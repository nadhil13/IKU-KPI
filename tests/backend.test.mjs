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

  // Superadmin menambah baris indikator baru di prp_kpi_config -> otomatis tersinkron ke form aktif prp_kpi_distribution_v1
  const configSyncRes = await invokeApi('POST', '/api/v1/sync/push', {
    token: adminToken,
    body: {
      stores: {
        prp_kpi_config: {
          version: 3,
          publishedAt: new Date().toISOString(),
          publishedBy: 'admin@itpln.ac.id',
          sections: [
            {
              code: 'A',
              title: 'PERSPEKTIF KEBERLANJUTAN',
              items: [
                {
                  id: 'A_1a',
                  no: '1',
                  indikator: 'Pendapatan Vertikal',
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
                {
                  id: 'A_new_rt',
                  no: '2',
                  indikator: 'Indikator Baru Realtime',
                  pics: ['BAKT'],
                  subrows: [{ key: 'a_new_rt_val', label: 'Realisasi Baru' }],
                },
              ],
            },
          ],
        },
      },
    },
  });
  assert.equal(configSyncRes.status, 200);
  const syncedDist = configSyncRes.json.stores.prp_kpi_distribution_v1;
  assert.equal(syncedDist.forms[0].sections[0].items.length, 3);
  assert.equal(syncedDist.forms[0].sections[0].items[2].id, 'A_new_rt');
  // Draf BAKT pada A_1b tetap terjaga utuh
  assert.equal(syncedDist.drafts['form_2026:bakt@itpln.ac.id'].values.a_1b_num, '95');
});

test('Hosting Production Gate: Vercel Serverless Gateway, PWA Manifest & Service Worker Notifikasi HP, dan SPA Deep Links', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const vercelHandler = (await import('../api/v1/[...route].js')).default;
  const { syncActiveFormWithPublishedSections } = await import('../backend/src/modules/kpi/kpiAccessPolicy.js');
  const { validateAndMergeIkuSubmissionsForUnit } = await import('../backend/src/modules/iku/ikuAccessPolicy.js');

  assert.equal(typeof vercelHandler, 'function');
  assert.equal(typeof syncActiveFormWithPublishedSections, 'function');
  assert.equal(typeof validateAndMergeIkuSubmissionsForUnit, 'function');

  // 1. Verifikasi manifest.json untuk instalasi PWA di Android & iPhone (standalone + shortcuts + maskable icon)
  const manifestRaw = fs.readFileSync(path.resolve('public/manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/internal');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.some((i) => i.purpose === 'maskable'));
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 2);

  // 2. Verifikasi Service Worker (sw.js) untuk notifikasi layar kunci HP & push handler
  const swSource = fs.readFileSync(path.resolve('public/sw.js'), 'utf8');
  assert.ok(swSource.includes('SHOW_OS_NOTIFICATION'));
  assert.ok(swSource.includes("self.addEventListener('push'"));
  assert.ok(swSource.includes("self.addEventListener('notificationclick'"));

  // 3. Verifikasi vercel.json mendukung API /api/v1/* dan SPA fallback tanpa 404 saat buka di tab baru
  const vercelConfig = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));
  assert.ok(Array.isArray(vercelConfig.rewrites) && vercelConfig.rewrites.length >= 2);
  assert.equal(vercelConfig.rewrites[0].source, '/api/v1/(.*)');
});

