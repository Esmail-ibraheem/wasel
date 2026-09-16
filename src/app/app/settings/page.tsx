import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { BusinessForm, OwnPasswordForm } from "./settings-forms";

export const metadata: Metadata = { title: "الإعدادات" };

export default async function SettingsPage() {
  const user = await requirePermission("settings.manage");
  const [business, counts] = await Promise.all([
    db.business.findUniqueOrThrow({ where: { id: user.businessId } }),
    db.$transaction([
      db.transfer.count({ where: { businessId: user.businessId } }),
      db.rawMessage.count({ where: { businessId: user.businessId } }),
      db.user.count({ where: { businessId: user.businessId } }),
    ]),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="الإعدادات" />
      <Card>
        <CardHeader title="بيانات المنشأة" />
        <div className="p-5">
          <BusinessForm name={business.name} />
        </div>
      </Card>
      <Card>
        <CardHeader title="كلمة المرور" subtitle="لحسابك أنت" />
        <div className="p-5">
          <OwnPasswordForm />
        </div>
      </Card>
      <Card>
        <CardHeader title="البيانات والاحتفاظ" />
        <div className="space-y-2 p-5 text-sm text-muted">
          <p className="tnum">
            لدى المنشأة {counts[0]} تحويل و{counts[1]} رسالة و{counts[2]} مستخدم.
          </p>
          <p>
            تُحفظ الرسائل الأصلية والتحويلات دون حد زمني في هذه النسخة. سياسة الاحتفاظ والحذف التلقائي ستُضاف عند تحديد المتطلبات القانونية
            للمنشأة.
          </p>
        </div>
      </Card>
    </div>
  );
}
