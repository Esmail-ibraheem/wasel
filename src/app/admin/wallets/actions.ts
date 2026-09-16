"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { firstErrors, templateSchema, walletSchema } from "@/lib/validation";
import type { ActionState } from "@/components/form";

function walletInput(formData: FormData) {
  return walletSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    senderIds: formData.get("senderIds"),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  });
}

export async function createWallet(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const parsed = walletInput(formData);
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  if (await db.wallet.findUnique({ where: { code: parsed.data.code } })) return { ok: false, errors: { code: "الرمز مستخدم مسبقًا." } };
  const w = await db.wallet.create({ data: { ...parsed.data, senderIds: JSON.stringify(parsed.data.senderIds) } });
  await audit({ action: "WALLET_CREATED", userId: admin.id, entityType: "Wallet", entityId: w.id, details: { code: w.code } });
  revalidatePath("/admin/wallets");
  redirect(`/admin/wallets/${w.id}`);
}

export async function updateWallet(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = walletInput(formData);
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  const clash = await db.wallet.findUnique({ where: { code: parsed.data.code } });
  if (clash && clash.id !== id) return { ok: false, errors: { code: "الرمز مستخدم لمحفظة أخرى." } };
  await db.wallet.update({ where: { id }, data: { ...parsed.data, senderIds: JSON.stringify(parsed.data.senderIds) } });
  await audit({ action: "WALLET_UPDATED", userId: admin.id, entityType: "Wallet", entityId: id, details: parsed.data });
  revalidatePath("/admin/wallets");
  revalidatePath(`/admin/wallets/${id}`);
  return { ok: true, message: "تم حفظ المحفظة." };
}

function templateInput(formData: FormData) {
  return templateSchema.safeParse({
    name: formData.get("name"),
    pattern: formData.get("pattern"),
    flags: formData.get("flags") ?? "iu",
    priority: formData.get("priority") ?? 0,
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    sampleText: formData.get("sampleText"),
  });
}

export async function saveTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const walletId = String(formData.get("walletId") ?? "");
  const id = String(formData.get("id") ?? "");
  const parsed = templateInput(formData);
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  const data = { ...parsed.data, sampleText: parsed.data.sampleText || null };

  if (id) {
    const existing = await db.messageTemplate.findFirst({ where: { id, walletId } });
    if (!existing) return { ok: false, message: "النمط غير موجود." };
    await db.messageTemplate.update({ where: { id }, data });
    await audit({ action: "TEMPLATE_UPDATED", userId: admin.id, entityType: "MessageTemplate", entityId: id, details: { name: data.name } });
  } else {
    const t = await db.messageTemplate.create({ data: { ...data, walletId } });
    await audit({ action: "TEMPLATE_CREATED", userId: admin.id, entityType: "MessageTemplate", entityId: t.id, details: { name: data.name, walletId } });
  }
  revalidatePath(`/admin/wallets/${walletId}`);
  return { ok: true, message: "تم حفظ النمط." };
}

export async function deleteTemplate(formData: FormData): Promise<void> {
  const admin = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const t = await db.messageTemplate.findUnique({ where: { id } });
  if (!t) return;
  await db.messageTemplate.delete({ where: { id } });
  await audit({ action: "TEMPLATE_DELETED", userId: admin.id, entityType: "MessageTemplate", entityId: id, details: { name: t.name } });
  revalidatePath(`/admin/wallets/${t.walletId}`);
}
