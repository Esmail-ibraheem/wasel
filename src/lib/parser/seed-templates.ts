/**
 * Built-in wallet catalog with plausible message templates.
 * No real samples were available at design time; every pattern is editable
 * from the super-admin UI, so real formats can be plugged in without a deploy.
 *
 * Group names: amount, currency, senderName, senderPhone, reference, date, time, account, balance
 */

export interface SeedTemplate {
  name: string;
  pattern: string;
  flags: string;
  priority: number;
  isActive: boolean;
  sampleText: string;
}

export interface SeedWallet {
  code: string;
  name: string;
  senderIds: string[];
  templates: SeedTemplate[];
}

const CUR = "(?<currency>ريال يمني|ريال سعودي|ريال|ر\\.ي|YER|SAR|USD)?";
const REF = "(?<reference>[A-Za-z0-9-]+)";
const NUM = "[\\d.,]+";

/** Rejects messages that describe money leaving the wallet, whatever verb they open with. */
const NOT_OUTGOING = String.raw`^(?![\s\S]*(?:من حسابك|من محفظتك|من رصيدك|لصالح|إلى حساب|الى حساب|إلى محفظة|الى محفظة|إلى رقم|الى رقم))`;
const RECEIVE_VERBS = "(?:تم إيداع|تم ايداع|تم استلام|استلمت|وصلك|وصلتك|أضيف|اضيف|تم إضافة|تم اضافة|received|credited)";
const TOLERANT_CUR = String.raw`(?<currency>ريال يمني|ريال سعودي|ريال|ر\.ي\.?|YER|SAR|USD)?`;
const REF_WORDS = String.raw`(?:رقم العملية|رقم المرجع|مرجع العملية|رقم الحوالة|رقم المعاملة|المرجع|مرجع|Ref\.?|Reference|Txn|Transaction)`;
const BALANCE_WORDS = "(?:الرصيد الحالي|الرصيد المتاح|رصيدك الحالي|رصيدك|الرصيد|Balance)";
const DATE_TIME = String.raw`(?:[^\d]*(?<date>\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*(?:الساعة|,)?\s*(?<time>\d{1,2}:\d{2}(?::\d{2})?\s*(?:ص|م|AM|PM)?))?`;

/**
 * Tolerant Arabic templates shared by the Yemeni wallets. They accept the
 * common phrasings (إيداع/استلام/وصلك, ر.ي/ريال/YER, name before or after the
 * phone, any of the usual reference words) and require a reference number so
 * they stay precise. Priority 5: below a wallet's exact template, above the
 * generic safety net.
 */
function tolerantArabicTemplates(): SeedTemplate[] {
  const head =
    NOT_OUTGOING +
    String.raw`[\s\S]*?${RECEIVE_VERBS}(?:\s*(?:حوالة|تحويل|مبلغ))?(?:\s*(?:وقدره|قدره|بمبلغ|بقيمة|مبلغ))?\s*` +
    String.raw`(?<amount>\d[\d.,]*)\s*${TOLERANT_CUR}(?:\s*(?:في|إلى|الى)\s*(?:محفظتك|حسابك|رصيدك))?` +
    String.raw`\s*(?:من|بواسطة|from)\s*(?:الرقم|رقم)?\s*`;
  const tail =
    String.raw`[.\s,:]*${REF_WORDS}\s*[:#]?\s*(?<reference>[A-Za-z0-9-]+)` +
    String.raw`(?:[.\s,]*${BALANCE_WORDS}\s*:?\s*(?<balance>\d[\d.,]*))?` +
    DATE_TIME;
  return [
    {
      name: "نمط عربي مرن — الرقم ثم الاسم",
      pattern: head + String.raw`(?<senderPhone>\d{9,12})(?:\s*[-–—(]\s*(?<senderName>[^).\n,]+?)\)?)?` + tail,
      flags: "iu",
      priority: 5,
      isActive: true,
      sampleText: "تم إيداع مبلغ 50,000 ر.ي في محفظتك من 777123456 - أحمد محمد. رقم العملية 123456. رصيدك 120,000 ر.ي",
    },
    {
      name: "نمط عربي مرن — الاسم ثم الرقم",
      pattern:
        head + String.raw`(?<senderName>(?:(?!إلى|الى|لصالح|حسابك|محفظتك)[^\d\n])+?)\s*(?<senderPhone>\d{9,12})` + tail,
      flags: "iu",
      priority: 5,
      isActive: true,
      sampleText: "استلمت 7,500 ريال من أحمد محمد 771234567 رقم المرجع: 998877 الرصيد الحالي: 30,000 ريال",
    },
  ];
}

/** Low-priority safety net: any "received"-style message with an amount. Never matches outgoing transfers. */
function genericTemplate(): SeedTemplate {
  return {
    name: "نمط عام (احتياطي)",
    pattern:
      NOT_OUTGOING +
      String.raw`[\s\S]*?${RECEIVE_VERBS}[\s\S]*?` +
      String.raw`(?<amount>\d[\d.,]*)\s*${CUR}` +
      String.raw`(?:[\s\S]*?(?:من|from)\s*(?<senderPhone>\d{9,12}))?` +
      String.raw`(?:[\s\S]*?${REF_WORDS}\s*[:#]?\s*${REF})?`,
    flags: "iu",
    priority: -10,
    isActive: true,
    sampleText: "تم استلام 5000 ريال من 777000000 رقم العملية 42",
  };
}

