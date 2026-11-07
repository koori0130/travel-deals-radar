import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFares } from "../scripts/fetch-fares.js";
import { appendHistory, historyStatus } from "../lib/history.js";
import { makeFareRecord } from "../lib/fare-record.js";

const REAL_CONFIG = fileURLToPath(new URL("../config/destinations.json", import.meta.url));

async function makeRoot(config) {
  const root = await mkdtemp(join(tmpdir(), "radar-"));
  await mkdir(join(root, "config"), { recursive: true });
  if (config) await writeFile(join(root, "config", "destinations.json"), JSON.stringify(config));
  else await cp(REAL_CONFIG, join(root, "config", "destinations.json"));
  return root;
}

function record(origin, destination, month, price) {
  return makeFareRecord({
    origin, destination, month, departureDate: `${month}-15`, price, currency: "TWD",
    tripType: "oneWay", taxIncluded: true, bookingUrl: "https://example.com",
  });
}

const smallConfig = { priceSource: "ignav", origins: ["TPE", "TSA"], destinations: ["NRT"] };
const NOW = new Date("2026-11-07T04:00:00Z");

test("a successful run writes the lowest fare per month with generation time and source", async () => {
  const root = await makeRoot(smallConfig);
  const adapter = {
    name: "fake",
    async getMonthlyLowest({ origin, destination }) {
      return [record(origin, destination, "2026-11", 4000), record(origin, destination, "2026-12", 4200)];
    },
  };
  const { snapshot, failures } = await runFares({ root, adapter, now: NOW, log() {} });
  assert.equal(failures.length, 0);
  assert.equal(snapshot.source, "fake");
  assert.equal(snapshot.generatedAt, NOW.toISOString());
  assert.equal(snapshot.fares.length, 4);
  const onDisk = JSON.parse(await readFile(join(root, "data", "fares.json"), "utf8"));
  assert.equal(onDisk.fares.length, 4);
  assert.ok(onDisk.fares.every((f) => f.stale === false && f.updatedAt === NOW.toISOString()));
});

test("partial failure keeps the previous entries and marks them stale", async () => {
  const root = await makeRoot(smallConfig);
  const good = { name: "fake", async getMonthlyLowest({ origin, destination }) { return [record(origin, destination, "2026-11", 4000)]; } };
  await runFares({ root, adapter: good, now: NOW, log() {} });

  const later = new Date("2026-11-08T04:00:00Z");
  const flaky = {
    name: "fake",
    async getMonthlyLowest({ origin, destination }) {
      if (origin === "TSA") throw new Error("boom");
      return [record(origin, destination, "2026-11", 3900)];
    },
  };
  const { snapshot, failures } = await runFares({ root, adapter: flaky, now: later, log() {} });
  assert.equal(failures.length, 1);
  const tpe = snapshot.fares.find((f) => f.origin === "TPE");
  const tsa = snapshot.fares.find((f) => f.origin === "TSA");
  assert.equal(tpe.price, 3900);
  assert.equal(tpe.stale, false);
  assert.equal(tsa.price, 4000);
  assert.equal(tsa.stale, true);
  assert.equal(tsa.updatedAt, NOW.toISOString());
});

test("an invalid destination config fails before any price query", async () => {
  const root = await makeRoot({ priceSource: "ignav", origins: ["TPE"], destinations: ["Tokyo"] });
  let queried = false;
  const adapter = { name: "fake", async getMonthlyLowest() { queried = true; return []; } };
  await assert.rejects(runFares({ root, adapter, now: NOW, log() {} }), /Tokyo/);
  assert.equal(queried, false);
});

test("a missing API key fails with the variable name and writes nothing", async () => {
  const root = await makeRoot(smallConfig);
  await assert.rejects(runFares({ root, env: {}, now: NOW, log() {} }), /IGNAV_API_KEY/);
  await assert.rejects(readFile(join(root, "data", "fares.json"), "utf8"));
});

test("published files never contain the API key", async () => {
  const root = await makeRoot(smallConfig);
  const secret = "ignav_secret_value_123";
  const fetchImpl = async (url, init) => {
    assert.equal(init.headers["X-Api-Key"], secret);
    return { ok: true, status: 200, json: async () => ({ dates: [{ departure_date: "2026-11-20", price: { amount: "4500", currency: "TWD", status: "unverified" } }] }) };
  };
  await runFares({ root, env: { IGNAV_API_KEY: secret }, fetchImpl, now: NOW, log() {} });
  const text = [];
  text.push(await readFile(join(root, "data", "fares.json"), "utf8"));
  for (const f of await readdir(join(root, "data", "history"))) text.push(await readFile(join(root, "data", "history", f), "utf8"));
  assert.ok(text.every((t) => !t.includes(secret)));
});

test("history gets one entry per route and month on each of two consecutive days", async () => {
  const dir = join(await mkdtemp(join(tmpdir(), "hist-")), "history");
  const fares = [record("TPE", "NRT", "2026-11", 4000), record("TPE", "NRT", "2026-12", 4100)];
  await appendHistory(dir, "2026-11-07", fares);
  await appendHistory(dir, "2026-11-08", fares);
  const files = (await readdir(dir)).sort();
  assert.deepEqual(files, ["2026-11-07.json", "2026-11-08.json"]);
  for (const f of files) assert.equal(JSON.parse(await readFile(join(dir, f), "utf8")).length, 2);
  const status = await historyStatus(dir);
  assert.deepEqual(status["TPE-NRT"], { days: 2, sufficient: false });
});

test("history window boundary: 89 days is insufficient, 90 is sufficient", async () => {
  const dir = join(await mkdtemp(join(tmpdir(), "hist-")), "history");
  const fares = [record("TPE", "NRT", "2026-11", 4000)];
  const day = (i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  for (let i = 0; i < 89; i += 1) await appendHistory(dir, day(i), fares);
  assert.equal((await historyStatus(dir))["TPE-NRT"].sufficient, false);
  await appendHistory(dir, day(89), fares);
  assert.deepEqual((await historyStatus(dir))["TPE-NRT"], { days: 90, sufficient: true });
});
