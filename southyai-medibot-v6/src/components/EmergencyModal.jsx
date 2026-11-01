import { useState } from "react";
import { EMERGENCY_NUMBERS, HELP_LINES } from "../lib/emergency.js";

export default function EmergencyModal({ onClose }) {
  const [loc, setLoc] = useState(null);
  const [locMsg, setLocMsg] = useState("");

  function getLocation() {
    if (!navigator.geolocation) {
      setLocMsg("This browser can't share a location. Tell the operator your street, suburb and a landmark.");
      return;
    }
    setLocMsg("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const text = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setLoc({ text, link: `https://maps.google.com/?q=${latitude},${longitude}` });
        setLocMsg("");
      },
      () => setLocMsg("Couldn't get your location. Tell the operator your street, suburb and a landmark."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function copyLoc() {
    try {
      await navigator.clipboard.writeText(`${loc.text} ${loc.link}`);
      setLocMsg("Copied. You can paste it in a message.");
    } catch {
      setLocMsg("Couldn't copy. Read the numbers out to the operator.");
    }
  }

  return (
    <div className="gate-overlay" onClick={onClose}>
      <div className="gate-card emergency-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2>Emergency help</h2>
        <p className="em-lead">
          Tap a number and your phone opens the dialler with it filled in. Then press call.
          Medibot can't place the call for you.
        </p>

        <div className="em-list">
          {EMERGENCY_NUMBERS.map((n) => (
            <a key={n.number} className={`em-call ${n.primary ? "primary" : ""}`} href={`tel:${n.number}`}>
              <span className="em-label">{n.label}<small>{n.note}</small></span>
              <span className="em-num">{n.display || n.number}</span>
            </a>
          ))}
        </div>

        <h3 className="em-sub">Other help lines</h3>
        <div className="em-list">
          {HELP_LINES.map((n) => (
            <a key={n.number} className="em-call" href={`tel:${n.number}`}>
              <span className="em-label">{n.label}</span>
              <span className="em-num">{n.display}</span>
            </a>
          ))}
        </div>

        <h3 className="em-sub">What to tell them</h3>
        <p className="em-tips">
          What happened, exactly where you are, the patient's age, whether they are awake and breathing.
          Stay on the line and follow their instructions.
        </p>

        <div className="em-loc">
          {!loc && <button onClick={getLocation}>Show my location</button>}
          {loc && (
            <>
              <strong>{loc.text}</strong>
              <button onClick={copyLoc}>Copy location link</button>
            </>
          )}
          {locMsg && <span className="em-msg">{locMsg}</span>}
        </div>

        <div className="gate-actions">
          <button className="confirm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
