# MyIAD & AB Global — Full-Stack Render + Neon + VPS Command Center Blueprint

> Comprehensive Production Blueprint for Angel Burgos's Unified Multi-Agent Command Center & Cloud Control Plane.

---

## 1. Executive Summary & Architecture Overview

The **MyIAD & AB Global Command Center** is a unified multi-tenant control plane connecting 10 flagship projects (**MyIAD**, **IPTV.Menu**, **Story.Menu**, **ClassroomAI**, **AB Global Consulting**, **Leafywell**, **Activotics**, **Piffkings**, **Sendput**, and **SendTHC**) directly to:
1. **Render**: Host for both the web application server (`myiad-command-center`) and the 10-minute automated cron prober (`myiad-ecosystem-health-monitor`).
2. **Neon Serverless PostgreSQL**: Primary managed database cluster (`ep-winter-poetry-ae51hoth.us-east-2.aws.neon.tech`).
3. **Dedicated Linux VPS PostgreSQL**: Secondary high-throughput database (`34.148.244.49:5432`) utilizing isolated multi-tenant schema `vault_app_angelburgosrosado`.

```
                    ┌──────────────────────────────────────────────┐
                    │               Render Platform                │
                    │                                              │
                    │  ┌────────────────────┐  ┌────────────────┐  │
                    │  │myiad-command-center│  │health-monitor  │  │
                    │  │  (Node Web Server) │  │(10-Min Cron)   │  │
                    │  └─────────┬──────────┘  └────────┬───────┘  │
                    └────────────┼──────────────────────┼──────────┘
                                 │                      │
                   ┌─────────────┴──────────────────────┴─────────────┐
                   ▼                                                  ▼
   ┌───────────────────────────────┐                  ┌───────────────────────────────┐
   │        Neon PostgreSQL        │                  │      Dedicated VPS Linux      │
   │   ep-winter-poetry-ae51hoth   │                  │       34.148.244.49:5432      │
   │  vault_app_angelburgosrosado  │                  │  vault_app_angelburgosrosado  │
   └───────────────────────────────┘                  └───────────────────────────────┘
```

---

## 2. Render Blueprint (`render.yaml`)

```yaml
services:
  - type: web
    name: myiad-command-center
    runtime: node
    plan: starter
    region: ohio
    buildCommand: npm install --include=dev && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: NODE_VERSION
        value: 20
      - key: PORT
        value: 10000
      - key: DATABASE_URL
        sync: false # Connect to Neon (ep-winter-poetry-ae51hoth) or VPS Postgres (34.148.244.49:5432)
      - key: VPS_POSTGRES_URL
        sync: false # Optional secondary pool for 34.148.244.49:5432 (vault_app_angelburgosrosado)
      - key: GEMINI_API_KEY
        sync: false
      - key: RENDER_API_KEY
        sync: false
      - key: GITHUB_PAT
        sync: false

  - type: cron
    name: myiad-ecosystem-health-monitor
    runtime: node
    schedule: "*/10 * * * *"
    buildCommand: npm install --include=dev && npm run build
    startCommand: node dist/health-worker.cjs
    envVars:
      - key: NODE_ENV
        value: production
      - key: NODE_VERSION
        value: 20
      - key: DATABASE_URL
        sync: false
      - key: VPS_POSTGRES_URL
        sync: false
```

---

## 3. Database Schema (`sql/schema.sql`)

Run against either Neon (`ep-winter-poetry-ae51hoth.us-east-2.aws.neon.tech`) or Dedicated Postgres VPS (`34.148.244.49:5432`):

