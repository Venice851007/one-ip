// Plain-text "what is my IP" for terminals: `curl ip.minispacex.com`, `wget -qO- …/ip`.
const CLI =
  /^(curl|wget|httpie|fetch|powershell|libfetch|aria2|xh)\b|WindowsPowerShell/i;

export function isCliAgent(ua) {
  return CLI.test(ua ?? "");
}

export function plainIpResponse(request, url) {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const ua = request.headers.get("User-Agent");
  const wantsPlain =
    path === "/ip" || (path === "/" && isCliAgent(ua) && !url.search);
  if (!wantsPlain) return null;
  const ip = request.headers.get("CF-Connecting-IP");
  return new Response(ip ? `${ip}\n` : "unknown\n", {
    status: ip ? 200 : 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "User-Agent",
    },
  });
}
