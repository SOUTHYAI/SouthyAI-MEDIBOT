import { imageSrc } from "../lib/image.js";

export default function MessageBubble({ role, content, images, sources, onSpeak }) {
  return (
    <div className={`message-row ${role}`}>
      <div className="bubble">
        {images && images.length > 0 && (
          <div className="bubble-images">
            {images.map((img, i) => (
              <img key={i} src={imageSrc(img)} alt="Attached photo" />
            ))}
          </div>
        )}
        {content}
        {sources && sources.length > 0 && (
          <div className="bubble-sources">
            <span>Sources checked online:</span>
            {sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
            ))}
          </div>
        )}
        {role === "assistant" && onSpeak && (
          <button className="speak-btn" onClick={() => onSpeak(content)} title="Read this aloud">🔊 Read aloud</button>
        )}
      </div>
    </div>
  );
}
