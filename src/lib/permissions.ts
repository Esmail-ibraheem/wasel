export const ROLES = ["OWNER", "MANAGER", "ACCOUNTANT", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "مالك المنشأة",
  MANAGER: "مدير",
  ACCOUNTANT: "محاسب",
  EMPLOYEE: "موظف",
};

/** Higher rank = more authority. Used for "who may manage whom". */
const ROLE_RANK: Record<Role, number> = { OWNER: 4, MANAGER: 3, ACCOUNTANT: 2, EMPLOYEE: 1 };

export const PERMISSIONS = {
  "transfers.view": ["OWNER", "MANAGER", "ACCOUNTANT", "EMPLOYEE"],
  "transfers.review": ["OWNER", "MANAGER", "ACCOUNTANT", "EMPLOYEE"],
  "transfers.confirm": ["OWNER", "MANAGER", "ACCOUNTANT"],
  "transfers.reject": ["OWNER", "MANAGER", "ACCOUNTANT"],
  "transfers.export": ["OWNER", "MANAGER", "ACCOUNTANT"],
  "messages.view": ["OWNER", "MANAGER", "ACCOUNTANT"],
  "messages.manual": ["OWNER", "MANAGER", "ACCOUNTANT"],
  "phones.manage": ["OWNER", "MANAGER"],
  "wallets.manage": ["OWNER", "MANAGER"],
  "users.manage": ["OWNER", "MANAGER"],
  "audit.view": ["OWNER", "MANAGER"],
  "settings.manage": ["OWNER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: string, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

/**
 * May `actor` create/edit/deactivate a user holding `target` role?
 * OWNER manages everyone except other owners; MANAGER manages roles strictly below MANAGER.
 */
export function canManageRole(actor: string, target: string): boolean {
  if (!isRole(actor) || !isRole(target)) return false;
  if (!can(actor, "users.manage")) return false;
  if (actor === "OWNER") return target !== "OWNER";
  return ROLE_RANK[target] < ROLE_RANK[actor];
}

/** Roles an actor is allowed to assign when creating or editing users. */
export function assignableRoles(actor: string): Role[] {
  return ROLES.filter((r) => canManageRole(actor, r));
}
