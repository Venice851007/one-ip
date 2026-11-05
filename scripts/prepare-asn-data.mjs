import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  parseAsnDrop,
  ASN_DROP_MAX_AGE,
} from "../public/worker/asn-evidence.js";

// Ordinary builds never re-download the official list. The repository updater
// owns the single daily download and retains the original copyright and date.
const data = await readFile(
  new URL("../data/spamhaus-asndrop.jsonl", import.meta.url),
);
const parsed = parseAsnDrop(data.toString("utf8"));
await mkdir("public/ip-data", { recursive: true });
await writeFile("public/ip-data/asndrop.json", data);
console.log(
  `Spamhaus ASN-DROP: ${parsed.entries.size} ASNs, published ${new Date(parsed.updated).toISOString()}, ${parsed.copyright}`,
);
if (Date.now() - parsed.updated > ASN_DROP_MAX_AGE)
  console.warn(
    "Bundled ASN-DROP is stale; runtime will check the repository snapshot and otherwise report unknown.",
  );
