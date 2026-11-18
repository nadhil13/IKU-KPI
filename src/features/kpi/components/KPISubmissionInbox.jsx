import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Check, ExternalLink, Eye, Download, FileText, Image as ImageIcon,
  Link2, Search, ShieldCheck, X, Layers, History, CheckCircle2,
  Save, FolderDown, PenLine, Send, MessageSquareWarning, Trash2, Plus, Lock, Unlock,
} from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { KPI_SECTIONS_CONFIG } from '../kpiTemplateConfig';
import HorizontalTableViewport from '../../../shared/components/HorizontalTableViewport';
import KPIDataEntrySheet, { EvidencePreviewModal } from './KPIDataEntrySheet';
import {
  KPI_TRANSITIONS,
  readKpiWorkflow,
  readUnitSubmission,
  readUnitDraft,
  readUnitEvidence,
  reviewUnitKpi,
  reviewUnitEvidence,
  addUnitEvidenceByAdmin,
  updateUnitEvidenceByAdmin,
  removeUnitEvidenceByAdmin,
  saveUnitKpiByAdmin,
  resetUnitKpiByAdmin,
  subscribeKpiWorkflow,
  readIntegratedKpiBoard,
  ensureDefaultKpiDistribution,
  getEditableItemsForUser,
  evaluateRenbangValidationStatus,
  setRenbangFinalValidation,
  readSpiAuditForForm,
  MAX_EVIDENCE_FILE_BYTES,
  ALLOWED_EVIDENCE_MIME_TYPES,
} from '../kpiWorkflowStore';
import { formatIndonesianNumber } from '../kpiSchema';
import { readAudit } from '../../internal/adminStore';

const labels = {
  EMPTY: 'Belum mengirim',
  DRAFT: 'Sedang dikerjakan (Draft)',
  SUBMITTED: 'Dikirim ke pusat',
  APPROVED: 'Disetujui PRP',
  NEEDS_REVISION: 'Perlu revisi / buka kembali',
  REJECTED: 'Ditolak',
  LOCKED: 'Dikunci final',
};

const badgeFor = (status) => {
  if (status === 'SUBMITTED') return 'ent-badge ent-badge-submitted';
  if (status === 'APPROVED') return 'ent-badge ent-badge-approved';
  if (status === 'NEEDS_REVISION') return 'ent-badge ent-badge-revision';
  if (status === 'REJECTED') return 'ent-badge ent-badge-rejected';
  if (status === 'LOCKED') return 'ent-badge ent-badge-locked';
  return 'ent-badge';
};

const actionLabels = {
  APPROVED: 'Setujui Submission',
  NEEDS_REVISION: 'Minta Revisi',
  REJECTED: 'Tolak Submission',
  LOCKED: 'Kunci Final',
};

