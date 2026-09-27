<img src="public/icon.svg" alt="IP Lookup Tools logo" width="96" height="96" />

# IP Lookup Tools

IP lookup, network diagnostics, browser checks and AI service status, running on Cloudflare Workers.

[中文](README.md) · **English**

[Live site](https://ip.minispacex.com/?lang=en) · [Source](https://github.com/Venice851007/one-ip) · [Issues](https://github.com/Venice851007/one-ip/issues) · [Blog](https://www.5201616.xyz)

> Modified from [zhihui-hu/one-ip](https://github.com/zhihui-hu/one-ip) (AGPL-3.0); maintained by [Venice851007](https://github.com/Venice851007) since 2026-09-27.
> Changes: rebranding, removal of the Claude environment score and WebMCP, server-side SEO metadata, sitemap/robots, optional ad slots and analytics. See the Git history for details.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2FVenice851007%2Fone-ip)

## Features

| Module                | Supported features                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Overview              | Domestic and external IPv4 detection, location, ISP, reputation score and network labels                     |
| IP details            | IPv4 / IPv6 lookup, ASN, CIDR, registration, network attributes, risk flags, map and multi-source comparison |
| Website connectivity  | Egress IP for different websites, grouped by address; multi-round HTTP sampling with median latency          |
| Global Ping           | Globalping probes with region and city selection, latency and packet loss                                    |
| DNS / CDN             | DNS resolver egress, CDN edge nodes and readable cache details                                               |
| WHOIS                 | RDAP registration data for domains, IPs and ASNs with raw responses                                          |
| Browser checks        | Environment, FingerprintJS, consistency, CreepJS deep checks, automation signals, permissions and WebRTC     |
| AI access             | ChatGPT, Claude, Grok, Perplexity, Gemini, DeepSeek, Qwen and Kimi connectivity, with egress comparisons     |
| Service status        | Official status, incidents, maintenance, components and events                                               |
| Experience            | Chinese and English, light and dark themes, mobile layout, lookup history, QR sharing and copy links         |
| Optional verification | Cloudflare Turnstile and Google reCAPTCHA v3, shown when configured                                          |

## Terminal and API

```bash
curl -fsS 'https://ip.minispacex.com/api/ip/health?format=text'
curl -fsS 'https://ip.minispacex.com/api/ip/health?ip=1.1.1.1'
```

## Deployment

`wrangler.toml` defines the Worker `ip-tools` on the custom domain `ip.minispacex.com` (`custom_domain = true` creates DNS and the certificate on deploy). `run_worker_first = ["/*", "!/assets/*"]` routes pages through the Worker for per-route SEO metadata while hashed build assets are served directly.

```bash
pnpm install --frozen-lockfile   # Node.js >= 24, pnpm 10.32.1
pnpm build && pnpm test && pnpm lint
pnpm exec wrangler deploy --env=""
```

The `Sync upstream` workflow stays disabled (it would merge unreviewed upstream changes into `main`). Merge upstream manually on a branch when needed.

## SEO

Route metadata lives in `src/seo/pages.ts`. The Worker (`public/worker/pages.js`, HTMLRewriter) injects title, description, canonical, hreflang (Chinese default, `?lang=en` for English), Open Graph / Twitter tags and JSON-LD (WebApplication, plus FAQPage on WHOIS and WebRTC pages). Unknown paths return 404 with `noindex`. Run `pnpm seo:generate` after changing routes to refresh `public/sitemap.xml`.

## Ads and analytics

Disabled by default. Set public IDs in `wrangler.toml` `[vars]` and redeploy: `ADSENSE_CLIENT` (`ca-pub-…`, also enables `/ads.txt`), `ADSENSE_SLOT_HOME`, `ADSENSE_SLOT_IP`, `ADSENSE_SLOT_TOOL`, `ADSENSE_SLOT_FOOTER`, and `CF_WEB_ANALYTICS_TOKEN` (Cloudflare Web Analytics beacon). When ads are configured, a consent banner appears and AdSense loads only after the visitor accepts. The current CSP only sets `frame-ancestors`, so no extra script allowances are needed.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm worker:dev
```

## License

[AGPL-3.0](LICENSE). This repository is a modified version of [zhihui-hu/one-ip](https://github.com/zhihui-hu/one-ip); original copyright and license notices are retained, and the live site links to this repository's source. Third-party notices: `vendor/browser-diagnostics/LICENSE` (CreepJS, MIT) and `public/browser-diagnostics.LICENSE.txt`.
