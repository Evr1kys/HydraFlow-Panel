<p align="center">
  <img src="https://img.shields.io/badge/HydraFlow-Panel-20C997?style=for-the-badge&logoColor=white" alt="HydraFlow Panel" />
</p>
<h1 align="center">HydraFlow Panel</h1>
<p align="center">
  <strong>Open-source admin panel for managing proxy servers, users, and subscriptions.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-20C997?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-MPL--2.0-blue?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/node-20+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/postgres-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="Postgres" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
</p>

---

## What is this?

Full-stack admin panel for VPN / proxy operators. Manage users, nodes, subscriptions, payments,
and a Telegram shop bot — all from one interface. Built with care by enthusiasts who wanted a
panel that's actually pleasant to use.

## Features

**Users & subscriptions**
- User CRUD with auto-generated subscription tokens and per-user device limits
- One-click expiration renewal and traffic counters reset
- Subscription links in v2ray / Clash / sing-box / Outline formats
- Per-user QR codes (generated locally, no third-party dependencies)
- Migration import from 3x-ui and Marzban databases

**Server management**
- Multi-node xray config sync via HTTPS API (mTLS-friendly)
- Health checks, restart orchestration, per-node plugin control
- Real-time protocol monitoring (VLESS+Reality, VLESS+WebSocket, Shadowsocks 2022)
- ISP intelligence map — see which methods work per provider per country
- Config profiles and live Xray config editor with Monaco

**Security & access control**
- JWT + OAuth2 (Telegram/GitHub/Yandex) + WebAuthn/Passkeys + 2FA/TOTP
- RBAC with 4 roles: superadmin, admin, operator, readonly
- Audit log of every mutation (who, what, when, IP, UA)
- Admin API keys with granular scopes (`hf_`-prefixed, SHA-256 hashed)
- Rate limiting on auth endpoints, helmet, restrictive CORS

**Billing**
- User subscription payments: YooKassa, Stripe, NOWPayments (crypto)
- Internal squads, external squads for resellers with host overrides

**Telegram Shop Bot (built-in)**
- User-facing bot: buy subscriptions, top up balance, view traffic, support tickets, referrals
- Visual button constructor in the admin UI — drag/arrange buttons per menu
- Per-menu keyboard mode toggle (inline or reply)
- Payment providers: YooKassa, Telegram Stars, CryptoBot, Heleket
- Admin tools: broadcast, bot users, plans, promo codes, transactions

**Ops**
- PostgreSQL backups (daily cron, retention cleanup, manual restore)
- SMTP email notifications (welcome, expiry, password reset)
- Webhooks with BullMQ retry (5 attempts, exponential backoff)
- Prometheus metrics endpoint
- Three languages: English, Russian, Chinese

## Quick start

```bash
git clone https://github.com/Evr1kys/HydraFlow-Panel.git
cd HydraFlow-Panel
cp .env.example .env
# edit .env with your DB_PASSWORD, JWT_SECRET, SERVER_PUBLIC_IP, CORS_ORIGIN
docker compose up -d
```

Then open `http://localhost:2080`. Default credentials: `admin@hydraflow.dev` / `admin` (change
this immediately in Settings).

To promote the default admin to `superadmin`:
```bash
docker compose exec postgres psql -U hydraflow -d hydraflow \
  -c "UPDATE \"Admin\" SET role='superadmin' WHERE email='admin@hydraflow.dev';"
```

## Environment variables

Core (required):
- `DB_PASSWORD` — Postgres password
- `JWT_SECRET` — long random string
- `SERVER_PUBLIC_IP` — public IP of your proxy server (used in subscription URLs)
- `CORS_ORIGIN` — comma-separated list of panel origins

Optional:
- `PUBLIC_BASE_URL` — public URL of the panel (e.g. `https://panel.yourdomain.com`)
- `REDIS_URL` — defaults to `redis://redis:6379`

Telegram bot (optional):
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_ADMIN_ID`
- `BOT_SHOP_ENABLED=true` to start the user-facing shop bot

Payments (optional, per provider):
- YooKassa: `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- CryptoBot: `CRYPTOBOT_TOKEN`
- Heleket: `HELEKET_MERCHANT_ID`, `HELEKET_API_KEY`
- NOWPayments: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`

## Architecture

```
backend/   NestJS + TypeScript + Prisma + PostgreSQL + Redis + BullMQ
  src/
    auth/              JWT, 2FA, passkeys, OAuth2
    users/             User CRUD + subscription tokens
    nodes/             Multi-node xray management
    squads/            Internal + external squads
    subscription/      v2ray / clash / singbox / outline formats
    xray/              Xray process control + config generation
    settings/          Server and protocol settings
    config-profiles/   Xray config profile library
    intelligence/      ISP censorship monitoring
    health/            Protocol port health checks
    hwid/              Device ID limits
    traffic/           Per-period traffic aggregation
    billing/           Provider cost tracking
    user-billing/      User subscription payments (YooKassa, Stripe, crypto)
    plugins/           Node plugin execution via HTTPS
    webhooks/          Event webhooks with BullMQ retry
    telegram/          Admin notifications + bot commands
    bot/               User-facing Telegram shop bot
    email/             SMTP notifications (nodemailer)
    backup/            Scheduled PostgreSQL backups
    audit-log/         Mutation audit trail
    admins/            Admin management
    api-keys/          Admin API keys with scopes
    metrics/           Prometheus metrics
    migration/         Import from 3x-ui / Marzban

frontend/  React 18 + Vite + Mantine v7 + TanStack Query
  src/
    api/               Typed API clients
    components/        AppShell, ErrorBoundary, LoadingSkeleton, PageHeader
    hooks/             usePermissions, useFormValidation
    pages/             27 pages (dashboard, users, nodes, bot, billing, etc.)
    i18n/              English, Russian, Chinese
```

## API reference

Full OpenAPI docs available at `/api/docs` after startup (Swagger UI).

Key endpoint groups:
- `/api/auth/*` — login, passkeys, OAuth, 2FA
- `/api/users/*` — CRUD + renew/reset-traffic/bulk
- `/api/nodes/*` — node management + health + config push
- `/api/subscription/*` — public subscription endpoints (no auth)
- `/api/bot/*` — shop bot admin (plans, users, buttons, broadcast)
- `/api/bot/webhook/*` — payment provider webhooks
- `/api/audit-logs` — audit trail with CSV export
- `/api/backup/*` — database backup/restore
- `/api/metrics/prometheus` — Prometheus scrape endpoint

## Development

```bash
# Backend
cd backend
npm install
npx prisma generate
npm run start:dev     # http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev           # http://localhost:5173
```

## License

[MPL-2.0](LICENSE) — free to use, fork, and modify. Changes to core files stay open.

## Links

- [HydraFlow core](https://github.com/Evr1kys/HydraFlow) — the Go anti-censorship engine this panel drives
