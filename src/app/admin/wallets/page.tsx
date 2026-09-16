import type { Metadata } from "next";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseSenderIds } from "@/lib/ingest";
import { Badge, Card, CardHeader, Mono, PageHeader, WalletChip } from "@/components/ui";
import { WalletForm } from "./wallet-forms";

export const metadata: Metadata = { title: "المحافظ والأنماط" };

export default async function AdminWalletsPage() {
  await requireSuperAdmin();
  const wallets = await db.wallet.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { templates: true, transfers: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="المحافظ والأنماط" description="كتالوج المحافظ المدعومة على المنصة وطريقة قراءة رسائل كل منها. التغييرات تسري على كل المنشآت." />
      <Card>
        <CardHeader title="المحافظ" />
        <ul className="divide-y divide-line">
          {wallets.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <WalletChip code={w.code} name={w.name} />
                  <Mono className="text-xs text-muted">{w.code}</Mono>
                  {!w.isActive && <Badge tone="neutral">معطّلة</Badge>}
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs text-muted">
                  {parseSenderIds(w.senderIds).map((s) => (
                    <Mono key={s} className="rounded bg-paper px-1.5 py-0.5">
                      {s}
                    </Mono>
                  ))}
                  <span className="ms-2 tnum">
                    {w._count.templates} نمط · {w._count.transfers} تحويل
                  </span>
                </div>
              </div>
              <Link href={`/admin/wallets/${w.id}`} className="text-sm font-medium text-sky hover:underline">
                الأنماط والتعديل ←
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="إضافة محفظة" />
        <div className="p-5">
          <WalletForm />
        </div>
      </Card>
    </div>
  );
}
