/**
 * Skema, kalkulasi, dan penyimpanan konfigurasi tabel KPI.
 * Dipakai bersama oleh lembar isian KPI (user) dan Desainer Tabel KPI (Superadmin PRP),
 * sehingga hasil simulasi di desainer selalu identik dengan hasil di lembar user.
 */

import { evaluateKpiFormula, validateKpiFormula } from './formulaEngine';

export const KPI_CONFIG_KEY = 'prp_kpi_config';
export const KPI_DRAFT_KEY = 'prp_kpi_draft';
export const KPI_HISTORY_KEY = 'prp_kpi_history';
export const KPI_LIVE_SYNC_KEY = 'prp_kpi_live_sync';
export const KPI_CONFIG_EVENT = 'prp-kpi-config-updated';

/* ───────────────────────── Parser angka & tanggal ───────────────────────── */

export function parseIndonesianNumber(input) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  let s = raw.replace(/^rp\.?\s*/i, '').replace(/%\s*$/, '').trim();
  if (!s || /[a-zA-Z]/.test(s)) return null;

  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const commaCount = (s.match(/,/g) || []).length;
    s = commaCount > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (s.includes('.')) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      s = s.replace(/\./g, '');
    } else {
      const parts = s.split('.');
      if (parts[1] && parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3) {
        s = parts[0] + parts[1];
      }
    }
  }

  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

const MONTH_MAP = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9,
  nov: 10, november: 10,
  des: 11, desember: 11, dec: 11, december: 11,
};

export function parseFlexibleDate(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));

  const textMatch = raw.replace(/,/g, '').match(/^(\d{1,2})[\s\-/]+([a-zA-Z]+)[\s\-/]+(\d{2,4})$/);
  if (textMatch) {
    let year = Number(textMatch[3]);
    if (year < 100) year += 2000;
    const month = MONTH_MAP[textMatch[2].toLowerCase()];
    if (month !== undefined) return new Date(year, month, Number(textMatch[1]));
  }

  const monthYearMatch = raw.replace(/,/g, '').match(/^([a-zA-Z]+)[\s\-/]+(\d{2,4})$/);
  if (monthYearMatch) {
    let year = Number(monthYearMatch[2]);
    if (year < 100) year += 2000;
    const month = MONTH_MAP[monthYearMatch[1].toLowerCase()];
    if (month !== undefined) return new Date(year, month + 1, 0);
  }

  const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyMatch) {
    let year = Number(dmyMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
  }

  return null;
}

export function formatIndonesianNumber(num, maxDecimals = 2) {
  if (num === null || num === undefined || !Number.isFinite(num)) return '—';
  return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
}

/* ───────────────────────── Katalog tipe rumus ───────────────────────── */

export const CALC_TYPES = {
  custom: {
    label: 'Rumus bebas (ala Excel)',
    expression: 'Tulis sendiri, mis. I1/I2*100 atau SUM(I1;I2)/T*100',
    minInputs: 1,
  },
  single_target: {
    label: 'Realisasi ÷ Target',
    expression: 'Capaian = Isian 1 ÷ Target × 100%',
    minInputs: 1,
    needsTarget: true,
  },
  ratio_two: {
    label: 'Rasio dua isian',
    expression: 'Capaian = Isian 1 ÷ Isian 2 × 100%',
    minInputs: 2,
  },
  ratio_target_pct: {
    label: 'Rasio isian terhadap target %',
    expression: 'Capaian = (Isian 1 ÷ Isian 2 × 100%) ÷ Target × 100%',
    minInputs: 2,
    needsTarget: true,
  },
  sum_two_target: {
    label: 'Jumlah dua isian ÷ Target',
    expression: 'Capaian = (Isian 1 + Isian 2) ÷ Target × 100%',
    minInputs: 2,
    needsTarget: true,
  },
  tracer_study: {
    label: 'Tracer study (6 komponen + responden)',
    expression: 'Capaian = (Σ Isian 1–6 ÷ Isian 7) ÷ Target × 100%',
    minInputs: 7,
    needsTarget: true,
  },
  primary_with_meta: {
    label: 'Isian utama + keterangan',
    expression: 'Capaian = Isian 1 ÷ Target × 100% (Isian 2 sebagai catatan)',
    minInputs: 2,
    needsTarget: true,
  },
  compliance_date_single: {
    label: 'Kepatuhan tanggal (1 batas waktu)',
    expression: 'Penalti penuh jika tanggal isian > batas waktu',
    minInputs: 1,
    needsDeadline: 1,
    penalty: true,
    textInput: true,
  },
  compliance_date_dual: {
    label: 'Kepatuhan tanggal (2 semester)',
    expression: 'Penalti ½ bobot untuk setiap semester yang terlambat',
    minInputs: 2,
    needsDeadline: 2,
    penalty: true,
    textInput: true,
  },
  compliance_integration_pct: {
    label: 'Kepatuhan persentase (target 100%)',
    expression: 'Penalti = (100% − Isian 1) × bobot',
    minInputs: 1,
    penalty: true,
  },
  compliance_audit_ratio: {
    label: 'Rasio temuan audit belum ditindaklanjuti',
    expression: 'Penalti = (Isian 1 ÷ Isian 2) × bobot',
    minInputs: 2,
    penalty: true,
  },
};

