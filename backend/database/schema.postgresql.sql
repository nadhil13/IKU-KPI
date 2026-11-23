-- Skema Basis Data Relasional PERFORMA KPI & IKU ITPLN (PostgreSQL 15 / 16 / 17)
-- Selaras dengan struktur tabel runtime SQLite WAL di backend/src/services/database.js

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  email VARCHAR(190) PRIMARY KEY,
  id VARCHAR(64) NOT NULL,
  code VARCHAR(32),
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(120),
  role VARCHAR(32) NOT NULL CHECK (role IN ('superadmin_prp', 'kpi_only', 'iku_only', 'dual', 'spi')),
  role_title VARCHAR(160),
  badge VARCHAR(120),
  allowed_portals_json JSONB NOT NULL DEFAULT '["kpi"]'::jsonb,
  pic_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  unit VARCHAR(255),
  avatar VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif')),
  must_change_password SMALLINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);

CREATE TABLE IF NOT EXISTS sessions (
  jti VARCHAR(128) PRIMARY KEY,
  email VARCHAR(190) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL,
  ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at BIGINT NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions (email);

CREATE TABLE IF NOT EXISTS kv_store (
  store_key VARCHAR(120) PRIMARY KEY,
  payload_json JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  checksum VARCHAR(64) NOT NULL,
  updated_by VARCHAR(190),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id VARCHAR(96) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(32) NOT NULL DEFAULT 'IMPORTANT',
  target_type VARCHAR(32) NOT NULL DEFAULT 'ALL',
  target_value VARCHAR(255) NOT NULL DEFAULT '',
  action_url VARCHAR(255) NOT NULL DEFAULT '/internal',
  action_label VARCHAR(120) NOT NULL DEFAULT 'Buka Ruang Kerja',
  sender_email VARCHAR(190) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS broadcast_acks (
  broadcast_id VARCHAR(96) NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  user_email VARCHAR(190) NOT NULL,
  user_name VARCHAR(255),
  unit VARCHAR(255),
  acked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (broadcast_id, user_email)
);

CREATE TABLE IF NOT EXISTS spi_audit_records (
  form_id VARCHAR(120) PRIMARY KEY,
  period VARCHAR(64) NOT NULL,
  header_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  items_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by VARCHAR(190) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  seq BIGSERIAL PRIMARY KEY,
  id VARCHAR(96) NOT NULL UNIQUE,
  action VARCHAR(96) NOT NULL,
  detail TEXT NOT NULL,
  actor VARCHAR(190) NOT NULL,
  ip VARCHAR(64),
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prev_hash VARCHAR(64) NOT NULL,
  entry_hash VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON audit_logs (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);

COMMIT;
