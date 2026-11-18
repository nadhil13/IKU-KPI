import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Lock,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { computeKpiItem, normalizeKpiSections, readPublishedKpiConfig } from '../kpiSchema';
import { KPI_SECTIONS_CONFIG } from '../kpiTemplateConfig';
import {
  SPI_FOLLOWUP_STATUSES,
  SPI_VERIFICATION_STATUSES,
  ensureDefaultKpiDistribution,
  evaluateRenbangValidationStatus,
  getFormForPeriod,
  readIntegratedKpiBoard,
  readKpiWorkflow,
  readSpiAuditForForm,
  saveSpiAuditHeader,
  saveSpiIndicatorAudit,
  subscribeKpiWorkflow,
  subscribeSpiAudit,
} from '../kpiWorkflowStore';
import { EvidencePreviewModal } from './KPIDataEntrySheet';

const SOLID_GREEN_BADGE = {
  background: '#15803D',
  color: '#FFFFFF',
  border: '1.5px solid #14532D',
  fontWeight: 800,
  letterSpacing: '0.02em',
  boxShadow: '0 1px 3px rgba(21, 128, 61, 0.28)',
};

const SOLID_RED_BADGE = {
  background: '#B91C1C',
  color: '#FFFFFF',
  border: '1.5px solid #7F1D1D',
  fontWeight: 800,
  letterSpacing: '0.02em',
  boxShadow: '0 1px 3px rgba(185, 28, 28, 0.28)',
};

const SPI_STATUS_META = {
  BELUM_DIPERIKSA: {
    label: 'Belum Diperiksa SPI',
    bg: '#F1F5F9',
    color: '#334155',
    border: '#CBD5E1',
  },
  SESUAI_BUKTI: {
    label: 'Sesuai Dokumen Bukti',
    bg: '#15803D',
    color: '#FFFFFF',
    border: '#14532D',
  },
  PERLU_KLARIFIKASI: {
    label: 'Perlu Klarifikasi Unit/PIC',
    bg: '#B45309',
    color: '#FFFFFF',
    border: '#78350F',
  },
  TEMUAN_AUDIT: {
    label: 'Temuan Audit SPI',
    bg: '#B91C1C',
    color: '#FFFFFF',
    border: '#7F1D1D',
  },
};

