import { normalizeDigits } from "./normalize";

/** Yemen is UTC+3 year-round (no DST). Wallet SMS timestamps are local time. */
export const YEMEN_UTC_OFFSET_HOURS = 3;

interface Ymd {
  y: number;
  m: number;
  d: number;
}

function parseDatePart(raw: string): Ymd | null {
  const s = normalizeDigits(raw).trim();
  let m: RegExpMatchArray | null;

  // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    return { y: +m[1], m: +m[2], d: +m[3] };
  }
  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
    return { y: +m[3], m: +m[2], d: +m[1] };
  }
  // DD-MM-YY
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/))) {
    return { y: 2000 + +m[3], m: +m[2], d: +m[1] };
  }
  return null;
}

function parseTimePart(raw: string | undefined): { h: number; mi: number; s: number } {
  if (!raw) return { h: 0, mi: 0, s: 0 };
  const s = normalizeDigits(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|ص|م|صباحا|صباحاً|مساء|مساءً)?$/i);
  if (!m) return { h: 0, mi: 0, s: 0 };
  let h = +m[1];
  const mi = +m[2];
  const sec = m[3] ? +m[3] : 0;
  const marker = m[4]?.toLowerCase();
  if (marker) {
    const isPm = marker === "pm" || marker === "م" || marker.startsWith("مساء");
    const isAm = marker === "am" || marker === "ص" || marker.startsWith("صباح");
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
  }
  return { h, mi, s: sec };
}

function isValidYmd({ y, m, d }: Ymd): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * Builds a UTC Date from a local Yemen date/time as written in the SMS.
 * Returns `fallback` (by identity) when the date is missing or invalid.
 */
export function parseDateTime(date: string | undefined, time: string | undefined, fallback: Date): Date {
  if (!date) return fallback;
  const ymd = parseDatePart(date);
  if (!ymd || !isValidYmd(ymd)) return fallback;
  const t = parseTimePart(time);
  if (t.h > 23 || t.mi > 59 || t.s > 59) return fallback;
  return new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, t.h - YEMEN_UTC_OFFSET_HOURS, t.mi, t.s));
}
