/**
 * Skema, master PIC, kalkulasi, validasi struktur, dan penyimpanan konfigurasi tabel KPI.
 * Dipakai bersama oleh lembar kerja operasional unit/PIC dan Desainer Tabel KPI (Superadmin PRP).
 */

import { evaluateKpiFormula, validateKpiFormula } from './formulaEngine';

export const KPI_CONFIG_KEY = 'prp_kpi_config';
export const KPI_DRAFT_KEY = 'prp_kpi_draft';
export const KPI_HISTORY_KEY = 'prp_kpi_history';
export const KPI_LIVE_SYNC_KEY = 'prp_kpi_live_sync';
export const KPI_VALIDATION_RULES_KEY = 'prp_kpi_validation_rules';
export const KPI_CONFIG_EVENT = 'prp-kpi-config-updated';

export const MASTER_KPI_PICS = Object.freeze([
  { code: 'PPA', name: 'Pusat Pelayanan Akademik (PPA)', category: 'units' },
  { code: 'BAKT', name: 'Biro Akuntansi (BAKT)', category: 'bureaus' },
  { code: 'BAG', name: 'Biro Anggaran (BAG)', category: 'bureaus' },
  { code: 'BKU', name: 'Biro Keuangan (BKU)', category: 'bureaus' },
  { code: 'PJM', name: 'Pusat Jaminan Mutu (PJM)', category: 'units' },
  { code: 'PRP', name: 'Direktorat Perencanaan & Pengembangan (PRP)', category: 'teams' },
  { code: 'BPKA', name: 'Biro Pengembangan Karir & Alumni (BPKA)', category: 'bureaus' },
  { code: 'BKK', name: 'Biro Kemahasiswaan & Konseling (BKK)', category: 'bureaus' },
  { code: 'BKAI', name: 'Biro Kerja Sama Akademik Internasional (BKAI)', category: 'bureaus' },
  { code: 'BPIK', name: 'Biro Pemasaran, Informasi & Komunikasi (BPIK)', category: 'bureaus' },
  { code: 'BKM', name: 'Biro Kemahasiswaan (BKM)', category: 'bureaus' },
  { code: 'BSAR', name: 'Biro Sarana & Prasarana (BSAR)', category: 'bureaus' },
  { code: 'BPAD', name: 'Biro Pengelolaan Aset & Dukungan (BPAD)', category: 'bureaus' },
  { code: 'FAK', name: 'Fakultas & Program Studi (FAK)', category: 'faculties' },
  { code: 'LPPM', name: 'Lembaga Penelitian & Pengabdian kepada Masyarakat (LPPM)', category: 'units' },
  { code: 'SDM', name: 'Bagian Sumber Daya Manusia (SDM)', category: 'bureaus' },
  { code: 'BSDM', name: 'Biro Sumber Daya Manusia (BSDM)', category: 'bureaus' },
  { code: 'BKAN', name: 'Biro Kerja Sama Akademik Nasional (BKAN)', category: 'bureaus' },
  { code: 'BPTI', name: 'Biro Pengembangan Teknologi Informasi (BPTI)', category: 'bureaus' },
  { code: 'SPI', name: 'Satuan Pengawasan Intern (SPI)', category: 'teams' },
  { code: 'Akuntansi', name: 'Tim Akuntansi & Pelaporan (Akuntansi)', category: 'teams' },
  { code: 'WBS', name: 'Whistleblowing System (WBS)', category: 'teams' },
]);

const CANONICAL_PIC_MAP = new Map(MASTER_KPI_PICS.map((entry) => [entry.code.toLowerCase(), entry.code]));

