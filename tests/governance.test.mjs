import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Load the real browser stores without a bundler, as in kpi.test.mjs.
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const adminUrl = moduleUrl(await readFile(new URL('../src/features/internal/adminStore.js', import.meta.url), 'utf8'));
const admin = await import(adminUrl);
const ikuSource = (await readFile(new URL('../src/features/iku/ikuWorkflowStore.js', import.meta.url), 'utf8'))
  .replace("'../internal/adminStore'", JSON.stringify(adminUrl));
const iku = await import(moduleUrl(ikuSource));
const memory = new Map();
const owner = { email: 'unit@test.id', role: 'iku_only', unit: 'Unit A' };
const reviewer = { email: 'prp@test.id', role: 'superadmin_prp' };
const period = 'test-period';
const values = () => iku.emptyIkuValues().map((row) => ({ ...row, actual: '50', target: '25', evidence: 'https://example.org/evidence' }));
const setPeriod = (patch = {}) => localStorage.setItem('prp_periods', JSON.stringify([{ id: period, status: 'Active', inputOpen: true, ...patch }]));
const submit = () => iku.saveIkuSubmission(owner, period, values(), true);

beforeEach(() => {
  memory.clear();
  globalThis.localStorage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) };
  globalThis.window = new EventTarget();
  setPeriod();
});

test('organization persists independently and writes actor-attributed audit/events', () => {
  assert.deepEqual(admin.readOrganization(), { units: [], faculties: [], bureaus: [], teams: [] });
  let events = 0;
  window.addEventListener('prp-admin-updated', () => events++);
  const organization = { units: ['Unit A'], faculties: ['Faculty A'], bureaus: ['Bureau A'], teams: ['Team A'] };
  assert.deepEqual(admin.saveOrganization(organization, reviewer.email), organization);
  organization.units.push('Not saved');
  assert.deepEqual(admin.readOrganization().units, ['Unit A']);
  const [entry] = admin.readAudit();
  assert.equal(entry.action, 'STRUKTUR_ORGANISASI');
  assert.equal(entry.actor, reviewer.email);
  assert.ok(Number.isFinite(Date.parse(entry.at)));
  assert.equal(events, 2);
  for (let i = 0; i < 501; i++) admin.writeAudit('TEST', String(i), owner.email);
  assert.equal(admin.readAudit().length, 500);
  assert.equal(admin.readAudit()[0].detail, '500');
});

test('settings merge, persist metadata, clamp password length, and tolerate malformed storage', () => {
  assert.equal(admin.readSystemConfig().evidenceRequired, true);
  admin.saveSystemConfig({ institutionName: 'Test institution', minimumPasswordLength: 100 }, reviewer.email);
  const config = admin.saveSystemConfig({ evidenceRequired: false }, reviewer.email);
  assert.equal(config.institutionName, 'Test institution');
  assert.equal(config.updatedBy, reviewer.email);
  assert.ok(Number.isFinite(Date.parse(config.updatedAt)));
  assert.deepEqual(admin.readSystemConfig(), config);
  assert.equal(admin.minimumPasswordLength(), 64);
  admin.saveSystemConfig({ minimumPasswordLength: 2 });
  assert.equal(admin.minimumPasswordLength(), 8);
  assert.equal(admin.readAudit()[0].action, 'KONFIGURASI_SISTEM');
  for (const key of ['prp_system_config', 'prp_organization', 'prp_audit']) localStorage.setItem(key, '{');
  assert.equal(admin.readSystemConfig().maintenanceMode, false);
  assert.deepEqual(admin.readOrganization().units, []);
  assert.deepEqual(admin.readAudit(), []);
});

test('IKU lifecycle preserves snapshots, verifies evidence, locks, revises and rejects', () => {
  const input = values();
  assert.equal(iku.ikuPercentage(input[0]), 200);
  assert.equal(iku.ikuPercentage({ actual: '', target: '25' }), null);
  let record = iku.saveIkuSubmission(owner, period, input);
  assert.equal(record.status, 'DRAFT');
  input[0].actual = '99';
  record = submit();
  assert.equal(record.history[0].snapshot.values[0].actual, '50');
  assert.equal(record.history[0].snapshot.status, 'DRAFT');
  assert.throws(() => iku.saveIkuSubmission(owner, period, values()));
  assert.throws(() => iku.reviewIkuSubmission(reviewer, record.id, 'APPROVED', 'Review'));
  iku.verifyIkuEvidence(reviewer, record.id, 'iku-1', 'REJECTED', 'Unreadable');
  assert.throws(() => iku.reviewIkuSubmission(reviewer, record.id, 'APPROVED', 'Review'));
  for (const row of values()) record = iku.verifyIkuEvidence(reviewer, record.id, row.id, 'VERIFIED', ' Inspected ');
  assert.equal(record.values[0].verificationNote, 'Inspected');
  assert.equal(record.values[0].verifiedBy, reviewer.email);
  record = iku.reviewIkuSubmission(reviewer, record.id, 'APPROVED', 'Approved');
  record = iku.reviewIkuSubmission(reviewer, record.id, 'LOCKED', 'Final');
  assert.throws(() => iku.saveIkuSubmission(owner, period, values(), true));
  record = iku.reviewIkuSubmission(reviewer, record.id, 'NEEDS_REVISION', 'Revise');
  record = submit();
  assert.ok(record.values.every((row) => row.verification === 'PENDING'));
  assert.equal(record.history[0].snapshot.status, 'DRAFT');
  record = iku.reviewIkuSubmission(reviewer, record.id, 'REJECTED', 'Rejected');
  assert.equal(iku.reviewIkuSubmission(reviewer, record.id, 'NEEDS_REVISION', 'Retry').status, 'NEEDS_REVISION');
  assert.ok(admin.readAudit().some((entry) => entry.action === 'IKU_LOCKED' && entry.actor === reviewer.email));
});

