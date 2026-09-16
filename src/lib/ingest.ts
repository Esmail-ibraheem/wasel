import type { PhoneNumber } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/auth/tokens";
import { normalizeText } from "@/lib/parser/normalize";
import { matchWalletBySender, parseWithTemplates } from "@/lib/parser/engine";
import { formatAmount } from "@/lib/format";
import { auditData } from "@/lib/audit";
import { publish } from "@/lib/events";

export interface IngestInput {
  phone: PhoneNumber;
  sender: string;
  text: string;
  receivedAt: Date;
  source: "WEBHOOK" | "MANUAL";
  /** Device-side message id, when the forwarder provides one. */
  externalId?: string;
  /** Manual entry: the user who pasted the message. */
  createdById?: string;
  /** Manual entry: explicit wallet — sender matching is skipped. */
  walletId?: string;
}

export type IngestResult =
  | { status: "DUPLICATE"; rawMessageId: string; transferId?: string }
  | { status: "PHONE_NOT_VERIFIED" }
  | { status: "VERIFIED"; rawMessageId: string }
  | { status: "IGNORED_SENDER" }
  | { status: "UNMATCHED"; rawMessageId: string }
  | { status: "DUPLICATE_TRANSFER"; rawMessageId: string; existingTransferId: string }
  | { status: "PARSED"; rawMessageId: string; transferId: string };

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Wallets the business may process: globally active and not disabled by the business. */
export async function enabledWalletsFor(businessId: string) {
  const wallets = await db.wallet.findMany({
    where: { isActive: true },
    include: {
      templates: true,
      businesses: { where: { businessId } },
    },
  });
  return wallets
    .filter((w) => w.businesses.length === 0 || w.businesses[0].isEnabled)
    .map((w) => ({ ...w, senderIds: parseSenderIds(w.senderIds) }));
}

