export default function EmergencyBanner({ message, onMore }) {
  if (!message) return null;
  const urgent = message.level === "urgent";
  return (
    <div className={`emergency-banner ${urgent ? "urgent" : ""}`}>
      <span className="icon">{urgent ? "!" : "⚠"}</span>
      <div>
        <h3>{message.title}</h3>
        <p>{message.body}</p>
        <div className="banner-actions">
          <a className="call-btn" href="tel:112">Call 112</a>
          <a className="call-btn" href="tel:10177">Call 10177 ambulance</a>
          <button className="call-more" onClick={onMore}>More numbers</button>
        </div>
      </div>
    </div>
  );
}
