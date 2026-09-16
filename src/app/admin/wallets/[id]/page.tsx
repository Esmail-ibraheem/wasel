import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parseSenderIds } from "@/lib/ingest";
import { parseWithTemplates } from "@/lib/parser/engine";
import { Badge, Card, CardHeader, EmptyState, PageHeader, WalletChip } from "@/components/ui";
import { InlineAction } from "@/components/form";
import { ParserTester } from "@/components/parser-tester";
import { NewTemplateToggle, TemplateEditor, WalletForm } from "../wallet-forms";
import { deleteTemplate } from "../actions";

export const metadata: Metadata = { title: "تعديل محفظة" };

export default async function AdminWalletDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const wallet = await db.wallet.findUnique({ where: { id }, include: { templates: { orderBy: [{ priority: "desc" }, { createdAt: "asc" }] } } });
  if (!wallet) notFound();

  // Self-check: does each template still match its own sample?
  const selfCheck = new Map<string, boolean | null>();
  for (const t of wallet.templates) {
    if (!t.sampleText) selfCheck.set(t.id, null);
    else selfCheck.set(t.id, parseWithTemplates(t.sampleText, [{ ...t, isActive: true }], new Date())?.templateId === t.id);
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted">
        <Link href="/admin/wallets" className="hover:underline">
          المحافظ
        </Link>{" "}
        / {wallet.name}
      </div>
      <PageHeader title={wallet.name} eyebrow={wallet.code} />

      <Card>
        <CardHeader title="بيانات المحفظة" />
        <div className="p-5">
          <WalletForm wallet={{ id: wallet.id, code: wallet.code, name: wallet.name, senderIds: parseSenderIds(wallet.senderIds), isActive: wallet.isActive }} />
        </div>
      </Card>

      <Card>
        <CardHeader title="أنماط الرسائل" subtitle="تُجرَّب بالترتيب من الأولوية الأعلى إلى الأدنى، وأول نمط يطابق هو المعتمد" action={<NewTemplateToggle walletId={wallet.id} />} />
        {wallet.templates.length === 0 ? (
          <EmptyState title="لا أنماط بعد" body="أضف نمطًا يحتوي على المجموعة (?<amount>...) على الأقل." />
        ) : (
          <ul className="divide-y divide-line">
            {wallet.templates.map((t) => {
              const ok = selfCheck.get(t.id);
              return (
                <li key={t.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.name}</span>
                        <Badge tone="neutral">أولوية {t.priority}</Badge>
                        {!t.isActive && <Badge tone="neutral">معطّل</Badge>}
                        {ok === true && <Badge tone="success">يطابق مثاله</Badge>}
                        {ok === false && <Badge tone="danger">لا يطابق مثاله</Badge>}
                        {ok === null && <Badge tone="warning">بلا مثال</Badge>}
                      </div>
                      <pre className="mt-2 overflow-x-auto rounded bg-paper p-3 font-mono text-[12px] ltr text-start text-muted">{t.pattern}</pre>
                      {t.sampleText && (
                        <div dir="auto" className="mt-2 text-xs text-muted">
                          مثال: {t.sampleText}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <TemplateEditor walletId={wallet.id} template={t} />
                      <InlineAction action={deleteTemplate} hidden={{ id: t.id }} variant="ghost" confirm="حذف هذا النمط؟">
                        <span className="text-crimson">حذف</span>
                      </InlineAction>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="اختبار سريع" subtitle={`يجرّب النص على أنماط ${wallet.name} فقط`} />
        <div className="p-5">
          <ParserTester
            wallets={[{ id: wallet.id, name: wallet.name, sample: wallet.templates.find((t) => t.sampleText)?.sampleText ?? "" }]}
            initialWalletId={wallet.id}
          />
        </div>
      </Card>

      <div className="text-xs text-muted">
        <WalletChip code={wallet.code} name={wallet.name} size="sm" /> — المعرّف: <span className="font-mono ltr">{wallet.id}</span>
      </div>
    </div>
  );
}
