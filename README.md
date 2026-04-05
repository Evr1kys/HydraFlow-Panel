<h1 align="center">HydraFlow Panel</h1>

<p align="center">
  <strong>Open-source admin panel for managing proxy servers, users, and subscriptions.</strong>
</p>

<p align="center">
  <a href="https://github.com/Evr1kys/HydraFlow-Panel/releases"><img src="https://img.shields.io/github/v/release/Evr1kys/HydraFlow-Panel?style=flat-square" alt="Release"></a>
  <a href="https://github.com/Evr1kys/HydraFlow-Panel/actions"><img src="https://img.shields.io/github/actions/workflow/status/Evr1kys/HydraFlow-Panel/ci.yml?style=flat-square" alt="CI"></a>
  <a href="https://github.com/Evr1kys/HydraFlow-Panel/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Evr1kys/HydraFlow-Panel?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/node-20+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 20+">
  <img src="https://img.shields.io/badge/postgres-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="Postgres 16">
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18">
</p>

<p align="center">
  <a href="https://hydraflow.xyz">Website</a> &bull;
  <a href="https://docs.hydraflow.xyz">Documentation</a> &bull;
  <a href="https://github.com/Evr1kys/HydraFlow">Core engine</a>
</p>

---

## What is this?

Full-stack admin panel for proxy operators. Manage users, nodes, subscriptions, payments, and a
Telegram shop bot — all from one interface. Built with care by enthusiasts who wanted a panel
that's actually pleasant to use.

## Features

**Users & subscriptions**
- User CRUD with auto-generated subscription tokens, per-user device limits, traffic strategies
- One-click expiry renewal, traffic reset, subscription revocation, bulk actions
- v2ray / Clash / sing-box / Outline subscription formats with custom templates
- Per-user QR codes (local generation, no external dependencies)
- Import from 3x-ui and Marzban databases

**Server management**
- Multi-node xray config sync via HTTPS API
- Health checks, restart orchestration, per-node plugin control
- Host management (inbound entries separate from nodes)
- Real-time protocol monitoring — VLESS+Reality, VLESS+WebSocket, Shadowsocks 2022
- ISP intelligence map — see which methods work per provider per country
- Config profiles and live Xray config editor with Monaco

**Security & access control**
- JWT + OAuth2 (Telegram/GitHub/Yandex) + WebAuthn/Passkeys + 2FA/TOTP
- RBAC with 4 roles (superadmin, admin, operator, readonly)
- Audit log of every mutation (who, what, when, IP, UA)
- Admin API keys with granular scopes (`hf_`-prefixed, SHA-256 hashed)
- Rate limiting, helmet security headers, restrictive CORS

**Billing**
- User subscription payments: YooKassa, Stripe, NOWPayments, Heleket, CryptoBot
- Internal squads, external squads for resellers with host overrides

**Telegram Shop Bot (built-in)**
- User-facing bot: buy subscriptions, top up balance, view traffic, referrals, support
- Visual button constructor with per-menu inline/reply mode toggle
- Payment providers: YooKassa, Telegram Stars, CryptoBot, Heleket
- Admin tools: broadcast, bot users, plans, promo codes, transactions

**Ops**
- PostgreSQL backups (daily cron, retention cleanup, manual restore)
- SMTP email notifications (welcome, expiry, password reset, 2FA)
- Webhooks with BullMQ retry (5 attempts, exponential backoff, delivery log)
- Prometheus metrics endpoint
- Three languages: English, Russian, Chinese

## Quick start

```bash
git clone https://github.com/Evr1kys/HydraFlow-Panel.git
cd HydraFlow-Panel
cp .env.example .env
# edit .env — at minimum set DB_PASSWORD, JWT_SECRET, SERVER_PUBLIC_IP, CORS_ORIGIN
docker compose up -d
```

Open `http://localhost:2080`. Default credentials: `admin@hydraflow.dev` / `admin` (change
this in Settings immediately after first login).

Promote the default admin to `superadmin` (to access admin management and sensitive endpoints):

```bash
docker compose exec postgres psql -U hydraflow -d hydraflow \
  -c "UPDATE \"Admin\" SET role='superadmin' WHERE email='admin@hydraflow.dev';"
```

## Architecture

```
backend/   NestJS + TypeScript + Prisma + PostgreSQL + Redis + BullMQ
frontend/  React 18 + Vite + Mantine v7 + TanStack Query
```

Full architecture breakdown and API reference at
[docs.hydraflow.xyz](https://docs.hydraflow.xyz). Swagger UI available at `/api/docs` after
startup.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 10, Prisma 5, class-validator, PostgreSQL 16, Redis 7, BullMQ |
| Frontend | React 18, Vite, Mantine v7, @tabler/icons-react, Monaco, qrcode.react |
| Auth | JWT, @simplewebauthn (Passkeys), OTPLib (2FA), arctic (OAuth) |
| Bot | grammY, nanoid |
| Observability | prom-client, custom audit interceptor |

## Development

```bash
# Backend (hot reload on :3000)
cd backend
npm install
npx prisma generate
npm run start:dev

# Frontend (Vite dev on :5173)
cd frontend
npm install
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full dev guide.

## License

[MPL-2.0](LICENSE) — free to use, fork, and modify. Changes to core files stay open.

## Links

- [HydraFlow core](https://github.com/Evr1kys/HydraFlow) — the Go anti-censorship engine
- [Documentation](https://docs.hydraflow.xyz)
- [Website](https://hydraflow.xyz)
