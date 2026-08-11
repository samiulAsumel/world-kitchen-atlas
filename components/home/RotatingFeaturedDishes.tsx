"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DishGrid } from "@/components/dish/DishGrid";
import { getLocaleFromPathname } from "@/lib/i18n";
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
  const [featured, setFeatured] = useState(initialDishes);
  const pausedRef = useRef(false);

  useEffect(() => {
    // WCAG 2.2.2 "Pause, Stop, Hide" — content that auto-updates for more
    // than 5s must be stoppable. Honoring reduced-motion by skipping the
    // rotation entirely (not just softening the CSS transition, which
    // app/globals.css already does) is the cleanest way to satisfy that.
    // Nothing meaningful to rotate into if the pool isn't bigger than what's
    // already shown.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (pool.length <= count) return;

    const id = window.setInterval(() => {
      if (pausedRef.current || document.hidden) return;
      setFeatured(sampleRandom(pool, count));
    }, intervalMs);

    return () => window.clearInterval(id);
    // pool/count/intervalMs are the homepage's static inputs, not expected to
    // change after mount — deliberately run this effect once, not per-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (featured.length === 0) return null;

  return (
    <section
      aria-labelledby="featured-heading"
      className="flex flex-col gap-6"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onFocus={() => (pausedRef.current = true)}
      onBlur={() => (pausedRef.current = false)}
    >
      <h2 id="featured-heading" className="font-display text-2xl text-ink">
        {heading}
      </h2>
      {/* No aria-live: announcing a silent content refresh to screen readers
          every 13s would be far more disruptive than saying nothing. */}
      <DishGrid dishes={featured} locale={locale} preserveOrder />
    </section>
  );
}
