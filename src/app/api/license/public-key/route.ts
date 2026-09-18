import { getPublicKey } from "@/lib/licensing/signing";

export const dynamic = "force-dynamic";

/** Public key installed software uses to verify license-server responses. */
export async function GET() {
  const pk = getPublicKey();
  return Response.json({ alg: pk.alg, publicKey: pk.spkiBase64, publicKeyRaw: pk.rawBase64 });
}
