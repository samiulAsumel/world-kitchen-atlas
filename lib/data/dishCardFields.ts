import type { DishCardFields, DishEntry } from "@/lib/types/recipe";

/** Projects a full DishEntry down to just what DishCard renders — used
 * wherever a full dish array would otherwise ship more (e.g. full-recipe
 * steps/ingredients) to client JS than a component actually needs. */
export function toDishCardFields(dish: DishEntry): DishCardFields {
  return {
    id: dish.id,
    slug: dish.slug,
    name: dish.name,
    country: dish.country,
    countrySlug: dish.countrySlug,
    continentSlug: dish.continentSlug,
    shortDescription: dish.shortDescription,
    heroImage: dish.heroImage,
    totalTimeMinutes: dish.totalTimeMinutes,
    difficulty: dish.difficulty,
    fullRecipeAvailable: dish.fullRecipeAvailable,
    confidenceLevel: dish.confidenceLevel,
    translations: dish.translations,
  };
}
