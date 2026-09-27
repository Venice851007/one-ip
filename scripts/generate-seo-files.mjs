// Regenerates public/sitemap.xml from src/seo/pages.ts.
// Run after changing routes or the site origin: pnpm seo:generate
import { writeFileSync } from "node:fs";
import { sitemapXml } from "../src/seo/pages.ts";

writeFileSync(new URL("../public/sitemap.xml", import.meta.url), sitemapXml());
console.log("public/sitemap.xml updated");
