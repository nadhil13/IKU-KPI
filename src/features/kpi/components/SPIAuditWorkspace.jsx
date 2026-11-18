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
  Link2,
  Lock,
  Plus,
  Printer,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { computeKpiItem, normalizeKpiSections, readPublishedKpiConfig } from '../kpiSchema';
import { KPI_SECTIONS_CONFIG } from '../kpiTemplateConfig';
import {
  ALLOWED_EVIDENCE_MIME_TYPES,
  MAX_EVIDENCE_FILE_BYTES,
  ensureDefaultKpiDistribution,
  evaluateRenbangValidationStatus,
  getFormForPeriod,
  readIntegratedKpiBoard,
  readKpiWorkflow,
  readSpiAuditForForm,
  saveSpiIndicatorAudit,
  submissionKey,
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
  const [previewEvidence, setPreviewEvidence] = useState(null);
  const [lastSavedToast, setLastSavedToast] = useState('');
  const [displayFormat, setDisplayFormat] = useState('RINGKAS');

  // State khusus penambahan bukti pada Bagian D.5 (Tindaklanjut Rekomendasi Audit & Temuan)
  const [evMode, setEvMode] = useState('link');
  const [evLabel, setEvLabel] = useState('');
  const [evUrl, setEvUrl] = useState('');
  const [evFileMeta, setEvFileMeta] = useState(null);
  const [evError, setEvError] = useState('');

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

  const spiAudit = useMemo(
    () => readSpiAuditForForm(periodForm?.id || period, workflow),
    [periodForm?.id, period, workflow],
  );

  // Resolusi Indikator Khusus SPI: Bagian D No. 5 - Tindaklanjut Rekomendasi Audit & Temuan (SPI, PJM, KAP, WBS)
  const d5Definition = useMemo(() => {
    const sections = periodForm?.sections || readPublishedKpiConfig()?.sections || normalizeKpiSections(KPI_SECTIONS_CONFIG);
    for (const sec of sections) {
      for (const item of sec.items || []) {
        if (
          item.id === 'D_5'
          || (sec.code === 'D' && String(item.no) === '5')
          || /tindak\s*lanjut\s+rekomendasi\s+audit/i.test(String(item.indikator || ''))
        ) {
          return { section: sec, item };
        }
      }
    }
    return {
      section: { code: 'D', title: 'PERSPEKTIF KEPATUHAN (COMPLIANCE)', isPenaltySection: true },
      item: {
        id: 'D_5',
        no: '5',
        indikator: 'Tindaklanjut Rekomendasi Audit & Temuan (SPI, PJM, KAP, WBS)',
        formula: 'Jumlah Rekomendasi Audit atau Temuan yg belum Ditindaklanjuti / Jumlah Rekomendasi * Bobot',
        pics: ['SPI', 'PJM', 'Akuntansi', 'WBS'],
        picDisplay: 'SPI, PJM, Akuntansi, WBS',
        bobot: -2.5,
        bobotDisplay: '-2,5',
        targetDisplay: '0',
        targetNum: 0,
        satuan: '%',
        calcType: 'compliance_audit_ratio',
        subrows: [
          { key: 'd_5_un', label: 'Jumlah Rekomendasi Audit atau Temuan yg belum Ditindaklanjuti', placeholder: '0' },
          { key: 'd_5_tot', label: 'Jumlah Rekomendasi', placeholder: '0', isDenominator: true },
        ],
      },
    };
  }, [periodForm]);

  const d5CurrentData = useMemo(() => {
    const subKeyUn = d5Definition.item.subrows?.[0]?.key || 'd_5_un';
    const subKeyTot = d5Definition.item.subrows?.[1]?.key || 'd_5_tot';
    const spiSubKey = periodForm && user?.email ? submissionKey(periodForm.id, user.email) : null;
    const spiSub = spiSubKey ? workflow.submissions?.[spiSubKey] : null;
    const spiEv = spiSubKey ? (workflow.evidence?.[spiSubKey] || []) : [];
    const savedD5 = spiAudit.items?.D_5 || {};

    const unfollowedCount = savedD5.unfollowedCount !== undefined
      ? String(savedD5.unfollowedCount)
      : String(spiSub?.values?.[subKeyUn] ?? '');
    const totalRecommendations = savedD5.totalRecommendations !== undefined
      ? String(savedD5.totalRecommendations)
      : String(spiSub?.values?.[subKeyTot] ?? '');
    const auditNote = savedD5.auditNote !== undefined
      ? String(savedD5.auditNote)
      : String(spiSub?.notes?.D_5 ?? '');
    const evidenceList = Array.isArray(savedD5.evidenceList) && savedD5.evidenceList.length > 0
      ? savedD5.evidenceList
      : spiEv.filter((e) => e.indicatorId === 'D_5');

    const computed = computeKpiItem(
      d5Definition.item,
      {
        [subKeyUn]: unfollowedCount,
        [subKeyTot]: totalRecommendations,
      },
      true,
      periodForm?.sections,
    );

    return {
      unfollowedCount,
      totalRecommendations,
      auditNote,
      evidenceList,
      computed,
      updatedAt: savedD5.updatedAt || spiAudit.updatedAt || spiSub?.submittedAt || null,
    };
  }, [d5Definition, periodForm, user?.email, workflow, spiAudit]);

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

  const handleD5Change = (patch) => {
    if (!user || user.role !== 'spi') return;
    const saved = saveSpiIndicatorAudit(periodForm?.id || period, user, 'D_5', patch);
    setLastSavedToast(`Tersimpan real-time ke database · ${new Date(saved.updatedAt).toLocaleTimeString('id-ID')}`);
    setTick((t) => t + 1);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    setEvError('');
    if (!file) {
      setEvFileMeta(null);
      return;
    }
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type)) {
      setEvError('Format berkas wajib berupa PDF atau gambar (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > MAX_EVIDENCE_FILE_BYTES) {
      setEvError('Ukuran berkas maksimal 2,5 MB. Gunakan tautan HTTPS untuk dokumen berukuran besar.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEvFileMeta({
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        dataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddD5Evidence = (e) => {
    e.preventDefault();
    setEvError('');
    const label = evLabel.trim();
    if (!label) {
      setEvError('Judul dokumen bukti tindak lanjut wajib diisi.');
      return;
    }
    let newEv;
    if (evMode === 'file') {
      if (!evFileMeta?.dataUrl) {
        setEvError('Pilih berkas PDF atau gambar terlebih dahulu.');
        return;
      }
      newEv = {
        id: `ev_d5_${Date.now()}`,
        indicatorId: 'D_5',
        kind: 'file',
        label,
        url: '',
        fileName: evFileMeta.fileName,
        mimeType: evFileMeta.mimeType,
        fileSize: evFileMeta.fileSize,
        dataUrl: evFileMeta.dataUrl,
        status: 'VERIFIED',
        owner: user?.email || 'spi@itpln.ac.id',
        ownerUnit: user?.unit || 'Satuan Pengawasan Intern (SPI)',
        picCodes: ['SPI'],
        createdAt: new Date().toISOString(),
      };
    } else {
      let parsedUrl;
      try {
        parsedUrl = new URL(evUrl.trim());
      } catch {
        setEvError('Format tautan URL tidak valid.');
        return;
      }
      if (parsedUrl.protocol !== 'https:') {
        setEvError('Gunakan tautan HTTPS yang valid.');
        return;
      }
      newEv = {
        id: `ev_d5_${Date.now()}`,
        indicatorId: 'D_5',
        kind: 'link',
        label,
        url: parsedUrl.href,
        fileName: '',
        mimeType: '',
        fileSize: 0,
        dataUrl: '',
        status: 'VERIFIED',
        owner: user?.email || 'spi@itpln.ac.id',
        ownerUnit: user?.unit || 'Satuan Pengawasan Intern (SPI)',
        picCodes: ['SPI'],
        createdAt: new Date().toISOString(),
      };
    }

    const nextList = [...d5CurrentData.evidenceList, newEv];
    handleD5Change({ evidenceList: nextList });
    setEvLabel('');
    setEvUrl('');
    setEvFileMeta(null);
  };

  const handleRemoveD5Evidence = (evId) => {
    const nextList = d5CurrentData.evidenceList.filter((ev) => ev.id !== evId);
    handleD5Change({ evidenceList: nextList });
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
          <td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:800;">${scoreStr}</td>
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
          <div style="margin-top:4px;"><strong>Isian Khusus SPI (Bagian D.5 · Tindaklanjut Rekomendasi Audit &amp; Temuan):</strong> Belum Ditindaklanjuti = <strong>${escapeHtml(d5CurrentData.unfollowedCount || '0')}</strong> dari Total Rekomendasi = <strong>${escapeHtml(d5CurrentData.totalRecommendations || '0')}</strong> (Skor D.5: <strong>${fmtNum(d5CurrentData.computed.weightedScore, 2)}</strong>)</div>
          <div style="margin-top:4px;"><strong>Keterangan D.5 (SPI):</strong> ${escapeHtml(d5CurrentData.auditNote || '-')}</div>
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
        <td>${escapeHtml(row.codeLabel)}</td>
        <td>${escapeHtml(row.item.indikator)}</td>
        <td>${escapeHtml(row.picDisplay)}</td>
        <td>${escapeHtml(row.contributor?.unit || '-')}</td>
        <td>${escapeHtml(row.item.bobotDisplay || row.item.bobot)}</td>
        <td>${row.computed.ratioPercent !== null ? fmtNum(row.computed.ratioPercent, 2) : '-'}</td>
        <td>${row.computed.weightedScore !== null ? fmtNum(row.computed.weightedScore, 2) : '-'}</td>
        <td>${row.evidences.length}</td>
        <td>${escapeHtml(row.evidences.map((e) => e.label).join('; ') || '-')}</td>
        <td>${escapeHtml(row.unitNote || '-')}</td>
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
   * Form Pengisian Khusus SPI: HANYA Bagian D No. 5
   * "5. Tindaklanjut Rekomendasi Audit & Temuan (SPI, PJM, KAP, WBS)"
   */
  const renderSpiD5ExclusiveForm = (placementId = 'top') => {
    const ratioVal = d5CurrentData.computed.ratioPercent;
    const scoreVal = d5CurrentData.computed.weightedScore;
    const extraNote = d5CurrentData.computed.extraNote;

    return (
      <section
        aria-label={`Form Inputan Khusus SPI Bagian D No. 5 (${placementId})`}
        style={{
          background: '#FFFFFF',
          border: '2px solid #0C2340',
          borderRadius: 12,
          padding: '20px 22px',
          boxShadow: '0 4px 14px rgba(12, 35, 64, 0.06)',
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
                <ClipboardCheck size={13} /> BAGIAN D · PERSPEKTIF KEPATUHAN (COMPLIANCE) · NO. 5
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
                <CheckCircle2 size={13} /> HAK INPUT KHUSUS SPI (PIC: SPI, PJM, KAP, WBS) · REAL-TIME DATABASE
              </span>
            </div>
            <h3 style={{ margin: '8px 0 4px', fontSize: 16.5, fontWeight: 800, color: '#0F172A' }}>
              5. Tindaklanjut Rekomendasi Audit &amp; Temuan (SPI, PJM, KAP, WBS)
            </h3>
            <p style={{ margin: 0, fontSize: 12.5, color: '#475569', maxWidth: '75ch' }}>
              Formula: <strong>{d5Definition.item.formula}</strong> · Bobot Maksimal: <strong>{d5Definition.item.bobotDisplay || '-2,5'}</strong> · Target: <strong>{d5Definition.item.targetDisplay || '0'}%</strong>.
              Akun SPI hanya dapat mengisi bagian D.5 miliknya ini dan tidak mencampuri isian unit lain maupun Renbang.
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
            <div>Status Penyimpanan Database (Real-Time):</div>
            <div style={{ color: '#15803D', fontWeight: 800, marginTop: 2 }}>
              {lastSavedToast || (d5CurrentData.updatedAt
                ? `Tersimpan di Database · ${new Date(d5CurrentData.updatedAt).toLocaleString('id-ID')}`
                : 'Tersimpan otomatis ke database saat angka diketik')}
            </div>
          </div>
        </div>

        {/* Grid Input 2 Sub-Baris Bagian D.5 + Kalkulasi Skor Otomatis */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              padding: '14px',
            }}
          >
            <label
              htmlFor={`d5-unfollowed-${placementId}`}
              style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}
            >
              Sub-Baris 1: Jumlah Rekomendasi Audit atau Temuan yg belum Ditindaklanjuti
            </label>
            <input
              id={`d5-unfollowed-${placementId}`}
              type="number"
              min="0"
              step="any"
              value={d5CurrentData.unfollowedCount}
              onChange={(e) => handleD5Change({ unfollowedCount: e.target.value })}
              placeholder="0"
              style={{
                width: '100%',
                minHeight: 42,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1.5px solid #0C2340',
                fontSize: 14,
                fontWeight: 800,
                color: '#0F172A',
                background: '#FFFFFF',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <span style={{ display: 'block', fontSize: 11, color: '#475569', marginTop: 5 }}>
              Masukkan jumlah temuan/rekomendasi yang masih berstatus belum selesai ditindaklanjuti (target ideal: 0).
            </span>
          </div>

          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              padding: '14px',
            }}
          >
            <label
              htmlFor={`d5-total-rec-${placementId}`}
              style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}
            >
              Sub-Baris 2: Jumlah Rekomendasi (Total Rekomendasi Audit &amp; Temuan)
            </label>
            <input
              id={`d5-total-rec-${placementId}`}
              type="number"
              min="0"
              step="any"
              value={d5CurrentData.totalRecommendations}
              onChange={(e) => handleD5Change({ totalRecommendations: e.target.value })}
              placeholder="0"
              style={{
                width: '100%',
                minHeight: 42,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1.5px solid #0C2340',
                fontSize: 14,
                fontWeight: 800,
                color: '#0F172A',
                background: '#FFFFFF',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <span style={{ display: 'block', fontSize: 11, color: '#475569', marginTop: 5 }}>
              Masukkan total seluruh rekomendasi audit/temuan (SPI, PJM, KAP, WBS) sebagai penyebut rumus.
            </span>
          </div>

          {/* Kartu Hasil Kalkulasi Otomatis Bagian D.5 */}
          <div
            style={{
              background: '#0C2340',
              color: '#FFFFFF',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', opacity: 0.9 }}>
              HASIL PERHITUNGAN OTOMATIS BAGIAN D.5 (BOBOT -2,5)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Capaian Kepatuhan:</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                  {ratioVal !== null ? `${fmtNum(ratioVal, 2)}%` : 'Belum Terisi'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Skor Penalti D.5:</div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: scoreVal !== null && scoreVal < 0 ? '#FCA5A5' : '#86EFAC',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {scoreVal !== null ? fmtNum(scoreVal, 2) : '-'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, marginTop: 8, opacity: 0.9 }}>
              {extraNote || 'Rumus: (Belum Ditindaklanjuti / Jumlah Rekomendasi) × (-2,5)'}
            </div>
          </div>
        </div>

        {/* Kolom Keterangan & Dokumen Bukti Pendukung Khusus Bagian D.5 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: 16,
          }}
        >
          <div>
            <label
              htmlFor={`d5-note-${placementId}`}
              style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: '#1E293B', marginBottom: 6 }}
            >
              Keterangan / Catatan Tindak Lanjut Audit &amp; Temuan (Bagian D.5)
            </label>
            <textarea
              id={`d5-note-${placementId}`}
              rows={4}
              value={d5CurrentData.auditNote}
              onChange={(e) => handleD5Change({ auditNote: e.target.value })}
              placeholder="Tuliskan rincian tindak lanjut rekomendasi audit & temuan (SPI, PJM, KAP, WBS)... Tersimpan otomatis secara real-time."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                fontSize: 13,
                color: '#0F172A',
                resize: 'vertical',
              }}
            />
          </div>

          <div
            style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
              Dokumen Bukti Pendukung Bagian D.5 ({d5CurrentData.evidenceList.length} Dokumen)
            </div>

            {d5CurrentData.evidenceList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {d5CurrentData.evidenceList.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.label}
                    </span>
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setPreviewEvidence(ev)}
                        style={{
                          minHeight: 30,
                          padding: '3px 8px',
                          borderRadius: 5,
                          border: '1px solid #0C2340',
                          background: '#FFFFFF',
                          color: '#0C2340',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Eye size={12} /> Lihat
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveD5Evidence(ev.id)}
                        style={{
                          minHeight: 30,
                          padding: '3px 8px',
                          borderRadius: 5,
                          border: '1px solid #FCA5A5',
                          background: '#FEF2F2',
                          color: '#B91C1C',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddD5Evidence} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setEvMode('link')}
                  style={{
                    minHeight: 32,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: evMode === 'link' ? '1.5px solid #0C2340' : '1px solid #CBD5E1',
                    background: evMode === 'link' ? '#0C2340' : '#FFFFFF',
                    color: evMode === 'link' ? '#FFFFFF' : '#334155',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Link2 size={12} /> Tautan HTTPS
                </button>
                <button
                  type="button"
                  onClick={() => setEvMode('file')}
                  style={{
                    minHeight: 32,
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: evMode === 'file' ? '1.5px solid #0C2340' : '1px solid #CBD5E1',
                    background: evMode === 'file' ? '#0C2340' : '#FFFFFF',
                    color: evMode === 'file' ? '#FFFFFF' : '#334155',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Upload size={12} /> Unggah PDF / Gambar
                </button>
              </div>

              <input
                type="text"
                aria-label="Judul bukti tindak lanjut audit Bagian D.5"
                value={evLabel}
                onChange={(e) => setEvLabel(e.target.value)}
                placeholder="Judul dokumen bukti (mis. Berita Acara Tindak Lanjut Audit SPI)..."
                style={{
                  minHeight: 36,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #CBD5E1',
                  fontSize: 12,
                  background: '#FFFFFF',
                }}
              />

              {evMode === 'link' ? (
                <input
                  type="url"
                  aria-label="URL HTTPS bukti tindak lanjut audit Bagian D.5"
                  value={evUrl}
                  onChange={(e) => setEvUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  style={{
                    minHeight: 36,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    fontSize: 12,
                    background: '#FFFFFF',
                  }}
                />
              ) : (
                <input
                  type="file"
                  aria-label="Pilih berkas PDF atau gambar bukti Bagian D.5"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileSelect}
                  style={{ fontSize: 11.5 }}
                />
              )}

              {evError && (
                <div style={{ fontSize: 11.5, color: '#B91C1C', fontWeight: 700 }}>{evError}</div>
              )}

              <button
                type="submit"
                style={{
                  alignSelf: 'flex-start',
                  minHeight: 36,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#15803D',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Plus size={13} /> Tambah Bukti Bagian D.5
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  };

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
            <span>Inputan Khusus SPI: Bagian D.5 (Tindaklanjut Audit)</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 10.5,
                ...SOLID_GREEN_BADGE,
              }}
            >
              REAL-TIME
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

      {/* Tab Menu Inputan Khusus SPI (Hanya Bagian D No. 5) */}
      {activeSpiTab === 'spi-form' && renderSpiD5ExclusiveForm('menu-top')}

      {/* Tab Tabel Audit KPI (Read-Only) + Form Bagian D.5 di Bawah Tabel */}
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
                    Selama pihak Renbang belum selesai memvalidasi seluruh data KPI unit, Tabel Audit KPI (Read-Only)
                    wajib dalam keadaan terkunci. SPI tidak diperbolehkan memantau data unit yang baru terisi sebagian.
                    Tabel ini akan <strong>terbuka otomatis</strong> segera setelah validasi Renbang mencapai <strong>100%</strong>.
                  </p>

                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: 10,
                      padding: '14px 16px',
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
                  </div>
                </div>
              </div>
            </section>
          ) : (
            /* STATE TERBUKA OTOMATIS: VALIDASI RENBANG 100% SELESAI */
            <>
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
                        Tampilan Ringkas Khusus SPI (Read-Only)
                      </span>
                    </div>
                    <h2 style={{ margin: '4px 0', fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                      Tabel Audit KPI (Read-Only) · Hasil Akhir Tervalidasi Renbang &amp; Dokumen Pendukung
                    </h2>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#475569', maxWidth: '76ch' }}>
                      Kolom teknis/mentah milik Admin/Renbang telah dihilangkan. Tabel di bawah ini bersifat murni Read-Only
                      untuk pengecekan dokumen bukti pendukung dan hasil akhir KPI yang telah divalidasi Renbang beserta PIC terkait.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setDisplayFormat('RINGKAS')}
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
                        onClick={() => setDisplayFormat('CETAK_LAPORAN')}
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

                {/* Filter Bar */}
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
                    <input
                      type="search"
                      aria-label="Cari indikator atau PIC pada tabel audit SPI"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari kode, indikator, atau PIC..."
                      style={{
                        minHeight: 38,
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        fontSize: 12.5,
                        minWidth: 240,
                      }}
                    />

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
                /* OPSI 1: TABEL AUDIT RINGKAS SPI (Murni Read-Only: Kode, Indikator, PIC, Hasil Akhir, Unduh Dokumen) */
                <section
                  aria-label="Tabel Ringkas Audit KPI SPI (Read-Only)"
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
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'center', width: 64 }}>Kode</th>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'left', minWidth: 260 }}>
                            Indikator Kinerja Utama (KPI) &amp; Keterangan Tervalidasi
                          </th>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'left', width: 175 }}>
                            PIC &amp; Unit Terkait
                          </th>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'right', width: 185 }}>
                            Hasil Akhir Tervalidasi Renbang
                          </th>
                          <th scope="col" style={{ padding: '11px 12px', textAlign: 'left', minWidth: 270 }}>
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
                                    ...(row.isPenaltySection && scoreVal < 0 ? SOLID_RED_BADGE : SOLID_GREEN_BADGE),
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
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                /* OPSI 2: CETAK LAPORAN KESELURUHAN TERVALIDASI */
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
                        LAPORAN KESELURUHAN HASIL AKHIR KPI TERVALIDASI · PERIODE {period}
                      </h3>
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
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left', width: 220 }}>Bukti Pendukung</th>
                          <th scope="col" style={{ padding: '9px 10px', textAlign: 'left', width: 200 }}>Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => (
                          <tr key={row.item.id} style={{ borderBottom: '1px solid #CBD5E1' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800 }}>{row.codeLabel}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.item.indikator}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700 }}>{row.picDisplay}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {row.item.bobotDisplay || row.item.bobot}
                            </td>
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
                            <td style={{ padding: '8px 10px', fontSize: 11.5, color: '#334155' }}>
                              {row.unitNote || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}

          {/* Form Pengisian Khusus SPI (Hanya Bagian D No. 5) di Bawah Tabel Audit Read-Only */}
          {renderSpiD5ExclusiveForm('below-table')}
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