const readJSON = (key, fallback) => {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

export function extractPicCodeFromOrgEntry(entryText) {
  const raw = String(entryText ?? '').trim();
  if (!raw) return '';
  const parenMatch = raw.match(/\(([A-Za-z0-9_-]{2,20})\)\s*$/);
  if (parenMatch) {
    const candidate = parenMatch[1].trim();
    return CANONICAL_PIC_MAP.get(candidate.toLowerCase()) || candidate;
  }
  const canonical = CANONICAL_PIC_MAP.get(raw.toLowerCase());
  if (canonical) return canonical;
  if (/^[A-Za-z0-9_-]{2,16}$/.test(raw)) return raw;
  const words = raw.split(/\s+/).filter((word) => /^[A-Za-z]/.test(word) && !/^(dan|&|di|ke|dari|untuk|pada)$/i.test(word));
  if (words.length >= 2) {
    const acronym = words.map((word) => word[0].toUpperCase()).join('').slice(0, 8);
    return CANONICAL_PIC_MAP.get(acronym.toLowerCase()) || acronym;
  }
  return raw.slice(0, 12).toUpperCase();
}

export function readMasterPicCatalog() {
  const map = new Map(MASTER_KPI_PICS.map((entry) => [entry.code.toLowerCase(), { ...entry }]));
  const org = readJSON('prp_organization', { units: [], faculties: [], bureaus: [], teams: [] });
  ['units', 'faculties', 'bureaus', 'teams'].forEach((category) => {
    const list = Array.isArray(org?.[category]) ? org[category] : [];
    list.forEach((rawEntry) => {
      if (rawEntry && typeof rawEntry === 'object') {
        const rawCode = String(rawEntry.code ?? '').trim();
        const rawName = String(rawEntry.name ?? '').trim();
        const code = (rawCode ? (CANONICAL_PIC_MAP.get(rawCode.toLowerCase()) || rawCode) : extractPicCodeFromOrgEntry(rawName));
        if (!code) return;
        const key = code.toLowerCase();
        const existing = map.get(key);
        map.set(key, {
          code: existing?.code || code,
          name: rawName || existing?.name || code,
          category,
          picEmail: rawEntry.picEmail || existing?.picEmail || '',
        });
        return;
      }
      const label = String(rawEntry ?? '').trim();
      const code = extractPicCodeFromOrgEntry(label);
      if (!code) return;
      const key = code.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { code, name: label, category });
      }
    });
  });
  return [...map.values()];
}

export function normalizePicCode(token) {
  const cleaned = String(token ?? '').trim();
  if (!cleaned) return '';
  const fromMaster = CANONICAL_PIC_MAP.get(cleaned.toLowerCase());
  if (fromMaster) return fromMaster;
  const dynamicCatalog = readMasterPicCatalog();
  const fromCatalog = dynamicCatalog.find((entry) => entry.code.toLowerCase() === cleaned.toLowerCase());
  if (fromCatalog) return fromCatalog.code;
  return cleaned;
}

export function normalizePicCodes(input) {
  const rawTokens = Array.isArray(input)
    ? input.flatMap((entry) => String(entry ?? '').split(/[,;/+&]|\bdan\b/i))
    : String(input ?? '').split(/[,;/+&]|\bdan\b/i);
  const seen = new Set();
  const result = [];
  rawTokens.forEach((token) => {
    const normalized = normalizePicCode(token);
    if (!normalized) return;
    const lower = normalized.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    result.push(normalized);
  });
  return result;
}

export function formatPicDisplay(pics, customDisplay = '') {
  const normalized = normalizePicCodes(pics);
  const trimmedCustom = String(customDisplay ?? '').trim();
  if (trimmedCustom) {
    const fromCustom = normalizePicCodes(trimmedCustom);
    const sameLength = fromCustom.length === normalized.length;
    const sameCodes = sameLength && fromCustom.every((code, idx) => code.toLowerCase() === normalized[idx].toLowerCase());
    if (sameCodes) return trimmedCustom;
  }
  return normalized.join(', ');
}

