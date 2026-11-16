import crypto from 'node:crypto';
import { readKvStore, writeKvStore } from './database.js';

const VAPID_STORE_KEY = 'prp_vapid_keys_v1';
const PUSH_SUBS_STORE_KEY = 'prp_web_push_subscriptions_v1';
const DEFAULT_VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:prp@itpln.ac.id';

function toBase64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(str) {
  const normalized = String(str || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

let cachedVapidKeys = null;

export function getOrCreateVapidKeys() {
  if (cachedVapidKeys) return cachedVapidKeys;

  const envPub = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPriv = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const envJwk = String(process.env.VAPID_PRIVATE_JWK || '').trim();

  if (envPub && envPriv && envJwk) {
    try {
      cachedVapidKeys = {
        publicKey: envPub,
        privateKey: envPriv,
        privateJwk: JSON.parse(envJwk),
      };
      return cachedVapidKeys;
    } catch {
      // Fallback to stored or freshly generated keys
    }
  }

  const stored = readKvStore(VAPID_STORE_KEY, null)?.value;
  if (stored?.publicKey && stored?.privateKey && stored?.privateJwk) {
    cachedVapidKeys = stored;
    return cachedVapidKeys;
  }

  const { privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const privateJwk = privateKey.export({ format: 'jwk' });
  const xBuf = fromBase64Url(privateJwk.x);
  const yBuf = fromBase64Url(privateJwk.y);
  const dBuf = fromBase64Url(privateJwk.d);

  const uncompressedPub = Buffer.concat([Buffer.from([0x04]), xBuf, yBuf]);
  const generated = {
    publicKey: toBase64Url(uncompressedPub),
    privateKey: toBase64Url(dBuf),
    privateJwk,
    createdAt: new Date().toISOString(),
  };

  writeKvStore(VAPID_STORE_KEY, generated, 'system_vapid');
  cachedVapidKeys = generated;
  return cachedVapidKeys;
}

export function getVapidPublicKey() {
  return getOrCreateVapidKeys().publicKey;
}

export function createVapidAuthHeader(endpoint, subject = DEFAULT_VAPID_SUBJECT) {
  const keys = getOrCreateVapidKeys();
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const headerPart = toBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payloadPart = toBase64Url(JSON.stringify({ aud, exp, sub: subject }));
  const signingInput = `${headerPart}.${payloadPart}`;

  const privateKeyObj = crypto.createPrivateKey({
    key: keys.privateJwk,
    format: 'jwk',
  });

  const signature = crypto.sign('sha256', Buffer.from(signingInput, 'utf8'), {
    key: privateKeyObj,
    dsaEncoding: 'ieee-p1363',
  });

  const jwt = `${signingInput}.${toBase64Url(signature)}`;
  return {
    authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
    cryptoKey: `p256ecdsa=${keys.publicKey}`,
  };
}

function hkdfSha256(ikm, salt, info, length) {
  return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, length));
}

export function encryptWebPushPayload(payload, subscriptionKeys) {
  const p256dhB64 = subscriptionKeys?.p256dh;
  const authB64 = subscriptionKeys?.auth;
  if (!p256dhB64 || !authB64) {
    throw new Error('Subscription keys (p256dh & auth) wajib disertakan untuk enkripsi Web Push.');
  }

  const uaPublic = fromBase64Url(p256dhB64);
  const authSecret = fromBase64Url(authB64);

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(uaPublic);

  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    uaPublic,
    asPublic,
  ]);
  const ikm = hkdfSha256(sharedSecret, authSecret, keyInfo, 32);

  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'utf8');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'utf8');
  const cek = hkdfSha256(ikm, salt, cekInfo, 16);
  const nonce = hkdfSha256(ikm, salt, nonceInfo, 12);

  const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const paddedPlaintext = Buffer.concat([
    Buffer.from(rawPayload, 'utf8'),
    Buffer.from([0x02]),
  ]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(paddedPlaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const recordSizeBuf = Buffer.alloc(4);
  recordSizeBuf.writeUInt32BE(4096, 0);
  const idLenBuf = Buffer.from([asPublic.length]);

  const body = Buffer.concat([
    salt,
    recordSizeBuf,
    idLenBuf,
    asPublic,
    encrypted,
    authTag,
  ]);

  return {
    body,
    salt: toBase64Url(salt),
    localPublicKey: toBase64Url(asPublic),
  };
}

export function listPushSubscriptions() {
  const existing = readKvStore(PUSH_SUBS_STORE_KEY, [])?.value;
  return Array.isArray(existing) ? existing : [];
}

export function savePushSubscription(subscription, caller = null) {
  const endpoint = String(subscription?.endpoint || '').trim();
  const p256dh = String(subscription?.keys?.p256dh || '').trim();
  const auth = String(subscription?.keys?.auth || '').trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Format langganan Web Push tidak lengkap (endpoint, keys.p256dh, keys.auth wajib ada).');
  }

  const list = listPushSubscriptions();
  const now = new Date().toISOString();
  const entry = {
    endpoint,
    expirationTime: subscription?.expirationTime || null,
    keys: { p256dh, auth },
    email: String(caller?.email || subscription?.email || '').trim().toLowerCase(),
    role: String(caller?.role || subscription?.role || '').trim(),
    unit: String(caller?.unit || subscription?.unit || '').trim(),
    picCodes: Array.isArray(caller?.picCodes)
      ? caller.picCodes
      : Array.isArray(subscription?.picCodes)
        ? subscription.picCodes
        : [],
    userAgent: String(subscription?.userAgent || '').slice(0, 240),
    updatedAt: now,
  };

  const filtered = list.filter((item) => item?.endpoint && item.endpoint !== endpoint);
  const nextList = [entry, ...filtered].slice(0, 500);
  writeKvStore(PUSH_SUBS_STORE_KEY, nextList, entry.email || 'system_push');
  return entry;
}