test('Keamanan Profil, Kata Sandi, Hapus User, Isolasi Role dual, dan Sanitasi Bootstrap prp_users', async () => {
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

  // 1. Update profil & ganti kata sandi sendiri oleh user aktif
  const profileRes = await invokeApi('POST', '/api/v1/auth/profile', {
    token: baktToken,
    body: { name: 'Operator BAKT Terbarui', unit: 'Biro Akuntansi Keuangan' },
  });
  assert.equal(profileRes.status, 200);
  assert.equal(profileRes.json.user.name, 'Operator BAKT Terbarui');

  const pwRes = await invokeApi('POST', '/api/v1/auth/password', {
    token: baktToken,
    body: { currentPassword: 'password', newPassword: 'BaktBaru#2026' },
  });
  assert.equal(pwRes.status, 200);

  const oldPwLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'bakt@itpln.ac.id', password: 'password' },
  });
  assert.equal(oldPwLogin.status, 401);

  const newPwLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'bakt@itpln.ac.id', password: 'BaktBaru#2026' },
  });
  assert.equal(newPwLogin.status, 200);

  // 2. Superadmin mendaftarkan akun role dual & prp_users harus tersanitasi (tanpa plaintext password) saat bootstrap
  const syncUsersRes = await invokeApi('POST', '/api/v1/sync/push', {
    token: adminToken,
    body: {
      stores: {
        prp_users: [
          {
            email: 'dual.test@itpln.ac.id',
            name: 'Akun Dual Uji',
            unit: 'Unit Penguji Dual',
            role: 'dual',
            status: 'Aktif',
            picCodes: ['BAKT'],
            password: 'RahasiaDual#2026',
          },
        ],
        prp_kpi_distribution_v1: {
          forms: [
            {
              id: 'form_dual',
              period: '2026',
              sections: [
                {
                  code: 'A',
                  items: [
                    { id: 'A_1a', no: '1a', pics: ['PPA'], subrows: [{ key: 'a_1a_num', label: 'PPA' }] },
                    { id: 'A_1b', no: '1b', pics: ['BAKT'], subrows: [{ key: 'a_1b_num', label: 'BAKT' }] },
                  ],
                },
              ],
            },
          ],
          drafts: {},
          submissions: {},
          evidence: {},
        },
      },
    },
  });
  assert.equal(syncUsersRes.status, 200);
  const storedUsers = syncUsersRes.json.stores.prp_users || [];
  const savedDual = storedUsers.find((u) => u.email === 'dual.test@itpln.ac.id');
  assert.ok(savedDual);
  assert.equal(savedDual.password, undefined);

  const bootstrapRes = await invokeApi('GET', '/api/v1/bootstrap', { token: adminToken });
  assert.equal(bootstrapRes.status, 200);
  const bootDual = (bootstrapRes.json.stores.prp_users || []).find((u) => u.email === 'dual.test@itpln.ac.id');
  assert.ok(bootDual);
  assert.equal(bootDual.password, undefined);

  // 3. Login akun role dual: boleh isi baris BAKT, ditolak 403 saat menyentuh baris PPA
  const dualLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'dual.test@itpln.ac.id', password: 'RahasiaDual#2026' },
  });
  assert.equal(dualLogin.status, 200);
  const dualToken = dualLogin.json.accessToken;

  const dualForbiddenPush = await invokeApi('POST', '/api/v1/sync/push', {
    token: dualToken,
    body: {
      stores: {
        prp_kpi_distribution_v1: {
          ...syncUsersRes.json.stores.prp_kpi_distribution_v1,
          drafts: {
            'form_dual:dual.test@itpln.ac.id': { values: { a_1a_num: '88' }, notes: {} },
          },
        },
      },
    },
  });
  assert.equal(dualForbiddenPush.status, 403);

  const dualAllowedPush = await invokeApi('POST', '/api/v1/sync/push', {
    token: dualToken,
    body: {
      stores: {
        prp_kpi_distribution_v1: {
          ...syncUsersRes.json.stores.prp_kpi_distribution_v1,
          drafts: {
            'form_dual:dual.test@itpln.ac.id': { values: { a_1b_num: '91' }, notes: {} },
          },
        },
      },
    },
  });
  assert.equal(dualAllowedPush.status, 200);

  // 4. Hapus user hanya oleh superadmin & tidak boleh hapus akun sendiri
  const nonAdminDel = await invokeApi('DELETE', '/api/v1/users/dual.test@itpln.ac.id', { token: dualToken });
  assert.equal(nonAdminDel.status, 403);

  const selfDel = await invokeApi('DELETE', '/api/v1/users/admin@itpln.ac.id', { token: adminToken });
  assert.equal(selfDel.status, 400);

  const validDel = await invokeApi('DELETE', '/api/v1/users/dual.test@itpln.ac.id', { token: adminToken });
  assert.equal(validDel.status, 200);
});

