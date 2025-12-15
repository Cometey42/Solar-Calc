# Backend (Solar)

## Overview
Express + Prisma API providing:
- `/search`: DB-backed parts search (page, page_size, q)
- `/compare/projects`: Aurora projects with design summaries
- `/compare/:designId`: Single design comparison
- `/aurora/*`: Aurora component/project/design listings
- `/health`, `/info`: status and route list

## Environment
Create `backend/.env`:
```
DATABASE_URL="mysql://solar_user:solar_password@db:3306/solar_db"
NODE_ENV=development
PORT=3000
AURORA_TENANT_ID=...
AURORA_API_TOKEN=...
# Optional, for prod CORS
FRONTEND_ORIGIN=https://your-frontend-domain.com
```

## Run (Docker Compose)
From project root (`Solar copy`):
```bash
docker compose -f docker-compose.backend-only.yml up -d
```
- API: `http://localhost:3000`
- MySQL: host `localhost:3307` (container `db:3306`)

## Prisma
Generate client (handled in image build):
```bash
npx prisma generate
```
Sync schema (indexes etc.):
```bash
docker exec -it solar-backend npx prisma db push
```

## Seeding (Excel)
Place Excel at `backend/data/material list (1).xlsx`.
Seed:
```bash
cd backend
npm run seed
```
Reset + seed (mirror Excel exactly):
```bash
cd backend
npm run reset-seed
```

## Endpoints
- `GET /search?page=1&page_size=50&q=panel`
- `GET /compare/projects?page=1&per_page=5&designs_per_project=1`
- `GET /compare/:designId`
- `GET /aurora/projects?page=1&per_page=50`
- `GET /aurora/projects/:projectId/designs?page=1&per_page=50`
- `GET /aurora/modules?limit=20`
- `GET /aurora/inverters?limit=20`
- `GET /aurora/dc-optimizers?limit=20`
- `GET /health`
- `GET /info`

## Operations
Logs:
```bash
docker logs --tail=200 solar-backend
```
Rebuild:
```bash
docker compose -f docker-compose.backend-only.yml up -d --build
```

## Notes
- CORS hardened in production via `FRONTEND_ORIGIN`.
- Short TTL cache (~30s) for `/aurora/*` lists.
- Request IDs attached and logged; included in compare errors.
