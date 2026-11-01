import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble.jsx";
import EmergencyBanner from "./EmergencyBanner.jsx";
import { prepareImage, imageSrc } from "../lib/image.js";

const MODES = [
  { id: "wound", label: "🩹 Wound / burn / cut", ask: "Please look at this photo. What should I do?" },
  { id: "script", label: "📄 Prescription", ask: "Please read this prescription and explain it in plain language." },
  { id: "pills", label: "💊 Pills / medicine", ask: "Please read this medicine packaging or pills and tell me what you can." },
  { id: "other", label: "🔎 Something else", ask: "Please look at this photo and tell me what you can." }
];

const VOICE_LANGS = [
  { id: "en-ZA", label: "English" },
  { id: "zu-ZA", label: "isiZulu" },
  { id: "af-ZA", label: "Afrikaans" }
];

const SpeechRecognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export default function ChatWindow({ role, messages, onSend, sending, emergency, onMoreEmergency }) {
  const [draft, setDraft] = useState("");
  const [images, setImages] = useState([]);
  const [mode, setMode] = useState("wound");
  const [photoError, setPhotoError] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-ZA");
  const [voiceError, setVoiceError] = useState("");
  const [autoRead, setAutoRead] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const recRef = useRef(null);
  const baseRef = useRef("");
  const lastSpokenRef = useRef(-1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Read new assistant answers aloud when the toggle is on.
  useEffect(() => {
    if (!autoRead || !messages.length) return;
    const idx = messages.length - 1;
    const m = messages[idx];
    if (m.role === "assistant" && lastSpokenRef.current !== idx) {
      lastSpokenRef.current = idx;
      speak(m.content);
    }
  }, [messages, autoRead]);

  useEffect(() => () => {
    recRef.current?.stop?.();
    window.speechSynthesis?.cancel();
  }, []);

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voiceLang;
    window.speechSynthesis.speak(u);
  }

  async function handleFiles(e) {
    setPhotoError("");
    const files = Array.from(e.target.files || []).slice(0, 3 - images.length);
    e.target.value = "";
    try {
      const prepared = [];
      for (const f of files) prepared.push(await prepareImage(f));
      setImages((prev) => [...prev, ...prepared].slice(0, 3));
    } catch (err) {
      setPhotoError(err.message);
    }
  }

  function toggleMic() {
    setVoiceError("");
    if (!SpeechRecognition) {
      setVoiceError("Voice typing isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = voiceLang;
    rec.interimResults = true;
    rec.continuous = true;
    baseRef.current = draft ? draft.trim() + " " : "";
    rec.onresult = (e) => {
      const spoken = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setDraft(baseRef.current + spoken);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed") setVoiceError("Microphone blocked. Allow the mic for this site in your browser settings.");
      else if (e.error === "language-not-supported") setVoiceError("That language isn't supported for voice typing on this device.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setVoiceError("Voice typing stopped (" + e.error + ").");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (sending) return;
    if (listening) recRef.current?.stop();
    let text = draft.trim();
    if (!text && images.length === 0) return;
    if (!text && images.length) text = MODES.find((m) => m.id === mode).ask;
    onSend(text, images, images.length ? mode : null);
    setDraft("");
    setImages([]);
    setPhotoError("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      handleSubmit(e);
    }
  }

  const canSend = !sending && (draft.trim() || images.length > 0);

  return (
    <>
      <EmergencyBanner message={emergency} onMore={onMoreEmergency} />

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <h2>Ask something to get started</h2>
            <p>
              {role.id === "public"
                ? "Type or speak in your own words. You can also add a photo of a wound, burn, prescription or medicine."
                : `Ask a ${role.name.toLowerCase()}-level question. This section responds with more technical depth. Photos and voice work here too.`}
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            role={m.role}
            content={m.content}
            images={m.images}
            sources={m.sources}
            onSpeak={speak}
          />
        ))}

        {sending && (
          <div className="message-row assistant">
            <div className="bubble">
              <span className="typing-dots">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="composer">
        {images.length > 0 && (
          <div className="attach-area">
            <div className="attach-thumbs">
              {images.map((img, i) => (
                <div className="thumb" key={i}>
                  <img src={imageSrc(img)} alt="Photo to send" />
                  <button type="button" aria-label="Remove photo" onClick={() => setImages(images.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
            <div className="mode-chips">
              <span>What is it?</span>
              {MODES.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className={`chip ${mode === m.id ? "active" : ""}`}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFiles}
          />
          <button
            type="button"
            className="icon-button"
            title="Add a photo"
            aria-label="Add a photo"
            disabled={images.length >= 3}
            onClick={() => fileRef.current?.click()}
          >
            📷
          </button>
          <button
            type="button"
            className={`icon-button ${listening ? "listening" : ""}`}
            title={listening ? "Stop voice typing" : "Speak instead of typing"}
            aria-label="Voice typing"
            onClick={toggleMic}
          >
            🎤
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              listening
                ? "Listening… speak now"
                : role.id === "public"
                ? "Type your question…"
                : `Type a ${role.name.toLowerCase()} question…`
            }
            rows={1}
          />
          <button className="send-button" type="submit" disabled={!canSend}>
            Send
          </button>
        </form>

        <div className="voice-row">
          <label>
            Voice language{" "}
            <select value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)} disabled={listening}>
              {VOICE_LANGS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </label>
          <label className="auto-read">
            <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
            Read answers aloud
          </label>
        </div>
        {(photoError || voiceError) && <p className="composer-error">{photoError || voiceError}</p>}

        <p className="composer-footnote">
          General information only, not a diagnosis. Photos are sent to the AI service to be read and are not stored by Medibot.
          In an emergency call 112 or 10177.
        </p>
      </div>
    </>
  );
}
