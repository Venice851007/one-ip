import { geoFallback, providers } from "./geo-sources.js";

export function cfGeo(request) {
  const cf = request.cf ?? {};
  return {
    ip: request.headers.get("CF-Connecting-IP") ?? "",
    country: cf.country,
    country_code: cf.country,
    region: cf.region,
    city: cf.city,
    isp: cf.asOrganization,
    asn: cf.asn,
    latitude: cf.latitude ? Number(cf.latitude) : undefined,
    longitude: cf.longitude ? Number(cf.longitude) : undefined,
    timezone: cf.timezone,
    source: "Cloudflare request.cf",
  };
}
/** Primary geo: multi-source fallback (ipwho.is → GeoJS → ipapi.is), edge-cached. */
export async function geoIp(ip, env) {
  const { sources_tried: _tried, ...geo } = await geoFallback(ip, env);
  return geo;
}
/** Secondary opinion for comparison: first provider other than the primary. */
export async function secondaryGeo(ip, env, primarySource) {
  const rest = providers.filter(
    (p) => p.name !== (primarySource ?? "ipwho.is"),
  );
  const { sources_tried: _tried, ...geo } = await geoFallback(
    ip,
    env,
    rest,
  ).catch(() => {
    throw new Error("第二归属地数据源未返回结果");
  });
  return geo;
}
