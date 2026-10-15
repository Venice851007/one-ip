import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseTorExitList, TOR_MAX_AGE } from "../public/worker/ip-evidence.js";

const file = process.argv[2];
if (!file)
  throw new Error(
    "Usage: node scripts/import-tor-exits.mjs /path/exit-addresses.txt",
  );
const data = await readFile(resolve(file));
if (data.length > 2_000_000)
  throw new Error("Exit list exceeds the import budget");
const parsed = parseTorExitList(data.toString("utf8"));
if (Date.now() - parsed.updatedAt > TOR_MAX_AGE)
  throw new Error("Exit list is stale; download a current official snapshot");
await mkdir(resolve("public/ip-data"), { recursive: true });
await writeFile(resolve("public/ip-data/tor-exits.txt"), data);
console.log(
  JSON.stringify({
    source: "Tor Project",
    license: "CC0-1.0",
    addresses: parsed.addresses.size,
    dataset_updated_at: new Date(parsed.updatedAt).toISOString(),
  }),
);
