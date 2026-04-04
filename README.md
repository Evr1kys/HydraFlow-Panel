<p align="center">
  <img src="https://raw.githubusercontent.com/Evr1kys/HydraFlow/main/assets/logo.svg" width="80" alt="HydraFlow Logo">
</p>

<h1 align="center">HydraFlow Panel</h1>

<p align="center">
  Production-grade administration panel for the <a href="https://github.com/Evr1kys/HydraFlow">HydraFlow</a> anti-censorship proxy server.<br>
  Single binary. No dependencies. No Node.js. No Docker required.
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#comparison-with-remnawave">Comparison</a> |
  <a href="#architecture">Architecture</a> |
  <a href="#api-reference">API</a>
</p>

---

## Features

### Core Panel
- Single binary deployment (Go backend + embedded HTML/CSS/JS)
- Dark theme UI with glassmorphism design
- JWT authentication with bcrypt password hashing
- User management with subscription links (V2Ray base64 format)
- Protocol support: VLESS+Reality, VLESS+WebSocket, Shadowsocks
- Xray-core process management with live restart
- Traffic monitoring, limits, and expiry dates
- Responsive design (mobile-friendly)

### ISP Intelligence (unique to HydraFlow)
- Real-time ISP blocking data by country (Russia, China, Iran)
- ISP x Protocol matrix table with color-coded status cells
- Crowdsourced anonymous blocking reports via public API
- Pre-seeded data for major ISPs: MegaFon, MTS, Beeline, Tele2, Rostelecom, China Telecom, China Unicom, China Mobile, Irancell, MCI, and more

### Protocol Health Monitor (unique to HydraFlow)
- Live TCP health checks for each configured protocol port
- Dashboard widget showing status, port, and latency for Reality, WS, and SS
- Auto-refresh every 30 seconds with 5-minute server-side cache
- Instant visibility into which protocols are up or down

### Censorship Alerts (unique to HydraFlow)
- Automatic alert generation when protocol status changes (working to blocked, etc.)
- Dashboard feed with the most recent alerts
- Color-coded by severity: red for blocked, green for recovered, yellow for degraded

### Public Subscription Page (unique to HydraFlow)
- Branded dark-themed page at `/p/:token` for end users
- Shows account status, QR code, and subscription URL
- Download links for v2rayNG, Hiddify, Streisand, NekoBox
- Setup guides per device (Android, iOS, Windows/macOS)
- Multi-language support (detects browser Accept-Language)
- No authentication required -- designed for end-user self-service

## Screenshots

| Dashboard | Intelligence | Subscription Page |
|-----------|-------------|-------------------|
| Server stats, protocol health cards, and censorship alerts feed | ISP x Protocol blocking matrix with country tabs | Branded user page with QR code, app links, and setup guides |

## Quick Start

### Binary

```bash
go build -o hydraflow-panel .
./hydraflow-panel --listen :2080 --db ./panel.json --xray-config ./xray-config.json
```

### Docker Compose

```yaml
version: "3.8"
services:
  panel:
    image: ghcr.io/evr1kys/hydraflow-panel:latest
    ports:
      - "2080:2080"
    volumes:
      - ./data:/etc/hydraflow
    restart: unless-stopped
```

```bash
docker compose up -d
```

Default credentials: `admin@hydraflow.dev` / `admin`

Open `http://your-server:2080` in your browser.

## Comparison with Remnawave

| Feature | HydraFlow Panel | Remnawave |
|---------|----------------|-----------|
| Deployment | Single Go binary | Node.js + PostgreSQL + Redis |
| ISP Intelligence | Built-in blocking matrix | Not available |
| Protocol Health | Live TCP health checks | Not available |
| Censorship Alerts | Real-time alert feed | Not available |
| Public Sub Page | Branded `/p/:token` page | Basic text endpoint |
| Crowdsourced Reports | Anonymous blocking API | Not available |
| Multi-language Sub | Auto-detect from browser | Not available |
| Database | JSON file (zero config) | PostgreSQL required |
| Memory footprint | ~15 MB | ~200+ MB (Node + PG + Redis) |
| Dependencies | None (single binary) | Node.js, npm, PostgreSQL, Redis |
| Protocols | Reality, WS, Shadowsocks | Reality, WS, Shadowsocks |
| User Management | Full CRUD + traffic limits | Full CRUD + traffic limits |
| Subscription Format | V2Ray base64 | V2Ray base64 |

