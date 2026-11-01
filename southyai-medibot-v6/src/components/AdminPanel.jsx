import { useEffect, useState } from "react";
import { staffApi } from "../lib/api.js";

const ROLE_LABEL = { admin: "Administrator", doctor: "Doctor", nurse: "Nurse", pharmacist: "Pharmacist" };

function fmt(d) {
  if (!d) return "never";
  return new Date(d).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminPanel({ session }) {
  const [staff, setStaff] = useState([]);
  const [audit, setAudit] = useState(null);
  const [form, setForm] = useState({ staffNumber: "", fullName: "", role: "nurse" });
  const [issued, setIssued] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setStaff((await staffApi("admin.list")).staff);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setError(""); setIssued(null); setBusy(true);
    try {
      const r = await staffApi("admin.add", form);
      setIssued({ who: `${r.staff.full_name} (${r.staff.staff_number})`, code: r.activationCode, hours: r.validHours });
      setForm({ staffNumber: "", fullName: "", role: form.role });
      load();
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function reset(s) {
    if (!window.confirm(`Reset access for ${s.full_name}? Their password stops working and they get a new activation code.`)) return;
    setError(""); setIssued(null);
    try {
      const r = await staffApi("admin.resetCode", { staffId: s.id });
      setIssued({ who: `${s.full_name} (${s.staff_number})`, code: r.activationCode, hours: r.validHours });
      load();
    } catch (err) { setError(err.message); }
  }

  async function toggle(s) {
    setError("");
    try {
      await staffApi("admin.setStatus", { staffId: s.id, status: s.status === "disabled" ? "enable" : "disabled" });
      load();
    } catch (err) { setError(err.message); }
  }

  async function showAudit() {
    setError("");
    try { setAudit((await staffApi("admin.audit")).entries); } catch (err) { setError(err.message); }
  }

  return (
    <div className="admin-panel">
      <h1>{session.org.name}</h1>
      <p className="admin-sub">
        Organisation code: <strong>{session.org.code}</strong>. Staff sign in with this code, their staff number and their own password.
      </p>

      {error && <p className="composer-error">{error}</p>}

      {issued && (
        <div className="issued-box">
          <strong>Activation code for {issued.who}</strong>
          <code>{issued.code}</code>
          <span>
            Give this to them privately. It is shown only once, works once and expires in {issued.hours} hours.
            They use "First time here" on the sign-in screen.
          </span>
          <button onClick={() => navigator.clipboard?.writeText(issued.code)}>Copy code</button>
        </div>
      )}

      <h2>Add a staff member</h2>
      <form className="admin-form" onSubmit={add}>
        <input placeholder="Staff number (e.g. H227867GHZN)" value={form.staffNumber} onChange={(e) => setForm({ ...form, staffNumber: e.target.value })} required />
        <input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
          <option value="pharmacist">Pharmacist</option>
          <option value="admin">Administrator</option>
        </select>
        <button type="submit" disabled={busy}>Create access code</button>
      </form>

      <h2>Your staff</h2>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Staff no.</th><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.staff_number}</td>
                <td>{s.full_name}</td>
                <td>{ROLE_LABEL[s.role]}</td>
                <td><span className={`pill ${s.status}`}>{s.status === "pending" ? (s.code_active ? "waiting to activate" : "code expired") : s.status}</span></td>
                <td>{fmt(s.last_login)}</td>
                <td className="row-actions">
                  {s.staff_number !== session.staff.staffNumber && (
                    <>
                      <button onClick={() => reset(s)}>New code</button>
                      <button onClick={() => toggle(s)}>{s.status === "disabled" ? "Enable" : "Disable"}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!staff.length && <tr><td colSpan="6">No staff yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Activity log</h2>
      {!audit ? (
        <button className="admin-link" onClick={showAudit}>Show the last 100 events</button>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Staff no.</th><th>What</th><th>Details</th></tr></thead>
            <tbody>
              {audit.map((a, i) => (
                <tr key={i}><td>{fmt(a.at)}</td><td>{a.staff_number || ""}</td><td>{a.action}</td><td>{a.detail || ""}</td></tr>
              ))}
              {!audit.length && <tr><td colSpan="4">Nothing yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
