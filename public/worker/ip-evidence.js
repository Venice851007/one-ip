import { Reader } from "mmdb-lib";
import { Buffer } from "node:buffer";
import { isIP } from "node:net";
import { boundedJson, publicIp } from "./http.js";

export const TOR_SOURCE = "https://check.torproject.org/exit-addresses";
export const TOR_TTL = 60 * 60_000;
export const TOR_MAX_AGE = 24 * 60 * 60_000;
export const LITE_MAX_BYTES = 25 * 1024 * 1024;
const DAY = 24 * 60 * 60_000;
const liteReaders = new WeakMap();
let torCache;
let torPending;
let torRetryAt = 0;

async function bytes(response, limit) {
  if (!response.ok || Number(response.headers.get("Content-Length")) > limit)
    throw new Error("source_unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_source");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > limit) throw new Error("source_too_large");
      chunks.push(Buffer.from(next.value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks, size);
}

const canonical = (ip) =>
  isIP(ip) === 6 ? new URL(`https://[${ip}]/`).hostname.slice(1, -1) : ip;

export function parseTorExitList(text, now = Date.now()) {
  const addresses = new Map();
  let updatedAt = 0;
  for (const line of text.split(/\r?\n/)) {
    const published = line.match(
      /^Published (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)$/,
    );
    if (published)
      updatedAt = Math.max(
        updatedAt,
        Date.parse(`${published[1].replace(" ", "T")}Z`),
      );
    const exit = line.match(
      /^ExitAddress (\S+) (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)$/,
    );
    if (!exit || !isIP(exit[1])) continue;
    const seen = Date.parse(`${exit[2].replace(" ", "T")}Z`);
    if (!Number.isFinite(seen) || seen > now + 300_000) continue;
    const key = canonical(exit[1]);
    addresses.set(key, Math.max(addresses.get(key) ?? 0, seen));
  }
  if (
    !text.includes("ExitNode ") ||
    !addresses.size ||
    !Number.isFinite(updatedAt) ||
    updatedAt <= 0 ||
    updatedAt > now + 300_000
  )
    throw new Error("invalid_exit_list");
  return { addresses, updatedAt };
}

async function torList(request, env) {
  const now = Date.now();
  if (torCache && now < torCache.expiresAt) return torCache;
  if (now < torRetryAt) throw new Error("source_backoff");
  if (!torPending) {
    torPending = (async () => {
      try {
        // A validated CC0 snapshot avoids a cold external request. Old snapshots
        // never become negative findings: refresh from the official source instead.
        if (env.ASSETS) {
          try {
            const snapshot = await env.ASSETS.fetch(
              new Request(new URL("/ip-data/tor-exits.txt", request.url)),
            );
            const parsed = parseTorExitList(
              (await bytes(snapshot, 2_000_000)).toString("utf8"),
            );
            if (Date.now() - parsed.updatedAt <= TOR_MAX_AGE) {
              torCache = { ...parsed, expiresAt: Date.now() + TOR_TTL };
              return torCache;
            }
          } catch {
            /* No valid offline snapshot; try the official live source. */
          }
        }
        const response = await fetch(TOR_SOURCE, {
          redirect: "error",
          signal: AbortSignal.timeout(8000),
        });
        const list = parseTorExitList(
          (await bytes(response, 2_000_000)).toString("utf8"),
        );
        torCache = { ...list, expiresAt: Date.now() + TOR_TTL };
        return torCache;
      } catch (error) {
        torRetryAt = Date.now() + 60_000;
        throw error;
      } finally {
        torPending = undefined;
      }
    })();
  }
  return torPending;
}

