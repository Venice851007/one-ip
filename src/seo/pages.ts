// Route metadata shared by the Worker (server-side <head> injection) and the
// SPA (client-side updates after navigation). Keep this module free of
// browser-only APIs so the Worker bundle and Node tests can import it.
import { webrtcFaq, whoisFaq, type FaqItem } from "./faq.ts";
import site from "./site.json" with { type: "json" };

export type SeoLocale = "zh-CN" | "en";
type Text = { zh: string; en: string };
export type SeoPage = {
  path: string;
  title: Text;
  description: Text;
  /** Listed in sitemap.xml. */
  sitemap?: boolean;
  noindex?: boolean;
  faq?: FaqItem[];
  priority?: string;
};

export const siteName: Text = { zh: site.name, en: "IP Lookup Tools" };

const aiPlatforms: [string, string, string][] = [
  ["gpt", "ChatGPT", "ChatGPT"],
  ["claude", "Claude", "Claude"],
  ["grok", "Grok", "Grok"],
  ["perplexity", "Perplexity", "Perplexity"],
  ["gemini", "Gemini", "Gemini"],
  ["deepseek", "DeepSeek", "DeepSeek"],
  ["qwen", "通义千问", "Qwen"],
  ["kimi", "Kimi", "Kimi"],
];

const page = (
  path: string,
  title: Text,
  description: Text,
  options: Partial<SeoPage> = {},
): SeoPage => ({ path, title, description, sitemap: true, ...options });

