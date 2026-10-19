import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Minus, Plus, RotateCcw, Save, Send, Trash2, Wand2 } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { KPI_SECTIONS_CONFIG } from '../../kpi/components/KPIDataEntrySheet';
import KPIDataEntrySheet from '../../kpi/components/KPIDataEntrySheet';
import {
  CALC_TYPES, KPI_DRAFT_KEY, KPI_LIVE_SYNC_KEY,
  createId, normalizeKpiSections, publishKpiSections, readKpiHistory,
  readPublishedKpiConfig, validateKpiSections, computeKpiItem, formatIndonesianNumber,
} from '../../kpi/kpiSchema';
import './KPITableDesigner.css';

const clone = (value) => JSON.parse(JSON.stringify(value));
const blankItem = (sectionCode, index = 1) => ({
  id: createId(sectionCode), no: String(index), excelNo: String(index), indikator: 'Indikator baru',
  formula: 'Realisasi ÷ Target × 100%', bobot: 0, bobotDisplay: '0', targetNum: 100, targetDisplay: '100', satuan: '%',
  calcType: 'single_target', hideExcelNo: false, hideIndikatorCell: false,
  subrows: [{ key: createId('input'), label: 'Nilai realisasi', placeholder: '0' }],
});

function Field({ label, value, onChange, type = 'text', compact = false }) {
  return <label className={`kpi-designer-field ${compact ? 'compact' : ''}`}><span>{label}</span><input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} /></label>;
}

