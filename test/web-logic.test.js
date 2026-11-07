import { test } from "node:test";
import assert from "node:assert/strict";
import { monthDetail, monthList, promoList, rankDestinations, safeUrl, staleSources } from "../web/logic.js";

const fare = (origin, destination, month, price, tripType = "oneWay") => ({
  origin, destination, month, price, currency: "TWD", tripType, taxIncluded: true, bookingUrl: "https://example.com", stale: false,
});

const FARES = [
  fare("TPE", "NRT", "2027-03", 6200),
  fare("TPE", "BKK", "2027-06", 4800),
  fare("TPE", "ICN", "2027-07", 5100),
  fare("TSA", "HND", "2027-02", 3900),
  fare("TPE", "NRT", "2027-04", 6900),
  fare("TPE", "NRT", "2027-03", 9000, "roundTrip"),
];

test("year view orders destinations from lowest to highest price (Bangkok, Seoul, Tokyo)", () => {
  const { oneWay } = rankDestinations(FARES, new Set(["TPE"]));
  assert.deepEqual(oneWay.map((f) => f.destination), ["BKK", "ICN", "NRT"]);
  assert.equal(oneWay[2].price, 6200);
  assert.equal(oneWay[2].month, "2027-03");
});

test("selecting only TSA hides every TPE fare", () => {
  const groups = rankDestinations(FARES, new Set(["TSA"]));
  assert.deepEqual(groups.oneWay.map((f) => f.destination), ["HND"]);
  assert.equal(groups.roundTrip.length, 0);
});

test("one-way and round-trip fares are ranked in separate groups", () => {
  const groups = rankDestinations(FARES, new Set(["TPE", "TSA"]));
  assert.equal(groups.roundTrip.length, 1);
  assert.ok(groups.oneWay.every((f) => f.tripType === "oneWay"));
  assert.ok(groups.roundTrip.every((f) => f.tripType === "roundTrip"));
});

test("month detail lists twelve months and marks months without data", () => {
  const detail = monthDetail(FARES, { destination: "NRT", origins: new Set(["TPE"]), tripType: "oneWay", today: "2027-01-15" });
  assert.equal(detail.length, 12);
  assert.equal(detail[0].month, "2027-01");
  assert.equal(detail[0].fare, null);
  assert.equal(detail.find((d) => d.month === "2027-03").fare.price, 6200);
  assert.equal(detail.find((d) => d.month === "2027-04").fare.price, 6900);
  assert.equal(monthList("2026-11-07", 3).join(), "2026-11,2026-12,2027-01");
});

const promo = (over) => ({
  airline: "Peach", sourceId: "peach", origin: "TPE", destination: "NRT", price: 3000, currency: "TWD",
  tripType: "oneWay", taxIncluded: false, travelFrom: null, travelTo: null, saleStart: null, saleEnd: null,
  sourceUrl: "https://example.com", fetchedAt: "2026-11-07T00:00:00.000Z", manual: false, ...over,
});
const NOW = new Date("2026-11-07T04:00:00Z");

test("promotions with the same price list the earliest sale end first", () => {
  const later = promo({ destination: "KIX", saleEnd: "2026-11-17T15:59:59.000Z" });
  const sooner = promo({ destination: "NRT", saleEnd: "2026-11-08T15:59:59.000Z" });
  const { oneWay } = promoList([later, sooner], { origins: new Set(["TPE"]), now: NOW });
  assert.deepEqual(oneWay.map((p) => p.destination), ["NRT", "KIX"]);
});

test("promotions are ordered by price before sale end, unknown end last", () => {
  const cheap = promo({ destination: "A", price: 1000, saleEnd: "2026-11-25T00:00:00.000Z" });
  const unknown = promo({ destination: "B", price: 2000, saleEnd: null });
  const dear = promo({ destination: "C", price: 2000, saleEnd: "2026-11-09T00:00:00.000Z" });
  const { oneWay } = promoList([unknown, dear, cheap], { origins: new Set(["TPE"]), now: NOW });
  assert.deepEqual(oneWay.map((p) => p.destination), ["A", "C", "B"]);
});

test("expired promotions and promotions ending beyond 30 days with far travel dates are left out", () => {
  const expired = promo({ destination: "X", saleEnd: "2026-11-06T00:00:00.000Z" });
  const farAway = promo({ destination: "Y", saleEnd: "2027-03-01T00:00:00.000Z", travelFrom: "2027-08-01", travelTo: "2027-09-01" });
  const travelSoon = promo({ destination: "Z", saleEnd: "2027-03-01T00:00:00.000Z", travelFrom: "2026-11-20", travelTo: "2027-01-31" });
  const { oneWay } = promoList([expired, farAway, travelSoon], { origins: new Set(["TPE"]), now: NOW });
  assert.deepEqual(oneWay.map((p) => p.destination), ["Z"]);
});

