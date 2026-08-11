export const CONTINENTS = [
  { slug: "asia", name: "Asia" },
  { slug: "europe", name: "Europe" },
  { slug: "africa", name: "Africa" },
  { slug: "americas", name: "Americas" },
  { slug: "oceania", name: "Oceania" },
] as const;

export const MEAL_TIMES = [
  { slug: "breakfast", name: "Breakfast" },
  { slug: "lunch", name: "Lunch" },
  { slug: "dinner", name: "Dinner" },
  { slug: "snacks", name: "Snacks" },
  { slug: "dessert", name: "Dessert" },
  { slug: "drinks", name: "Drinks" },
] as const;

// Hand-picked for the homepage's featured-dishes section — curated for visual
// range (biryani, a whole roast, grilled, a dosa, two contrasting desserts,
// street food) across all three live countries, not just "biggest photo".
// Order is preserved as-is (DishGrid's preserveOrder) rather than A-Z sorted.
export const FEATURED_DISH_SLUGS: { countrySlug: string; slug: string }[] = [
  { countrySlug: "pakistan", slug: "karachi-biryani" },
  { countrySlug: "india", slug: "hyderabadi-biryani" },
  { countrySlug: "pakistan", slug: "sajji" },
  { countrySlug: "india", slug: "masala-dosa" },
  { countrySlug: "bangladesh", slug: "fuchka" },
  { countrySlug: "pakistan", slug: "chicken-tikka" },
  { countrySlug: "india", slug: "gulab-jamun" },
  { countrySlug: "bangladesh", slug: "rasgulla" },
] as const;

export const OCCASIONS = [
  { slug: "street-food", name: "Street Food" },
  { slug: "festival-food", name: "Festival Food" },
] as const;

export const DIETARY_FLAGS = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "glutenFree", label: "Gluten-Free" },
  { key: "dairyFree", label: "Dairy-Free" },
  { key: "eggFree", label: "Egg-Free" },
  { key: "nutFree", label: "Nut-Free" },
  { key: "lowCarb", label: "Low-Carb" },
  { key: "highProtein", label: "High-Protein" },
] as const;

export type ContinentSlug = (typeof CONTINENTS)[number]["slug"];

export function isContinentSlug(value: string): value is ContinentSlug {
  return CONTINENTS.some((continent) => continent.slug === value);
}

// Sentinel path segment for generateStaticParams() when the data source has zero
// entries. Next.js fails the entire `output: 'export'` build if a dynamic route's
// generateStaticParams() returns [] (vercel/next.js#71862, unresolved as of 16.2.12)
// — a leading underscore guarantees this never collides with a real slug, which
// the worker restricts to ^[a-z0-9-]+$. The page itself still 404s on this slug.
export const EMPTY_STATIC_PARAM = "_empty";
