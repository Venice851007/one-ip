// Multi-source IP geolocation with edge caching. No single upstream is required:
// each provider is tried in order and the first usable answer wins.
// Free-tier terms (checked 2026-11):
//  - ipwho.is (ipwhois.io free endpoint): 1,000 req/day per client IP, no key, commercial use allowed.
//  - GeoJS (get.geojs.io): free, no key, no published rate limit, CORS/HTTPS.
//  - ipapi.is: anonymous 30 req/day; with IPAPI_IS_KEY 1,000 req/day, commercial use explicitly allowed.
// ip.sb's free API asks commercial products to buy a plan, so the Worker no longer calls it.
import { HttpError, publicIp, upstream } from "./http.js";

const num = (v) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const asnNum = (v) => {
  if (Number.isInteger(v)) return v;
  const m = typeof v === "string" && v.match(/^(?:AS)?(\d+)/i);
  return m ? Number(m[1]) : undefined;
};

export const providers = [
  {
    name: "ipwho.is",
    url: (ip) => `https://ipwho.is/${encodeURIComponent(ip)}`,
    parse: (d) =>
      d?.success
        ? {
            country: str(d.country),
            country_code: str(d.country_code),
            region: str(d.region),
            city: str(d.city),
            isp: str(d.connection?.isp) ?? str(d.connection?.org),
            asn: asnNum(d.connection?.asn),
            latitude: num(d.latitude),
            longitude: num(d.longitude),
            timezone: str(d.timezone?.id),
          }
        : null,
  },
  {
    name: "GeoJS",
    url: (ip) =>
      `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`,
    parse: (d) =>
      d?.country || d?.organization_name
        ? {
            country: str(d.country),
            country_code: str(d.country_code),
            region: str(d.region),
            city: str(d.city),
            isp: str(d.organization_name),
            asn: asnNum(d.asn),
            latitude: num(d.latitude),
            longitude: num(d.longitude),
            timezone: str(d.timezone),
          }
        : null,
  },
  {
    name: "ipapi.is",
    url: (ip, env) =>
      `https://api.ipapi.is/?q=${encodeURIComponent(ip)}${env?.IPAPI_IS_KEY ? `&key=${encodeURIComponent(env.IPAPI_IS_KEY)}` : ""}`,
    parse: (d) =>
      d?.ip && !d.is_bogon
        ? {
            country: str(d.country) ?? str(d.location?.country),
            country_code: str(d.location?.country_code),
            region: str(d.region) ?? str(d.location?.state),
            city: str(d.city) ?? str(d.location?.city),
            isp: str(
              typeof d.company === "string" ? d.company : d.company?.name,
            ),
            asn: asnNum(typeof d.asn === "object" ? d.asn?.asn : d.asn),
            latitude: num(d.lat ?? d.location?.latitude),
            longitude: num(d.lon ?? d.location?.longitude),
            timezone: str(d.timezone ?? d.location?.timezone),
          }
        : null,
  },
];

function clean(geo) {
  return Object.fromEntries(
    Object.entries(geo).filter(([, v]) => v !== undefined),
  );
}

const cacheKey = (kind, id) =>
  new Request(
    `https://cache.ip-tools.internal/${kind}/${encodeURIComponent(id)}`,
  );
const edgeCache = () => (typeof caches !== "undefined" ? caches.default : null);

/** Read-through Cache API helper; failures to cache never fail the request. */
export async function cached(kind, id, ttl, load) {
  const cache = edgeCache();
  const key = cacheKey(kind, id);
  if (cache) {
    const hit = await cache.match(key).catch(() => undefined);
    if (hit) return hit.json();
  }
  const value = await load();
  if (cache)
    await cache
      .put(
        key,
        Response.json(value, {
          headers: { "Cache-Control": `public, max-age=${ttl}` },
        }),
      )
      .catch(() => {});
  return value;
}

/** Try each provider in order; returns { ...geo, source, sources_tried }. */
export async function geoFallback(ip, env, list = providers) {
  publicIp(ip);
  return cached(
    `geo-${list.map((p) => p.name).join("+")}`,
    ip,
    6 * 3600,
    async () => {
      const tried = [];
      let limited = false;
      for (const p of list) {
        tried.push(p.name);
        try {
          const geo = p.parse(await upstream(p.url(ip, env)));
          if (geo && (geo.country || geo.isp))
            return { ip, ...clean(geo), source: p.name, sources_tried: tried };
        } catch (error) {
          if (error instanceof HttpError && error.status === 429)
            limited = true;
        }
      }
      if (limited) throw new HttpError(429, "外部数据源限流，请稍后重试");
      throw new HttpError(502, "所有 IP 归属地数据源暂不可用，请稍后重试");
    },
  );
}

/** Cached proxy for ip.net.coffee reputation data (browser no longer calls it directly). */
export async function coffeeReputation(ip) {
  publicIp(ip);
  return cached("coffee", ip, 1800, () =>
    upstream(`https://ip.net.coffee/api/ip/lookup/${encodeURIComponent(ip)}`, {
      redirect: "manual",
    }),
  );
}
