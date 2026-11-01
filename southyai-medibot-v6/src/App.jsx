import { useEffect, useRef, useState } from "react";
import RoleSelector from "./components/RoleSelector.jsx";
import StaffLogin from "./components/StaffLogin.jsx";
import AdminPanel from "./components/AdminPanel.jsx";
import { staffApi } from "./lib/api.js";
import ChatWindow from "./components/ChatWindow.jsx";
import AtlasFrame from "./components/AtlasFrame.jsx";
import EmergencyModal from "./components/EmergencyModal.jsx";
import { ROLES, getRole } from "./lib/roles.js";
import { organName } from "./lib/organNames.js";
import "./anatomy.css";

export default function App() {
  const [activeRoleId, setActiveRoleId] = useState("public");
  const [session, setSession] = useState(null);
  const [loginFor, setLoginFor] = useState(undefined); // undefined = closed, null = open (no section), "doctor" etc.
  const idleTimer = useRef(null);
  const [conversations, setConversations] = useState(
    Object.fromEntries(ROLES.map((r) => [r.id, []]))
  );
  const [sending, setSending] = useState(false);
  const [emergency, setEmergency] = useState(null);
  const [view, setView] = useState("chat");
  const [highlight, setHighlight] = useState([]);
  const [showEmergency, setShowEmergency] = useState(false);

  const activeRole = getRole(activeRoleId);
  const messages = conversations[activeRoleId];

  // Who is signed in? (the login cookie lives in the browser, the server decides)
  useEffect(() => {
    staffApi("me").then((r) => setSession(r.staff ? r : null)).catch(() => {});
  }, []);

  function clearStaffChats() {
    setConversations(Object.fromEntries(ROLES.map((r) => [r.id, []])));
  }

  async function signOut() {
    try { await staffApi("logout"); } catch { /* ignore */ }
    setSession(null);
    clearStaffChats();
    setActiveRoleId("public");
    setView("chat");
    setEmergency(null);
    setHighlight([]);
  }

  // Auto sign-out after 25 minutes with no activity (the server also enforces 30).
  useEffect(() => {
    if (!session) return undefined;
    const reset = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(signOut, 25 * 60 * 1000);
    };
    reset();
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      clearTimeout(idleTimer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session]);

  function handleRoleSelect(roleId) {
    const role = getRole(roleId);
    if (role.gated && session?.staff?.role !== roleId) {
      setLoginFor(roleId);
      return;
    }
    setEmergency(null);
    setHighlight([]);
    setActiveRoleId(roleId);
    setView("chat");
  }

  function handleLoggedIn(data) {
    setSession(data);
    setLoginFor(undefined);
    clearStaffChats();
    setEmergency(null);
    setHighlight([]);
    const r = data.staff.role;
    if (r === "admin") {
      setView("admin");
    } else {
      setActiveRoleId(r);
      setView("chat");
    }
  }

  async function handleSend(text, images = [], mode = null) {
    const userMessage = { role: "user", content: text, images, mode };
    const nextMessages = [...messages, userMessage];

    setConversations((prev) => ({ ...prev, [activeRoleId]: nextMessages }));
    setSending(true);
    setEmergency(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: activeRoleId,
          mode,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
            images: m.images && m.images.length ? m.images : undefined
          }))
        })
      });

      const data = await res.json();

      if (res.status === 401 && activeRole.gated) {
        setSession(null);
        setActiveRoleId("public");
        setLoginFor(activeRoleId);
        throw new Error("Your session ended. Please sign in again.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      if (data.emergency) {
        setEmergency(data.emergency);
      }

      setHighlight(Array.isArray(data.organs) ? data.organs : []);

      const replyMessage = {
        role: "assistant",
        content: data.reply || "(No response)",
        sources: Array.isArray(data.sources) ? data.sources : []
      };
      setConversations((prev) => ({
        ...prev,
        [activeRoleId]: [...nextMessages, replyMessage]
      }));
    } catch (err) {
      const errorMessage = {
        role: "assistant",
        content:
          "Something went wrong reaching the assistant. Please try again in a moment. " +
          "(" + err.message + ")"
      };
      setConversations((prev) => ({
        ...prev,
        [activeRoleId]: [...nextMessages, errorMessage]
      }));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="app-shell">
      <RoleSelector
        activeRole={activeRoleId}
        onSelect={handleRoleSelect}
        session={session}
        onSignIn={() => setLoginFor(null)}
        onSignOut={signOut}
        onAdmin={() => setView("admin")}
        adminActive={view === "admin"}
      />

      <main className="main">
        <div className="view-tabs">
          <button
            className={`view-tab ${view === "chat" ? "active" : ""}`}
            onClick={() => setView("chat")}
          >
            Chat
          </button>
          <button
            className={`view-tab ${view === "anatomy" ? "active" : ""}`}
            onClick={() => setView("anatomy")}
          >
            3D Anatomy
          </button>
          <button className="emergency-btn" onClick={() => setShowEmergency(true)}>
            🚨 Emergency
          </button>
        </div>

        {view === "admin" && session?.staff?.role === "admin" ? (
          <AdminPanel session={session} />
        ) : view === "chat" ? (
          <>
            <header className="main-header">
              {activeRole.gated && <span className="role-scope-tag">Professional section</span>}
              <h1>{activeRole.name}</h1>
              <p>{activeRole.headerDesc}</p>
            </header>

            {highlight.length > 0 && (
              <div className="organ-bar">
                <span className="organ-bar-label">Body parts involved:</span>
                {highlight.map((id) => (
                  <span key={id} className="organ-bar-chip">{organName(id)}</span>
                ))}
                <button className="organ-bar-btn" onClick={() => setView("anatomy")}>
                  View on 3D body
                </button>
              </div>
            )}

            <ChatWindow
              role={activeRole}
              messages={messages}
              onSend={handleSend}
              sending={sending}
              emergency={emergency}
              onMoreEmergency={() => setShowEmergency(true)}
            />
          </>
        ) : (
          <AtlasFrame organs={highlight} />
        )}

        <footer className="credit">
          3D anatomy: <a href="https://github.com/Z-Anatomy/Models-of-human-anatomy" target="_blank" rel="noopener noreferrer">Z-Anatomy, the libre 3D atlas of anatomy</a>,
          built on BodyParts3D (DBCLS). Definitions from Wikipedia via Z-Anatomy. Licence: CC BY-SA 4.0.
        </footer>
      </main>

      {showEmergency && <EmergencyModal onClose={() => setShowEmergency(false)} />}

      {loginFor !== undefined && (
        <StaffLogin
          wantedRole={loginFor}
          onDone={handleLoggedIn}
          onCancel={() => setLoginFor(undefined)}
        />
      )}
    </div>
  );
}
