import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { ingestSms } from "@/lib/ingest";
import { SEED_WALLETS } from "@/lib/parser/seed-templates";
import { subscribe } from "@/lib/events";

const JAIB_TEXT =
  "تم استلام مبلغ 50,000 ريال يمني من 777123456 (أحمد محمد). رقم العملية: 123456789. الرصيد: 120,000 ريال. 2026-09-16 14:35";

let businessId: string;
let otherBusinessId: string;
let phoneId: string;
let pendingPhoneId: string;
let ownerId: string;
let employeeId: string;

async function resetData() {
  await db.notification.deleteMany();
  await db.transferEvent.deleteMany();
  await db.transfer.deleteMany();
  await db.rawMessage.deleteMany();
  await db.auditLog.deleteMany();
  await db.phoneNumber.update({ where: { id: pendingPhoneId }, data: { status: "PENDING", verifiedAt: null } });
}

beforeAll(async () => {
  await db.notification.deleteMany();
  await db.transferEvent.deleteMany();
  await db.transfer.deleteMany();
  await db.rawMessage.deleteMany();
  await db.auditLog.deleteMany();
  await db.businessWallet.deleteMany();
  await db.phoneNumber.deleteMany();
  await db.user.deleteMany();
  await db.business.deleteMany();
  await db.messageTemplate.deleteMany();
  await db.wallet.deleteMany();

  for (const w of SEED_WALLETS) {
    await db.wallet.create({
      data: {
        code: w.code,
        name: w.name,
        senderIds: JSON.stringify(w.senderIds),
        templates: { create: w.templates },
      },
    });
  }

  const biz = await db.business.create({ data: { name: "متجر الاختبار" } });
  businessId = biz.id;
  const other = await db.business.create({ data: { name: "منشأة أخرى" } });
  otherBusinessId = other.id;

  const owner = await db.user.create({
    data: { businessId, username: "t_owner", fullName: "المالك", passwordHash: "x", role: "OWNER" },
  });
  ownerId = owner.id;
  const employee = await db.user.create({
    data: { businessId, username: "t_emp", fullName: "موظف", passwordHash: "x", role: "EMPLOYEE" },
  });
  employeeId = employee.id;
  await db.user.create({
    data: { businessId, username: "t_inactive", fullName: "معطل", passwordHash: "x", role: "EMPLOYEE", isActive: false },
  });

  const phone = await db.phoneNumber.create({
    data: {
      businessId,
      number: "967777000001",
      status: "VERIFIED",
      verificationCode: "WASEL-AAAAAA",
      apiKeyHash: "hash1",
      apiKeyPrefix: "wsl_test1",
      verifiedAt: new Date(),
    },
  });
  phoneId = phone.id;
  const pending = await db.phoneNumber.create({
    data: {
      businessId,
      number: "967777000002",
      status: "PENDING",
      verificationCode: "WASEL-ZZZZZZ",
      apiKeyHash: "hash2",
      apiKeyPrefix: "wsl_test2",
    },
  });
  pendingPhoneId = pending.id;
});

beforeEach(resetData);

async function phone(id: string) {
  return (await db.phoneNumber.findUniqueOrThrow({ where: { id } }))!;
}