/**
 * Rumus ekuivalen untuk preset non-tanggal, supaya PRP bisa mengubah preset
 * menjadi "Rumus bebas" lalu mengedit rumusnya tanpa mulai dari nol.
 */
export const PRESET_FORMULA_EXPR = {
  single_target: 'I1/T*100',
  ratio_two: 'I1/I2*100',
  ratio_target_pct: '(I1/I2*100)/T*100',
  sum_two_target: '(I1+I2)/T*100',
  tracer_study: 'SUM(I1;I2;I3;I4;I5;I6)/I7*100/T*100',
  primary_with_meta: 'I1/T*100',
  compliance_integration_pct: 'I1',
  compliance_audit_ratio: '100-I1/I2*100',
};

/* ───────────────────────── Kalkulasi per baris ───────────────────────── */

const toDeadline = (iso) => (iso ? new Date(`${iso}T23:59:59`) : null);

/**
 * Menghitung satu baris indikator KPI.
 * Capaian selalu dibatasi 0–100%. Skor dibatasi 0..bobot (positif) atau −|bobot|..0 (penalti).
 */
export function computeKpiItem(item, values, isPenaltySection) {
  const bobot = Number(item.bobot) || 0;
  const targetNum = Number(item.targetNum) || 0;

  const parsedSubs = (item.subrows || []).map((sub) => {
    const raw = values?.[sub.key] ?? '';
    const trimmed = String(raw).trim();
    const num = parseIndonesianNumber(raw);
    const dateObj = sub.isTextInput ? parseFlexibleDate(raw) : null;
    const isFilled = sub.isTextInput ? trimmed !== '' && (dateObj !== null || num !== null) : num !== null;
    const isInvalid = sub.isTextInput ? trimmed !== '' && dateObj === null && num === null : trimmed !== '' && num === null;
    return { ...sub, raw, num, dateObj, isFilled, isInvalid };
  });

  const n = (index) => parsedSubs[index]?.num ?? null;
  let ratioPercent = null;
  let weightedScore = null;
  let extraNote = null;

  switch (item.calcType) {
    case 'custom': {
      // Hasil rumus = capaian (%). Penalti: skor = (100 − capaian)% × bobot (bobot sudah negatif).
      const result = evaluateKpiFormula(item.formulaExpr, {
        inputs: parsedSubs.map((sub) => sub.num),
        target: targetNum,
        bobot,
      });
      if (result.error) {
        extraNote = `Rumus error: ${result.error}`;
      } else if (result.value !== null) {
        const clamped = Math.min(100, Math.max(0, result.value));
        ratioPercent = clamped;
        weightedScore = isPenaltySection ? ((100 - clamped) / 100) * bobot : (clamped / 100) * bobot;
      }
      break;
    }
    case 'ratio_two': {
      if (n(0) !== null && n(1) !== null && n(1) !== 0) {
        ratioPercent = (n(0) / n(1)) * 100;
        weightedScore = (ratioPercent / 100) * bobot;
      }
      break;
    }
    case 'ratio_target_pct': {
      if (n(0) !== null && n(1) !== null && n(1) !== 0 && targetNum > 0) {
        const actualPct = (n(0) / n(1)) * 100;
        ratioPercent = (actualPct / targetNum) * 100;
        weightedScore = (ratioPercent / 100) * bobot;
        extraNote = `Rasio aktual: ${formatIndonesianNumber(actualPct, 2)}% (Target: ${item.targetDisplay}%)`;
      }
      break;
    }
    case 'sum_two_target': {
      if ((n(0) !== null || n(1) !== null) && targetNum > 0) {
        const total = (n(0) || 0) + (n(1) || 0);
        ratioPercent = (total / targetNum) * 100;
        weightedScore = (ratioPercent / 100) * bobot;
        extraNote = `Total: ${formatIndonesianNumber(total, 0)} dari ${item.targetDisplay}`;
      }
      break;
    }
    case 'tracer_study': {
      const components = parsedSubs.slice(0, 6).map((sub) => sub.num);
      const respondents = n(6);
      if (components.some((value) => value !== null) && respondents !== null && respondents > 0 && targetNum > 0) {
        const sum = components.reduce((acc, value) => acc + (value || 0), 0);
        const tracerPct = (sum / respondents) * 100;
        ratioPercent = (tracerPct / targetNum) * 100;
        weightedScore = (ratioPercent / 100) * bobot;
        extraNote = `Serapan tracer: ${formatIndonesianNumber(tracerPct, 2)}% (${formatIndonesianNumber(sum, 0)} / ${formatIndonesianNumber(respondents, 0)} responden)`;
      }
      break;
    }
    case 'primary_with_meta': {
      if (n(0) !== null && targetNum > 0) {
        ratioPercent = (n(0) / targetNum) * 100;
        weightedScore = (ratioPercent / 100) * bobot;
        if (n(1) !== null) extraNote = `${formatIndonesianNumber(n(1), 0)} ${parsedSubs[1]?.label || 'keterangan'}`;
      }
      break;
    }
    case 'compliance_date_single': {
      const sub = parsedSubs[0];
      const deadline = toDeadline(item.deadlineISO);
      if (sub?.dateObj && deadline) {
        const onTime = sub.dateObj.getTime() <= deadline.getTime();
        ratioPercent = onTime ? 100 : 0;
        weightedScore = onTime ? 0 : bobot;
        extraNote = onTime ? 'Tepat waktu (penalti 0)' : `Melewati batas waktu (${formatIndonesianNumber(bobot, 2)})`;
      } else if (sub?.num !== null && sub?.num !== undefined) {
        const pct = Math.min(100, Math.max(0, sub.num));
        ratioPercent = pct;
        weightedScore = ((100 - pct) / 100) * bobot;
      }
      break;
    }
    case 'compliance_date_dual': {
      const [s1, s2] = parsedSubs;
      const [d1, d2] = (item.deadlinesISO || []).map(toDeadline);
      const has1 = Boolean(s1 && (s1.dateObj || s1.num !== null));
      const has2 = Boolean(s2 && (s2.dateObj || s2.num !== null));
      if (has1 || has2) {
        const check = (sub, deadline) => (sub.dateObj && deadline ? sub.dateObj.getTime() <= deadline.getTime() : sub.num !== null ? sub.num >= 100 : true);
        const ok1 = has1 ? check(s1, d1) : true;
        const ok2 = has2 ? check(s2, d2) : true;
        const filled = (has1 ? 1 : 0) + (has2 ? 1 : 0);
        const onTime = (has1 && ok1 ? 1 : 0) + (has2 && ok2 ? 1 : 0);
        const late = (has1 && !ok1 ? 1 : 0) + (has2 && !ok2 ? 1 : 0);
        ratioPercent = (onTime / filled) * 100;
        weightedScore = (late / 2) * bobot;
        extraNote = late === 0 ? 'Semesteran tepat waktu (penalti 0)' : `${late} semester terlambat (${formatIndonesianNumber(weightedScore, 2)})`;
      }
      break;
    }
    case 'compliance_integration_pct': {
      if (n(0) !== null) {
        const clamped = Math.min(100, Math.max(0, n(0)));
        ratioPercent = clamped;
        weightedScore = ((100 - clamped) / 100) * bobot;
      }
      break;
    }
    case 'compliance_audit_ratio': {
      if (n(0) !== null && n(1) !== null && n(1) > 0) {
        const unRatio = Math.min(1, Math.max(0, n(0) / n(1)));
        ratioPercent = Math.max(0, 100 - unRatio * 100);
        weightedScore = unRatio * bobot;
        extraNote = `Belum ditindaklanjuti: ${formatIndonesianNumber(unRatio * 100, 2)}%`;
      }
      break;
    }
    default: {
      // single_target & fallback
      if (n(0) !== null && targetNum > 0) {
        ratioPercent = (n(0) / targetNum) * 100;
        weightedScore = (ratioPercent / 100) * bobot;
      }
    }
  }

  if (ratioPercent !== null) ratioPercent = Math.min(100, Math.max(0, ratioPercent));
  if (weightedScore !== null) {
    const limit = Math.abs(bobot);
    weightedScore = isPenaltySection ? Math.max(-limit, Math.min(0, weightedScore)) : Math.min(limit, Math.max(0, weightedScore));
    if (Math.abs(weightedScore) < 1e-9) weightedScore = 0;
  }

  return { parsedSubs, ratioPercent, weightedScore, extraNote };
}

