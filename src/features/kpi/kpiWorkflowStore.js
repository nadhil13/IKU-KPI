/** Snapshot formulir terdistribusi: draft PRP tidak mengubah submission lama. */
import { MOCK_ACCOUNTS } from '../auth/context/AuthContext';
import { createId, normalizeKpiSections, validateKpiSections, computeKpiItem, publishKpiSections } from './kpiSchema';

const KEY = 'prp_kpi_distribution_v1';
const EVENT = 'prp-kpi-workflow-updated';
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
export const readKpiWorkflow = () => read(KEY, { forms: [], submissions: {} });
const write = (state) => {
  localStorage.setItem(KEY, JSON.stringify(state));
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
export function distributeKpiForm(sections, { period = String(new Date().getFullYear()) } = {}) {
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
  if (!form?.units.some((unit) => unit.email === user?.email?.toLowerCase())) throw new Error('Formulir tidak ditujukan ke akun ini.');
  const key = submissionKey(formId, user.email);
  const previous = state.submissions[key];
  if (previous && !['NEEDS_REVISION'].includes(previous.status)) throw new Error('Submission sudah terkunci.');
  const sectionScores = form.sections.map((section) => {
    const results = section.items.map((item) => computeKpiItem(item, values, section.isPenaltySection));
    if (results.some((result) => result.ratioPercent === null || result.parsedSubs.some((sub) => !sub.isFilled || sub.isInvalid))) {
      throw new Error('Lengkapi semua isian dan pastikan rumus dapat dihitung (pembagi tidak nol).');
    }
    return { code: section.code, title: section.title, score: results.reduce((sum, result) => sum + result.weightedScore, 0) };
  });
  const record = { formId, email: user.email.toLowerCase(), unit: user.unit || user.name, values,
    status: 'SUBMITTED', submittedAt: new Date().toISOString(), revisionNote: '', sectionScores,
    totalScore: Math.min(100, Math.max(0, sectionScores.reduce((sum, section) => sum + section.score, 0))) };
  write({ ...state, submissions: { ...state.submissions, [key]: record } });
  return record;
}
export function reviewUnitKpi(formId, email, status, note = '') {
  const state = readKpiWorkflow();
  const key = submissionKey(formId, email);
  const record = state.submissions[key];
  if (!record || !['APPROVED', 'NEEDS_REVISION'].includes(status)) throw new Error('Submission tidak valid.');
  write({ ...state, submissions: { ...state.submissions, [key]: { ...record, status, revisionNote: note, reviewedAt: new Date().toISOString() } } });
}