export function parseSenderIds(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function ingestSms(input: IngestInput): Promise<IngestResult> {
  const { phone, source } = input;
  const sender = input.sender.trim();
  const text = input.text;
  const normalized = normalizeText(text);
  const receivedAt = input.receivedAt;
  const textHash = sha256Hex(`${phone.id}|${sender.toLowerCase()}|${normalized}`);

  if (source === "WEBHOOK") {
    await db.phoneNumber.update({ where: { id: phone.id }, data: { lastSeenAt: new Date() } });
  }

  // 1. Dedupe: by device message id, then by identical text within the window.
  const existing = await db.rawMessage.findFirst({
    where: {
      phoneNumberId: phone.id,
      OR: [
        ...(input.externalId ? [{ externalId: input.externalId }] : []),
        {
          textHash,
          receivedAt: {
            gte: new Date(receivedAt.getTime() - DEDUPE_WINDOW_MS),
            lte: new Date(receivedAt.getTime() + DEDUPE_WINDOW_MS),
          },
        },
      ],
    },
    include: { transfer: { select: { id: true } } },
  });
  if (existing) {
    return { status: "DUPLICATE", rawMessageId: existing.id, transferId: existing.transfer?.id };
  }

  // 2. Reverse-OTP verification for pending phones.
  if (phone.status !== "VERIFIED") {
    if (phone.status === "PENDING" && normalized.toUpperCase().includes(phone.verificationCode.toUpperCase())) {
      const raw = await db.$transaction(async (tx) => {
        await tx.phoneNumber.update({
          where: { id: phone.id },
          data: { status: "VERIFIED", verifiedAt: new Date() },
        });
        const raw = await tx.rawMessage.create({
          data: {
            businessId: phone.businessId,
            phoneNumberId: phone.id,
            sender,
            text,
            receivedAt,
            source,
            textHash,
            externalId: input.externalId,
            status: "VERIFICATION",
            createdById: input.createdById,
          },
        });
        await tx.auditLog.create({
          data: auditData({
            action: "PHONE_VERIFIED",
            businessId: phone.businessId,
            entityType: "PhoneNumber",
            entityId: phone.id,
            details: { number: phone.number, via: source },
          }),
        });
        return raw;
      });
      return { status: "VERIFIED", rawMessageId: raw.id };
    }
    return { status: "PHONE_NOT_VERIFIED" };
  }

  // 3. Resolve the wallet: explicit (manual) or by sender id.
  const wallets = await enabledWalletsFor(phone.businessId);
  const wallet = input.walletId
    ? wallets.find((w) => w.id === input.walletId)
    : matchWalletBySender(sender, wallets);
  if (!wallet) return { status: "IGNORED_SENDER" };

  const baseRaw = {
    businessId: phone.businessId,
    phoneNumberId: phone.id,
    sender,
    text,
    receivedAt,
    source,
    textHash,
    externalId: input.externalId,
    walletId: wallet.id,
    createdById: input.createdById,
  };

  // 4. Parse.
  const parsed = parseWithTemplates(text, wallet.templates, receivedAt);
  if (!parsed) {
    const raw = await db.rawMessage.create({ data: { ...baseRaw, status: "UNMATCHED" } });
    return { status: "UNMATCHED", rawMessageId: raw.id };
  }
  const d = parsed.data;

  // 5. Same reference already recorded for this business+wallet?
  if (d.reference) {
    const dup = await db.transfer.findUnique({
      where: { businessId_walletId_reference: { businessId: phone.businessId, walletId: wallet.id, reference: d.reference } },
      select: { id: true },
    });
    if (dup) {
      const raw = await db.rawMessage.create({ data: { ...baseRaw, status: "DUPLICATE_TRANSFER", templateId: parsed.templateId } });
      return { status: "DUPLICATE_TRANSFER", rawMessageId: raw.id, existingTransferId: dup.id };
    }
  }

  // 6. Persist transfer + notifications + audit atomically.
  const title = `تحويل جديد: ${formatAmount(d.amount, d.currency)} — ${wallet.name}`;
  const fromParts = [d.senderName, d.senderPhone].filter(Boolean).join(" ");
  const body = [fromParts ? `من ${fromParts}` : null, d.reference ? `رقم العملية: ${d.reference}` : null]
    .filter(Boolean)
    .join(" · ");

  try {
    const result = await db.$transaction(async (tx) => {
      const raw = await tx.rawMessage.create({ data: { ...baseRaw, status: "PARSED", templateId: parsed.templateId } });
      const transfer = await tx.transfer.create({
        data: {
          businessId: phone.businessId,
          phoneNumberId: phone.id,
          rawMessageId: raw.id,
          walletId: wallet.id,
          amount: d.amount,
          currency: d.currency,
          senderName: d.senderName,
          senderPhone: d.senderPhone,
          reference: d.reference,
          transferredAt: d.transferredAt,
          account: d.account,
          balanceAfter: d.balanceAfter,
          status: "NEW",
          events: { create: { fromStatus: null, toStatus: "NEW", userId: input.createdById } },
        },
      });
      const users = await tx.user.findMany({
        where: { businessId: phone.businessId, isActive: true },
        select: { id: true },
      });
      const notifications: Record<string, string> = {};
      for (const u of users) {
        const n = await tx.notification.create({
          data: { businessId: phone.businessId, userId: u.id, transferId: transfer.id, title, body },
        });
        notifications[u.id] = n.id;
      }
      await tx.auditLog.create({
        data: auditData({
          action: "TRANSFER_RECEIVED",
          businessId: phone.businessId,
          userId: input.createdById,
          entityType: "Transfer",
          entityId: transfer.id,
          details: { amount: d.amount, currency: d.currency, reference: d.reference, wallet: wallet.code, source },
        }),
      });
      return { raw, transfer, notifications };
    });

    publish({
      type: "transfer",
      businessId: phone.businessId,
      transferId: result.transfer.id,
      notifications: result.notifications,
      title,
      body,
      createdAt: result.transfer.createdAt.toISOString(),
    });

    return { status: "PARSED", rawMessageId: result.raw.id, transferId: result.transfer.id };
  } catch (err) {
    // Lost a race on the (business, wallet, reference) unique index → record as duplicate.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && d.reference) {
      const dup = await db.transfer.findUnique({
        where: { businessId_walletId_reference: { businessId: phone.businessId, walletId: wallet.id, reference: d.reference } },
        select: { id: true },
      });
      const raw = await db.rawMessage.create({ data: { ...baseRaw, status: "DUPLICATE_TRANSFER", templateId: parsed.templateId } });
      return { status: "DUPLICATE_TRANSFER", rawMessageId: raw.id, existingTransferId: dup?.id ?? "" };
    }
    throw err;
  }
}