const actionLabel = (from, to) => (from === 'LOCKED' && to === 'NEEDS_REVISION' ? 'Buka Kembali (Unlock)' : (actionLabels[to] || labels[to]));

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function KPISubmissionInbox({ selected: controlledSelected, onSelect }) {
  const { currentUser } = useAuth();
  const [state, setState] = useState(readKpiWorkflow);
  const [auditTick, setAuditTick] = useState(0);
  const [localSelected, setLocalSelected] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [showIntegratedSheet, setShowIntegratedSheet] = useState(false);
  const [showEvidenceVault, setShowEvidenceVault] = useState(false);
  const [boardViewMode, setBoardViewMode] = useState('auto');
  const [vaultUnitFilter, setVaultUnitFilter] = useState('');
  const [vaultStatusFilter, setVaultStatusFilter] = useState('');
  const [adminUnitEdits, setAdminUnitEdits] = useState(null);
  const [savedNotice, setSavedNotice] = useState('');
  const [evActionPanel, setEvActionPanel] = useState(null);
  const [newUnitEv, setNewUnitEv] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [note, setNote] = useState('');
  const [complete, setComplete] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState(null);
  const [pendingResetUnit, setPendingResetUnit] = useState(null);
  const [error, setError] = useState('');
  const [isMobileView, setIsMobileView] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 768
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selected = controlledSelected !== undefined ? controlledSelected : localSelected;
  const updateSelected = useCallback((next) => {
    if (onSelect) onSelect(next);
    else setLocalSelected(next);
    setNote('');
    setComplete(false);
    setError('');
    setAdminUnitEdits(null);
    setSavedNotice('');
    setEvActionPanel(null);
    setNewUnitEv(null);
  }, [onSelect]);

  useEffect(() => {
    const offWorkflow = subscribeKpiWorkflow(() => {
      setState(readKpiWorkflow());
      setAuditTick((n) => n + 1);
    });
    const onAdmin = () => setAuditTick((n) => n + 1);
    window.addEventListener('prp-admin-updated', onAdmin);
    return () => {
      offWorkflow();
      window.removeEventListener('prp-admin-updated', onAdmin);
    };
  }, []);

  const latestForm = state.forms[state.forms.length - 1] || null;
  const integratedBoard = useMemo(
    () => (latestForm ? readIntegratedKpiBoard(latestForm.id, state, { confirmedOnly: false }) : null),
    [latestForm, state],
  );
  const confirmedBoard = useMemo(
    () => (latestForm ? readIntegratedKpiBoard(latestForm.id, state, { confirmedOnly: true }) : null),
    [latestForm, state],
  );

  const kpiAuditEntries = useMemo(() => {
    void auditTick;
    const all = readAudit();
    return all
      .filter((entry) => /KPI|DISTRIBUSI|PUBLIKASI|VALIDASI|ORGANISASI/i.test(String(entry.action || '')))
      .slice(0, 12);
  }, [auditTick]);

  const form = state.forms.find((f) => f.id === selected?.formId);
  const record = selected && readUnitSubmission(selected.formId, selected.email, state);
  const draft = selected && readUnitDraft(selected.formId, selected.email, state);
  const selectedFormBoard = useMemo(
    () => (form ? readIntegratedKpiBoard(form.id, state) : null),
    [form, state],
  );

  useEffect(() => {
    if (!selected || !form) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (pendingResetUnit) setPendingResetUnit(null);
        else if (pendingUnlock) setPendingUnlock(null);
        else if (!previewDoc) updateSelected(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selected, form, previewDoc, pendingUnlock, pendingResetUnit, updateSelected]);

  const mutate = (action) => {
    setError('');
    try {
      if (!currentUser) throw new Error('Silakan masuk kembali.');
      action();
      setComplete(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const boardMetrics = useMemo(() => {
    if (!integratedBoard) return null;
    const statuses = integratedBoard.unitStatuses || [];
    const submittedCount = statuses.filter((u) => u.status === 'SUBMITTED').length;
    const approvedCount = statuses.filter((u) => u.status === 'APPROVED' || u.status === 'LOCKED').length;
    const draftCount = statuses.filter((u) => u.status === 'DRAFT' || u.status === 'NEEDS_REVISION').length;
    const totalEvidence = statuses.reduce((sum, u) => sum + u.evidenceCount, 0);
    const verifiedEvidence = statuses.reduce((sum, u) => sum + u.verifiedEvidenceCount, 0);
    return { submittedCount, approvedCount, draftCount, totalEvidence, verifiedEvidence };
  }, [integratedBoard]);

  const resolvedBoardMode = boardViewMode === 'auto'
    ? ((boardMetrics?.approvedCount || 0) > 0 ? 'confirmed' : 'live')
    : boardViewMode;
  const activeBoard = resolvedBoardMode === 'confirmed' && confirmedBoard ? confirmedBoard : integratedBoard;

  const latestIndicatorLabelById = useMemo(() => {
    const map = {};
    (latestForm?.sections || []).forEach((sec) => {
      (sec.items || []).forEach((item) => {
        map[item.id] = `${sec.code}.${item.no} ${item.indikator}`;
      });
    });
    return map;
  }, [latestForm]);

  const allPeriodEvidence = useMemo(() => {
    if (!latestForm) return [];
    const entries = [];
    (latestForm.units || []).forEach((u) => {
      const sub = readUnitSubmission(latestForm.id, u.email, state);
      const unitStatus = sub?.status || 'DRAFT';
      const evList = readUnitEvidence(latestForm.id, u.email, state);
      evList.forEach((ev) => {
        entries.push({
          ...ev,
          unitName: sub?.unit || u.name,
          unitEmail: u.email,
          unitPicCodes: sub?.picCodes || u.picCodes || [],
          unitStatus,
          indicatorLabel: latestIndicatorLabelById[ev.indicatorId] || ev.indicatorId,
        });
      });
    });
    return entries;
  }, [latestForm, state, latestIndicatorLabelById]);

  const filteredVaultEvidence = useMemo(() => (
    allPeriodEvidence.filter((ev) => {
      if (vaultUnitFilter && ev.unitEmail.toLowerCase() !== vaultUnitFilter.toLowerCase()) return false;
      if (vaultStatusFilter && ev.status !== vaultStatusFilter) return false;
      return true;
    })
  ), [allPeriodEvidence, vaultUnitFilter, vaultStatusFilter]);

  const handleDownloadAllAttachedFiles = () => {
    const files = filteredVaultEvidence.filter((ev) => ev.kind === 'file' && ev.dataUrl);
    if (!files.length) {
      setSavedNotice('Tidak ada berkas PDF/gambar terlampir pada filter aktif (hanya tautan Drive/HTTP). Gunakan tombol Unduh Rekap Daftar Bukti (.csv).');
      return;
    }
    files.forEach((ev, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = ev.dataUrl;
        const safeUnit = (ev.unitPicCodes?.[0] || ev.unitName || 'UNIT').replace(/[^a-z0-9_-]/gi, '_');
        a.download = `${safeUnit}_${ev.fileName || `${ev.label}.pdf`}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 220);
    });
    setSavedNotice(`Mengunduh ${files.length} berkas bukti PDF/gambar unit secara berurutan...`);
  };

  const handleDownloadEvidenceManifestCsv = () => {
    if (!filteredVaultEvidence.length) return;
    const escCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = ['No', 'Unit Kerja', 'Email PIC', 'Kode PIC', 'Status Submission', 'Indikator', 'Jenis Bukti', 'Judul Dokumen', 'Nama Berkas / Tautan HTTPS', 'Status Verifikasi', 'Catatan PRP'];
    const rows = filteredVaultEvidence.map((ev, idx) => [
      idx + 1,
      ev.unitName,
      ev.unitEmail,
      (ev.unitPicCodes || []).join('; '),
      labels[ev.unitStatus] || ev.unitStatus,
      ev.indicatorLabel,
      ev.kind === 'file' ? 'Berkas Terunggah' : 'Tautan HTTPS',
      ev.label,
      ev.kind === 'file' ? (ev.fileName || 'Dokumen') : ev.url,
      ev.status,
      ev.note || '',
    ].map(escCsv).join(','));
    const csv = `\uFEFF${[headers.map(escCsv).join(','), ...rows].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Daftar_Berkas_Bukti_KPI_${latestForm?.period || '2026'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const indicatorLabelById = useMemo(() => {
    const map = {};
    (form?.sections || []).forEach((sec) => {
      (sec.items || []).forEach((item) => {
        map[item.id] = `${sec.code}.${item.no} ${item.indikator}`;
      });
    });
    return map;
  }, [form]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0, width: '100%', maxWidth: '100%' }}>
      {latestForm && activeBoard && boardMetrics && (
        <section className="gov-table" aria-label="Papan Integrasi & Tabel Final KPI Terkonsolidasi">
          <div className="gov-table-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
            <div>
              <h2>Tabel Final KPI Terkonsolidasi &amp; Gudang Berkas Unit</h2>
              <span>
                Rekonsiliasi hasil revisi &amp; konfirmasi seluruh unit kerja pada Periode {latestForm.period} (Versi v{latestForm.version}). Ekspor full Excel/PDF dan unduh semua bukti unit.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="ent-btn"
                style={{ minHeight: '44px' }}
                onClick={() => setShowEvidenceVault((prev) => !prev)}
              >
                <FolderDown size={15} />
                <span>{showEvidenceVault ? 'Tutup Gudang Berkas' : `Semua Berkas Unit (${allPeriodEvidence.length})`}</span>
              </button>
              <button
                type="button"
                className="ent-btn ent-btn-primary"
                style={{ minHeight: '44px' }}
                onClick={() => setShowIntegratedSheet((prev) => !prev)}
              >
                <Layers size={14} />
                <span>{showIntegratedSheet ? 'Sembunyikan Tabel Final' : 'Buka Tabel Final & Ekspor'}</span>
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
              gap: '0.85rem',
              padding: '1rem 1.3rem',
              background: '#FFFFFF',
            }}
          >
            <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: '#F7FAFB', border: '1px solid #D8E4EA' }}>
              <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {resolvedBoardMode === 'confirmed' ? 'Skor Final Terkonfirmasi' : 'Skor Institusi (Progres Live)'}
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#072534', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                {formatIndonesianNumber(activeBoard.totalScore, 2)} <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>/ 100 Poin</span>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: '#F7FAFB', border: '1px solid #D8E4EA' }}>
              <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Cakupan Indikator ({resolvedBoardMode === 'confirmed' ? 'Final' : 'Live'})
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#094E68', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                {activeBoard.filledIndicatorCount} / {activeBoard.totalIndicatorCount} <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>Baris</span>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: '#F7FAFB', border: '1px solid #D8E4EA' }}>
              <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Status Pengajuan Unit PIC
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#072534', marginTop: '0.35rem', lineHeight: 1.45 }}>
                {boardMetrics.submittedCount} Menunggu Review · {boardMetrics.approvedCount} Terkonfirmasi · {boardMetrics.draftCount} Draft
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: '#F7FAFB', border: '1px solid #D8E4EA' }}>
              <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Verifikasi Bukti Capaian
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#14532D', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                {boardMetrics.verifiedEvidence} / {boardMetrics.totalEvidence} <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>Terverifikasi</span>
              </div>
            </div>
          </div>

          {/* Panel Kontrol Validasi Final 100% Renbang & Pembukaan Otomatis Akses Audit SPI */}
          {(() => {
            const renbangStatus = evaluateRenbangValidationStatus(latestForm.id, state);
            const spiRecord = readSpiAuditForForm(latestForm.id, state);
            const spiCheckedItems = Object.values(spiRecord.items || {}).filter(
              (it) => it && (it.verificationStatus !== 'BELUM_DIPERIKSA' || String(it.auditNote || '').trim() !== '')
            );
            return (
              <div
                style={{
                  padding: '0.95rem 1.3rem',
                  borderTop: '1px solid #D8E4EA',
                  background: renbangStatus.isValidated100 ? '#F0FDF4' : '#FEF2F2',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: renbangStatus.isValidated100 ? '#15803D' : '#B91C1C',
                          color: '#FFFFFF',
                          border: renbangStatus.isValidated100 ? '1.5px solid #14532D' : '1.5px solid #7F1D1D',
                        }}
                      >
                        {renbangStatus.isValidated100 ? <Unlock size={13} /> : <Lock size={13} />}
                        {renbangStatus.isValidated100
                          ? 'AKSES TABEL AUDIT SPI: TERBUKA OTOMATIS (VALIDASI RENBANG 100%)'
                          : 'AKSES TABEL AUDIT SPI: TERKUNCI ("Akses masih tertutup")'}
                      </span>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                        Progres Validasi Renbang: {renbangStatus.validatedUnits}/{renbangStatus.totalUnits} Unit ({renbangStatus.progressPercent}%)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#334155' }}>
                      {renbangStatus.isValidated100
                        ? 'Seluruh data KPI periode ini telah berstatus tervalidasi final 100% oleh Renbang. Akun SPI kini dapat melihat Tabel Audit KPI (Read-Only) dan mengisi catatan audit.'
                        : 'Selama validasi Renbang belum mencapai 100%, akun SPI tidak dapat memantau data unit yang baru terisi sebagian. Setujui seluruh unit atau klik tombol pengesahan final di kanan untuk membuka akses SPI.'}
                    </span>
                  </div>

                  {currentUser?.role === 'superadmin_prp' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {!renbangStatus.isValidated100 ? (
                        <button
                          type="button"
                          onClick={() => mutate(() => {
                            setRenbangFinalValidation(latestForm.id, true, currentUser, {
                              approveAllSubmitted: true,
                              note: 'Validasi Final 100% disahkan oleh Admin Renbang / PRP',
                            });
                            setState(readKpiWorkflow());
                            setSavedNotice('Validasi Final 100% Renbang disahkan. Tabel Audit KPI pada akun SPI kini terbuka otomatis.');
                          })}
                          style={{
                            minHeight: '40px',
                            padding: '0.45rem 0.95rem',
                            borderRadius: '8px',
                            border: '1.5px solid #14532D',
                            background: '#15803D',
                            color: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                          }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Sahkan Validasi Final 100% Renbang (Buka Akses Audit SPI)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => mutate(() => {
                            setRenbangFinalValidation(latestForm.id, false, currentUser, {
                              note: 'Validasi dibuka kembali oleh Renbang, akses SPI dikunci sementara',
                            });
                            setState(readKpiWorkflow());
                            setSavedNotice('Akses Tabel Audit KPI pada akun SPI dikunci kembali ("Akses masih tertutup").');
                          })}
                          style={{
                            minHeight: '40px',
                            padding: '0.45rem 0.95rem',
                            borderRadius: '8px',
                            border: '1.5px solid #7F1D1D',
                            background: '#B91C1C',
                            color: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                          }}
                        >
                          <Lock size={14} />
                          <span>Kunci Kembali Akses Audit SPI</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {(spiRecord.updatedAt || spiCheckedItems.length > 0) && (
                  <div
                    style={{
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.74rem',
                      color: '#1E293B',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <strong>Pantauan Real-Time Inputan Akun SPI:</strong>{' '}
                      No. Dokumen: <strong>{spiRecord.header?.auditDocNumber || '-'}</strong> ·{' '}
                      Indikator Diperiksa SPI: <strong>{spiCheckedItems.length} butir</strong>
                      {spiRecord.header?.generalSummary ? ` · Ringkasan SPI: "${spiRecord.header.generalSummary}"` : ''}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#15803D', fontWeight: 800 }}>
                      Diperbarui SPI: {spiRecord.updatedAt ? new Date(spiRecord.updatedAt).toLocaleString('id-ID') : '-'}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {showEvidenceVault && (
            <div style={{ padding: '1rem 1.3rem', borderTop: '1px solid #D8E4EA', background: '#F7FAFB', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#072534', fontFamily: 'Outfit, sans-serif', display: 'block' }}>
                    Gudang Seluruh Berkas &amp; Tautan Bukti Unit (Periode {latestForm.period})
                  </strong>
                  <span style={{ fontSize: '0.73rem', color: '#475569' }}>
                    Pratinjau langsung dokumen PDF/gambar, akses tautan HTTPS, atau unduh seluruh berkas unit dalam satu klik.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="ent-btn"
                    style={{ minHeight: '44px' }}
                    disabled={filteredVaultEvidence.length === 0}
                    onClick={handleDownloadEvidenceManifestCsv}
                  >
                    <Download size={14} />
                    <span>Unduh Rekap Daftar Bukti (.csv)</span>
                  </button>
                  <button
                    type="button"
                    className="ent-btn ent-btn-teal"
                    style={{ minHeight: '44px' }}
                    disabled={!filteredVaultEvidence.some((ev) => ev.kind === 'file' && ev.dataUrl)}
                    onClick={handleDownloadAllAttachedFiles}
                  >
                    <FolderDown size={14} />
                    <span>Unduh Semua Berkas PDF/Gambar ({filteredVaultEvidence.filter((ev) => ev.kind === 'file' && ev.dataUrl).length})</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0.65rem' }}>
                <select className="gov-field" aria-label="Filter unit pada gudang berkas" value={vaultUnitFilter} onChange={(e) => setVaultUnitFilter(e.target.value)}>
                  <option value="">Semua unit pengirim ({latestForm.units?.length || 0})</option>
                  {(latestForm.units || []).map((u) => (
                    <option key={u.email} value={u.email}>{u.name} ({(u.picCodes || []).join(', ') || 'PIC'})</option>
                  ))}
                </select>
                <select className="gov-field" aria-label="Filter status verifikasi berkas" value={vaultStatusFilter} onChange={(e) => setVaultStatusFilter(e.target.value)}>
                  <option value="">Semua status verifikasi</option>
                  <option value="VERIFIED">Terverifikasi (VERIFIED)</option>
                  <option value="NEEDS_REVISION">Perlu Revisi (NEEDS_REVISION)</option>
                  <option value="PENDING">Menunggu Verifikasi (PENDING)</option>
                  <option value="REJECTED">Ditolak (REJECTED)</option>
                </select>
              </div>

              {savedNotice && !selected && (
                <div role="status" style={{ padding: '0.65rem 0.9rem', borderRadius: '8px', background: '#F0FDF4', border: '1px solid #86EFAC', color: '#14532D', fontSize: '0.75rem', fontWeight: 600 }}>
                  {savedNotice}
                </div>
              )}

              {filteredVaultEvidence.length === 0 ? (
                <div className="gov-placeholder">Belum ada berkas atau tautan bukti dukung yang cocok dengan filter aktif.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '0.7rem', maxHeight: '380px', overflowY: 'auto' }}>
                  {filteredVaultEvidence.map((ev) => {
                    const isFile = ev.kind === 'file' || Boolean(ev.dataUrl);
                    const isImg = /^image\//i.test(ev.mimeType || '');
                    return (
                      <article
                        key={`${ev.unitEmail}:${ev.id}`}
                        style={{
                          padding: '0.8rem 0.9rem',
                          borderRadius: '8px',
                          background: '#FFFFFF',
                          border: '1px solid #D8E4EA',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                          minWidth: 0,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, fontSize: '0.78rem', color: '#072534', overflowWrap: 'anywhere' }}>
                              {isFile ? (isImg ? <ImageIcon size={14} color="#094E68" /> : <FileText size={14} color="#094E68" />) : <Link2 size={14} color="#094E68" />}
                              <span>{ev.label}</span>
                            </div>
                            <div style={{ fontSize: '0.69rem', color: '#334155', marginTop: '0.2rem', fontWeight: 600 }}>
                              {ev.unitName} · <span style={{ color: '#094E68' }}>{(ev.unitPicCodes || []).join(', ') || 'PIC'}</span>
                            </div>
                            <div style={{ fontSize: '0.67rem', color: '#475569', overflowWrap: 'anywhere' }}>
                              {ev.indicatorLabel}{ev.fileName ? ` · ${ev.fileName} (${formatBytes(ev.fileSize)})` : ''}
                            </div>
                          </div>
                          <span className={ev.status === 'NEEDS_REVISION' ? 'ent-badge ent-badge-revision' : ev.status === 'VERIFIED' ? 'ent-badge ent-badge-approved' : ev.status === 'REJECTED' ? 'ent-badge ent-badge-rejected' : 'ent-badge'}>
                            {ev.status === 'NEEDS_REVISION' ? 'PERLU REVISI' : ev.status}
                          </span>
                        </div>
                        {ev.note && (
                          <div style={{ fontSize: '0.68rem', color: ev.status === 'NEEDS_REVISION' ? '#92400E' : '#475569', fontWeight: 600, overflowWrap: 'anywhere' }}>
                            Catatan PRP: {ev.note}
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                          {isFile ? (
                            <>
                              <button type="button" className="gov-button" style={{ minHeight: '44px', fontSize: '0.7rem' }} onClick={() => setPreviewDoc({ ...ev, _formId: latestForm.id, _email: ev.unitEmail })}>
                                <Eye size={12} /> Pratinjau, Revisi &amp; Edit
                              </button>
                              {ev.dataUrl && (
                                <a
                                  href={ev.dataUrl}
                                  download={ev.fileName || `${ev.label}.pdf`}
                                  className="gov-button"
                                  style={{ minHeight: '44px', fontSize: '0.7rem', textDecoration: 'none' }}
                                >
                                  <Download size={12} /> Unduh Berkas
                                </a>
                              )}
                            </>
                          ) : (
                            <>
                              <button type="button" className="gov-button" style={{ minHeight: '44px', fontSize: '0.7rem' }} onClick={() => setPreviewDoc({ ...ev, _formId: latestForm.id, _email: ev.unitEmail })}>
                                <PenLine size={12} /> Revisi / Edit
                              </button>
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gov-button"
                                style={{ minHeight: '44px', fontSize: '0.7rem', textDecoration: 'none' }}
                              >
                                <ExternalLink size={12} /> Buka Tautan Drive
                              </a>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showIntegratedSheet && (
            <div style={{ padding: 'clamp(0.75rem, 2vw, 1.3rem)', borderTop: '1px solid #D8E4EA', background: '#F7FAFB', minWidth: 0, maxWidth: '100%', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
                <div style={{ display: 'inline-flex', background: '#EDF3F6', padding: '3px', borderRadius: '8px', border: '1px solid #B8CAD4', gap: '3px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setBoardViewMode('confirmed')}
                    style={{
                      minHeight: '44px',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '6px',
                      border: resolvedBoardMode === 'confirmed' ? '1px solid #094E68' : '1px solid transparent',
                      background: resolvedBoardMode === 'confirmed' ? '#094E68' : 'transparent',
                      color: resolvedBoardMode === 'confirmed' ? '#FFFFFF' : '#334155',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Tabel Final Terkonfirmasi ({boardMetrics.approvedCount} Unit Disetujui/Dikunci)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardViewMode('live')}
                    style={{
                      minHeight: '44px',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '6px',
                      border: resolvedBoardMode === 'live' ? '1px solid #094E68' : '1px solid transparent',
                      background: resolvedBoardMode === 'live' ? '#094E68' : 'transparent',
                      color: resolvedBoardMode === 'live' ? '#FFFFFF' : '#334155',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Semua Progres Realtime (Termasuk Draft &amp; Revisi)
                  </button>
                </div>
                {resolvedBoardMode === 'confirmed' && boardMetrics.approvedCount === 0 && (
                  <span style={{ fontSize: '0.73rem', fontWeight: 600, color: '#92400E', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '6px', padding: '0.4rem 0.7rem' }}>
                    Belum ada unit yang dikonfirmasi (Disetujui / Dikunci). Beralih ke tab Progres Realtime atau konfirmasi unit di tabel bawah.
                  </span>
                )}
              </div>

              <KPIDataEntrySheet
                key={`integrated:${latestForm.id}:${resolvedBoardMode}:${auditTick}`}
                period={latestForm.period}
                sectionsOverride={latestForm.sections}
                valuesOverride={activeBoard.values}
                notesOverride={activeBoard.notes}
                evidenceOverride={Object.values(activeBoard.evidenceByItem || {}).flat()}
                contributorMapOverride={activeBoard.contributorsByItem}
                persist={false}
                readOnly
              />
            </div>
          )}
        </section>
      )}

      <div className="gov-table">
        <div className="gov-table-head">
          <div>
            <h2>Monitoring Submission &amp; Verifikasi Bukti KPI Unit Kerja</h2>
            <span>Pantau status pengiriman per akun PIC, verifikasi berkas PDF/gambar atau tautan Drive, dan tetapkan persetujuan PRP</span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: '0.65rem',
            padding: '0.9rem 1.3rem',
            background: '#F7FAFB',
            borderBottom: '1px solid #D8E4EA',
          }}
        >
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#475569" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              className="gov-field"
              style={{ paddingLeft: '2.2rem' }}
              aria-label="Cari unit, PIC, atau periode"
              placeholder="Cari unit kerja, kode PIC, atau periode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="gov-field" aria-label="Status" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Semua status pengisian</option>
            <option value="EMPTY">Belum mulai mengisi</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {error && !selected && (
          <div role="alert" style={{ margin: '1rem 1.3rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#7F1D1D', fontSize: '0.78rem', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {!state.forms.length && (
          <div className="gov-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div>Belum ada distribusi formulir KPI aktif pada penyimpanan peramban ini.</div>
            <button
              type="button"
              className="ent-btn ent-btn-primary"
              onClick={() => mutate(() => ensureDefaultKpiDistribution(KPI_SECTIONS_CONFIG))}
            >
              Inisialisasi Formulir 29 Indikator &amp; PIC ITPLN
            </button>
          </div>
        )}

        {[...state.forms].reverse().map((f) => {
          const unitEntries = f.units
            .filter((u) => `${u.name} ${u.email} ${(u.picCodes || []).join(' ')} ${f.period}`.toLowerCase().includes(search.toLowerCase()))
            .map((u) => {
              const r = readUnitSubmission(f.id, u.email, state);
              const d = readUnitDraft(f.id, u.email, state);
              const evList = readUnitEvidence(f.id, u.email, state);
              const effectiveStatus = r?.status || (d || evList.length > 0 ? 'DRAFT' : 'EMPTY');
              if (filter && effectiveStatus !== filter) return null;

              const assignedCount = getEditableItemsForUser(f, {
                role: 'kpi_only',
                status: 'Aktif',
                email: u.email,
                picCodes: u.picCodes,
                unit: u.name,
              }).length;
              const verifiedCount = evList.filter((e) => e.status === 'VERIFIED').length;
              const fileCount = evList.filter((e) => e.kind === 'file').length;
              const linkCount = evList.length - fileCount;

              return {
                u,
                r,
                evList,
                effectiveStatus,
                assignedCount,
                verifiedCount,
                fileCount,
                linkCount,
              };
            })
            .filter(Boolean);

          return (
          <section key={f.id} style={{ borderBottom: '1px solid #D8E4EA' }}>
            <div style={{ padding: '0.8rem 1.3rem', background: '#F7FAFB', borderBottom: '1px solid #D8E4EA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: '#072534', fontFamily: 'Outfit, sans-serif' }}>
                Periode {f.period} · Versi v{f.version}
              </h3>
              <span className="ent-badge">{f.units.length} akun unit/PIC terdaftar</span>
            </div>

            <div className="resp-desktop-table">
              <HorizontalTableViewport panLabel="Geser kolom manajemen unit KPI">
                <table style={{ width: '100%', minWidth: '760px', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ color: '#475569', background: '#FFFFFF', borderBottom: '1px solid #D8E4EA' }}>
                      <th style={{ padding: '0.68rem 0.85rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Unit Kerja / Akun</th>
                      <th style={{ padding: '0.68rem 0.85rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Otoritas PIC</th>
                      <th style={{ padding: '0.68rem 0.85rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Status</th>
                      <th style={{ padding: '0.68rem 0.85rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Bukti Capaian</th>
                      <th style={{ padding: '0.68rem 0.85rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Skor Kontribusi</th>
                      <th style={{ padding: '0.68rem 0.85rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'right' }}>Tindakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitEntries.map(({ u, r, evList, effectiveStatus, assignedCount, verifiedCount, fileCount, linkCount }) => (
                      <tr key={u.email} style={{ borderTop: '1px solid #D8E4EA' }}>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <strong style={{ color: '#072534', display: 'block' }}>{u.name}</strong>
                          <small style={{ color: '#475569' }}>{u.email}</small>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                            {(u.picCodes || []).length > 0 ? (u.picCodes || []).map((code) => (
                              <span
                                key={code}
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  fontFamily: 'JetBrains Mono, monospace',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: '#EDF3F6',
                                  border: '1px solid #B8CAD4',
                                  color: '#072534',
                                }}
                              >
                                {code}
                              </span>
                            )) : <span style={{ color: '#475569' }}>-</span>}
                            <span style={{ fontSize: '0.69rem', color: '#475569', marginLeft: '0.2rem' }}>
                              ({assignedCount} baris)
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <span className={badgeFor(effectiveStatus)}>
                            <span className="ent-badge-dot" />
                            {labels[effectiveStatus] || 'Belum submit'}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', color: '#334155', fontSize: '0.73rem' }}>
                          {evList.length > 0 ? (
                            <div>
                              <strong style={{ color: '#072534' }}>{verifiedCount}/{evList.length}</strong> terverifikasi
                              <div style={{ fontSize: '0.67rem', color: '#475569' }}>
                                {fileCount > 0 ? `${fileCount} berkas` : ''}{fileCount > 0 && linkCount > 0 ? ' · ' : ''}{linkCount > 0 ? `${linkCount} tautan` : ''}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#475569' }}>Belum ada</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#072534' }}>
                          {r ? `${formatIndonesianNumber(r.totalScore, 2)} Poin` : '-'}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="gov-button"
                            onClick={() => updateSelected({ formId: f.id, email: u.email })}
                          >
                            {r ? 'Tinjau, Edit & Revisi' : 'Kelola & Edit Unit'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {unitEntries.length === 0 && (
                  <div className="gov-placeholder">Tidak ada unit KPI yang cocok dengan filter pencarian.</div>
                )}
              </HorizontalTableViewport>
            </div>

            <div className="resp-mobile-cards">
              {unitEntries.length === 0 ? (
                <div className="gov-placeholder">Tidak ada unit KPI yang cocok dengan filter pencarian.</div>
              ) : (
                unitEntries.map(({ u, r, evList, effectiveStatus, assignedCount, verifiedCount }) => (
                  <article
                    key={`mob-${f.id}-${u.email}`}
                    style={{
                      padding: '0.9rem 1rem',
                      borderTop: '1px solid #D8E4EA',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                      background: '#FFFFFF',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div>
                        <strong style={{ color: '#072534', fontSize: '0.84rem', display: 'block' }}>{u.name}</strong>
                        <small style={{ color: '#475569', fontSize: '0.72rem' }}>{u.email}</small>
                      </div>
                      <span className={badgeFor(effectiveStatus)}>
                        <span className="ent-badge-dot" />
                        {labels[effectiveStatus] || 'Belum submit'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.28rem', alignItems: 'center' }}>
                      {(u.picCodes || []).map((code) => (
                        <span
                          key={code}
                          style={{
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            fontFamily: 'JetBrains Mono, monospace',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#EDF3F6',
                            border: '1px solid #B8CAD4',
                            color: '#072534',
                          }}
                        >
                          {code}
                        </span>
                      ))}
                      <span style={{ fontSize: '0.7rem', color: '#475569' }}>({assignedCount} indikator PIC)</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', paddingTop: '0.2rem' }}>
                      <div style={{ fontSize: '0.73rem', color: '#334155' }}>
                        <strong>{r ? `${formatIndonesianNumber(r.totalScore, 2)} Poin` : 'Belum ada skor'}</strong>
                        {' · '}Bukti {verifiedCount}/{evList.length}
                      </div>
                      <button
                        type="button"
                        className="gov-button"
                        style={{ minHeight: '44px' }}
                        onClick={() => updateSelected({ formId: f.id, email: u.email })}
                      >
                        {r ? 'Tinjau, Edit & Revisi' : 'Kelola & Edit Unit'}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
          );
        })}
      </div>

      <section className="gov-table" aria-label="Rekap Audit Trail KPI Terpusat">
        <div className="gov-table-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2>Rekap Audit Trail KPI Terpusat</h2>
            <span>Jejak aktivitas pengiriman unit, verifikasi bukti dukung, perubahan struktur tabel, dan aturan validasi PRP</span>
          </div>
          <Link to="/internal/admin/governance?tab=audit" className="gov-button" style={{ textDecoration: 'none' }}>
            <History size={14} />
            <span>Buka Log Audit Lengkap</span>
          </Link>
        </div>
        {kpiAuditEntries.length === 0 ? (
          <div className="gov-placeholder">Belum ada rekaman aktivitas workflow KPI pada sesi ini.</div>
        ) : (
          <HorizontalTableViewport panLabel="Geser kolom log audit KPI">
            <table style={{ width: '100%', minWidth: '640px', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ color: '#475569', background: '#F7FAFB', borderBottom: '1px solid #D8E4EA' }}>
                  <th style={{ padding: '0.65rem 1.15rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Waktu</th>
                  <th style={{ padding: '0.65rem 1.15rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Aksi</th>
                  <th style={{ padding: '0.65rem 1.15rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pelaku / Akun</th>
                  <th style={{ padding: '0.65rem 1.15rem', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rincian Rekaman</th>
                </tr>
              </thead>
              <tbody>
                {kpiAuditEntries.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid #D8E4EA' }}>
                    <td style={{ padding: '0.68rem 1.15rem', color: '#475569', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {item.at ? new Date(item.at).toLocaleString('id-ID') : '-'}
                    </td>
                    <td style={{ padding: '0.68rem 1.15rem' }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          fontFamily: 'JetBrains Mono, monospace',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: '#EDF3F6',
                          border: '1px solid #B8CAD4',
                          color: '#094E68',
                        }}
                      >
                        {item.action}
                      </span>
                    </td>
                    <td style={{ padding: '0.68rem 1.15rem', fontWeight: 600, color: '#072534' }}>
                      {item.actor || 'Sistem'}
                    </td>
                    <td style={{ padding: '0.68rem 1.15rem', color: '#334155' }}>
                      {item.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalTableViewport>
        )}
      </section>

      {selected && form && (() => {
        const targetEmail = selected.email;
        const unitMeta = (form.units || []).find((u) => u.email?.toLowerCase() === targetEmail?.toLowerCase()) || {
          email: targetEmail,
          name: record?.unit || draft?.unit || targetEmail,
          picCodes: record?.picCodes || draft?.picCodes || [],
        };
        const unitDisplayName = record?.unit || draft?.unit || unitMeta.name || targetEmail;
        const unitPicCodes = record?.picCodes || draft?.picCodes || unitMeta.picCodes || [];
        const unitAssignedCount = record?.assignedIndicatorIds?.length
          ?? getEditableItemsForUser(form, { role: 'kpi_only', status: 'Aktif', email: targetEmail, picCodes: unitPicCodes, unit: unitDisplayName }).length;
        const activeUnitStatus = record?.status || (draft ? 'DRAFT' : 'EMPTY');
        const unitInitialValues = { ...(draft?.values || {}), ...(record?.values || {}) };
        const unitInitialNotes = { ...(draft?.notes || {}), ...(record?.notes || {}) };
        const currentValuesPayload = adminUnitEdits?.values ?? unitInitialValues;
        const currentNotesPayload = adminUnitEdits?.notes ?? unitInitialNotes;
        const unitEvidenceList = readUnitEvidence(form.id, targetEmail, state);
        const unitVerifiedEvidenceCount = unitEvidenceList.filter((ev) => ev.status === 'VERIFIED').length;

        const saveUnitEditsNow = (nextTransition = null) => {
          mutate(() => {
            saveUnitKpiByAdmin(form.id, targetEmail, currentUser, {
              values: currentValuesPayload,
              notes: currentNotesPayload,
              statusTransition: nextTransition,
              revisionNote: note.trim(),
            });
            setAdminUnitEdits(null);
            setSavedNotice(`Data KPI ${unitDisplayName} berhasil diperbarui${nextTransition ? ` (${labels[nextTransition] || nextTransition})` : ''}.`);
          });
        };

        const runUnitTransition = (status) => {
          if (status === 'LOCKED' || record?.status === 'LOCKED') {
            if (record?.status === 'LOCKED') {
              setPendingUnlock({
                formId: form.id,
                email: targetEmail,
                status,
                nextNote: note || 'Submission dibuka kembali oleh PRP',
                pendingEdits: adminUnitEdits,
              });
              return;
            }
          }
          mutate(() => {
            if (adminUnitEdits) {
              saveUnitKpiByAdmin(form.id, targetEmail, currentUser, {
                values: adminUnitEdits.values,
                notes: adminUnitEdits.notes,
              });
            }
            reviewUnitKpi(form.id, targetEmail, status, note || 'Disetujui dan terverifikasi oleh PRP', currentUser);
            setAdminUnitEdits(null);
            setSavedNotice(`Status unit ${unitDisplayName} diperbarui ke ${labels[status] || status}.`);
          });
        };

        const detailDialog = (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tinjauan & Revisi KPI Unit"
            data-lenis-prevent
            onClick={(event) => {
              if (event.target === event.currentTarget) updateSelected(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1400,
              background: 'rgba(6, 44, 61, 0.58)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 'max(0.65rem, env(safe-area-inset-top, 0px))',
              paddingRight: 'max(0.65rem, env(safe-area-inset-right, 0px))',
              paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(0.65rem, env(safe-area-inset-left, 0px))',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: 'min(1340px, 100%)',
                maxHeight: 'calc(100dvh - 1.3rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
                minWidth: 0,
                background: '#FFFFFF',
                border: '1px solid #B8CAD4',
                borderRadius: '8px',
                boxShadow: '0 20px 48px rgba(7, 37, 52, 0.22)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  padding: isMobileView ? '0.85rem 1rem' : 'clamp(0.9rem, 2vw, 1.25rem) clamp(1rem, 2.5vw, 1.5rem)',
                  borderBottom: '1px solid #D8E4EA',
                  background: '#F7FAFB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                  <div className="ent-eyebrow" style={{ marginBottom: '0.35rem' }}>
                    <ShieldCheck size={12} /> REVIEW, EDIT LANGSUNG &amp; REVISI PER UNIT
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'clamp(1rem, 2vw, 1.18rem)', fontFamily: 'Outfit, sans-serif', color: '#072534', overflowWrap: 'anywhere' }}>
                    {unitDisplayName} · Periode {form.period}
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '0.2rem', overflowWrap: 'anywhere' }}>
                    Akun: <strong>{targetEmail}</strong>
                    {unitPicCodes.length > 0 ? ` · Kode PIC: ${unitPicCodes.join(', ')}` : ''}
                    {` · ${unitAssignedCount} indikator tugas unit`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <span className={badgeFor(activeUnitStatus)}>
                    <span className="ent-badge-dot" />
                    {labels[activeUnitStatus] || activeUnitStatus}
                  </span>
                  <button
                    type="button"
                    className="ent-btn ent-btn-primary"
                    style={{ minHeight: '44px' }}
                    onClick={() => saveUnitEditsNow(null)}
                  >
                    <Save size={14} />
                    <span>{adminUnitEdits ? 'Simpan Editan Unit Ini*' : 'Simpan Nilai Unit Ini'}</span>
                  </button>
                  <button type="button" className="gov-button" style={{ minHeight: '44px' }} onClick={() => updateSelected(null)}>
                    <X size={15} /> Tutup Detail
                  </button>
                </div>
              </div>

              <div
                data-lenis-prevent
                style={{
                  padding: 'clamp(0.9rem, 2.2vw, 1.5rem)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  minWidth: 0,
                  flex: '1 1 auto',
                  minHeight: 0,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                }}
              >
                {error && (
                  <div role="alert" style={{ padding: '0.8rem 1rem', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#7F1D1D', fontSize: '0.8rem', fontWeight: 600 }}>
                    {error}
                  </div>
                )}
                {savedNotice && (
                  <div role="status" style={{ padding: '0.8rem 1rem', borderRadius: '8px', background: '#F0FDF4', border: '1px solid #86EFAC', color: '#14532D', fontSize: '0.8rem', fontWeight: 600 }}>
                    {savedNotice}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.15rem', minWidth: 0 }}>
                  <div className="ent-card" style={{ padding: '1.2rem', minWidth: 0 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                      Catatan pemeriksaan &amp; instruksi revisi PRP (berlaku saat meminta revisi, edit langsung, atau menolak)
                      <textarea
                        className="ent-textarea"
                        rows={3}
                        placeholder="Tuliskan catatan verifikasi, perbaikan isian, atau instruksi revisi untuk unit ini..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginTop: '0.95rem', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input type="checkbox" style={{ accentColor: '#094E68', width: '16px', height: '16px', flexShrink: 0 }} checked={complete} onChange={(e) => setComplete(e.target.checked)} />
                      <span>Saya telah memeriksa kesesuaian capaian, bukti fisik/digital, dan keterangan unit.</span>
                    </label>

                    <p style={{ margin: '0.65rem 0 0.95rem', fontSize: '0.75rem', color: '#475569' }}>
                      Bukti terverifikasi: <strong style={{ color: '#072534' }}>{unitVerifiedEvidenceCount}/{unitEvidenceList.length}</strong>
                      {unitEvidenceList.length && unitVerifiedEvidenceCount < unitEvidenceList.length ? '. Verifikasi seluruh bukti capaian sebelum menyetujui submission.' : ''}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="ent-btn"
                        style={{ minHeight: '44px', borderColor: '#094E68', color: '#094E68', background: '#EDF3F6' }}
                        onClick={() => saveUnitEditsNow(null)}
                      >
                        <PenLine size={14} />
                        <span>{adminUnitEdits ? 'Simpan Editan Isi Unit*' : 'Simpan Editan Isi Unit'}</span>
                      </button>

                      {!record ? (
                        <>
                          <button
                            type="button"
                            className="ent-btn ent-btn-primary"
                            style={{ minHeight: '44px' }}
                            onClick={() => saveUnitEditsNow('SUBMITTED')}
                          >
                            <Send size={14} />
                            <span>Simpan &amp; Ajukan atas Nama Unit</span>
                          </button>
                          <button
                            type="button"
                            className="ent-btn"
                            style={{ minHeight: '44px' }}
                            disabled={!note.trim()}
                            onClick={() => saveUnitEditsNow('NEEDS_REVISION')}
                          >
                            Kirim Revisi + Email ke Unit
                          </button>
                        </>
                      ) : (
                        (KPI_TRANSITIONS[record.status] || []).filter((s) => s !== 'SUBMITTED').map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={`ent-btn ${status === 'APPROVED' ? 'ent-btn-teal' : status === 'LOCKED' ? 'ent-btn-primary' : ''}`}
                            style={{ minHeight: '44px' }}
                            disabled={(status === 'APPROVED' && !complete) || (status !== 'APPROVED' && status !== 'LOCKED' && !note.trim())}
                            onClick={() => runUnitTransition(status)}
                          >
                            {status === 'APPROVED' && <Check size={14} />}
                            {actionLabel(record.status, status)}
                          </button>
                        ))
                      )}

                      {(record || draft || unitEvidenceList.length > 0) && (
                        <button
                          type="button"
                          className="ent-btn"
                          style={{ minHeight: '44px', borderColor: '#FCA5A5', color: '#991B1B', background: '#FEF2F2' }}
                          onClick={() => {
                            setPendingResetUnit({
                              formId: form.id,
                              email: targetEmail,
                              unitDisplayName,
                            });
                          }}
                        >
                          Reset Data Unit ke Semula
                        </button>
                      )}
                    </div>

                    {Object.keys(currentNotesPayload || {}).length > 0 && (
                      <div style={{ marginTop: '1rem', paddingTop: '0.9rem', borderTop: '1px solid #D8E4EA' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#072534', marginBottom: '0.45rem' }}>
                          Ringkasan Keterangan per Baris ({Object.keys(currentNotesPayload).length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto' }}>
                          {Object.entries(currentNotesPayload).map(([itemId, text]) => (
                            <div key={itemId} style={{ fontSize: '0.72rem', padding: '0.45rem 0.6rem', borderRadius: '6px', background: '#F7FAFB', border: '1px solid #D8E4EA', color: '#334155', overflowWrap: 'anywhere' }}>
                              <strong style={{ color: '#094E68' }}>{indicatorLabelById[itemId] || itemId}:</strong> {text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ent-card" style={{ padding: '1.2rem', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}>
                        Daftar Dokumen &amp; Tautan Bukti Capaian ({unitEvidenceList.length})
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="ent-btn"
                          style={{ minHeight: '44px', padding: '0.38rem 0.75rem', fontSize: '0.71rem' }}
                          onClick={() => {
                            const unitItems = getEditableItemsForUser(form, {
                              role: 'kpi_only',
                              status: 'Aktif',
                              email: targetEmail,
                              picCodes: unitPicCodes,
                              unit: unitDisplayName,
                            });
                            const firstId = unitItems[0]?.item?.id || form.sections?.[0]?.items?.[0]?.id || '';
                            setNewUnitEv((prev) => (prev ? null : {
                              indicatorId: firstId,
                              kind: 'file',
                              label: '',
                              url: '',
                              description: '',
                              file: null,
                            }));
                          }}
                        >
                          <Plus size={13} />
                          <span>{newUnitEv ? 'Tutup Form' : 'Tambah Bukti'}</span>
                        </button>
                        {unitEvidenceList.some((e) => e.status !== 'VERIFIED') && (
                          <button
                            type="button"
                            className="ent-btn ent-btn-teal"
                            style={{ minHeight: '44px', padding: '0.38rem 0.75rem', fontSize: '0.71rem' }}
                            onClick={() => mutate(() => {
                              const pendingList = readUnitEvidence(form.id, targetEmail, readKpiWorkflow()).filter((ev) => ev.status !== 'VERIFIED');
                              pendingList.forEach((ev) => {
                                reviewUnitEvidence(
                                  form.id,
                                  targetEmail,
                                  ev.id,
                                  'VERIFIED',
                                  note.trim() || 'Bukti capaian sesuai dan terverifikasi oleh PRP',
                                  currentUser,
                                );
                              });
                            })}
                          >
                            <CheckCircle2 size={13} />
                            <span>Verifikasi Semua Bukti</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {newUnitEv && (() => {
                      const selectableUnitItems = getEditableItemsForUser(form, {
                        role: 'kpi_only',
                        status: 'Aktif',
                        email: targetEmail,
                        picCodes: unitPicCodes,
                        unit: unitDisplayName,
                      });
                      const allItemsFallback = selectableUnitItems.length > 0
                        ? selectableUnitItems
                        : (form.sections || []).flatMap((section) => (section.items || []).map((item) => ({ section, item })));

                      return (
                        <div style={{ marginBottom: '0.85rem', padding: '0.8rem', borderRadius: '8px', background: '#EDF3F6', border: '1px solid #94B8C7', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.75rem', color: '#072534' }}>Tambah Bukti Baru untuk {unitDisplayName}</strong>
                          <select
                            className="gov-field"
                            aria-label="Indikator target bukti"
                            value={newUnitEv.indicatorId}
                            onChange={(e) => setNewUnitEv((prev) => ({ ...prev, indicatorId: e.target.value }))}
                          >
                            {allItemsFallback.map(({ section, item }) => (
                              <option key={item.id} value={item.id}>{section.code}.{item.no} {item.indikator}</option>
                            ))}
                          </select>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '0.45rem' }}>
                            <input
                              type="text"
                              className="gov-field"
                              placeholder="Judul dokumen/gambar bukti..."
                              value={newUnitEv.label}
                              onChange={(e) => setNewUnitEv((prev) => ({ ...prev, label: e.target.value }))}
                            />
                            <select
                              className="gov-field"
                              value={newUnitEv.kind}
                              onChange={(e) => setNewUnitEv((prev) => ({ ...prev, kind: e.target.value }))}
                            >
                              <option value="file">Unggah Gambar / PDF</option>
                              <option value="link">Tautan HTTPS / Drive</option>
                            </select>
                          </div>
                          {newUnitEv.kind === 'link' ? (
                            <input
                              type="url"
                              className="gov-field"
                              placeholder="https://drive.google.com/..."
                              value={newUnitEv.url}
                              onChange={(e) => setNewUnitEv((prev) => ({ ...prev, url: e.target.value }))}
                            />
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                                onChange={(event) => {
                                  const f = event.target.files?.[0];
                                  if (!f) return;
                                  const mime = String(f.type || '').toLowerCase();
                                  if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(mime) || f.size > MAX_EVIDENCE_FILE_BYTES) {
                                    setError('Format berkas wajib PDF/PNG/JPG/WEBP maksimal 2,5 MB.');
                                    event.target.value = '';
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    setNewUnitEv((prev) => ({
                                      ...prev,
                                      label: prev.label.trim() ? prev.label : f.name.replace(/\.[^.]+$/, ''),
                                      file: {
                                        fileName: f.name,
                                        mimeType: mime,
                                        fileSize: f.size,
                                        dataUrl: String(reader.result || ''),
                                      },
                                    }));
                                  };
                                  reader.readAsDataURL(f);
                                }}
                                style={{ fontSize: '0.73rem', color: '#334155', width: '100%' }}
                              />
                              {newUnitEv.file && (
                                <div style={{ fontSize: '0.68rem', color: '#14532D', fontWeight: 600, marginTop: '0.2rem' }}>
                                  Siap disimpan: {newUnitEv.file.fileName} ({formatBytes(newUnitEv.file.fileSize)})
                                </div>
                              )}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="ent-btn ent-btn-primary"
                              style={{ minHeight: '44px', fontSize: '0.72rem' }}
                              onClick={() => mutate(() => {
                                addUnitEvidenceByAdmin(form.id, targetEmail, currentUser, {
                                  indicatorId: newUnitEv.indicatorId,
                                  kind: newUnitEv.kind,
                                  label: newUnitEv.label,
                                  url: newUnitEv.url,
                                  description: newUnitEv.description,
                                  ...(newUnitEv.kind === 'file' ? (newUnitEv.file || {}) : {}),
                                });
                                setNewUnitEv(null);
                                setSavedNotice(`Bukti baru berhasil ditambahkan pada akun ${unitDisplayName}.`);
                              })}
                            >
                              <Save size={13} />
                              <span>Simpan Bukti Unit</span>
                            </button>
                            <button type="button" className="ent-btn" style={{ minHeight: '44px', fontSize: '0.72rem' }} onClick={() => setNewUnitEv(null)}>
                              Batal
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {!unitEvidenceList.length && (
                      <p style={{ color: '#475569', fontSize: '0.78rem', margin: 0 }}>
                        Belum ada bukti capaian yang dilampirkan unit ini. Admin PRP dapat menekan Tambah Bukti atau unggah langsung pada baris tabel di bawah.
                      </p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '380px', overflowY: 'auto' }}>
                      {unitEvidenceList.map((e) => {
                        const isFile = e.kind === 'file' || Boolean(e.dataUrl);
                        const isImg = /^image\//i.test(e.mimeType || '');
                        return (
                          <div
                            key={e.id}
                            style={{
                              padding: '0.75rem 0.85rem',
                              borderRadius: '8px',
                              background: '#F7FAFB',
                              border: '1px solid #D8E4EA',
                              fontSize: '0.75rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.45rem',
                              minWidth: 0,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#072534', overflowWrap: 'anywhere' }}>
                                  {isFile ? (isImg ? <ImageIcon size={14} color="#094E68" style={{ flexShrink: 0 }} /> : <FileText size={14} color="#094E68" style={{ flexShrink: 0 }} />) : <Link2 size={14} color="#094E68" style={{ flexShrink: 0 }} />}
                                  <span>{e.label}</span>
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.15rem', overflowWrap: 'anywhere' }}>
                                  Indikator: <strong>{indicatorLabelById[e.indicatorId] || e.indicatorId}</strong>
                                  {e.fileName ? ` · ${e.fileName} (${formatBytes(e.fileSize)})` : ''}
                                </div>
                              </div>
                              <span className={e.status === 'NEEDS_REVISION' ? 'ent-badge ent-badge-revision' : e.status === 'VERIFIED' ? 'ent-badge ent-badge-approved' : e.status === 'REJECTED' ? 'ent-badge ent-badge-rejected' : 'ent-badge'}>
                                {e.status === 'NEEDS_REVISION' ? 'PERLU REVISI' : e.status}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {isFile ? (
                                <>
                                  <button
                                    type="button"
                                    className="gov-button"
                                    style={{ minHeight: '44px', padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}
                                    onClick={() => setPreviewDoc({ ...e, _formId: form.id, _email: targetEmail })}
                                  >
                                    <Eye size={12} /> Pratinjau
                                  </button>
                                  {e.dataUrl && (
                                    <a
                                      href={e.dataUrl}
                                      download={e.fileName || `${e.label}.pdf`}
                                      className="gov-button"
                                      style={{ minHeight: '44px', padding: '0.35rem 0.7rem', fontSize: '0.7rem', textDecoration: 'none' }}
                                    >
                                      <Download size={12} /> Unduh
                                    </a>
                                  )}
                                </>
                              ) : (
                                <a
                                  href={e.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="gov-button"
                                  style={{ minHeight: '44px', padding: '0.35rem 0.7rem', fontSize: '0.7rem', textDecoration: 'none' }}
                                >
                                  <ExternalLink size={12} /> Buka Tautan
                                </a>
                              )}

                              <button
                                type="button"
                                className="ent-btn"
                                style={{ minHeight: '44px', padding: '0.35rem 0.7rem', fontSize: '0.7rem', borderColor: '#F59E0B', background: '#FFFBEB', color: '#92400E' }}
                                onClick={() => setEvActionPanel((prev) => (prev?.id === e.id && prev.mode === 'revise'
                                  ? null
                                  : { id: e.id, mode: 'revise', note: e.note || note || '' }))}
                              >
                                <MessageSquareWarning size={12} /> Revisi Bukti
                              </button>

                              <button
                                type="button"
                                className="ent-btn"
                                style={{ minHeight: '44px', padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}
                                onClick={() => setEvActionPanel((prev) => (prev?.id === e.id && prev.mode === 'edit'
                                  ? null
                                  : {
                                    id: e.id,
                                    mode: 'edit',
                                    label: e.label || '',
                                    kind: e.kind || 'link',
                                    url: e.url || '',
                                    description: e.description || '',
                                    file: null,
                                  }))}
                              >
                                <PenLine size={12} /> Edit Bukti
                              </button>

                              {e.status !== 'VERIFIED' && (
                                <button
                                  type="button"
                                  className="ent-btn ent-btn-teal"
                                  style={{ minHeight: '44px', padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}
                                  onClick={() => mutate(() => reviewUnitEvidence(
                                    form.id,
                                    targetEmail,
                                    e.id,
                                    'VERIFIED',
                                    note.trim() || 'Bukti capaian sesuai dan terverifikasi oleh PRP',
                                    currentUser,
                                  ))}
                                >
                                  Verifikasi Bukti
                                </button>
                              )}
                              {e.status !== 'REJECTED' && (
                                <button
                                  type="button"
                                  className="ent-btn"
                                  style={{ minHeight: '44px', padding: '0.35rem 0.7rem', fontSize: '0.7rem', color: '#7F1D1D' }}
                                  disabled={!note.trim()}
                                  title={note.trim() ? '' : 'Tuliskan alasan penolakan pada kolom catatan terlebih dahulu'}
                                  onClick={() => mutate(() => reviewUnitEvidence(form.id, targetEmail, e.id, 'REJECTED', note, currentUser))}
                                >
                                  Tolak Bukti
                                </button>
                              )}
                              <button
                                type="button"
                                className="ent-btn"
                                style={{ minHeight: '44px', padding: '0.35rem 0.7rem', fontSize: '0.7rem', color: '#991B1B', borderColor: '#FCA5A5', background: '#FEF2F2' }}
                                aria-label={`Hapus bukti ${e.label}`}
                                onClick={() => mutate(() => {
                                  removeUnitEvidenceByAdmin(form.id, targetEmail, currentUser, e.id);
                                  setSavedNotice(`Bukti "${e.label}" dihapus oleh Admin PRP.`);
                                })}
                              >
                                <Trash2 size={12} /> Hapus
                              </button>
                            </div>

                            {evActionPanel?.id === e.id && evActionPanel.mode === 'revise' && (
                              <div style={{ marginTop: '0.3rem', padding: '0.6rem', borderRadius: '6px', background: '#FFFBEB', border: '1px solid #F59E0B', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                <strong style={{ fontSize: '0.71rem', color: '#78350F' }}>
                                  Catatan Revisi Gambar / Dokumen ({e.label})
                                </strong>
                                <textarea
                                  rows={2}
                                  className="ent-textarea"
                                  placeholder="Jelaskan revisi pada gambar/PDF/tautan bukti ini (misal: lampiran buram atau belum bertanda tangan)..."
                                  value={evActionPanel.note || ''}
                                  onChange={(ev) => setEvActionPanel((prev) => ({ ...prev, note: ev.target.value }))}
                                />
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="ent-btn ent-btn-primary"
                                    style={{ minHeight: '44px', fontSize: '0.71rem', background: '#92400E', borderColor: '#92400E' }}
                                    onClick={() => mutate(() => {
                                      reviewUnitEvidence(form.id, targetEmail, e.id, 'NEEDS_REVISION', evActionPanel.note || '', currentUser);
                                      setEvActionPanel(null);
                                      setSavedNotice(`Permintaan revisi bukti "${e.label}" terkirim via Notifikasi Web + Email ke unit.`);
                                    })}
                                  >
                                    <Send size={12} /> Kirim Revisi Bukti + Email
                                  </button>
                                  <button type="button" className="ent-btn" style={{ minHeight: '44px', fontSize: '0.71rem' }} onClick={() => setEvActionPanel(null)}>
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}

                            {evActionPanel?.id === e.id && evActionPanel.mode === 'edit' && (
                              <div style={{ marginTop: '0.3rem', padding: '0.6rem', borderRadius: '6px', background: '#FFFFFF', border: '1px solid #94B8C7', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                <strong style={{ fontSize: '0.71rem', color: '#072534' }}>
                                  Edit / Ganti Berkas Bukti ({e.label})
                                </strong>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: '0.4rem' }}>
                                  <input
                                    type="text"
                                    className="gov-field"
                                    placeholder="Judul dokumen bukti..."
                                    value={evActionPanel.label || ''}
                                    onChange={(ev) => setEvActionPanel((prev) => ({ ...prev, label: ev.target.value }))}
                                  />
                                  <select
                                    className="gov-field"
                                    value={evActionPanel.kind || 'link'}
                                    onChange={(ev) => setEvActionPanel((prev) => ({ ...prev, kind: ev.target.value }))}
                                  >
                                    <option value="file">Berkas Gambar / PDF</option>
                                    <option value="link">Tautan HTTPS / Drive</option>
                                  </select>
                                </div>
                                {evActionPanel.kind === 'link' ? (
                                  <input
                                    type="url"
                                    className="gov-field"
                                    placeholder="https://drive.google.com/..."
                                    value={evActionPanel.url || ''}
                                    onChange={(ev) => setEvActionPanel((prev) => ({ ...prev, url: ev.target.value }))}
                                  />
                                ) : (
                                  <div>
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                                      onChange={(event) => {
                                        const f = event.target.files?.[0];
                                        if (!f) return;
                                        const mime = String(f.type || '').toLowerCase();
                                        if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(mime) || f.size > MAX_EVIDENCE_FILE_BYTES) {
                                          setError('Format wajib PDF/PNG/JPG/WEBP maksimal 2,5 MB.');
                                          event.target.value = '';
                                          return;
                                        }
                                        const reader = new FileReader();
                                        reader.onload = () => {
                                          setEvActionPanel((prev) => ({
                                            ...prev,
                                            file: {
                                              fileName: f.name,
                                              mimeType: mime,
                                              fileSize: f.size,
                                              dataUrl: String(reader.result || ''),
                                            },
                                          }));
                                        };
                                        reader.readAsDataURL(f);
                                      }}
                                      style={{ fontSize: '0.72rem', color: '#334155', width: '100%' }}
                                    />
                                    <div style={{ fontSize: '0.67rem', color: '#475569', marginTop: '0.2rem' }}>
                                      {evActionPanel.file
                                        ? `Berkas pengganti siap: ${evActionPanel.file.fileName} (${formatBytes(evActionPanel.file.fileSize)})`
                                        : (e.fileName ? `Saat ini: ${e.fileName}. Biarkan kosong jika tidak mengganti berkas.` : 'Pilih file PDF/PNG/JPG/WEBP maks. 2,5 MB.')}
                                    </div>
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="ent-btn ent-btn-primary"
                                    style={{ minHeight: '44px', fontSize: '0.71rem' }}
                                    onClick={() => mutate(() => {
                                      const updated = updateUnitEvidenceByAdmin(form.id, targetEmail, currentUser, e.id, {
                                        label: evActionPanel.label,
                                        kind: evActionPanel.kind,
                                        url: evActionPanel.url,
                                        description: evActionPanel.description,
                                        ...(evActionPanel.kind === 'file' && evActionPanel.file ? evActionPanel.file : {}),
                                      });
                                      setEvActionPanel(null);
                                      setSavedNotice(`Bukti "${updated.label}" berhasil diedit Admin PRP.`);
                                    })}
                                  >
                                    <Save size={12} /> Simpan Perubahan Bukti
                                  </button>
                                  <button type="button" className="ent-btn" style={{ minHeight: '44px', fontSize: '0.71rem' }} onClick={() => setEvActionPanel(null)}>
                                    Batal
                                  </button>
                                </div>
                              </div>
                            )}

                            {e.note && <div style={{ color: e.status === 'NEEDS_REVISION' ? '#92400E' : '#475569', fontSize: '0.7rem', fontWeight: e.status === 'NEEDS_REVISION' ? 700 : 400, overflowWrap: 'anywhere' }}>Catatan verifikasi/revisi: {e.note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {(record?.history || []).length > 0 && (
                  <div className="ent-card" style={{ padding: '1rem 1.2rem', minWidth: 0 }}>
                    <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.86rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}>
                      Riwayat Audit Submission &amp; Snapshot ({record.history.length})
                    </h4>
                    {(record.history || []).map((h, index) => (
                      <details key={index} style={{ padding: '0.55rem 0', borderTop: index > 0 ? '1px solid #D8E4EA' : 'none', fontSize: '0.74rem' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155', overflowWrap: 'anywhere' }}>
                          {new Date(h.at).toLocaleString('id-ID')} · {h.from} {'->'} {h.status} · {h.actor?.email || 'Sistem'} {h.note ? `· ${h.note}` : ''}
                        </summary>
                        <pre style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: '6px', background: '#F7FAFB', border: '1px solid #D8E4EA', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '0.68rem', color: '#334155' }}>
                          {JSON.stringify(
                            {
                              ...h.snapshot,
                              evidence: (h.snapshot?.evidence || []).map((ev) => ({
                                ...ev,
                                dataUrl: ev.dataUrl ? `[Berkas tertanam ${formatBytes(ev.fileSize)}]` : '',
                              })),
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}

                <div style={{ minWidth: 0, maxWidth: '100%' }}>
                  <KPIDataEntrySheet
                    key={`${form.id}:${targetEmail}:${activeUnitStatus}`}
                    period={form.period}
                    sectionsOverride={form.sections}
                    valuesOverride={unitInitialValues}
                    notesOverride={unitInitialNotes}
                    evidenceOverride={unitEvidenceList}
                    contributorMapOverride={selectedFormBoard?.contributorsByItem}
                    integratedBoardOverride={selectedFormBoard}
                    highlightPicCodes={unitPicCodes}
                    adminUnitContext={{
                      formId: form.id,
                      email: targetEmail,
                      unitName: unitDisplayName,
                      picCodes: unitPicCodes,
                      status: activeUnitStatus,
                      period: form.period,
                    }}
                    onAdminUnitDraftChange={setAdminUnitEdits}
                    persist={false}
                    readOnly={false}
                  />
                </div>
              </div>
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(detailDialog, document.body) : detailDialog;
      })()}

      <EvidencePreviewModal
        evidence={previewDoc}
        onClose={() => setPreviewDoc(null)}
        adminActions={previewDoc && (previewDoc._formId || form?.id) && (previewDoc._email || selected?.email) ? {
          onReview: (ev, status, reviewNote) => {
            const fId = previewDoc._formId || form?.id;
            const em = previewDoc._email || selected?.email;
            reviewUnitEvidence(fId, em, ev.id, status, reviewNote, currentUser);
            const refreshed = readUnitEvidence(fId, em, readKpiWorkflow()).find((item) => item.id === ev.id);
            if (refreshed) setPreviewDoc({ ...refreshed, _formId: fId, _email: em });
            setSavedNotice(`Status bukti "${ev.label}" diperbarui menjadi ${status === 'NEEDS_REVISION' ? 'Perlu Revisi' : status}.`);
          },
          onUpdate: (ev, metadata) => {
            const fId = previewDoc._formId || form?.id;
            const em = previewDoc._email || selected?.email;
            const updated = updateUnitEvidenceByAdmin(fId, em, currentUser, ev.id, metadata);
            setPreviewDoc({ ...updated, _formId: fId, _email: em });
            setSavedNotice(`Bukti "${updated.label}" berhasil diperbarui Admin PRP.`);
          },
        } : null}
      />

      {pendingUnlock && (() => {
        const unlockDialog = (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="kpi-unlock-title"
            onClick={(event) => {
              if (event.target === event.currentTarget) setPendingUnlock(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1450,
              background: 'rgba(6, 44, 61, 0.58)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
              paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
              paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
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
                id="kpi-unlock-title"
                style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}
              >
                Buka Kunci Submission KPI
              </h3>
              <p style={{ margin: '0 0 1.15rem', fontSize: '0.84rem', lineHeight: 1.55, color: '#334155' }}>
                Buka kembali submission yang sudah dikunci untuk <strong>{pendingUnlock.email}</strong>? Unit dapat mengubah data capaian lagi.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button type="button" className="ent-btn" style={{ minHeight: '44px' }} onClick={() => setPendingUnlock(null)}>
                  Batal
                </button>
                <button
                  type="button"
                  className="ent-btn ent-btn-primary"
                  style={{ minHeight: '44px' }}
                  onClick={() => {
                    const target = pendingUnlock;
                    setPendingUnlock(null);
                    mutate(() => {
                      if (target.pendingEdits) {
                        saveUnitKpiByAdmin(target.formId, target.email, currentUser, {
                          values: target.pendingEdits.values,
                          notes: target.pendingEdits.notes,
                        });
                      }
                      reviewUnitKpi(target.formId, target.email, target.status, target.nextNote, currentUser);
                      setAdminUnitEdits(null);
                    });
                  }}
                >
                  Ya, Buka Kunci
                </button>
              </div>
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(unlockDialog, document.body) : unlockDialog;
      })()}

      {pendingResetUnit && (() => {
        const resetDialog = (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kpi-reset-unit-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10025,
              background: 'rgba(7, 37, 52, 0.58)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setPendingResetUnit(null);
            }}
          >
            <div
              style={{
                width: 'min(440px, 100%)',
                background: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #64748B',
                boxShadow: '0 24px 48px rgba(7, 37, 52, 0.22)',
                padding: '1.35rem',
              }}
            >
              <h3
                id="kpi-reset-unit-title"
                style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}
              >
                Reset Data Unit ke Semula
              </h3>
              <p style={{ margin: '0 0 1.15rem', fontSize: '0.84rem', lineHeight: 1.55, color: '#334155' }}>
                Hapus dan reset seluruh isian uji coba milik <strong>{pendingResetUnit.unitDisplayName}</strong> ({pendingResetUnit.email}) kembali ke Belum Diisi (0,00)?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button type="button" className="ent-btn" style={{ minHeight: '44px' }} onClick={() => setPendingResetUnit(null)}>
                  Batal
                </button>
                <button
                  type="button"
                  className="ent-btn"
                  style={{ minHeight: '44px', borderColor: '#DC2626', background: '#DC2626', color: '#FFFFFF' }}
                  onClick={() => {
                    const target = pendingResetUnit;
                    setPendingResetUnit(null);
                    mutate(() => {
                      resetUnitKpiByAdmin(target.formId, target.email, currentUser);
                      updateSelected(null);
                    });
                  }}
                >
                  Ya, Reset Data Unit
                </button>
              </div>
            </div>
          </div>
        );
        return typeof document !== 'undefined' ? createPortal(resetDialog, document.body) : resetDialog;
      })()}
    </div>
  );
}
