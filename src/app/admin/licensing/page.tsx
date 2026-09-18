import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireSuperAdmin } from "@/lib/auth/session";
import { getPublicKey } from "@/lib/licensing/signing";
import { CHECK_INTERVAL_SEC, GRACE_SEC } from "@/lib/licensing/api";
import { Card, CardHeader, Mono, Notice, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "واجهة الترخيص" };

export default async function LicensingDocsPage() {
  await requireSuperAdmin();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;
  const pk = getPublicKey();
  const seeded = Boolean(process.env.LICENSE_SIGNING_SEED);

  return (
    <div className="space-y-6">
      <PageHeader title="واجهة الترخيص المركزية" description="ما يحتاجه البرنامج المثبَّت لدى العميل (خادم محلي، تطبيق مكتبي، تطبيق الهاتف) للتفعيل والتحقق الدوري." />

      {!seeded && <Notice tone="danger">المتغير LICENSE_SIGNING_SEED غير مضبوط — يُستخدم مفتاح تطوير غير آمن. اضبطه قبل توزيع أي برنامج.</Notice>}

      <Card>
        <CardHeader title="كيف يعمل" />
        <ol className="list-decimal space-y-2 p-5 ps-9 text-sm leading-relaxed">
          <li>تُصدر ترخيصًا للمنشأة من صفحتها (مفتاح بصيغة <Mono>WSL-XXXX-XXXX-XXXX</Mono>) وتعطيه للعميل.</li>
          <li>البرنامج المثبَّت يرسل المفتاح إلى <Mono>/api/license/activate</Mono> فيُسجَّل التركيب والجهاز ويحصل على <Mono>deviceToken</Mono> سري.</li>
          <li>كل {CHECK_INTERVAL_SEC / 3600} ساعات يستدعي <Mono>/api/license/check</Mono> بالرمز؛ الرد موقّع بمفتاح Ed25519 ويحمل الحالة الحالية: ACTIVE / PENDING / SUSPENDED / EXPIRED / BLOCKED.</li>
          <li>البرنامج يتوقف إذا كانت الحالة ≠ ACTIVE، أو إذا مضى أكثر من {GRACE_SEC / 86400} أيام دون رد موقّع ناجح. الحالة لا تُحفظ محليًا كقيمة قابلة للتعديل — فقط آخر رد موقّع.</li>
          <li>حظر جهاز أو إيقاف ترخيص أو منشأة من هذه اللوحة ينعكس في الفحص التالي فورًا.</li>
        </ol>
      </Card>

      <Card>
        <CardHeader title="المفتاح العام للتحقق" subtitle="يُضمَّن داخل البرنامج للتحقق من توقيع الردود. لا تغيّر LICENSE_SIGNING_SEED بعد التوزيع." />
        <div className="space-y-3 p-5 text-sm">
          <div>
            <div className="mb-1 text-xs text-muted">SPKI (base64) — لـ Node / OpenSSL / .NET / Java</div>
            <code className="block break-all rounded bg-paper p-3 font-mono text-xs ltr">{pk.spkiBase64}</code>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">Raw 32 bytes (base64) — لـ tweetnacl / libsodium / Android</div>
            <code className="block break-all rounded bg-paper p-3 font-mono text-xs ltr">{pk.rawBase64}</code>
          </div>
          <div className="text-xs text-muted">
            متاح أيضًا على <Mono>{base}/api/license/public-key</Mono> — لكن الأفضل تضمينه في البرنامج حتى لا يُستبدل.
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="التفعيل" />
        <pre className="overflow-x-auto p-5 font-mono text-xs ltr text-start leading-relaxed">{`POST ${base}/api/license/activate
Content-Type: application/json

{
  "licenseKey": "WSL-XXXX-XXXX-XXXX",
  "installation": { "name": "فرع صنعاء" },        // optional; or "installationId": "WSL-I-…" to join an existing one
  "device": { "kind": "DESKTOP", "name": "كاشير 1", "fingerprint": "<machine id>", "platform": "win32", "appVersion": "1.0.0" }
}

200 → { "ok": true, "status": "ACTIVE", "installationId": "WSL-I-…", "deviceId": "WSL-D-…", "deviceToken": "wsd_…",
        "license": { "key", "plan", "status", "expiresAt" }, "business": { "id": "WSL-B-…", "name" },
        "checkIntervalSec": ${CHECK_INTERVAL_SEC}, "graceSec": ${GRACE_SEC}, "serverTime": "…", "nonce": null, "alg": "Ed25519", "signature": "<base64>" }
403 → status PENDING | SUSPENDED | EXPIRED | REJECTED   (signed too)
404 → LICENSE_NOT_FOUND · 409 → DEVICE_LIMIT_REACHED`}</pre>
      </Card>

      <Card>
        <CardHeader title="الفحص الدوري" />
        <pre className="overflow-x-auto p-5 font-mono text-xs ltr text-start leading-relaxed">{`POST ${base}/api/license/check
X-Device-Token: wsd_…
Content-Type: application/json

{ "nonce": "<random string>", "appVersion": "1.0.0" }

200 → { "ok": true|false, "status": "ACTIVE|PENDING|SUSPENDED|EXPIRED|REJECTED|NO_LICENSE|BLOCKED",
        "nonce": "<same nonce>", "serverTime": "…", "license": {…}, "business": {…},
        "deviceId": "WSL-D-…", "deviceStatus": "ACTIVE|BLOCKED", "checkIntervalSec": ${CHECK_INTERVAL_SEC}, "graceSec": ${GRACE_SEC},
        "alg": "Ed25519", "signature": "<base64>" }
401 → INVALID_DEVICE_TOKEN`}</pre>
      </Card>

      <Card>
        <CardHeader title="التحقق من التوقيع" subtitle="ترتيب المفاتيح أبجدي وبلا مسافات (canonical JSON) قبل التوقيع" />
        <pre className="overflow-x-auto p-5 font-mono text-xs ltr text-start leading-relaxed">{`// Node.js
import { createPublicKey, verify } from "node:crypto";
const PUBLIC_KEY = "${pk.spkiBase64}";
function canonicalize(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  return "{" + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
}
function verifyResponse(res, expectedNonce) {
  const { signature, alg, ...payload } = res;
  const key = createPublicKey({ key: Buffer.from(PUBLIC_KEY, "base64"), format: "der", type: "spki" });
  const okSig = verify(null, Buffer.from(canonicalize(payload)), key, Buffer.from(signature, "base64"));
  const fresh = Math.abs(Date.now() - Date.parse(payload.serverTime)) < 10 * 60 * 1000;
  return okSig && fresh && payload.nonce === expectedNonce && payload.status === "ACTIVE";
}`}</pre>
      </Card>
    </div>
  );
}
