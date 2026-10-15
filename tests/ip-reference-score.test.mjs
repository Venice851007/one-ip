import assert from "node:assert/strict";
import { test } from "node:test";
import {
  explainIpAssessment,
  scoreIpEvidence,
} from "../src/lib/ip-assessment.ts";

const now = Date.parse("2026-10-15T04:00:00Z");
const stamp = "2026-10-15T03:00:00Z";
const base = {
  ip: "1.1.1.1",
  trust_score: 95,
  countryCode: "US",
  asn: 13335,
  isResidential: true,
  is_datacenter: false,
  is_vpn: false,
  is_proxy: false,
  is_tor: false,
  is_abuser: false,
  is_bogon: false,
  is_crawler: false,
};
const drop = (listed = false, changes = {}) => ({
  id: "spamhaus-asndrop",
  name: "Spamhaus ASN-DROP",
  state: "available",
  capabilities: ["asn_drop"],
  fields: { asn: "AS13335", asn_drop: listed },
  dataset_updated_at: stamp,
  ...changes,
});
const score = (data = base, sources = [], options = {}) =>
  scoreIpEvidence(
    data,
    explainIpAssessment(data, [...sources, drop()], { now, ...options }),
    options,
  );
const tor = (value, changes = {}) => ({
  id: "tor-project",
  name: "Tor Project",
  state: "available",
  capabilities: ["tor_exit"],
  fields: { tor_exit: value },
  dataset_updated_at: stamp,
  observed_at: value ? stamp : null,
  ...changes,
});

test("single-provider scores are capped at 79 without changing original values", () => {
  for (const trust_score of [0, 41, 49, 50, 79, 80, 85, 95, 100]) {
    const result = score({ ...base, trust_score });
    assert.equal(result.value, Math.min(trust_score, 79));
    assert.equal(result.original.value, trust_score);
    assert.equal(result.calibration, "heuristic_unvalidated");
  }
  assert.equal(score({ ...base, trust_score: 79.9 }).value, 79);
});

test("risk/use ceilings take the strictest limit rather than adding deductions", () => {
  for (const [flag, ceiling] of [
    ["is_abuser", 20],
    ["is_tor", 40],
    ["is_proxy", 50],
    ["is_vpn", 60],
    ["is_crawler", 70],
    ["is_bogon", 10],
  ]) {
    const result = score({ ...base, trust_score: 100, [flag]: true });
    assert.equal(result.value, ceiling, flag);
  }
  assert.equal(
    score({ ...base, is_tor: true, is_proxy: true, is_vpn: true }).value,
    40,
  );
  assert.equal(
    score({ ...base, is_abuser: true, is_tor: true, is_proxy: true }).value,
    20,
  );
  assert.equal(score({ ...base, trust_score: 5, is_abuser: true }).value, 5);
});

test("anonymous-only threat labels do not impose an additional abuse ceiling", () => {
  const proxy = score({
    ...base,
    is_proxy: true,
    intelligence: { threats: ["Open proxy", "Open proxy"] },
  });
  assert.equal(proxy.value, 50);
  assert.ok(
    !proxy.limits.some((limit) => limit.rule === "other_threat_record"),
  );
  assert.equal(
    score({ ...base, is_vpn: true, intelligence: { threats: ["VPN"] } }).value,
    60,
  );
  assert.equal(
    score({ ...base, intelligence: { threats: ["VPN"] } }).value,
    40,
  );
  assert.equal(
    score({
      ...base,
      intelligence: { threats: [{ label: "Mobile", severity: "info" }] },
    }).value,
    79,
  );
  assert.equal(
    score({ ...base, intelligence: { threats: ["Malware report"] } }).value,
    40,
  );
});

test("confirmed anonymous-use labels do not become abuse in the primary conclusion", () => {
  const data = {
    ...base,
    is_vpn: true,
    intelligence: { threats: ["VPN", "VPN"] },
  };
  const assessment = explainIpAssessment(data, [], { now });
  assert.equal(assessment.summary, "anonymity_reported");
  assert.deepEqual(assessment.abuse.threats, []);
  assert.equal(scoreIpEvidence(data, assessment).value, 60);
  const unconfirmed = explainIpAssessment({ ...data, is_vpn: false }, [], {
    now,
  });
  assert.equal(unconfirmed.summary, "review_records");
  assert.equal(
    scoreIpEvidence({ ...data, is_vpn: false }, unconfirmed).value,
    40,
  );
});

test("free Tor positives survive provider disagreement while stale records never lower the anonymity ceiling", () => {
  const result = score(base, [tor(true), tor(true)]);
  assert.equal(result.value, 40);
  assert.equal(
    result.limits.filter((limit) => limit.rule === "tor_exit").length,
    1,
  );
  const stale = score(base, [
    tor(true, { dataset_updated_at: "2026-10-13T03:00:00Z" }),
  ]);
  assert.equal(stale.value, 60);
  assert.ok(!stale.limits.some((limit) => limit.rule === "tor_exit"));
});

