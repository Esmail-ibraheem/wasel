"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { parseWithTemplates, type ParseResult } from "@/lib/parser/engine";
import { normalizeText } from "@/lib/parser/normalize";

export async function toggleWallet(formData: FormData): Promise<void> {
  const user = await requirePermission("wallets.manage");
  const walletId = String(formData.get("walletId") ?? "");
  const enable = formData.get("enable") === "1";
  const wallet = await db.wallet.findUnique({ where: { id: walletId } });
  if (!wallet) return;
  await db.businessWallet.upsert({
    where: { businessId_walletId: { businessId: user.businessId, walletId } },
    create: { businessId: user.businessId, walletId, isEnabled: enable },
    update: { isEnabled: enable },
  });
  await audit({ action: "WALLET_TOGGLED", businessId: user.businessId, userId: user.id, entityType: "Wallet", entityId: walletId, details: { code: wallet.code, enabled: enable } });
  revalidatePath("/app/wallets");
}

export interface TestParseResult {
  normalized: string;
  result: (Omit<ParseResult, "data"> & { data: Omit<ParseResult["data"], "transferredAt"> & { transferredAt: string }; templateName: string }) | null;
}

/** Runs a message through a wallet's templates without storing anything. */
export async function testParse(walletId: string, text: string): Promise<TestParseResult> {
  await requireUser();
  const wallet = await db.wallet.findUnique({ where: { id: walletId }, include: { templates: true } });
  if (!wallet) return { normalized: normalizeText(text), result: null };
  const r = parseWithTemplates(text, wallet.templates, new Date());
  if (!r) return { normalized: normalizeText(text), result: null };
  return {
    normalized: normalizeText(text),
    result: {
      ...r,
      data: { ...r.data, transferredAt: r.data.transferredAt.toISOString() },
      templateName: wallet.templates.find((t) => t.id === r.templateId)?.name ?? "",
    },
  };
}
