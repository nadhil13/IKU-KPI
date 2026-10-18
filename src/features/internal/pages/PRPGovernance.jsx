import { useMemo, useRef, useState } from 'react';
import { Archive, Calculator, Check, ChevronRight, Clock3, Download, FileCog, GitBranch, History, Plus, Save, Table2, Upload, X } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const initialIndicators = [
  { id: 'IKU-01', code: 'IKU 01', name: 'Kesiapan Kerja Lulusan', formula: 'Lulusan bekerja + wirausaha + studi lanjut / total lulusan', weight: '12.5', status: 'Published', version: 'v1.4' },
  { id: 'KPI-A1', code: 'KPI A.1', name: 'Pendapatan Vertikal Mahasiswa', formula: 'Realisasi pendapatan / target RKA × bobot', weight: '10', status: 'Published', version: 'v2.1' },
  { id: 'KPI-D1', code: 'KPI D.1', name: 'Kepatuhan Pelaporan', formula: 'Tanggal realisasi dibandingkan batas waktu periode', weight: '—', status: 'Draft', version: 'v1.0' },
];

const tabs = [
  { id: 'tables', label: 'Struktur tabel', icon: Table2 },
  { id: 'formulas', label: 'Rumus & bobot', icon: Calculator },
  { id: 'periods', label: 'Periode evaluasi', icon: Clock3 },
  { id: 'audit', label: 'Audit trail', icon: History },
];

const initialPeriods = [
  { id: '2025/2026', label: 'Tahun Akademik 2025/2026', start: '2025-08-01', end: '2026-07-31', status: 'Active' },
  { id: '2024/2025', label: 'Tahun Akademik 2024/2025', start: '2024-08-01', end: '2025-07-31', status: 'Archived' },
];

