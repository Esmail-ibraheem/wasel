import type { Metadata } from "next";
import { headers } from "next/headers";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime, PHONE_STATUS_LABELS } from "@/lib/format";
import { Badge, Card, CardHeader, EmptyState, Mono, PageHeader } from "@/components/ui";
import { InlineAction } from "@/components/form";
import { AddPhoneForm, CodeChip, RotateKeyForm } from "./phone-forms";
import { removePhone, setPhoneStatus } from "./actions";

export const metadata: Metadata = { title: "أرقام الهواتف" };

const TONES: Record<string, "success" | "warning" | "neutral"> = { VERIFIED: "success", PENDING: "warning", DISABLED: "neutral" };

export default async function PhonesPage() {
  const user = await requirePermission("phones.manage");
  const phones = await db.phoneNumber.findMany({
    where: { businessId: user.businessId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { transfers: true, rawMessages: true } } },
  });
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const ingestUrl = `${proto}://${host}/api/ingest/sms`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="أرقام الهواتف"
        description="الأرقام التي تستقبل رسائل المحافظ. لكل رقم مفتاح وصول خاص يستخدمه الجهاز أو التطبيق الذي يمرر الرسائل إلى واصل."
      />

      <Card>
        <CardHeader title="إضافة رقم" subtitle="لا يمكن ربط الرقم نفسه بأكثر من منشأة." />
        <div className="p-5">
          <AddPhoneForm />
        </div>
      </Card>

      <Card>
        <CardHeader title="الأرقام المرتبطة" />
        {phones.length === 0 ? (
          <EmptyState title="لا أرقام بعد" body="أضف الرقم الذي تصل إليه رسائل التحويل لتبدأ." />
        ) : (
          <ul className="divide-y divide-line">
            {phones.map((p) => (
              <li key={p.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono className="text-base font-medium">{p.number}</Mono>
                    {p.label && <span className="text-sm text-muted">{p.label}</span>}
                    <Badge tone={TONES[p.status] ?? "neutral"}>{PHONE_STATUS_LABELS[p.status] ?? p.status}</Badge>
                    {p.hmacSecret && <Badge tone="neutral">توقيع HMAC مفعّل</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>
                      مفتاح الوصول: <Mono>{p.apiKeyPrefix}…</Mono>
                    </span>
                    <span className="tnum">{p._count.transfers} تحويل</span>
                    <span className="tnum">{p._count.rawMessages} رسالة</span>
                    {p.lastSeenAt && <span className="tnum">آخر رسالة: {formatDateTime(p.lastSeenAt)}</span>}
                    {p.verifiedAt && <span className="tnum">وُثّق: {formatDateTime(p.verifiedAt)}</span>}
                  </div>

                  {p.status === "PENDING" && (
                    <div className="rounded-md border border-saffron/40 bg-saffron-soft p-4 text-sm leading-relaxed">
                      <div className="mb-2 font-semibold">لإكمال التحقق من ملكية الرقم</div>
                      <ol className="list-decimal space-y-1 ps-5">
                        <li>اضبط تطبيق التمرير أو الجهاز على هذا الرقم باستخدام مفتاح الوصول.</li>
                        <li>
                          أرسل رسالة SMS إلى هذا الرقم من أي هاتف تحتوي على الرمز: <CodeChip code={p.verificationCode} />
                        </li>
                        <li>عند وصول الرسالة عبر القناة يُوثَّق الرقم تلقائيًا ويبدأ استقبال التحويلات.</li>
                      </ol>
                      <details className="mt-3 text-xs text-muted">
                        <summary className="cursor-pointer">تجربة سريعة عبر curl</summary>
                        <pre className="mt-2 overflow-x-auto rounded bg-white p-3 font-mono text-[11px] ltr text-start">{`curl -X POST ${ingestUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: <مفتاح الوصول>" \\
  -d '{"sender":"777000000","text":"${p.verificationCode}"}'`}</pre>
                      </details>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <RotateKeyForm id={p.id} hasHmac={Boolean(p.hmacSecret)} />
                  {p.status === "DISABLED" ? (
                    <InlineAction action={setPhoneStatus} hidden={{ id: p.id, status: "VERIFIED" }}>
                      إعادة التفعيل
                    </InlineAction>
                  ) : (
                    <InlineAction action={setPhoneStatus} hidden={{ id: p.id, status: "DISABLED" }} confirm="سيتوقف هذا الرقم عن استقبال الرسائل. المتابعة؟">
                      تعطيل
                    </InlineAction>
                  )}
                  <InlineAction
                    action={removePhone}
                    hidden={{ id: p.id }}
                    variant="ghost"
                    confirm={p._count.transfers > 0 ? "الرقم مرتبط بتحويلات سابقة، لذلك سيُعطَّل بدل حذفه. المتابعة؟" : "حذف الرقم نهائيًا؟"}
                    className="text-crimson"
                  >
                    <span className="text-crimson">حذف</span>
                  </InlineAction>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="واجهة الاستقبال" subtitle="للمطوّر أو مزوّد الخدمة الذي سيمرر الرسائل إلى واصل" />
        <div className="space-y-3 p-5 text-sm leading-relaxed">
          <p>
            أرسل كل رسالة SMS واردة كطلب <Mono>POST</Mono> إلى <Mono>{ingestUrl}</Mono> مع ترويسة <Mono>X-Api-Key</Mono> الخاصة بالرقم.
          </p>
          <pre className="overflow-x-auto rounded-md border border-line bg-paper p-4 font-mono text-xs ltr text-start">{`POST ${ingestUrl}
Content-Type: application/json
X-Api-Key: wsl_...
X-Signature: <hex hmac-sha256 of body>   (only if HMAC is enabled for the number)

{
  "sender": "Jaib",
  "text": "تم استلام مبلغ 50,000 ريال يمني من 777123456 ...",
  "receivedAt": "2026-09-16T14:35:00+03:00",
  "externalId": "device-message-id (optional, used for de-duplication)"
}`}</pre>
          <ul className="list-disc space-y-1 ps-5 text-muted">
            <li>
              <Mono>200 PARSED</Mono> تحويل جديد · <Mono>200 DUPLICATE</Mono> رسالة مكررة · <Mono>202 UNMATCHED</Mono> مرسل معتمد لكن الصيغة غير معروفة ·{" "}
              <Mono>202 IGNORED_SENDER</Mono> مرسل غير معتمد (لا يُحفظ النص) · <Mono>403 PHONE_NOT_VERIFIED</Mono>
            </li>
            <li>يُرفض أي طلب بمفتاح غير صحيح، ويُحدّ عدد الطلبات إلى 120 في الدقيقة لكل مفتاح.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
