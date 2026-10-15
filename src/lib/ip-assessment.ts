export function referenceScore(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
    ? value
    : null;
}
export function referenceBand(value: unknown) {
  const score = referenceScore(value);
  return score === null
    ? "unknown"
    : score >= 75
      ? "good"
      : score >= 45
        ? "moderate"
        : "poor";
}
export function assessIpRecord(
  data: Record<string, unknown>,
  queriedAt?: string,
) {
  const keys = [
    "is_vpn",
    "is_proxy",
    "is_tor",
    "is_crawler",
    "is_abuser",
    "is_bogon",
  ];
  const unknown = keys.filter((key) => typeof data[key] !== "boolean");
  const states: string[] = [];
  if (data.is_abuser === true) states.push("abuse_record");
  if (data.is_bogon === true) states.push("bogon_record");
  if (
    ["is_vpn", "is_proxy", "is_tor", "is_crawler"].some(
      (key) => data[key] === true,
    )
  )
    states.push("network_usage_flag");
  if (data.isResidential === true && data.is_datacenter === true)
    states.push("type_conflict");
  const intelligence = data.intelligence as { threats?: unknown } | undefined;
  if (
    Array.isArray(intelligence?.threats) &&
    intelligence.threats.some((value) =>
      typeof value === "string"
        ? value.trim().length > 0
        : value &&
          typeof value === "object" &&
          typeof value.label === "string" &&
          value.label.trim().length > 0 &&
          (typeof value.severity !== "string" ||
            value.severity.toLowerCase() !== "info"),
    )
  )
    states.push("threat_record");
  if (
    referenceBand(data.trust_score) === "poor" &&
    data.is_public_service !== true
  )
    states.push("low_provider_score");
  if (unknown.length) states.push("incomplete_flags");
  if (!states.length) states.push("no_flags_reported");
  return {
    scope: "single-provider",
    states,
    unknown_fields: unknown,
    rule_version: "provider-evidence-v2",
    explanation: explainIpAssessment(data, [], { queriedAt }),
  };
}

export type AssessmentSource = {
  id: string;
  name: string;
  state: string;
  capabilities: readonly string[];
  fields: Record<string, unknown>;
  queried_at?: string;
  dataset_updated_at?: string;
  observed_at?: string | null;
};

const fieldKeys = [
  "country_code",
  "asn",
  "vpn_exit",
  "proxy",
  "tor_exit",
  "abuse",
] as const;
type AssessmentField = (typeof fieldKeys)[number];
const booleanFields = new Set<string>([
  "vpn_exit",
  "proxy",
  "tor_exit",
  "abuse",
]);
const sourceNames: Record<string, string> = {
  "net-coffee": "Net.Coffee",
  "tor-project": "Tor Project",
  "ipinfo-lite": "IPinfo Lite",
};

/** Explain evidence without assigning an invented aggregate safety score.
 * Source counts describe reporting services; upstream independence is unknown.
 * Query time is never substituted for the date of an observation or dataset.
 */
