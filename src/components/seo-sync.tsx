import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { locale } from "@/i18n";
import { pageMeta } from "@/seo/pages";

function setMeta(selector: string, attribute: string, value: string) {
  let element = document.head.querySelector<HTMLElement>(selector);
  if (!element) {
    const match = selector.match(/^(meta|link)\[(\w+)="([^"]+)"\]$/);
    if (!match) return;
    element = document.createElement(match[1]);
    element.setAttribute(match[2], match[3]);
    document.head.append(element);
  }
  element.setAttribute(attribute, value);
}

/** Keeps <head> metadata in sync after client-side navigation. */
export function SeoSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = pageMeta(pathname, locale, window.location.origin);
    const production = pageMeta(pathname, locale);
    document.title = meta.title;
    document.documentElement.lang = locale;
    setMeta('meta[name="description"]', "content", meta.description);
    setMeta('meta[property="og:title"]', "content", meta.title);
    setMeta('meta[property="og:description"]', "content", meta.description);
    setMeta('meta[property="og:url"]', "content", production.canonical);
    setMeta('meta[name="twitter:title"]', "content", meta.title);
    setMeta('meta[name="twitter:description"]', "content", meta.description);
    if (meta.found)
      setMeta('link[rel="canonical"]', "href", production.canonical);
    else document.head.querySelector('link[rel="canonical"]')?.remove();
  }, [pathname]);
  return null;
}
