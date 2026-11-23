-- Skema Basis Data Relasional PERFORMA KPI & IKU ITPLN (MariaDB / MySQL 8.4)
-- Selaras dengan struktur tabel runtime SQLite WAL di backend/src/services/database.js

SET NAMES utf8mb4;
SET time_zone = '+07:00';

CREATE TABLE IF NOT EXISTS users (
  email VARCHAR(190) NOT NULL,
  id VARCHAR(64) NOT NULL,
  code VARCHAR(32),
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(120),
  role VARCHAR(32) NOT NULL,
  role_title VARCHAR(160),
  badge VARCHAR(120),
  allowed_portals_json JSON NOT NULL,
  pic_codes_json JSON NOT NULL,
  unit VARCHAR(255),
  avatar VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'Aktif',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  jti VARCHAR(128) NOT NULL,
  email VARCHAR(190) NOT NULL,
  role VARCHAR(32) NOT NULL,
  ip VARCHAR(64),
  user_agent TEXT,
  created_at VARCHAR(40) NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at VARCHAR(40),
  PRIMARY KEY (jti),
  KEY idx_sessions_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kv_store (
  store_key VARCHAR(120) NOT NULL,
  payload_json JSON NOT NULL,
  version INT NOT NULL DEFAULT 1,
  checksum VARCHAR(64) NOT NULL,
  updated_by VARCHAR(190),
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (store_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcasts (
  id VARCHAR(96) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(32) NOT NULL DEFAULT 'IMPORTANT',
  target_type VARCHAR(32) NOT NULL DEFAULT 'ALL',
  target_value VARCHAR(255) NOT NULL DEFAULT '',
  action_url VARCHAR(255) NOT NULL DEFAULT '/internal',
  action_label VARCHAR(120) NOT NULL DEFAULT 'Buka Ruang Kerja',
  sender_email VARCHAR(190) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(40) NOT NULL,
  expires_at VARCHAR(40),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_acks (
  broadcast_id VARCHAR(96) NOT NULL,
  user_email VARCHAR(190) NOT NULL,
  user_name VARCHAR(255),
  unit VARCHAR(255),
  acked_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (broadcast_id, user_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS audit_logs (
  seq BIGINT NOT NULL AUTO_INCREMENT,
  id VARCHAR(96) NOT NULL,
  action VARCHAR(96) NOT NULL,
  detail TEXT NOT NULL,
  actor VARCHAR(190) NOT NULL,
  ip VARCHAR(64),
  at VARCHAR(40) NOT NULL,
  prev_hash VARCHAR(64) NOT NULL,
  entry_hash VARCHAR(64) NOT NULL,
  PRIMARY KEY (seq),
  UNIQUE KEY uq_audit_logs_id (id),
  KEY idx_audit_logs_at (at),
  KEY idx_audit_logs_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
