import { can, type Permission } from "./permissions";

export interface Transition {
  to: string;
  permission: Extract<Permission, "transfers.review" | "transfers.confirm" | "transfers.reject">;
  label: string;
  variant: "primary" | "success" | "danger" | "secondary";
}

/** Which transitions each status allows, and the permission needed. */
export const TRANSITIONS: Record<string, Transition[]> = {
  NEW: [
    { to: "REVIEWED", permission: "transfers.review", label: "تمت المراجعة", variant: "secondary" },
    { to: "CONFIRMED", permission: "transfers.confirm", label: "تأكيد الاستلام", variant: "success" },
    { to: "REJECTED", permission: "transfers.reject", label: "رفض", variant: "danger" },
  ],
  REVIEWED: [
    { to: "CONFIRMED", permission: "transfers.confirm", label: "تأكيد الاستلام", variant: "success" },
    { to: "REJECTED", permission: "transfers.reject", label: "رفض", variant: "danger" },
  ],
  CONFIRMED: [{ to: "REJECTED", permission: "transfers.reject", label: "إلغاء التأكيد (رفض)", variant: "danger" }],
  REJECTED: [{ to: "CONFIRMED", permission: "transfers.confirm", label: "إعادة التأكيد", variant: "success" }],
};

export function allowedTransitions(from: string, role: string): Transition[] {
  return (TRANSITIONS[from] ?? []).filter((t) => can(role, t.permission));
}
