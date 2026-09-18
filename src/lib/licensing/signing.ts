import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";

/**
 * Ed25519 signatures over license-server responses. Installed client software
 * embeds the public key and verifies every activation/check response, so a
 * client cannot forge "ACTIVE" by pointing the app at a fake server or editing
 * local files.
 *
 * The private key is derived from LICENSE_SIGNING_SEED (32 bytes, hex). Keep it
 * secret and stable — rotating it invalidates the public key shipped in clients.
 */

// PKCS#8 DER prefix for an Ed25519 private key; the 32-byte seed follows.
const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
// SPKI DER for Ed25519 is a fixed 12-byte prefix + the 32-byte public key.
const SPKI_PREFIX_LEN = 12;

let cached: { priv: KeyObject; pub: KeyObject; spki: Buffer } | undefined;
let warned = false;

function seed(): Buffer {
  const env = process.env.LICENSE_SIGNING_SEED?.trim();
  if (env && /^[0-9a-fA-F]{64}$/.test(env)) return Buffer.from(env, "hex");
  if (process.env.NODE_ENV === "production" && !process.env.VITEST) {
    throw new Error("LICENSE_SIGNING_SEED must be set to 32 bytes (64 hex chars) in production");
  }
  if (!warned) {
    warned = true;
    console.warn("[wasel] LICENSE_SIGNING_SEED not set — using an insecure development seed");
  }
  return createHash("sha256").update("wasel-dev-signing-seed").digest();
}

function keys() {
  if (cached) return cached;
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed()]), format: "der", type: "pkcs8" });
  const pub = createPublicKey(priv);
  const spki = pub.export({ type: "spki", format: "der" }) as Buffer;
  cached = { priv, pub, spki };
  return cached;
}

/** Deterministic JSON: object keys sorted recursively, no whitespace. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]))
      .join(",") +
    "}"
  );
}

export function signPayload<T extends Record<string, unknown>>(payload: T): T & { alg: "Ed25519"; signature: string } {
  const signature = sign(null, Buffer.from(canonicalize(payload), "utf8"), keys().priv).toString("base64");
  return { ...payload, alg: "Ed25519", signature };
}

export function verifyPayload(payload: Record<string, unknown>, signatureBase64: string, publicKeySpkiBase64: string): boolean {
  try {
    const pub = createPublicKey({ key: Buffer.from(publicKeySpkiBase64, "base64"), format: "der", type: "spki" });
    return verify(null, Buffer.from(canonicalize(payload), "utf8"), pub, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

export function getPublicKey(): { alg: "Ed25519"; spkiBase64: string; rawBase64: string } {
  const { spki } = keys();
  return { alg: "Ed25519", spkiBase64: spki.toString("base64"), rawBase64: spki.subarray(SPKI_PREFIX_LEN).toString("base64") };
}
