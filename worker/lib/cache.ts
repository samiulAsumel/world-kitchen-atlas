// Content-addressed KV cache for the public read routes (worker/routes/public.ts).
//
// Cache keys hash the git sha(s) of the recipe file(s) a payload is built from,
// not a fixed cache name — so a key changes exactly when the underlying data
// changes, and never otherwise. That means: no TTL-driven staleness window (a
// build immediately after a recipe push always sees the new data), and no
// explicit invalidation step needed when data changes — the old key is simply
// never requested again. expirationTtl below only garbage-collects those
// superseded keys; it does not bound freshness.
//
// Every payload is cached and returned as an already-serialized JSON string,
// never parsed back into an object on the hit path — re-parsing/re-stringifying
// the ~7MB merged dataset on every request is expensive enough on its own to
// risk hitting the Worker's CPU limit under concurrent load (the likely cause
// of the 502s that broke a production deploy — see git history).

import type { Dish, Env } from "../types";
import { fetchCountryFile, fetchCountryFileRaw, fromBase64Utf8, gh, listCountryFilesWithSha } from "./github";
import { sha256Hex } from "./crypto";
import { DIR, BRANCH } from "../types";

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days; see file header re: this not being a freshness bound.

async function cacheKey(prefix: string, parts: string[]): Promise<string> {
  // Sorted so key order never affects the hash (file listing order isn't guaranteed).
  const hash = await sha256Hex([...parts].sort().join("|"));
  return `${prefix}:v1:${hash}`;
}

/** Merged /dishes payload, pre-serialized. Populates and reuses a single shared cache entry. */
export async function getDishesPayload(env: Env): Promise<string> {
  const files = await listCountryFilesWithSha(env);
  const key = await cacheKey(
    "dishes",
    files.map((f) => `${f.name}@${f.sha}`),
  );

  const cached = await env.DATA_CACHE.get(key, "text");
  if (cached !== null) return cached;

  const perFile = await Promise.all(files.map((f) => fetchCountryFile(env, f.name)));
  const payload = JSON.stringify(perFile.flat());
  await env.DATA_CACHE.put(key, payload, { expirationTtl: CACHE_TTL_SECONDS });
  return payload;
}

/** Country-summary payload for GET / (handleRoot), derived from getDishesPayload. */
export async function getCountriesPayload(env: Env): Promise<string> {
  const files = await listCountryFilesWithSha(env);
  const key = await cacheKey(
    "countries",
    files.map((f) => `${f.name}@${f.sha}`),
  );

  const cached = await env.DATA_CACHE.get(key, "text");
  if (cached !== null) return cached;

  const dishes = JSON.parse(await getDishesPayload(env)) as Dish[];
  const bySlug = new Map<
    string,
    { slug: string; name: string; continentSlug: string; dishCount: number }
  >();
  for (const dish of dishes) {
    const existing = bySlug.get(dish.countrySlug);
    if (existing) {
      existing.dishCount += 1;
    } else {
      bySlug.set(dish.countrySlug, {
        slug: dish.countrySlug,
        name: dish.country,
        continentSlug: dish.continentSlug,
        dishCount: 1,
      });
    }
  }
  const payload = JSON.stringify({ countries: [...bySlug.values()] });
  await env.DATA_CACHE.put(key, payload, { expirationTtl: CACHE_TTL_SECONDS });
  return payload;
}

export type CountryPayloadResult =
  | { status: "ok"; payload: string; sha: string }
  | { status: "not_found" };

/**
 * Single country's payload for GET /countries/{slug}, keyed by just that file's sha —
 * unaffected by other countries changing. Skips JSON.parse/stringify on both the hit
 * and miss paths: a recipe file's raw content (once base64-decoded, or fetched via the
 * raw media type for files over GitHub's 1MB inline-content limit) already *is* the
 * exact JSON text this endpoint returns.
 */
export async function getCountryPayload(env: Env, slug: string): Promise<CountryPayloadResult> {
  const metaRes = await gh(env, `contents/${DIR}/${slug}.json?ref=${BRANCH}`);
  if (metaRes.status === 404) return { status: "not_found" };
  if (!metaRes.ok) {
    throw new Error(`failed to read ${slug}.json: ${metaRes.status}`);
  }
  const meta = (await metaRes.json()) as { content?: string; sha: string };
  const key = await cacheKey("country", [`${slug}@${meta.sha}`]);

  const cached = await env.DATA_CACHE.get(key, "text");
  if (cached !== null) return { status: "ok", payload: cached, sha: meta.sha };

  const payload = meta.content
    ? fromBase64Utf8(meta.content)
    : await fetchCountryFileRaw(env, `${slug}.json`);
  await env.DATA_CACHE.put(key, payload, { expirationTtl: CACHE_TTL_SECONDS });
  return { status: "ok", payload, sha: meta.sha };
}