test("missing fields and conflicts limit an otherwise high score", () => {
  assert.equal(score({ ...base, is_vpn: undefined }).value, 60);
  assert.equal(score({ ...base, is_datacenter: true }).value, 60);
  assert.equal(score(base, [tor(false, { state: "unavailable" })]).value, 60);
  assert.equal(
    score({ ...base, is_proxy: undefined, is_abuser: true }).value,
    20,
  );
});

test("network type and geography corroboration do not create extra reputation points", () => {
  const lite = {
    id: "ipinfo-lite",
    name: "IPinfo Lite",
    state: "available",
    capabilities: ["country_code", "asn"],
    fields: { country_code: "US", asn: "AS13335" },
    dataset_updated_at: stamp,
  };
  for (const changes of [
    {},
    { isResidential: false, is_datacenter: true },
    { is_mobile: true },
    { is_public_service: true },
  ]) {
    const result = score({ ...base, ...changes }, [lite, tor(false)]);
    assert.equal(result.value, 79);
    assert.equal(result.dimensions.asn, "blocklist_evidence_ceiling");
    assert.equal(result.dimensions.network, "context_only");
  }
});

test("no valid provider score or insufficient risk fields never receives an invented score", () => {
  for (const trust_score of [undefined, null, NaN, Infinity, -1, 101, "95"]) {
    const result = score({ ...base, trust_score });
    assert.equal(result.value, null);
    assert.equal(result.band, "unavailable");
  }
  assert.equal(score({ ip: "1.1.1.1", trust_score: 100 }).value, null);
  assert.equal(
    score(base, [tor(true)], { primaryAvailable: false }).value,
    null,
  );
  assert.equal(score({ trust_score: 100, is_abuser: true }).value, 20);
});

test("score bands follow the published 80/50 display thresholds", () => {
  for (const [value, band] of [
    [0, "review"],
    [49, "review"],
    [50, "caution"],
    [79, "caution"],
    [80, "caution"],
    [100, "caution"],
  ])
    assert.equal(score({ ...base, trust_score: value }).band, band);
});

test("ASN list hits cap the score without inventing individual IP abuse", () => {
  const assessment = explainIpAssessment(base, [drop(true)], { now });
  const result = scoreIpEvidence(base, assessment);
  assert.equal(result.value, 20);
  assert.equal(assessment.asn.reputation, "risk_listed");
  assert.equal(assessment.abuse.reported, false);
  assert.equal(assessment.summary, "review_records");
  assert.ok(result.limits.some((item) => item.rule === "asn_drop_record"));
  assert.equal(score(base, [drop(false)]).value, 79);
});

test("missing, stale, mismatched and conflicting ASN evidence never earns high scores or a list finding", () => {
  const none = explainIpAssessment(base, [], { now });
  assert.equal(scoreIpEvidence(base, none).value, 60);
  for (const source of [
    drop(true, { state: "unavailable" }),
    drop(true, { dataset_updated_at: "2026-10-13T00:00:00Z" }),
    drop(true, { dataset_updated_at: "2026-10-16T00:00:00Z" }),
    drop(true, { fields: { asn: "AS245", asn_drop: true } }),
    drop(true, { capabilities: ["asn"] }),
  ]) {
    const assessment = explainIpAssessment(base, [source], { now });
    assert.equal(assessment.asn.drop.listed, null);
    assert.equal(scoreIpEvidence(base, assessment).value, 60);
  }
  const lite = {
    id: "ipinfo-lite",
    name: "Lite",
    state: "available",
    capabilities: ["asn"],
    fields: { asn: "AS245" },
    dataset_updated_at: stamp,
  };
  const conflict = explainIpAssessment(base, [drop(true), lite], { now });
  assert.equal(conflict.asn.reputation, "mapping_conflict");
  assert.equal(conflict.asn.drop.listed, null);
  assert.equal(scoreIpEvidence(base, conflict).value, 60);
});

test("CIRCL ranking is dated ASN context and never a direct IP penalty or bonus", () => {
  for (const rank of [0, 0.0001, 10]) {
    const source = {
      id: "circl-bgp",
      name: "CIRCL",
      state: "available",
      capabilities: ["asn_ranking"],
      dataset_updated_at: "2026-10-14T00:00:00Z",
      fields: {
        asn: "AS13335",
        asn_rank: rank,
        asn_position: 2,
        asn_total: 100,
      },
    };
    const assessment = explainIpAssessment(base, [drop(false), source], {
      now,
    });
    assert.equal(assessment.asn.ranking.rank, rank);
    assert.equal(assessment.asn.ranking.date, "2026-10-14");
    assert.equal(scoreIpEvidence(base, assessment).value, 79);
    source.fields.asn = "AS245";
    assert.equal(
      explainIpAssessment(base, [source], { now }).asn.ranking.rank,
      null,
    );
  }
});
