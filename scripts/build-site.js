// Assembles the static site into dist/: the web/ folder plus the two published data files.
// Usage: node scripts/build-site.js
// History, manual promo store and config are never copied, so nothing private reaches the site.

import { cp, mkdir, rm, copyFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLISHED_DATA = ["fares.json", "promos.json"];

export async function buildSite({ root = ROOT, log = console.log } = {}) {
  const dist = join(root, "dist");
  await rm(dist, { recursive: true, force: true });
  await mkdir(join(dist, "data"), { recursive: true });
  await cp(join(root, "web"), dist, { recursive: true, filter: (src) => !src.endsWith(".gitkeep") });

  const copied = [];
  for (const name of PUBLISHED_DATA) {
    try {
      await access(join(root, "data", name));
    } catch {
      log(`warn: data/${name} is missing; the page will show a load-failure message for it`);
      continue;
    }
    await copyFile(join(root, "data", name), join(dist, "data", name));
    copied.push(name);
  }
  return { dist, copied };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { dist, copied } = await buildSite();
  console.log(`site built in ${dist} with data: ${copied.length ? copied.join(", ") : "none"}`);
}
