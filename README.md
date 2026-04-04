# HydraFlow Panel

Production-grade administration panel for HydraFlow anti-censorship proxy server.

## Features

- Single binary deployment (Go backend + embedded HTML/CSS/JS frontend)
- Dark theme UI with glassmorphism design
- JWT authentication with bcrypt password hashing
- User management with subscription links (V2Ray base64 format)
- Protocol support: VLESS+Reality, VLESS+WebSocket, Shadowsocks
- Xray-core process management
- Traffic monitoring and limits
- Responsive design (mobile-friendly)

## Quick Start

```bash
go build -o hydraflow-panel .
./hydraflow-panel --listen :2080 --db ./panel.json --xray-config ./xray-config.json
```

Default credentials: `admin@hydraflow.dev` / `admin`

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--listen` | `:2080` | HTTP listen address |
| `--db` | `/etc/hydraflow/panel.json` | Path to JSON database |
| `--xray-config` | `/etc/hydraflow/xray-config.json` | Path to xray config |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/login` | No | JWT authentication |
| GET | `/api/status` | Yes | Server status |
| GET/POST | `/api/users` | Yes | List/create users |
| DELETE | `/api/users/:id` | Yes | Delete user |
| POST | `/api/users/:id/toggle` | Yes | Enable/disable user |
| GET | `/api/users/:id/sub` | Yes | Get subscription link |
| GET/POST | `/api/settings` | Yes | Protocol settings |
| POST | `/api/xray/restart` | Yes | Restart xray-core |
| GET | `/api/xray/status` | Yes | Xray running status |
| POST | `/api/admin/password` | Yes | Change admin password |
| GET | `/sub/:token` | No | Public subscription endpoint |

## Tech Stack

- **Backend:** Go 1.22, stdlib HTTP server, bcrypt, HMAC-SHA256 JWT
- **Frontend:** Vanilla HTML/CSS/JS, embedded via `go:embed`
- **Database:** JSON file with atomic writes
- **Fonts:** Outfit + JetBrains Mono
- **Icons:** Inline SVG (Lucide-style, stroke-based)
