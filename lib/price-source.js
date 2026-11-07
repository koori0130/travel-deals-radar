import { createIgnavAdapter, IGNAV_KEY_ENV } from "./adapters/ignav.js";

/** Builds the configured price adapter. Throws naming the missing environment variable. */
export function createPriceAdapter(name, env, fetchImpl) {
  switch (name) {
    case "ignav": {
      const apiKey = env[IGNAV_KEY_ENV];
      if (!apiKey) throw new Error(`Missing environment variable ${IGNAV_KEY_ENV}`);
      return createIgnavAdapter({ apiKey, fetchImpl });
    }
    default:
      throw new Error(`Unknown price source: ${name}`);
  }
}
