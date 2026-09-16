"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { ingestSms } from "@/lib/ingest";
import { firstErrors, manualMessageSchema } from "@/lib/validation";
import type { ActionState } from "@/components/form";

export async function submitManualMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!can(user.role, "messages.manual")) return { ok: false, message: "لا تملك صلاحية إدخال الرسائل." };

  const parsed = manualMessageSchema.safeParse({
    phoneNumberId: formData.get("phoneNumberId"),
    walletId: formData.get("walletId"),
    text: formData.get("text"),
    receivedAt: formData.get("receivedAt"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };

  const phone = await db.phoneNumber.findFirst({ where: { id: parsed.data.phoneNumberId, businessId: user.businessId } });
  if (!phone) return { ok: false, errors: { phoneNumberId: "رقم الهاتف غير موجود." } };
  if (phone.status !== "VERIFIED") return { ok: false, errors: { phoneNumberId: "هذا الرقم لم يُوثَّق بعد." } };

  let receivedAt = new Date();
  if (parsed.data.receivedAt) {
    // datetime-local has no zone; treat it as Yemen local time.
    const d = new Date(parsed.data.receivedAt + "+03:00");
    if (!Number.isNaN(d.getTime())) receivedAt = d;
  }

  const result = await ingestSms({
    phone,
    sender: "manual",
    text: parsed.data.text,
    receivedAt,
    source: "MANUAL",
    walletId: parsed.data.walletId,
    createdById: user.id,
  });

  await audit({
    action: "MESSAGE_MANUAL",
    businessId: user.businessId,
    userId: user.id,
    entityType: "RawMessage",
    entityId: "rawMessageId" in result ? result.rawMessageId : undefined,
    details: { status: result.status, walletId: parsed.data.walletId },
  });

  revalidatePath("/app");
  revalidatePath("/app/transfers");
  revalidatePath("/app/messages");

  switch (result.status) {
    case "PARSED":
      return { ok: true, message: `تم تسجيل التحويل بنجاح. يمكنك فتحه من قائمة التحويلات.` };
    case "DUPLICATE":
      return { ok: false, message: "هذه الرسالة مسجلة مسبقًا (نص مطابق خلال 24 ساعة)." };
    case "DUPLICATE_TRANSFER":
      return { ok: false, message: "يوجد تحويل مسجل بنفس رقم العملية لهذه المحفظة. حُفظت الرسالة كعملية مكررة." };
    case "UNMATCHED":
      return { ok: false, message: "حُفظت الرسالة لكن لم يتعرف النظام على صيغتها. راجع نص الرسالة أو جرّبه في صفحة المحافظ." };
    case "IGNORED_SENDER":
      return { ok: false, errors: { walletId: "هذه المحفظة غير مفعّلة للمنشأة." } };
    default:
      return { ok: false, message: "تعذّر تسجيل الرسالة." };
  }
}
