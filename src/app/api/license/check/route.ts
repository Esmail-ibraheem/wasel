import { checkDevice, checkSchema, statusPayload } from "@/lib/licensing/api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Heartbeat for installed software.
 *
 *   POST /api/license/check
 *   X-Device-Token: wsd_…
 *   { "nonce": "<random, echoed back inside the signed payload>", "appVersion": "1.2.0" }
 *
 * → signed { ok, status: ACTIVE|PENDING|SUSPENDED|EXPIRED|REJECTED|NO_LICENSE|BLOCKED, license, business, serverTime, nonce, checkIntervalSec, graceSec }
 * The client must stop working when status ≠ ACTIVE, or when it has not obtained a valid signed ACTIVE for longer than graceSec.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-device-token")?.trim();
  if (!token) return Response.json({ ok: false, error: "MISSING_DEVICE_TOKEN" }, { status: 401 });

  const limit = rateLimit(`license-check:${token.slice(0, 16)}`, 60, 60_000);
  if (!limit.ok) return Response.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: limit.retryAfterSec }, { status: 429 });

  let raw: unknown = {};
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = checkSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const result = await checkDevice(token, parsed.data, ip);
  if (!result) return Response.json({ ok: false, error: "INVALID_DEVICE_TOKEN" }, { status: 401 });

  return Response.json(
    statusPayload({
      status: result.status,
      nonce: parsed.data.nonce,
      license: result.license,
      business: result.business,
      extra: { deviceId: result.device.publicId, deviceStatus: result.device.status },
    }),
  );
}
