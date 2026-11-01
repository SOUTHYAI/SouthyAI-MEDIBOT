export function ipOf(req) {
  const xf = req.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || null;
}

export function toReq(req) {
  return { method: req.method, headers: req.headers, body: req.body, ip: ipOf(req) };
}

export function send(res, r) {
  res.setHeader("Cache-Control", "no-store");
  if (r.cookie) res.setHeader("Set-Cookie", r.cookie);
  res.status(r.status).json(r.json);
}
