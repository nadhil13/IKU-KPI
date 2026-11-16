import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateKpiFormula, validateKpiFormula } from '../src/features/kpi/formulaEngine.js';

// Muat modul aplikasi tanpa bundler; mock hanya akun/auth dan API browser.
const engineUrl = new URL('../src/features/kpi/formulaEngine.js', import.meta.url).href;
const schemaSource = (await readFile(new URL('../src/features/kpi/kpiSchema.js', import.meta.url), 'utf8'))
  .replace("'./formulaEngine'", JSON.stringify(engineUrl));
const schemaUrl = `data:text/javascript;base64,${Buffer.from(schemaSource).toString('base64')}`;
const {
  computeKpiItem,
  buildKpiCellDirectory,
  validateKpiSections,
  canUserEditKpiItem,
  normalizePicCodes,
  saveKpiValidationRules,
} = await import(schemaUrl);

test('validasi bobot akurat: Σ baris per bagian, total 100, tanpa noise float', () => {
  const item = (id, bobot) => ({ id, no: id, label: id, bobot, formula: 'A1', inputs: [{ key: `${id}_a`, label: 'a' }], deadlines: [] });
  const sections = [
    { code: 'A', title: 'A', totalWeight: 25, isPenaltySection: false, items: [item('a1', 20), item('a2', 15)] },
    { code: 'B', title: 'B', totalWeight: 75, isPenaltySection: false, items: [item('b1', 0.1), item('b2', 0.2), item('b3', 74.7)] },
    { code: 'C', title: 'C', totalWeight: -5, isPenaltySection: true, items: [item('c1', -5)] },
  ];
  const { sectionSummaries, positiveTotal, penaltyTotal, issues } = validateKpiSections(sections);
  assert.equal(sectionSummaries[0].itemSum, 35);
  assert.equal(sectionSummaries[0].diff, 10);
  assert.equal(sectionSummaries[1].matches, true); // 0,1 + 0,2 + 74,7 = 75 tepat
  assert.equal(sectionSummaries[2].matches, true); // penalti dibandingkan secara absolut
  assert.equal(positiveTotal, 110);
  assert.equal(penaltyTotal, 5);
  assert.ok(issues.some((i) => i.sectionCode === 'A' && i.level === 'warn'));
  assert.ok(!issues.some((i) => i.sectionCode === 'B' && /bobot/.test(i.message)));
});
const storeSource = (await readFile(new URL('../src/features/kpi/kpiWorkflowStore.js', import.meta.url), 'utf8'))
  .replace("import { MOCK_ACCOUNTS } from '../auth/authAccounts';", `const MOCK_ACCOUNTS = [
    {email:'one@test.id',name:'Satu',role:'kpi_only'},
    {email:'two@test.id',name:'Dua',role:'kpi_only'},
    {email:'ppa@itpln.ac.id',name:'Operator PPA',unit:'Pusat Pelayanan Akademik (PPA)',role:'kpi_only',picCodes:['PPA']},
    {email:'bakt@itpln.ac.id',name:'Operator BAKT',unit:'Biro Akuntansi (BAKT)',role:'kpi_only',picCodes:['BAKT']}];`)
  .replace("'./kpiSchema'", JSON.stringify(schemaUrl));
const store = await import(`data:text/javascript;base64,${Buffer.from(storeSource).toString('base64')}`);
const memory = new Map();
globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
globalThis.window = new EventTarget();
const item = { id: 'a1', no: '1', indikator: 'Uji', calcType: 'custom', formulaExpr: 'I1/T*100', targetNum: 100, bobot: 10, subrows: [{ key: 'value', label: 'Realisasi' }] };
const sections = [{ code: 'A', title: 'Uji', totalWeight: 10, items: [item] }];

