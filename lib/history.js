// Daily price history: one file per day under data/history/YYYY-MM-DD.json.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { routeKey } from "./snapshot.js";

export const HISTORY_MIN_DAYS = 90;

/** Writes (or overwrites) the day's history file with the lowest fare per route and month. */
export async function appendHistory(dir, date, fares) {
  await mkdir(dir, { recursive: true });
  const entries = fares
    .filter((f) => !f.stale)
    .map((f) => ({
      date,
      origin: f.origin,
      destination: f.destination,
      month: f.month,
      price: f.price,
      currency: f.currency,
      tripType: f.tripType,
    }));
  await writeFile(join(dir, `${date}.json`), `${JSON.stringify(entries)}\n`, "utf8");
  return entries.length;
}

/**
 * Reads the history folder and reports, per route, how many distinct days it has.
 * Returns { "TPE-NRT": { days: 12, sufficient: false } }.
 */
export async function historyStatus(dir) {
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const daysByRoute = new Map();
  for (const file of files) {
    const entries = JSON.parse(await readFile(join(dir, file), "utf8"));
    const routes = new Set(entries.map((e) => routeKey(e.origin, e.destination)));
    for (const route of routes) daysByRoute.set(route, (daysByRoute.get(route) ?? 0) + 1);
  }
  const status = {};
  for (const [route, days] of daysByRoute) {
    status[route] = { days, sufficient: days >= HISTORY_MIN_DAYS };
  }
  return status;
}
