import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AIM_VERSION,
  ACCESS_VERSION,
  accessRating,
  summarizeAccessEvidence,
  endpointSummary,
  EVIDENCE_TTL,
  canonicalIp,
  sameIp,
  evidenceState,
  qualityRating,
  summarizeHttp,
} from "../src/views/ip/scenario-evidence.ts";
import {
  measurePlatform,
  measurePlatforms,
  ACCESS_BUDGET_MS,
} from "../src/views/ip/scenario-probes.ts";

const sample = (outcome) => ({ elapsedMs: 100, outcome });
function quality() {
  return {
    kind: "quality",
    queriedIp: "1.1.1.1",
    target: "speed.cloudflare.com",
    direction: "browser-outbound",
    source: AIM_VERSION,
    ruleVersion: AIM_VERSION,
    protocol: "HTTPS + WebRTC/UDP",
    addressFamily: "IPv4",
    startedAt: 1000,
    checkedAt: 2000,
    expiresAt: 2000 + EVIDENCE_TTL,
    state: "complete",
    egressBefore: "1.1.1.1",
    egressAfter: "1.1.1.1",
    samples: [],
    metrics: {
      latency: 10,
      jitter: 1,
      download: 100e6,
      upload: 50e6,
      packetLoss: 0,
      downLoadedLatency: 20,
      upLoadedLatency: 20,
    },
    raw: {
      latency: Array(20).fill(10),
      downLoaded: [20, 20, 20],
      upLoaded: [20, 20, 20],
      download: [100e6, 100e6, 100e6],
      upload: [50e6, 50e6, 50e6],
      packetsSent: 100,
      packetsLost: [],
    },
    aimScores: Object.fromEntries(
      ["streaming", "gaming", "rtc"].map((name) => [
        name,
        { classificationIdx: 4, classificationName: "great", points: 60 },
      ]),
    ),
  };
}
test("only complete, fresh, attributed AIM evidence produces stars", () => {
  for (const name of ["streaming", "gaming", "rtc"])
    assert.equal(qualityRating(quality(), "1.1.1.1", name, 2100).stars, 5);
  assert.equal(qualityRating(undefined, "1.1.1.1", "gaming", 2100).stars, null);
  assert.equal(
    qualityRating(quality(), "8.8.8.8", "gaming", 2100).state,
    "mismatch",
  );
  assert.equal(
    qualityRating(quality(), "1.1.1.1", "gaming", 302000).state,
    "expired",
  );
  for (const change of [
    { kind: "inbound", direction: "probe-inbound" },
    { state: "cancelled" },
    { ruleVersion: "future" },
    { target: "other.example" },
    { incomplete: true },
    { egressAfter: "8.8.8.8" },
    { egressBefore: undefined },
  ])
    assert.equal(
      qualityRating({ ...quality(), ...change }, "1.1.1.1", "gaming", 2100)
        .stars,
      null,
    );
});
test("missing packet loss is not upstream default points or zero loss", () => {
  const evidence = quality();
  delete evidence.metrics.packetLoss;
  assert.equal(qualityRating(evidence, "1.1.1.1", "gaming", 2100).stars, null);
  assert.ok(
    qualityRating(evidence, "1.1.1.1", "gaming", 2100).missing.includes(
      "packetLoss",
    ),
  );
  for (const value of [NaN, Infinity, -1, 1.1])
    assert.equal(
      qualityRating(
        { ...quality(), metrics: { ...quality().metrics, packetLoss: value } },
        "1.1.1.1",
        "gaming",
        2100,
      ).stars,
      null,
    );
  for (const change of [
    { latency: [10] },
    { packetsSent: 3 },
    { packetsLost: undefined },
    { downLoaded: [] },
    { upload: [] },
  ])
    assert.equal(
      qualityRating(
        { ...quality(), raw: { ...quality().raw, ...change } },
        "1.1.1.1",
        "rtc",
        2100,
      ).stars,
      null,
    );
  assert.equal(
    qualityRating(
      {
        ...quality(),
        aimScores: {
          gaming: {
            classificationIdx: 4,
            classificationName: "bad",
            points: 60,
          },
        },
      },
      "1.1.1.1",
      "gaming",
      2100,
    ).stars,
    null,
  );
});
test("addresses normalize and target-specific routing stays isolated", () => {
  assert.ok(sameIp("2001:4860:4860:0:0:0:0:8888", "2001:4860:4860::8888"));
  assert.equal(canonicalIp("not-an-ip"), null);
  assert.equal(sameIp(undefined, undefined), false);
  assert.equal(
    evidenceState({ ...quality(), egressAfter: "1.0.0.1" }, "1.1.1.1", 2100),
    "mismatch",
  );
  assert.equal(
    evidenceState({ ...quality(), egressAfter: undefined }, "1.1.1.1", 2100),
    "unverifiable",
  );
});
test("opaque responses, refusal, rate limits and unavailable probes stay distinct", () => {
  assert.equal(summarizeHttp([sample("opaque"), sample("opaque")]), "partial");
  assert.equal(summarizeHttp([sample("refused"), sample("refused")]), "failed");
  assert.equal(summarizeHttp([sample("rate-limited")]), "rate-limited");
  assert.equal(
    summarizeHttp([sample("unknown"), sample("unknown")]),
    "unverifiable",
  );
  assert.equal(summarizeHttp(Array(8).fill(sample("readable"))), "complete");
});
test("browser checks finish three clean samples and detect route changes", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(options.credentials, "omit");
      calls++;
      const response = new Response(
        `ip=${calls === 3 ? "8.8.8.8" : "1.1.1.1"}\nloc=US\n`,
      );
      Object.defineProperty(response, "url", { value: url });
      return response;
    };
    const result = await measurePlatform(
      "1.1.1.1",
      {
        id: "claude",
        name: "Claude",
        url: "https://claude.ai/cdn-cgi/trace",
        trace: true,
      },
      new AbortController().signal,
      () => {},
    );
    assert.equal(result.samples.length, 3);
    assert.equal(calls, 3);
    assert.equal(evidenceState(result, "1.1.1.1"), "mismatch");
  } finally {
    globalThis.fetch = previous;
  }
});
test("two unavailable samples stop early and cancellation never returns a completed result", async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new TypeError("CORS");
    };
    const target = {
      id: "test",
      name: "Test",
      url: "https://example.com/favicon.ico",
    };
    const result = await measurePlatform(
      "1.1.1.1",
      target,
      new AbortController().signal,
      () => {},
    );
    assert.equal(result.samples.length, 2);
    assert.equal(result.state, "unverifiable");
    globalThis.fetch = async () => new Response("ok");
    const control = new AbortController();
    await assert.rejects(
      () =>
        measurePlatform("1.1.1.1", target, control.signal, () =>
          control.abort(),
        ),
      (error) => error.name === "AbortError",
    );
  } finally {
    globalThis.fetch = previous;
  }
});