/* ───────────────────────── Normalisasi struktur ───────────────────────── */

const toDisplay = (value) => formatIndonesianNumber(Number(value) || 0, 2);
const slug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const createId = (prefix = 'kpi') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Menyeragamkan struktur sebelum dipublish: angka valid, key isian unik,
 * dan rowSpan untuk export Excel/PDF dihitung ulang otomatis.
 */
export function normalizeKpiSections(sections) {
  const usedKeys = new Set();

  const normalized = (sections || []).map((section, sectionIndex) => {
    const code = String(section.code || String.fromCharCode(65 + sectionIndex)).trim();
    const items = (section.items || []).map((item, itemIndex) => {
      const meta = CALC_TYPES[item.calcType] || CALC_TYPES.single_target;
      // Bagian penalti selalu berbobot negatif, bagian capaian selalu positif.
      const rawBobot = Math.abs(Number(item.bobot) || 0);
      const bobot = section.isPenaltySection ? -rawBobot : rawBobot;
      const targetNum = Number(item.targetNum) || 0;
      const rawSubrows = item.subrows?.length ? item.subrows : [{ label: 'Nilai realisasi' }];
      const subrows = rawSubrows.map((sub, subIndex) => {
        const base = slug(sub.key) || `${slug(code)}_${itemIndex + 1}_${subIndex + 1}`;
        let key = base;
        let counter = 1;
        while (usedKeys.has(key)) key = `${base}_${counter++}`;
        usedKeys.add(key);
        return { ...sub, key, label: sub.label || `Isian ${subIndex + 1}`, isTextInput: meta.textInput ? true : Boolean(sub.isTextInput) };
      });

      return {
        ...item,
        id: item.id || createId(code),
        no: String(item.no ?? itemIndex + 1),
        excelNo: String(item.excelNo ?? item.no ?? itemIndex + 1),
        indikator: item.indikator || 'Indikator baru',
        formula: item.formula || '',
        bobot,
        bobotDisplay: toDisplay(bobot),
        targetNum,
        targetDisplay: item.targetDisplay?.toString().trim() ? String(item.targetDisplay) : toDisplay(targetNum),
        satuan: item.satuan || '-',
        calcType: CALC_TYPES[item.calcType] ? item.calcType : 'single_target',
        hideExcelNo: itemIndex > 0 && Boolean(item.hideExcelNo),
        hideIndikatorCell: itemIndex > 0 && Boolean(item.hideIndikatorCell),
        subrows,
      };
    });

    // Hitung ulang rowSpan untuk sel NO & INDIKATOR yang digabung (merge) pada export.
    items.forEach((item, index) => {
      if (!item.hideExcelNo) {
        let span = 0;
        for (let j = index; j < items.length; j += 1) {
          if (j > index && !items[j].hideExcelNo) break;
          span += items[j].subrows.length + (items[j].groupBannerTitle ? 1 : 0);
        }
        item.excelNoRowSpan = span;
      } else {
        item.excelNoRowSpan = 0;
      }
      if (!item.hideIndikatorCell) {
        let span = 0;
        for (let j = index; j < items.length; j += 1) {
          if (j > index && !items[j].hideIndikatorCell) break;
          span += items[j].subrows.length;
        }
        item.indikatorRowSpan = span;
      } else {
        item.indikatorRowSpan = 0;
      }
    });

    const rawTotal = Math.abs(Number(section.totalWeight) || 0);
    const totalWeight = section.isPenaltySection ? -rawTotal : rawTotal;
    return {
      ...section,
      code,
      title: section.title || `Bagian ${code}`,
      totalWeight,
      weightDisplay: toDisplay(totalWeight),
      isPenaltySection: Boolean(section.isPenaltySection),
      items,
    };
  });

  return normalized;
}

