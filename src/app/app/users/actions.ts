"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { canManageRole, isRole } from "@/lib/permissions";
import { createUserSchema, firstErrors, passwordSchema, roleSchema } from "@/lib/validation";
import type { ActionState } from "@/components/form";

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  const parsed = createUserSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  if (!canManageRole(actor.role, parsed.data.role)) return { ok: false, errors: { role: "لا يمكنك إضافة مستخدم بهذا الدور." } };
  if (await db.user.findUnique({ where: { username: parsed.data.username } })) {
    return { ok: false, errors: { username: "اسم المستخدم محجوز." } };
  }
  const user = await db.user.create({
    data: {
      businessId: actor.businessId,
      username: parsed.data.username,
      fullName: parsed.data.fullName,
      passwordHash: hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
  });
  await audit({ action: "USER_CREATED", businessId: actor.businessId, userId: actor.id, entityType: "User", entityId: user.id, details: { username: user.username, role: user.role } });
  revalidatePath("/app/users");
  return { ok: true, message: `تمت إضافة ${user.fullName}.` };
}

async function loadTarget(actorBusinessId: string, id: string) {
  return db.user.findFirst({ where: { id, businessId: actorBusinessId } });
}

export async function updateUserRole(formData: FormData): Promise<void> {
  const actor = await requirePermission("users.manage");
  const id = String(formData.get("id") ?? "");
  const role = roleSchema.safeParse(formData.get("role"));
  if (!role.success || id === actor.id) return;
  const target = await loadTarget(actor.businessId, id);
  if (!target || !isRole(target.role)) return;
  if (!canManageRole(actor.role, target.role) || !canManageRole(actor.role, role.data)) return;
  await db.user.update({ where: { id }, data: { role: role.data } });
  await audit({ action: "USER_UPDATED", businessId: actor.businessId, userId: actor.id, entityType: "User", entityId: id, details: { username: target.username, from: target.role, to: role.data } });
  revalidatePath("/app/users");
}

export async function setUserActive(formData: FormData): Promise<void> {
  const actor = await requirePermission("users.manage");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "1";
  if (id === actor.id) return;
  const target = await loadTarget(actor.businessId, id);
  if (!target || !canManageRole(actor.role, target.role)) return;
  await db.$transaction([
    db.user.update({ where: { id }, data: { isActive: active } }),
    ...(active ? [] : [db.session.deleteMany({ where: { userId: id } })]),
  ]);
  await audit({ action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED", businessId: actor.businessId, userId: actor.id, entityType: "User", entityId: id, details: { username: target.username } });
  revalidatePath("/app/users");
}

export async function resetUserPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requirePermission("users.manage");
  const id = String(formData.get("id") ?? "");
  const pw = passwordSchema.safeParse(formData.get("password"));
  if (!pw.success) return { ok: false, errors: { password: pw.error.issues[0].message } };
  const target = await loadTarget(actor.businessId, id);
  if (!target || (id !== actor.id && !canManageRole(actor.role, target.role))) return { ok: false, message: "غير مسموح." };
  await db.$transaction([
    db.user.update({ where: { id }, data: { passwordHash: hashPassword(pw.data) } }),
    db.session.deleteMany({ where: { userId: id } }),
  ]);
  await audit({ action: "PASSWORD_RESET", businessId: actor.businessId, userId: actor.id, entityType: "User", entityId: id, details: { username: target.username } });
  revalidatePath("/app/users");
  return { ok: true, message: "تم تغيير كلمة المرور وإنهاء جلسات المستخدم." };
}
