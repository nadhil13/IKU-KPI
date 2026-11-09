/** Snapshot formulir KPI terdistribusi, pembatasan hak input PIC, bukti per baris, dan papan integrasi terpusat. */
import { MOCK_ACCOUNTS } from '../auth/context/AuthContext';
import {
  createId,
  normalizeKpiSections,
  validateKpiSections,
  computeKpiItem,
  publishKpiSections,
  canUserEditKpiItem,
  getUserPicCodes,
  normalizePicCodes,
  readKpiValidationRules,
} from './kpiSchema';

const KEY = 'prp_kpi_distribution_v1';
const EVENT = 'prp-kpi-workflow-updated';
export const MAX_EVIDENCE_FILE_BYTES = Math.round(2.5 * 1024 * 1024);
export const ALLOWED_EVIDENCE_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const read = (key, fallback) => {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

export const readKpiWorkflow = () => ({
  forms: [],
  submissions: {},
  evidence: {},
  drafts: {},
  ...read(KEY, { forms: [], submissions: {}, evidence: {}, drafts: {} }),
});

const config = () => read('prp_system_config', {});
const clone = (value) => JSON.parse(JSON.stringify(value));

const reviewer = (actor) => {
  if (actor && (actor.role !== 'superadmin_prp' || actor.status === 'Nonaktif')) {
    throw new Error('Hanya PRP aktif dapat meninjau.');
  }
};

const maintenance = () => {
  if (config().maintenanceMode) throw new Error('Sistem sedang dalam pemeliharaan.');
};

function inputAllowed(form) {
  maintenance();
  const periods = read('prp_periods', []);
  const text = String(form.period);
  const period = periods.find((p) => p.id === text || p.label === text)
    || periods.find((p) => p.status === 'Active' && /^\d{4}$/.test(text) && (p.start?.startsWith(text) || p.end?.startsWith(text) || p.label?.includes(text)));
  const now = new Date();
  if (period && (period.status !== 'Active' || period.inputOpen === false || (period.start && now < new Date(`${period.start}T00:00:00`)) || (period.end && now > new Date(`${period.end}T23:59:59.999`)))) {
    throw new Error('Periode pengisian ditutup.');
  }
  const deadline = period?.submissionDeadline || config().submissionDeadline;
  if (deadline && now > new Date(deadline)) throw new Error('Tenggat pengiriman telah lewat.');
}

function owner(form, user) {
  const normalizedEmail = user?.email?.toLowerCase();
  const isRegisteredUnit = Boolean(normalizedEmail) && (
    form?.units?.some((unit) => unit.email === normalizedEmail)
    || getKpiUnits().some((unit) => unit.email === normalizedEmail)
  );
  if (!normalizedEmail || user.status === 'Nonaktif' || (user.role && user.role !== 'kpi_only') || !form || !isRegisteredUnit) {
    throw new Error('Formulir tidak ditujukan ke akun ini.');
  }
  inputAllowed(form);
}

export const KPI_TRANSITIONS = Object.freeze({
  SUBMITTED: ['APPROVED', 'NEEDS_REVISION', 'REJECTED'],
  NEEDS_REVISION: ['SUBMITTED'],
  APPROVED: ['LOCKED', 'NEEDS_REVISION'],
  REJECTED: ['NEEDS_REVISION'],
  LOCKED: ['NEEDS_REVISION'],
});

function history(record, status, note, actor, evidence) {
  return [
    ...(record?.history || []),
    {
      status,
      from: record?.status || 'DRAFT',
      at: new Date().toISOString(),
      note,
      actor: actor ? { email: actor.email, name: actor.name, role: actor.role } : null,
      snapshot: clone({
        values: record?.values || {},
        notes: record?.notes || {},
        sectionScores: record?.sectionScores || [],
        totalScore: record?.totalScore ?? null,
        evidence: evidence || [],
      }),
    },
  ];
}

export const submissionKey = (formId, email) => `${formId}:${email?.toLowerCase()}`;

export const readUnitEvidence = (formId, email, state = readKpiWorkflow()) => state.evidence?.[submissionKey(formId, email)] || [];

export const readUnitDraft = (formId, email, state = readKpiWorkflow()) => state.drafts?.[submissionKey(formId, email)] || null;

export function getEditableItemsForUser(form, user) {
  if (!form?.sections || !user) return [];
  const entries = [];
  form.sections.forEach((section) => {
    (section.items || []).forEach((item) => {
      if (canUserEditKpiItem(item, user)) {
        entries.push({ section, item });
      }
    });
  });
  return entries;
}

export function addUnitEvidence(formId, user, metadata) {
  const state = readKpiWorkflow();
  const form = state.forms.find((f) => f.id === formId);
  owner(form, user);
  const key = submissionKey(formId, user.email);
  if (state.submissions[key] && state.submissions[key].status !== 'NEEDS_REVISION') {
    throw new Error('Bukti terkunci.');
  }

  const targetItem = form.sections.flatMap((s) => s.items || []).find((i) => i.id === metadata?.indicatorId);
  if (!metadata?.label?.trim() || !targetItem) {
    throw new Error('Label dan indikator bukti wajib valid.');
  }
  if (!canUserEditKpiItem(targetItem, user)) {
    throw new Error('Akun ini tidak memiliki hak input bukti pada indikator milik PIC lain.');
  }

  const isFileUpload = metadata.kind === 'file' || Boolean(metadata.dataUrl);
  let entry;

  if (isFileUpload) {
    const fileName = String(metadata.fileName || '').trim();
    const mimeType = String(metadata.mimeType || '').trim().toLowerCase();
    const dataUrl = String(metadata.dataUrl || '');
    const fileSize = Number(metadata.fileSize) || Math.round((dataUrl.length * 3) / 4);

    if (!fileName || !dataUrl) {
      throw new Error('Berkas bukti wajib dipilih.');
    }
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(mimeType) || !/^data:(application\/pdf|image\/(png|jpe?g|webp));base64,/i.test(dataUrl)) {
      throw new Error('Format berkas wajib berupa PDF atau gambar (PNG, JPG, WEBP).');
    }
    if (fileSize <= 0 || fileSize > MAX_EVIDENCE_FILE_BYTES) {
      throw new Error('Ukuran berkas maksimal 2,5 MB. Gunakan tautan Google Drive untuk dokumen berukuran besar.');
    }

    entry = {
      id: createId('evidence'),
      indicatorId: targetItem.id,
      kind: 'file',
      label: metadata.label.trim(),
      url: '',
      fileName,
      mimeType,
      fileSize,
      dataUrl,
      description: String(metadata.description || '').trim(),
      status: 'PENDING',
      owner: user.email.toLowerCase(),
      ownerUnit: user.unit || user.name || user.email,
      picCodes: getUserPicCodes(user),
      createdAt: new Date().toISOString(),
    };
  } else {
    let url;
    try {
      url = new URL(metadata.url);
    } catch {
      throw new Error('URL bukti tidak valid.');
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('Gunakan URL HTTPS tanpa kredensial.');
    }

    entry = {
      id: createId('evidence'),
      indicatorId: targetItem.id,
      kind: 'link',
      label: metadata.label.trim(),
      url: url.href,
      fileName: '',
      mimeType: '',
      fileSize: 0,
      dataUrl: '',
      description: String(metadata.description || '').trim(),
      status: 'PENDING',
      owner: user.email.toLowerCase(),
      ownerUnit: user.unit || user.name || user.email,
      picCodes: getUserPicCodes(user),
      createdAt: new Date().toISOString(),
    };
  }

  write({
    ...state,
    evidence: {
      ...state.evidence,
      [key]: [...readUnitEvidence(formId, user.email, state), entry],
    },
  });
  return entry;
}