/** Validasi struktur untuk ditampilkan di desainer. */
export function validateKpiSections(sections) {
  const issues = [];
  const keys = new Map();
  const codes = new Set();
  let positiveTotal = 0;

  sections.forEach((section) => {
    if (codes.has(section.code)) {
      issues.push({ level: 'error', sectionCode: section.code, message: `Kode bagian "${section.code}" dipakai lebih dari satu kali.` });
    }
    codes.add(section.code);
    if (!section.items.length) {
      issues.push({ level: 'warn', sectionCode: section.code, message: `Bagian ${section.code} belum memiliki baris indikator.` });
    }
    const itemSum = section.items.reduce((acc, item) => acc + (Number(item.bobot) || 0), 0);
    if (!section.isPenaltySection) positiveTotal += itemSum;
    if (Math.abs(itemSum - (Number(section.totalWeight) || 0)) > 0.001) {
      issues.push({ level: 'warn', sectionCode: section.code, message: `Bagian ${section.code}: jumlah bobot baris (${formatIndonesianNumber(itemSum, 2)}) ≠ bobot bagian (${formatIndonesianNumber(Number(section.totalWeight) || 0, 2)}).` });
    }
    section.items.forEach((item) => {
      const meta = CALC_TYPES[item.calcType] || CALC_TYPES.single_target;
      if ((item.subrows?.length || 0) < meta.minInputs) {
        issues.push({ level: 'error', itemId: item.id, message: `${section.code}.${item.no} ${item.indikator}: rumus "${meta.label}" butuh minimal ${meta.minInputs} isian.` });
      }
      if (item.calcType === 'custom') {
        const formulaError = validateKpiFormula(item.formulaExpr, item.subrows?.length || 0);
        if (formulaError) issues.push({ level: 'error', itemId: item.id, message: `${section.code}.${item.no}: ${formulaError}` });
        if (/\bT\b/i.test(item.formulaExpr || '') && !(Number(item.targetNum) > 0)) {
          issues.push({ level: 'error', itemId: item.id, message: `${section.code}.${item.no}: rumus memakai T, target numerik harus > 0.` });
        }
      }
      if (meta.needsTarget && !(Number(item.targetNum) > 0)) {
        issues.push({ level: 'error', itemId: item.id, message: `${section.code}.${item.no}: target numerik harus > 0.` });
      }
      if (meta.needsDeadline === 1 && !item.deadlineISO) {
        issues.push({ level: 'error', itemId: item.id, message: `${section.code}.${item.no}: batas waktu belum diisi.` });
      }
      if (meta.needsDeadline === 2 && !(item.deadlinesISO?.[0] && item.deadlinesISO?.[1])) {
        issues.push({ level: 'error', itemId: item.id, message: `${section.code}.${item.no}: dua batas waktu semester belum lengkap.` });
      }
      if (meta.penalty && !section.isPenaltySection) {
        issues.push({ level: 'warn', itemId: item.id, message: `${section.code}.${item.no}: rumus kepatuhan sebaiknya berada di bagian penalti.` });
      }
      (item.subrows || []).forEach((sub) => {
        if (sub.key && keys.has(sub.key)) issues.push({ level: 'error', itemId: item.id, message: `Key isian "${sub.key}" dipakai lebih dari satu kali.` });
        keys.set(sub.key, true);
      });
    });
  });

  if (Math.abs(positiveTotal - 100) > 0.001) {
    issues.unshift({ level: 'warn', message: `Total bobot capaian (non-penalti) = ${formatIndonesianNumber(positiveTotal, 2)}. Idealnya 100.` });
  }

  return { issues, positiveTotal };
}