test('rumus aman, fungsi malas, angka hilang, dan referensi isian', () => {
  assert.equal(evaluateKpiFormula('SUM(I1;I2)/T*100', { inputs: [20, 30], target: 100 }).value, 50);
  assert.equal(evaluateKpiFormula('IF(I1=0;100;I2/I1)', { inputs: [0, null] }).value, 100);
  assert.equal(evaluateKpiFormula('I1/I2', { inputs: [1, 0] }).value, null);
  assert.equal(evaluateKpiFormula('I1+I2', { inputs: [1, null] }).value, null);
  assert.ok(validateKpiFormula('I3/T', 2));
  assert.ok(validateKpiFormula('alert(1)', 1));
  assert.equal(evaluateKpiFormula('2^3^2', {}).value, 512);
});
test('capaian dibatasi dan penalti konsisten', () => {
  assert.equal(computeKpiItem(item, { value: '150' }, false).weightedScore, 10);
  assert.equal(computeKpiItem({ ...item, bobot: -10 }, { value: '75' }, true).weightedScore, -2.5);
});
test('referensi sel lintas baris ala Excel', () => {
  // Baris A.1b memakai isian A.1a dan target baris lain.
  const rowA = { id: 'x1', no: '1a', calcType: 'ratio_two', targetNum: 80, bobot: 5, subrows: [{ key: 'xa', label: 'Pembilang' }] };
  const rowB = { id: 'x2', no: '1b', calcType: 'custom', formulaExpr: '=A1A_I1/I1*100', targetNum: 0, bobot: 10, subrows: [{ key: 'xb', label: 'Penyebut' }] };
  const grid = [{ code: 'A', title: 'Lintas', totalWeight: 15, items: [rowA, rowB] }];
  const { allowedRefs, cells } = buildKpiCellDirectory(grid, { xa: '30', xb: '60' });
  assert.equal(cells.A1A_I1, 30);
  assert.equal(cells.A1A_T, 80);
  assert.equal(validateKpiFormula('A1A_I1/I1*100', 1, allowedRefs), null);
  assert.ok(validateKpiFormula('Z9_I1/I1', 1, allowedRefs));
  const result = computeKpiItem(rowB, { xa: '30', xb: '60' }, false, grid);
  assert.equal(result.ratioPercent, 50);
  assert.equal(result.weightedScore, 5);
});
test('snapshot, isolasi unit, revisi dan versi baru', () => {
  memory.clear();
  const form = store.distributeKpiForm(sections, { period: '2027' });
  sections[0].items[0].targetNum = 200;
  assert.equal(store.getUnitKpiForm('one@test.id').sections[0].items[0].targetNum, 100);
  const user = { email: 'one@test.id', name: 'Satu' };
  assert.throws(() => store.submitUnitKpi(form.id, user, { value: '' }));
  assert.equal(store.submitUnitKpi(form.id, user, { value: '75' }).totalScore, 7.5);
  assert.equal(store.readUnitSubmission(form.id, 'two@test.id'), null);
  assert.throws(() => store.submitUnitKpi(form.id, user, { value: '80' }));
  store.reviewUnitKpi(form.id, user.email, 'NEEDS_REVISION', 'Perbaiki');
  assert.equal(store.submitUnitKpi(form.id, user, { value: '80' }).totalScore, 8);
  store.reviewUnitKpi(form.id, user.email, 'APPROVED');
  assert.throws(() => store.submitUnitKpi(form.id, user, { value: '90' }));
  const next = store.distributeKpiForm(sections, { period: '2028' });
  assert.equal(store.getUnitKpiForm(user.email).id, next.id);
  assert.equal(store.readUnitSubmission(form.id, user.email).status, 'APPROVED');
  assert.equal(store.readUnitSubmission(next.id, user.email), null);
});

test('otorisasi PIC ketat per baris, bukti berkas/tautan per baris, keterangan, dan papan integrasi pusat PRP', () => {
  memory.clear();
  assert.deepEqual(normalizePicCodes('PJM dan PRP'), ['PJM', 'PRP']);
  assert.deepEqual(normalizePicCodes('SPI, PJM, Akuntansi, WBS'), ['SPI', 'PJM', 'Akuntansi', 'WBS']);

  const rowPpa = {
    id: 'A_1a',
    no: '1a',
    indikator: 'Pendapatan Vertikal Mahasiswa',
    calcType: 'single_target',
    targetNum: 2000,
    bobot: 10,
    pics: ['PPA'],
    picDisplay: 'PPA',
    subrows: [{ key: 'maba_real', label: 'Realisasi Mahasiswa Baru' }],
  };
  const rowBakt = {
    id: 'A_1b',
    no: '1b',
    indikator: 'Realisasi Pendapatan Mahasiswa',
    calcType: 'single_target',
    targetNum: 100,
    bobot: 10,
    pics: ['BAKT', 'BAG'],
    picDisplay: 'BAKT, BAG',
    subrows: [{ key: 'rev_real', label: 'Realisasi Pendapatan (Miliar)' }],
  };
  const picSections = [{ code: 'A', title: 'Perspektif Keberlanjutan', totalWeight: 20, items: [rowPpa, rowBakt] }];
  const prpAdmin = { email: 'admin@itpln.ac.id', name: 'Superadmin PRP', role: 'superadmin_prp', status: 'Aktif' };
  const userPpa = { email: 'ppa@itpln.ac.id', name: 'Operator PPA', unit: 'Pusat Pelayanan Akademik (PPA)', role: 'kpi_only', picCodes: ['PPA'] };
  const userBakt = { email: 'bakt@itpln.ac.id', name: 'Operator BAKT', unit: 'Biro Akuntansi (BAKT)', role: 'kpi_only', picCodes: ['BAKT'] };

  assert.equal(canUserEditKpiItem(rowPpa, userPpa), true);
  assert.equal(canUserEditKpiItem(rowBakt, userPpa), false);
  assert.equal(canUserEditKpiItem(rowBakt, userBakt), true);
  assert.equal(canUserEditKpiItem(rowPpa, userBakt), false);

  const form = store.distributeKpiForm(picSections, { period: '2026', actor: prpAdmin });

  // BAKT dilarang mengisi nilai, keterangan, atau mengunggah bukti pada baris milik PPA.
  assert.throws(() => store.submitUnitKpi(form.id, userBakt, { maba_real: '1800', rev_real: '90' }), /hak input pada indikator A\.1a/i);
  assert.throws(() => store.addUnitEvidence(form.id, userBakt, {
    indicatorId: 'A_1a',
    kind: 'link',
    label: 'Bukti salah kamar',
    url: 'https://drive.google.com/file/d/ppa',
  }), /milik PIC lain/i);

  // Bukti wajib dilampirkan pada tiap baris PIC sebelum submit ke sistem pusat.
  assert.throws(() => store.submitUnitKpi(form.id, userBakt, { rev_real: '90' }), /Bukti capaian \(evidence\) wajib/i);

  // Unggah bukti berkas PDF langsung (base64 dataUrl) pada baris BAKT + simpan draf keterangan.
  const samplePdfDataUrl = `data:application/pdf;base64,${Buffer.from('%PDF-1.4 laporan realisasi').toString('base64')}`;
  const evFile = store.addUnitEvidence(form.id, userBakt, {
    indicatorId: 'A_1b',
    kind: 'file',
    label: 'Rekap Buku Besar Pendapatan Mahasiswa',
    fileName: 'rekap-bakt-2026.pdf',
    mimeType: 'application/pdf',
    fileSize: 256,
    dataUrl: samplePdfDataUrl,
  });
  assert.equal(evFile.kind, 'file');
  assert.equal(evFile.fileName, 'rekap-bakt-2026.pdf');

  store.saveUnitKpiDraft(form.id, userBakt, {
    values: { rev_real: '90', maba_real: '9999' },
    notes: { A_1b: 'Sudah diaudit internal triwulan III', A_1a: 'Harus diabaikan' },
  });
  const savedDraft = store.readUnitDraft(form.id, userBakt.email);
  assert.equal(savedDraft.values.rev_real, '90');
  assert.equal(savedDraft.values.maba_real, undefined);
  assert.equal(savedDraft.notes.A_1a, undefined);

  const subBakt = store.submitUnitKpi(form.id, userBakt, { rev_real: '90' }, { notes: { A_1b: 'Realisasi 90 Miliar sesuai RKA' } });
  assert.equal(subBakt.totalScore, 9);
  assert.equal(store.readUnitDraft(form.id, userBakt.email), null);

  // PPA melampirkan bukti tautan HTTPS Google Drive pada baris A_1a lalu submit.
  const evLink = store.addUnitEvidence(form.id, userPpa, {
    indicatorId: 'A_1a',
    kind: 'link',
    label: 'SK Rektor Penetapan Mahasiswa Baru',
    url: 'https://drive.google.com/file/d/sk-maba-2026/view',
  });
  assert.equal(evLink.kind, 'link');
  const subPpa = store.submitUnitKpi(form.id, userPpa, { maba_real: '1600' }, { notes: { A_1a: 'Gelombang 1 s.d. 3 terverifikasi' } });
  assert.equal(subPpa.totalScore, 8);

  // Sistem pusat menggabungkan capaian PPA (8) + BAKT (9) = 17 secara transparan lintas unit.
  const board = store.readIntegratedKpiBoard(form.id);
  assert.equal(board.filledIndicatorCount, 2);
  assert.equal(board.totalScore, 17);
  assert.equal(board.values.maba_real, '1600');
  assert.equal(board.values.rev_real, '90');
  assert.equal(board.notes.A_1a, 'Gelombang 1 s.d. 3 terverifikasi');
  assert.equal(board.notes.A_1b, 'Realisasi 90 Miliar sesuai RKA');
  assert.equal(board.evidenceByItem.A_1b[0].kind, 'file');
  assert.equal(board.evidenceByItem.A_1a[0].kind, 'link');

  // Superadmin PRP wajib memverifikasi bukti baris sebelum menyetujui pengajuan unit.
  assert.throws(() => store.reviewUnitKpi(form.id, userBakt.email, 'APPROVED', '', prpAdmin), /bukti/i);
  store.reviewUnitEvidence(form.id, userBakt.email, evFile.id, 'VERIFIED', 'Dokumen PDF sesuai buku besar', prpAdmin);
  const approvedBakt = store.reviewUnitKpi(form.id, userBakt.email, 'APPROVED', 'Capaian BAKT disetujui PRP', prpAdmin);
  assert.equal(approvedBakt.status, 'APPROVED');
});

