import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Settings2, Upload, ArrowUpRight, RotateCcw } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Link, useSearchParams } from 'react-router-dom';
import KPITableDesigner from '../components/KPITableDesigner';
import KPISubmissionInbox from '../components/KPISubmissionInbox';
import AllSubmissionsTable from '../components/AllSubmissionsTable';
import SystemSettings from '../components/SystemSettings';
import { readAudit, readSystemConfig, writeAudit } from '../adminStore';
import { useAuth } from '../../auth/context/AuthContext';

gsap.registerPlugin(ScrollTrigger);

const DEFAULT_PERIODS = [
  { id: '2025/2026', label: 'Tahun Akademik 2025/2026', start: '2025-08-01', end: '2026-07-31', status: 'Active', inputOpen: true },
  { id: '2024/2025', label: 'Tahun Akademik 2024/2025', start: '2024-08-01', end: '2025-07-31', status: 'Archived', inputOpen: false },
];

const TABS = [
  { idx: '01', id: 'kpi-builder', label: 'Desainer Tabel KPI', desc: 'Struktur & formula' },
  { idx: '02', id: 'submissions', label: 'Pusat Review Unit', desc: 'Inbox IKU & KPI' },
  { idx: '03', id: 'periods', label: 'Periode & Tenggat', desc: 'Siklus akademik' },
  { idx: '04', id: 'audit', label: 'Audit Trail', desc: 'Jejak aktivitas' },
  { idx: '05', id: 'settings', label: 'Kebijakan Sistem', desc: 'Parameter global' },
];

const VALID_TAB_IDS = new Set(TABS.map((t) => t.id));

const readJSON = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};

