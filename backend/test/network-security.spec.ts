import {
  isAllowedAgentAddress,
  normalizeAgentHost,
} from '../src/nodes/network-security';

describe('Agent network security', () => {
  it('allows public IP addresses', () => {
    expect(isAllowedAgentAddress('8.8.8.8')).toBe(true);
    expect(isAllowedAgentAddress('2606:4700:4700::1111')).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '224.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
  ])('blocks non-public address %s', (address) => {
    expect(isAllowedAgentAddress(address)).toBe(false);
  });

  it('permits an explicitly allowlisted private address', () => {
    const allowlist = new Set(['10.20.30.40']);
    expect(isAllowedAgentAddress('10.20.30.40', allowlist)).toBe(true);
    expect(isAllowedAgentAddress('10.20.30.41', allowlist)).toBe(false);
  });

  it('never permits cloud metadata addresses', () => {
    const allowlist = new Set([
      '169.254.169.254',
      '100.100.100.200',
      'fd00:ec2::254',
    ]);
    for (const address of allowlist) {
      expect(isAllowedAgentAddress(address, allowlist)).toBe(false);
    }
  });

  it('rejects URLs and local-only hostnames', () => {
    expect(() => normalizeAgentHost('https://node.example.com')).toThrow();
    expect(() => normalizeAgentHost('localhost')).toThrow();
    expect(() => normalizeAgentHost('node.local')).toThrow();
    expect(() => normalizeAgentHost('user@node.example.com')).toThrow();
  });

  it('normalizes internationalized DNS names', () => {
    expect(normalizeAgentHost('BÜCHER.example')).toBe('xn--bcher-kva.example');
  });
});