async function torEvidence(ip, now, request, env) {
  const base = {
    id: "tor-project",
    name: "Tor Project",
    source: TOR_SOURCE,
    license: "CC0-1.0",
    capabilities: ["tor_exit"],
    queried_at: new Date(now).toISOString(),
  };
  try {
    const list = await torList(request, env);
    const seen = list.addresses.get(canonical(ip));
    const stale = now - list.updatedAt > TOR_MAX_AGE;
    return {
      ...base,
      state: stale ? "stale" : "available",
      dataset_updated_at: new Date(list.updatedAt).toISOString(),
      observed_at: seen ? new Date(seen).toISOString() : null,
      fields: {
        tor_exit: stale
          ? null
          : seen
            ? now - seen <= TOR_MAX_AGE
              ? true
              : null
            : false,
      },
      reason: stale
        ? "dataset_stale"
        : seen && now - seen > TOR_MAX_AGE
          ? "observation_stale"
          : null,
    };
  } catch {
    return {
      ...base,
      state: "unavailable",
      fields: { tor_exit: null },
      reason: "source_unavailable",
    };
  }
}

async function liteEvidence(ip, request, env, now) {
  const base = {
    id: "ipinfo-lite",
    name: "IPinfo Lite",
    source: "https://ipinfo.io/developers/ipinfo-lite-database",
    license: "CC-BY-SA-4.0",
    capabilities: ["country_code", "asn"],
    queried_at: new Date(now).toISOString(),
  };
  if (env.IPINFO_LITE_ENABLED !== "true")
    return {
      ...base,
      state: "not_configured",
      fields: {},
      reason: "dataset_not_imported",
    };
  try {
    if (!env.ASSETS) throw new Error("assets_unavailable");
    let cached = liteReaders.get(env.ASSETS);
    if (!cached || now >= cached.expiresAt) {
      const promise = (async () => {
        const metaResponse = await env.ASSETS.fetch(
          new Request(new URL("/ip-data/ipinfo-lite.json", request.url)),
        );
        if (!metaResponse.ok) throw new Error("manifest_unavailable");
        const meta = await boundedJson(metaResponse, 4096);
        const updated = Date.parse(meta.dataset_updated_at);
        if (
          meta.provider !== "IPinfo Lite" ||
          meta.license !== "CC-BY-SA-4.0" ||
          !Number.isFinite(updated) ||
          updated > now + 300_000
        )
          throw new Error("invalid_manifest");
        const response = await env.ASSETS.fetch(
          new Request(new URL("/ip-data/ipinfo-lite.mmdb", request.url)),
        );
        const database = await bytes(response, LITE_MAX_BYTES);
        const digest = Buffer.from(
          await crypto.subtle.digest("SHA-256", database),
        ).toString("hex");
        if (meta.sha256 !== digest) throw new Error("dataset_mismatch");
        const reader = new Reader(database);
        return {
          reader,
          updated,
          sample: reader.metadata.databaseType.toLowerCase().includes("sample"),
        };
      })();
      cached = { promise, expiresAt: now + TOR_TTL };
      liteReaders.set(env.ASSETS, cached);
      promise.catch(() => {
        liteReaders.delete(env.ASSETS);
      });
    }
    const { reader, updated, sample } = await cached.promise;
    const value = reader.get(ip);
    const stale = now - updated > 7 * DAY;
    return {
      ...base,
      state: sample
        ? "sample"
        : stale
          ? "stale"
          : value
            ? "available"
            : "no_record",
      dataset_updated_at: new Date(updated).toISOString(),
      fields: stale
        ? {}
        : {
            country_code:
              typeof value?.country_code === "string" &&
              /^[A-Z]{2}$/.test(value.country_code)
                ? value.country_code
                : null,
            asn:
              typeof value?.asn === "string" && /^AS\d+$/.test(value.asn)
                ? value.asn
                : null,
          },
      reason: sample ? "sample_not_evidence" : stale ? "dataset_stale" : null,
    };
  } catch {
    return {
      ...base,
      state: "unavailable",
      fields: {},
      reason: "dataset_unavailable",
    };
  }
}

export async function ipEvidence(ip, request, env) {
  ip = publicIp(ip);
  const now = Date.now();
  const sources = await Promise.all([
    torEvidence(ip, now, request, env),
    liteEvidence(ip, request, env, now),
  ]);
  return {
    schema_version: 2,
    ip,
    checked_at: new Date(now).toISOString(),
    reputation_scope: "single-provider",
    sources,
  };
}
