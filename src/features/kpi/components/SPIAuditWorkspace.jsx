import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  FolderDown,
  Layers,
  Printer,
  RotateCcw,
  Search,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import HorizontalTableViewport from '../../../shared/components/HorizontalTableViewport';
import {
  computeKpiItem,
  formatIndonesianNumber,
  getKpiAchievementMeta,
  normalizeKpiSections,
  readPublishedKpiConfig,
  resolveItemPicRoles,
} from '../kpiSchema';
import { KPI_SECTIONS_CONFIG } from '../kpiTemplateConfig';
import {
  ensureDefaultKpiDistribution,
  evaluateRenbangValidationStatus,
  getFormForPeriod,
  listKpiPeriodsWithStatus,
  readIntegratedKpiBoard,
  readKpiWorkflow,
  subscribeKpiWorkflow,
} from '../kpiWorkflowStore';
import {
  IKU_INDICATORS,
  ikuAchievementMeta,
  ikuPercentage,
  listIkuSubmissions,
  subscribeIku,
} from '../../iku/ikuWorkflowStore';
import KPIDataEntrySheet, { EvidencePreviewModal } from './KPIDataEntrySheet';

function escapeHtml(value, isExcel = false) {
  const raw = String(value ?? '');
  const safe = isExcel && /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw;
  return safe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function triggerEvidenceDownload(ev) {
  if (!ev) return;
  if (ev.kind === 'file' && ev.dataUrl) {
    const link = document.createElement('a');
    link.href = ev.dataUrl;
    link.download = ev.fileName || `${ev.label || 'bukti-kpi'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  if (ev.url && /^https?:\/\//i.test(ev.url)) {
    window.open(ev.url, '_blank', 'noopener,noreferrer');
  }
}

export default function SPIAuditWorkspace({ period = '2026', isPeriodOpen = true, onPeriodChange }) {
  const { currentUser: user } = useAuth();
  const [tick, setTick] = useState(0);
  const [periodOverride, setPeriodOverride] = useState(null);
  const [activeTab, setActiveTab] = useState('kpi');
  const [searchQuery, setSearchQuery] = useState('');
  const [picFilter, setPicFilter] = useState('ALL');
  const [dataScope, setDataScope] = useState('ALL_SUBMITTED');
  const [showFullSheet, setShowFullSheet] = useState(false);
  const [previewEvidence, setPreviewEvidence] = useState(null);
  const [actionNotice, setActionNotice] = useState('');

  const localPeriod = onPeriodChange
    ? String(period || '2026')
    : String(periodOverride ?? period ?? '2026');

  useEffect(() => {
    const baseSections = readPublishedKpiConfig()?.sections || normalizeKpiSections(KPI_SECTIONS_CONFIG);
    ensureDefaultKpiDistribution(baseSections, String(localPeriod || '2026'), { silent: true });
    const unsubKpi = subscribeKpiWorkflow(() => setTick((t) => t + 1));
    const unsubIku = subscribeIku(() => setTick((t) => t + 1));
    return () => {
      unsubKpi();
      unsubIku();
    };
  }, [localPeriod]);

  const periods = useMemo(() => {
    void tick;
    return listKpiPeriodsWithStatus();
  }, [tick]);

  const workflow = useMemo(() => {
    void tick;
    return readKpiWorkflow();
  }, [tick]);

  const periodForm = useMemo(
    () =>
      getFormForPeriod(localPeriod, workflow, { fallbackToLatest: false })
      || getFormForPeriod(localPeriod, workflow, { fallbackToLatest: true })
      || workflow.forms[workflow.forms.length - 1]
      || null,
    [localPeriod, workflow],
  );

  const renbangValidation = useMemo(
    () => evaluateRenbangValidationStatus(periodForm?.id || localPeriod, workflow),
    [periodForm?.id, localPeriod, workflow],
  );

  const integratedBoard = useMemo(() => {
    if (!periodForm) {
      return {
        form: null,
        values: {},
        notes: {},
        evidenceByItem: {},
        unitStatuses: [],
      };
    }
    return readIntegratedKpiBoard(periodForm.id, workflow, {
      confirmedOnly: dataScope === 'APPROVED_ONLY',
    });
  }, [periodForm, workflow, dataScope]);

  const allBoardEvidence = useMemo(
    () => Object.values(integratedBoard.evidenceByItem || {}).flat(),
    [integratedBoard.evidenceByItem],
  );

  const sections = useMemo(
    () =>
      periodForm?.sections?.length
        ? normalizeKpiSections(periodForm.sections)
        : readPublishedKpiConfig()?.sections || normalizeKpiSections(KPI_SECTIONS_CONFIG),
    [periodForm],
  );

  const kpiRows = useMemo(() => {
    const evMap = integratedBoard.evidenceByItem || {};

    const rows = sections.flatMap((sec) => {
      const secCode = sec.code || 'A';
      return (sec.items || []).map((item) => {
        const computed = computeKpiItem(item, integratedBoard.values || {}, Boolean(sec.isPenaltySection), sections);
        const { primaryPic, coPics } = resolveItemPicRoles(item);
        const itemEvidences = evMap[item.id] || [];
        const parsedSubs = computed.parsedSubs || [];
        const hasFilledSubRow = parsedSubs.some((sr) => sr.isFilled);
        const isFilled = hasFilledSubRow && computed.ratioPercent !== null && Number.isFinite(computed.ratioPercent);

        const meta = isFilled
          ? getKpiAchievementMeta(computed.ratioPercent, { isPenaltySection: Boolean(sec.isPenaltySection) })
          : { tier: 'empty', label: 'Belum Diisi', color: '#475569' };

        const subRowSummary = parsedSubs
          .map((sr) => {
            const valText = !sr.isFilled
              ? '-'
              : sr.isTextInput
                ? String(sr.raw)
                : sr.num !== null
                  ? formatIndonesianNumber(sr.num, 2)
                  : String(sr.raw);
            return `${sr.label || sr.key}: ${valText}`;
          })
          .join(' | ');

        const unitSuffix = item.satuan && item.satuan !== '-' ? ` ${item.satuan}` : '';

        return {
          id: item.id,
          sectionCode: secCode,
          sectionTitle: sec.title,
          isPenaltySection: Boolean(sec.isPenaltySection),
          code: `${secCode}.${item.no}`,
          indikator: item.indikator,
          formulaText: item.formula || item.formulaExpr || '',
          primaryPic,
          coPics,
          allPics: [primaryPic, ...coPics].filter(Boolean),
          bobot: item.bobot,
          targetLabel: `${item.targetDisplay || formatIndonesianNumber(item.targetNum, 2)}${unitSuffix}`,
          subRowSummary,
          ratioPercent: isFilled ? computed.ratioPercent : null,
          weightedScore: computed.weightedScore || 0,
          note: (integratedBoard.notes || {})[item.id] || '',
          evidences: itemEvidences,
          isFilled,
          meta,
        };
      });
    });

    const positiveScore = rows
      .filter((r) => !r.isPenaltySection)
      .reduce((acc, r) => acc + (r.weightedScore || 0), 0);
    const penaltyScore = rows
      .filter((r) => r.isPenaltySection)
      .reduce((acc, r) => acc + (r.weightedScore || 0), 0);
    const filledRows = rows.filter((r) => r.isFilled && r.ratioPercent !== null);
    const institutionScore = Math.max(-25, Number((positiveScore + penaltyScore).toFixed(2)));
    const avgRatio = filledRows.length
      ? filledRows.reduce((acc, r) => acc + r.ratioPercent, 0) / filledRows.length
      : null;

    return {
      rows,
      institutionScore,
      positiveScore,
      penaltyScore,
      filledCount: filledRows.length,
      avgRatio,
      avgMeta: avgRatio !== null ? getKpiAchievementMeta(avgRatio) : null,
    };
  }, [sections, integratedBoard]);

  const availablePicCodes = useMemo(() => {
    const set = new Set();
    kpiRows.rows.forEach((r) => r.allPics.forEach((p) => set.add(p)));
    return [...set].sort();
  }, [kpiRows.rows]);

  const filteredKpiRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return kpiRows.rows.filter((row) => {
      const matchPic =
        picFilter === 'ALL'
        || row.allPics.some((code) => code.toLowerCase() === picFilter.toLowerCase());
      const matchQuery =
        !q
        || `${row.code} ${row.indikator} ${row.primaryPic} ${row.coPics.join(' ')} ${row.note} ${row.subRowSummary}`
          .toLowerCase()
          .includes(q);
      return matchPic && matchQuery;
    });
  }, [kpiRows.rows, picFilter, searchQuery]);

  const ikuRecords = useMemo(() => {
    void tick;
    try {
      const all = listIkuSubmissions(user);
      return all.filter((r) => String(r.period) === String(localPeriod) || localPeriod === '2026' && r.period === '2025/2026');
    } catch {
      return [];
    }
  }, [user, localPeriod, tick]);

  const downloadableFiles = useMemo(
    () => allBoardEvidence.filter((ev) => ev.kind === 'file' && ev.dataUrl),
    [allBoardEvidence],
  );

  const handleSelectPeriod = (nextPeriod) => {
    setPeriodOverride(nextPeriod);
    if (typeof onPeriodChange === 'function') {
      onPeriodChange(nextPeriod);
    }
  };

  const handleExportExcel = () => {
    const rowsHtml = filteredKpiRows
      .map((row) => {
        const evSummary = row.evidences.length
          ? row.evidences
              .map((ev) => `${ev.label || ev.fileName || 'Bukti'} (${ev.kind === 'file' ? ev.fileName || 'Berkas' : ev.url || '-'}) [${ev.status || 'SUBMITTED'}]`)
              .join('; ')
          : 'Belum ada bukti';
        return `<tr>
          <td>${escapeHtml(row.code, true)}</td>
          <td>${escapeHtml(row.indikator, true)}</td>
          <td>${escapeHtml(row.primaryPic || '-', true)}</td>
          <td>${escapeHtml(row.coPics.join(', ') || '-', true)}</td>
          <td>${escapeHtml(row.subRowSummary, true)}</td>
          <td style="text-align:right;">${escapeHtml(formatIndonesianNumber(row.bobot, 2))}</td>
          <td style="text-align:right;">${escapeHtml(row.targetLabel, true)}</td>
          <td style="text-align:right;font-weight:700;color:${row.meta.color};">${row.ratioPercent !== null ? escapeHtml(`${formatIndonesianNumber(row.ratioPercent, 2)}%`) : '-'}</td>
          <td style="font-weight:700;color:${row.meta.color};">${escapeHtml(row.meta.label, true)}</td>
          <td style="text-align:right;font-weight:700;">${escapeHtml(formatIndonesianNumber(row.weightedScore, 2))}</td>
          <td>${escapeHtml(row.note || '-', true)}</td>
          <td>${escapeHtml(evSummary, true)}</td>
        </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Verifikasi SPI KPI ITPLN Periode ${escapeHtml(localPeriod)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #072534; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #94A3B8; padding: 6px 8px; vertical-align: top; }
    th { background: #094E68; color: #FFFFFF; font-weight: bold; }
  </style>
</head>
<body>
  <h2>VERIFIKASI SATUAN PENGAWAS INTERNAL (SPI) - PERFORMA ITPLN</h2>
  <p><strong>Periode Evaluasi:</strong> ${escapeHtml(localPeriod)} | <strong>Skor Institusi:</strong> ${escapeHtml(formatIndonesianNumber(kpiRows.institutionScore, 2))} | <strong>Mode Akses:</strong> Auditor View-Only</p>
  <table>
    <thead>
      <tr>
        <th>Kode</th>
        <th>Indikator Kinerja</th>
        <th>PIC Utama</th>
        <th>Co-PIC</th>
        <th>Rincian Angka Isian</th>
        <th>Bobot</th>
        <th>Target</th>
        <th>Capaian Riil (%)</th>
        <th>Status Ambang Batas</th>
        <th>Skor Terbobot</th>
        <th>Keterangan Unit</th>
        <th>Rekap Dokumen Bukti (Evidence)</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Verifikasi-SPI-KPI-ITPLN-${localPeriod}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setActionNotice(`Berkas Excel Verifikasi SPI periode ${localPeriod} berhasil diunduh.`);
  };

  const handlePrintPdf = () => {
    const popup = window.open('', '_blank', 'width=1120,height=780');
    if (!popup) {
      setActionNotice('Izinkan jendela pop-up pada browser untuk mencetak PDF Verifikasi SPI.');
      return;
    }
    const rowsHtml = filteredKpiRows
      .map(
        (row) => `<tr>
          <td><strong>${escapeHtml(row.code)}</strong></td>
          <td>${escapeHtml(row.indikator)}</td>
          <td><strong>${escapeHtml(row.primaryPic || '-')}</strong>${row.coPics.length ? `<br/><small>Co-PIC: ${escapeHtml(row.coPics.join(', '))}</small>` : ''}</td>
          <td>${escapeHtml(row.subRowSummary)}</td>
          <td style="text-align:right;">${escapeHtml(formatIndonesianNumber(row.bobot, 2))}</td>
          <td style="text-align:right;">${escapeHtml(row.targetLabel)}</td>
          <td style="text-align:right;font-weight:700;color:${row.meta.color};">${row.ratioPercent !== null ? `${escapeHtml(formatIndonesianNumber(row.ratioPercent, 2))}% (${escapeHtml(row.meta.label)})` : '-'}</td>
          <td style="text-align:right;font-weight:700;">${escapeHtml(formatIndonesianNumber(row.weightedScore, 2))}</td>
          <td>${row.evidences.length ? `${row.evidences.length} bukti terlampir` : 'Belum ada'}</td>
        </tr>`,
      )
      .join('');

    popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Laporan Verifikasi SPI - Periode ${escapeHtml(localPeriod)}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #072534; padding: 24px; font-size: 11px; }
    h1 { margin: 0 0 6px; font-size: 18px; color: #094E68; }
    p { margin: 0 0 14px; color: #334155; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #CBD5E1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #EDF3F6; font-weight: 700; }
    @media print { @page { size: landscape; margin: 12mm; } }
  </style>
</head>
<body>
  <h1>LAPORAN VERIFIKASI SPI (READ-ONLY) - PERFORMA ITPLN</h1>
  <p>Periode: <strong>${escapeHtml(localPeriod)}</strong> | Skor Institusi: <strong>${escapeHtml(formatIndonesianNumber(kpiRows.institutionScore, 2))}</strong> | Dicetak: ${escapeHtml(new Date().toLocaleString('id-ID'))}</p>
  <table>
    <thead>
      <tr>
        <th>Kode</th>
        <th>Indikator Kinerja</th>
        <th>PIC Utama &amp; Co-PIC</th>
        <th>Isian Realisasi</th>
        <th>Bobot</th>
        <th>Target</th>
        <th>Capaian Riil (%)</th>
        <th>Skor</th>
        <th>Bukti Dukung</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleDownloadEvidenceCsv = () => {
    const header = [
      'modul',
      'periode',
      'kode_indikator',
      'unit_atau_pic_utama',
      'jenis_bukti',
      'judul_bukti',
      'nama_berkas_atau_url',
      'status_verifikasi',
    ];
    const kpiEvLines = filteredKpiRows.flatMap((row) =>
      row.evidences.map((ev) =>
        [
          'KPI',
          localPeriod,
          row.code,
          ev.unit || row.primaryPic || '-',
          ev.kind || 'link',
          ev.label || ev.fileName || 'Bukti KPI',
          ev.kind === 'file' ? ev.fileName || 'berkas-lokal' : ev.url || '-',
          ev.status || 'SUBMITTED',
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    );
    const ikuEvLines = ikuRecords.flatMap((rec) =>
      (rec.values || [])
        .filter((v) => v.evidence)
        .map((v, idx) =>
          [
            'IKU',
            rec.period,
            `IKU.0${idx + 1}`,
            rec.unit || rec.owner || '-',
            'link',
            IKU_INDICATORS[idx]?.label || v.id,
            v.evidence,
            v.verification || 'PENDING',
          ]
            .map(escapeCsvCell)
            .join(','),
        ),
    );

    const csvContent = '\ufeff' + [header.join(','), ...kpiEvLines, ...ikuEvLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Manifest-Evidence-Verifikasi-SPI-${localPeriod}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setActionNotice(
      `Daftar manifest bukti dukung (${kpiEvLines.length + ikuEvLines.length} entri) berhasil diunduh dalam format CSV.`,
    );
  };

  const handleDownloadAllEvidenceFiles = () => {
    if (!downloadableFiles.length) {
      setActionNotice(
        'Belum ada berkas dokumen PDF/gambar unggahan lokal pada periode ini. Tautan HTTPS eksternal dapat dibuka langsung atau diunduh melalui Manifest CSV.',
      );
      return;
    }
    downloadableFiles.forEach((ev, idx) => {
      window.setTimeout(() => triggerEvidenceDownload(ev), idx * 180);
    });
    setActionNotice(`Mengunduh ${downloadableFiles.length} berkas dokumen bukti dukung secara berurutan.`);
  };

  return (
    <section aria-label="Ruang Kerja Verifikasi SPI Read-Only" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      {/* Top Informational Status & Period Filter Bar */}
      <div
        style={{
          padding: '1.1rem 1.3rem',
          borderRadius: '8px',
          border: '1px solid #CBD5E1',
          background: '#F7FAFB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', minWidth: 0, flex: '1 1 320px' }}>
          <ShieldCheck size={20} color="#094E68" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.02rem', fontWeight: 800, color: '#072534' }}>
                Verifikasi SPI (Akses Auditor Komprehensif · Hanya Lihat &amp; Unduh)
              </strong>
              <strong style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 800, color: '#094E68' }}>
                MODE BACA KETAT (READ-ONLY)
              </strong>
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.79rem', color: '#334155', lineHeight: 1.55 }}>
              Menampilkan seluruh data capaian KPI, 8 IKU, dan lampiran bukti dukung lintas unit kerja. Wewenang akun SPI dibatasi khusus untuk pemeriksaan, pratinjau dokumen, dan pengunduhan berkas ekspor tanpa pengubahan data, status, maupun isian umpan balik.
            </p>
            <div style={{ marginTop: '0.4rem', fontSize: '0.74rem', color: '#475569', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span>
                Status siklus:{' '}
                <strong style={{ color: isPeriodOpen ? '#166534' : '#B91C1C', fontWeight: 800 }}>
                  {isPeriodOpen ? 'AKTIF' : 'ARSIP HISTORIS'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Validasi Final PRP:{' '}
                <strong style={{ color: renbangValidation.isValidated100 ? '#166534' : '#92400E', fontWeight: 800 }}>
                  {renbangValidation.validatedUnits}/{renbangValidation.totalUnits} UNIT DISETUJUI ({renbangValidation.progressPercent}%)
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Export & Download Action Buttons (All with Supporting Icons) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="ent-btn ent-btn-primary" style={{ minHeight: '44px' }} onClick={handleExportExcel}>
            <FileSpreadsheet size={15} />
            <span>Unduh Excel (.xls)</span>
          </button>
          <button type="button" className="ent-btn" style={{ minHeight: '44px' }} onClick={handlePrintPdf}>
            <Printer size={15} />
            <span>Cetak / PDF</span>
          </button>
          <button type="button" className="ent-btn" style={{ minHeight: '44px' }} onClick={handleDownloadEvidenceCsv}>
            <Download size={15} />
            <span>Manifest Evidence (.csv)</span>
          </button>
          <button type="button" className="ent-btn" style={{ minHeight: '44px' }} onClick={handleDownloadAllEvidenceFiles}>
            <FolderDown size={15} />
            <span>Unduh Berkas Evidence ({downloadableFiles.length})</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          role="status"
          style={{
            padding: '0.7rem 1rem',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            background: '#FFFFFF',
            color: '#166534',
            fontSize: '0.79rem',
            fontWeight: 700,
          }}
        >
          {actionNotice}
        </div>
      )}

      {/* Aggregate Executive Summary Strip for SPI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
          border: '1px solid #CBD5E1',
          borderRadius: '8px',
          background: '#FFFFFF',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem 1.15rem', borderRight: '1px solid #E2E8F0' }}>
          <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.63rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            SKOR INSTITUSI KPI
          </span>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 800, color: '#072534', marginTop: '0.2rem' }}>
            {formatIndonesianNumber(kpiRows.institutionScore, 2)}
          </div>
          <span style={{ fontSize: '0.73rem', color: '#475569' }}>
            Positif {formatIndonesianNumber(kpiRows.positiveScore, 2)} · Penalti {formatIndonesianNumber(kpiRows.penaltyScore, 2)}
          </span>
        </div>

        <div style={{ padding: '1rem 1.15rem', borderRight: '1px solid #E2E8F0' }}>
          <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.63rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            RATA-RATA CAPAIAN RIIL
          </span>
          <div
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: '1.85rem',
              fontWeight: 800,
              color: kpiRows.avgMeta ? kpiRows.avgMeta.color : '#475569',
              marginTop: '0.2rem',
            }}
          >
            {kpiRows.avgRatio !== null ? `${formatIndonesianNumber(kpiRows.avgRatio, 2)}%` : '-'}
          </div>
          <strong style={{ fontSize: '0.72rem', color: kpiRows.avgMeta ? kpiRows.avgMeta.color : '#475569', fontWeight: 800 }}>
            {kpiRows.avgMeta ? kpiRows.avgMeta.label : 'Belum Ada Isian'}
          </strong>
        </div>

        <div style={{ padding: '1rem 1.15rem', borderRight: '1px solid #E2E8F0' }}>
          <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.63rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            INDIKATOR &amp; BUKTI KPI
          </span>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 800, color: '#094E68', marginTop: '0.2rem' }}>
            {kpiRows.filledCount}/{kpiRows.rows.length}
          </div>
          <span style={{ fontSize: '0.73rem', color: '#475569' }}>
            {allBoardEvidence.length} dokumen/tautan evidence terlampir
          </span>
        </div>

        <div style={{ padding: '1rem 1.15rem' }}>
          <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.63rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            PENGAJUAN 8 IKU KEMENTERIAN
          </span>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.85rem', fontWeight: 800, color: '#094E68', marginTop: '0.2rem' }}>
            {ikuRecords.length}
          </div>
          <span style={{ fontSize: '0.73rem', color: '#475569' }}>
            Rekaman submission IKU pada periode terpilih
          </span>
        </div>
      </div>

      {/* Navigation Tabs + Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '2px solid #094E68',
        }}
      >
        <div role="tablist" aria-label="Pilih modul Verifikasi SPI" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'kpi'}
            className={`ent-btn ${activeTab === 'kpi' ? 'ent-btn-primary' : ''}`}
            style={{ minHeight: '44px' }}
            onClick={() => setActiveTab('kpi')}
          >
            <Table2 size={15} />
            <span>Evaluasi KPI &amp; Evidence ({filteredKpiRows.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'iku'}
            className={`ent-btn ${activeTab === 'iku' ? 'ent-btn-primary' : ''}`}
            style={{ minHeight: '44px' }}
            onClick={() => setActiveTab('iku')}
          >
            <Layers size={15} />
            <span>Evaluasi 8 IKU &amp; Evidence ({ikuRecords.length})</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', fontWeight: 700, color: '#072534' }}>
            <Calendar size={14} color="#094E68" />
            <span>Periode:</span>
            <select
              aria-label="Filter periode pada Verifikasi SPI"
              className="ent-select"
              style={{ minHeight: '44px', minWidth: '180px', fontWeight: 700 }}
              value={localPeriod}
              onChange={(e) => handleSelectPeriod(e.target.value)}
            >
              {periods.map((p) => {
                const pid = p.id || p.year;
                const openFlag = Boolean(p.isOpenForInput ?? p.inputOpen ?? p.status === 'Active');
                return (
                  <option key={pid} value={pid}>
                    {p.label || `Periode ${pid}`} ({openFlag ? 'Aktif' : 'Historis'})
                  </option>
                );
              })}
            </select>
          </label>

          {activeTab === 'kpi' && (
            <>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', fontWeight: 700, color: '#072534' }}>
                <Filter size={14} color="#094E68" />
                <select
                  aria-label="Cakupan status data KPI SPI"
                  className="ent-select"
                  style={{ minHeight: '44px', fontWeight: 700 }}
                  value={dataScope}
                  onChange={(e) => setDataScope(e.target.value)}
                >
                  <option value="ALL_SUBMITTED">Seluruh Data Terkumpul</option>
                  <option value="APPROVED_ONLY">Khusus Disetujui Final PRP</option>
                </select>
              </label>

              <button
                type="button"
                className="ent-btn"
                style={{ minHeight: '44px' }}
                onClick={() => setShowFullSheet((prev) => !prev)}
              >
                <Eye size={14} />
                <span>{showFullSheet ? 'Tabel Pemeriksaan Evidence' : 'Format Lembar Kerja Utuh'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {activeTab === 'kpi' ? (
        showFullSheet ? (
          <KPIDataEntrySheet
            sectionsOverride={sections}
            valuesOverride={integratedBoard.values}
            notesOverride={integratedBoard.notes}
            evidenceOverride={allBoardEvidence}
            contributorMapOverride={integratedBoard.contributorsByItem}
            integratedBoardOverride={integratedBoard}
            period={localPeriod}
            readOnly
            persist={false}
          />
        ) : (
          <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', background: '#FFFFFF', overflow: 'hidden' }}>
            {/* Search & PIC Filter Toolbar */}
            <div
              style={{
                padding: '0.9rem 1.15rem',
                background: '#F7FAFB',
                borderBottom: '1px solid #CBD5E1',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
                <Search
                  size={15}
                  color="#475569"
                  style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
                <input
                  type="search"
                  className="ent-input"
                  aria-label="Cari indikator KPI atau bukti dukung"
                  placeholder="Cari kode indikator, nama KPI, PIC Utama, Co-PIC, atau keterangan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.2rem', minHeight: '44px' }}
                />
              </div>

              <select
                aria-label="Filter kode PIC pada Verifikasi SPI"
                className="ent-select"
                style={{ minHeight: '44px', minWidth: '185px', fontWeight: 700 }}
                value={picFilter}
                onChange={(e) => setPicFilter(e.target.value)}
              >
                <option value="ALL">Semua Unit Kerja / PIC</option>
                {availablePicCodes.map((code) => (
                  <option key={code} value={code}>
                    Unit / PIC: {code}
                  </option>
                ))}
              </select>

              {(searchQuery || picFilter !== 'ALL') && (
                <button
                  type="button"
                  className="ent-btn"
                  style={{ minHeight: '44px' }}
                  onClick={() => {
                    setSearchQuery('');
                    setPicFilter('ALL');
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            <HorizontalTableViewport panLabel="Geser tabel Verifikasi SPI KPI dan Evidence">
              <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                <thead>
                  <tr style={{ background: '#EDF3F6', borderBottom: '1px solid #64748B', color: '#334155', textAlign: 'left' }}>
                    <th style={{ padding: '0.7rem 0.8rem', fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', textTransform: 'uppercase' }}>Kode</th>
                    <th style={{ padding: '0.7rem 0.8rem', fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', textTransform: 'uppercase' }}>Indikator Kinerja</th>
                    <th style={{ padding: '0.7rem 0.8rem', fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', textTransform: 'uppercase' }}>PIC Utama &amp; Co-PIC</th>
                    <th style={{ padding: '0.7rem 0.8rem', fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', textTransform: 'uppercase' }}>Rincian Angka Isian</th>
                    <th style={{ padding: '0.7rem 0.8rem', fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', textTransform: 'uppercase', textAlign: 'right' }}>Bobot</th>
                    <th style={{ padding: '0.7rem 0.8rem', fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', textTransform: 'uppercase', textAlign: 'right' }}>Target</th>
                    <th style={{ padding: '0.7rem 0.8rem', fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', textTransform: 'uppercase', textAlign: 'right' }}>Capaian Riil (%)</th>
                    <th style={{ padding: '0.7rem 0.8rem', fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', textTransform: 'uppercase', textAlign: 'right' }}>Skor</th>
                    <th style={{ padding: '0.7rem 0.8rem', fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', textTransform: 'uppercase' }}>Dokumen Bukti (Evidence)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKpiRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '2.25rem 1rem', textAlign: 'center', color: '#475569' }}>
                        Tidak ada baris indikator KPI yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredKpiRows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #E2E8F0', verticalAlign: 'top' }}>
                        <td style={{ padding: '0.75rem 0.8rem', fontFamily: 'var(--ent-mono)', fontWeight: 800, color: '#094E68', whiteSpace: 'nowrap' }}>
                          {row.code}
                        </td>
                        <td style={{ padding: '0.75rem 0.8rem', minWidth: '230px' }}>
                          <div style={{ fontWeight: 700, color: '#072534', lineHeight: 1.45 }}>{row.indikator}</div>
                          {row.note && (
                            <div style={{ marginTop: '0.28rem', fontSize: '0.72rem', color: '#334155' }}>
                              <strong>Catatan Unit:</strong> {row.note}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.8rem', minWidth: '155px', fontSize: '0.74rem', lineHeight: 1.45 }}>
                          <strong style={{ color: '#094E68', display: 'block', fontWeight: 800 }}>
                            Utama: {row.primaryPic || '-'}
                          </strong>
                          {row.coPics.length > 0 && (
                            <span style={{ color: '#475569', fontWeight: 600 }}>
                              Co-PIC: {row.coPics.join(', ')}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.8rem', minWidth: '195px', fontSize: '0.73rem', color: '#334155', lineHeight: 1.48 }}>
                          {row.subRowSummary || '-'}
                        </td>
                        <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontFamily: 'var(--ent-mono)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatIndonesianNumber(row.bobot, 2)}
                        </td>
                        <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', fontFamily: 'var(--ent-mono)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {row.targetLabel}
                        </td>
                        <td style={{ padding: '0.75rem 0.8rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <strong style={{ fontFamily: 'var(--ent-mono)', fontWeight: 800, color: row.meta.color, display: 'block' }}>
                            {row.ratioPercent !== null ? `${formatIndonesianNumber(row.ratioPercent, 2)}%` : '-'}
                          </strong>
                          <span style={{ fontSize: '0.66rem', fontWeight: 800, color: row.meta.color }}>
                            {row.meta.label}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '0.75rem 0.8rem',
                            textAlign: 'right',
                            fontFamily: 'var(--ent-mono)',
                            fontWeight: 800,
                            color: row.weightedScore < 0 ? '#B91C1C' : '#072534',
                          }}
                        >
                          {formatIndonesianNumber(row.weightedScore, 2)}
                        </td>
                        <td style={{ padding: '0.75rem 0.8rem', minWidth: '240px' }}>
                          {row.evidences.length === 0 ? (
                            <span style={{ fontSize: '0.73rem', color: '#64748B', fontWeight: 600 }}>
                              Belum ada bukti dukung
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              {row.evidences.map((ev) => (
                                <div
                                  key={ev.id}
                                  style={{
                                    padding: '0.45rem 0.6rem',
                                    borderRadius: '6px',
                                    border: '1px solid #D8E4EA',
                                    background: '#F7FAFB',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <strong style={{ fontSize: '0.73rem', color: '#072534', wordBreak: 'break-word' }}>
                                      {ev.label || ev.fileName || 'Dokumen Bukti'}
                                    </strong>
                                    <strong
                                      style={{
                                        fontFamily: 'var(--ent-mono)',
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        color:
                                          ev.status === 'VERIFIED'
                                            ? '#166534'
                                            : ev.status === 'REJECTED'
                                              ? '#B91C1C'
                                              : '#094E68',
                                      }}
                                    >
                                      {ev.status || 'SUBMITTED'}
                                    </strong>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      className="ent-btn"
                                      style={{ minHeight: '44px', padding: '0.35rem 0.65rem', fontSize: '0.7rem' }}
                                      onClick={() => setPreviewEvidence(ev)}
                                    >
                                      <Eye size={13} />
                                      <span>Pratinjau</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="ent-btn"
                                      style={{ minHeight: '44px', padding: '0.35rem 0.65rem', fontSize: '0.7rem' }}
                                      onClick={() => triggerEvidenceDownload(ev)}
                                    >
                                      {ev.kind === 'file' ? <Download size={13} /> : <ExternalLink size={13} />}
                                      <span>{ev.kind === 'file' ? 'Unduh' : 'Buka Tautan'}</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </HorizontalTableViewport>
          </div>
        )
      ) : (
        <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', background: '#FFFFFF', overflow: 'hidden' }}>
          {ikuRecords.length === 0 ? (
            <div style={{ padding: '2.5rem 1.25rem', textAlign: 'center', color: '#475569', fontSize: '0.84rem' }}>
              Belum ada pengajuan 8 IKU yang tercatat pada periode {localPeriod}. Gunakan pemilih periode di atas untuk meninjau data siklus lainnya.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.15rem' }}>
              {ikuRecords.map((rec) => (
                <article
                  key={rec.id}
                  style={{
                    border: '1px solid #D8E4EA',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '0.85rem 1.1rem',
                      background: '#F7FAFB',
                      borderBottom: '1px solid #D8E4EA',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: '#072534' }}>{rec.unit}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#475569', marginLeft: '0.5rem' }}>
                        ({rec.owner}) · Periode {rec.period}
                      </span>
                    </div>
                    <strong
                      style={{
                        fontFamily: 'var(--ent-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color:
                          rec.status === 'APPROVED'
                            ? '#166534'
                            : rec.status === 'REJECTED'
                              ? '#B91C1C'
                              : '#094E68',
                      }}
                    >
                      STATUS: {rec.status}
                    </strong>
                  </div>

                  <HorizontalTableViewport panLabel="Geser tabel rincian 8 IKU Verifikasi SPI">
                    <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                      <thead>
                        <tr style={{ background: '#EDF3F6', borderBottom: '1px solid #64748B', textAlign: 'left', color: '#334155' }}>
                          <th style={{ padding: '0.6rem 0.8rem' }}>Indikator IKU</th>
                          <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Aktual</th>
                          <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Target</th>
                          <th style={{ padding: '0.6rem 0.8rem', textAlign: 'right' }}>Capaian Riil (%)</th>
                          <th style={{ padding: '0.6rem 0.8rem' }}>Catatan Unit</th>
                          <th style={{ padding: '0.6rem 0.8rem' }}>Tautan Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(rec.values || []).map((val, idx) => {
                          const pct = ikuPercentage(val);
                          const meta = ikuAchievementMeta(pct);
                          return (
                            <tr key={val.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                              <td style={{ padding: '0.65rem 0.8rem', fontWeight: 700, color: '#072534' }}>
                                IKU.0{idx + 1} · {IKU_INDICATORS[idx]?.label || val.id}
                              </td>
                              <td style={{ padding: '0.65rem 0.8rem', textAlign: 'right', fontFamily: 'var(--ent-mono)' }}>
                                {val.actual !== '' ? val.actual : '-'}
                              </td>
                              <td style={{ padding: '0.65rem 0.8rem', textAlign: 'right', fontFamily: 'var(--ent-mono)' }}>
                                {val.target !== '' ? val.target : '-'}
                              </td>
                              <td style={{ padding: '0.65rem 0.8rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <strong style={{ fontFamily: 'var(--ent-mono)', fontWeight: 800, color: meta.color }}>
                                  {pct !== null ? `${formatIndonesianNumber(pct, 2)}%` : '-'}
                                </strong>
                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: meta.color }}>
                                  {meta.label}
                                </div>
                              </td>
                              <td style={{ padding: '0.65rem 0.8rem', color: '#334155' }}>{val.notes || '-'}</td>
                              <td style={{ padding: '0.65rem 0.8rem' }}>
                                {val.evidence && /^https:\/\//i.test(val.evidence) ? (
                                  <a
                                    href={val.evidence}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      color: '#094E68',
                                      fontWeight: 700,
                                      minHeight: '44px',
                                    }}
                                  >
                                    <ExternalLink size={13} />
                                    <span>Buka Evidence ({val.verification || 'PENDING'})</span>
                                  </a>
                                ) : (
                                  <span style={{ color: '#64748B' }}>Belum dilampirkan</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </HorizontalTableViewport>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {previewEvidence && (
        <EvidencePreviewModal
          evidence={previewEvidence}
          onClose={() => setPreviewEvidence(null)}
          adminActions={null}
        />
      )}
    </section>
  );
}
