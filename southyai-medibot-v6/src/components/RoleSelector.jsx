import { ROLES } from "../lib/roles.js";

export default function RoleSelector({ activeRole, onSelect, session, onSignIn, onSignOut, onAdmin, adminActive }) {
  const staff = session?.staff;
  return (
    <aside className="sidebar">
      <p className="brand">SOUTHYAI</p>
      <p className="brand-tagline">
        Everyday health information, with sections built for the people who use them.
      </p>

      <ul className="role-list">
        {ROLES.map((role) => {
          const locked = role.gated && staff?.role !== role.id;
          return (
            <li key={role.id}>
              <button
                className={`role-button ${activeRole === role.id && !adminActive ? "active" : ""}`}
                onClick={() => onSelect(role.id)}
              >
                <span className="role-name">{role.name}{role.gated && <span className="lock">{locked ? " 🔒" : " ✓"}</span>}</span>
                <span className="role-desc">{role.shortDesc}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="staff-box">
        {staff ? (
          <>
            <div className="staff-who">
              <strong>{staff.name}</strong>
              <span>{staff.role === "admin" ? "Administrator" : staff.role} · {session.org.name}</span>
            </div>
            {staff.role === "admin" && (
              <button className={`staff-btn ${adminActive ? "active" : ""}`} onClick={onAdmin}>Manage staff</button>
            )}
            <button className="staff-btn" onClick={onSignOut}>Sign out</button>
          </>
        ) : (
          <button className="staff-btn" onClick={() => onSignIn(null)}>Staff sign-in</button>
        )}
      </div>

      <div className="sidebar-footer">
        SOUTHYAI MediBot gives general health information and decision support.
        It does not diagnose, prescribe, or replace a qualified healthcare
        professional. In an emergency, contact your local emergency services.
      </div>
    </aside>
  );
}
