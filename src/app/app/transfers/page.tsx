import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { TRANSFER_STATUS } from "@/lib/format";
import { buildTransferWhere, filtersToQuery, PAGE_SIZE, pageFrom, type TransferFilters } from "@/lib/queries/transfers";
import { Button, Card, EmptyState, Field, Input, LinkButton, Pagination, PageHeader, Select } from "@/components/ui";
import { TransferRow } from "@/components/transfer-row";

export const metadata: Metadata = { title: "التحويلات" };

export default async function TransfersPage({ searchParams }: { searchParams: Promise<TransferFilters> }) {
  const user = await requireUser();
  const f = await searchParams;
  const page = pageFrom(f);
  const where = buildTransferWhere(user.businessId, f);

  const [wallets, total, rows] = await Promise.all([
    db.wallet.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.transfer.count({ where }),
    db.transfer.findMany({
      where,
      orderBy: [{ transferredAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { wallet: { select: { code: true, name: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(f.q || f.status || f.wallet || f.from || f.to || f.min || f.max);

  return (
    <div>
      <PageHeader
        title="التحويلات الواردة"
        description="كل تحويل وصل إلى أرقام المنشأة. ابحث بالمرجع أو المرسل، أو صفِّ حسب التاريخ والمبلغ والحالة."
        actions={
          <>
            {can(user.role, "messages.manual") && (
              <LinkButton href="/app/messages/new" variant="secondary">
                إدخال رسالة يدويًا
              </LinkButton>
            )}
            {can(user.role, "transfers.export") && total > 0 && (
              <LinkButton href={`/api/transfers/export${filtersToQuery(f, { page: undefined })}`} variant="secondary" prefetch={false}>
                تصدير CSV
              </LinkButton>
            )}
          </>
        }
      />

      <Card className="mb-4 p-4">
        <form method="get" className="grid gap-3 md:grid-cols-6">
          <Field label="بحث" className="md:col-span-2">
            <Input name="q" defaultValue={f.q ?? ""} placeholder="رقم العملية، اسم أو رقم المرسل، ملاحظة" />
          </Field>
          <Field label="الحالة">
            <Select name="status" defaultValue={f.status ?? ""}>
              <option value="">الكل</option>
              {Object.entries(TRANSFER_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المحفظة">
            <Select name="wallet" defaultValue={f.wallet ?? ""}>
              <option value="">الكل</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="من تاريخ">
            <Input name="from" type="date" defaultValue={f.from ?? ""} />
          </Field>
          <Field label="إلى تاريخ">
            <Input name="to" type="date" defaultValue={f.to ?? ""} />
          </Field>
          <Field label="أقل مبلغ">
            <Input name="min" inputMode="numeric" defaultValue={f.min ?? ""} placeholder="0" />
          </Field>
          <Field label="أعلى مبلغ">
            <Input name="max" inputMode="numeric" defaultValue={f.max ?? ""} placeholder="∞" />
          </Field>
          <div className="flex items-end gap-2 md:col-span-4">
            <Button type="submit" variant="primary">
              تطبيق
            </Button>
            {hasFilters && (
              <LinkButton href="/app/transfers" variant="ghost">
                مسح الفلاتر
              </LinkButton>
            )}
            <span className="ms-auto self-center text-xs text-muted tnum">{total} نتيجة</span>
          </div>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title={hasFilters ? "لا نتائج مطابقة" : "لا تحويلات بعد"}
            body={hasFilters ? "جرّب توسيع نطاق البحث أو مسح الفلاتر." : "ستظهر التحويلات هنا فور وصول رسائل المحافظ."}
          />
        ) : (
          <div className="divide-y divide-line">
            {rows.map((t) => (
              <TransferRow key={t.id} t={t} />
            ))}
          </div>
        )}
        <Pagination page={page} pages={pages} hrefFor={(p) => `/app/transfers${filtersToQuery(f, { page: String(p) })}`} />
      </Card>
    </div>
  );
}
