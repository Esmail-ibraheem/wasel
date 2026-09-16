"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { transferStatusSchema } from "@/lib/validation";
import { TRANSITIONS } from "@/lib/transfer-workflow";
import type { ActionState } from "@/components/form";

export async function changeTransferStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const parsedStatus = transferStatusSchema.safeParse(formData.get("status"));
  if (!id || !parsedStatus.success) return { ok: false, message: "طلب غير صالح." };
  const to = parsedStatus.data;

  const transfer = await db.transfer.findFirst({ where: { id, businessId: user.businessId } });
  if (!transfer) return { ok: false, message: "التحويل غير موجود." };

  const allowed = (TRANSITIONS[transfer.status] ?? []).find((t) => t.to === to);
  if (!allowed) return { ok: false, message: "هذا الانتقال غير مسموح من الحالة الحالية." };
  if (!can(user.role, allowed.permission)) return { ok: false, message: "لا تملك صلاحية هذا الإجراء." };
  if (to === "REJECTED" && !note) return { ok: false, errors: { note: "اكتب سبب الرفض." } };

  await db.$transaction([
    db.transfer.update({
      where: { id },
      data: {
        status: to,
        ...(note && { note }),
        events: { create: { fromStatus: transfer.status, toStatus: to, userId: user.id, note: note || null } },
      },
    }),
    db.auditLog.create({
      data: {
        businessId: user.businessId,
        userId: user.id,
        action: "TRANSFER_STATUS_CHANGED",
        entityType: "Transfer",
        entityId: id,
        details: JSON.stringify({ from: transfer.status, to, note: note || undefined, reference: transfer.reference, amount: transfer.amount }),
      },
    }),
  ]);

  revalidatePath(`/app/transfers/${id}`);
  revalidatePath("/app/transfers");
  revalidatePath("/app");
  return { ok: true, message: "تم تحديث حالة التحويل." };
}

export async function updateTransferNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!can(user.role, "transfers.review")) return { ok: false, message: "لا تملك صلاحية هذا الإجراء." };
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const transfer = await db.transfer.findFirst({ where: { id, businessId: user.businessId } });
  if (!transfer) return { ok: false, message: "التحويل غير موجود." };
  await db.transfer.update({ where: { id }, data: { note: note || null } });
  await audit({ action: "TRANSFER_NOTE_UPDATED", businessId: user.businessId, userId: user.id, entityType: "Transfer", entityId: id, details: { note } });
  revalidatePath(`/app/transfers/${id}`);
  return { ok: true, message: "تم حفظ الملاحظة." };
}
