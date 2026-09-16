import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { auditLabel, AUDIT_ACTIONS } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { Button, Card, EmptyState, Field, Pagination, PageHeader, Select, Table, Td, Th } from "@/components/ui";

export const metadata: Metadata = { title: "سجل التدقيق" };
const PAGE_SIZE = 40;

function describe(details: string | null): string {
  if (!details) return "";
  try {
    const d = JSON.parse(details) as Record<string, unknown>;
    return Object.entries(d)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join(" · ");
  } catch {
    return details;
  }
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  const user = await requirePermission("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { businessId: user.businessId, ...(sp.action && sp.action in AUDIT_ACTIONS ? { action: sp.action } : {}) };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { fullName: true } } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="سجل التدقيق" description="من فعل ماذا ومتى: الدخول، المراجعة، التأكيد، التعديلات على المستخدمين والأرقام." />
      <Card className="mb-4 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="نوع الحدث" className="w-64">
            <Select name="action" defaultValue={sp.action ?? ""}>
              <option value="">الكل</option>
              {Object.entries(AUDIT_ACTIONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            تصفية
          </Button>
          <span className="ms-auto text-xs text-muted tnum">{total} حدث</span>
        </form>
      </Card>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا أحداث" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>الوقت</Th>
                <Th>المستخدم</Th>
                <Th>الحدث</Th>
                <Th>التفاصيل</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="tnum whitespace-nowrap text-xs text-muted">{formatDateTime(r.createdAt)}</Td>
                  <Td className="whitespace-nowrap">{r.user?.fullName ?? <span className="text-faint">النظام</span>}</Td>
                  <Td className="whitespace-nowrap font-medium">
                    {r.entityType === "Transfer" && r.entityId ? (
                      <Link href={`/app/transfers/${r.entityId}`} className="hover:underline">
                        {auditLabel(r.action)}
                      </Link>
                    ) : (
                      auditLabel(r.action)
                    )}
                  </Td>
                  <Td className="text-xs text-muted">
                    <span className="ltr inline-block max-w-xl truncate align-middle" title={describe(r.details)}>
                      {describe(r.details)}
                    </span>
                    {r.ip && r.ip !== "local" && <span className="ms-2 font-mono">{r.ip}</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={page} pages={pages} hrefFor={(p) => `/app/audit?${new URLSearchParams({ ...(sp.action && { action: sp.action }), page: String(p) })}`} />
      </Card>
    </div>
  );
}
