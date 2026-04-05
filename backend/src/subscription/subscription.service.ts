import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HwidService } from '../hwid/hwid.service';

type ClientFormat = 'base64' | 'clash' | 'singbox';

function formatBytes(bytes: bigint): string {
  const num = Number(bytes);
  if (num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  const val = num / Math.pow(k, i);
  return `${val.toFixed(1)} ${sizes[i]}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detectClientFormat(userAgent: string): ClientFormat {
  const ua = userAgent.toLowerCase();

  // Clash-based clients
  if (ua.includes('clash') || ua.includes('stash') || ua.includes('meta')) {
    return 'clash';
  }

  // sing-box based clients
  if (ua.includes('sing-box') || ua.includes('singbox') || ua.includes('sfi') || ua.includes('sfa')) {
    return 'singbox';
  }

  // Default: base64 (v2rayNG, V2rayN, Nekoray, Streisand, V2Box, etc.)
  return 'base64';
}

interface SubscriptionUserInfo {
  upload: bigint;
  download: bigint;
  total: bigint | null;
  expire: Date | null;
}

function buildSubscriptionUserInfoHeader(info: SubscriptionUserInfo): string {
  const parts = [
    `upload=${info.upload}`,
    `download=${info.download}`,
    `total=${info.total ?? 0}`,
  ];
  if (info.expire) {
    parts.push(`expire=${Math.floor(info.expire.getTime() / 1000)}`);
  }
  return parts.join('; ');
}

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hwidService: HwidService,
  ) {}

  private resolveServerIp(
    hostOverrides: Record<string, string>,
    settings: { serverIp: string | null } | null,
  ): string {
    const fromOverride = hostOverrides['serverIp'];
    if (fromOverride) return fromOverride;
    if (settings?.serverIp) return settings.serverIp;
    const fromEnv = process.env['SERVER_PUBLIC_IP'];
    if (fromEnv) return fromEnv;
    throw new NotFoundException(
      'Server public IP is not configured. Set it in Settings or via SERVER_PUBLIC_IP env var.',
    );
  }

  private async getHostOverrides(
    user: { externalSquadId: string | null; internalSquadId: string | null },
  ): Promise<Record<string, string>> {
    if (user.externalSquadId) {
      const squad = await this.prisma.externalSquad.findUnique({
        where: { id: user.externalSquadId },
      });
      if (squad?.hostOverrides && typeof squad.hostOverrides === 'object') {
        return squad.hostOverrides as Record<string, string>;
      }
    }
    return {};
  }

  private async getSquadBranding(
    user: { externalSquadId: string | null },
  ): Promise<{ title: string; brand: string }> {
    if (user.externalSquadId) {
      const squad = await this.prisma.externalSquad.findUnique({
        where: { id: user.externalSquadId },
      });
      if (squad) {
        return {
          title: squad.subPageTitle ?? 'HydraFlow',
          brand: squad.subPageBrand ?? 'HydraFlow',
        };
      }
    }
    return { title: 'HydraFlow', brand: 'HydraFlow' };
  }

  async generateLinks(
    token: string,
    userAgent: string = '',
    hwid?: string,
    platform?: string,
  ): Promise<{ content: string; contentType: string; userInfo: SubscriptionUserInfo }> {
    const user = await this.prisma.user.findUnique({
      where: { subToken: token },
    });

    if (!user || !user.enabled) {
      throw new NotFoundException('Invalid or disabled subscription');
    }

    if (user.expiryDate && user.expiryDate < new Date()) {
      throw new NotFoundException('Subscription expired');
    }

    // HWID check if provided
    if (hwid) {
      const hwidResult = await this.hwidService.checkDevice(user.id, hwid, platform);
      if (!hwidResult.allowed) {
        throw new ForbiddenException(
          `Device limit reached (${hwidResult.currentDevices}/${hwidResult.maxDevices}). Remove a device to continue.`,
        );
      }
    }

    const settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });

    if (!settings) {
      throw new NotFoundException('Server not configured');
    }

    const userInfo: SubscriptionUserInfo = {
      upload: user.trafficUp,
      download: user.trafficDown,
      total: user.trafficLimit,
      expire: user.expiryDate,
    };

    const hostOverrides = await this.getHostOverrides(user);
    const clientFormat = detectClientFormat(userAgent);

    if (clientFormat === 'clash') {
      const clashConfig = this.generateClashConfig(user, settings, hostOverrides);
      return { content: clashConfig, contentType: 'text/yaml; charset=utf-8', userInfo };
    }

    if (clientFormat === 'singbox') {
      const singboxConfig = this.generateSingboxConfig(user, settings, hostOverrides);
      return { content: singboxConfig, contentType: 'application/json; charset=utf-8', userInfo };
    }

    // Default: base64 links
    const links = this.generateBase64Links(user, settings, hostOverrides);
    return { content: links, contentType: 'text/plain; charset=utf-8', userInfo };
  }

  private generateBase64Links(
    user: { uuid: string; remark: string | null; email: string },
    settings: {
      serverIp: string | null;
      realityEnabled: boolean;
      realityPort: number;
      realityPbk: string | null;
      realitySni: string;
      realitySid: string | null;
      wsEnabled: boolean;
      wsPort: number;
      wsPath: string | null;
      wsHost: string | null;
      cdnDomain: string | null;
      ssEnabled: boolean;
      ssPort: number;
      ssMethod: string;
      ssPassword: string | null;
    },
    hostOverrides: Record<string, string> = {},
  ): string {
    const links: string[] = [];
    const serverIp = this.resolveServerIp(hostOverrides, settings);
    const remark = user.remark ?? user.email;

    if (settings.realityEnabled) {
      const realityHost = hostOverrides['reality'] ?? serverIp;
      const params = new URLSearchParams({
        type: 'tcp',
        security: 'reality',
        pbk: settings.realityPbk ?? '',
        fp: 'chrome',
        sni: settings.realitySni,
        sid: settings.realitySid ?? '',
        flow: 'xtls-rprx-vision',
      });
      links.push(
        `vless://${user.uuid}@${realityHost}:${settings.realityPort}?${params.toString()}#${encodeURIComponent(`${remark}-reality`)}`,
      );
    }

    if (settings.wsEnabled) {
      const wsOverride = hostOverrides['ws'];
      const host = wsOverride ?? settings.cdnDomain ?? settings.wsHost ?? serverIp;
      const params = new URLSearchParams({
        type: 'ws',
        security: 'none',
        path: settings.wsPath ?? '/ws',
        host,
      });
      links.push(
        `vless://${user.uuid}@${host}:${settings.wsPort}?${params.toString()}#${encodeURIComponent(`${remark}-ws`)}`,
      );
    }

    if (settings.ssEnabled && settings.ssPassword) {
      const ssHost = hostOverrides['ss'] ?? serverIp;
      const userInfo = Buffer.from(
        `${settings.ssMethod}:${settings.ssPassword}`,
      ).toString('base64');
      links.push(
        `ss://${userInfo}@${ssHost}:${settings.ssPort}#${encodeURIComponent(`${remark}-ss`)}`,
      );
    }

    return Buffer.from(links.join('\n')).toString('base64');
  }

  private generateClashConfig(
    user: { uuid: string; remark: string | null; email: string },
    settings: {
      serverIp: string | null;
      realityEnabled: boolean;
      realityPort: number;
      realityPbk: string | null;
      realitySni: string;
      realitySid: string | null;
      wsEnabled: boolean;
      wsPort: number;
      wsPath: string | null;
      wsHost: string | null;
      cdnDomain: string | null;
      ssEnabled: boolean;
      ssPort: number;
      ssMethod: string;
      ssPassword: string | null;
      splitTunneling: boolean;
    },
    hostOverrides: Record<string, string> = {},
  ): string {
    const serverIp = this.resolveServerIp(hostOverrides, settings);
    const remark = user.remark ?? user.email;
    const proxies: string[] = [];
    const proxyNames: string[] = [];

    if (settings.realityEnabled) {
      const realityHost = hostOverrides['reality'] ?? serverIp;
      const name = `${remark}-reality`;
      proxyNames.push(name);
      proxies.push(
        `  - name: "${name}"\n` +
        `    type: vless\n` +
        `    server: ${realityHost}\n` +
        `    port: ${settings.realityPort}\n` +
        `    uuid: ${user.uuid}\n` +
        `    network: tcp\n` +
        `    tls: true\n` +
        `    udp: true\n` +
        `    flow: xtls-rprx-vision\n` +
        `    servername: ${settings.realitySni}\n` +
        `    reality-opts:\n` +
        `      public-key: ${settings.realityPbk ?? ''}\n` +
        `      short-id: ${settings.realitySid ?? ''}\n` +
        `    client-fingerprint: chrome`,
      );
    }

    if (settings.wsEnabled) {
      const wsOverride = hostOverrides['ws'];
      const host = wsOverride ?? settings.cdnDomain ?? settings.wsHost ?? serverIp;
      const name = `${remark}-ws`;
      proxyNames.push(name);
      proxies.push(
        `  - name: "${name}"\n` +
        `    type: vless\n` +
        `    server: ${host}\n` +
        `    port: ${settings.wsPort}\n` +
        `    uuid: ${user.uuid}\n` +
        `    network: ws\n` +
        `    tls: false\n` +
        `    udp: true\n` +
        `    ws-opts:\n` +
        `      path: ${settings.wsPath ?? '/ws'}\n` +
        `      headers:\n` +
        `        Host: ${host}`,
      );
    }

    if (settings.ssEnabled && settings.ssPassword) {
      const ssHost = hostOverrides['ss'] ?? serverIp;
      const name = `${remark}-ss`;
      proxyNames.push(name);
      proxies.push(
        `  - name: "${name}"\n` +
        `    type: ss\n` +
        `    server: ${ssHost}\n` +
        `    port: ${settings.ssPort}\n` +
        `    cipher: ${settings.ssMethod}\n` +
        `    password: "${settings.ssPassword}"`,
      );
    }

    const proxyNamesYaml = proxyNames.map((n) => `      - "${n}"`).join('\n');

    let rules = '';
    if (settings.splitTunneling) {
      rules =
        `rules:\n` +
        `  - DOMAIN-SUFFIX,ru,DIRECT\n` +
        `  - DOMAIN-SUFFIX,su,DIRECT\n` +
        `  - DOMAIN-SUFFIX,xn--p1ai,DIRECT\n` +
        `  - GEOIP,RU,DIRECT\n` +
        `  - MATCH,proxy`;
    } else {
      rules = `rules:\n  - MATCH,proxy`;
    }

    return (
      `mixed-port: 7890\n` +
      `allow-lan: false\n` +
      `mode: rule\n` +
      `log-level: info\n` +
      `\n` +
      `proxies:\n` +
      proxies.join('\n\n') + '\n' +
      `\n` +
      `proxy-groups:\n` +
      `  - name: proxy\n` +
      `    type: select\n` +
      `    proxies:\n` +
      proxyNamesYaml + '\n' +
      `\n` +
      rules + '\n'
    );
  }

  private generateSingboxConfig(
    user: { uuid: string; remark: string | null; email: string },
    settings: {
      serverIp: string | null;
      realityEnabled: boolean;
      realityPort: number;
      realityPbk: string | null;
      realitySni: string;
      realitySid: string | null;
      wsEnabled: boolean;
      wsPort: number;
      wsPath: string | null;
      wsHost: string | null;
      cdnDomain: string | null;
      ssEnabled: boolean;
      ssPort: number;
      ssMethod: string;
      ssPassword: string | null;
      splitTunneling: boolean;
    },
    hostOverrides: Record<string, string> = {},
  ): string {
    const serverIp = this.resolveServerIp(hostOverrides, settings);
    const remark = user.remark ?? user.email;
    const outbounds: Record<string, unknown>[] = [];
    const tags: string[] = [];

    if (settings.realityEnabled) {
      const realityHost = hostOverrides['reality'] ?? serverIp;
      const tag = `${remark}-reality`;
      tags.push(tag);
      outbounds.push({
        type: 'vless',
        tag,
        server: realityHost,
        server_port: settings.realityPort,
        uuid: user.uuid,
        flow: 'xtls-rprx-vision',
        tls: {
          enabled: true,
          server_name: settings.realitySni,
          utls: { enabled: true, fingerprint: 'chrome' },
          reality: {
            enabled: true,
            public_key: settings.realityPbk ?? '',
            short_id: settings.realitySid ?? '',
          },
        },
      });
    }

    if (settings.wsEnabled) {
      const wsOverride = hostOverrides['ws'];
      const host = wsOverride ?? settings.cdnDomain ?? settings.wsHost ?? serverIp;
      const tag = `${remark}-ws`;
      tags.push(tag);
      outbounds.push({
        type: 'vless',
        tag,
        server: host,
        server_port: settings.wsPort,
        uuid: user.uuid,
        transport: {
          type: 'ws',
          path: settings.wsPath ?? '/ws',
          headers: { Host: host },
        },
      });
    }

    if (settings.ssEnabled && settings.ssPassword) {
      const ssHost = hostOverrides['ss'] ?? serverIp;
      const tag = `${remark}-ss`;
      tags.push(tag);
      outbounds.push({
        type: 'shadowsocks',
        tag,
        server: ssHost,
        server_port: settings.ssPort,
        method: settings.ssMethod,
        password: settings.ssPassword,
      });
    }

    outbounds.push({
      type: 'selector',
      tag: 'proxy',
      outbounds: tags,
      default: tags[0] ?? '',
    });

    outbounds.push({ type: 'direct', tag: 'direct' });
    outbounds.push({ type: 'block', tag: 'block' });
    outbounds.push({ type: 'dns', tag: 'dns-out' });

    const rules: Record<string, unknown>[] = [];
    if (settings.splitTunneling) {
      rules.push({
        domain_suffix: ['.ru', '.su', '.xn--p1ai'],
        outbound: 'direct',
      });
      rules.push({
        geoip: ['RU'],
        outbound: 'direct',
      });
    }
    rules.push({ protocol: 'dns', outbound: 'dns-out' });

    const config = {
      log: { level: 'info' },
      dns: {
        servers: [
          { tag: 'google', address: 'tls://8.8.8.8' },
          { tag: 'local', address: 'local', detour: 'direct' },
        ],
        rules: [
          { outbound: 'any', server: 'local' },
        ],
      },
      inbounds: [
        {
          type: 'tun',
          tag: 'tun-in',
          inet4_address: '172.19.0.1/30',
          auto_route: true,
          strict_route: true,
          stack: 'system',
          sniff: true,
        },
      ],
      outbounds,
      route: {
        rules,
        final: 'proxy',
        auto_detect_interface: true,
      },
    };

    return JSON.stringify(config, null, 2);
  }

  generateOutline(
    user: { remark: string | null; email: string },
    settings: {
      serverIp: string | null;
      ssEnabled: boolean;
      ssPort: number;
      ssMethod: string;
      ssPassword: string | null;
    },
    hostOverrides: Record<string, string> = {},
  ): string {
    const serverIp = this.resolveServerIp(hostOverrides, settings);
    const remark = user.remark ?? user.email;
    const servers: Record<string, unknown>[] = [];

    if (settings.ssEnabled && settings.ssPassword) {
      const ssHost = hostOverrides['ss'] ?? serverIp;
      servers.push({
        id: 'hydraflow-main',
        name: `HydraFlow SS - ${remark}`,
        method: settings.ssMethod,
        password: settings.ssPassword,
        server: ssHost,
        server_port: settings.ssPort,
      });
    }

    return JSON.stringify({ servers }, null, 2);
  }

  async generateOutlineConfig(
    token: string,
  ): Promise<{ content: string; contentType: string; userInfo: SubscriptionUserInfo }> {
    const user = await this.prisma.user.findUnique({
      where: { subToken: token },
    });

    if (!user || !user.enabled) {
      throw new NotFoundException('Invalid or disabled subscription');
    }

    if (user.expiryDate && user.expiryDate < new Date()) {
      throw new NotFoundException('Subscription expired');
    }

    const settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });

    if (!settings) {
      throw new NotFoundException('Server not configured');
    }

    const userInfo: SubscriptionUserInfo = {
      upload: user.trafficUp,
      download: user.trafficDown,
      total: user.trafficLimit,
      expire: user.expiryDate,
    };

    const hostOverrides = await this.getHostOverrides(user);
    const content = this.generateOutline(user, settings, hostOverrides);
    return { content, contentType: 'application/json; charset=utf-8', userInfo };
  }

  getSubscriptionUrl(token: string, host?: string): string {
    const base = host ?? 'http://localhost:3000';
    return `${base}/sub/${token}`;
  }

  async generatePage(token: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { subToken: token },
    });

    if (!user) {
      throw new NotFoundException('Invalid subscription token');
    }

    const settings = await this.prisma.settings.findUnique({
      where: { id: 'main' },
    });

    const branding = await this.getSquadBranding(user);
    const remark = escapeHtml(user.remark ?? user.email);
    const email = escapeHtml(user.email);
    const status = !user.enabled
      ? 'Disabled'
      : user.expiryDate && user.expiryDate < new Date()
        ? 'Expired'
        : 'Active';

    const statusColor =
      status === 'Active' ? '#00e8c6' : status === 'Expired' ? '#ff6b6b' : '#fcc419';

    const trafficUp = formatBytes(user.trafficUp);
    const trafficDown = formatBytes(user.trafficDown);
    const trafficTotal = formatBytes(user.trafficUp + user.trafficDown);
    const trafficLimit = user.trafficLimit
      ? formatBytes(user.trafficLimit)
      : 'Unlimited';

    const expiryDate = user.expiryDate
      ? user.expiryDate.toISOString().split('T')[0]
      : 'Never';

    const hostOverrides = await this.getHostOverrides(user);
    const subHost = hostOverrides['serverIp'] ?? settings?.serverIp;
    const subUrl = `${subHost ? `http://${subHost}:3000` : ''}/sub/${token}`;
    const safeSubUrl = escapeHtml(subUrl);

    const protocols: string[] = [];
    if (settings?.realityEnabled) protocols.push('VLESS+Reality');
    if (settings?.wsEnabled) protocols.push('VLESS+WebSocket');
    if (settings?.ssEnabled) protocols.push('Shadowsocks');

    const deviceCount = await this.prisma.hwidDevice.count({
      where: { userId: user.id },
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(branding.title)} - ${remark}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #060a12 0%, #0b1121 50%, #111b30 100%);
      color: #d0d7e3;
      min-height: 100vh;
      padding: 24px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 32px;
      padding: 24px 0;
    }
    .header h1 {
      color: #00e8c6;
      font-size: 28px;
      letter-spacing: -0.5px;
    }
    .header p { color: #97a8c2; margin-top: 8px; font-size: 14px; }
    .card {
      background: #0b1121;
      border: 1px solid #1a2940;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .card h2 {
      font-size: 14px;
      text-transform: uppercase;
      color: #97a8c2;
      margin-bottom: 16px;
      letter-spacing: 0.5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #111b30;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #97a8c2; font-size: 14px; }
    .info-value { color: #d0d7e3; font-size: 14px; font-weight: 500; }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: ${statusColor}22;
      color: ${statusColor};
      border: 1px solid ${statusColor}44;
    }
    .sub-url {
      background: #060a12;
      border: 1px solid #1a2940;
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      color: #00e8c6;
      margin-bottom: 12px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #00b894, #00cec9);
      color: #060a12;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      width: 100%;
    }
    .btn:hover { opacity: 0.9; }
    .qr-container { text-align: center; margin: 16px 0; }
    .qr-container img {
      border-radius: 8px;
      background: #fff;
      padding: 8px;
    }
    .guide-section { margin-top: 8px; }
    .guide-item {
      background: #060a12;
      border: 1px solid #1a2940;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    }
    .guide-item h3 { color: #00e8c6; font-size: 14px; margin-bottom: 4px; }
    .guide-item p { color: #97a8c2; font-size: 13px; line-height: 1.5; }
    .protocols {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .protocol-badge {
      background: #1a2940;
      color: #00e8c6;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(branding.brand)}</h1>
      <p>Subscription for ${remark}</p>
    </div>

    <div class="card">
      <h2>Account Info</h2>
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value"><span class="status-badge">${status}</span></span>
      </div>
      <div class="info-row">
        <span class="info-label">Expires</span>
        <span class="info-value">${expiryDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Devices</span>
        <span class="info-value">${deviceCount} / ${user.maxDevices}</span>
      </div>
    </div>

    <div class="card">
      <h2>Traffic Usage</h2>
      <div class="info-row">
        <span class="info-label">Upload</span>
        <span class="info-value">${trafficUp}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Download</span>
        <span class="info-value">${trafficDown}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Total Used</span>
        <span class="info-value">${trafficTotal}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Limit</span>
        <span class="info-value">${trafficLimit}</span>
      </div>
    </div>

    <div class="card">
      <h2>Subscription Link</h2>
      <div class="sub-url" id="subUrl">${safeSubUrl}</div>
      <div class="qr-container">
        <img
          src="/subscription/qr/${encodeURIComponent(token)}"
          alt="QR Code"
          width="200"
          height="200"
        />
      </div>
      <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('subUrl').textContent);this.textContent='Copied!';">
        Copy Subscription Link
      </button>
    </div>

    <div class="card">
      <h2>Available Protocols</h2>
      <div class="protocols">
        ${protocols.map((p) => `<span class="protocol-badge">${p}</span>`).join('\n        ')}
      </div>
    </div>

    <div class="card">
      <h2>Setup Guides</h2>
      <div class="guide-section">
        <div class="guide-item">
          <h3>iOS / macOS</h3>
          <p>Install Streisand or V2Box from the App Store. Add server by pasting the subscription link above, or scan the QR code.</p>
        </div>
        <div class="guide-item">
          <h3>Android</h3>
          <p>Install V2rayNG from Google Play. Tap the + button, select "Import config from clipboard" after copying the subscription link.</p>
        </div>
        <div class="guide-item">
          <h3>Windows</h3>
          <p>Download Nekoray or V2rayN. Add subscription URL in settings, then update and connect.</p>
        </div>
        <div class="guide-item">
          <h3>Linux</h3>
          <p>Use Nekoray or configure xray-core directly with the subscription link. Use the base64 decoded config URLs.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
