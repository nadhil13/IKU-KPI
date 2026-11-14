/** Snapshot formulir KPI terdistribusi, pembatasan hak input PIC, bukti per baris, dan papan integrasi terpusat. */
import { MOCK_ACCOUNTS } from '../auth/authAccounts';
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
  adminOverrides: {},
  revisions: {},
  ...read(KEY, { forms: [], submissions: {}, evidence: {}, drafts: {}, adminOverrides: {}, revisions: {} }),
});

const NOTIF_KEY = 'prp_notifications_v1';
const EMAIL_OUTBOX_KEY = 'prp_email_outbox_v1';

function dispatchWorkflowNotification({
  kind = 'SYSTEM',
  title = 'Pembaruan Sistem KPI',
  message = '',
  targetType = 'ALL',
  targetEmails = [],
  targetRoles = [],
  targetPicCodes = [],
  actionUrl = '/internal/kpi',
  actionLabel = 'Buka Tabel KPI',
  meta = {},
  actor = null,
  sendEmail = false,
  emailRecipients = [],
  emailSubject = '',
  emailBody = '',
} = {}) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const now = new Date().toISOString();
    const cleanEmails = (targetEmails || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
    const cleanRoles = (targetRoles || []).map((r) => String(r || '').trim()).filter(Boolean);
    const cleanPics = (targetPicCodes || []).map((p) => String(p || '').trim().toUpperCase()).filter(Boolean);
    const recipients = (emailRecipients.length ? emailRecipients : cleanEmails)
      .map((e) => String(e || '').trim().toLowerCase())
      .filter(Boolean);
    let emailRecord = null;
    if (sendEmail && recipients.length > 0) {
      const outbox = read(EMAIL_OUTBOX_KEY, []);
      emailRecord = {
        id: createId('email'),
        messageId: `<${String(kind || 'system').toLowerCase()}-${Date.now()}@performa.itpln.ac.id>`,
        subject: String(emailSubject || `[PORTAL KPI ITPLN] ${title}`).trim(),
        body: String(emailBody || message || title).trim(),
        toEmails: recipients,
        recipients,
        recipientLabel: recipients.join(', '),
        kind,
        actionUrl,
        indicatorCode: meta?.targetId || '',
        period: meta?.period || '',
        meta,
        actorEmail: actor?.email || 'prp@itpln.ac.id',
        actorName: actor?.name || 'Admin PRP ITPLN',
        status: 'TERKIRIM_TERCATAT',
        transport: 'SMTP_GATEWAY_READY',
        sentAt: now,
      };
      localStorage.setItem(EMAIL_OUTBOX_KEY, JSON.stringify([emailRecord, ...(Array.isArray(outbox) ? outbox : [])].slice(0, 400)));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('prp-email-outbox-updated'));
      }
    }
    let resolvedTargetValue = '';
    if (targetType === 'USER') resolvedTargetValue = cleanEmails.join(', ');
    else if (targetType === 'PIC') resolvedTargetValue = cleanPics.join(', ');
    else if (targetType === 'ROLE') resolvedTargetValue = cleanRoles.join(', ');

    const existing = read(NOTIF_KEY, []);
    const entry = {
      id: createId('notif'),
      kind,
      title: String(title || '').trim(),
      message: String(message || '').trim(),
      targetType,
      targetValue: resolvedTargetValue,
      targetEmails: cleanEmails,
      targetRoles: cleanRoles,
      targetPicCodes: cleanPics,
      actionUrl: String(actionUrl || '/internal/kpi'),
      actionLabel: String(actionLabel || 'Buka Halaman Terkait'),
      indicatorCode: meta?.targetId || '',
      period: meta?.period || '',
      meta: meta && typeof meta === 'object' ? meta : {},
      actorEmail: actor?.email || 'prp@itpln.ac.id',
      actorName: actor?.name || 'Admin PRP',
      createdAt: now,
      readBy: [],
      emailSent: Boolean(emailRecord),
      emailAuditId: emailRecord?.id || null,
      emailRecordId: emailRecord?.id || null,
      emailRecipients: recipients,
    };
    localStorage.setItem(NOTIF_KEY, JSON.stringify([entry, ...(Array.isArray(existing) ? existing : [])].slice(0, 400)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('prp-notifications-updated'));
    }
    return entry;
  } catch {
    return null;
  }
}

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
  const effectiveEnd = period?.end === '2026-07-31' && period?.status === 'Active' && period?.inputOpen !== false
    ? '2026-12-31'
    : period?.end;
  const startOk = Boolean(period?.syncedAt && period?.inputOpen === true)
    || !period?.start
    || now >= new Date(`${period.start}T00:00:00`);
  if (period && (period.status !== 'Active' || period.inputOpen === false || !startOk || (effectiveEnd && now > new Date(`${effectiveEnd}T23:59:59.999`)))) {
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
  if (!normalizedEmail || user.status === 'Nonaktif' || (user.role && user.role !== 'kpi_only' && user.role !== 'dual') || !form || !isRegisteredUnit) {
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
  const form = state.forms.find((f) => f.id === formId);
  const reviewedEv = entries.find((e) => e.id === evidenceId);
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
  if (email) {
    dispatchWorkflowNotification({
      kind: status === 'REJECTED' ? 'REVISION' : 'SYSTEM',
      title: status === 'REJECTED'
        ? `Bukti Capaian Ditolak (${reviewedEv?.label || evidenceId})`
        : `Bukti Capaian Terverifikasi (${reviewedEv?.label || evidenceId})`,
      message: status === 'REJECTED'
        ? `Admin PRP menolak bukti "${reviewedEv?.label || evidenceId}" dengan catatan: ${note.trim()}`
        : `Bukti "${reviewedEv?.label || evidenceId}" telah diverifikasi oleh Admin PRP.`,
      targetType: 'USER',
      targetEmails: [email],
      actionUrl: `/internal/kpi?period=${encodeURIComponent(form?.period || '2026')}&focusItem=${encodeURIComponent(reviewedEv?.indicatorId || '')}`,
      actionLabel: 'Buka Baris Indikator',
      meta: { formId, evidenceId, indicatorId: reviewedEv?.indicatorId || null, status },
      actor,
      sendEmail: status === 'REJECTED',
      emailRecipients: [email],
      emailSubject: `[PORTAL KPI ITPLN] ${status === 'REJECTED' ? 'Penolakan Bukti Capaian KPI' : 'Verifikasi Bukti Capaian KPI'}`,
    });
  }
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
    if (!event.key || event.key === KEY || event.key === 'prp_kpi_config') callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener('prp-kpi-config-updated', callback);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('prp-kpi-config-updated', callback);
    window.removeEventListener('storage', storage);
  };
}

