import { requireSuperAdmin } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();
  const nav: NavItem[] = [
    { href: "/admin", label: "المنشآت", icon: "building", exact: true },
    { href: "/admin/wallets", label: "المحافظ والأنماط", icon: "wallet" },
    { href: "/admin/tester", label: "اختبار التحليل", icon: "messages" },
  ];
  return (
    <AppShell
      nav={nav}
      user={user}
      businessName="لوحة مشرف المنصة"
      footerLink={user.businessId ? { href: "/app", label: "← العودة إلى المنشأة" } : undefined}
    >
      {children}
    </AppShell>
  );
}
