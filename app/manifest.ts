import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// Icons rasterized from app/icon.svg's pin mark via scripts/generate-icons.mjs
// — re-run that script if the glyph or brand colors change.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "World Kitchen Atlas",
    short_name: "Kitchen Atlas",
    description:
      "A global culinary encyclopedia organized by continent, country, and dish — with history, occasion, and traditional drink pairings for every entry.",
    start_url: "/",
    display: "standalone",
    background_color: "#120e0a",
    theme_color: "#120e0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
