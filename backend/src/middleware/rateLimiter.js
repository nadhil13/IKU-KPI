/**
 * Pelindung Anti-Overload, Pembatas Laju (Sliding-Window Rate Limiter),
 * Circuit Breaker Konkurensi, dan Kunci Brute-Force Login.
 */

const ipBuckets = new Map();
const loginAttemptBuckets = new Map();
const inFlightByIp = new Map();
let totalInFlight = 0;

export const RATE_LIMIT_CONFIG = Object.freeze({
  windowMs: 60 * 1000,
  maxReadPerMinute: 360,
  maxWritePerMinute: 120,
  maxGlobalInFlight: 150,
  maxPerIpInFlight: 35,
  maxLoginFailures: 5,
  loginLockoutMs: 5 * 60 * 1000,
});

function pruneExpired(now = Date.now()) {
  if (ipBuckets.size > 2000) {
    for (const [key, entry] of ipBuckets.entries()) {
      if (now > entry.resetAt) ipBuckets.delete(key);
    }
  }
  if (loginAttemptBuckets.size > 2000) {
    for (const [key, entry] of loginAttemptBuckets.entries()) {
      if (now > entry.resetAt && (!entry.lockedUntil || now > entry.lockedUntil)) {
        loginAttemptBuckets.delete(key);
      }
    }
  }
}

export function acquireRequestSlot(ip, isMutation = false) {
  const now = Date.now();
  pruneExpired(now);

  const currentIpInFlight = inFlightByIp.get(ip) || 0;
  if (totalInFlight >= RATE_LIMIT_CONFIG.maxGlobalInFlight || currentIpInFlight >= RATE_LIMIT_CONFIG.maxPerIpInFlight) {
    return {
      allowed: false,
      status: 503,
      retryAfterSec: 3,
      reason: 'Server sedang menahan lonjakan beban trafik (Anti-Overload Shield aktif). Coba lagi dalam beberapa detik.',
      limit: RATE_LIMIT_CONFIG.maxPerIpInFlight,
      remaining: 0,
      resetSec: 3,
    };
  }

  const bucketKey = `${ip}:${isMutation ? 'write' : 'read'}`;
  const maxAllowed = isMutation ? RATE_LIMIT_CONFIG.maxWritePerMinute : RATE_LIMIT_CONFIG.maxReadPerMinute;
  let bucket = ipBuckets.get(bucketKey);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_CONFIG.windowMs };
    ipBuckets.set(bucketKey, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, maxAllowed - bucket.count);
  const resetSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  if (bucket.count > maxAllowed) {
    return {
      allowed: false,
      status: 429,
      retryAfterSec: resetSec,
      reason: 'Batas laju permintaan (rate limit) terlampaui. Tunggu sebentar sebelum mengirim permintaan baru.',
      limit: maxAllowed,
      remaining: 0,
      resetSec,
    };
  }

  totalInFlight += 1;
  inFlightByIp.set(ip, currentIpInFlight + 1);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    totalInFlight = Math.max(0, totalInFlight - 1);
    const cur = inFlightByIp.get(ip) || 1;
    if (cur <= 1) inFlightByIp.delete(ip);
    else inFlightByIp.set(ip, cur - 1);
  };

  return {
    allowed: true,
    status: 200,
    limit: maxAllowed,
    remaining,
    resetSec,
    release,
  };
}

export function checkLoginLockout(ip, email) {
  const now = Date.now();
  const key = `${ip}:${String(email || '').toLowerCase()}`;
  const record = loginAttemptBuckets.get(key);
  if (!record) return { locked: false, remainingAttempts: RATE_LIMIT_CONFIG.maxLoginFailures };
  if (record.lockedUntil && now < record.lockedUntil) {
    const retryAfterSec = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
    return {
      locked: true,
      retryAfterSec,
      message: `Terlalu banyak percobaan login gagal. Akun dikunci sementara selama ${retryAfterSec} detik demi keamanan.`,
    };
  }
  if (now > record.resetAt) {
    loginAttemptBuckets.delete(key);
    return { locked: false, remainingAttempts: RATE_LIMIT_CONFIG.maxLoginFailures };
  }
  return {
    locked: false,
    remainingAttempts: Math.max(0, RATE_LIMIT_CONFIG.maxLoginFailures - record.failures),
  };
}

export function recordLoginFailure(ip, email) {
  const now = Date.now();
  const key = `${ip}:${String(email || '').toLowerCase()}`;
  const existing = loginAttemptBuckets.get(key);
  const failures = (existing && now <= existing.resetAt ? existing.failures : 0) + 1;
  const lockedUntil = failures >= RATE_LIMIT_CONFIG.maxLoginFailures ? now + RATE_LIMIT_CONFIG.loginLockoutMs : null;
  loginAttemptBuckets.set(key, {
    failures,
    resetAt: now + 10 * 60 * 1000,
    lockedUntil,
  });
  return {
    failures,
    locked: Boolean(lockedUntil),
    retryAfterSec: lockedUntil ? Math.ceil(RATE_LIMIT_CONFIG.loginLockoutMs / 1000) : 0,
  };
}

export function clearLoginFailures(ip, email) {
  const key = `${ip}:${String(email || '').toLowerCase()}`;
  loginAttemptBuckets.delete(key);
}

export function getRateLimiterTelemetry() {
  return {
    totalInFlight,
    activeIpBuckets: ipBuckets.size,
    activeLoginLocks: [...loginAttemptBuckets.values()].filter((v) => v.lockedUntil && v.lockedUntil > Date.now()).length,
  };
}

export function resetRateLimiterForTests() {
  ipBuckets.clear();
  loginAttemptBuckets.clear();
  inFlightByIp.clear();
  totalInFlight = 0;
}
