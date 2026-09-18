import { z } from "zod";
import type { Device, Installation, License } from "@prisma/client";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/auth/tokens";
import { auditData } from "@/lib/audit";
import { evaluateAccess, DEVICE_KINDS, type AccessStatus } from "./access";
import { devicePublicId, installationPublicId, normalizeLicenseKey } from "./ids";
import { signPayload } from "./signing";

/** How often installed software should call /api/license/check, and how long it may keep running without a successful check. */
export const CHECK_INTERVAL_SEC = 6 * 60 * 60;
export const GRACE_SEC = 3 * 24 * 60 * 60;

export const activateSchema = z.object({
  licenseKey: z.string().trim().min(8).max(40),
  installationId: z.string().trim().max(40).optional(),
  installation: z.object({ name: z.string().trim().min(1).max(80).optional() }).optional(),
  device: z.object({
    kind: z.enum(DEVICE_KINDS).default("OTHER"),
    name: z.string().trim().min(1).max(80),
    fingerprint: z.string().trim().max(200).optional(),
    platform: z.string().trim().max(80).optional(),
    appVersion: z.string().trim().max(40).optional(),
  }),
});

export const checkSchema = z.object({
  nonce: z.string().trim().max(128).optional(),
  appVersion: z.string().trim().max(40).optional(),
});

export type DeviceStatus = AccessStatus | "BLOCKED";

/** Signed status envelope shared by activate and check responses. */
export function statusPayload(input: {
  status: DeviceStatus;
  nonce?: string;
  license?: License | null;
  business?: { publicId: string; name: string } | null;
  extra?: Record<string, unknown>;
}) {
  return signPayload({
    ok: input.status === "ACTIVE",
    status: input.status,
    nonce: input.nonce ?? null,
    serverTime: new Date().toISOString(),
    checkIntervalSec: CHECK_INTERVAL_SEC,
    graceSec: GRACE_SEC,
    license: input.license
      ? { key: input.license.key, plan: input.license.plan, status: input.license.status, expiresAt: input.license.expiresAt?.toISOString() ?? null }
      : null,
    business: input.business ? { id: input.business.publicId, name: input.business.name } : null,
    ...(input.extra ?? {}),
  });
}

/** Loads a license by key and evaluates it together with its business; lazily expires it. */
export async function resolveLicense(rawKey: string) {
  const key = normalizeLicenseKey(rawKey);
  const license = await db.license.findUnique({ where: { key }, include: { business: { include: { licenses: true } } } });
  if (!license) return null;
  const now = new Date();
  if (license.status === "ACTIVE" && license.expiresAt && license.expiresAt <= now) {
    await db.license.update({ where: { id: license.id }, data: { status: "EXPIRED" } });
    license.status = "EXPIRED";
  }
  // Access is judged on THIS license (not any other license of the business).
  const access = evaluateAccess(license.business, [license], now);
  return { license, business: license.business, access };
}

export async function registerDevice(input: z.infer<typeof activateSchema>, ip: string | null) {
  const resolved = await resolveLicense(input.licenseKey);
  if (!resolved) return { error: "LICENSE_NOT_FOUND" as const, httpStatus: 404 };
  const { license, business, access } = resolved;
  if (!access.ok) {
    await db.auditLog.create({
      data: auditData({ action: "LICENSE_ACTIVATION_FAILED", businessId: business.id, entityType: "License", entityId: license.id, details: { status: access.status, device: input.device.name }, ip }),
    });
    return { error: "LICENSE_NOT_ACTIVE" as const, httpStatus: 403, status: access.status, license, business };
  }

  const activeDevices = await db.device.count({ where: { licenseId: license.id, status: { not: "BLOCKED" } } });
  if (activeDevices >= license.maxDevices) {
    return { error: "DEVICE_LIMIT_REACHED" as const, httpStatus: 409, status: "ACTIVE" as const, license, business, maxDevices: license.maxDevices };
  }

  let installation: Installation | null = null;
  if (input.installationId) {
    installation = await db.installation.findFirst({ where: { publicId: input.installationId.trim().toUpperCase(), businessId: business.id } });
    if (!installation) return { error: "INSTALLATION_NOT_FOUND" as const, httpStatus: 404 };
    if (installation.status === "BLOCKED") return { error: "INSTALLATION_BLOCKED" as const, httpStatus: 403, status: "BLOCKED" as const, license, business };
  }

  const token = "wsd_" + sha256Hex(`${Date.now()}|${Math.random()}|${license.id}`).slice(0, 40);
  const { device, created } = await db.$transaction(async (tx) => {
    let inst = installation;
    let created = false;
    if (!inst) {
      inst = await tx.installation.create({
        data: {
          publicId: installationPublicId(),
          businessId: business.id,
          licenseId: license.id,
          name: input.installation?.name || input.device.name,
          appVersion: input.device.appVersion,
          lastSeenAt: new Date(),
        },
      });
      created = true;
      await tx.auditLog.create({
        data: auditData({ action: "INSTALLATION_REGISTERED", businessId: business.id, entityType: "Installation", entityId: inst.id, details: { publicId: inst.publicId, name: inst.name }, ip }),
      });
    } else {
      await tx.installation.update({ where: { id: inst.id }, data: { lastSeenAt: new Date(), appVersion: input.device.appVersion ?? inst.appVersion } });
    }
    const device = await tx.device.create({
      data: {
        publicId: devicePublicId(),
        businessId: business.id,
        installationId: inst.id,
        licenseId: license.id,
        kind: input.device.kind,
        name: input.device.name,
        fingerprint: input.device.fingerprint,
        platform: input.device.platform,
        appVersion: input.device.appVersion,
        tokenHash: sha256Hex(token),
        lastSeenAt: new Date(),
        lastIp: ip,
      },
    });
    await tx.auditLog.create({
      data: auditData({ action: "DEVICE_REGISTERED", businessId: business.id, entityType: "Device", entityId: device.id, details: { publicId: device.publicId, kind: device.kind, name: device.name, installation: inst.publicId }, ip }),
    });
    await tx.license.update({ where: { id: license.id }, data: { lastCheckAt: new Date(), activatedAt: license.activatedAt ?? new Date() } });
    return { device, created, inst };
  });

  const inst = await db.installation.findUniqueOrThrow({ where: { id: device.installationId! } });
  return { ok: true as const, license, business, installation: inst, installationCreated: created, device, token };
}

export async function checkDevice(token: string, input: z.infer<typeof checkSchema>, ip: string | null) {
  const device = await db.device.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { installation: true, license: true, business: { include: { licenses: true } } },
  });
  if (!device) return null;

  await db.device.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date(), lastIp: ip, appVersion: input.appVersion ?? device.appVersion },
  });
  if (device.installationId) await db.installation.update({ where: { id: device.installationId }, data: { lastSeenAt: new Date() } });
  if (device.licenseId) await db.license.update({ where: { id: device.licenseId }, data: { lastCheckAt: new Date() } });

  let status: DeviceStatus;
  if (device.status === "BLOCKED" || device.installation?.status === "BLOCKED") {
    status = "BLOCKED";
  } else if (device.license) {
    const now = new Date();
    if (device.license.status === "ACTIVE" && device.license.expiresAt && device.license.expiresAt <= now) {
      await db.license.update({ where: { id: device.license.id }, data: { status: "EXPIRED" } });
      device.license.status = "EXPIRED";
    }
    status = evaluateAccess(device.business, [device.license], now).status;
  } else {
    status = evaluateAccess(device.business, device.business.licenses).status;
  }
  return { device: device as Device, license: device.license, business: device.business, status };
}
