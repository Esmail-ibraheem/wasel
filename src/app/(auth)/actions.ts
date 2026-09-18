"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { firstErrors, loginSchema, registerSchema } from "@/lib/validation";
import { businessPublicId } from "@/lib/licensing/ids";
import type { ActionState } from "@/components/form";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };

  const ip = await clientIp();
  const limit = rateLimit(`login:${ip}:${parsed.data.username}`, 8, 15 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, message: `محاولات كثيرة. حاول مجددًا بعد ${Math.ceil(limit.retryAfterSec / 60)} دقيقة.` };
  }

  const user = await db.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    await audit({ action: "LOGIN_FAILED", businessId: user?.businessId, userId: user?.id, ip, details: { username: parsed.data.username } });
    return { ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة." };
  }
  if (!user.isActive) return { ok: false, message: "هذا الحساب معطّل. تواصل مع مدير المنشأة." };

  await createSession(user.id);
  await audit({ action: "LOGIN", businessId: user.businessId, userId: user.id, ip });
  // /app itself redirects to /activation when the business is not active.
  redirect(user.businessId ? "/app" : user.isSuperAdmin ? "/admin" : "/login");
}

export async function register(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    businessName: formData.get("businessName"),
    contactPhone: formData.get("contactPhone"),
    contactNote: formData.get("contactNote"),
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };

  const ip = await clientIp();
  const limit = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return { ok: false, message: "محاولات تسجيل كثيرة من هذا الجهاز. حاول لاحقًا." };

  if (await db.user.findUnique({ where: { username: parsed.data.username } })) {
    return { ok: false, errors: { username: "اسم المستخدم محجوز. اختر اسمًا آخر." } };
  }

  const { business, owner } = await db.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        publicId: businessPublicId(),
        name: parsed.data.businessName,
        status: "PENDING",
        contactPhone: parsed.data.contactPhone,
        contactNote: parsed.data.contactNote || null,
      },
    });
    const owner = await tx.user.create({
      data: {
        businessId: business.id,
        username: parsed.data.username,
        fullName: parsed.data.fullName,
        passwordHash: hashPassword(parsed.data.password),
        role: "OWNER",
      },
    });
    return { business, owner };
  });

  await createSession(owner.id);
  await audit({
    action: "BUSINESS_REGISTERED",
    businessId: business.id,
    userId: owner.id,
    entityType: "Business",
    entityId: business.id,
    ip,
    details: { publicId: business.publicId, contactPhone: business.contactPhone },
  });
  // New businesses wait for the platform owner's approval.
  redirect("/activation");
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit({ action: "LOGOUT", businessId: user.businessId, userId: user.id });
  redirect("/login");
}
