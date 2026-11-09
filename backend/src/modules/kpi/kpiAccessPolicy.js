/**
 * Modul Keamanan & Sinkronisasi Struktur Domain KPI (Backend).
 * Menegakkan otorisasi baris berbasis PIC (Row-Level Security), mencegah pemalsuan status verifikasi,
 * serta menyinkronkan penambahan/perubahan baris indikator ke formulir aktif seluruh unit secara realtime.
 */
import { appendAuditLog } from '../../services/database.js';

export function normalizePicList(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/(?:,|\/|&|\bdan\b)+/i);
  const seen = new Set();
  const out = [];
  list.forEach((entry) => {
    const clean = String(entry ?? '').trim().toUpperCase();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      out.push(clean);
    }
  });
  return out;
}

export function canCallerEditKpiRow(item, callerUser) {
  if (!callerUser || callerUser.status === 'Nonaktif') return false;
  if (callerUser.role === 'superadmin_prp') return true;
  if (callerUser.role !== 'kpi_only') return false;
  const rowPics = normalizePicList(item?.pics ?? item?.picDisplay ?? []);
  if (rowPics.length === 0) return false;
  const userPics = new Set(normalizePicList(callerUser.picCodes || []));
  return rowPics.some((code) => userPics.has(code));
}

function keyEmailLabel(entryKey) {
  const parts = String(entryKey).split(':');
  return parts[1] || entryKey;
}

/**
 * Ketika Superadmin PRP menerbitkan atau menyinkronkan prp_kpi_config,
 * perbarui sections pada formulir aktif di prp_kpi_distribution_v1 tanpa menghapus submission/draf/bukti unit.
 */
export function syncActiveFormWithPublishedSections(existingWorkflow, nextSections, actorEmail = 'Superadmin PRP') {
  if (!Array.isArray(nextSections) || nextSections.length === 0) return null;
  const base = existingWorkflow && typeof existingWorkflow === 'object'
    ? existingWorkflow
    : { forms: [], submissions: {}, evidence: {}, drafts: {} };
  if (!Array.isArray(base.forms) || base.forms.length === 0) return null;

  const lastIdx = base.forms.length - 1;
  const latestForm = base.forms[lastIdx];
  if (JSON.stringify(latestForm.sections || []) === JSON.stringify(nextSections)) {
    return null;
  }

  const updatedForm = {
    ...latestForm,
    sections: nextSections,
    structureRevision: (Number(latestForm.structureRevision) || 1) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  };
  return {
    ...base,
    forms: base.forms.map((f, idx) => (idx === lastIdx ? updatedForm : f)),
  };
}

