"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { passwordSchema } from "@/lib/validation";
import type { ActionState } from "@/components/form";

export async function updateBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("settings.manage");
  const name = z.string().trim().min(2, "الاسم قصير جدًا").max(120).safeParse(formData.get("name"));
  if (!name.success) return { ok: false, errors: { name: name.error.issues[0].message } };
  await db.business.update({ where: { id: user.businessId }, data: { name: name.data } });
  await audit({ action: "SETTINGS_UPDATED", businessId: user.businessId, userId: user.id, details: { name: name.data } });
  revalidatePath("/app", "layout");
  return { ok: true, message: "تم حفظ الإعدادات." };
}

export async function changeOwnPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = passwordSchema.safeParse(formData.get("password"));
  if (!next.success) return { ok: false, errors: { password: next.error.issues[0].message } };
  if (next.data !== String(formData.get("confirm") ?? "")) return { ok: false, errors: { confirm: "كلمتا المرور غير متطابقتين" } };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!verifyPassword(current, row.passwordHash)) return { ok: false, errors: { current: "كلمة المرور الحالية غير صحيحة" } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next.data) } });
  await audit({ action: "PASSWORD_RESET", businessId: user.businessId, userId: user.id, entityType: "User", entityId: user.id, details: { self: true } });
  return { ok: true, message: "تم تغيير كلمة المرور." };
}