export function doesFormMatchPeriod(form, period) {
  if (!form || !period) return false;
  const target = String(period).trim();
  const formPeriod = String(form.period || '').trim();
  if (!target || !formPeriod) return false;
  if (formPeriod.toLowerCase() === target.toLowerCase() || form.id === target) return true;
  const targetYearMatch = target.match(/\b(20\d{2})\b/);
  const formYearMatch = formPeriod.match(/\b(20\d{2})\b/);
  if (targetYearMatch && formYearMatch && targetYearMatch[1] === formYearMatch[1]) {
    if (/^\d{4}$/.test(target) || /^\d{4}$/.test(formPeriod)) return true;
  }
  return false;
}

export function getFormForPeriod(period, state = readKpiWorkflow(), { fallbackToLatest = true } = {}) {
  if (!state?.forms?.length) return null;
  if (!period) return state.forms[state.forms.length - 1];
  const exact = [...state.forms].reverse().find((f) => String(f.period || '').trim().toLowerCase() === String(period).trim().toLowerCase() || f.id === period);
  if (exact) return exact;
  const matched = [...state.forms].reverse().find((f) => doesFormMatchPeriod(f, period));
  if (matched) return matched;
  return fallbackToLatest ? state.forms[state.forms.length - 1] : null;
}

export function listKpiPeriodsWithStatus(state = readKpiWorkflow()) {
  const rawPeriods = read('prp_periods', []);
  const sysDeadline = config().submissionDeadline || null;
  const now = new Date();
  const byYear = new Map();

  const evaluateStatus = (periodObj, yearStr) => {
    if (!periodObj) {
      const isCurrentYear = String(yearStr) === String(new Date().getFullYear());
      const deadlinePassed = sysDeadline && now > new Date(sysDeadline);
      const isOpen = isCurrentYear && !deadlinePassed;
      return {
        year: String(yearStr),
        id: String(yearStr),
        label: `Periode Evaluasi ${yearStr}`,
        status: isOpen ? 'Active' : 'Archived',
        inputOpen: isOpen,
        isOpenForInput: isOpen,
        isLocked: !isOpen,
        lockReason: !isOpen ? (deadlinePassed ? 'Melewati Tenggat Waktu' : 'Periode Historis / Terkunci') : 'Terbuka untuk Pengisian',
        deadline: sysDeadline,
      };
    }
    const effectiveEnd = periodObj.end === '2026-07-31' && periodObj.status === 'Active' && periodObj.inputOpen !== false
      ? '2026-12-31'
      : periodObj.end;
    const startOk = Boolean(periodObj.syncedAt && periodObj.inputOpen === true)
      || !periodObj.start
      || now >= new Date(`${periodObj.start}T00:00:00`);
    const endOk = !effectiveEnd || now <= new Date(`${effectiveEnd}T23:59:59.999`);
    const deadline = periodObj.submissionDeadline || sysDeadline;
    const deadlineOk = !deadline || now <= new Date(deadline);
    const isOpen = periodObj.status === 'Active' && periodObj.inputOpen !== false && startOk && endOk && deadlineOk;
    let lockReason = 'Terbuka untuk Pengisian';
    if (!isOpen) {
      if (periodObj.status !== 'Active' || periodObj.inputOpen === false) lockReason = 'Dinonaktifkan / Dikunci Admin PRP';
      else if (!deadlineOk || !endOk) lockReason = 'Tenggat Waktu Berakhir';
      else if (!startOk) lockReason = 'Belum Dibuka';
    }
    return {
      year: String(yearStr),
      id: periodObj.id || String(yearStr),
      label: periodObj.label || `Periode Evaluasi ${yearStr}`,
      status: periodObj.status || (isOpen ? 'Active' : 'Archived'),
      inputOpen: isOpen,
      isOpenForInput: isOpen,
      isLocked: !isOpen,
      lockReason,
      deadline,
      start: periodObj.start || null,
      end: periodObj.end || null,
    };
  };

  (Array.isArray(rawPeriods) ? rawPeriods : []).forEach((p) => {
    const ymAll = String(p.id || p.label || p.end || p.start || '').match(/\b(20\d{2})\b/g);
    const yearKey = ymAll && ymAll.length ? ymAll[ymAll.length - 1] : String(p.id || p.label || '2026');
    const prev = byYear.get(yearKey);
    const evaluated = evaluateStatus(p, yearKey);
    if (!prev || (!prev.inputOpen && evaluated.inputOpen)) {
      byYear.set(yearKey, evaluated);
    }
  });

  (state?.forms || []).forEach((f) => {
    const ym = String(f.period || '').match(/\b(20\d{2})\b/);
    const yearKey = ym ? ym[1] : String(f.period || '2026');
    if (!byYear.has(yearKey)) {
      byYear.set(yearKey, evaluateStatus(null, yearKey));
    }
  });

  ['2027', '2026', '2025', '2024'].forEach((yr) => {
    if (!byYear.has(yr)) {
      byYear.set(yr, evaluateStatus(null, yr));
    }
  });

  return [...byYear.values()].sort((a, b) => String(b.year).localeCompare(String(a.year)));
}

