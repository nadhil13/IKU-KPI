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
export const SPI_AUDIT_KEY = 'prp_spi_audit_v1';
export const SPI_AUDIT_EVENT = 'prp-spi-audit-updated';
export const SPI_VERIFICATION_STATUSES = Object.freeze([
  'BELUM_DIPERIKSA',
  'SESUAI_BUKTI',
  'PERLU_KLARIFIKASI',
  'TEMUAN_AUDIT',
]);
export const SPI_FOLLOWUP_STATUSES = Object.freeze([
  'OPEN',
  'ON_PROGRESS',
  'CLOSED',
]);
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
  actionUrl = '/internal',
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
      if (typeof fetch === 'function') {
        const token = localStorage.getItem('performa_access_token') || '';
        if (token) {
          fetch('/api/v1/notifications/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(emailRecord),
          }).catch(() => {});
        }
      }
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
      actionUrl: String(actionUrl || '/internal'),
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
  const yearPrefix = text.match(/^\d{4}/)?.[0] || '';
  const matchesYear = (p) => Boolean(yearPrefix) && (
    p.start?.startsWith(yearPrefix)
    || p.end?.startsWith(yearPrefix)
    || p.label?.includes(yearPrefix)
    || p.id?.includes(yearPrefix)
  );
  const period = periods.find((p) => p.id === text || p.label === text)
    || periods.find((p) => p.status === 'Active' && matchesYear(p))
    || periods.find((p) => matchesYear(p));
  const now = new Date();
  const effectiveEnd = period?.end;
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
  if (user?.role === 'spi' || normalizedEmail === 'spi@itpln.ac.id') {
    throw new Error('Akun Verifikasi SPI bersifat ketat Hanya Lihat (Read-Only) tanpa wewenang mengedit data.');
  }
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

function stripEvidenceDataUrl(evidenceList) {
  if (!Array.isArray(evidenceList)) return [];
  return evidenceList.map((ev) => {
    if (!ev || typeof ev !== 'object') return ev;
    const { dataUrl, ...meta } = ev;
    return {
      ...meta,
      ...(dataUrl ? { hasBinaryData: true } : {}),
    };
  });
}

function isSubmissionLockedForActor(record, user) {
  if (!record) return false;
  if (user?.role === 'spi') {
    return ['APPROVED', 'LOCKED'].includes(record.status);
  }
  return !['DRAFT', 'NEEDS_REVISION'].includes(record.status);
}

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
        evidence: stripEvidenceDataUrl(evidence),
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

function buildValidatedEvidenceEntry(form, ownerUser, metadata, { bypassPicCheck = false } = {}) {
  const targetItem = (form.sections || []).flatMap((s) => s.items || []).find((i) => i.id === metadata?.indicatorId);
  if (!metadata?.label?.trim() || !targetItem) {
    throw new Error('Label dan indikator bukti wajib valid.');
  }
  if (!bypassPicCheck && !canUserEditKpiItem(targetItem, ownerUser)) {
    throw new Error('Akun ini tidak memiliki hak input bukti pada indikator milik PIC lain.');
  }

  const ownerEmail = String(ownerUser?.email || '').trim().toLowerCase();
  const isFileUpload = metadata.kind === 'file' || Boolean(metadata.dataUrl);

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

    return {
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
      owner: ownerEmail,
      ownerUnit: ownerUser.unit || ownerUser.name || ownerEmail,
      picCodes: getUserPicCodes(ownerUser),
      createdAt: new Date().toISOString(),
    };
  }

  let url;
  try {
    url = new URL(metadata.url);
  } catch {
    throw new Error('URL bukti tidak valid.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Gunakan URL HTTPS tanpa kredensial.');
  }

  return {
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
    owner: ownerEmail,
    ownerUnit: ownerUser.unit || ownerUser.name || ownerEmail,
    picCodes: getUserPicCodes(ownerUser),
    createdAt: new Date().toISOString(),
  };
}

export function addUnitEvidence(formId, user, metadata) {
  const state = readKpiWorkflow();
  const form = state.forms.find((f) => f.id === formId);
  owner(form, user);
  const key = submissionKey(formId, user.email);
  if (isSubmissionLockedForActor(state.submissions[key], user)) {
    throw new Error('Bukti terkunci.');
  }
  const entry = buildValidatedEvidenceEntry(form, user, metadata);
  write({
    ...state,
    evidence: {
      ...state.evidence,
      [key]: [...readUnitEvidence(formId, user.email, state), entry],
    },
  });
  return entry;
}

