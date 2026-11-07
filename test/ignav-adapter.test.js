import { test } from "node:test";
import assert from "node:assert/strict";
import { createIgnavAdapter } from "../lib/adapters/ignav.js";
import { monthWindows, taipeiDate } from "../lib/dates.js";

function fakeFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    const payload = handler(body, calls.length);
    return { ok: true, status: 200, json: async () => payload };
  };
  impl.calls = calls;
  return impl;
}

test("adapter requires an API key", () => {
  assert.throws(() => createIgnavAdapter({ apiKey: "" }), /IGNAV_API_KEY/);
});

test("adapter returns the lowest one-way fare per month in the standard record shape", async () => {
  const fetchImpl = fakeFetch((body) => ({
    origin: body.origin,
    destination: body.destination,
    dates: [
      { departure_date: body.departure_date_range.start, price: { amount: "6200", currency: "TWD", status: "unverified" } },
      { departure_date: body.departure_date_range.end, price: { amount: "4800", currency: "TWD", status: "unverified" } },
      { departure_date: body.departure_date_range.end, price: null },
    ],
  }));
  const adapter = createIgnavAdapter({ apiKey: "k", fetchImpl });
  const records = await adapter.getMonthlyLowest({ origin: "TPE", destination: "NRT", today: "2026-11-07", months: 3 });

  assert.equal(records.length, 3);
  assert.equal(records[0].month, "2026-11");
  assert.equal(records[0].price, 4800);
  assert.equal(records[0].currency, "TWD");
  assert.equal(records[0].tripType, "oneWay");
  assert.equal(records[0].taxIncluded, true);
  assert.equal(records[0].departureDate, "2026-11-30");
  assert.match(records[0].bookingUrl, /^https:\/\//);
  assert.equal(fetchImpl.calls[0].init.headers["X-Api-Key"], "k");
});

test("months without any fare produce no record", async () => {
  const fetchImpl = fakeFetch(() => ({ dates: [{ departure_date: "2026-11-10", price: null }] }));
  const adapter = createIgnavAdapter({ apiKey: "k", fetchImpl });
  const records = await adapter.getMonthlyLowest({ origin: "TSA", destination: "KIX", today: "2026-11-07", months: 2 });
  assert.deepEqual(records, []);
});

test("a failing request surfaces the route and month", async () => {
  const impl = async () => ({ ok: false, status: 429, json: async () => ({}) });
  const adapter = createIgnavAdapter({ apiKey: "k", fetchImpl: impl });
  await assert.rejects(
    adapter.getMonthlyLowest({ origin: "TPE", destination: "NRT", today: "2026-11-07", months: 1 }),
    /TPE-NRT 2026-11: HTTP 429/,
  );
});

test("month windows start today, then on the 1st, and never exceed 31 days", () => {
  const w = monthWindows("2026-11-07", 3);
  assert.deepEqual(w[0], { month: "2026-11", start: "2026-11-07", end: "2026-11-30" });
  assert.deepEqual(w[1], { month: "2026-12", start: "2026-12-01", end: "2026-12-31" });
  assert.equal(w[2].month, "2027-01");
  const all = monthWindows("2026-01-01", 12);
  assert.equal(all[11].month, "2026-12");
});

test("Taipei date is ahead of UTC late in the UTC day", () => {
  assert.equal(taipeiDate(new Date("2026-11-07T20:00:00Z")), "2026-11-08");
});
