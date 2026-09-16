import { normalizeDigits } from "./normalize";

/** Parses "50,000", "1,250,000.75", "50 000", "1500,50" → number. Returns null when not a number. */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  let s = normalizeDigits(raw).replace(/\s+/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Whichever separator comes last is the decimal one.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = s.split(",");
    const last = parts[parts.length - 1];
    // "1500,50" → decimal comma; "50,000" / "1,250,000" → thousands
    if (parts.length === 2 && last.length > 0 && last.length < 3) {
      s = parts[0] + "." + last;
    } else {
      s = parts.join("");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const CURRENCY_MAP: Array<[RegExp, string]> = [
  [/سعودي|sar|ر\.?س/i, "SAR"],
  [/دولار|usd|\$/i, "USD"],
  [/يورو|eur|€/i, "EUR"],
  [/ريال|yer|ر\.?ي/i, "YER"],
];

export function normalizeCurrency(raw: string | undefined): string {
  if (!raw) return "YER";
  const s = raw.trim();
  for (const [re, code] of CURRENCY_MAP) {
    if (re.test(s)) return code;
  }
  return s.length <= 4 ? s.toUpperCase() : "YER";
}
