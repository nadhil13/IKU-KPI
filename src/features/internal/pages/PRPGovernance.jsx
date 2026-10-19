import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Clock3, Download, FileCog, History, Table2, Upload } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import KPITableDesigner from '../components/KPITableDesigner';

const DEFAULT_PERIODS = [
  { id: '2025/2026', label: 'Tahun Akademik 2025/2026', start: '2025-08-01', end: '2026-07-31', status: 'Active', inputOpen: true },
  { id: '2024/2025', label: 'Tahun Akademik 2024/2025', start: '2024-08-01', end: '2025-07-31', status: 'Archived', inputOpen: false },
];

const TABS = [
  { id: 'kpi-builder', label: 'Desainer tabel KPI', icon: Table2 },
  { id: 'periods', label: 'Periode evaluasi', icon: Clock3 },
  { id: 'audit', label: 'Audit trail', icon: History },
];

const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
};

export default function PRPGovernance() {
  const pageRef = useRef(null);
  const [activeTab, setActiveTab] = useState('kpi-builder');
  const [periods, setPeriods] = useState(() => readJSON('prp_periods', DEFAULT_PERIODS));
  const [audit, setAudit] = useState(() => readJSON('prp_audit', []));

  useGSAP(() => {
    gsap.from('.gov-reveal', { y: 18, opacity: 0, duration: 0.65, stagger: 0.06, ease: 'expo.out' });
  }, { scope: pageRef });

  const activePeriod = useMemo(() => periods.find((period) => period.status === 'Active') || periods[0], [periods]);

  const savePeriods = (next) => {
    setPeriods(next);
    localStorage.setItem('prp_periods', JSON.stringify(next));
  };

  // Hanya satu periode boleh Active; periode lain otomatis diarsipkan.
  const updatePeriod = (id, field, value) => {
    savePeriods(periods.map((period) => {
      if (period.id === id) return { ...period, [field]: value };
      if (field === 'status' && value === 'Active') return { ...period, status: 'Archived' };
      return period;
    }));
  };

  const addPeriod = () => savePeriods([
    ...periods,
    { id: `Periode-${Date.now()}`, label: 'Periode evaluasi baru', start: '', end: '', status: 'Draft', inputOpen: false, submissionDeadline: '' },
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
        if (Array.isArray(data.periods)) savePeriods(data.periods);
        if (Array.isArray(data.audit)) {
          setAudit(data.audit);
          localStorage.setItem('prp_audit', JSON.stringify(data.audit));
        }
      } catch {
        // File tidak valid diabaikan.
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <section ref={pageRef} className="governance-page">
      <style>{`
        .governance-page{max-width:1500px;margin:0 auto;padding:.25rem 0 4rem;color:#0f172a}
        .gov-head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;margin-bottom:1.3rem}
        .gov-eyebrow{display:flex;align-items:center;gap:.45rem;color:#64748b;font-size:.68rem;font-weight:800;letter-spacing:.12em}
        .gov-title{margin:.55rem 0 .35rem;font:800 clamp(1.8rem,3vw,2.7rem)/1 Outfit,sans-serif;letter-spacing:-.05em}
        .gov-lede{max-width:760px;margin:0;color:#64748b;font-size:.82rem;line-height:1.6}
        .gov-meta{padding:.7rem .9rem;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#475569;font-size:.68rem;font-weight:750}
        .gov-layout{display:grid;grid-template-columns:200px minmax(0,1fr);gap:1rem;align-items:start}
        .gov-tabs{position:sticky;top:0;padding:.55rem;border:1px solid #e2e8f0;border-radius:15px;background:#fff}
        .gov-tab{display:flex;align-items:center;gap:.6rem;width:100%;padding:.72rem;border:0;border-radius:9px;background:transparent;color:#64748b;text-align:left;font-size:.73rem;font-weight:750;cursor:pointer;transition:background .2s,color .2s}
        .gov-tab:hover{color:#0f172a}
        .gov-tab.active{background:#f1f5f9;color:#0f172a}
        .gov-tab .chev{margin-left:auto}
        .gov-note{margin:.9rem .35rem;padding-top:.75rem;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:.65rem;line-height:1.5}
        .gov-button{display:flex;align-items:center;justify-content:center;gap:.4rem;width:100%;box-sizing:border-box;padding:.62rem;border:1px solid #dbe3ec;border-radius:9px;background:#fff;color:#475569;font-weight:750;font-size:.68rem;cursor:pointer}
        .gov-table{border:1px solid #e2e8f0;border-radius:15px;background:#fff;overflow:hidden}
        .gov-table-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem 1.1rem;border-bottom:1px solid #f1f5f9}
        .gov-table-head h2{margin:0;font:800 .95rem Outfit,sans-serif}
        .gov-table-head span{color:#94a3b8;font-size:.68rem}
        .gov-period-row{display:grid;grid-template-columns:1fr 140px 140px 110px 120px;gap:.75rem;align-items:center;padding:.8rem 1rem;border-bottom:1px solid #f1f5f9;font-size:.72rem}
        .gov-period-row input,.gov-period-row select{width:100%;box-sizing:border-box;padding:.45rem;border:1px solid #dbe3ec;border-radius:6px;font-size:.7rem}
        .gov-period-row label{display:flex;align-items:center;gap:.35rem;color:#475569;font-weight:700}
        .gov-period-row label input{width:auto}
        .gov-audit-row{display:grid;grid-template-columns:180px 1fr 170px;gap:.75rem;padding:.8rem 1rem;border-bottom:1px solid #f1f5f9;font-size:.72rem}
        .gov-placeholder{padding:2rem;color:#94a3b8;font-size:.78rem}
        @media(max-width:900px){
          .gov-layout{grid-template-columns:1fr}
          .gov-tabs{position:static;display:flex;gap:.3rem;overflow:auto}
          .gov-tab{min-width:max-content}
          .gov-note,.gov-tabs>.gov-button{display:none}
          .gov-head{align-items:flex-start;flex-direction:column}
          .gov-period-row,.gov-audit-row{grid-template-columns:1fr 1fr}
        }
      `}</style>

      <div className="gov-head gov-reveal">
        <div>
          <div className="gov-eyebrow"><FileCog size={13} /> PRP / GOVERNANCE WORKSPACE</div>
          <h1 className="gov-title">Konfigurasi kinerja</h1>
          <p className="gov-lede">
            Desain struktur KPI dengan bentuk tabel yang sama persis dengan lembar isian user. Setiap publish membuat versi baru dan langsung tersinkron realtime ke user KPI.
          </p>
        </div>
        <div className="gov-meta">PERIODE AKTIF · {activePeriod?.label || 'Belum ada'}</div>
      </div>

      <div className="gov-layout gov-reveal">
        <aside className="gov-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`gov-tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
              <Icon size={15} />{label}<ChevronRight size={13} className="chev" />
            </button>
          ))}
          <div className="gov-note">Edit inline · simulasi realtime · publish ke seluruh user KPI.</div>
          <button type="button" className="gov-button" onClick={exportData}><Download size={14} /> Export JSON</button>
          <label className="gov-button" style={{ marginTop: '.45rem' }}>
            <Upload size={14} /> Import JSON
            <input hidden type="file" accept="application/json" onChange={importData} />
          </label>
        </aside>

        <main style={{ minWidth: 0 }}>
          {activeTab === 'kpi-builder' && <KPITableDesigner />}

          {activeTab === 'periods' && (
            <div className="gov-table">
              <div className="gov-table-head">
                <div><h2>Periode evaluasi</h2><span>Satu periode aktif untuk pengisian KPI</span></div>
                <button type="button" className="gov-button" style={{ width: 'auto' }} onClick={addPeriod}>+ Tambah periode</button>
              </div>
              {periods.map((period) => (
                <div className="gov-period-row" key={period.id}>
                  <input value={period.label} onChange={(event) => updatePeriod(period.id, 'label', event.target.value)} />
                  <input type="date" value={period.start || ''} onChange={(event) => updatePeriod(period.id, 'start', event.target.value)} />
                  <input type="date" value={period.end || ''} onChange={(event) => updatePeriod(period.id, 'end', event.target.value)} />
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
              <div className="gov-table-head"><div><h2>Audit trail</h2><span>Riwayat aktivitas governance</span></div></div>
              {audit.length
                ? audit.map((item) => (
                  <div className="gov-audit-row" key={item.id}>
                    <strong>{item.action}</strong><span>{item.detail}</span><span>{item.at}</span>
                  </div>
                ))
                : <div className="gov-placeholder">Belum ada aktivitas.</div>}
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
