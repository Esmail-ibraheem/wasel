import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { randomToken, sha256Hex } from "./tokens";
import { can, type Permission } from "@/lib/permissions";
import { evaluateAccess, type AccessStatus } from "@/lib/licensing/access";

export const SESSION_COOKIE = "wasel_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isSuperAdmin: boolean;
  businessId: string | null;
  businessName: string | null;
  businessPublicId: string | null;
  /** Server-evaluated activation state of the user's business (super admins without a business are always ACTIVE). */
  access: { ok: boolean; status: AccessStatus; licenseExpiresAt: string | null };
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const hdrs = await headers();
  await db.session.create({
    data: {
      id: sha256Hex(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      userAgent: hdrs.get("user-agent")?.slice(0, 255) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { id: sha256Hex(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

/** Resolves the logged-in user for this request (memoized per request). Null when not logged in. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256Hex(token) },
    include: {
      user: {
        include: {
          business: { select: { name: true, publicId: true, status: true, licenses: { select: { id: true, status: true, expiresAt: true } } } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const u = session.user;
  const access = u.business
    ? evaluateAccess(u.business, u.business.licenses)
    : { ok: true, status: "ACTIVE" as AccessStatus, license: undefined };
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    isSuperAdmin: u.isSuperAdmin,
    businessId: u.businessId,
    businessName: u.business?.name ?? null,
    businessPublicId: u.business?.publicId ?? null,
    access: { ok: access.ok, status: access.status, licenseExpiresAt: access.license?.expiresAt?.toISOString() ?? null },
  };
});

/**
 * For tenant pages and actions: requires a logged-in user that belongs to a
 * business whose activation/license is currently valid. Everything under
 * /app and every server action goes through here, so a pending, suspended,
 * rejected or expired business is blocked server-side.
 */
export async function requireUser(): Promise<CurrentUser & { businessId: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.businessId) redirect(user.isSuperAdmin ? "/admin" : "/login");
  if (!user.access.ok) redirect("/activation");
  return user as CurrentUser & { businessId: string };
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/app?denied=1");
  return user;
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) redirect("/app");
  return user;
}
