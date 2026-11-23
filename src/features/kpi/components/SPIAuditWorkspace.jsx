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
  ensureDefaultKpiDistribution,
  evaluateRenbangValidationStatus,
  getFormForPeriod,
  readIntegratedKpiBoard,
  readKpiWorkflow,
  subscribeKpiWorkflow,
  subscribeSpiAudit,
} from '../kpiWorkflowStore';
import KPIDataEntrySheet, { EvidencePreviewModal } from './KPIDataEntrySheet';

const SOLID_GREEN_BADGE = {
  background: '#15803D',
  color: '#FFFFFF',
  border: '1.5px solid #14532D',
  fontWeight: 700,
  letterSpacing: '0.02em',
};

const SOLID_RED_BADGE = {
  background: '#B91C1C',
  color: '#FFFFFF',
  border: '1.5px solid #7F1D1D',
  fontWeight: 700,
  letterSpacing: '0.02em',
};

function fmtNum(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function escapeHtml(value, isExcel = false) {
  const raw = String(value ?? '');
  const safe = isExcel && /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw;
  return safe
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
  const [previewEvidence, setPreviewEvidence] = useState(null);
  const [displayFormat, setDisplayFormat] = useState('RINGKAS');

  const activeSpiTab = searchParams.get('spiView') === 'spi-form' ? 'spi-form' : 'audit-table';

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
        });
      });
    });
    return rows;
  }, [periodForm, isAuditUnlocked, integratedBoard]);

  const availablePics = useMemo(() => {
    const set = new Set();
    allAuditRows.forEach((r) => r.pics.forEach((p) => set.add(p)));
    return [...set].sort();
  }, [allAuditRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allAuditRows.filter((row) => {
      if (picFilter !== 'ALL' && !row.pics.includes(picFilter)) return false;
      if (!q) return true;
      return (
        row.codeLabel.toLowerCase().includes(q)
        || String(row.item.indikator || '').toLowerCase().includes(q)
        || String(row.picDisplay || '').toLowerCase().includes(q)
        || String(row.unitNote || '').toLowerCase().includes(q)
      );
    });
  }, [allAuditRows, picFilter, searchQuery]);

  const switchSpiTab = (nextView) => {
    const next = new URLSearchParams(searchParams);
    next.set('spiView', nextView);
    setSearchParams(next, { replace: true });
  };

  const handlePrintValidatedReport = () => {
    if (!isAuditUnlocked) return;
    const rowsHtml = allAuditRows.map((row, idx) => {
      const ratioStr = row.computed.ratioPercent !== null ? `${fmtNum(row.computed.ratioPercent, 2)}%` : 'Belum Terisi';
      const scoreStr = row.computed.weightedScore !== null ? fmtNum(row.computed.weightedScore, 2) : '-';
      const evNames = row.evidences.length > 0
        ? row.evidences.map((e) => `${escapeHtml(e.label)} (${e.kind === 'file' ? escapeHtml(e.fileName || 'Berkas') : 'Tautan HTTPS'})`).join('; ')
        : 'Tidak ada lampiran';
      return `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td><strong>${escapeHtml(row.codeLabel)}</strong><br/>${escapeHtml(row.item.indikator)}</td>
          <td style="text-align:center;"><strong>${escapeHtml(row.picDisplay)}</strong><br/><span style="font-size:10px;color:#475569;">${escapeHtml(row.contributor?.unit || 'Tervalidasi Renbang')}</span></td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;">${escapeHtml(row.item.bobotDisplay || row.item.bobot)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;">${ratioStr}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;">${scoreStr}</td>
          <td style="font-size:11px;">${evNames}</td>
          <td style="font-size:11px;">${escapeHtml(row.unitNote || '-')}</td>
        </tr>`;
    }).join('');

    const html = `<!doctype html>
      <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Laporan Evaluasi KPI Tervalidasi Renbang - Periode ${escapeHtml(period)}</title>
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
        <h1>LAPORAN HASIL AKHIR EVALUASI KPI TERVALIDASI 100% RENBANG (SALINAN AUDIT SPI)</h1>
        <div class="sub">Institut Teknologi Perusahaan Listrik Negara (ITPLN) · Periode Evaluasi ${escapeHtml(period)} · Status Validasi Renbang: 100% Tervalidasi Final</div>
        <div class="meta-box">
          <div><strong>Total Skor Akhir KPI Tervalidasi Renbang:</strong> ${fmtNum(integratedBoard.totalScore, 2)} &nbsp;|&nbsp; <strong>Indikator Terisi:</strong> ${integratedBoard.filledIndicatorCount}/${integratedBoard.totalIndicatorCount}</div>
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
              <th scope="col" style="width:210px;">Dokumen Pendukung Terlampir</th>
              <th scope="col" style="width:200px;">Keterangan Tervalidasi</th>
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
            PIC Bagian D.5 &amp; Pemeriksa Internal<br/><br/><br/>
            ( ${escapeHtml(user?.name || 'Auditor SPI ITPLN')} )
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
    const rowsHtml = allAuditRows.map((row, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(row.codeLabel, true)}</td>
        <td>${escapeHtml(row.item.indikator, true)}</td>
        <td>${escapeHtml(row.picDisplay, true)}</td>
        <td>${escapeHtml(row.contributor?.unit || '-', true)}</td>
        <td>${escapeHtml(row.item.bobotDisplay || row.item.bobot, true)}</td>
        <td>${row.computed.ratioPercent !== null ? fmtNum(row.computed.ratioPercent, 2) : '-'}</td>
        <td>${row.computed.weightedScore !== null ? fmtNum(row.computed.weightedScore, 2) : '-'}</td>
        <td>${row.evidences.length}</td>
        <td>${escapeHtml(row.evidences.map((e) => e.label).join('; ') || '-', true)}</td>
        <td>${escapeHtml(row.unitNote || '-', true)}</td>
      </tr>`).join('');

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
              <th scope="col">Keterangan Tervalidasi</th>
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
    a.download = `Laporan-Audit-KPI-SPI-ITPLN-Periode-${period}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  /**
   * Bagian Pengisian Khusus SPI yang tampil persis menggunakan tabel standar unit (KPIDataEntrySheet)
   * khusus untuk 1 indikator PIC SPI: Bagian D No. 5 (Tindaklanjut Rekomendasi Audit & Temuan).
   */
  const renderStandardUnitTableForSpi = (sectionTitle = 'Lembar Kerja Pengisian KPI Unit SPI (Khusus Bagian D No. 5)') => (
    <section
      aria-label={sectionTitle}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        minWidth: 0,
        width: '100%',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #D8E4EA',
          borderLeft: '4px solid #094E68',
          borderRadius: '8px',
          padding: '0.9rem 1.15rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
            <span
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#094E68',
                letterSpacing: '0.04em',
              }}
            >
              LEMBAR KERJA PIC SPI · BAGIAN D (PERSPEKTIF KEPATUHAN) · BUTIR NO. 5
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.66rem',
                ...SOLID_GREEN_BADGE,
              }}
            >
              SAMA SEPERTI TABEL UNIT LAINNYA
            </span>
          </div>
          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#072534' }}>
            5. Tindaklanjut Rekomendasi Audit &amp; Temuan (SPI, PJM, KAP, WBS)
          </div>
          <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
            Isi angka pada kolom <strong>ISIAN</strong> (tersimpan otomatis sebagai <strong>Draft</strong> saat diketik), lampirkan bukti PDF/tautan, lalu klik <strong>Kirim Capaian Unit</strong> apabila sudah siap dikirim ke pusat.
          </div>
        </div>
      </div>

      <KPIDataEntrySheet
        period={period}
        spiUnitInputMode
      />
    </section>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', minWidth: 0, width: '100%' }}>
      {/* Bar Navigasi Atas Khusus SPI + Indikator Status Kunci/Terbuka */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #D8E4EA',
          borderRadius: '10px',
          padding: '0.9rem 1.15rem',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={() => switchSpiTab('audit-table')}
            style={{
              minHeight: '44px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: activeSpiTab === 'audit-table' ? '1.5px solid #094E68' : '1px solid #CBD5E1',
              background: activeSpiTab === 'audit-table' ? '#094E68' : '#FFFFFF',
              color: activeSpiTab === 'audit-table' ? '#FFFFFF' : '#072534',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {isAuditUnlocked ? <Unlock size={15} /> : <Lock size={15} />}
            <span>Tabel Audit KPI (Read-Only)</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '5px',
                fontSize: '0.68rem',
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
              minHeight: '44px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: activeSpiTab === 'spi-form' ? '1.5px solid #094E68' : '1px solid #CBD5E1',
              background: activeSpiTab === 'spi-form' ? '#094E68' : '#FFFFFF',
              color: activeSpiTab === 'spi-form' ? '#FFFFFF' : '#072534',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ClipboardCheck size={15} />
            <span>Lembar Kerja Input SPI (Bagian D.5)</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '5px',
                fontSize: '0.68rem',
                ...SOLID_GREEN_BADGE,
              }}
            >
              1 BUTIR PIC
            </span>
          </button>
        </div>

        {/* Status Badge Validasi Renbang & Periode */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.55rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              ...(isPeriodOpen ? SOLID_GREEN_BADGE : SOLID_RED_BADGE),
            }}
          >
            {isPeriodOpen ? <CheckCircle2 size={13} /> : <Lock size={13} />}
            <span>PERIODE {period}: {isPeriodOpen ? 'AKTIF (TERBUKA)' : 'TIDAK AKTIF (TERTUTUP)'}</span>
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.72rem',
              ...(isAuditUnlocked ? SOLID_GREEN_BADGE : SOLID_RED_BADGE),
            }}
          >
            {isAuditUnlocked ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
            <span>TABEL AUDIT: {isAuditUnlocked ? 'TERBUKA (VALIDASI 100%)' : 'AKSES MASIH TERTUTUP'}</span>
          </span>
        </div>
      </div>

      {/* Tab Menu Inputan Khusus SPI: Menampilkan Tabel Unit Standar KPIDataEntrySheet (Persis Seperti Unit Lain) */}
      {activeSpiTab === 'spi-form' && renderStandardUnitTableForSpi('Menu Inputan Khusus SPI (Bagian D No. 5)')}

      {activeSpiTab === 'audit-table' && (
        <>
          {!isAuditUnlocked ? (
            <section
              aria-label="Tabel Audit KPI Terkunci - Akses Masih Tertutup"
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #B91C1C',
                borderRadius: '10px',
                padding: 'clamp(1.1rem, 2.5vw, 1.5rem)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '10px',
                    background: '#B91C1C',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Lock size={24} />
                </div>

                <div style={{ flex: 1, minWidth: 'min(100%, 260px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '5px',
                        fontSize: '0.72rem',
                        ...SOLID_RED_BADGE,
                      }}
                    >
                      AKSES MASIH TERTUTUP
                    </span>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '5px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: '#FEF2F2',
                        color: '#991B1B',
                        border: '1px solid #FCA5A5',
                      }}
                    >
                      Menunggu Validasi Final 100% dari Pihak Renbang (PRP)
                    </span>
                  </div>

                  <h2 style={{ margin: '0.2rem 0 0.45rem', fontSize: '1.15rem', fontWeight: 700, color: '#072534' }}>
                    Akses masih tertutup · Tabel Audit KPI (Read-Only) Belum Dapat Dibuka
                  </h2>

                  <p style={{ margin: '0 0 0.9rem', fontSize: '0.84rem', color: '#334155', lineHeight: 1.6, maxWidth: '75ch' }}>
                    Selama pihak Renbang belum selesai memvalidasi seluruh data KPI unit, Tabel Audit KPI (Read-Only)
                    wajib dalam keadaan terkunci. SPI tidak diperbolehkan memantau data unit yang baru terisi sebagian.
                    Tabel audit akan <strong>terbuka otomatis</strong> segera setelah validasi Renbang mencapai <strong>100%</strong>.
                  </p>

                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '0.8rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>
                        Progres Validasi Akhir Renbang (Periode {period}): {renbangValidation.validatedUnits} dari {renbangValidation.totalUnits} Unit Tervalidasi Final
                      </span>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
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
                        height: '8px',
                        background: '#E2E8F0',
                        borderRadius: '999px',
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
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section
                aria-label="Kontrol Tampilan Tabel Audit Ringkas & Cetak Laporan Keseluruhan SPI"
                style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #15803D',
                  borderRadius: '10px',
                  padding: '1.1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.85rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '5px',
                          fontSize: '0.72rem',
                          ...SOLID_GREEN_BADGE,
                        }}
                      >
                        VALIDASI RENBANG 100% SELESAI · AKSES AUDIT SPI TERBUKA OTOMATIS
                      </span>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: '#EDF3F6',
                          color: '#094E68',
                          border: '1px solid #64748B',
                        }}
                      >
                        Tampilan Ringkas Khusus SPI (Read-Only)
                      </span>
                    </div>
                    <h2 style={{ margin: '0.2rem 0', fontSize: '1.08rem', fontWeight: 700, color: '#072534' }}>
                      Tabel Audit KPI (Read-Only) · Hasil Akhir Tervalidasi Renbang &amp; Dokumen Pendukung
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', maxWidth: '76ch' }}>
                      Kolom teknis/mentah milik Admin/Renbang telah disederhanakan. Tabel ini menampilkan hasil akhir KPI yang telah divalidasi Renbang beserta PIC dan dokumen pendukungnya.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setDisplayFormat('RINGKAS')}
                        style={{
                          minHeight: '44px',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '7px',
                          border: displayFormat === 'RINGKAS' ? '1.5px solid #094E68' : '1px solid #64748B',
                          background: displayFormat === 'RINGKAS' ? '#094E68' : '#FFFFFF',
                          color: displayFormat === 'RINGKAS' ? '#FFFFFF' : '#072534',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <FileCheck2 size={14} />
                        <span>Opsi 1: Tabel Ringkas Audit SPI</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDisplayFormat('CETAK_LAPORAN')}
                        style={{
                          minHeight: '44px',
                          padding: '0.45rem 0.9rem',
                          borderRadius: '7px',
                          border: displayFormat === 'CETAK_LAPORAN' ? '1.5px solid #094E68' : '1px solid #64748B',
                          background: displayFormat === 'CETAK_LAPORAN' ? '#094E68' : '#FFFFFF',
                          color: displayFormat === 'CETAK_LAPORAN' ? '#FFFFFF' : '#072534',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Printer size={14} />
                        <span>Opsi 2: Cetak Laporan Keseluruhan</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={handlePrintValidatedReport}
                        style={{
                          minHeight: '44px',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '7px',
                          border: '1px solid #094E68',
                          background: '#F8FAFC',
                          color: '#094E68',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <Printer size={14} />
                        <span>Cetak / Export PDF Laporan</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportExcelSpi}
                        style={{
                          minHeight: '44px',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '7px',
                          border: '1px solid #15803D',
                          background: '#15803D',
                          color: '#FFFFFF',
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <FileSpreadsheet size={14} />
                        <span>Unduh Excel Audit SPI (.xls)</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '0.85rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #E2E8F0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.6rem',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
                    <input
                      type="search"
                      aria-label="Cari indikator atau PIC pada tabel audit SPI"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari kode, indikator, atau PIC..."
                      style={{
                        minHeight: '44px',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '7px',
                        border: '1px solid #64748B',
                        fontSize: '0.78rem',
                        minWidth: 'min(100%, 230px)',
                      }}
                    />

                    <select
                      aria-label="Filter berdasarkan PIC terkait"
                      value={picFilter}
                      onChange={(e) => setPicFilter(e.target.value)}
                      style={{
                        minHeight: '44px',
                        padding: '0.4rem 0.7rem',
                        borderRadius: '7px',
                        border: '1px solid #64748B',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      <option value="ALL">Semua PIC ({availablePics.length})</option>
                      {availablePics.map((p) => (
                        <option key={p} value={p}>PIC: {p}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.78rem', fontWeight: 700, color: '#072534' }}>
                    <span>
                      Indikator Tervalidasi: <strong>{integratedBoard.filledIndicatorCount}/{integratedBoard.totalIndicatorCount}</strong>
                    </span>
                    <span
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        background: '#094E68',
                        color: '#FFFFFF',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      Total Skor Akhir Tervalidasi: {fmtNum(integratedBoard.totalScore, 2)}
                    </span>
                  </div>
                </div>
              </section>

              {displayFormat === 'RINGKAS' ? (
                /* OPSI 1: TABEL AUDIT RINGKAS SPI */
                <section
                  aria-label="Tabel Ringkas Audit KPI SPI (Read-Only)"
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #D8E4EA',
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: '#094E68', color: '#FFFFFF' }}>
                          <th scope="col" style={{ padding: '10px 12px', textAlign: 'center', width: 64 }}>Kode</th>
                          <th scope="col" style={{ padding: '10px 12px', textAlign: 'left', minWidth: 240 }}>
                            Indikator Kinerja Utama (KPI) &amp; Keterangan Tervalidasi
                          </th>
                          <th scope="col" style={{ padding: '10px 12px', textAlign: 'left', width: 170 }}>
                            PIC &amp; Unit Terkait
                          </th>
                          <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', width: 175 }}>
                            Hasil Akhir Tervalidasi Renbang
                          </th>
                          <th scope="col" style={{ padding: '10px 12px', textAlign: 'left', minWidth: 250 }}>
                            Dokumen Pendukung (Pratinjau &amp; Unduh Bukti)
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
                                  padding: '11px 12px',
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  color: '#072534',
                                  verticalAlign: 'top',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {row.codeLabel}
                              </td>

                              <td style={{ padding: '11px 12px', verticalAlign: 'top' }}>
                                <div style={{ fontWeight: 700, color: '#072534', lineHeight: 1.45 }}>
                                  {row.item.indikator}
                                </div>
                                <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: 4 }}>
                                  Bagian {row.sectionCode}: {row.sectionTitle} · Satuan: <strong>{row.item.satuan || '%'}</strong> · Bobot: <strong>{row.item.bobotDisplay || row.item.bobot}</strong>
                                </div>
                                {row.unitNote && (
                                  <div
                                    style={{
                                      marginTop: 6,
                                      padding: '5px 8px',
                                      borderRadius: 6,
                                      background: '#F8FAFC',
                                      border: '1px solid #E2E8F0',
                                      fontSize: '0.73rem',
                                      color: '#334155',
                                    }}
                                  >
                                    <strong>Keterangan Tervalidasi:</strong> {row.unitNote}
                                  </div>
                                )}
                              </td>

                              <td style={{ padding: '11px 12px', verticalAlign: 'top' }}>
                                <div
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: 5,
                                    background: '#EDF3F6',
                                    color: '#094E68',
                                    border: '1px solid #64748B',
                                    fontWeight: 700,
                                    fontSize: '0.73rem',
                                  }}
                                >
                                  PIC: {row.picDisplay}
                                </div>
                                <div style={{ fontSize: '0.73rem', color: '#334155', marginTop: 5, fontWeight: 600 }}>
                                  {row.contributor?.unit || 'Tervalidasi Renbang'}
                                </div>
                              </td>

                              <td
                                style={{
                                  padding: '11px 12px',
                                  textAlign: 'right',
                                  verticalAlign: 'top',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                <div style={{ fontSize: '0.7rem', color: '#475569' }}>Capaian Akhir:</div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#072534' }}>
                                  {ratioVal !== null ? `${fmtNum(ratioVal, 2)}%` : '-'}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 5 }}>Skor Akhir:</div>
                                <div
                                  style={{
                                    display: 'inline-block',
                                    marginTop: 2,
                                    padding: '2px 8px',
                                    borderRadius: 5,
                                    ...(row.isPenaltySection && scoreVal < 0 ? SOLID_RED_BADGE : SOLID_GREEN_BADGE),
                                    fontSize: '0.76rem',
                                  }}
                                >
                                  {scoreVal !== null ? fmtNum(scoreVal, 2) : '-'}
                                </div>
                              </td>

                              <td style={{ padding: '11px 12px', verticalAlign: 'top' }}>
                                {row.evidences.length === 0 ? (
                                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic' }}>
                                    Tidak ada dokumen bukti terlampir
                                  </span>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                    {row.evidences.map((ev) => (
                                      <div
                                        key={ev.id}
                                        style={{
                                          padding: '7px 9px',
                                          borderRadius: 7,
                                          border: '1px solid #CBD5E1',
                                          background: '#F8FAFC',
                                        }}
                                      >
                                        <div style={{ fontWeight: 600, fontSize: '0.76rem', color: '#072534', marginBottom: 4 }}>
                                          {ev.label}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                          <button
                                            type="button"
                                            onClick={() => setPreviewEvidence(ev)}
                                            style={{
                                              minHeight: '44px',
                                              padding: '4px 10px',
                                              borderRadius: 6,
                                              border: '1px solid #094E68',
                                              background: '#FFFFFF',
                                              color: '#094E68',
                                              fontSize: '0.73rem',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 5,
                                            }}
                                          >
                                            <Eye size={13} />
                                            <span>Pratinjau</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => triggerEvidenceDownload(ev)}
                                            style={{
                                              minHeight: '44px',
                                              padding: '4px 10px',
                                              borderRadius: 6,
                                              border: 'none',
                                              background: '#094E68',
                                              color: '#FFFFFF',
                                              fontSize: '0.73rem',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 5,
                                            }}
                                          >
                                            {ev.kind === 'file' ? <Download size={13} /> : <ExternalLink size={13} />}
                                            <span>{ev.kind === 'file' ? 'Unduh Dokumen' : 'Buka Tautan'}</span>
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {filteredRows.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: '2rem 1rem', textAlign: 'center', color: '#475569' }}>
                              <div style={{ marginBottom: '0.65rem', fontWeight: 600 }}>
                                Tidak ada baris indikator KPI yang sesuai dengan kata kunci pencarian atau filter PIC.
                              </div>
                              {(searchQuery || picFilter !== 'ALL') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery('');
                                    setPicFilter('ALL');
                                  }}
                                  style={{
                                    minHeight: '44px',
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: '6px',
                                    border: '1px solid #094E68',
                                    background: '#FFFFFF',
                                    color: '#094E68',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Reset Pencarian &amp; Filter PIC
                                </button>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <section
                  aria-label="Cetak Laporan Keseluruhan KPI Tervalidasi Renbang"
                  style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #094E68',
                    borderRadius: '10px',
                    padding: 'clamp(1rem, 2.5vw, 1.4rem)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '0.85rem',
                      borderBottom: '1.5px solid #094E68',
                      paddingBottom: '0.85rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803D', letterSpacing: '0.03em' }}>
                        DOKUMEN RESMI LAPORAN EVALUASI KINERJA TERVALIDASI 100% RENBANG
                      </div>
                      <h3 style={{ margin: '4px 0', fontSize: '1.08rem', fontWeight: 700, color: '#072534' }}>
                        LAPORAN KESELURUHAN HASIL AKHIR KPI TERVALIDASI · PERIODE {period}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={handlePrintValidatedReport}
                      style={{
                        minHeight: '44px',
                        padding: '0.45rem 0.95rem',
                        borderRadius: '7px',
                        border: 'none',
                        background: '#094E68',
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                      }}
                    >
                      <Printer size={15} />
                      <span>Cetak Laporan Keseluruhan (PDF / Printer)</span>
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#094E68', color: '#FFFFFF' }}>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'center', width: 54 }}>Kode</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left' }}>Indikator KPI</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left', width: 130 }}>PIC</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'right', width: 70 }}>Bobot</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'right', width: 100 }}>Capaian (%)</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'right', width: 95 }}>Skor Akhir</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left', width: 220 }}>Bukti Pendukung</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left', width: 200 }}>Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => (
                          <tr key={row.item.id} style={{ borderBottom: '1px solid #CBD5E1' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{row.codeLabel}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.item.indikator}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.picDisplay}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {row.item.bobotDisplay || row.item.bobot}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {row.computed.ratioPercent !== null ? `${fmtNum(row.computed.ratioPercent, 2)}%` : '-'}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
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
                                      minHeight: '44px',
                                      marginRight: 4,
                                      marginBottom: 4,
                                      padding: '3px 8px',
                                      borderRadius: 5,
                                      border: '1px solid #094E68',
                                      background: '#F8FAFC',
                                      color: '#094E68',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Download size={11} />
                                    <span>{ev.label}</span>
                                  </button>
                                ))
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: '0.74rem', color: '#334155' }}>
                              {row.unitNote || '-'}
                            </td>
                          </tr>
                        ))}
                        {filteredRows.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: '2rem 1rem', textAlign: 'center', color: '#475569' }}>
                              <div style={{ marginBottom: '0.65rem', fontWeight: 600 }}>
                                Tidak ada baris indikator KPI yang sesuai dengan kata kunci pencarian atau filter PIC.
                              </div>
                              {(searchQuery || picFilter !== 'ALL') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSearchQuery('');
                                    setPicFilter('ALL');
                                  }}
                                  style={{
                                    minHeight: '44px',
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: '6px',
                                    border: '1px solid #094E68',
                                    background: '#FFFFFF',
                                    color: '#094E68',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Reset Pencarian &amp; Filter PIC
                                </button>
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {renderStandardUnitTableForSpi('Form Pengisian Khusus SPI di Bawah Tabel Audit Read-Only (Bagian D No. 5)')}
        </>
      )}

      {previewEvidence && (
        <EvidencePreviewModal
          evidence={previewEvidence}
          onClose={() => setPreviewEvidence(null)}
        />
      )}
    </div>
  );
}
