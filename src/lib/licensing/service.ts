import type { License } from "@prisma/client";
import { db } from "@/lib/db";
import { evaluateAccess, type AccessResult } from "./access";
import { licenseKey } from "./ids";

/**
 * Evaluates whether a business may use the system right now, marking
 * ACTIVE-but-expired licenses as EXPIRED on the way (lazy expiry, so the
 * admin tables always show the truth without a cron job).
 */
export async function getBusinessAccess(businessId: string): Promise<AccessResult<License> & { businessStatus: string }> {
  const business = await db.business.findUnique({ where: { id: businessId }, include: { licenses: true } });
  if (!business) return { ok: false, status: "REJECTED", businessStatus: "REJECTED" };
  const now = new Date();
  const stale = business.licenses.filter((l) => l.status === "ACTIVE" && l.expiresAt !== null && l.expiresAt <= now);
  if (stale.length) {
    await db.license.updateMany({ where: { id: { in: stale.map((l) => l.id) } }, data: { status: "EXPIRED" } });
    for (const l of stale) l.status = "EXPIRED";
  }
  return { ...evaluateAccess(business, business.licenses, now), businessStatus: business.status };
}

export interface IssueLicenseInput {
  businessId: string;
  plan?: string;
  days?: number | null;
  maxPhones?: number;
  maxUsers?: number;
  maxDevices?: number;
  status?: "ACTIVE" | "PENDING";
  note?: string | null;
  issuedById?: string | null;
}

export async function issueLicense(input: IssueLicenseInput): Promise<License> {
  const now = new Date();
  const status = input.status ?? "ACTIVE";
  return db.license.create({
    data: {
      key: licenseKey(),
      businessId: input.businessId,
      plan: input.plan?.trim() || "أساسية",
      status,
      maxPhones: input.maxPhones ?? 5,
      maxUsers: input.maxUsers ?? 10,
      maxDevices: input.maxDevices ?? 3,
      expiresAt: input.days ? new Date(now.getTime() + input.days * 86400e3) : null,
      activatedAt: status === "ACTIVE" ? now : null,
      note: input.note || null,
      issuedById: input.issuedById ?? null,
    },
  });
}

/** Limits from the currently valid license (or conservative defaults when none). */
export async function businessLimits(businessId: string): Promise<{ maxPhones: number; maxUsers: number; maxDevices: number }> {
  const access = await getBusinessAccess(businessId);
  return {
    maxPhones: access.license?.maxPhones ?? 1,
    maxUsers: access.license?.maxUsers ?? 2,
    maxDevices: access.license?.maxDevices ?? 0,
  };
}
