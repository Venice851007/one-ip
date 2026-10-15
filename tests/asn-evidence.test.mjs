import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asnNumber,
  parseAsnDrop,
  parseCirclRanking,
  ASN_DROP_MAX_AGE,
} from "../public/worker/asn-evidence.js";

const dataset = (time = Date.now(), changes = {}) =>
  [
    JSON.stringify({ asn: 245, asname: "TEST-AS" }),
    JSON.stringify({
      type: "metadata",
      timestamp: Math.floor(time / 1000),
      records: 1,
      copyright: "(c) 2026 The Spamhaus Project SLU",
      terms: "https://www.spamhaus.org/drop/terms/",
      ...changes,
    }),
  ].join("\n");
const req = new Request("https://example.com/api/ip/evidence/1.1.1.1?asn=245");
let id = 0;
const fresh = () => import(`../public/worker/asn-evidence.js?test=${id++}`);
async function withFetch(fetcher, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    return await run();
  } finally {
    globalThis.fetch = previous;
  }
}

test("ASN numbers and ASN-DROP snapshots are strictly validated, including copyright and dates", () => {
  for (const input of [0, -1, "245junk", 1.5, "0x245", 4294967296, "", null])
    assert.equal(asnNumber(input), null);
  assert.equal(asnNumber("AS245"), 245);
  assert.equal(asnNumber(4294967295), 4294967295);
  assert.equal(parseAsnDrop(dataset()).entries.has(245), true);
  for (const body of [
    "<html>blocked</html>",
    "",
    dataset(Date.now() + 600_000),
    dataset(Date.now(), { records: 2 }),
    dataset(Date.now(), { copyright: "Unknown" }),
    dataset().replace('"asn":245', '"asn":0'),
    dataset().replace('"asn":245', '"asn":1.5'),
  ])
    assert.throws(() => parseAsnDrop(body));
});

test("ASN-DROP reads a shared offline snapshot without visitor-triggered Spamhaus requests", async () => {
  const { asnDropEvidence } = await fresh();
  let reads = 0;
  const env = {
    ASSETS: {
      fetch: async () => {
        reads++;
        return new Response(dataset());
      },
    },
  };
  await withFetch(
    async () => {
      throw new Error("must not download");
    },
    async () => {
      const [listed, clear] = await Promise.all([
        asnDropEvidence(245, req, env),
        asnDropEvidence(13335, req, env),
      ]);
      assert.equal(reads, 1);
      assert.equal(listed.fields.asn_drop, true);
      assert.equal(clear.fields.asn_drop, false);
      assert.equal(listed.copyright, "(c) 2026 The Spamhaus Project SLU");
      assert.equal(listed.fields.abuse, undefined);
      assert.equal((await asnDropEvidence(null, req, env)).state, "no_record");
    },
  );
});

test("missing, invalid and expired ASN snapshots never become a negative finding", async () => {
  for (const [body, state] of [
    [dataset(Date.now() - ASN_DROP_MAX_AGE - 5000), "stale"],
    ["<html>missing asset</html>", "unavailable"],
  ]) {
    const { asnDropEvidence } = await fresh();
    const result = await withFetch(
      async () => {
        throw new Error("mirror unavailable");
      },
      () =>
        asnDropEvidence(245, req, {
          ASSETS: { fetch: async () => new Response(body) },
        }),
    );
    assert.equal(result.state, state);
    assert.equal(result.fields.asn_drop, null);
  }
});

const day = "2026-10-14";
const ranking = {
  meta: { asn: "13335" },
  response: { ranking: { rank: 0.0004, position: 100, total_known_asns: 500 } },
};
const history = {
  meta: { asn: "13335" },
  response: {
    asn_history: [
      [day, 0.0004],
      ["2026-10-15", 0.0001],
    ],
  },
};

test("CIRCL ranks must match the queried ASN and a dated history point", () => {
  const result = parseCirclRanking(ranking, history, 13335, day);
  assert.equal(result.date, day);
  assert.equal(result.rank, 0.0004);
  assert.equal(result.history.length, 1);
  for (const change of [
    { meta: { asn: "245" }, response: ranking.response },
    {
      ...ranking,
      response: { ranking: { ...ranking.response.ranking, rank: null } },
    },
    {
      ...ranking,
      response: { ranking: { ...ranking.response.ranking, rank: 0.001 } },
    },
    {
      ...ranking,
      response: { ranking: { ...ranking.response.ranking, position: 501 } },
    },
  ])
    assert.throws(() => parseCirclRanking(change, history, 13335, day));
  assert.throws(() => parseCirclRanking(ranking, history, 13335, "2026-10-13"));
});

test("CIRCL queries a completed day and shares both API calls for the same ASN", async () => {
  const { circlEvidence } = await fresh();
  let calls = 0;
  await withFetch(
    async (url, init) => {
      calls++;
      assert.equal(JSON.parse(init.body).date, day);
      assert.equal(JSON.parse(init.body).asn, "13335");
      return Response.json(
        String(url).endsWith("/asn_history") ? history : ranking,
      );
    },
    async () => {
      const now = Date.parse("2026-10-15T05:00:00Z");
      const [a, b] = await Promise.all([
        circlEvidence(13335, now),
        circlEvidence(13335, now),
      ]);
      assert.equal(calls, 2);
      assert.equal(a.state, "available");
      assert.equal(a.fields.asn_rank, b.fields.asn_rank);
      assert.equal(a.ranking_date, day);
      assert.equal(a.dataset_updated_at, `${day}T00:00:00.000Z`);
    },
  );
});

test("CIRCL missing dates and failures remain unavailable and back off", async () => {
  const { circlEvidence } = await fresh();
  let calls = 0;
  await withFetch(
    async () => {
      calls++;
      return Response.json({ private_upstream_message: "hidden" });
    },
    async () => {
      const a = await circlEvidence(245);
      await circlEvidence(245);
      assert.equal(calls, 2);
      assert.equal(a.state, "unavailable");
      assert.equal(a.fields.asn_rank, undefined);
      assert.ok(!JSON.stringify(a).includes("hidden"));
    },
  );
});

test("an expired bundle can refresh from the repository mirror without polling Spamhaus", async () => {
  const { asnDropEvidence, ASN_DROP_MIRROR } = await fresh();
  let calls = 0;
  await withFetch(
    async (url) => {
      calls++;
      assert.equal(url, ASN_DROP_MIRROR);
      return new Response(dataset());
    },
    async () => {
      const env = {
        ASSETS: {
          fetch: async () =>
            new Response(dataset(Date.now() - 40 * 60 * 60_000)),
        },
      };
      const result = await asnDropEvidence(245, req, env);
      assert.equal(result.state, "available");
      assert.equal(result.fields.asn_drop, true);
      await asnDropEvidence(13335, req, env);
      assert.equal(calls, 1);
    },
  );
});
