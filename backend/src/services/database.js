import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword, computeSha256 } from '../config/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.resolve(__dirname, '../../storage/app/private/performa_itpln.sqlite');

export const SEED_ACCOUNTS = Object.freeze([
  {
    id: 'user-iku',
    code: '01',
    email: 'iku@itpln.ac.id',
    password: 'password',
    name: 'Biro Kemahasiswaan & Akademik',
    shortName: 'PIC IKU',
    role: 'iku_only',
    roleTitle: 'Otoritas Khusus IKU',
    badge: 'IKU ONLY',
    allowedPortals: ['iku'],
    picCodes: [],
    unit: 'Biro Akademik & Kemahasiswaan ITPLN',
    avatar: 'IKU',
    status: 'Aktif',
  },
  {
    id: 'user-kpi',
    code: '02',
    email: 'kpi@itpln.ac.id',
    password: 'password',
    name: 'Biro Akuntansi & Biro Anggaran (BAKT / BAG)',
    shortName: 'PIC BAKT/BAG',
    role: 'kpi_only',
    roleTitle: 'Otoritas Unit KPI (BAKT & BAG)',
    badge: 'PIC: BAKT, BAG',
    allowedPortals: ['kpi'],
    picCodes: ['BAKT', 'BAG'],
    unit: 'Biro Akuntansi & Anggaran (BAKT, BAG)',
    avatar: 'BKG',
    status: 'Aktif',
  },
  {
    id: 'user-dual',
    code: '03',
    email: 'admin@itpln.ac.id',
    password: 'password',
    name: 'Administrator Terpadu ITPLN',
    shortName: 'Integrator',
    role: 'superadmin_prp',
    roleTitle: 'Superadmin PRP',
    badge: 'SUPERADMIN PRP',
    allowedPortals: ['iku', 'kpi'],
    picCodes: ['PRP'],
    unit: 'Direktorat Perencanaan & Pengembangan (PRP)',
    avatar: 'ADM',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-bakt',
    code: '04',
    email: 'bakt@itpln.ac.id',
    password: 'password',
    name: 'Biro Akuntansi ITPLN',
    shortName: 'PIC BAKT',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BAKT',
    badge: 'PIC: BAKT',
    allowedPortals: ['kpi'],
    picCodes: ['BAKT'],
    unit: 'Biro Akuntansi (BAKT)',
    avatar: 'BAK',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-bag',
    code: '05',
    email: 'bag@itpln.ac.id',
    password: 'password',
    name: 'Biro Anggaran ITPLN',
    shortName: 'PIC BAG',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BAG',
    badge: 'PIC: BAG',
    allowedPortals: ['kpi'],
    picCodes: ['BAG'],
    unit: 'Biro Anggaran (BAG)',
    avatar: 'BAG',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-ppa',
    code: '06',
    email: 'ppa@itpln.ac.id',
    password: 'password',
    name: 'Pusat Pelayanan Akademik ITPLN',
    shortName: 'PIC PPA',
    role: 'kpi_only',
    roleTitle: 'PIC Unit PPA',
    badge: 'PIC: PPA',
    allowedPortals: ['kpi'],
    picCodes: ['PPA'],
    unit: 'Pusat Pelayanan Akademik (PPA)',
    avatar: 'PPA',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-bku',
    code: '07',
    email: 'bku@itpln.ac.id',
    password: 'password',
    name: 'Biro Keuangan ITPLN',
    shortName: 'PIC BKU',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKU',
    badge: 'PIC: BKU',
    allowedPortals: ['kpi'],
    picCodes: ['BKU'],
    unit: 'Biro Keuangan (BKU)',
    avatar: 'BKU',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-pjm',
    code: '08',
    email: 'pjm@itpln.ac.id',
    password: 'password',
    name: 'Pusat Jaminan Mutu ITPLN',
    shortName: 'PIC PJM',
    role: 'kpi_only',
    roleTitle: 'PIC Unit PJM',
    badge: 'PIC: PJM',
    allowedPortals: ['kpi'],
    picCodes: ['PJM'],
    unit: 'Pusat Jaminan Mutu (PJM)',
    avatar: 'PJM',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-prp',
    code: '09',
    email: 'prp.unit@itpln.ac.id',
    password: 'password',
    name: 'Unit Pelaksana Pelaporan PRP',
    shortName: 'PIC PRP',
    role: 'kpi_only',
    roleTitle: 'PIC Unit PRP',
    badge: 'PIC: PRP',
    allowedPortals: ['kpi'],
    picCodes: ['PRP'],
    unit: 'Direktorat Perencanaan & Pengembangan (PRP)',
    avatar: 'PRP',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-bpka',
    code: '10',
    email: 'bpka@itpln.ac.id',
    password: 'password',
    name: 'Biro Pengembangan Karir & Alumni',
    shortName: 'PIC BPKA',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BPKA',
    badge: 'PIC: BPKA',
    allowedPortals: ['kpi'],
    picCodes: ['BPKA'],
    unit: 'Biro Pengembangan Karir & Alumni (BPKA)',
    avatar: 'BPK',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-bkk',
    code: '11',
    email: 'bkk@itpln.ac.id',
    password: 'password',
    name: 'Biro Kemahasiswaan & Konseling',
    shortName: 'PIC BKK',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKK',
    badge: 'PIC: BKK',
    allowedPortals: ['kpi'],
    picCodes: ['BKK'],
    unit: 'Biro Kemahasiswaan & Konseling (BKK)',
    avatar: 'BKK',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-bkai',
    code: '12',
    email: 'bkai@itpln.ac.id',
    password: 'password',
    name: 'Biro Kerja Sama Akademik Internasional',
    shortName: 'PIC BKAI',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKAI',
    badge: 'PIC: BKAI',
    allowedPortals: ['kpi'],
    picCodes: ['BKAI'],
    unit: 'Biro Kerja Sama Akademik Internasional (BKAI)',
    avatar: 'BKI',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-bpik',
    code: '13',
    email: 'bpik@itpln.ac.id',
    password: 'password',
    name: 'Tim Penjaringan Mahasiswa Baru (BPIK, BKM, BSAR, BPAD)',
    shortName: 'PIC Admisi',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BPIK/BKM/BSAR/BPAD',
    badge: 'PIC: BPIK, BKM, BSAR, BPAD',
    allowedPortals: ['kpi'],
    picCodes: ['BPIK', 'BKM', 'BSAR', 'BPAD'],
    unit: 'Biro Pemasaran, Kemahasiswaan, Sarpras & Aset (BPIK, BKM, BSAR, BPAD)',
    avatar: 'PMB',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-fak',
    code: '14',
    email: 'fak@itpln.ac.id',
    password: 'password',
    name: 'Fakultas & Program Studi ITPLN',
    shortName: 'PIC FAK',
    role: 'kpi_only',
    roleTitle: 'PIC Fakultas (FAK)',
    badge: 'PIC: FAK',
    allowedPortals: ['kpi'],
    picCodes: ['FAK'],
    unit: 'Fakultas & Program Studi (FAK)',
    avatar: 'FAK',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-lppm',
    code: '15',
    email: 'lppm@itpln.ac.id',
    password: 'password',
    name: 'Lembaga Penelitian & Pengabdian kepada Masyarakat',
    shortName: 'PIC LPPM',
    role: 'kpi_only',
    roleTitle: 'PIC Unit LPPM',
    badge: 'PIC: LPPM',
    allowedPortals: ['kpi'],
    picCodes: ['LPPM'],
    unit: 'Lembaga Penelitian & Pengabdian kepada Masyarakat (LPPM)',
    avatar: 'LPM',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-sdm',
    code: '16',
    email: 'sdm@itpln.ac.id',
    password: 'password',
    name: 'Biro Sumber Daya Manusia (SDM & BSDM)',
    shortName: 'PIC SDM/BSDM',
    role: 'kpi_only',
    roleTitle: 'PIC Unit SDM & BSDM',
    badge: 'PIC: SDM, BSDM',
    allowedPortals: ['kpi'],
    picCodes: ['SDM', 'BSDM'],
    unit: 'Biro Sumber Daya Manusia (SDM, BSDM)',
    avatar: 'SDM',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-bkan',
    code: '17',
    email: 'bkan@itpln.ac.id',
    password: 'password',
    name: 'Biro Kerja Sama Akademik Nasional',
    shortName: 'PIC BKAN',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKAN',
    badge: 'PIC: BKAN',
    allowedPortals: ['kpi'],
    picCodes: ['BKAN'],
    unit: 'Biro Kerja Sama Akademik Nasional (BKAN)',
    avatar: 'BKN',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-bpti',
    code: '18',
    email: 'bpti@itpln.ac.id',
    password: 'password',
    name: 'Biro Pengembangan Teknologi Informasi',
    shortName: 'PIC BPTI',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BPTI',
    badge: 'PIC: BPTI',
    allowedPortals: ['kpi'],
    picCodes: ['BPTI'],
    unit: 'Biro Pengembangan Teknologi Informasi (BPTI)',
    avatar: 'BTI',
    status: 'Aktif',
  },
  {
    id: 'user-kpi-spi',
    code: '19',
    email: 'spi@itpln.ac.id',
    password: 'password',
    name: 'Satuan Pengawasan Intern, Akuntansi & WBS',
    shortName: 'PIC SPI/Audit',
    role: 'kpi_only',
    roleTitle: 'PIC Unit SPI, Akuntansi & WBS',
    badge: 'PIC: SPI, Akuntansi, WBS',
    allowedPortals: ['kpi'],
    picCodes: ['SPI', 'Akuntansi', 'WBS'],
    unit: 'Satuan Pengawasan Intern (SPI, Akuntansi, WBS)',
    avatar: 'SPI',
    status: 'Aktif',
  },
]);

