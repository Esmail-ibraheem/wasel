"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { issueLicense } from "@/lib/licensing/service";
import { LICENSE_STATUSES } from "@/lib/licensing/access";
import type { ActionState } from "@/components/form";

const licenseForm = z.object({
  plan: z.string().trim().max(60).optional().or(z.literal("")),
  days: z.coerce.number().int().min(0).max(3650).default(365),
  maxPhones: z.coerce.number().int().min(1).max(500).default(5),
  maxUsers: z.coerce.number().int().min(1).max(1000).default(10),
  maxDevices: z.coerce.number().int().min(0).max(1000).default(3),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

function refresh(businessId: string) {
  revalidatePath("/admin");
  revalidatePath(`/admin/businesses/${businessId}`);
}

async function loadBusiness(id: string) {
  return db.business.findUnique({ where: { id } });
}

/** Approve a pending business and issue its first license in one step. */
export async function approveBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const biz = await loadBusiness(id);
  if (!biz) return { ok: false, message: "المنشأة غير موجودة." };
  if (!["PENDING", "REJECTED"].includes(biz.status)) return { ok: false, message: "هذه المنشأة ليست بانتظار التفعيل." };
  const parsed = licenseForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "بيانات الترخيص غير صالحة." };

  const license = await issueLicense({
    businessId: id,
    plan: parsed.data.plan || undefined,
    days: parsed.data.days || null,
    maxPhones: parsed.data.maxPhones,
    maxUsers: parsed.data.maxUsers,
    maxDevices: parsed.data.maxDevices,
    note: parsed.data.note || null,
    issuedById: admin.id,
  });
  await db.business.update({
    where: { id },
    data: { status: "ACTIVE", activatedAt: new Date(), reviewedById: admin.id, reviewedAt: new Date(), reviewNote: null },
  });
  await audit({ action: "BUSINESS_APPROVED", businessId: id, userId: admin.id, entityType: "Business", entityId: id, details: { publicId: biz.publicId, license: license.key } });
  await audit({ action: "LICENSE_ISSUED", businessId: id, userId: admin.id, entityType: "License", entityId: license.id, details: { key: license.key, plan: license.plan, expiresAt: license.expiresAt } });
  refresh(id);
  return { ok: true, message: `تم تفعيل ${biz.name} وإصدار الترخيص ${license.key}.` };
}

export async function rejectBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const biz = await loadBusiness(id);
  if (!biz) return { ok: false, message: "المنشأة غير موجودة." };
  if (!note) return { ok: false, errors: { note: "اكتب سبب الرفض — يظهر للعميل." } };
  await db.$transaction([
    db.business.update({ where: { id }, data: { status: "REJECTED", reviewNote: note, reviewedById: admin.id, reviewedAt: new Date() } }),
    db.session.deleteMany({ where: { user: { businessId: id } } }),
  ]);
  await audit({ action: "BUSINESS_REJECTED", businessId: id, userId: admin.id, entityType: "Business", entityId: id, details: { publicId: biz.publicId, note } });
  refresh(id);
  return { ok: true, message: `تم رفض ${biz.name}.` };
}

export async function suspendBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const biz = await loadBusiness(id);
  if (!biz) return { ok: false, message: "المنشأة غير موجودة." };
  if (biz.status !== "ACTIVE") return { ok: false, message: "المنشأة ليست فعّالة." };
  if (!note) return { ok: false, errors: { note: "اكتب سبب الإيقاف — يظهر للعميل." } };
  await db.$transaction([
    db.business.update({ where: { id }, data: { status: "SUSPENDED", reviewNote: note, reviewedById: admin.id, reviewedAt: new Date() } }),
    db.session.deleteMany({ where: { user: { businessId: id } } }),
  ]);
  await audit({ action: "BUSINESS_SUSPENDED", businessId: id, userId: admin.id, entityType: "Business", entityId: id, details: { publicId: biz.publicId, note } });
  refresh(id);
  return { ok: true, message: `تم إيقاف ${biz.name}. أُنهيت جلسات مستخدميها.` };
}

export async function reactivateBusiness(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const biz = await loadBusiness(id);
  if (!biz || biz.status !== "SUSPENDED") return;
  await db.business.update({ where: { id }, data: { status: "ACTIVE", reviewNote: null, reviewedById: admin.id, reviewedAt: new Date() } });
  await audit({ action: "BUSINESS_REACTIVATED", businessId: id, userId: admin.id, entityType: "Business", entityId: id, details: { publicId: biz.publicId } });
  refresh(id);
}

export async function updateBusinessInfo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    contactPhone: z.string().trim().max(20).optional().or(z.literal("")),
    contactNote: z.string().trim().max(500).optional().or(z.literal("")),
  });
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "بيانات غير صالحة." };
  await db.business.update({ where: { id }, data: { name: parsed.data.name, contactPhone: parsed.data.contactPhone || null, contactNote: parsed.data.contactNote || null } });
  await audit({ action: "BUSINESS_UPDATED", businessId: id, userId: admin.id, entityType: "Business", entityId: id, details: parsed.data });
  refresh(id);
  return { ok: true, message: "تم الحفظ." };
}

/* ---------- licenses ---------- */

