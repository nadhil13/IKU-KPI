import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, Settings2, Upload, ArrowUpRight, RotateCcw
} from 'lucide-react';
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
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
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
    return [item.action, item.detail, item.actor, item.at].join(' ').toLowerCase().includes(search.toLowerCase())
      && (!auditFilter.action || item.action === auditFilter.action)
      && (!auditFilter.actor || item.actor === auditFilter.actor)
      && (!auditFilter.from || day >= auditFilter.from)
      && (!auditFilter.to || day <= auditFilter.to);
  });

  /** Unduh audit terfilter sebagai berkas JSON atau CSV (CSV aman untuk koma/kutip). */
  const downloadAudit = (format) => {
    const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const body = format === 'csv'
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
    const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    for (const period of items) {
      if (!period || typeof period.id !== 'string' || !period.id.trim() || ids.has(period.id) || typeof period.label !== 'string' || !period.label.trim()
        || !['Active', 'Draft', 'Archived'].includes(period.status) || typeof period.inputOpen !== 'boolean'
        || !validDate(period.start) || !validDate(period.end) || period.start > period.end) {
        throw new Error('Setiap periode wajib memiliki ID unik, nama, status, flag input, dan rentang tanggal yang valid.');
      }
      ids.add(period.id);
      const deadline = period.submissionDeadline;
      if (deadline !== undefined && (typeof deadline !== 'string' || (deadline && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline) || !validDate(deadline.slice(0, 10)) || !Number.isFinite(new Date(deadline).getTime()) || deadline.slice(11) > '23:59' || deadline.slice(14) > '59' || deadline.slice(0, 10) < period.start || deadline.slice(0, 10) > period.end)))) {
        throw new Error('Tenggat periode harus valid dan berada dalam rentang awal–akhir periode.');
      }
    }
    if (items.filter((period) => period.status === 'Active').length > 1) throw new Error('Hanya satu periode boleh aktif.');
  };

  // Entrance Masthead Choreography
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(
      '.gov-title-line',
      { yPercent: 115 },
      { yPercent: 0, duration: 0.82, stagger: 0.07 }
    )
      .fromTo(
        '.gov-reveal',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, clearProps: 'transform' },
        '-=0.55'
      )
      .fromTo(
        '.gov-keyline',
        { scaleX: 0 },
        { scaleX: 1, transformOrigin: 'left center', duration: 0.9, ease: 'expo.inOut' },
        '-=0.6'
      );
  }, { scope: pageRef });

  // Sliding Underline Bar + Masked Stage Transition saat berpindah sub-tab
  useGSAP(() => {
    if (tabBarRef.current && tabLineRef.current) {
      const activeBtn = tabBarRef.current.querySelector('[data-tab-active="true"]');
      if (activeBtn) {
        gsap.to(tabLineRef.current, {
          x: activeBtn.offsetLeft,
          width: activeBtn.offsetWidth,
          opacity: 1,
          duration: 0.45,
          ease: 'expo.out',
          overwrite: 'auto',
        });
      }
    }

    if (!tabStageRef.current) return;
    gsap.fromTo(
      tabStageRef.current,
      { opacity: 0, y: 18, clipPath: 'inset(0% 0% 3% 0%)' },
      {
        opacity: 1,
        y: 0,
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 0.52,
        ease: 'expo.out',
        clearProps: 'transform,clipPath',
        onComplete: () => ScrollTrigger.refresh(),
      }
    );
  }, { dependencies: [activeTab] });

  const activePeriod = useMemo(() => periods.find((period) => period.status === 'Active') || periods[0], [periods]);

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
    savePeriods(periods.map((period) => {
      if (period.id === id) return { ...period, [field]: value };
      if (field === 'status' && value === 'Active') return { ...period, status: 'Archived' };
      return period;
    }), `Periode ${id}: ${field} → ${String(value)}${field === 'status' && value === 'Active' ? '; periode aktif lainnya diarsipkan' : ''}`);
  };

  const addPeriod = () => savePeriods([
    ...periods,
    { id: `Periode-${Date.now()}`, label: 'Periode evaluasi baru', start: new Date().toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10), status: 'Draft', inputOpen: false, submissionDeadline: '' },
  ]);

  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ periods, audit }, null, 2)], { type: 'application/json' }));
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
        const clean = data.periods.map(({ id, label, start, end, status, inputOpen, submissionDeadline = '' }) => ({ id, label, start, end, status, inputOpen, submissionDeadline }));
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
          color: #09090b;
        }
        .gov-meta-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding-bottom: 0.9rem;
          border-bottom: 1px solid #e4e4e7;
          font-family: var(--ent-mono);
          font-size: 0.65rem;
          color: #71717a;
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
          font: 800 clamp(1.85rem, 3.2vw, 2.75rem)/1.03 Outfit, sans-serif;
          letter-spacing: -0.04em;
          color: #09090b;
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
          color: #52525b;
          font-size: 0.86rem;
          line-height: 1.65;
        }
        .gov-keyline {
          width: 100%;
          height: 1.5px;
          background: #09090b;
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
          border-bottom: 1px solid #e4e4e7;
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
          height: 2px;
          width: 0;
          background: #09090b;
          opacity: 0;
          pointer-events: none;
        }
        .gov-tabs-actions {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0;
          margin-left: auto;
        }
        .gov-tab {
          display: inline-flex;
          align-items: center;
          gap: 0.48rem;
          padding: 0.85rem 0.9rem;
          border: none;
          background: transparent;
          color: #71717a;
          text-align: left;
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s ease;
        }
        .gov-tab:hover {
          color: #09090b;
        }
        .gov-tab.active {
          color: #09090b;
          font-weight: 700;
        }
        .gov-tab-idx {
          font-family: var(--ent-mono);
          font-size: 0.62rem;
          color: #a1a1aa;
          font-weight: 600;
        }
        .gov-tab.active .gov-tab-idx {
          color: #09090b;
          font-weight: 700;
        }
        .gov-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.42rem;
          box-sizing: border-box;
          padding: 0.48rem 0.85rem;
          border: 1px solid #d4d4d8;
          border-radius: 6px;
          background: #ffffff;
          color: #09090b;
          font-weight: 600;
          font-size: 0.73rem;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.18s ease;
          white-space: nowrap;
        }
        .gov-button:hover:not(:disabled) {
          background: #f4f4f5;
          border-color: #09090b;
        }
        .gov-button-primary {
          background: #09090b;
          color: #ffffff;
          border-color: #09090b;
        }
        .gov-button-primary:hover:not(:disabled) {
          background: #27272a;
          color: #ffffff;
          border-color: #27272a;
        }
        .gov-table {
          border: 1px solid #e4e4e7;
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
          border-bottom: 1px solid #e4e4e7;
          background: #fafafa;
        }
        .gov-table-head h2 {
          margin: 0;
          font: 800 0.96rem Outfit, sans-serif;
          color: #09090b;
          letter-spacing: -0.015em;
        }
        .gov-table-head span {
          display: block;
          margin-top: 0.18rem;
          color: #71717a;
          font-size: 0.72rem;
        }
        .gov-field {
          display: block;
          width: 100%;
          box-sizing: border-box;
          padding: 0.56rem 0.75rem;
          border: 1px solid #d4d4d8;
          border-radius: 6px;
          background: #ffffff;
          color: #09090b;
          font: inherit;
          font-size: 0.78rem;
          outline: none;
          transition: border-color 0.18s ease;
        }
        .gov-field:focus {
          border-color: #09090b;
        }
        .gov-period-row {
          display: grid;
          grid-template-columns: minmax(170px, 1.2fr) 140px 140px minmax(200px, 1.2fr) 115px 125px;
          gap: 0.75rem;
          align-items: center;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid #e4e4e7;
          font-size: 0.76rem;
          transition: background 0.18s ease;
        }
        .gov-period-row:hover {
          background: #fafafa;
        }
        .gov-period-row:last-child {
          border-bottom: none;
        }
        .gov-period-row input:not([type="checkbox"]),
        .gov-period-row select {
          width: 100%;
          box-sizing: border-box;
          padding: 0.48rem 0.62rem;
          border: 1px solid #d4d4d8;
          border-radius: 6px;
          font-size: 0.75rem;
          background: #ffffff;
          color: #09090b;
          outline: none;
        }
        .gov-period-row input:not([type="checkbox"]):focus,
        .gov-period-row select:focus {
          border-color: #09090b;
        }
        .gov-period-row label {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: #27272a;
          font-weight: 600;
          cursor: pointer;
        }
        .gov-audit-row {
          display: grid;
          grid-template-columns: 200px 1fr 175px;
          gap: 1rem;
          align-items: center;
          padding: 0.85rem 1.25rem;
          border-bottom: 1px solid #e4e4e7;
          font-size: 0.76rem;
          transition: background 0.18s ease;
        }
        .gov-audit-row:hover {
          background: #fafafa;
        }
        .gov-audit-row:last-child {
          border-bottom: none;
        }
        .gov-placeholder {
          padding: 2.5rem 1.5rem;
          text-align: center;
          color: #71717a;
          font-size: 0.82rem;
        }
        .gov-feedback-banner {
          margin-bottom: 0.85rem;
          padding: 0.7rem 0.95rem;
          border-left: 2px solid #09090b;
          background: #fafafa;
          border-top: 1px solid #e4e4e7;
          border-right: 1px solid #e4e4e7;
          border-bottom: 1px solid #e4e4e7;
          color: #09090b;
          font-size: 0.78rem;
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
          .gov-tabs-actions {
            width: 100%;
            justify-content: flex-start;
            margin-left: 0;
          }
        }
      `}</style>

      <div className="gov-meta-top gov-reveal">
        <span>SYS // PRP.GOVERNANCE</span>
        <span>SIKLUS AKTIF: <strong style={{ color: '#09090b' }}>{activePeriod?.label || 'Belum diatur'}</strong></span>
      </div>

      <div className="gov-head">
        <div>
          <h1 className="gov-title">
            <span className="gov-title-mask">
              <span className="gov-title-line">Konfigurasi &amp; Tata Kelola</span>
            </span>
          </h1>
          <p className="gov-lede gov-reveal">
            Arsitektur tabel dan formula KPI, pusat verifikasi submission lintas unit, manajemen siklus evaluasi akademik, serta audit kebijakan institusi.
          </p>
        </div>
        <div className="gov-reveal" style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button type="button" className="gov-button" onClick={exportData}>
            <Download size={13} /> Export JSON
          </button>
          <label className="gov-button">
            <Upload size={13} /> Import JSON
            <input hidden type="file" accept="application/json" onChange={importData} />
          </label>
        </div>
      </div>

      <div className="gov-keyline" />

      <div className="gov-layout">
        <aside className="gov-tabs gov-reveal" aria-label="Sub-modul tata kelola PRP">
          <div ref={tabBarRef} className="gov-tabs-list">
            {TABS.map(({ idx, id, label }) => (
              <button
                key={id}
                type="button"
                data-tab-active={activeTab === id ? 'true' : undefined}
                className={`gov-tab ${activeTab === id ? 'active' : ''}`}
                onClick={() => selectTab(id)}
              >
                <span className="gov-tab-idx">{idx}</span>
                <span>{label}</span>
              </button>
            ))}
            <div ref={tabLineRef} className="gov-tab-underline" aria-hidden="true" />
          </div>
        </aside>

        <main ref={tabStageRef} style={{ minWidth: 0 }}>
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
                  padding: '1rem 1.3rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <strong style={{ fontSize: '0.92rem', fontFamily: 'Outfit, sans-serif', color: '#0f172a', display: 'block' }}>
                    Pusat Review Terpadu — IKU Kementerian & KPI Operasional
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Verifikasi kelengkapan isian, tautan bukti pendukung HTTPS, serta persetujuan dan penguncian data unit.
                  </span>
                </div>
                <Link to="/internal/iku-submissions" className="gov-button gov-button-primary">
                  Buka Workspace Submission IKU <ArrowUpRight size={14} />
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
                  <span>Hanya satu periode yang dapat berstatus Aktif untuk pengisian KPI & IKU secara serentak</span>
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
                    <small style={{ display: 'block', marginTop: '3px', color: '#64748b', fontSize: '0.65rem' }}>
                      Fallback global: {readSystemConfig().submissionDeadline || 'Belum diatur'}
                    </small>
                  </div>
                  <select value={period.status} onChange={(event) => updatePeriod(period.id, 'status', event.target.value)}>
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
                    <Download size={14} /> Export CSV ({filteredAudit.length})
                  </button>
                  <button type="button" className="gov-button" onClick={() => downloadAudit('json')}>
                    <Download size={14} /> Export JSON
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
                  gap: '0.65rem',
                  padding: '0.95rem 1.3rem',
                  background: '#f8fafc',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <input
                  className="gov-field"
                  type="search"
                  aria-label="Cari audit"
                  placeholder="Cari aktivitas, detail, pelaku…"
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
                  {auditActions.map((a) => <option key={a}>{a}</option>)}
                </select>
                <select
                  className="gov-field"
                  aria-label="Filter pelaku"
                  value={auditFilter.actor}
                  onChange={(e) => setAuditFilter((f) => ({ ...f, actor: e.target.value }))}
                >
                  <option value="">Semua pelaku</option>
                  {auditActors.map((a) => <option key={a}>{a}</option>)}
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
                      <strong style={{ color: '#0f172a', fontSize: '0.75rem', letterSpacing: '0.02em' }}>{item.action}</strong>
                      <small style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>{item.actor || 'Pelaku tidak tercatat'}</small>
                    </div>
                    <span style={{ color: '#334155', lineHeight: 1.5 }}>{item.detail}</span>
                    <time
                      dateTime={item.at}
                      style={{ color: '#64748b', fontSize: '0.71rem', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}
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
        </main>
      </div>
    </section>
  );
}