test('Isolasi Privasi Data Antar-Unit (Unit Data Privacy), Otoritas Read-Only Auditor SPI, serta Sinkronisasi Notifikasi & Email Audit', async () => {
  const adminLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'admin@itpln.ac.id', password: 'password' },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.json.accessToken;

  const ppaLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'ppa@itpln.ac.id', password: 'password' },
  });
  assert.equal(ppaLogin.status, 200);
  const ppaToken = ppaLogin.json.accessToken;

  const bpkaLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'bpka@itpln.ac.id', password: 'password' },
  });
  assert.equal(bpkaLogin.status, 200);
  const bpkaToken = bpkaLogin.json.accessToken;

  const spiLogin = await invokeApi('POST', '/api/v1/auth/login', {
    body: { email: 'spi@itpln.ac.id', password: 'password' },
  });
  assert.equal(spiLogin.status, 200);
  assert.equal(spiLogin.json.user.role, 'spi');
  const spiToken = spiLogin.json.accessToken;

  // 1. Admin PRP mendistribusikan form dengan isian dari PPA dan BPKA
  const seedWorkflow = {
    activeFormId: 'form_privacy_2026',
    forms: [
      {
        id: 'form_privacy_2026',
        period: '2026 / 2027',
        sections: [
          {
            code: 'A',
            items: [
              { id: 'A_1a', no: '1', pics: ['PPA'], subrows: [{ key: 'ppa_val', label: 'Maba PPA' }] },
            ],
          },
          {
            code: 'B',
            items: [
              { id: 'B_1a', no: '1a', pics: ['BPKA'], subrows: [{ key: 'bpka_val', label: 'Tracer BPKA' }] },
            ],
          },
        ],
      },
    ],
    drafts: {
      'form_privacy_2026:ppa@itpln.ac.id': { values: { ppa_val: '1850' }, notes: { A_1a: 'Rahasia PPA' } },
      'form_privacy_2026:bpka@itpln.ac.id': { values: { bpka_val: '72' }, notes: { B_1a: 'Rahasia BPKA' } },
    },
    submissions: {
      'form_privacy_2026:ppa@itpln.ac.id': { status: 'SUBMITTED', values: { ppa_val: '1850' }, notes: { A_1a: 'Rahasia PPA' } },
      'form_privacy_2026:bpka@itpln.ac.id': { status: 'SUBMITTED', values: { bpka_val: '72' }, notes: { B_1a: 'Rahasia BPKA' } },
    },
    evidence: {
      'form_privacy_2026:ppa@itpln.ac.id': [{ id: 'ev_ppa', itemId: 'A_1a', label: 'SK PPA', url: 'https://drive.google.com/ppa' }],
      'form_privacy_2026:bpka@itpln.ac.id': [{ id: 'ev_bpka', itemId: 'B_1a', label: 'SK BPKA', url: 'https://drive.google.com/bpka' }],
    },
  };

  const pushSeed = await invokeApi('POST', '/api/v1/sync/push', {
    token: adminToken,
    body: {
      stores: {
        prp_kpi_distribution_v1: seedWorkflow,
      },
    },
  });
  assert.equal(pushSeed.status, 200);

  // 2. Saat BPKA memanggil bootstrap, BPKA HANYA melihat data milik BPKA sendiri (data PPA disembunyikan penuh)
  const bpkaBoot = await invokeApi('GET', '/api/v1/bootstrap', { token: bpkaToken });
  assert.equal(bpkaBoot.status, 200);
  const bpkaDist = bpkaBoot.json.stores.prp_kpi_distribution_v1;
  assert.ok(bpkaDist.submissions['form_privacy_2026:bpka@itpln.ac.id']);
  assert.equal(bpkaDist.submissions['form_privacy_2026:ppa@itpln.ac.id'], undefined);
  assert.equal(bpkaDist.drafts['form_privacy_2026:ppa@itpln.ac.id'], undefined);
  assert.equal(bpkaDist.evidence['form_privacy_2026:ppa@itpln.ac.id'], undefined);

  // 3. Saat PPA memanggil bootstrap, PPA HANYA melihat data milik PPA sendiri (data BPKA disembunyikan penuh)
  const ppaBoot = await invokeApi('GET', '/api/v1/bootstrap', { token: ppaToken });
  assert.equal(ppaBoot.status, 200);
  const ppaDist = ppaBoot.json.stores.prp_kpi_distribution_v1;
  assert.ok(ppaDist.submissions['form_privacy_2026:ppa@itpln.ac.id']);
  assert.equal(ppaDist.submissions['form_privacy_2026:bpka@itpln.ac.id'], undefined);

  // 4. Akun Auditor SPI (role: 'spi') dapat melihat seluruh data terintegrasi (View-Only), namun ditolak 403 jika mencoba mengedit
  const spiBoot = await invokeApi('GET', '/api/v1/bootstrap', { token: spiToken });
  assert.equal(spiBoot.status, 200);
  const spiDist = spiBoot.json.stores.prp_kpi_distribution_v1;
  assert.ok(spiDist.submissions['form_privacy_2026:ppa@itpln.ac.id']);
  assert.ok(spiDist.submissions['form_privacy_2026:bpka@itpln.ac.id']);

  const spiMutateAttempt = await invokeApi('POST', '/api/v1/sync/push', {
    token: spiToken,
    body: {
      stores: {
        prp_kpi_distribution_v1: seedWorkflow,
      },
    },
  });
  assert.equal(spiMutateAttempt.status, 403);

  // 5. Sinkronisasi Notifikasi In-App & Log Email Audit Trail
  const notifSync = await invokeApi('POST', '/api/v1/sync/push', {
    token: adminToken,
    body: {
      stores: {
        prp_notifications_v1: [
          {
            id: 'notif-rev-bpka-1',
            kind: 'REVISION',
            title: 'Catatan Revisi PRP • Baris B.1a',
            message: 'Mohon lengkapi tautan bukti Tracer Study',
            targetType: 'PIC',
            targetValue: 'BPKA',
            actionUrl: '/internal?period=2026%20%2F%202027&section=B&item=B_1a',
            readBy: [],
            createdAt: new Date().toISOString(),
          },
        ],
        prp_email_outbox_v1: [
          {
            id: 'email-rev-bpka-1',
            kind: 'REVISION',
            toEmails: ['bpka@itpln.ac.id'],
            subject: '[PERFORMA ITPLN] Catatan Revisi KPI B.1a',
            status: 'TERKIRIM_TERCATAT',
            sentAt: new Date().toISOString(),
          },
        ],
      },
    },
  });
  assert.equal(notifSync.status, 200);
  assert.equal(notifSync.json.stores.prp_notifications_v1.length, 1);
  assert.equal(notifSync.json.stores.prp_email_outbox_v1.length, 1);
});