/* ───────────────────────── Persistensi & sinkronisasi ───────────────────────── */

const readJSON = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

export const readPublishedKpiConfig = () => readJSON(KPI_CONFIG_KEY, null);
export const readKpiHistory = () => readJSON(KPI_HISTORY_KEY, []);

export function publishKpiSections(sections, { actor = 'Superadmin PRP', note = '', snapshot = false } = {}) {
  const normalized = normalizeKpiSections(sections);
  const previous = readPublishedKpiConfig();
  const config = {
    version: (previous?.version && previous.version < 1e9 ? previous.version : 0) + 1,
    publishedAt: new Date().toISOString(),
    publishedBy: actor,
    sections: normalized,
  };
  localStorage.setItem(KPI_CONFIG_KEY, JSON.stringify(config));

  if (snapshot) {
    const history = [{ ...config, note }, ...readKpiHistory()].slice(0, 15);
    localStorage.setItem(KPI_HISTORY_KEY, JSON.stringify(history));
  }

  // Sinkronisasi tab yang sama (event 'storage' hanya otomatis untuk tab lain).
  window.dispatchEvent(new CustomEvent(KPI_CONFIG_EVENT, { detail: config }));
  return config;
}

export function subscribeKpiConfig(callback) {
  const onStorage = (event) => {
    if (!event.key || event.key === KPI_CONFIG_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(KPI_CONFIG_EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(KPI_CONFIG_EVENT, callback);
  };
}