export function removeUnitEvidence(formId, user, evidenceId) {
  const state = readKpiWorkflow();
  const form = state.forms.find((f) => f.id === formId);
  owner(form, user);
  const key = submissionKey(formId, user.email);
  if (state.submissions[key] && state.submissions[key].status !== 'NEEDS_REVISION') {
    throw new Error('Bukti terkunci.');
  }
  const existing = readUnitEvidence(formId, user.email, state);
  const target = existing.find((e) => e.id === evidenceId);
  if (target) {
    const item = form.sections.flatMap((s) => s.items || []).find((i) => i.id === target.indicatorId);
    if (item && !canUserEditKpiItem(item, user)) {
      throw new Error('Akun ini tidak memiliki hak menghapus bukti pada indikator milik PIC lain.');
    }
  }
  write({
    ...state,
    evidence: {
      ...state.evidence,
      [key]: existing.filter((e) => e.id !== evidenceId),
    },
  });
}

export function reviewUnitEvidence(formId, email, evidenceId, status, note = '', actor) {
  maintenance();
  reviewer(actor);
  const state = readKpiWorkflow();
  const key = submissionKey(formId, email);
  if (state.submissions[key]?.status !== 'SUBMITTED' || !['VERIFIED', 'REJECTED'].includes(status)) {
    throw new Error('Bukti tidak dapat ditinjau.');
  }
  if (status === 'REJECTED' && !note.trim()) {
    throw new Error('Alasan penolakan bukti wajib diisi.');
  }
  const entries = readUnitEvidence(formId, email, state);
  if (!entries.some((e) => e.id === evidenceId)) {
    throw new Error('Bukti tidak ditemukan.');
  }
  const next = entries.map((e) => (e.id === evidenceId
    ? { ...e, status, note: note.trim(), reviewedAt: new Date().toISOString(), reviewedBy: actor?.email || null }
    : e));
  const record = state.submissions[key];
  write({
    ...state,
    evidence: { ...state.evidence, [key]: next },
    submissions: {
      ...state.submissions,
      [key]: {
        ...record,
        history: history(record, record.status, `Bukti ${evidenceId}: ${status}. ${note.trim()}`.trim(), actor, next),
      },
    },
  });
}

