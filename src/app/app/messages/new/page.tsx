import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { enabledWalletsFor } from "@/lib/ingest";
import { Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { ManualMessageForm } from "./manual-form";

export const metadata: Metadata = { title: "إدخال رسالة يدويًا" };

export default async function NewMessagePage() {
  const user = await requirePermission("messages.manual");
  const [phones, wallets] = await Promise.all([
    db.phoneNumber.findMany({ where: { businessId: user.businessId, status: "VERIFIED" }, orderBy: { createdAt: "asc" } }),
    enabledWalletsFor(user.businessId),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="إدخال رسالة يدويًا"
        description="الصق نص رسالة التحويل كما وصلت إلى الهاتف. تمر الرسالة بنفس مسار التحليل والتحقق من التكرار كأنها وصلت عبر قناة الاستقبال."
      />
      {phones.length === 0 ? (
        <Notice tone="warning">لا يوجد رقم موثّق يمكن نسب الرسالة إليه. وثّق رقمًا أولًا من صفحة أرقام الهواتف.</Notice>
      ) : (
        <Card>
          <CardHeader title="الرسالة" />
          <div className="p-5">
            <ManualMessageForm
              phones={phones.map((p) => ({ id: p.id, number: p.number, label: p.label }))}
              wallets={wallets.map((w) => ({ id: w.id, name: w.name, sample: w.templates.find((t) => t.sampleText)?.sampleText ?? "" }))}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