test('pengaturan aturan validasi struktur oleh Admin PRP bekerja dinamis', () => {
  memory.clear();
  const prpAdmin = { email: 'admin@itpln.ac.id', name: 'Superadmin PRP', role: 'superadmin_prp', status: 'Aktif' };
  const sampleSections = [{
    code: 'A',
    title: 'Bagian Uji',
    totalWeight: 25,
    items: [{
      id: 'u1',
      no: '1',
      indikator: 'Indikator Tanpa PIC',
      calcType: 'single_target',
      targetNum: 100,
      bobot: 25,
      pics: [],
      subrows: [{ key: 'u1_v', label: 'Nilai' }],
    }],
  }];

  // Default: total bobot 25 != 100 hanya menghasilkan peringatan ('warn') dan distribusi diizinkan.
  const initialCheck = validateKpiSections(sampleSections);
  assert.ok(initialCheck.issues.some((i) => i.level === 'warn'));
  assert.equal(initialCheck.issues.some((i) => i.level === 'error'), false);

  // Admin PRP mengubah kebijakan wajib PIC menjadi 'error' -> distribusi diblokir sampai PIC diisi.
  saveKpiValidationRules({ requirePicPolicy: 'error', totalWeightPolicy: 'off' }, 'admin@itpln.ac.id');
  const strictPicCheck = validateKpiSections(sampleSections);
  assert.ok(strictPicCheck.issues.some((i) => i.level === 'error' && /PIC/i.test(i.message)));
  assert.throws(() => store.distributeKpiForm(sampleSections, { period: '2026', actor: prpAdmin }), /aturan struktur wajib/i);

  // Setelah PIC ditetapkan, distribusi berhasil.
  sampleSections[0].items[0].pics = ['PPA'];
  const distributed = store.distributeKpiForm(sampleSections, { period: '2026', actor: prpAdmin });
  assert.equal(distributed.sections[0].items[0].pics[0], 'PPA');

  // Penambahan baris baru secara realtime tanpa meriset draf/submission yang sudah ada.
  const expandedSections = JSON.parse(JSON.stringify(sampleSections));
  expandedSections[0].items.push({
    id: 'A_2_rt',
    no: '2',
    indikator: 'Indikator Tambahan Realtime',
    formula: '[a_2_rt_val]',
    pics: ['BAKT'],
    bobot: 25,
    targetNum: 100,
    satuan: '%',
    subrows: [{ key: 'a_2_rt_val', label: 'Capaian Tambahan' }],
  });
  const syncedForm = store.syncActiveKpiFormSections(expandedSections, { actor: prpAdmin });
  assert.equal(syncedForm.id, distributed.id);
  assert.equal(syncedForm.sections[0].items.length, 2);
  assert.equal(syncedForm.sections[0].items[1].id, 'A_2_rt');
});

