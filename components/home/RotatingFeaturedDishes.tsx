"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DishGrid } from "@/components/dish/DishGrid";
import { Button } from "@/components/ui/Button";
import { getDictionary, getLocaleFromPathname } from "@/lib/i18n";
import type { DishCardFields } from "@/lib/types/recipe";

interface RotatingFeaturedDishesProps {
  heading: string;
  /** Shown on first paint (server-rendered and client's first render must
   * match exactly, or React flags a hydration mismatch) — the random swap
   * only ever happens inside useEffect, which never runs during SSR/build. */
  initialDishes: DishCardFields[];
  /** Every dish eligible for rotation — every dish with a photo, so a newly
   * added recipe becomes rotation-eligible automatically, no code change. */
  pool: DishCardFields[];
  count?: number;
  intervalMs?: number;
}

/** Proper partial Fisher-Yates — not the common but statistically biased
 * `array.sort(() => Math.random() - 0.5)` shuffle trick. */
function sampleRandom<T>(pool: readonly T[], count: number): T[] {
  const copy = [...pool];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export function RotatingFeaturedDishes({
  heading,
  initialDishes,
  pool,
  count = 8,
  intervalMs = 13000,
}: RotatingFeaturedDishesProps): React.JSX.Element | null {
  const locale = getLocaleFromPathname(usePathname());
  const dict = getDictionary(locale);
  const [featured, setFeatured] = useState(initialDishes);
  // Explicit user pause (the button below) — WCAG 2.2.2 "Pause, Stop, Hide"
  // wants a real, visible control for this, for every visitor, not just
  // reduced-motion ones. Reduced-motion itself is handled separately, below.
  const [userPaused, setUserPaused] = useState(false);
  // Hover/focus is a courtesy auto-pause, not a user decision — kept out of
  // state (a ref) so mouse movement doesn't trigger re-renders.
  const hoverPausedRef = useRef(false);

  useEffect(() => {
    if (userPaused) return;
    if (pool.length <= count) return; // nothing meaningful to rotate into

    const id = window.setInterval(() => {
      if (hoverPausedRef.current || document.hidden) return;
      setFeatured(sampleRandom(pool, count));
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [userPaused, pool, count, intervalMs]);

  if (featured.length === 0) return null;

  const canRotate = pool.length > count;

  return (
    <section
      aria-labelledby="featured-heading"
      className="flex flex-col gap-6"
      onMouseEnter={() => (hoverPausedRef.current = true)}
      onMouseLeave={() => (hoverPausedRef.current = false)}
      onFocus={() => (hoverPausedRef.current = true)}
      onBlur={() => (hoverPausedRef.current = false)}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="featured-heading" className="font-display text-2xl text-ink">
          {heading}
        </h2>
        {/* Reduced-motion visitors still get rotation (just an instant swap —
            app/globals.css already collapses the fade-up animation to ~0 for
            them) rather than losing the feature outright; this button is
            what actually satisfies "Pause, Stop, Hide" for everyone. */}
        {canRotate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUserPaused((prev) => !prev)}
            aria-pressed={userPaused}
          >
            {userPaused ? dict.home.resumeRotation : dict.home.pauseRotation}
          </Button>
        )}
      </div>
      {/* No aria-live: announcing a silent content refresh to screen readers
          every 13s would be far more disruptive than saying nothing. */}
      <DishGrid dishes={featured} locale={locale} preserveOrder />
    </section>
  );
}
