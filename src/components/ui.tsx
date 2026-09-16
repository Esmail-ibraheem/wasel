import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { walletColors } from "@/lib/wallet-colors";
import { TRANSFER_STATUS, transferStatusLabel } from "@/lib/format";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-800 border border-ink",
  secondary: "bg-surface text-text border border-line-strong hover:bg-paper",
  ghost: "bg-transparent text-text hover:bg-paper border border-transparent",
  danger: "bg-crimson text-white border border-crimson hover:brightness-95",
  success: "bg-emerald text-white border border-emerald hover:brightness-95",
};
const SIZES: Record<Size, string> = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ---------- Form controls ---------- */

const control =
  "w-full h-10 rounded-md border border-line-strong bg-surface px-3 text-sm text-text placeholder:text-faint focus:border-ink focus:outline-none focus:ring-2 focus:ring-saffron/40";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(control, "pe-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(control, "h-auto min-h-28 py-2 leading-relaxed", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-text">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-crimson">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

/* ---------- Layout ---------- */

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-lg border border-line bg-surface shadow-card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-medium tracking-wide text-faint">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-semibold leading-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="text-base font-semibold">{title}</div>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ---------- Badges ---------- */

type Tone = "info" | "warning" | "success" | "danger" | "neutral";
const TONES: Record<Tone, string> = {
  info: "bg-sky-soft text-sky",
  warning: "bg-saffron-soft text-[#8a5f0b]",
  success: "bg-emerald-soft text-emerald",
  danger: "bg-crimson-soft text-crimson",
  neutral: "bg-paper text-muted border border-line",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = (TRANSFER_STATUS as Record<string, { tone: Tone }>)[status]?.tone ?? "neutral";
  return <Badge tone={tone}>{transferStatusLabel(status)}</Badge>;
}

export function WalletChip({ code, name, size = "md" }: { code: string; name: string; size?: "sm" | "md" }) {
  const c = walletColors(code);
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
      )}
      style={{ background: c.soft, color: c.color }}
    >
      <span className="inline-block size-1.5 rounded-full" style={{ background: c.color }} />
      {name}
    </span>
  );
}

/* ---------- Tables ---------- */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cx("border-b border-line px-4 py-2.5 text-start text-xs font-medium text-muted", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cx("border-b border-line px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

/* ---------- Misc ---------- */

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono text-[13px] ltr", className)}>{children}</span>;
}

export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const styles: Record<Tone, string> = {
    info: "border-sky/30 bg-sky-soft text-ink",
    warning: "border-saffron/40 bg-saffron-soft text-[#5f420a]",
    success: "border-emerald/30 bg-emerald-soft text-emerald",
    danger: "border-crimson/30 bg-crimson-soft text-crimson",
    neutral: "border-line bg-paper text-muted",
  };
  return <div className={cx("rounded-md border px-4 py-3 text-sm leading-relaxed", styles[tone])}>{children}</div>;
}

export function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (p: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted" aria-label="ترقيم الصفحات">
      <span className="tnum">
        صفحة {page} من {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <LinkButton variant="secondary" size="sm" href={hrefFor(page - 1)}>
            السابق
          </LinkButton>
        ) : (
          <span className={buttonClass("secondary", "sm", "opacity-50")}>السابق</span>
        )}
        {page < pages ? (
          <LinkButton variant="secondary" size="sm" href={hrefFor(page + 1)}>
            التالي
          </LinkButton>
        ) : (
          <span className={buttonClass("secondary", "sm", "opacity-50")}>التالي</span>
        )}
      </div>
    </nav>
  );
}