export function addUnitEvidenceByAdmin(formId, targetEmail, actor, metadata) {
  maintenance();
  reviewer(actor);
  const state = readKpiWorkflow();
  const form = state.forms.find((f) => f.id === formId) || state.forms[state.forms.length - 1];
  if (!form) throw new Error('Formulir KPI tidak ditemukan.');
  const normalizedEmail = String(targetEmail || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Akun unit tujuan tidak valid.');
  const targetUnit = (form.units || []).find((u) => u.email?.toLowerCase() === normalizedEmail)
    || getKpiUnits().find((u) => u.email?.toLowerCase() === normalizedEmail)
    || { email: normalizedEmail, name: normalizedEmail, picCodes: [] };
  const ownerProxy = {
    role: 'kpi_only',
    status: 'Aktif',
    email: normalizedEmail,
    unit: targetUnit.name,
    picCodes: targetUnit.picCodes || [],
  };
  const entry = buildValidatedEvidenceEntry(form, ownerProxy, metadata, { bypassPicCheck: true });
  entry.uploadedByAdmin = actor?.email || 'prp@itpln.ac.id';
  entry.status = 'VERIFIED';
  entry.note = `Diunggah & terverifikasi langsung oleh Admin PRP (${actor?.name || 'Admin PRP'})`;
  const key = submissionKey(form.id, normalizedEmail);
  write({
    ...state,
    evidence: {
      ...state.evidence,
      [key]: [...readUnitEvidence(form.id, normalizedEmail, state), entry],
    },
  });
  return entry;
}

export function updateUnitEvidenceByAdmin(formId, targetEmail, actor, evidenceId, metadata = {}) {
  maintenance();
  reviewer(actor);
  const state = readKpiWorkflow();
  const form = state.forms.find((f) => f.id === formId) || state.forms[state.forms.length - 1];
  if (!form) throw new Error('Formulir KPI tidak ditemukan.');
  const normalizedEmail = String(targetEmail || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Akun unit tujuan tidak valid.');
  const key = submissionKey(form.id, normalizedEmail);
  const existing = readUnitEvidence(form.id, normalizedEmail, state);
  const targetEv = existing.find((e) => e.id === evidenceId);
  if (!targetEv) throw new Error('Bukti capaian tidak ditemukan.');

  const nextIndicatorId = metadata.indicatorId !== undefined ? String(metadata.indicatorId).trim() : targetEv.indicatorId;
  const targetItem = (form.sections || []).flatMap((s) => s.items || []).find((i) => i.id === nextIndicatorId);
  if (!targetItem) throw new Error('Indikator tujuan tidak ditemukan pada formulir.');

  const nextLabel = metadata.label !== undefined ? String(metadata.label).trim() : targetEv.label;
  if (!nextLabel) throw new Error('Judul dokumen bukti wajib diisi.');

  const nextKind = metadata.kind || targetEv.kind || 'link';
  let fileFields = {
    kind: nextKind,
    url: targetEv.url || '',
    fileName: targetEv.fileName || '',
    mimeType: targetEv.mimeType || '',
    fileSize: targetEv.fileSize || 0,
    dataUrl: targetEv.dataUrl || '',
  };

  if (nextKind === 'file') {
    if (metadata.dataUrl) {
      const validated = buildValidatedEvidenceEntry(form, {
        role: 'kpi_only',
        status: 'Aktif',
        email: normalizedEmail,
      }, {
        indicatorId: targetItem.id,
        kind: 'file',
        label: nextLabel,
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        fileSize: metadata.fileSize,
        dataUrl: metadata.dataUrl,
      }, { bypassPicCheck: true });
      fileFields = {
        kind: 'file',
        url: '',
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        fileSize: validated.fileSize,
        dataUrl: validated.dataUrl,
      };
    } else if (!targetEv.dataUrl) {
      throw new Error('Pilih berkas PDF atau gambar terlebih dahulu untuk mengubah ke tipe berkas.');
    }
  } else {
    const nextUrlRaw = metadata.url !== undefined ? String(metadata.url).trim() : targetEv.url;
    const validatedLink = buildValidatedEvidenceEntry(form, {
      role: 'kpi_only',
      status: 'Aktif',
      email: normalizedEmail,
    }, {
      indicatorId: targetItem.id,
      kind: 'link',
      label: nextLabel,
      url: nextUrlRaw,
    }, { bypassPicCheck: true });
    fileFields = {
      kind: 'link',
      url: validatedLink.url,
      fileName: '',
      mimeType: '',
      fileSize: 0,
      dataUrl: '',
    };
  }

  const now = new Date().toISOString();
  const updatedEntry = {
    ...targetEv,
    ...fileFields,
    indicatorId: targetItem.id,
    label: nextLabel,
    description: metadata.description !== undefined ? String(metadata.description).trim() : (targetEv.description || ''),
    status: metadata.status && ['PENDING', 'VERIFIED', 'NEEDS_REVISION', 'REJECTED'].includes(metadata.status)
      ? metadata.status
      : targetEv.status,
    note: metadata.note !== undefined ? String(metadata.note).trim() : (targetEv.note || ''),
    updatedAt: now,
    updatedByAdmin: actor?.email || 'prp@itpln.ac.id',
  };

  const nextList = existing.map((e) => (e.id === evidenceId ? updatedEntry : e));
  const record = state.submissions?.[key] || null;
  const nextSubmissions = { ...(state.submissions || {}) };
  if (record) {
    nextSubmissions[key] = {
      ...record,
      history: history(record, record.status, `Bukti "${updatedEntry.label}" diperbarui oleh Admin PRP.`, actor, nextList),
    };
  }

  write({
    ...state,
    evidence: {
      ...state.evidence,
      [key]: nextList,
    },
    submissions: nextSubmissions,
  });

  if (normalizedEmail) {
    dispatchWorkflowNotification({
      kind: 'WORKFLOW',
      title: `Bukti Capaian Diedit Admin PRP (${updatedEntry.label})`,
      message: `Admin PRP memperbarui rincian bukti capaian "${updatedEntry.label}".`,
      targetType: 'USER',
      targetEmails: [normalizedEmail],
      actionUrl: `/internal?period=${encodeURIComponent(form.period || '2026')}&focusItem=${encodeURIComponent(updatedEntry.indicatorId)}`,
      actionLabel: 'Lihat Bukti Indikator',
      meta: { formId: form.id, evidenceId, indicatorId: updatedEntry.indicatorId },
      actor,
      sendEmail: false,
    });
  }

  return updatedEntry;
}

export function removeUnitEvidenceByAdmin(formId, targetEmail, actor, evidenceId) {
  maintenance();
  reviewer(actor);
  const state = readKpiWorkflow();
  const form = state.forms.find((f) => f.id === formId) || state.forms[state.forms.length - 1];
  if (!form) throw new Error('Formulir KPI tidak ditemukan.');
  const key = submissionKey(form.id, targetEmail);
  const existing = readUnitEvidence(form.id, targetEmail, state);
  write({
    ...state,
    evidence: {
      ...state.evidence,
      [key]: existing.filter((e) => e.id !== evidenceId),
    },
  });
}

export function removeUnitEvidence(formId, user, evidenceId) {
  const state = readKpiWorkflow();
  const form = state.forms.find((f) => f.id === formId);
  owner(form, user);
  const key = submissionKey(formId, user.email);
  if (isSubmissionLockedForActor(state.submissions[key], user)) {
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
  if (!['VERIFIED', 'NEEDS_REVISION', 'REJECTED'].includes(status)) {
    throw new Error('Bukti tidak dapat ditinjau.');
  }
  const entries = readUnitEvidence(formId, email, state);
  const reviewedEv = entries.find((e) => e.id === evidenceId);
  if (!reviewedEv) {
    throw new Error('Bukti tidak ditemukan.');
  }
  const trimmedNote = String(note || '').trim();
  if ((status === 'REJECTED' || status === 'NEEDS_REVISION') && !trimmedNote) {
    throw new Error(status === 'NEEDS_REVISION' ? 'Catatan revisi bukti wajib diisi.' : 'Alasan penolakan bukti wajib diisi.');
  }
  const now = new Date().toISOString();
  const next = entries.map((e) => (e.id === evidenceId
    ? { ...e, status, note: trimmedNote, reviewedAt: now, reviewedBy: actor?.email || null }
    : e));
  const record = state.submissions[key];
  const form = state.forms.find((f) => f.id === formId);

  const nextSubmissions = { ...(state.submissions || {}) };
  const nextDrafts = { ...(state.drafts || {}) };
  if (record) {
    const requiresUnitFix = status === 'NEEDS_REVISION' || status === 'REJECTED';
    const nextRecordStatus = requiresUnitFix ? 'NEEDS_REVISION' : record.status;
    nextSubmissions[key] = {
      ...record,
      status: nextRecordStatus,
      revisionNote: requiresUnitFix
        ? `[${status === 'REJECTED' ? 'Bukti Ditolak' : 'Revisi Bukti'}: ${reviewedEv.label}] ${trimmedNote}`
        : record.revisionNote,
      reviewedAt: requiresUnitFix ? now : record.reviewedAt,
      history: history(
        record,
        nextRecordStatus,
        `Bukti ${reviewedEv.label} (${evidenceId}): ${status}. ${trimmedNote}`.trim(),
        actor,
        next,
      ),
    };
    if (nextRecordStatus === 'NEEDS_REVISION') {
      nextDrafts[key] = {
        ...(nextDrafts[key] || {}),
        formId: form?.id || formId,
        email: String(email || '').trim().toLowerCase(),
        unit: record.unit,
        picCodes: record.picCodes || [],
        values: record.values || {},
        notes: record.notes || {},
        updatedAt: now,
      };
    }
  }

  const nextRevisions = { ...(state.revisions || {}) };
  if (form) {
    const prevFormRev = nextRevisions[form.id] || { items: {}, sections: {} };
    const nextItemsRev = { ...(prevFormRev.items || {}) };
    if (status === 'NEEDS_REVISION' || status === 'REJECTED') {
      nextItemsRev[reviewedEv.indicatorId] = {
        scope: 'ITEM',
        targetId: reviewedEv.indicatorId,
        targetColumn: 'Bukti / Gambar Capaian',
        targetEmail: String(email || '').trim().toLowerCase(),
        comment: `${status === 'REJECTED' ? 'Bukti ditolak' : 'Revisi bukti'} (${reviewedEv.label}): ${trimmedNote}`,
        status: 'NEEDS_REVISION',
        updatedAt: now,
        authorEmail: actor?.email || 'prp@itpln.ac.id',
        authorName: actor?.name || 'Admin PRP',
      };
    } else if (status === 'VERIFIED' && nextItemsRev[reviewedEv.indicatorId]?.targetColumn === 'Bukti / Gambar Capaian') {
      const stillHasFlagged = next.some((ev) => ev.indicatorId === reviewedEv.indicatorId && ev.status !== 'VERIFIED');
      if (!stillHasFlagged) {
        delete nextItemsRev[reviewedEv.indicatorId];
      }
    }
    nextRevisions[form.id] = {
      ...prevFormRev,
      items: nextItemsRev,
    };
  }

  write({
    ...state,
    evidence: { ...state.evidence, [key]: next },
    submissions: nextSubmissions,
    drafts: nextDrafts,
    revisions: nextRevisions,
  });

  if (email) {
    const needsUnitAction = status === 'REJECTED' || status === 'NEEDS_REVISION';
    dispatchWorkflowNotification({
      kind: needsUnitAction ? 'REVISION' : 'SYSTEM',
      title: status === 'NEEDS_REVISION'
        ? `Revisi Bukti / Gambar Capaian (${reviewedEv.label})`
        : status === 'REJECTED'
          ? `Bukti Capaian Ditolak (${reviewedEv.label})`
          : `Bukti Capaian Terverifikasi (${reviewedEv.label})`,
      message: status === 'NEEDS_REVISION'
        ? `Admin PRP meminta revisi pada bukti/gambar "${reviewedEv.label}": ${trimmedNote}`
        : status === 'REJECTED'
          ? `Admin PRP menolak bukti "${reviewedEv.label}" dengan catatan: ${trimmedNote}`
          : `Bukti "${reviewedEv.label}" telah diverifikasi oleh Admin PRP.`,
      targetType: 'USER',
      targetEmails: [email],
      actionUrl: `/internal?period=${encodeURIComponent(form?.period || '2026')}&focusItem=${encodeURIComponent(reviewedEv.indicatorId || '')}`,
      actionLabel: 'Perbaiki Bukti Indikator',
      meta: { formId, evidenceId, indicatorId: reviewedEv.indicatorId || null, status },
      actor,
      sendEmail: needsUnitAction,
      emailRecipients: [email],
      emailSubject: `[PORTAL KPI ITPLN] ${status === 'NEEDS_REVISION' ? 'Permintaan Revisi Bukti / Gambar KPI' : status === 'REJECTED' ? 'Penolakan Bukti Capaian KPI' : 'Verifikasi Bukti Capaian KPI'}`,
      emailBody: needsUnitAction
        ? `Yth. Unit Kerja,\n\nTim Admin PRP ITPLN meminta tindak lanjut atas bukti capaian "${reviewedEv.label}":\nCatatan PRP: "${trimmedNote}"\n\nSilakan masuk ke Portal Kinerja ITPLN untuk mengganti atau merevisi gambar/dokumen bukti tersebut.`
        : undefined,
    });
  }

  return next.find((e) => e.id === evidenceId) || reviewedEv;
}

const pruneStateHistoryForQuota = (state) => {
  if (!state || typeof state !== 'object') return state;
  const prunedSubmissions = {};
  for (const [k, sub] of Object.entries(state.submissions || {})) {
    if (!sub || typeof sub !== 'object') continue;
    prunedSubmissions[k] = {
      ...sub,
      history: (Array.isArray(sub.history) ? sub.history.slice(-3) : []).map((h) => ({
        ...h,
        snapshot: h?.snapshot
          ? {
              ...h.snapshot,
              evidence: stripEvidenceDataUrl(h.snapshot.evidence),
            }
          : h?.snapshot,
      })),
    };
  }
  return {
    ...state,
    submissions: prunedSubmissions,
  };
};

const write = (state, options = {}) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    try {
      const compactState = pruneStateHistoryForQuota(state);
      localStorage.setItem(KEY, JSON.stringify(compactState));
    } catch {
      // Abaikan bila kuota penyimpanan browser tetap penuh
    }
  }
  if (!options.skipAudit) {
    const entries = read('prp_audit', []);
    const latest = Object.values(state.submissions || {})
      .flatMap((record) => record.history || [])
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    const signature = latest
      ? `${latest.at}:${latest.status}:${latest.note}`
      : `forms:${state.forms.length}:evidence:${Object.values(state.evidence || {}).reduce((sum, list) => sum + (list?.length || 0), 0)}:drafts:${Object.keys(state.drafts || {}).length}`;
    if (entries[0]?.workflowSignature !== signature) {
      try {
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
      } catch {
        // Abaikan kegagalan kuota pada log audit lokal
      }
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
    if (!event.key || event.key === KEY || event.key === 'prp_kpi_config' || event.key === SPI_AUDIT_KEY) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener(SPI_AUDIT_EVENT, callback);
  window.addEventListener('prp-kpi-config-updated', callback);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener(SPI_AUDIT_EVENT, callback);
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
      const lockReason = !isOpen ? (deadlinePassed ? 'Melewati Tenggat Waktu' : 'Periode Historis / Terkunci') : 'Terbuka untuk Pengisian';
      return {
        year: String(yearStr),
        id: String(yearStr),
        label: `Periode Evaluasi ${yearStr}`,
        name: `Periode Evaluasi ${yearStr}`,
        status: isOpen ? 'Active' : 'Archived',
        inputOpen: isOpen,
        isOpenForInput: isOpen,
        isLocked: !isOpen,
        lockReason,
        statusLabel: lockReason,
        deadline: sysDeadline,
      };
    }
    const effectiveEnd = periodObj.end;
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
    const resolvedLabel = periodObj.label || periodObj.name || `Periode Evaluasi ${yearStr}`;
    return {
      year: String(yearStr),
      id: periodObj.id || String(yearStr),
      label: resolvedLabel,
      name: resolvedLabel,
      status: periodObj.status || (isOpen ? 'Active' : 'Archived'),
      inputOpen: isOpen,
      isOpenForInput: isOpen,
      isLocked: !isOpen,
      lockReason,
      statusLabel: lockReason,
      deadline,
      start: periodObj.start || null,
      end: periodObj.end || null,
    };
  };

  (Array.isArray(rawPeriods) ? rawPeriods : []).forEach((p) => {
    const ymAll = String(p.id || p.start || p.label || p.end || '').match(/\b(20\d{2})\b/g);
    const yearKey = ymAll && ymAll.length ? ymAll[0] : String(p.id || p.label || '2026');
    const prev = byYear.get(yearKey);
    const evaluated = evaluateStatus(p, yearKey);
    if (!prev || (!prev.inputOpen && evaluated.inputOpen)) {
      byYear.set(yearKey, evaluated);
    }
    if (p.id && String(p.id) !== yearKey && byYear.get(yearKey)?.id !== p.id) {
      byYear.set(String(p.id), evaluated);
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
  const cleanPeriod = String(period || new Date().getFullYear()).trim();

  let existingIdx = -1;
  for (let i = state.forms.length - 1; i >= 0; i -= 1) {
    if (String(state.forms[i]?.period || '').trim() === cleanPeriod) {
      existingIdx = i;
      break;
    }
  }

  let form;
  let nextForms;
  if (existingIdx >= 0) {
    const prevForm = state.forms[existingIdx];
    form = {
      ...prevForm,
      version: (Number(prevForm.version) || state.forms.length) + 1,
      period: cleanPeriod,
      sections: normalized,
      units,
      structureRevision: (Number(prevForm.structureRevision) || 1) + 1,
      sentAt: new Date().toISOString(),
    };
    nextForms = state.forms.map((f, idx) => (idx === existingIdx ? form : f));
  } else {
    form = {
      id: createId('form'),
      version: state.forms.length + 1,
      period: cleanPeriod,
      sections: normalized,
      units,
      sentAt: new Date().toISOString(),
    };
    nextForms = [...state.forms, form];
  }

  write({ ...state, forms: nextForms });
  publishKpiSections(normalized, { actor: actor?.email || 'Superadmin PRP', snapshot: true, note: `Distribusi periode ${cleanPeriod} (${form.id})` });
  dispatchWorkflowNotification({
    kind: 'STRUCTURE_SYNC',
    title: `Formulir Evaluasi KPI Periode ${cleanPeriod} Didistribusikan`,
    message: `Admin PRP telah mendistribusikan struktur tabel KPI periode ${cleanPeriod} ke seluruh unit kerja PIC. Silakan buka lembar kerja untuk mengisi capaian unit Anda.`,
    targetType: 'ALL',
    actionUrl: `/internal/kpi?period=${encodeURIComponent(cleanPeriod)}`,
    actionLabel: 'Buka Lembar Kerja KPI',
    meta: { formId: form.id, period: cleanPeriod },
    actor,
  });
  return form;
}

export function getUnitKpiForm(email, state = readKpiWorkflow(), period = null) {
  const normalizedEmail = email?.toLowerCase();
  if (!normalizedEmail || !state.forms?.length) return null;
  const isSpiAccount = normalizedEmail === 'spi@itpln.ac.id'
    || [...MOCK_ACCOUNTS, ...read('prp_users', [])].some((u) => u?.email?.toLowerCase() === normalizedEmail && u?.role === 'spi');
  if (period) {
    const periodMatch = [...state.forms].reverse().find(
      (form) => doesFormMatchPeriod(form, period) && (isSpiAccount || form.units?.some((unit) => unit.email === normalizedEmail)),
    );
    if (periodMatch) return periodMatch;
    const isActiveKpiUnitForPeriod = isSpiAccount || getKpiUnits().some((unit) => unit.email === normalizedEmail);
    if (isActiveKpiUnitForPeriod) {
      const anyPeriodForm = [...state.forms].reverse().find((form) => doesFormMatchPeriod(form, period));
      if (anyPeriodForm) return anyPeriodForm;
    }
  }
  const directMatch = [...state.forms].reverse().find((form) => form.units?.some((unit) => unit.email === normalizedEmail));
  if (directMatch) return directMatch;
  const isActiveKpiUnit = isSpiAccount || getKpiUnits().some((unit) => unit.email === normalizedEmail);
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

/** Simpan edit langsung Admin PRP terhadap isian & status unit tertentu (baik sebelum kirim, draft, dikirim, maupun revisi). */
export function saveUnitKpiByAdmin(formId, targetEmail, actor, {
  values = {},
  notes = {},
  statusTransition = null,
  revisionNote = '',
} = {}) {
  maintenance();
  reviewer(actor);
  const state = readKpiWorkflow();
  const form = state.forms.find((entry) => entry.id === formId) || state.forms[state.forms.length - 1];
  if (!form) throw new Error('Formulir KPI tidak ditemukan.');

  const normalizedEmail = String(targetEmail || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Akun unit target tidak valid.');

  const targetUnit = (form.units || []).find((u) => u.email?.toLowerCase() === normalizedEmail)
    || getKpiUnits().find((u) => u.email?.toLowerCase() === normalizedEmail)
    || { email: normalizedEmail, name: normalizedEmail, picCodes: [] };

  const unitProxy = {
    role: 'kpi_only',
    status: 'Aktif',
    email: normalizedEmail,
    unit: targetUnit.name,
    picCodes: targetUnit.picCodes || [],
  };

  const hasPicScope = Array.isArray(targetUnit.picCodes) && targetUnit.picCodes.length > 0;
  const scopedEntries = hasPicScope
    ? getEditableItemsForUser(form, unitProxy)
    : (form.sections || []).flatMap((section) => (section.items || []).map((item) => ({ section, item })));

  const allowedSubKeys = new Set();
  const allowedItemIds = new Set();
  scopedEntries.forEach(({ item }) => {
    allowedItemIds.add(item.id);
    (item.subrows || []).forEach((sub) => allowedSubKeys.add(sub.key));
  });

  const sKey = submissionKey(form.id, normalizedEmail);
  const existingSub = state.submissions?.[sKey] || null;
  const existingDraft = state.drafts?.[sKey] || null;

  const baseValues = { ...(existingDraft?.values || {}), ...(existingSub?.values || {}) };
  const nextValues = { ...baseValues };
  Object.entries(values || {}).forEach(([subKey, rawVal]) => {
    if (!allowedSubKeys.has(subKey)) return;
    const str = String(rawVal ?? '').trim();
    if (str === '') {
      delete nextValues[subKey];
    } else {
      nextValues[subKey] = rawVal;
    }
  });

  const baseNotes = { ...(existingDraft?.notes || {}), ...(existingSub?.notes || {}) };
  const nextNotes = { ...baseNotes };
  Object.entries(notes || {}).forEach(([itemId, rawNote]) => {
    if (!allowedItemIds.has(itemId)) return;
    const str = String(rawNote ?? '').trim();
    if (str === '') {
      delete nextNotes[itemId];
    } else {
      nextNotes[itemId] = str;
    }
  });

  const integrated = readIntegratedKpiBoard(form.id, state);
  const evalValues = { ...integrated.values, ...nextValues };
  const sectionBuckets = new Map();
  scopedEntries.forEach(({ section, item }) => {
    const computed = computeKpiItem(item, evalValues, section.isPenaltySection, form.sections);
    if (!sectionBuckets.has(section.code)) {
      sectionBuckets.set(section.code, { code: section.code, title: section.title, score: 0 });
    }
    if (computed.ratioPercent !== null) {
      sectionBuckets.get(section.code).score += computed.weightedScore || 0;
    }
  });
  const sectionScores = [...sectionBuckets.values()];
  const totalScore = Math.min(100, Math.max(-25, sectionScores.reduce((sum, s) => sum + s.score, 0)));

  const now = new Date().toISOString();
  const evList = readUnitEvidence(form.id, normalizedEmail, state);
  const trimmedNote = String(revisionNote || '').trim();
  const nextSubmissions = { ...(state.submissions || {}) };
  const nextDrafts = { ...(state.drafts || {}) };
  const nextAdminOverrides = { ...(state.adminOverrides || {}) };

  // Sinkronkan agar override lama di item unit yang baru diedit tidak menimpa data unit terbaru
  if (nextAdminOverrides[form.id]) {
    const cleanedOverrideVals = { ...(nextAdminOverrides[form.id].values || {}) };
    const cleanedOverrideNotes = { ...(nextAdminOverrides[form.id].notes || {}) };
    allowedSubKeys.forEach((k) => { delete cleanedOverrideVals[k]; });
    allowedItemIds.forEach((id) => { delete cleanedOverrideNotes[id]; });
    nextAdminOverrides[form.id] = {
      ...nextAdminOverrides[form.id],
      values: cleanedOverrideVals,
      notes: cleanedOverrideNotes,
    };
  }

  let resultRecord = existingSub;

  if (statusTransition === 'DRAFT' || (!existingSub && !statusTransition)) {
    nextDrafts[sKey] = {
      formId: form.id,
      email: normalizedEmail,
      unit: targetUnit.name,
      picCodes: targetUnit.picCodes || [],
      values: nextValues,
      notes: nextNotes,
      updatedAt: now,
      updatedByAdmin: actor?.email || 'prp@itpln.ac.id',
    };
    if (statusTransition === 'DRAFT' && existingSub) {
      delete nextSubmissions[sKey];
      resultRecord = null;
    }
  } else {
    const nextStatus = statusTransition || existingSub?.status || 'SUBMITTED';
    const historyNote = trimmedNote || (statusTransition && statusTransition !== existingSub?.status
      ? `Nilai diperbarui dan status ditetapkan ke ${statusTransition} oleh Admin PRP`
      : 'Isian capaian dan keterangan disesuaikan langsung oleh Admin PRP');

    resultRecord = {
      ...(existingSub || {
        formId: form.id,
        email: normalizedEmail,
        unit: targetUnit.name,
        picCodes: targetUnit.picCodes || [],
        assignedIndicatorIds: scopedEntries.map(({ item }) => item.id),
        submittedAt: now,
        submittedBy: actor?.email || normalizedEmail,
      }),
      unit: targetUnit.name,
      picCodes: targetUnit.picCodes || [],
      assignedIndicatorIds: scopedEntries.map(({ item }) => item.id),
      status: nextStatus,
      values: nextValues,
      notes: nextNotes,
      sectionScores,
      totalScore,
      updatedAt: now,
      reviewedAt: now,
      reviewedBy: actor?.email || 'prp@itpln.ac.id',
      revisionNote: trimmedNote || (nextStatus === 'APPROVED' || nextStatus === 'LOCKED' ? '' : (existingSub?.revisionNote || '')),
      history: history(existingSub, nextStatus, historyNote, actor, evList),
    };
    nextSubmissions[sKey] = resultRecord;

    if (nextStatus === 'NEEDS_REVISION') {
      nextDrafts[sKey] = {
        formId: form.id,
        email: normalizedEmail,
        unit: targetUnit.name,
        picCodes: targetUnit.picCodes || [],
        values: nextValues,
        notes: nextNotes,
        updatedAt: now,
        updatedByAdmin: actor?.email || 'prp@itpln.ac.id',
      };
    } else {
      delete nextDrafts[sKey];
    }
  }

  write({
    ...state,
    submissions: nextSubmissions,
    drafts: nextDrafts,
    adminOverrides: nextAdminOverrides,
  });

  const actionDesc = trimmedNote
    ? `Admin PRP memperbarui data unit ${targetUnit.name} (${trimmedNote}).`
    : `Admin PRP menyesuaikan isian/status KPI unit ${targetUnit.name} secara langsung.`;

  dispatchWorkflowNotification({
    kind: statusTransition === 'NEEDS_REVISION' ? 'REVISION' : 'WORKFLOW',
    title: `Pembaruan KPI Unit oleh Admin PRP (${targetUnit.name})`,
    message: actionDesc,
    targetType: 'USER',
    targetEmails: [normalizedEmail],
    actionUrl: `/internal?period=${encodeURIComponent(form.period || '2026')}`,
    actionLabel: 'Buka Lembar KPI Unit',
    meta: { formId: form.id, period: form.period, email: normalizedEmail },
    actor,
    sendEmail: Boolean(trimmedNote || statusTransition),
    emailRecipients: [normalizedEmail],
    emailSubject: `[PERFORMA KPI - Periode ${form.period}] Pembaruan Data Unit ${targetUnit.name}`,
    emailBody: `Yth. ${targetUnit.name},\n\n${actionDesc}\nPeriode: ${form.period}\n\nSilakan masuk ke Portal Kinerja ITPLN untuk meninjau pembaruan tersebut.`,
  });

  return {
    record: resultRecord,
    draft: nextDrafts[sKey] || null,
    totalScore,
    sectionScores,
  };
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
  targetColumn = '',
  targetEmail = '',
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

  const normalizedColumn = String(targetColumn || '').trim();
  const scopedTargetEmail = String(targetEmail || '').trim().toLowerCase();
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
        targetColumn: normalizedColumn,
        targetEmail: scopedTargetEmail,
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
        targetColumn: normalizedColumn,
        targetEmail: scopedTargetEmail,
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

  const columnTag = normalizedColumn && normalizedColumn !== 'Semua Kolom' ? ` [${normalizedColumn}]` : '';
  const nextSubmissions = { ...(state.submissions || {}) };
  const affectedUnitEmails = new Set();

  if (trimmedComment && !resolved && (affectedItems.length > 0 || scopedTargetEmail)) {
    const unitPool = scopedTargetEmail
      ? (form.units || []).filter((unit) => unit.email?.toLowerCase() === scopedTargetEmail)
      : (form.units || []);

    if (scopedTargetEmail && unitPool.length === 0) {
      affectedUnitEmails.add(scopedTargetEmail);
    }

    unitPool.forEach((unit) => {
      const fakeUser = { role: 'kpi_only', status: 'Aktif', email: unit.email, picCodes: unit.picCodes, unit: unit.name };
      const matchesUnit = scopedTargetEmail
        ? unit.email.toLowerCase() === scopedTargetEmail
        : affectedItems.some((it) => canUserEditKpiItem(it, fakeUser));
      if (matchesUnit) {
        affectedUnitEmails.add(unit.email.toLowerCase());
        const sKey = submissionKey(form.id, unit.email);
        const existingSub = nextSubmissions[sKey];
        if (existingSub && ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(existingSub.status)) {
          const ev = readUnitEvidence(form.id, unit.email, state);
          nextSubmissions[sKey] = {
            ...existingSub,
            status: 'NEEDS_REVISION',
            revisionNote: `[${targetLabel}${columnTag}] ${trimmedComment}`,
            reviewedAt: now,
            history: history(existingSub, 'NEEDS_REVISION', `Catatan Revisi PRP (${targetLabel}${columnTag}): ${trimmedComment}`, actor, ev),
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
      title: `Catatan Revisi PRP: ${targetLabel}${columnTag}`,
      message: `Admin PRP memberikan catatan revisi pada ${targetLabel}${columnTag}: "${trimmedComment}". Silakan perbaiki isian atau bukti pendukung Anda.`,
      targetType: recipientEmails.length > 0 ? 'USER' : (affectedPics.length > 0 ? 'PIC' : 'ALL'),
      targetEmails: recipientEmails,
      targetPicCodes: affectedPics,
      actionUrl: `/internal?period=${encodeURIComponent(form.period || '2026')}${focusParam}`,
      actionLabel: 'Perbaiki Baris Indikator',
      meta: {
        formId: form.id,
        period: form.period,
        scope,
        targetId: normalizedTarget,
        targetColumn: normalizedColumn,
        picCodes: affectedPics,
      },
      actor,
      sendEmail: recipientEmails.length > 0,
      emailRecipients: recipientEmails,
      emailSubject: `[REVISI KPI ITPLN - Periode ${form.period}] ${targetLabel}${columnTag}`,
      emailBody: `Yth. Bapak/Ibu PIC (${affectedPics.join(', ') || 'Unit Kerja'}),\n\nTim Admin PRP ITPLN telah mengirimkan catatan revisi evaluasi KPI pada:\nTarget: ${targetLabel}${columnTag ? `\nKolom Spesifik: ${normalizedColumn}` : ''}\nPeriode: ${form.period}\nCatatan Revisi: "${trimmedComment}"\n\nSilakan masuk ke Portal Kinerja ITPLN untuk menindaklanjuti revisi tersebut.`,
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

export function resetUnitKpiByAdmin(formId, targetEmail, actor = null) {
  reviewer(actor);
  const state = readKpiWorkflow();
  const key = submissionKey(formId, targetEmail);
  const nextDrafts = { ...(state.drafts || {}) };
  const nextSubmissions = { ...(state.submissions || {}) };
  const nextEvidence = { ...(state.evidence || {}) };
  delete nextDrafts[key];
  delete nextSubmissions[key];
  delete nextEvidence[key];
  write({
    ...state,
    drafts: nextDrafts,
    submissions: nextSubmissions,
    evidence: nextEvidence,
  });
}

export function resetAllFormKpiData(formId, actor = null) {
  reviewer(actor);
  const state = readKpiWorkflow();
  const targetId = formId || state.forms[state.forms.length - 1]?.id;
  if (!targetId) return;
  const prefix = `${targetId}:`;
  const nextDrafts = Object.fromEntries(Object.entries(state.drafts || {}).filter(([k]) => !k.startsWith(prefix)));
  const nextSubmissions = Object.fromEntries(Object.entries(state.submissions || {}).filter(([k]) => !k.startsWith(prefix)));
  const nextEvidence = Object.fromEntries(Object.entries(state.evidence || {}).filter(([k]) => !k.startsWith(prefix)));
  const nextOverrides = { ...(state.adminOverrides || {}) };
  delete nextOverrides[targetId];
  const nextRevisions = { ...(state.revisions || {}) };
  delete nextRevisions[targetId];
  write({
    ...state,
    drafts: nextDrafts,
    submissions: nextSubmissions,
    evidence: nextEvidence,
    adminOverrides: nextOverrides,
    revisions: nextRevisions,
  });
}

export function saveUnitKpiDraft(formId, user, { values = {}, notes = {} } = {}) {
  const state = readKpiWorkflow();
  const form = state.forms.find((entry) => entry.id === formId);
  owner(form, user);
  const key = submissionKey(formId, user.email);
  const previous = state.submissions[key];
  if (isSubmissionLockedForActor(previous, user)) {
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

  if (user.role === 'spi') {
    const d5Item = form.sections?.flatMap((s) => s.items || []).find((it) => it.id === 'D_5');
    const subKeyUn = d5Item?.subrows?.[0]?.key || 'd_5_un';
    const subKeyTot = d5Item?.subrows?.[1]?.key || 'd_5_tot';
    const currentSpi = readSpiAuditForForm(form.id);
    writeSpiAuditRecord(
      {
        ...currentSpi,
        isDraft: true,
        items: {
          D_5: {
            ...(currentSpi.items?.D_5 || {}),
            indicatorId: 'D_5',
            isDraft: true,
            status: 'DRAFT',
            unfollowedCount: String(filteredValues[subKeyUn] ?? ''),
            totalRecommendations: String(filteredValues[subKeyTot] ?? ''),
            auditNote: String(filteredNotes.D_5 ?? ''),
            evidenceList: stripEvidenceDataUrl(readUnitEvidence(form.id, user.email)),
            updatedBy: user.email.toLowerCase(),
            updatedByName: user.name || user.unit || 'SPI ITPLN',
            updatedAt: draft.updatedAt,
          },
        },
        updatedBy: user.email.toLowerCase(),
        updatedByName: user.name || user.unit || 'SPI ITPLN',
        updatedAt: draft.updatedAt,
      },
      user,
      `Draft Bagian D.5 SPI disimpan real-time (${form.period})`,
    );
  }
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

export function readIntegratedKpiBoard(formId, state = readKpiWorkflow(), { confirmedOnly = false } = {}) {
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
  const boardUnits = [...(form.units || [])];
  if (!boardUnits.some((u) => u.email?.toLowerCase() === 'spi@itpln.ac.id')) {
    const spiKey = submissionKey(form.id, 'spi@itpln.ac.id');
    if (state.submissions?.[spiKey] || state.drafts?.[spiKey] || (state.evidence?.[spiKey]?.length > 0)) {
      boardUnits.push({
        email: 'spi@itpln.ac.id',
        name: 'Satuan Pengawasan Intern (SPI)',
        picCodes: ['SPI'],
      });
    }
  }
  boardUnits.forEach((unit) => {
    const key = submissionKey(form.id, unit.email);
    const sub = state.submissions?.[key];
    const draft = state.drafts?.[key];
    const ev = state.evidence?.[key] || [];
    if (confirmedOnly) {
      if (sub && (sub.status === 'APPROVED' || sub.status === 'LOCKED')) {
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
      }
      return;
    }
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

  const totalScore = Math.min(100, Math.max(-25, sectionScores.reduce((sum, s) => sum + s.score, 0)));

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

  const renbangValidation = evaluateRenbangValidationStatus(form.id, state);
  const spiAudit = readSpiAuditForForm(form.id, state);

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
    renbangValidation,
    spiAudit,
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
  if (isSubmissionLockedForActor(previous, user)) {
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
  const evalValues = { ...(form.sharedValues || {}), ...integrated.values, ...sanitizedValues };

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

  const evidence = unitEvidence.map((e) => (
    e.status === 'VERIFIED'
      ? { ...e }
      : {
          ...e,
          status: 'PENDING',
          note: '',
          reviewedAt: null,
          reviewedBy: null,
        }
  ));

  const rawTotalScore = sectionScores.reduce((sum, section) => sum + section.score, 0);
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
    totalScore: Math.min(100, Math.max(-25, rawTotalScore)),
  };
  record.history = history(previous, 'SUBMITTED', 'Dikirim unit ke sistem pusat PRP', user, evidence);
  record.history[record.history.length - 1].snapshot = clone({
    values: sanitizedValues,
    notes: sanitizedNotes,
    sectionScores,
    totalScore: record.totalScore,
    evidence: stripEvidenceDataUrl(evidence),
  });

  const nextDrafts = { ...(state.drafts || {}) };
  delete nextDrafts[key];

  write({
    ...state,
    drafts: nextDrafts,
    evidence: { ...state.evidence, [key]: evidence },
    submissions: { ...state.submissions, [key]: record },
  });

  if (user.role === 'spi') {
    const d5Item = form.sections?.flatMap((s) => s.items || []).find((it) => it.id === 'D_5');
    const subKeyUn = d5Item?.subrows?.[0]?.key || 'd_5_un';
    const subKeyTot = d5Item?.subrows?.[1]?.key || 'd_5_tot';
    const currentSpi = readSpiAuditForForm(form.id);
    writeSpiAuditRecord(
      {
        ...currentSpi,
        items: {
          D_5: {
            ...(currentSpi.items?.D_5 || {}),
            indicatorId: 'D_5',
            unfollowedCount: String(sanitizedValues[subKeyUn] ?? ''),
            totalRecommendations: String(sanitizedValues[subKeyTot] ?? ''),
            auditNote: String(sanitizedNotes.D_5 ?? ''),
            evidenceList: evidence,
            updatedBy: user.email.toLowerCase(),
            updatedByName: user.name || user.unit || 'SPI ITPLN',
            updatedAt: record.submittedAt,
          },
        },
        updatedBy: user.email.toLowerCase(),
        updatedByName: user.name || user.unit || 'SPI ITPLN',
        updatedAt: record.submittedAt,
      },
      user,
      `Capaian Bagian D.5 SPI dikirim ke pusat (${form.period})`,
    );
  }
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

  const reviewedAt = new Date().toISOString();
  const next = {
    ...record,
    status,
    revisionNote: note.trim(),
    reviewedAt,
    history: history(record, status, note.trim(), actor, evidence),
  };
  const nextDrafts = { ...(state.drafts || {}) };
  if (['NEEDS_REVISION', 'REJECTED'].includes(status)) {
    nextDrafts[key] = {
      formId,
      email: email.toLowerCase(),
      values: { ...(record.values || {}) },
      notes: { ...(record.notes || {}) },
      updatedAt: reviewedAt,
    };
  }
  const nextForms = (state.forms || []).map((f) => {
    if (f.id !== formId) return f;
    if (['NEEDS_REVISION', 'REJECTED'].includes(status)) {
      return { ...f, renbangValidatedFinal: false };
    }
    if (['APPROVED', 'LOCKED'].includes(status)) {
      return { ...f, renbangExplicitlyLocked: false };
    }
    return f;
  });
  write({ ...state, drafts: nextDrafts, forms: nextForms, submissions: { ...state.submissions, [key]: next } });

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

/**
 * Mengevaluasi progres validasi akhir dari Renbang (PRP) pada satu formulir periode.
 * Tabel Audit KPI (Read-Only) di akun SPI otomatis terbuka segera setelah validasi Renbang mencapai 100%,
 * dan wajib terkunci ("Akses masih tertutup") selama masih ada unit yang belum tervalidasi final.
 */
export function evaluateRenbangValidationStatus(formId, state = readKpiWorkflow()) {
  const form = state?.forms?.find((entry) => entry.id === formId)
    || getFormForPeriod(formId, state, { fallbackToLatest: true })
    || null;

  if (!form) {
    return {
      formId: null,
      period: '2026',
      totalUnits: 0,
      validatedUnits: 0,
      submittedUnits: 0,
      draftUnits: 0,
      pendingUnits: 0,
      progressPercent: 0,
      isValidated100: false,
      renbangValidatedFinal: false,
      renbangExplicitlyLocked: false,
      renbangValidatedAt: null,
      renbangValidatedBy: null,
      renbangValidationNote: '',
      statusLabel: 'Akses masih tertutup',
      unitBreakdown: [],
    };
  }

  const serverSummary = form.renbangValidationSummary || state?.validationByFormId?.[form.id] || null;
  const rawUnits = Array.isArray(form.units) && form.units.length > 0 ? form.units : getKpiUnits();
  const scopedUnits = rawUnits.filter((unit) => {
    const email = String(unit?.email || '').trim().toLowerCase();
    if (!email || email === 'spi@itpln.ac.id') return false;
    const assigned = getEditableItemsForUser(form, {
      role: 'kpi_only',
      status: 'Aktif',
      email,
      picCodes: unit.picCodes || [],
      unit: unit.name,
    });
    return assigned.length > 0;
  });
  const effectiveUnits = scopedUnits.length > 0
    ? scopedUnits
    : rawUnits.filter((u) => String(u?.email || '').toLowerCase() !== 'spi@itpln.ac.id');

  const unitBreakdown = effectiveUnits.map((unit) => {
    const key = submissionKey(form.id, unit.email);
    const sub = state.submissions?.[key] || null;
    const draft = state.drafts?.[key] || null;
    const rawStatus = sub?.status || (draft ? 'DRAFT' : 'BELUM_MENGISI');
    const isValidated = rawStatus === 'APPROVED' || rawStatus === 'LOCKED' || Boolean(form.renbangValidatedFinal && !form.renbangExplicitlyLocked);
    return {
      email: unit.email,
      name: unit.name,
      picCodes: unit.picCodes || [],
      status: isValidated && !['APPROVED', 'LOCKED'].includes(rawStatus) ? 'APPROVED' : rawStatus,
      isValidated,
      reviewedAt: sub?.reviewedAt || form.renbangValidatedAt || null,
    };
  });

  let totalUnits = unitBreakdown.length;
  let validatedUnits = unitBreakdown.filter((u) => u.isValidated).length;
  const submittedUnits = unitBreakdown.filter((u) => u.status === 'SUBMITTED').length;
  const draftUnits = unitBreakdown.filter((u) => u.status === 'DRAFT' || u.status === 'NEEDS_REVISION').length;

  // Jika state.submissions disaring oleh backend karena SPI belum tervalidasi 100%, gunakan ringkasan otoritatif server
  const hasAnyLocalSub = Object.keys(state.submissions || {}).some((k) => k.startsWith(`${form.id}:`));
  if (!hasAnyLocalSub && serverSummary && typeof serverSummary === 'object') {
    totalUnits = Number(serverSummary.totalUnits) || totalUnits;
    validatedUnits = Number(serverSummary.validatedUnits) || 0;
  }

  const isExplicitlyLocked = Boolean(form.renbangExplicitlyLocked);
  const isValidated100 = !isExplicitlyLocked && (
    Boolean(form.renbangValidatedFinal)
    || Boolean(serverSummary?.isValidated100 && !hasAnyLocalSub)
    || (totalUnits > 0 && validatedUnits === totalUnits)
  );

  if (isValidated100 && validatedUnits < totalUnits) {
    validatedUnits = totalUnits;
  }

  const pendingUnits = Math.max(0, totalUnits - validatedUnits);
  const progressPercent = isValidated100
    ? 100
    : (totalUnits > 0 ? Math.min(99, Math.floor((validatedUnits / totalUnits) * 100)) : 0);

  return {
    formId: form.id,
    period: String(form.period || '2026'),
    totalUnits,
    validatedUnits,
    submittedUnits,
    draftUnits,
    pendingUnits,
    progressPercent,
    isValidated100,
    renbangValidatedFinal: Boolean(form.renbangValidatedFinal && !isExplicitlyLocked),
    renbangExplicitlyLocked: isExplicitlyLocked,
    renbangValidatedAt: form.renbangValidatedAt || null,
    renbangValidatedBy: form.renbangValidatedBy || null,
    renbangValidationNote: form.renbangValidationNote || '',
    statusLabel: isValidated100
      ? 'Terbuka (100% Tervalidasi Renbang)'
      : 'Akses masih tertutup',
    unitBreakdown,
  };
}

/**
 * Mengizinkan Admin Renbang (Superadmin PRP) mengesahkan validasi final 100% seluruh data KPI periode
 * untuk membuka otomatis Tabel Audit KPI (Read-Only) di akun SPI, atau menguncinya kembali bila masih ditinjau.
 */
export function setRenbangFinalValidation(formId, isValidated, actor, { approveAllSubmitted = true, note = '' } = {}) {
  maintenance();
  reviewer(actor);
  const state = readKpiWorkflow();
  const form = state.forms.find((entry) => entry.id === formId)
    || getFormForPeriod(formId, state, { fallbackToLatest: true })
    || null;
  if (!form) {
    throw new Error('Formulir evaluasi KPI tidak ditemukan.');
  }

  const now = new Date().toISOString();
  const trimmedNote = String(note || '').trim();
  const nextSubmissions = { ...(state.submissions || {}) };
  const nextEvidence = { ...(state.evidence || {}) };

  if (isValidated) {
    if (approveAllSubmitted !== false) {
      (form.units || []).forEach((unit) => {
        const key = submissionKey(form.id, unit.email);
        const sub = nextSubmissions[key];
        const evList = nextEvidence[key] || [];
        if (evList.length > 0) {
          nextEvidence[key] = evList.map((ev) => (
            ev.status === 'PENDING'
              ? { ...ev, status: 'VERIFIED', reviewedAt: now, reviewedBy: actor?.email || 'prp@itpln.ac.id' }
              : ev
          ));
        }
        if (sub && sub.status === 'SUBMITTED') {
          nextSubmissions[key] = {
            ...sub,
            status: 'APPROVED',
            reviewedAt: now,
            reviewedBy: actor?.email || 'prp@itpln.ac.id',
            revisionNote: trimmedNote || sub.revisionNote || '',
            history: history(
              sub,
              'APPROVED',
              trimmedNote || 'Disahkan dalam Validasi Final 100% Renbang (PRP)',
              actor,
              nextEvidence[key] || evList,
            ),
          };
        }
      });
    }
  }

  const updatedForm = {
    ...form,
    renbangValidatedFinal: Boolean(isValidated),
    renbangExplicitlyLocked: !isValidated,
    renbangValidatedAt: isValidated ? now : null,
    renbangValidatedBy: isValidated ? (actor?.email || 'prp@itpln.ac.id') : null,
    renbangValidatedByName: isValidated ? (actor?.name || 'Admin Renbang / PRP') : null,
    renbangValidationNote: trimmedNote,
  };
  delete updatedForm.renbangValidationSummary;

  const nextForms = state.forms.map((f) => (f.id === form.id ? updatedForm : f));
  write({
    ...state,
    forms: nextForms,
    submissions: nextSubmissions,
    evidence: nextEvidence,
  });

  dispatchWorkflowNotification({
    kind: 'WORKFLOW',
    title: isValidated
      ? `Validasi Final 100% Renbang Selesai (Periode ${form.period}) · Akses Audit SPI Terbuka`
      : `Akses Tabel Audit KPI SPI Dikunci Kembali (Periode ${form.period})`,
    message: isValidated
      ? `Pihak Renbang (PRP) telah menyelesaikan validasi final 100% data KPI periode ${form.period}. Menu Tabel Audit KPI (Read-Only) pada akun SPI kini terbuka secara otomatis.`
      : `Pihak Renbang (PRP) membuka kembali proses validasi data KPI periode ${form.period}. Menu Tabel Audit KPI pada akun SPI dikunci sementara ("Akses masih tertutup").`,
    targetType: 'ROLE',
    targetRoles: ['spi'],
    actionUrl: `/internal?period=${encodeURIComponent(form.period || '2026')}&spiView=audit-table`,
    actionLabel: isValidated ? 'Buka Tabel Audit KPI SPI' : 'Lihat Status Validasi',
    meta: { formId: form.id, period: form.period, isValidated100: Boolean(isValidated) },
    actor,
  });

  return evaluateRenbangValidationStatus(form.id, readKpiWorkflow());
}

function spiActorGuard() {
  throw new Error('Akun Verifikasi SPI bersifat ketat Hanya Lihat (Read-Only) tanpa wewenang mengedit data, mengubah status, maupun mengisi umpan balik.');
}

export function readSpiAuditStore() {
  const raw = read(SPI_AUDIT_KEY, { records: {}, byForm: {}, updatedAt: null });
  const recordsMap = (raw && typeof raw.records === 'object' && Object.keys(raw.records).length > 0)
    ? raw.records
    : (raw && typeof raw.byForm === 'object' ? raw.byForm : {});
  return {
    records: recordsMap,
    byForm: recordsMap,
    updatedAt: raw?.updatedAt || null,
  };
}

export function readSpiAuditForForm(formId, state = readKpiWorkflow()) {
  const form = state?.forms?.find((entry) => entry.id === formId)
    || getFormForPeriod(formId, state, { fallbackToLatest: true })
    || null;
  const resolvedId = form?.id || String(formId || 'default');
  const store = readSpiAuditStore();
  let record = store.records?.[resolvedId] || null;
  if (!record && form?.period) {
    record = Object.values(store.records || {}).find((r) => String(r?.period) === String(form.period)) || null;
  }
  return {
    formId: resolvedId,
    period: String(form?.period || record?.period || '2026'),
    header: {
      auditDocNumber: '',
      auditDate: '',
      auditorName: 'Satuan Pengawasan Internal (SPI) ITPLN',
      auditFocus: 'Pemeriksaan Dokumen Pendukung & Hasil Akhir KPI Tervalidasi Renbang',
      generalSummary: '',
      overallConclusion: 'SESUAI_BUKTI',
      followUpSummary: '',
      preferredReportFormat: 'RINGKAS',
      ...(record?.header || {}),
    },
    items: record?.items && typeof record.items === 'object' ? { ...record.items } : {},
    updatedBy: record?.updatedBy || null,
    updatedByName: record?.updatedByName || null,
    updatedAt: record?.updatedAt || null,
  };
}

function writeSpiAuditRecord(nextRecord, actor, auditDetail) {
  if (typeof localStorage === 'undefined') return nextRecord;
  const store = readSpiAuditStore();
  const nextRecordsMap = {
    ...(store.records || {}),
    [nextRecord.formId]: nextRecord,
  };
  const nextStore = {
    records: nextRecordsMap,
    byForm: nextRecordsMap,
    updatedAt: nextRecord.updatedAt,
  };
  try {
    localStorage.setItem(SPI_AUDIT_KEY, JSON.stringify(nextStore));
  } catch {
    // Abaikan kegagalan kuota penyimpanan lokal
  }

  const entries = read('prp_audit', []);
  try {
    localStorage.setItem(
      'prp_audit',
      JSON.stringify([
        {
          id: createId('audit'),
          action: 'SPI_AUDIT_REALTIME',
          detail: auditDetail,
          actor: actor?.email || 'spi@itpln.ac.id',
          at: nextRecord.updatedAt,
        },
        ...(Array.isArray(entries) ? entries : []),
      ].slice(0, 500)),
    );
  } catch {
    // Abaikan kegagalan kuota pada log audit lokal
  }

  if (typeof fetch === 'function') {
    const token = localStorage.getItem('performa_access_token') || '';
    if (token) {
      fetch('/api/v1/spi/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(nextRecord),
      }).catch(() => {});
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SPI_AUDIT_EVENT));
    window.dispatchEvent(new Event(EVENT));
  }

  return nextRecord;
}

/**
 * Menyimpan isian dokumen/ringkasan audit khusus SPI secara real-time ke penyimpanan lokal & database server.
 * Hanya akun SPI yang dapat memanggil fungsi ini (tidak mencampuri isian Renbang maupun unit).
 */
export function saveSpiAuditHeader(formId, user, headerPatch = {}) {
  maintenance();
  spiActorGuard(user);
  const state = readKpiWorkflow();
  const current = readSpiAuditForForm(formId, state);
  const now = new Date().toISOString();
  const cleanHeader = {
    ...current.header,
  };
  if (headerPatch.auditDocNumber !== undefined) cleanHeader.auditDocNumber = String(headerPatch.auditDocNumber ?? '');
  if (headerPatch.auditDate !== undefined) cleanHeader.auditDate = String(headerPatch.auditDate ?? '');
  if (headerPatch.auditorName !== undefined) cleanHeader.auditorName = String(headerPatch.auditorName ?? '');
  if (headerPatch.auditFocus !== undefined) cleanHeader.auditFocus = String(headerPatch.auditFocus ?? '');
  if (headerPatch.generalSummary !== undefined) cleanHeader.generalSummary = String(headerPatch.generalSummary ?? '');
  if (headerPatch.followUpSummary !== undefined) cleanHeader.followUpSummary = String(headerPatch.followUpSummary ?? '');
  if (headerPatch.preferredReportFormat !== undefined && ['RINGKAS', 'CETAK_LAPORAN'].includes(headerPatch.preferredReportFormat)) {
    cleanHeader.preferredReportFormat = headerPatch.preferredReportFormat;
  }
  if (headerPatch.overallConclusion !== undefined && SPI_VERIFICATION_STATUSES.includes(headerPatch.overallConclusion)) {
    cleanHeader.overallConclusion = headerPatch.overallConclusion;
  }

  const nextRecord = {
    ...current,
    header: cleanHeader,
    updatedBy: user.email.toLowerCase(),
    updatedByName: user.name || user.unit || 'SPI ITPLN',
    updatedAt: now,
  };

  return writeSpiAuditRecord(
    nextRecord,
    user,
    `Form inputan khusus SPI diperbarui secara real-time untuk periode ${nextRecord.period} (${nextRecord.formId})`,
  );
}

/**
 * Menyimpan isian khusus SPI pada Bagian D No. 5: Tindaklanjut Rekomendasi Audit & Temuan (SPI, PJM, KAP, WBS)
 * secara real-time ke penyimpanan lokal & database server, sekaligus menyinkronkan ke papan integrasi KPI.
 * Akun SPI hanya diperbolehkan mengisi indikator D_5 miliknya sendiri.
 */
export function saveSpiIndicatorAudit(formId, user, indicatorId = 'D_5', itemPatch = {}) {
  maintenance();
  spiActorGuard(user);
  const cleanId = String(indicatorId || 'D_5').trim();
  if (cleanId !== 'D_5') {
    throw new Error('Akun SPI hanya dapat mengisi Bagian D No. 5: Tindaklanjut Rekomendasi Audit & Temuan (SPI, PJM, KAP, WBS).');
  }
  const state = readKpiWorkflow();
  const form = state?.forms?.find((entry) => entry.id === formId)
    || getFormForPeriod(formId, state, { fallbackToLatest: true })
    || null;
  const current = readSpiAuditForForm(form?.id || formId, state);
  const spiSubKey = form ? submissionKey(form.id, user.email) : null;
  const existingSub = spiSubKey ? state.submissions?.[spiSubKey] : null;
  const existingEv = spiSubKey ? (state.evidence?.[spiSubKey] || []) : [];

  const d5ItemDef = form?.sections
    ?.flatMap((s) => s.items || [])
    ?.find((it) => it.id === 'D_5' || (String(it.no) === '5' && /tindak\s*lanjut\s+rekomendasi\s+audit/i.test(String(it.indikator || ''))));
  const subKeyUn = d5ItemDef?.subrows?.[0]?.key || 'd_5_un';
  const subKeyTot = d5ItemDef?.subrows?.[1]?.key || 'd_5_tot';

  const prevItem = current.items?.D_5 || {
    indicatorId: 'D_5',
    unfollowedCount: existingSub?.values?.[subKeyUn] ?? '',
    totalRecommendations: existingSub?.values?.[subKeyTot] ?? '',
    verificationStatus: 'SESUAI_BUKTI',
    auditNote: existingSub?.notes?.D_5 ?? '',
    recommendation: '',
    followUpStatus: 'OPEN',
    evidenceChecked: true,
    evidenceList: existingEv,
  };

  const now = new Date().toISOString();
  const nextUnfollowed = itemPatch.unfollowedCount !== undefined
    ? String(itemPatch.unfollowedCount ?? '')
    : String(prevItem.unfollowedCount ?? '');
  const nextTotalRec = itemPatch.totalRecommendations !== undefined
    ? String(itemPatch.totalRecommendations ?? '')
    : String(prevItem.totalRecommendations ?? '');
  const nextAuditNote = itemPatch.auditNote !== undefined
    ? String(itemPatch.auditNote ?? '')
    : String(prevItem.auditNote ?? '');
  const nextEvList = Array.isArray(itemPatch.evidenceList)
    ? itemPatch.evidenceList.filter((ev) => ev && ev.indicatorId === 'D_5')
    : (existingEv.length > 0 ? existingEv : (Array.isArray(prevItem.evidenceList) ? prevItem.evidenceList : []));

  const nextItem = {
    ...prevItem,
    indicatorId: 'D_5',
    unfollowedCount: nextUnfollowed,
    totalRecommendations: nextTotalRec,
    verificationStatus: itemPatch.verificationStatus && SPI_VERIFICATION_STATUSES.includes(itemPatch.verificationStatus)
      ? itemPatch.verificationStatus
      : prevItem.verificationStatus,
    auditNote: nextAuditNote,
    recommendation: itemPatch.recommendation !== undefined ? String(itemPatch.recommendation ?? '') : prevItem.recommendation,
    followUpStatus: itemPatch.followUpStatus && SPI_FOLLOWUP_STATUSES.includes(itemPatch.followUpStatus)
      ? itemPatch.followUpStatus
      : prevItem.followUpStatus,
    evidenceChecked: itemPatch.evidenceChecked !== undefined ? Boolean(itemPatch.evidenceChecked) : Boolean(prevItem.evidenceChecked),
    evidenceList: nextEvList,
    updatedBy: user.email.toLowerCase(),
    updatedByName: user.name || user.unit || 'SPI ITPLN',
    updatedAt: now,
  };

  // Sinkronkan langsung ke prp_kpi_distribution_v1 khusus indikator D_5 milik SPI
  if (form && spiSubKey) {
    const d5Values = {
      [subKeyUn]: nextUnfollowed,
      [subKeyTot]: nextTotalRec,
    };
    const computedD5 = d5ItemDef
      ? computeKpiItem(d5ItemDef, d5Values, true, form.sections)
      : { ratioPercent: null, weightedScore: 0 };
    const isDraftOnly = Boolean(itemPatch.isDraft);
    if (isDraftOnly && (!existingSub || existingSub.status === 'DRAFT' || existingSub.status === 'NEEDS_REVISION')) {
      write(
        {
          ...state,
          drafts: {
            ...(state.drafts || {}),
            [spiSubKey]: {
              formId: form.id,
              email: user.email.toLowerCase(),
              unit: user.unit || user.name || 'Satuan Pengawasan Intern (SPI)',
              picCodes: ['SPI'],
              values: d5Values,
              notes: nextAuditNote.trim() ? { D_5: nextAuditNote.trim() } : {},
              updatedAt: now,
            },
          },
          evidence: {
            ...(state.evidence || {}),
            [spiSubKey]: nextEvList,
          },
        },
        { skipAudit: true },
      );
    } else {
      const nextSpiSubmission = {
        ...(existingSub || {}),
        formId: form.id,
        email: user.email.toLowerCase(),
        unit: user.unit || user.name || 'Satuan Pengawasan Intern (SPI)',
        picCodes: ['SPI'],
        assignedIndicatorIds: ['D_5'],
        values: d5Values,
        notes: nextAuditNote.trim() ? { D_5: nextAuditNote.trim() } : {},
        status: existingSub?.status || 'SUBMITTED',
        submittedAt: now,
        sectionScores: [
          {
            code: 'D',
            title: 'PERSPEKTIF KEPATUHAN (COMPLIANCE)',
            score: computedD5.weightedScore || 0,
          },
        ],
        totalScore: computedD5.weightedScore || 0,
      };
      write(
        {
          ...state,
          submissions: {
            ...(state.submissions || {}),
            [spiSubKey]: nextSpiSubmission,
          },
          evidence: {
            ...(state.evidence || {}),
            [spiSubKey]: nextEvList,
          },
        },
        { skipAudit: true },
      );
    }
  }

  const nextRecord = {
    ...current,
    items: {
      D_5: nextItem,
    },
    updatedBy: user.email.toLowerCase(),
    updatedByName: user.name || user.unit || 'SPI ITPLN',
    updatedAt: now,
  };

  return writeSpiAuditRecord(
    nextRecord,
    user,
    `Input real-time SPI Bagian D.5 (Tindaklanjut Rekomendasi Audit & Temuan) diperbarui: Belum ditindaklanjuti=${nextUnfollowed || '0'}, Total rekomendasi=${nextTotalRec || '0'}`,
  );
}

export function subscribeSpiAudit(callback) {
  const storage = (event) => {
    if (!event.key || event.key === SPI_AUDIT_KEY || event.key === KEY) callback();
  };
  window.addEventListener(SPI_AUDIT_EVENT, callback);
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(SPI_AUDIT_EVENT, callback);
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', storage);
  };
}
