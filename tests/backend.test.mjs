import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  sanitizePayload,
} from '../backend/src/config/security.js';
import {
  acquireRequestSlot,
  resetRateLimiterForTests,
  RATE_LIMIT_CONFIG,
} from '../backend/src/middleware/rateLimiter.js';
import {
  getDatabase,
  verifyAuditChain,
  doesBroadcastMatchUser,
} from '../backend/src/services/database.js';
import { handleApiRequest } from '../backend/src/routes/apiRouter.js';

function invokeApi(method, url, { body = null, token = '', ip = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body !== null ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = new Readable({
      read() {
        if (bodyBuf) this.push(bodyBuf);
        this.push(null);
      },
    });
    req.method = method;
    req.url = url;
    req.headers = {
      host: 'localhost:8000',
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    };
    req.socket = { remoteAddress: ip };

    const headers = {};
    let statusCode = 200;
    const chunks = [];

    const res = {
      setHeader(k, v) {
        headers[k.toLowerCase()] = v;
      },
      writeHead(code, extra = {}) {
        statusCode = code;
        for (const [k, v] of Object.entries(extra)) {
          headers[k.toLowerCase()] = v;
        }
      },
      write(chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch {
          json = null;
        }
        resolve({ status: statusCode, headers, raw, json });
      },
    };

    handleApiRequest(req, res).catch(reject);
  });
}

beforeEach(() => {
  process.env.PERFORMA_DB_PATH = ':memory:';
  getDatabase(':memory:');
  resetRateLimiterForTests();
});

test('PBKDF2-SHA512 password hashing, JWT HMAC-SHA256 verification, and prototype-pollution sanitizer', () => {
  const hash = hashPassword('SandiKuat#2026');
  assert.equal(verifyPassword('SandiKuat#2026', hash), true);
  assert.equal(verifyPassword('SalahSandi', hash), false);

  const { token } = signAccessToken({
    email: 'bakt@itpln.ac.id',
    role: 'kpi_only',
    name: 'PIC BAKT',
    picCodes: ['BAKT'],
  });
  const verified = verifyAccessToken(token);
  assert.equal(verified.sub, 'bakt@itpln.ac.id');
  assert.deepEqual(verified.picCodes, ['BAKT']);

  // Token yang dimanipulasi wajib ditolak
  const tampered = `${token.slice(0, -4)}xxxx`;
  assert.equal(verifyAccessToken(tampered), null);

  // Sanitizer menolak __proto__ dan javascript: URI
  const dirty = JSON.parse('{"__proto__":{"polluted":true},"url":"javascript:alert(1)","safe":"ok"}');
  const clean = sanitizePayload(dirty);
  assert.equal(clean.safe, 'ok');
  assert.equal(clean.url, '');
  assert.equal(({}).polluted, undefined);
});

test('Anti-brute-force login lockout dan Anti-Overload concurrency shield', async () => {
  // 5 percobaan login gagal berturut-turut memicu kunci sementara (HTTP 429)
  for (let i = 1; i <= 5; i += 1) {
    const failRes = await invokeApi('POST', '/api/v1/auth/login', {
      ip: '10.0.0.77',
      body: { email: 'bakt@itpln.ac.id', password: 'salah-password' },
    });
    assert.equal(failRes.status, 401);
  }

  const lockedRes = await invokeApi('POST', '/api/v1/auth/login', {
    ip: '10.0.0.77',
    body: { email: 'bakt@itpln.ac.id', password: 'password' },
  });
  assert.equal(lockedRes.status, 429);
  assert.ok(lockedRes.headers['retry-after']);

  // Anti-Overload: tahan lonjakan melebihi maxPerIpInFlight dengan HTTP 503
  const slots = [];
  for (let i = 0; i < RATE_LIMIT_CONFIG.maxPerIpInFlight; i += 1) {
    const s = acquireRequestSlot('10.0.0.88', false);
    assert.equal(s.allowed, true);
    slots.push(s);
  }
  const overloaded = acquireRequestSlot('10.0.0.88', false);
  assert.equal(overloaded.allowed, false);
  assert.equal(overloaded.status, 503);
  slots.forEach((s) => s.release());
});