export async function issueLicenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const businessId = String(formData.get("businessId") ?? "");
  const biz = await loadBusiness(businessId);
  if (!biz) return { ok: false, message: "المنشأة غير موجودة." };
  const parsed = licenseForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "بيانات الترخيص غير صالحة." };
  const status = formData.get("status") === "PENDING" ? "PENDING" : "ACTIVE";
  const license = await issueLicense({
    businessId,
    plan: parsed.data.plan || undefined,
    days: parsed.data.days || null,
    maxPhones: parsed.data.maxPhones,
    maxUsers: parsed.data.maxUsers,
    maxDevices: parsed.data.maxDevices,
    note: parsed.data.note || null,
    status,
    issuedById: admin.id,
  });
  await audit({ action: "LICENSE_ISSUED", businessId, userId: admin.id, entityType: "License", entityId: license.id, details: { key: license.key, plan: license.plan, status, expiresAt: license.expiresAt } });
  refresh(businessId);
  return { ok: true, message: `صدر الترخيص ${license.key}.` };
}

export async function setLicenseStatus(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(LICENSE_STATUSES as readonly string[]).includes(status)) return;
  const license = await db.license.findUnique({ where: { id } });
  if (!license) return;
  const data: { status: string; activatedAt?: Date; expiresAt?: Date | null } = { status };
  if (status === "ACTIVE") {
    data.activatedAt = license.activatedAt ?? new Date();
    // Re-activating an expired license without a new date would expire again immediately.
    if (license.expiresAt && license.expiresAt <= new Date()) data.expiresAt = null;
  }
  await db.license.update({ where: { id }, data });
  await audit({ action: "LICENSE_UPDATED", businessId: license.businessId, userId: admin.id, entityType: "License", entityId: id, details: { key: license.key, from: license.status, to: status } });
  refresh(license.businessId);
}

export async function extendLicense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const days = z.coerce.number().int().min(-3650).max(3650).safeParse(formData.get("days"));
  const license = await db.license.findUnique({ where: { id } });
  if (!license) return { ok: false, message: "الترخيص غير موجود." };
  if (!days.success) return { ok: false, message: "عدد أيام غير صالح." };
  const base = license.expiresAt && license.expiresAt > new Date() ? license.expiresAt : new Date();
  const expiresAt = days.data === 0 ? null : new Date(base.getTime() + days.data * 86400e3);
  await db.license.update({ where: { id }, data: { expiresAt, status: license.status === "EXPIRED" ? "ACTIVE" : license.status } });
  await audit({ action: "LICENSE_UPDATED", businessId: license.businessId, userId: admin.id, entityType: "License", entityId: id, details: { key: license.key, expiresAt, days: days.data } });
  refresh(license.businessId);
  return { ok: true, message: expiresAt ? `الترخيص ساري حتى ${expiresAt.toISOString().slice(0, 10)}.` : "الترخيص أصبح دائمًا (بلا انتهاء)." };
}

export async function updateLicenseLimits(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = licenseForm.pick({ plan: true, maxPhones: true, maxUsers: true, maxDevices: true, note: true }).safeParse(Object.fromEntries(formData.entries()));
  const license = await db.license.findUnique({ where: { id } });
  if (!license) return { ok: false, message: "الترخيص غير موجود." };
  if (!parsed.success) return { ok: false, message: "قيم غير صالحة." };
  await db.license.update({
    where: { id },
    data: { plan: parsed.data.plan || license.plan, maxPhones: parsed.data.maxPhones, maxUsers: parsed.data.maxUsers, maxDevices: parsed.data.maxDevices, note: parsed.data.note || null },
  });
  await audit({ action: "LICENSE_UPDATED", businessId: license.businessId, userId: admin.id, entityType: "License", entityId: id, details: { key: license.key, ...parsed.data } });
  refresh(license.businessId);
  return { ok: true, message: "تم تحديث الترخيص." };
}

/* ---------- installations & devices ---------- */

export async function setInstallationStatus(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "BLOCKED" ? "BLOCKED" : "ACTIVE";
  const inst = await db.installation.findUnique({ where: { id } });
  if (!inst) return;
  await db.installation.update({ where: { id }, data: { status } });
  await audit({ action: "INSTALLATION_UPDATED", businessId: inst.businessId, userId: admin.id, entityType: "Installation", entityId: id, details: { publicId: inst.publicId, status } });
  refresh(inst.businessId);
}

export async function setDeviceStatus(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "BLOCKED" ? "BLOCKED" : "ACTIVE";
  const dev = await db.device.findUnique({ where: { id } });
  if (!dev) return;
  await db.device.update({ where: { id }, data: { status } });
  await audit({ action: "DEVICE_UPDATED", businessId: dev.businessId, userId: admin.id, entityType: "Device", entityId: id, details: { publicId: dev.publicId, status } });
  refresh(dev.businessId);
}

export async function deleteDevice(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const dev = await db.device.findUnique({ where: { id } });
  if (!dev) return;
  await db.device.delete({ where: { id } });
  await audit({ action: "DEVICE_UPDATED", businessId: dev.businessId, userId: admin.id, entityType: "Device", entityId: id, details: { publicId: dev.publicId, deleted: true } });
  refresh(dev.businessId);
}
