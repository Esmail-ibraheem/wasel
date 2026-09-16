import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Phone API keys look like `wsl_<40 hex>`; only the sha256 is stored. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = "wsl_" + randomBytes(20).toString("hex");
  return { key, hash: sha256Hex(key), prefix: key.slice(0, 12) };
}

/** 6-character verification code with unambiguous characters (no 0/O/1/I). */
export function generateVerificationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return `WASEL-${out}`;
}

export function hmacHex(secret: string, body: string | Buffer): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