export function syncActiveKpiFormSections(sections, options = {}) {
  if (!Array.isArray(sections) || !sections.length) return null;
  const normalized = normalizeKpiSections(sections);
  const state = readKpiWorkflow();
  if (!state.forms.length) return null;
  let targetIdx = state.forms.length - 1;
  if (options.period) {
    for (let i = state.forms.length - 1; i >= 0; i -= 1) {
      if (doesFormMatchPeriod(state.forms[i], options.period)) {
        targetIdx = i;
        break;
      }
    }
  }
  const latestForm = state.forms[targetIdx];
  const prevJson = JSON.stringify(latestForm.sections || []);
  const nextJson = JSON.stringify(normalized);
  const units = getKpiUnits();
  const nextUnits = units.length > 0 ? units : latestForm.units || [];
  if (prevJson === nextJson && JSON.stringify(latestForm.units || []) === JSON.stringify(nextUnits)) {
    return latestForm;
  }
  const updatedForm = {
    ...latestForm,
    sections: normalized,
    units: nextUnits,
    structureRevision: (Number(latestForm.structureRevision) || 1) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: options.actor || 'Superadmin PRP',
  };
  const nextForms = state.forms.map((f, idx) => (idx === targetIdx ? updatedForm : f));
  write(
    { ...state, forms: nextForms },
    {
      skipWorkflowEvent: Boolean(options.silent),
      skipAdminEvent: Boolean(options.silent),
      skipAudit: Boolean(options.silent),
    },
  );
  return updatedForm;
}

