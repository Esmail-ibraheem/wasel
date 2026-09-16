import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { OwnPasswordForm } from "@/app/app/settings/settings-forms";

export const metadata: Metadata = { title: "حساب المشرف" };

export default async function AdminAccountPage() {
  const user = await requireSuperAdmin();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="حساب المشرف" description={`اسم المستخدم: ${user.username}`} />
      <Card>
        <CardHeader title="تغيير كلمة المرور" />
        <div className="p-5">
          <OwnPasswordForm />
        </div>
      </Card>
    </div>
  );
}