export function getUserPicCodes(user) {
  if (!user) return [];
  if (Array.isArray(user.picCodes) && user.picCodes.length > 0) {
    return normalizePicCodes(user.picCodes);
  }
  if (typeof user.picCode === 'string' && user.picCode.trim()) {
    return normalizePicCodes(user.picCode);
  }
  if (typeof user.unit === 'string' && user.unit.trim()) {
    const paren = user.unit.match(/\(([A-Za-z0-9_,\s-]+)\)/);
    if (paren) return normalizePicCodes(paren[1]);
    const direct = CANONICAL_PIC_MAP.get(user.unit.trim().toLowerCase());
    if (direct) return [direct];
  }
  return [];
}

export function canUserEditKpiItem(item, user) {
  if (!user || user.status === 'Nonaktif') return false;
  if (user.role === 'superadmin_prp') return true;
  const rowPics = normalizePicCodes(item?.pics?.length ? item.pics : (item?.picDisplay || []));
  const hasKpiAuthority = !user.role || user.role === 'kpi_only' || user.role === 'dual';
  // Baris tanpa penugasan PIC spesifik tetap dapat diisi akun KPI/Dual untuk menjaga kompatibilitas formulir umum.
  if (rowPics.length === 0) return hasKpiAuthority;
  if (!hasKpiAuthority) return false;
  const userPics = new Set(getUserPicCodes(user).map((code) => code.toLowerCase()));
  if (userPics.size === 0) return false;
  return rowPics.some((code) => userPics.has(code.toLowerCase()));
}

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
  if (num === null || num === undefined || !Number.isFinite(num)) return '-';
  return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
}

export const CALC_TYPES = {
  custom: {
    label: 'Rumus bebas (ala Excel)',
    expression: 'Tulis sendiri, mis. I1/I2*100 atau SUM(I1;I2)/T*100',
    minInputs: 1,
  },
  single_target: {
    label: 'Realisasi / Target',
    expression: 'Capaian = Isian 1 / Target x 100%',
    minInputs: 1,
    needsTarget: true,
  },
  ratio_two: {
    label: 'Rasio dua isian',
    expression: 'Capaian = Isian 1 / Isian 2 x 100%',
    minInputs: 2,
  },
  ratio_target_pct: {
    label: 'Rasio isian terhadap target %',
    expression: 'Capaian = (Isian 1 / Isian 2 x 100%) / Target x 100%',
    minInputs: 2,
    needsTarget: true,
  },
  sum_two_target: {
    label: 'Jumlah dua isian / Target',
    expression: 'Capaian = (Isian 1 + Isian 2) / Target x 100%',
    minInputs: 2,
    needsTarget: true,
  },
  tracer_study: {
    label: 'Tracer study (6 komponen + responden)',
    expression: 'Capaian = (Total Isian 1-6 / Isian 7) / Target x 100%',
    minInputs: 7,
    needsTarget: true,
  },
  primary_with_meta: {
    label: 'Isian utama + keterangan',
    expression: 'Capaian = Isian 1 / Target x 100% (Isian 2 sebagai catatan)',
    minInputs: 2,
    needsTarget: true,
  },
  compliance_date_single: {
    label: 'Kepatuhan tanggal (1 batas waktu)',
    expression: 'Penalti penuh jika tanggal isian melewati batas waktu',
    minInputs: 1,
    needsDeadline: 1,
    penalty: true,
    textInput: true,
  },
  compliance_date_dual: {
    label: 'Kepatuhan tanggal (2 semester)',
    expression: 'Penalti setengah bobot untuk setiap semester yang terlambat',
    minInputs: 2,
    needsDeadline: 2,
    penalty: true,
    textInput: true,
  },
  compliance_integration_pct: {
    label: 'Kepatuhan persentase (target 100%)',
    expression: 'Penalti = (100% - Isian 1) x bobot',
    minInputs: 1,
    penalty: true,
  },
  compliance_audit_ratio: {
    label: 'Rasio temuan audit belum ditindaklanjuti',
    expression: 'Penalti = (Isian 1 / Isian 2) x bobot',
    minInputs: 2,
    penalty: true,
  },
};