export default function PRPGovernance() {
  const { currentUser } = useAuth();
  const actor = currentUser?.name || currentUser?.email || 'Admin lokal';
  const pageRef = useRef(null);
  const tabStageRef = useRef(null);
  const tabBarRef = useRef(null);
  const tabLineRef = useRef(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = VALID_TAB_IDS.has(rawTab) ? rawTab : 'kpi-builder';

  const selectTab = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const [periods, setPeriods] = useState(() => readJSON('prp_periods', DEFAULT_PERIODS));
  const [audit, setAudit] = useState(() => readJSON('prp_audit', []));
  const [feedback, setFeedback] = useState('');
  const [search, setSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState({ action: '', actor: '', from: '', to: '' });
  const [kpiSelected, setKpiSelected] = useState(null);

  useEffect(() => {
    const refresh = () => setAudit(readAudit());
    window.addEventListener('prp-admin-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('prp-admin-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const auditActions = useMemo(() => [...new Set(audit.map((item) => item.action).filter(Boolean))].sort(), [audit]);
  const auditActors = useMemo(() => [...new Set(audit.map((item) => item.actor).filter(Boolean))].sort(), [audit]);
  const filteredAudit = audit.filter((item) => {
    const day = typeof item.at === 'string' ? item.at.slice(0, 10) : '';
    return (
      [item.action, item.detail, item.actor, item.at].join(' ').toLowerCase().includes(search.toLowerCase()) &&
      (!auditFilter.action || item.action === auditFilter.action) &&
      (!auditFilter.actor || item.actor === auditFilter.actor) &&
      (!auditFilter.from || day >= auditFilter.from) &&
      (!auditFilter.to || day <= auditFilter.to)
    );
  });

  /** Unduh audit terfilter sebagai berkas JSON atau CSV (CSV aman untuk koma/kutip). */
  const downloadAudit = (format) => {
    const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const body =
      format === 'csv'
        ? ['waktu,aksi,pelaku,detail', ...filteredAudit.map((item) => [item.at, item.action, item.actor, item.detail].map(cell).join(','))].join('\r\n')
        : JSON.stringify(filteredAudit, null, 2);
    const type = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';
    const url = URL.createObjectURL(new Blob([format === 'csv' ? '\ufeff' + body : body], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `prp-audit.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
    writeAudit('EXPORT_AUDIT', `${filteredAudit.length} entri (${format.toUpperCase()})`, actor);
  };

  const validatePeriods = (items) => {
    if (!Array.isArray(items) || !items.length) throw new Error('Daftar periode harus berisi minimal satu periode.');
    const ids = new Set();
    const validDate = (value) =>
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value;
    for (const period of items) {
      if (
        !period ||
        typeof period.id !== 'string' ||
        !period.id.trim() ||
        ids.has(period.id) ||
        typeof period.label !== 'string' ||
        !period.label.trim() ||
        !['Active', 'Draft', 'Archived'].includes(period.status) ||
        typeof period.inputOpen !== 'boolean' ||
        !validDate(period.start) ||
        !validDate(period.end) ||
        period.start > period.end
      ) {
        throw new Error('Setiap periode wajib memiliki ID unik, nama, status, flag input, dan rentang tanggal yang valid.');
      }
      ids.add(period.id);
      const deadline = period.submissionDeadline;
      if (
        deadline !== undefined &&
        (typeof deadline !== 'string' ||
          (deadline &&
            (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline) ||
              !validDate(deadline.slice(0, 10)) ||
              !Number.isFinite(new Date(deadline).getTime()) ||
              deadline.slice(11) > '23:59' ||
              deadline.slice(14) > '59' ||
              deadline.slice(0, 10) < period.start ||
              deadline.slice(0, 10) > period.end)))
      ) {
        throw new Error('Tenggat periode harus valid dan berada dalam rentang awal sampai akhir periode.');
      }
    }
    if (items.filter((period) => period.status === 'Active').length > 1) throw new Error('Hanya satu periode boleh aktif.');
  };

  // Entrance Masthead Choreography
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.gov-title-line', { yPercent: 115 }, { yPercent: 0, duration: 0.78, stagger: 0.06 })
      .fromTo(
        '.gov-reveal',
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.04, clearProps: 'transform' },
        '-=0.5'
      )
      .fromTo(
        '.gov-keyline',
        { scaleX: 0 },
        { scaleX: 1, transformOrigin: 'left center', duration: 0.85, ease: 'expo.inOut' },
        '-=0.55'
      );
  }, { scope: pageRef });

  // Sliding Underline Bar + Stage Transition saat berpindah sub-tab
  useGSAP(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (tabBarRef.current && tabLineRef.current) {
      const activeBtn = tabBarRef.current.querySelector('[data-tab-active="true"]');
      if (activeBtn) {
        gsap.to(tabLineRef.current, {
          x: activeBtn.offsetLeft,
          width: activeBtn.offsetWidth,
          opacity: 1,
          duration: reduced ? 0 : 0.4,
          ease: 'expo.out',
          overwrite: 'auto',
        });
      }
    }

    if (reduced || !tabStageRef.current) return undefined;
    gsap.fromTo(
      tabStageRef.current,
      { opacity: 0, y: 14 },
      {
        opacity: 1,
        y: 0,
        duration: 0.45,
        ease: 'expo.out',
        clearProps: 'transform',
        onComplete: () => ScrollTrigger.refresh(),
      }
    );
  }, { dependencies: [activeTab] });

  const activePeriod = useMemo(
    () => periods.find((period) => period.status === 'Active') || periods[0],
    [periods]
  );

  const savePeriods = (next, detail = 'Periode evaluasi diperbarui') => {
    try {
      validatePeriods(next);
      const previous = readJSON('prp_periods', DEFAULT_PERIODS);
      if (JSON.stringify(previous) === JSON.stringify(next)) return;
      localStorage.setItem('prp_periods', JSON.stringify(next));
      writeAudit('PERIODE_EVALUASI', detail, actor);
      setPeriods(next);
      window.dispatchEvent(new CustomEvent('prp-admin-updated'));
      setFeedback('Perubahan periode berhasil disimpan dan diaudit.');
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const updatePeriod = (id, field, value) => {
    savePeriods(
      periods.map((period) => {
        if (period.id === id) return { ...period, [field]: value };
        if (field === 'status' && value === 'Active') return { ...period, status: 'Archived' };
        return period;
      }),
      `Periode ${id}: ${field} -> ${String(value)}${field === 'status' && value === 'Active' ? '; periode aktif lainnya diarsipkan' : ''}`
    );
  };

  const addPeriod = () =>
    savePeriods([
      ...periods,
      {
        id: `Periode-${Date.now()}`,
        label: 'Periode evaluasi baru',
        start: new Date().toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
        status: 'Draft',
        inputOpen: false,
        submissionDeadline: '',
      },
    ]);

  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ periods, audit }, null, 2)], { type: 'application/json' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'prp-governance.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        validatePeriods(data.periods);
        const clean = data.periods.map(
          ({ id, label, start, end, status, inputOpen, submissionDeadline = '' }) => ({
            id,
            label,
            start,
            end,
            status,
            inputOpen,
            submissionDeadline,
          })
        );
        savePeriods(clean, `Import ${clean.length} periode; audit file diabaikan`);
      } catch (error) {
        setFeedback(`Import ditolak: ${error.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <section ref={pageRef} className="governance-page">
      <style>{`
        .governance-page {
          max-width: 1680px;
          margin: 0 auto;
          padding: 0 0 4rem;
          color: #072534;
        }
        .gov-meta-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding-bottom: 0.9rem;
          border-bottom: 1px solid #D8E4EA;
          font-family: var(--ent-mono);
          font-size: 0.66rem;
          color: #475569;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .gov-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 1.5rem;
          padding: 1.65rem 0 1.4rem;
        }
        .gov-title {
          margin: 0;
          font: 800 clamp(1.85rem, 3.2vw, 2.75rem)/1.04 Outfit, sans-serif;
          letter-spacing: -0.04em;
          color: #072534;
        }
        .gov-title-mask {
          overflow: hidden;
          display: block;
          padding-bottom: 0.05em;
        }
        .gov-title-line {
          display: block;
          will-change: transform;
        }
        .gov-lede {
          max-width: 680px;
          margin: 0.75rem 0 0;
          color: #334155;
          font-size: 0.9rem;
          line-height: 1.65;
        }
        .gov-keyline {
          width: 100%;
          height: 2px;
          background: #094E68;
        }
        .gov-layout {
          display: flex;
          flex-direction: column;
          gap: 1.35rem;
        }
        .gov-tabs {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          border-bottom: 1px solid #D8E4EA;
          background: #ffffff;
        }
        .gov-tabs-list {
          position: relative;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.25rem;
        }
        .gov-tab-underline {
          position: absolute;
          left: 0;
          bottom: -1px;
          height: 2.5px;
          width: 0;
          background: #094E68;
          opacity: 0;
          pointer-events: none;
        }
        .gov-tab {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          gap: 0.48rem;
          padding: 0.75rem 0.95rem;
          border: none;
          border-radius: 6px 6px 0 0;
          background: transparent;
          color: #475569;
          text-align: left;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.18s ease, background-color 0.18s ease;
        }
        .gov-tab:hover {
          color: #072534;
          background: #F7FAFB;
        }
        .gov-tab.active {
          color: #094E68;
          font-weight: 700;
        }
        .gov-tab-idx {
          font-family: var(--ent-mono);
          font-size: 0.64rem;
          color: #475569;
          font-weight: 600;
        }
        .gov-tab.active .gov-tab-idx {
          color: #0E7480;
          font-weight: 700;
        }
        .gov-button {
          position: relative;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          box-sizing: border-box;
          padding: 0.5rem 0.9rem;
          border: 1px solid #D8E4EA;
          border-radius: 7px;
          background: #ffffff;
          color: #072534;
          font-weight: 600;
          font-size: 0.75rem;
          cursor: pointer;
          text-decoration: none;
          transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
          white-space: nowrap;
        }
        .gov-button:hover:not(:disabled) {
          background: #F7FAFB;
          border-color: #094E68;
        }
        .gov-button:focus-within {
          outline: 2px solid #0E7480;
          outline-offset: 2px;
        }
        .gov-button-primary {
          background: #094E68;
          color: #ffffff;
          border-color: #094E68;
        }
        .gov-button-primary:hover:not(:disabled) {
          background: #072534;
          color: #ffffff;
          border-color: #072534;
        }
        .gov-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .gov-table {
          border: 1px solid #D8E4EA;
          border-radius: 8px;
          background: #ffffff;
          overflow: hidden;
        }
        .gov-table-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 1.05rem 1.25rem;
          border-bottom: 1px solid #D8E4EA;
          background: #F7FAFB;
        }
        .gov-table-head h2 {
          margin: 0;
          font: 800 1rem Outfit, sans-serif;
          color: #072534;
          letter-spacing: -0.015em;
        }
        .gov-table-head span {
          display: block;
          margin-top: 0.2rem;
          color: #475569;
          font-size: 0.75rem;
        }
        .gov-field {
          display: block;
          width: 100%;
          min-height: 40px;
          box-sizing: border-box;
          padding: 0.56rem 0.75rem;
          border: 1px solid #D8E4EA;
          border-radius: 6px;
          background: #ffffff;
          color: #072534;
          font: inherit;
          font-size: 0.8rem;
          transition: border-color 0.18s ease;
        }
        .gov-field::placeholder {
          color: #64748b;
        }
        .gov-field:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: 1px;
          border-color: #094E68;
        }
        .gov-period-row {
          display: grid;
          grid-template-columns: minmax(170px, 1.2fr) 145px 145px minmax(200px, 1.2fr) 120px 130px;
          gap: 0.75rem;
          align-items: center;
          padding: 0.95rem 1.25rem;
          border-bottom: 1px solid #D8E4EA;
          font-size: 0.78rem;
          transition: background-color 0.18s ease;
        }
        .gov-period-row:hover {
          background: #F7FAFB;
        }
        .gov-period-row:last-child {
          border-bottom: none;
        }
        .gov-period-row input:not([type="checkbox"]),
        .gov-period-row select {
          width: 100%;
          min-height: 40px;
          box-sizing: border-box;
          padding: 0.48rem 0.65rem;
          border: 1px solid #D8E4EA;
          border-radius: 6px;
          font-size: 0.78rem;
          background: #ffffff;
          color: #072534;
        }
        .gov-period-row input:not([type="checkbox"]):focus-visible,
        .gov-period-row select:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: 1px;
          border-color: #094E68;
        }
        .gov-period-row label {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: #072534;
          font-weight: 600;
          cursor: pointer;
        }
        .gov-audit-row {
          display: grid;
          grid-template-columns: 205px 1fr 175px;
          gap: 1rem;
          align-items: center;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid #D8E4EA;
          font-size: 0.78rem;
          transition: background-color 0.18s ease;
        }
        .gov-audit-row:hover {
          background: #F7FAFB;
        }
        .gov-audit-row:last-child {
          border-bottom: none;
        }
        .gov-placeholder {
          padding: 2.5rem 1.5rem;
          text-align: center;
          color: #475569;
          font-size: 0.84rem;
        }
        .gov-feedback-banner {
          margin-bottom: 0.85rem;
          padding: 0.75rem 1rem;
          border-left: 3px solid #094E68;
          background: #F7FAFB;
          border-top: 1px solid #D8E4EA;
          border-right: 1px solid #D8E4EA;
          border-bottom: 1px solid #D8E4EA;
          border-radius: 0 6px 6px 0;
          color: #072534;
          font-size: 0.8rem;
          font-weight: 600;
        }
        @media (max-width: 1024px) {
          .gov-period-row {
            grid-template-columns: 1fr 1fr;
          }
          .gov-audit-row {
            grid-template-columns: 1fr;
            gap: 0.35rem;
          }
          .gov-audit-time {
            text-align: left !important;
          }
        }
        @media (max-width: 640px) {
          .gov-period-row {
            grid-template-columns: 1fr;
          }
          .gov-button {
            min-height: 44px;
          }
        }
      `}</style>

      <div className="gov-meta-top gov-reveal">
        <span style={{ color: '#094E68', fontWeight: 700 }}>PRP // TATA KELOLA SISTEM</span>
        <span>
          SIKLUS AKTIF: <strong style={{ color: '#072534' }}>{activePeriod?.label || 'Belum diatur'}</strong>
        </span>
      </div>

      <div className="gov-head">
        <div>
          <h1 className="gov-title">
            <span className="gov-title-mask">
              <span className="gov-title-line">Konfigurasi &amp; Tata Kelola</span>
            </span>
          </h1>
          <p className="gov-lede gov-reveal">
            Pengaturan struktur tabel dan formula KPI, pusat verifikasi submission lintas unit, manajemen siklus evaluasi akademik, serta audit kebijakan institusi.
          </p>
        </div>
        <div className="gov-reveal" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="gov-button" onClick={exportData}>
            <Download size={14} /> Ekspor JSON
          </button>
          <label className="gov-button">
            <Upload size={14} /> Impor JSON
            <input className="gov-sr-only" type="file" accept="application/json" onChange={importData} />
          </label>
        </div>
      </div>

      <div className="gov-keyline" />

      <div className="gov-layout">
        <div className="gov-tabs gov-reveal">
          <div ref={tabBarRef} role="tablist" aria-label="Sub-modul tata kelola PRP" className="gov-tabs-list">
            {TABS.map(({ idx, id, label }) => {
              const isSelected = activeTab === id;
              return (
                <button
                  key={id}
                  id={`gov-tab-${id}`}
                  role="tab"
                  aria-selected={isSelected}
                  type="button"
                  data-tab-active={isSelected ? 'true' : undefined}
                  className={`gov-tab ${isSelected ? 'active' : ''}`}
                  onClick={() => selectTab(id)}
                >
                  <span className="gov-tab-idx">{idx}</span>
                  <span>{label}</span>
                </button>
              );
            })}
            <div ref={tabLineRef} className="gov-tab-underline" aria-hidden="true" />
          </div>
        </div>

        <div ref={tabStageRef} role="tabpanel" aria-labelledby={`gov-tab-${activeTab}`} style={{ minWidth: 0 }}>
          {feedback && (
            <div role="status" aria-live="polite" className="gov-feedback-banner">
              {feedback}
            </div>
          )}

          {activeTab === 'kpi-builder' && <KPITableDesigner />}

          {activeTab === 'submissions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div
                className="ent-card"
                style={{
                  padding: '1.05rem 1.3rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <strong
                    style={{
                      fontSize: '0.95rem',
                      fontFamily: 'Outfit, sans-serif',
                      color: '#072534',
                      display: 'block',
                    }}
                  >
                    Pusat Review Terpadu: IKU Kementerian &amp; KPI Operasional
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                    Verifikasi kelengkapan isian, tautan bukti pendukung HTTPS, serta persetujuan dan penguncian data unit.
                  </span>
                </div>
                <Link to="/internal/iku-submissions" className="gov-button gov-button-primary">
                  Buka Review Submission IKU <ArrowUpRight size={14} />
                </Link>
              </div>
              <AllSubmissionsTable onReviewKpi={(target) => setKpiSelected({ ...target })} />
              <KPISubmissionInbox selected={kpiSelected} onSelect={setKpiSelected} />
            </div>
          )}

          {activeTab === 'settings' && <SystemSettings />}

          {activeTab === 'periods' && (
            <div className="gov-table">
              <div className="gov-table-head">
                <div>
                  <h2>Manajemen Periode Evaluasi</h2>
                  <span>Hanya satu periode yang dapat berstatus Aktif untuk pengisian KPI dan IKU secara serentak</span>
                </div>
                <button type="button" className="gov-button gov-button-primary" onClick={addPeriod}>
                  + Tambah Periode Baru
                </button>
              </div>
              {periods.map((period) => (
                <div className="gov-period-row" key={period.id}>
                  <input
                    aria-label="Nama periode"
                    key={`label-${period.label}`}
                    defaultValue={period.label}
                    onBlur={(event) => updatePeriod(period.id, 'label', event.target.value.trim())}
                  />
                  <input
                    aria-label="Tanggal mulai"
                    key={`start-${period.start}`}
                    type="date"
                    defaultValue={period.start || ''}
                    onBlur={(event) => updatePeriod(period.id, 'start', event.target.value)}
                  />
                  <input
                    aria-label="Tanggal akhir"
                    key={`end-${period.end}`}
                    type="date"
                    defaultValue={period.end || ''}
                    onBlur={(event) => updatePeriod(period.id, 'end', event.target.value)}
                  />
                  <div>
                    <input
                      aria-label="Tenggat periode opsional"
                      key={`deadline-${period.submissionDeadline}`}
                      type="datetime-local"
                      defaultValue={period.submissionDeadline || ''}
                      onBlur={(event) => updatePeriod(period.id, 'submissionDeadline', event.target.value)}
                    />
                    <small style={{ display: 'block', marginTop: '4px', color: '#475569', fontSize: '0.68rem' }}>
                      Tenggat global: {readSystemConfig().submissionDeadline || 'Belum diatur'}
                    </small>
                  </div>
                  <select
                    aria-label={`Status periode ${period.label}`}
                    value={period.status}
                    onChange={(event) => updatePeriod(period.id, 'status', event.target.value)}
                  >
                    <option>Active</option>
                    <option>Draft</option>
                    <option>Archived</option>
                  </select>
                  <label>
                    <input
                      type="checkbox"
                      checked={period.inputOpen !== false}
                      onChange={(event) => updatePeriod(period.id, 'inputOpen', event.target.checked)}
                    />
                    Input dibuka
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="gov-table">
              <div className="gov-table-head">
                <div>
                  <h2>Log Audit Aktivitas Sistem</h2>
                  <span>Rekam jejak perubahan konfigurasi, pengguna, dan keputusan review (maksimum 500 entri lokal)</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="gov-button" onClick={() => selectTab('settings')}>
                    <Settings2 size={14} /> Kebijakan Sistem
                  </button>
                  <button type="button" className="gov-button" onClick={() => downloadAudit('csv')}>
                    <Download size={14} /> Ekspor CSV ({filteredAudit.length})
                  </button>
                  <button type="button" className="gov-button" onClick={() => downloadAudit('json')}>
                    <Download size={14} /> Ekspor JSON
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
                  gap: '0.65rem',
                  padding: '0.95rem 1.25rem',
                  background: '#F7FAFB',
                  borderBottom: '1px solid #D8E4EA',
                }}
              >
                <input
                  className="gov-field"
                  type="search"
                  aria-label="Cari audit"
                  placeholder="Cari aktivitas, detail, pelaku..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select
                  className="gov-field"
                  aria-label="Filter aksi"
                  value={auditFilter.action}
                  onChange={(e) => setAuditFilter((f) => ({ ...f, action: e.target.value }))}
                >
                  <option value="">Semua aksi</option>
                  {auditActions.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <select
                  className="gov-field"
                  aria-label="Filter pelaku"
                  value={auditFilter.actor}
                  onChange={(e) => setAuditFilter((f) => ({ ...f, actor: e.target.value }))}
                >
                  <option value="">Semua pelaku</option>
                  {auditActors.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <input
                  className="gov-field"
                  type="date"
                  aria-label="Dari tanggal"
                  value={auditFilter.from}
                  onChange={(e) => setAuditFilter((f) => ({ ...f, from: e.target.value }))}
                />
                <input
                  className="gov-field"
                  type="date"
                  aria-label="Sampai tanggal"
                  value={auditFilter.to}
                  onChange={(e) => setAuditFilter((f) => ({ ...f, to: e.target.value }))}
                />
                <button
                  type="button"
                  className="gov-button"
                  onClick={() => {
                    setSearch('');
                    setAuditFilter({ action: '', actor: '', from: '', to: '' });
                  }}
                >
                  <RotateCcw size={13} /> Reset Filter
                </button>
              </div>
              {filteredAudit.length ? (
                filteredAudit.map((item) => (
                  <div className="gov-audit-row" key={item.id}>
                    <div>
                      <strong style={{ color: '#072534', fontSize: '0.76rem', fontFamily: 'var(--ent-mono)', letterSpacing: '0.02em' }}>
                        {item.action}
                      </strong>
                      <small style={{ display: 'block', color: '#475569', marginTop: '2px', fontSize: '0.72rem' }}>
                        {item.actor || 'Pelaku tidak tercatat'}
                      </small>
                    </div>
                    <span style={{ color: '#334155', lineHeight: 1.5 }}>{item.detail}</span>
                    <time
                      className="gov-audit-time"
                      dateTime={item.at}
                      style={{
                        color: '#475569',
                        fontFamily: 'var(--ent-mono)',
                        fontSize: '0.71rem',
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'right',
                      }}
                    >
                      {Number.isFinite(Date.parse(item.at)) ? new Date(item.at).toLocaleString('id-ID') : item.at}
                    </time>
                  </div>
                ))
              ) : (
                <div className="gov-placeholder">Tidak ada aktivitas audit yang sesuai dengan kriteria pencarian.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
