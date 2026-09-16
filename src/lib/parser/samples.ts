import fs from "node:fs";
import path from "node:path";
import { parseWithTemplates, type ParseResult, type TemplateLike } from "./engine";
import { SEED_WALLETS } from "./seed-templates";

export interface SampleFile {
  code: string;
  file: string;
  messages: string[];
}

export interface SampleReport {
  code: string;
  file: string;
  results: Array<{ text: string; result: ParseResult | null; templateName?: string }>;
}

/** Parses a samples file: `#` lines are comments, blank lines separate messages. */
export function parseSamplesFile(content: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const msg = current.join("\n").trim();
    if (msg) out.push(msg);
    current = [];
  };
  for (const line of content.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    if (line.trim() === "") flush();
    else current.push(line);
  }
  flush();
  return out;
}

export function loadSampleFiles(dir = path.resolve(process.cwd(), "samples")): SampleFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => ({
      code: path.basename(f, ".txt"),
      file: path.join(dir, f),
      messages: parseSamplesFile(fs.readFileSync(path.join(dir, f), "utf8")),
    }))
    .filter((s) => s.messages.length > 0);
}

/** Runs every sample through the given templates (defaults to the built-in seed templates). */
export function checkSamples(
  samples: SampleFile[],
  templatesFor: (code: string) => Array<TemplateLike & { name: string }> | undefined = seedTemplatesFor,
): SampleReport[] {
  const now = new Date();
  return samples.map((s) => {
    const templates = templatesFor(s.code) ?? [];
    return {
      code: s.code,
      file: s.file,
      results: s.messages.map((text) => {
        const result = templates.length ? parseWithTemplates(text, templates, now) : null;
        return { text, result, templateName: result ? templates.find((t) => t.id === result.templateId)?.name : undefined };
      }),
    };
  });
}

export function seedTemplatesFor(code: string) {
  const w = SEED_WALLETS.find((w) => w.code === code);
  return w?.templates.map((t, i) => ({ id: `${code}-${i}`, ...t }));
}
