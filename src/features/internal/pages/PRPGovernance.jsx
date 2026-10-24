import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Clock3, Download, FileCog, History, Table2, Upload } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import KPITableDesigner from '../components/KPITableDesigner';
import KPISubmissionInbox from '../components/KPISubmissionInbox';
import AllSubmissionsTable from '../components/AllSubmissionsTable';
import SystemSettings from '../components/SystemSettings';
import { readAudit, readSystemConfig, writeAudit } from '../adminStore';
import { useAuth } from '../../auth/context/AuthContext';
import { Link } from 'react-router-dom';

const DEFAULT_PERIODS = [
  { id: '2025/2026', label: 'Tahun Akademik 2025/2026', start: '2025-08-01', end: '2026-07-31', status: 'Active', inputOpen: true },
  { id: '2024/2025', label: 'Tahun Akademik 2024/2025', start: '2024-08-01', end: '2025-07-31', status: 'Archived', inputOpen: false },
];

const TABS = [
  { id: 'kpi-builder', label: 'Desainer tabel KPI', icon: Table2 },
  { id: 'submissions', label: 'Submission Unit', icon: FileCog },
  { id: 'periods', label: 'Periode evaluasi', icon: Clock3 },
  { id: 'audit', label: 'Audit trail', icon: History },
  { id: 'settings', label: 'Pengaturan sistem', icon: FileCog },
];

const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};

