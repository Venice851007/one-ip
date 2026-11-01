import { geoFallback } from "./geo-sources.js";
import { publicIp } from "./http.js";
import en from "../../src/i18n/en.json" with { type: "json" };
import legacyRoutes from "../../src/layout/legacy-routes.json" with { type: "json" };
import {
  bodyHtml,
  headHtml,
  localeFromSearch,
  pageMeta,
} from "../../src/seo/pages.ts";
import site from "../../src/seo/site.json" with { type: "json" };

const legacyPatterns = Object.keys(legacyRoutes).map(
  (path) =>
    new RegExp(`^${path.replace(/[.]/g, "\\.").replace(/:ip/, "[^/]+")}/?$`),
);

/** Extension-less GET/HEAD paths are SPA pages; files and Vite internals pass through. */
export function isPagePath(url, request) {
  if (!["GET", "HEAD"].includes(request.method)) return false;
  const path = url.pathname;
  if (path.startsWith("/@") || path.startsWith("/node_modules/")) return false;
  // A file has an extension that starts with a letter; "/network/ip/1.1.1.1" is a page.
  const last = path.split("/").pop() ?? "";
  return !/\.[a-z][a-z0-9]{0,7}$/i.test(last);
}

export function isLegacyPath(pathname) {
  return legacyPatterns.some((pattern) => pattern.test(pathname));
}

const publisher = (client) => client.replace(/^ca-/, "");

/** Public, non-secret runtime config exposed to the SPA. Invalid values are ignored. */
export function siteConfig(env) {
  const client = env.ADSENSE_CLIENT?.trim();
  const slot = (value) =>
    typeof value === "string" && /^\d{5,20}$/.test(value.trim())
      ? value.trim()
      : undefined;
  const ads =
    client && /^ca-pub-\d{10,20}$/.test(client)
      ? {
          client,
          slots: {
            home: slot(env.ADSENSE_SLOT_HOME),
            ip: slot(env.ADSENSE_SLOT_IP),
            tool: slot(env.ADSENSE_SLOT_TOOL),
            footer: slot(env.ADSENSE_SLOT_FOOTER),
          },
        }
      : null;
  const token = env.CF_WEB_ANALYTICS_TOKEN?.trim();
  return {
    ads,
    analyticsToken: token && /^[0-9a-f]{32}$/i.test(token) ? token : null,
  };
}

export function adsTxt(env) {
  const { ads } = siteConfig(env);
  if (!ads) return new Response("Not found", { status: 404 });
  return new Response(
    `google.com, ${publisher(ads.client)}, DIRECT, f08c47fec0942fa0\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}

function configHtml(env) {
  const config = siteConfig(env);
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  let html = `<script>window.__SITE_CONFIG__=${json}</script>`;
  if (config.analyticsToken)
    html += `\n  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${config.analyticsToken}"}'></script>`;
  return html;
}

// #root reserves the first viewport so the crawlable article below never causes layout shift.
const contentStyle = `<style>#root{min-height:100vh}#seo-content{max-width:860px;margin:0 auto;padding:32px 20px 48px;font:14px/1.75 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#525252}#seo-content h2{font-size:20px;color:#171717;margin:0 0 12px}#seo-content h3{font-size:16px;color:#262626;margin:20px 0 8px}#seo-content h4{font-size:14px;margin:12px 0 4px;color:#262626}#seo-content a{color:#2563eb}#seo-content nav ol{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:6px;font-size:12px}#seo-content nav li+li:before{content:"/";margin-right:6px;color:#a3a3a3}#seo-content ul{display:flex;flex-wrap:wrap;gap:8px 16px;padding-left:18px}#seo-content dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px}#seo-content dt{color:#737373}#seo-content dd{margin:0;color:#171717}.dark #seo-content{color:#a3a3a3}.dark #seo-content h2,.dark #seo-content h3,.dark #seo-content h4,.dark #seo-content dd{color:#e5e5e5}.dark #seo-content a{color:#60a5fa}</style>`;

/** Server-side IP summary for /network/ip/<ip> pages; never blocks the page for long. */
async function ipContext(meta, env) {
  const match = meta.path.match(/^\/network\/ip\/([^/]+)$/);
  if (!match || !meta.found) return undefined;
  let value;
  try {
    value = publicIp(decodeURIComponent(match[1]));
  } catch {
    return { value: decodeURIComponent(match[1]), summary: null };
  }
  const summary = await Promise.race([
    geoFallback(value, env).catch(() => null),
    new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
  ]);
  return { value, summary };
}

export async function pageBody(url, env) {
  const locale = localeFromSearch(url.search);
  const origin = env.LOCAL_DEV === "true" ? url.origin : site.origin;
  const meta = pageMeta(url.pathname, locale, origin);
  return bodyHtml(meta, origin, await ipContext(meta, env));
}

export function pageHead(url, env) {
  const locale = localeFromSearch(url.search);
  const origin = env.LOCAL_DEV === "true" ? url.origin : site.origin;
  const meta = pageMeta(url.pathname, locale, origin);
  const translate = (text) => (locale === "en" ? (en[text] ?? text) : text);
  return {
    meta,
    html: `${headHtml(meta, translate, origin)}\n  ${contentStyle}\n  ${configHtml(env)}\n`,
  };
}

/** String fallback for runtimes without HTMLRewriter (Node tests). */
export function injectHead(source, url, env) {
  const { meta, html } = pageHead(url, env);
  return {
    meta,
    html: source
      .replace(/<html lang="[^"]*"/, `<html lang="${meta.locale}"`)
      .replace(/\s*<title>[\s\S]*?<\/title>/, "")
      .replace(/\s*<meta name="description"[^>]*>/, "")
      .replace("</head>", `  ${html}</head>`),
  };
}

export async function renderPage(response, url, env) {
  const type = response.headers.get("Content-Type") ?? "";
  if (!type.includes("text/html") || isLegacyPath(url.pathname))
    return response;
  const headers = new Headers(response.headers);
  headers.delete("ETag");
  headers.delete("Content-Length");
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  if (typeof HTMLRewriter === "undefined") {
    const { meta, html } = injectHead(await response.text(), url, env);
    const body = await pageBody(url, env);
    return new Response(html.replace("</body>", `${body}\n</body>`), {
      status: meta.found ? response.status : 404,
      headers,
    });
  }
  const { meta, html } = pageHead(url, env);
  const body = await pageBody(url, env);
  const remove = { element: (element) => element.remove() };
  const rewritten = new HTMLRewriter()
    .on("html", {
      element: (element) => element.setAttribute("lang", meta.locale),
    })
    .on("head > title", remove)
    .on('head > meta[name="description"]', remove)
    .on("head", { element: (element) => element.append(html, { html: true }) })
    .on("body", { element: (element) => element.append(body, { html: true }) })
    .transform(response);
  return new Response(rewritten.body, {
    status: meta.found ? response.status : 404,
    headers,
  });
}
