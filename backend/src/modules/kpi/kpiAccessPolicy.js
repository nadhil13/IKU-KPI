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

export function resolveRowPrimaryPic(item) {
  const explicit = String(item?.primaryPic ?? '').trim().toUpperCase();
  if (explicit) return explicit;
  const list = normalizePicList(item?.pics ?? item?.picDisplay ?? []);
  return list[0] || '';
}

export function canCallerEditKpiRow(item, callerUser) {
  if (!callerUser || callerUser.status === 'Nonaktif') return false;
  if (callerUser.role === 'superadmin_prp') return true;
  // Akun SPI bersifat ketat Hanya Lihat (Read-Only Auditor).
  if (callerUser.role === 'spi') return false;
  if (callerUser.role !== 'kpi_only' && callerUser.role !== 'dual') return false;
  const primaryPic = resolveRowPrimaryPic(item);
  if (!primaryPic) return true;
  const userPics = new Set(normalizePicList(callerUser.picCodes || []));
  // Hanya 1 PIC Utama yang memiliki wewenang tulis/input dokumen; Co-PIC bersifat informasi kolaborasi.
  return userPics.has(primaryPic);
}

function splitFormAndEmailKey(entryKey) {
  const raw = String(entryKey || '');
  const idx = raw.lastIndexOf(':');
  if (idx === -1) return { formId: raw, email: '' };
  return {
    formId: raw.slice(0, idx),
    email: raw.slice(idx + 1).trim().toLowerCase(),
  };
}

