import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseSenderIds } from "@/lib/ingest";
import { Badge, Card, CardHeader, Mono, PageHeader, WalletChip } from "@/components/ui";
import { InlineAction } from "@/components/form";
import { ParserTester } from "@/components/parser-tester";
import { toggleWallet } from "./actions";

export const metadata: Metadata = { title: "المحافظ" };

export default async function WalletsPage() {
  const user = await requirePermission("wallets.manage");
  const wallets = await db.wallet.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      templates: { where: { isActive: true }, orderBy: { priority: "desc" } },
      businesses: { where: { businessId: user.businessId } },
      _count: { select: { transfers: { where: { businessId: user.businessId } } } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="المحافظ الإلكترونية"
        description="المحافظ التي يقرأ النظام رسائلها لهذه المنشأة. عطّل أي محفظة لا تستخدمها حتى تُتجاهل رسائلها."
      />

      <Card>
        <CardHeader title="المحافظ المدعومة" subtitle="معرّفات المرسل هي الأسماء أو الأرقام التي تصل منها الرسائل الرسمية" />
        <ul className="divide-y divide-line">
          {wallets.map((w) => {
            const enabled = w.businesses.length === 0 || w.businesses[0].isEnabled;
            return (
              <li key={w.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <WalletChip code={w.code} name={w.name} />
                    {enabled ? <Badge tone="success">مفعّلة</Badge> : <Badge tone="neutral">معطّلة</Badge>}
                    <span className="text-xs text-muted tnum">{w._count.transfers} تحويل لهذه المنشأة</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>معرّفات المرسل:</span>
                    {parseSenderIds(w.senderIds).map((s) => (
                      <Mono key={s} className="rounded bg-paper px-1.5 py-0.5">
                        {s}
                      </Mono>
                    ))}
                    <span className="ms-2 tnum">{w.templates.length} نمط رسالة</span>
                  </div>
                </div>
                <InlineAction action={toggleWallet} hidden={{ walletId: w.id, enable: enabled ? "0" : "1" }} variant={enabled ? "secondary" : "primary"}>
                  {enabled ? "تعطيل" : "تفعيل"}
                </InlineAction>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader title="اختبار قراءة رسالة" subtitle="تأكد أن صيغة رسائل محفظتك مفهومة للنظام قبل الاعتماد عليها" />
        <div className="p-5">
          <ParserTester wallets={wallets.map((w) => ({ id: w.id, name: w.name, sample: w.templates.find((t) => t.sampleText)?.sampleText ?? "" }))} />
        </div>
      </Card>
    </div>
  );
}
