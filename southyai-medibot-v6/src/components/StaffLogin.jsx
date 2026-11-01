import { useState } from "react";
import { staffApi } from "../lib/api.js";

export default function StaffLogin({ wantedRole, onDone, onCancel }) {
  const [tab, setTab] = useState("signin");
  const [orgCode, setOrgCode] = useState("");
  const [staffNumber, setStaffNumber] = useState("");
  const [password, setPassword] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (tab === "activate" && password !== password2) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const data =
        tab === "signin"
          ? await staffApi("login", { orgCode, staffNumber, password })
          : await staffApi("activate", { orgCode, staffNumber, activationCode, newPassword: password });
      onDone(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate-overlay">
      <div className="gate-card login-card" role="dialog" aria-modal="true">
        <h2>Staff access</h2>
        <p>
          {wantedRole
            ? `The ${wantedRole} section is for staff of licensed hospitals and practices.`
            : "For staff of licensed hospitals and practices."}{" "}
          Your employer creates your access.
        </p>

        <div className="login-tabs">
          <button type="button" className={tab === "signin" ? "active" : ""} onClick={() => { setTab("signin"); setError(""); }}>Sign in</button>
          <button type="button" className={tab === "activate" ? "active" : ""} onClick={() => { setTab("activate"); setError(""); }}>First time here</button>
        </div>

        <form onSubmit={submit} autoComplete="off">
          <label>Organisation code
            <input value={orgCode} onChange={(e) => setOrgCode(e.target.value)} placeholder="e.g. NETCARE-DBN" autoCapitalize="characters" required />
          </label>
          <label>Staff number
            <input value={staffNumber} onChange={(e) => setStaffNumber(e.target.value)} placeholder="e.g. H227867GHZN" autoCapitalize="characters" required />
          </label>

          {tab === "activate" && (
            <label>Activation code from your employer
              <input value={activationCode} onChange={(e) => setActivationCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" required />
            </label>
          )}

          <label>{tab === "activate" ? "Choose your password" : "Password"}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === "activate" ? "new-password" : "current-password"} required />
          </label>

          {tab === "activate" && (
            <>
              <label>Repeat password
                <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" required />
              </label>
              <p className="login-hint">At least 10 characters, with letters and numbers. Only you should know it.</p>
            </>
          )}

          {error && <p className="composer-error login-error">{error}</p>}

          <div className="gate-actions">
            <button type="button" className="cancel" onClick={onCancel}>Cancel</button>
            <button type="submit" className="confirm" disabled={busy}>
              {busy ? "Please wait…" : tab === "signin" ? "Sign in" : "Activate and sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
