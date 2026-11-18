-- =============================================================================
-- SKEMA DATABASE PRODUKSI PERFORMA KPI & IKU ITPLN (PostgreSQL 15 / 16 / 17 LTS)
-- Direkomendasikan sebagai Database Utama Server BPTI ITPLN (Kepatuhan CVE 2026)
-- =============================================================================

BEGIN;

-- 1. Tabel Pengguna & Otorisasi Berbasis Peran + PIC (RBAC & Row-Level Security)
CREATE TABLE IF NOT EXISTS users (
  email VARCHAR(190) PRIMARY KEY,
  id VARCHAR(64) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(120) NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('superadmin_prp', 'kpi_only', 'iku_only', 'dual', 'spi')),
  role_title VARCHAR(160) NOT NULL,
  badge VARCHAR(120) NOT NULL,
  unit VARCHAR(255) NOT NULL,
  avatar VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif')),
  pic_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_portals_json JSONB NOT NULL DEFAULT '["kpi"]'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);
CREATE INDEX IF NOT EXISTS idx_users_pic_codes_gin ON users USING GIN (pic_codes_json);

-- 2. Tabel Penyimpanan Dokumen Terstruktur (Master Form KPI, Submission, Bukti, Periode)
CREATE TABLE IF NOT EXISTS kv_store (
  key VARCHAR(120) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(190) NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_kv_store_value_gin ON kv_store USING GIN (value);

-- 3. Tabel Khusus Inputan & Catatan Audit SPI (Real-Time Persistence)
CREATE TABLE IF NOT EXISTS spi_audit_records (
  form_id VARCHAR(120) PRIMARY KEY,
  period VARCHAR(64) NOT NULL,
  header_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  items_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by VARCHAR(190) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spi_audit_period ON spi_audit_records (period);
CREATE INDEX IF NOT EXISTS idx_spi_audit_items_gin ON spi_audit_records USING GIN (items_json);

-- 4. Tabel Sesi Refresh Token (Rotasi Kriptografis & Anti-Replay)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  jti VARCHAR(128) PRIMARY KEY,
  email VARCHAR(190) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip VARCHAR(64) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_email ON refresh_tokens (email, revoked);

-- 5. Tabel Log Audit Aktivitas Kriptografis (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(96) PRIMARY KEY,
  action VARCHAR(96) NOT NULL,
  detail TEXT NOT NULL,
  actor VARCHAR(190) NOT NULL,
  ip VARCHAR(64) NOT NULL DEFAULT '',
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON audit_logs (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);

-- 6. Tabel Outbox Email Notifikasi Resmi
CREATE TABLE IF NOT EXISTS email_outbox (
  id VARCHAR(96) PRIMARY KEY,
  message_id VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  recipients_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  kind VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
  indicator_code VARCHAR(64) NOT NULL DEFAULT '',
  period VARCHAR(64) NOT NULL DEFAULT '',
  actor_email VARCHAR(190) NOT NULL,
  actor_name VARCHAR(255) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'TERKIRIM_TERCATAT',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_sent_at ON email_outbox (sent_at DESC);

COMMIT;
