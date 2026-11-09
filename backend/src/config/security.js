import crypto from 'node:crypto';

const DEFAULT_SECRET = 'performa-itpln-hmac-root-key-2026-institutional-grade-v1';
const TOKEN_SECRET = process.env.APP_SECRET || process.env.JWT_SECRET || DEFAULT_SECRET;
const PBKDF2_ITERATIONS = 120000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';
export const MAX_JSON_BODY_BYTES = 6 * 1024 * 1024;
export const ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export function hashPassword(plainPassword, existingSalt = null) {
  const password = String(plainPassword ?? '');
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
  return `pbkdf2_sha512$${PBKDF2_ITERATIONS}$${salt}$${derived}`;
}

export function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha512') return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!Number.isFinite(iterations) || iterations < 10000 || !salt || !expectedHex) return false;
  const actualHex = crypto
    .pbkdf2Sync(String(plainPassword ?? ''), salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = Buffer.from(actualHex, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input) {
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

export function signAccessToken(user, extra = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const jti = extra.jti || `sess_${crypto.randomUUID()}`;
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: String(user.email || '').toLowerCase(),
    role: user.role,
    name: user.name || '',
    unit: user.unit || '',
    picCodes: Array.isArray(user.picCodes) ? user.picCodes : [],
    jti,
    iat: nowSec,
    exp: nowSec + (extra.ttlSeconds || ACCESS_TOKEN_TTL_SECONDS),
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', TOKEN_SECRET).update(signingInput).digest(),
  );
  return { token: `${signingInput}.${signature}`, payload };
}

export function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', TOKEN_SECRET).update(signingInput).digest(),
  );
  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.sub || !payload.exp || payload.exp < nowSec) return null;
    return payload;
  } catch {
    return null;
  }
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function sanitizePayload(value, depth = 0) {
  if (depth > 16) return null;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const cleaned = value.replaceAll(String.fromCharCode(0), '');
    if (/^\s*javascript\s*:/i.test(cleaned) || /^\s*vbscript\s*:/i.test(cleaned)) {
      return '';
    }
    return cleaned;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 2000).map((item) => sanitizePayload(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      out[key] = sanitizePayload(val, depth + 1);
    }
    return out;
  }
  return null;
}

export function computeSha256(input) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function applySecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-XSS-Protection', '0');

  const origin = req.headers?.origin;
  if (origin && (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) || /\.vercel\.app$/i.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Id, X-CSRF-Token');
    res.setHeader('Vary', 'Origin');
  }
}

export function parseCookies(cookieHeader = '') {
  const out = {};
  String(cookieHeader || '')
    .split(';')
    .forEach((pair) => {
      const idx = pair.indexOf('=');
      if (idx <= 0) return;
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k && !FORBIDDEN_KEYS.has(k)) {
        try {
          out[k] = decodeURIComponent(v);
        } catch {
          out[k] = v;
        }
      }
    });
  return out;
}

export function extractTokenFromRequest(req, urlObj = null) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers?.cookie);
  if (cookies.performa_access_token) {
    return cookies.performa_access_token;
  }
  if (urlObj && urlObj.searchParams.get('token')) {
    return urlObj.searchParams.get('token');
  }
  return null;
}

export function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}
