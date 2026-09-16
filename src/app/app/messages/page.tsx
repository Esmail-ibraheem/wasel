import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDateTime, RAW_STATUS_LABELS } from "@/lib/format";
import { can } from "@/lib/permissions";
import { Badge, Card, EmptyState, Field, LinkButton, Pagination, PageHeader, Select, Button, WalletChip, cx } from "@/components/ui";

export const metadata: Metadata = { title: "الرسائل الواردة" };

const PAGE_SIZE = 30;
const TONES: Record<string, "success" | "warning" | "info" | "neutral"> = {
  PARSED: "success",
  UNMATCHED: "warning",
  VERIFICATION: "info",
  DUPLICATE_TRANSFER: "neutral",
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await requirePermission("messages.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = {
    businessId: user.businessId,
    ...(sp.status && RAW_STATUS_LABELS[sp.status] ? { status: sp.status } : {}),
  };
  const [total, rows] = await Promise.all([
    db.rawMessage.count({ where }),
    db.rawMessage.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        wallet: { select: { code: true, name: true } },
        transfer: { select: { id: true } },
        phoneNumber: { select: { number: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (p: number) => `/app/messages?${new URLSearchParams({ ...(sp.status && { status: sp.status }), page: String(p) })}`;

  return (
    <div>
      <PageHeader
        title="الرسائل الواردة"
        description="النص الأصلي لكل رسالة وصلت من محفظة معتمدة. الرسائل من مرسلين غير معتمدين لا تُحفظ إطلاقًا."
        actions={
          <LinkButton href="/app/messages/new" variant="primary">
            إدخال رسالة يدويًا
          </LinkButton>
        }
      />

      <Card className="mb-4 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="الحالة" className="w-56">
            <Select name="status" defaultValue={sp.status ?? ""}>
              <option value="">الكل</option>
              {Object.entries(RAW_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            تصفية
          </Button>
          <span className="ms-auto text-xs text-muted tnum">{total} رسالة</span>
        </form>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState title="لا رسائل" body="ستظهر الرسائل هنا عند وصولها عبر قناة الاستقبال أو إدخالها يدويًا." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <Badge tone={TONES[m.status] ?? "neutral"}>{RAW_STATUS_LABELS[m.status] ?? m.status}</Badge>
                  {m.wallet && <WalletChip code={m.wallet.code} name={m.wallet.name} size="sm" />}
                  <span>
                    المرسل: <span className="font-mono ltr">{m.sender}</span>
                  </span>
                  <span className="tnum">{formatDateTime(m.receivedAt)}</span>
                  <span>{m.source === "MANUAL" ? "يدوي" : "قناة الاستقبال"}</span>
                  <span className="font-mono ltr">{m.phoneNumber.number}</span>
                  {m.transfer && (
                    <Link href={`/app/transfers/${m.transfer.id}`} className="ms-auto font-medium text-sky hover:underline">
                      فتح التحويل ←
                    </Link>
                  )}
                </div>
                <pre className={cx("whitespace-pre-wrap font-sans text-sm leading-relaxed", m.status === "UNMATCHED" && "text-[#5f420a]")}>{m.text}</pre>
                {m.status === "UNMATCHED" && (
                  <p className="mt-2 text-xs text-muted">
                    لم يطابق أي نمط لهذه المحفظة. يمكن لمشرف المنصة تعديل الأنماط
                    {can(user.role, "wallets.manage") ? (
                      <>
                        ، أو{" "}
                        <Link href="/app/wallets" className="underline">
                          اختبار النص في صفحة المحافظ
                        </Link>
                      </>
                    ) : null}
                    .
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pages={pages} hrefFor={qs} />
      </Card>
    </div>
  );
}
