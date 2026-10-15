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
export function assessIpRecord(data: Record<string, unknown>) {
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
  };
}
