// Builds the fares snapshot published to the front end.

/** Stable key for a route, used in snapshots and history. */
export function routeKey(origin, destination) {
  return `${origin}-${destination}`;
}

/**
 * Merges one run's results into the previous snapshot.
 * - A route that succeeded replaces all of its earlier records.
 * - A route that failed keeps its earlier records, marked stale, with the old updatedAt.
 * results: [{ origin, destination, records?: FareRecord[], error?: string }]
 */
export function mergeSnapshot({ previous, results, now, source }) {
  const nowIso = now.toISOString();
  const previousByRoute = new Map();
  for (const fare of previous?.fares ?? []) {
    const key = routeKey(fare.origin, fare.destination);
    if (!previousByRoute.has(key)) previousByRoute.set(key, []);
    previousByRoute.get(key).push(fare);
  }

  const fares = [];
  const failures = [];
  for (const result of results) {
    const key = routeKey(result.origin, result.destination);
    if (result.error) {
      failures.push({ origin: result.origin, destination: result.destination, error: result.error });
      for (const old of previousByRoute.get(key) ?? []) fares.push({ ...old, stale: true });
    } else {
      for (const record of result.records ?? []) {
        fares.push({ ...record, stale: false, updatedAt: nowIso });
      }
    }
  }

  return {
    snapshot: { generatedAt: nowIso, source, fares },
    failures,
  };
}