test('peran dual memiliki hak edit KPI berbasis PIC yang konsisten dengan kpi_only', () => {
  const dualBakt = { email: 'dual.bakt@itpln.ac.id', role: 'dual', picCodes: ['BAKT'], status: 'Aktif' };
  const spiAuditor = { email: 'spi@itpln.ac.id', role: 'spi', picCodes: [], status: 'Aktif' };
  const rowBakt = { id: 'r_bakt', pics: ['BAKT'] };
  const rowPpa = { id: 'r_ppa', pics: ['PPA'] };
  const rowUmum = { id: 'r_umum', pics: [] };

  assert.equal(canUserEditKpiItem(rowBakt, dualBakt), true);
  assert.equal(canUserEditKpiItem(rowPpa, dualBakt), false);
  assert.equal(canUserEditKpiItem(rowUmum, dualBakt), true);
  assert.equal(canUserEditKpiItem(rowBakt, { role: 'dual', picCodes: ['BAKT'], status: 'Nonaktif' }), false);
  assert.equal(canUserEditKpiItem(rowBakt, spiAuditor), false);
  assert.equal(canUserEditKpiItem(rowUmum, spiAuditor), false);
});

test('sinkronisasi master tabel lintas periode menjaga keutuhan data historis, override Admin PRP, serta revisi & notifikasi email', () => {
  memory.clear();
  const prpAdmin = { email: 'admin@itpln.ac.id', name: 'Superadmin PRP', role: 'superadmin_prp', status: 'Aktif' };
  const userPpa = { email: 'ppa@itpln.ac.id', name: 'Pusat Pelayanan Akademik', unit: 'PPA', role: 'kpi_only', picCodes: ['PPA'], status: 'Aktif' };

  const sections2026 = [{
    code: 'B',
    title: 'PERSPEKTIF MAHASISWA 2026',
    totalWeight: 100,
    items: [{
      id: 'B_1a',
      no: '1',
      indikator: 'Tracer Study 2026',
      calcType: 'single_target',
      targetNum: 65,
      bobot: 100,
      pics: ['PPA'],
      subrows: [{ key: 'b_1a_val', label: 'Tracer 2026' }],
    }],
  }];

  const form2026 = store.syncPeriodMasterTable(sections2026, {
    period: '2026 / 2027',
    actor: prpAdmin,
    openPeriod: true,
    lockPreviousPeriods: false,
  });
  assert.equal(form2026.period, '2026 / 2027');

  // Unit PPA mengisi dan mengirim data pada periode 2026 / 2027
  store.addUnitEvidence(form2026.id, userPpa, {
    indicatorId: 'B_1a',
    kind: 'link',
    label: 'Bukti Tracer 2026',
    url: 'https://drive.google.com/file/d/tracer-2026/view',
  });
  store.submitUnitKpi(form2026.id, userPpa, { b_1a_val: '65' }, { notes: { B_1a: 'Target 2026 tercapai 100%' } });

  // Transisi ke periode baru 2027 / 2028 dengan struktur baris baru + kunci periode sebelumnya
  const sections2027 = [{
    code: 'B',
    title: 'PERSPEKTIF MAHASISWA 2027',
    totalWeight: 100,
    items: [
      {
        id: 'B_1a',
        no: '1',
        indikator: 'Tracer Study 2027',
        calcType: 'single_target',
        targetNum: 75,
        bobot: 60,
        pics: ['PPA'],
        subrows: [{ key: 'b_1a_val', label: 'Tracer 2027' }],
      },
      {
        id: 'B_new_2027',
        no: '2',
        indikator: 'Sertifikasi Kompetensi Internasional 2027',
        calcType: 'single_target',
        targetNum: 100,
        bobot: 40,
        pics: ['PPA'],
        subrows: [{ key: 'b_cert_val', label: 'Sertifikasi 2027' }],
      },
    ],
  }];

  const form2027 = store.syncPeriodMasterTable(sections2027, {
    period: '2027 / 2028',
    actor: prpAdmin,
    openPeriod: true,
    lockPreviousPeriods: true,
  });
  assert.equal(form2027.period, '2027 / 2028');
  assert.equal(form2027.sections[0].items.length, 2);

  // Pastikan struktur & nilai historis 2026 / 2027 tetap utuh 1 baris dengan skor 100
  const historicalForm2026 = store.getFormForPeriod('2026 / 2027');
  assert.equal(historicalForm2026.id, form2026.id);
  assert.equal(historicalForm2026.sections[0].items.length, 1);
  const board2026 = store.readIntegratedKpiBoard(historicalForm2026.id);
  assert.equal(board2026.totalScore, 100);
  assert.equal(board2026.values.b_1a_val, '65');

  // Cek status periode: 2026 Terkunci (inputOpen: false), 2027 Aktif (inputOpen: true)
  const periodsStatus = store.listKpiPeriodsWithStatus();
  const p2026 = periodsStatus.find((p) => p.year === '2026');
  const p2027 = periodsStatus.find((p) => p.year === '2027');
  assert.equal(p2026?.inputOpen, false);
  assert.equal(p2027?.inputOpen, true);

  // Admin PRP melakukan Override Edit langsung pada periode 2027 / 2028
  store.saveAdminKpiOverride(form2027.id, prpAdmin, {
    values: { b_1a_val: '75', b_cert_val: '50' },
    notes: { B_1a: 'Diisi oleh Admin PRP karena mendekati tenggat waktu' },
  });
  const board2027 = store.readIntegratedKpiBoard(form2027.id);
  assert.equal(board2027.values.b_1a_val, '75');
  assert.equal(board2027.values.b_cert_val, '50');
  assert.equal(board2027.totalScore, 80);

  // Admin PRP mengirim catatan revisi per item dan per bagian -> memicu notifikasi in-app & log email
  store.saveKpiRevisionComment(form2027.id, prpAdmin, {
    scope: 'ITEM',
    targetId: 'B_new_2027',
    comment: 'Mohon lampirkan daftar nama mahasiswa penerima sertifikasi internasional.',
  });
  store.saveKpiRevisionComment(form2027.id, prpAdmin, {
    scope: 'SECTION',
    targetId: 'B',
    comment: 'Rekapitulasi Perspektif Mahasiswa perlu paraf Kepala Biro.',
  });

  const revisions = store.readKpiRevisions(form2027.id);
  assert.ok(revisions.items.B_new_2027);
  assert.ok(revisions.sections.B);

  const notifs = JSON.parse(memory.get('prp_notifications_v1') || '[]');
  const emails = JSON.parse(memory.get('prp_email_outbox_v1') || '[]');
  assert.ok(notifs.some((n) => n.kind === 'REVISION' && n.meta?.targetId === 'B_new_2027'));
  assert.ok(emails.some((e) => e.kind === 'REVISION' && e.toEmails.includes('ppa@itpln.ac.id')));
});

