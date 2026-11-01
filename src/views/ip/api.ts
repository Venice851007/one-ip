import { t } from "@/i18n";
import { endpoint } from "@/lib/network";
import type { Geo } from "@/lib/types";
import { adaptCoffee, type CoffeeIp } from "./coffee.ts";

export async function lookupIp(ip: string, signal?: AbortSignal) {
  let data: CoffeeIp;
  try {
    // Proxied and edge-cached by the Worker so ad blockers / CORS do not break it.
    data = await endpoint<CoffeeIp>(
      `/ip/reputation/${encodeURIComponent(ip)}`,
      { signal },
    );
  } catch (error) {
    signal?.throwIfAborted();
    // Reputation source unavailable: show multi-source geo, hide the score.
    const geo = await endpoint<Geo>(`/geoip/${encodeURIComponent(ip)}`, {
      signal,
    }).catch(() => {
      throw error;
    });
    data = {
      ip: geo.ip ?? ip,
      country: geo.country,
      countryCode: geo.country_code,
      region: geo.region,
      city: geo.city,
      isp: geo.isp,
      asn: typeof geo.asn === "number" ? geo.asn : Number(geo.asn) || undefined,
      geo_sources: [
        {
          src: geo.source,
          country: geo.country,
          country_code: geo.country_code,
          region: geo.region,
          city: geo.city,
          lat: geo.latitude ?? null,
          lon: geo.longitude ?? null,
        },
      ],
    };
  }
  const normalize = (value: string) =>
    value.includes(":") ? new URL(`https://[${value}]/`).hostname : value;
  if (typeof data.ip !== "string" || normalize(data.ip) !== normalize(ip))
    throw new Error(t("IP 数据源返回的地址不匹配"));
  return adaptCoffee(data);
}
export const currentIp = (signal?: AbortSignal) =>
  endpoint<Geo>("/me", { signal });
