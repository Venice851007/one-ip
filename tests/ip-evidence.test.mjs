import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseTorExitList, TOR_MAX_AGE } from "../public/worker/ip-evidence.js";
import { assessIpRecord } from "../src/lib/ip-assessment.ts";
import {
  sourceObservations,
  compareField,
} from "../src/views/ip/source-evidence.ts";

const stamp = (time) =>
  new Date(time).toISOString().replace("T", " ").slice(0, 19);
const list = (time = Date.now()) =>
  `ExitNode EXAMPLE\nPublished ${stamp(time)}\nLastStatus ${stamp(time)}\nExitAddress 1.1.1.1 ${stamp(time)}\nExitAddress 2606:4700:4700:0:0:0:0:1111 ${stamp(time)}\n`;
let moduleId = 0;
const freshModule = () =>
  import(`../public/worker/ip-evidence.js?case=${moduleId++}`);
const request = new Request("https://example.com/api/ip/evidence/1.1.1.1");
async function withFetch(fetcher, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    return await run();
  } finally {
    globalThis.fetch = previous;
  }
}

test("Tor parser canonicalizes IPv6 and refuses HTML, empty data and future publications", () => {
  const now = Date.now();
  assert.ok(
    parseTorExitList(list(now), now).addresses.has("2606:4700:4700::1111"),
  );
  for (const body of [
    "<html>blocked</html>",
    "ExitNode TEST\nPublished broken",
    list(now + 600_000),
  ])
    assert.throws(() => parseTorExitList(body, now));
});

test("a fresh offline Tor snapshot works without an external fetch", async () => {
  const { ipEvidence } = await freshModule();
  await withFetch(
    async () => {
      throw new Error("must not fetch");
    },
    async () => {
      const result = await ipEvidence("1.1.1.1", request, {
        ASSETS: { fetch: async () => new Response(list()) },
      });
      assert.equal(result.sources[0].state, "available");
      assert.equal(result.sources[0].fields.tor_exit, true);
    },
  );
});

test("free endpoint shares Tor downloads, keeps unsupported fields absent and marks Lite unconfigured", async () => {
  const { ipEvidence } = await freshModule();
  let calls = 0;
  await withFetch(
    async (url, init) => {
      calls++;
      assert.equal(init.redirect, "manual");
      assert.equal(url, "https://check.torproject.org/exit-addresses");
      return new Response(list());
    },
    async () => {
      const [a, b] = await Promise.all([
        ipEvidence("1.1.1.1", request, {}),
        ipEvidence("8.8.8.8", request, {}),
      ]);
      assert.equal(calls, 1);
      assert.equal(a.sources[0].fields.tor_exit, true);
      assert.equal(b.sources[0].fields.tor_exit, false);
      assert.equal(a.sources[0].fields.vpn_exit, undefined);
      assert.equal(a.sources[1].state, "not_configured");
      assert.equal(a.reputation_scope, "single-provider");
      assert.ok(!JSON.stringify(a).includes("trust_score"));
    },
  );
});

test("stale and failed Tor data never become a negative finding, and failures back off", async () => {
  let module = await freshModule();
  await withFetch(
    async () => new Response(list(Date.now() - TOR_MAX_AGE - 1000)),
    async () => {
      const result = await module.ipEvidence("1.1.1.1", request, {});
      assert.equal(result.sources[0].state, "stale");
      assert.equal(result.sources[0].fields.tor_exit, null);
    },
  );
  module = await freshModule();
  let calls = 0;
  await withFetch(
    async () => {
      calls++;
      throw new Error("upstream body is private");
    },
    async () => {
      const a = await module.ipEvidence("1.1.1.1", request, {});
      await module.ipEvidence("8.8.8.8", request, {});
      assert.equal(calls, 1);
      assert.equal(a.sources[0].state, "unavailable");
      assert.equal(a.sources[0].fields.tor_exit, null);
      assert.ok(!JSON.stringify(a).includes("private"));
    },
  );
});