function access(samples = Array.from({ length: 8 }, () => sample("opaque"))) {
  return {
    ...quality(),
    kind: "http",
    target: "https://example.com/favicon.ico",
    ruleVersion: ACCESS_VERSION,
    samples,
    egressBefore: undefined,
    egressAfter: undefined,
  };
}
test("access stars describe response speed without claiming unverified IP ownership", () => {
  for (const [elapsedMs, stars] of [
    [150, 5],
    [151, 4],
    [300, 4],
    [301, 3],
    [600, 3],
    [601, 2],
    [1000, 2],
    [1001, 1],
  ]) {
    const result = accessRating(
      access(Array(3).fill({ outcome: "readable", elapsedMs })),
      "1.1.1.1",
      2100,
    );
    assert.equal(result.stars, stars);
    assert.equal(result.scope, "browser");
  }
  assert.equal(
    accessRating(access([sample("opaque"), sample("opaque")]), "1.1.1.1", 2100)
      .stars,
    null,
  );
  assert.equal(accessRating(access(), "8.8.8.8", 2100).stars, null);
  assert.equal(accessRating(access(), "1.1.1.1", 400000).stars, null);
  for (const change of [
    { state: "cancelled" },
    { state: "rate-limited" },
    { ruleVersion: "old" },
    { kind: "inbound" },
  ])
    assert.equal(
      accessRating({ ...access(), ...change }, "1.1.1.1", 2100).stars,
      null,
    );
  for (const outcome of ["refused", "rate-limited"])
    assert.equal(
      accessRating(
        access([...access().samples, sample(outcome)]),
        "1.1.1.1",
        2100,
      ).stars,
      null,
    );
  const mixed = accessRating(
    access([
      sample("opaque"),
      sample("unknown"),
      sample("opaque"),
      sample("opaque"),
    ]),
    "1.1.1.1",
    2100,
  );
  assert.equal(mixed.fluctuating, true);
  assert.equal(mixed.responses, 3);
  assert.equal(mixed.total, 4);
  assert.equal(
    accessRating(access(Array(8).fill(sample("unknown"))), "1.1.1.1", 2100)
      .stars,
    null,
  );
});
test("verified, split, changed and partially observed egress remain distinct", () => {
  for (const [before, after, scope] of [
    ["1.1.1.1", "1.1.1.1", "ip"],
    ["8.8.8.8", "8.8.8.8", "different"],
    ["1.1.1.1", undefined, "browser"],
  ]) {
    const rating = accessRating(
      {
        ...access(),
        egressBefore: before,
        egressAfter: after,
        samples: access().samples.map((sample) => ({
          ...sample,
          observedIp: before,
        })),
      },
      "1.1.1.1",
      2100,
    );
    assert.equal(rating.scope, scope);
    assert.equal(rating.stars, null);
  }
  assert.equal(
    accessRating(
      {
        ...access(),
        egressBefore: "1.1.1.1",
        egressAfter: "1.1.1.1",
        routeChanged: true,
      },
      "1.1.1.1",
      2100,
    ).scope,
    "different",
  );
});
test("a trace followed by unverified resource responses cannot attribute the whole round", () => {
  const evidence = {
    ...access(),
    egressBefore: "1.1.1.1",
    egressAfter: "1.1.1.1",
  };
  evidence.samples[0] = { ...sample("readable"), observedIp: "1.1.1.1" };
  evidence.samples[1] = { ...sample("readable"), observedIp: "1.1.1.1" };
  assert.equal(accessRating(evidence, "1.1.1.1", 2100).scope, "browser");
});
test("batch shares duplicate targets, bounds concurrency and schedules every first sample before repeats", async () => {
  const previous = globalThis.fetch;
  const targets = Array.from({ length: 11 }, (_, index) => ({
    id: String(index),
    name: String(index),
    url: `https://example.com/${index}`,
  }));
  const urls = [];
  let active = 0,
    maximum = 0;
  try {
    globalThis.fetch = async (url, options) => {
      urls.push(url);
      assert.equal(options.mode, "no-cors");
      maximum = Math.max(maximum, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      const response = new Response();
      Object.defineProperty(response, "type", { value: "opaque" });
      return response;
    };
    const snapshots = [];
    const result = await measurePlatforms(
      "1.1.1.1",
      [...targets, targets[0]],
      new AbortController().signal,
      (_, evidence) => snapshots.push(evidence),
    );
    assert.ok(maximum <= 4);
    assert.deepEqual(
      urls.slice(0, 11),
      targets.map((target) => target.url),
    );
    assert.equal(urls.length, 33);
    assert.ok(
      snapshots.some(
        (value) => value.samples.length === 1 && value.state === "running",
      ),
    );
    assert.ok(
      Object.values(result).every(
        (value) =>
          value.samples.length === 3 && value.addressFamily === "unknown",
      ),
    );
    assert.ok(
      Object.values(result).every(
        (value) => accessRating(value, "1.1.1.1").scope === "browser",
      ),
    );
  } finally {
    globalThis.fetch = previous;
  }
});
test("CORS fallback is learned once and readable 403 or 429 is never a successful sample", async () => {
  const previous = globalThis.fetch;
  const target = {
    id: "api",
    name: "API",
    url: "https://example.com/api",
    readable: true,
  };
  try {
    const modes = [];
    globalThis.fetch = async (_, options) => {
      modes.push(options.mode);
      if (options.mode === "cors") throw new TypeError("CORS");
      const response = new Response();
      Object.defineProperty(response, "type", { value: "opaque" });
      return response;
    };
    const evidence = await measurePlatform(
      "1.1.1.1",
      target,
      new AbortController().signal,
      () => {},
    );
    assert.deepEqual(modes, ["cors", ...Array(7).fill("no-cors")]);
    assert.equal(evidence.samples[0].outcome, "unknown");
    assert.equal(accessRating(evidence, "1.1.1.1").responses, 7);
    for (const status of [403, 429]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return new Response("", { status });
      };
      const result = await measurePlatform(
        "1.1.1.1",
        target,
        new AbortController().signal,
        () => {},
      );
      assert.equal(calls, 1);
      assert.equal(result.state, status === 403 ? "failed" : "rate-limited");
      assert.equal(accessRating(result, "1.1.1.1").stars, null);
    }
  } finally {
    globalThis.fetch = previous;
  }
});
test("batch deadline preserves partial evidence and leaves no running targets", async () => {
  const previous = globalThis.fetch;
  const timeout = AbortSignal.timeout;
  try {
    AbortSignal.timeout = (ms) => timeout(ms === ACCESS_BUDGET_MS ? 30 : 1000);
    let calls = 0;
    globalThis.fetch = async (_, options) => {
      if (++calls <= 2) return new Response("ok");
      return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 2000);
        options.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(options.signal.reason);
          },
          { once: true },
        );
      });
    };
    const evidence = await measurePlatform(
      "1.1.1.1",
      { id: "slow", name: "Slow", url: "https://example.com/slow" },
      new AbortController().signal,
      () => {},
    );
    assert.equal(evidence.samples.length, 2);
    assert.equal(evidence.incomplete, true);
    assert.notEqual(evidence.state, "running");
    assert.equal(accessRating(evidence, "1.1.1.1").stars, null);
  } finally {
    globalThis.fetch = previous;
    AbortSignal.timeout = timeout;
  }
});

