/** Shared formatting helpers (safe for both server and client components). */

const CURRENCY_LABELS: Record<string, string> = {
  YER: "ريال",
  SAR: "ريال سعودي",
  USD: "دولار",
  EUR: "يورو",
};

const numberFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return numberFmt.format(n);
}

export function formatAmount(amount: number, currency = "YER"): string {
  return `${numberFmt.format(amount)} ${CURRENCY_LABELS[currency] ?? currency}`;
}

const dateTimeFmt = new Intl.DateTimeFormat("ar-YE-u-nu-latn", {
  timeZone: "Asia/Aden",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const dateFmt = new Intl.DateTimeFormat("ar-YE-u-nu-latn", {
  timeZone: "Asia/Aden",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDateTime(d: Date | string): string {
  return dateTimeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function formatDate(d: Date | string): string {
  return dateFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Math.round((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  return `قبل ${Math.floor(diff / 86400)} يوم`;
}

export const TRANSFER_STATUS = {
  NEW: { label: "جديدة", tone: "info" },
  REVIEWED: { label: "تمت المراجعة", tone: "warning" },
  CONFIRMED: { label: "مؤكدة", tone: "success" },
  REJECTED: { label: "مرفوضة", tone: "danger" },
} as const;

export type TransferStatus = keyof typeof TRANSFER_STATUS;

export function transferStatusLabel(s: string): string {
  return (TRANSFER_STATUS as Record<string, { label: string }>)[s]?.label ?? s;
}

export const RAW_STATUS_LABELS: Record<string, string> = {
  PARSED: "تم التحليل",
  UNMATCHED: "لم يُتعرف عليها",
  VERIFICATION: "رسالة تحقق",
  DUPLICATE_TRANSFER: "عملية مكررة",
};

export const PHONE_STATUS_LABELS: Record<string, string> = {
  PENDING: "بانتظار التحقق",
  VERIFIED: "موثّق",
  DISABLED: "معطّل",
};

/** Masks all but the last 3 digits of a phone number: 967777123456 → 967•••••••456 */
export function maskPhone(n: string): string {
  if (n.length <= 6) return n;
  return n.slice(0, 3) + "•".repeat(n.length - 6) + n.slice(-3);
}