const write = (state, options = {}) => {
  localStorage.setItem(KEY, JSON.stringify(state));
  if (!options.skipAudit) {
    const entries = read('prp_audit', []);
    const latest = Object.values(state.submissions || {})
      .flatMap((record) => record.history || [])
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const signature = latest
      ? `${latest.at}:${latest.status}:${latest.note}`
      : `forms:${state.forms.length}:evidence:${Object.values(state.evidence || {}).reduce((sum, list) => sum + (list?.length || 0), 0)}:drafts:${Object.keys(state.drafts || {}).length}`;
    if (entries[0]?.workflowSignature !== signature) {
      localStorage.setItem(
        'prp_audit',
        JSON.stringify([
          {
            id: createId('audit'),
            action: 'KPI_WORKFLOW',
            detail: latest ? `${latest.from} -> ${latest.status}: ${latest.note}` : 'Distribusi, draf, atau bukti KPI diperbarui',
            actor: latest?.actor?.email || 'Workflow KPI',
            at: new Date().toISOString(),
            workflowSignature: signature,
          },
          ...entries,
        ].slice(0, 500)),
      );
    }
  }
  if (typeof window !== 'undefined') {
    if (!options.skipAdminEvent) {
      window.dispatchEvent(new Event('prp-admin-updated'));
    }
    if (!options.skipWorkflowEvent) {
      window.dispatchEvent(new Event(EVENT));
    }
  }
};

export function subscribeKpiWorkflow(callback) {
  const storage = (event) => {
    if (!event.key || event.key === KEY) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', storage);
  };
}

export function getKpiUnits() {
  const accounts = new Map();
  [...MOCK_ACCOUNTS, ...read('prp_users', [])].forEach((user) => {
    if (user?.email) accounts.set(user.email.toLowerCase(), user);
  });
  return [...accounts.values()]
    .filter((user) => user.role === 'kpi_only' && user.status !== 'Nonaktif')
    .map((user) => ({
      email: user.email.toLowerCase(),
      name: user.unit || user.name,
      picCodes: getUserPicCodes(user),
    }));
}

export function syncActiveKpiFormUnits(options = {}) {
  const state = readKpiWorkflow();
  if (!state.forms.length) return null;
  const units = getKpiUnits();
  if (!units.length) return state.forms[state.forms.length - 1];
  const lastIdx = state.forms.length - 1;
  const latestForm = state.forms[lastIdx];
  const existingMap = new Map((latestForm.units || []).map((u) => [u.email.toLowerCase(), u]));
  let changed = false;
  units.forEach((unit) => {
    const prev = existingMap.get(unit.email);
    if (!prev || JSON.stringify(prev.picCodes || []) !== JSON.stringify(unit.picCodes || [])) {
      existingMap.set(unit.email, unit);
      changed = true;
    }
  });
  if (!changed) return latestForm;
  const updatedForm = { ...latestForm, units: [...existingMap.values()] };
  const nextForms = state.forms.map((f, idx) => (idx === lastIdx ? updatedForm : f));
  write(
    { ...state, forms: nextForms },
    { skipWorkflowEvent: Boolean(options.silent), skipAdminEvent: Boolean(options.silent), skipAudit: Boolean(options.silent) },
  );
  return updatedForm;
}

