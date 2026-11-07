import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../scripts/build-site.js";

async function makeRoot() {
  const root = await mkdtemp(join(tmpdir(), "site-"));
  await mkdir(join(root, "web"), { recursive: true });
  await mkdir(join(root, "data", "history"), { recursive: true });
  await writeFile(join(root, "web", "index.html"), "<html></html>");
  await writeFile(join(root, "data", "fares.json"), "{}");
  await writeFile(join(root, "data", "promos.json"), "{}");
  await writeFile(join(root, "data", "promos.manual.json"), "{}");
  await writeFile(join(root, "data", "history", "2026-11-07.json"), "[]");
  return root;
}

test("the site contains the page and only the two published data files", async () => {
  const root = await makeRoot();
  const { dist, copied } = await buildSite({ root, log() {} });
  assert.deepEqual(copied.sort(), ["fares.json", "promos.json"]);
  assert.deepEqual((await readdir(join(dist, "data"))).sort(), ["fares.json", "promos.json"]);
  assert.ok((await readdir(dist)).includes("index.html"));
});

test("a missing data file is reported and skipped instead of failing the build", async () => {
  const root = await makeRoot();
  await writeFile(join(root, "data", "fares.json"), "{}");
  const logs = [];
  const { rm } = await import("node:fs/promises");
  await rm(join(root, "data", "promos.json"));
  const { copied } = await buildSite({ root, log: (m) => logs.push(m) });
  assert.deepEqual(copied, ["fares.json"]);
  assert.ok(logs.some((m) => /promos\.json is missing/.test(m)));
});
