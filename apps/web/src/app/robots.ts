import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Room codes and an in-progress local game hold live, private,
      // per-session state -- never indexable. The BFF routes are internal
      // helpers for this site's own client, not a public API.
      disallow: ["/room/", "/local/play", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
