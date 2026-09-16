import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { formatDateTime, transferStatusLabel } from "@/lib/format";
import { buildTransferWhere, type TransferFilters } from "@/lib/queries/transfers";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.businessId) return new Response("unauthorized", { status: 401 });
  if (!can(user.role, "transfers.export")) return new Response("forbidden", { status: 403 });

  const url = new URL(req.url);
  const f: TransferFilters = Object.fromEntries(url.searchParams.entries());
  const where = buildTransferWhere(user.businessId, f);
  const rows = await db.transfer.findMany({
    where,
    orderBy: { transferredAt: "desc" },
    take: 5000,
    include: { wallet: { select: { name: true } }, phoneNumber: { select: { number: true } } },
  });

  const header = ["وقت التحويل", "المحفظة", "المبلغ", "العملة", "اسم المرسل", "رقم المرسل", "رقم العملية", "الحالة", "ملاحظة", "الرقم المستقبل", "المعرّف"];
  const lines = [header.map(csvCell).join(",")];
  for (const t of rows) {
    lines.push(
      [
        formatDateTime(t.transferredAt),
        t.wallet.name,
        t.amount,
        t.currency,
        t.senderName,
        t.senderPhone,
        t.reference,
        transferStatusLabel(t.status),
        t.note,
        t.phoneNumber.number,
        t.id,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  await audit({ action: "EXPORT", businessId: user.businessId, userId: user.id, details: { rows: rows.length, filters: f } });

  // BOM so Excel opens Arabic correctly.
  const body = "﻿" + lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wasel-transfers-${stamp}.csv"`,
    },
  });
}