export function syncPeriodMasterTable(sections, {
  period = String(new Date().getFullYear()),
  actor = null,
  openPeriod = true,
  lockPreviousPeriods = false,
  note = '',
} = {}) {
  maintenance();
  reviewer(actor);
  const normalized = normalizeKpiSections(sections);
  if (validateKpiSections(normalized).issues.some((issue) => issue.level === 'error')) {
    throw new Error('Perbaiki rumus atau pelanggaran aturan struktur wajib sebelum menyinkronkan periode.');
  }
  const state = readKpiWorkflow();
  const units = getKpiUnits();
  if (!units.length) throw new Error('Belum ada akun unit KPI aktif.');

  const targetPeriod = String(period || new Date().getFullYear()).trim();
  const yearMatch = targetPeriod.match(/\b(20\d{2})\b/);
  const targetYear = yearMatch ? yearMatch[1] : targetPeriod;

  let existingIdx = -1;
  for (let i = state.forms.length - 1; i >= 0; i -= 1) {
    if (doesFormMatchPeriod(state.forms[i], targetPeriod)) {
      existingIdx = i;
      break;
    }
  }

  let syncedForm;
  let nextForms;
  if (existingIdx >= 0) {
    const prevForm = state.forms[existingIdx];
    syncedForm = {
      ...prevForm,
      period: targetPeriod,
      sections: normalized,
      units,
      structureRevision: (Number(prevForm.structureRevision) || 1) + 1,
      syncedAt: new Date().toISOString(),
      syncedBy: actor?.email || 'prp@itpln.ac.id',
    };
    nextForms = state.forms.map((f, idx) => (idx === existingIdx ? syncedForm : f));
  } else {
    syncedForm = {
      id: createId('form'),
      version: state.forms.length + 1,
      period: targetPeriod,
      sections: normalized,
      units,
      structureRevision: 1,
      sentAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
      syncedBy: actor?.email || 'prp@itpln.ac.id',
    };
    nextForms = [...state.forms, syncedForm];
  }

  if (typeof localStorage !== 'undefined') {
    const rawPeriods = read('prp_periods', []);
    const list = Array.isArray(rawPeriods) ? [...rawPeriods] : [];
    const periodIdx = list.findIndex((p) => String(p.id) === targetPeriod || String(p.label) === targetPeriod || String(p.start || '').startsWith(targetYear));
    const nextPeriodRecord = {
      id: periodIdx >= 0 ? list[periodIdx].id : `PER-${targetYear}`,
      label: periodIdx >= 0 ? list[periodIdx].label : `Periode Evaluasi KPI ${targetPeriod}`,
      start: periodIdx >= 0 && list[periodIdx].start ? list[periodIdx].start : `${targetYear}-01-01`,
      end: periodIdx >= 0 && list[periodIdx].end ? list[periodIdx].end : `${targetYear}-12-31`,
      status: openPeriod ? 'Active' : (periodIdx >= 0 ? list[periodIdx].status : 'Archived'),
      inputOpen: Boolean(openPeriod),
      syncedAt: new Date().toISOString(),
      structureRevision: syncedForm.structureRevision,
    };
    const updatedPeriods = list.map((p, idx) => {
      if (idx === periodIdx) return { ...p, ...nextPeriodRecord };
      if (lockPreviousPeriods && openPeriod) {
        return { ...p, status: 'Archived', inputOpen: false };
      }
      return p;
    });
    if (periodIdx < 0) {
      updatedPeriods.unshift(nextPeriodRecord);
    }
    localStorage.setItem('prp_periods', JSON.stringify(updatedPeriods));
  }

  write({ ...state, forms: nextForms });
  publishKpiSections(normalized, {
    actor: actor?.email || 'Superadmin PRP',
    snapshot: true,
    note: note || `Sinkronisasi Master Tabel Periode ${targetPeriod} (${syncedForm.id})`,
  });

  dispatchWorkflowNotification({
    kind: 'STRUCTURE_SYNC',
    title: `Master Tabel KPI Periode ${targetPeriod} Disinkronkan`,
    message: note
      || `Admin PRP telah menyinkronkan struktur Master Tabel KPI untuk periode ${targetPeriod} (${openPeriod ? 'Status: AKTIF / Terbuka untuk Diisi' : 'Status: TERKUNCI / Arsip'}). Data historis periode sebelumnya tetap tersimpan utuh.`,
    targetType: 'ALL',
    actionUrl: `/internal/kpi?period=${encodeURIComponent(targetYear)}`,
    actionLabel: `Buka Tabel Periode ${targetPeriod}`,
    meta: { formId: syncedForm.id, period: targetPeriod, openPeriod },
    actor,
  });

  return syncedForm;
}