export function ensureDefaultKpiDistribution(defaultSections, period = String(new Date().getFullYear()), options = {}) {
  const writeOpts = {
    skipWorkflowEvent: Boolean(options.silent),
    skipAdminEvent: Boolean(options.silent),
    skipAudit: Boolean(options.silent),
  };
  const state = readKpiWorkflow();
  const defaultPicById = new Map(
    (defaultSections || []).flatMap((sec) => (sec.items || []).map((item) => [item.id, item])),
  );
  if (state.forms.length > 0) {
    const synced = syncActiveKpiFormUnits(options) || state.forms[state.forms.length - 1];
    if (!synced || defaultPicById.size === 0) return synced;
    let hydratedAnyPic = false;
    const nextSections = (synced.sections || []).map((sec) => ({
      ...sec,
      items: (sec.items || []).map((item) => {
        const ref = defaultPicById.get(item.id);
        const existingPics = normalizePicCodes(item.pics ?? item.picDisplay ?? []);
        if (!ref || existingPics.length > 0 || item.picClearedByAdmin) return item;
        const fallbackPics = normalizePicCodes(ref.pics ?? ref.picDisplay ?? []);
        if (!fallbackPics.length) return item;
        hydratedAnyPic = true;
        return {
          ...item,
          pics: fallbackPics,
          picDisplay: ref.picDisplay || fallbackPics.join(', '),
        };
      }),
    }));
    if (!hydratedAnyPic) return synced;
    const freshState = readKpiWorkflow();
    const lastIdx = freshState.forms.length - 1;
    const updatedForm = { ...freshState.forms[lastIdx], sections: normalizeKpiSections(nextSections) };
    const nextForms = freshState.forms.map((f, idx) => (idx === lastIdx ? updatedForm : f));
    write({ ...freshState, forms: nextForms }, writeOpts);
    return updatedForm;
  }
  const units = getKpiUnits();
  if (!units.length || !Array.isArray(defaultSections) || !defaultSections.length) return null;
  const published = read('prp_kpi_config', null);
  const rawSections = (published?.sections?.length ? published.sections : defaultSections).map((sec) => ({
    ...sec,
    items: (sec.items || []).map((item) => {
      const ref = defaultPicById.get(item.id);
      const existingPics = normalizePicCodes(item.pics ?? item.picDisplay ?? []);
      if (!ref || existingPics.length > 0 || item.picClearedByAdmin) return item;
      const fallbackPics = normalizePicCodes(ref.pics ?? ref.picDisplay ?? []);
      return {
        ...item,
        pics: fallbackPics,
        picDisplay: ref.picDisplay || fallbackPics.join(', '),
      };
    }),
  }));
  const normalized = normalizeKpiSections(rawSections);
  const form = {
    id: createId('form'),
    version: 1,
    period,
    sections: normalized,
    units,
    sentAt: new Date().toISOString(),
  };
  write({ ...state, forms: [form] }, writeOpts);
  if (!published?.sections?.length && !options.silent) {
    publishKpiSections(normalized, { actor: 'Sistem Inisialisasi PRP', snapshot: true, note: `Distribusi awal periode ${period}` });
  }
  return form;
}

export function distributeKpiForm(sections, { period = String(new Date().getFullYear()), actor } = {}) {
  maintenance();
  reviewer(actor);
  const normalized = normalizeKpiSections(sections);
  if (validateKpiSections(normalized).issues.some((issue) => issue.level === 'error')) {
    throw new Error('Perbaiki rumus atau pelanggaran aturan struktur wajib sebelum mendistribusikan.');
  }
  const state = readKpiWorkflow();
  const units = getKpiUnits();
  if (!units.length) throw new Error('Belum ada akun unit KPI aktif.');
  const form = {
    id: createId('form'),
    version: state.forms.length + 1,
    period,
    sections: normalized,
    units,
    sentAt: new Date().toISOString(),
  };
  write({ ...state, forms: [...state.forms, form] });
  publishKpiSections(normalized, { actor: actor?.email || 'Superadmin PRP', snapshot: true, note: `Distribusi periode ${period} (${form.id})` });
  return form;
}

