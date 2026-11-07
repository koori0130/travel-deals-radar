// Promo source configuration and the terms-of-use gate for automated page fetching.

import { readFile } from "node:fs/promises";

export const METHODS = ["manual", "feed", "page"];

export function validatePromoSources(config) {
  const problems = [];
  if (!Number.isInteger(config.staleAfterDays) || config.staleAfterDays < 1) {
    problems.push("staleAfterDays must be a positive integer");
  }
  const ids = new Set();
  for (const source of config.sources ?? []) {
    if (!source.id) problems.push("a source is missing id");
    if (ids.has(source.id)) problems.push(`duplicate source id ${source.id}`);
    ids.add(source.id);
    if (!METHODS.includes(source.method)) problems.push(`${source.id}: method must be one of ${METHODS.join(", ")}`);
    if (typeof source.termsReviewed !== "boolean") problems.push(`${source.id}: termsReviewed must be true or false`);
    if (typeof source.termsAllowFetch !== "boolean") problems.push(`${source.id}: termsAllowFetch must be true or false`);
    if (source.termsAllowFetch === true && source.termsReviewed !== true) {
      problems.push(`${source.id}: termsAllowFetch cannot be true unless termsReviewed is true`);
    }
    if (!source.airline) problems.push(`${source.id}: airline is required`);
  }
  if (problems.length > 0) throw new Error(`Invalid promo source config:\n- ${problems.join("\n- ")}`);
  return config;
}

export async function loadPromoSources(path) {
  return validatePromoSources(JSON.parse(await readFile(path, "utf8")));
}

/**
 * Terms gate: a page source may be fetched automatically only after its terms were reviewed
 * and the review found that they allow it.
 * Returns { allowed: true } or { allowed: false, reason }.
 */
export function checkPageFetchAllowed(source) {
  if (source.method !== "page") return { allowed: true };
  if (source.termsReviewed !== true) {
    return {
      allowed: false,
      reason: `${source.id}: terms of use have not been reviewed; use an official feed or manual entry`,
    };
  }
  if (source.termsAllowFetch !== true) {
    return {
      allowed: false,
      reason: `${source.id}: terms of use do not allow automated fetching; use an official feed or manual entry`,
    };
  }
  return { allowed: true };
}