/**
 * Rumus ekuivalen untuk preset non-tanggal agar PRP dapat beralih ke rumus bebas tanpa menulis dari nol.
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

const toDeadline = (iso) => (iso ? new Date(`${iso}T23:59:59`) : null);

export const cleanRefCode = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
export const itemRefPrefix = (sectionCode, itemNo) => `${cleanRefCode(sectionCode || 'A')}${cleanRefCode(itemNo || '1')}`;

/**
 * Membangun peta referensi sel ala Excel untuk seluruh tabel KPI (mis. A1A_I1, A1A_T, A1A_B).
 */
export function buildKpiCellDirectory(sections = [], values = {}) {
  const cells = {};
  const labels = {};
  const allowedRefs = new Set();

  (sections || []).forEach((section, sIdx) => {
    const secCode = cleanRefCode(section.code || String.fromCharCode(65 + sIdx));
    (section.items || []).forEach((item, iIdx) => {
      const prefix = itemRefPrefix(secCode, item.no ?? (iIdx + 1));
      const targetVal = Number(item.targetNum) || 0;
      const bobotVal = Math.abs(Number(item.bobot) || 0);

      const tRef = `${prefix}_T`;
      const bRef = `${prefix}_B`;
      cells[tRef] = targetVal;
      cells[bRef] = bobotVal;
      allowedRefs.add(tRef);
      allowedRefs.add(bRef);
      labels[tRef] = `${section.code}.${item.no} Target`;
      labels[bRef] = `${section.code}.${item.no} Bobot`;

      (item.subrows || []).forEach((sub, subIdx) => {
        const iRef = `${prefix}_I${subIdx + 1}`;
        const parsed = parseIndonesianNumber(values?.[sub.key] ?? '');
        cells[iRef] = parsed;
        allowedRefs.add(iRef);
        labels[iRef] = `${section.code}.${item.no} ${sub.label || `Isian ${subIdx + 1}`}`;
      });
    });
  });

  return { cells, labels, allowedRefs };
}

/**
 * Menghitung satu baris indikator KPI. Capaian dibatasi 0-100%, skor dibatasi oleh bobot baris.
 */
