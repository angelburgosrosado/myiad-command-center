-- schema.sql — Multi-Tenant Command Center Schema for Neon (ep-winter-poetry-ae51hoth) & VPS (34.148.244.49:5432)
CREATE SCHEMA IF NOT EXISTS vault_app_angelburgosrosado;
SET search_path TO vault_app_angelburgosrosado, public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
