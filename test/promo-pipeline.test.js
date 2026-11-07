import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { addPromo } from "../scripts/add-promo.js";
import { describeSources, runPromos } from "../scripts/fetch-promos.js";
import { checkPageFetchAllowed, loadPromoSources } from "../lib/promo-sources.js";

const REAL_CONFIG = fileURLToPath(new URL("../config/promo-sources.json", import.meta.url));

async function makeRoot(mutate) {
  const root = await mkdtemp(join(tmpdir(), "promo-"));
  await mkdir(join(root, "config"), { recursive: true });
  const config = JSON.parse(await readFile(REAL_CONFIG, "utf8"));
  if (mutate) mutate(config);
  await writeFile(join(root, "config", "promo-sources.json"), JSON.stringify(config));
  return root;
}

const NOW = new Date("2026-11-07T04:00:00Z");
const peachPromo = {
  source: "peach", origin: "TPE", destination: "NRT", price: "1580", currency: "TWD", trip: "oneWay", tax: "false",
  url: "https://www.flypeach.com/sale", "sale-end": "2026-11-20",
};

test("the shipped config lists the five first-batch airlines with their acquisition methods", async () => {
  const config = await loadPromoSources(REAL_CONFIG);
  const rows = describeSources(config);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map((r) => r.airline).sort(), ["AirAsia", "Jetstar", "Peach", "Scoot", "Tigerair Taiwan"]);
  assert.ok(rows.every((r) => ["manual", "feed", "page"].includes(r.method)));
  assert.ok(rows.every((r) => typeof r.termsReviewed === "boolean"));
});

test("a page source without a recorded terms review is refused", () => {
  const gate = checkPageFetchAllowed({ id: "x", method: "page", termsReviewed: false });
  assert.equal(gate.allowed, false);
  assert.match(gate.reason, /terms of use have not been reviewed/);
  assert.equal(checkPageFetchAllowed({ id: "x", method: "page", termsReviewed: true }).allowed, true);
  assert.equal(checkPageFetchAllowed({ id: "x", method: "manual", termsReviewed: false }).allowed, true);
});

test("an unreviewed page source never runs its parser and reports the reason", async () => {
  const root = await makeRoot((c) => { c.sources[0].method = "page"; });
  let called = false;
  const parsers = { [JSON.parse(await readFile(REAL_CONFIG, "utf8")).sources[0].id]: async () => { called = true; return []; } };
  const { notes } = await runPromos({ root, now: NOW, parsers, log() {} });
  assert.equal(called, false);
  assert.ok(notes.some((n) => /refused: .*terms of use have not been reviewed/.test(n)));
});

test("a reviewed page source runs its parser and counts as a successful update", async () => {
  const root = await makeRoot((c) => { c.sources[0].method = "page"; c.sources[0].termsReviewed = true; });
  const id = JSON.parse(await readFile(REAL_CONFIG, "utf8")).sources[0].id;
  const parsers = {
    [id]: async () => [{ origin: "TPE", destination: "KIX", price: 1780, currency: "TWD", tripType: "oneWay", taxIncluded: true, sourceUrl: "https://example.com/p" }],
  };
  const { output } = await runPromos({ root, now: NOW, parsers, log() {} });
  assert.equal(output.promos.length, 1);
  assert.equal(output.promos[0].manual, false);
  const src = output.sources.find((s) => s.id === id);
  assert.equal(src.lastSuccessAt, NOW.toISOString());
  assert.equal(src.stale, false);
});

test("a manual promo with a future end time appears in the output marked manual", async () => {
  const root = await makeRoot();
  await addPromo({ root, values: peachPromo, now: NOW });
  const { output } = await runPromos({ root, now: NOW, log() {} });
  assert.equal(output.promos.length, 1);
  assert.equal(output.promos[0].manual, true);
  assert.equal(output.promos[0].sourceId, "peach");
  assert.equal(output.sources.find((s) => s.id === "peach").stale, false);
});

test("an expired promo is absent from the active output", async () => {
  const root = await makeRoot();
  await addPromo({ root, values: { ...peachPromo, "sale-end": "2026-11-10" }, now: NOW });
  const later = new Date("2026-11-11T00:00:00Z");
  const { output } = await runPromos({ root, now: later, log() {} });
  assert.equal(output.promos.length, 0);
});

test("invalid manual input is rejected and nothing is stored", async () => {
  const root = await makeRoot();
  await assert.rejects(addPromo({ root, values: { ...peachPromo, trip: "multi" }, now: NOW }), /tripType/);
  await assert.rejects(addPromo({ root, values: { ...peachPromo, source: "nope" }, now: NOW }), /Unknown source/);
  const { output } = await runPromos({ root, now: NOW, log() {} });
  assert.equal(output.promos.length, 0);
});

test("a source with no successful update is flagged stale, a recently checked one is not", async () => {
  const root = await makeRoot();
  await addPromo({ root, values: { source: "scoot", checked: true }, now: new Date("2026-11-05T04:00:00Z") });
  const { output } = await runPromos({ root, now: NOW, log() {} });
  assert.equal(output.sources.find((s) => s.id === "scoot").stale, false);
  assert.equal(output.sources.find((s) => s.id === "peach").stale, true);
  assert.equal(output.sources.find((s) => s.id === "peach").lastSuccessAt, null);
  assert.equal(output.staleAfterDays, 3);
});

test("a source goes stale once its last update is older than the threshold", async () => {
  const root = await makeRoot();
  await addPromo({ root, values: { source: "scoot", checked: true }, now: new Date("2026-11-03T04:00:00Z") });
  const { output } = await runPromos({ root, now: NOW, log() {} });
  assert.equal(output.sources.find((s) => s.id === "scoot").stale, true);
});

test("a failed source keeps its previous lastSuccessAt", async () => {
  const root = await makeRoot((c) => { c.sources[0].method = "page"; c.sources[0].termsReviewed = true; });
  const id = JSON.parse(await readFile(REAL_CONFIG, "utf8")).sources[0].id;
  const ok = { [id]: async () => [] };
  await runPromos({ root, now: new Date("2026-11-05T04:00:00Z"), parsers: ok, log() {} });
  const broken = { [id]: async () => { throw new Error("layout changed"); } };
  const { output, notes } = await runPromos({ root, now: NOW, parsers: broken, log() {} });
  assert.ok(notes.some((n) => /layout changed/.test(n)));
  assert.equal(output.sources.find((s) => s.id === id).lastSuccessAt, "2026-11-05T04:00:00.000Z");
});
