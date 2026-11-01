// Server-rendered, crawlable body copy for each tool page. The Worker renders this
// into <article id="seo-content"> after the SPA root so search engines see real text
// without JavaScript. Original copy; keep it useful, not keyword-stuffed.
export type Block = {
  h: string;
  intro: string[];
  steps?: string[];
  faq?: [string, string][];
};
export type PageContent = {
  zh: Block;
  en: Block;
  related: string[];
  blog?: boolean;
};

export const blogUrl = "https://www.5201616.xyz";

export const pageContent: Record<string, PageContent> = {
  "/": {
    related: [
      "/network/ip",
      "/network/dns",
      "/browser/privacy",
      "/network/cidr",
      "/network/whois",
      "/network/ping",
    ],
    blog: true,
    zh: {
      h: "IP 查询工具：查看我的 IP 地址、归属地与网络出口",
      intro: [
        "打开本页即可看到你当前的公网 IP 地址（IPv4 与 IPv6）、所在国家与城市、运营商、ASN 自治系统号，以及该 IP 是否被识别为机房、代理、VPN 或 Tor 出口。数据由本站 Cloudflare Worker 从多个公开数据源汇总，并在边缘节点短时缓存，单一数据源故障或被广告拦截插件屏蔽时仍可返回结果。",
        "除了“我的 IP”，本站还提供网站分流出口检测（看访问国内、海外与 AI 网站时实际走的是哪个出口）、DNS 出口与 DNS 泄露测试、WebRTC 泄露检测、浏览器指纹、全球 Ping、WHOIS/RDAP 查询、子域名查询和 IP 子网（CIDR）计算器。所有检测均可免费使用，无需注册。",
        "在终端里也能用：执行 curl ip.minispacex.com 会直接返回你的出口 IP 纯文本；访问 /ip 路径同样返回纯文本，适合脚本和路由器调用。",
      ],
      steps: [
        "打开首页，等待几秒，页面会自动显示本机 IP、归属地与风险标记。",
        "需要查询其他地址时，在 IP 检测页输入 IPv4 或 IPv6 地址，结果页可直接复制或分享链接。",
        "使用代理或 VPN 时，对比“网站分流出口”中各网站的出口 IP，确认分流规则是否生效。",
      ],
      faq: [
        [
          "为什么不同网站显示的 IP 不一样？",
          "如果你使用了代理分流、多线路宽带或 IPv6，不同网站可能经由不同出口访问，因此看到的 IP 不同。本站的分流出口检测会把这些出口并排列出。",
        ],
        [
          "IP 归属地准确吗？",
          "IP 定位基于公开的 IP 数据库，通常能精确到国家与省份，城市级别可能存在偏差，移动网络和企业网络尤其如此。本站会展示多个数据源以便交叉对比。",
        ],
        [
          "本站会保存我的 IP 吗？",
          "不会长期保存。查询记录只存在你自己浏览器的本地存储中，可随时清除。详见隐私政策。",
        ],
      ],
    },
    en: {
      h: "IP Lookup Tools: what is my IP address, location and egress",
      intro: [
        "This page shows your current public IP address (IPv4 and IPv6), country and city, ISP, ASN, and whether the address is flagged as a datacenter, proxy, VPN or Tor exit. The data is aggregated by our Cloudflare Worker from several public sources and cached briefly at the edge, so a single provider outage or an ad blocker does not break the result.",
        "Beyond “my IP”, the site offers a website egress check (which exit your traffic uses for domestic, overseas and AI sites), DNS egress and DNS leak testing, WebRTC leak detection, browser fingerprinting, global Ping, WHOIS/RDAP, subdomain discovery and an IP subnet (CIDR) calculator. Everything is free and needs no account.",
        "It works from a terminal too: curl ip.minispacex.com prints your IP as plain text, and the /ip path does the same for scripts and routers.",
      ],
      steps: [
        "Open the home page; your IP, location and risk flags appear within seconds.",
        "To check another address, enter an IPv4 or IPv6 address on the IP lookup page, then copy or share the result link.",
        "When using a proxy or VPN, compare the per-site egress IPs to confirm your routing rules work.",
      ],
      faq: [
        [
          "Why do different sites show different IPs?",
          "With split routing, multi-WAN or IPv6, different sites can be reached through different exits. The egress check lists them side by side.",
        ],
        [
          "How accurate is IP geolocation?",
          "It comes from public IP databases: usually accurate to country and region, less so to city, especially on mobile and corporate networks. Multiple sources are shown for comparison.",
        ],
        [
          "Do you store my IP?",
          "No long-term storage. Lookup history lives only in your own browser storage and can be cleared at any time.",
        ],
      ],
    },
  },
  "/network/ip": {
    related: [
      "/network/whois",
      "/network/cidr",
      "/network/ping",
      "/network/ip/8.8.8.8",
      "/network/ip/1.1.1.1",
      "/network/ip/114.114.114.114",
      "/network/ip/223.5.5.5",
    ],
    blog: true,
    zh: {
      h: "IP 地址查询：归属地、运营商、ASN 与风险检测",
      intro: [
        "输入任意公网 IPv4 或 IPv6 地址，即可查询它的国家、地区、城市、运营商（ISP）、所属 ASN 自治系统、CIDR 网段与 RDAP 注册信息，并查看信誉分以及代理、VPN、Tor、机房（数据中心）、爬虫等风险标记。",
        "归属地由多个数据源依次提供（ipwho.is、GeoJS、ipapi.is），由本站 Worker 统一请求并缓存，避免浏览器直连第三方被拦截；信誉分来自 Net.Coffee，当该数据源不可用时页面会隐藏分数，只显示归属信息，而不会整页报错。",
        "常见用途：确认代理/VPN 节点是否被识别为机房 IP、排查账号风控、查看陌生登录 IP 来自哪里、核对服务器或 CDN 的归属。",
      ],
      steps: [
        "在输入框粘贴 IP 地址并回车，或直接访问 /network/ip/<IP>。",
        "查看信誉分与风险标记，分数越高表示该 IP 越接近普通住宅网络。",
        "点击复制按钮复制结果，或复制地址栏链接分享给他人。",
      ],
      faq: [
        [
          "什么是 ASN？",
          "ASN（自治系统号）是分配给运营商、云厂商等网络的编号，例如 AS13335 属于 Cloudflare、AS4134 属于中国电信。通过 ASN 可以判断 IP 属于哪个网络。",
        ],
        [
          "“机房 IP”有什么影响？",
          "云服务器和数据中心的 IP 常被网站识别为非住宅流量，可能触发验证码或风控。住宅宽带和移动网络 IP 通常信誉更高。",
        ],
        [
          "可以查询内网 IP 吗？",
          "不可以。192.168.x.x、10.x.x.x 等私有地址和保留地址没有公网归属信息。",
        ],
      ],
    },
    en: {
      h: "IP address lookup: location, ISP, ASN and risk check",
      intro: [
        "Enter any public IPv4 or IPv6 address to see its country, region, city, ISP, ASN, CIDR range and RDAP registration data, plus a reputation score and proxy, VPN, Tor, datacenter and crawler flags.",
        "Location comes from several providers in turn (ipwho.is, GeoJS, ipapi.is), requested and cached by our Worker so browser extensions cannot block it. The reputation score comes from Net.Coffee; if that source is down the score is simply hidden and the location is still shown.",
        "Typical uses: checking whether a proxy or VPN node is seen as datacenter traffic, investigating account risk checks, tracing an unfamiliar login IP, or verifying who owns a server or CDN address.",
      ],
      steps: [
        "Paste an IP and press Enter, or open /network/ip/<IP> directly.",
        "Review the score and flags; higher scores look more like ordinary residential traffic.",
        "Copy individual values or share the page URL.",
      ],
      faq: [
        [
          "What is an ASN?",
          "An autonomous system number identifies a network such as an ISP or cloud provider, e.g. AS13335 is Cloudflare and AS15169 is Google.",
        ],
        [
          "Why does “datacenter IP” matter?",
          "Cloud and hosting addresses are often treated as non-residential traffic and may trigger captchas or fraud checks.",
        ],
        [
          "Can I look up a private IP?",
          "No. Private and reserved ranges such as 192.168.0.0/16 and 10.0.0.0/8 have no public location data.",
        ],
      ],
    },
  },
  "/network/cidr": {
    related: ["/network/ip", "/network/whois", "/network/ping"],
    zh: {
      h: "IP 子网计算器（CIDR 计算）",
      intro: [
        "输入“IP/前缀长度”（如 192.168.1.10/24）或“IP 与子网掩码”（如 10.0.0.0 255.255.240.0），即可计算网络地址、广播地址、子网掩码、通配符掩码（ACL 反掩码）、第一个和最后一个可用主机地址、地址总数与可用主机数，并给出二进制掩码。也支持 IPv6 前缀，例如 2001:db8::/48。",
        "计算完全在浏览器本地完成，不会上传你输入的地址。常用于规划内网网段、配置路由器与防火墙 ACL、编写云安全组规则，或检查两个地址是否位于同一子网。",
      ],
      steps: [
        "在输入框输入 IP/前缀或 IP 与掩码。",
        "结果实时更新，点击每项旁的复制按钮即可复制。",
        "地址栏链接包含输入内容，可直接分享。",
      ],
      faq: [
        [
          "/24 有多少个可用 IP？",
          "/24 共 256 个地址，去掉网络地址和广播地址后有 254 个可用主机地址。/31 与 /32 是特例：/31 用于点对点链路，两个地址都可用；/32 表示单个主机。",
        ],
        [
          "子网掩码和 CIDR 前缀如何换算？",
          "前缀长度就是掩码中连续 1 的个数：255.255.255.0 = /24，255.255.240.0 = /20，255.255.255.252 = /30。",
        ],
        [
          "什么是通配符掩码？",
          "通配符掩码是子网掩码按位取反的结果，例如 /24 的通配符掩码是 0.0.0.255，常见于 Cisco ACL 与 OSPF 配置。",
        ],
      ],
    },
    en: {
      h: "IP subnet calculator (CIDR)",
      intro: [
        "Enter an IP with a prefix (192.168.1.10/24) or an IP with a subnet mask (10.0.0.0 255.255.240.0) to get the network address, broadcast address, subnet mask, wildcard mask, first and last usable host, total and usable address counts, and the binary mask. IPv6 prefixes such as 2001:db8::/48 are supported too.",
        "Everything is calculated locally in your browser. Use it to plan LAN ranges, write router and firewall ACLs, define cloud security-group rules, or check whether two hosts share a subnet.",
      ],
      steps: [
        "Type an IP/prefix or IP and mask.",
        "Results update instantly; use the copy buttons.",
        "The URL contains your input, so you can share it.",
      ],
      faq: [
        [
          "How many usable IPs are in a /24?",
          "256 addresses, 254 usable hosts. /31 (point-to-point, both usable) and /32 (single host) are special cases.",
        ],
        [
          "How do masks map to prefixes?",
          "The prefix is the number of leading 1 bits: 255.255.255.0 = /24, 255.255.240.0 = /20, 255.255.255.252 = /30.",
        ],
        [
          "What is a wildcard mask?",
          "The bitwise inverse of the subnet mask, e.g. 0.0.0.255 for a /24, used in Cisco ACLs and OSPF.",
        ],
      ],
    },
  },
  "/network/whois": {
    related: ["/network/ip", "/network/subdomains", "/network/cidr"],
    blog: true,
    zh: {
      h: "WHOIS / RDAP 查询：域名、IP 与 ASN 注册信息",
      intro: [
        "本页通过 RDAP（注册数据访问协议）查询域名、公网 IP 与 AS 号的注册信息，包括注册商、注册与到期时间、域名状态、权威 DNS 服务器，以及 IP 段所属的组织和区域互联网注册机构（APNIC、ARIN、RIPE 等）。RDAP 是 ICANN 推行的 WHOIS 替代协议，返回结构化 JSON，字段更统一。",
        "查询域名时只需输入主域名，如 example.com；查询 IP 可输入 8.8.8.8；查询自治系统输入 AS15169。结果会保存在本地最近记录中，方便再次查看。",
      ],
    },
    en: {
      h: "WHOIS / RDAP lookup for domains, IPs and ASNs",
      intro: [
        "This page queries RDAP (Registration Data Access Protocol) for domains, public IPs and AS numbers: registrar, creation and expiry dates, domain status, authoritative name servers, and the organisation and regional registry (APNIC, ARIN, RIPE…) behind an IP range. RDAP is ICANN's structured, JSON-based successor to WHOIS.",
        "Enter a registered domain (example.com), an IP (8.8.8.8) or an ASN (AS15169). Recent successful lookups are kept locally in your browser.",
      ],
    },
  },
  "/network/dns": {
    related: [
      "/browser/privacy",
      "/network/connectivity",
      "/network/ip/1.1.1.1",
      "/network/ip/8.8.8.8",
    ],
    blog: true,
    zh: {
      h: "DNS 出口检测与 DNS 泄露测试",
      intro: [
        "访问网站前，浏览器需要先通过 DNS 把域名解析为 IP。本页会触发若干随机子域名的解析，由权威服务器记录是哪一个递归 DNS 出口来查询的，从而告诉你：你的 DNS 请求实际由谁处理、出口位于哪个国家和运营商。",
        "如果你在使用代理或 VPN，却发现 DNS 出口仍是本地运营商（例如显示为国内电信、联通、移动的 DNS），就说明存在 DNS 泄露：你访问了哪些网站可能被本地网络看到，也可能导致分流规则判断错误。解决方法通常是在代理客户端开启“远程 DNS / Fake-IP”，或在系统中改用加密 DNS（DoH/DoT）。",
      ],
      faq: [
        [
          "什么是 DNS 泄露？",
          "使用代理或 VPN 时，DNS 查询没有经过隧道，而是直接发给了本地运营商的 DNS，称为 DNS 泄露。",
        ],
        [
          "公共 DNS 推荐哪些？",
          "国内常用 223.5.5.5（阿里）、119.29.29.29（腾讯）、114.114.114.114；海外常用 1.1.1.1（Cloudflare）、8.8.8.8（Google）、9.9.9.9（Quad9）。",
        ],
      ],
    },
    en: {
      h: "DNS egress check and DNS leak test",
      intro: [
        "Before loading a site your browser resolves its name through DNS. This page resolves a few random subdomains and the authoritative server records which recursive resolver asked, revealing who actually handles your DNS and where that resolver sits.",
        "If you use a proxy or VPN but the resolver is still your local ISP, you have a DNS leak: your local network can see which sites you visit, and split-routing rules may misfire. Enable remote DNS / Fake-IP in your proxy client or switch to encrypted DNS (DoH/DoT).",
      ],
      faq: [
        [
          "What is a DNS leak?",
          "When DNS queries bypass the VPN or proxy tunnel and go to your ISP's resolver directly.",
        ],
        [
          "Which public resolvers are common?",
          "1.1.1.1 (Cloudflare), 8.8.8.8 (Google), 9.9.9.9 (Quad9); in mainland China 223.5.5.5 (Alibaba), 119.29.29.29 (Tencent), 114.114.114.114.",
        ],
      ],
    },
  },
  "/network/ping": {
    related: ["/network/connectivity", "/network/cdn", "/network/ip"],
    zh: {
      h: "全球 Ping 测试：多地延迟与丢包",
      intro: [
        "输入域名或 IP，从分布在全球各地的探针节点（由 Globalping 提供）同时发起 Ping，比较不同国家和城市到目标的往返延迟（RTT）与丢包率。适合评估 VPS、CDN 或游戏服务器在各地区的网络质量，排查“某地访问慢”的问题。",
        "延迟通常与物理距离和线路质量有关：同城一般低于 10 ms，跨洲常在 150 ms 以上。若某地区丢包明显，可能是跨境线路拥塞或目标对 ICMP 做了限速。",
      ],
    },
    en: {
      h: "Global Ping test: latency and packet loss worldwide",
      intro: [
        "Enter a domain or IP and ping it simultaneously from probes around the world (via Globalping) to compare round-trip time and packet loss by country and city. Useful for evaluating a VPS, CDN or game server and for tracing regional slowness.",
        "Latency tracks distance and routing quality: same-city usually under 10 ms, intercontinental often above 150 ms. Regional packet loss can indicate congested cross-border links or ICMP rate limiting.",
      ],
    },
  },
  "/network/connectivity": {
    related: ["/network/dns", "/ai", "/network/ip"],
    zh: {
      h: "网站连通性与分流出口检测",
      intro: [
        "本页从你的浏览器直接访问一组国内外常用网站（如百度、淘宝、Google、GitHub、YouTube 以及各 AI 服务），检测是否可达、延迟多少，并在可行时读取该网站看到的出口 IP。通过对比，你可以确认代理分流规则是否按预期工作：国内网站应走本地出口，海外网站走代理出口。",
      ],
    },
    en: {
      h: "Website connectivity and egress check",
      intro: [
        "Your browser contacts a set of popular domestic and international sites (Baidu, Taobao, Google, GitHub, YouTube and AI services), measuring reachability and latency and, where possible, the egress IP each site sees. Compare them to confirm split-routing works: domestic sites via your local line, overseas sites via your proxy.",
      ],
    },
  },
  "/network/subdomains": {
    related: ["/network/whois", "/network/ip"],
    zh: {
      h: "子域名查询（证书透明度）",
      intro: [
        "通过公开的证书透明度（Certificate Transparency）日志，列出某个域名下曾签发过 HTTPS 证书的子域名。适用于资产梳理、排查遗忘的测试站点或核对 CDN 接入范围。结果只包含公开签发过证书的名称，不代表全部子域名。",
      ],
    },
    en: {
      h: "Subdomain lookup (Certificate Transparency)",
      intro: [
        "Lists subdomains that have had public HTTPS certificates issued, using Certificate Transparency logs. Handy for asset inventory, finding forgotten test hosts or checking CDN coverage. Only names with public certificates appear.",
      ],
    },
  },
  "/browser/privacy": {
    related: ["/network/dns", "/browser/fingerprint", "/browser/consistency"],
    blog: true,
    zh: {
      h: "WebRTC 泄露检测与网站权限检查",
      intro: [
        "WebRTC 是浏览器内置的实时音视频通信技术，它会通过 STUN 请求获取本机的网络地址。即使你开启了代理或 VPN，WebRTC 也可能绕过代理暴露真实公网 IP 或局域网 IP，这就是 WebRTC 泄露。本页会在浏览器本地发起检测，列出 WebRTC 可见的地址，并与当前出口 IP 对比。",
        "如果检测出与代理出口不同的公网 IP，建议在浏览器中禁用 WebRTC 非代理 UDP（如 Chrome 扩展 WebRTC Network Limiter，或 Firefox 设置 media.peerconnection.enabled=false）。本页还会列出摄像头、麦克风、定位、通知等权限的当前状态。",
      ],
    },
    en: {
      h: "WebRTC leak test and permission check",
      intro: [
        "WebRTC, the browser's built-in real-time communication stack, discovers network addresses via STUN. Even behind a proxy or VPN it can reveal your real public or LAN IP — a WebRTC leak. This page runs the check locally and compares the addresses WebRTC exposes with your current egress IP.",
        "If a public IP different from your proxy exit shows up, restrict WebRTC (e.g. the WebRTC Network Limiter extension in Chrome, or media.peerconnection.enabled=false in Firefox). Camera, microphone, location and notification permission states are listed too.",
      ],
    },
  },
  "/browser/fingerprint": {
    related: [
      "/browser/consistency",
      "/browser/automation",
      "/browser/privacy",
    ],
    zh: {
      h: "浏览器指纹检测",
      intro: [
        "浏览器指纹是网站根据 Canvas、WebGL、字体、屏幕、时区、语言、硬件并发数等特征计算出的标识，即使清除 Cookie 也可能持续识别同一设备。本页使用开源 FingerprintJS 计算指纹，并展示参与计算的各项组成，可多次检测对比变化，帮助你评估隐私插件或指纹浏览器的效果。所有计算在本地完成。",
      ],
    },
    en: {
      h: "Browser fingerprint check",
      intro: [
        "A browser fingerprint is an identifier derived from Canvas, WebGL, fonts, screen, time zone, language, hardware concurrency and more; it can follow a device even after cookies are cleared. This page computes one with open-source FingerprintJS, shows every component, and lets you compare repeated runs to evaluate privacy extensions or anti-detect browsers. Everything runs locally.",
      ],
    },
  },
  "/docs/api": {
    related: ["/network/ip", "/"],
    zh: {
      h: "我的 IP 信息 API",
      intro: [
        "最简单的用法：curl ip.minispacex.com 或 curl ip.minispacex.com/ip 返回纯文本出口 IP。需要更多信息时，调用 /api/ip/health 返回 JSON（出口 IP、位置、ASN、信誉分与风险标记），加 ?format=text 返回适合终端阅读的文本，加 ?ip=8.8.8.8 查询指定地址。接口有频率限制，请勿用于高并发批量查询。",
      ],
    },
    en: {
      h: "My IP information API",
      intro: [
        "Simplest form: curl ip.minispacex.com or curl ip.minispacex.com/ip prints your egress IP. For details, /api/ip/health returns JSON (egress IP, location, ASN, reputation score, risk flags); add ?format=text for terminal output or ?ip=8.8.8.8 for a specific address. Requests are rate-limited; please do not use it for bulk lookups.",
      ],
    },
  },
};

