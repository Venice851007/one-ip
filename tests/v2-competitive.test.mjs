import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../.worker-test/index.js";
import { geoFallback, providers } from "../public/worker/geo-sources.js";
import { isCliAgent, plainIpResponse } from "../public/worker/plain.js";
import { calculateCidr, formatIp6, parseIp6 } from "../src/lib/cidr.ts";
import { bodyHtml, pageMeta, sitemapXml } from "../src/seo/pages.ts";

const env = {
  ASSETS: {
    fetch: async () =>
      new Response(
        '<!doctype html><html lang="zh-CN"><head><title>x</title><meta name="description" content="x"></head><body><div id="root"></div></body></html>',
        { headers: { "Content-Type": "text/html" } },
      ),
  },
  API_LIMITER: { limit: async () => ({ success: true }) },
};

test("geo fallback skips failing providers and reports the source used", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(String(url));
    if (String(url).includes("ipwho.is"))
      return new Response("down", { status: 503 });
    return Response.json({
      country: "United States",
      country_code: "US",
      asn: 15169,
      organization_name: "Google LLC",
      latitude: "37.7",
      longitude: "-97.8",
    });
  });
  const geo = await geoFallback("8.8.8.8", {});
  assert.equal(geo.source, "GeoJS");
  assert.equal(geo.asn, 15169);
  assert.equal(geo.latitude, 37.7);
  assert.deepEqual(geo.sources_tried, ["ipwho.is", "GeoJS"]);
  assert.equal(calls.length, 2);
});

test("geo fallback: all providers down → 502, rate-limited → 429", async (t) => {
  let status = 500;
  t.mock.method(globalThis, "fetch", async () => new Response("x", { status }));
  await assert.rejects(geoFallback("8.8.4.4", {}), (e) => e.status === 502);
  status = 429;
  await assert.rejects(geoFallback("8.8.4.4", {}), (e) => e.status === 429);
});

test("provider parsers normalise ASN strings and reject unsuccessful payloads", () => {
  const [ipwho, , ipapi] = providers;
  assert.equal(ipwho.parse({ success: false }), null);
  assert.equal(
    ipapi.parse({
      ip: "1.1.1.1",
      asn: "AS13335 Cloudflare",
      company: "Cloudflare",
      country: "AU",
    }).asn,
    13335,
  );
  assert.match(ipapi.url("1.1.1.1", { IPAPI_IS_KEY: "k" }), /key=k/);
});

test("reputation proxy and health degrade gracefully when Net.Coffee is down", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (String(url).includes("net.coffee"))
      return new Response("x", { status: 503 });
    return Response.json({
      success: true,
      country: "Australia",
      connection: { isp: "Cloudflare", asn: 13335 },
    });
  });
  const rep = await worker.fetch(
    new Request("https://t.example/api/ip/reputation/1.0.0.1"),
    env,
  );
  assert.equal(rep.status, 502);
  const health = await worker.fetch(
    new Request("https://t.example/api/ip/health?ip=1.0.0.1"),
    env,
  );
  assert.equal(health.status, 200);
  const data = await health.json();
  assert.equal(data.score, null);
  assert.equal(data.status, "unknown");
  assert.equal(data.asn, 13335);
});

test("curl / wget get a plain-text IP; browsers get the page", async () => {
  assert.ok(isCliAgent("curl/8.5.0"));
  assert.ok(isCliAgent("Wget/1.21"));
  assert.ok(!isCliAgent("Mozilla/5.0 Chrome/130"));
  const req = (path, ua) =>
    new Request(`https://t.example${path}`, {
      headers: { "User-Agent": ua, "CF-Connecting-IP": "203.0.114.9" },
    });
  const r = await worker.fetch(req("/", "curl/8.5.0"), env);
  assert.equal(await r.text(), "203.0.114.9\n");
  assert.match(r.headers.get("Content-Type"), /text\/plain/);
  assert.equal(
    await (await worker.fetch(req("/ip", "Mozilla/5.0"), env)).text(),
    "203.0.114.9\n",
  );
  assert.equal(
    plainIpResponse(
      req("/network", "curl/8"),
      new URL("https://t.example/network"),
    ),
    null,
  );
  const page = await worker.fetch(req("/", "Mozilla/5.0"), env);
  assert.match(await page.text(), /<article id="seo-content"/);
});

test("tool pages include crawlable body copy, breadcrumbs and BreadcrumbList", async () => {
  for (const path of [
    "/",
    "/network/ip",
    "/network/cidr",
    "/network/dns",
    "/browser/privacy",
    "/status",
  ]) {
    const html = await (
      await worker.fetch(new Request(`https://t.example${path}`), env)
    ).text();
    const article =
      html.match(/<article id="seo-content"[\s\S]*<\/article>/)?.[0] ?? "";
    assert.ok(article.length > 200, path);
  }
  const html = await (
    await worker.fetch(
      new Request("https://t.example/network/cidr?lang=en"),
      env,
    )
  ).text();
  assert.match(html, /BreadcrumbList/);
  assert.match(html, /How many usable IPs/);
});

test("popular IP pages are indexable with a server summary; other IP pages are noindex", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      success: true,
      country: "United States",
      city: "Mountain View",
      connection: { isp: "Google LLC", asn: 15169 },
    }),
  );
  const popular = await (
    await worker.fetch(new Request("https://t.example/network/ip/8.8.8.8"), env)
  ).text();
  assert.doesNotMatch(popular, /noindex/);
  assert.match(popular, /Google Public DNS/);
  assert.match(popular, /AS15169/);
  const other = await (
    await worker.fetch(new Request("https://t.example/network/ip/8.8.9.9"), env)
  ).text();
  assert.match(other, /noindex, follow/);
  assert.equal(pageMeta("/network/ip/1.1.1.1", "zh-CN").noindex, false);
  assert.match(sitemapXml(), /\/network\/ip\/114\.114\.114\.114/);
  assert.match(sitemapXml(), /\/network\/cidr/);
  assert.equal(bodyHtml(pageMeta("/nope", "zh-CN")), "");
});

test("body copy escapes injected IP path values", () => {
  const html = bodyHtml(
    pageMeta("/network/ip/1.2.3.4", "en"),
    "https://x.test",
    { value: "<script>", summary: { isp: "<b>" } },
  );
  assert.doesNotMatch(html, /<script>|<b>/);
});

test("CIDR calculator: IPv4 prefix, mask form, /31, IPv6", () => {
  const a = calculateCidr("192.168.1.10/24");
  assert.equal(a.network, "192.168.1.0");
  assert.equal(a.broadcast, "192.168.1.255");
  assert.equal(a.usable, 254);
  assert.equal(a.wildcard, "0.0.0.255");
  const b = calculateCidr("10.0.0.1 255.255.240.0");
  assert.equal(b.cidr, "10.0.0.0/20");
  assert.equal(b.last, "10.0.15.254");
  assert.equal(calculateCidr("172.16.5.4/31").usable, 2);
  assert.equal(calculateCidr("1.2.3.4 255.0.255.0"), null);
  assert.equal(calculateCidr("300.1.1.1/24"), null);
  const c = calculateCidr("2001:db8:abcd::1/48");
  assert.equal(c.network, "2001:db8:abcd::");
  assert.equal(c.last, "2001:db8:abcd:ffff:ffff:ffff:ffff:ffff");
  assert.equal(formatIp6(parseIp6("::1")), "::1");
  assert.equal(parseIp6("1::2::3"), null);
});
