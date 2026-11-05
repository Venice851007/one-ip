import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import "./prepare-asn-data.mjs";
import {
  parseTorExitList,
  TOR_MAX_AGE,
  TOR_SOURCE,
} from "../public/worker/ip-evidence.js";

// Builds may run without an imported snapshot. Refresh only the public CC0
// source; runtime retains its live fallback when a build-time refresh fails.
try {
  const response = await fetch(TOR_SOURCE, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > 2_000_000)
      throw new Error("Exit list exceeds the import budget");
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);
  const parsed = parseTorExitList(data.toString("utf8"));
  if (Date.now() - parsed.updatedAt > TOR_MAX_AGE)
    throw new Error("Official exit list is stale");
  await mkdir(resolve("public/ip-data"), { recursive: true });
  await writeFile(resolve("public/ip-data/tor-exits.txt"), data);
  console.log(
    `Tor Project CC0 snapshot: ${parsed.addresses.size} addresses, published ${new Date(parsed.updatedAt).toISOString()}`,
  );
} catch (error) {
  console.warn(
    `Tor snapshot refresh skipped (${error.message}); runtime will validate any existing snapshot and fall back to the official source.`,
  );
}
