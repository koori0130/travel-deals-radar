// Standard fare record shared by every price adapter and the snapshot writer.

export const TRIP_TYPES = ["oneWay", "roundTrip"];

/**
 * Builds a fare record. Throws when a required field is missing so adapters can
 * never emit a record without trip type or tax information.
 */
export function makeFareRecord({
  origin,
  destination,
  month,
  departureDate,
  price,
  currency,
  tripType,
  taxIncluded,
  bookingUrl,
}) {
  if (!TRIP_TYPES.includes(tripType)) {
    throw new Error(`tripType must be one of ${TRIP_TYPES.join(", ")}`);
  }
  if (typeof taxIncluded !== "boolean") {
    throw new Error("taxIncluded must be a boolean");
  }
  if (!(price >= 0) || !currency) {
    throw new Error("price and currency are required");
  }
  return {
    origin,
    destination,
    month,
    departureDate: departureDate ?? null,
    price,
    currency,
    tripType,
    taxIncluded,
    bookingUrl: bookingUrl ?? null,
    stale: false,
    updatedAt: null,
  };
}

/** A non-affiliate link-out so visitors can check and book the fare themselves. */
export function searchLink(origin, destination, departureDate) {
  const q = `Flights from ${origin} to ${destination} on ${departureDate} one way`;
  return `https://www.google.com/travel/flights?hl=zh-TW&q=${encodeURIComponent(q)}`;
}