test("promotions respect the origin filter and the trip type grouping", () => {
  const tsa = promo({ origin: "TSA", destination: "HND" });
  const rt = promo({ tripType: "roundTrip", destination: "KIX" });
  const groups = promoList([tsa, rt], { origins: new Set(["TPE"]), now: NOW });
  assert.equal(groups.oneWay.length, 0);
  assert.equal(groups.roundTrip.length, 1);
});

test("stale sources are reported and only https links are rendered", () => {
  const data = { sources: [{ id: "a", stale: false }, { id: "b", stale: true, lastSuccessAt: "2026-11-01T00:00:00Z" }] };
  assert.deepEqual(staleSources(data).map((s) => s.id), ["b"]);
  assert.equal(safeUrl("https://example.com/x"), "https://example.com/x");
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("http://example.com"), null);
});

import { buildHash, googleExploreLink, googleFlightsLink, isGenericLink, parseHash, searchDate, skyscannerLink } from "../web/logic.js";

test("airline filter keeps only the chosen airlines, and an empty selection means all", () => {
  const peach = promo({ sourceId: "peach", destination: "KIX", price: 1780 });
  const scoot = promo({ sourceId: "scoot", destination: "SIN", price: 3000 });
  const origins = new Set(["TPE"]);
  assert.equal(promoList([peach, scoot], { origins, now: NOW }).oneWay.length, 2);
  assert.equal(promoList([peach, scoot], { origins, now: NOW, airlines: new Set() }).oneWay.length, 2);
  assert.deepEqual(promoList([peach, scoot], { origins, now: NOW, airlines: new Set(["scoot"]) }).oneWay.map((p) => p.destination), ["SIN"]);
  assert.deepEqual(promoList([peach, scoot], { origins, now: NOW, airlines: new Set(["peach", "scoot"]) }).oneWay.length, 2);
});

test("page state survives a round trip through the URL hash", () => {
  const state = { view: "promo", origins: new Set(["TSA"]), tripType: "roundTrip", airlines: new Set(["scoot", "peach"]) };
  const back = parseHash(buildHash(state));
  assert.equal(back.view, "promo");
  assert.deepEqual([...back.origins], ["TSA"]);
  assert.equal(back.tripType, "roundTrip");
  assert.deepEqual([...back.airlines].sort(), ["peach", "scoot"]);
});

test("an empty or damaged hash falls back to the defaults", () => {
  for (const hash of ["", "#", "#v=zzz&o=XXX&t=bad"]) {
    const s = parseHash(hash);
    assert.equal(s.view, "year");
    assert.deepEqual([...s.origins].sort(), ["TPE", "TSA"]);
    assert.equal(s.tripType, "oneWay");
    assert.equal(s.airlines.size, 0);
  }
});

test("search links carry the route and the date", () => {
  assert.match(googleFlightsLink("TPE", "KIX", "2026-12-01"), /Flights%20from%20TPE%20to%20KIX%20on%202026-12-01/);
  assert.equal(
    skyscannerLink("TPE", "KIX", "2026-12-01"),
    "https://www.skyscanner.com.tw/transport/flights/tpe/kix/261201/?adultsv2=1&cabinclass=economy&rtn=0",
  );
  assert.match(googleExploreLink("TSA"), /travel\/explore.*Flights%20from%20TSA/);
});

test("the search date is the first travel day when it is still ahead, otherwise tomorrow", () => {
  assert.equal(searchDate({ travelFrom: "2026-12-01" }, "2026-11-07"), "2026-12-01");
  assert.equal(searchDate({ travelFrom: "2026-10-01" }, "2026-11-07"), "2026-11-08");
  assert.equal(searchDate({ travelFrom: null }, "2026-11-07"), "2026-11-08");
});

test("a front-page link is recognised as generic, a specific page is not", () => {
  assert.equal(isGenericLink("https://www.flypeach.com/", "https://www.flypeach.com/"), true);
  assert.equal(isGenericLink("https://www.flypeach.com", null), true);
  assert.equal(isGenericLink("https://www.flypeach.com/campaign/sale2026", "https://www.flypeach.com/"), false);
  assert.equal(isGenericLink("not a url", null), false);
});
