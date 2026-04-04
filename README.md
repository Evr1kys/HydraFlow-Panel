# HydraFlow Panel

Admin panel for HydraFlow proxy servers. Built with NestJS, React, Mantine v7, Prisma, and PostgreSQL.

![Version](https://img.shields.io/badge/version-2.0.0-teal)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Dashboard** -- Real-time protocol health monitoring, user statistics, traffic overview, and censorship alerts
- **User Management** -- Full CRUD with auto-generated subscription links, traffic tracking, and expiry management
- **Protocol Support** -- VLESS+Reality, VLESS+WebSocket, Shadowsocks 2022 with per-protocol configuration
- **ISP Intelligence** -- Unique censorship monitoring matrix by country, ISP, and protocol (not found in Remnawave)
- **Subscription API** -- Public endpoint for V2Ray/Xray client configuration delivery
- **Settings** -- Split tunneling, ad blocking, CDN domain, protocol toggling
- **Dark Theme** -- Professional dark UI with teal accents, Outfit font, Tabler icons

### Comparison with Remnawave

| Feature | HydraFlow Panel | Remnawave |
|---------|----------------|-----------|
| ISP Intelligence Map | Yes | No |
| Censorship Alerts | Yes | No |
| Protocol Health Monitor | Yes | Partial |
| Split Tunneling Config | Yes | No |
| Ad Blocking Toggle | Yes | No |
| Multi-protocol | Reality + WS + SS | Reality + WS |
| Dark Theme | Custom dark | Default |

## Quick Start

```bash
git clone https://github.com/Evr1kys/HydraFlow-Panel.git
cd HydraFlow-Panel
cp .env.example .env
# Edit .env with your secrets
docker-compose up -d
```

Panel will be available at `http://localhost:2080`

Default credentials: `admin@hydraflow.dev` / `admin`

## Architecture

```
backend/           NestJS + TypeScript + Prisma + PostgreSQL
  src/
    auth/          JWT authentication
    users/         User management + subscription tokens
    xray/          Xray process control + config generation
    settings/      Server and protocol settings
    dashboard/     Statistics and health checks
    intelligence/  ISP censorship monitoring
    subscription/  Public subscription endpoint
    health/        Protocol port connectivity checks
    prisma/        Database service

frontend/          React + Vite + Mantine v7
  src/
    api/           Axios API client functions
    components/    AppShell, AuthProvider
    pages/         Dashboard, Users, Settings, Intelligence, Login
```

## API Reference

### Authentication
- `POST /api/auth/login` -- Login with email/password, returns JWT
- `POST /api/auth/change-password` -- Change admin password

### Users
- `GET /api/users` -- List all users
- `POST /api/users` -- Create user
- `PATCH /api/users/:id` -- Update user
- `DELETE /api/users/:id` -- Delete user
- `POST /api/users/:id/toggle` -- Toggle user enabled/disabled

### Settings
- `GET /api/settings` -- Get current settings
- `PATCH /api/settings` -- Update settings (rebuilds xray config)

### Xray
- `GET /api/xray/status` -- Get xray process status
- `POST /api/xray/restart` -- Restart xray process

### Dashboard
- `GET /api/dashboard/stats` -- Get dashboard statistics

### Intelligence
- `GET /api/intelligence` -- Get ISP intelligence map
- `POST /api/intelligence/report` -- Submit ISP report
- `GET /api/alerts` -- Get censorship alerts

### Subscription
- `GET /sub/:token` -- Public subscription endpoint (no auth)

### Health
- `GET /api/health` -- Protocol port health checks

## Development

### Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## License

MIT

## Links

- [HydraFlow Main Project](https://github.com/Evr1kys/HydraFlow)
