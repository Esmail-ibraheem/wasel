import { z } from "zod";
import { ROLES } from "./permissions";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "اسم المستخدم 3 أحرف على الأقل")
  .max(32, "اسم المستخدم طويل جدًا")
  .regex(/^[a-z0-9_.]+$/, "اسم المستخدم: أحرف إنجليزية صغيرة وأرقام و _ . فقط");

export const passwordSchema = z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(128, "كلمة المرور طويلة جدًا");

export const fullNameSchema = z.string().trim().min(2, "الاسم قصير جدًا").max(80, "الاسم طويل جدًا");

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "أدخل كلمة المرور"),
});

export const registerSchema = z
  .object({
    businessName: z.string().trim().min(2, "اسم المنشأة قصير جدًا").max(120, "اسم المنشأة طويل جدًا"),
    contactPhone: z
      .string()
      .trim()
      .min(7, "أدخل رقم تواصل صحيحًا")
      .max(20, "رقم التواصل طويل جدًا")
      .regex(/^[+\d\s-]+$/, "أدخل رقم تواصل صحيحًا"),
    contactNote: z.string().trim().max(500, "الملاحظة طويلة جدًا").optional().or(z.literal("")),
    fullName: fullNameSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "كلمتا المرور غير متطابقتين" });

export const roleSchema = z.enum(ROLES, { message: "دور غير معروف" });

export const createUserSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  password: passwordSchema,
  role: roleSchema,
});

/** Yemeni numbers: 7xxxxxxxx (9 digits) optionally prefixed with 967 / +967 / 00967. Stored as 9677xxxxxxxx. */
export const phoneNumberSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s\-()]/g, ""))
  .transform((s) => s.replace(/^\+/, "").replace(/^00/, ""))
  .transform((s) => (s.startsWith("967") ? s : s.startsWith("0") ? "967" + s.slice(1) : "967" + s))
  .refine((s) => /^9677\d{8}$/.test(s), "أدخل رقمًا يمنيًا صحيحًا مثل 777123456");

export const addPhoneSchema = z.object({
  number: phoneNumberSchema,
  label: z.string().trim().max(60, "الوصف طويل جدًا").optional().or(z.literal("")),
});

export const manualMessageSchema = z.object({
  phoneNumberId: z.string().min(1, "اختر رقم الهاتف"),
  walletId: z.string().min(1, "اختر المحفظة"),
  text: z.string().trim().min(5, "نص الرسالة قصير جدًا").max(2000, "نص الرسالة طويل جدًا"),
  receivedAt: z.string().optional().or(z.literal("")),
});

export const transferStatusSchema = z.enum(["NEW", "REVIEWED", "CONFIRMED", "REJECTED"]);

export const templateSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير جدًا").max(80),
  pattern: z
    .string()
    .trim()
    .min(3, "النمط قصير جدًا")
    .max(2000)
    .refine((p) => p.includes("(?<amount>"), "يجب أن يحتوي النمط على المجموعة (?<amount>...)")
    .refine(
      (p) => {
        try {
          new RegExp(p, "u");
          return true;
        } catch {
          return false;
        }
      },
      { message: "التعبير النمطي غير صالح" },
    ),
  flags: z
    .string()
    .trim()
    .max(4)
    .regex(/^[imsu]*$/, "الأعلام المسموحة: i m s u")
    .transform((f) => (f.includes("u") ? f : f + "u")),
  priority: z.coerce.number().int().min(-100).max(100),
  isActive: z.coerce.boolean(),
  sampleText: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const walletSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(24)
    .regex(/^[a-z0-9_-]+$/, "الرمز: أحرف إنجليزية صغيرة وأرقام فقط"),
  name: z.string().trim().min(2, "الاسم قصير جدًا").max(60),
  senderIds: z
    .string()
    .transform((s) =>
      s
        .split(/[\n,،]/)
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .refine((a) => a.length > 0, "أدخل معرّف مرسل واحدًا على الأقل"),
  isActive: z.coerce.boolean(),
});

export function firstErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