export function computeKpiItem(item, values, isPenaltySection, allSections = null) {
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
      const globalCells = allSections ? buildKpiCellDirectory(allSections, values).cells : null;
      const result = evaluateKpiFormula(item.formulaExpr, {
        inputs: parsedSubs.map((sub) => sub.num),
        target: targetNum,
        bobot,
        cells: globalCells,
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

const toDisplay = (value) => formatIndonesianNumber(Number(value) || 0, 2);
const slug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const createId = (prefix = 'kpi') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Menyeragamkan struktur sebelum dipublikasikan: angka valid, PIC ternormalisasi, key isian unik, dan rowSpan ekspor dihitung otomatis.
 */
export function normalizeKpiSections(sections) {
  const usedKeys = new Set();

  const normalized = (sections || []).map((section, sectionIndex) => {
    const code = String(section.code || String.fromCharCode(65 + sectionIndex)).trim();
    const items = (section.items || []).map((item, itemIndex) => {
      const meta = CALC_TYPES[item.calcType] || CALC_TYPES.single_target;
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
      const pics = normalizePicCodes(item.pics ?? item.picDisplay ?? []);
      const picDisplay = formatPicDisplay(pics, item.picDisplay);

      return {
        ...item,
        id: item.id || createId(code),
        no: String(item.no ?? itemIndex + 1),
        excelNo: String(item.excelNo ?? item.no ?? itemIndex + 1),
        indikator: item.indikator || 'Indikator baru',
        formula: item.formula || '',
        pics,
        picDisplay,
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

const roundWeight = (value) => Math.round((Number(value) || 0) * 1e6) / 1e6;
const WEIGHT_TOLERANCE = 0.0001;
export const TARGET_TOTAL_WEIGHT = 100;

export const DEFAULT_KPI_VALIDATION_RULES = Object.freeze({
  targetPositiveWeight: TARGET_TOTAL_WEIGHT,
  totalWeightPolicy: 'warn',
  sectionWeightPolicy: 'warn',
  maxPenaltyWeight: 12.5,
  penaltyWeightPolicy: 'off',
  requirePicPolicy: 'off',
  requireFormulaText: false,
  requireEvidenceOnSubmit: true,
});

const sanitizePolicy = (value, fallback) => (['error', 'warn', 'off'].includes(value) ? value : fallback);

export function readKpiValidationRules() {
  const stored = readJSON(KPI_VALIDATION_RULES_KEY, null);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_KPI_VALIDATION_RULES };
  const targetPositiveWeight = Number(stored.targetPositiveWeight);
  const maxPenaltyWeight = Number(stored.maxPenaltyWeight);
  return {
    targetPositiveWeight: Number.isFinite(targetPositiveWeight) && targetPositiveWeight > 0 ? targetPositiveWeight : DEFAULT_KPI_VALIDATION_RULES.targetPositiveWeight,
    totalWeightPolicy: sanitizePolicy(stored.totalWeightPolicy, DEFAULT_KPI_VALIDATION_RULES.totalWeightPolicy),
    sectionWeightPolicy: sanitizePolicy(stored.sectionWeightPolicy, DEFAULT_KPI_VALIDATION_RULES.sectionWeightPolicy),
    maxPenaltyWeight: Number.isFinite(maxPenaltyWeight) && maxPenaltyWeight >= 0 ? maxPenaltyWeight : DEFAULT_KPI_VALIDATION_RULES.maxPenaltyWeight,
    penaltyWeightPolicy: sanitizePolicy(stored.penaltyWeightPolicy, DEFAULT_KPI_VALIDATION_RULES.penaltyWeightPolicy),
    requirePicPolicy: sanitizePolicy(stored.requirePicPolicy, DEFAULT_KPI_VALIDATION_RULES.requirePicPolicy),
    requireFormulaText: Boolean(stored.requireFormulaText),
    requireEvidenceOnSubmit: stored.requireEvidenceOnSubmit === undefined ? DEFAULT_KPI_VALIDATION_RULES.requireEvidenceOnSubmit : Boolean(stored.requireEvidenceOnSubmit),
    updatedAt: stored.updatedAt || null,
    updatedBy: stored.updatedBy || null,
  };
}

export function saveKpiValidationRules(patch = {}, actor = 'Superadmin PRP') {
  const current = readKpiValidationRules();
  const merged = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
  const sanitized = {
    targetPositiveWeight: Number.isFinite(Number(merged.targetPositiveWeight)) && Number(merged.targetPositiveWeight) > 0
      ? Number(merged.targetPositiveWeight)
      : DEFAULT_KPI_VALIDATION_RULES.targetPositiveWeight,
    totalWeightPolicy: sanitizePolicy(merged.totalWeightPolicy, DEFAULT_KPI_VALIDATION_RULES.totalWeightPolicy),
    sectionWeightPolicy: sanitizePolicy(merged.sectionWeightPolicy, DEFAULT_KPI_VALIDATION_RULES.sectionWeightPolicy),
    maxPenaltyWeight: Number.isFinite(Number(merged.maxPenaltyWeight)) && Number(merged.maxPenaltyWeight) >= 0
      ? Number(merged.maxPenaltyWeight)
      : DEFAULT_KPI_VALIDATION_RULES.maxPenaltyWeight,
    penaltyWeightPolicy: sanitizePolicy(merged.penaltyWeightPolicy, DEFAULT_KPI_VALIDATION_RULES.penaltyWeightPolicy),
    requirePicPolicy: sanitizePolicy(merged.requirePicPolicy, DEFAULT_KPI_VALIDATION_RULES.requirePicPolicy),
    requireFormulaText: Boolean(merged.requireFormulaText),
    requireEvidenceOnSubmit: merged.requireEvidenceOnSubmit === undefined ? true : Boolean(merged.requireEvidenceOnSubmit),
    updatedAt: merged.updatedAt,
    updatedBy: merged.updatedBy,
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(KPI_VALIDATION_RULES_KEY, JSON.stringify(sanitized));
    const audits = readJSON('prp_audit', []);
    const auditEntry = {
      id: createId('audit'),
      action: 'ATURAN_VALIDASI_KPI',
      detail: `Aturan validasi struktur diperbarui (target bobot ${sanitized.targetPositiveWeight}, kebijakan bobot ${sanitized.totalWeightPolicy}, kebijakan PIC ${sanitized.requirePicPolicy})`,
      actor,
      at: sanitized.updatedAt,
    };
    localStorage.setItem('prp_audit', JSON.stringify([auditEntry, ...audits].slice(0, 500)));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(KPI_CONFIG_EVENT, { detail: { validationRules: sanitized } }));
    window.dispatchEvent(new Event('prp-admin-updated'));
  }
  return sanitized;
}

/**
 * Validasi struktur tabel KPI berdasarkan aturan teknis rumus dan kebijakan tata kelola Admin PRP.
 */
export function validateKpiSections(sections, rulesOverride = null) {
  const rules = rulesOverride
    ? { ...readKpiValidationRules(), ...rulesOverride }
    : readKpiValidationRules();
  const issues = [];
  const keys = new Map();
  const codes = new Set();
  const sectionSummaries = [];
  const { allowedRefs } = buildKpiCellDirectory(sections);
  const fmt = (value) => formatIndonesianNumber(value, 4);

  sections.forEach((section) => {
    if (codes.has(section.code)) {
      issues.push({ level: 'error', sectionCode: section.code, message: `Kode bagian "${section.code}" dipakai lebih dari satu kali.` });
    }
    codes.add(section.code);
    if (!section.items.length) {
      issues.push({ level: 'warn', sectionCode: section.code, message: `Bagian ${section.code} belum memiliki baris indikator.` });
    }

    const itemSum = roundWeight(section.items.reduce((acc, item) => acc + Math.abs(Number(item.bobot) || 0), 0));
    const sectionWeight = roundWeight(Math.abs(Number(section.totalWeight) || 0));
    const diff = roundWeight(itemSum - sectionWeight);
    sectionSummaries.push({
      code: section.code,
      title: section.title,
      isPenaltySection: Boolean(section.isPenaltySection),
      itemCount: section.items.length,
      itemSum,
      sectionWeight,
      diff,
      matches: Math.abs(diff) <= WEIGHT_TOLERANCE,
    });
    if (Math.abs(diff) > WEIGHT_TOLERANCE && rules.sectionWeightPolicy !== 'off') {
      issues.push({
        level: rules.sectionWeightPolicy,
        sectionCode: section.code,
        message: `Bagian ${section.code}: total bobot baris ${fmt(itemSum)} tidak sama dengan bobot bagian ${fmt(sectionWeight)} (selisih ${diff > 0 ? '+' : ''}${fmt(diff)}). `
          + `Ubah bobot bagian menjadi ${fmt(itemSum)} atau ${diff > 0 ? 'kurangi' : 'tambah'} bobot baris sebanyak ${fmt(Math.abs(diff))}.`,
      });
    }
    section.items.forEach((item) => {
      const meta = CALC_TYPES[item.calcType] || CALC_TYPES.single_target;
      const rowSubrows = item.subrows || item.inputs || [];
      if (rowSubrows.length < meta.minInputs) {
        issues.push({ level: 'error', itemId: item.id, message: `${section.code}.${item.no} ${item.indikator || item.label || ''}: rumus "${meta.label}" butuh minimal ${meta.minInputs} isian.` });
      }
      if (item.calcType === 'custom') {
        const formulaError = validateKpiFormula(item.formulaExpr, rowSubrows.length, allowedRefs);
        if (formulaError) issues.push({ level: 'error', itemId: item.id, message: `${section.code}.${item.no}: ${formulaError}` });
        if (/\bT\b/i.test(item.formulaExpr || '') && !(Number(item.targetNum) > 0)) {
          issues.push({ level: 'error', itemId: item.id, message: `${section.code}.${item.no}: rumus memakai T, target numerik harus > 0.` });
        }
      }
      if (meta.needsTarget && item.calcType && !(Number(item.targetNum) > 0)) {
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
      if (rules.requirePicPolicy !== 'off') {
        const rowPics = normalizePicCodes(item.pics ?? item.picDisplay ?? []);
        if (rowPics.length === 0) {
          issues.push({
            level: rules.requirePicPolicy,
            itemId: item.id,
            message: `${section.code}.${item.no} ${item.indikator || ''}: PIC penanggung jawab belum ditetapkan.`,
          });
        }
      }
      if (rules.requireFormulaText && !String(item.formula ?? '').trim()) {
        issues.push({
          level: 'warn',
          itemId: item.id,
          message: `${section.code}.${item.no} ${item.indikator || ''}: narasi rumusan indikator masih kosong.`,
        });
      }
      (item.subrows || []).forEach((sub) => {
        if (sub.key && keys.has(sub.key)) issues.push({ level: 'error', itemId: item.id, message: `Key isian "${sub.key}" dipakai lebih dari satu kali.` });
        keys.set(sub.key, true);
      });
    });
  });

  const positiveTotal = roundWeight(sectionSummaries.filter((s) => !s.isPenaltySection).reduce((acc, s) => acc + s.itemSum, 0));
  const penaltyTotal = roundWeight(sectionSummaries.filter((s) => s.isPenaltySection).reduce((acc, s) => acc + s.itemSum, 0));
  const targetWeight = Number(rules.targetPositiveWeight) || TARGET_TOTAL_WEIGHT;
  const totalDiff = roundWeight(positiveTotal - targetWeight);
  if (Math.abs(totalDiff) > WEIGHT_TOLERANCE && rules.totalWeightPolicy !== 'off') {
    const breakdown = sectionSummaries.filter((s) => !s.isPenaltySection).map((s) => `${s.code} ${fmt(s.itemSum)}`).join(' + ');
    issues.unshift({
      level: rules.totalWeightPolicy,
      message: `Total bobot capaian (non-penalti) = ${breakdown || '0'} = ${fmt(positiveTotal)}; target struktur ${fmt(targetWeight)} `
        + `(${totalDiff > 0 ? 'kelebihan' : 'kurang'} ${fmt(Math.abs(totalDiff))}).`,
    });
  }
  if (rules.penaltyWeightPolicy !== 'off') {
    const maxPenalty = Number(rules.maxPenaltyWeight) || 0;
    const penaltyDiff = roundWeight(penaltyTotal - maxPenalty);
    if (penaltyDiff > WEIGHT_TOLERANCE) {
      issues.push({
        level: rules.penaltyWeightPolicy,
        message: `Total bobot penalti bagian kepatuhan ${fmt(penaltyTotal)} melebihi batas maksimal ${fmt(maxPenalty)} (kelebihan +${fmt(penaltyDiff)}).`,
      });
    }
  }

  return { issues, positiveTotal, penaltyTotal, totalDiff, sectionSummaries, rules };
}

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

  window.dispatchEvent(new CustomEvent(KPI_CONFIG_EVENT, { detail: config }));
  return config;
}

export function subscribeKpiConfig(callback) {
  const onStorage = (event) => {
    if (!event.key || event.key === KPI_CONFIG_KEY || event.key === KPI_VALIDATION_RULES_KEY) callback();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(KPI_CONFIG_EVENT, callback);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(KPI_CONFIG_EVENT, callback);
  };
}