describe("ingestSms", () => {
  it("parses a Jaib message into a NEW transfer, notifies active users, audits and publishes", async () => {
    const received: string[] = [];
    const unsub = subscribe(businessId, (e) => received.push(e.transferId));

    const r = await ingestSms({
      phone: await phone(phoneId),
      sender: "Jaib",
      text: JAIB_TEXT,
      receivedAt: new Date("2026-09-16T12:00:00Z"),
      source: "WEBHOOK",
    });
    unsub();

    expect(r.status).toBe("PARSED");
    if (r.status !== "PARSED") return;

    const t = await db.transfer.findUniqueOrThrow({ where: { id: r.transferId }, include: { events: true } });
    expect(t.amount).toBe(50000);
    expect(t.reference).toBe("123456789");
    expect(t.senderName).toBe("أحمد محمد");
    expect(t.status).toBe("NEW");
    expect(t.transferredAt.toISOString()).toBe("2026-09-16T11:35:00.000Z");
    expect(t.events).toHaveLength(1);

    const raw = await db.rawMessage.findUniqueOrThrow({ where: { id: r.rawMessageId } });
    expect(raw.status).toBe("PARSED");
    expect(raw.text).toBe(JAIB_TEXT);

    const notifications = await db.notification.findMany({ where: { transferId: t.id } });
    expect(notifications.map((n) => n.userId).sort()).toEqual([ownerId, employeeId].sort());
    expect(notifications[0].title).toContain("50,000");

    const logs = await db.auditLog.findMany({ where: { businessId, action: "TRANSFER_RECEIVED" } });
    expect(logs).toHaveLength(1);

    expect(received).toEqual([t.id]);
    expect((await phone(phoneId)).lastSeenAt).not.toBeNull();
  });

  it("returns DUPLICATE for the same text re-sent within 24h and stores nothing new", async () => {
    const first = await ingestSms({
      phone: await phone(phoneId),
      sender: "Jaib",
      text: JAIB_TEXT,
      receivedAt: new Date("2026-09-16T12:00:00Z"),
      source: "WEBHOOK",
    });
    const second = await ingestSms({
      phone: await phone(phoneId),
      sender: "jaib",
      text: "  " + JAIB_TEXT.replace("50,000", "٥٠,٠٠٠") + "\n",
      receivedAt: new Date("2026-09-16T12:05:00Z"),
      source: "WEBHOOK",
    });
    expect(second.status).toBe("DUPLICATE");
    if (second.status !== "DUPLICATE" || first.status !== "PARSED") return;
    expect(second.rawMessageId).toBe(first.rawMessageId);
    expect(await db.rawMessage.count()).toBe(1);
    expect(await db.transfer.count()).toBe(1);
  });

  it("dedupes on externalId regardless of text", async () => {
    await ingestSms({
      phone: await phone(phoneId),
      sender: "Jaib",
      text: JAIB_TEXT,
      receivedAt: new Date(),
      source: "WEBHOOK",
      externalId: "dev-msg-1",
    });
    const r = await ingestSms({
      phone: await phone(phoneId),
      sender: "Jaib",
      text: JAIB_TEXT.replace("123456789", "999"),
      receivedAt: new Date(),
      source: "WEBHOOK",
      externalId: "dev-msg-1",
    });
    expect(r.status).toBe("DUPLICATE");
    expect(await db.transfer.count()).toBe(1);
  });

  it("stores DUPLICATE_TRANSFER when the same reference arrives with different text", async () => {
    await ingestSms({
      phone: await phone(phoneId),
      sender: "Jaib",
      text: JAIB_TEXT,
      receivedAt: new Date(),
      source: "WEBHOOK",
    });
    const r = await ingestSms({
      phone: await phone(phoneId),
      sender: "Jaib",
      text: JAIB_TEXT.replace("الرصيد: 120,000", "الرصيد: 170,000"),
      receivedAt: new Date(),
      source: "WEBHOOK",
    });
    expect(r.status).toBe("DUPLICATE_TRANSFER");
    expect(await db.transfer.count()).toBe(1);
    expect(await db.rawMessage.count({ where: { status: "DUPLICATE_TRANSFER" } })).toBe(1);
  });

  it("allows the same reference for a different business", async () => {
    const otherPhone = await db.phoneNumber.create({
      data: {
        businessId: otherBusinessId,
        number: "967777000009",
        status: "VERIFIED",
        verificationCode: "WASEL-BBBBBB",
        apiKeyHash: "hash9",
        apiKeyPrefix: "wsl_test9",
      },
    });
    const a = await ingestSms({ phone: await phone(phoneId), sender: "Jaib", text: JAIB_TEXT, receivedAt: new Date(), source: "WEBHOOK" });
    const b = await ingestSms({ phone: otherPhone, sender: "Jaib", text: JAIB_TEXT, receivedAt: new Date(), source: "WEBHOOK" });
    expect(a.status).toBe("PARSED");
    expect(b.status).toBe("PARSED");
    await db.phoneNumber.delete({ where: { id: otherPhone.id } });
  });

  it("ignores messages from unknown senders without storing the text", async () => {
    const r = await ingestSms({
      phone: await phone(phoneId),
      sender: "Mom",
      text: "لا تنسَ الغداء",
      receivedAt: new Date(),
      source: "WEBHOOK",
    });
    expect(r.status).toBe("IGNORED_SENDER");
    expect(await db.rawMessage.count()).toBe(0);
  });

  it("ignores senders of wallets the business disabled", async () => {
    const jaib = await db.wallet.findUniqueOrThrow({ where: { code: "jaib" } });
    await db.businessWallet.create({ data: { businessId, walletId: jaib.id, isEnabled: false } });
    const r = await ingestSms({ phone: await phone(phoneId), sender: "Jaib", text: JAIB_TEXT, receivedAt: new Date(), source: "WEBHOOK" });
    expect(r.status).toBe("IGNORED_SENDER");
    await db.businessWallet.deleteMany({ where: { businessId } });
  });

  it("stores UNMATCHED when the sender is known but no template matches", async () => {
    const r = await ingestSms({
      phone: await phone(phoneId),
      sender: "Jaib",
      text: "تم تحويل مبلغ 5,000 ريال من حسابك إلى 777999888. رقم العملية: 1",
      receivedAt: new Date(),
      source: "WEBHOOK",
    });
    expect(r.status).toBe("UNMATCHED");
    if (r.status !== "UNMATCHED") return;
    const raw = await db.rawMessage.findUniqueOrThrow({ where: { id: r.rawMessageId } });
    expect(raw.walletId).not.toBeNull();
    expect(await db.transfer.count()).toBe(0);
  });

  it("rejects messages for a PENDING phone unless they carry the verification code", async () => {
    const rejected = await ingestSms({ phone: await phone(pendingPhoneId), sender: "Jaib", text: JAIB_TEXT, receivedAt: new Date(), source: "WEBHOOK" });
    expect(rejected.status).toBe("PHONE_NOT_VERIFIED");

    const verified = await ingestSms({
      phone: await phone(pendingPhoneId),
      sender: "777123456",
      text: "رمز التحقق: wasel-zzzzzz",
      receivedAt: new Date(),
      source: "WEBHOOK",
    });
    expect(verified.status).toBe("VERIFIED");
    const p = await phone(pendingPhoneId);
    expect(p.status).toBe("VERIFIED");
    expect(p.verifiedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "PHONE_VERIFIED" } })).toBe(1);

    const after = await ingestSms({ phone: p, sender: "Jaib", text: JAIB_TEXT, receivedAt: new Date(), source: "WEBHOOK" });
    expect(after.status).toBe("PARSED");
  });

  it("manual entry uses the explicit wallet, skips sender matching, and records the user", async () => {
    const floosak = await db.wallet.findUniqueOrThrow({ where: { code: "floosak" } });
    const r = await ingestSms({
      phone: await phone(phoneId),
      sender: "manual",
      text: "تم إيداع 25,000 YER في حسابك من محمد علي 771234567 رقم المرجع 987654321",
      receivedAt: new Date(),
      source: "MANUAL",
      walletId: floosak.id,
      createdById: ownerId,
    });
    expect(r.status).toBe("PARSED");
    if (r.status !== "PARSED") return;
    const raw = await db.rawMessage.findUniqueOrThrow({ where: { id: r.rawMessageId } });
    expect(raw.source).toBe("MANUAL");
    expect(raw.createdById).toBe(ownerId);
    expect(raw.walletId).toBe(floosak.id);
  });
});
