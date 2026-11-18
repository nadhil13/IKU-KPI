-- =============================================================================
-- SKEMA DATABASE PRODUKSI PERFORMA KPI & IKU ITPLN (MariaDB v12 / MySQL 8.4 LTS)
-- Alternatif Kompatibel Environment Server BPTI ITPLN (Kepatuhan CVE 2026)
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+07:00';

-- 1. Tabel Pengguna & Otorisasi Berbasis Peran + PIC (RBAC & Row-Level Security)
CREATE TABLE IF NOT EXISTS users (
  email VARCHAR(190) NOT NULL,
  id VARCHAR(64) NOT NULL,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(120) NOT NULL,
  role VARCHAR(32) NOT NULL,
  role_title VARCHAR(160) NOT NULL,
  badge VARCHAR(120) NOT NULL,
  unit VARCHAR(255) NOT NULL,
  avatar VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'Aktif',
  pic_codes_json JSON NOT NULL,
  allowed_portals_json JSON NOT NULL,
  description TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until BIGINT NOT NULL DEFAULT 0,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Penyimpanan Dokumen Terstruktur (Master Form KPI, Submission, Bukti, Periode)
CREATE TABLE IF NOT EXISTS kv_store (
  `key` VARCHAR(120) NOT NULL,
  `value` JSON NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  updated_by VARCHAR(190) NOT NULL DEFAULT 'system',
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Khusus Inputan & Catatan Audit SPI (Real-Time Persistence)
CREATE TABLE IF NOT EXISTS spi_audit_records (
  form_id VARCHAR(120) NOT NULL,
  period VARCHAR(64) NOT NULL,
  header_json JSON NOT NULL,
  items_json JSON NOT NULL,
  updated_by VARCHAR(190) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (form_id),
  KEY idx_spi_audit_period (period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Sesi Refresh Token (Rotasi Kriptografis & Anti-Replay)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  jti VARCHAR(128) NOT NULL,
  email VARCHAR(190) NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  created_at VARCHAR(40) NOT NULL,
  ip VARCHAR(64) NOT NULL DEFAULT '',
  PRIMARY KEY (jti),
  KEY idx_refresh_tokens_email (email, revoked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Log Audit Aktivitas Kriptografis
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(96) NOT NULL,
  action VARCHAR(96) NOT NULL,
  detail TEXT NOT NULL,
  actor VARCHAR(190) NOT NULL,
  ip VARCHAR(64) NOT NULL DEFAULT '',
  at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_audit_logs_at (at),
  KEY idx_audit_logs_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel Outbox Email Notifikasi Resmi
CREATE TABLE IF NOT EXISTS email_outbox (
  id VARCHAR(96) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  recipients_json JSON NOT NULL,
  kind VARCHAR(64) NOT NULL DEFAULT 'SYSTEM',
  indicator_code VARCHAR(64) NOT NULL DEFAULT '',
  period VARCHAR(64) NOT NULL DEFAULT '',
  actor_email VARCHAR(190) NOT NULL,
  actor_name VARCHAR(255) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'TERKIRIM_TERCATAT',
  sent_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_email_outbox_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
