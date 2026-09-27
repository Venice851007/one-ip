<img src="public/icon.svg" alt="IP 查询工具 Logo" width="96" height="96" />

# IP 查询工具

IP 查询、网络诊断、浏览器检测与 AI 服务状态工具箱，运行在 Cloudflare Workers 上。

**中文** · [English](README.en.md)

[在线使用](https://ip.minispacex.com/) · [源代码](https://github.com/Venice851007/one-ip) · [问题反馈](https://github.com/Venice851007/one-ip/issues) · [小磊哥の博客](https://www.5201616.xyz)

> 本项目基于 [zhihui-hu/one-ip](https://github.com/zhihui-hu/one-ip)（AGPL-3.0）修改，由 [Venice851007](https://github.com/Venice851007) 于 2026-09-27 起维护。
> 主要改动：品牌替换、移除 Claude 环境评分与 WebMCP、增加服务端 SEO 元数据、sitemap/robots、可选的广告位与统计配置。详见 Git 提交历史。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2FVenice851007%2Fone-ip)

## 功能

| 模块             | 支持的功能                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| 首页概览         | 国内与外部 IPv4 探测、归属地、运营商、信誉分与类型标签                                                    |
| IP 详情          | IPv4 / IPv6 查询、ASN、CIDR、注册信息、网络属性、风险标记、地图、多源位置对比与关联地址；字段取决于数据源 |
| 网站分流与连通性 | 检查不同网站的出口 IP，按地址汇总；多轮 HTTP 采样、中位耗时与排序                                         |
| 全球 Ping        | Globalping 全球探针、地区与城市选择、延迟与丢包、分批返回结果                                             |
| DNS / CDN        | DNS 解析出口、CDN 命中节点及可读取的缓存信息                                                              |
| WHOIS            | 域名、IP、ASN 的 RDAP 注册资料与原始响应                                                                  |
| 浏览器检测       | 环境信息、FingerprintJS 指纹、环境一致性、CreepJS 深度检测、自动化特征、权限与 WebRTC                     |
| AI 访问          | ChatGPT、Claude、Grok、Perplexity、Gemini、DeepSeek、通义千问、Kimi 的资源连通性与部分平台出口对照        |
| 服务状态         | 聚合官方运行状态、故障、维护、组件与事件详情                                                              |
| 使用体验         | 中英文、深浅主题、移动端布局与底部抽屉、查询历史、二维码分享与复制链接                                    |
| 可选验证体验     | Cloudflare Turnstile、Google reCAPTCHA v3；入口需要配置和域名匹配                                         |

第三方服务的限流和跨域限制会影响查询结果。IP 类型和信誉分来自第三方数据源，仅供参考。

## 终端与 API

`GET /api/ip/health` 查询 IP 健康度，无需 API Key。

```bash
curl -fsS 'https://ip.minispacex.com/api/ip/health?format=text'
curl -fsS 'https://ip.minispacex.com/api/ip/health'
curl -fsS 'https://ip.minispacex.com/api/ip/health?ip=1.1.1.1'
```

返回 `ip`、`checked_at`、`score`（0–100，75 以上 `good`、45–74 `moderate`、低于 45 `poor`）、位置、ISP、ASN 和 `flags`（住宅、数据中心、移动网络、VPN、代理、Tor、爬虫、滥用）。错误返回 JSON `{ "error": "…" }`：400 参数无效、429 限流、503 无法识别访客 IP、502 数据源故障。

## 部署

站点使用 **Cloudflare Workers + Static Assets**，配置在 `wrangler.toml`：

- Worker 名称 `ip-tools`，自定义域名 `ip.minispacex.com`（`routes` 中 `custom_domain = true`，部署时 Cloudflare 自动创建 DNS 记录和证书）。
- `run_worker_first = ["/*", "!/assets/*"]`：页面请求经过 Worker 注入每个路由的 SEO 元数据；`/assets/*` 构建产物直接由静态资源服务返回；其他文件由 Worker 原样透传。
- 限流命名空间 `8517001` / `8517002`（账号内唯一即可）。

```bash
pnpm install --frozen-lockfile   # Node.js >= 24，pnpm 10.32.1
pnpm build && pnpm test && pnpm lint
pnpm exec wrangler login
pnpm exec wrangler deploy --env=""   # 或 make deploy
```

用 Workers Builds（连接 GitHub 自动部署）时：构建命令 `pnpm build`，部署命令 `pnpm exec wrangler deploy --env=""`。Workers Builds 和 GitHub Actions（`.github/workflows/pages.yml`，需要 `ENABLE_CF_DEPLOY=true` 与 CF 密钥）二选一。

国内访问地图建议配置 `TIANDITU_TOKEN`（`pnpm exec wrangler secret put TIANDITU_TOKEN`），未配置时使用 OpenStreetMap。

### 上游同步

`Sync upstream` 工作流**默认关闭**（需要仓库变量 `AUTO_SYNC_UPSTREAM=true` 或手动触发）。它会把上游改动直接合并到 `main`，连同自动部署会把未审查的上游品牌、功能和数据源上线，因此本仓库不启用。需要同步时，建议新建分支合并 `zhihui-hu/one-ip` 的 `main`，检查差异后再合并。

## SEO

- `src/seo/pages.ts`：每个路由的中英文标题、描述、sitemap 标记和 FAQ。Worker（`public/worker/pages.js`，HTMLRewriter）据此在返回的 HTML 中注入 `<title>`、description、canonical、hreflang（`zh-CN` 默认，`?lang=en` 为英文）、Open Graph / Twitter 卡片、JSON-LD（WebApplication，WHOIS 与 WebRTC 页面另有 FAQPage）。未知路径返回 404 + `noindex`。
- 前端 `src/components/seo-sync.tsx` 在单页导航后同步标题和 canonical。
- `public/robots.txt`、`public/sitemap.xml`；修改路由后运行 `pnpm seo:generate` 重新生成 sitemap（测试会检查是否同步）。
- 站点名、域名、仓库和博客链接集中在 `src/seo/site.json`。

## 广告与统计

默认全部关闭，不加载任何第三方广告或统计脚本。配置写在 `wrangler.toml` 的 `[vars]`（公开 ID，不是密钥），修改后重新部署即可，无需改代码：

| 变量                     | 说明                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| `ADSENSE_CLIENT`         | AdSense 发布商 ID，格式 `ca-pub-` + 数字。设置后自动提供 `/ads.txt`         |
| `ADSENSE_SLOT_HOME`      | 首页结果下方广告位的 slot ID（数字）                                        |
| `ADSENSE_SLOT_IP`        | IP 详情结果下方广告位                                                       |
| `ADSENSE_SLOT_TOOL`      | 各工具页底部广告位（IP 详情页除外）                                         |
| `ADSENSE_SLOT_FOOTER`    | 页脚上方广告位                                                              |
| `CF_WEB_ANALYTICS_TOKEN` | Cloudflare Web Analytics 站点 token（32 位十六进制），设置后注入官方 beacon |

- 只填 `ADSENSE_CLIENT` 不填 slot 时不显示广告位；格式不对的值会被忽略。
- 配置广告后页面底部出现 Cookie 同意提示，访客同意后才加载 AdSense。面向欧洲经济区/英国流量时，Google 要求使用经认证的 CMP，可在 AdSense「隐私和消息」中开启 Google 自带的同意消息。
- 当前 CSP 只限制 `frame-ancestors`（`public/_headers`），不限制脚本来源，所以 AdSense 与 Cloudflare beacon 无需额外放行；以后若收紧 `script-src`，需要放行 `pagead2.googlesyndication.com`、`*.googlesyndication.com`、`*.doubleclick.net`、`static.cloudflareinsights.com`，`connect-src` 放行 `cloudflareinsights.com`。
- 代码位置：`src/components/ads/`、`src/lib/site-config.ts`、`public/worker/pages.js`。

## 本地开发

```bash
pnpm install --frozen-lockfile
pnpm worker:dev
```

打开 `http://127.0.0.1:8787`。命令启动 Vite 和本地 Worker，支持热更新。

## 验证体验（可选）

选择 Turnstile 或 reCAPTCHA，填写 Site Key、Secret 和允许访问的域名。配置齐全且访问域名匹配时显示“验证体验”入口。

| 提供商       | 配置项                                                          |
| ------------ | --------------------------------------------------------------- |
| Turnstile    | `TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET`、`TURNSTILE_HOSTNAMES` |
| reCAPTCHA v3 | `RECAPTCHA_SITE_KEY`、`RECAPTCHA_SECRET`、`RECAPTCHA_HOSTNAMES` |

本地开发把[配置示例](docs/config/challenges.env.example)复制为 `.dev.vars`；线上用 `pnpm exec wrangler secret put 名称`，或复制 `.secrets.example` 为 `.secrets.production.env` 后运行 `node scripts/sync-worker-secrets.mjs production`。

## 项目结构与数据来源

- `src/views`：网络、浏览器、AI 与状态页面；`public/worker`：Worker API 与页面元数据注入。
- Net.Coffee：IP 详情与信誉分；ipwho.is / IP.SB / ipify：IP 归属；Globalping：全球测量；IANA / RDAP：注册资料；各平台官方状态源：运行状态。
- FingerprintJS 与 CreepJS：浏览器检测，见 [vendor/browser-diagnostics](vendor/browser-diagnostics/README.md)。

## 许可证

[AGPL-3.0](LICENSE)。本仓库是 [zhihui-hu/one-ip](https://github.com/zhihui-hu/one-ip) 的修改版，原作者版权与许可声明保留；线上站点页脚提供本仓库源代码链接。第三方组件许可见 `vendor/browser-diagnostics/LICENSE`（CreepJS，MIT）与 `public/browser-diagnostics.LICENSE.txt`。
