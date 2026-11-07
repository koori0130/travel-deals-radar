// Daily job: query the price source for every route and write data/fares.json.
// Usage: node scripts/fetch-fares.js

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadDestinationConfig, routesFrom } from "../lib/destinations.js";
import { taipeiDate } from "../lib/dates.js";
import { appendHistory, historyStatus } from "../lib/history.js";
import { createPriceAdapter } from "../lib/price-source.js";
import { mergeSnapshot, routeKey } from "../lib/snapshot.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Runs the daily fare job. Dependencies are injectable for tests.
 * Returns { snapshot, failures, queried }. Throws before any query on bad config or missing key.
 */
export async function runFares({
  root = ROOT,
  env = process.env,
  now = new Date(),
  fetchImpl,
  adapter,
  log = console.log,
} = {}) {
  const config = await loadDestinationConfig(join(root, "config", "destinations.json"));
  const priceAdapter = adapter ?? createPriceAdapter(config.priceSource, env, fetchImpl);
  const today = taipeiDate(now);
  const faresPath = join(root, "data", "fares.json");
  const previous = await readJsonIfExists(faresPath);

  const results = [];
  for (const route of routesFrom(config)) {
    try {
      const records = await priceAdapter.getMonthlyLowest({ ...route, today, months: 12 });
      results.push({ ...route, records });
    } catch (err) {
      log(`warn: ${routeKey(route.origin, route.destination)} failed: ${err.message}`);
      results.push({ ...route, error: err.message });
    }
  }

  const { snapshot, failures } = mergeSnapshot({
    previous,
    results,
    now,
    source: priceAdapter.name,
  });

  const historyDir = join(root, "data", "history");
  await appendHistory(historyDir, today, snapshot.fares);
  snapshot.history = await historyStatus(historyDir);

  await mkdir(join(root, "data"), { recursive: true });
  await writeFile(faresPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return { snapshot, failures, queried: results.length };
}

async function main() {
  try {
    const { snapshot, failures, queried } = await runFares();
    console.log(`fares: ${snapshot.fares.length} records, ${failures.length}/${queried} routes failed`);
    if (failures.length === queried) process.exitCode = 1;
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
