// The full 3D anatomy atlas lives in /public/anatomy and is shown here as one screen of Medibot.
export default function AtlasFrame({ organs = [] }) {
  const qs = new URLSearchParams({ embed: "1" });
  if (organs.length) qs.set("organs", organs.join(","));
  return (
    <iframe
      key={organs.join(",")}
      className="atlas-frame"
      title="3D human anatomy atlas"
      src={`/anatomy/index.html?${qs.toString()}`}
      allow="fullscreen"
    />
  );
}