export const seoPages: SeoPage[] = [
  page(
    "/",
    {
      zh: "IP 查询工具 - IP 地址查询、归属地、网络诊断与浏览器检测",
      en: "IP Lookup Tools - IP address lookup, geolocation, network diagnostics and browser checks",
    },
    {
      zh: "免费在线查询本机 IP 与任意 IP 的归属地、运营商、ASN、信誉分和风险标记，并提供网站分流出口、DNS/CDN 出口、全球 Ping、WHOIS、WebRTC 泄露与浏览器指纹检测。",
      en: "Free online lookup for your IP or any IP: location, ISP, ASN, reputation score and risk flags, plus website egress, DNS/CDN exits, global Ping, WHOIS, WebRTC leak and browser fingerprint checks.",
    },
    { priority: "1.0" },
  ),
  page(
    "/network",
    { zh: "网络检测", en: "Network checks" },
    {
      zh: "IP 查询、子域名、WHOIS、网站连通性、全球 Ping、CDN 节点与 DNS 出口等网络诊断工具合集。",
      en: "Network diagnostics: IP lookup, subdomains, WHOIS, website connectivity, global Ping, CDN nodes and DNS egress.",
    },
    { priority: "0.8" },
  ),
  page(
    "/network/ip",
    {
      zh: "IP 地址查询 - 归属地、ASN 与风险检测",
      en: "IP address lookup - location, ASN and risk check",
    },
    {
      zh: "查询 IPv4 / IPv6 地址的归属地、运营商、ASN、CIDR、注册信息、信誉分与代理/VPN/机房风险标记，支持地图与多源位置对比。",
      en: "Look up any IPv4 / IPv6 address: location, ISP, ASN, CIDR, registration data, reputation score and proxy / VPN / datacenter flags, with maps and multi-source comparison.",
    },
    { priority: "0.9" },
  ),
  page(
    "/network/subdomains",
    { zh: "子域名查询", en: "Subdomain lookup" },
    {
      zh: "通过证书透明度日志查询域名下已公开的子域名。",
      en: "Find public subdomains of a domain from certificate transparency logs.",
    },
  ),
  page(
    "/network/whois",
    {
      zh: "WHOIS 查询 - 域名、IP 与 ASN 注册信息",
      en: "WHOIS lookup - domain, IP and ASN registration data",
    },
    {
      zh: "基于 RDAP 查询域名、IP 与 AS 号的注册信息、状态、名称服务器与事件时间。",
      en: "RDAP-based WHOIS lookup for domains, IP addresses and AS numbers: registration data, status, name servers and events.",
    },
    { faq: whoisFaq, priority: "0.8" },
  ),
  page(
    "/network/connectivity",
    {
      zh: "网站连通性与分流出口检测",
      en: "Website connectivity and egress check",
    },
    {
      zh: "检测访问国内外常用网站的连通性、延迟与实际出口 IP，核对代理分流是否生效。",
      en: "Check connectivity, latency and the actual egress IP for popular websites to verify proxy routing.",
    },
  ),
  page(
    "/network/ping",
    { zh: "全球 Ping 测试", en: "Global Ping test" },
    {
      zh: "从全球探针对域名或 IP 进行 Ping，测量各地区延迟与丢包。",
      en: "Ping a domain or IP from probes around the world and compare latency and packet loss by region.",
    },
  ),
  page(
    "/network/cdn",
    { zh: "CDN 节点检测", en: "CDN node check" },
    {
      zh: "查看当前网络访问主流 CDN 时命中的接入节点与缓存信息。",
      en: "See which edge nodes of major CDNs your network reaches, with cache information.",
    },
  ),
  page(
    "/network/dns",
    {
      zh: "DNS 出口检测 - DNS 泄露测试",
      en: "DNS egress check - DNS leak test",
    },
    {
      zh: "检测域名解析实际经过的 DNS 出口网络，排查 DNS 泄露。",
      en: "Find the DNS resolvers your lookups actually exit through and check for DNS leaks.",
    },
  ),
  page(
    "/browser",
    { zh: "浏览器检测", en: "Browser checks" },
    {
      zh: "浏览器环境信息、指纹、环境一致性、自动化特征、WebRTC 与权限检测。",
      en: "Browser environment, fingerprint, consistency, automation signals, WebRTC and permission checks.",
    },
    { priority: "0.8" },
  ),
  page(
    "/browser/environment",
    { zh: "浏览器环境信息检测", en: "Browser environment check" },
    {
      zh: "查看浏览器、操作系统、语言、时区、屏幕与硬件信息。",
      en: "Inspect your browser, operating system, language, time zone, screen and hardware information.",
    },
  ),
  page(
    "/browser/fingerprint",
    { zh: "浏览器指纹检测", en: "Browser fingerprint check" },
    {
      zh: "基于 FingerprintJS 查看浏览器指纹组成，比较多次检测的变化。",
      en: "See what makes up your browser fingerprint (FingerprintJS) and compare repeated checks.",
    },
  ),
  page(
    "/browser/consistency",
    { zh: "浏览器环境一致性检测", en: "Browser consistency check" },
    {
      zh: "核对 IP、时区、语言与浏览器环境是否一致，并运行 CreepJS 深度检测。",
      en: "Check whether IP, time zone, language and browser environment are consistent, with CreepJS deep checks.",
    },
  ),
  page(
    "/browser/automation",
    { zh: "自动化特征检测", en: "Automation signal check" },
    {
      zh: "查看浏览器中可观察到的自动化与无头浏览器相关信号。",
      en: "See automation and headless-browser signals observable in your browser.",
    },
  ),
  page(
    "/browser/privacy",
    {
      zh: "WebRTC 泄露检测与权限检查",
      en: "WebRTC leak test and permissions check",
    },
    {
      zh: "检测 WebRTC 是否暴露真实 IP，并检查摄像头、麦克风、定位等网站权限。",
      en: "Test whether WebRTC exposes your real IP and review camera, microphone and location permissions.",
    },
    { faq: webrtcFaq, priority: "0.8" },
  ),
  page(
    "/browser/challenges",
    { zh: "人机验证体验", en: "Human verification test" },
    {
      zh: "体验 Cloudflare Turnstile 与 reCAPTCHA v3 验证并查看本次结果。",
      en: "Try Cloudflare Turnstile and reCAPTCHA v3 and view the result.",
    },
    { sitemap: false, noindex: true },
  ),
  page(
    "/ai",
    { zh: "AI 服务访问检测", en: "AI service access checks" },
    {
      zh: "检测 ChatGPT、Claude、Gemini、Grok、DeepSeek、通义千问、Kimi 等 AI 服务的连通性与访问出口。",
      en: "Check connectivity and egress for ChatGPT, Claude, Gemini, Grok, DeepSeek, Qwen, Kimi and other AI services.",
    },
    { priority: "0.8" },
  ),
  ...aiPlatforms.map(([id, zhName, enName]) =>
    page(
      `/ai/${id}`,
      { zh: `${zhName} 访问检测`, en: `${enName} access check` },
      {
        zh: `检测 ${zhName} 相关域名的连通性、延迟与访问出口 IP，辅助排查网络访问问题。`,
        en: `Check connectivity, latency and egress IP for ${enName} domains to troubleshoot access issues.`,
      },
    ),
  ),
  page(
    "/status",
    {
      zh: "服务状态 - AI 与云服务运行状态",
      en: "Service status - AI and cloud services",
    },
    {
      zh: "汇总 OpenAI、Claude、Gemini、Cloudflare、AWS、阿里云等服务的官方运行状态、故障与维护信息。",
      en: "Official status, incidents and maintenance for OpenAI, Claude, Gemini, Cloudflare, AWS, Alibaba Cloud and more.",
    },
    { priority: "0.8" },
  ),
  page(
    "/status/openai",
    { zh: "OpenAI / ChatGPT 服务状态", en: "OpenAI / ChatGPT status" },
    {
      zh: "查看 OpenAI 与 ChatGPT 各项服务的官方运行状态和故障事件。",
      en: "Official status and incidents for OpenAI and ChatGPT services.",
    },
  ),
  page(
    "/status/claude",
    { zh: "Claude 服务状态", en: "Claude status" },
    {
      zh: "查看 Claude 各项服务的官方运行状态和故障事件。",
      en: "Official status and incidents for Claude services.",
    },
  ),
  page(
    "/docs/api",
    { zh: "我的 IP 信息 API", en: "My IP information API" },
    {
      zh: "免费 IP 健康度 API：返回出口 IP、位置、ASN、信誉分与风险标记，支持 JSON 和终端文本。",
      en: "Free IP health API returning egress IP, location, ASN, reputation score and risk flags as JSON or terminal text.",
    },
    { priority: "0.6" },
  ),
  page(
    "/terms",
    { zh: "使用条款", en: "Terms of use" },
    { zh: "IP 查询工具使用条款。", en: "Terms of use for IP Lookup Tools." },
    { priority: "0.2" },
  ),
  page(
    "/privacy",
    { zh: "隐私政策", en: "Privacy policy" },
    { zh: "IP 查询工具隐私政策。", en: "Privacy policy for IP Lookup Tools." },
    { priority: "0.2" },
  ),
];

