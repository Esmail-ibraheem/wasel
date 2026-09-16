import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { ParserTester } from "@/components/parser-tester";

export const metadata: Metadata = { title: "اختبار التحليل" };

export default async function AdminTesterPage() {
  await requireSuperAdmin();
  const wallets = await db.wallet.findMany({ orderBy: { name: "asc" }, include: { templates: { where: { isActive: true }, orderBy: { priority: "desc" } } } });
  return (
    <div className="space-y-6">
      <PageHeader title="اختبار التحليل" description="جرّب أي نص على أنماط أي محفظة دون حفظ شيء." />
      <Card>
        <CardHeader title="المحلل" />
        <div className="p-5">
          <ParserTester wallets={wallets.map((w) => ({ id: w.id, name: w.name, sample: w.templates.find((t) => t.sampleText)?.sampleText ?? "" }))} />
        </div>
      </Card>
    </div>
  );
}
