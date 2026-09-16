import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatAmount, formatNumber } from "@/lib/format";
import { Card, CardHeader, EmptyState, LinkButton, Notice } from "@/components/ui";
import { TransferRow } from "@/components/transfer-row";

/** Start of "today" in Asia/Aden (UTC+3). */
function startOfTodayAden(): Date {
  const now = new Date();
  const aden = new Date(now.getTime() + 3 * 3600 * 1000);
  return new Date(Date.UTC(aden.getUTCFullYear(), aden.getUTCMonth(), aden.getUTCDate()) - 3 * 3600 * 1000);
}
function startOfMonthAden(): Date {
  const now = new Date();
  const aden = new Date(now.getTime() + 3 * 3600 * 1000);
  return new Date(Date.UTC(aden.getUTCFullYear(), aden.getUTCMonth(), 1) - 3 * 3600 * 1000);
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ welcome?: string; denied?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const businessId = user.businessId;
  const today = startOfTodayAden();
  const month = startOfMonthAden();

  const [todayAgg, monthAgg, newCount, latest, pendingPhones, phoneCount, unmatched] = await Promise.all([
    db.transfer.groupBy({
      by: ["currency"],
      where: { businessId, transferredAt: { gte: today }, status: { not: "REJECTED" } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.transfer.groupBy({
      by: ["currency"],
      where: { businessId, transferredAt: { gte: month }, status: { not: "REJECTED" } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.transfer.count({ where: { businessId, status: "NEW" } }),
    db.transfer.findMany({
      where: { businessId },
      orderBy: [{ transferredAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: { wallet: { select: { code: true, name: true } } },
    }),
    db.phoneNumber.count({ where: { businessId, status: "PENDING" } }),
    db.phoneNumber.count({ where: { businessId } }),
    can(user.role, "messages.view")
      ? db.rawMessage.count({ where: { businessId, status: "UNMATCHED", receivedAt: { gte: new Date(Date.now() - 7 * 86400e3) } } })
      : Promise.resolve(0),
  ]);

  const sumFor = (rows: typeof todayAgg) => {
    const yer = rows.find((r) => r.currency === "YER");
    const others = rows.filter((r) => r.currency !== "YER");
    return {
      primary: yer?._sum.amount ?? 0,
      count: rows.reduce((a, r) => a + r._count._all, 0),
      others: others.map((r) => formatAmount(r._sum.amount ?? 0, r.currency)),
    };
  };
  const t = sumFor(todayAgg);
  const m = sumFor(monthAgg);

  return (
    <div className="space-y-6">
      {sp.welcome && (
        <Notice tone="success">
          أهلًا بك في واصل. الخطوة التالية: <Link href="/app/phones" className="font-medium underline">اربط رقم الهاتف</Link> الذي تصل إليه رسائل التحويل.
        </Notice>
      )}
      {sp.denied && <Notice tone="warning">لا تملك صلاحية الوصول إلى تلك الصفحة.</Notice>}
      {phoneCount === 0 && can(user.role, "phones.manage") && (
        <Notice tone="warning">
          لم يُربط أي رقم هاتف بعد، لذلك لن تصل أي تحويلات. <Link href="/app/phones" className="font-medium underline">أضف رقمًا الآن</Link>.
        </Notice>
      )}
      {pendingPhones > 0 && can(user.role, "phones.manage") && (
        <Notice tone="info">
          لديك {pendingPhones} رقم بانتظار التحقق. <Link href="/app/phones" className="font-medium underline">أكمل التحقق</Link> ليبدأ استقبال التحويلات.
        </Notice>
      )}
      {unmatched > 0 && (
        <Notice tone="warning">
          {unmatched} رسالة من محافظ معتمدة لم يتمكن النظام من قراءتها خلال الأسبوع الماضي.{" "}
          <Link href="/app/messages?status=UNMATCHED" className="font-medium underline">راجعها</Link>.
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="وارد اليوم" value={formatNumber(t.primary)} unit="ريال" sub={`${t.count} تحويل${t.others.length ? " · " + t.others.join(" · ") : ""}`} />
        <Stat label="وارد هذا الشهر" value={formatNumber(m.primary)} unit="ريال" sub={`${m.count} تحويل${m.others.length ? " · " + m.others.join(" · ") : ""}`} />
        <Stat
          label="بانتظار المراجعة"
          value={formatNumber(newCount)}
          unit="تحويل"
          sub={newCount > 0 ? "تحويلات جديدة لم يراجعها أحد بعد" : "كل شيء تمت مراجعته"}
          tone={newCount > 0 ? "saffron" : "default"}
          href="/app/transfers?status=NEW"
        />
      </div>

      <Card>
        <CardHeader
          title="آخر التحويلات"
          subtitle="تظهر هنا فور وصول رسالة التحويل"
          action={
            <LinkButton href="/app/transfers" variant="secondary" size="sm">
              كل التحويلات
            </LinkButton>
          }
        />
        {latest.length === 0 ? (
          <EmptyState
            title="لا تحويلات بعد"
            body="عند وصول أول رسالة تحويل إلى الرقم المرتبط ستظهر هنا مباشرة."
            action={
              can(user.role, "messages.manual") ? (
                <LinkButton href="/app/messages/new" variant="secondary" size="sm">
                  إدخال رسالة يدويًا للتجربة
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-line">
            {latest.map((tr) => (
              <TransferRow key={tr.id} t={tr} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  sub,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string;
  tone?: "default" | "saffron";
  href?: string;
}) {
  const body = (
    <>
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`amount text-3xl font-semibold leading-none ${tone === "saffron" ? "text-[#8a5f0b]" : ""}`}>{value}</span>
        <span className="text-sm text-muted">{unit}</span>
      </div>
      {sub && <div className="mt-2 text-xs text-faint">{sub}</div>}
    </>
  );
  const cls = `block rounded-lg border p-5 shadow-card ${tone === "saffron" ? "border-saffron/40 bg-saffron-soft" : "border-line bg-surface"}`;
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-line-strong`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
