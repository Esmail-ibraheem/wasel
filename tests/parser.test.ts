import { describe, it, expect } from "vitest";
import { normalizeDigits, normalizeText } from "@/lib/parser/normalize";
import { parseAmount, normalizeCurrency } from "@/lib/parser/amount";
import { parseDateTime } from "@/lib/parser/datetime";
import { matchWalletBySender, parseWithTemplates, compileTemplate } from "@/lib/parser/engine";
import { SEED_WALLETS } from "@/lib/parser/seed-templates";

describe("normalize", () => {
  it("converts Arabic-Indic and Persian digits to ASCII", () => {
    expect(normalizeDigits("٥٠,٠٠٠ ریال ۱۲۳")).toBe("50,000 ریال 123");
  });
  it("collapses whitespace, arabic separators and zero-width chars", () => {
    expect(normalizeText("تم  استلام‏\n مبلغ ٥٠٬٠٠٠٫٥ ريال، اليوم ")).toBe(
      "تم استلام مبلغ 50,000.5 ريال, اليوم",
    );
  });
});

describe("parseAmount", () => {
  it("parses thousands separators", () => {
    expect(parseAmount("50,000")).toBe(50000);
    expect(parseAmount("1,250,000.75")).toBe(1250000.75);
  });
  it("parses plain and decimal amounts", () => {
    expect(parseAmount("15000")).toBe(15000);
    expect(parseAmount("99.5")).toBe(99.5);
    expect(parseAmount("50 000")).toBe(50000);
  });
  it("treats a trailing comma group of 1-2 digits as decimals", () => {
    expect(parseAmount("1500,50")).toBe(1500.5);
  });
  it("returns null for garbage", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("normalizeCurrency", () => {
  it("maps arabic and latin variants", () => {
    expect(normalizeCurrency("ريال يمني")).toBe("YER");
    expect(normalizeCurrency("ر.ي")).toBe("YER");
    expect(normalizeCurrency("yer")).toBe("YER");
    expect(normalizeCurrency("ريال سعودي")).toBe("SAR");
    expect(normalizeCurrency("دولار")).toBe("USD");
    expect(normalizeCurrency(undefined)).toBe("YER");
  });
});

describe("parseDateTime (Asia/Aden = UTC+3, no DST)", () => {
  const fallback = new Date("2026-01-01T00:00:00Z");
  it("parses ISO-like date and 24h time", () => {
    expect(parseDateTime("2026-09-16", "14:35", fallback).toISOString()).toBe("2026-09-16T11:35:00.000Z");
  });
  it("parses DD/MM/YYYY and DD-MM-YYYY", () => {
    expect(parseDateTime("16/09/2026", "10:20", fallback).toISOString()).toBe("2026-09-16T07:20:00.000Z");
    expect(parseDateTime("16-09-2026", "09:15", fallback).toISOString()).toBe("2026-09-16T06:15:00.000Z");
  });
  it("handles 12h clock with AM/PM and Arabic markers", () => {
    expect(parseDateTime("2026-09-16", "02:35 PM", fallback).toISOString()).toBe("2026-09-16T11:35:00.000Z");
    expect(parseDateTime("2026-09-16", "12:10 ص", fallback).toISOString()).toBe("2026-09-15T21:10:00.000Z");
    expect(parseDateTime("2026-09-16", "1:05 م", fallback).toISOString()).toBe("2026-09-16T10:05:00.000Z");
  });
  it("falls back when date missing or invalid", () => {
    expect(parseDateTime(undefined, "14:35", fallback)).toBe(fallback);
    expect(parseDateTime("99/99/2026", "14:35", fallback)).toBe(fallback);
  });
  it("uses midnight when time is missing", () => {
    expect(parseDateTime("2026-09-16", undefined, fallback).toISOString()).toBe("2026-09-15T21:00:00.000Z");
  });
});

describe("matchWalletBySender", () => {
  const wallets = [
    { id: "w1", senderIds: ["Jaib", "JAIB-YE"] },
    { id: "w2", senderIds: ["Floosak", "777000111"] },
  ];
  it("matches case-insensitively", () => {
    expect(matchWalletBySender("jaib", wallets)?.id).toBe("w1");
    expect(matchWalletBySender("FLOOSAK", wallets)?.id).toBe("w2");
  });
  it("matches phone sender ids ignoring +, spaces and arabic digits", () => {
    expect(matchWalletBySender("+٧٧٧ 000 111", wallets)?.id).toBe("w2");
  });
  it("returns undefined for unknown senders", () => {
    expect(matchWalletBySender("Mom", wallets)).toBeUndefined();
  });
});

describe("compileTemplate", () => {
  it("returns null for an invalid regex instead of throwing", () => {
    expect(compileTemplate({ pattern: "(unclosed", flags: "iu" })).toBeNull();
  });
});

describe("parseWithTemplates using seeded wallet templates", () => {
  const receivedAt = new Date("2026-09-16T12:00:00Z");
  const templatesOf = (code: string) => {
    const w = SEED_WALLETS.find((w) => w.code === code)!;
    return w.templates.map((t, i) => ({ id: `${code}-${i}`, ...t }));
  };

  it("parses a Jaib message", () => {
    const text =
      "تم استلام مبلغ ٥٠,٠٠٠ ريال يمني من 777123456 (أحمد محمد). رقم العملية: 123456789. الرصيد: 120,000 ريال. 2026-09-16 14:35";
    const r = parseWithTemplates(text, templatesOf("jaib"), receivedAt);
    expect(r).not.toBeNull();
    expect(r!.data).toMatchObject({
      amount: 50000,
      currency: "YER",
      senderPhone: "777123456",
      senderName: "أحمد محمد",
      reference: "123456789",
      balanceAfter: 120000,
    });
    expect(r!.data.transferredAt.toISOString()).toBe("2026-09-16T11:35:00.000Z");
  });

  it("parses a Floosak message", () => {
    const text =
      "تم إيداع 25,000 YER في حسابك من محمد علي 771234567 رقم المرجع 987654321 بتاريخ 16/09/2026 10:20 رصيدك 80,000 YER";
    const r = parseWithTemplates(text, templatesOf("floosak"), receivedAt);
    expect(r!.data).toMatchObject({
      amount: 25000,
      senderName: "محمد علي",
      senderPhone: "771234567",
      reference: "987654321",
      balanceAfter: 80000,
    });
  });

  it("parses a Cash message", () => {
    const text =
      "عزيزي العميل، تم تحويل مبلغ 10,000 ر.ي إلى محفظتك من الرقم 733123456. رقم العملية 55667788. التاريخ 16-09-2026 الساعة 09:15";
    const r = parseWithTemplates(text, templatesOf("cash"), receivedAt);
    expect(r!.data).toMatchObject({ amount: 10000, senderPhone: "733123456", reference: "55667788" });
    expect(r!.data.transferredAt.toISOString()).toBe("2026-09-16T06:15:00.000Z");
  });

  it("parses a ONE Cash message", () => {
    const text = "استلمت 15000 ريال من 700123456 - سالم قاسم. المرجع: ONE-2233445. الرصيد الحالي 45000 ريال";
    const r = parseWithTemplates(text, templatesOf("onecash"), receivedAt);
    expect(r!.data).toMatchObject({
      amount: 15000,
      senderPhone: "700123456",
      senderName: "سالم قاسم",
      reference: "ONE-2233445",
      balanceAfter: 45000,
    });
    // no date in message → falls back to receivedAt
    expect(r!.data.transferredAt).toBe(receivedAt);
  });

  it("parses a Jawali (English) message", () => {
    const text = "You have received 20,000 YER from 770123456. Ref: JW123456. Balance: 60,000 YER. 16/09/2026 12:00";
    const r = parseWithTemplates(text, templatesOf("jawali"), receivedAt);
    expect(r!.data).toMatchObject({ amount: 20000, currency: "YER", senderPhone: "770123456", reference: "JW123456" });
  });

  it("does not parse an outgoing-transfer message as incoming", () => {
    const text = "تم تحويل مبلغ 5,000 ريال من حسابك إلى 777999888. رقم العملية: 1. الرصيد: 10,000 ريال";
    expect(parseWithTemplates(text, templatesOf("jaib"), receivedAt)).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(parseWithTemplates("مرحبا كيف حالك", templatesOf("jaib"), receivedAt)).toBeNull();
  });

  it("skips inactive templates and respects priority order", () => {
    const templates = [
      { id: "low", pattern: "(?<amount>\\d+)", flags: "u", priority: 0, isActive: true },
      { id: "high", pattern: "مبلغ (?<amount>\\d+)", flags: "u", priority: 10, isActive: true },
      { id: "off", pattern: "(?<amount>\\d+) ريال", flags: "u", priority: 100, isActive: false },
    ];
    const r = parseWithTemplates("مبلغ 500 ريال", templates, receivedAt);
    expect(r!.templateId).toBe("high");
  });

  it("rejects a match with a non-positive amount", () => {
    const templates = [{ id: "t", pattern: "(?<amount>[\\d.,]+)", flags: "u", priority: 0, isActive: true }];
    expect(parseWithTemplates("0", templates, receivedAt)).toBeNull();
  });
});
