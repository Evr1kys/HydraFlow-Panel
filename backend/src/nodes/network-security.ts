import { BadRequestException } from '@nestjs/common';
import { promises as dns } from 'dns';
import { isIP } from 'net';
import { domainToASCII } from 'url';

export interface ResolvedAgentAddress {
  originalHost: string;
  normalizedHost: string;
  address: string;
  family: 4 | 6;
}

const METADATA_ADDRESSES = new Set([
  '169.254.169.254',
  'fd00:ec2::254',
  '100.100.100.200',
]);

function configuredAllowlist(): Set<string> {
  return new Set(
    (process.env.NODE_AGENT_PRIVATE_ALLOWLIST ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function normalizeAgentHost(input: string): string {
  const value = input.trim();
  if (!value || value.length > 253) {
    throw new BadRequestException('Node address is invalid');
  }
  if (
    value.includes('://') ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('@') ||
    value.includes('#') ||
    value.includes('?') ||
    value.includes('%')
  ) {
    throw new BadRequestException(
      'Node address must be a hostname or IP address, not a URL',
    );
  }

  const unwrapped = value.startsWith('[') && value.endsWith(']')
    ? value.slice(1, -1)
    : value;
  if (isIP(unwrapped)) return unwrapped.toLowerCase();

  const ascii = domainToASCII(unwrapped).toLowerCase();
  if (
    !ascii ||
    ascii.length > 253 ||
    ascii === 'localhost' ||
    ascii.endsWith('.localhost') ||
    ascii.endsWith('.local') ||
    ascii.startsWith('.') ||
    ascii.endsWith('.') ||
    ascii.split('.').some((label) =>
      !label ||
      label.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    throw new BadRequestException('Node hostname is invalid or local-only');
  }
  return ascii;
}

export async function resolveAgentAddress(
  host: string,
  allowlist = configuredAllowlist(),
): Promise<ResolvedAgentAddress> {
  const normalizedHost = normalizeAgentHost(host);
  const directFamily = isIP(normalizedHost);
  const results = directFamily
    ? [{ address: normalizedHost, family: directFamily as 4 | 6 }]
    : await dns.lookup(normalizedHost, { all: true, verbatim: true });

  if (results.length === 0) {
    throw new BadRequestException('Node hostname did not resolve');
  }

  const unique = new Map<string, 4 | 6>();
  for (const result of results) {
    unique.set(result.address.toLowerCase(), result.family as 4 | 6);
  }

  for (const [address] of unique) {
    if (!isAllowedAgentAddress(address, allowlist)) {
      throw new BadRequestException(
        `Node address resolves to a forbidden network: ${address}`,
      );
    }
  }

  const first = unique.entries().next().value as [string, 4 | 6] | undefined;
  if (!first) {
    throw new BadRequestException('Node hostname did not resolve');
  }
  return {
    originalHost: host,
    normalizedHost,
    address: first[0],
    family: first[1],
  };
}

export function isAllowedAgentAddress(
  rawAddress: string,
  allowlist = configuredAllowlist(),
): boolean {
  const address = rawAddress.trim().toLowerCase();
  if (METADATA_ADDRESSES.has(address)) return false;

  const family = isIP(address);
  if (family === 4) {
    if (isForbiddenIPv4(address)) return allowlist.has(address);
    return true;
  }
  if (family === 6) {
    const mapped = mappedIPv4(address);
    if (mapped) return isAllowedAgentAddress(mapped, allowlist);
    if (isForbiddenIPv6(address)) return allowlist.has(address);
    return true;
  }
  return false;
}

function isForbiddenIPv4(address: string): boolean {
  const value = ipv4Number(address);
  return (
    inV4(value, '0.0.0.0', 8) ||
    inV4(value, '10.0.0.0', 8) ||
    inV4(value, '100.64.0.0', 10) ||
    inV4(value, '127.0.0.0', 8) ||
    inV4(value, '169.254.0.0', 16) ||
    inV4(value, '172.16.0.0', 12) ||
    inV4(value, '192.0.0.0', 24) ||
    inV4(value, '192.0.2.0', 24) ||
    inV4(value, '192.168.0.0', 16) ||
    inV4(value, '198.18.0.0', 15) ||
    inV4(value, '198.51.100.0', 24) ||
    inV4(value, '203.0.113.0', 24) ||
    inV4(value, '224.0.0.0', 4) ||
    inV4(value, '240.0.0.0', 4)
  );
}

function ipv4Number(address: string): number {
  return address
    .split('.')
    .reduce((value, octet) => ((value << 8) | Number(octet)) >>> 0, 0);
}

function inV4(value: number, network: string, prefix: number): boolean {
  const networkValue = ipv4Number(network);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (networkValue & mask);
}

function mappedIPv4(address: string): string | null {
  if (!address.startsWith('::ffff:')) return null;
  const tail = address.slice('::ffff:'.length);
  if (isIP(tail) === 4) return tail;
  const halves = tail.split(':');
  if (halves.length !== 2) return null;
  const high = Number.parseInt(halves[0], 16);
  const low = Number.parseInt(halves[1], 16);
  if (!Number.isInteger(high) || !Number.isInteger(low)) return null;
  return [high >>> 8, high & 0xff, low >>> 8, low & 0xff].join('.');
}

function isForbiddenIPv6(address: string): boolean {
  if (address === '::' || address === '::1') return true;
  if (address.startsWith('fc') || address.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(address)) return true;
  if (address.startsWith('ff')) return true;
  if (address.startsWith('2001:db8:') || address === '2001:db8::') return true;
  if (address.startsWith('100:')) return true;
  return false;
}

export function formatPinnedHost(address: string): string {
  return isIP(address) === 6 ? `[${address}]` : address;
}
