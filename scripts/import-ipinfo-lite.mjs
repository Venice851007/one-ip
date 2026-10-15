import { Reader } from "mmdb-lib";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";

// Import a legitimately downloaded Lite MMDB; never download with or expose a token.
const [file, datasetDate] = process.argv.slice(2);
if (!file || !/^\d{4}-\d\d-\d\d$/.test(datasetDate ?? ""))
  throw new Error(
    "Usage: node scripts/import-ipinfo-lite.mjs /path/ipinfo_lite.mmdb YYYY-MM-DD (source dataset date)",
  );
const updated = Date.parse(`${datasetDate}T00:00:00Z`);
if (
  !Number.isFinite(updated) ||
  new Date(updated).toISOString().slice(0, 10) !== datasetDate ||
  updated > Date.now()
)
  throw new Error("Invalid source dataset date");
const data = await readFile(resolve(file));
if (data.length > 25 * 1024 * 1024)
  throw new Error(
    "Database exceeds the 25 MiB asset budget; do not enable this deployment",
  );
const reader = new Reader(Buffer.from(data));
if (reader.metadata.databaseType.toLowerCase().includes("sample"))
  throw new Error(
    "Sample databases are for tests only; import the full free IPinfo Lite database",
  );
const buildTime = reader.metadata.buildEpoch.getTime();
if (!Number.isFinite(buildTime) || buildTime > Date.now() + 300_000)
  throw new Error("Invalid database build time");
// Validate the product schema, not any particular IP's presumed country.
const record = ["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"]
  .map((ip) => reader.get(ip))
  .find(Boolean);
if (!record || !("country_code" in record) || !("asn" in record))
  throw new Error(
    "Expected an IPinfo Lite database with country_code and asn fields",
  );
const directory = resolve("public/ip-data");
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, "ipinfo-lite.mmdb.tmp"), data);
await rename(
  resolve(directory, "ipinfo-lite.mmdb.tmp"),
  resolve(directory, "ipinfo-lite.mmdb"),
);
await writeFile(
  resolve(directory, "ipinfo-lite.json"),
  JSON.stringify(
    {
      provider: "IPinfo Lite",
      license: "CC-BY-SA-4.0",
      dataset_updated_at: new Date(Math.min(buildTime, updated)).toISOString(),
      imported_at: new Date().toISOString(),
      sha256: createHash("sha256").update(data).digest("hex"),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Imported IPinfo Lite. Keep attribution and data licensing; enable IPINFO_LITE_ENABLED only after build verification.",
);
