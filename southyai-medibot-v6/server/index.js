import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { handleChat } from "./chatHandler.js";
import { handleStaff, getSession } from "./staffService.js";
import { handlePlatform } from "./platformService.js";
import { toReq, send } from "./http.js";

dotenv.config();

export const app = express();
app.use(cors({ origin: false }));
app.use(express.json({ limit: "8mb" }));

app.post("/api/chat", async (req, res) => {
  let session = null;
  try { session = await getSession(toReq(req)); } catch (e) { console.error(e.message); }
  send(res, await handleChat(req.body, { session }));
});

app.post("/api/staff", async (req, res) => {
  try { send(res, await handleStaff(toReq(req))); }
  catch (e) { console.error(e); res.status(500).json({ error: "Something went wrong. Please try again." }); }
});

app.post("/api/platform", async (req, res) => {
  try { send(res, await handlePlatform(toReq(req))); }
  catch (e) { console.error(e); res.status(500).json({ error: "Something went wrong. Please try again." }); }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

if (!process.env.NO_LISTEN) {
  const PORT = process.env.PORT || 8787;
  app.listen(PORT, () => console.log(`SOUTHYAI MediBot server listening on http://localhost:${PORT}`));
}
