import en from "../../src/i18n/en.json" with { type: "json" };
import legacyRoutes from "../../src/layout/legacy-routes.json" with { type: "json" };
import { headHtml, localeFromSearch, pageMeta } from "../../src/seo/pages.ts";
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

export function pageHead(url, env) {
  const locale = localeFromSearch(url.search);
  const origin = env.LOCAL_DEV === "true" ? url.origin : site.origin;
  const meta = pageMeta(url.pathname, locale, origin);
  const translate = (text) => (locale === "en" ? (en[text] ?? text) : text);
  return {
    meta,
    html: `${headHtml(meta, translate, origin)}\n  ${configHtml(env)}\n`,
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
    return new Response(html, {
      status: meta.found ? response.status : 404,
      headers,
    });
  }
  const { meta, html } = pageHead(url, env);
  const remove = { element: (element) => element.remove() };
  const rewritten = new HTMLRewriter()
    .on("html", {
      element: (element) => element.setAttribute("lang", meta.locale),
    })
    .on("head > title", remove)
    .on('head > meta[name="description"]', remove)
    .on("head", { element: (element) => element.append(html, { html: true }) })
    .transform(response);
  return new Response(rewritten.body, {
    status: meta.found ? response.status : 404,
    headers,
  });
}
