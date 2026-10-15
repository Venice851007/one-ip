import type { CoffeeIp } from "./coffee.ts";
import { sameIp } from "./scenario-evidence.ts";

export type SourceState =
  | "available"
  | "stale"
  | "not_configured"
  | "no_record"
  | "unavailable"
  | "sample";
export type SourceObservation = {
  id: string;
  name: string;
  source: string;
  license?: string;
  state: SourceState;
  capabilities: string[];
  fields: Record<string, string | boolean | null>;
  queried_at?: string;
  dataset_updated_at?: string;
  observed_at?: string | null;
};
export type FreeEvidence = {
  schema_version: 2;
  ip: string;
  sources: SourceObservation[];
};
export const evidenceFields = [
  "country_code",
  "asn",
  "tor_exit",
  "vpn_exit",
  "proxy",
  "abuse",
] as const;
export type EvidenceField = (typeof evidenceFields)[number];
const flag = (value: unknown) => (typeof value === "boolean" ? value : null);

export function sourceObservations(
  coffee: CoffeeIp,
  extra?: FreeEvidence,
  queriedAt?: string,
  primaryState: "available" | "unavailable" = "available",
): SourceObservation[] {
  const country = coffee.countryCode?.trim().toUpperCase();
  const existing: SourceObservation = {
    id: "net-coffee",
    name: "Net.Coffee",
    source: "https://ip.net.coffee/",
    state: primaryState,
    capabilities: [...evidenceFields],
    queried_at: queriedAt,
    fields: {
      country_code: country && /^[A-Z]{2}$/.test(country) ? country : null,
      asn:
        Number.isInteger(coffee.asn) && coffee.asn! > 0
          ? `AS${coffee.asn}`
          : null,
      tor_exit: flag(coffee.is_tor),
      vpn_exit: flag(coffee.is_vpn),
      proxy: flag(coffee.is_proxy),
      abuse: flag(coffee.is_abuser),
    },
  };
  const extras =
    extra?.schema_version === 2 &&
    sameIp(extra.ip, coffee.ip) &&
    Array.isArray(extra.sources)
      ? extra.sources.filter((source) =>
          ["ipinfo-lite", "tor-project"].includes(source.id),
        )
      : [];
  return [
    existing,
    ...["ipinfo-lite", "tor-project"].map(
      (id) =>
        extras.find((source) => source.id === id) ?? {
          id,
          name: id === "ipinfo-lite" ? "IPinfo Lite" : "Tor Project",
          source:
            id === "ipinfo-lite"
              ? "https://ipinfo.io/developers/ipinfo-lite-database"
              : "https://metrics.torproject.org/collector.html",
          state: "unavailable" as const,
          capabilities:
            id === "ipinfo-lite" ? ["country_code", "asn"] : ["tor_exit"],
          fields: {},
        },
    ),
  ];
}

export function compareField(
  sources: SourceObservation[],
  field: EvidenceField,
) {
  const observations = sources
    .filter(
      (source) =>
        source.state === "available" && source.capabilities.includes(field),
    )
    .map((source) => ({ source: source.id, value: source.fields[field] }))
    .filter(
      (item) =>
        typeof item.value === "boolean" ||
        (typeof item.value === "string" && item.value.length > 0),
    );
  const different = new Set(observations.map((item) => item.value)).size > 1;
  const detected = observations.some((item) => item.value === true);
  return {
    count: observations.length,
    detected,
    state: different
      ? ("different" as const)
      : observations.length >= 2
        ? ("consistent" as const)
        : observations.length === 1
          ? ("single" as const)
          : ("unknown" as const),
  };
}
