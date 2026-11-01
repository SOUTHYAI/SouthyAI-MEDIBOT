import { handlePlatform } from "../server/platformService.js";
import { toReq, send } from "../server/http.js";

export default async function handler(req, res) {
  try {
    send(res, await handlePlatform(toReq(req)));
  } catch (e) {
    console.error("platform endpoint error:", e);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