export default function PRPGovernance() {
  const { currentUser } = useAuth();
  const actor = currentUser?.name || currentUser?.email || 'Admin lokal';
  const pageRef = useRef(null);
  const [activeTab, setActiveTab] = useState('kpi-builder');
  const [periods, setPeriods] = useState(() => readJSON('prp_periods', DEFAULT_PERIODS));
  const [audit, setAudit] = useState(() => readJSON('prp_audit', []));
  const [feedback, setFeedback] = useState('');
  const [search, setSearch] = useState('');
  // Filter audit terstruktur: jenis aksi, pelaku, dan rentang tanggal (YYYY-MM-DD).
  const [auditFilter, setAuditFilter] = useState({ action: '', actor: '', from: '', to: '' });
  // Submission KPI yang dipilih dari daftar terpadu untuk dibuka di inbox.
  const [kpiFocus, setKpiFocus] = useState(null);
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
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `prp-audit.${format}`; anchor.click(); URL.revokeObjectURL(url);
    writeAudit('EXPORT_AUDIT', `${filteredAudit.length} entri (${format.toUpperCase()})`, actor);
  };

  const validatePeriods = (items) => {
    if (!Array.isArray(items) || !items.length) throw new Error('Daftar periode harus berisi minimal satu periode.');
    const ids = new Set();
    const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    for (const period of items) {
      if (!period || typeof period.id !== 'string' || !period.id.trim() || ids.has(period.id) || typeof period.label !== 'string' || !period.label.trim()
        || !['Active', 'Draft', 'Archived'].includes(period.status) || typeof period.inputOpen !== 'boolean'
        || !validDate(period.start) || !validDate(period.end) || period.start > period.end) throw new Error('Setiap periode wajib memiliki ID unik, nama, status, flag input, dan rentang tanggal yang valid.');
      ids.add(period.id);
      const deadline = period.submissionDeadline;
      if (deadline !== undefined && (typeof deadline !== 'string' || (deadline && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline) || !validDate(deadline.slice(0, 10)) || !Number.isFinite(new Date(deadline).getTime()) || deadline.slice(11) > '23:59' || deadline.slice(14) > '59' || deadline.slice(0, 10) < period.start || deadline.slice(0, 10) > period.end)))) throw new Error('Tenggat periode harus valid dan berada dalam rentang awal–akhir periode.');
    }
    if (items.filter((period) => period.status === 'Active').length > 1) throw new Error('Hanya satu periode boleh aktif.');
  };

  useGSAP(() => {
    gsap.from('.gov-reveal', { y: 18, opacity: 0, duration: 0.65, stagger: 0.06, ease: 'expo.out' });
  }, { scope: pageRef });

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
    } catch (error) { setFeedback(error.message); }
  };

  // Hanya satu periode boleh Active; periode lain otomatis diarsipkan.
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
        .governance-page{max-width:1680px;margin:0 auto;padding:.25rem 0 4rem;color:#0f172a}
        .gov-head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;margin-bottom:1.1rem}
        .gov-eyebrow{display:flex;align-items:center;gap:.45rem;color:#64748b;font-size:.68rem;font-weight:800;letter-spacing:.12em}
        .gov-title{margin:.55rem 0 .35rem;font:800 clamp(1.8rem,3vw,2.7rem)/1 Outfit,sans-serif;letter-spacing:-.05em}
        .gov-lede{max-width:760px;margin:0;color:#64748b;font-size:.82rem;line-height:1.6}
        .gov-meta{padding:.7rem .9rem;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#475569;font-size:.68rem;font-weight:750}
        .gov-layout{display:flex;flex-direction:column;gap:1rem}
        .gov-tabs{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.55rem;padding:.55rem .7rem;border:1px solid #e2e8f0;border-radius:14px;background:#fff}
        .gov-tabs-list{display:flex;align-items:center;flex-wrap:wrap;gap:.35rem}
        .gov-tabs-actions{display:flex;align-items:center;gap:.45rem;margin-left:auto}
        .gov-tab{display:inline-flex;align-items:center;gap:.5rem;padding:.6rem .85rem;border:1px solid transparent;border-radius:9px;background:transparent;color:#64748b;text-align:left;font-size:.74rem;font-weight:750;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
        .gov-tab:hover{color:#0f172a;background:#f8fafc}
        .gov-tab.active{background:#0f172a;color:#fff;border-color:#0f172a}
        .gov-tab .chev{display:none}
        .gov-note{display:none}
        .gov-button{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;box-sizing:border-box;padding:.55rem .8rem;border:1px solid #dbe3ec;border-radius:9px;background:#fff;color:#475569;font-weight:750;font-size:.68rem;cursor:pointer}
        .gov-table{border:1px solid #e2e8f0;border-radius:15px;background:#fff;overflow:hidden}
        .gov-table-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem 1.1rem;border-bottom:1px solid #f1f5f9}
        .gov-table-head h2{margin:0;font:800 .95rem Outfit,sans-serif}
        .gov-table-head span{color:#94a3b8;font-size:.68rem}
        .gov-field{display:block;width:100%;box-sizing:border-box;padding:.65rem;margin-top:.4rem;border:1px solid #dbe3ec;border-radius:8px;font:inherit}
        .gov-period-row{display:grid;grid-template-columns:minmax(130px,1fr) 130px 130px minmax(180px,1fr) 100px 120px;gap:.6rem;align-items:center;padding:.8rem 1rem;border-bottom:1px solid #f1f5f9;font-size:.72rem;overflow:auto}
        .gov-period-row input,.gov-period-row select{width:100%;box-sizing:border-box;padding:.45rem;border:1px solid #dbe3ec;border-radius:6px;font-size:.7rem}
        .gov-period-row label{display:flex;align-items:center;gap:.35rem;color:#475569;font-weight:700}
        .gov-period-row label input{width:auto}
        .gov-audit-row{display:grid;grid-template-columns:180px 1fr 170px;gap:.75rem;padding:.8rem 1rem;border-bottom:1px solid #f1f5f9;font-size:.72rem}
        .gov-placeholder{padding:2rem;color:#94a3b8;font-size:.78rem}
        @media(max-width:900px){
          .gov-head{align-items:flex-start;flex-direction:column}
          .gov-period-row,.gov-audit-row{grid-template-columns:1fr 1fr}
          .gov-tabs-actions{width:100%;justify-content:flex-start;margin-left:0}
        }
      `}</style>

      <div className="gov-head gov-reveal">
        <div>
          <div className="gov-eyebrow"><FileCog size={13} /> PRP / GOVERNANCE WORKSPACE</div>
          <h1 className="gov-title">Konfigurasi kinerja</h1>
          <p className="gov-lede">
            Buat struktur dan rumus KPI ala Excel, lalu kirim formulir ke Unit Kerja. Setiap pengiriman menyimpan versi per periode; perubahan draft tidak mengubah isian yang sudah dikirim.
          </p>
        </div>
        <div className="gov-meta">PERIODE AKTIF · {activePeriod?.label || 'Belum ada'}</div>
      </div>

      <div className="gov-layout gov-reveal">
        <aside className="gov-tabs">
          <div className="gov-tabs-list">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" className={`gov-tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
                <Icon size={15} />{label}<ChevronRight size={13} className="chev" />
              </button>
            ))}
          </div>
          <div className="gov-tabs-actions">
            <button type="button" className="gov-button" onClick={exportData}><Download size={14} /> Export JSON</button>
            <label className="gov-button">
              <Upload size={14} /> Import JSON
              <input hidden type="file" accept="application/json" onChange={importData} />
            </label>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <div role="status" aria-live="polite" style={{ marginBottom: '.75rem' }}>{feedback}</div>
          {activeTab === 'kpi-builder' && <KPITableDesigner />}
          {activeTab === 'submissions' && <><div className="gov-table-head"><strong>Pusat review IKU & KPI</strong><Link to="/internal/iku-submissions" className="gov-button" style={{ width: 'auto' }}>Buka submission IKU →</Link></div><AllSubmissionsTable onReviewKpi={(target) => setKpiFocus({ ...target })} /><KPISubmissionInbox focus={kpiFocus} /></>}
          {activeTab === 'settings' && <SystemSettings />}

          {activeTab === 'periods' && (
            <div className="gov-table">
              <div className="gov-table-head">
                <div><h2>Periode evaluasi</h2><span>Satu periode aktif untuk pengisian KPI</span></div>
                <button type="button" className="gov-button" style={{ width: 'auto' }} onClick={addPeriod}>+ Tambah periode</button>
              </div>
              {periods.map((period) => (
                <div className="gov-period-row" key={period.id}>
                  <input aria-label="Nama periode" key={`label-${period.label}`} defaultValue={period.label} onBlur={(event) => updatePeriod(period.id, 'label', event.target.value.trim())} />
                  <input aria-label="Tanggal mulai" key={`start-${period.start}`} type="date" defaultValue={period.start || ''} onBlur={(event) => updatePeriod(period.id, 'start', event.target.value)} />
                  <input aria-label="Tanggal akhir" key={`end-${period.end}`} type="date" defaultValue={period.end || ''} onBlur={(event) => updatePeriod(period.id, 'end', event.target.value)} />
                  <div><input aria-label="Tenggat periode opsional" key={`deadline-${period.submissionDeadline}`} type="datetime-local" defaultValue={period.submissionDeadline || ''} onBlur={(event) => updatePeriod(period.id, 'submissionDeadline', event.target.value)} /><small>Kosong: tenggat global {readSystemConfig().submissionDeadline || '(belum diatur)'}</small></div>
                  <select value={period.status} onChange={(event) => updatePeriod(period.id, 'status', event.target.value)}>
                    <option>Active</option><option>Draft</option><option>Archived</option>
                  </select>
                  <label>
                    <input type="checkbox" checked={period.inputOpen !== false} onChange={(event) => updatePeriod(period.id, 'inputOpen', event.target.checked)} />
                    Input dibuka
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="gov-table">
              <div className="gov-table-head"><div><h2>Audit trail</h2><span>Riwayat lokal · maksimum 500 entri · bukan log server permanen</span></div>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <button type="button" className="gov-button" style={{ width: 'auto' }} onClick={() => downloadAudit('csv')}>Export CSV ({filteredAudit.length})</button>
                  <button type="button" className="gov-button" style={{ width: 'auto' }} onClick={() => downloadAudit('json')}>Export JSON</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '.6rem', padding: '.8rem 1rem' }}>
                <input className="gov-field" type="search" aria-label="Cari audit" placeholder="Cari aktivitas, detail, pelaku, atau waktu…" value={search} onChange={(event) => setSearch(event.target.value)} />
                <select className="gov-field" aria-label="Filter aksi" value={auditFilter.action} onChange={(e) => setAuditFilter((f) => ({ ...f, action: e.target.value }))}><option value="">Semua aksi</option>{auditActions.map((a) => <option key={a}>{a}</option>)}</select>
                <select className="gov-field" aria-label="Filter pelaku" value={auditFilter.actor} onChange={(e) => setAuditFilter((f) => ({ ...f, actor: e.target.value }))}><option value="">Semua pelaku</option>{auditActors.map((a) => <option key={a}>{a}</option>)}</select>
                <input className="gov-field" type="date" aria-label="Dari tanggal" value={auditFilter.from} onChange={(e) => setAuditFilter((f) => ({ ...f, from: e.target.value }))} />
                <input className="gov-field" type="date" aria-label="Sampai tanggal" value={auditFilter.to} onChange={(e) => setAuditFilter((f) => ({ ...f, to: e.target.value }))} />
                <button type="button" className="gov-button" onClick={() => { setSearch(''); setAuditFilter({ action: '', actor: '', from: '', to: '' }); }}>Reset filter</button>
              </div>
              {filteredAudit.length
                ? filteredAudit.map((item) => (
                  <div className="gov-audit-row" key={item.id}>
                    <strong>{item.action}<br /><small>{item.actor || 'Pelaku tidak tercatat'}</small></strong><span>{item.detail}</span><time dateTime={item.at}>{Number.isFinite(Date.parse(item.at)) ? new Date(item.at).toLocaleString('id-ID') : item.at}</time>
                  </div>
                ))
                : <div className="gov-placeholder">Tidak ada aktivitas yang sesuai.</div>}
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