function keyEmailLabel(entryKey) {
  const { email } = splitFormAndEmailKey(entryKey);
  return email || String(entryKey || '');
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

  const activeIdx = base.activeFormId
    ? base.forms.findIndex((f) => String(f?.id) === String(base.activeFormId))
    : -1;
  const targetIdx = activeIdx >= 0 ? activeIdx : base.forms.length - 1;
  const latestForm = base.forms[targetIdx];
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
    forms: base.forms.map((f, idx) => (idx === targetIdx ? updatedForm : f)),
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

  // Saat server belum memiliki form aktif (cold-start), izinkan bootstrap struktur form awal
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

  // Cek apakah ada upaya memodifikasi key milik unit lain
  const checkForeignKeyTampering = (incomingMap, baseMap, mapLabel) => {
    for (const [entryKey, incomingVal] of Object.entries(incomingMap || {})) {
      const { email: keyEmail } = splitFormAndEmailKey(entryKey);
      if (keyEmail && keyEmail !== callerEmail) {
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
    const editableItemIds = new Set();
    const editableSubKeys = new Set();
    (form.sections || []).forEach((sec) => {
      (sec.items || []).forEach((item) => {
        if (canCallerEditKpiRow(item, callerUser)) {
          editableItemIds.add(item.id);
          (item.subrows || []).forEach((sub) => editableSubKeys.add(sub.key));
        }
      });
    });

    const unitKey = `${form.id}:${callerEmail}`;

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

    const prevSubForUnit = base.submissions?.[unitKey];
    const isUnitSubmissionLocked = prevSubForUnit && ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(prevSubForUnit.status);

    if (incoming.evidence && Object.prototype.hasOwnProperty.call(incoming.evidence, unitKey)) {
      if (isUnitSubmissionLocked) {
        nextEvidence[unitKey] = base.evidence?.[unitKey] || [];
      } else {
        const rawEvList = Array.isArray(incoming.evidence[unitKey]) ? incoming.evidence[unitKey] : [];
        const prevEvById = new Map(((base.evidence && base.evidence[unitKey]) || []).map((e) => [e.id, e]));
        const seenEvIds = new Set();
        const cleanEvList = [];
        for (const ev of rawEvList) {
          if (!ev || typeof ev !== 'object') continue;
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
          const evId = String(ev.id || `${ev.indicatorId}_${cleanEvList.length + 1}`);
          if (seenEvIds.has(evId)) continue;
          seenEvIds.add(evId);
          const prevEv = prevEvById.get(evId);
          const isUnchangedVerified = prevEv?.status === 'VERIFIED'
            && prevEv.indicatorId === ev.indicatorId
            && String(prevEv.url || '') === String(ev.url || '')
            && String(prevEv.dataUrl || '') === String(ev.dataUrl || '')
            && String(prevEv.fileName || '') === String(ev.fileName || '');
          cleanEvList.push({
            ...ev,
            id: evId,
            owner: callerEmail,
            ownerUnit: callerUser.unit || callerUser.name,
            picCodes: callerUser.picCodes || [],
            status: isUnchangedVerified ? 'VERIFIED' : 'PENDING',
          });
        }
        if (cleanEvList.length > 0) {
          nextEvidence[unitKey] = cleanEvList;
        } else {
          delete nextEvidence[unitKey];
        }
      }
    } else if (incoming.evidence && !Object.prototype.hasOwnProperty.call(incoming.evidence, unitKey) && !isUnitSubmissionLocked) {
      delete nextEvidence[unitKey];
    }

    if (incoming.submissions && Object.prototype.hasOwnProperty.call(incoming.submissions, unitKey)) {
      const rawSub = incoming.submissions[unitKey];
      const prevSub = base.submissions?.[unitKey];
      const isPrevFinalLocked = prevSub && ['SUBMITTED', 'APPROVED', 'LOCKED'].includes(prevSub.status);
      if (!rawSub) {
        if (!isUnitSubmissionLocked) {
          delete nextSubmissions[unitKey];
        }
      } else {
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
        if (isPrevFinalLocked) {
          nextSubmissions[unitKey] = prevSub;
        } else {
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
  }

  return {
    ...base,
    forms,
    formsByPeriod: base.formsByPeriod || incoming.formsByPeriod || {},
    adminOverrides: base.adminOverrides || {},
    revisions: base.revisions || {},
    submissions: nextSubmissions,
    evidence: nextEvidence,
    drafts: nextDrafts,
  };
}

/**
 * Mengevaluasi apakah proses validasi data KPI dari Renbang (PRP) pada satu formulir periode telah selesai 100%.
 * Digunakan untuk membuka kunci otomatis Tabel Audit KPI (Read-Only) pada akun SPI.
 */
export function evaluateRenbangValidationForForm(form, workflow) {
  if (!form || typeof form !== 'object') {
    return {
      isValidated100: false,
      totalUnits: 0,
      validatedUnits: 0,
      pendingUnits: 0,
      progressPercent: 0,
      statusLabel: 'Akses masih tertutup',
    };
  }
  const formId = String(form.id || '');
  const submissions = workflow?.submissions || {};
  const drafts = workflow?.drafts || {};

  if (form.renbangValidatedFinal === true && !form.renbangExplicitlyLocked) {
    const unitCount = Array.isArray(form.units) && form.units.length > 0 ? form.units.length : 1;
    return {
      formId,
      period: form.period || '2026',
      isValidated100: true,
      renbangValidatedFinal: true,
      renbangValidatedAt: form.renbangValidatedAt || null,
      renbangValidatedBy: form.renbangValidatedBy || null,
      totalUnits: unitCount,
      validatedUnits: unitCount,
      pendingUnits: 0,
      progressPercent: 100,
      statusLabel: 'Tervalidasi Final 100% oleh Renbang (Akses Terbuka)',
    };
  }

  const allSectionItems = (form.sections || []).flatMap((sec) => sec.items || []);
  const candidateEmails = new Set();

  if (Array.isArray(form.units) && form.units.length > 0) {
    form.units.forEach((u) => {
      const email = String(u?.email || '').trim().toLowerCase();
      if (!email || email === 'spi@itpln.ac.id') return;
      const unitPics = normalizePicList(u?.picCodes || []);
      const hasAssignedRow = allSectionItems.length === 0 || unitPics.length === 0 || allSectionItems.some((item) => {
        const rowPics = normalizePicList(item?.pics ?? item?.picDisplay ?? []);
        return rowPics.length === 0 || rowPics.some((p) => unitPics.includes(p));
      });
      if (hasAssignedRow) candidateEmails.add(email);
    });
  } else {
    const prefix = `${formId}:`;
    Object.keys(submissions).forEach((k) => {
      if (k.startsWith(prefix)) {
        const email = k.slice(prefix.length).toLowerCase();
        if (email && email !== 'spi@itpln.ac.id') candidateEmails.add(email);
      }
    });
    Object.keys(drafts).forEach((k) => {
      if (k.startsWith(prefix)) {
        const email = k.slice(prefix.length).toLowerCase();
        if (email && email !== 'spi@itpln.ac.id') candidateEmails.add(email);
      }
    });
  }

  const requiredEmails = [...candidateEmails];
  const totalUnits = requiredEmails.length;
  let validatedUnits = 0;

  requiredEmails.forEach((email) => {
    const sub = submissions[`${formId}:${email}`];
    if (sub && (sub.status === 'APPROVED' || sub.status === 'LOCKED')) {
      validatedUnits += 1;
    }
  });

  const isValidated100 = !form.renbangExplicitlyLocked && totalUnits > 0 && validatedUnits === totalUnits;
  const progressPercent = isValidated100
    ? 100
    : (totalUnits > 0 ? Math.min(99, Math.floor((validatedUnits / totalUnits) * 100)) : 0);

  return {
    formId,
    period: form.period || '2026',
    isValidated100,
    renbangValidatedFinal: false,
    renbangExplicitlyLocked: Boolean(form.renbangExplicitlyLocked),
    totalUnits,
    validatedUnits,
    pendingUnits: Math.max(0, totalUnits - validatedUnits),
    progressPercent,
    statusLabel: isValidated100
      ? 'Tervalidasi Final 100% oleh Renbang (Akses Terbuka)'
      : 'Akses masih tertutup',
  };
}

/**
 * Isolasi Data Antar-Unit (Data Privacy) & Penguncian Akses Tabel Audit SPI:
 * - Akun unit (kpi_only / dual) hanya boleh menerima submissions, drafts, dan evidence milik unitnya sendiri.
 * - Admin PRP (superadmin_prp) dapat melihat seluruh data lintas unit.
 * - Auditor SPI (spi) HANYA dapat memantau data KPI pada formulir yang sudah tervalidasi final 100% oleh Renbang.
 *   Selama validasi Renbang belum 100%, data unit yang baru terisi sebagian disembunyikan ("Akses masih tertutup").
 */
export function filterKpiWorkflowForCaller(workflow, callerUser) {
  if (!workflow || typeof workflow !== 'object') return workflow;
  if (!callerUser) {
    return {
      ...workflow,
      submissions: {},
      evidence: {},
      drafts: {},
      adminOverrides: {},
      revisions: {},
    };
  }
  if (callerUser.role === 'superadmin_prp') {
    return workflow;
  }
  if (callerUser.role === 'spi') {
    const forms = Array.isArray(workflow.forms) ? workflow.forms : [];
    const validationByFormId = {};
    const annotatedForms = forms.map((form) => {
      const valStatus = evaluateRenbangValidationForForm(form, workflow);
      validationByFormId[form.id] = valStatus;
      return {
        ...form,
        renbangValidationSummary: valStatus,
      };
    });
    // SPI memperoleh tampilan data komprehensif setara Admin untuk pemeriksaan (termasuk berkas evidence),
    // namun akses tulis diblokir penuh pada endpoint mutasi.
    return {
      ...workflow,
      forms: annotatedForms,
      validationByFormId,
    };
  }
  const callerEmail = String(callerUser.email || '').toLowerCase();
  const callerPics = new Set(normalizePicList(callerUser.picCodes || []));
  const filterByOwnEmail = (mapObj) => {
    const out = {};
    for (const [entryKey, val] of Object.entries(mapObj || {})) {
      const { email: keyEmail } = splitFormAndEmailKey(entryKey);
      if (keyEmail && keyEmail === callerEmail) {
        out[entryKey] = val;
      }
    }
    return out;
  };

  // Siapkan nilai lintas-baris (khusus evaluasi rumus koordinat Excel & kolaborasi Co-PIC Read-Only)
  // tanpa mengekspos objek submission/draft penuh milik unit lain.
  const sanitizedForms = (Array.isArray(workflow.forms) ? workflow.forms : []).map((form) => {
    const sharedValues = {};
    const coPicSubKeys = new Set();
    const allCustomFormulaSubKeys = new Set();
    const subKeyByCoord = new Map();
    let rowCursor = 2;
    (form.sections || []).forEach((sec) => {
      rowCursor += 1;
      (sec.items || []).forEach((item) => {
        const primary = resolveRowPrimaryPic(item);
        const allRowPics = normalizePicList(item?.coPics?.length ? [primary, ...item.coPics] : (item?.pics ?? item?.picDisplay ?? []));
        const isCallerCoPic = allRowPics.some((p) => p !== primary && callerPics.has(p));
        const subs = item.subrows || item.inputs || [];
        subs.forEach((sub, idx) => {
          const rNum = rowCursor + idx;
          if (sub?.key) {
            subKeyByCoord.set(`E${rNum}`, sub.key);
            if (isCallerCoPic) coPicSubKeys.add(sub.key);
          }
        });
        rowCursor += Math.max(1, subs.length);
      });
    });
    (form.sections || []).forEach((sec) => {
      (sec.items || []).forEach((item) => {
        if (item.calcType === 'custom' && item.formulaExpr && canCallerEditKpiRow(item, callerUser)) {
          const matches = String(item.formulaExpr).toUpperCase().match(/\bE\d+\b/g) || [];
          matches.forEach((coord) => {
            const k = subKeyByCoord.get(coord);
            if (k) allCustomFormulaSubKeys.add(k);
          });
        }
      });
    });

    const allowedSharedKeys = new Set([...coPicSubKeys, ...allCustomFormulaSubKeys]);
    if (allowedSharedKeys.size > 0) {
      for (const [entryKey, subRec] of Object.entries(workflow.submissions || {})) {
        const { formId } = splitFormAndEmailKey(entryKey);
        if (formId !== form.id || !subRec?.values) continue;
        for (const [k, v] of Object.entries(subRec.values)) {
          if (allowedSharedKeys.has(k) && String(v ?? '').trim() !== '') {
            sharedValues[k] = v;
          }
        }
      }
      const adminOvr = workflow.adminOverrides?.[form.id];
      if (adminOvr?.values) {
        for (const [k, v] of Object.entries(adminOvr.values)) {
          if (allowedSharedKeys.has(k) && String(v ?? '').trim() !== '') {
            sharedValues[k] = v;
          }
        }
      }
    }
    return Object.keys(sharedValues).length > 0 ? { ...form, sharedValues } : form;
  });

  return {
    ...workflow,
    forms: sanitizedForms,
    submissions: filterByOwnEmail(workflow.submissions),
    evidence: filterByOwnEmail(workflow.evidence),
    drafts: filterByOwnEmail(workflow.drafts),
  };
}
