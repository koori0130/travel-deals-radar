import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadDestinationConfig, routesFrom, validateDestinationConfig } from "../lib/destinations.js";

test("the shipped destination config is valid and covers both Taipei airports", async () => {
  const path = fileURLToPath(new URL("../config/destinations.json", import.meta.url));
  const config = await loadDestinationConfig(path);
  assert.deepEqual(config.origins, ["TPE", "TSA"]);
  assert.ok(config.destinations.length >= 30 && config.destinations.length <= 50);
});

test("adding a destination yields routes from both TPE and TSA", () => {
  const config = validateDestinationConfig({ origins: ["TPE", "TSA"], destinations: ["NRT", "LHR"] });
  const routes = routesFrom(config).filter((r) => r.destination === "LHR");
  assert.deepEqual(routes.map((r) => r.origin), ["TPE", "TSA"]);
});

test("an invalid code fails before any query and names the bad entry", () => {
  assert.throws(
    () => validateDestinationConfig({ origins: ["TPE"], destinations: ["NRT", "Tokyo", "kix"] }),
    (err) => /"Tokyo"/.test(err.message) && /"kix"/.test(err.message),
  );
});

test("a destination equal to an origin is rejected", () => {
  assert.throws(() => validateDestinationConfig({ origins: ["TPE"], destinations: ["TPE"] }), /also an origin/);
});
