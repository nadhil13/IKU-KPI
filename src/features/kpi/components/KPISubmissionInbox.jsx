import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Check, ExternalLink, Eye, Download, FileText, Image as ImageIcon,
  Link2, Search, ShieldCheck, X, Layers, History, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../auth/hooks/useAuth';
import { KPI_SECTIONS_CONFIG } from '../kpiTemplateConfig';
import KPIDataEntrySheet, { EvidencePreviewModal } from './KPIDataEntrySheet';
import {
  KPI_TRANSITIONS,
  readKpiWorkflow,
  readUnitSubmission,
  readUnitDraft,
  readUnitEvidence,
  reviewUnitKpi,
  reviewUnitEvidence,
  resetUnitKpiByAdmin,
  subscribeKpiWorkflow,
  readIntegratedKpiBoard,
  ensureDefaultKpiDistribution,
  getEditableItemsForUser,
} from '../kpiWorkflowStore';
import { formatIndonesianNumber } from '../kpiSchema';
import { readAudit } from '../../internal/adminStore';

const labels = {
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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [note, setNote] = useState('');
  const [complete, setComplete] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState(null);
  const [error, setError] = useState('');

  const selected = controlledSelected !== undefined ? controlledSelected : localSelected;
  const updateSelected = useCallback((next) => {
    if (onSelect) onSelect(next);
    else setLocalSelected(next);
    setNote('');
    setComplete(false);
    setError('');
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
    () => (latestForm ? readIntegratedKpiBoard(latestForm.id, state) : null),
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
  const selectedFormBoard = useMemo(
    () => (form ? readIntegratedKpiBoard(form.id, state) : null),
    [form, state],
  );

  useEffect(() => {
    if (!record || !form) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (pendingUnlock) setPendingUnlock(null);
        else if (!previewDoc) updateSelected(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [record, form, previewDoc, pendingUnlock, updateSelected]);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {latestForm && integratedBoard && boardMetrics && (
        <section className="gov-table" aria-label="Papan Integrasi Sistem Pusat KPI">
          <div className="gov-table-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
            <div>
              <h2>Papan Integrasi Sistem Pusat KPI Lintas Unit &amp; PIC</h2>
              <span>
                Rekonsiliasi otomatis capaian, bukti dukung, dan keterangan dari seluruh unit kerja pada Periode {latestForm.period} (Versi v{latestForm.version})
              </span>
            </div>
            <button
              type="button"
              className="ent-btn ent-btn-primary"
              style={{ minHeight: '44px' }}
              onClick={() => setShowIntegratedSheet((prev) => !prev)}
            >
              <Layers size={14} />
              <span>{showIntegratedSheet ? 'Sembunyikan Tabel Terpusat' : 'Buka Tabel Rekonsiliasi Indikator'}</span>
            </button>
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
                Skor Institusi Terpusat
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#072534', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                {formatIndonesianNumber(integratedBoard.totalScore, 2)} <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>/ 100 Poin</span>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: '#F7FAFB', border: '1px solid #D8E4EA' }}>
              <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Cakupan Indikator Terisi
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#094E68', marginTop: '0.2rem', fontVariantNumeric: 'tabular-nums' }}>
                {integratedBoard.filledIndicatorCount} / {integratedBoard.totalIndicatorCount} <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>Baris</span>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: '#F7FAFB', border: '1px solid #D8E4EA' }}>
              <div style={{ fontSize: '0.67rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Status Pengajuan Unit PIC
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#072534', marginTop: '0.35rem', lineHeight: 1.45 }}>
                {boardMetrics.submittedCount} Menunggu Review · {boardMetrics.approvedCount} Disetujui · {boardMetrics.draftCount} Draft
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

          {showIntegratedSheet && (
            <div style={{ padding: 'clamp(0.75rem, 2vw, 1.3rem)', borderTop: '1px solid #D8E4EA', background: '#F7FAFB', minWidth: 0, maxWidth: '100%', overflowX: 'auto' }}>
              <KPIDataEntrySheet
                key={`integrated:${latestForm.id}:${auditTick}`}
                period={latestForm.period}
                sectionsOverride={latestForm.sections}
                valuesOverride={integratedBoard.values}
                notesOverride={integratedBoard.notes}
                evidenceOverride={Object.values(integratedBoard.evidenceByItem || {}).flat()}
                contributorMapOverride={integratedBoard.contributorsByItem}
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

        {error && !record && (
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

        {[...state.forms].reverse().map((f) => (
          <section key={f.id} style={{ borderBottom: '1px solid #D8E4EA' }}>
            <div style={{ padding: '0.8rem 1.3rem', background: '#F7FAFB', borderBottom: '1px solid #D8E4EA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: '#072534', fontFamily: 'Outfit, sans-serif' }}>
                Periode {f.period} · Versi v{f.version}
              </h3>
              <span className="ent-badge">{f.units.length} akun unit/PIC terdaftar</span>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                <thead>
                  <tr style={{ color: '#475569', background: '#FFFFFF', borderBottom: '1px solid #D8E4EA' }}>
                    <th style={{ padding: '0.68rem 1.15rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Unit Kerja / Akun</th>
                    <th style={{ padding: '0.68rem 1.15rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Otoritas PIC</th>
                    <th style={{ padding: '0.68rem 1.15rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Status</th>
                    <th style={{ padding: '0.68rem 1.15rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Bukti Capaian</th>
                    <th style={{ padding: '0.68rem 1.15rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Skor Kontribusi</th>
                    <th style={{ padding: '0.68rem 1.15rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {f.units
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

                      return (
                        <tr key={u.email} style={{ borderTop: '1px solid #D8E4EA' }}>
                          <td style={{ padding: '0.78rem 1.15rem' }}>
                            <strong style={{ color: '#072534', display: 'block' }}>{u.name}</strong>
                            <small style={{ color: '#475569' }}>{u.email}</small>
                          </td>
                          <td style={{ padding: '0.78rem 1.15rem' }}>
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
                          <td style={{ padding: '0.78rem 1.15rem' }}>
                            <span className={badgeFor(effectiveStatus)}>
                              <span className="ent-badge-dot" />
                              {labels[effectiveStatus] || 'Belum submit'}
                            </span>
                          </td>
                          <td style={{ padding: '0.78rem 1.15rem', color: '#334155', fontSize: '0.73rem' }}>
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
                          <td style={{ padding: '0.78rem 1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#072534' }}>
                            {r ? `${formatIndonesianNumber(r.totalScore, 2)} Poin` : '-'}
                          </td>
                          <td style={{ padding: '0.78rem 1.15rem' }}>
                            {r && (
                              <button
                                type="button"
                                className="gov-button"
                                onClick={() => updateSelected({ formId: f.id, email: u.email })}
                              >
                                Tinjau &amp; Verifikasi
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
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
          <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
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
          </div>
        )}
      </section>

      {record && form && (() => {
        const detailDialog = (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tinjauan KPI Unit"
            data-lenis-prevent
            onClick={(event) => {
              if (event.target === event.currentTarget) updateSelected(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1300,
              background: 'rgba(6, 44, 61, 0.58)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: 'clamp(0.65rem, 2.5vw, 1.75rem)',
              overflowY: 'auto',
              overflowX: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                width: 'min(1340px, 100%)',
                minWidth: 0,
                background: '#FFFFFF',
                border: '1px solid #B8CAD4',
                borderRadius: '8px',
                boxShadow: '0 20px 48px rgba(7, 37, 52, 0.22)',
                overflow: 'hidden',
                margin: 'auto 0',
              }}
            >
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  padding: 'clamp(0.9rem, 2vw, 1.25rem) clamp(1rem, 2.5vw, 1.5rem)',
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
                    <ShieldCheck size={12} /> VERIFIKASI SUBMISSION &amp; BUKTI CAPAIAN KPI
                  </div>
                  <h3 style={{ margin: 0, fontSize: 'clamp(1rem, 2vw, 1.18rem)', fontFamily: 'Outfit, sans-serif', color: '#072534', overflowWrap: 'anywhere' }}>
                    {record.unit} · Periode {form.period}
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '0.2rem', overflowWrap: 'anywhere' }}>
                    Akun: <strong>{record.email}</strong>
                    {(record.picCodes || []).length > 0 ? ` · Kode PIC: ${record.picCodes.join(', ')}` : ''}
                    {Array.isArray(record.assignedIndicatorIds) ? ` · ${record.assignedIndicatorIds.length} indikator ditugaskan` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <span className={badgeFor(record.status)}>
                    <span className="ent-badge-dot" />
                    {labels[record.status]}
                  </span>
                  <button type="button" className="gov-button" style={{ minHeight: '44px' }} onClick={() => updateSelected(null)}>
                    <X size={15} /> Tutup Detail
                  </button>
                </div>
              </div>

              <div style={{ padding: 'clamp(0.9rem, 2.2vw, 1.5rem)', display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
                {error && (
                  <div role="alert" style={{ padding: '0.8rem 1rem', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#7F1D1D', fontSize: '0.8rem', fontWeight: 600 }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.15rem', minWidth: 0 }}>
                  <div className="ent-card" style={{ padding: '1.2rem', minWidth: 0 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                      Catatan pemeriksaan PRP (wajib diisi saat menolak bukti, meminta revisi, atau menolak submission)
                      <textarea
                        className="ent-textarea"
                        rows={3}
                        placeholder="Tuliskan catatan verifikasi atau instruksi revisi untuk unit kerja..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginTop: '0.95rem', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                      <input type="checkbox" style={{ accentColor: '#094E68', width: '16px', height: '16px', flexShrink: 0 }} checked={complete} onChange={(e) => setComplete(e.target.checked)} />
                      <span>Saya telah memeriksa kesesuaian capaian, bukti fisik/digital, dan keterangan unit.</span>
                    </label>

                    {(() => {
                      const items = readUnitEvidence(form.id, record.email, state);
                      const verified = items.filter((e) => e.status === 'VERIFIED').length;
                      return (
                        <p style={{ margin: '0.65rem 0 0.95rem', fontSize: '0.75rem', color: '#475569' }}>
                          Bukti terverifikasi: <strong style={{ color: '#072534' }}>{verified}/{items.length}</strong>
                          {items.length && verified < items.length ? '. Verifikasi seluruh bukti capaian sebelum menyetujui submission.' : ''}
                        </p>
                      );
                    })()}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {(KPI_TRANSITIONS[record.status] || []).filter((s) => s !== 'SUBMITTED').map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`ent-btn ${status === 'APPROVED' ? 'ent-btn-teal' : status === 'LOCKED' ? 'ent-btn-primary' : ''}`}
                          style={{ minHeight: '44px' }}
                          disabled={(status === 'APPROVED' && !complete) || (status !== 'APPROVED' && status !== 'LOCKED' && !note.trim())}
                          onClick={() => {
                            if (record.status === 'LOCKED') {
                              setPendingUnlock({
                                formId: form.id,
                                email: record.email,
                                status,
                                nextNote: note || 'Submission dibuka kembali oleh PRP',
                              });
                              return;
                            }
                            mutate(() => reviewUnitKpi(form.id, record.email, status, note || 'Disetujui dan terverifikasi oleh PRP', currentUser));
                          }}
                        >
                          {status === 'APPROVED' && <Check size={14} />}
                          {actionLabel(record.status, status)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="ent-btn"
                        style={{ minHeight: '44px', borderColor: '#FCA5A5', color: '#991B1B', background: '#FEF2F2' }}
                        onClick={() => {
                          const ok = typeof window === 'undefined'
                            || window.confirm(`Hapus & reset data submission uji coba milik ${record.unit} (${record.email}) kembali ke Belum Diisi (0,00)?`);
                          if (!ok) return;
                          mutate(() => {
                            resetUnitKpiByAdmin(form.id, record.email, currentUser);
                            updateSelected(null);
                          });
                        }}
                      >
                        Reset Data Unit ke Semula
                      </button>
                    </div>

                    {record.notes && Object.keys(record.notes).length > 0 && (
                      <div style={{ marginTop: '1rem', paddingTop: '0.9rem', borderTop: '1px solid #D8E4EA' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#072534', marginBottom: '0.45rem' }}>
                          Ringkasan Keterangan per Baris ({Object.keys(record.notes).length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto' }}>
                          {Object.entries(record.notes).map(([itemId, text]) => (
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
                        Daftar Dokumen &amp; Tautan Bukti Capaian ({readUnitEvidence(form.id, record.email, state).length})
                      </h4>
                      {record.status === 'SUBMITTED' && readUnitEvidence(form.id, record.email, state).some((e) => e.status !== 'VERIFIED') && (
                        <button
                          type="button"
                          className="ent-btn ent-btn-teal"
                          style={{ minHeight: '40px', padding: '0.38rem 0.75rem', fontSize: '0.71rem' }}
                          onClick={() => mutate(() => {
                            const pendingList = readUnitEvidence(form.id, record.email, readKpiWorkflow()).filter((ev) => ev.status !== 'VERIFIED');
                            pendingList.forEach((ev) => {
                              reviewUnitEvidence(
                                form.id,
                                record.email,
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

                    {!readUnitEvidence(form.id, record.email, state).length && (
                      <p style={{ color: '#475569', fontSize: '0.78rem', margin: 0 }}>Belum ada bukti capaian yang dilampirkan oleh unit ini.</p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '340px', overflowY: 'auto' }}>
                      {readUnitEvidence(form.id, record.email, state).map((e) => {
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
                              <span className="ent-badge">{e.status}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {isFile ? (
                                <>
                                  <button
                                    type="button"
                                    className="gov-button"
                                    style={{ minHeight: '38px', padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}
                                    onClick={() => setPreviewDoc(e)}
                                  >
                                    <Eye size={12} /> Pratinjau Dokumen
                                  </button>
                                  {e.dataUrl && (
                                    <a
                                      href={e.dataUrl}
                                      download={e.fileName || `${e.label}.pdf`}
                                      className="gov-button"
                                      style={{ minHeight: '38px', padding: '0.35rem 0.7rem', fontSize: '0.7rem', textDecoration: 'none' }}
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
                                  style={{ minHeight: '38px', padding: '0.35rem 0.7rem', fontSize: '0.7rem', textDecoration: 'none' }}
                                >
                                  <ExternalLink size={12} /> Buka Tautan
                                </a>
                              )}

                              {record.status === 'SUBMITTED' && (
                                <>
                                  <button
                                    type="button"
                                    className="ent-btn ent-btn-teal"
                                    style={{ minHeight: '38px', padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}
                                    onClick={() => mutate(() => reviewUnitEvidence(
                                      form.id,
                                      record.email,
                                      e.id,
                                      'VERIFIED',
                                      note.trim() || 'Bukti capaian sesuai dan terverifikasi oleh PRP',
                                      currentUser,
                                    ))}
                                  >
                                    Verifikasi Bukti
                                  </button>
                                  <button
                                    type="button"
                                    className="ent-btn"
                                    style={{ minHeight: '38px', padding: '0.35rem 0.7rem', fontSize: '0.7rem', color: '#7F1D1D' }}
                                    disabled={!note.trim()}
                                    title={note.trim() ? '' : 'Tuliskan alasan penolakan pada kolom catatan terlebih dahulu'}
                                    onClick={() => mutate(() => reviewUnitEvidence(form.id, record.email, e.id, 'REJECTED', note, currentUser))}
                                  >
                                    Tolak Bukti
                                  </button>
                                </>
                              )}
                            </div>

                            {e.note && <div style={{ color: '#475569', fontSize: '0.7rem', overflowWrap: 'anywhere' }}>Catatan verifikasi: {e.note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {(record.history || []).length > 0 && (
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

                <div style={{ minWidth: 0, maxWidth: '100%', overflowX: 'auto' }}>
                  <KPIDataEntrySheet
                    key={`${form.id}:${record.email}:${record.status}`}
                    period={form.period}
                    sectionsOverride={form.sections}
                    valuesOverride={{ ...(selectedFormBoard?.values || {}), ...(record.values || {}) }}
                    notesOverride={{ ...(selectedFormBoard?.notes || {}), ...(record.notes || {}) }}
                    evidenceOverride={readUnitEvidence(form.id, record.email, state)}
                    contributorMapOverride={selectedFormBoard?.contributorsByItem}
                    highlightPicCodes={record.picCodes}
                    persist={false}
                    readOnly
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
                    mutate(() => reviewUnitKpi(target.formId, target.email, target.status, target.nextNote, currentUser));
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
    </div>
  );
}
