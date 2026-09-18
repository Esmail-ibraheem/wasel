import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { evaluateAccess, ACCESS_STATUS_LABELS, BUSINESS_STATUS_LABELS } from "@/lib/licensing/access";
import { Badge, Card, CardHeader, EmptyState, LinkButton, Mono, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "المنشآت" };

const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { ACTIVE: "success", PENDING: "warning", SUSPENDED: "danger", REJECTED: "neutral", EXPIRED: "danger", NO_LICENSE: "warning" };

export default async function AdminHome() {
  await requireSuperAdmin();
  const now = new Date();
  const [businesses, totals] = await Promise.all([
    db.business.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        licenses: { select: { id: true, status: true, expiresAt: true } },
        users: { where: { role: "OWNER" }, select: { fullName: true, username: true }, take: 1 },
        _count: { select: { users: true, phones: true, transfers: true, devices: true, installations: true } },
      },
    }),
    db.$transaction([db.transfer.count(), db.device.count({ where: { status: "ACTIVE" } }), db.license.count({ where: { status: "ACTIVE" } })]),
  ]);
  const rows = businesses.map((b) => ({ ...b, access: evaluateAccess(b, b.licenses, now) }));
  const pending = rows.filter((b) => b.status === "PENDING");
  const attention = rows.filter((b) => b.status === "ACTIVE" && !b.access.ok);

  return (
    <div className="space-y-6">
      <PageHeader title="المنشآت والتراخيص" description="طلبات التفعيل تصل هنا. لا تستطيع أي منشأة استخدام النظام قبل موافقتك، ويُتحقق من الترخيص عند كل طلب." />

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["بانتظار التفعيل", pending.length],
          ["منشآت فعّالة", rows.filter((b) => b.access.ok).length],
          ["تراخيص فعّالة", totals[2]],
          ["أجهزة فعّالة", totals[1]],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-5">
            <div className="text-[13px] text-muted">{label}</div>
            <div className="amount mt-2 text-3xl font-semibold">{formatNumber(Number(value))}</div>
          </Card>
        ))}
      </div>

      <Card className={pending.length ? "border-saffron/50" : undefined}>
        <CardHeader title="طلبات التفعيل" subtitle="راجع بيانات العميل وتواصل معه على رقم التواصل قبل الموافقة" />
        {pending.length === 0 ? (
          <EmptyState title="لا طلبات جديدة" />
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{b.name}</span>
                    <Mono className="text-xs">{b.publicId}</Mono>
                    <span className="text-xs text-muted tnum">{formatDateTime(b.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {b.users[0]?.fullName} · <Mono>{b.users[0]?.username}</Mono>
                    {b.contactPhone && (
                      <>
                        {" "}
                        · تواصل: <Mono>{b.contactPhone}</Mono>
                      </>
                    )}
                  </div>
                  {b.contactNote && <div className="mt-1 text-xs text-muted">{b.contactNote}</div>}
                </div>
                <LinkButton href={`/admin/businesses/${b.id}`} variant="primary" size="sm">
                  مراجعة الطلب
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {attention.length > 0 && (
        <Card className="border-crimson/40">
          <CardHeader title="منشآت فعّالة بلا ترخيص ساري" subtitle="انتهى ترخيصها أو أُوقف — لا تستقبل تحويلات حتى تجدد" />
          <ul className="divide-y divide-line">
            {attention.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Link href={`/admin/businesses/${b.id}`} className="font-medium hover:underline">
                  {b.name}
                </Link>
                <Badge tone={TONE[b.access.status] ?? "neutral"}>{ACCESS_STATUS_LABELS[b.access.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title="كل المنشآت" subtitle={`${rows.length} منشأة · ${totals[0]} تحويل على المنصة`} />
        {rows.length === 0 ? (
          <EmptyState title="لا منشآت بعد" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>المنشأة</Th>
                <Th>الحالة</Th>
                <Th>الوصول</Th>
                <Th>الترخيص ينتهي</Th>
                <Th>المستخدمون</Th>
                <Th>الأرقام</Th>
                <Th>الأجهزة</Th>
                <Th>التحويلات</Th>
                <Th>التسجيل</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <Td>
                    <Link href={`/admin/businesses/${b.id}`} className="font-medium hover:underline">
                      {b.name}
                    </Link>
                    <div className="text-xs text-muted">
                      <Mono>{b.publicId}</Mono>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={TONE[b.status] ?? "neutral"}>{BUSINESS_STATUS_LABELS[b.status] ?? b.status}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={b.access.ok ? "success" : TONE[b.access.status] ?? "neutral"}>{ACCESS_STATUS_LABELS[b.access.status]}</Badge>
                  </Td>
                  <Td className="tnum text-xs text-muted">{b.access.license ? (b.access.license.expiresAt ? formatDate(b.access.license.expiresAt) : "بلا انتهاء") : "—"}</Td>
                  <Td className="tnum">{b._count.users}</Td>
                  <Td className="tnum">{b._count.phones}</Td>
                  <Td className="tnum">
                    {b._count.devices}
                    {b._count.installations > 0 && <span className="ms-1 text-xs text-muted">({b._count.installations} تركيب)</span>}
                  </Td>
                  <Td className="tnum">{b._count.transfers}</Td>
                  <Td className="tnum text-xs text-muted">{formatDateTime(b.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
