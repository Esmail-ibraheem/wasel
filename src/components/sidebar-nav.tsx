"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-white/10 font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
            )}
          >
            <span className={cx("shrink-0", active ? "text-saffron" : "text-white/45")}>{ICONS[item.icon]}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

const ICONS = {
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M4 11 12 4l8 7v9H4z" />
      <path d="M10 20v-6h4v6" />
    </svg>
  ),
  transfers: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  ),
  messages: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M4 5h16v11H8l-4 4z" />
    </svg>
  ),
  phone: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 17h2" />
    </svg>
  ),
  wallet: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M4 7V6a2 2 0 0 1 2-2h10M16 13h4" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-4-5.6" />
    </svg>
  ),
  audit: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </svg>
  ),
  bell: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" />
    </svg>
  ),
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
    </svg>
  ),
  building: (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M4 21h16M8 7h4M8 11h4M8 15h4" />
    </svg>
  ),
};