export const SEED_WALLETS: SeedWallet[] = [
  {
    code: "jaib",
    name: "محفظة جيب",
    senderIds: ["Jaib", "JAIB-YE"],
    templates: [
      {
        name: "استلام تحويل",
        pattern:
          `تم استلام مبلغ\\s*(?<amount>${NUM})\\s*${CUR}\\s*من\\s*(?<senderPhone>\\d{9,12})` +
          "(?:\\s*\\((?<senderName>[^)]+)\\))?" +
          `[.\\s]*رقم العملية\\s*:?\\s*${REF}` +
          `(?:[.\\s]*الرصيد\\s*:?\\s*(?<balance>${NUM}))?` +
          "(?:[^\\d]*(?<date>\\d{4}[-/]\\d{2}[-/]\\d{2})\\s+(?<time>\\d{1,2}:\\d{2}))?",
        flags: "iu",
        priority: 10,
        isActive: true,
        sampleText:
          "تم استلام مبلغ 50,000 ريال يمني من 777123456 (أحمد محمد). رقم العملية: 123456789. الرصيد: 120,000 ريال. 2026-09-16 14:35",
      },
      ...tolerantArabicTemplates(),
      genericTemplate(),
    ],
  },
  {
    code: "floosak",
    name: "فلوسك",
    senderIds: ["Floosak", "FLOOSAK"],
    templates: [
      {
        name: "إيداع في الحساب",
        pattern:
          `تم إيداع\\s*(?<amount>${NUM})\\s*${CUR}\\s*في حسابك من\\s*(?<senderName>.+?)\\s*(?<senderPhone>\\d{9,12})` +
          `\\s*رقم المرجع\\s*:?\\s*${REF}` +
          "(?:\\s*بتاريخ\\s*(?<date>[\\d/.-]+)\\s+(?<time>\\d{1,2}:\\d{2}))?" +
          `(?:\\s*رصيدك\\s*:?\\s*(?<balance>${NUM}))?`,
        flags: "iu",
        priority: 10,
        isActive: true,
        sampleText:
          "تم إيداع 25,000 YER في حسابك من محمد علي 771234567 رقم المرجع 987654321 بتاريخ 16/09/2026 10:20 رصيدك 80,000 YER",
      },
      ...tolerantArabicTemplates(),
      genericTemplate(),
    ],
  },
  {
    code: "cash",
    name: "كاش",
    senderIds: ["Cash", "CASH-YE"],
    templates: [
      {
        name: "تحويل إلى المحفظة",
        pattern:
          `تم تحويل مبلغ\\s*(?<amount>${NUM})\\s*${CUR}\\s*إلى محفظتك من الرقم\\s*(?<senderPhone>\\d{9,12})` +
          `[.\\s]*رقم العملية\\s*:?\\s*${REF}` +
          "(?:[.\\s]*التاريخ\\s*(?<date>[\\d/.-]+)\\s*الساعة\\s*(?<time>\\d{1,2}:\\d{2}))?",
        flags: "iu",
        priority: 10,
        isActive: true,
        sampleText:
          "عزيزي العميل، تم تحويل مبلغ 10,000 ر.ي إلى محفظتك من الرقم 733123456. رقم العملية 55667788. التاريخ 16-09-2026 الساعة 09:15",
      },
      ...tolerantArabicTemplates(),
      genericTemplate(),
    ],
  },
  {
    code: "onecash",
    name: "ون كاش",
    senderIds: ["ONECash", "ONE Cash"],
    templates: [
      {
        name: "استلام مبلغ",
        pattern:
          `استلمت\\s*(?<amount>${NUM})\\s*${CUR}\\s*من\\s*(?<senderPhone>\\d{9,12})` +
          "(?:\\s*-\\s*(?<senderName>[^.]+?))?" +
          `[.\\s]*المرجع\\s*:?\\s*${REF}` +
          `(?:[.\\s]*الرصيد الحالي\\s*:?\\s*(?<balance>${NUM}))?`,
        flags: "iu",
        priority: 10,
        isActive: true,
        sampleText: "استلمت 15000 ريال من 700123456 - سالم قاسم. المرجع: ONE-2233445. الرصيد الحالي 45000 ريال",
      },
      ...tolerantArabicTemplates(),
      genericTemplate(),
    ],
  },
  {
    code: "jawali",
    name: "جوالي",
    senderIds: ["Jawali", "JAWALI"],
    templates: [
      {
        name: "Received (EN)",
        pattern:
          `You have received\\s*(?<amount>${NUM})\\s*(?<currency>YER|SAR|USD)?\\s*from\\s*(?<senderPhone>\\d{9,12})` +
          "(?:\\s*\\((?<senderName>[^)]+)\\))?" +
          `[.\\s]*Ref\\.?\\s*:?\\s*${REF}` +
          `(?:[.\\s]*Balance\\s*:?\\s*(?<balance>${NUM})\\s*(?:YER|SAR|USD)?)?` +
          "(?:[^\\d]*(?<date>\\d{1,2}[-/]\\d{1,2}[-/]\\d{4}|\\d{4}[-/]\\d{2}[-/]\\d{2})\\s+(?<time>\\d{1,2}:\\d{2}))?",
        flags: "iu",
        priority: 10,
        isActive: true,
        sampleText: "You have received 20,000 YER from 770123456. Ref: JW123456. Balance: 60,000 YER. 16/09/2026 12:00",
      },
      genericTemplate(),
    ],
  },
];