```sql
CREATE SCHEMA IF NOT EXISTS vault_app_angelburgosrosado;

SET search_path TO vault_app_angelburgosrosado, public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Master Projects Registry
CREATE TABLE IF NOT EXISTS command_projects (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  status VARCHAR(100) NOT NULL,
  priority VARCHAR(32) NOT NULL,
  live_url TEXT,
  repo_url TEXT,
  infra_target VARCHAR(255),
  summary TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Project Execution Tasks
CREATE TABLE IF NOT EXISTS command_tasks (
  id VARCHAR(100) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES command_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  demand VARCHAR(32) DEFAULT 'steady',
  done BOOLEAN DEFAULT FALSE,
  execution_target VARCHAR(255),
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Ecosystem Infrastructure Health & Latency Telemetry
CREATE TABLE IF NOT EXISTS infra_health_telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name VARCHAR(120) NOT NULL,
  endpoint_url TEXT NOT NULL,
  provider VARCHAR(64) NOT NULL,
  http_status INT,
  latency_ms INT,
  llms_txt_detected BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Sendput SFAI & AICS Audit Proposals
CREATE TABLE IF NOT EXISTS sendput_audit_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name VARCHAR(255) NOT NULL,
  website_url TEXT NOT NULL,
  city_niche VARCHAR(255),
  sfai_score INT,
  aics_score INT,
  recommended_tier VARCHAR(64),
  proposal_markdown TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Physical Commerce & Retail SKU Catalog Vault
CREATE TABLE IF NOT EXISTS sku_catalog_vault (
  sku VARCHAR(32) PRIMARY KEY,
  product_name VARCHAR(255) NOT NULL,
  brand_phase VARCHAR(100) NOT NULL,
  unit_cost NUMERIC(10,2),
  msrp NUMERIC(10,2),
  margin_pct INT,
  label_dimensions VARCHAR(64),
  store_ready BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Full-Stack Codebase Components

| Component | Path | Description |
| :--- | :--- | :--- |
| **Frontend Dashboard** | `public/index.html` | 8-Tab Glassmorphism UI, real-time latency prober, AI agent compiler, and interactive project matrix. |
| **API Server** | `src/server.ts` | Express server compiled via `esbuild` to `dist/server.cjs`. Features TCP port 5432 socket validation, connection pooling, and multi-tenant schema isolation. |
| **Cron Worker** | `src/health-worker.ts` | Scheduled worker testing endpoints every 10 minutes and writing telemetry directly to PostgreSQL. |
| **Container Spec** | `Dockerfile` | Multi-stage Node 20 Alpine production container. |
| **Type Definitions** | `tsconfig.json` | Modern strict TypeScript compiler configuration targeting Node 20. |

---

## 5. Deployment Instructions (Step-by-Step)

### Step 1: Push Code to GitHub
Repository target: `https://github.com/angelburgosrosado/myiad-command-center`

```bash
git init
git add .
git commit -m "feat: initial commit of MyIAD command center full-stack codebase"
git remote add origin git@github.com:angelburgosrosado/myiad-command-center.git
git branch -M main
git push -u origin main
```

### Step 2: Initialize Database Schema
Run migrations against Neon or VPS PostgreSQL:

```bash
# Neon Endpoint Migration
psql "postgresql://USER:PASSWORD@ep-winter-poetry-ae51hoth.us-east-2.aws.neon.tech/neondb?sslmode=require" -f sql/schema.sql

# Or Dedicated VPS PostgreSQL Migration
psql "postgresql://USER:PASSWORD@34.148.244.49:5432/postgres" -f sql/schema.sql
```

### Step 3: Deploy on Render via Blueprint
1. Open [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your repository: `angelburgosrosado/myiad-command-center`.
4. Fill in the required environment variables:
   - `DATABASE_URL`: Your Neon connection string or VPS Postgres URL.
   - `VPS_POSTGRES_URL`: (Optional) dedicated VPS connection.
   - `GEMINI_API_KEY`: (Optional) for agentic reasoning modules.
5. Click **Apply**. Render will automatically provision:
   - `myiad-command-center` (Web Service on Ohio)
   - `myiad-ecosystem-health-monitor` (Cron Worker on `*/10 * * * *`)