test('Otorisasi server ketat per baris PIC KPI, proteksi lintas unit, dan rantai hash audit anti-manipulasi', async () => {
  const adminLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'admin@itpln.ac.id', password: 'password' },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.json.accessToken;

  const baktLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'bakt@itpln.ac.id', password: 'password' },
  });
  assert.equal(baktLogin.status, 200);
  const baktToken = baktLogin.json.accessToken;

  // Superadmin mendistribusikan form KPI dengan baris A_1a (PIC: PPA) dan A_1b (PIC: BAKT, BAG)
  const sampleWorkflow = {
    forms: [
      {
        id: 'form_2026',
        version: 1,
        period: '2026',
        sections: [
          {
            code: 'A',
            title: 'Perspektif Keberlanjutan',
            totalWeight: 20,
            items: [
              {
                id: 'A_1a',
                no: '1a',
                indikator: 'Mahasiswa Baru',
                pics: ['PPA'],
                subrows: [{ key: 'a_1a_num', label: 'Realisasi Maba' }],
              },
              {
                id: 'A_1b',
                no: '1b',
                indikator: 'Pendapatan Mahasiswa',
                pics: ['BAKT', 'BAG'],
                subrows: [{ key: 'a_1b_num', label: 'Realisasi Pendapatan' }],
              },
            ],
          },
        ],
        units: [
          { email: 'ppa@itpln.ac.id', picCodes: ['PPA'] },
          { email: 'bakt@itpln.ac.id', picCodes: ['BAKT'] },
        ],
      },
    ],
    submissions: {},
    evidence: {},
    drafts: {},
  };

  const distRes = await invokeApi('POST', '/api/v1/sync/push', {
    token: adminToken,
    body: { stores: { prp_kpi_distribution_v1: sampleWorkflow } },
  });
  assert.equal(distRes.status, 200);

  // 1. BAKT dilarang mengubah konfigurasi struktur tabel KPI milik Superadmin
  const illegalConfigPush = await invokeApi('POST', '/api/v1/sync/push', {
    token: baktToken,
    body: { stores: { prp_kpi_config: { hacked: true } } },
  });
  assert.equal(illegalConfigPush.status, 403);

  // 2. BAKT dilarang mengisi nilai pada sub-baris A_1a milik PPA
  const illegalRowPush = await invokeApi('POST', '/api/v1/sync/push', {
    token: baktToken,
    body: {
      stores: {
        prp_kpi_distribution_v1: {
          ...sampleWorkflow,
          drafts: {
            'form_2026:bakt@itpln.ac.id': {
              values: { a_1a_num: '1900', a_1b_num: '95' },
              notes: {},
            },
          },
        },
      },
    },
  });
  assert.equal(illegalRowPush.status, 403);

  // 3. BAKT berhasil menyimpan draf & bukti resmi pada baris A_1b miliknya sendiri
  const validBaktPush = await invokeApi('POST', '/api/v1/sync/push', {
    token: baktToken,
    body: {
      stores: {
        prp_kpi_distribution_v1: {
          ...sampleWorkflow,
          drafts: {
            'form_2026:bakt@itpln.ac.id': {
              values: { a_1b_num: '95' },
              notes: { A_1b: 'Terealisasi 95 Miliar' },
            },
          },
          evidence: {
            'form_2026:bakt@itpln.ac.id': [
              {
                id: 'ev_1',
                indicatorId: 'A_1b',
                kind: 'link',
                label: 'Rekap Pendapatan BAKT',
                url: 'https://drive.itpln.ac.id/bakt',
              },
            ],
          },
        },
      },
    },
  });
  assert.equal(validBaktPush.status, 200);
  assert.equal(
    validBaktPush.json.stores.prp_kpi_distribution_v1.drafts['form_2026:bakt@itpln.ac.id'].values.a_1b_num,
    '95',
  );

  // 4. Rantai hash audit valid secara kriptografis
  const chainStatus = verifyAuditChain();
  assert.equal(chainStatus.valid, true);
  assert.ok(chainStatus.totalEntries >= 5);
});

test('Broadcast Realtime Superadmin PRP: penargetan ALL, ROLE, PIC, USER serta konfirmasi baca', async () => {
  const adminLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'admin@itpln.ac.id', password: 'password' },
  });
  const adminToken = adminLogin.json.accessToken;

  const baktLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'bakt@itpln.ac.id', password: 'password' },
  });
  const baktToken = baktLogin.json.accessToken;
  const baktUser = baktLogin.json.user;

  const ppaLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'ppa@itpln.ac.id', password: 'password' },
  });
  const ppaUser = ppaLogin.json.user;

  // Non-superadmin dilarang mengirim broadcast
  const deniedBc = await invokeApi('POST', '/api/v1/broadcasts', {
    token: baktToken,
    body: { title: 'Palsu', message: 'Tidak boleh' },
  });
  assert.equal(deniedBc.status, 403);

  // Superadmin mengirim broadcast khusus ke PIC: BAKT
  const createBc = await invokeApi('POST', '/api/v1/broadcasts', {
    token: adminToken,
    body: {
      title: 'Segera Input Realisasi Pendapatan BAKT',
      message: 'Mohon selesaikan pengisian indikator 1b s.d. 4 Bagian A sebelum pukul 17.00 WIB.',
      priority: 'URGENT',
      targetType: 'PIC',
      targetValue: 'BAKT',
    },
  });
  assert.equal(createBc.status, 201);
  const bc = createBc.json.broadcast;

  assert.equal(doesBroadcastMatchUser(bc, baktUser), true);
  assert.equal(doesBroadcastMatchUser(bc, ppaUser), false);

  // BAKT mengonfirmasi telah membaca instruksi
  const ackRes = await invokeApi('POST', `/api/v1/broadcasts/${bc.id}/ack`, {
    token: baktToken,
  });
  assert.equal(ackRes.status, 200);
  assert.equal(ackRes.json.broadcast.acknowledgements.length, 1);
  assert.equal(ackRes.json.broadcast.acknowledgements[0].email, 'bakt@itpln.ac.id');
});
