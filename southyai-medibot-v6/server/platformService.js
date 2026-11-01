// Platform owner tools (you, SOUTHYAI): create hospitals/practices and manage their licence.
// Protected by PLATFORM_KEY. Never shown to hospital staff.
import { query, ensureSchema, dbConfigured } from "./db.js";
import * as sec from "./security.js";
import { audit } from "./staffService.js";

const err = (status, message) => ({ status, json: { error: message } });

export async function handlePlatform(req) {
  if (req.method !== "POST") return err(405, "Use POST");
  if (!dbConfigured()) return err(503, "Database isn't connected yet (DATABASE_URL).");
  if (!sec.secret()) return err(503, "AUTH_SECRET is missing (24+ characters).");
  const key = process.env.PLATFORM_KEY || "";
  if (key.length < 24) return err(503, "PLATFORM_KEY is missing (24+ characters).");

  await ensureSchema();
  const ip = req.ip || null;

  const { rows: fails } = await query(
    "SELECT count(*)::int AS n FROM audit_log WHERE ip=$1 AND action='platform.fail' AND at > now() - interval '15 minutes'",
    [ip]
  );
  if (fails[0].n >= 10) return err(429, "Too many attempts. Wait 15 minutes.");

  if (!sec.safeEqual(req.headers["x-platform-key"] || "", key)) {
    await audit({ action: "platform.fail", ip });
    return err(403, "Wrong platform key.");
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};

  switch (body.action) {
    case "org.create": {
      const name = String(body.name || "").trim();
      const code = String(body.code || "").trim().toUpperCase();
      const adminNumber = String(body.adminStaffNumber || "").trim().toUpperCase();
      const adminName = String(body.adminName || "").trim();
      if (name.length < 2) return err(400, "Enter the organisation name.");
      if (!/^[A-Z0-9-]{3,20}$/.test(code)) return err(400, "Org code: 3 to 20 letters, numbers or dashes.");
      if (!/^[A-Z0-9][A-Z0-9._\/-]{2,29}$/.test(adminNumber)) return err(400, "Admin staff number: 3 to 30 letters or numbers.");
      if (adminName.length < 2) return err(400, "Enter the administrator's name.");
      try {
        const { rows } = await query(
          "INSERT INTO organisations (name, code, licence_status, licence_expires) VALUES ($1,$2,'active',$3) RETURNING id, name, code",
          [name, code, body.licenceExpires || null]
        );
        const activationCode = sec.newActivationCode();
        await query(
          `INSERT INTO staff (org_id, staff_number, full_name, role, activation_hash, activation_expires)
           VALUES ($1,$2,$3,'admin',$4, now() + interval '72 hours')`,
          [rows[0].id, adminNumber, adminName, sec.hashActivation(activationCode)]
        );
        await audit({ orgId: rows[0].id, action: "platform.org_create", detail: code, ip });
        return { status: 200, json: { org: rows[0], adminStaffNumber: adminNumber, activationCode, validHours: 72 } };
      } catch (e) {
        if (e.code === "23505" || String(e.message).includes("duplicate")) return err(409, "That organisation code is already taken.");
        throw e;
      }
    }

    case "org.list": {
      const { rows } = await query(
        `SELECT o.name, o.code, o.licence_status, o.licence_expires, o.created_at,
                (SELECT count(*)::int FROM staff s WHERE s.org_id=o.id) AS staff_count
           FROM organisations o ORDER BY o.created_at DESC`
      );
      return { status: 200, json: { orgs: rows } };
    }

    case "org.setLicence": {
      const code = String(body.code || "").trim().toUpperCase();
      const status = body.status === "suspended" ? "suspended" : "active";
      const expires = body.expires ? String(body.expires) : null;
      if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return err(400, "Use the date format YYYY-MM-DD.");
      const { rowCount } = await query(
        "UPDATE organisations SET licence_status=$1, licence_expires=$2 WHERE code=$3", [status, expires, code]
      );
      if (!rowCount) return err(404, "No organisation with that code.");
      if (status === "suspended") {
        await query("DELETE FROM sessions WHERE staff_id IN (SELECT s.id FROM staff s JOIN organisations o ON o.id=s.org_id WHERE o.code=$1)", [code]);
      }
      await audit({ action: "platform.licence", detail: `${code} ${status} ${expires || ""}`, ip });
      return { status: 200, json: { ok: true } };
    }
  }
  return err(400, "Unknown action.");
}
