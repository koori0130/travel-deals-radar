// Normalized airline promotion records, expiry, and source freshness.

import { isIata } from "./destinations.js";
import { TRIP_TYPES } from "./fare-record.js";

export const PROMO_ORIGINS = ["TPE", "TSA"];
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a sale start or end time. A bare date means start of day or end of day in Taipei.
 * Returns an ISO string in UTC, or null when the value is missing. Never invents a time.
 */
export function parseSaleTime(value, edge) {
  if (value == null || value === "") return null;
  let text = String(value).trim();
  if (DATE_ONLY.test(text)) {
    text = edge === "end" ? `${text}T23:59:59+08:00` : `${text}T00:00:00+08:00`;
  }
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) throw new Error(`Invalid sale time: ${JSON.stringify(value)}`);
  return new Date(ms).toISOString();
}

function dateOrNull(value, label) {
  if (value == null || value === "") return null;
  if (!DATE_ONLY.test(String(value))) throw new Error(`${label} must be YYYY-MM-DD`);
  return String(value);
}

/**
 * Converts a raw promotion into the standard record.
 * Throws when a required field is missing, so bad input is never published.
 */
export function normalizePromo(raw, { sourceId, airline, fetchedAt, manual = false }) {
  const price = Number(raw.price);
  if (!PROMO_ORIGINS.includes(raw.origin)) throw new Error(`origin must be one of ${PROMO_ORIGINS.join(", ")}`);
  if (!isIata(raw.destination)) throw new Error("destination must be a three-letter airport code");
  if (!Number.isFinite(price) || price < 0) throw new Error("price must be a non-negative number");
  if (!raw.currency) throw new Error("currency is required");
  if (!TRIP_TYPES.includes(raw.tripType)) throw new Error(`tripType must be one of ${TRIP_TYPES.join(", ")}`);
  if (typeof raw.taxIncluded !== "boolean") throw new Error("taxIncluded must be true or false");
  if (!raw.sourceUrl) throw new Error("sourceUrl is required");

  return {
    airline,
    sourceId,
    origin: raw.origin,
    destination: raw.destination,
    price,
    currency: raw.currency,
    tripType: raw.tripType,
    taxIncluded: raw.taxIncluded,
    travelFrom: dateOrNull(raw.travelFrom, "travelFrom"),
    travelTo: dateOrNull(raw.travelTo, "travelTo"),
    saleStart: parseSaleTime(raw.saleStart, "start"),
    saleEnd: parseSaleTime(raw.saleEnd, "end"),
    sourceUrl: raw.sourceUrl,
    fetchedAt,
    manual,
  };
}

/** A promotion is active until its sale end time passes. Unknown end time stays active. */
export function isActive(promo, now) {
  if (promo.saleEnd == null) return true;
  return Date.parse(promo.saleEnd) > now.getTime();
}

export function activePromos(promos, now) {
  return promos.filter((p) => isActive(p, now));
}

/**
 * Freshness of one source. A source with no successful update is stale.
 * Returns { lastSuccessAt, stale }.
 */
export function sourceFreshness({ lastSuccessAt, now, staleAfterDays }) {
  if (!lastSuccessAt) return { lastSuccessAt: null, stale: true };
  const ageMs = now.getTime() - Date.parse(lastSuccessAt);
  return { lastSuccessAt, stale: ageMs > staleAfterDays * 86400000 };
}
