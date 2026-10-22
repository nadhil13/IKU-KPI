import { readSystemConfig, writeAudit } from '../internal/adminStore';

const KEY = 'prp_iku_submissions_v1';
const EVENT = 'prp-iku-updated';
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const clone = (value) => JSON.parse(JSON.stringify(value));
export const IKU_INDICATORS = Array.from({ length: 8 }, (_, i) => ({ id: `iku-${i + 1}`, label: `Indikator ${i + 1}` }));
export const emptyIkuValues = () => IKU_INDICATORS.map(({ id }) => ({ id, actual: '', target: '', notes: '', evidence: '', verification: 'PENDING' }));
export const ikuPercentage = (row) => row.actual !== '' && row.target !== '' && Number.isFinite(Number(row.actual)) && Number.isFinite(Number(row.target)) && Number(row.target) > 0 ? Number(row.actual) / Number(row.target) * 100 : null;
export function getIkuPeriods() {
  const periods = read('prp_periods', []);
  return Array.isArray(periods) && periods.length ? periods : [{ id: String(new Date().getFullYear()), label: String(new Date().getFullYear()), status: 'Active', inputOpen: true }];
}
function authorize(actor, role) {
  if (!actor?.email || !actor?.role || actor.status === 'Nonaktif' || !role.includes(actor.role)) throw new Error('Akses IKU tidak diizinkan.');
}
export function listIkuSubmissions(actor) {
  authorize(actor, ['iku_only', 'superadmin_prp']);
  const records = read(KEY, []);
  return records.filter((r) => actor.role === 'superadmin_prp' || r.owner === actor.email.toLowerCase());
}
function available() {
  if (readSystemConfig().maintenanceMode) throw new Error('Sistem dalam pemeliharaan; perubahan dinonaktifkan.');
}
export function ikuInputIssue(periodId) {
  try {
    available();
    const period = getIkuPeriods().find((p) => p.id === periodId);
    if (!period || period.status !== 'Active' || period.inputOpen === false) throw new Error('Periode pengisian ditutup atau tidak tersedia.');
    const now = Date.now();
    for (const [value, end, label] of [[period.start, false, 'Periode belum dimulai.'], [period.end, true, 'Periode telah berakhir.'], [period.submissionDeadline, true, 'Tenggat periode telah lewat.'], [readSystemConfig().submissionDeadline, true, 'Tenggat sistem telah lewat.']]) {
      if (!value) continue;
      const time = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${end ? '23:59:59.999' : '00:00:00'}` : value).getTime();
      if (!Number.isFinite(time)) throw new Error('Konfigurasi tanggal tidak valid.');
      if (end ? now > time : now < time) throw new Error(label);
    }
    return '';
  } catch (error) { return error.message; }
}
function persist(records, next, actor, action, reason) {
  const at = new Date().toISOString();
  const previous = records.find((r) => r.id === next.id);
  next.updatedAt = at;
  next.history = [...(previous?.history || []), { action, from: previous?.status || null, status: next.status, reason, at, actor: { email: actor.email, name: actor.name, role: actor.role }, snapshot: clone({ period: next.period, owner: next.owner, unit: next.unit, status: next.status, values: next.values }) }];
  writeAudit(`IKU_${action}`, `${next.id}: ${reason}`, actor.email);
  localStorage.setItem(KEY, JSON.stringify([...records.filter((r) => r.id !== next.id), next]));
  window.dispatchEvent(new Event(EVENT));
  return next;
}
function normalize(values, submit) {
  if (!Array.isArray(values) || values.length !== 8) throw new Error('Delapan indikator wajib tersedia.');
  return IKU_INDICATORS.map(({ id }) => {
    const row = values.find((v) => v.id === id);
    if (!row) throw new Error('Indikator tidak valid.');
    const { actual, target } = row;
    if ((actual !== '' && (!Number.isFinite(Number(actual)) || Number(actual) < 0)) || (target !== '' && (!Number.isFinite(Number(target)) || Number(target) <= 0))) throw new Error('Aktual harus ≥ 0 dan target harus > 0.');
    const evidence = String(row.evidence || '').trim();
    if (evidence) {
      let url;
      try { url = new URL(evidence); } catch { throw new Error('URL bukti tidak valid.'); }
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Bukti harus berupa URL HTTPS tanpa kredensial.');
    }
    if (submit && (actual === '' || target === '' || (readSystemConfig().evidenceRequired !== false && !evidence))) throw new Error('Lengkapi aktual, target, dan bukti yang diwajibkan pada setiap indikator.');
    return { id, actual, target, notes: String(row.notes || ''), evidence, verification: 'PENDING' };
  });
}
export function saveIkuSubmission(actor, period, values, submit = false) {
  authorize(actor, ['iku_only']);
  const issue = ikuInputIssue(period);
  if (issue) throw new Error(issue);
  const records = read(KEY, []);
  const owner = actor.email.toLowerCase();
  const previous = records.find((r) => r.owner === owner && r.period === period);
  if (previous && !['DRAFT', 'NEEDS_REVISION'].includes(previous.status)) throw new Error('Submission terkunci; minta PRP membuka revisi.');
  const next = { ...previous, id: previous?.id || `iku-${crypto.randomUUID()}`, owner, unit: actor.unit || actor.name || owner, period, values: normalize(values, submit), status: submit ? 'SUBMITTED' : previous?.status || 'DRAFT' };
  return persist(records, next, actor, submit ? 'SUBMIT' : 'SAVE_DRAFT', submit ? 'Dikirim oleh pemilik.' : 'Draft disimpan oleh pemilik.');
}
export const IKU_TRANSITIONS = { SUBMITTED: ['APPROVED', 'NEEDS_REVISION', 'REJECTED'], APPROVED: ['LOCKED', 'NEEDS_REVISION'], REJECTED: ['NEEDS_REVISION'], LOCKED: ['NEEDS_REVISION'] };
export function reviewIkuSubmission(actor, id, status, reason) {
  authorize(actor, ['superadmin_prp']); available();
  if (!reason?.trim()) throw new Error('Alasan keputusan wajib diisi.');
  const records = read(KEY, []);
  const record = records.find((r) => r.id === id);
  if (!record || !IKU_TRANSITIONS[record.status]?.includes(status)) throw new Error('Transisi status tidak diizinkan.');
  if (status === 'APPROVED' && record.values.some((r) => (readSystemConfig().evidenceRequired !== false && !r.evidence) || (r.evidence && r.verification !== 'VERIFIED'))) throw new Error('Semua bukti harus terverifikasi dan bukti wajib harus lengkap.');
  return persist(records, { ...record, status }, actor, status, reason.trim());
}
export function verifyIkuEvidence(actor, id, indicatorId, status, reason) {
  authorize(actor, ['superadmin_prp']); available();
  if (!reason?.trim()) throw new Error('Catatan verifikasi wajib diisi.');
  const records = read(KEY, []);
  const record = records.find((r) => r.id === id);
  if (record?.status !== 'SUBMITTED' || !['VERIFIED', 'REJECTED'].includes(status) || !record.values.some((r) => r.id === indicatorId && r.evidence)) throw new Error('Bukti tidak dapat ditinjau.');
  return persist(records, { ...record, values: record.values.map((r) => r.id === indicatorId ? { ...r, verification: status, verificationNote: reason.trim(), verifiedBy: actor.email, verifiedAt: new Date().toISOString() } : r) }, actor, `EVIDENCE_${status}`, `${indicatorId}: ${reason.trim()}`);
}
export function subscribeIku(callback) {
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', callback);
  window.addEventListener('focus', callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', callback); window.removeEventListener('focus', callback); };
}