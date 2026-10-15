import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessIpRecord,
  explainIpAssessment,
} from "../src/lib/ip-assessment.ts";

const now = Date.parse("2026-10-15T04:00:00Z");
const current = "2026-10-15T03:00:00Z";
const base = {
  ip: "1.1.1.1",
  countryCode: "US",
  asn: 13335,
  trust_score: 100,
  isResidential: false,
  is_datacenter: true,
  is_mobile: false,
  is_vpn: false,
  is_proxy: false,
  is_tor: false,
  is_abuser: false,
  is_bogon: false,
  is_crawler: false,
};
const tor = (value, changes = {}) => ({
  id: "tor-project",
  name: "Tor Project",
  state: "available",
  capabilities: ["tor_exit"],
  fields: { tor_exit: value },
  dataset_updated_at: current,
  observed_at: value ? current : null,
  ...changes,
});
const explain = (data = base, sources = [], options = {}) =>
  explainIpAssessment(data, sources, { now, ...options });

test("a perfect provider score never clears abuse or threat records", () => {
  const result = explain({ ...base, is_abuser: true });
  assert.equal(result.summary, "review_records");
  assert.equal(result.abuse.reported, true);
  assert.equal(result.fields.abuse.support, "single");
  assert.equal(result.abuse.record_time, null);
  const threat = explain({
    ...base,
    intelligence: { threats: [{ label: "Abuse report", severity: "high" }] },
  });
  assert.deepEqual(threat.abuse.threats, ["Abuse report"]);
  assert.equal(threat.summary, "review_records");
});

test("network type and ASN identity do not become abuse or a safety percentage", () => {
  for (const change of [
    { is_datacenter: true },
    { isResidential: true, is_datacenter: false },
    { is_mobile: true },
    { is_crawler: true },
  ]) {
    const result = explain({ ...base, ...change });
    assert.equal(result.summary, "no_records_reported");
    assert.equal(result.asn.reputation, "not_assessed");
    assert.equal(result.coverage.independence, "not_verified");
    assert.equal(result.score, undefined);
    assert.equal(result.confidence, undefined);
  }
  assert.equal(
    explain({ ...base, isResidential: true }).summary,
    "review_conflicts",
  );
});

test("anonymous use is surfaced separately from malicious activity", () => {
  const result = explain({ ...base, is_vpn: true });
  assert.equal(result.summary, "anonymity_reported");
  assert.deepEqual(result.anonymity.detected, ["vpn_exit"]);
  assert.equal(result.abuse.reported, false);
  assert.equal(result.fields.vpn_exit.support, "single");
});

test("a positive official Tor record survives a provider disagreement", () => {
  const result = explain(base, [tor(true)]);
  assert.equal(result.summary, "review_conflicts");
  assert.deepEqual(result.coverage.conflicts, ["tor_exit"]);
  assert.deepEqual(result.anonymity.detected, ["tor_exit"]);
  assert.deepEqual(
    result.fields.tor_exit.reports.map((report) => report.value),
    [false, true],
  );
  assert.equal(result.fields.tor_exit.support, "multiple");
});

test("duplicate or incapable sources cannot corroborate VPN or abuse", () => {
  const lite = {
    id: "ipinfo-lite",
    name: "Spoofed source name",
    state: "available",
    capabilities: ["asn", "vpn_exit", "abuse"],
    fields: { asn: "AS13335", vpn_exit: true, abuse: true },
    dataset_updated_at: current,
  };
  const result = explain(base, [lite, lite, tor(false), tor(false)]);
  assert.equal(result.fields.asn.reports.length, 2);
  assert.equal(result.fields.asn.reports[1].name, "IPinfo Lite");
  assert.equal(result.fields.vpn_exit.support, "single");
  assert.equal(result.fields.abuse.state, "not_detected");
  assert.equal(result.fields.tor_exit.reports.length, 2);
});

test("stale, future, sample and unavailable data never create positive or negative findings", () => {
  const primary = { ...base, is_tor: undefined };
  for (const source of [
    tor(false, { dataset_updated_at: "2026-10-13T03:00:00Z" }),
    tor(false, { dataset_updated_at: "2026-10-16T03:00:00Z" }),
    tor(false, { dataset_updated_at: undefined }),
    tor(true, { observed_at: "2026-10-13T03:00:00Z" }),
    ...["stale", "sample", "unavailable", "not_configured", "no_record"].map(
      (state) => tor(false, { state }),
    ),
  ]) {
    const result = explain(primary, [source]);
    assert.equal(result.fields.tor_exit.state, "unknown");
    assert.equal(result.fields.tor_exit.support, "none");
    assert.equal(result.summary, "incomplete_evidence");
  }
});

test("query time does not replace unknown source dates or invent age decay", () => {
  const result = explain(base, [], { queriedAt: current });
  const record = result.fields.abuse.reports[0];
  assert.equal(record.queried_at, current.replace("Z", ".000Z"));
  assert.equal(record.dataset_updated_at, null);
  assert.equal(record.observed_at, null);
  assert.equal(result.abuse.record_time, null);
});

test("provider outage removes its cached records while retaining a current Tor result", () => {
  const result = explain({ ...base, is_abuser: true }, [tor(true)], {
    primaryAvailable: false,
  });
  assert.equal(result.abuse.reported, false);
  assert.equal(result.fields.abuse.state, "unknown");
  assert.equal(result.fields.tor_exit.state, "detected");
  assert.equal(result.fields.tor_exit.support, "single");
  assert.equal(result.summary, "anonymity_reported");
  assert.ok(
    Object.values(result.network.flags).every((value) => value === null),
  );
});

test("missing and malformed fields stay unknown instead of producing clean results", () => {
  const result = explain({
    ip: "1.1.1.1",
    is_vpn: "false",
    asn: -1,
    countryCode: "USA",
  });
  assert.equal(result.summary, "incomplete_evidence");
  assert.deepEqual(result.coverage, {
    available: 0,
    total: 6,
    unknown: ["country_code", "asn", "vpn_exit", "proxy", "tor_exit", "abuse"],
    conflicts: [],
    independence: "not_verified",
  });
});

test("informational labels are excluded, low scores remain attributable and public services are exempt from low-score alerts", () => {
  assert.equal(
    explain({
      ...base,
      intelligence: { threats: [{ label: "Mobile", severity: "info" }] },
    }).summary,
    "no_records_reported",
  );
  assert.equal(explain({ ...base, trust_score: 10 }).summary, "low_reference");
  assert.equal(
    explain({ ...base, trust_score: 10, is_public_service: true }).summary,
    "no_records_reported",
  );
  const apiAssessment = assessIpRecord({ ...base, is_abuser: true });
  assert.ok(apiAssessment.states.includes("abuse_record"));
  assert.equal(apiAssessment.explanation.summary, "review_records");
});
