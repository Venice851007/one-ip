// Runtime config injected by the Worker into the page <head> (see
// public/worker/pages.js). Values come from Worker vars in wrangler.toml, so
// ads and analytics can be enabled without rebuilding the SPA.
export type AdSlotName = "home" | "ip" | "tool" | "footer";
export type SiteConfig = {
  ads: { client: string; slots: Partial<Record<AdSlotName, string>> } | null;
  analyticsToken: string | null;
};

declare global {
  interface Window {
    __SITE_CONFIG__?: SiteConfig;
    adsbygoogle?: unknown[];
  }
}

export function siteConfig(): SiteConfig {
  return (
    (typeof window !== "undefined" && window.__SITE_CONFIG__) || {
      ads: null,
      analyticsToken: null,
    }
  );
}
