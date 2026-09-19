/** Canonical production URL, no trailing slash. Single source of truth for
 * metadataBase, canonical links, sitemap.xml, robots.txt, and llms.txt. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "Between Words";
export const SITE_DESCRIPTION =
  "A party game of related secret words and social deduction. Play face-to-face or in a private online room.";
