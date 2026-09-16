import { z } from "zod";
import { db } from "@/lib/db";
import { hmacHex, safeEqualHex, sha256Hex } from "@/lib/auth/tokens";
import { ingestSms } from "@/lib/ingest";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Ingestion webhook. Called by whatever bridges the phone to the server
 * (SMS forwarder app, GSM gateway, telecom webhook).
 *
 *   POST /api/ingest/sms
 *   X-Api-Key: wsl_...                       (per phone number; shown once when the number is added)
 *   X-Signature: hex(HMAC-SHA256(secret, rawBody))   (required only if the number has a signing secret)
 *   { "sender": "Jaib", "text": "...", "receivedAt": "2026-09-16T10:22:00+03:00", "externalId": "device-msg-id" }
 */
const bodySchema = z.object({
  sender: z.string().trim().min(1).max(64),
  text: z.string().min(1).max(4000),
  receivedAt: z.string().datetime({ offset: true }).optional(),
  externalId: z.string().trim().max(128).optional(),
});

function json(status: number, data: Record<string, unknown>) {
  return Response.json(data, { status });
}

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (!apiKey) return json(401, { ok: false, error: "MISSING_API_KEY" });

  const limit = rateLimit(`ingest:${sha256Hex(apiKey).slice(0, 16)}`, 120, 60_000);
  if (!limit.ok) return json(429, { ok: false, error: "RATE_LIMITED", retryAfterSec: limit.retryAfterSec });

  const phone = await db.phoneNumber.findUnique({ where: { apiKeyHash: sha256Hex(apiKey) } });
  if (!phone) return json(401, { ok: false, error: "INVALID_API_KEY" });
  if (phone.status === "DISABLED") return json(403, { ok: false, error: "PHONE_DISABLED" });

  const rawBody = await req.text();
  if (phone.hmacSecret) {
    const sig = req.headers.get("x-signature")?.trim().toLowerCase() ?? "";
    if (!safeEqualHex(sig, hmacHex(phone.hmacSecret, rawBody))) {
      return json(401, { ok: false, error: "BAD_SIGNATURE" });
    }
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return json(400, { ok: false, error: "INVALID_JSON" });
  }
  const body = bodySchema.safeParse(parsedBody);
  if (!body.success) return json(400, { ok: false, error: "INVALID_BODY", issues: body.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });

  const receivedAt = body.data.receivedAt ? new Date(body.data.receivedAt) : new Date();

  const result = await ingestSms({
    phone,
    sender: body.data.sender,
    text: body.data.text,
    receivedAt,
    source: "WEBHOOK",
    externalId: body.data.externalId,
  });

  switch (result.status) {
    case "PARSED":
      return json(200, { ok: true, status: result.status, transferId: result.transferId, rawMessageId: result.rawMessageId });
    case "DUPLICATE":
      return json(200, { ok: true, status: result.status, rawMessageId: result.rawMessageId, transferId: result.transferId ?? null });
    case "DUPLICATE_TRANSFER":
      return json(200, { ok: true, status: result.status, rawMessageId: result.rawMessageId, transferId: result.existingTransferId });
    case "VERIFIED":
      return json(200, { ok: true, status: result.status, rawMessageId: result.rawMessageId });
    case "UNMATCHED":
      return json(202, { ok: true, status: result.status, rawMessageId: result.rawMessageId });
    case "IGNORED_SENDER":
      return json(202, { ok: true, status: result.status });
    case "PHONE_NOT_VERIFIED":
      return json(403, { ok: false, error: result.status, hint: "Send a message containing the verification code first." });
  }
}
