// Builds data/promos.json from every configured promo source.
// Usage: node scripts/fetch-promos.js [--list]
//   --list   print each source with its acquisition method, then exit

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readManualStore } from "../lib/manual-promos.js";
import { checkPageFetchAllowed, loadPromoSources } from "../lib/promo-sources.js";
import { activePromos, normalizePromo, sourceFreshness } from "../lib/promos.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Page parsers keyed by source id: async (source) => raw promo[]. None are enabled yet:
// a parser is added only after that airline's terms were reviewed and allow automated fetching.
export const PAGE_PARSERS = {};

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export function describeSources(config) {
  return config.sources.map((s) => ({
    id: s.id,
    airline: s.airline,
    method: s.method,
    termsReviewed: s.termsReviewed,
    termsAllowFetch: s.termsAllowFetch,
  }));
}

/** Collects raw promos for one source. Returns { promos, ok, note }. */
async function collectSource(source, manualStore, parsers, now) {
  if (source.method === "manual") {
    const entries = manualStore.entries.filter((e) => e.sourceId === source.id);
    const lastCheck = manualStore.checks[source.id] ?? null;
    return { raws: entries, manual: true, lastSuccessAt: lastCheck, note: null };
  }
  if (source.method === "page") {
    const gate = checkPageFetchAllowed(source);
    if (!gate.allowed) return { raws: [], manual: false, lastSuccessAt: undefined, note: `refused: ${gate.reason}` };
    const parse = parsers[source.id];
    if (!parse) return { raws: [], manual: false, lastSuccessAt: undefined, note: "no parser for this source" };
    try {
      return { raws: await parse(source), manual: false, lastSuccessAt: now.toISOString(), note: null };
    } catch (err) {
      return { raws: [], manual: false, lastSuccessAt: undefined, note: `fetch failed: ${err.message}` };
    }
  }
  return { raws: [], manual: false, lastSuccessAt: undefined, note: `${source.method} sources are not supported yet` };
}

/**
 * Builds the promo output. Sources that fail keep their previous lastSuccessAt so the
 * stale warning can fire. Returns { output, notes }.
 */
export async function runPromos({
  root = ROOT,
  now = new Date(),
  parsers = PAGE_PARSERS,
  log = console.log,
} = {}) {
  const config = await loadPromoSources(join(root, "config", "promo-sources.json"));
  const manualStore = await readManualStore(join(root, "data", "promos.manual.json"));
  const previous = await readJsonIfExists(join(root, "data", "promos.json"));
  const previousSuccess = new Map((previous?.sources ?? []).map((s) => [s.id, s.lastSuccessAt]));

  const promos = [];
  const sources = [];
  const notes = [];
  for (const source of config.sources) {
    const result = await collectSource(source, manualStore, parsers, now);
    const lastSuccessAt =
      result.lastSuccessAt === undefined ? previousSuccess.get(source.id) ?? null : result.lastSuccessAt;
    if (result.note) {
      notes.push(`${source.id}: ${result.note}`);
      log(`warn: ${source.id}: ${result.note}`);
    }
    for (const raw of result.raws) {
      try {
        promos.push(
          normalizePromo(raw, {
            sourceId: source.id,
            airline: source.airline,
            fetchedAt: raw.addedAt ?? now.toISOString(),
            manual: result.manual,
          }),
        );
      } catch (err) {
        notes.push(`${source.id}: skipped invalid promo: ${err.message}`);
        log(`warn: ${source.id}: skipped invalid promo: ${err.message}`);
      }
    }
    sources.push({
      id: source.id,
      airline: source.airline,
      airlineZh: source.airlineZh ?? source.airline,
      method: source.method,
      siteUrl: source.siteUrl ?? null,
      ...sourceFreshness({ lastSuccessAt, now, staleAfterDays: config.staleAfterDays }),
    });
  }

  const output = {
    generatedAt: now.toISOString(),
    staleAfterDays: config.staleAfterDays,
    sources,
    promos: activePromos(promos, now),
  };
  await mkdir(join(root, "data"), { recursive: true });
  await writeFile(join(root, "data", "promos.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return { output, notes };
}

async function main() {
  try {
    if (process.argv.includes("--list")) {
      const config = await loadPromoSources(join(ROOT, "config", "promo-sources.json"));
      for (const s of describeSources(config)) {
        console.log(`${s.id}\t${s.airline}\t${s.method}\ttermsReviewed=${s.termsReviewed}\tallowFetch=${s.termsAllowFetch}`);
      }
      return;
    }
    const { output } = await runPromos();
    const stale = output.sources.filter((s) => s.stale).map((s) => s.id);
    console.log(`promos: ${output.promos.length} active, stale sources: ${stale.length ? stale.join(", ") : "none"}`);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
