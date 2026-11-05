import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ASN_DROP_SOURCE,
  ASN_DROP_REFRESH,
  ASN_DROP_MAX_AGE,
  parseAsnDrop,
} from "../public/worker/asn-evidence.js";

const file = resolve("data/spamhaus-asndrop.jsonl");
const receipt = resolve("data/spamhaus-asndrop-import.json");
try {
  let reusable = false;
  try {
    const { downloaded_at } = JSON.parse(await readFile(receipt, "utf8"));
    const downloaded = Date.parse(downloaded_at);
    const parsed = parseAsnDrop(await readFile(file, "utf8"));
    reusable =
      downloaded <= Date.now() &&
      Date.now() - downloaded < ASN_DROP_REFRESH &&
      Date.now() - parsed.updated <= ASN_DROP_MAX_AGE;
  } catch {
    /* No validated recent download. */
  }
  if (reusable) {
    console.log(
      "Spamhaus ASN-DROP: reusing a validated download from the last 24 hours.",
    );
  } else {
    const response = await fetch(ASN_DROP_SOURCE, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 2_000_000)
        throw new Error("ASN list exceeds the import budget");
      chunks.push(chunk);
    }
    const data = Buffer.concat(chunks);
    const parsed = parseAsnDrop(data.toString("utf8"));
    if (Date.now() - parsed.updated > ASN_DROP_MAX_AGE)
      throw new Error("Official ASN list is stale");
    await mkdir(resolve("data"), { recursive: true });
    await writeFile(file, data);
    await writeFile(
      receipt,
      JSON.stringify({ downloaded_at: new Date().toISOString() }),
    );
    console.log(
      `Spamhaus ASN-DROP: ${parsed.entries.size} ASNs, published ${new Date(parsed.updated).toISOString()}, ${parsed.copyright}`,
    );
  }
} catch (error) {
  console.error(
    `ASN-DROP update failed (${error.message}); the previous snapshot is preserved.`,
  );
  process.exitCode = 1;
}