/** Well-known public resolver IPs with curated, indexable pages. */
export const popularIps: Record<string, { zh: string; en: string }> = {
  "1.1.1.1": {
    zh: "Cloudflare 公共 DNS（1.1.1.1）主地址，主打隐私与速度，支持 DoH/DoT，由 Cloudflare 全球 Anycast 网络提供服务。",
    en: "Cloudflare's primary public DNS resolver, focused on privacy and speed, with DoH/DoT, served from Cloudflare's global anycast network.",
  },
  "1.0.0.1": {
    zh: "Cloudflare 公共 DNS 的备用地址，与 1.1.1.1 搭配使用。",
    en: "Cloudflare's secondary public DNS address, paired with 1.1.1.1.",
  },
  "8.8.8.8": {
    zh: "Google Public DNS 主地址，全球使用最广的公共 DNS 之一，属于 AS15169（Google LLC），Anycast 部署。",
    en: "Google Public DNS primary address, one of the most used resolvers worldwide, announced by AS15169 (Google LLC) via anycast.",
  },
  "8.8.4.4": {
    zh: "Google Public DNS 备用地址，与 8.8.8.8 搭配使用。",
    en: "Google Public DNS secondary address, paired with 8.8.8.8.",
  },
  "9.9.9.9": {
    zh: "Quad9 公共 DNS，由非营利组织运营，默认拦截已知恶意域名。",
    en: "Quad9 public DNS, run by a non-profit, blocking known malicious domains by default.",
  },
  "114.114.114.114": {
    zh: "114DNS 公共 DNS，中国大陆老牌公共解析服务，适合国内网络使用。",
    en: "114DNS, a long-standing public resolver in mainland China.",
  },
  "223.5.5.5": {
    zh: "阿里云公共 DNS（AliDNS）主地址，国内解析速度快，支持 DoH/DoT。",
    en: "Alibaba Cloud public DNS (AliDNS) primary address, fast within mainland China, supports DoH/DoT.",
  },
  "223.6.6.6": {
    zh: "阿里云公共 DNS 备用地址，与 223.5.5.5 搭配使用。",
    en: "AliDNS secondary address, paired with 223.5.5.5.",
  },
  "119.29.29.29": {
    zh: "腾讯 DNSPod 公共 DNS，国内常用公共解析服务之一。",
    en: "Tencent DNSPod public DNS, widely used in mainland China.",
  },
  "180.76.76.76": { zh: "百度公共 DNS。", en: "Baidu public DNS." },
  "208.67.222.222": {
    zh: "Cisco OpenDNS 公共 DNS，提供可选的内容过滤。",
    en: "Cisco OpenDNS public resolver with optional content filtering.",
  },
};
