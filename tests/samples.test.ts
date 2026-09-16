import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSamples, loadSampleFiles, parseSamplesFile } from "@/lib/parser/samples";

const samplesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../samples");

describe("parseSamplesFile", () => {
  it("splits on blank lines, keeps multi-line messages, drops comments", () => {
    const msgs = parseSamplesFile("# c\n\nfirst line\nsecond line\n\n\n# another\nthird\n");
    expect(msgs).toEqual(["first line\nsecond line", "third"]);
  });
});

/**
 * Every message in samples/<wallet>.txt must be readable by that wallet's
 * built-in templates. Drop real messages into those files and this test tells
 * you exactly which one needs a template change.
 */
describe("samples/ corpus", () => {
  const files = loadSampleFiles(samplesDir);
  const reports = checkSamples(files);
  if (reports.length === 0) {
    it.skip("no sample files present", () => {});
    return;
  }
  for (const r of reports) {
    describe(r.code, () => {
      r.results.forEach(({ text, result }, i) => {
        it(`#${i + 1}: ${text.replace(/\s+/g, " ").slice(0, 60)}`, () => {
          expect(result, `sample ${i + 1} in ${path.basename(r.file)} did not match any template`).not.toBeNull();
          expect(result!.data.amount).toBeGreaterThan(0);
        });
      });
    });
  }
});
