/** Snapshot formulir terdistribusi: draft PRP tidak mengubah submission lama. */
import { MOCK_ACCOUNTS } from '../auth/context/AuthContext';
import { createId, normalizeKpiSections, validateKpiSections, computeKpiItem, publishKpiSections } from './kpiSchema';

const KEY = 'prp_kpi_distribution_v1';
const EVENT = 'prp-kpi-workflow-updated';
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
export const readKpiWorkflow = () => ({ evidence: {}, ...read(KEY, { forms: [], submissions: {} }) });
// Read the same persisted settings as adminStore, without importing UI dependencies.
const config = () => read('prp_system_config', {});
const clone = (value) => JSON.parse(JSON.stringify(value));
const reviewer = (actor) => {
  if (actor && (actor.role !== 'superadmin_prp' || actor.status === 'Nonaktif')) throw new Error('Hanya PRP aktif dapat meninjau.');
};
const maintenance = () => { if (config().maintenanceMode) throw new Error('Sistem sedang dalam pemeliharaan.'); };
function inputAllowed(form) {
  maintenance();
  const periods = read('prp_periods', []);
  const text = String(form.period);
  const period = periods.find((p) => p.id === text || p.label === text)
    || periods.find((p) => p.status === 'Active' && /^\d{4}$/.test(text) && (p.start?.startsWith(text) || p.end?.startsWith(text) || p.label?.includes(text)));
  const now = new Date();
  if (period && (period.status !== 'Active' || period.inputOpen === false || (period.start && now < new Date(`${period.start}T00:00:00`)) || (period.end && now > new Date(`${period.end}T23:59:59.999`)))) throw new Error('Periode pengisian ditutup.');
  const deadline = period?.submissionDeadline || config().submissionDeadline;
  if (deadline && now > new Date(deadline)) throw new Error('Tenggat pengiriman telah lewat.');
}
function owner(form, user) {
  if (!user?.email || user.status === 'Nonaktif' || (user.role && user.role !== 'kpi_only') || !form?.units.some((unit) => unit.email === user.email.toLowerCase())) throw new Error('Formulir tidak ditujukan ke akun ini.');
  inputAllowed(form);
}
export const KPI_TRANSITIONS = Object.freeze({ SUBMITTED: ['APPROVED', 'NEEDS_REVISION', 'REJECTED'], NEEDS_REVISION: ['SUBMITTED'], APPROVED: ['LOCKED', 'NEEDS_REVISION'], REJECTED: ['NEEDS_REVISION'], LOCKED: ['NEEDS_REVISION'] });
function history(record, status, note, actor, evidence) {
  return [...(record?.history || []), { status, from: record?.status || 'DRAFT', at: new Date().toISOString(), note, actor: actor ? { email: actor.email, name: actor.name, role: actor.role } : null,
    snapshot: clone({ values: record?.values || {}, sectionScores: record?.sectionScores || [], totalScore: record?.totalScore ?? null, evidence: evidence || [] }) }];
}
export const readUnitEvidence = (formId, email, state = readKpiWorkflow()) => state.evidence?.[submissionKey(formId, email)] || [];
export function addUnitEvidence(formId, user, metadata) {
  const state = readKpiWorkflow();
  const form = state.forms.find((f) => f.id === formId);
  owner(form, user);
  const key = submissionKey(formId, user.email);
  if (state.submissions[key] && state.submissions[key].status !== 'NEEDS_REVISION') throw new Error('Bukti terkunci.');
  let url;
  try { url = new URL(metadata.url); } catch { throw new Error('URL bukti tidak valid.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Gunakan URL HTTPS tanpa kredensial.');
  if (!metadata.label?.trim() || !form.sections.some((s) => s.items.some((i) => i.id === metadata.indicatorId))) throw new Error('Label dan indikator bukti wajib valid.');
  const entry = { id: createId('evidence'), indicatorId: metadata.indicatorId, label: metadata.label.trim(), url: url.href, status: 'PENDING', owner: user.email.toLowerCase(), createdAt: new Date().toISOString() };
  write({ ...state, evidence: { ...state.evidence, [key]: [...readUnitEvidence(formId, user.email, state), entry] } });
  return entry;
}
export function removeUnitEvidence(formId, user, evidenceId) {
  const state = readKpiWorkflow();
  owner(state.forms.find((f) => f.id === formId), user);
  const key = submissionKey(formId, user.email);
  if (state.submissions[key] && state.submissions[key].status !== 'NEEDS_REVISION') throw new Error('Bukti terkunci.');
  write({ ...state, evidence: { ...state.evidence, [key]: readUnitEvidence(formId, user.email, state).filter((e) => e.id !== evidenceId) } });
}
export function reviewUnitEvidence(formId, email, evidenceId, status, note = '', actor) {
  maintenance(); reviewer(actor);
  const state = readKpiWorkflow();
  const key = submissionKey(formId, email);
  if (state.submissions[key]?.status !== 'SUBMITTED' || !['VERIFIED', 'REJECTED'].includes(status)) throw new Error('Bukti tidak dapat ditinjau.');
  if (status === 'REJECTED' && !note.trim()) throw new Error('Alasan penolakan bukti wajib diisi.');
  const entries = readUnitEvidence(formId, email, state);
  if (!entries.some((e) => e.id === evidenceId)) throw new Error('Bukti tidak ditemukan.');
  const next = entries.map((e) => e.id === evidenceId ? { ...e, status, note: note.trim(), reviewedAt: new Date().toISOString(), reviewedBy: actor?.email || null } : e);
  const record = state.submissions[key];
  write({ ...state, evidence: { ...state.evidence, [key]: next }, submissions: { ...state.submissions, [key]: { ...record, history: history(record, record.status, `Bukti ${evidenceId}: ${status}. ${note}`, actor, next) } } });
}
const write = (state) => {
  localStorage.setItem(KEY, JSON.stringify(state));
  const entries = read('prp_audit', []);
  const latest = Object.values(state.submissions).flatMap((record) => record.history || []).sort((a, b) => b.at.localeCompare(a.at))[0];
  const signature = latest ? `${latest.at}:${latest.status}:${latest.note}` : `forms:${state.forms.length}:evidence:${JSON.stringify(state.evidence).length}`;
  if (entries[0]?.workflowSignature !== signature) {
    localStorage.setItem('prp_audit', JSON.stringify([{ id: createId('audit'), action: 'KPI_WORKFLOW', detail: latest ? `${latest.from} → ${latest.status}: ${latest.note}` : 'Distribusi atau bukti KPI diperbarui', actor: latest?.actor?.email || 'Workflow KPI', at: new Date().toISOString(), workflowSignature: signature }, ...entries].slice(0, 500)));
  }
  window.dispatchEvent(new Event('prp-admin-updated'));
  window.dispatchEvent(new Event(EVENT));
};
export function subscribeKpiWorkflow(callback) {
  const storage = (event) => { if (!event.key || event.key === KEY) callback(); };
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', storage);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', storage); };
}
export function getKpiUnits() {
  const accounts = new Map();
  [...MOCK_ACCOUNTS, ...read('prp_users', [])].forEach((user) => accounts.set(user.email?.toLowerCase(), user));
  return [...accounts.values()].filter((user) => user.role === 'kpi_only' && user.status !== 'Nonaktif')
    .map(({ email, name, unit }) => ({ email: email.toLowerCase(), name: unit || name }));
}
export function distributeKpiForm(sections, { period = String(new Date().getFullYear()), actor } = {}) {
  maintenance(); reviewer(actor);
  const normalized = normalizeKpiSections(sections);
  if (validateKpiSections(normalized).issues.some((issue) => issue.level === 'error')) throw new Error('Perbaiki rumus/struktur sebelum mengirim.');
  const state = readKpiWorkflow();
  const units = getKpiUnits();
  if (!units.length) throw new Error('Belum ada akun unit KPI aktif.');
  const form = { id: createId('form'), version: state.forms.length + 1, period, sections: normalized, units, sentAt: new Date().toISOString() };
  write({ ...state, forms: [...state.forms, form] });
  publishKpiSections(normalized, { snapshot: true, note: `Distribusi periode ${period} (${form.id})` });
  return form;
}
export function getUnitKpiForm(email, state = readKpiWorkflow()) {
  return [...state.forms].reverse().find((form) => form.units.some((unit) => unit.email === email?.toLowerCase())) || null;
}
export const submissionKey = (formId, email) => `${formId}:${email?.toLowerCase()}`;
export function readUnitSubmission(formId, email, state = readKpiWorkflow()) {
  return state.submissions[submissionKey(formId, email)] || null;
}
export function submitUnitKpi(formId, user, values) {
  const state = readKpiWorkflow();
  const form = state.forms.find((entry) => entry.id === formId);
  owner(form, user);
  const key = submissionKey(formId, user.email);
  const previous = state.submissions[key];
  if (previous && !['NEEDS_REVISION'].includes(previous.status)) throw new Error('Submission sudah terkunci.');
  const sectionScores = form.sections.map((section) => {
    const results = section.items.map((item) => computeKpiItem(item, values, section.isPenaltySection, form.sections));
    if (results.some((result) => result.ratioPercent === null || result.parsedSubs.some((sub) => !sub.isFilled || sub.isInvalid))) {
      throw new Error('Lengkapi semua isian dan pastikan rumus dapat dihitung (pembagi tidak nol).');
    }
    return { code: section.code, title: section.title, score: results.reduce((sum, result) => sum + result.weightedScore, 0) };
  });
  const record = { formId, email: user.email.toLowerCase(), unit: user.unit || user.name, values,
    status: 'SUBMITTED', submittedAt: new Date().toISOString(), revisionNote: '', sectionScores,
    totalScore: Math.min(100, Math.max(0, sectionScores.reduce((sum, section) => sum + section.score, 0))) };
  const evidence = readUnitEvidence(formId, user.email, state).map((e) => ({ ...e, status: 'PENDING', note: '', reviewedAt: null, reviewedBy: null }));
  record.history = history(previous, 'SUBMITTED', 'Dikirim unit', user, evidence);
  record.history[record.history.length - 1].snapshot = clone({ values, sectionScores, totalScore: record.totalScore, evidence });
  write({ ...state, evidence: { ...state.evidence, [key]: evidence }, submissions: { ...state.submissions, [key]: record } });
  return record;
}
export function reviewUnitKpi(formId, email, status, note = '', actor) {
  maintenance(); reviewer(actor);
  const state = readKpiWorkflow();
  const key = submissionKey(formId, email);
  const record = state.submissions[key];
  if (!record || status === 'SUBMITTED' || !KPI_TRANSITIONS[record.status]?.includes(status)) throw new Error('Transisi status tidak valid.');
  if (['NEEDS_REVISION', 'REJECTED'].includes(status) && !note.trim()) throw new Error('Alasan wajib diisi.');
  const evidence = readUnitEvidence(formId, email, state);
  if (status === 'APPROVED' && ((config().evidenceRequired === true && !evidence.length) || evidence.some((e) => e.status !== 'VERIFIED'))) throw new Error('Persetujuan memerlukan seluruh bukti terverifikasi dan minimal satu bukti bila diwajibkan.');
  const next = { ...record, status, revisionNote: note.trim(), reviewedAt: new Date().toISOString(), history: history(record, status, note.trim(), actor, evidence) };
  write({ ...state, submissions: { ...state.submissions, [key]: next } });
  return next;
}