test("scenario summary keeps denied, opaque and unavailable targets in the fixed denominator", () => {
  const fast = access(Array(3).fill({ outcome: "readable", elapsedMs: 100 }));
  const refused = {
    ...access([{ outcome: "refused", elapsedMs: 80, status: 403 }]),
    state: "failed",
  };
  const limited = {
    ...refused,
    samples: [{ outcome: "rate-limited", elapsedMs: 80, status: 429 }],
    state: "rate-limited",
  };
  const summary = summarizeAccessEvidence(
    [fast, fast, fast, fast, refused, refused],
    "1.1.1.1",
    2100,
  );
  assert.equal(summary.total, 6);
  assert.equal(summary.readable, 4);
  assert.equal(summary.denied, 2);
  assert.equal(summary.unknown, 0);
  const mixed = summarizeAccessEvidence(
    [fast, access(), limited, undefined],
    "1.1.1.1",
    2100,
  );
  assert.equal(mixed.total, 4);
  assert.equal(mixed.readable, 1);
  assert.equal(mixed.rateLimited, 1);
  assert.equal(mixed.unknown, 2);
  assert.equal(summarizeAccessEvidence([fast], "1.1.1.1", 400000).unknown, 1);
});

test("fast timeouts, opaque responses and incomplete rounds cannot produce speed stars", () => {
  const fast = access(Array(3).fill({ outcome: "readable", elapsedMs: 100 }));
  const mixed = {
    ...fast,
    state: "partial",
    samples: [
      ...fast.samples,
      { outcome: "unknown", elapsedMs: 3000, error: "timeout" },
      { outcome: "unknown", elapsedMs: 3000, error: "timeout" },
    ],
  };
  assert.equal(accessRating(mixed, "1.1.1.1", 2100).stars, null);
  assert.equal(endpointSummary(mixed, "1.1.1.1", 2100).timeouts, 2);
  assert.equal(endpointSummary(mixed, "1.1.1.1", 2100).total, 5);
  assert.equal(endpointSummary(mixed, "1.1.1.1", 2100).median, 100);
  assert.equal(endpointSummary(mixed, "1.1.1.1", 2100).state, "partial");
  assert.equal(accessRating(access(), "1.1.1.1", 2100).stars, null);
  assert.equal(endpointSummary(access(), "1.1.1.1", 2100).state, "opaque");
  assert.equal(
    endpointSummary({ ...fast, incomplete: true }, "1.1.1.1", 2100).state,
    "partial",
  );
  assert.equal(
    accessRating({ ...fast, incomplete: true }, "1.1.1.1", 2100).stars,
    null,
  );
  assert.equal(
    endpointSummary({ ...fast, state: "cancelled" }, "1.1.1.1", 2100).state,
    "cancelled",
  );
  assert.equal(endpointSummary(fast, "8.8.8.8", 2100).state, "unverifiable");
});
