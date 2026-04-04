<p align="center">
  <img src="https://raw.githubusercontent.com/Evr1kys/HydraFlow/main/.github/logo.svg" width="120" alt="HydraFlow" />
</p>

<h1 align="center">HydraFlow Panel</h1>

<p align="center">
  Modern web panel for managing <a href="https://github.com/Evr1kys/HydraFlow">HydraFlow</a> proxy server.<br />
  Built with NestJS, React, Mantine UI, PostgreSQL, and Redis.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-Full%20Stack-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/NestJS-Backend-red?style=flat-square&logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/React-Frontend-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

<!-- Screenshot placeholder -->
<!-- <p align="center"><img src=".github/screenshot.png" width="800" /></p> -->

## Features

- **User Management** -- create, enable/disable, delete proxy users with auto-generated UUIDs
- **Subscription Links** -- V2Ray-compatible base64 subscription endpoint for each user
- **Multi-Protocol** -- VLESS + Reality, VLESS + WebSocket, Shadowsocks configuration
- **Xray Control** -- start, stop, restart Xray-core directly from the panel
- **Dashboard** -- real-time stats: user count, traffic usage, uptime, service status
- **Dark UI** -- clean dark theme with glassmorphism cards, built with Mantine v7
- **JWT Authentication** -- secure admin login with token refresh
- **Docker Ready** -- one-command deployment with Docker Compose

## Quick Start

```bash
git clone https://github.com/Evr1kys/HydraFlow-Panel.git
cd HydraFlow-Panel
```

Create a `.env` file:

```env
DB_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
```

Start with Docker Compose:

```bash
docker compose up -d
```

The panel will be available at `http://your-server:2080`.

**Default credentials:**
- Email: `admin@hydraflow.dev`
- Password: `admin`

> Change the default password immediately after first login.

## Development

### Backend

```bash
cd backend
cp .env.example .env
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

## Architecture

```
HydraFlow-Panel/
├── backend/            NestJS + Prisma + PostgreSQL
│   ├── src/
│   │   ├── auth/       JWT authentication
│   │   ├── users/      User CRUD
│   │   ├── xray/       Xray-core management
│   │   ├── subscription/  Public V2Ray subscription
│   │   ├── dashboard/  Statistics API
│   │   ├── settings/   Server configuration
│   │   └── prisma/     Database client + seed
│   └── prisma/         Schema + migrations
├── frontend/           React + Mantine + Vite
│   └── src/
│       ├── pages/      Login, Dashboard, Users, Settings
│       ├── components/ AppShell, AuthProvider
│       └── api/        Axios API client
└── docker-compose.yml  Full-stack deployment
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/login` | No | Admin login |
| POST | `/api/auth/refresh` | No | Refresh JWT |
| GET | `/api/dashboard/stats` | Yes | Dashboard statistics |
| GET | `/api/users` | Yes | List all users |
| POST | `/api/users` | Yes | Create user |
| PATCH | `/api/users/:id` | Yes | Update user |
| DELETE | `/api/users/:id` | Yes | Delete user |
| POST | `/api/users/:id/toggle` | Yes | Toggle user status |
| GET | `/api/xray/status` | Yes | Xray service status |
| POST | `/api/xray/restart` | Yes | Restart Xray |
| GET | `/api/settings` | Yes | Get settings |
| PUT | `/api/settings` | Yes | Update settings |
| GET | `/sub/:token` | No | V2Ray subscription |

## Related

- [HydraFlow](https://github.com/Evr1kys/HydraFlow) -- The core anti-censorship proxy server

## License

MIT
