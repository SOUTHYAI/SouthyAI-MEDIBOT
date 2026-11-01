import { handleChat } from "../server/chatHandler.js";
import { getSession } from "../server/staffService.js";
import { toReq, send } from "../server/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }
  let session = null;
  try {
    session = await getSession(toReq(req));
  } catch (e) {
    console.error("session check failed:", e.message);
  }
  send(res, await handleChat(req.body || {}, { session }));
}
