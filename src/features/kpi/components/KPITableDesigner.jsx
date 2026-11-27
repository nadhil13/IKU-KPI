/**
 * Desainer Tabel & Formula KPI (Superadmin PRP).
 * Menyediakan pengeditan langsung sel ala spreadsheet, kolom PIC per indikator yang tersinkronisasi
 * dengan master data organisasi, sinkronisasi baris realtime ke formulir seluruh unit kerja,
 * serta konfigurasi aturan validasi struktur oleh Admin PRP.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, CircleCheck, Copy, Ellipsis, Eye, FileSpreadsheet, GitMerge, History, Lock, LockOpen, MousePointerClick,
  PanelRightClose, Plus, Radio, RotateCcw, Send, Settings2, Sigma, Split, Table2, Trash2, TriangleAlert, Users, X,
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../auth/hooks/useAuth';
import HorizontalTableViewport from '../../../shared/components/HorizontalTableViewport';
import { KPI_SECTIONS_CONFIG } from '../kpiTemplateConfig';
import KPIDataEntrySheet from './KPIDataEntrySheet';
import {
  CALC_TYPES, PRESET_FORMULA_EXPR, KPI_DRAFT_KEY, KPI_LIVE_SYNC_KEY, DEFAULT_KPI_VALIDATION_RULES,
  createId, normalizeKpiSections, publishKpiSections, readKpiHistory, readPublishedKpiConfig,
  validateKpiSections, computeKpiItem, formatIndonesianNumber, buildKpiCellDirectory, itemRefPrefix,
  readMasterPicCatalog, normalizePicCode, normalizePicCodes, formatPicDisplay, readKpiValidationRules, saveKpiValidationRules,
  computeKpiExcelRowMap, resolveItemPicRoles, getKpiAchievementMeta,
} from '../kpiSchema';
import { compileFormula, describeKpiFormula, validateKpiFormula } from '../formulaEngine';
import {
  distributeKpiForm,
  syncActiveKpiFormSections,
  getKpiUnits,
  listKpiPeriodsWithStatus,
  syncPeriodMasterTable,
  getFormForPeriod,
} from '../kpiWorkflowStore';
import './KPITableDesigner.css';

const clone = (value) => JSON.parse(JSON.stringify(value));
const newSub = (index = 1) => ({ key: createId('input'), label: `Isian ${index}`, placeholder: '0' });
const blankItem = (code, no) => ({
  id: createId(code),
  no: String(no),
  excelNo: String(no),
  indikator: 'Indikator baru',
  pics: [],
  picDisplay: '',
  formula: 'Realisasi / Target x 100%',
  formulaExpr: PRESET_FORMULA_EXPR.single_target,
  bobot: 0,
  targetNum: 100,
  targetDisplay: '100',
  satuan: '%',
  calcType: 'single_target',
  hideExcelNo: false,
  subrows: [newSub()],
});
const groupNumber = (item) => Number(String(item.no).match(/^\d+/)?.[0]) || 0;
const nextNumber = (items) => Math.max(0, ...items.map(groupNumber)) + 1;
const letters = (index) => {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    result = String.fromCharCode(97 + ((n - 1) % 26)) + result;
  }
  return result;
};
const move = (rows, index, direction) => {
  const target = index + direction;
  if (target < 0 || target >= rows.length) return rows;
  const result = [...rows];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
};
const stripEq = (expr) => String(expr ?? '').trim().replace(/^=\s*/, '');
const isDateType = (calcType) => Boolean(CALC_TYPES[calcType]?.needsDeadline);
const visibleExpr = (item) => (item.calcType === 'custom' ? item.formulaExpr ?? '' : PRESET_FORMULA_EXPR[item.calcType] ?? '');

function hydrateDefaultPics(sections) {
  const defaultMap = new Map();
  (KPI_SECTIONS_CONFIG || []).forEach((sec) => {
    (sec.items || []).forEach((item) => {
      if (item.id && (item.pics?.length || item.picDisplay)) {
        defaultMap.set(item.id, { pics: item.pics || [], picDisplay: item.picDisplay || '' });
      }
    });
  });

  return (sections || []).map((section) => ({
    ...section,
    items: (section.items || []).map((item) => {
      const hasPic = (Array.isArray(item.pics) && item.pics.length > 0) || Boolean(String(item.picDisplay || '').trim());
      const fallback = !hasPic && !item.picClearedByAdmin ? defaultMap.get(item.id) : null;
      return {
        ...item,
        pics: fallback ? fallback.pics : (item.pics || []),
        picDisplay: fallback ? fallback.picDisplay : (item.picDisplay || ''),
        formulaExpr: item.formulaExpr ?? PRESET_FORMULA_EXPR[item.calcType] ?? '',
      };
    }),
  }));
}

function migrate(sections) {
  return normalizeKpiSections(hydrateDefaultPics(sections));
}

function initialSections() {
  try {
    const draft = JSON.parse(localStorage.getItem(KPI_DRAFT_KEY) || 'null');
    return migrate(draft?.sections || readPublishedKpiConfig()?.sections || KPI_SECTIONS_CONFIG);
  } catch {
    return migrate(KPI_SECTIONS_CONFIG);
  }
}