test('Admin PRP dapat mengedit unit sebelum & sesudah kirim, revisi per kolom/unit, serta filter tabel final terkonfirmasi', () => {
  memory.clear();
  const prpAdmin = { email: 'admin@itpln.ac.id', name: 'Superadmin PRP', role: 'superadmin_prp', status: 'Aktif' };
  const ppaUser = { email: 'ppa@itpln.ac.id', name: 'Operator PPA', unit: 'PPA', role: 'kpi_only', picCodes: ['PPA'], status: 'Aktif' };

  const multiUnitSections = [{
    code: 'A',
    title: 'PERSPEKTIF KEBERLANJUTAN & AKADEMIK',
    totalWeight: 100,
    items: [
      {
        id: 'A_bakt_1',
        no: '1',
        indikator: 'Pendapatan BAKT',
        calcType: 'single_target',
        targetNum: 100,
        bobot: 40,
        pics: ['BAKT'],
        subrows: [{ key: 'a_bakt_val', label: 'Realisasi BAKT' }],
      },
      {
        id: 'A_ppa_1',
        no: '2',
        indikator: 'Akreditasi PPA',
        calcType: 'single_target',
        targetNum: 100,
        bobot: 60,
        pics: ['PPA'],
        subrows: [{ key: 'a_ppa_val', label: 'Realisasi PPA' }],
      },
    ],
  }];

  const form = store.distributeKpiForm(multiUnitSections, { period: '2026' });

  // 1. Admin PRP mengedit unit BAKT sebelum BAKT mengirim apa pun (status EMPTY -> DRAFT + isolasi PIC BAKT)
  const draftRes = store.saveUnitKpiByAdmin(form.id, 'bakt@itpln.ac.id', prpAdmin, {
    values: { a_bakt_val: '50', a_ppa_val: '999' }, // a_ppa_val harus terfilter karena bukan PIC BAKT
    notes: { A_bakt_1: 'Diinput awal oleh Admin PRP untuk simulasi', A_ppa_1: 'Seharusnya tidak tersimpan di BAKT' },
  });
  assert.equal(draftRes.record, null);
  assert.equal(draftRes.draft?.values?.a_bakt_val, '50');
  assert.equal(draftRes.draft?.values?.a_ppa_val, undefined);
  assert.equal(draftRes.draft?.notes?.A_ppa_1, undefined);

  // Admin menambahkan bukti dukung untuk unit PPA lalu unit submit dan Admin edit + verifikasi bukti sebelum menyetujui
  const ppaEv = store.addUnitEvidenceByAdmin(form.id, 'ppa@itpln.ac.id', prpAdmin, {
    indicatorId: 'A_ppa_1',
    kind: 'link',
    label: 'SK Akreditasi Resmi',
    url: 'https://drive.google.com/file/d/sk-akreditasi/view',
  });
  store.submitUnitKpi(form.id, ppaUser, { a_ppa_val: '100' }, { notes: { A_ppa_1: 'Akreditasi unggul 100%' } });
  // Admin edit ulang nilai PPA sebelum approve dan memverifikasi bukti setelah submission
  store.saveUnitKpiByAdmin(form.id, 'ppa@itpln.ac.id', prpAdmin, {
    values: { a_ppa_val: '80' },
    notes: { A_ppa_1: 'Penyesuaian verifikasi Admin PRP' },
  });
  store.reviewUnitEvidence(form.id, 'ppa@itpln.ac.id', ppaEv.id, 'VERIFIED', 'Bukti sah dan sesuai', prpAdmin);
  store.reviewUnitKpi(form.id, 'ppa@itpln.ac.id', 'APPROVED', 'Terverifikasi final PRP', prpAdmin);

  // Cek perbedaan Papan Live (memuat draft BAKT + approved PPA) vs Tabel Final Terkonfirmasi (hanya PPA)
  const liveBoard = store.readIntegratedKpiBoard(form.id, store.readKpiWorkflow(), { confirmedOnly: false });
  assert.equal(liveBoard.values.a_bakt_val, '50');
  assert.equal(liveBoard.values.a_ppa_val, '80');

  const finalBoard = store.readIntegratedKpiBoard(form.id, store.readKpiWorkflow(), { confirmedOnly: true });
  assert.equal(finalBoard.values.a_bakt_val, undefined);
  assert.equal(finalBoard.values.a_ppa_val, '80');
  assert.equal(finalBoard.totalScore, 48); // 80% * 60 = 48

  // Admin meminta revisi spesifik kolom 'Isian Capaian' hanya untuk unit BAKT (PPA tetap APPROVED)
  store.saveUnitKpiByAdmin(form.id, 'bakt@itpln.ac.id', prpAdmin, {
    values: { a_bakt_val: '50' },
    statusTransition: 'SUBMITTED',
  });
  const revResult = store.saveKpiRevisionComment(form.id, prpAdmin, {
    scope: 'ITEM',
    targetId: 'A_bakt_1',
    targetColumn: 'Isian Capaian',
    targetEmail: 'bakt@itpln.ac.id',
    comment: 'Mohon sesuaikan angka realisasi pendapatan BAKT dengan neraca audit.',
  });
  assert.deepEqual(revResult.notifiedEmails, ['bakt@itpln.ac.id']);
  assert.equal(revResult.items.A_bakt_1.targetColumn, 'Isian Capaian');
  assert.equal(store.readUnitSubmission(form.id, 'bakt@itpln.ac.id')?.status, 'NEEDS_REVISION');
  assert.equal(store.readUnitSubmission(form.id, 'ppa@itpln.ac.id')?.status, 'APPROVED');
});

