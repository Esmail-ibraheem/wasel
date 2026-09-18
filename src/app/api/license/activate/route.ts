import { activateSchema, registerDevice, statusPayload } from "@/lib/licensing/api";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function ip(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

/**
 * Activates installed software with a license key.
 *
 *   POST /api/license/activate
 *   { "licenseKey": "WSL-XXXX-XXXX-XXXX",
 *     "installationId": "WSL-I-…" (optional: attach to an existing installation),
 *     "installation": { "name": "فرع صنعاء" } (optional),
 *     "device": { "kind": "DESKTOP|PHONE|SERVER|OTHER", "name": "...", "fingerprint": "...", "platform": "...", "appVersion": "..." } }
 *
 * Returns a signed envelope with installationId, deviceId and a deviceToken
 * to use on /api/license/check. Every response is Ed25519-signed.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`license-activate:${ip(req) ?? "anon"}`, 20, 10 * 60_000);
  if (!limit.ok) return Response.json({ ok: false, error: "RATE_LIMITED", retryAfterSec: limit.retryAfterSec }, { status: 429 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = activateSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false, error: "INVALID_BODY", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });

  const result = await registerDevice(parsed.data, ip(req));
  if ("error" in result) {
    const body = "status" in result && result.status
      ? statusPayload({ status: result.status, license: result.license, business: result.business, extra: { error: result.error, ...("maxDevices" in result ? { maxDevices: result.maxDevices } : {}) } })
      : { ok: false, error: result.error };
    return Response.json(body, { status: result.httpStatus });
  }

  return Response.json(
    statusPayload({
      status: "ACTIVE",
      license: result.license,
      business: result.business,
      extra: {
        installationId: result.installation.publicId,
        installationName: result.installation.name,
        deviceId: result.device.publicId,
        deviceToken: result.token,
      },
    }),
  );
}
