import type { Prisma } from "@prisma/client";
import { normalizeDigits } from "@/lib/parser/normalize";

export interface TransferFilters {
  q?: string;
  status?: string;
  wallet?: string;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
  page?: string;
}

export const PAGE_SIZE = 25;

/** Interprets a YYYY-MM-DD input as local Yemen time (UTC+3). */
function adenDate(s: string | undefined, endOfDay = false): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d, -3, 0, 0);
  return new Date(endOfDay ? base + 86400e3 - 1 : base);
}

function num(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number(normalizeDigits(s).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function buildTransferWhere(businessId: string, f: TransferFilters): Prisma.TransferWhereInput {
  const where: Prisma.TransferWhereInput = { businessId };
  if (f.status && ["NEW", "REVIEWED", "CONFIRMED", "REJECTED"].includes(f.status)) where.status = f.status;
  if (f.wallet) where.walletId = f.wallet;

  const gte = adenDate(f.from);
  const lte = adenDate(f.to, true);
  if (gte || lte) where.transferredAt = { ...(gte && { gte }), ...(lte && { lte }) };

  const min = num(f.min);
  const max = num(f.max);
  if (min !== undefined || max !== undefined) where.amount = { ...(min !== undefined && { gte: min }), ...(max !== undefined && { lte: max }) };

  const q = f.q?.trim();
  if (q) {
    const nq = normalizeDigits(q);
    where.OR = [
      { reference: { contains: nq } },
      { senderName: { contains: q } },
      { senderPhone: { contains: nq.replace(/\D/g, "") || nq } },
      { note: { contains: q } },
    ];
  }
  return where;
}

export function pageFrom(f: TransferFilters): number {
  const p = Number(f.page);
  return Number.isInteger(p) && p > 0 ? p : 1;
}

export function filtersToQuery(f: TransferFilters, overrides: Partial<TransferFilters> = {}): string {
  const merged = { ...f, ...overrides };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