export default function KPITableDesigner() {
  const rootRef = useRef(null);
  const tableRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const [liveSync, setLiveSync] = useState(() => localStorage.getItem(KPI_LIVE_SYNC_KEY) !== 'false');
  const [sections, setSections] = useState(() => {
    const draft = JSON.parse(localStorage.getItem(KPI_DRAFT_KEY) || 'null');
    const published = readPublishedKpiConfig();
    return normalizeKpiSections(draft?.sections || published?.sections || KPI_SECTIONS_CONFIG);
  });
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState(() => readKpiHistory());
  const [simValues, setSimValues] = useState({});
  const [showPreview, setShowPreview] = useState(false);

  const normalized = useMemo(() => normalizeKpiSections(sections), [sections]);
  const validation = useMemo(() => validateKpiSections(normalized), [normalized]);
  const selected = useMemo(() => normalized.flatMap((section) => section.items).find((item) => item.id === selectedId), [normalized, selectedId]);
  const totalRows = normalized.reduce((sum, section) => sum + section.items.length, 0);
  const setDraft = useCallback((next) => {
    setSections((current) => normalizeKpiSections(typeof next === 'function' ? next(current) : next));
  }, []);

  useEffect(() => {
    localStorage.setItem(KPI_DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), sections: normalized }));
  }, [normalized]);

  // Live sync: auto-publish (debounce 700ms) selama tidak ada error validasi.
  // Snapshot history dimatikan agar riwayat tidak dibanjiri tiap ketikan.
  const hasBlockingError = validation.issues.some((issue) => issue.level === 'error');
  useEffect(() => {
    if (!liveSync || hasBlockingError) return undefined;
    const timer = window.setTimeout(() => {
      publishKpiSections(normalized, { actor: 'Superadmin PRP', note: 'Live sync', snapshot: false });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [normalized, liveSync, hasBlockingError]);

  useEffect(() => () => window.clearTimeout(noticeTimerRef.current), []);

  useGSAP(() => {
    gsap.fromTo('.kpi-designer-section', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: .65, stagger: .08, ease: 'expo.out', clearProps: 'transform' });
  }, { scope: rootRef, dependencies: [normalized.length] });

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 2800);
  };
  const updateItem = (sectionIndex, itemIndex, patch) => setDraft((current) => current.map((section, si) => si !== sectionIndex ? section : { ...section, items: section.items.map((item, ii) => ii === itemIndex ? { ...item, ...patch } : item) }));
  const updateSub = (sectionIndex, itemIndex, subIndex, patch) => setDraft((current) => current.map((section, si) => si !== sectionIndex ? section : { ...section, items: section.items.map((item, ii) => ii !== itemIndex ? item : { ...item, subrows: item.subrows.map((sub, subi) => subi === subIndex ? { ...sub, ...patch } : sub) }) }));
  const addSub = (si, ii) => setDraft((current) => current.map((section, s) => s !== si ? section : { ...section, items: section.items.map((item, i) => i !== ii ? item : { ...item, subrows: [...item.subrows, { key: createId('input'), label: `Isian ${item.subrows.length + 1}`, placeholder: '0' }] }) }));
  const deleteSub = (si, ii, subi) => setDraft((current) => current.map((section, s) => s !== si ? section : { ...section, items: section.items.map((item, i) => i !== ii || item.subrows.length <= 1 ? item : { ...item, subrows: item.subrows.filter((_, index) => index !== subi) }) }));
  const addRow = (si) => setDraft((current) => current.map((section, s) => s !== si ? section : { ...section, items: [...section.items, blankItem(section.code, section.items.length + 1)] }));
  const deleteRow = (si, ii) => setDraft((current) => current.map((section, s) => s !== si ? section : { ...section, items: section.items.length <= 1 ? section.items : section.items.filter((_, i) => i !== ii) }));
  const moveRow = (si, ii, direction) => setDraft((current) => current.map((section, s) => { if (s !== si) return section; const items = [...section.items]; const target = ii + direction; if (target < 0 || target >= items.length) return section; [items[ii], items[target]] = [items[target], items[ii]]; return { ...section, items }; }));
  const addSection = () => setDraft((current) => [...current, { code: String.fromCharCode(65 + current.length), title: 'Bagian baru', totalWeight: 0, isPenaltySection: false, items: [blankItem(String.fromCharCode(65 + current.length))] }]);
  const deleteSection = (si) => setDraft((current) => current.length <= 1 ? current : current.filter((_, index) => index !== si));
  const publish = () => {
    const result = publishKpiSections(normalized, { actor: 'Superadmin PRP', note: 'Publish dari visual designer KPI', snapshot: true });
    setHistory(readKpiHistory());
    notify(`KPI v${result.version} aktif realtime untuk user`);
  };
  const rollback = (snapshot) => { if (snapshot?.sections) { setDraft(snapshot.sections); notify(`Draft dikembalikan ke v${snapshot.version}`); } };
  const updateSimulation = (key, value) => setSimValues((current) => ({ ...current, [key]: value }));
  const simulation = selected ? computeKpiItem(selected, simValues, normalized.find((section) => section.items.some((item) => item.id === selected.id))?.isPenaltySection) : null;

  return <div ref={rootRef} className="kpi-designer-page">
    <header className="kpi-designer-hero">
      <div><div className="kpi-designer-kicker"><Wand2 size={14} /> PRP / KPI GOVERNANCE</div><h1>Desainer Tabel KPI</h1><p>Edit bentuk tabel, rumusan per baris, bobot, target, dan isian dari tampilan yang sama dengan user KPI.</p></div>
      <div className="kpi-designer-actions"><button className="kpi-designer-button" onClick={() => { setSections(normalizeKpiSections(KPI_SECTIONS_CONFIG)); notify('Struktur dikembalikan ke default'); }}><RotateCcw size={15} /> Reset</button><button className="kpi-designer-button primary" onClick={publish}><Send size={15} /> Publish realtime</button></div>
    </header>
    <div className="kpi-designer-toolbar"><div><strong>{totalRows}</strong> baris · <strong>{normalized.length}</strong> bagian · {validation.issues.length ? `${validation.issues.length} catatan validasi` : 'Struktur valid'}</div><div className="kpi-designer-toolbar-actions"><label className="kpi-toggle"><input type="checkbox" checked={liveSync} onChange={(event) => { setLiveSync(event.target.checked); localStorage.setItem(KPI_LIVE_SYNC_KEY, String(event.target.checked)); }} /><span /> Live sync</label><button className="kpi-designer-button" onClick={() => setShowPreview((value) => !value)}>{showPreview ? <EyeOff size={15} /> : <Eye size={15} />} {showPreview ? 'Tutup preview' : 'Preview user'}</button></div></div>
    {notice && <div className="kpi-designer-notice"><Save size={15} /> {notice}</div>}
    {showPreview ? <div className="kpi-designer-preview"><KPIDataEntrySheet sectionsOverride={normalized} persist={false} readOnly /></div> : <>
      <div className="kpi-designer-layout"><main className="kpi-designer-canvas" ref={tableRef}>
        {normalized.map((section, si) => <section className="kpi-designer-section" key={`${section.code}-${si}`}>
          <div className="kpi-designer-section-head"><div className="kpi-designer-section-title"><Field label="Kode" value={section.code} compact onChange={(value) => setDraft((current) => current.map((item, index) => index === si ? { ...item, code: value.toUpperCase() } : item))} /><Field label="Judul bagian" value={section.title} onChange={(value) => setDraft((current) => current.map((item, index) => index === si ? { ...item, title: value } : item))} /><Field label="Bobot bagian" value={section.totalWeight} type="number" compact onChange={(value) => setDraft((current) => current.map((item, index) => index === si ? { ...item, totalWeight: value } : item))} /></div><label className="kpi-penalty-check"><input type="checkbox" checked={Boolean(section.isPenaltySection)} onChange={(event) => setDraft((current) => current.map((item, index) => index === si ? { ...item, isPenaltySection: event.target.checked } : item))} /> Bagian penalti</label><button className="icon-button danger" title="Hapus bagian" onClick={() => deleteSection(si)}><Trash2 size={15} /></button></div>
          <div className="kpi-table-scroll"><table className="kpi-designer-table"><thead><tr><th>NO</th><th>INDIKATOR KINERJA</th><th>FORMULA / RUMUS</th><th>RUMUSAN ISIAN</th><th>ISIAN SIMULASI</th><th>BOBOT</th><th>TARGET</th><th>SATUAN</th><th>CAPAIAN / SKOR</th><th /></tr></thead><tbody>{section.items.map((item, ii) => { const computed = computeKpiItem(item, simValues, section.isPenaltySection); return <tr className={selectedId === item.id ? 'selected' : ''} key={item.id} onClick={() => setSelectedId(item.id)}><td className="number-cell"><GripVertical size={13} /> <Field label="" value={item.no} compact onChange={(value) => updateItem(si, ii, { no: value, excelNo: value })} /><div className="row-actions"><button onClick={(event) => { event.stopPropagation(); moveRow(si, ii, -1); }}><ArrowUp size={12} /></button><button onClick={(event) => { event.stopPropagation(); moveRow(si, ii, 1); }}><ArrowDown size={12} /></button></div></td><td><Field label="" value={item.indikator} onChange={(value) => updateItem(si, ii, { indikator: value })} /><div className="merge-options"><label><input type="checkbox" checked={Boolean(item.hideIndikatorCell)} onChange={(event) => updateItem(si, ii, { hideIndikatorCell: event.target.checked })} /> merge indikator</label></div></td><td><Field label="" value={item.formula} onChange={(value) => updateItem(si, ii, { formula: value })} /><select value={item.calcType} onChange={(event) => updateItem(si, ii, { calcType: event.target.value })}>{Object.entries(CALC_TYPES).map(([key, type]) => <option key={key} value={key}>{type.label}</option>)}</select><small>{CALC_TYPES[item.calcType]?.expression}</small>{item.calcType === 'compliance_date_single' && <Field label="Batas waktu" type="date" value={item.deadlineISO} onChange={(value) => updateItem(si, ii, { deadlineISO: value })} />}{item.calcType === 'compliance_date_dual' && <div className="date-pair"><Field label="Semester 1" type="date" value={item.deadlinesISO?.[0] || ''} onChange={(value) => updateItem(si, ii, { deadlinesISO: [value, item.deadlinesISO?.[1] || ''] })} /><Field label="Semester 2" type="date" value={item.deadlinesISO?.[1] || ''} onChange={(value) => updateItem(si, ii, { deadlinesISO: [item.deadlinesISO?.[0] || '', value] })} /></div>}</td><td className="subrows-cell">{item.subrows.map((sub, subi) => <div className="designer-subrow" key={sub.key}><Field label="" value={sub.label} onChange={(value) => updateSub(si, ii, subi, { label: value })} /><button className="mini-icon danger" onClick={() => deleteSub(si, ii, subi)}><Minus size={12} /></button></div>)}<button className="text-button" onClick={() => addSub(si, ii)}><Plus size={13} /> Tambah isian</button></td><td><Field label="" value={item.bobot} type="number" onChange={(value) => updateItem(si, ii, { bobot: value })} /></td><td><Field label="" value={item.targetNum} type="number" onChange={(value) => updateItem(si, ii, { targetNum: value, targetDisplay: value })} /><Field label="Tampilan" value={item.targetDisplay} onChange={(value) => updateItem(si, ii, { targetDisplay: value })} /></td><td><Field label="" value={item.satuan} onChange={(value) => updateItem(si, ii, { satuan: value })} /></td><td className="score-cell"><strong>{computed.ratioPercent === null ? '—' : `${formatIndonesianNumber(computed.ratioPercent)}%`}</strong><span>{computed.weightedScore === null ? 'Belum disimulasi' : `${formatIndonesianNumber(computed.weightedScore)} poin`}</span></td><td className="row-menu"><button className="mini-icon" onClick={(event) => { event.stopPropagation(); setDraft((current) => current.map((sectionItem, sectionIndex) => sectionIndex === si ? { ...sectionItem, items: [...sectionItem.items.slice(0, ii + 1), { ...clone(item), id: createId(section.code), no: String(ii + 2), excelNo: String(ii + 2), subrows: item.subrows.map((sub) => ({ ...sub, key: createId('input') })) }, ...sectionItem.items.slice(ii + 1)] } : sectionItem)); }} title="Duplikat"><Copy size={13} /></button><button className="mini-icon danger" onClick={(event) => { event.stopPropagation(); deleteRow(si, ii); }} title="Hapus"><Trash2 size={13} /></button></td></tr>; })}</tbody></table></div><button className="add-row-button" onClick={() => addRow(si)}><Plus size={15} /> Tambah baris KPI di Bagian {section.code}</button></section>)}
        <button className="add-section-button" onClick={addSection}><Plus size={16} /> Tambah bagian KPI</button>
      </main><aside className="kpi-designer-aside"><div className="designer-panel"><h3>Validasi struktur</h3>{validation.issues.length ? <ul>{validation.issues.slice(0, 12).map((issue, index) => <li className={issue.level} key={`${issue.message}-${index}`}>{issue.message}</li>)}</ul> : <p className="valid-state">✓ Struktur siap dipublish</p>}</div><div className="designer-panel"><h3>Simulasi baris</h3>{selected ? <><strong>{selected.no}. {selected.indikator}</strong>{selected.subrows.map((sub) => <Field key={sub.key} label={sub.label} value={simValues[sub.key] || ''} onChange={(value) => updateSimulation(sub.key, value)} />)}<div className="simulation-result"><span>Capaian</span><strong>{simulation?.ratioPercent === null ? '—' : `${formatIndonesianNumber(simulation.ratioPercent)}%`}</strong><span>Skor</span><strong>{simulation?.weightedScore === null ? '—' : formatIndonesianNumber(simulation.weightedScore)}</strong></div></> : <p>Pilih satu baris untuk simulasi.</p>}</div><div className="designer-panel"><h3>Riwayat publish</h3>{history.length ? history.slice(0, 6).map((snapshot) => <div className="history-row" key={`${snapshot.version}-${snapshot.publishedAt}`}><span>v{snapshot.version}<small>{new Date(snapshot.publishedAt).toLocaleString('id-ID')}</small></span><button className="mini-icon" onClick={() => rollback(snapshot)}><RotateCcw size={13} /></button></div>) : <p>Belum ada snapshot.</p>}</div></aside></div>
    </>}
  </div>;
}
