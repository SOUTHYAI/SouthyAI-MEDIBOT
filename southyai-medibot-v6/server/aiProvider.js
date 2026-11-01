// One place that talks to the AI. Uses the Google Gemini key if GEMINI_API_KEY is set,
// otherwise Claude if ANTHROPIC_API_KEY is set.
// Supports photos, and optional web search ("grounding") so photo answers can be
// cross-checked against online sources.

export class AIError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

export function aiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export const MISSING_KEY_MESSAGE =
  "No AI key found. Add GEMINI_API_KEY (free from aistudio.google.com/apikey) in your Vercel project settings, then redeploy.";

// Returns { text, sources: [{title, url}] }
export async function generateReply({ system, messages, useSearch = false }) {
  if (process.env.GEMINI_API_KEY) return callGemini({ system, messages, useSearch });
  if (process.env.ANTHROPIC_API_KEY) return callClaude({ system, messages, useSearch });
  throw new AIError(MISSING_KEY_MESSAGE, 500);
}

function geminiParts(m) {
  const parts = (m.images || []).map((i) => ({ inlineData: { mimeType: i.mime, data: i.data } }));
  parts.push({ text: m.content && m.content.trim() ? m.content : "(photo attached)" });
  return parts;
}

async function callGemini({ system, messages, useSearch }) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  async function attempt(withSearch) {
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: geminiParts(m)
      })),
      generationConfig: { maxOutputTokens: 2048 }
    };
    if (withSearch) body.tools = [{ google_search: {} }];
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify(body)
    });
  }

  let response = await attempt(useSearch);
  if (!response.ok && useSearch && response.status !== 429) {
    console.error("Gemini with search failed, retrying without:", response.status, await response.text());
    response = await attempt(false);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", response.status, errText);
    if (response.status === 429) {
      throw new AIError("Free AI limit reached for now. Wait a minute and try again.", 429);
    }
    throw new AIError(`The AI service returned an error (${response.status}).`);
  }

  const data = await response.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || "").join("\n").trim();
  if (!text) throw new AIError("The AI returned an empty answer. Try rephrasing or a clearer photo.");

  const sources = [];
  for (const c of cand?.groundingMetadata?.groundingChunks || []) {
    if (c.web?.uri) sources.push({ title: c.web.title || c.web.uri, url: c.web.uri });
  }
  return { text, sources: dedupe(sources).slice(0, 5) };
}

function claudeContent(m) {
  if (!m.images || !m.images.length) return m.content;
  return [
    ...m.images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.data } })),
    { type: "text", text: m.content && m.content.trim() ? m.content : "(photo attached)" }
  ];
}

async function callClaude({ system, messages, useSearch }) {
  async function attempt(withSearch) {
    const body = {
      model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages: messages.map((m) => ({ role: m.role, content: claudeContent(m) }))
    };
    if (withSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }];
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });
  }

  let response = await attempt(useSearch);
  if (!response.ok && useSearch && response.status !== 429) {
    console.error("Claude with search failed, retrying without:", response.status, await response.text());
    response = await attempt(false);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("Anthropic API error:", response.status, errText);
    throw new AIError(`The AI service returned an error (${response.status}).`);
  }

  const data = await response.json();
  const blocks = data.content || [];
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const sources = [];
  for (const b of blocks) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) sources.push({ title: r.title || r.url, url: r.url });
    }
  }
  if (!text) throw new AIError("The AI returned an empty answer. Try rephrasing or a clearer photo.");
  return { text, sources: dedupe(sources).slice(0, 5) };
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((s) => (seen.has(s.url) ? false : seen.add(s.url)));
}
