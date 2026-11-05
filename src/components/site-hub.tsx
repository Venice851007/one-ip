const LINKS = [
  { id: "blog", name: "博客", url: "https://www.minispacex.com" },
  { id: "tools", name: "工具箱", url: "https://go.minispacex.com" },
  { id: "mail", name: "临时邮箱", url: "https://mail.5201616.xyz" },
  { id: "otp", name: "OTP", url: "https://otp.minispacex.com" },
  { id: "tarot", name: "打工人塔罗", url: "https://tarot.minispacex.com" },
  { id: "air", name: "苍穹打击者", url: "https://air.minispacex.com" },
  { id: "brick", name: "方块轮回", url: "https://brick.minispacex.com" },
  { id: "dola", name: "DoLa", url: "https://dola.minispacex.com/" },
  { id: "address", name: "美区地址", url: "https://address.minispacex.com" },
  { id: "ip", name: "IP 查询工具", url: "https://ip.minispacex.com" },
] as const;

const CURRENT = "ip";

/** Cross-site hub matching 「小磊哥の站点」 footers on sister properties. */
export function SiteHub() {
  return (
    <nav className="site-hub" aria-label="小磊哥の站点">
      <div className="site-hub__title">小磊哥の站点 · More</div>
      <ul className="site-hub__list">
        {LINKS.map((link) =>
          link.id === CURRENT ? (
            <li key={link.id}>
              <span className="is-current" aria-current="page">
                {link.name} · 当前
              </span>
            </li>
          ) : (
            <li key={link.id}>
              <a href={link.url} target="_blank" rel="noopener">
                {link.name}
              </a>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