const ipPage: Omit<SeoPage, "path"> = {
  title: {
    zh: "{0} IP 归属地与风险查询",
    en: "{0} IP location and risk lookup",
  },
  description: {
    zh: "查看 {0} 的归属地、运营商、ASN、信誉分与代理/VPN/机房风险标记。",
    en: "Location, ISP, ASN, reputation score and proxy / VPN / datacenter flags for {0}.",
  },
};

export function normalizePath(pathname: string) {
  const path = pathname.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

function looksLikeIp(value: string) {
  return (
    value.length <= 45 &&
    (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value) ||
      (/^[0-9a-f:.]+$/i.test(value) && value.includes(":")))
  );
}

export type PageMeta = {
  found: boolean;
  path: string;
  locale: SeoLocale;
  title: string;
  description: string;
  canonical: string;
  alternates: { zh: string; en: string };
  noindex: boolean;
  faq?: FaqItem[];
};

export function localeFromSearch(search: string): SeoLocale {
  return new URLSearchParams(search).get("lang") === "en" ? "en" : "zh-CN";
}

export function pageMeta(
  pathname: string,
  locale: SeoLocale,
  origin: string = site.origin,
): PageMeta {
  const path = normalizePath(pathname);
  const key = locale === "en" ? "en" : "zh";
  const name = siteName[key];
  let entry: Omit<SeoPage, "path"> | undefined = seoPages.find(
    (item) => item.path === path,
  );
  let value = "";
  const ipMatch = path.match(/^\/network\/ip\/([^/]+)$/);
  if (!entry && ipMatch) {
    try {
      value = decodeURIComponent(ipMatch[1]);
    } catch {
      value = "";
    }
    if (looksLikeIp(value)) entry = ipPage;
  }
  const found = Boolean(entry);
  const title = entry
    ? path === "/"
      ? entry.title[key]
      : `${entry.title[key].replace("{0}", value)} - ${name}`
    : `${locale === "en" ? "Page not found" : "页面不存在"} - ${name}`;
  const description = entry
    ? entry.description[key].replace("{0}", value)
    : seoPages[0].description[key];
  const base = origin.replace(/\/$/, "");
  const url = base + (path === "/" ? "/" : path);
  const en = `${url}?lang=en`;
  return {
    found,
    path,
    locale,
    title,
    description,
    canonical: locale === "en" ? en : url,
    alternates: { zh: url, en },
    noindex: !found || Boolean(entry?.noindex),
    faq: entry?.faq,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonLd(data: unknown) {
  // Prevent "</script>" and HTML comment sequences inside the JSON payload.
  return `<script type="application/ld+json">${JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")}</script>`;
}

/** HTML inserted at the end of <head>; the original title/description are removed. */
export function headHtml(
  meta: PageMeta,
  translate: (text: string) => string = (text) => text,
  origin: string = site.origin,
) {
  const key = meta.locale === "en" ? "en" : "zh";
  const image = `${origin.replace(/\/$/, "")}/og.png`;
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
  ];
  if (meta.noindex)
    tags.push(`<meta name="robots" content="noindex, follow" />`);
  if (meta.found) {
    tags.push(
      `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
      `<link rel="alternate" hreflang="zh-CN" href="${escapeHtml(meta.alternates.zh)}" />`,
      `<link rel="alternate" hreflang="en" href="${escapeHtml(meta.alternates.en)}" />`,
      `<link rel="alternate" hreflang="x-default" href="${escapeHtml(meta.alternates.zh)}" />`,
    );
  }
  tags.push(
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName[key])}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="${meta.locale === "en" ? "en_US" : "zh_CN"}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  );
  if (meta.found && !meta.noindex) {
    tags.push(
      jsonLd({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: meta.path === "/" ? siteName[key] : meta.title,
        url: meta.canonical,
        description: meta.description,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        inLanguage: meta.locale,
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        isPartOf: {
          "@type": "WebSite",
          name: siteName[key],
          url: `${origin.replace(/\/$/, "")}/`,
        },
      }),
    );
    if (meta.faq?.length)
      tags.push(
        jsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          inLanguage: meta.locale,
          mainEntity: meta.faq.map((item) => ({
            "@type": "Question",
            name: translate(item.title),
            acceptedAnswer: { "@type": "Answer", text: translate(item.text) },
          })),
        }),
      );
  }
  return tags.join("\n  ");
}

export function sitemapXml(origin: string = site.origin) {
  const base = origin.replace(/\/$/, "");
  const urls = seoPages
    .filter((item) => item.sitemap && !item.noindex)
    .map((item) => {
      const loc = base + (item.path === "/" ? "/" : item.path);
      return [
        "  <url>",
        `    <loc>${loc}</loc>`,
        `    <xhtml:link rel="alternate" hreflang="zh-CN" href="${loc}" />`,
        `    <xhtml:link rel="alternate" hreflang="en" href="${loc}?lang=en" />`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />`,
        `    <changefreq>weekly</changefreq>`,
        `    <priority>${item.priority ?? "0.7"}</priority>`,
        "  </url>",
      ].join("\n");
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}