export function getKpiUnits() {
  const accounts = new Map();
  [...MOCK_ACCOUNTS, ...read('prp_users', [])].forEach((user) => {
    if (user?.email) accounts.set(user.email.toLowerCase(), user);
  });
  return [...accounts.values()]
    .filter((user) => (user.role === 'kpi_only' || user.role === 'dual') && user.status !== 'Nonaktif')
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
  dispatchWorkflowNotification({
    kind: 'STRUCTURE_SYNC',
    title: `Formulir Evaluasi KPI Periode ${period} Didistribusikan`,
    message: `Admin PRP telah mendistribusikan struktur tabel KPI periode ${period} ke seluruh unit kerja PIC. Silakan buka lembar kerja untuk mengisi capaian unit Anda.`,
    targetType: 'ALL',
    actionUrl: `/internal/kpi?period=${encodeURIComponent(period)}`,
    actionLabel: 'Buka Lembar Kerja KPI',
    meta: { formId: form.id, period },
    actor,
  });
  return form;
}

export function getUnitKpiForm(email, state = readKpiWorkflow(), period = null) {
  const normalizedEmail = email?.toLowerCase();
  if (!normalizedEmail || !state.forms?.length) return null;
  if (period) {
    const periodMatch = [...state.forms].reverse().find(
      (form) => doesFormMatchPeriod(form, period) && form.units?.some((unit) => unit.email === normalizedEmail),
    );
    if (periodMatch) return periodMatch;
    const isActiveKpiUnitForPeriod = getKpiUnits().some((unit) => unit.email === normalizedEmail);
    if (isActiveKpiUnitForPeriod) {
      const anyPeriodForm = [...state.forms].reverse().find((form) => doesFormMatchPeriod(form, period));
      if (anyPeriodForm) return anyPeriodForm;
    }
  }
  const directMatch = [...state.forms].reverse().find((form) => form.units?.some((unit) => unit.email === normalizedEmail));
  if (directMatch) return directMatch;
  const isActiveKpiUnit = getKpiUnits().some((unit) => unit.email === normalizedEmail);
  return isActiveKpiUnit ? state.forms[state.forms.length - 1] : null;
}

export function readUnitSubmission(formId, email, state = readKpiWorkflow()) {
  return state.submissions[submissionKey(formId, email)] || null;
}

