import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async generateLinks(token: string): Promise<string> {
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

    const links: string[] = [];
    const serverIp = settings.serverIp ?? '127.0.0.1';
    const remark = user.remark ?? user.email;

    if (settings.realityEnabled) {
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
        `vless://${user.uuid}@${serverIp}:${settings.realityPort}?${params.toString()}#${encodeURIComponent(`${remark}-reality`)}`,
      );
    }

    if (settings.wsEnabled) {
      const host = settings.cdnDomain ?? settings.wsHost ?? serverIp;
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
      const userInfo = Buffer.from(
        `${settings.ssMethod}:${settings.ssPassword}`,
      ).toString('base64');
      links.push(
        `ss://${userInfo}@${serverIp}:${settings.ssPort}#${encodeURIComponent(`${remark}-ss`)}`,
      );
    }

    return Buffer.from(links.join('\n')).toString('base64');
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

    const subUrl = `${settings?.serverIp ? `http://${settings.serverIp}:3000` : ''}/sub/${token}`;
    const safeSubUrl = escapeHtml(subUrl);

    const protocols: string[] = [];
    if (settings?.realityEnabled) protocols.push('VLESS+Reality');
    if (settings?.wsEnabled) protocols.push('VLESS+WebSocket');
    if (settings?.ssEnabled) protocols.push('Shadowsocks');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HydraFlow - ${remark}</title>
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
      <h1>HydraFlow</h1>
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
          src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&amp;data=${encodeURIComponent(subUrl)}"
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
