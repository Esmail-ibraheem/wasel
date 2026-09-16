/**
 * Text normalization applied to every incoming SMS before matching.
 * Only digits, separators and whitespace are normalized — letters are left
 * untouched so templates can match the wallet's exact wording.
 */

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0; // ۰

export function normalizeDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String.fromCharCode(48 + (code - ARABIC_INDIC_ZERO));
    } else if (code >= EXTENDED_ARABIC_INDIC_ZERO && code <= EXTENDED_ARABIC_INDIC_ZERO + 9) {
      out += String.fromCharCode(48 + (code - EXTENDED_ARABIC_INDIC_ZERO));
    } else {
      out += ch;
    }
  }
  return out;
}

export function normalizeText(input: string): string {
  return normalizeDigits(input)
    .replace(/[​-‏‪-‮⁠﻿]/g, "") // zero-width / bidi controls
    .replace(/ـ/g, "") // tatweel
    .replace(/،/g, ",") // Arabic comma ،
    .replace(/٬/g, ",") // Arabic thousands separator ٬
    .replace(/٫/g, ".") // Arabic decimal separator ٫
    .replace(/[\s ]+/g, " ")
    .trim();
}
