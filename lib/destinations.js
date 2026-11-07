import { readFile } from "node:fs/promises";

const IATA = /^[A-Z]{3}$/;

export function isIata(code) {
  return typeof code === "string" && IATA.test(code);
}

/**
 * Validates the destination configuration and returns it.
 * Throws before any price query when a code is not a three-letter airport code.
 */
export function validateDestinationConfig(config) {
  const problems = [];
  const check = (list, label) => {
    if (!Array.isArray(list) || list.length === 0) {
      problems.push(`${label} must be a non-empty list`);
      return;
    }
    for (const code of list) {
      if (!isIata(code)) problems.push(`${label}: invalid airport code ${JSON.stringify(code)}`);
    }
  };
  check(config.origins, "origins");
  check(config.destinations, "destinations");
  if (Array.isArray(config.origins) && Array.isArray(config.destinations)) {
    const overlap = config.destinations.filter((d) => config.origins.includes(d));
    for (const code of overlap) problems.push(`destinations: ${code} is also an origin`);
  }
  if (problems.length > 0) {
    throw new Error(`Invalid destination config:\n- ${problems.join("\n- ")}`);
  }
  return config;
}

/** Every origin x destination pair, in configuration order. */
export function routesFrom(config) {
  const routes = [];
  for (const origin of config.origins) {
    for (const destination of config.destinations) routes.push({ origin, destination });
  }
  return routes;
}

export async function loadDestinationConfig(path) {
  const raw = JSON.parse(await readFile(path, "utf8"));
  return validateDestinationConfig(raw);
}
