import { describe, it, expect } from "vitest";
import { parseWithTemplates } from "@/lib/parser/engine";
import { SEED_WALLETS } from "@/lib/parser/seed-templates";

const receivedAt = new Date("2026-09-16T12:00:00Z");
const templatesOf = (code: string) => {
  const w = SEED_WALLETS.find((w) => w.code === code)!;
  return w.templates.map((t, i) => ({ id: `${code}-${i}`, ...t }));
};

/**
 * Phrasings Yemeni wallets are likely to use. None is a verified verbatim
 * sample — these guard the tolerant templates until real messages are
 * dropped into samples/<wallet>.txt.
 */
describe("tolerant Arabic templates (Jaib / Floosak)", () => {
  it("deposit wording, ر.ي currency, name after a dash, 'رصيدك'", () => {
    const text = "تم إيداع مبلغ 50,000 ر.ي في محفظتك من 777123456 - أحمد محمد. رقم العملية 123456. رصيدك 120,000 ر.ي";
    const r = parseWithTemplates(text, templatesOf("jaib"), receivedAt);
    expect(r?.data).toMatchObject({ amount: 50000, currency: "YER", senderPhone: "777123456", senderName: "أحمد محمد", reference: "123456", balanceAfter: 120000 });
  });

  it("name before the phone, 'رقم المرجع', 12h Arabic time", () => {
    const text = "استلمت 7,500 ريال من أحمد محمد 771234567 رقم المرجع: 998877 الرصيد الحالي: 30,000 ريال 16/09/2026 02:15 م";
    const r = parseWithTemplates(text, templatesOf("floosak"), receivedAt);
    expect(r?.data).toMatchObject({ amount: 7500, senderPhone: "771234567", senderName: "أحمد محمد", reference: "998877", balanceAfter: 30000 });
    expect(r?.data.transferredAt.toISOString()).toBe("2026-09-16T11:15:00.000Z");
  });

  it("'وصلك مبلغ وقدره', 'من الرقم', name in parentheses, seconds in time", () => {
    const text = "وصلك مبلغ وقدره 12000 YER من الرقم 733000111 (سالم قاسم). مرجع العملية: AB-12. 2026-09-16 14:05:33";
    const r = parseWithTemplates(text, templatesOf("jaib"), receivedAt);
    expect(r?.data).toMatchObject({ amount: 12000, currency: "YER", senderPhone: "733000111", senderName: "سالم قاسم", reference: "AB-12" });
    expect(r?.data.transferredAt.toISOString()).toBe("2026-09-16T11:05:33.000Z");
  });

  it("Arabic-Indic digits throughout, 'رقم الحوالة', 'الرصيد المتاح'", () => {
    const text = "تم استلام حوالة بمبلغ ٢٥٠٠٠ ريال يمني من ٧٧٠١٢٣٤٥٦ رقم الحوالة ٥٥٤٤٣٣ الرصيد المتاح ٩٠٠٠٠ ريال";
    const r = parseWithTemplates(text, templatesOf("floosak"), receivedAt);
    expect(r?.data).toMatchObject({ amount: 25000, senderPhone: "770123456", reference: "554433", balanceAfter: 90000 });
  });

  it("customer greeting prefix and trailing marketing line do not break parsing", () => {
    const text = "عزيزي العميل، تم إيداع 3,000 ريال في حسابك من 777000222 رقم العملية 42. شكرًا لاستخدامك جيب.";
    const r = parseWithTemplates(text, templatesOf("jaib"), receivedAt);
    expect(r?.data).toMatchObject({ amount: 3000, senderPhone: "777000222", reference: "42" });
  });

  it("still refuses outgoing-transfer wording", () => {
    for (const text of [
      "تم تحويل مبلغ 5,000 ريال من حسابك إلى 777999888. رقم العملية: 1. رصيدك 10,000 ريال",
      "تم خصم 2,000 ريال من محفظتك لصالح 733111222. رقم العملية 7",
      "تم سحب 15,000 ريال من محفظتك. رقم العملية 9. رصيدك 1,000",
      "تم إيداع 5000 ريال من حسابك إلى 777999888 رقم العملية 5",
      "استلمت طلبك بتحويل 9,000 ريال لصالح 777111222 رقم العملية 11",
    ]) {
      expect(parseWithTemplates(text, templatesOf("jaib"), receivedAt)).toBeNull();
      expect(parseWithTemplates(text, templatesOf("floosak"), receivedAt)).toBeNull();
    }
  });
});
