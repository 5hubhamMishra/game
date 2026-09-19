import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only stable, public, stateless routes. Never /local/play or /room/[code]
// -- those hold live per-session game state, not indexable content.
const PUBLIC_ROUTES = ["/", "/local", "/online", "/how-to-play", "/about", "/contact", "/privacy", "/developers"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