export function validateAndMergeKpiWorkflowForUnit(existingWorkflow, incomingWorkflow, callerUser, ip) {
  const callerEmail = callerUser.email.toLowerCase();
  const base = existingWorkflow && typeof existingWorkflow === 'object'
    ? existingWorkflow
    : { forms: [], submissions: {}, evidence: {}, drafts: {} };

  const incoming = incomingWorkflow && typeof incomingWorkflow === 'object'
    ? incomingWorkflow
    : { forms: [], submissions: {}, evidence: {}, drafts: {} };

  // Jika server belum memiliki form sama sekali, izinkan inisialisasi form default tanpa submission
  const forms = Array.isArray(base.forms) && base.forms.length > 0
    ? base.forms
    : (Array.isArray(incoming.forms) ? incoming.forms.slice(0, 2) : []);

  const nextSubmissions = { ...(base.submissions || {}) };
  const nextEvidence = { ...(base.evidence || {}) };
  const nextDrafts = { ...(base.drafts || {}) };

  const activeForm = forms[forms.length - 1];
  if (!activeForm) {
    return { forms, submissions: nextSubmissions, evidence: nextEvidence, drafts: nextDrafts };
  }

  const editableItemIds = new Set();
  const editableSubKeys = new Set();
  (activeForm.sections || []).forEach((sec) => {
    (sec.items || []).forEach((item) => {
      if (canCallerEditKpiRow(item, callerUser)) {
        editableItemIds.add(item.id);
        (item.subrows || []).forEach((sub) => editableSubKeys.add(sub.key));
      }
    });
  });

  // Cek apakah ada upaya memodifikasi key milik unit lain
  const checkForeignKeyTampering = (incomingMap, baseMap, mapLabel) => {
    for (const [entryKey, incomingVal] of Object.entries(incomingMap || {})) {
      const [, keyEmail] = String(entryKey).split(':');
      if (keyEmail && keyEmail.toLowerCase() !== callerEmail) {
        const prevJson = JSON.stringify(baseMap?.[entryKey] ?? null);
        const nextJson = JSON.stringify(incomingVal ?? null);
        if (prevJson !== nextJson) {
          appendAuditLog(
            'SECURITY_VIOLATION',
            `Percobaan modifikasi ${mapLabel} lintas unit (${entryKey}) oleh ${callerEmail} ditolak.`,
            callerEmail,
            ip,
          );
          throw Object.assign(
            new Error(`Pelanggaran hak akses: Akun ${callerEmail} dilarang memodifikasi data milik unit lain (${keyEmailLabel(entryKey)}).`),
            { status: 403 },
          );
        }
      }
    }
  };

  checkForeignKeyTampering(incoming.submissions, base.submissions, 'submission KPI');
  checkForeignKeyTampering(incoming.evidence, base.evidence, 'bukti capaian KPI');
  checkForeignKeyTampering(incoming.drafts, base.drafts, 'draf KPI');

  for (const form of forms) {
    const unitKey = `${form.id}:${callerEmail}`;

    // 1. Validasi Draf Unit
    if (incoming.drafts && Object.prototype.hasOwnProperty.call(incoming.drafts, unitKey)) {
      const rawDraft = incoming.drafts[unitKey];
      if (!rawDraft) {
        delete nextDrafts[unitKey];
      } else {
        const cleanValues = {};
        for (const [k, v] of Object.entries(rawDraft.values || {})) {
          if (!editableSubKeys.has(k) && String(v ?? '').trim() !== '') {
            appendAuditLog(
              'SECURITY_VIOLATION',
              `Percobaan pengisian draf pada sub-baris ${k} di luar otoritas PIC (${(callerUser.picCodes || []).join(',')}) oleh ${callerEmail}`,
              callerEmail,
              ip,
            );
            throw Object.assign(
              new Error(`Akses ditolak: Anda tidak memiliki hak input PIC pada kolom ${k}.`),
              { status: 403 },
            );
          }
          if (editableSubKeys.has(k)) cleanValues[k] = v;
        }
        const cleanNotes = {};
        for (const [itemId, noteText] of Object.entries(rawDraft.notes || {})) {
          if (editableItemIds.has(itemId)) cleanNotes[itemId] = String(noteText ?? '');
        }
        nextDrafts[unitKey] = {
          ...rawDraft,
          formId: form.id,
          email: callerEmail,
          picCodes: callerUser.picCodes || [],
          values: cleanValues,
          notes: cleanNotes,
          updatedAt: new Date().toISOString(),
        };
      }
    } else if (incoming.drafts && !Object.prototype.hasOwnProperty.call(incoming.drafts, unitKey)) {
      delete nextDrafts[unitKey];
    }

    // 2. Validasi Evidence Unit per Baris
    if (incoming.evidence && Object.prototype.hasOwnProperty.call(incoming.evidence, unitKey)) {
      const rawEvList = Array.isArray(incoming.evidence[unitKey]) ? incoming.evidence[unitKey] : [];
      const prevEvById = new Map(((base.evidence && base.evidence[unitKey]) || []).map((e) => [e.id, e]));
      const cleanEvList = rawEvList.map((ev) => {
        if (!editableItemIds.has(ev.indicatorId)) {
          appendAuditLog(
            'SECURITY_VIOLATION',
            `Percobaan unggah bukti pada indikator ${ev.indicatorId} milik PIC lain oleh ${callerEmail}`,
            callerEmail,
            ip,
          );
          throw Object.assign(
            new Error(`Akses ditolak: Indikator ${ev.indicatorId} bukan tanggung jawab PIC akun Anda.`),
            { status: 403 },
          );
        }
        const prevEv = prevEvById.get(ev.id);
        return {
          ...ev,
          owner: callerEmail,
          ownerUnit: callerUser.unit || callerUser.name,
          picCodes: callerUser.picCodes || [],
          status: prevEv?.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
        };
      });
      nextEvidence[unitKey] = cleanEvList;
    }

    // 3. Validasi Submission Unit
    if (incoming.submissions && Object.prototype.hasOwnProperty.call(incoming.submissions, unitKey)) {
      const rawSub = incoming.submissions[unitKey];
      const prevSub = base.submissions?.[unitKey];
      if (rawSub) {
        if (['APPROVED', 'LOCKED'].includes(rawSub.status) && prevSub?.status !== rawSub.status) {
          appendAuditLog(
            'SECURITY_VIOLATION',
            `Percobaan manipulasi status submission ke ${rawSub.status} oleh ${callerEmail}`,
            callerEmail,
            ip,
          );
          throw Object.assign(
            new Error('Pelanggaran keamanan: Hanya Superadmin PRP yang berhak menyetujui atau mengunci submission.'),
            { status: 403 },
          );
        }
        for (const [k, v] of Object.entries(rawSub.values || {})) {
          if (!editableSubKeys.has(k) && String(v ?? '').trim() !== '') {
            appendAuditLog(
              'SECURITY_VIOLATION',
              `Percobaan submit nilai pada sub-baris ${k} milik PIC lain oleh ${callerEmail}`,
              callerEmail,
              ip,
            );
            throw Object.assign(
              new Error(`Pelanggaran hak akses PIC: Anda tidak berhak mengisi sub-baris ${k}.`),
              { status: 403 },
            );
          }
        }
        nextSubmissions[unitKey] = {
          ...rawSub,
          email: callerEmail,
          picCodes: callerUser.picCodes || [],
        };
      }
    }
  }

  return {
    forms,
    submissions: nextSubmissions,
    evidence: nextEvidence,
    drafts: nextDrafts,
  };
}
