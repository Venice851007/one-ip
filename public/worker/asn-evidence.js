import { boundedJson, HttpError } from "./http.js";

export const ASN_DROP_SOURCE = "https://www.spamhaus.org/drop/asndrop.json";
export const ASN_DROP_MAX_AGE = 36 * 60 * 60_000;
export const ASN_DROP_REFRESH = 24 * 60 * 60_000;
export const CIRCL_SOURCE = "https://bgpranking.circl.lu";
export const ASN_DROP_MIRROR =
  "https://raw.githubusercontent.com/Venice851007/one-ip/main/data/spamhaus-asndrop.jsonl";
const dropCaches = new WeakMap();
const fallbackAssets = {};
const rankings = new Map();

export function asnNumber(value) {
  const text = String(value ?? "").replace(/^AS/i, "");
  if (!/^[1-9]\d{0,9}$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n <= 4294967295 ? n : null;
}

export function parseAsnDrop(text, now = Date.now()) {
  if (text.length > 2_000_000) throw new Error("dataset_too_large");
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const meta = rows.pop();
  const updated = meta?.timestamp * 1000;
  if (
    meta?.type !== "metadata" ||
    !Number.isInteger(meta.timestamp) ||
    !Number.isFinite(updated) ||
    updated <= 0 ||
    updated > now + 300_000 ||
    typeof meta.copyright !== "string" ||
    !meta.copyright.includes("Spamhaus") ||
    meta.terms !== "https://www.spamhaus.org/drop/terms/" ||
    meta.records !== rows.length ||
    !rows.length ||
    rows.length > 50_000
  )
    throw new Error("invalid_asn_drop");
  const entries = new Map();
  for (const row of rows) {
    const asn = asnNumber(row.asn);
    if (!asn || typeof row.asn !== "number" || entries.has(asn))
      throw new Error("invalid_asn_record");
    entries.set(asn, {
      asname: typeof row.asname === "string" ? row.asname.slice(0, 200) : null,
    });
  }
  return { entries, updated, copyright: meta.copyright, terms: meta.terms };
}

async function textFile(response) {
  if (!response.ok) throw new Error("source_unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_source");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) throw new Error("dataset_too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(data);
}

// The repository updater owns official downloads. Edge lookups can only read
// our bundled file or our own public mirror, never poll Spamhaus per visitor.
async function dropList(request, env) {
  const owner = env.ASSETS ?? fallbackAssets;
  let cached = dropCaches.get(owner);
  if (!cached || Date.now() >= cached.expires) {
    const pending = (async () => {
      let bundled;
      if (env.ASSETS) {
        try {
          bundled = parseAsnDrop(
            await textFile(
              await env.ASSETS.fetch(
                new Request(new URL("/ip-data/asndrop.json", request.url)),
              ),
            ),
          );
          if (Date.now() - bundled.updated <= ASN_DROP_REFRESH) return bundled;
        } catch {
          /* Check our updated repository snapshot. */
        }
      }
      try {
        const cache = typeof caches !== "undefined" ? caches.default : null;
        const cacheRequest = new Request(ASN_DROP_MIRROR);
        const hit = cache
          ? await cache.match(cacheRequest).catch(() => null)
          : null;
        let text;
        if (hit) text = await textFile(hit);
        else {
          text = await textFile(
            await fetch(ASN_DROP_MIRROR, {
              redirect: "manual",
              signal: AbortSignal.timeout(8000),
            }),
          );
          const parsed = parseAsnDrop(text);
          if (cache)
            await cache
              .put(
                cacheRequest,
                new Response(text, {
                  headers: { "Cache-Control": "public, max-age=3600" },
                }),
              )
              .catch(() => {});
          return !bundled || parsed.updated >= bundled.updated
            ? parsed
            : bundled;
        }
        const parsed = parseAsnDrop(text);
        return !bundled || parsed.updated >= bundled.updated ? parsed : bundled;
      } catch {
        if (bundled) return bundled;
        throw new Error("dataset_unavailable");
      }
    })();
    cached = { pending, expires: Date.now() + 60 * 60_000 };
    dropCaches.set(owner, cached);
    pending.catch(() => {
      cached.expires = Date.now() + 60_000;
    });
  }
  return cached.pending;
}

export async function asnDropEvidence(asn, request, env, now = Date.now()) {
  const base = {
    id: "spamhaus-asndrop",
    name: "Spamhaus ASN-DROP",
    source: ASN_DROP_SOURCE,
    license: "Spamhaus DROP Terms of Use",
    capabilities: ["asn_drop"],
    queried_at: new Date(now).toISOString(),
    fields: { asn: asn ? `AS${asn}` : null, asn_drop: null },
  };
  if (!asn) return { ...base, state: "no_record", reason: "asn_unknown" };
  try {
    const list = await dropList(request, env);
    const stale = now - list.updated > ASN_DROP_MAX_AGE;
    return {
      ...base,
      state: stale ? "stale" : "available",
      dataset_updated_at: new Date(list.updated).toISOString(),
      copyright: list.copyright,
      terms: list.terms,
      fields: {
        asn: `AS${asn}`,
        asn_drop: stale ? null : list.entries.has(asn),
      },
      reason: stale ? "dataset_stale" : null,
    };
  } catch {
    return { ...base, state: "unavailable", reason: "dataset_unavailable" };
  }
}

function rankingDay(now) {
  // Today's ranking is still being assembled. Query the last completed UTC day.
  return new Date(now - 86_400_000).toISOString().slice(0, 10);
}

export function parseCirclRanking(data, historyData, asn, day) {
  if (
    (data?.meta?.date !== undefined && data.meta.date !== day) ||
    String(data?.meta?.asn) !== String(asn) ||
    String(historyData?.meta?.asn) !== String(asn)
  )
    throw new Error("asn_mismatch");
  const ranking = data?.response?.ranking;
  const history = historyData?.response?.asn_history;
  if (!ranking || !Array.isArray(history)) throw new Error("ranking_missing");
  const validRank = (value) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const points = history.filter(
    (row) =>
      Array.isArray(row) &&
      /^\d{4}-\d\d-\d\d$/.test(row[0]) &&
      row[0] <= day &&
      validRank(row[1]),
  );
  const point = points.find((row) => row[0] === day);
  if (
    !point ||
    !validRank(ranking.rank) ||
    Math.abs(point[1] - ranking.rank) > Math.max(1e-12, ranking.rank * 1e-8) ||
    !Number.isInteger(ranking.position) ||
    !Number.isInteger(ranking.total_known_asns) ||
    ranking.position < 1 ||
    ranking.position > ranking.total_known_asns
  )
    throw new Error("ranking_date_or_value_invalid");
  return {
    rank: ranking.rank,
    position: ranking.position,
    total: ranking.total_known_asns,
    date: day,
    history: points.slice(-5).map(([date, rank]) => ({ date, rank })),
  };
}

async function loadRanking(asn, day) {
  const key = `${asn}:${day}`;
  const now = Date.now();
  let cached = rankings.get(key);
  if (cached && now < cached.expires) return cached.pending;
  // Cache API persists results across isolates on the same edge; a bounded local
  // map also shares in-flight requests and backs off failures.
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheRequest = new Request(
    `https://ip-tools.invalid/asn-ranking/${key}`,
  );
  const pending = (async () => {
    const hit = cache
      ? await cache.match(cacheRequest).catch(() => null)
      : null;
    if (hit) return boundedJson(hit, 32_000);
    const post = async (path, body) => {
      const response = await fetch(`${CIRCL_SOURCE}${path}`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("source_unavailable");
      return boundedJson(response, 32_000);
    };
    const [data, history] = await Promise.all([
      post("/json/asn", { asn: String(asn), date: day }),
      post("/json/asn_history", { asn: String(asn), date: day, period: 5 }),
    ]);
    const result = parseCirclRanking(data, history, asn, day);
    if (cache)
      await cache
        .put(
          cacheRequest,
          Response.json(result, {
            headers: { "Cache-Control": "public, max-age=86400" },
          }),
        )
        .catch(() => {});
    return result;
  })();
  cached = { pending, expires: now + 86_400_000 };
  rankings.set(key, cached);
  if (rankings.size > 256) rankings.delete(rankings.keys().next().value);
  pending.catch(() => {
    cached.expires = Date.now() + 60_000;
  });
  return pending;
}

export async function circlEvidence(asn, now = Date.now()) {
  const day = rankingDay(now);
  const base = {
    id: "circl-bgp",
    name: "CIRCL BGP Ranking",
    source: `${CIRCL_SOURCE}/`,
    capabilities: ["asn_ranking"],
    queried_at: new Date(now).toISOString(),
    fields: { asn: asn ? `AS${asn}` : null },
  };
  if (!asn) return { ...base, state: "no_record", reason: "asn_unknown" };
  try {
    const result = await loadRanking(asn, day);
    return {
      ...base,
      state: "available",
      dataset_updated_at: `${day}T00:00:00.000Z`,
      ranking_date: day,
      fields: {
        ...base.fields,
        asn_rank: result.rank,
        asn_position: result.position,
        asn_total: result.total,
      },
      history: result.history,
    };
  } catch {
    return {
      ...base,
      state: "unavailable",
      reason: "ranking_unavailable_or_unverified_date",
    };
  }
}

export function requestedAsn(request) {
  const value = new URL(request.url).searchParams.get("asn");
  if (value === null) return null;
  const asn = asnNumber(value);
  if (!asn) throw new HttpError(400, "请输入有效的 ASN");
  return asn;
}
