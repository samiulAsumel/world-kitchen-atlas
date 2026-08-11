import { getDataApiUrl } from "@/lib/env";
import type { ContinentSlug } from "@/lib/constants";
import type { CountrySummary, DishEntry } from "@/lib/types/recipe";

export class DataSourceError extends Error {
  constructor(endpoint: string, status: number, body: string) {
    super(`Data API request to ${endpoint} failed with status ${status}: ${body}`);
    this.name = "DataSourceError";
  }
}

// A transient upstream blip (the Worker cold-starting, a GitHub API hiccup on
// a cache miss, ...) must not take down an entire deploy — see git history for
// the incident where a single 502 on this endpoint failed a build and left
// production silently serving a stale deploy. 4 attempts, ~1s/3s/9s backoff.
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 20_000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(endpoint: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.ok) return res;
      if (!isRetryableStatus(res.status) || attempt === MAX_ATTEMPTS) return res;
      lastError = new DataSourceError(endpoint, res.status, await res.text());
    } catch (err) {
      // Network error or timeout — also retryable.
      if (attempt === MAX_ATTEMPTS) throw err;
      lastError = err;
    }
    await sleep(BASE_DELAY_MS * 3 ** (attempt - 1));
  }

  // Unreachable given the loop above always returns or throws on the final
  // attempt, but keeps the function's return type honest for TypeScript.
  throw lastError;
}

// Memoised so a single `next build` hits the Worker's /dishes endpoint once,
// not once per generateStaticParams call across continent/country/dish routes.
let dishesPromise: Promise<DishEntry[]> | null = null;

async function fetchAllDishes(): Promise<DishEntry[]> {
  const endpoint = `${getDataApiUrl()}/dishes`;
  const res = await fetchWithRetry(endpoint);
  if (!res.ok) {
    throw new DataSourceError(endpoint, res.status, await res.text());
  }
  return (await res.json()) as DishEntry[];
}

export function getAllDishes(): Promise<DishEntry[]> {
  if (!dishesPromise) {
    // Clear the memo on failure — a rejected promise otherwise stays cached
    // for the rest of the process, permanently failing every subsequent call.
    dishesPromise = fetchAllDishes().catch((err) => {
      dishesPromise = null;
      throw err;
    });
  }
  return dishesPromise;
}

export async function getCountries(): Promise<CountrySummary[]> {
  const dishes = await getAllDishes();
  const bySlug = new Map<string, CountrySummary>();

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

  return [...bySlug.values()];
}

export async function getCountriesByContinent(
  continentSlug: ContinentSlug,
): Promise<CountrySummary[]> {
  const countries = await getCountries();
  return countries.filter((country) => country.continentSlug === continentSlug);
}

export async function getDishesByCountry(countrySlug: string): Promise<DishEntry[]> {
  const dishes = await getAllDishes();
  return dishes.filter((dish) => dish.countrySlug === countrySlug);
}

export async function getDish(
  countrySlug: string,
  dishSlug: string,
): Promise<DishEntry | undefined> {
  const dishes = await getDishesByCountry(countrySlug);
  return dishes.find((dish) => dish.slug === dishSlug);
}