export function getUnitKpiForm(email, state = readKpiWorkflow()) {
  const normalizedEmail = email?.toLowerCase();
  if (!normalizedEmail || !state.forms?.length) return null;
  const directMatch = [...state.forms].reverse().find((form) => form.units?.some((unit) => unit.email === normalizedEmail));
  if (directMatch) return directMatch;
  const isActiveKpiUnit = getKpiUnits().some((unit) => unit.email === normalizedEmail);
  return isActiveKpiUnit ? state.forms[state.forms.length - 1] : null;
}

export function readUnitSubmission(formId, email, state = readKpiWorkflow()) {
  return state.submissions[submissionKey(formId, email)] || null;
}

export function clearUnitKpiDraft(formId, user, { clearPendingEvidence = false } = {}) {
  const state = readKpiWorkflow();
  const form = state.forms.find((entry) => entry.id === formId);
  if (!form || !user?.email) return;
  const key = submissionKey(formId, user.email);
  const previous = state.submissions[key];
  if (previous && !['NEEDS_REVISION'].includes(previous.status)) return;
  const nextDrafts = { ...(state.drafts || {}) };
  delete nextDrafts[key];
  const nextEvidence = { ...(state.evidence || {}) };
  if (clearPendingEvidence && Array.isArray(nextEvidence[key])) {
    const remaining = nextEvidence[key].filter((ev) => ev.status === 'VERIFIED');
    if (remaining.length > 0) {
      nextEvidence[key] = remaining;
    } else {
      delete nextEvidence[key];
    }
  }
  write(
    {
      ...state,
      drafts: nextDrafts,
      evidence: nextEvidence,
    },
    { skipAudit: true },
  );
}

export function saveUnitKpiDraft(formId, user, { values = {}, notes = {} } = {}) {
  const state = readKpiWorkflow();
  const form = state.forms.find((entry) => entry.id === formId);
  owner(form, user);
  const key = submissionKey(formId, user.email);
  const previous = state.submissions[key];
  if (previous && !['NEEDS_REVISION'].includes(previous.status)) {
    throw new Error('Submission sudah terkunci.');
  }

  const editableSubKeys = new Set();
  const editableItemIds = new Set();
  form.sections.forEach((section) => {
    (section.items || []).forEach((item) => {
      if (canUserEditKpiItem(item, user)) {
        editableItemIds.add(item.id);
        (item.subrows || []).forEach((sub) => editableSubKeys.add(sub.key));
      }
    });
  });

  const filteredValues = {};
  Object.entries(values || {}).forEach(([subKey, val]) => {
    if (editableSubKeys.has(subKey)) {
      filteredValues[subKey] = val;
    }
  });

  const filteredNotes = {};
  Object.entries(notes || {}).forEach(([itemId, text]) => {
    if (editableItemIds.has(itemId)) {
      filteredNotes[itemId] = String(text ?? '');
    }
  });

  const existingDraft = state.drafts?.[key];
  if (
    existingDraft
    && JSON.stringify(existingDraft.values || {}) === JSON.stringify(filteredValues)
    && JSON.stringify(existingDraft.notes || {}) === JSON.stringify(filteredNotes)
  ) {
    return existingDraft;
  }

  const draft = {
    formId,
    email: user.email.toLowerCase(),
    unit: user.unit || user.name || user.email,
    picCodes: getUserPicCodes(user),
    values: filteredValues,
    notes: filteredNotes,
    updatedAt: new Date().toISOString(),
  };

  write(
    {
      ...state,
      drafts: {
        ...(state.drafts || {}),
        [key]: draft,
      },
    },
    { skipAudit: true, skipAdminEvent: true },
  );
  return draft;
}

const STATUS_PRIORITY = {
  LOCKED: 5,
  APPROVED: 4,
  SUBMITTED: 3,
  NEEDS_REVISION: 2,
  DRAFT: 1,
  REJECTED: 0,
};

