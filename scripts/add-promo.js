// Manually add an airline promotion, or record that a source was checked.
// Usage:
//   node scripts/add-promo.js --source peach --origin TPE --destination NRT --price 1580 \
//     --currency TWD --trip oneWay --tax false --url https://... \
//     [--travel-from 2026-12-01] [--travel-to 2027-03-31] [--sale-start 2026-11-07] [--sale-end 2026-11-10]
//   node scripts/add-promo.js --source peach --checked      (no new promo; mark the source as checked today)

import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { addManualEntry, recordManualCheck } from "../lib/manual-promos.js";
import { loadPromoSources } from "../lib/promo-sources.js";
import { normalizePromo } from "../lib/promos.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const OPTIONS = {
  source: { type: "string" },
  origin: { type: "string" },
  destination: { type: "string" },
  price: { type: "string" },
  currency: { type: "string" },
  trip: { type: "string" },
  tax: { type: "string" },
  url: { type: "string" },
  "travel-from": { type: "string" },
  "travel-to": { type: "string" },
  "sale-start": { type: "string" },
  "sale-end": { type: "string" },
  checked: { type: "boolean" },
};

export function rawFromArgs(values) {
  const tax = values.tax;
  return {
    origin: values.origin,
    destination: values.destination,
    price: values.price,
    currency: values.currency,
    tripType: values.trip,
    taxIncluded: tax === "true" ? true : tax === "false" ? false : undefined,
    sourceUrl: values.url,
    travelFrom: values["travel-from"],
    travelTo: values["travel-to"],
    saleStart: values["sale-start"],
    saleEnd: values["sale-end"],
  };
}

/** Adds a manual promo (validated first) or records a check. Returns a short message. */
export async function addPromo({ root = ROOT, values, now = new Date() }) {
  const config = await loadPromoSources(join(root, "config", "promo-sources.json"));
  const source = config.sources.find((s) => s.id === values.source);
  if (!source) {
    throw new Error(`Unknown source ${JSON.stringify(values.source)}. Known: ${config.sources.map((s) => s.id).join(", ")}`);
  }
  const storePath = join(root, "data", "promos.manual.json");
  if (values.checked) {
    await recordManualCheck(storePath, source.id, now);
    return `recorded check for ${source.id}`;
  }
  const raw = rawFromArgs(values);
  normalizePromo(raw, { sourceId: source.id, airline: source.airline, fetchedAt: now.toISOString(), manual: true });
  await addManualEntry(storePath, source.id, raw, now);
  return `added manual promo for ${source.id}: ${raw.origin}-${raw.destination} ${raw.price} ${raw.currency}`;
}

async function main() {
  try {
    const { values } = parseArgs({ options: OPTIONS });
    console.log(await addPromo({ values }));
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
