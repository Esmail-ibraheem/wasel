import { randomBytes } from "node:crypto";

/** Unambiguous alphabet: no 0/O/1/I. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function code(len: number): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** WSL-B-XXXXXX — the id a client reads out to you on the phone. */
export const businessPublicId = () => `WSL-B-${code(6)}`;
/** WSL-XXXX-XXXX-XXXX — typed into installed software to activate it. */
export const licenseKey = () => `WSL-${code(4)}-${code(4)}-${code(4)}`;
export const installationPublicId = () => `WSL-I-${code(8)}`;
export const devicePublicId = () => `WSL-D-${code(8)}`;

export function normalizeLicenseKey(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^WSL/, "")
    .replace(/(.{4})(?=.)/g, "$1-")
    .replace(/^/, "WSL-");
}
