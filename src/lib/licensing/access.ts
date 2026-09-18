/**
 * Pure access evaluation. The server is the single source of truth: nothing
 * about activation is trusted from the client.
 */

export const BUSINESS_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const LICENSE_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "EXPIRED"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export type AccessStatus = "ACTIVE" | "PENDING" | "REJECTED" | "SUSPENDED" | "EXPIRED" | "NO_LICENSE";

export interface LicenseLike {
  id?: string;
  status: string;
  expiresAt: Date | null;
}

export interface AccessResult<L extends LicenseLike = LicenseLike> {
  ok: boolean;
  status: AccessStatus;
  license?: L;
}

export function isLicenseValid(l: LicenseLike, now = new Date()): boolean {
  return l.status === "ACTIVE" && (l.expiresAt === null || l.expiresAt > now);
}

export function evaluateAccess<L extends LicenseLike>(business: { status: string }, licenses: L[], now = new Date()): AccessResult<L> {
  switch (business.status) {
    case "PENDING":
      return { ok: false, status: "PENDING" };
    case "REJECTED":
      return { ok: false, status: "REJECTED" };
    case "SUSPENDED":
      return { ok: false, status: "SUSPENDED" };
    case "ACTIVE":
      break;
    default:
      return { ok: false, status: "PENDING" };
  }
  const valid = licenses.find((l) => isLicenseValid(l, now));
  if (valid) return { ok: true, status: "ACTIVE", license: valid };
  if (licenses.some((l) => l.status === "EXPIRED" || (l.status === "ACTIVE" && l.expiresAt !== null && l.expiresAt <= now))) {
    return { ok: false, status: "EXPIRED" };
  }
  if (licenses.some((l) => l.status === "SUSPENDED")) return { ok: false, status: "SUSPENDED" };
  if (licenses.some((l) => l.status === "PENDING")) return { ok: false, status: "PENDING" };
  return { ok: false, status: "NO_LICENSE" };
}

export const BUSINESS_STATUS_LABELS: Record<string, string> = {
  PENDING: "بانتظار التفعيل",
  ACTIVE: "فعّالة",
  SUSPENDED: "موقوفة",
  REJECTED: "مرفوضة",
};

export const LICENSE_STATUS_LABELS: Record<string, string> = {
  PENDING: "بانتظار التفعيل",
  ACTIVE: "فعّال",
  SUSPENDED: "موقوف",
  EXPIRED: "منتهي",
};

export const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  ACTIVE: "فعّال",
  PENDING: "بانتظار التفعيل",
  REJECTED: "مرفوض",
  SUSPENDED: "موقوف",
  EXPIRED: "الترخيص منتهي",
  NO_LICENSE: "لا يوجد ترخيص",
};

export const DEVICE_KINDS = ["PHONE", "DESKTOP", "SERVER", "OTHER"] as const;
export const DEVICE_KIND_LABELS: Record<string, string> = {
  PHONE: "هاتف",
  DESKTOP: "جهاز مكتبي",
  SERVER: "خادم",
  OTHER: "أخرى",
};