export function readIntegratedKpiBoard(formId, state = readKpiWorkflow()) {
  const form = state.forms.find((entry) => entry.id === formId) || state.forms[state.forms.length - 1] || null;
  if (!form) {
    return {
      form: null,
      values: {},
      notes: {},
      evidenceByItem: {},
      contributorsByItem: {},
      sectionScores: [],
      totalScore: 0,
      filledIndicatorCount: 0,
      totalIndicatorCount: 0,
      unitStatuses: [],
    };
  }

  const candidates = [];
  (form.units || []).forEach((unit) => {
    const key = submissionKey(form.id, unit.email);
    const sub = state.submissions?.[key];
    const draft = state.drafts?.[key];
    const ev = state.evidence?.[key] || [];
    if (sub) {
      candidates.push({
        email: unit.email,
        unit: sub.unit || unit.name,
        picCodes: sub.picCodes || unit.picCodes || [],
        status: sub.status,
        priority: STATUS_PRIORITY[sub.status] ?? 0,
        timestamp: sub.reviewedAt || sub.submittedAt || '',
        values: sub.values || {},
        notes: sub.notes || {},
        evidence: ev,
      });
    } else if (draft || ev.length > 0) {
      candidates.push({
        email: unit.email,
        unit: draft?.unit || unit.name,
        picCodes: draft?.picCodes || unit.picCodes || [],
        status: 'DRAFT',
        priority: STATUS_PRIORITY.DRAFT,
        timestamp: draft?.updatedAt || '',
        values: draft?.values || {},
        notes: draft?.notes || {},
        evidence: ev,
      });
    }
  });

  candidates.sort((a, b) => (b.priority - a.priority) || String(b.timestamp).localeCompare(String(a.timestamp)));

  const mergedValues = {};
  const mergedNotes = {};
  const evidenceByItem = {};
  const contributorsByItem = {};

  form.sections.forEach((section) => {
    (section.items || []).forEach((item) => {
      const fakeUserForMatch = (cand) => ({ role: 'kpi_only', status: 'Aktif', email: cand.email, picCodes: cand.picCodes, unit: cand.unit });
      const permittedCandidates = candidates.filter((cand) => canUserEditKpiItem(item, fakeUserForMatch(cand)));

      const allItemEvidence = [];
      permittedCandidates.forEach((cand) => {
        (cand.evidence || [])
          .filter((ev) => ev.indicatorId === item.id)
          .forEach((ev) => {
            allItemEvidence.push({
              ...ev,
              submissionStatus: cand.status,
              unitName: cand.unit,
              unitEmail: cand.email,
            });
          });
      });
      evidenceByItem[item.id] = allItemEvidence;

      const winner = permittedCandidates.find((cand) => (item.subrows || []).some((sub) => String(cand.values?.[sub.key] ?? '').trim() !== ''));
      if (winner) {
        (item.subrows || []).forEach((sub) => {
          mergedValues[sub.key] = winner.values?.[sub.key] ?? '';
        });
        contributorsByItem[item.id] = {
          email: winner.email,
          unit: winner.unit,
          status: winner.status,
          timestamp: winner.timestamp,
          picCodes: winner.picCodes,
        };
      }

      const noteWinner = permittedCandidates.find((cand) => String(cand.notes?.[item.id] ?? '').trim() !== '');
      if (noteWinner) {
        mergedNotes[item.id] = String(noteWinner.notes[item.id]).trim();
      }
    });
  });

  let filledIndicatorCount = 0;
  let totalIndicatorCount = 0;
  const sectionScores = form.sections.map((section) => {
    let sectionScore = 0;
    (section.items || []).forEach((item) => {
      totalIndicatorCount += 1;
      const computed = computeKpiItem(item, mergedValues, section.isPenaltySection, form.sections);
      if (computed.ratioPercent !== null) {
        filledIndicatorCount += 1;
        sectionScore += computed.weightedScore || 0;
      }
    });
    return { code: section.code, title: section.title, score: sectionScore, isPenaltySection: Boolean(section.isPenaltySection) };
  });

  const totalScore = Math.min(100, Math.max(0, sectionScores.reduce((sum, s) => sum + s.score, 0)));

  const unitStatuses = (form.units || []).map((unit) => {
    const key = submissionKey(form.id, unit.email);
    const sub = state.submissions?.[key] || null;
    const draft = state.drafts?.[key] || null;
    const ev = state.evidence?.[key] || [];
    const assignedCount = getEditableItemsForUser(form, { role: 'kpi_only', status: 'Aktif', email: unit.email, picCodes: unit.picCodes, unit: unit.name }).length;
    return {
      email: unit.email,
      name: unit.name,
      picCodes: unit.picCodes || [],
      assignedCount,
      status: sub?.status || (draft ? 'DRAFT' : 'BELUM_MENGISI'),
      submittedAt: sub?.submittedAt || draft?.updatedAt || null,
      evidenceCount: ev.length,
      verifiedEvidenceCount: ev.filter((e) => e.status === 'VERIFIED').length,
      totalScore: sub?.totalScore ?? null,
    };
  });

  return {
    form,
    values: mergedValues,
    notes: mergedNotes,
    evidenceByItem,
    contributorsByItem,
    sectionScores,
    totalScore,
    filledIndicatorCount,
    totalIndicatorCount,
    unitStatuses,
  };
}