test('IKU enforces owner isolation and role authorization', () => {
  const record = submit();
  const other = { ...owner, email: 'other@test.id' };
  assert.equal(iku.listIkuSubmissions(other).length, 0);
  assert.equal(iku.listIkuSubmissions({ ...owner, email: owner.email.toUpperCase() })[0].id, record.id);
  assert.equal(iku.listIkuSubmissions(reviewer).length, 1);
  assert.notEqual(iku.saveIkuSubmission(other, period, values()).id, record.id);
  for (const actor of [undefined, reviewer, { ...owner, status: 'Nonaktif' }, { ...owner, role: 'kpi_only' }]) {
    assert.throws(() => iku.saveIkuSubmission(actor, period, values()));
  }
  assert.throws(() => iku.listIkuSubmissions(undefined));
  assert.throws(() => iku.reviewIkuSubmission(owner, record.id, 'REJECTED', 'No'));
  assert.throws(() => iku.verifyIkuEvidence(owner, record.id, 'iku-1', 'VERIFIED', 'No'));
});

test('IKU rejects invalid transitions, evidence decisions and incomplete or unsafe inputs', () => {
  const draft = iku.saveIkuSubmission(owner, period, iku.emptyIkuValues());
  assert.throws(() => iku.reviewIkuSubmission(reviewer, draft.id, 'APPROVED', 'No'));
  assert.throws(() => iku.verifyIkuEvidence(reviewer, draft.id, 'iku-1', 'VERIFIED', 'No'));
  assert.throws(() => iku.saveIkuSubmission(owner, period, iku.emptyIkuValues(), true));
  assert.throws(() => iku.saveIkuSubmission(owner, period, values().slice(1)));
  for (const patch of [{ id: 'unknown' }, { actual: '-1' }, { target: '0' }, { actual: 'NaN' }, { evidence: 'http://example.org' }, { evidence: 'https://user:password@example.org' }, { evidence: 'not a URL' }, { evidence: '' }]) {
    const rows = values();
    Object.assign(rows[0], patch);
    assert.throws(() => iku.saveIkuSubmission(owner, period, rows, true));
  }
  const record = submit();
  for (const status of ['DRAFT', 'LOCKED', 'UNKNOWN']) assert.throws(() => iku.reviewIkuSubmission(reviewer, record.id, status, 'No'));
  assert.throws(() => iku.reviewIkuSubmission(reviewer, record.id, 'REJECTED', ' '));
  assert.throws(() => iku.reviewIkuSubmission(reviewer, 'missing', 'REJECTED', 'No'));
  assert.throws(() => iku.verifyIkuEvidence(reviewer, record.id, 'iku-1', 'VERIFIED', ' '));
  assert.throws(() => iku.verifyIkuEvidence(reviewer, record.id, 'missing', 'VERIFIED', 'No'));
  assert.throws(() => iku.verifyIkuEvidence(reviewer, record.id, 'iku-1', 'PENDING', 'No'));
});

test('IKU honors optional evidence, deadlines, period windows and maintenance', () => {
  admin.saveSystemConfig({ evidenceRequired: false });
  const rows = values().map((row) => ({ ...row, evidence: '' }));
  const record = iku.saveIkuSubmission(owner, period, rows, true);
  assert.equal(iku.reviewIkuSubmission(reviewer, record.id, 'APPROVED', 'No evidence required').status, 'APPROVED');
  for (const patch of [{ inputOpen: false }, { status: 'Closed' }, { start: '2999-01-01' }, { end: '2000-01-01' }, { submissionDeadline: '2000-01-01' }, { end: 'invalid-date' }]) {
    setPeriod(patch);
    assert.notEqual(iku.ikuInputIssue(period), '');
    assert.throws(() => iku.saveIkuSubmission({ ...owner, email: 'new@test.id' }, period, rows));
  }
  setPeriod();
  assert.notEqual(iku.ikuInputIssue('missing'), '');
  admin.saveSystemConfig({ submissionDeadline: '2000-01-01' });
  assert.match(iku.ikuInputIssue(period), /Tenggat sistem/);
  admin.saveSystemConfig({ submissionDeadline: '', maintenanceMode: true });
  assert.throws(() => iku.saveIkuSubmission(owner, period, rows));
  assert.throws(() => iku.reviewIkuSubmission(reviewer, record.id, 'LOCKED', 'Final'));
  assert.throws(() => iku.verifyIkuEvidence(reviewer, record.id, 'iku-1', 'VERIFIED', 'Check'));
  admin.saveSystemConfig({ maintenanceMode: false });
  assert.equal(iku.ikuInputIssue(period), '');
});

test('IKU subscriptions notify and unsubscribe from workflow and browser events', () => {
  let events = 0;
  const unsubscribe = iku.subscribeIku(() => events++);
  iku.saveIkuSubmission(owner, period, values());
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('focus'));
  assert.equal(events, 3);
  unsubscribe();
  iku.saveIkuSubmission(owner, period, values());
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('focus'));
  assert.equal(events, 3);
});