export function readAdminKpiOverride(formId, state = readKpiWorkflow()) {
  if (!formId) return { values: {}, notes: {}, updatedAt: null, updatedBy: null };
  return state.adminOverrides?.[formId] || { values: {}, notes: {}, updatedAt: null, updatedBy: null };
}

export function saveAdminKpiOverride(formId, actor, { values = {}, notes = {} } = {}) {
  maintenance();
  reviewer(actor);
  const state = readKpiWorkflow();
  const form = state.forms.find((entry) => entry.id === formId) || state.forms[state.forms.length - 1];
  if (!form) throw new Error('Formulir KPI tidak ditemukan.');

  const prevOverride = state.adminOverrides?.[form.id] || { values: {}, notes: {} };
  const nextValues = { ...(prevOverride.values || {}) };
  Object.entries(values || {}).forEach(([subKey, rawVal]) => {
    const str = String(rawVal ?? '').trim();
    if (str === '') {
      delete nextValues[subKey];
    } else {
      nextValues[subKey] = rawVal;
    }
  });

  const nextNotes = { ...(prevOverride.notes || {}) };
  Object.entries(notes || {}).forEach(([itemId, rawNote]) => {
    const str = String(rawNote ?? '').trim();
    if (str === '') {
      delete nextNotes[itemId];
    } else {
      nextNotes[itemId] = str;
    }
  });

  const overrideRecord = {
    formId: form.id,
    values: nextValues,
    notes: nextNotes,
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.name || 'Admin PRP',
    updatedByEmail: actor?.email || 'prp@itpln.ac.id',
  };

  write({
    ...state,
    adminOverrides: {
      ...(state.adminOverrides || {}),
      [form.id]: overrideRecord,
    },
  });

  return overrideRecord;
}

export function readKpiRevisions(formId, state = readKpiWorkflow()) {
  if (!formId) return { items: {}, sections: {} };
  const record = state.revisions?.[formId];
  return {
    items: record?.items || {},
    sections: record?.sections || {},
  };
}