export function submitUnitKpi(formId, user, values, options = {}) {
  const state = readKpiWorkflow();
  const form = state.forms.find((entry) => entry.id === formId);
  owner(form, user);
  const key = submissionKey(formId, user.email);
  const previous = state.submissions[key];
  if (previous && !['NEEDS_REVISION'].includes(previous.status)) {
    throw new Error('Submission sudah terkunci.');
  }

  const allItemsBySubKey = new Map();
  const allItemsById = new Map();
  form.sections.forEach((section) => {
    (section.items || []).forEach((item) => {
      allItemsById.set(item.id, { section, item });
      (item.subrows || []).forEach((sub) => {
        allItemsBySubKey.set(sub.key, { section, item, sub });
      });
    });
  });

  const sanitizedValues = {};
  Object.entries(values || {}).forEach(([subKey, rawVal]) => {
    const ref = allItemsBySubKey.get(subKey);
    if (!ref) return;
    if (!canUserEditKpiItem(ref.item, user)) {
      if (String(rawVal ?? '').trim() !== '') {
        throw new Error(`Akun ini tidak memiliki hak input pada indikator ${ref.section.code}.${ref.item.no} (PIC: ${ref.item.picDisplay || ref.item.pics?.join(', ') || '-'}).`);
      }
      return;
    }
    sanitizedValues[subKey] = rawVal;
  });

  const rawNotes = options?.notes || state.drafts?.[key]?.notes || previous?.notes || {};
  const sanitizedNotes = {};
  Object.entries(rawNotes || {}).forEach(([itemId, rawNote]) => {
    const ref = allItemsById.get(itemId);
    if (!ref) return;
    if (!canUserEditKpiItem(ref.item, user)) {
      if (String(rawNote ?? '').trim() !== '') {
        throw new Error(`Akun ini tidak memiliki hak input keterangan pada indikator ${ref.section.code}.${ref.item.no}.`);
      }
      return;
    }
    if (String(rawNote ?? '').trim() !== '') {
      sanitizedNotes[itemId] = String(rawNote).trim();
    }
  });

  const editableEntries = getEditableItemsForUser(form, user);
  if (editableEntries.length === 0) {
    throw new Error('Tidak ada baris indikator KPI yang ditugaskan ke PIC akun ini.');
  }

  const integrated = readIntegratedKpiBoard(formId, state);
  const evalValues = { ...integrated.values, ...sanitizedValues };

  const sectionScores = form.sections.map((section) => {
    const sectionItems = (section.items || []).filter((item) => canUserEditKpiItem(item, user));
    const results = sectionItems.map((item) => computeKpiItem(item, evalValues, section.isPenaltySection, form.sections));
    if (results.some((result) => result.ratioPercent === null || result.parsedSubs.some((sub) => !sub.isFilled || sub.isInvalid))) {
      throw new Error('Lengkapi semua isian pada indikator PIC Anda dan pastikan rumus dapat dihitung (pembagi tidak nol).');
    }
    return {
      code: section.code,
      title: section.title,
      score: results.reduce((sum, result) => sum + (result.weightedScore || 0), 0),
    };
  });

  const unitEvidence = readUnitEvidence(formId, user.email, state);
  const sysConfig = read('prp_system_config', null);
  const valRules = readKpiValidationRules();
  const hasExplicitPics = editableEntries.some(({ item }) => normalizePicCodes(item.pics).length > 0);
  const mustHaveRowEvidence = valRules.requireEvidenceOnSubmit !== false
    && sysConfig?.evidenceRequired !== false
    && (hasExplicitPics || sysConfig?.evidenceRequired === true);

  if (mustHaveRowEvidence) {
    const missing = editableEntries
      .filter(({ item }) => !unitEvidence.some((ev) => ev.indicatorId === item.id))
      .map(({ section, item }) => `${section.code}.${item.no}`);
    if (missing.length > 0) {
      throw new Error(`Bukti capaian (evidence) wajib dilampirkan pada setiap indikator PIC Anda (belum lengkap pada: ${missing.join(', ')}).`);
    }
  }

  const evidence = unitEvidence.map((e) => ({
    ...e,
    status: 'PENDING',
    note: '',
    reviewedAt: null,
    reviewedBy: null,
  }));

  const record = {
    formId,
    email: user.email.toLowerCase(),
    unit: user.unit || user.name,
    picCodes: getUserPicCodes(user),
    assignedIndicatorIds: editableEntries.map(({ item }) => item.id),
    values: sanitizedValues,
    notes: sanitizedNotes,
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString(),
    revisionNote: '',
    sectionScores,
    totalScore: Math.min(100, Math.max(0, sectionScores.reduce((sum, section) => sum + section.score, 0))),
  };
  record.history = history(previous, 'SUBMITTED', 'Dikirim unit ke sistem pusat PRP', user, evidence);
  record.history[record.history.length - 1].snapshot = clone({
    values: sanitizedValues,
    notes: sanitizedNotes,
    sectionScores,
    totalScore: record.totalScore,
    evidence,
  });

  const nextDrafts = { ...(state.drafts || {}) };
  delete nextDrafts[key];

  write({
    ...state,
    drafts: nextDrafts,
    evidence: { ...state.evidence, [key]: evidence },
    submissions: { ...state.submissions, [key]: record },
  });
  return record;
}

