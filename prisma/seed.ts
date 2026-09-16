/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { generateApiKey, sha256Hex } from "../src/lib/auth/tokens";
import { SEED_WALLETS } from "../src/lib/parser/seed-templates";
import { ingestSms } from "../src/lib/ingest";

const db = new PrismaClient();

const DEMO_API_KEY = "wsl_demo_0123456789abcdef0123456789abcdef01234567";

async function main() {
  // Wallet catalog (idempotent: new wallets are created; existing wallets only gain templates they lack, by name)
  for (const w of SEED_WALLETS) {
    const existing = await db.wallet.findUnique({ where: { code: w.code }, include: { templates: { select: { name: true } } } });
    if (!existing) {
      await db.wallet.create({
        data: { code: w.code, name: w.name, senderIds: JSON.stringify(w.senderIds), templates: { create: w.templates } },
      });
      console.log(`wallet ${w.code} created`);
      continue;
    }
    const have = new Set(existing.templates.map((t) => t.name));
    const missing = w.templates.filter((t) => !have.has(t.name));
    if (missing.length) {
      await db.messageTemplate.createMany({ data: missing.map((t) => ({ ...t, walletId: existing.id })) });
      console.log(`wallet ${w.code}: added ${missing.length} template(s)`);
    }
  }

  // Platform super admin.
  // Production: credentials come from ADMIN_USERNAME / ADMIN_PASSWORD (skipped when unset).
  // Development / SEED_DEMO=true: falls back to admin / Admin@12345.
  const demo = process.env.SEED_DEMO === "true" || process.env.NODE_ENV !== "production";
  const adminUsername = (process.env.ADMIN_USERNAME || (demo ? "admin" : "")).trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || (demo ? "Admin@12345" : "");
  if (adminUsername && adminPassword) {
    const existingAdmin = await db.user.findUnique({ where: { username: adminUsername } });
    if (!existingAdmin) {
      await db.user.create({
        data: { username: adminUsername, fullName: "مشرف المنصة", passwordHash: hashPassword(adminPassword), role: "OWNER", isSuperAdmin: true },
      });
      console.log(`super admin created: ${adminUsername}`);
    } else if (process.env.ADMIN_PASSWORD && !existingAdmin.isSuperAdmin) {
      console.log(`warning: ${adminUsername} exists but is not a super admin — not modified`);
    }
  } else {
    console.log("no super admin seeded (set ADMIN_USERNAME and ADMIN_PASSWORD)");
  }

  if (!demo) {
    console.log("production mode: demo business not seeded (set SEED_DEMO=true to add it)");
    return;
  }

  // Demo business
  if (await db.user.findUnique({ where: { username: "owner" } })) {
    console.log("demo business already seeded");
    return;
  }

  const biz = await db.business.create({ data: { name: "متجر النور للإلكترونيات" } });
  const owner = await db.user.create({
    data: { businessId: biz.id, username: "owner", fullName: "عبدالله النور", passwordHash: hashPassword("Owner@12345"), role: "OWNER" },
  });
  await db.user.create({
    data: { businessId: biz.id, username: "manager", fullName: "سامي الحداد", passwordHash: hashPassword("Manager@12345"), role: "MANAGER" },
  });
  await db.user.create({
    data: { businessId: biz.id, username: "accountant", fullName: "هدى المقطري", passwordHash: hashPassword("Accountant@12345"), role: "ACCOUNTANT" },
  });
  await db.user.create({
    data: { businessId: biz.id, username: "employee", fullName: "خالد الشرعبي", passwordHash: hashPassword("Employee@12345"), role: "EMPLOYEE" },
  });

  const phone = await db.phoneNumber.create({
    data: {
      businessId: biz.id,
      number: "967777123456",
      label: "هاتف المحل الرئيسي",
      status: "VERIFIED",
      verificationCode: "WASEL-DEMO42",
      apiKeyHash: sha256Hex(DEMO_API_KEY),
      apiKeyPrefix: DEMO_API_KEY.slice(0, 12),
      verifiedAt: new Date(),
    },
  });

  const pendingKey = generateApiKey();
  await db.phoneNumber.create({
    data: {
      businessId: biz.id,
      number: "967733123456",
      label: "هاتف الفرع",
      status: "PENDING",
      verificationCode: "WASEL-BR7K2M",
      apiKeyHash: pendingKey.hash,
      apiKeyPrefix: pendingKey.prefix,
    },
  });

  // A few demo transfers spread over the last days
  const now = Date.now();
  const H = 3600 * 1000;
  const samples: Array<{ sender: string; text: string; ago: number }> = [
    { sender: "Jaib", ago: 0.3 * H, text: "تم استلام مبلغ 50,000 ريال يمني من 777123456 (أحمد محمد). رقم العملية: 100238471. الرصيد: 820,000 ريال." },
    { sender: "Floosak", ago: 1.5 * H, text: "تم إيداع 25,000 YER في حسابك من محمد علي 771234567 رقم المرجع 5588120 رصيدك 380,000 YER" },
    { sender: "Cash", ago: 4 * H, text: "عزيزي العميل، تم تحويل مبلغ 12,500 ر.ي إلى محفظتك من الرقم 733998877. رقم العملية 77120045." },
    { sender: "ONECash", ago: 9 * H, text: "استلمت 8000 ريال من 700556677 - سالم قاسم. المرجع: ONE-9912. الرصيد الحالي 145000 ريال" },
    { sender: "Jawali", ago: 26 * H, text: "You have received 120,000 YER from 770112233 (Fatima Saleh). Ref: JW77812. Balance: 640,000 YER." },
    { sender: "Jaib", ago: 30 * H, text: "تم استلام مبلغ 3,500 ريال يمني من 777654321. رقم العملية: 100238100. الرصيد: 770,000 ريال." },
    { sender: "Jaib", ago: 52 * H, text: "تم استلام مبلغ 240,000 ريال يمني من 771000001 (شركة الأمل للتجارة). رقم العملية: 100237990. الرصيد: 766,500 ريال." },
    { sender: "Floosak", ago: 75 * H, text: "تم إيداع 60,000 YER في حسابك من نبيل الأصبحي 773000002 رقم المرجع 5587001 رصيدك 355,000 YER" },
    { sender: "Jaib", ago: 2 * H, text: "عرض خاص: اشحن رصيدك الآن واحصل على مكافأة 10%" },
  ];
  const ids: string[] = [];
  for (const s of samples) {
    const p = await db.phoneNumber.findUniqueOrThrow({ where: { id: phone.id } });
    const r = await ingestSms({ phone: p, sender: s.sender, text: s.text, receivedAt: new Date(now - s.ago), source: "WEBHOOK" });
    if (r.status === "PARSED") ids.push(r.transferId);
    console.log(`${s.sender}: ${r.status}`);
  }

  // Give the history some life: confirm/review a few
  const accountant = await db.user.findUniqueOrThrow({ where: { username: "accountant" } });
  const setStatus = async (id: string, status: string, note?: string) => {
    const t = await db.transfer.findUniqueOrThrow({ where: { id } });
    await db.transfer.update({
      where: { id },
      data: { status, note, events: { create: { fromStatus: t.status, toStatus: status, userId: accountant.id, note } } },
    });
  };
  if (ids[4]) await setStatus(ids[4], "CONFIRMED", "فاتورة رقم 1042");
  if (ids[5]) await setStatus(ids[5], "REVIEWED");
  if (ids[6]) await setStatus(ids[6], "CONFIRMED", "دفعة أولى من عقد التوريد");
  if (ids[7]) await setStatus(ids[7], "REJECTED", "المبلغ لا يطابق أي فاتورة — بانتظار العميل");

  await db.auditLog.create({
    data: { businessId: biz.id, userId: owner.id, action: "BUSINESS_REGISTERED", entityType: "Business", entityId: biz.id },
  });

  console.log("\nDemo accounts (password after the slash):");
  console.log("  owner / Owner@12345 · manager / Manager@12345 · accountant / Accountant@12345 · employee / Employee@12345");
  console.log(`  super admin: ${adminUsername}`);
  console.log(`Demo phone API key: ${DEMO_API_KEY}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
