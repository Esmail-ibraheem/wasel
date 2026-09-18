import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const AUDIT_ACTIONS = {
  LOGIN: "تسجيل دخول",
  LOGIN_FAILED: "محاولة دخول فاشلة",
  LOGOUT: "تسجيل خروج",
  BUSINESS_REGISTERED: "تسجيل منشأة",
  USER_CREATED: "إضافة مستخدم",
  USER_UPDATED: "تعديل مستخدم",
  USER_DEACTIVATED: "تعطيل مستخدم",
  USER_ACTIVATED: "تفعيل مستخدم",
  PASSWORD_RESET: "إعادة تعيين كلمة مرور",
  PHONE_ADDED: "إضافة رقم هاتف",
  PHONE_VERIFIED: "تحقق من رقم هاتف",
  PHONE_KEY_ROTATED: "تجديد مفتاح الرقم",
  PHONE_REMOVED: "حذف رقم هاتف",
  PHONE_UPDATED: "تعديل رقم هاتف",
  WALLET_TOGGLED: "تغيير حالة محفظة",
  TRANSFER_RECEIVED: "استلام تحويل",
  TRANSFER_STATUS_CHANGED: "تغيير حالة تحويل",
  TRANSFER_NOTE_UPDATED: "تعديل ملاحظة تحويل",
  MESSAGE_MANUAL: "إدخال رسالة يدويًا",
  TEMPLATE_CREATED: "إضافة نمط رسالة",
  TEMPLATE_UPDATED: "تعديل نمط رسالة",
  TEMPLATE_DELETED: "حذف نمط رسالة",
  WALLET_CREATED: "إضافة محفظة",
  WALLET_UPDATED: "تعديل محفظة",
  SETTINGS_UPDATED: "تعديل الإعدادات",
  EXPORT: "تصدير بيانات",
  BUSINESS_APPROVED: "الموافقة على منشأة",
  BUSINESS_REJECTED: "رفض منشأة",
  BUSINESS_SUSPENDED: "إيقاف منشأة",
  BUSINESS_REACTIVATED: "إعادة تفعيل منشأة",
  BUSINESS_UPDATED: "تعديل بيانات منشأة",
  LICENSE_ISSUED: "إصدار ترخيص",
  LICENSE_UPDATED: "تعديل ترخيص",
  INSTALLATION_REGISTERED: "تسجيل تركيب",
  INSTALLATION_UPDATED: "تعديل تركيب",
  DEVICE_REGISTERED: "تسجيل جهاز",
  DEVICE_UPDATED: "تعديل جهاز",
  LICENSE_ACTIVATION_FAILED: "محاولة تفعيل فاشلة",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function auditLabel(action: string): string {
  return (AUDIT_ACTIONS as Record<string, string>)[action] ?? action;
}

export interface AuditInput {
  action: AuditAction;
  businessId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ip?: string | null;
}

export function auditData(input: AuditInput): Prisma.AuditLogUncheckedCreateInput {
  return {
    action: input.action,
    businessId: input.businessId ?? null,
    userId: input.userId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    details: input.details ? JSON.stringify(input.details) : null,
    ip: input.ip ?? null,
  };
}

export async function audit(input: AuditInput): Promise<void> {
  await db.auditLog.create({ data: auditData(input) });
}
