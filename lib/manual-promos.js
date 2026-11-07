// Manual promo store: data/promos.manual.json
// { "entries": [ { sourceId, addedAt, ...raw promo fields } ], "checks": { "<sourceId>": "<ISO time>" } }
// "checks" records that an operator looked at the airline's page and confirmed it is up to date,
// even when no new promotion was found. Both entries and checks count as a successful update.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readManualStore(path) {
  try {
    const store = JSON.parse(await readFile(path, "utf8"));
    return { entries: store.entries ?? [], checks: store.checks ?? {} };
  } catch (err) {
    if (err.code === "ENOENT") return { entries: [], checks: {} };
    throw err;
  }
}

async function writeStore(path, store) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function addManualEntry(path, sourceId, raw, now) {
  const store = await readManualStore(path);
  const addedAt = now.toISOString();
  store.entries.push({ ...raw, sourceId, addedAt });
  store.checks[sourceId] = addedAt;
  await writeStore(path, store);
  return store;
}

export async function recordManualCheck(path, sourceId, now) {
  const store = await readManualStore(path);
  store.checks[sourceId] = now.toISOString();
  await writeStore(path, store);
  return store;
}
