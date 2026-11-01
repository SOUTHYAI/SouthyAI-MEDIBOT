import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);

export function secret() {
  const s = process.env.AUTH_SECRET || "";
  if (s.length < 24) return null;
  return s;
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const N = 16384, r = 8, p = 1;
  const key = await scrypt(password, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [, N, r, p, saltB64, keyB64] = String(stored).split("$");
    const key = Buffer.from(keyB64, "base64");
    const test = await scrypt(password, Buffer.from(saltB64, "base64"), key.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(key, test);
  } catch {
    return false;
  }
}

// A throwaway hash so "unknown user" takes as long as "wrong password".
export const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U

export function newActivationCode() {
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += ALPHABET[bytes[i] % 32];
  return out.match(/.{4}/g).join("-");
}

export function normaliseCode(code = "") {
  return String(code).toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

function hmac(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export const hashActivation = (code) => hmac("act:" + normaliseCode(code));
export const hashToken = (token) => hmac("tok:" + token);
export const newToken = () => crypto.randomBytes(32).toString("base64url");

export function safeEqual(a = "", b = "") {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

const COMMON = new Set(["password123", "1234567890", "qwertyuiop", "password12", "iloveyou12", "welcome123"]);
export function passwordProblem(pw = "", staffNumber = "") {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 200) return "That password is too long.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Use a mix of letters and numbers.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common.";
  if (staffNumber && pw.toLowerCase().includes(staffNumber.toLowerCase())) return "Don't use your staff number in your password.";
  return null;
}

export function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(token, { secure, maxAge }) {
  return `mb_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
