// Pure IPv4 / IPv6 CIDR maths shared by the subnet calculator and tests.
export type Cidr4 = {
  version: 4;
  input: string;
  network: string;
  broadcast: string;
  mask: string;
  wildcard: string;
  prefix: number;
  total: number;
  usable: number;
  first: string;
  last: string;
  cidr: string;
  binaryMask: string;
};
export type Cidr6 = {
  version: 6;
  input: string;
  network: string;
  last: string;
  prefix: number;
  total: string;
  cidr: string;
};

const toIp4 = (n: number) =>
  [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");

export function parseIp4(value: string): number | null {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n >>> 0;
}

function maskPrefix(mask: string): number | null {
  const n = parseIp4(mask);
  if (n === null) return null;
  const bits = n.toString(2).padStart(32, "0");
  return /^1*0*$/.test(bits)
    ? bits.indexOf("0") === -1
      ? 32
      : bits.indexOf("0")
    : null;
}

export function parseIp6(value: string): bigint | null {
  const v = value.trim().toLowerCase();
  if (!/^[0-9a-f:]+$/.test(v) || !v.includes(":")) return null;
  const halves = v.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [
    ...head,
    ...Array(halves.length === 2 ? missing : 0).fill("0"),
    ...tail,
  ];
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

export function formatIp6(n: bigint): string {
  const groups = Array.from({ length: 8 }, (_, i) =>
    Number((n >> BigInt((7 - i) * 16)) & 0xffffn).toString(16),
  );
  // Compress the longest run of zero groups (RFC 5952).
  let best = [-1, 0];
  for (let i = 0; i < 8;) {
    if (groups[i] !== "0") {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && groups[j] === "0") j++;
    if (j - i > best[1] && j - i > 1) best = [i, j - i];
    i = j;
  }
  if (best[0] < 0) return groups.join(":");
  return `${groups.slice(0, best[0]).join(":")}::${groups.slice(best[0] + best[1]).join(":")}`;
}

/** Accepts "192.168.1.10/24", "10.0.0.1 255.255.255.0", "2001:db8::/48" or a bare IP. */
export function calculateCidr(input: string): Cidr4 | Cidr6 | null {
  const raw = input.trim();
  const [addr, rest] = raw.includes("/")
    ? raw.split("/", 2)
    : raw.split(/\s+/, 2);
  if (!addr) return null;
  const ip4 = parseIp4(addr);
  if (ip4 !== null) {
    const prefix =
      rest === undefined
        ? 32
        : /^\d{1,2}$/.test(rest)
          ? Number(rest)
          : maskPrefix(rest);
    if (prefix === null || prefix > 32) return null;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = (ip4 & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const total = 2 ** (32 - prefix);
    const usable = prefix >= 31 ? total : total - 2;
    return {
      version: 4,
      input: raw,
      network: toIp4(network),
      broadcast: toIp4(broadcast),
      mask: toIp4(mask),
      wildcard: toIp4(~mask >>> 0),
      prefix,
      total,
      usable,
      first: toIp4(prefix >= 31 ? network : network + 1),
      last: toIp4(prefix >= 31 ? broadcast : broadcast - 1),
      cidr: `${toIp4(network)}/${prefix}`,
      binaryMask: mask
        .toString(2)
        .padStart(32, "0")
        .replace(/(.{8})(?!$)/g, "$1."),
    };
  }
  const ip6 = parseIp6(addr);
  if (ip6 === null) return null;
  const prefix =
    rest === undefined ? 128 : /^\d{1,3}$/.test(rest) ? Number(rest) : NaN;
  if (!(prefix >= 0 && prefix <= 128)) return null;
  const host = (1n << BigInt(128 - prefix)) - 1n;
  const network = ip6 & ~host & ((1n << 128n) - 1n);
  return {
    version: 6,
    input: raw,
    network: formatIp6(network),
    last: formatIp6(network | host),
    prefix,
    total: (1n << BigInt(128 - prefix)).toLocaleString("en-US"),
    cidr: `${formatIp6(network)}/${prefix}`,
  };
}
