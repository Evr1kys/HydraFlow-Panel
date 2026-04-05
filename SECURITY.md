# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue. Report security bugs privately via
GitHub's security advisories feature:

[Report a vulnerability](https://github.com/Evr1kys/HydraFlow-Panel/security/advisories/new)

Include:
- A description of the vulnerability
- Steps to reproduce
- Affected version/commit
- Your suggested fix (if any)

## Supported versions

| Version | Supported |
|---------|-----------|
| 2.x     | Yes       |
| 1.x     | Security fixes only |
| < 1.0   | No        |

## Security measures

HydraFlow Panel ships with the following protections enabled by default:

- **JWT Bearer auth** on all `/api/*` endpoints (no cookies → no CSRF surface)
- **Helmet** middleware (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- **Restrictive CORS** (only origins listed in `CORS_ORIGIN` env var)
- **Rate limiting** via `@nestjs/throttler` (5 req/min on auth endpoints, 100/min default)
- **Argon2/bcrypt** password hashing
- **SHA-256** API key hashing (plaintext shown once on creation)
- **Audit log** of every mutation (action, resource, admin, IP, user agent, success)
- **RBAC** with 4 roles (superadmin/admin/operator/readonly)
- **Passkey challenges** stored in Redis with 5-minute TTL
- **Webhook signing** with HMAC-SHA256
- **Sensitive-value masking** on settings GET responses (Reality private keys, passwords)

## Responsible deployment checklist

Before going to production:

- [ ] Generate a strong unique `JWT_SECRET` (at least 32 random chars)
- [ ] Change default `ADMIN_PASSWORD` immediately after first login
- [ ] Restrict `CORS_ORIGIN` to your actual panel domain
- [ ] Set up HTTPS via Cloudflare or Let's Encrypt (never serve the panel over HTTP)
- [ ] Configure Telegram bot token via env, not code
- [ ] Do not expose the backend port (3100) publicly — only through the frontend reverse proxy
- [ ] Regularly review the audit log (`/audit-log` page)
- [ ] Rotate admin API keys periodically

## Known limitations

- Default admin credentials (`admin@hydraflow.dev` / `admin`) must be changed immediately after deployment.
- The panel does not encrypt its PostgreSQL database at rest — use disk-level encryption if needed.
- Backup files contain full user data including Reality keys — protect `/var/backups/hydraflow/` with file-system permissions.
