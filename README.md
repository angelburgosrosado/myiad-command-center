# MyIAD & AB Global — Full-Stack Cloud Control Plane & Multi-Agent Dashboard

This full-stack system connects your 10 projects (**MyIAD**, **IPTV.Menu**, **Story.Menu**, **ClassroomAI**, **AB Global Consulting**, **Leafywell**, **Activotics**, **Piffkings**, **Sendput**, and **SendTHC**) directly to your **Render**, **Neon Serverless PostgreSQL**, and **Dedicated PostgreSQL VPS (`34.148.244.49:5432`)** infrastructure.

## 1. Architecture & Deliverable Files

| File | Role in Stack | Target Environment |
| :--- | :--- | :--- |
| `ab_project_command_center.html` | Interactive 8-Tab Cloud Control Plane, Live 7-Domain Latency Prober & 4 Multi-Agent Execution Compilers | Browser / Canvas / `/public/index.html` |
| `server.ts` | Express + TypeScript Backend with Self-Healing TCP Port `5432` Socket Probe, Multi-Tenant `vault_app_angelburgosrosado` Pool & Live Ecosystem Health Endpoint (`/api/probe-ecosystem`) | Render Web Service (`myiad-command-center`) / Cloud Run |
| `render.yaml` | 1-Click Render Blueprint provisioning `myiad-command-center` (Web) + `myiad-ecosystem-health-monitor` (10-Min Cron Worker) | Render Dashboard (`dashboard.render.com`) |
| `schema.sql` | PostgreSQL schema migration creating `command_projects`, `command_tasks`, `infra_health_telemetry`, `sendput_audit_proposals`, and `sku_catalog_vault` | Neon (`ep-winter-poetry-ae51hoth`) & VPS (`34.148.244.49:5432`) |
| `Dockerfile` | Production Node 20 Alpine container image (`esbuild` CommonJS bundle `dist/server.cjs`) | Render / Google Cloud Run (`01783B-2086B0-767989`) / VPS |

## 2. Deployment Steps (Render + Neon / VPS)

1. Push this repository to `https://github.com/angelburgosrosado/myiad-command-center`.
2. In Render (`https://dashboard.render.com`), click **New + -> Blueprint** and connect `angelburgosrosado/myiad-command-center`.
3. Set `DATABASE_URL` to your rotated Neon connection string (`ep-winter-poetry-ae51hoth.us-east-2.aws.neon.tech`) or your Dedicated Postgres VPS (`postgresql://USER:PASSWORD@34.148.244.49:5432/postgres`).
4. Run `psql $DATABASE_URL -f schema.sql` to initialize the `vault_app_angelburgosrosado` tables.