export function removePushSubscription(endpoint, actorEmail = 'system_push') {
  const cleanEndpoint = String(endpoint || '').trim();
  if (!cleanEndpoint) return false;
  const list = listPushSubscriptions();
  const nextList = list.filter((item) => item?.endpoint !== cleanEndpoint);
  if (nextList.length === list.length) return false;
  writeKvStore(PUSH_SUBS_STORE_KEY, nextList, actorEmail);
  return true;
}

export async function sendWebPushNotification(subscription, payloadObj) {
  const endpoint = String(subscription?.endpoint || '').trim();
  if (!endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return { ok: false, status: 400, reason: 'INVALID_SUBSCRIPTION' };
  }

  try {
    const { body } = encryptWebPushPayload(payloadObj, subscription.keys);
    const { authorization } = createVapidAuthHeader(endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(body.length),
        TTL: '86400',
        Urgency: 'high',
      },
      body,
    });

    if (response.status === 404 || response.status === 410) {
      removePushSubscription(endpoint, 'vapid_cleanup');
      return { ok: false, status: response.status, expired: true };
    }

    return {
      ok: response.ok,
      status: response.status,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'WEB_PUSH_NETWORK_ERROR',
    };
  }
}

function subscriptionMatchesTarget(sub, filter = {}) {
  if (!filter || filter.broadcastAll || filter.targetType === 'ALL') return true;

  const subEmail = String(sub?.email || '').trim().toLowerCase();
  const subRole = String(sub?.role || '').trim();
  const subUnit = String(sub?.unit || '').trim().toLowerCase();
  const subPicCodes = Array.isArray(sub?.picCodes)
    ? sub.picCodes.map((c) => String(c || '').trim().toUpperCase())
    : [];

  if (Array.isArray(filter.targetEmails) && filter.targetEmails.length > 0) {
    const normalizedEmails = filter.targetEmails.map((e) => String(e || '').trim().toLowerCase());
    if (subEmail && normalizedEmails.includes(subEmail)) return true;
  }

  if (Array.isArray(filter.targetRoles) && filter.targetRoles.length > 0) {
    if (subRole && filter.targetRoles.includes(subRole)) return true;
    if (subRole === 'superadmin_prp' && filter.targetRoles.includes('superadmin_prp')) return true;
  }

  if (Array.isArray(filter.targetPicCodes) && filter.targetPicCodes.length > 0) {
    const normalizedPics = filter.targetPicCodes.map((c) => String(c || '').trim().toUpperCase());
    if (subPicCodes.some((code) => normalizedPics.includes(code))) return true;
  }

  if (filter.targetType) {
    const tType = String(filter.targetType).toUpperCase();
    const tVal = String(filter.targetValue || '').trim();
    if (tType === 'ROLE') {
      if (tVal === 'ALL_UNITS') return subRole !== 'superadmin_prp' && subRole !== 'spi';
      return subRole === tVal || (tVal === 'kpi_only' && subRole === 'dual') || (tVal === 'iku_only' && subRole === 'dual');
    }
    if (tType === 'UNIT') {
      const upperVal = tVal.toUpperCase();
      return subUnit.includes(tVal.toLowerCase()) || subPicCodes.includes(upperVal);
    }
    if (tType === 'USER') {
      return subEmail === tVal.toLowerCase();
    }
  }

  return false;
}

export async function dispatchWebPushToTargets(payloadObj, filter = {}) {
  const subs = listPushSubscriptions();
  const matched = subs.filter((sub) => subscriptionMatchesTarget(sub, filter));
  if (matched.length === 0) {
    return { attempted: 0, delivered: 0 };
  }

  const results = await Promise.allSettled(
    matched.map((sub) => sendWebPushNotification(sub, payloadObj)),
  );

  const delivered = results.filter(
    (r) => r.status === 'fulfilled' && r.value?.ok,
  ).length;

  return {
    attempted: matched.length,
    delivered,
  };
}
