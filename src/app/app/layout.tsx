import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { LiveNotifications } from "@/components/live-notifications";
import type { NavItem } from "@/components/sidebar-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [recent, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  const nav: NavItem[] = [
    { href: "/app", label: "نظرة عامة", icon: "home", exact: true },
    { href: "/app/transfers", label: "التحويلات", icon: "transfers" },
  ];
  if (can(user.role, "messages.view")) nav.push({ href: "/app/messages", label: "الرسائل الواردة", icon: "messages" });
  if (can(user.role, "phones.manage")) nav.push({ href: "/app/phones", label: "أرقام الهواتف", icon: "phone" });
  if (can(user.role, "wallets.manage")) nav.push({ href: "/app/wallets", label: "المحافظ", icon: "wallet" });
  if (can(user.role, "users.manage")) nav.push({ href: "/app/users", label: "المستخدمون", icon: "users" });
  if (can(user.role, "audit.view")) nav.push({ href: "/app/audit", label: "سجل التدقيق", icon: "audit" });
  nav.push({ href: "/app/notifications", label: "الإشعارات", icon: "bell" });
  if (can(user.role, "settings.manage")) nav.push({ href: "/app/settings", label: "الإعدادات", icon: "settings" });

  return (
    <AppShell
      nav={nav}
      user={user}
      businessName={user.businessName ?? ""}
      businessPublicId={user.businessPublicId}
      footerLink={user.isSuperAdmin ? { href: "/admin", label: "لوحة المشرف ←" } : undefined}
      topRight={
        <LiveNotifications
          initialUnread={unread}
          initial={recent.map((n) => ({
            id: n.id,
            transferId: n.transferId,
            title: n.title,
            body: n.body,
            readAt: n.readAt?.toISOString() ?? null,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      }
    >
      {children}
    </AppShell>
  );
}
