import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { assignableRoles, canManageRole, PERMISSIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, CardHeader, Mono, PageHeader, Table, Td, Th } from "@/components/ui";
import { InlineAction } from "@/components/form";
import { CreateUserForm, ResetPasswordForm, RoleSelect } from "./user-forms";
import { setUserActive } from "./actions";

export const metadata: Metadata = { title: "المستخدمون" };

const PERMISSION_LABELS: Record<keyof typeof PERMISSIONS, string> = {
  "transfers.view": "عرض التحويلات",
  "transfers.review": "تعليم كمُراجَع وكتابة ملاحظات",
  "transfers.confirm": "تأكيد الاستلام",
  "transfers.reject": "رفض تحويل",
  "transfers.export": "تصدير CSV",
  "messages.view": "عرض نص الرسائل الأصلية",
  "messages.manual": "إدخال رسالة يدويًا",
  "phones.manage": "إدارة أرقام الهواتف",
  "wallets.manage": "إدارة المحافظ",
  "users.manage": "إدارة المستخدمين",
  "audit.view": "سجل التدقيق",
  "settings.manage": "إعدادات المنشأة",
};

export default async function UsersPage() {
  const actor = await requirePermission("users.manage");
  const users = await db.user.findMany({ where: { businessId: actor.businessId }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  const roles = assignableRoles(actor.role);

  return (
    <div className="space-y-6">
      <PageHeader title="المستخدمون" description="فريق المنشأة وصلاحياته. كل مستخدم يرى فقط ما يسمح به دوره." />

      <Card>
        <CardHeader title="إضافة مستخدم" subtitle="أعطه كلمة مرور مؤقتة ويستطيع تغييرها لاحقًا" />
        <div className="p-5">
          <CreateUserForm roles={roles} />
        </div>
      </Card>

      <Card>
        <CardHeader title="الفريق" />
        <Table>
          <thead>
            <tr>
              <Th>الاسم</Th>
              <Th>اسم المستخدم</Th>
              <Th>الدور</Th>
              <Th>الحالة</Th>
              <Th>انضم</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const manageable = u.id !== actor.id && canManageRole(actor.role, u.role);
              return (
                <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                  <Td className="font-medium">
                    {u.fullName}
                    {u.id === actor.id && <span className="ms-2 text-xs text-faint">(أنت)</span>}
                  </Td>
                  <Td>
                    <Mono>{u.username}</Mono>
                  </Td>
                  <Td>{manageable ? <RoleSelect id={u.id} role={u.role} roles={roles} /> : ROLE_LABELS[u.role as Role] ?? u.role}</Td>
                  <Td>{u.isActive ? <Badge tone="success">نشط</Badge> : <Badge tone="neutral">معطّل</Badge>}</Td>
                  <Td className="tnum text-xs text-muted">{formatDateTime(u.createdAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(manageable || u.id === actor.id) && <ResetPasswordForm id={u.id} />}
                      {manageable &&
                        (u.isActive ? (
                          <InlineAction action={setUserActive} hidden={{ id: u.id, active: "0" }} variant="ghost" confirm={`تعطيل حساب ${u.fullName}؟ سيُخرَج من جميع أجهزته.`}>
                            <span className="text-crimson">تعطيل</span>
                          </InlineAction>
                        ) : (
                          <InlineAction action={setUserActive} hidden={{ id: u.id, active: "1" }}>
                            تفعيل
                          </InlineAction>
                        ))}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="مصفوفة الصلاحيات" subtitle="ما يستطيع كل دور فعله" />
        <Table>
          <thead>
            <tr>
              <Th>الصلاحية</Th>
              {ROLES.map((r) => (
                <Th key={r} className="text-center">
                  {ROLE_LABELS[r]}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]).map((p) => (
              <tr key={p}>
                <Td>{PERMISSION_LABELS[p]}</Td>
                {ROLES.map((r) => (
                  <Td key={r} className="text-center">
                    {(PERMISSIONS[p] as readonly string[]).includes(r) ? <span className="text-emerald">✓</span> : <span className="text-faint">—</span>}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