test('Admin PRP dapat meminta revisi gambar/bukti (NEEDS_REVISION + notif + email) dan mengedit bukti unit', () => {
  memory.clear();
  const prpAdmin = { email: 'admin@itpln.ac.id', name: 'Superadmin PRP', role: 'superadmin_prp', status: 'Aktif' };
  const baktUser = { email: 'bakt@itpln.ac.id', name: 'Operator BAKT', unit: 'BAKT', role: 'kpi_only', picCodes: ['BAKT'], status: 'Aktif' };

  const imgSections = [{
    code: 'A',
    title: 'PERSPEKTIF KEUANGAN',
    totalWeight: 100,
    items: [{
      id: 'A_bakt_img',
      no: '1',
      indikator: 'Bukti Realisasi BAKT',
      calcType: 'single_target',
      targetNum: 100,
      bobot: 100,
      pics: ['BAKT'],
      subrows: [{ key: 'a_bakt_real', label: 'Realisasi BAKT' }],
    }],
  }];

  const form = store.distributeKpiForm(imgSections, { period: '2026' });
  const pngBytesV1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const pngBytesV2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9QzwAEjDAGNzYAAIoaB/5tU3uLAAAAAElFTkSuQmCC';

  // Unit mengunggah bukti gambar lalu mengirim submission KPI
  store.addUnitEvidence(form.id, baktUser, {
    indicatorId: 'A_bakt_img',
    kind: 'file',
    label: 'Foto Kwitansi Awal',
    fileName: 'kwitansi-v1.png',
    mimeType: 'image/png',
    fileSize: 120,
    dataUrl: pngBytesV1,
    description: 'Foto awal dari unit',
  });
  store.submitUnitKpi(form.id, baktUser, { a_bakt_real: '90' }, { notes: { A_bakt_img: 'Siap dicek' } });
  const initialEvidence = store.readUnitEvidence(form.id, 'bakt@itpln.ac.id');
  assert.equal(initialEvidence.length, 1);
  const evId = initialEvidence[0].id;
  assert.equal(initialEvidence[0].status, 'PENDING');

  // 1. Wajib menyertakan catatan saat meminta revisi gambar/bukti
  assert.throws(() => {
    store.reviewUnitEvidence(form.id, 'bakt@itpln.ac.id', evId, 'NEEDS_REVISION', '   ', prpAdmin);
  }, /Catatan .*wajib diisi/i);

  // 2. Admin PRP meminta revisi bukti gambar -> status bukti & submission jadi NEEDS_REVISION + marker indikator + notif + email
  const revEv = store.reviewUnitEvidence(
    form.id,
    'bakt@itpln.ac.id',
    evId,
    'NEEDS_REVISION',
    'Foto kwitansi buram dan belum ada stempel resmi.',
    prpAdmin,
  );
  assert.equal(revEv.status, 'NEEDS_REVISION');
  assert.equal(revEv.note, 'Foto kwitansi buram dan belum ada stempel resmi.');
  assert.equal(store.readUnitSubmission(form.id, 'bakt@itpln.ac.id')?.status, 'NEEDS_REVISION');

  const revisionsAfterEvRev = store.readKpiRevisions(form.id);
  assert.equal(revisionsAfterEvRev.items.A_bakt_img?.targetColumn, 'Bukti / Gambar Capaian');
  assert.ok(revisionsAfterEvRev.items.A_bakt_img?.comment?.includes('Foto kwitansi buram'));

  const notifs = JSON.parse(memory.get('prp_notifications_v1') || '[]');
  const emails = JSON.parse(memory.get('prp_email_outbox_v1') || '[]');
  assert.ok(notifs.some((n) => n.kind === 'REVISION' && n.meta?.evidenceId === evId && n.meta?.status === 'NEEDS_REVISION'));
  assert.ok(emails.some((e) => e.kind === 'REVISION' && e.toEmails.includes('bakt@itpln.ac.id') && e.body.includes('Foto kwitansi buram')));

  // 3. Admin PRP mengedit langsung label, keterangan, dan mengganti file gambar bukti
  const editedFileEv = store.updateUnitEvidenceByAdmin(form.id, 'bakt@itpln.ac.id', prpAdmin, evId, {
    label: 'Foto Kwitansi Stempel Basah',
    description: 'Diganti Admin PRP dengan scan resolusi tinggi',
    kind: 'file',
    fileName: 'kwitansi-v2-resmi.png',
    mimeType: 'image/png',
    fileSize: 240,
    dataUrl: pngBytesV2,
  });
  assert.equal(editedFileEv.label, 'Foto Kwitansi Stempel Basah');
  assert.equal(editedFileEv.fileName, 'kwitansi-v2-resmi.png');
  assert.equal(editedFileEv.dataUrl, pngBytesV2);

  // Admin juga bisa mengubah bukti menjadi tautan HTTPS lalu mengembalikannya ke file gambar
  const editedLinkEv = store.updateUnitEvidenceByAdmin(form.id, 'bakt@itpln.ac.id', prpAdmin, evId, {
    label: 'Tautan Arsip Drive BAKT',
    kind: 'link',
    url: 'https://drive.google.com/file/d/kwitansi-resmi/view',
  });
  assert.equal(editedLinkEv.kind, 'link');
  assert.equal(editedLinkEv.url, 'https://drive.google.com/file/d/kwitansi-resmi/view');
  assert.equal(editedLinkEv.dataUrl, '');

  const subHistory = store.readUnitSubmission(form.id, 'bakt@itpln.ac.id')?.history || [];
  assert.ok(subHistory.some((h) => /diperbarui oleh Admin PRP/i.test(h.note || '')));
  const notifsAfterEdit = JSON.parse(memory.get('prp_notifications_v1') || '[]');
  assert.ok(notifsAfterEdit.some((n) => n.kind === 'WORKFLOW' && n.meta?.evidenceId === evId));

  // 4. Setelah Admin memverifikasi bukti tersebut, penanda revisi bukti pada indikator bersih otomatis
  const verifiedEv = store.reviewUnitEvidence(form.id, 'bakt@itpln.ac.id', evId, 'VERIFIED', 'Arsip resmi sudah valid', prpAdmin);
  assert.equal(verifiedEv.status, 'VERIFIED');
  assert.equal(store.readKpiRevisions(form.id).items.A_bakt_img, undefined);
});


