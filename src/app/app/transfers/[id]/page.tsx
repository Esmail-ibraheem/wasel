import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatAmount, formatDateTime, transferStatusLabel } from "@/lib/format";
import { allowedTransitions } from "@/lib/transfer-workflow";
import { walletColors } from "@/lib/wallet-colors";
import { Card, CardHeader, Mono, StatusBadge, WalletChip } from "@/components/ui";
import { NoteForm, StatusForm } from "./status-form";

export const metadata: Metadata = { title: "تفاصيل التحويل" };

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const t = await db.transfer.findFirst({
    where: { id, businessId: user.businessId },
    include: {
      wallet: true,
      phoneNumber: { select: { number: true, label: true } },
      rawMessage: { include: { template: { select: { name: true } }, createdBy: { select: { fullName: true } } } },
      events: { orderBy: { createdAt: "asc" }, include: { user: { select: { fullName: true } } } },
    },
  });
  if (!t) notFound();

  const c = walletColors(t.wallet.code);
  const transitions = allowedTransitions(t.status, user.role);
  const canSeeRaw = can(user.role, "messages.view");

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted">
        <Link href="/app/transfers" className="hover:underline">
          التحويلات
        </Link>{" "}
        / <span className="font-mono ltr">{t.reference ?? t.id.slice(-8)}</span>
      </div>

      <Card className="stub overflow-hidden" style={{ ["--stub-color" as string]: c.color }}>
        <div className="flex flex-wrap items-start justify-between gap-6 p-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <WalletChip code={t.wallet.code} name={t.wallet.name} />
              <StatusBadge status={t.status} />
            </div>
            <div className="amount text-5xl font-semibold leading-none">
              {formatAmount(t.amount, t.currency).split(" ")[0]}
              <span className="ms-2 font-sans text-base font-normal text-muted">{formatAmount(t.amount, t.currency).split(" ").slice(1).join(" ")}</span>
            </div>
            <div className="mt-3 text-sm text-muted tnum">وقت التحويل: {formatDateTime(t.transferredAt)}</div>
          </div>
          <dl className="grid min-w-[260px] grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">المرسل</dt>
            <dd className="font-medium">{t.senderName ?? <span className="text-faint">—</span>}</dd>
            <dt className="text-muted">رقم المرسل</dt>
            <dd>{t.senderPhone ? <Mono>{t.senderPhone}</Mono> : <span className="text-faint">—</span>}</dd>
            <dt className="text-muted">رقم العملية</dt>
            <dd>{t.reference ? <Mono>{t.reference}</Mono> : <span className="text-faint">غير متوفر</span>}</dd>
            {t.account && (
              <>
                <dt className="text-muted">الحساب</dt>
                <dd>
                  <Mono>{t.account}</Mono>
                </dd>
              </>
            )}
            {t.balanceAfter !== null && (
              <>
                <dt className="text-muted">الرصيد بعد العملية</dt>
                <dd className="tnum">{formatAmount(t.balanceAfter, t.currency)}</dd>
              </>
            )}
            <dt className="text-muted">الرقم المستقبِل</dt>
            <dd>
              <Mono>{t.phoneNumber.number}</Mono>
              {t.phoneNumber.label && <span className="ms-2 text-xs text-muted">{t.phoneNumber.label}</span>}
            </dd>
          </dl>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="الإجراء" subtitle={`الحالة الحالية: ${transferStatusLabel(t.status)}`} />
            <div className="p-5">
              <StatusForm id={t.id} transitions={transitions} note={t.note} />
            </div>
          </Card>

          <Card>
            <CardHeader title="ملاحظة داخلية" subtitle="تظهر لفريق المنشأة فقط" />
            <div className="p-5">
              {can(user.role, "transfers.review") ? (
                <NoteForm id={t.id} note={t.note} />
              ) : (
                <p className="text-sm">{t.note ?? <span className="text-faint">لا ملاحظة</span>}</p>
              )}
            </div>
          </Card>

          {canSeeRaw && (
            <Card>
              <CardHeader
                title="الرسالة الأصلية"
                subtitle={`المرسل: ${t.rawMessage.sender} · استُلمت ${formatDateTime(t.rawMessage.receivedAt)} · ${
                  t.rawMessage.source === "MANUAL" ? `أُدخلت يدويًا بواسطة ${t.rawMessage.createdBy?.fullName ?? "—"}` : "عبر قناة الاستقبال"
                }`}
              />
              <div className="p-5">
                <pre className="whitespace-pre-wrap rounded-md border border-line bg-paper p-4 font-sans text-sm leading-relaxed">{t.rawMessage.text}</pre>
                {t.rawMessage.template && <div className="mt-2 text-xs text-muted">النمط المستخدم: {t.rawMessage.template.name}</div>}
              </div>
            </Card>
          )}
        </div>

        <Card className="self-start">
          <CardHeader title="سجل الحالة" />
          <ol className="divide-y divide-line">
            {t.events.map((e) => (
              <li key={e.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {e.fromStatus ? `${transferStatusLabel(e.fromStatus)} ← ` : ""}
                    {transferStatusLabel(e.toStatus)}
                  </span>
                  <span className="tnum text-xs text-faint">{formatDateTime(e.createdAt)}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted">{e.user?.fullName ?? "النظام"}</div>
                {e.note && <div className="mt-1 text-xs">{e.note}</div>}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