export function reviewUnitKpi(formId, email, status, note = '', actor) {
  maintenance();
  reviewer(actor);
  const state = readKpiWorkflow();
  const key = submissionKey(formId, email);
  const record = state.submissions[key];
  if (!record || status === 'SUBMITTED' || !KPI_TRANSITIONS[record.status]?.includes(status)) {
    throw new Error('Transisi status tidak valid.');
  }
  if (['NEEDS_REVISION', 'REJECTED'].includes(status) && !note.trim()) {
    throw new Error('Alasan wajib diisi.');
  }
  const evidence = readUnitEvidence(formId, email, state);
  const form = state.forms.find((f) => f.id === formId);
  const assignedItems = form
    ? form.sections.flatMap((s) => s.items || []).filter((i) => (record.assignedIndicatorIds || []).includes(i.id))
    : [];
  const hasExplicitPics = assignedItems.some((item) => normalizePicCodes(item.pics).length > 0);
  const sysConfig = read('prp_system_config', null);
  const valRules = readKpiValidationRules();
  const requireEvidence = (config().evidenceRequired === true)
    || (hasExplicitPics && valRules.requireEvidenceOnSubmit !== false && sysConfig?.evidenceRequired !== false);

  if (status === 'APPROVED') {
    if ((requireEvidence && !evidence.length) || evidence.some((e) => e.status !== 'VERIFIED')) {
      throw new Error('Persetujuan memerlukan seluruh bukti terverifikasi dan minimal satu bukti bila diwajibkan.');
    }
    if (requireEvidence && assignedItems.length > 0) {
      const unverifiedRows = assignedItems.filter((item) => !evidence.some((e) => e.indicatorId === item.id && e.status === 'VERIFIED'));
      if (unverifiedRows.length > 0) {
        throw new Error('Seluruh baris indikator PIC pada pengajuan ini wajib memiliki bukti berstatus Terverifikasi sebelum disetujui.');
      }
    }
  }

  const next = {
    ...record,
    status,
    revisionNote: note.trim(),
    reviewedAt: new Date().toISOString(),
    history: history(record, status, note.trim(), actor, evidence),
  };
  write({ ...state, submissions: { ...state.submissions, [key]: next } });
  return next;
}