export function saveKpiRevisionComment(formId, actor, {
  scope = 'ITEM',
  targetId = '',
  comment = '',
  resolved = false,
} = {}) {
  maintenance();
  reviewer(actor);
  const state = readKpiWorkflow();
  const form = state.forms.find((entry) => entry.id === formId) || state.forms[state.forms.length - 1];
  if (!form) throw new Error('Formulir KPI tidak ditemukan.');
  const normalizedTarget = String(targetId || '').trim();
  if (!normalizedTarget) throw new Error('Target item atau bagian revisi wajib dipilih.');

  const trimmedComment = String(comment || '').trim();
  const prevFormRev = state.revisions?.[form.id] || { items: {}, sections: {} };
  const nextItems = { ...(prevFormRev.items || {}) };
  const nextSections = { ...(prevFormRev.sections || {}) };
  const now = new Date().toISOString();

  let targetLabel = normalizedTarget;
  let affectedPics = [];
  let affectedItems = [];

  if (scope === 'SECTION') {
    const sec = (form.sections || []).find((s) => s.code === normalizedTarget);
    targetLabel = sec ? `Bagian ${sec.code} (${sec.title})` : `Bagian ${normalizedTarget}`;
    affectedItems = sec?.items || [];
    affectedPics = normalizePicCodes(affectedItems.flatMap((it) => it.pics || []));
    if (!trimmedComment || resolved) {
      delete nextSections[normalizedTarget];
    } else {
      nextSections[normalizedTarget] = {
        scope: 'SECTION',
        targetId: normalizedTarget,
        label: targetLabel,
        comment: trimmedComment,
        status: 'NEEDS_REVISION',
        updatedAt: now,
        authorEmail: actor?.email || 'prp@itpln.ac.id',
        authorName: actor?.name || 'Admin PRP',
      };
    }
  } else {
    let foundSec = null;
    let foundItem = null;
    (form.sections || []).forEach((s) => {
      (s.items || []).forEach((it) => {
        if (it.id === normalizedTarget) {
          foundSec = s;
          foundItem = it;
        }
      });
    });
    targetLabel = foundItem
      ? `Indikator ${foundSec.code}.${foundItem.no} (${foundItem.indikator})`
      : `Indikator ${normalizedTarget}`;
    affectedItems = foundItem ? [foundItem] : [];
    affectedPics = foundItem ? normalizePicCodes(foundItem.pics || foundItem.picDisplay || []) : [];

    if (!trimmedComment || resolved) {
      delete nextItems[normalizedTarget];
    } else {
      nextItems[normalizedTarget] = {
        scope: 'ITEM',
        targetId: normalizedTarget,
        sectionCode: foundSec?.code || '',
        indicatorNo: foundItem?.no || '',
        label: targetLabel,
        comment: trimmedComment,
        picCodes: affectedPics,
        status: 'NEEDS_REVISION',
        updatedAt: now,
        authorEmail: actor?.email || 'prp@itpln.ac.id',
        authorName: actor?.name || 'Admin PRP',
      };
    }
  }

  const nextSubmissions = { ...(state.submissions || {}) };
  const affectedUnitEmails = new Set();

  if (trimmedComment && !resolved && affectedItems.length > 0) {
    (form.units || []).forEach((unit) => {
      const fakeUser = { role: 'kpi_only', status: 'Aktif', email: unit.email, picCodes: unit.picCodes, unit: unit.name };
      const matchesUnit = affectedItems.some((it) => canUserEditKpiItem(it, fakeUser));
      if (matchesUnit) {
        affectedUnitEmails.add(unit.email.toLowerCase());
        const sKey = submissionKey(form.id, unit.email);
        const existingSub = nextSubmissions[sKey];
        if (existingSub && ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(existingSub.status)) {
          const ev = readUnitEvidence(form.id, unit.email, state);
          nextSubmissions[sKey] = {
            ...existingSub,
            status: 'NEEDS_REVISION',
            revisionNote: `[${targetLabel}] ${trimmedComment}`,
            reviewedAt: now,
            history: history(existingSub, 'NEEDS_REVISION', `Catatan Revisi PRP (${targetLabel}): ${trimmedComment}`, actor, ev),
          };
        }
      }
    });
  }

  write({
    ...state,
    submissions: nextSubmissions,
    revisions: {
      ...(state.revisions || {}),
      [form.id]: {
        items: nextItems,
        sections: nextSections,
      },
    },
  });

  if (trimmedComment && !resolved) {
    const recipientEmails = [...affectedUnitEmails];
    const focusParam = scope === 'ITEM' ? `&focusItem=${encodeURIComponent(normalizedTarget)}` : `&focusSection=${encodeURIComponent(normalizedTarget)}`;
    dispatchWorkflowNotification({
      kind: 'REVISION',
      title: `Catatan Revisi PRP: ${targetLabel}`,
      message: `Admin PRP memberikan catatan revisi pada ${targetLabel}: "${trimmedComment}". Silakan perbaiki isian atau bukti pendukung Anda.`,
      targetType: recipientEmails.length > 0 ? 'USER' : (affectedPics.length > 0 ? 'PIC' : 'ALL'),
      targetEmails: recipientEmails,
      targetPicCodes: affectedPics,
      actionUrl: `/internal/kpi?period=${encodeURIComponent(form.period || '2026')}${focusParam}`,
      actionLabel: 'Perbaiki Baris Indikator',
      meta: {
        formId: form.id,
        period: form.period,
        scope,
        targetId: normalizedTarget,
        picCodes: affectedPics,
      },
      actor,
      sendEmail: recipientEmails.length > 0,
      emailRecipients: recipientEmails,
      emailSubject: `[REVISI KPI ITPLN - Periode ${form.period}] ${targetLabel}`,
      emailBody: `Yth. Bapak/Ibu PIC (${affectedPics.join(', ') || 'Unit Kerja'}),\n\nTim Admin PRP ITPLN telah mengirimkan catatan revisi evaluasi KPI pada:\nTarget: ${targetLabel}\nPeriode: ${form.period}\nCatatan Revisi: "${trimmedComment}"\n\nSilakan masuk ke Portal Kinerja ITPLN untuk menindaklanjuti revisi tersebut.`,
    });
  }

  return {
    items: nextItems,
    sections: nextSections,
    notifiedEmails: [...affectedUnitEmails],
  };
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
  const form = state.forms.find((entry) => entry.id === formId)
    || getFormForPeriod(formId, state, { fallbackToLatest: true })
    || null;
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
      revisions: { items: {}, sections: {} },
    };
  }

  const adminOverride = state.adminOverrides?.[form.id] || { values: {}, notes: {} };
  const formRevisions = state.revisions?.[form.id] || { items: {}, sections: {} };

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

      let overriddenAnySub = false;
      (item.subrows || []).forEach((sub) => {
        const overrideVal = adminOverride.values?.[sub.key];
        if (overrideVal !== undefined && String(overrideVal).trim() !== '') {
          mergedValues[sub.key] = overrideVal;
          overriddenAnySub = true;
        }
      });
      if (overriddenAnySub) {
        contributorsByItem[item.id] = {
          email: adminOverride.updatedByEmail || 'prp@itpln.ac.id',
          unit: contributorsByItem[item.id]?.unit ? `${contributorsByItem[item.id].unit} (Override PRP)` : 'Override Admin PRP',
          status: contributorsByItem[item.id]?.status || 'APPROVED',
          timestamp: adminOverride.updatedAt || new Date().toISOString(),
          picCodes: contributorsByItem[item.id]?.picCodes || item.pics || ['PRP'],
          isAdminOverride: true,
        };
      }

      const noteWinner = permittedCandidates.find((cand) => String(cand.notes?.[item.id] ?? '').trim() !== '');
      if (noteWinner) {
        mergedNotes[item.id] = String(noteWinner.notes[item.id]).trim();
      }
      if (adminOverride.notes?.[item.id] && String(adminOverride.notes[item.id]).trim() !== '') {
        mergedNotes[item.id] = String(adminOverride.notes[item.id]).trim();
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
    revisions: {
      items: formRevisions.items || {},
      sections: formRevisions.sections || {},
    },
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

  if (email) {
    const isRev = ['NEEDS_REVISION', 'REJECTED'].includes(status);
    const statusLabelMap = {
      APPROVED: 'Disetujui (Approved)',
      NEEDS_REVISION: 'Perlu Revisi (Needs Revision)',
      REJECTED: 'Ditolak (Rejected)',
      LOCKED: 'Dikunci Permanen (Locked)',
    };
    const statusLabel = statusLabelMap[status] || status;
    dispatchWorkflowNotification({
      kind: isRev ? 'REVISION' : 'SYSTEM',
      title: `Status Pengajuan KPI: ${statusLabel}`,
      message: isRev
        ? `Admin PRP meminta revisi pada pengajuan KPI unit ${record.unit || email}: "${note.trim()}"`
        : `Pengajuan evaluasi KPI unit ${record.unit || email} telah diperbarui menjadi ${statusLabel}.${note.trim() ? ` Catatan: ${note.trim()}` : ''}`,
      targetType: 'USER',
      targetEmails: [email],
      actionUrl: `/internal/kpi?period=${encodeURIComponent(form?.period || '2026')}`,
      actionLabel: isRev ? 'Buka & Perbaiki Isian KPI' : 'Lihat Hasil Evaluasi KPI',
      meta: { formId, status, note: note.trim() },
      actor,
      sendEmail: true,
      emailRecipients: [email],
      emailSubject: `[PORTAL KPI ITPLN] Status Evaluasi KPI Unit ${record.unit || email}: ${statusLabel}`,
      emailBody: `Yth. Bapak/Ibu PIC ${record.unit || email},\n\nStatus pengajuan evaluasi KPI Anda pada Periode ${form?.period || '2026'} telah diperbarui oleh Tim Admin PRP menjadi: ${statusLabel}.\n${note.trim() ? `Catatan Verifikator PRP: "${note.trim()}"\n` : ''}\nSilakan masuk ke Portal Kinerja ITPLN untuk melihat rinciannya.`,
    });
  }

  return next;
}
