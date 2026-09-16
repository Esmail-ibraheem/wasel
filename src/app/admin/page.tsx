import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "المنشآت" };

export default async function AdminHome() {
  await requireSuperAdmin();
  const [businesses, totals] = await Promise.all([
    db.business.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, phones: true, transfers: true, rawMessages: true } },
        phones: { select: { status: true } },
      },
    }),
    db.$transaction([db.transfer.count(), db.rawMessage.count({ where: { status: "UNMATCHED" } }), db.phoneNumber.count({ where: { status: "PENDING" } })]),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="المنشآت المسجلة" description="نظرة عامة على المنصة. لا تظهر هنا بيانات التحويلات نفسها." />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["منشآت", businesses.length],
          ["تحويلات على المنصة", totals[0]],
          ["رسائل لم تُقرأ (كل المنشآت)", totals[1]],
        ].map(([label, value]) => (
          <Card key={String(label)} className="p-5">
            <div className="text-[13px] text-muted">{label}</div>
            <div className="amount mt-2 text-3xl font-semibold">{formatNumber(Number(value))}</div>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="المنشآت" subtitle={totals[2] > 0 ? `${totals[2]} رقم بانتظار التحقق عبر المنصة` : undefined} />
        {businesses.length === 0 ? (
          <EmptyState title="لا منشآت بعد" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>المنشأة</Th>
                <Th>المستخدمون</Th>
                <Th>الأرقام</Th>
                <Th>التحويلات</Th>
                <Th>الرسائل</Th>
                <Th>التسجيل</Th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((b) => (
                <tr key={b.id}>
                  <Td className="font-medium">{b.name}</Td>
                  <Td className="tnum">{b._count.users}</Td>
                  <Td className="tnum">
                    {b._count.phones}
                    {b.phones.some((p) => p.status === "PENDING") && <span className="ms-2 text-xs text-[#8a5f0b]">بانتظار تحقق</span>}
                  </Td>
                  <Td className="tnum">{b._count.transfers}</Td>
                  <Td className="tnum">{b._count.rawMessages}</Td>
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