const FOLLOWUP_META = {
  OPEN: { label: 'Open (Belum Ditindaklanjuti)', bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5' },
  ON_PROGRESS: { label: 'On Progress (Dalam Tindak Lanjut)', bg: '#FFFBEB', color: '#92400E', border: '#FCD34D' },
  CLOSED: { label: 'Closed (Selesai Ditindaklanjuti)', bg: '#DCFCE7', color: '#14532D', border: '#86EFAC' },
};

function fmtNum(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  if (ev.url) {
    window.open(ev.url, '_blank', 'noopener,noreferrer');
  }
}

export default function SPIAuditWorkspace({ period = '2026', isPeriodOpen = true }) {
  const { currentUser: user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [picFilter, setPicFilter] = useState('ALL');
  const [spiStatusFilter, setSpiStatusFilter] = useState('ALL');
  const [previewEvidence, setPreviewEvidence] = useState(null);
  const [lastSavedToast, setLastSavedToast] = useState('');

  const activeSpiTab = searchParams.get('spiView') === 'spi-form' ? 'spi-form' : 'audit-table';
  const [displayFormat, setDisplayFormat] = useState('RINGKAS');

  useEffect(() => {
    const sections = readPublishedKpiConfig()?.sections || normalizeKpiSections(KPI_SECTIONS_CONFIG);
    ensureDefaultKpiDistribution(sections, String(period || '2026'), { silent: true });
    const unsubWorkflow = subscribeKpiWorkflow(() => setTick((t) => t + 1));
    const unsubSpi = subscribeSpiAudit(() => setTick((t) => t + 1));
    return () => {
      unsubWorkflow();
      unsubSpi();
    };
  }, [period]);

  const workflow = readKpiWorkflow();
  const periodForm = getFormForPeriod(period, workflow, { fallbackToLatest: true })
    || workflow.forms[workflow.forms.length - 1]
    || null;

  const renbangValidation = useMemo(
    () => evaluateRenbangValidationStatus(periodForm?.id || period, workflow),
    [periodForm?.id, period, workflow],
  );

  const isAuditUnlocked = Boolean(renbangValidation.isValidated100);

  const integratedBoard = useMemo(() => {
    if (!periodForm || !isAuditUnlocked) {
      return {
        form: periodForm,
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
    return readIntegratedKpiBoard(periodForm.id, workflow, {
      confirmedOnly: !periodForm.renbangValidatedFinal,
    });
  }, [periodForm, isAuditUnlocked, workflow]);

  const spiAudit = useMemo(
    () => readSpiAuditForForm(periodForm?.id || period, workflow),
    [periodForm?.id, period, workflow],
  );

  const allAuditRows = useMemo(() => {
    const sections = periodForm?.sections || readPublishedKpiConfig()?.sections || normalizeKpiSections(KPI_SECTIONS_CONFIG);
    const rows = [];
    sections.forEach((sec) => {
      (sec.items || []).forEach((item) => {
        const computed = isAuditUnlocked
          ? computeKpiItem(item, integratedBoard.values, sec.isPenaltySection, sections)
          : { ratioPercent: null, weightedScore: null, parsedSubs: [] };
        const evidences = isAuditUnlocked ? (integratedBoard.evidenceByItem?.[item.id] || []) : [];
        const contributor = isAuditUnlocked ? (integratedBoard.contributorsByItem?.[item.id] || null) : null;
        const unitNote = isAuditUnlocked ? (integratedBoard.notes?.[item.id] || '') : '';
        const spiItem = spiAudit.items?.[item.id] || {
          indicatorId: item.id,
          verificationStatus: 'BELUM_DIPERIKSA',
          auditNote: '',
          recommendation: '',
          followUpStatus: 'OPEN',
          evidenceChecked: false,
        };
        const pics = Array.isArray(item.pics) && item.pics.length > 0
          ? item.pics
          : String(item.picDisplay || 'PRP').split(',').map((s) => s.trim()).filter(Boolean);

        rows.push({
          sectionCode: sec.code,
          sectionTitle: sec.title,
          isPenaltySection: Boolean(sec.isPenaltySection),
          item,
          codeLabel: `${sec.code}.${item.no}`,
          pics,
          picDisplay: item.picDisplay || pics.join(', ') || 'PRP',
          computed,
          evidences,
          contributor,
          unitNote,
          spiItem,
        });
      });
    });
    return rows;
  }, [periodForm, isAuditUnlocked, integratedBoard, spiAudit]);

  const availablePics = useMemo(() => {
    const set = new Set();
    allAuditRows.forEach((r) => r.pics.forEach((p) => set.add(p)));
    return [...set].sort();
  }, [allAuditRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allAuditRows.filter((row) => {
      if (picFilter !== 'ALL' && !row.pics.includes(picFilter)) return false;
      if (spiStatusFilter !== 'ALL' && row.spiItem.verificationStatus !== spiStatusFilter) return false;
      if (!q) return true;
      return (
        row.codeLabel.toLowerCase().includes(q)
        || String(row.item.indikator || '').toLowerCase().includes(q)
        || String(row.picDisplay || '').toLowerCase().includes(q)
        || String(row.spiItem.auditNote || '').toLowerCase().includes(q)
      );
    });
  }, [allAuditRows, picFilter, spiStatusFilter, searchQuery]);

  const spiAuditMetrics = useMemo(() => {
    let checkedCount = 0;
    let sesuaiCount = 0;
    let klarifikasiCount = 0;
    let temuanCount = 0;
    allAuditRows.forEach(({ spiItem }) => {
      if (spiItem.verificationStatus !== 'BELUM_DIPERIKSA' || String(spiItem.auditNote || '').trim() !== '') {
        checkedCount += 1;
      }
      if (spiItem.verificationStatus === 'SESUAI_BUKTI') sesuaiCount += 1;
      if (spiItem.verificationStatus === 'PERLU_KLARIFIKASI') klarifikasiCount += 1;
      if (spiItem.verificationStatus === 'TEMUAN_AUDIT') temuanCount += 1;
    });
    return {
      totalIndicators: allAuditRows.length,
      checkedCount,
      sesuaiCount,
      klarifikasiCount,
      temuanCount,
    };
  }, [allAuditRows]);

  const switchSpiTab = (nextView) => {
    const next = new URLSearchParams(searchParams);
    next.set('spiView', nextView);
    setSearchParams(next, { replace: true });
  };

  const handleHeaderChange = (field, value) => {
    if (!user || user.role !== 'spi') return;
    const saved = saveSpiAuditHeader(periodForm?.id || period, user, { [field]: value });
    setLastSavedToast(`Tersimpan otomatis ke database · ${new Date(saved.updatedAt).toLocaleTimeString('id-ID')}`);
    setTick((t) => t + 1);
  };

  const handleItemAuditChange = (indicatorId, patch) => {
    if (!user || user.role !== 'spi') return;
    const saved = saveSpiIndicatorAudit(periodForm?.id || period, user, indicatorId, patch);
    setLastSavedToast(`Catatan SPI indikator disimpan real-time · ${new Date(saved.updatedAt).toLocaleTimeString('id-ID')}`);
    setTick((t) => t + 1);
  };

  const handlePrintValidatedReport = () => {
    if (!isAuditUnlocked) return;
    const rowsHtml = allAuditRows.map((row, idx) => {
      const ratioStr = row.computed.ratioPercent !== null ? `${fmtNum(row.computed.ratioPercent, 2)}%` : 'Belum Terisi';
      const scoreStr = row.computed.weightedScore !== null ? fmtNum(row.computed.weightedScore, 2) : '-';
      const evNames = row.evidences.length > 0
        ? row.evidences.map((e) => `${escapeHtml(e.label)} (${e.kind === 'file' ? escapeHtml(e.fileName || 'Berkas') : 'Tautan HTTPS'})`).join('; ')
        : 'Tidak ada lampiran';
      const spiMeta = SPI_STATUS_META[row.spiItem.verificationStatus] || SPI_STATUS_META.BELUM_DIPERIKSA;
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>${escapeHtml(row.codeLabel)}</strong><br/>${escapeHtml(row.item.indikator)}</td>
          <td style="text-align:center;"><strong>${escapeHtml(row.picDisplay)}</strong><br/><span style="font-size:10px;color:#475569;">${escapeHtml(row.contributor?.unit || 'Tervalidasi Renbang')}</span></td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(row.item.bobot)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;">${ratioStr}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:800;">${scoreStr}</td>
          <td style="font-size:11px;">${evNames}</td>
          <td style="font-size:11px;"><strong>${escapeHtml(spiMeta.label)}</strong>${row.spiItem.auditNote ? `<br/>${escapeHtml(row.spiItem.auditNote)}` : ''}</td>
        </tr>`;
    }).join('');

    const html = `<!doctype html>
      <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Laporan Audit KPI Tervalidasi Renbang - Periode ${escapeHtml(period)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
          h1 { font-size: 18px; margin: 0 0 4px; color: #0c2340; }
          .sub { font-size: 12px; color: #475569; margin-bottom: 14px; }
          .meta-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 16px; background: #f8fafc; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
          th, td { border: 1px solid #94a3b8; padding: 7px 8px; vertical-align: top; }
          th { background: #0c2340; color: #ffffff; text-align: left; }
          .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 28px; font-size: 12px; }
          @media print { @page { size: landscape; margin: 12mm; } }
        </style>
      </head>
      <body>
        <h1>LAPORAN HASIL AKHIR EVALUASI KPI TERVALIDASI RENBANG &amp; CATATAN AUDIT SPI</h1>
        <div class="sub">Institut Teknologi Perusahaan Listrik Negara (ITPLN) · Periode Evaluasi ${escapeHtml(period)} · Status Validasi Renbang: 100% Tervalidasi Final</div>
        <div class="meta-box">
          <div><strong>Nomor Dokumen Audit SPI:</strong> ${escapeHtml(spiAudit.header.auditDocNumber || '-')} &nbsp;|&nbsp; <strong>Tanggal Audit:</strong> ${escapeHtml(spiAudit.header.auditDate || new Date().toISOString().slice(0, 10))}</div>
          <div style="margin-top:4px;"><strong>Auditor SPI:</strong> ${escapeHtml(spiAudit.header.auditorName || user?.name || 'SPI ITPLN')} &nbsp;|&nbsp; <strong>Total Skor Akhir KPI Tervalidasi:</strong> ${fmtNum(integratedBoard.totalScore, 2)}</div>
          <div style="margin-top:4px;"><strong>Ringkasan Hasil Pemeriksaan SPI:</strong> ${escapeHtml(spiAudit.header.generalSummary || '-')}</div>
          <div style="margin-top:4px;"><strong>Rekomendasi &amp; Tindak Lanjut SPI:</strong> ${escapeHtml(spiAudit.header.followUpSummary || '-')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th scope="col" style="width:36px;">No</th>
              <th scope="col">Indikator Kinerja Utama / KPI</th>
              <th scope="col" style="width:120px;">PIC Terkait</th>
              <th scope="col" style="width:60px;">Bobot</th>
              <th scope="col" style="width:90px;">Capaian (%)</th>
              <th scope="col" style="width:85px;">Skor Akhir</th>
              <th scope="col" style="width:190px;">Dokumen Pendukung Terlampir</th>
              <th scope="col" style="width:220px;">Status &amp; Catatan Audit SPI</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="sig-grid">
          <div>
            <strong>Divisi Perencanaan &amp; Pengembangan (Renbang / PRP)</strong><br/>
            Status Validasi: 100% Tervalidasi Final<br/><br/><br/>
            ( ${escapeHtml(renbangValidation.renbangValidatedBy || 'Direktur / Admin PRP ITPLN')} )
          </div>
          <div>
            <strong>Satuan Pengawasan Internal (SPI) ITPLN</strong><br/>
            Pemeriksa / Auditor Internal<br/><br/><br/>
            ( ${escapeHtml(spiAudit.header.auditorName || user?.name || 'Auditor SPI ITPLN')} )
          </div>
        </div>
      </body>
      </html>`;

    const win = window.open('', '_blank', 'width=1180,height=820');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 250);
    }
  };

  const handleExportExcelSpi = () => {
    if (!isAuditUnlocked) return;
    const rowsHtml = allAuditRows.map((row, idx) => {
      const spiMeta = SPI_STATUS_META[row.spiItem.verificationStatus] || SPI_STATUS_META.BELUM_DIPERIKSA;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(row.codeLabel)}</td>
          <td>${escapeHtml(row.item.indikator)}</td>
          <td>${escapeHtml(row.picDisplay)}</td>
          <td>${escapeHtml(row.contributor?.unit || '-')}</td>
          <td>${escapeHtml(row.item.bobot)}</td>
          <td>${row.computed.ratioPercent !== null ? fmtNum(row.computed.ratioPercent, 2) : '-'}</td>
          <td>${row.computed.weightedScore !== null ? fmtNum(row.computed.weightedScore, 2) : '-'}</td>
          <td>${row.evidences.length}</td>
          <td>${escapeHtml(row.evidences.map((e) => e.label).join('; ') || '-')}</td>
          <td>${escapeHtml(spiMeta.label)}</td>
          <td>${escapeHtml(row.spiItem.auditNote || '-')}</td>
          <td>${escapeHtml(row.spiItem.recommendation || '-')}</td>
          <td>${escapeHtml(row.spiItem.followUpStatus || 'OPEN')}</td>
        </tr>`;
    }).join('');

    const excelDoc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8" /></head>
      <body>
        <table border="1">
          <thead>
            <tr style="background:#0c2340;color:#ffffff;font-weight:bold;">
              <th scope="col">No</th>
              <th scope="col">Kode</th>
              <th scope="col">Indikator KPI</th>
              <th scope="col">PIC</th>
              <th scope="col">Unit Pengisi</th>
              <th scope="col">Bobot</th>
              <th scope="col">Hasil Akhir Capaian (%)</th>
              <th scope="col">Skor Akhir Tervalidasi</th>
              <th scope="col">Jumlah Bukti</th>
              <th scope="col">Daftar Dokumen Pendukung</th>
              <th scope="col">Status Verifikasi SPI</th>
              <th scope="col">Catatan Audit SPI</th>
              <th scope="col">Rekomendasi SPI</th>
              <th scope="col">Status Tindak Lanjut</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>`;

    const blob = new Blob([excelDoc], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Audit-SPI-KPI-ITPLN-Periode-${period}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const renderSpiDedicatedInputForm = (placementLabel = 'Menu Inputan Khusus SPI') => (
    <section
      aria-label={placementLabel}
      style={{
        background: '#FFFFFF',
        border: '1.5px solid #0C2340',
        borderRadius: 12,
        padding: '20px 22px',
        boxShadow: '0 4px 14px rgba(12, 35, 64, 0.06)',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid #E2E8F0',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: '#0C2340',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              <ClipboardCheck size={13} /> FORM INPUTAN KHUSUS SPI (REAL-TIME DATABASE)
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 6,
                ...SOLID_GREEN_BADGE,
                fontSize: 11,
              }}
            >
              <CheckCircle2 size={13} /> HAK INPUT EKSKLUSIF SPI · REAL-TIME AKTIF
            </span>
          </div>
          <h3 style={{ margin: '8px 0 4px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
            Lembar Kerja &amp; Berita Acara Pemeriksaan Satuan Pengawasan Internal (SPI) · Periode {period}
          </h3>
          <p style={{ margin: 0, fontSize: 12.5, color: '#475569', maxWidth: '72ch' }}>
            Bagian ini khusus diisi oleh akun SPI. Seluruh catatan audit, kesimpulan pemeriksaan bukti, dan rekomendasi
            tersimpan langsung ke database secara real-time tanpa mengubah nilai capaian unit maupun validasi Renbang.
          </p>
        </div>

        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 11.5,
            color: '#1E293B',
            fontWeight: 600,
          }}
        >
          <div>Status Sinkronisasi Database:</div>
          <div style={{ color: '#15803D', fontWeight: 800, marginTop: 2 }}>
            {lastSavedToast || (spiAudit.updatedAt
              ? `Tersimpan di Database · ${new Date(spiAudit.updatedAt).toLocaleString('id-ID')}`
              : 'Siap menyimpan otomatis setiap ketikan (Real-Time)')}
          </div>
        </div>
      </div>

      {/* Form Header Berita Acara SPI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div>
          <label
            htmlFor={`spi-doc-num-${placementLabel}`}
            style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 5 }}
          >
            Nomor Dokumen / Berita Acara Audit SPI
          </label>
          <input
            id={`spi-doc-num-${placementLabel}`}
            type="text"
            value={spiAudit.header.auditDocNumber || ''}
            onChange={(e) => handleHeaderChange('auditDocNumber', e.target.value)}
            placeholder="Contoh: BA-SPI/ITPLN/KPI/2026/01"
            style={{
              width: '100%',
              minHeight: 40,
              padding: '8px 11px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              color: '#0F172A',
            }}
          />
        </div>

        <div>
          <label
            htmlFor={`spi-audit-date-${placementLabel}`}
            style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 5 }}
          >
            Tanggal Pemeriksaan SPI
          </label>
          <input
            id={`spi-audit-date-${placementLabel}`}
            type="date"
            value={spiAudit.header.auditDate || ''}
            onChange={(e) => handleHeaderChange('auditDate', e.target.value)}
            style={{
              width: '100%',
              minHeight: 40,
              padding: '8px 11px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              color: '#0F172A',
            }}
          />
        </div>

        <div>
          <label
            htmlFor={`spi-auditor-name-${placementLabel}`}
            style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 5 }}
          >
            Nama Auditor / Tim Pemeriksa SPI
          </label>
          <input
            id={`spi-auditor-name-${placementLabel}`}
            type="text"
            value={spiAudit.header.auditorName || ''}
            onChange={(e) => handleHeaderChange('auditorName', e.target.value)}
            placeholder="Nama Ketua / Anggota Tim Auditor SPI"
            style={{
              width: '100%',
              minHeight: 40,
              padding: '8px 11px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              color: '#0F172A',
            }}
          />
        </div>

        <div>
          <label
            htmlFor={`spi-overall-conclusion-${placementLabel}`}
            style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 5 }}
          >
            Opini / Kesimpulan Umum Audit SPI
          </label>
          <select
            id={`spi-overall-conclusion-${placementLabel}`}
            value={spiAudit.header.overallConclusion || 'SESUAI_BUKTI'}
            onChange={(e) => handleHeaderChange('overallConclusion', e.target.value)}
            style={{
              width: '100%',
              minHeight: 40,
              padding: '8px 11px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              fontWeight: 700,
              color: '#0F172A',
              background: '#FFFFFF',
            }}
          >
            {SPI_VERIFICATION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {SPI_STATUS_META[st]?.label || st}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        <div>
          <label
            htmlFor={`spi-general-summary-${placementLabel}`}
            style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 5 }}
          >
            Ringkasan Hasil Pemeriksaan Dokumen Pendukung &amp; Catatan Umum SPI
          </label>
          <textarea
            id={`spi-general-summary-${placementLabel}`}
            rows={3}
            value={spiAudit.header.generalSummary || ''}
            onChange={(e) => handleHeaderChange('generalSummary', e.target.value)}
            placeholder="Tuliskan ringkasan hasil pengecekan dokumen bukti KPI yang telah divalidasi Renbang..."
            style={{
              width: '100%',
              padding: '9px 11px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              color: '#0F172A',
              resize: 'vertical',
            }}
          />
        </div>

        <div>
          <label
            htmlFor={`spi-followup-summary-${placementLabel}`}
            style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 5 }}
          >
            Rekomendasi Audit SPI &amp; Catatan Tindak Lanjut
          </label>
          <textarea
            id={`spi-followup-summary-${placementLabel}`}
            rows={3}
            value={spiAudit.header.followUpSummary || ''}
            onChange={(e) => handleHeaderChange('followUpSummary', e.target.value)}
            placeholder="Tuliskan rekomendasi perbaikan atau tindak lanjut audit SPI..."
            style={{
              width: '100%',
              padding: '9px 11px',
              borderRadius: 8,
              border: '1px solid #CBD5E1',
              fontSize: 13,
              color: '#0F172A',
              resize: 'vertical',
            }}
          />
        </div>
      </div>

      {/* Ringkasan Cepat Progres Pengisian SPI */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#334155', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6 }}>
            Indikator Diperiksa SPI: <strong>{spiAuditMetrics.checkedCount} / {spiAuditMetrics.totalIndicators}</strong>
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#14532D', background: '#DCFCE7', padding: '4px 10px', borderRadius: 6 }}>
            Sesuai Bukti: <strong>{spiAuditMetrics.sesuaiCount}</strong>
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '4px 10px', borderRadius: 6 }}>
            Perlu Klarifikasi: <strong>{spiAuditMetrics.klarifikasiCount}</strong>
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', background: '#FEE2E2', padding: '4px 10px', borderRadius: 6 }}>
            Temuan Audit: <strong>{spiAuditMetrics.temuanCount}</strong>
          </span>
        </div>
        <span style={{ fontSize: 11.5, color: '#475569' }}>
          Diisi eksklusif oleh: <strong>{user?.name || 'Auditor SPI'} ({user?.email || 'spi@itpln.ac.id'})</strong>
        </span>
      </div>
    </section>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Bar Navigasi Atas Khusus SPI + Indikator Status Kunci/Terbuka */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: 12,
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => switchSpiTab('audit-table')}
            style={{
              minHeight: 42,
              padding: '9px 16px',
              borderRadius: 8,
              border: activeSpiTab === 'audit-table' ? '2px solid #0C2340' : '1px solid #CBD5E1',
              background: activeSpiTab === 'audit-table' ? '#0C2340' : '#F8FAFC',
              color: activeSpiTab === 'audit-table' ? '#FFFFFF' : '#1E293B',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {isAuditUnlocked ? <Unlock size={15} /> : <Lock size={15} />}
            <span>Tabel Audit KPI (Read-Only)</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 10.5,
                ...(isAuditUnlocked ? SOLID_GREEN_BADGE : SOLID_RED_BADGE),
              }}
            >
              {isAuditUnlocked ? 'TERBUKA (100%)' : 'TERKUNCI'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchSpiTab('spi-form')}
            style={{
              minHeight: 42,
              padding: '9px 16px',
              borderRadius: 8,
              border: activeSpiTab === 'spi-form' ? '2px solid #0C2340' : '1px solid #CBD5E1',
              background: activeSpiTab === 'spi-form' ? '#0C2340' : '#F8FAFC',
              color: activeSpiTab === 'spi-form' ? '#FFFFFF' : '#1E293B',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ClipboardCheck size={15} />
            <span>Form Inputan Khusus SPI (Real-Time)</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 10.5,
                ...SOLID_GREEN_BADGE,
              }}
            >
              AKTIF
            </span>
          </button>
        </div>

        {/* Status Badge Validasi Renbang & Periode */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              ...(isPeriodOpen ? SOLID_GREEN_BADGE : SOLID_RED_BADGE),
            }}
          >
            {isPeriodOpen ? <CheckCircle2 size={14} /> : <Lock size={14} />}
            PERIODE {period}: {isPeriodOpen ? 'AKTIF (TERBUKA)' : 'TIDAK AKTIF (TERTUTUP)'}
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              ...(isAuditUnlocked ? SOLID_GREEN_BADGE : SOLID_RED_BADGE),
            }}
          >
            {isAuditUnlocked ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            STATUS TABEL AUDIT SPI: {isAuditUnlocked ? 'TERBUKA (VALIDASI RENBANG 100%)' : 'AKSES MASIH TERTUTUP'}
          </span>
        </div>
      </div>

      {/* Jika pengguna memilih Tab Menu Inputan Khusus SPI di Bagian Atas */}
      {activeSpiTab === 'spi-form' && (
        <>
          {renderSpiDedicatedInputForm('Menu Inputan Khusus SPI (Bagian Atas)')}

          <section
            aria-label="Pengisian Catatan Audit Per Indikator oleh SPI"
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: 12,
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                  Daftar Pengisian Catatan &amp; Verifikasi Audit Khusus SPI per Indikator (Real-Time)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#475569' }}>
                  SPI hanya mengisi kolom status pemeriksaan SPI, catatan temuan/verifikasi, dan rekomendasi tindak lanjut di bawah ini.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="search"
                  aria-label="Cari indikator KPI pada form inputan SPI"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kode, indikator, atau PIC..."
                  style={{
                    minHeight: 38,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 12.5,
                  }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#0C2340', color: '#FFFFFF' }}>
                    <th scope="col" style={{ padding: '10px 12px', textAlign: 'left', width: 70 }}>Kode</th>
                    <th scope="col" style={{ padding: '10px 12px', textAlign: 'left', minWidth: 220 }}>Indikator KPI &amp; PIC</th>
                    <th scope="col" style={{ padding: '10px 12px', textAlign: 'left', width: 210 }}>Status Verifikasi Audit SPI</th>
                    <th scope="col" style={{ padding: '10px 12px', textAlign: 'left', minWidth: 240 }}>Catatan Pemeriksaan / Temuan SPI</th>
                    <th scope="col" style={{ padding: '10px 12px', textAlign: 'left', minWidth: 220 }}>Rekomendasi &amp; Tindak Lanjut SPI</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.item.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0C2340', verticalAlign: 'top' }}>
                        {row.codeLabel}
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{row.item.indikator}</div>
                        <div style={{ fontSize: 11.5, color: '#475569', marginTop: 4 }}>
                          PIC: <strong>{row.picDisplay}</strong> · Bobot: <strong>{row.item.bobot}</strong>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <select
                          aria-label={`Status verifikasi SPI untuk indikator ${row.codeLabel}`}
                          value={row.spiItem.verificationStatus || 'BELUM_DIPERIKSA'}
                          onChange={(e) => handleItemAuditChange(row.item.id, { verificationStatus: e.target.value })}
                          style={{
                            width: '100%',
                            minHeight: 38,
                            padding: '6px 8px',
                            borderRadius: 6,
                            border: '1px solid #CBD5E1',
                            fontSize: 12,
                            fontWeight: 700,
                            marginBottom: 6,
                          }}
                        >
                          {SPI_VERIFICATION_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {SPI_STATUS_META[st]?.label || st}
                            </option>
                          ))}
                        </select>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#334155', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(row.spiItem.evidenceChecked)}
                            onChange={(e) => handleItemAuditChange(row.item.id, { evidenceChecked: e.target.checked })}
                          />
                          Dokumen bukti telah dicek SPI
                        </label>
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <textarea
                          aria-label={`Catatan audit SPI untuk indikator ${row.codeLabel}`}
                          rows={2}
                          value={row.spiItem.auditNote || ''}
                          onChange={(e) => handleItemAuditChange(row.item.id, { auditNote: e.target.value })}
                          placeholder="Ketik catatan hasil audit SPI pada indikator ini (tersimpan otomatis)..."
                          style={{
                            width: '100%',
                            padding: '7px 9px',
                            borderRadius: 6,
                            border: '1px solid #CBD5E1',
                            fontSize: 12,
                            resize: 'vertical',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          aria-label={`Rekomendasi SPI untuk indikator ${row.codeLabel}`}
                          value={row.spiItem.recommendation || ''}
                          onChange={(e) => handleItemAuditChange(row.item.id, { recommendation: e.target.value })}
                          placeholder="Rekomendasi tindak lanjut..."
                          style={{
                            width: '100%',
                            minHeight: 36,
                            padding: '6px 9px',
                            borderRadius: 6,
                            border: '1px solid #CBD5E1',
                            fontSize: 12,
                            marginBottom: 6,
                          }}
                        />
                        <select
                          aria-label={`Status tindak lanjut SPI untuk indikator ${row.codeLabel}`}
                          value={row.spiItem.followUpStatus || 'OPEN'}
                          onChange={(e) => handleItemAuditChange(row.item.id, { followUpStatus: e.target.value })}
                          style={{
                            width: '100%',
                            minHeight: 34,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #CBD5E1',
                            fontSize: 11.5,
                            fontWeight: 700,
                          }}
                        >
                          {SPI_FOLLOWUP_STATUSES.map((fst) => (
                            <option key={fst} value={fst}>
                              {FOLLOWUP_META[fst]?.label || fst}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Jika pengguna berada di Tab Tabel Audit KPI (Read-Only) */}
      {activeSpiTab === 'audit-table' && (
        <>
          {!isAuditUnlocked ? (
            /* STATE TERKUNCI: VALIDASI RENBANG BELUM 100% ("Akses masih tertutup") */
            <section
              aria-label="Tabel Audit KPI Terkunci - Akses Masih Tertutup"
              style={{
                background: '#FFFFFF',
                border: '2px solid #B91C1C',
                borderRadius: 12,
                padding: '28px 26px',
                boxShadow: '0 6px 20px rgba(185, 28, 28, 0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 12,
                    background: '#B91C1C',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Lock size={28} />
                </div>

                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        ...SOLID_RED_BADGE,
                      }}
                    >
                      AKSES MASIH TERTUTUP
                    </span>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: '#FEF2F2',
                        color: '#991B1B',
                        border: '1px solid #FCA5A5',
                      }}
                    >
                      Menunggu Validasi Final 100% dari Pihak Renbang (PRP)
                    </span>
                  </div>

                  <h2 style={{ margin: '4px 0 8px', fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
                    Akses masih tertutup · Tabel Audit KPI (Read-Only) Belum Dapat Dibuka
                  </h2>

                  <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#334155', lineHeight: 1.6, maxWidth: '75ch' }}>
                    Sesuai kebijakan tata kelola Satuan Pengawasan Internal (SPI) ITPLN, akun SPI tidak diperbolehkan
                    memantau data unit yang baru terisi sebagian atau belum berstatus tervalidasi final oleh pihak
                    Renbang (Divisi Perencanaan &amp; Pengembangan / PRP). Menu tabel audit ini akan <strong>terbuka secara otomatis</strong> segera
                    setelah proses validasi seluruh data KPI dari Renbang selesai <strong>100%</strong>.
                  </p>

                  {/* Bar Progres Validasi Renbang (Tanpa Membocorkan Angka/Isian Unit yang Belum Final) */}
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: 10,
                      padding: '14px 16px',
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A' }}>
                        Progres Validasi Akhir Renbang (Periode {period}): {renbangValidation.validatedUnits} dari {renbangValidation.totalUnits} Unit Tervalidasi Final
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#B91C1C',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {renbangValidation.progressPercent}% (Belum Mencapai 100%)
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 10,
                        background: '#E2E8F0',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(4, renbangValidation.progressPercent)}%`,
                          height: '100%',
                          background: '#B91C1C',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
                      Masih terdapat <strong>{renbangValidation.pendingUnits} unit kerja PIC</strong> yang sedang dalam tahap pengisian atau verifikasi Renbang.
                      Data capaian dan dokumen bukti unit disembunyikan hingga validasi Renbang mencapai 100%.
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => switchSpiTab('spi-form')}
                      style={{
                        minHeight: 40,
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#0C2340',
                        color: '#FFFFFF',
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <ClipboardCheck size={15} />
                      Isi Berita Acara / Form Inputan Khusus SPI di Bagian Atas
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            /* STATE TERBUKA OTOMATIS: VALIDASI RENBANG 100% SELESAI */
            <>
              {/* Banner Status Validasi Final 100% & Konfirmasi Format Tampilan Bu Brita */}
              <section
                aria-label="Kontrol Tampilan Tabel Audit Ringkas & Cetak Laporan Keseluruhan SPI"
                style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #15803D',
                  borderRadius: 12,
                  padding: '18px 20px',
                  boxShadow: '0 4px 12px rgba(21, 128, 61, 0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          ...SOLID_GREEN_BADGE,
                        }}
                      >
                        VALIDASI RENBANG 100% SELESAI · AKSES AUDIT SPI TERBUKA OTOMATIS
                      </span>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: '#EFF6FF',
                          color: '#1E3A8A',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                         Tampilan Khusus SPI (Bukan Tabel Teknis Penuh Admin/Renbang)
                      </span>
                    </div>
                    <h2 style={{ margin: '4px 0', fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                      Pemeriksaan Dokumen Pendukung &amp; Hasil Akhir KPI Tervalidasi Renbang · Periode {period}
                    </h2>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#475569', maxWidth: '76ch' }}>
                      Kolom rumus teknis dan sub-baris input mentah milik Admin/Renbang telah disederhanakan.
                      SPI difokuskan pada pengecekan dokumen pendukung (bukti capaian), hasil akhir yang telah divalidasi Renbang beserta PIC terkait, serta pengisian kolom audit SPI secara real-time.
                    </p>
                  </div>

                  {/* Pengalih Mode: Tabel Ringkas vs Cetak Laporan Keseluruhan Tervalidasi */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayFormat('RINGKAS');
                          handleHeaderChange('preferredReportFormat', 'RINGKAS');
                        }}
                        style={{
                          minHeight: 40,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: displayFormat === 'RINGKAS' ? '2px solid #0C2340' : '1px solid #CBD5E1',
                          background: displayFormat === 'RINGKAS' ? '#0C2340' : '#FFFFFF',
                          color: displayFormat === 'RINGKAS' ? '#FFFFFF' : '#1E293B',
                          fontSize: 12.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <FileCheck2 size={15} />
                        Opsi 1: Tabel Ringkas Audit SPI (PIC, Hasil Akhir &amp; Unduh Dokumen)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDisplayFormat('CETAK_LAPORAN');
                          handleHeaderChange('preferredReportFormat', 'CETAK_LAPORAN');
                        }}
                        style={{
                          minHeight: 40,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: displayFormat === 'CETAK_LAPORAN' ? '2px solid #0C2340' : '1px solid #CBD5E1',
                          background: displayFormat === 'CETAK_LAPORAN' ? '#0C2340' : '#FFFFFF',
                          color: displayFormat === 'CETAK_LAPORAN' ? '#FFFFFF' : '#1E293B',
                          fontSize: 12.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Printer size={15} />
                        Opsi 2: Cetak Laporan Keseluruhan Tervalidasi
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        onClick={handlePrintValidatedReport}
                        style={{
                          minHeight: 38,
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid #0C2340',
                          background: '#F8FAFC',
                          color: '#0C2340',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Printer size={14} /> Cetak / Export PDF Laporan Keseluruhan
                      </button>

                      <button
                        type="button"
                        onClick={handleExportExcelSpi}
                        style={{
                          minHeight: 38,
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid #15803D',
                          background: '#F0FDF4',
                          color: '#14532D',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <FileSpreadsheet size={14} /> Unduh Excel Audit SPI (.xls)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter Bar untuk Tabel Ringkas SPI */}
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="search"
                        aria-label="Cari indikator atau PIC pada tabel audit SPI"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari indikator, PIC, atau catatan SPI..."
                        style={{
                          minHeight: 38,
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid #CBD5E1',
                          fontSize: 12.5,
                          minWidth: 240,
                        }}
                      />
                    </div>

                    <select
                      aria-label="Filter berdasarkan PIC terkait"
                      value={picFilter}
                      onChange={(e) => setPicFilter(e.target.value)}
                      style={{
                        minHeight: 38,
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        fontSize: 12.5,
                        fontWeight: 700,
                      }}
                    >
                      <option value="ALL">Semua PIC ({availablePics.length})</option>
                      {availablePics.map((p) => (
                        <option key={p} value={p}>PIC: {p}</option>
                      ))}
                    </select>

                    <select
                      aria-label="Filter berdasarkan status audit SPI"
                      value={spiStatusFilter}
                      onChange={(e) => setSpiStatusFilter(e.target.value)}
                      style={{
                        minHeight: 38,
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        fontSize: 12.5,
                        fontWeight: 700,
                      }}
                    >
                      <option value="ALL">Semua Status Pemeriksaan SPI</option>
                      {SPI_VERIFICATION_STATUSES.map((st) => (
                        <option key={st} value={st}>{SPI_STATUS_META[st]?.label || st}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12.5, fontWeight: 800, color: '#0C2340' }}>
                    <span>
                      Indikator Tervalidasi: <strong>{integratedBoard.filledIndicatorCount}/{integratedBoard.totalIndicatorCount}</strong>
                    </span>
                    <span
                      style={{
                        padding: '5px 12px',
                        borderRadius: 8,
                        background: '#0C2340',
                        color: '#FFFFFF',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Total Skor Akhir Tervalidasi Renbang: {fmtNum(integratedBoard.totalScore, 2)}
                    </span>
                  </div>
                </div>
              </section>

              {displayFormat === 'RINGKAS' ? (
                /* OPSI 1: TABEL AUDIT RINGKAS SPI (Disempurnakan khusus kebutuhan SPI) */
                <section
                  aria-label="Tabel Ringkas Audit KPI SPI (Read-Only Hasil Renbang + Kolom Audit SPI)"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: 12,
                    overflow: 'hidden',
                    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
                  }}
                >
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: '#0C2340', color: '#FFFFFF' }}>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'center', width: 58 }}>Kode</th>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'left', minWidth: 230 }}>
                            Indikator Kinerja Utama (KPI)
                          </th>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'left', width: 150 }}>
                            PIC &amp; Unit Terkait
                          </th>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'right', width: 165 }}>
                            Hasil Akhir Tervalidasi Renbang
                          </th>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'left', minWidth: 250 }}>
                            Dokumen Pendukung (Pratinjau &amp; Unduh Bukti)
                          </th>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'left', minWidth: 280, background: '#14532D' }}>
                            Kolom Pengisian Khusus SPI (Real-Time)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => {
                          const ratioVal = row.computed.ratioPercent;
                          const scoreVal = row.computed.weightedScore;
                          return (
                            <tr key={row.item.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                              <td
                                style={{
                                  padding: '12px',
                                  textAlign: 'center',
                                  fontWeight: 800,
                                  color: '#0C2340',
                                  verticalAlign: 'top',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {row.codeLabel}
                              </td>

                              <td style={{ padding: '12px', verticalAlign: 'top' }}>
                                <div style={{ fontWeight: 700, color: '#0F172A', lineHeight: 1.45 }}>
                                  {row.item.indikator}
                                </div>
                                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 4 }}>
                                  Bagian {row.sectionCode}: {row.sectionTitle} · Satuan: <strong>{row.item.satuan || '%'}</strong> · Bobot: <strong>{row.item.bobot}</strong>
                                </div>
                                {row.unitNote && (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      padding: '5px 8px',
                                      borderRadius: 6,
                                      background: '#F8FAFC',
                                      border: '1px solid #E2E8F0',
                                      fontSize: 11.5,
                                      color: '#334155',
                                    }}
                                  >
                                    <strong>Keterangan Tervalidasi:</strong> {row.unitNote}
                                  </div>
                                )}
                              </td>

                              <td style={{ padding: '12px', verticalAlign: 'top' }}>
                                <div
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    background: '#EFF6FF',
                                    color: '#1E3A8A',
                                    border: '1px solid #BFDBFE',
                                    fontWeight: 800,
                                    fontSize: 11.5,
                                  }}
                                >
                                  PIC: {row.picDisplay}
                                </div>
                                <div style={{ fontSize: 11.5, color: '#334155', marginTop: 6, fontWeight: 600 }}>
                                  {row.contributor?.unit || 'Tervalidasi Renbang'}
                                </div>
                                <div style={{ fontSize: 10.5, color: '#15803D', fontWeight: 800, marginTop: 2 }}>
                                  ✓ Tervalidasi Renbang
                                </div>
                              </td>

                              <td
                                style={{
                                  padding: '12px',
                                  textAlign: 'right',
                                  verticalAlign: 'top',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                <div style={{ fontSize: 11, color: '#475569' }}>Capaian Akhir:</div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                                  {ratioVal !== null ? `${fmtNum(ratioVal, 2)}%` : '-'}
                                </div>
                                <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>Skor Akhir Tertimbang:</div>
                                <div
                                  style={{
                                    display: 'inline-block',
                                    marginTop: 2,
                                    padding: '3px 9px',
                                    borderRadius: 6,
                                    ...SOLID_GREEN_BADGE,
                                    fontSize: 12.5,
                                  }}
                                >
                                  {scoreVal !== null ? fmtNum(scoreVal, 2) : '-'}
                                </div>
                              </td>

                              <td style={{ padding: '12px', verticalAlign: 'top' }}>
                                {row.evidences.length === 0 ? (
                                  <span style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>
                                    Tidak ada dokumen bukti terlampir
                                  </span>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {row.evidences.map((ev) => (
                                      <div
                                        key={ev.id}
                                        style={{
                                          padding: '8px 10px',
                                          borderRadius: 8,
                                          border: '1px solid #CBD5E1',
                                          background: '#F8FAFC',
                                        }}
                                      >
                                        <div style={{ fontWeight: 700, fontSize: 12, color: '#0F172A', marginBottom: 4 }}>
                                          {ev.label}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                          <button
                                            type="button"
                                            onClick={() => setPreviewEvidence(ev)}
                                            style={{
                                              minHeight: 32,
                                              padding: '4px 9px',
                                              borderRadius: 6,
                                              border: '1px solid #0C2340',
                                              background: '#FFFFFF',
                                              color: '#0C2340',
                                              fontSize: 11.5,
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 5,
                                            }}
                                          >
                                            <Eye size={13} /> Pratinjau
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => triggerEvidenceDownload(ev)}
                                            style={{
                                              minHeight: 32,
                                              padding: '4px 9px',
                                              borderRadius: 6,
                                              border: 'none',
                                              background: '#0C2340',
                                              color: '#FFFFFF',
                                              fontSize: 11.5,
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 5,
                                            }}
                                          >
                                            {ev.kind === 'file' ? <Download size={13} /> : <ExternalLink size={13} />}
                                            {ev.kind === 'file' ? 'Unduh Dokumen' : 'Buka Tautan'}
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>

                              {/* Kolom Khusus SPI (Real-Time Input) */}
                              <td style={{ padding: '12px', verticalAlign: 'top', background: '#F8FAFC' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <select
                                    aria-label={`Status audit SPI indikator ${row.codeLabel}`}
                                    value={row.spiItem.verificationStatus || 'BELUM_DIPERIKSA'}
                                    onChange={(e) => handleItemAuditChange(row.item.id, { verificationStatus: e.target.value })}
                                    style={{
                                      width: '100%',
                                      minHeight: 36,
                                      padding: '5px 8px',
                                      borderRadius: 6,
                                      border: '1px solid #94A3B8',
                                      fontSize: 12,
                                      fontWeight: 700,
                                      background: '#FFFFFF',
                                    }}
                                  >
                                    {SPI_VERIFICATION_STATUSES.map((st) => (
                                      <option key={st} value={st}>
                                        {SPI_STATUS_META[st]?.label || st}
                                      </option>
                                    ))}
                                  </select>

                                  <textarea
                                    aria-label={`Catatan audit SPI indikator ${row.codeLabel}`}
                                    rows={2}
                                    value={row.spiItem.auditNote || ''}
                                    onChange={(e) => handleItemAuditChange(row.item.id, { auditNote: e.target.value })}
                                    placeholder="Ketik catatan audit SPI (real-time)..."
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      borderRadius: 6,
                                      border: '1px solid #CBD5E1',
                                      fontSize: 12,
                                      background: '#FFFFFF',
                                      resize: 'vertical',
                                    }}
                                  />

                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#334155', cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(row.spiItem.evidenceChecked)}
                                        onChange={(e) => handleItemAuditChange(row.item.id, { evidenceChecked: e.target.checked })}
                                      />
                                      Bukti telah diperiksa SPI
                                    </label>
                                    {row.spiItem.updatedAt && (
                                      <span style={{ fontSize: 10.5, color: '#15803D', fontWeight: 700 }}>
                                        Tersimpan
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                /* OPSI 2: CETAK LAPORAN KESELURUHAN TERVALIDASI (Tampilan Lembar Laporan Eksekutif) */
                <section
                  aria-label="Cetak Laporan Keseluruhan KPI Tervalidasi Renbang"
                  style={{
                    background: '#FFFFFF',
                    border: '2px solid #0C2340',
                    borderRadius: 12,
                    padding: '24px',
                    boxShadow: '0 4px 16px rgba(12, 35, 64, 0.08)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 14,
                      borderBottom: '2px solid #0C2340',
                      paddingBottom: 14,
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#15803D', letterSpacing: '0.04em' }}>
                        DOKUMEN RESMI LAPORAN EVALUASI KINERJA TERVALIDASI 100% RENBANG
                      </div>
                      <h3 style={{ margin: '4px 0', fontSize: 18, fontWeight: 800, color: '#0C2340' }}>
                        LAPORAN KESELURUHAN HASIL AKHIR KPI &amp; PEMERIKSAAN SPI · PERIODE {period}
                      </h3>
                      <div style={{ fontSize: 12.5, color: '#475569' }}>
                        No. Berita Acara SPI: <strong>{spiAudit.header.auditDocNumber || 'Belum Diisi'}</strong> ·
                        Auditor: <strong>{spiAudit.header.auditorName || user?.name || 'SPI ITPLN'}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={handlePrintValidatedReport}
                        style={{
                          minHeight: 40,
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#0C2340',
                          color: '#FFFFFF',
                          fontSize: 12.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Printer size={15} /> Cetak Laporan Keseluruhan (PDF / Printer)
                      </button>
                    </div>
                  </div>

                  {/* Ringkasan Skor Per Bagian */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                      gap: 12,
                      marginBottom: 18,
                    }}
                  >
                    {(integratedBoard.sectionScores || []).map((sec) => (
                      <div
                        key={sec.code}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          border: '1px solid #CBD5E1',
                          background: '#F8FAFC',
                        }}
                      >
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                          Bagian {sec.code} · {sec.title}
                        </div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: sec.isPenaltySection ? '#B91C1C' : '#0C2340',
                            marginTop: 4,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {fmtNum(sec.score, 2)}
                        </div>
                      </div>
                    ))}
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        ...SOLID_GREEN_BADGE,
                      }}
                    >
                      <div style={{ fontSize: 11.5, opacity: 0.92 }}>TOTAL SKOR AKHIR TERVALIDASI</div>
                      <div style={{ fontSize: 20, fontWeight: 900, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(integratedBoard.totalScore, 2)}
                      </div>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#0C2340', color: '#FFFFFF' }}>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'center', width: 54 }}>Kode</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left' }}>Indikator KPI</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left', width: 130 }}>PIC</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'right', width: 70 }}>Bobot</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'right', width: 100 }}>Capaian (%)</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'right', width: 95 }}>Skor Akhir</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left', width: 200 }}>Bukti Pendukung</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left', width: 220 }}>Hasil Pemeriksaan SPI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => {
                          const spiMeta = SPI_STATUS_META[row.spiItem.verificationStatus] || SPI_STATUS_META.BELUM_DIPERIKSA;
                          return (
                            <tr key={row.item.id} style={{ borderBottom: '1px solid #CBD5E1' }}>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>{row.codeLabel}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.item.indikator}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700 }}>{row.picDisplay}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.item.bobot}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                {row.computed.ratioPercent !== null ? `${fmtNum(row.computed.ratioPercent, 2)}%` : '-'}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                                {row.computed.weightedScore !== null ? fmtNum(row.computed.weightedScore, 2) : '-'}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {row.evidences.length === 0 ? (
                                  <span>-</span>
                                ) : (
                                  row.evidences.map((ev) => (
                                    <button
                                      key={ev.id}
                                      type="button"
                                      onClick={() => triggerEvidenceDownload(ev)}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        marginRight: 4,
                                        marginBottom: 4,
                                        padding: '3px 7px',
                                        borderRadius: 4,
                                        border: '1px solid #0C2340',
                                        background: '#F8FAFC',
                                        color: '#0C2340',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Download size={11} /> {ev.label}
                                    </button>
                                  ))
                                )}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontWeight: 800, fontSize: 11.5 }}>{spiMeta.label}</div>
                                {row.spiItem.auditNote && (
                                  <div style={{ fontSize: 11.5, color: '#334155', marginTop: 2 }}>{row.spiItem.auditNote}</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Form Pengisian Khusus SPI di Bawah Tabel Read-Only */}
              {renderSpiDedicatedInputForm('Form Pengisian Khusus SPI di Bawah Tabel Read-Only')}
            </>
          )}
        </>
      )}

      {/* Modal Pratinjau Bukti (Read-Only untuk SPI) */}
      {previewEvidence && (
        <EvidencePreviewModal
          evidence={previewEvidence}
          onClose={() => setPreviewEvidence(null)}
        />
      )}
    </div>
  );
}