## Architecture

```
+------------------------------------------------------------------+
|  HydraFlow Panel (single Go binary)                              |
|                                                                  |
|  +------------------+  +------------------+  +-----------------+ |
|  |  HTTP Server     |  |  Auth Manager    |  |  Xray Manager   | |
|  |  (stdlib)        |  |  (JWT + bcrypt)  |  |  (process ctl)  | |
|  +--------+---------+  +------------------+  +-----------------+ |
|           |                                                      |
|  +--------v---------+  +------------------+  +-----------------+ |
|  |  API Handlers     |  |  Intelligence    |  |  Health Cache   | |
|  |  /api/*           |  |  Store           |  |  (5m TTL)       | |
|  +------------------+  |  (in-memory)      |  +-----------------+ |
|                        +------------------+                      |
|  +------------------+  +------------------+                      |
|  |  JSON Database   |  |  Static Files    |                      |
|  |  (atomic writes) |  |  (go:embed)      |                      |
|  +------------------+  +------------------+                      |
+------------------------------------------------------------------+
         |                        |
         v                        v
  +-------------+          +-------------+
  | panel.json  |          | xray-core   |
  | (file)      |          | (subprocess)|
  +-------------+          +-------------+
```

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--listen` | `:2080` | HTTP listen address |
| `--db` | `/etc/hydraflow/panel.json` | Path to JSON database |
| `--xray-config` | `/etc/hydraflow/xray-config.json` | Path to xray config |

## API Reference

### Authenticated Endpoints (require JWT Bearer token)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/login` | Authenticate and receive JWT |
| GET | `/api/status` | Server status and stats |
| GET/POST | `/api/users` | List or create users |
| DELETE | `/api/users/:id` | Delete user |
| POST | `/api/users/:id/toggle` | Enable/disable user |
| GET | `/api/users/:id/sub` | Get subscription link |
| GET/POST | `/api/settings` | Protocol settings |
| POST | `/api/xray/restart` | Restart xray-core |
| GET | `/api/xray/status` | Xray running status |
| POST | `/api/admin/password` | Change admin password |
| GET | `/api/intelligence` | ISP blocking data (optional `?country=russia`) |
| GET | `/api/alerts` | Recent censorship alerts |
| GET | `/api/health` | Protocol health check results |

### Public Endpoints (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sub/:token` | V2Ray subscription (base64) |
| GET | `/p/:token` | Branded subscription page |
| POST | `/api/intelligence/report` | Submit anonymous blocking report |

### Intelligence Report Format

```json
POST /api/intelligence/report
{
  "country": "russia",
  "isp": "MegaFon",
  "asn": "AS31133",
  "protocol": "VLESS+Reality",
  "status": "working"
}
```

Status values: `working`, `slow`, `blocked`, `unknown`

## Tech Stack

- **Backend:** Go 1.22, stdlib HTTP server, bcrypt, HMAC-SHA256 JWT, html/template
- **Frontend:** Vanilla HTML/CSS/JS, embedded via `go:embed`
- **Database:** JSON file with atomic writes (no external DB required)
- **Fonts:** Outfit + JetBrains Mono
- **Icons:** Inline SVG (Lucide-style, stroke-based)

## License

MIT

## Links

- [HydraFlow (main project)](https://github.com/Evr1kys/HydraFlow)
- [HydraFlow Panel](https://github.com/Evr1kys/HydraFlow-Panel)
