"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { generateApiKey, generateVerificationCode, randomToken } from "@/lib/auth/tokens";
import { addPhoneSchema, firstErrors } from "@/lib/validation";
import type { ActionState } from "@/components/form";

export type PhoneActionState =
  | (NonNullable<ActionState> & { secret?: { apiKey: string; hmacSecret?: string; number: string } })
  | null;

const MAX_PHONES_PER_BUSINESS = 5;

export async function addPhone(_prev: PhoneActionState, formData: FormData): Promise<PhoneActionState> {
  const user = await requirePermission("phones.manage");
  const parsed = addPhoneSchema.safeParse({ number: formData.get("number"), label: formData.get("label") });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };

  const count = await db.phoneNumber.count({ where: { businessId: user.businessId } });
  if (count >= MAX_PHONES_PER_BUSINESS) return { ok: false, message: `الحد الأقصى ${MAX_PHONES_PER_BUSINESS} أرقام لكل منشأة في هذه الباقة.` };

  const existing = await db.phoneNumber.findUnique({ where: { number: parsed.data.number } });
  if (existing) {
    return {
      ok: false,
      errors: {
        number:
          existing.businessId === user.businessId
            ? "هذا الرقم مضاف مسبقًا."
            : "هذا الرقم مرتبط بمنشأة أخرى. لا يمكن ربط الرقم نفسه بأكثر من حساب.",
      },
    };
  }

  const key = generateApiKey();
  const phone = await db.phoneNumber.create({
    data: {
      businessId: user.businessId,
      number: parsed.data.number,
      label: parsed.data.label || null,
      status: "PENDING",
      verificationCode: generateVerificationCode(),
      apiKeyHash: key.hash,
      apiKeyPrefix: key.prefix,
    },
  });
  await audit({ action: "PHONE_ADDED", businessId: user.businessId, userId: user.id, entityType: "PhoneNumber", entityId: phone.id, details: { number: phone.number } });
  revalidatePath("/app/phones");
  return {
    ok: true,
    message: "تمت إضافة الرقم. انسخ مفتاح الوصول الآن — لن يظهر مرة أخرى.",
    secret: { apiKey: key.key, number: phone.number },
  };
}

export async function rotatePhoneKey(_prev: PhoneActionState, formData: FormData): Promise<PhoneActionState> {
  const user = await requirePermission("phones.manage");
  const id = String(formData.get("id") ?? "");
  const withHmac = formData.get("hmac") === "1";
  const phone = await db.phoneNumber.findFirst({ where: { id, businessId: user.businessId } });
  if (!phone) return { ok: false, message: "الرقم غير موجود." };

  const key = generateApiKey();
  const hmacSecret = withHmac ? randomToken(24) : null;
  await db.phoneNumber.update({ where: { id }, data: { apiKeyHash: key.hash, apiKeyPrefix: key.prefix, hmacSecret } });
  await audit({ action: "PHONE_KEY_ROTATED", businessId: user.businessId, userId: user.id, entityType: "PhoneNumber", entityId: id, details: { number: phone.number, hmac: withHmac } });
  revalidatePath("/app/phones");
  return {
    ok: true,
    message: "تم إنشاء مفتاح جديد. المفتاح القديم لم يعد صالحًا.",
    secret: { apiKey: key.key, hmacSecret: hmacSecret ?? undefined, number: phone.number },
  };
}

export async function setPhoneStatus(formData: FormData): Promise<void> {
  const user = await requirePermission("phones.manage");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["VERIFIED", "DISABLED"].includes(status)) return;
  const phone = await db.phoneNumber.findFirst({ where: { id, businessId: user.businessId } });
  if (!phone) return;
  // Re-enabling only returns to VERIFIED if it was verified before; otherwise back to PENDING.
  const next = status === "VERIFIED" && !phone.verifiedAt ? "PENDING" : status;
  await db.phoneNumber.update({ where: { id }, data: { status: next } });
  await audit({ action: "PHONE_UPDATED", businessId: user.businessId, userId: user.id, entityType: "PhoneNumber", entityId: id, details: { number: phone.number, status: next } });
  revalidatePath("/app/phones");
}

export async function removePhone(formData: FormData): Promise<void> {
  const user = await requirePermission("phones.manage");
  const id = String(formData.get("id") ?? "");
  const phone = await db.phoneNumber.findFirst({ where: { id, businessId: user.businessId }, include: { _count: { select: { transfers: true } } } });
  if (!phone) return;
  if (phone._count.transfers > 0) {
    // Keep history intact: disable instead of deleting.
    await db.phoneNumber.update({ where: { id }, data: { status: "DISABLED" } });
  } else {
    await db.phoneNumber.delete({ where: { id } });
  }
  await audit({ action: "PHONE_REMOVED", businessId: user.businessId, userId: user.id, entityType: "PhoneNumber", entityId: id, details: { number: phone.number, hadTransfers: phone._count.transfers > 0 } });
  revalidatePath("/app/phones");
}
