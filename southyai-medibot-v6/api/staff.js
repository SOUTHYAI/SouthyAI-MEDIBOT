import { handleStaff } from "../server/staffService.js";
import { toReq, send } from "../server/http.js";

export default async function handler(req, res) {
  try {
    send(res, await handleStaff(toReq(req)));
  } catch (e) {
    console.error("staff endpoint error:", e);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
