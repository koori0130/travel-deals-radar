// Price source adapter for Ignav's cheapest-dates endpoint.
// Adapter interface: getMonthlyLowest({ origin, destination, today, months })
//   -> Promise<FareRecord[]> with at most one record per month, one-way fares only.
// Based on the public Ignav docs; verify against a live key before relying on it.

import { monthWindows } from "../dates.js";
import { makeFareRecord, searchLink } from "../fare-record.js";

export const IGNAV_KEY_ENV = "IGNAV_API_KEY";
const ENDPOINT = "https://ignav.com/api/fares/cheapest-dates";

export function createIgnavAdapter({ apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) {
    throw new Error(`Missing environment variable ${IGNAV_KEY_ENV}`);
  }

  async function queryWindow(origin, destination, window) {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        departure_date_range: { start: window.start, end: window.end },
      }),
    });
    if (!response.ok) {
      throw new Error(`Ignav ${origin}-${destination} ${window.month}: HTTP ${response.status}`);
    }
    return response.json();
  }

  return {
    name: "ignav",
    async getMonthlyLowest({ origin, destination, today, months = 12 }) {
      const records = [];
      for (const window of monthWindows(today, months)) {
        const body = await queryWindow(origin, destination, window);
        let best = null;
        for (const entry of body.dates ?? []) {
          const amount = entry?.price?.amount;
          if (amount == null) continue;
          const value = Number(amount);
          if (!Number.isFinite(value)) continue;
          if (!best || value < best.value) {
            best = { value, currency: entry.price.currency, date: entry.departure_date };
          }
        }
        if (best) {
          records.push(
            makeFareRecord({
              origin,
              destination,
              month: window.month,
              departureDate: best.date,
              price: best.value,
              currency: best.currency,
              tripType: "oneWay",
              taxIncluded: true,
              bookingUrl: searchLink(origin, destination, best.date),
            }),
          );
        }
      }
      return records;
    },
  };
}
