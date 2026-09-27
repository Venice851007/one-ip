// FAQ copy shared by the pages and the Worker FAQPage structured data.
// Strings are Chinese source text; English comes from src/i18n/en.json.
export type FaqItem = { title: string; text: string };

export const whoisFaq: FaqItem[] = [
  {
    title: "可以查询哪些内容？",
    text: "支持域名、公网 IPv4、IPv6 和 AS 号（例如 AS15169）。域名只需填写名称，不要包含 https://、端口或路径。\n\n例如 qq.com、1.1.1.1、AS15169。查询 www.qq.com 等子域名不一定能得到独立注册记录；通常应输入实际注册的域名 qq.com。",
  },
  {
    title: "WHOIS 和 RDAP 有什么区别？",
    text: "两者都用于查询注册信息。本页使用返回结构化数据的 RDAP；域名由注册局提供数据，IP 和 ASN 由区域互联网注册机构提供数据。\n\n页面会按响应展示标识符、状态、名称服务器、事件时间及实体信息，不同注册机构提供的字段可能不同。原始 RDAP 数据入口可用于核对完整响应。",
  },
  {
    title: "为什么查询失败或没有结果？",
    text: "域名后缀可能尚无可用 RDAP 服务，也可能遇到未注册域名、上游限流或连接超时。查询失败不代表域名可以注册，请以注册商结果为准。\n\n先检查拼写和输入格式，再尝试原条件重新查询。若仅某个后缀失败，可能是该注册局服务不支持或暂不可用；不要通过反复高频点击来绕过上游限流。",
  },
  {
    title: "为什么看不到注册人或国家信息？",
    text: "上游可能未公开相关字段，或对联系人信息作了隐私处理。“未知”仅表示此次响应没有提供数据。\n\n域名记录中的国家通常属于注册或联系信息，不能用来判断网站服务器所在地。联系人标识符也未必是姓名；隐私代理或注册商实体可能代替注册人出现在响应中。",
  },
  {
    title: "域名状态与 DNS 服务器代表什么？",
    text: "transfer prohibited 表示限制转移，delete prohibited 表示限制删除，hold 表示暂停解析。DNS 服务器字段列出注册信息中的权威名称服务器，不代表当前网站服务器 IP。\n\nclient 前缀一般表示注册商设置的限制，server 前缀一般表示注册局设置的限制。转移锁并不表示网站不可访问；名称服务器列表也不直接表示你当前使用的递归 DNS。",
  },
  {
    title: "最近查询会自动更新吗？",
    text: "本浏览器分别保留最近 10 条 IP 和 WHOIS 成功查询。点击历史优先显示已保存结果及时间；需要最新信息时，再点击“查询”。清除站点数据会删除本地历史。\n\n同一查询成功更新后会覆盖旧结果并排到前面，超过 10 条会移除最早保存的记录。缓存不会后台自动更新，注册状态、DNS 或到期日期发生变化时应主动重新查询。",
  },
];

export const webrtcFaq: FaqItem[] = [
  {
    title: "WebRTC 泄露是怎么回事？",
    text: "WebRTC 通过 ICE/STUN 发现可用于点对点连接的地址。STUN 通常使用 UDP，如果代理仅接管 TCP，候选地址可能暴露另一条公网出口。本页只创建数据通道，不申请摄像头或麦克风权限。",
  },
  {
    title: "STUN 和 UDP 是什么？",
    text: "UDP 是无连接传输协议。STUN 服务器把它观察到的公网映射地址返回给客户端。本工具同时配置 Google 与 Cloudflare STUN，采集 ICE 候选并与 HTTP 出口对照；mDNS 隐藏的本地地址不会被误报为公网 IP。",
  },
  {
    title: "如何判断是否泄露了？",
    text: "出口不同仅说明 UDP 和 HTTP 路由不同，也可能是预期分流。请核对运营商、地区和代理规则。没有采集到公网地址可能是 UDP 被阻断或浏览器限制，不能据此断言安全。",
  },
  {
    title: "发现泄露了，怎么修？",
    text: "检查客户端 UDP 转发、TUN 接管和 IPv6 规则。Firefox 可在 about:config 中关闭 media.peerconnection.enabled；Brave 可禁用非代理 UDP。关闭 WebRTC 会影响视频会议等功能，优先修正代理路由。",
  },
  {
    title: "为什么代理模式和 TUN 模式检测结果不同？",
    text: "系统代理与虚拟网卡模式接管流量的范围不同。STUN 在某些代理模式下可能完全无法发出，在 TUN 模式下则能真实反映 UDP 路由。请同时检测 DNS，不能将单次 WebRTC 结果视为完整隐私审计。",
  },
];
