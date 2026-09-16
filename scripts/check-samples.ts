/* eslint-disable no-console */
/**
 * pnpm samples:check [--db]
 *
 * Runs every message in samples/<wallet>.txt through that wallet's templates
 * and prints what was extracted. With --db the templates are read from the
 * database (i.e. including edits made in the admin UI) instead of the seed file.
 */
import { checkSamples, loadSampleFiles, seedTemplatesFor } from "../src/lib/parser/samples";
import { formatAmount } from "../src/lib/format";
import type { TemplateLike } from "../src/lib/parser/engine";

async function templatesFromDb(): Promise<(code: string) => Array<TemplateLike & { name: string }> | undefined> {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const wallets = await db.wallet.findMany({ include: { templates: true } });
  await db.$disconnect();
  const map = new Map(wallets.map((w) => [w.code, w.templates]));
  return (code) => map.get(code);
}

async function main() {
  const useDb = process.argv.includes("--db");
  const samples = loadSampleFiles();
  if (samples.length === 0) {
    console.log("لا توجد عينات. أضف رسائل إلى samples/<wallet>.txt");
    return;
  }
  const reports = checkSamples(samples, useDb ? await templatesFromDb() : seedTemplatesFor);
  let failed = 0;
  let total = 0;
  for (const r of reports) {
    console.log(`\n=== ${r.code} (${r.results.length} رسالة) — ${useDb ? "أنماط قاعدة البيانات" : "الأنماط المضمّنة"}`);
    r.results.forEach(({ text, result, templateName }, i) => {
      total++;
      const preview = text.replace(/\s+/g, " ").slice(0, 90);
      if (!result) {
        failed++;
        console.log(`  ${i + 1}. ✗ لم يُتعرف عليها: ${preview}`);
        return;
      }
      const d = result.data;
      const fields = [
        formatAmount(d.amount, d.currency),
        d.senderName ? `من ${d.senderName}` : null,
        d.senderPhone ?? null,
        d.reference ? `مرجع ${d.reference}` : "بدون مرجع",
        d.balanceAfter !== undefined ? `رصيد ${formatAmount(d.balanceAfter, d.currency)}` : null,
        d.transferredAt.toISOString(),
      ]
        .filter(Boolean)
        .join(" · ");
      console.log(`  ${i + 1}. ✓ [${templateName}] ${fields}`);
    });
  }
  console.log(`\n${total - failed}/${total} رسالة قُرئت بنجاح.`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