export function explainIpAssessment(
  input: Record<string, unknown>,
  extra: readonly AssessmentSource[] = [],
  options: {
    primaryAvailable?: boolean;
    queriedAt?: string;
    now?: number;
  } = {},
) {
  const now = options.now ?? Date.now();
  const primaryAvailable = options.primaryAvailable !== false;
  const data = primaryAvailable ? input : {};
  const date = (value: unknown) => {
    if (typeof value !== "string") return null;
    const time = Date.parse(value);
    return Number.isFinite(time) && time <= now + 300_000
      ? new Date(time).toISOString()
      : null;
  };
  const country =
    typeof data.countryCode === "string"
      ? data.countryCode.trim().toUpperCase()
      : "";
  const sources: AssessmentSource[] = [
    {
      id: "net-coffee",
      name: "Net.Coffee",
      state: primaryAvailable ? "available" : "unavailable",
      capabilities: [...fieldKeys],
      fields: {
        country_code: /^[A-Z]{2}$/.test(country) ? country : null,
        asn:
          Number.isInteger(data.asn) && Number(data.asn) > 0
            ? `AS${data.asn}`
            : null,
        vpn_exit: data.is_vpn,
        proxy: data.is_proxy,
        tor_exit: data.is_tor,
        abuse: data.is_abuser,
      },
      queried_at: options.queriedAt,
    },
  ];
  // Only the existing integrations can corroborate fields; duplicates and
  // unsupported claims from a geography-only database never gain a vote.
  for (const id of ["ipinfo-lite", "tor-project"]) {
    const source = extra.find((item) => item.id === id);
    if (!source) continue;
    const maximumAge = (id === "tor-project" ? 1 : 7) * 86_400_000;
    const updated = date(source.dataset_updated_at);
    const observed = date(source.observed_at);
    const expired =
      !updated ||
      now - Date.parse(updated) > maximumAge ||
      (id === "tor-project" &&
        source.fields.tor_exit === true &&
        (!observed || now - Date.parse(observed) > maximumAge));
    sources.push({
      ...source,
      name: sourceNames[id],
      state: source.state === "available" && expired ? "stale" : source.state,
      capabilities: source.capabilities.filter((field) =>
        (id === "tor-project"
          ? ["tor_exit"]
          : ["country_code", "asn"]
        ).includes(field),
      ),
    });
  }
  const fields = Object.fromEntries(
    fieldKeys.map((key) => {
      const reports = sources.flatMap((source) => {
        if (source.state !== "available" || !source.capabilities.includes(key))
          return [];
        const value = source.fields[key];
        if (
          booleanFields.has(key)
            ? typeof value !== "boolean"
            : key === "asn"
              ? typeof value !== "string" || !/^AS[1-9]\d*$/.test(value)
              : typeof value !== "string" || !/^[A-Z]{2}$/.test(value)
        )
          return [];
        return [
          {
            source: source.id,
            name: source.name,
            value: value as string | boolean,
            queried_at: date(source.queried_at),
            dataset_updated_at: date(source.dataset_updated_at),
            observed_at: date(source.observed_at),
          },
        ];
      });
      const conflict = new Set(reports.map((report) => report.value)).size > 1;
      return [
        key,
        {
          state: conflict
            ? "conflict"
            : reports.length === 0
              ? "unknown"
              : booleanFields.has(key)
                ? reports[0].value === true
                  ? "detected"
                  : "not_detected"
                : "reported",
          support:
            reports.length >= 2
              ? "multiple"
              : reports.length === 1
                ? "single"
                : "none",
          reports,
        },
      ];
    }),
  ) as Record<
    AssessmentField,
    {
      state: "conflict" | "unknown" | "detected" | "not_detected" | "reported";
      support: "multiple" | "single" | "none";
      reports: {
        source: string;
        name: string;
        value: string | boolean;
        queried_at: string | null;
        dataset_updated_at: string | null;
        observed_at: string | null;
      }[];
    }
  >;
  const flags = [
    "isResidential",
    "is_datacenter",
    "is_mobile",
    "is_public_service",
    "is_crawler",
  ] as const;
  const network = Object.fromEntries(
    flags.map((key) => [
      key,
      typeof data[key] === "boolean" ? data[key] : null,
    ]),
  );
  const typeConflict =
    data.isResidential === true && data.is_datacenter === true;
  const intelligence = data.intelligence as { threats?: unknown } | undefined;
  const threats = Array.isArray(intelligence?.threats)
    ? intelligence.threats.flatMap((threat) => {
        if (typeof threat === "string")
          return threat.trim() ? [threat.trim()] : [];
        if (
          !threat ||
          typeof threat !== "object" ||
          typeof threat.label !== "string" ||
          (typeof threat.severity === "string" &&
            threat.severity.toLowerCase() === "info")
        )
          return [];
        return threat.label.trim() ? [threat.label.trim()] : [];
      })
    : [];
  const anonymityKeys = ["vpn_exit", "proxy", "tor_exit"] as const;
  const detectedAnonymity = anonymityKeys.filter((key) =>
    fields[key].reports.some((report) => report.value === true),
  );
  const conflicts = fieldKeys.filter((key) => fields[key].state === "conflict");
  const unknown = fieldKeys.filter((key) => fields[key].state === "unknown");
  const abuseReported = fields.abuse.reports.some(
    (report) => report.value === true,
  );
  const bogon = typeof data.is_bogon === "boolean" ? data.is_bogon : null;
  const needsReview = abuseReported || threats.length > 0 || bogon === true;
  const lowReference =
    referenceBand(data.trust_score) === "poor" &&
    data.is_public_service !== true;
  const summary = needsReview
    ? "review_records"
    : conflicts.length || typeConflict
      ? "review_conflicts"
      : detectedAnonymity.length
        ? "anonymity_reported"
        : lowReference
          ? "low_reference"
          : anonymityKeys.some((key) => fields[key].state === "unknown") ||
              fields.abuse.state === "unknown" ||
              bogon === null
            ? "incomplete_evidence"
            : "no_records_reported";
  return {
    rule_version: "evidence-explanation-v1",
    summary,
    // This is field availability, never a confidence or safety percentage.
    coverage: {
      available: fieldKeys.length - unknown.length,
      total: fieldKeys.length,
      unknown,
      conflicts,
      independence: "not_verified",
    },
    network: { flags: network, type_conflict: typeConflict },
    anonymity: { detected: detectedAnonymity },
    abuse: {
      reported: abuseReported,
      threats: [...new Set(threats)],
      bogon,
      record_time: null,
    },
    asn: { reputation: "not_assessed" },
    fields,
  };
}
