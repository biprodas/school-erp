# School ERP

Monorepo for a school administration platform: admissions, academics, people (students, parents, staff), finance, campus services, communication, and reporting. The UI is a Next.js dashboard with a configurable sidebar; the API layer is NestJS.

## Repository layout

| Path | Description |
|------|--------------|
| `frontend/` | Next.js App Router app (dashboard, marketing pages, shared UI) |
| `backend/` | NestJS HTTP API |
| `doc/` | Product docs — menu IA, features |

## Prerequisites

- **Node.js** (LTS recommended) and **npm**
- **Docker** with Compose v2 (for local infrastructure)

## Local infrastructure

`docker-compose.yml` at the repo root runs the services the apps depend on (the apps themselves still run on the host):

```bash
docker compose up -d      # start
docker compose ps         # status / health
docker compose down       # stop, keep data
docker compose down -v    # stop and wipe all data
```

| Service | URL / port | Credentials |
|---------|------------|-------------|
| PostgreSQL 17 | `localhost:5433` (db `school_erp`) | `postgres` / `postgres` |
| pgAdmin | http://localhost:5050 | no login; server pre-registered |
| Redis 7 | `localhost:6379` | none |
| RedisInsight | http://localhost:5540 | none; Redis pre-registered |
| Mailpit | SMTP `localhost:1025`, UI http://localhost:8025 | any |

Postgres uses host port 5433 so it can coexist with a native Postgres on 5432; set `DB_PORT=5433` in `backend/.env.development`. To change any port or credential, copy `.env.docker.example` to `.env` in the repo root.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (default Next.js port).

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

**Stack (high level):** Next.js 16, React 19, Tailwind CSS v4, shadcn-style UI (radix-ui), TanStack Query.

## Backend

```bash
cd backend
npm install
npm run start:dev
```

Other scripts: `npm run build`, `npm run start`, `npm run start:prod`, `npm test`, `npm run lint`.

**Stack:** NestJS 11.

## Documentation

- **[Menu structure](doc/menu-structure.md)** — sidebar categories, menus, and routes (mirrors `frontend/src/app/(dashboard)/_components/sidebar-nav.tsx`).
- **[Features](doc/features.md)** — capability overview.

## License

See [LICENSE](LICENSE) in the repository root.