let dbInstance = null;
let currentDbPath = null;

export function getDatabase(customPath = null) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }
  const targetPath = customPath || process.env.PERFORMA_DB_PATH || DEFAULT_DB_PATH;
  if (dbInstance && currentDbPath === targetPath) {
    return dbInstance;
  }
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // Abaikan saat penutupan koneksi lama
    }
  }
  if (targetPath !== ':memory:') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }
  const db = new DatabaseSync(targetPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      id TEXT NOT NULL,
      code TEXT,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT,
      role TEXT NOT NULL,
      role_title TEXT,
      badge TEXT,
      allowed_portals_json TEXT NOT NULL,
      pic_codes_json TEXT NOT NULL,
      unit TEXT,
      avatar TEXT,
      status TEXT NOT NULL DEFAULT 'Aktif',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      jti TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      store_key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      checksum TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'IMPORTANT',
      target_type TEXT NOT NULL DEFAULT 'ALL',
      target_value TEXT NOT NULL DEFAULT '',
      action_url TEXT NOT NULL DEFAULT '/internal',
      action_label TEXT NOT NULL DEFAULT 'Buka Ruang Kerja',
      sender_email TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS broadcast_acks (
      broadcast_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      user_name TEXT,
      unit TEXT,
      acked_at TEXT NOT NULL,
      PRIMARY KEY (broadcast_id, user_email)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      actor TEXT NOT NULL,
      ip TEXT,
      at TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      entry_hash TEXT NOT NULL
    );
  `);

  dbInstance = db;
  currentDbPath = targetPath;
  seedDefaultAccounts(db);
  return db;
}

const sharedDefaultPasswordHash = hashPassword('password', 'a1b2c3d4e5f60718293a4b5c6d7e8f90');

function seedDefaultAccounts(db) {
  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();
  if (countRow && countRow.cnt >= SEED_ACCOUNTS.length) return;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO users (
      email, id, code, password_hash, name, short_name, role, role_title,
      badge, allowed_portals_json, pic_codes_json, unit, avatar, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const acc of SEED_ACCOUNTS) {
      insertStmt.run(
        acc.email.toLowerCase(),
        acc.id,
        acc.code || '',
        sharedDefaultPasswordHash,
        acc.name,
        acc.shortName || acc.name,
        acc.role,
        acc.roleTitle || acc.role,
        acc.badge || '',
        JSON.stringify(acc.allowedPortals || []),
        JSON.stringify(acc.picCodes || []),
        acc.unit || '',
        acc.avatar || 'USR',
        acc.status || 'Aktif',
        now,
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function rowToUser(row) {
  if (!row) return null;
  let allowedPortals = [];
  let picCodes = [];
  try {
    allowedPortals = JSON.parse(row.allowed_portals_json || '[]');
  } catch {
    allowedPortals = [];
  }
  try {
    picCodes = JSON.parse(row.pic_codes_json || '[]');
  } catch {
    picCodes = [];
  }
  return {
    id: row.id,
    code: row.code,
    email: row.email,
    name: row.name,
    shortName: row.short_name,
    role: row.role,
    roleTitle: row.role_title,
    badge: row.badge,
    allowedPortals,
    picCodes,
    unit: row.unit,
    avatar: row.avatar,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export function findUserByEmail(email) {
  if (!email) return null;
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase());
  return row ? { ...rowToUser(row), passwordHash: row.password_hash } : null;
}

export function listAllUsers() {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM users ORDER BY code ASC, email ASC').all();
  return rows.map(rowToUser);
}

export function verifyUserCredentials(email, plainPassword) {
  const record = findUserByEmail(email);
  if (!record) return { ok: false, reason: 'USER_NOT_FOUND' };
  if (record.status === 'Nonaktif') return { ok: false, reason: 'USER_INACTIVE' };
  const valid = verifyPassword(plainPassword, record.passwordHash);
  if (!valid) return { ok: false, reason: 'INVALID_PASSWORD' };
  const { passwordHash: _ignored, ...safeUser } = record;
  return { ok: true, user: safeUser };
}

export function syncUsersListFromAdmin(usersArray, actorEmail = 'admin@itpln.ac.id') {
  if (!Array.isArray(usersArray)) return listAllUsers();
  const db = getDatabase();
  const now = new Date().toISOString();
  const existingStmt = db.prepare('SELECT password_hash FROM users WHERE email = ?');
  const upsertStmt = db.prepare(`
    INSERT INTO users (
      email, id, code, password_hash, name, short_name, role, role_title,
      badge, allowed_portals_json, pic_codes_json, unit, avatar, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      password_hash = excluded.password_hash,
      name = excluded.name,
      short_name = excluded.short_name,
      role = excluded.role,
      role_title = excluded.role_title,
      badge = excluded.badge,
      allowed_portals_json = excluded.allowed_portals_json,
      pic_codes_json = excluded.pic_codes_json,
      unit = excluded.unit,
      avatar = excluded.avatar,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    usersArray.forEach((u, idx) => {
      if (!u?.email || typeof u.email !== 'string') return;
      const email = u.email.trim().toLowerCase();
      const existing = existingStmt.get(email);
      const pwHash = u.password && u.password !== '********'
        ? hashPassword(u.password)
        : existing?.password_hash || sharedDefaultPasswordHash;
      const role = ['superadmin_prp', 'iku_only', 'kpi_only', 'dual'].includes(u.role) ? u.role : 'kpi_only';
      const portals = role === 'superadmin_prp' || role === 'dual' ? ['iku', 'kpi'] : role === 'iku_only' ? ['iku'] : ['kpi'];
      const picCodes = Array.isArray(u.picCodes) ? u.picCodes : [];
      upsertStmt.run(
        email,
        u.id || `user-${idx + 1}`,
        u.code || String(idx + 1).padStart(2, '0'),
        pwHash,
        String(u.name || email),
        String(u.shortName || u.name || email),
        role,
        String(u.roleTitle || role),
        String(u.badge || (picCodes.length ? `PIC: ${picCodes.join(', ')}` : role.toUpperCase())),
        JSON.stringify(portals),
        JSON.stringify(picCodes),
        String(u.unit || ''),
        String(u.avatar || 'USR').slice(0, 4),
        u.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
        now,
      );
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  appendAuditLog('PENGGUNA_DISINKRONKAN', `Sinkronisasi ${usersArray.length} akun pengguna`, actorEmail);
  return listAllUsers();
}

export function createSessionRecord({ jti, email, role, ip, userAgent, expiresAt }) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO sessions (jti, email, role, ip, user_agent, created_at, expires_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(jti, email.toLowerCase(), role, ip || '', userAgent || '', new Date().toISOString(), expiresAt);
}

export function revokeSessionRecord(jti) {
  if (!jti) return;
  const db = getDatabase();
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE jti = ?').run(new Date().toISOString(), jti);
}

export function isSessionActive(jti) {
  if (!jti) return false;
  const db = getDatabase();
  const row = db.prepare('SELECT revoked_at, expires_at FROM sessions WHERE jti = ?').get(jti);
  if (!row) return true;
  if (row.revoked_at) return false;
  return row.expires_at >= Math.floor(Date.now() / 1000);
}

export function readKvStore(key, fallback = null) {
  const db = getDatabase();
  const row = db.prepare('SELECT payload_json, version, checksum, updated_by, updated_at FROM kv_store WHERE store_key = ?').get(key);
  if (!row) return { value: fallback, version: 0, updatedAt: null, updatedBy: null };
  try {
    return {
      value: JSON.parse(row.payload_json),
      version: row.version,
      checksum: row.checksum,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    };
  } catch {
    return { value: fallback, version: 0, updatedAt: null, updatedBy: null };
  }
}

export function readAllKvStores() {
  const db = getDatabase();
  const rows = db.prepare('SELECT store_key, payload_json, version, checksum, updated_by, updated_at FROM kv_store').all();
  const stores = {};
  const meta = {};
  for (const row of rows) {
    try {
      stores[row.store_key] = JSON.parse(row.payload_json);
      meta[row.store_key] = {
        version: row.version,
        checksum: row.checksum,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at,
      };
    } catch {
      // Abaikan entri korup
    }
  }
  return { stores, meta };
}

export function writeKvStore(key, value, actorEmail = 'system') {
  const db = getDatabase();
  const serialized = JSON.stringify(value ?? null);
  const checksum = computeSha256(serialized);
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT version, checksum FROM kv_store WHERE store_key = ?').get(key);
  if (existing && existing.checksum === checksum) {
    return { version: existing.version, checksum, changed: false, updatedAt: now };
  }

  const nextVersion = (existing?.version || 0) + 1;
  db.prepare(`
    INSERT INTO kv_store (store_key, payload_json, version, checksum, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(store_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      version = excluded.version,
      checksum = excluded.checksum,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `).run(key, serialized, nextVersion, checksum, actorEmail, now);

  return { version: nextVersion, checksum, changed: true, updatedAt: now };
}

export function appendAuditLog(action, detail, actor = 'system', ip = '127.0.0.1') {
  const db = getDatabase();
  const lastRow = db.prepare('SELECT entry_hash FROM audit_logs ORDER BY seq DESC LIMIT 1').get();
  const prevHash = lastRow?.entry_hash || 'GENESIS_PERFORMA_ITPLN_2026';
  const at = new Date().toISOString();
  const id = `aud_${crypto.randomUUID()}`;
  const entryHash = computeSha256(`${prevHash}|${id}|${action}|${detail}|${actor}|${at}`);

  db.prepare(`
    INSERT INTO audit_logs (id, action, detail, actor, ip, at, prev_hash, entry_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, String(action), String(detail), String(actor), String(ip || ''), at, prevHash, entryHash);

  return { id, action, detail, actor, at, prevHash, entryHash };
}

export function listAuditLogs(limit = 250) {
  const db = getDatabase();
  return db
    .prepare('SELECT id, seq, action, detail, actor, ip, at, prev_hash AS prevHash, entry_hash AS entryHash FROM audit_logs ORDER BY seq DESC LIMIT ?')
    .all(Math.min(500, Math.max(1, Number(limit) || 250)));
}

export function verifyAuditChain() {
  const db = getDatabase();
  const rows = db.prepare('SELECT id, action, detail, actor, at, prev_hash, entry_hash FROM audit_logs ORDER BY seq ASC').all();
  let expectedPrev = 'GENESIS_PERFORMA_ITPLN_2026';
  for (const row of rows) {
    if (row.prev_hash !== expectedPrev) {
      return { valid: false, totalEntries: rows.length, brokenAtId: row.id };
    }
    const recomputed = computeSha256(`${row.prev_hash}|${row.id}|${row.action}|${row.detail}|${row.actor}|${row.at}`);
    if (recomputed !== row.entry_hash) {
      return { valid: false, totalEntries: rows.length, brokenAtId: row.id };
    }
    expectedPrev = row.entry_hash;
  }
  return { valid: true, totalEntries: rows.length, headHash: expectedPrev };
}

export function createBroadcast({
  title,
  message,
  priority = 'IMPORTANT',
  targetType = 'ALL',
  targetValue = '',
  actionUrl = '/internal',
  actionLabel = 'Buka Lembar Kerja',
  senderEmail,
  senderName,
  expiresAt = null,
}) {
  const db = getDatabase();
  const id = `bc_${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const cleanPriority = ['INFO', 'IMPORTANT', 'URGENT'].includes(priority) ? priority : 'IMPORTANT';
  const cleanTargetType = ['ALL', 'ROLE', 'PIC', 'USER'].includes(targetType) ? targetType : 'ALL';
  const cleanTargetValue = cleanTargetType === 'ALL' ? '' : String(targetValue || '').trim();

  db.prepare(`
    INSERT INTO broadcasts (
      id, title, message, priority, target_type, target_value,
      action_url, action_label, sender_email, sender_name, active, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id,
    String(title || '').trim(),
    String(message || '').trim(),
    cleanPriority,
    cleanTargetType,
    cleanTargetValue,
    String(actionUrl || '/internal').trim(),
    String(actionLabel || 'Buka Ruang Kerja').trim(),
    String(senderEmail || 'admin@itpln.ac.id').toLowerCase(),
    String(senderName || 'Superadmin PRP'),
    createdAt,
    expiresAt || null,
  );

  appendAuditLog(
    'BROADCAST_DIKIRIM',
    `[${cleanPriority}] "${String(title).trim()}" -> ${cleanTargetType}${cleanTargetValue ? `:${cleanTargetValue}` : ''}`,
    senderEmail || 'admin@itpln.ac.id',
  );

  return getBroadcastById(id);
}

export function getBroadcastById(id) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM broadcasts WHERE id = ?').get(id);
  if (!row) return null;
  const acks = db
    .prepare('SELECT user_email AS email, user_name AS name, unit, acked_at AS ackedAt FROM broadcast_acks WHERE broadcast_id = ? ORDER BY acked_at DESC')
    .all(id);
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    priority: row.priority,
    targetType: row.target_type,
    targetValue: row.target_value,
    actionUrl: row.action_url,
    actionLabel: row.action_label,
    senderEmail: row.sender_email,
    senderName: row.sender_name,
    active: Boolean(row.active),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acknowledgements: acks,
  };
}

export function doesBroadcastMatchUser(broadcast, user) {
  if (!broadcast || !broadcast.active) return false;
  if (broadcast.expiresAt && new Date(broadcast.expiresAt).getTime() < Date.now()) return false;
  if (!user) return broadcast.targetType === 'ALL';
  if (user.role === 'superadmin_prp') return true;
  if (broadcast.targetType === 'ALL') return true;
  if (broadcast.targetType === 'ROLE') {
    return String(user.role || '').toLowerCase() === String(broadcast.targetValue || '').toLowerCase();
  }
  if (broadcast.targetType === 'USER') {
    const targets = String(broadcast.targetValue || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return targets.includes(String(user.email || '').toLowerCase());
  }
  if (broadcast.targetType === 'PIC') {
    const targetPics = String(broadcast.targetValue || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const userPics = (user.picCodes || []).map((c) => String(c).trim().toUpperCase());
    return targetPics.some((code) => userPics.includes(code));
  }
  return false;
}

export function listBroadcastsForUser(user = null) {
  const db = getDatabase();
  const rows = db.prepare('SELECT id FROM broadcasts WHERE active = 1 ORDER BY created_at DESC LIMIT 50').all();
  const all = rows.map((r) => getBroadcastById(r.id)).filter(Boolean);
  if (!user || user.role === 'superadmin_prp') return all;
  return all.filter((b) => doesBroadcastMatchUser(b, user));
}

export function acknowledgeBroadcast(broadcastId, user) {
  if (!broadcastId || !user?.email) return null;
  const db = getDatabase();
  const existing = getBroadcastById(broadcastId);
  if (!existing) return null;
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO broadcast_acks (broadcast_id, user_email, user_name, unit, acked_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    broadcastId,
    user.email.toLowerCase(),
    user.name || user.email,
    user.unit || '',
    now,
  );
  return getBroadcastById(broadcastId);
}

export function deleteBroadcast(broadcastId, actorEmail = 'admin@itpln.ac.id') {
  const db = getDatabase();
  const existing = getBroadcastById(broadcastId);
  if (!existing) return false;
  db.prepare('UPDATE broadcasts SET active = 0 WHERE id = ?').run(broadcastId);
  appendAuditLog('BROADCAST_DIARSIPKAN', `Siaran "${existing.title}" dihentikan oleh PRP`, actorEmail);
  return true;
}