function Cell({ value, onChange, multiline = false, className = '', ...props }) {
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <Tag
      {...props}
      rows={multiline ? 1 : undefined}
      className={`cell-input ${className}`}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

const OPERATORS = [
  { label: '+', token: '+', title: 'Tambah' },
  { label: '-', token: '-', title: 'Kurang' },
  { label: 'x', token: '*', title: 'Kali' },
  { label: '/', token: '/', title: 'Bagi' },
  { label: '(', token: '(', title: 'Kurung buka' },
  { label: ')', token: ')', title: 'Kurung tutup' },
  { label: 'x100', token: '*100', title: 'Kali 100 (jadikan persen)' },
  { label: ';', token: ';', title: 'Pemisah argumen fungsi' },
];
const FUNCTIONS = ['SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'IF', 'ABS'];
const COLUMNS = [
  'No',
  'Indikator kinerja',
  'PIC',
  'Rumusan isian',
  'Isian (simulasi)',
  'Bobot',
  'Target',
  'Satuan',
  'Rumus',
  'Capaian',
  'Skor',
];

export default function KPITableDesigner() {
  const { currentUser } = useAuth();
  const rootRef = useRef(null);
  const formulaRef = useRef(null);
  const sheetScrollRef = useRef(null);
  const noticeTimer = useRef(null);
  const sendingRef = useRef(false);
  const [sections, setSections] = useState(initialSections);
  const [picCatalog, setPicCatalog] = useState(readMasterPicCatalog);
  const [validationRules, setValidationRules] = useState(readKpiValidationRules);
  // Default aktif (true) agar setiap penambahan/perubahan baris langsung tersinkron ke form seluruh unit
  const [liveSync, setLiveSync] = useState(() => localStorage.getItem(KPI_LIVE_SYNC_KEY) !== 'false');
  const [selectedId, setSelectedId] = useState(null);
  const [pickMode, setPickMode] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [picPickerFor, setPicPickerFor] = useState(null);
  const [picSearch, setPicSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState(readKpiHistory);
  const [showPreview, setShowPreview] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [simValues, setSimValues] = useState({});
  const [periodString, setPeriodString] = useState(() => String(new Date().getFullYear()));
  const [periodsList, setPeriodsList] = useState(listKpiPeriodsWithStatus);
  const [syncOpenPeriod, setSyncOpenPeriod] = useState(true);
  const [syncLockPrevious, setSyncLockPrevious] = useState(true);
  const [sending, setSending] = useState(false);

  const selectedPeriodMeta = useMemo(() => {
    const clean = String(periodString || '').trim();
    if (!clean) return null;
    return (
      periodsList.find(
        (p) =>
          String(p.id) === clean ||
          String(p.year || '') === clean ||
          String(p.label || '') === clean ||
          String(p.label || p.name || '').includes(clean) ||
          String(p.id || '').includes(clean)
      ) || null
    );
  }, [periodsList, periodString]);

  const normalized = useMemo(() => normalizeKpiSections(sections), [sections]);
  const excelRowMap = useMemo(() => computeKpiExcelRowMap(normalized), [normalized]);
  const validation = useMemo(() => validateKpiSections(normalized, validationRules), [normalized, validationRules]);
  const directory = useMemo(() => buildKpiCellDirectory(normalized, simValues), [normalized, simValues]);
  const errorCount = validation.issues.filter((issue) => issue.level === 'error').length;
  const warnCount = validation.issues.length - errorCount;
  const hasBlockingError = errorCount > 0;
  const issuesByItem = useMemo(() => {
    const map = new Map();
    validation.issues.forEach((issue) => issue.itemId && map.set(issue.itemId, [...(map.get(issue.itemId) || []), issue]));
    return map;
  }, [validation]);

  const selectedSectionIndex = normalized.findIndex((section) => section.items.some((item) => item.id === selectedId));
  const selectedSection = selectedSectionIndex >= 0 ? normalized[selectedSectionIndex] : undefined;
  const selectedItemIndex = selectedSection ? selectedSection.items.findIndex((item) => item.id === selectedId) : -1;
  const selected = selectedItemIndex >= 0 ? selectedSection.items[selectedItemIndex] : null;
  const selectedExcelMeta = selected ? excelRowMap.itemRowInfo.get(selected.id) : null;
  const selectedPicRoles = useMemo(() => (selected ? resolveItemPicRoles(selected) : { primaryPic: '', coPics: [], allPics: [] }), [selected]);
  const selectedPrefix = selected ? itemRefPrefix(selectedSection.code, selected.no) : '';
  const selectedExpr = selected ? visibleExpr(selected) : '';
  const formulaEditable = Boolean(selected) && !isDateType(selected.calcType);
  const formulaError = selected && formulaEditable
    ? validateKpiFormula(selectedExpr, selected.subrows.length, directory.allowedRefs)
    : null;

  const referencedCells = useMemo(() => {
    if (!selected || !formulaEditable) return new Set();
    const { vars } = compileFormula(stripEq(selectedExpr));
    const refs = new Set();
    const selMeta = excelRowMap.itemRowInfo.get(selected.id);
    vars.forEach((name) => {
      if (/^I(\d+)$/.test(name)) {
        const subIdx = Number(name.slice(1)) - 1;
        refs.add(`${selectedPrefix}_${name}`);
        if (selMeta?.subRows?.[subIdx]) refs.add(`E${selMeta.subRows[subIdx]}`);
      } else if (name === 'B') {
        refs.add(`${selectedPrefix}_B`);
        if (selMeta?.startRow) refs.add(`F${selMeta.startRow}`);
      } else if (name === 'T') {
        refs.add(`${selectedPrefix}_T`);
        if (selMeta?.startRow) refs.add(`G${selMeta.startRow}`);
      } else {
        refs.add(name);
      }
    });
    return refs;
  }, [selected, formulaEditable, selectedExpr, selectedPrefix, excelRowMap]);

  const results = useMemo(() => {
    const map = new Map();
    normalized.forEach((section) => section.items.forEach((item) => {
      map.set(item.id, computeKpiItem(item, simValues, section.isPenaltySection, normalized));
    }));
    return map;
  }, [normalized, simValues]);

  const totalScore = [...results.values()].reduce((sum, result) => sum + (result.weightedScore || 0), 0);
  const totalRows = normalized.reduce((sum, section) => sum + section.items.length, 0);
  const activeUnitCount = useMemo(() => (picCatalog.length >= 0 ? getKpiUnits().length : 0), [picCatalog]);

  const notify = useCallback((message) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 6000);
  }, []);

  useEffect(() => {
    const syncMaster = () => {
      setPicCatalog(readMasterPicCatalog());
      setValidationRules(readKpiValidationRules());
      setPeriodsList(listKpiPeriodsWithStatus());
      setHistory(readKpiHistory());
    };
    window.addEventListener('prp-admin-updated', syncMaster);
    window.addEventListener('prp-kpi-workflow-updated', syncMaster);
    window.addEventListener('prp-kpi-config-updated', syncMaster);
    window.addEventListener('kpi-workflow-updated', syncMaster);
    window.addEventListener('storage', syncMaster);
    return () => {
      window.removeEventListener('prp-admin-updated', syncMaster);
      window.removeEventListener('prp-kpi-workflow-updated', syncMaster);
      window.removeEventListener('prp-kpi-config-updated', syncMaster);
      window.removeEventListener('kpi-workflow-updated', syncMaster);
      window.removeEventListener('storage', syncMaster);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KPI_DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), sections: normalized }));
    } catch {
      window.queueMicrotask(() => notify('Draft tidak dapat disimpan. Periksa penyimpanan browser.'));
    }
  }, [normalized, notify]);

  // Sinkronisasi struktur & baris realtime ke form seluruh unit kerja (debounced agar bebas spam)
  useEffect(() => {
    if (!liveSync || hasBlockingError) return undefined;
    const timer = window.setTimeout(() => {
      try {
        const actor = currentUser?.email || 'Superadmin PRP';
        publishKpiSections(normalized, { actor, note: 'Live sync', snapshot: false });
        syncActiveKpiFormSections(normalized, { actor });
      } catch {
        notify('Live sync gagal menyimpan konfigurasi.');
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [normalized, liveSync, hasBlockingError, notify, currentUser?.email]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  useEffect(() => {
    if (!confirmState) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setConfirmState(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmState]);

  useEffect(() => {
    if (!menuFor && !picPickerFor) return undefined;
    const close = (event) => {
      if (event.type === 'keydown') {
        if (event.key === 'Escape' || event.keyCode === 27) {
          setMenuFor(null);
          setPicPickerFor(null);
        }
        return;
      }
      if (menuFor && !event.target.closest('.sheet-menu')) setMenuFor(null);
      if (picPickerFor && !event.target.closest('.pic-cell')) setPicPickerFor(null);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', close);
    };
  }, [menuFor, picPickerFor]);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo('.sheet-shell', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out', clearProps: 'all' });
  }, { scope: rootRef, dependencies: [showPreview] });

  const focusSection = (si) => {
    const el = rootRef.current?.querySelector(`#kpi-section-${si}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    window.setTimeout(() => el.classList.remove('flash'), 1200);
  };

  const pushRealtimeStructureNow = useCallback((nextSectionsRaw, feedbackMessage) => {
    const clean = normalizeKpiSections(nextSectionsRaw);
    const check = validateKpiSections(clean);
    if (check.issues.some((i) => i.level === 'error')) {
      return;
    }
    const actor = currentUser?.email || 'Superadmin PRP';
    try {
      publishKpiSections(clean, { actor, note: feedbackMessage || 'Sinkronisasi baris realtime', snapshot: false });
      syncActiveKpiFormSections(clean, { actor });
      if (feedbackMessage) notify(feedbackMessage);
    } catch {
      notify('Gagal menyinkronkan struktur baris ke penyimpanan lokal.');
    }
  }, [currentUser?.email, notify]);

  const updateSection = (si, patch) => setSections((current) => current.map((section, index) => (
    index === si ? { ...section, ...patch } : section
  )));
  const editItems = (si, transform, immediateSyncNote = '') => setSections((current) => {
    const next = current.map((section, index) => (
      index === si ? { ...section, items: transform(section.items, section) } : section
    ));
    if (immediateSyncNote) {
      window.queueMicrotask(() => notify(immediateSyncNote));
    }
    return next;
  });
  const updateItem = (si, ii, patch) => editItems(si, (items) => items.map((item, index) => (
    index === ii ? { ...item, ...patch } : item
  )));
  const patchItemById = (id, patch) => setSections((current) => current.map((section) => ({
    ...section,
    items: section.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  })));
  const editSubs = (si, ii, transform) => editItems(si, (items) => items.map((item, index) => (
    index === ii ? { ...item, subrows: transform(item.subrows) } : item
  )));

  const setItemPrimaryPic = (item, rawPrimaryCode) => {
    const nextPrimary = normalizePicCode(rawPrimaryCode);
    const currentRoles = resolveItemPicRoles(item);
    const nextCoPics = currentRoles.coPics.filter((c) => c.toLowerCase() !== nextPrimary.toLowerCase());
    const nextPics = nextPrimary ? [nextPrimary, ...nextCoPics] : [...nextCoPics];
    patchItemById(item.id, {
      primaryPic: nextPrimary,
      coPics: nextPrimary ? nextCoPics : nextCoPics.slice(1),
      pics: nextPics,
      picDisplay: nextPics.join(', '),
      picClearedByAdmin: nextPics.length === 0,
    });
  };

  const toggleItemCoPic = (item, rawCode) => {
    const code = normalizePicCode(rawCode);
    if (!code) return;
    const currentRoles = resolveItemPicRoles(item);
    if (!currentRoles.primaryPic) {
      patchItemById(item.id, {
        primaryPic: code,
        coPics: [],
        pics: [code],
        picDisplay: code,
        picClearedByAdmin: false,
      });
      return;
    }
    if (currentRoles.primaryPic.toLowerCase() === code.toLowerCase()) {
      const promoted = currentRoles.coPics[0] || '';
      const remainingCo = currentRoles.coPics.slice(1);
      const nextPics = promoted ? [promoted, ...remainingCo] : [];
      patchItemById(item.id, {
        primaryPic: promoted,
        coPics: remainingCo,
        pics: nextPics,
        picDisplay: nextPics.join(', '),
        picClearedByAdmin: nextPics.length === 0,
      });
      return;
    }
    const exists = currentRoles.coPics.some((c) => c.toLowerCase() === code.toLowerCase());
    const nextCoPics = exists
      ? currentRoles.coPics.filter((c) => c.toLowerCase() !== code.toLowerCase())
      : [...currentRoles.coPics, code];
    const nextPics = [currentRoles.primaryPic, ...nextCoPics];
    patchItemById(item.id, {
      primaryPic: currentRoles.primaryPic,
      coPics: nextCoPics,
      pics: nextPics,
      picDisplay: nextPics.join(', '),
      picClearedByAdmin: false,
    });
  };

  const insertRow = (si, ii, duplicate = false, position = 'below') => {
    let addedId = null;
    const secCode = normalized[si]?.code || 'A';
    editItems(
      si,
      (items, section) => {
        const no = String(nextNumber(items));
        const item = duplicate ? {
          ...clone(items[ii]),
          id: createId(section.code),
          no,
          excelNo: no,
          hideExcelNo: false,
          subrows: items[ii].subrows.map((sub) => ({ ...sub, key: createId('input') })),
        } : blankItem(section.code, no);
        delete item.hideIndikatorCell;
        addedId = item.id;
        const result = [...items];
        const insertAt = position === 'above' ? Math.max(0, ii) : ii + 1;
        result.splice(insertAt, 0, item);
        return result;
      },
      `Baris indikator baru (${position === 'above' ? 'sisip di atas' : 'sisip di bawah'}) pada Perspektif ${secCode} berhasil ditambahkan dan disinkronkan realtime ke ${activeUnitCount} unit kerja.`,
    );
    if (addedId) setSelectedId(addedId);
  };

  const deleteRowAt = (si, ii, itemLabel = '') => {
    const secCode = normalized[si]?.code || 'A';
    const targetItem = normalized[si]?.items?.[ii];
    const rowTitle = targetItem?.indikator ? ` (${targetItem.indikator})` : '';
    setConfirmState({
      title: `Hapus Baris Indikator ${secCode}.${itemLabel || ii + 1}`,
      message: `Hapus baris ${secCode}.${itemLabel || ii + 1}${rowTitle}?${liveSync ? ' Karena Live Sync aktif, penghapusan ini akan langsung disinkronkan ke formulir seluruh unit kerja.' : ''}`,
      confirmLabel: 'Ya, Hapus Baris',
      danger: true,
      onConfirm: () => {
        editItems(
          si,
          (items) => items.filter((_, index) => index !== ii),
          `Baris ${secCode}.${itemLabel || ii + 1} dihapus dan disinkronkan ke form seluruh unit.`,
        );
      },
    });
  };

  const toggleMergeNo = (si, ii, item) => {
    if (ii <= 0) {
      notify('Merge sel ke atas hanya dapat dilakukan mulai dari baris ke-2 pada bagian yang sama.');
      return;
    }
    const nextMerged = !item.hideExcelNo;
    editItems(
      si,
      (items) => items.map((entry, idx) => (idx === ii ? { ...entry, hideExcelNo: nextMerged } : entry)),
      nextMerged
        ? `Sel Nomor pada baris ${normalized[si]?.code}.${item.no} digabung (Merge Cell) dengan baris di atasnya.`
        : `Merge Sel Nomor pada baris ${normalized[si]?.code}.${item.no} dibatalkan (Unmerge).`,
    );
  };

  const toggleMergeIndikator = (si, ii, item) => {
    if (ii <= 0) {
      notify('Merge sel ke atas hanya dapat dilakukan mulai dari baris ke-2 pada bagian yang sama.');
      return;
    }
    const nextMerged = !item.hideIndikatorCell;
    editItems(
      si,
      (items) => items.map((entry, idx) => (idx === ii ? { ...entry, hideIndikatorCell: nextMerged } : entry)),
      nextMerged
        ? `Sel Indikator Kinerja pada baris ${normalized[si]?.code}.${item.no} digabung (Merge Cell) dengan baris di atasnya.`
        : `Merge Sel Indikator pada baris ${normalized[si]?.code}.${item.no} dibatalkan (Unmerge).`,
    );
  };

  const mergeBothCellsAbove = (si, ii, item) => {
    if (ii <= 0) {
      notify('Merge sel ke atas hanya dapat dilakukan mulai dari baris ke-2 pada bagian yang sama.');
      return;
    }
    editItems(
      si,
      (items) => items.map((entry, idx) => (idx === ii ? { ...entry, hideExcelNo: true, hideIndikatorCell: true } : entry)),
      `Sel Nomor & Indikator pada baris ${normalized[si]?.code}.${item.no} digabung (Merge Cell) dengan baris di atasnya.`,
    );
  };

  const unmergeRowCells = (si, ii, item) => {
    editItems(
      si,
      (items) => items.map((entry, idx) => (idx === ii ? { ...entry, hideExcelNo: false, hideIndikatorCell: false } : entry)),
      `Sel pada baris ${normalized[si]?.code}.${item.no} dipisahkan kembali (Unmerge Cell).`,
    );
  };

  const handleLoadPeriodStructure = (targetPeriod) => {
    const clean = String(targetPeriod || periodString || '').trim();
    if (!clean) return;
    setPeriodString(clean);
    const periodForm = getFormForPeriod(clean);
    if (periodForm?.sections?.length) {
      const migrated = migrate(clone(periodForm.sections));
      setSections(migrated);
      notify(`Struktur master tabel historis periode ${clean} (${migrated.reduce((acc, s) => acc + s.items.length, 0)} baris) dimuat ke editor.`);
    } else {
      notify(`Periode ${clean} dipilih. Gunakan "Sinkronkan Master Tabel ke Periode" untuk menyimpan struktur tahun ${clean}.`);
    }
  };

  const handleSyncPeriodMaster = () => {
    const clean = String(periodString || '').trim();
    if (!clean || hasBlockingError) {
      notify('Perbaiki error validasi wajib dan pastikan tahun periode terisi sebelum menyinkronkan master tabel.');
      setShowPanel(true);
      return;
    }
    try {
      syncPeriodMasterTable(normalized, {
        period: clean,
        actor: currentUser,
        openPeriod: syncOpenPeriod,
        lockPreviousPeriods: syncLockPrevious,
        note: `Sinkronisasi Master Tabel Periode ${clean}`,
      });
      const latestConfig = readPublishedKpiConfig();
      setHistory(readKpiHistory());
      setPeriodsList(listKpiPeriodsWithStatus());
      notify(
        `Master Tabel KPI Periode ${clean} (v${latestConfig?.version || 1}, ${totalRows} baris) berhasil disinkronkan. Data historis periode sebelumnya tetap tersimpan utuh.`,
      );
    } catch (err) {
      notify(err?.message || 'Gagal menyinkronkan master tabel periode.');
    }
  };

  const addSubIndicator = (si, ii) => {
    const secCode = normalized[si]?.code || 'A';
    editItems(
      si,
      (items, section) => {
        const group = groupNumber(items[ii]) || nextNumber(items);
        const indexes = items.flatMap((item, index) => (groupNumber(item) === group ? [index] : []));
        if (!indexes.includes(ii)) indexes.push(ii);
        indexes.sort((a, b) => a - b);
        const result = items.map((item, index) => {
          const position = indexes.indexOf(index);
          if (position < 0) return item;
          const no = `${group}${letters(position)}`;
          return { ...item, no, excelNo: no, hideExcelNo: false, hideIndikatorCell: false };
        });
        result.splice(Math.max(...indexes) + 1, 0, blankItem(section.code, `${group}${letters(indexes.length)}`));
        return result;
      },
      `Sub-indikator baru pada Perspektif ${secCode} berhasil disinkronkan realtime ke form seluruh unit.`,
    );
  };

  const changeCalcType = (item, calcType) => patchItemById(item.id, {
    calcType,
    formulaExpr: calcType === 'custom' ? visibleExpr(item) : PRESET_FORMULA_EXPR[calcType] ?? '',
  });

  const addSection = () => setSections((current) => {
    let number = current.length;
    let code;
    do { code = letters(number++).toUpperCase(); } while (current.some((section) => section.code === code));
    const next = [...current, { code, title: 'Bagian baru', totalWeight: 0, isPenaltySection: false, items: [blankItem(code, 1)] }];
    window.queueMicrotask(() => notify(`Perspektif baru (${code}) ditambahkan${liveSync ? ' dan disinkronkan ke seluruh unit' : ''}.`));
    return next;
  });

  const setFormula = (expr) => selected && patchItemById(selected.id, { calcType: 'custom', formulaExpr: expr });

  const insertToken = (token) => {
    if (!selected || !formulaEditable) return;
    const input = formulaRef.current;
    const current = selectedExpr;
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    setFormula(current.slice(0, start) + token + current.slice(end));
    window.requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const caret = start + token.length;
      input.setSelectionRange(caret, caret);
    });
  };

  const pickHandlers = (ownerId, localRef, excelRef, legacyRef) => (pickMode && formulaEditable ? {
    onMouseDown: (event) => {
      event.preventDefault();
    },
    onClick: () => {
      insertToken(ownerId === selected?.id ? excelRef : excelRef || legacyRef);
    },
    title: `Klik untuk menyisipkan koordinat Excel ${excelRef} (alias ${ownerId === selected?.id ? localRef : legacyRef})`,
  } : {});
  const refClass = (excelRef, legacyRef) => [
    pickMode && formulaEditable ? 'pickable' : '',
    referencedCells.has(excelRef) || referencedCells.has(legacyRef) ? 'is-ref' : '',
  ].join(' ');

  const handleExportDesignerExcel = () => {
    const esc = (val) => {
      const raw = String(val ?? '');
      const safe = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw;
      return safe.replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
    };
    let rowsHtml = '';
    normalized.forEach((sec) => {
      rowsHtml += `<tr style="background:#EDF3F6;font-weight:bold;color:#072534;">
        <td style="border:1px solid #CBD5E1;text-align:center;padding:6px;">${esc(sec.code)}</td>
        <td colspan="4" style="border:1px solid #CBD5E1;padding:6px;">${esc(sec.title)}</td>
        <td style="border:1px solid #CBD5E1;text-align:right;padding:6px;">${esc(sec.totalWeight)}</td>
        <td colspan="5" style="border:1px solid #CBD5E1;padding:6px;">${sec.isPenaltySection ? 'Bagian Penalti' : ''}</td>
      </tr>`;
      sec.items.forEach((item) => {
        const span = item.subrows.length;
        const picMeta = resolveItemPicRoles(item);
        const picText = picMeta.primaryPic
          ? (picMeta.coPics.length ? `Utama: ${picMeta.primaryPic} | Co-PIC: ${picMeta.coPics.join(', ')}` : picMeta.primaryPic)
          : (item.picDisplay || '-');
        const res = results.get(item.id);
        const capStr = res?.ratioPercent == null ? '' : `${formatIndonesianNumber(res.ratioPercent, 2)}%`;
        const skorStr = res?.weightedScore == null ? '' : formatIndonesianNumber(res.weightedScore, 2);
        const formulaStr = isDateType(item.calcType) ? CALC_TYPES[item.calcType].label : `=${stripEq(visibleExpr(item))}`;
        item.subrows.forEach((sub, sIdx) => {
          const simVal = simValues[sub.key] ?? '';
          if (sIdx === 0) {
            rowsHtml += `<tr>
              <td rowspan="${span}" style="border:1px solid #CBD5E1;text-align:center;">${esc(item.no)}</td>
              <td rowspan="${span}" style="border:1px solid #CBD5E1;padding:6px;">${esc(item.indikator)}</td>
              <td rowspan="${span}" style="border:1px solid #CBD5E1;padding:6px;">${esc(picText)}</td>
              <td style="border:1px solid #CBD5E1;padding:6px;">${esc(sub.label)}</td>
              <td style="border:1px solid #CBD5E1;text-align:right;padding:6px;">${esc(simVal)}</td>
              <td rowspan="${span}" style="border:1px solid #CBD5E1;text-align:right;padding:6px;">${esc(Math.abs(Number(item.bobot) || 0))}</td>
              <td rowspan="${span}" style="border:1px solid #CBD5E1;text-align:right;padding:6px;">${esc(item.targetNum)}</td>
              <td rowspan="${span}" style="border:1px solid #CBD5E1;text-align:center;padding:6px;">${esc(item.satuan)}</td>
              <td rowspan="${span}" style="border:1px solid #CBD5E1;padding:6px;font-family:Consolas,monospace;">${esc(formulaStr)}</td>
              <td rowspan="${span}" style="border:1px solid #CBD5E1;text-align:right;padding:6px;font-weight:bold;">${esc(capStr)}</td>
              <td rowspan="${span}" style="border:1px solid #CBD5E1;text-align:right;padding:6px;font-weight:bold;">${esc(skorStr)}</td>
            </tr>`;
          } else {
            rowsHtml += `<tr>
              <td style="border:1px solid #CBD5E1;padding:6px;">${esc(sub.label)}</td>
              <td style="border:1px solid #CBD5E1;text-align:right;padding:6px;">${esc(simVal)}</td>
            </tr>`;
          }
        });
      });
    });
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8" /></head>
      <body style="font-family:Calibri,Arial,sans-serif;font-size:10pt;">
        <table style="border-collapse:collapse;width:100%;">
          <thead>
            <tr style="background:#F8FAFC;font-weight:bold;text-align:center;">
              ${COLUMNS.map((c) => `<th style="border:1px solid #CBD5E1;padding:8px;">${esc(c)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Template_Desainer_KPI_Excel_A_K_${periodString || '2026'}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveValidationRules = () => {
    const saved = saveKpiValidationRules(validationRules, currentUser?.email || 'Superadmin PRP');
    setValidationRules(saved);
    notify('Pengaturan aturan validasi struktur berhasil disimpan oleh Admin PRP.');
  };

  const handleResetValidationRules = () => {
    const reset = saveKpiValidationRules(DEFAULT_KPI_VALIDATION_RULES, currentUser?.email || 'Superadmin PRP');
    setValidationRules(reset);
    notify('Aturan validasi struktur dikembalikan ke standar default.');
  };

  const syncAllSectionWeightsToRows = () => {
    setSections((current) => current.map((sec, idx) => {
      const sum = validation.sectionSummaries[idx]?.itemSum ?? Math.abs(Number(sec.totalWeight) || 0);
      return { ...sec, totalWeight: sec.isPenaltySection ? -sum : sum };
    }));
    notify('Seluruh bobot bagian disamakan dengan total bobot baris di bagian masing-masing.');
  };

  const handleSyncStructureRealtime = () => {
    if (hasBlockingError) {
      notify('Perbaiki error validasi wajib sebelum menyinkronkan struktur ke unit kerja.');
      setShowPanel(true);
      return;
    }
    try {
      const actor = currentUser?.email || 'Superadmin PRP';
      const pub = publishKpiSections(normalized, { actor, snapshot: true, note: `Sinkronisasi struktur realtime (${totalRows} indikator)` });
      const synced = syncActiveKpiFormSections(normalized, { actor });
      setHistory(readKpiHistory());
      notify(
        `Struktur tabel KPI (${totalRows} baris indikator, v${pub.version}) berhasil disinkronkan secara realtime ke ${synced?.units?.length || activeUnitCount} akun unit kerja tanpa menghapus isian unit.`,
      );
    } catch (err) {
      notify(err?.message || 'Gagal menyinkronkan struktur tabel KPI.');
    }
  };

  const distribute = async () => {
    if (sendingRef.current) return;
    if (hasBlockingError || !periodString.trim()) {
      notify('Perbaiki error validasi wajib dan isi periode sebelum mendistribusikan ke unit kerja.');
      setShowPanel(true);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      const result = await distributeKpiForm(normalized, { period: periodString, actor: currentUser });
      setHistory(readKpiHistory());
      setPeriodsList(listKpiPeriodsWithStatus());
      notify(`Formulir KPI v${result.version} terdistribusi ke seluruh akun Unit/PIC untuk periode ${periodString}. ID: ${result.id}`);
    } catch (error) {
      notify(`Pengiriman gagal: ${error?.message || 'Silakan coba kembali.'}`);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const filteredPicCatalog = useMemo(() => {
    const q = picSearch.trim().toLowerCase();
    if (!q) return picCatalog;
    return picCatalog.filter((entry) => entry.code.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q));
  }, [picCatalog, picSearch]);

  const targetTotal = Number(validationRules.targetPositiveWeight) || 100;

  return (
    <div ref={rootRef} className="kpi-designer-page" aria-busy={sending}>
      <header className="designer-hero">
        <div>
          <div className="designer-kicker"><Table2 size={14} /> PRP / DESAINER TABEL DINAMIS, MERGE SEL, PIC &amp; SINKRONISASI PERIODE</div>
          <h1>Desainer Tabel &amp; Formula KPI</h1>
          <p>
            Kelola struktur tabel ala Excel (<strong>Sisip/Hapus Baris</strong>, <strong>Merge &amp; Unmerge Sel</strong>, bobot, target, rumus <strong>fx</strong>), tetapkan <strong>PIC Penanggung Jawab</strong>, dan sinkronkan master tabel saat pergantian periode tanpa mengubah data historis tahun sebelumnya.
          </p>
        </div>
        <div className="designer-actions" style={{ alignItems: 'center' }}>
          <label className="designer-period" title="Pilih periode yang ada atau ketik tahun periode baru (mis. 2027)">
            <span>Periode</span>
            <select
              aria-label="Pilih periode tersedia"
              value={selectedPeriodMeta ? selectedPeriodMeta.id : ''}
              onChange={(event) => {
                if (event.target.value) handleLoadPeriodStructure(event.target.value);
              }}
              style={{ border: 'none', background: 'transparent', fontWeight: 700, color: '#072534', cursor: 'pointer' }}
            >
              <option value="">Kustom...</option>
              {periodsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label && p.label !== p.id ? `${p.id} - ${p.label}` : p.id} ({p.isOpenForInput ? 'AKTIF - Terbuka' : 'TERKUNCI - Nonaktif'})
                </option>
              ))}
            </select>
            <input
              aria-label="Ketik tahun periode"
              value={periodString}
              onChange={(event) => setPeriodString(event.target.value)}
              style={{ width: '68px' }}
            />
          </label>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.15rem 0.25rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.01em',
              color: selectedPeriodMeta
                ? (selectedPeriodMeta.isOpenForInput ? '#166534' : '#B91C1C')
                : '#094E68',
            }}
            title={selectedPeriodMeta ? selectedPeriodMeta.statusLabel : 'Periode Baru (belum disinkronkan)'}
          >
            {selectedPeriodMeta?.isOpenForInput ? <LockOpen size={13} /> : <Lock size={13} />}
            {selectedPeriodMeta
              ? (selectedPeriodMeta.isOpenForInput ? `Periode ${periodString}: Aktif (Terbuka)` : `Periode ${periodString}: Tidak Aktif (Terkunci)`)
              : `Periode ${periodString || '-'}: Siap Buat Baru`}
          </span>
          <button
            type="button"
            onClick={() => {
              setConfirmState({
                title: 'Reset Draft Struktur KPI',
                message: 'Kembalikan draft ke struktur resmi ITPLN beserta 29 pemetaan PIC default?',
                confirmLabel: 'Ya, Reset Default',
                danger: false,
                onConfirm: () => {
                  localStorage.removeItem(KPI_DRAFT_KEY);
                  const defaults = migrate(KPI_SECTIONS_CONFIG);
                  setSections(defaults);
                  setSimValues({});
                  setSelectedId(null);
                  pushRealtimeStructureNow(defaults, 'Draft dikembalikan ke struktur resmi ITPLN beserta pemetaan PIC.');
                },
              });
            }}
          >
            <RotateCcw size={15} /> Reset Default
          </button>
          <button
            type="button"
            disabled={hasBlockingError || !periodString.trim()}
            onClick={handleSyncPeriodMaster}
            title="Sinkronkan desain master tabel ke periode terpilih dan simpan struktur historis periode sebelumnya secara utuh"
          >
            <Radio size={15} /> Sinkronkan Master Tabel ke Periode {periodString}
          </button>
          <button type="button" className="primary" disabled={sending || hasBlockingError || !periodString.trim()} onClick={distribute}>
            <Send size={15} /> {sending ? 'Mengirim...' : `Buka & Kirim Periode ${periodString}`}
          </button>
        </div>
      </header>

      <div className="designer-toolbar">
        <span className="designer-stats">
          <Table2 size={14} /> <strong>{totalRows}</strong> indikator · <strong>{normalized.length}</strong> bagian ·
          {' '}<strong>{activeUnitCount}</strong> unit terhubung · Total skor simulasi <strong>{formatIndonesianNumber(totalScore)}</strong>
        </span>
        <span className={`designer-weight ${Math.abs(validation.totalDiff) > 0.0001 ? 'warn' : 'ok'}`} title="Total bobot baris seluruh bagian non-penalti">
          Bobot capaian <strong>{formatIndonesianNumber(validation.positiveTotal, 4)}</strong> / {formatIndonesianNumber(targetTotal, 2)}
          {Math.abs(validation.totalDiff) > 0.0001 && <> ({validation.totalDiff > 0 ? '+' : ''}{formatIndonesianNumber(validation.totalDiff, 4)})</>}
          {validation.penaltyTotal > 0 && <> · Penalti maks -{formatIndonesianNumber(validation.penaltyTotal, 4)}</>}
        </span>
        <div className="designer-actions">
          <label className="designer-check" title="Saat aktif, penambahan atau perubahan baris otomatis muncul di form unit secara realtime">
            <input
              type="checkbox"
              checked={liveSync}
              onChange={(event) => {
                setLiveSync(event.target.checked);
                localStorage.setItem(KPI_LIVE_SYNC_KEY, String(event.target.checked));
              }}
            /> Live sync ke unit
          </label>
          <label className="designer-check" title="Buka periode target untuk pengisian unit saat sinkronisasi periode">
            <input
              type="checkbox"
              checked={syncOpenPeriod}
              onChange={(event) => setSyncOpenPeriod(event.target.checked)}
            /> Buka periode saat sync
          </label>
          <label className="designer-check" title="Kunci periode tahun sebelumnya agar data historis tetap utuh dan tidak berubah">
            <input
              type="checkbox"
              checked={syncLockPrevious}
              onChange={(event) => setSyncLockPrevious(event.target.checked)}
            /> Kunci periode lama (Arsip utuh)
          </label>
          <button type="button" onClick={handleSyncStructureRealtime} disabled={hasBlockingError}>
            <Radio size={14} /> Sync Baris Aktif
          </button>
          <button type="button" onClick={handleExportDesignerExcel} title="Ekspor struktur tabel desainer dengan pemetaan kolom A-K dan baris Excel 1:1">
            <FileSpreadsheet size={14} /> Template Excel (A-K)
          </button>
          <button type="button" onClick={() => setSimValues({})}><RotateCcw size={14} /> Kosongkan simulasi</button>
          <button
            type="button"
            onClick={() => sheetScrollRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
            title="Geser tampilan tabel ke kiri"
          >
            <ChevronLeft size={14} /> Geser Kiri
          </button>
          <button
            type="button"
            onClick={() => sheetScrollRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
            title="Geser tampilan tabel ke kanan (kolom Rumus, Capaian, Skor)"
          >
            Geser Kanan <ChevronRight size={14} />
          </button>
          <button type="button" aria-pressed={showPreview} onClick={() => setShowPreview((value) => !value)}>
            <Eye size={14} /> {showPreview ? 'Kembali ke editor' : 'Preview user'}
          </button>
          <button type="button" aria-pressed={showPanel} onClick={() => setShowPanel((value) => !value)} className={errorCount ? 'has-error' : ''}>
            {showPanel ? <PanelRightClose size={14} /> : <Settings2 size={14} />}
            Validasi &amp; Aturan PRP
            {errorCount > 0 && <span className="badge" title={`${errorCount} error (memblokir kirim)`}>{errorCount}</span>}
            {warnCount > 0 && <span className="badge warn" title={`${warnCount} peringatan`}>{warnCount}</span>}
          </button>
        </div>
      </div>
      <div className="designer-notice" role="status" aria-live="polite">{notice}</div>

      {showPreview ? (
        <div className="designer-preview sheet-shell">
          <p className="designer-sim-banner">PRATINJAU SAJA: menampilkan struktur tabel beserta kolom PIC dan bukti per baris tanpa mengubah data unit kerja.</p>
          <KPIDataEntrySheet sectionsOverride={normalized} persist={false} readOnly />
        </div>
      ) : (
        <div className={`designer-layout ${showPanel ? 'with-panel' : ''}`}>
          <div className="sheet-shell">
            <div className={`formula-bar ${pickMode && formulaEditable ? 'picking' : ''}`}>
              <div className="formula-row">
                <span className="name-box" title="Koordinat baris terpilih (Kode KPI & Baris Excel)">
                  {selected ? `${selectedSection.code}.${selected.no} · E${selectedExcelMeta?.startRow || '-'}` : '-'}
                </span>
                <select
                  aria-label="Tipe perhitungan"
                  disabled={!selected}
                  value={selected?.calcType || ''}
                  onChange={(event) => changeCalcType(selected, event.target.value)}
                >
                  {!selected && <option value="">Pilih baris...</option>}
                  {Object.entries(CALC_TYPES).map(([key, type]) => <option key={key} value={key}>{type.label}</option>)}
                </select>
                <span className="fx"><Sigma size={14} /> fx</span>
                <input
                  ref={formulaRef}
                  className={`formula-input ${formulaError ? 'invalid' : ''}`}
                  aria-label="Rumus baris terpilih"
                  aria-invalid={Boolean(formulaError)}
                  disabled={!formulaEditable}
                  placeholder={!selected ? 'Klik salah satu baris di tabel untuk mengedit rumus dan PIC' : isDateType(selected.calcType) ? 'Tipe tanggal memakai batas waktu, bukan rumus' : `=E${selectedExcelMeta?.startRow || 3}/G${selectedExcelMeta?.startRow || 3}*100 atau =I1/T*100`}
                  value={formulaEditable ? `=${stripEq(selectedExpr)}` : ''}
                  onChange={(event) => setFormula(stripEq(event.target.value))}
                  onFocus={() => setPickMode(true)}
                  onBlur={() => setPickMode(false)}
                  spellCheck={false}
                />
              </div>
              {selected && (
                <div className="formula-tools">
                  <div className="op-group" role="group" aria-label="Operator">
                    {OPERATORS.map((op) => (
                      <button
                        key={op.label}
                        type="button"
                        title={op.title}
                        disabled={!formulaEditable}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertToken(op.token)}
                      >
                        {op.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      title="Rentang sel Excel (misal SUM(E3:E8))"
                      disabled={!formulaEditable}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertToken(':')}
                    >
                      :
                    </button>
                  </div>
                  <div className="op-group" role="group" aria-label="Fungsi">
                    {FUNCTIONS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        disabled={!formulaEditable}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertToken(`${name}(`)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <div className="op-group" role="group" aria-label="Koordinat Excel dan alias baris ini">
                    {selected.subrows.map((sub, index) => {
                      const excelCoord = `E${selectedExcelMeta?.subRows?.[index] || index + 3}`;
                      return (
                        <button
                          key={sub.key}
                          type="button"
                          className="ref-chip"
                          disabled={!formulaEditable}
                          title={`Sel Excel ${excelCoord} (${sub.label} · alias I${index + 1})`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => insertToken(excelCoord)}
                        >
                          {excelCoord}
                        </button>
                      );
                    })}
                    {selectedExcelMeta?.startRow && (
                      <>
                        <button
                          type="button"
                          className="ref-chip"
                          disabled={!formulaEditable}
                          title={`Target Excel G${selectedExcelMeta.startRow} (alias T)`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => insertToken(`G${selectedExcelMeta.startRow}`)}
                        >
                          G{selectedExcelMeta.startRow}
                        </button>
                        <button
                          type="button"
                          className="ref-chip"
                          disabled={!formulaEditable}
                          title={`Bobot Excel F${selectedExcelMeta.startRow} (alias B)`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => insertToken(`F${selectedExcelMeta.startRow}`)}
                        >
                          F{selectedExcelMeta.startRow}
                        </button>
                      </>
                    )}
                    {selected.subrows.map((sub, index) => (
                      <button
                        key={`alias-${sub.key}`}
                        type="button"
                        disabled={!formulaEditable}
                        title={`Alias lokal I${index + 1}: ${sub.label}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertToken(`I${index + 1}`)}
                      >
                        I{index + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={!formulaEditable}
                      title="Target baris ini (alias T)"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertToken('T')}
                    >
                      T
                    </button>
                    <button
                      type="button"
                      disabled={!formulaEditable}
                      title="Bobot baris ini (alias B)"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => insertToken('B')}
                    >
                      B
                    </button>
                  </div>
                  {formulaEditable && (
                    <button
                      type="button"
                      className="ghost"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => { setFormula(''); formulaRef.current?.focus(); }}
                    >
                      <Trash2 size={13} /> Kosongkan
                    </button>
                  )}
                </div>
              )}
              {selected && (
                <div className="formula-info">
                  {formulaEditable ? (
                    <>
                      <span className={formulaError ? 'error' : 'valid'}>
                        {formulaError ? <TriangleAlert size={13} /> : <CircleCheck size={13} />} {formulaError || 'Rumus valid'}
                      </span>
                      {!formulaError && <span className="desc">= {describeKpiFormula(selectedExpr, selected.subrows, directory.labels)}</span>}
                      <span className="sim">
                        Capaian{' '}
                        <strong style={{ color: getKpiAchievementMeta(results.get(selected.id)?.ratioPercent, { isPenaltySection: selectedSection?.isPenaltySection }).color }}>
                          {results.get(selected.id)?.ratioPercent == null ? '-' : `${formatIndonesianNumber(results.get(selected.id).ratioPercent)}%`}
                        </strong>
                        {' · '}Skor <strong>{formatIndonesianNumber(results.get(selected.id)?.weightedScore)}</strong>
                      </span>
                      {selected.calcType !== 'custom' && <span className="hint">Preset: mengetik di kolom fx otomatis mengubahnya menjadi rumus bebas (mendukung sel Excel E3, F3, G3, SUM(E3:E8)).</span>}
                    </>
                  ) : (
                    <span className="hint">{CALC_TYPES[selected.calcType]?.expression}</span>
                  )}
                  <span className="hint pick-hint">
                    <MousePointerClick size={13} /> {pickMode && formulaEditable ? 'Mode pilih sel aktif: klik sel Isian (E), Bobot (F), atau Target (G) di baris mana pun.' : 'Klik kolom fx untuk mengaktifkan mode pilih sel Excel.'}
                  </span>
                </div>
              )}
              {selected && (
                <div className="formula-detail">
                  <label>
                    <span>Keterangan rumus (tampil ke unit kerja)</span>
                    <input value={selected.formula ?? ''} onChange={(event) => patchItemById(selected.id, { formula: event.target.value })} />
                  </label>
                  <label>
                    <span>PIC Utama (1 Unit Penanggung Jawab Input)</span>
                    <select
                      value={selectedPicRoles.primaryPic}
                      onChange={(event) => setItemPrimaryPic(selected, event.target.value)}
                      style={{ minHeight: '36px', padding: '.4rem .55rem', border: '1px solid var(--line-strong)', borderRadius: '5px', background: '#FFFFFF', color: '#072534', fontSize: '.76rem' }}
                    >
                      <option value="">- Pilih PIC Utama -</option>
                      {picCatalog.map((entry) => (
                        <option key={entry.code} value={entry.code}>{entry.code} - {entry.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Co-PIC Kolaborasi (hanya info, pisahkan koma)</span>
                    <input
                      value={selectedPicRoles.coPics.join(', ')}
                      placeholder="Contoh: BAG, PJM (tanpa input ganda)"
                      onChange={(event) => {
                        const rawCo = normalizePicCodes(event.target.value).filter(
                          (c) => c.toLowerCase() !== selectedPicRoles.primaryPic.toLowerCase(),
                        );
                        const nextPics = selectedPicRoles.primaryPic ? [selectedPicRoles.primaryPic, ...rawCo] : rawCo;
                        patchItemById(selected.id, {
                          primaryPic: selectedPicRoles.primaryPic || rawCo[0] || '',
                          coPics: selectedPicRoles.primaryPic ? rawCo : rawCo.slice(1),
                          pics: nextPics,
                          picDisplay: nextPics.join(', '),
                          picClearedByAdmin: nextPics.length === 0,
                        });
                      }}
                    />
                  </label>
                  <label>
                    <span>Judul Grup Spanduk di Atas Baris (opsional, ala C.2)</span>
                    <input
                      value={selected.groupBannerTitle ?? ''}
                      placeholder="Contoh: Klasterisasi Perguruan Tinggi Menuju Mandiri"
                      onChange={(event) => patchItemById(selected.id, { groupBannerTitle: event.target.value })}
                    />
                  </label>
                  {selected.calcType === 'compliance_date_single' && (
                    <label>
                      <span>Batas waktu</span>
                      <input type="date" value={selected.deadlineISO ?? ''} onChange={(event) => patchItemById(selected.id, { deadlineISO: event.target.value })} />
                    </label>
                  )}
                  {selected.calcType === 'compliance_date_dual' && [0, 1].map((index) => (
                    <label key={index}>
                      <span>Batas semester {index + 1}</span>
                      <input
                        type="date"
                        value={selected.deadlinesISO?.[index] ?? ''}
                        onChange={(event) => {
                          const deadlinesISO = [...(selected.deadlinesISO || ['', ''])];
                          deadlinesISO[index] = event.target.value;
                          patchItemById(selected.id, { deadlinesISO });
                        }}
                      />
                    </label>
                  ))}
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      flexWrap: 'wrap',
                      paddingTop: '0.35rem',
                      borderTop: '1px dashed #D8E4EA',
                    }}
                  >
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#072534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Kontrol Baris &amp; Merge Sel ({selectedSection.code}.{selected.no}):
                    </span>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => insertRow(selectedSectionIndex, selectedItemIndex, false, 'above')}
                      title="Sisipkan baris indikator baru tepat di atas baris ini"
                    >
                      <Plus size={13} /> Sisip Baris Atas
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => insertRow(selectedSectionIndex, selectedItemIndex, false, 'below')}
                      title="Sisipkan baris indikator baru tepat di bawah baris ini"
                    >
                      <Plus size={13} /> Sisip Baris Bawah
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={selectedItemIndex <= 0}
                      aria-pressed={Boolean(selected.hideExcelNo)}
                      onClick={() => toggleMergeNo(selectedSectionIndex, selectedItemIndex, selected)}
                      title="Gabungkan (Merge) atau pisahkan sel Nomor dengan baris di atasnya"
                    >
                      <GitMerge size={13} /> {selected.hideExcelNo ? 'Unmerge Sel No' : 'Merge Sel No ↑'}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={selectedItemIndex <= 0}
                      aria-pressed={Boolean(selected.hideIndikatorCell)}
                      onClick={() => toggleMergeIndikator(selectedSectionIndex, selectedItemIndex, selected)}
                      title="Gabungkan (Merge) atau pisahkan sel Indikator Kinerja dengan baris di atasnya"
                    >
                      <GitMerge size={13} /> {selected.hideIndikatorCell ? 'Unmerge Sel Indikator' : 'Merge Sel Indikator ↑'}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={selectedItemIndex <= 0}
                      onClick={() => mergeBothCellsAbove(selectedSectionIndex, selectedItemIndex, selected)}
                      title="Gabungkan sel Nomor sekaligus Indikator dengan baris di atasnya"
                    >
                      <GitMerge size={13} /> Merge No &amp; Indikator ↑
                    </button>
                    {(selected.hideExcelNo || selected.hideIndikatorCell) && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => unmergeRowCells(selectedSectionIndex, selectedItemIndex, selected)}
                        title="Batalkan seluruh penggabungan sel (Unmerge Cell) pada baris ini"
                        style={{ background: '#FFFBEB', borderColor: '#FCD34D', color: '#78350F', fontWeight: 700 }}
                      >
                        <Split size={13} /> Batalkan Merge Sel (Unmerge)
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost danger"
                      onClick={() => deleteRowAt(selectedSectionIndex, selectedItemIndex, selected.no)}
                      title="Hapus baris indikator ini"
                    >
                      <Trash2 size={13} /> Hapus Baris
                    </button>
                  </div>
                </div>
              )}
            </div>

            <HorizontalTableViewport
              scrollRef={sheetScrollRef}
              dragDisabled={Boolean(pickMode && formulaEditable)}
              dataLenisPrevent
              panLabel="Geser kolom desainer KPI"
              className={`sheet-scroll ${pickMode && formulaEditable ? 'picking' : ''}`}
              role="region"
              aria-label="Lembar Desainer KPI"
              tabIndex={0}
            >
              <table className="sheet">
                <colgroup>
                  <col className="c-gutter" />
                  <col className="c-no" />
                  <col className="c-ind" />
                  <col className="c-pic" />
                  <col className="c-sub" />
                  <col className="c-sim" />
                  <col className="c-num" />
                  <col className="c-num" />
                  <col className="c-unit" />
                  <col className="c-formula" />
                  <col className="c-res" />
                  <col className="c-res" />
                  <col className="c-act" />
                </colgroup>
                <thead>
                  <tr className="letters">
                    <th>Baris</th>
                    {COLUMNS.map((_, index) => <th key={index}>{String.fromCharCode(65 + index)}</th>)}
                    <th />
                  </tr>
                  <tr className="titles">
                    <th scope="col" className="gutter" title="Baris Excel 1 (Header Kolom)">1</th>
                    {COLUMNS.map((title) => <th scope="col" key={title}>{title}</th>)}
                    <th scope="col"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                {normalized.map((section, si) => {
                  const summary = validation.sectionSummaries[si];
                  const itemSum = summary?.itemSum ?? 0;
                  const weightMismatch = summary ? !summary.matches : false;
                  const secExcelRow = excelRowMap.sectionHeaderRow.get(si) || 2;
                  return (
                    <tbody key={`section-${si}`} id={`kpi-section-${si}`} className={`sheet-section ${weightMismatch ? 'has-warn' : ''}`}>
                      <tr className="section-row">
                        <td className="gutter" title={`Baris Excel ${secExcelRow} (Header Bagian ${section.code})`}>{secExcelRow}</td>
                        <td colSpan={COLUMNS.length + 1}>
                          <div className="section-bar">
                            <input aria-label="Kode bagian" className="code" value={section.code} onChange={(event) => updateSection(si, { code: event.target.value.toUpperCase() })} />
                            <input aria-label="Judul bagian" className="title" value={section.title} onChange={(event) => updateSection(si, { title: event.target.value })} />
                            <label className="mini">
                              Bobot bagian
                              <input type="number" step="any" value={Math.abs(Number(section.totalWeight) || 0)} onChange={(event) => updateSection(si, { totalWeight: event.target.value })} />
                            </label>
                            <span className={`sum ${weightMismatch ? 'warn' : ''}`} title="Jumlah bobot seluruh baris di bagian ini">
                              Total baris {formatIndonesianNumber(itemSum, 4)}
                              {weightMismatch && <> · selisih {summary.diff > 0 ? '+' : ''}{formatIndonesianNumber(summary.diff, 4)}</>}
                            </span>
                            {weightMismatch && (
                              <button
                                type="button"
                                className="ghost fix"
                                title="Samakan bobot bagian dengan total bobot baris"
                                onClick={() => updateSection(si, { totalWeight: itemSum })}
                              >
                                <Check size={12} /> Samakan = {formatIndonesianNumber(itemSum, 4)}
                              </button>
                            )}
                            <label className="designer-check">
                              <input type="checkbox" checked={section.isPenaltySection} onChange={(event) => updateSection(si, { isPenaltySection: event.target.checked })} /> Penalti
                            </label>
                            <button
                              type="button"
                              className="ghost"
                              data-add-row-section={section.code}
                              onClick={() => insertRow(si, section.items.length - 1)}
                            >
                              <Plus size={13} /> Indikator
                            </button>
                            <button
                              type="button"
                              className="ghost danger"
                              disabled={normalized.length <= 1}
                              title={`Hapus bagian ${section.code}`}
                              onClick={() =>
                                setConfirmState({
                                  title: `Hapus Bagian ${section.code}`,
                                  message: `Hapus bagian ${section.code} beserta seluruh indikatornya?`,
                                  confirmLabel: 'Ya, Hapus Bagian',
                                  danger: true,
                                  onConfirm: () => setSections((current) => current.filter((_, index) => index !== si)),
                                })
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {section.items.map((item, ii) => {
                        const prefix = itemRefPrefix(section.code, item.no);
                        const result = results.get(item.id);
                        const rowIssues = issuesByItem.get(item.id) || [];
                        const hasError = rowIssues.some((issue) => issue.level === 'error');
                        const span = item.subrows.length;
                        const isSelected = item.id === selectedId;
                        const rowClass = `${isSelected ? 'selected' : ''} ${hasError ? 'row-error' : ''}`;
                        const select = () => { if (!pickMode) setSelectedId(item.id); };
                        const itemExcelMeta = excelRowMap.itemRowInfo.get(item.id) || { startRow: 3, subRows: item.subrows.map((_, i) => 3 + i) };
                        const itemStartRow = itemExcelMeta.startRow;
                        const picRoles = resolveItemPicRoles(item);
                        const capMeta = getKpiAchievementMeta(result?.ratioPercent, { isPenaltySection: section.isPenaltySection });

                        return item.subrows.map((sub, subi) => {
                          const subExcelRow = itemExcelMeta.subRows[subi] || (itemStartRow + subi);
                          const patchSub = (patch) => editSubs(si, ii, (subs) => subs.map((entry, index) => (index === subi ? { ...entry, ...patch } : entry)));
                          const iRef = `${prefix}_I${subi + 1}`;
                          const excelERef = `E${subExcelRow}`;
                          const excelFRef = `F${itemStartRow}`;
                          const excelGRef = `G${itemStartRow}`;
                          return (
                            <tr key={sub.key} className={`${rowClass} ${subi === 0 ? 'item-start' : ''}`} onFocusCapture={select} onClick={select}>
                              <td className="gutter" title={hasError ? rowIssues.map((issue) => issue.message).join('\n') : `Baris Excel ${subExcelRow}`}>{subExcelRow}</td>
                              {subi === 0 && (
                                <>
                                  <td rowSpan={span} style={{ background: item.hideExcelNo ? '#F8FAFC' : undefined }}>
                                    <Cell
                                      aria-label={`Nomor ${section.code}.${item.no}`}
                                      className="center"
                                      value={item.no}
                                      onChange={(value) => updateItem(si, ii, { no: value, excelNo: value, hideExcelNo: false })}
                                    />
                                    {item.hideExcelNo && (
                                      <button
                                        type="button"
                                        className="ghost"
                                        onClick={() => toggleMergeNo(si, ii, item)}
                                        title="Sel Nomor ini digabung (Merge) ke baris di atasnya. Klik untuk membatalkan merge (Unmerge)."
                                        style={{
                                          fontSize: '0.6rem',
                                          padding: '1px 4px',
                                          minHeight: '20px',
                                          width: '100%',
                                          color: '#094E68',
                                          fontWeight: 700,
                                        }}
                                      >
                                        <Split size={11} /> Merged (Unmerge)
                                      </button>
                                    )}
                                  </td>
                                  <td rowSpan={span} style={{ background: item.hideIndikatorCell ? '#F8FAFC' : undefined }}>
                                    {item.groupBannerTitle && (
                                      <div
                                        style={{
                                          fontSize: '0.64rem',
                                          fontWeight: 800,
                                          color: '#094E68',
                                          padding: '2px 6px',
                                          background: '#EDF3F6',
                                          borderBottom: '1px solid #D8E4EA',
                                        }}
                                      >
                                        Grup: {item.groupBannerTitle}
                                      </div>
                                    )}
                                    <Cell
                                      multiline
                                      aria-label={`Indikator ${section.code}.${item.no}`}
                                      value={item.indikator}
                                      onChange={(value) => updateItem(si, ii, { indikator: value })}
                                    />
                                    {item.hideIndikatorCell && (
                                      <button
                                        type="button"
                                        className="ghost"
                                        onClick={() => toggleMergeIndikator(si, ii, item)}
                                        title="Sel Indikator ini digabung (Merge) ke baris di atasnya. Klik untuk membatalkan merge (Unmerge)."
                                        style={{
                                          fontSize: '0.62rem',
                                          padding: '2px 6px',
                                          minHeight: '22px',
                                          color: '#094E68',
                                          fontWeight: 700,
                                        }}
                                      >
                                        <Split size={11} /> Merged dg Baris Atas (Unmerge)
                                      </button>
                                    )}
                                  </td>
                                  <td rowSpan={span} className="pic-cell">
                                    <button
                                      type="button"
                                      className="pic-cell-trigger"
                                      aria-label={`Pilih PIC Utama dan Co-PIC untuk indikator ${section.code}.${item.no}`}
                                      aria-haspopup="dialog"
                                      aria-expanded={picPickerFor === item.id}
                                      onClick={() => {
                                        setPicCatalog(readMasterPicCatalog());
                                        setPicSearch('');
                                        setPicPickerFor((cur) => (cur === item.id ? null : item.id));
                                      }}
                                    >
                                      <Users size={12} style={{ flexShrink: 0, color: '#094E68' }} />
                                      {picRoles.primaryPic ? (
                                        <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', lineHeight: 1.25 }}>
                                          <strong style={{ fontSize: '0.69rem', color: '#094E68' }}>Utama: {picRoles.primaryPic}</strong>
                                          {picRoles.coPics.length > 0 && (
                                            <span style={{ fontSize: '0.63rem', color: '#475569', fontWeight: 600 }}>
                                              Co-PIC: {picRoles.coPics.join(', ')}
                                            </span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="pic-empty">Atur PIC Utama</span>
                                      )}
                                    </button>
                                    {picPickerFor === item.id && (
                                      <div
                                        className="pic-popover"
                                        role="dialog"
                                        aria-label={`Pemilih PIC ${section.code}.${item.no}`}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Escape') {
                                            event.stopPropagation();
                                            setPicPickerFor(null);
                                          }
                                        }}
                                      >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                                          <strong style={{ fontSize: '0.73rem', color: '#072534' }}>
                                            PIC Utama &amp; Co-PIC ({section.code}.{item.no})
                                          </strong>
                                          <button
                                            type="button"
                                            className="ghost"
                                            aria-label="Tutup pemilih PIC"
                                            onClick={() => setPicPickerFor(null)}
                                            style={{ minHeight: '44px', minWidth: '44px', padding: '0.2rem' }}
                                          >
                                            <X size={13} />
                                          </button>
                                        </div>
                                        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.68rem', fontWeight: 700, color: '#072534' }}>
                                          1. PIC Utama (Penanggung Jawab Pengisian)
                                          <select
                                            className="pic-popover-display"
                                            aria-label="Pilih PIC Utama"
                                            value={picRoles.primaryPic}
                                            onChange={(event) => setItemPrimaryPic(item, event.target.value)}
                                          >
                                            <option value="">- Belum Ditentukan -</option>
                                            {picCatalog.map((entry) => (
                                              <option key={entry.code} value={entry.code}>{entry.code} - {entry.name}</option>
                                            ))}
                                          </select>
                                        </label>
                                        <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#334155', marginTop: '0.15rem' }}>
                                          2. Co-PIC (Kolaborasi / Informasi Tanpa Akun Ganda)
                                        </div>
                                        <input
                                          className="pic-popover-search"
                                          placeholder="Cari unit Co-PIC (mis. BAG, PJM)..."
                                          aria-label="Cari kode Co-PIC"
                                          value={picSearch}
                                          onChange={(event) => setPicSearch(event.target.value)}
                                        />
                                        <div className="pic-popover-list">
                                          {filteredPicCatalog.map((entry) => {
                                            const isPrimary = picRoles.primaryPic.toLowerCase() === entry.code.toLowerCase();
                                            const isCo = picRoles.coPics.some((c) => c.toLowerCase() === entry.code.toLowerCase());
                                            return (
                                              <button
                                                key={entry.code}
                                                type="button"
                                                aria-pressed={isPrimary || isCo}
                                                title={isPrimary ? `${entry.name} (PIC Utama saat ini)` : entry.name}
                                                className={`pic-option ${isPrimary || isCo ? 'active' : ''}`}
                                                style={isPrimary ? { background: '#166534', borderColor: '#166534', color: '#FFFFFF' } : undefined}
                                                onClick={() => toggleItemCoPic(item, entry.code)}
                                              >
                                                {isPrimary ? <Check size={11} /> : <Plus size={11} />}
                                                {entry.code}{isPrimary ? ' (Utama)' : ''}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                </>
                              )}
                              <td className="sub-cell">
                                <div className="sub-wrap">
                                  <Cell multiline aria-label={`Rumusan isian ${subi + 1} ${section.code}.${item.no}`} value={sub.label} onChange={(value) => patchSub({ label: value })} />
                                  <div className="sub-actions">
                                    <button
                                      type="button"
                                      title="Isian teks atau tanggal"
                                      aria-pressed={Boolean(sub.isTextInput)}
                                      className={sub.isTextInput ? 'on' : ''}
                                      onClick={() => patchSub({ isTextInput: !sub.isTextInput })}
                                    >
                                      <Settings2 size={11} /> Aa
                                    </button>
                                    <button type="button" title="Naikkan" disabled={subi === 0} onClick={() => editSubs(si, ii, (subs) => move(subs, subi, -1))}><ArrowUp size={12} /></button>
                                    <button type="button" title="Turunkan" disabled={subi === span - 1} onClick={() => editSubs(si, ii, (subs) => move(subs, subi, 1))}><ArrowDown size={12} /></button>
                                    <button
                                      type="button"
                                      title="Sisipkan isian di bawah"
                                      onClick={() => editSubs(si, ii, (subs) => [...subs.slice(0, subi + 1), newSub(subi + 2), ...subs.slice(subi + 1)])}
                                    >
                                      <Plus size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Hapus isian"
                                      disabled={span <= 1}
                                      onClick={() => editSubs(si, ii, (subs) => subs.filter((_, index) => index !== subi))}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </td>
                              <td className={`ref-cell sim ${refClass(excelERef, iRef)}`} {...pickHandlers(item.id, `I${subi + 1}`, excelERef, iRef)}>
                                <span className="ref-tag" title={`Sel Excel ${excelERef} · Alias ${iRef}`}>{excelERef} · I{subi + 1}</span>
                                <Cell
                                  aria-label={`Simulasi ${excelERef}`}
                                  className="right"
                                  value={simValues[sub.key]}
                                  placeholder={sub.placeholder || '0'}
                                  onChange={(value) => setSimValues((current) => ({ ...current, [sub.key]: value }))}
                                />
                              </td>
                              {subi === 0 && (
                                <>
                                  <td rowSpan={span} className={`ref-cell ${refClass(excelFRef, `${prefix}_B`)}`} {...pickHandlers(item.id, 'B', excelFRef, `${prefix}_B`)}>
                                    <span className="ref-tag" title={`Sel Excel ${excelFRef} · Alias ${prefix}_B`}>{excelFRef} · B</span>
                                    <Cell
                                      type="number"
                                      step="any"
                                      className="right"
                                      aria-label={`Bobot ${section.code}.${item.no}`}
                                      value={Math.abs(Number(item.bobot) || 0)}
                                      onChange={(value) => updateItem(si, ii, { bobot: value })}
                                    />
                                  </td>
                                  <td rowSpan={span} className={`ref-cell ${refClass(excelGRef, `${prefix}_T`)}`} {...pickHandlers(item.id, 'T', excelGRef, `${prefix}_T`)}>
                                    <span className="ref-tag" title={`Sel Excel ${excelGRef} · Alias ${prefix}_T`}>{excelGRef} · T</span>
                                    <Cell
                                      type="number"
                                      step="any"
                                      className="right"
                                      aria-label={`Target ${section.code}.${item.no}`}
                                      value={item.targetNum}
                                      onChange={(value) => updateItem(si, ii, { targetNum: value, targetDisplay: value === '' ? '' : formatIndonesianNumber(Number(value)) })}
                                    />
                                  </td>
                                  <td rowSpan={span}>
                                    <Cell aria-label={`Satuan ${section.code}.${item.no}`} className="center" value={item.satuan} onChange={(value) => updateItem(si, ii, { satuan: value })} />
                                  </td>
                                  <td rowSpan={span} className="formula-cell">
                                    <button
                                      type="button"
                                      className={`formula-preview ${hasError ? 'error' : ''}`}
                                      title="Edit rumus di formula bar"
                                      onClick={() => { setSelectedId(item.id); window.requestAnimationFrame(() => formulaRef.current?.focus()); }}
                                    >
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <Sigma size={11} />
                                        {isDateType(item.calcType) ? CALC_TYPES[item.calcType].label : `=${stripEq(visibleExpr(item)) || '...'}`}
                                      </span>
                                      {item.calcType !== 'custom' && <small>preset</small>}
                                    </button>
                                  </td>
                                  <td rowSpan={span} className="result" style={{ color: capMeta.color }}>
                                    {result?.ratioPercent == null ? '-' : `${formatIndonesianNumber(result.ratioPercent)}%`}
                                    {result?.ratioPercent != null && (
                                      <small style={{ color: capMeta.color, fontWeight: 700, textAlign: 'right' }}>{capMeta.label}</small>
                                    )}
                                  </td>
                                  <td rowSpan={span} className="result">
                                    {formatIndonesianNumber(result?.weightedScore)}
                                    {result?.extraNote && <small title={result.extraNote}>{result.extraNote}</small>}
                                  </td>
                                  <td rowSpan={span} className="act-cell">
                                    <div className="sheet-menu">
                                      <button
                                        type="button"
                                        className="ghost"
                                        aria-haspopup="menu"
                                        aria-expanded={menuFor === item.id}
                                        aria-label={`Aksi baris ${section.code}.${item.no}`}
                                        onClick={() => setMenuFor((value) => (value === item.id ? null : item.id))}
                                      >
                                        <Ellipsis size={15} />
                                      </button>
                                      {menuFor === item.id && (
                                        <div className="menu" role="menu">
                                          {[
                                            { icon: Plus, label: 'Sisipkan indikator di atas', run: () => insertRow(si, ii, false, 'above') },
                                            { icon: Plus, label: 'Sisipkan indikator di bawah', run: () => insertRow(si, ii, false, 'below') },
                                            { icon: Plus, label: 'Tambah sub-indikator (1a, 1b...)', run: () => addSubIndicator(si, ii) },
                                            { icon: Plus, label: 'Tambah isian', run: () => editSubs(si, ii, (subs) => [...subs, newSub(subs.length + 1)]) },
                                            {
                                              icon: GitMerge,
                                              label: item.hideExcelNo ? 'Unmerge Sel Nomor' : 'Merge Sel Nomor dg Baris Atas ↑',
                                              run: () => toggleMergeNo(si, ii, item),
                                              disabled: ii === 0,
                                            },
                                            {
                                              icon: GitMerge,
                                              label: item.hideIndikatorCell ? 'Unmerge Sel Indikator' : 'Merge Sel Indikator dg Baris Atas ↑',
                                              run: () => toggleMergeIndikator(si, ii, item),
                                              disabled: ii === 0,
                                            },
                                            {
                                              icon: Split,
                                              label: 'Batalkan Semua Merge Sel (Unmerge)',
                                              run: () => unmergeRowCells(si, ii, item),
                                              disabled: !item.hideExcelNo && !item.hideIndikatorCell,
                                            },
                                            { icon: Copy, label: 'Duplikat baris', run: () => insertRow(si, ii, true) },
                                            { icon: ArrowUp, label: 'Pindah ke atas', run: () => editItems(si, (items) => move(items, ii, -1)), disabled: ii === 0 },
                                            { icon: ArrowDown, label: 'Pindah ke bawah', run: () => editItems(si, (items) => move(items, ii, 1)), disabled: ii === section.items.length - 1 },
                                            {
                                              icon: Trash2,
                                              label: 'Hapus baris',
                                              danger: true,
                                              run: () => deleteRowAt(si, ii, item.no),
                                            },
                                          ].map(({ icon: Icon, label, run, disabled, danger }) => (
                                            <button
                                              key={label}
                                              type="button"
                                              role="menuitem"
                                              disabled={disabled}
                                              className={danger ? 'danger' : ''}
                                              onClick={() => { run(); setMenuFor(null); }}
                                            >
                                              <Icon size={13} /> {label}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  );
                })}
                <tfoot>
                  <tr>
                    <td className="gutter">{excelRowMap.totalRows + 1}</td>
                    <td colSpan={COLUMNS.length - 1} className="total-label">Total skor simulasi</td>
                    <td className="result total">{formatIndonesianNumber(totalScore)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </HorizontalTableViewport>
            <button type="button" className="designer-add" onClick={addSection}><Plus size={15} /> Tambah bagian KPI</button>
          </div>

          {showPanel && (
            <aside className="designer-aside" aria-label="Validasi, aturan PRP, dan riwayat" data-lenis-prevent>
              <section className="designer-panel">
                <h2><TriangleAlert size={15} /> Hasil Validasi Struktur</h2>
                <p>
                  <strong className="count-error">{errorCount} error wajib</strong> (memblokir kirim) ·{' '}
                  <strong className="count-warn">{warnCount} peringatan</strong> (tetap bisa dikirim).
                </p>
                {validation.issues.length ? (
                  <ul>
                    {validation.issues.map((issue, index) => {
                      const sectionIndex = issue.sectionCode ? normalized.findIndex((s) => s.code === issue.sectionCode) : -1;
                      const summary = sectionIndex >= 0 ? validation.sectionSummaries[sectionIndex] : null;
                      return (
                        <li key={`${issue.level}-${index}-${issue.message}`} className={issue.level}>
                          <span className="issue-tag">{issue.level === 'error' ? 'Error' : 'Peringatan'}</span>
                          {issue.itemId ? (
                            <button type="button" className="link" onClick={() => setSelectedId(issue.itemId)}><MousePointerClick size={12} /> {issue.message}</button>
                          ) : sectionIndex >= 0 ? (
                            <button type="button" className="link" onClick={() => focusSection(sectionIndex)}><MousePointerClick size={12} /> {issue.message}</button>
                          ) : issue.message}
                          {summary && !summary.matches && (
                            <button type="button" className="ghost fix" onClick={() => updateSection(sectionIndex, { totalWeight: summary.itemSum })}>
                              <Check size={12} /> Set bobot {issue.sectionCode} = {formatIndonesianNumber(summary.itemSum, 4)}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="valid"><CircleCheck size={13} /> Seluruh aturan struktur terpenuhi.</p>}
              </section>

              <section className="designer-panel">
                <h2><Settings2 size={15} /> Pengaturan Validasi Struktur (Admin PRP)</h2>
                <div className="rule-guide">
                  <strong>Cara kerja validasi:</strong> sistem memeriksa sintaks rumus <code>fx</code>, jumlah minimum isian, duplikasi kode, kesesuaian bobot bagian dan total, serta kelengkapan PIC. Admin PRP dapat mengatur apakah setiap aturan bersifat <strong>Peringatan</strong>, <strong>Wajib (Blokir Distribusi)</strong>, atau <strong>Nonaktif</strong>.
                </div>
                <div className="rule-grid">
                  <label className="rule-field">
                    <span>Target Total Bobot Capaian Positif</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={validationRules.targetPositiveWeight}
                      onChange={(e) => setValidationRules((prev) => ({ ...prev, targetPositiveWeight: e.target.value }))}
                    />
                  </label>
                  <label className="rule-field">
                    <span>Kebijakan Selisih Total Bobot</span>
                    <select
                      value={validationRules.totalWeightPolicy}
                      onChange={(e) => setValidationRules((prev) => ({ ...prev, totalWeightPolicy: e.target.value }))}
                    >
                      <option value="warn">Peringatan (Tetap Bisa Kirim)</option>
                      <option value="error">Wajib Tepat (Blokir Kirim)</option>
                      <option value="off">Nonaktif</option>
                    </select>
                  </label>
                  <label className="rule-field">
                    <span>Kebijakan Bobot Bagian vs Total Baris</span>
                    <select
                      value={validationRules.sectionWeightPolicy}
                      onChange={(e) => setValidationRules((prev) => ({ ...prev, sectionWeightPolicy: e.target.value }))}
                    >
                      <option value="warn">Peringatan (Tetap Bisa Kirim)</option>
                      <option value="error">Wajib Sama (Blokir Kirim)</option>
                      <option value="off">Nonaktif</option>
                    </select>
                  </label>
                  <button type="button" onClick={syncAllSectionWeightsToRows} style={{ width: '100%' }}>
                    <Check size={14} /> Samakan Semua Bobot Bagian ke Total Baris
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                    <label className="rule-field">
                      <span>Maks. Bobot Penalti</span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={validationRules.maxPenaltyWeight}
                        onChange={(e) => setValidationRules((prev) => ({ ...prev, maxPenaltyWeight: e.target.value }))}
                      />
                    </label>
                    <label className="rule-field">
                      <span>Kebijakan Penalti</span>
                      <select
                        value={validationRules.penaltyWeightPolicy}
                        onChange={(e) => setValidationRules((prev) => ({ ...prev, penaltyWeightPolicy: e.target.value }))}
                      >
                        <option value="off">Nonaktif</option>
                        <option value="warn">Peringatan</option>
                        <option value="error">Wajib (Blokir)</option>
                      </select>
                    </label>
                  </div>
                  <label className="rule-field">
                    <span>Kebijakan Kelengkapan PIC per Baris</span>
                    <select
                      value={validationRules.requirePicPolicy}
                      onChange={(e) => setValidationRules((prev) => ({ ...prev, requirePicPolicy: e.target.value }))}
                    >
                      <option value="off">Opsional (Tanpa Peringatan)</option>
                      <option value="warn">Peringatan bila PIC Kosong</option>
                      <option value="error">Wajib Ada PIC (Blokir Kirim)</option>
                    </select>
                  </label>
                  <label className="designer-check" style={{ marginTop: '0.15rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(validationRules.requireEvidenceOnSubmit)}
                      onChange={(e) => setValidationRules((prev) => ({ ...prev, requireEvidenceOnSubmit: e.target.checked }))}
                    />
                    Wajib bukti capaian per baris saat unit submit
                  </label>
                  <label className="designer-check">
                    <input
                      type="checkbox"
                      checked={Boolean(validationRules.requireFormulaText)}
                      onChange={(e) => setValidationRules((prev) => ({ ...prev, requireFormulaText: e.target.checked }))}
                    />
                    Peringatkan jika narasi rumusan kosong
                  </label>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    <button type="button" className="primary" onClick={handleSaveValidationRules} style={{ flex: '1 1 150px' }}>
                      <Check size={14} /> Simpan Aturan PRP
                    </button>
                    <button type="button" onClick={handleResetValidationRules}>
                      <RotateCcw size={14} /> Reset
                    </button>
                  </div>
                </div>
              </section>

              <section className="designer-panel">
                <h2><History size={15} /> Riwayat Snapshot Konfigurasi</h2>
                {history.length ? history.map((snapshot, index) => (
                  <div className="designer-history" key={`${snapshot.version}-${index}`}>
                    <span>v{snapshot.version}<small>{new Date(snapshot.publishedAt).toLocaleString('id-ID')}</small></span>
                    <button
                      type="button"
                      className="ghost"
                      title={`Pulihkan v${snapshot.version} ke draft`}
                      disabled={!snapshot.sections}
                      onClick={() => {
                        const restored = migrate(clone(snapshot.sections));
                        setSections(restored);
                        setSimValues({});
                        pushRealtimeStructureNow(restored, `v${snapshot.version} dipulihkan dan disinkronkan ke seluruh unit.`);
                      }}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                )) : <p>Belum ada snapshot terpublikasi.</p>}
              </section>
            </aside>
          )}
        </div>
      )}

      {confirmState && (() => {
        const confirmNode = (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="kpi-designer-confirm-title"
            onClick={(event) => {
              if (event.target === event.currentTarget) setConfirmState(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1450,
              background: 'rgba(6, 44, 61, 0.56)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <div
              style={{
                width: 'min(440px, 100%)',
                background: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #D8E4EA',
                boxShadow: '0 24px 48px rgba(7, 37, 52, 0.22)',
                padding: '1.35rem',
              }}
            >
              <h3
                id="kpi-designer-confirm-title"
                style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}
              >
                {confirmState.title}
              </h3>
              <p style={{ margin: '0 0 1.15rem', fontSize: '0.84rem', lineHeight: 1.55, color: '#334155' }}>
                {confirmState.message}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="ghost"
                  style={{ minHeight: '44px', padding: '0.45rem 0.9rem', border: '1px solid #B8CAD4', borderRadius: '6px' }}
                  onClick={() => setConfirmState(null)}
                >
                  <X size={14} /> Batal
                </button>
                <button
                  type="button"
                  className="primary"
                  style={{
                    minHeight: '44px',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    background: confirmState.danger ? '#991B1B' : '#094E68',
                    borderColor: confirmState.danger ? '#991B1B' : '#094E68',
                    color: '#FFFFFF',
                  }}
                  onClick={() => {
                    const fn = confirmState.onConfirm;
                    setConfirmState(null);
                    fn?.();
                  }}
                >
                  {confirmState.danger ? <Trash2 size={14} /> : <Check size={14} />}
                  {confirmState.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(confirmNode, document.body) : confirmNode;
      })()}
    </div>
  );
}
