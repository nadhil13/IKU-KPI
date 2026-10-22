import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateKpiFormula, validateKpiFormula } from '../src/features/kpi/formulaEngine.js';

// Muat modul aplikasi tanpa bundler; mock hanya akun/auth dan API browser.
const engineUrl = new URL('../src/features/kpi/formulaEngine.js', import.meta.url).href;
const schemaSource = (await readFile(new URL('../src/features/kpi/kpiSchema.js', import.meta.url), 'utf8'))
  .replace("'./formulaEngine'", JSON.stringify(engineUrl));
const schemaUrl = `data:text/javascript;base64,${Buffer.from(schemaSource).toString('base64')}`;
const { computeKpiItem, buildKpiCellDirectory, validateKpiSections } = await import(schemaUrl);

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
    {email:'one@test.id',name:'Satu',role:'kpi_only'}, {email:'two@test.id',name:'Dua',role:'kpi_only'}];`)
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