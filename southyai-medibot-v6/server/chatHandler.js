// Shared by the local Express server (server/index.js) and the Vercel function (api/chat.js).
import { checkEmergency, EMERGENCY_MESSAGE, URGENT_MESSAGE } from "./safetyLayer.js";
import { getSystemPrompt, imageInstruction } from "./systemPrompts.js";
import { TAG_INSTRUCTION, extractTags } from "./organTags.js";
import { generateReply, aiConfigured, MISSING_KEY_MESSAGE, AIError } from "./aiProvider.js";
import { GATED_ROLES } from "./staffService.js";

const VALID_ROLES = new Set(["public", "doctor", "nurse", "pharmacist"]);
const VALID_MODES = new Set(["wound", "script", "pills", "other"]);
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGES_PER_MESSAGE = 3;
const MAX_IMAGE_CHARS = 2_500_000; // base64 characters, roughly 1.8 MB
const MAX_MESSAGES = 24;

function cleanMessages(raw) {
  const list = Array.isArray(raw) ? raw.slice(-MAX_MESSAGES) : [];
  const out = list
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => {
      const images = Array.isArray(m.images)
        ? m.images
            .filter((i) => i && ALLOWED_MIME.has(i.mime) && typeof i.data === "string" && i.data.length < MAX_IMAGE_CHARS)
            .slice(0, MAX_IMAGES_PER_MESSAGE)
        : [];
      return {
        role: m.role,
        content: typeof m.content === "string" ? m.content.slice(0, 8000) : "",
        images: m.role === "user" ? images : []
      };
    });

  // Only keep photos on the two most recent messages that have them (keeps requests small).
  let kept = 0;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].images.length) {
      kept += 1;
      if (kept > 2) out[i].images = [];
    }
  }
  return out;
}

export async function handleChat(body = {}, ctx = {}) {
  try {
    const role = VALID_ROLES.has(body.role) ? body.role : "public";

    // Doctor / Nurse / Pharmacist sections need a real staff sign-in for that exact role.
    if (GATED_ROLES.has(role) && (!ctx.session || ctx.session.staff.role !== role)) {
      return { status: 401, json: { error: "Please sign in with your staff account to use this section." } };
    }
    const messages = cleanMessages(body.messages);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return { status: 400, json: { error: "Send a message first." } };
    }

    const last = messages[messages.length - 1];
    const hasImages = last.images.length > 0;
    const mode = hasImages ? (VALID_MODES.has(body.mode) ? body.mode : "other") : null;

    if (!aiConfigured()) {
      return { status: 500, json: { error: MISSING_KEY_MESSAGE } };
    }

    const regexEmergency = checkEmergency(last.content || "");

    const system =
      getSystemPrompt(role) +
      (hasImages ? "\n\n" + imageInstruction(mode) : "") +
      "\n\n" + TAG_INSTRUCTION;

    const useSearch = hasImages && process.env.DISABLE_SEARCH !== "1";
    const { text, sources } = await generateReply({ system, messages, useSearch });
    const parsed = extractTags(text);

    let emergency = null;
    if (regexEmergency.triggered || parsed.urgency === "emergency") emergency = EMERGENCY_MESSAGE;
    else if (parsed.urgency === "urgent") emergency = URGENT_MESSAGE;

    return {
      status: 200,
      json: { reply: parsed.text, organs: parsed.organs, emergency, sources }
    };
  } catch (err) {
    console.error("Chat endpoint error:", err);
    if (err instanceof AIError) {
      return { status: err.status === 429 ? 429 : 502, json: { error: err.message } };
    }
    return { status: 500, json: { error: "Something went wrong handling that message." } };
  }
}
