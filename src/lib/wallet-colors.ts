/** Each wallet gets a stable hue for chips and receipt-stub edges. */
const PALETTE: Record<string, { color: string; soft: string }> = {
  jaib: { color: "var(--color-crimson)", soft: "var(--color-crimson-soft)" },
  floosak: { color: "var(--color-emerald)", soft: "var(--color-emerald-soft)" },
  cash: { color: "var(--color-sky)", soft: "var(--color-sky-soft)" },
  onecash: { color: "var(--color-tangerine)", soft: "var(--color-tangerine-soft)" },
  jawali: { color: "var(--color-plum)", soft: "var(--color-plum-soft)" },
};

const FALLBACKS = [
  { color: "var(--color-ink-600)", soft: "var(--color-sky-soft)" },
  { color: "var(--color-saffron)", soft: "var(--color-saffron-soft)" },
];

export function walletColors(code: string): { color: string; soft: string } {
  if (PALETTE[code]) return PALETTE[code];
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACKS[Math.abs(h) % FALLBACKS.length];
}
