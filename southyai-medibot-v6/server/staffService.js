// Staff accounts: employer-created, activation-code based, role-locked.
import { query, ensureSchema, dbConfigured } from "./db.js";
import * as sec from "./security.js";

const SESSION_HOURS = 8;
const IDLE_MINUTES = 30;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const ACTIVATION_HOURS = 72;
const ROLES = ["admin", "doctor", "nurse", "pharmacist"];
export const GATED_ROLES = new Set(["doctor", "nurse", "pharmacist"]);

const GENERIC_LOGIN_FAIL =
  "Those details don't match, or the account isn't activated yet. Check your organisation code, staff number and password.";

const normStaff = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "");
const normOrg = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "");
const validStaffNumber = (s) => /^[A-Z0-9][A-Z0-9._\/-]{2,29}$/.test(s);

function isSecure(req) {
  return req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function audit({ orgId = null, staffId = null, staffNumber = null, action, detail = null, ip = null }) {
  try {
    await query(
      "INSERT INTO audit_log (org_id, staff_id, staff_number, action, detail, ip) VALUES ($1,$2,$3,$4,$5,$6)",
      [orgId, staffId, staffNumber, action, detail, ip]
    );
  } catch (e) {
    console.error("audit failed", e.message);
  }
}

function licenceProblem(org) {
  if (org.licence_status !== "active") return "Your organisation's licence is not active. Please contact SOUTHYAI.";
  if (org.licence_expires && new Date(org.licence_expires) < new Date(new Date().toDateString())) {
    return "Your organisation's licence has expired. Please contact SOUTHYAI.";
  }
  return null;
}

function publicSession(row) {
  return {
    staff: {
      id: row.staff_id ?? row.id,
      name: row.full_name,
      role: row.role,
      staffNumber: row.staff_number,
      orgId: row.org_id
    },
    org: { id: row.org_id, name: row.org_name, code: row.org_code }
  };
}

// Returns { staff, org } or null. Used by every protected route (including the AI chat).
export async function getSession(req) {
  if (!dbConfigured() || !sec.secret()) return null;
  const token = sec.parseCookies(req.headers.cookie || "").mb_session;
  if (!token) return null;
  await ensureSchema();
  const { rows } = await query(
    `SELECT st.token_hash, st.expires_at, st.last_seen,
            s.id AS staff_id, s.org_id, s.staff_number, s.full_name, s.role, s.status,
            o.name AS org_name, o.code AS org_code, o.licence_status, o.licence_expires
       FROM sessions st
       JOIN staff s ON s.id = st.staff_id
       JOIN organisations o ON o.id = s.org_id
      WHERE st.token_hash = $1`,
    [sec.hashToken(token)]
  );
  const row = rows[0];
  if (!row) return null;
  const now = Date.now();
  const idleOk = now - new Date(row.last_seen).getTime() < IDLE_MINUTES * 60000;
  const absOk = new Date(row.expires_at).getTime() > now;
  if (!idleOk || !absOk || row.status !== "active" || licenceProblem(row)) {
    await query("DELETE FROM sessions WHERE token_hash=$1", [row.token_hash]);
    return null;
  }
  if (now - new Date(row.last_seen).getTime() > 60000) {
    await query("UPDATE sessions SET last_seen=now() WHERE token_hash=$1", [row.token_hash]);
  }
  return publicSession(row);
}

async function startSession(req, staffRow) {
  const token = sec.newToken();
  const expires = new Date(Date.now() + SESSION_HOURS * 3600000);
  await query("INSERT INTO sessions (token_hash, staff_id, expires_at) VALUES ($1,$2,$3)", [
    sec.hashToken(token), staffRow.id, expires
  ]);
  await query("DELETE FROM sessions WHERE expires_at < now() OR last_seen < now() - interval '1 day'");
  return sec.sessionCookie(token, { secure: isSecure(req), maxAge: SESSION_HOURS * 3600 });
}

async function tooManyFailsFromIp(ip, action) {
  if (!ip) return false;
  const { rows } = await query(
    "SELECT count(*)::int AS n FROM audit_log WHERE ip=$1 AND action=$2 AND at > now() - interval '15 minutes'",
    [ip, action]
  );
  return rows[0].n >= 20;
}

async function findStaff(orgCode, staffNumber) {
  const { rows } = await query(
    `SELECT s.*, o.name AS org_name, o.code AS org_code, o.licence_status, o.licence_expires
       FROM staff s JOIN organisations o ON o.id = s.org_id
      WHERE o.code = $1 AND s.staff_number = $2`,
    [orgCode, staffNumber]
  );
  return rows[0] || null;
}

const ok = (json, cookie) => ({ status: 200, json, cookie });
const err = (status, message) => ({ status, json: { error: message } });

export async function handleStaff(req) {
  if (req.method !== "POST") return err(405, "Use POST");
  if (!dbConfigured()) {
    return err(503, "The staff database isn't connected yet. Add DATABASE_URL (see the README), then redeploy.");
  }
  if (!sec.secret()) return err(503, "AUTH_SECRET is missing (needs 24+ characters). Add it in your hosting settings.");
  if (!sameOrigin(req)) return err(403, "Blocked: request came from another site.");

  await ensureSchema();
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const ip = req.ip || null;

  switch (body.action) {
    case "me": {
      const s = await getSession(req);
      return ok(s || { staff: null });
    }

    case "login": {
      if (await tooManyFailsFromIp(ip, "login.fail")) return err(429, "Too many attempts. Please wait 15 minutes.");
      const orgCode = normOrg(body.orgCode), staffNumber = normStaff(body.staffNumber);
      const password = String(body.password || "");
      const staff = orgCode && staffNumber ? await findStaff(orgCode, staffNumber) : null;

      if (staff && staff.locked_until && new Date(staff.locked_until) > new Date()) {
        return err(423, "Too many wrong attempts. This account is locked for 15 minutes.");
      }

      const usable = staff && staff.status === "active" && staff.password_hash;
      const good = await sec.verifyPassword(password, usable ? staff.password_hash : sec.DUMMY_HASH);
      if (!usable || !good) {
        if (staff) {
          const fails = staff.failed_attempts + 1;
          const lock = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
          await query("UPDATE staff SET failed_attempts=$1, locked_until=$2 WHERE id=$3", [
            lock ? 0 : fails, lock, staff.id
          ]);
        }
        await audit({ orgId: staff?.org_id, staffId: staff?.id, staffNumber: staffNumber || null, action: "login.fail", ip });
        return err(401, GENERIC_LOGIN_FAIL);
      }

      const problem = licenceProblem(staff);
      if (problem) {
        await audit({ orgId: staff.org_id, staffId: staff.id, staffNumber, action: "login.blocked_licence", ip });
        return err(403, problem);
      }

      await query("UPDATE staff SET failed_attempts=0, locked_until=NULL, last_login=now() WHERE id=$1", [staff.id]);
      const cookie = await startSession(req, staff);
      await audit({ orgId: staff.org_id, staffId: staff.id, staffNumber, action: "login.ok", ip });
      return ok(publicSession(staff), cookie);
    }

    case "activate": {
      if (await tooManyFailsFromIp(ip, "activate.fail")) return err(429, "Too many attempts. Please wait 15 minutes.");
      const orgCode = normOrg(body.orgCode), staffNumber = normStaff(body.staffNumber);
      const staff = orgCode && staffNumber ? await findStaff(orgCode, staffNumber) : null;
      const bad = "That activation code isn't valid or has expired. Ask your administrator for a new one.";

      if (staff && staff.locked_until && new Date(staff.locked_until) > new Date()) {
        return err(423, "Too many wrong attempts. Try again in 15 minutes.");
      }
      const valid =
        staff && staff.status === "pending" && staff.activation_hash &&
        staff.activation_expires && new Date(staff.activation_expires) > new Date() &&
        sec.safeEqual(sec.hashActivation(body.activationCode), staff.activation_hash);

      if (!valid) {
        if (staff) {
          const fails = staff.failed_attempts + 1;
          const lock = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;
          await query("UPDATE staff SET failed_attempts=$1, locked_until=$2 WHERE id=$3", [lock ? 0 : fails, lock, staff.id]);
        }
        await audit({ orgId: staff?.org_id, staffId: staff?.id, staffNumber: staffNumber || null, action: "activate.fail", ip });
        return err(400, bad);
      }

      const problem = licenceProblem(staff);
      if (problem) return err(403, problem);
      const pwProblem = sec.passwordProblem(String(body.newPassword || ""), staffNumber);
      if (pwProblem) return err(400, pwProblem);

      const hash = await sec.hashPassword(String(body.newPassword));
      await query(
        `UPDATE staff SET password_hash=$1, status='active', activation_hash=NULL, activation_expires=NULL,
                failed_attempts=0, locked_until=NULL, last_login=now() WHERE id=$2`,
        [hash, staff.id]
      );
      const cookie = await startSession(req, staff);
      await audit({ orgId: staff.org_id, staffId: staff.id, staffNumber, action: "activate.ok", ip });
      return ok(publicSession(staff), cookie);
    }

    case "logout": {
      const token = sec.parseCookies(req.headers.cookie || "").mb_session;
      if (token) {
        const s = await getSession(req);
        await query("DELETE FROM sessions WHERE token_hash=$1", [sec.hashToken(token)]);
        if (s) await audit({ orgId: s.org.id, staffId: s.staff.id, staffNumber: s.staff.staffNumber, action: "logout", ip });
      }
      return ok({ ok: true }, sec.sessionCookie("", { secure: isSecure(req), maxAge: 0 }));
    }
  }

  // ---- everything below needs an administrator ----
  const session = await getSession(req);
  if (!session) return err(401, "Please sign in.");
  if (session.staff.role !== "admin") return err(403, "Administrators only.");
  const orgId = session.org.id;
  const me = session.staff;

  switch (body.action) {
    case "admin.list": {
      const { rows } = await query(
        `SELECT id, staff_number, full_name, role, status, last_login, created_at,
                (activation_expires IS NOT NULL AND activation_expires > now()) AS code_active
           FROM staff WHERE org_id=$1 ORDER BY role, full_name`,
        [orgId]
      );
      return ok({ staff: rows });
    }

    case "admin.add": {
      const staffNumber = normStaff(body.staffNumber);
      const fullName = String(body.fullName || "").trim();
      const role = String(body.role || "");
      if (!validStaffNumber(staffNumber)) return err(400, "Staff number should be 3 to 30 letters or numbers.");
      if (fullName.length < 2 || fullName.length > 100) return err(400, "Enter the staff member's full name.");
      if (!ROLES.includes(role)) return err(400, "Choose a role.");
      const code = sec.newActivationCode();
      try {
        const { rows } = await query(
          `INSERT INTO staff (org_id, staff_number, full_name, role, activation_hash, activation_expires, created_by)
           VALUES ($1,$2,$3,$4,$5, now() + interval '${ACTIVATION_HOURS} hours', $6)
           RETURNING id, staff_number, full_name, role, status`,
          [orgId, staffNumber, fullName, role, sec.hashActivation(code), me.id]
        );
        await audit({ orgId, staffId: me.id, staffNumber: me.staffNumber, action: "staff.add", detail: `${staffNumber} as ${role}`, ip });
        return ok({ staff: rows[0], activationCode: code, validHours: ACTIVATION_HOURS });
      } catch (e) {
        if (String(e.message).includes("duplicate") || e.code === "23505") return err(409, "That staff number already exists in your organisation.");
        throw e;
      }
    }

    case "admin.resetCode": {
      const id = Number(body.staffId);
      const { rows } = await query("SELECT id, staff_number FROM staff WHERE id=$1 AND org_id=$2", [id, orgId]);
      if (!rows[0]) return err(404, "Staff member not found.");
      if (rows[0].id === me.id) return err(400, "Ask another administrator to reset your own access.");
      const code = sec.newActivationCode();
      await query(
        `UPDATE staff SET password_hash=NULL, status='pending', activation_hash=$1,
                activation_expires = now() + interval '${ACTIVATION_HOURS} hours', failed_attempts=0, locked_until=NULL
          WHERE id=$2`,
        [sec.hashActivation(code), id]
      );
      await query("DELETE FROM sessions WHERE staff_id=$1", [id]);
      await audit({ orgId, staffId: me.id, staffNumber: me.staffNumber, action: "staff.reset", detail: rows[0].staff_number, ip });
      return ok({ activationCode: code, validHours: ACTIVATION_HOURS });
    }

    case "admin.setStatus": {
      const id = Number(body.staffId);
      const want = body.status === "disabled" ? "disabled" : "enable";
      const { rows } = await query("SELECT id, staff_number, password_hash FROM staff WHERE id=$1 AND org_id=$2", [id, orgId]);
      if (!rows[0]) return err(404, "Staff member not found.");
      if (rows[0].id === me.id) return err(400, "You can't disable your own account.");
      const status = want === "disabled" ? "disabled" : rows[0].password_hash ? "active" : "pending";
      await query("UPDATE staff SET status=$1 WHERE id=$2", [status, id]);
      if (status === "disabled") await query("DELETE FROM sessions WHERE staff_id=$1", [id]);
      await audit({ orgId, staffId: me.id, staffNumber: me.staffNumber, action: "staff." + status, detail: rows[0].staff_number, ip });
      return ok({ status });
    }

    case "admin.audit": {
      const { rows } = await query(
        "SELECT at, staff_number, action, detail, ip FROM audit_log WHERE org_id=$1 ORDER BY at DESC LIMIT 100",
        [orgId]
      );
      return ok({ entries: rows });
    }
  }

  return err(400, "Unknown action.");
}