test('Reject bukti otomatis membuka NEEDS_REVISION, kirim ulang mempertahankan VERIFIED, rumus lintas-unit Admin PRP akurat, dan periode kustom nonaktif mengunci input', async () => {
  const assert = (await import('node:assert/strict')).default;
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { pathToFileURL } = await import('node:url');

  const toDataModule = (relPath, replacements = {}) => {
    let code = fs.readFileSync(path.resolve(relPath), 'utf8');
    for (const [from, to] of Object.entries(replacements)) {
      code = code.replace(from, to);
    }
    return `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`;
  };
  const formulaUrl = pathToFileURL(path.resolve('src/features/kpi/formulaEngine.js')).href;
  const authUrl = pathToFileURL(path.resolve('src/features/auth/authAccounts.js')).href;
  const schemaDataUrl = toDataModule('src/features/kpi/kpiSchema.js', {
    "'./formulaEngine'": JSON.stringify(formulaUrl),
  });
  const workflowDataUrl = toDataModule('src/features/kpi/kpiWorkflowStore.js', {
    "'../auth/authAccounts'": JSON.stringify(authUrl),
    "'./kpiSchema'": JSON.stringify(schemaDataUrl),
  });
  const {
    syncPeriodMasterTable,
    addUnitEvidence,
    submitUnitKpi,
    reviewUnitEvidence,
    readUnitEvidence,
    readKpiWorkflow,
    saveUnitKpiByAdmin,
    listKpiPeriodsWithStatus,
  } = await import(workflowDataUrl);

  ['prp_kpi_distribution_v1', 'prp_periods', 'prp_kpi_config', 'prp_kpi_validation_rules', 'prp_system_config', 'prp_notifications_v1', 'prp_email_outbox_v1'].forEach((k) => {
    localStorage.setItem(k, 'null');
  });

  const adminActor = {
    email: 'prp@itpln.ac.id',
    name: 'Admin PRP',
    role: 'superadmin_prp',
    status: 'Aktif',
  };
  const unitBpti = {
    email: 'bpti@itpln.ac.id',
    name: 'BPTI',
    unit: 'Biro Pengembangan Teknologi Informasi (BPTI)',
    role: 'kpi_only',
    status: 'Aktif',
    picCodes: ['BPTI'],
  };
  const unitBkan = {
    email: 'bkan@itpln.ac.id',
    name: 'BKAN',
    unit: 'Biro Kerja Sama Akademik Nasional (BKAN)',
    role: 'kpi_only',
    status: 'Aktif',
    picCodes: ['BKAN'],
  };

  const sections = [
    {
      code: 'A',
      title: 'Bagian A',
      totalWeight: 100,
      items: [
        {
          id: 'item-bpti',
          no: 1,
          indikator: 'Indikator BPTI',
          bobot: 50,
          targetNum: 100,
          pics: ['BPTI'],
          picDisplay: 'BPTI',
          calcType: 'custom',
          formulaExpr: 'I1',
          subrows: [{ key: 'a1_bpti', label: 'Capaian BPTI', value: '' }],
        },
        {
          id: 'item-bkan',
          no: 2,
          indikator: 'Indikator BKAN Lintas Unit',
          bobot: 50,
          targetNum: 100,
          pics: ['BKAN'],
          picDisplay: 'BKAN',
          calcType: 'custom',
          formulaExpr: 'A1_I1 + I1',
          subrows: [{ key: 'a2_bkan', label: 'Capaian BKAN', value: '' }],
        },
      ],
    },
  ];

  const form = syncPeriodMasterTable(sections, { period: '2026', actor: adminActor, openPeriod: true });

  const evVerified = addUnitEvidence(form.id, unitBpti, {
    indicatorId: 'item-bpti',
    kind: 'link',
    label: 'Dokumen Bukti 1 Valid',
    url: 'https://itpln.ac.id/bukti-valid-1',
  });
  const evRejected = addUnitEvidence(form.id, unitBpti, {
    indicatorId: 'item-bpti',
    kind: 'link',
    label: 'Dokumen Bukti 2 Salah',
    url: 'https://itpln.ac.id/bukti-salah-2',
  });

  submitUnitKpi(form.id, unitBpti, { a1_bpti: '60' }, { 'item-bpti': 'Catatan awal BPTI' });

  reviewUnitEvidence(form.id, unitBpti.email, evVerified.id, 'VERIFIED', 'Bukti 1 sah', adminActor);
  reviewUnitEvidence(form.id, unitBpti.email, evRejected.id, 'REJECTED', 'Bukti 2 tidak sesuai periode', adminActor);

  const stateAfterReject = readKpiWorkflow();
  const subKeyBpti = `${form.id}:${unitBpti.email}`;
  assert.equal(stateAfterReject.submissions[subKeyBpti].status, 'NEEDS_REVISION');
  assert.ok(stateAfterReject.drafts[subKeyBpti], 'Draft unit harus disiapkan saat bukti ditolak');

  const evReplacement = addUnitEvidence(form.id, unitBpti, {
    indicatorId: 'item-bpti',
    kind: 'link',
    label: 'Dokumen Bukti 2 Perbaikan',
    url: 'https://itpln.ac.id/bukti-perbaikan-2',
  });

  submitUnitKpi(form.id, unitBpti, { a1_bpti: '60' }, { 'item-bpti': 'Kirim ulang setelah perbaikan bukti' });

  const evListAfterResubmit = readUnitEvidence(form.id, unitBpti.email);
  const afterVerified = evListAfterResubmit.find((e) => e.id === evVerified.id);
  const afterRejected = evListAfterResubmit.find((e) => e.id === evRejected.id);
  const afterReplacement = evListAfterResubmit.find((e) => e.id === evReplacement.id);

  assert.equal(afterVerified.status, 'VERIFIED', 'Bukti yang sudah VERIFIED tidak boleh di-reset ke PENDING saat kirim ulang');
  assert.equal(afterVerified.note, 'Bukti 1 sah');
  assert.equal(afterRejected.status, 'PENDING');
  assert.equal(afterReplacement.status, 'PENDING');

  // Uji perhitungan rumus lintas-unit pada saveUnitKpiByAdmin (A1_1 dari BPTI = 60, A2_1 dari BKAN = 40 -> total 100 -> skor penuh 50)
  const adminSaveResult = saveUnitKpiByAdmin(form.id, unitBkan.email, adminActor, {
    values: { a2_bkan: '40' },
    notes: { 'item-bkan': 'Diisi Admin PRP' },
    statusTransition: 'SUBMITTED',
  });
  assert.equal(adminSaveResult.totalScore, 50, 'saveUnitKpiByAdmin harus menyertakan nilai lintas-unit dari papan integrasi');

  // Uji periode kustom Periode-* dan penguncian input saat dinonaktifkan
  localStorage.setItem(
    'prp_periods',
    JSON.stringify([
      {
        id: 'Periode-1790000000',
        name: 'Periode Evaluasi Khusus 2026',
        start: '2026-01-01',
        end: '2026-12-31',
        status: 'Inactive',
        inputOpen: false,
      },
    ]),
  );

  const periodsMeta = listKpiPeriodsWithStatus();
  const customPeriodMeta = periodsMeta.find((p) => p.id === 'Periode-1790000000');
  assert.ok(customPeriodMeta, 'listKpiPeriodsWithStatus harus mengenali ID Periode-* kustom');
  assert.equal(customPeriodMeta.name, 'Periode Evaluasi Khusus 2026');
  assert.equal(customPeriodMeta.inputOpen, false);

  assert.throws(
    () => submitUnitKpi(form.id, unitBkan, { a2_bkan: '45' }),
    /Periode pengisian ditutup/,
    'inputAllowed harus memblokir submit saat periode kustom tahun terkait berstatus Inactive',
  );
});
