import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import worker from "../.worker-test/index.js";
import { siteConfig } from "../public/worker/pages.js";
import { webrtcFaq, whoisFaq } from "../src/seo/faq.ts";
import { headHtml, pageMeta, seoPages, sitemapXml } from "../src/seo/pages.ts";

const en = JSON.parse(readFileSync("src/i18n/en.json", "utf8"));
const shell = readFileSync("index.html", "utf8");
const env = {
  ASSETS: {
    fetch: async (request) =>
      /\.[a-z]+$/.test(new URL(request.url).pathname)
        ? new Response("asset", {
            headers: { "Content-Type": "image/svg+xml" },
          })
        : new Response(shell, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              ETag: '"x"',
            },
          }),
  },
  API_LIMITER: { limit: async () => ({ success: true }) },
  ACTION_LIMITER: { limit: async () => ({ success: true }) },
};
const get = (path) =>
  worker.fetch(new Request(`https://ip.example.com${path}`), env);

test("every SEO route has unique titles and Chinese/English copy", () => {
  const titles = new Set();
  for (const page of seoPages) {
    for (const locale of ["zh-CN", "en"]) {
      const meta = pageMeta(page.path, locale);
      assert.ok(meta.found, page.path);
      assert.ok(!titles.has(meta.title), `duplicate title ${meta.title}`);
      titles.add(meta.title);
      assert.ok(meta.description.length > 10, page.path);
    }
  }
});

test("FAQ copy used for structured data has English translations", () => {
  for (const item of [...whoisFaq, ...webrtcFaq]) {
    assert.ok(en[item.title], item.title);
    assert.ok(en[item.text], item.text);
  }
});

test("canonical, hreflang and noindex follow the locale and route", () => {
  const zh = pageMeta("/network/whois/", "zh-CN");
  assert.equal(zh.canonical, "https://ip.minispacex.com/network/whois");
  assert.equal(
    pageMeta("/network/whois", "en").canonical,
    "https://ip.minispacex.com/network/whois?lang=en",
  );
  assert.equal(pageMeta("/", "zh-CN").canonical, "https://ip.minispacex.com/");
  assert.ok(pageMeta("/browser/challenges", "zh-CN").noindex);
  assert.ok(pageMeta("/nope", "zh-CN").noindex);
  assert.equal(pageMeta("/network/ip/1.1.1.1", "zh-CN").found, true);
  assert.equal(pageMeta("/network/ip/not-an-ip", "zh-CN").found, false);
  const html = headHtml(zh);
  assert.match(
    html,
    /hreflang="en" href="https:\/\/ip\.minispacex\.com\/network\/whois\?lang=en"/,
  );
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"WebApplication"/);
});

test("injected metadata escapes user-controlled path values", () => {
  const html = headHtml(pageMeta("/network/ip/%3Cscript%3E", "zh-CN"));
  assert.doesNotMatch(html, /<script>/i);
});

test("public/sitemap.xml matches the route table (run pnpm seo:generate)", () => {
  assert.equal(readFileSync("public/sitemap.xml", "utf8"), sitemapXml());
  assert.doesNotMatch(sitemapXml(), /challenges/);
});

test("Worker injects per-route head into the SPA shell", async () => {
  const response = await get("/network/ping");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("ETag"), null);
  const html = await response.text();
  assert.match(html, /<title>全球 Ping 测试 - IP 查询工具<\/title>/);
  assert.equal(html.match(/<title>/g).length, 1);
  assert.equal(html.match(/name="description"/g).length, 1);
  assert.match(html, /<html lang="zh-CN"/);
  assert.match(
    html,
    /window\.__SITE_CONFIG__=\{"ads":null,"analyticsToken":null\}/,
  );
  const english = await (await get("/network/ping?lang=en")).text();
  assert.match(english, /<title>Global Ping test - IP Lookup Tools<\/title>/);
  assert.match(english, /<html lang="en"/);
});

test("unknown pages are 404 + noindex, legacy paths and files pass through", async () => {
  const missing = await get("/does-not-exist");
  assert.equal(missing.status, 404);
  assert.match(await missing.text(), /noindex/);
  const legacy = await get("/whois");
  assert.equal(legacy.status, 200);
  assert.doesNotMatch(await legacy.text(), /__SITE_CONFIG__/);
  assert.equal(await (await get("/favicon.svg")).text(), "asset");
  const ip = await (await get("/network/ip/1.1.1.1")).text();
  assert.match(
    ip,
    /<title>1\.1\.1\.1 IP 归属地与风险查询 - IP 查询工具<\/title>/,
  );
});

test("ads and analytics config only accepts well-formed public IDs", async () => {
  assert.deepEqual(siteConfig({}), { ads: null, analyticsToken: null });
  assert.equal(siteConfig({ ADSENSE_CLIENT: "pub-123" }).ads, null);
  const config = siteConfig({
    ADSENSE_CLIENT: "ca-pub-1234567890123456",
    ADSENSE_SLOT_HOME: "1234567890",
    ADSENSE_SLOT_IP: "<bad>",
    CF_WEB_ANALYTICS_TOKEN: "0123456789abcdef0123456789abcdef",
  });
  assert.equal(config.ads.slots.home, "1234567890");
  assert.equal(config.ads.slots.ip, undefined);
  assert.equal(config.analyticsToken, "0123456789abcdef0123456789abcdef");
  assert.equal((await get("/ads.txt")).status, 404);
  const ads = await worker.fetch(
    new Request("https://ip.example.com/ads.txt"),
    {
      ...env,
      ADSENSE_CLIENT: "ca-pub-1234567890123456",
    },
  );
  assert.equal(
    await ads.text(),
    "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n",
  );
});
