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
  .replace("import { MOCK_ACCOUNTS } from '../auth/context/AuthContext';", `const MOCK_ACCOUNTS = [
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
});