test("real official sample MMDB is decoded but excluded as sample, and mismatched manifests fail closed", async () => {
  const database = readFileSync(
    new URL("./fixtures/ipinfo-lite-sample.mmdb", import.meta.url),
  );
  let sha256 = createHash("sha256").update(database).digest("hex");
  const assets = () => ({
    fetch: async (req) =>
      new URL(req.url).pathname.endsWith(".json")
        ? Response.json({
            provider: "IPinfo Lite",
            license: "CC-BY-SA-4.0",
            dataset_updated_at: new Date().toISOString(),
            sha256,
          })
        : new Response(database),
  });
  await withFetch(
    async () => new Response(list()),
    async () => {
      let module = await freshModule();
      const result = await module.ipEvidence("1.1.1.1", request, {
        IPINFO_LITE_ENABLED: "true",
        ASSETS: assets(),
      });
      assert.equal(result.sources[1].fields.asn, "AS13335");
      assert.equal(result.sources[1].state, "sample");
      assert.equal(
        compareField(
          sourceObservations({ ip: "1.1.1.1", asn: 13335 }, result),
          "asn",
        ).count,
        1,
      );
      sha256 = "incorrect";
      module = await freshModule();
      const rejected = await module.ipEvidence("1.1.1.1", request, {
        IPINFO_LITE_ENABLED: "true",
        ASSETS: assets(),
      });
      assert.equal(rejected.sources[1].state, "unavailable");
      assert.deepEqual(rejected.sources[1].fields, {});
    },
  );
});

test("source comparison retains conflicting Tor records, ignores unsupported fields and rejects the wrong queried IP", () => {
  const coffee = {
    ip: "1.1.1.1",
    countryCode: "us",
    asn: 13335,
    is_tor: false,
    is_vpn: true,
  };
  const extra = {
    schema_version: 2,
    ip: "1.1.1.1",
    sources: [
      {
        id: "tor-project",
        name: "Tor",
        state: "available",
        capabilities: ["tor_exit"],
        fields: { tor_exit: true },
      },
      {
        id: "ipinfo-lite",
        name: "Lite",
        state: "available",
        capabilities: ["asn", "country_code"],
        fields: { asn: "AS13335", country_code: "US" },
      },
    ],
  };
  const sources = sourceObservations(coffee, extra);
  assert.equal(compareField(sources, "tor_exit").state, "different");
  assert.equal(compareField(sources, "tor_exit").detected, true);
  assert.equal(compareField(sources, "asn").state, "consistent");
  assert.equal(compareField(sources, "vpn_exit").count, 1);
  assert.equal(compareField(sources, "abuse").state, "unknown");
  assert.equal(
    compareField(
      sourceObservations(coffee, { ...extra, ip: "8.8.8.8" }),
      "tor_exit",
    ).count,
    1,
  );
  extra.sources[0].state = "stale";
  assert.equal(
    compareField(sourceObservations(coffee, extra), "tor_exit").count,
    1,
  );
  assert.equal(
    compareField(
      sourceObservations(coffee, undefined, undefined, "unavailable"),
      "vpn_exit",
    ).count,
    0,
  );
});

test("perfect reference score cannot erase abuse, and residential proxy is not a network type conflict", () => {
  const clear = {
    is_vpn: false,
    is_proxy: false,
    is_tor: false,
    is_crawler: false,
    is_abuser: false,
    is_bogon: false,
  };
  const flagged = assessIpRecord({
    ...clear,
    trust_score: 100,
    is_abuser: true,
  });
  assert.ok(flagged.states.includes("abuse_record"));
  assert.ok(!flagged.states.includes("no_flags_reported"));
  const residentialProxy = assessIpRecord({
    ...clear,
    isResidential: true,
    is_datacenter: false,
    is_proxy: true,
  });
  assert.ok(residentialProxy.states.includes("network_usage_flag"));
  assert.ok(!residentialProxy.states.includes("type_conflict"));
  assert.ok(assessIpRecord({}).states.includes("incomplete_flags"));
  assert.ok(
    assessIpRecord({
      ...clear,
      isResidential: true,
      is_datacenter: true,
    }).states.includes("type_conflict"),
  );
});
