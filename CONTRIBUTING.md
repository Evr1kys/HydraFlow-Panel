# Contributing to HydraFlow Panel

Thanks for your interest in contributing.

## Setup

```bash
git clone https://github.com/Evr1kys/HydraFlow-Panel.git
cd HydraFlow-Panel
cp .env.example .env
# edit .env, then:
docker compose up -d
```

Backend dev loop:
```bash
cd backend
npm install
npx prisma generate
npm run start:dev   # hot reload on http://localhost:3000
```

Frontend dev loop:
```bash
cd frontend
npm install
npm run dev         # Vite dev server on http://localhost:5173
```

## Before submitting a PR

- [ ] `cd backend && npx tsc --noEmit` passes
- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] `cd backend && npm run build` passes
- [ ] `cd frontend && npm run build` passes
- [ ] No new warnings in backend startup logs
- [ ] New endpoints have DTOs with `class-validator` decorators
- [ ] New pages use `@tabler/icons-react` — **no emoji anywhere**
- [ ] New i18n strings added to all 3 locales (`en.ts`, `ru.ts`, `zh.ts`)
- [ ] Mutations are protected with `@Roles(...)` where appropriate
- [ ] Secrets/keys are not logged or returned from GET endpoints

## Style

- **Backend**: NestJS conventions — one module per domain, DTOs in `dto/`, guards in `common/guards/`, decorators in `common/decorators/`.
- **Frontend**: one page per route, API clients in `src/api/`, shared components in `src/components/`, hooks in `src/hooks/`.
- **Dark theme only** — teal (`#20C997`) as accent, Outfit font, JetBrains Mono for numbers/IDs.
- **No emoji**: use `@tabler/icons-react` SVG icons instead.

## Commit messages

Short imperative subject line, optional body explaining the *why*:

```
feat: add bulk user actions

Add 8 new bulk endpoints for extend-expiration, reset-traffic, etc.
Each emits per-user webhook + event for downstream processing.
```

Prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`.

## Reporting bugs

Open an issue with:
- Version / commit hash (`git log -1 --oneline`)
- Steps to reproduce
- Expected vs. actual
- Relevant logs (`docker compose logs backend | tail -50`)

## Security

Don't open public issues for security bugs — see [SECURITY.md](SECURITY.md).