export default function PRPGovernance() {
  const pageRef = useRef(null);
  const [activeTab, setActiveTab] = useState('tables');
  const [indicators, setIndicators] = useState(() => {
    try { return JSON.parse(localStorage.getItem('prp_indicators')) || initialIndicators; } catch { return initialIndicators; }
  });
  const [periods, setPeriods] = useState(() => {
    try { return JSON.parse(localStorage.getItem('prp_periods')) || initialPeriods; } catch { return initialPeriods; }
  });
  const [audit, setAudit] = useState(() => {
    try { return JSON.parse(localStorage.getItem('prp_audit')) || []; } catch { return []; }
  });
  const [selectedId, setSelectedId] = useState(initialIndicators[0].id);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const selected = indicators.find((item) => item.id === selectedId) || indicators[0];

  useGSAP(() => {
    gsap.from('.gov-reveal', { y: 20, opacity: 0, duration: .7, stagger: .07, ease: 'expo.out' });
  }, { scope: pageRef });

  const updateSelected = (field, value) => {
    setIndicators((current) => current.map((item) => item.id === selected.id ? { ...item, [field]: value, status: 'Draft' } : item));
    setSaved(false);
  };

  const notify = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2600);
  };

  const addAudit = (action, detail) => {
    const next = [{ id: Date.now(), actor: 'Admin PRP', action, detail, at: new Date().toLocaleString('id-ID') }, ...audit];
    setAudit(next);
    localStorage.setItem('prp_audit', JSON.stringify(next));
  };

  const saveDraft = () => {
    localStorage.setItem('prp_indicators', JSON.stringify(indicators));
    setSaved(true);
    addAudit('Simpan draft', `${selected.code} diperbarui`);
    notify('Draft tersimpan');
    gsap.fromTo('.gov-save-state', { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: .35 });
  };

  const publish = () => {
    const next = indicators.map((item) => item.id === selected.id ? { ...item, status: 'Published', version: `v${Number(item.version.replace('v', '')) + 1}` } : item);
    setIndicators(next);
    localStorage.setItem('prp_indicators', JSON.stringify(next));
    addAudit('Publish versi', `${selected.code} menjadi ${next.find((item) => item.id === selected.id).version}`);
    setSaved(false);
    notify('Versi berhasil dipublikasikan');
  };

  const archive = () => {
    const next = indicators.map((item) => item.id === selected.id ? { ...item, status: 'Archived' } : item);
    setIndicators(next);
    localStorage.setItem('prp_indicators', JSON.stringify(next));
    addAudit('Arsipkan indikator', selected.code);
    notify('Indikator diarsipkan');
  };

  const addIndicator = () => {
    const next = { id: `NEW-${indicators.length + 1}`, code: `KPI NEW-${indicators.length + 1}`, name: 'Indikator baru', formula: 'Definisikan rumus indikator', weight: '0', status: 'Draft', version: 'v1.0' };
    setIndicators((current) => [...current, next]);
    setSelectedId(next.id);
    setActiveTab('tables');
  };

  const addPeriod = () => {
    const next = [...periods, { id: `Periode-${periods.length + 1}`, label: 'Periode evaluasi baru', start: '', end: '', status: 'Draft' }];
    setPeriods(next);
    localStorage.setItem('prp_periods', JSON.stringify(next));
    addAudit('Tambah periode', next[next.length - 1].id);
    notify('Periode ditambahkan');
  };

  const updatePeriod = (id, field, value) => {
    const next = periods.map((item) => item.id === id ? { ...item, [field]: value } : item);
    setPeriods(next);
    localStorage.setItem('prp_periods', JSON.stringify(next));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ indicators, periods, audit }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'prp-governance.json';
    anchor.click();
    URL.revokeObjectURL(url);
    addAudit('Export konfigurasi', 'JSON governance');
  };

  const importData = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.indicators) {
          setIndicators(data.indicators);
          localStorage.setItem('prp_indicators', JSON.stringify(data.indicators));
        }
        if (data.periods) {
          setPeriods(data.periods);
          localStorage.setItem('prp_periods', JSON.stringify(data.periods));
        }
        addAudit('Import konfigurasi', file.name);
        notify('Konfigurasi berhasil diimpor');
      } catch {
        notify('File JSON tidak valid');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const publishedCount = useMemo(() => indicators.filter((item) => item.status === 'Published').length, [indicators]);

  return <section ref={pageRef} className="governance-page">
    <style>{`.governance-page{max-width:1380px;margin:0 auto;padding:.25rem 0 4rem;color:#0f172a}.gov-head{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;margin-bottom:1.4rem}.gov-eyebrow{display:flex;align-items:center;gap:.45rem;color:#64748b;font-size:.68rem;font-weight:800;letter-spacing:.12em}.gov-title{margin:.65rem 0 .4rem;font:800 clamp(1.8rem,3vw,2.7rem)/1 Outfit,sans-serif;letter-spacing:-.05em}.gov-lede{max-width:680px;margin:0;color:#64748b;font-size:.82rem;line-height:1.6}.gov-meta{padding:.75rem 1rem;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#475569;font-size:.7rem;font-weight:700}.gov-layout{display:grid;grid-template-columns:220px 1fr;gap:1rem}.gov-tabs,.gov-editor,.gov-table{border:1px solid #e2e8f0;border-radius:15px;background:#fff}.gov-tabs{padding:.55rem}.gov-tab{display:flex;align-items:center;gap:.65rem;width:100%;padding:.75rem;border:0;border-radius:9px;background:transparent;color:#64748b;text-align:left;font-size:.75rem;font-weight:700;cursor:pointer}.gov-tab.active{background:#f1f5f9;color:#0f172a}.gov-tab svg{width:16px}.gov-workspace{display:grid;grid-template-columns:1fr 340px;gap:1rem}.gov-table{overflow:hidden}.gov-table-head,.gov-editor-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.15rem;border-bottom:1px solid #f1f5f9}.gov-table-head h2,.gov-editor-head h2{margin:0;font:800 .92rem Outfit,sans-serif}.gov-table-head span,.gov-editor-head span{color:#94a3b8;font-size:.68rem}.gov-row{display:grid;grid-template-columns:86px 1fr 80px 84px;gap:.7rem;align-items:center;padding:.85rem 1.1rem;border-bottom:1px solid #f1f5f9;cursor:pointer}.gov-row:last-child{border-bottom:0}.gov-row.active{background:#f8fafc}.gov-code,.gov-version{color:#64748b;font-size:.68rem}.gov-name{font-size:.75rem;font-weight:750}.gov-status{justify-self:start;padding:.25rem .45rem;border-radius:5px;background:#f1f5f9;color:#475569;font-size:.6rem;font-weight:700}.gov-status.draft{background:#fff7ed;color:#9a3412}.gov-editor{overflow:hidden}.gov-editor-body{padding:1.1rem}.gov-field{display:block;margin-bottom:.85rem;color:#64748b;font-size:.66rem;font-weight:750}.gov-field input,.gov-field textarea{display:block;width:100%;box-sizing:border-box;margin-top:.35rem;padding:.65rem .7rem;border:1px solid #e2e8f0;border-radius:8px;outline:0;color:#0f172a;background:#f8fafc;font:inherit;font-size:.73rem}.gov-field textarea{min-height:82px;resize:vertical}.gov-actions{display:flex;gap:.5rem;padding:1rem 1.1rem;border-top:1px solid #f1f5f9}.gov-button{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;padding:.62rem .75rem;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#334155;font-size:.68rem;font-weight:750;cursor:pointer}.gov-button.primary{background:#0f172a;color:#fff;border-color:#0f172a}.gov-button:hover{transform:translateY(-1px)}.gov-save-state{margin-left:auto;color:#15803d;font-size:.66rem;font-weight:700}.gov-placeholder{grid-column:1/-1;padding:2.8rem;text-align:center;color:#64748b;font-size:.8rem}.gov-note{margin-top:1rem;padding:.85rem 1rem;border-left:3px solid #94a3b8;background:#f8fafc;color:#64748b;font-size:.7rem;line-height:1.6}@media(max-width:900px){.gov-layout,.gov-workspace{grid-template-columns:1fr}.gov-tabs{display:flex;overflow:auto}.gov-tab{white-space:nowrap}.gov-editor{order:-1}}@media(max-width:560px){.gov-row{grid-template-columns:70px 1fr}.gov-row .gov-version,.gov-row .gov-status{display:none}.gov-head{align-items:flex-start;flex-direction:column}}`}</style>
    <div className="gov-head gov-reveal"><div><div className="gov-eyebrow"><FileCog size={13}/> PRP / GOVERNANCE WORKSPACE</div><h1 className="gov-title">Konfigurasi kinerja</h1><p className="gov-lede">Kelola struktur tabel, definisi indikator, rumus, bobot, periode, dan riwayat perubahan tanpa mengubah histori data yang sudah dipublikasikan.</p></div><div className="gov-meta">{publishedCount} PUBLISHED · {indicators.length} INDICATORS</div></div>
    <div className="gov-layout gov-reveal"><aside className="gov-tabs">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={`gov-tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}><Icon size={16}/>{label}<ChevronRight size={13} style={{ marginLeft:'auto' }}/></button>)}<div className="gov-note"><GitBranch size={14}/><br/>Setiap publish membuat versi baru. Data historis tetap immutable.</div><button className="gov-button" onClick={exportData}><Download size={14}/> Export JSON</button><label className="gov-button" style={{ marginTop: '.45rem' }}><Upload size={14}/> Import JSON<input hidden type="file" accept="application/json" onChange={importData}/></label></aside>
      {activeTab === 'periods' ? <div className="gov-table"><div className="gov-table-head"><div><h2>Periode evaluasi</h2><span>Kelola status aktif, draft, dan arsip</span></div><button className="gov-button" onClick={addPeriod}><Plus size={14}/> Tambah periode</button></div>{periods.map((item) => <div className="gov-row" key={item.id}><input className="gov-field" value={item.label} onChange={(e) => updatePeriod(item.id, 'label', e.target.value)}/><input type="date" value={item.start} onChange={(e) => updatePeriod(item.id, 'start', e.target.value)}/><input type="date" value={item.end} onChange={(e) => updatePeriod(item.id, 'end', e.target.value)}/><select value={item.status} onChange={(e) => updatePeriod(item.id, 'status', e.target.value)}><option>Active</option><option>Draft</option><option>Archived</option></select></div>)}</div> : activeTab === 'audit' ? <div className="gov-table"><div className="gov-table-head"><div><h2>Audit trail</h2><span>{audit.length} aktivitas tercatat</span></div></div>{audit.length ? audit.map((item) => <div className="gov-row" key={item.id}><span className="gov-version">{item.at}</span><span className="gov-name">{item.action}</span><span className="gov-code">{item.detail}</span><span className="gov-code">{item.actor}</span></div>) : <div className="gov-placeholder">Belum ada aktivitas.</div>}</div> : <div className="gov-workspace"><div className="gov-table"><div className="gov-table-head"><div><h2>{activeTab === 'tables' ? 'Master indikator IKU & KPI' : 'Formula dan bobot indikator'}</h2><span>Draft changes are isolated from published data</span></div><button className="gov-button" onClick={addIndicator}><Plus size={14}/> Tambah</button></div>{indicators.map((item) => <div key={item.id} className={`gov-row ${selected.id === item.id ? 'active' : ''}`} onClick={() => setSelectedId(item.id)}><span className="gov-code">{item.code}</span><span className="gov-name">{activeTab === 'formulas' ? item.formula : item.name}</span><span className="gov-version">{item.version}</span><span className={`gov-status ${item.status === 'Draft' ? 'draft' : ''}`}>{item.status}</span></div>)}</div><div className="gov-editor"><div className="gov-editor-head"><div><h2>Edit konfigurasi</h2><span>{selected.code} · {selected.version}</span></div><Archive size={16} color="#94a3b8"/></div><div className="gov-editor-body"><label className="gov-field">Kode indikator<input value={selected.code} onChange={(e) => updateSelected('code', e.target.value)}/></label><label className="gov-field">Nama indikator<input value={selected.name} onChange={(e) => updateSelected('name', e.target.value)}/></label><label className="gov-field">Definisi<textarea value={selected.definition || ''} onChange={(e) => updateSelected('definition', e.target.value)}/></label><label className="gov-field">Rumus kalkulasi<textarea value={selected.formula} onChange={(e) => updateSelected('formula', e.target.value)}/></label><label className="gov-field">Bobot<input value={selected.weight} onChange={(e) => updateSelected('weight', e.target.value)}/></label></div><div className="gov-actions"><button className="gov-button" onClick={saveDraft}><Save size={14}/> Simpan draft</button><button className="gov-button primary" onClick={publish}><Check size={14}/> Publish versi</button><button className="gov-button" onClick={archive}><X size={14}/> Arsipkan</button>{saved && <span className="gov-save-state">Tersimpan</span>}</div></div></div>}
    </div>{message && <div className="gov-toast">{message}</div>}
  </section>;
}
