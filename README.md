# HydraFlow Panel

Web admin panel for managing HydraFlow proxy servers.

## Features
- User management (add/remove/traffic limits)
- Protocol configuration (Reality, WS, SS, Trojan)
- Real-time monitoring via SSE
- Subscription link generation with QR codes
- Multi-server support
- Dark theme UI

## Quick Start
```bash
go build -o hydraflow-panel ./cmd/
./hydraflow-panel --listen :2080
```

## Part of [HydraFlow](https://github.com/Evr1kys/HydraFlow)
