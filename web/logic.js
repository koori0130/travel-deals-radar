// Pure view logic for the page. No DOM access, so it runs in the browser and in node tests.
// Assumption: one data snapshot uses a single currency, so prices are compared as numbers.

export const WINDOW_DAYS = 30;
export const TRIP_LABEL = { oneWay: "單程", roundTrip: "來回" };

/** YYYY-MM-DD in Taipei time. */
export function taipeiDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The next `count` calendar months starting from today's month: ["2026-11", ...]. */
export function monthList(today, count = 12) {
  const [y, m] = today.split("-").map(Number);
  const months = [];
  for (let i = 0; i < count; i += 1) {
    const idx = m - 1 + i;
    months.push(`${y + Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`);
  }
  return months;
}

/**
 * Lowest fare per destination for the selected origins, grouped by trip type.
 * One-way and round-trip are never ranked together.
 * Returns { oneWay: [...], roundTrip: [...] }, each sorted by price then destination.
 */
export function rankDestinations(fares, origins) {
  const best = new Map();
  for (const fare of fares) {
    if (!origins.has(fare.origin)) continue;
    const key = `${fare.tripType}|${fare.destination}`;
    const current = best.get(key);
    if (!current || fare.price < current.price || (fare.price === current.price && fare.month < current.month)) {
      best.set(key, fare);
    }
  }
  const groups = { oneWay: [], roundTrip: [] };
  for (const fare of best.values()) groups[fare.tripType]?.push(fare);
  const order = (a, b) => a.price - b.price || a.destination.localeCompare(b.destination);
  groups.oneWay.sort(order);
  groups.roundTrip.sort(order);
  return groups;
}

/** Twelve months for one destination: the lowest fare per month, or null for "no data". */
export function monthDetail(fares, { destination, origins, tripType, today }) {
  return monthList(today, 12).map((month) => {
    let best = null;
    for (const fare of fares) {
      if (fare.destination !== destination || fare.tripType !== tripType || fare.month !== month) continue;
      if (!origins.has(fare.origin)) continue;
      if (!best || fare.price < best.price) best = fare;
    }
    return { month, fare: best };
  });
}

function saleEndMs(promo) {
  return promo.saleEnd == null ? Infinity : Date.parse(promo.saleEnd);
}

/**
 * Active promotions for the selected origins that either end within 30 days, have travel dates
 * overlapping the next 30 days, or have no announced end time. Grouped by trip type, ordered by
 * price and then by nearest sale end (unknown end last).
 */
export function promoList(promos, { origins, now, airlines = new Set() }) {
  const today = taipeiDate(now);
  const windowEnd = addDays(today, WINDOW_DAYS);
  const windowEndMs = now.getTime() + WINDOW_DAYS * 86400000;
  const groups = { oneWay: [], roundTrip: [] };
  for (const promo of promos) {
    if (!origins.has(promo.origin)) continue;
    if (airlines.size > 0 && !airlines.has(promo.sourceId)) continue;
    if (promo.saleEnd != null && Date.parse(promo.saleEnd) <= now.getTime()) continue;
    const endsSoon = promo.saleEnd != null && Date.parse(promo.saleEnd) <= windowEndMs;
    const travelOverlaps =
      (promo.travelFrom != null || promo.travelTo != null) &&
      (promo.travelTo == null || promo.travelTo >= today) &&
      (promo.travelFrom == null || promo.travelFrom <= windowEnd);
    if (!(endsSoon || travelOverlaps || promo.saleEnd == null)) continue;
    groups[promo.tripType]?.push(promo);
  }
  const order = (a, b) => a.price - b.price || saleEndMs(a) - saleEndMs(b);
  groups.oneWay.sort(order);
  groups.roundTrip.sort(order);
  return groups;
}

/** Sources flagged stale, for the visible notice. */
export function staleSources(promoData) {
  return (promoData?.sources ?? []).filter((s) => s.stale);
}

export function formatPrice(price, currency) {
  return `${currency} ${Number(price).toLocaleString("en-US")}`;
}

/** Departure date used for a search link: the promo's first travel day if still ahead, else tomorrow. */
export function searchDate(promo, today) {
  return promo.travelFrom && promo.travelFrom > today ? promo.travelFrom : addDays(today, 1);
}

/** Google Flights search prefilled with route and date (one-way or round-trip is left to the visitor). */
export function googleFlightsLink(origin, destination, date) {
  const q = `Flights from ${origin} to ${destination} on ${date} one way`;
  return `https://www.google.com/travel/flights?hl=zh-TW&gl=TW&curr=TWD&q=${encodeURIComponent(q)}`;
}

/** Skyscanner Taiwan one-way search prefilled with route and date. */
export function skyscannerLink(origin, destination, date) {
  const yymmdd = date.slice(2).replace(/-/g, "");
  return `https://www.skyscanner.com.tw/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${yymmdd}/?adultsv2=1&cabinclass=economy&rtn=0`;
}

/** Google Flights "Explore": every destination from one origin, which this page cannot cover itself. */
export function googleExploreLink(origin) {
  return `https://www.google.com/travel/explore?hl=zh-TW&gl=TW&curr=TWD&q=${encodeURIComponent(`Flights from ${origin}`)}`;
}

/** True when a promo link only points at an airline's front page, with no promo or route in it. */
export function isGenericLink(url, siteUrl) {
  try {
    const u = new URL(url);
    if (siteUrl && url.replace(/\/$/, "") === siteUrl.replace(/\/$/, "")) return true;
    return u.pathname === "/" || u.pathname === "";
  } catch {
    return false;
  }
}

/** Page state kept in the URL hash so Back, refresh and shared links restore the same view. */
export function parseHash(hash) {
  const p = new URLSearchParams(String(hash).replace(/^#/, ""));
  const origins = (p.get("o") ?? "").split(",").filter((c) => ["TPE", "TSA"].includes(c));
  return {
    view: p.get("v") === "promo" ? "promo" : "year",
    origins: new Set(origins.length ? origins : ["TPE", "TSA"]),
    tripType: p.get("t") === "roundTrip" ? "roundTrip" : "oneWay",
    airlines: new Set((p.get("a") ?? "").split(",").filter(Boolean)),
  };
}

export function buildHash({ view, origins, tripType, airlines }) {
  const p = new URLSearchParams();
  p.set("v", view);
  p.set("o", [...origins].sort().join(","));
  p.set("t", tripType);
  if (airlines.size > 0) p.set("a", [...airlines].sort().join(","));
  return `#${p.toString()}`;
}

/** Only https links are ever rendered as booking links. */
export function safeUrl(url) {
  return typeof url === "string" && /^https:\/\//i.test(url) ? url : null;
}
