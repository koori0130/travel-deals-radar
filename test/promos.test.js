import { test } from "node:test";
import assert from "node:assert/strict";
import { activePromos, normalizePromo, sourceFreshness } from "../lib/promos.js";

const base = {
  origin: "TPE",
  destination: "NRT",
  price: 1580,
  currency: "TWD",
  tripType: "oneWay",
  taxIncluded: false,
  sourceUrl: "https://example.com/sale",
};
const ctx = { sourceId: "peach", airline: "Peach", fetchedAt: "2026-11-07T00:00:00.000Z" };

test("normalization produces every standard field", () => {
  const p = normalizePromo({ ...base, travelFrom: "2026-12-01", travelTo: "2027-03-31", saleStart: "2026-11-07", saleEnd: "2026-11-10" }, ctx);
  assert.deepEqual(Object.keys(p).sort(), [
    "airline", "currency", "destination", "fetchedAt", "manual", "origin", "price", "saleEnd", "saleStart",
    "sourceId", "sourceUrl", "taxIncluded", "travelFrom", "travelTo", "tripType",
  ]);
  assert.equal(p.saleEnd, "2026-11-10T15:59:59.000Z");
  assert.equal(p.saleStart, "2026-11-06T16:00:00.000Z");
});

test("a missing sale end time is stored as null and never invented", () => {
  const p = normalizePromo({ ...base }, ctx);
  assert.equal(p.saleEnd, null);
  assert.equal(p.saleStart, null);
});

test("invalid input is rejected with a clear message", () => {
  assert.throws(() => normalizePromo({ ...base, tripType: "multi" }, ctx), /tripType/);
  assert.throws(() => normalizePromo({ ...base, taxIncluded: "yes" }, ctx), /taxIncluded/);
  assert.throws(() => normalizePromo({ ...base, origin: "KHH" }, ctx), /origin/);
  assert.throws(() => normalizePromo({ ...base, price: "abc" }, ctx), /price/);
  assert.throws(() => normalizePromo({ ...base, sourceUrl: "" }, ctx), /sourceUrl/);
});

test("expired promotions are removed and unknown end times stay", () => {
  const now = new Date("2026-11-11T00:00:00Z");
  const expired = normalizePromo({ ...base, saleEnd: "2026-11-10" }, ctx);
  const open = normalizePromo({ ...base, saleEnd: "2026-11-20" }, ctx);
  const unknown = normalizePromo({ ...base }, ctx);
  assert.deepEqual(activePromos([expired, open, unknown], now), [open, unknown]);
});

test("a sale ending today stays active until the end of the day in Taipei", () => {
  const p = normalizePromo({ ...base, saleEnd: "2026-11-10" }, ctx);
  assert.equal(activePromos([p], new Date("2026-11-10T15:00:00Z")).length, 1);
  assert.equal(activePromos([p], new Date("2026-11-10T16:00:00Z")).length, 0);
});

test("source freshness uses the configured threshold (3 days)", () => {
  const now = new Date("2026-11-07T00:00:00Z");
  const days = (n) => new Date(now.getTime() - n * 86400000).toISOString();
  assert.equal(sourceFreshness({ lastSuccessAt: days(2), now, staleAfterDays: 3 }).stale, false);
  assert.equal(sourceFreshness({ lastSuccessAt: days(4), now, staleAfterDays: 3 }).stale, true);
  assert.deepEqual(sourceFreshness({ lastSuccessAt: null, now, staleAfterDays: 3 }), { lastSuccessAt: null, stale: true });
});
