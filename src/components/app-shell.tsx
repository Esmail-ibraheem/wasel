import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { SidebarNav, type NavItem } from "./sidebar-nav";
import { logout } from "@/app/(auth)/actions";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export function AppShell({
  nav,
  user,
  businessName,
  businessPublicId,
  topRight,
  children,
  footerLink,
}: {
  nav: NavItem[];
  user: { fullName: string; username: string; role: string; isSuperAdmin: boolean };
  businessName: string;
  businessPublicId?: string | null;
  topRight?: ReactNode;
  children: ReactNode;
  footerLink?: { href: string; label: string };
}) {
  return (
    <div className="flex min-h-dvh">
      {/* Sidebar sits on the inline-start (right in RTL). */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-ink px-3 py-5 text-white md:flex">
        <Link href="/app" className="mb-6 block px-3">
          <Logo light />
        </Link>
        <div className="mb-5 px-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-white/40">المنشأة</div>
          <div className="mt-0.5 truncate text-sm font-medium text-white/90">{businessName}</div>
          {businessPublicId && <div className="mt-0.5 font-mono text-[11px] text-white/40 ltr text-start">{businessPublicId}</div>}
        </div>
        <SidebarNav items={nav} />
        <div className="mt-auto space-y-1 border-t border-white/10 px-3 pt-4">
          {footerLink && (
            <Link href={footerLink.href} className="block text-xs text-saffron hover:underline">
              {footerLink.label}
            </Link>
          )}
          <div className="text-sm font-medium text-white/90">{user.fullName}</div>
          <div className="text-xs text-white/50">
            {ROLE_LABELS[user.role as Role] ?? user.role} · <span className="font-mono ltr">{user.username}</span>
          </div>
          <form action={logout}>
            <button type="submit" className="mt-2 text-xs text-white/60 hover:text-white hover:underline">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/app">
              <Logo />
            </Link>
          </div>
          <div className="hidden text-sm text-muted md:block">{businessName}</div>
          <div className="flex items-center gap-2">{topRight}</div>
        </header>

        {/* Mobile nav */}
        <div className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-2 py-1.5 md:hidden">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted hover:bg-paper hover:text-text">
              {n.label}
            </Link>
          ))}
          <form action={logout} className="ms-auto">
            <button type="submit" className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted">
              خروج
            </button>
          </form>
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
