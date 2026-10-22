import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, Plus, RotateCcw, Send, Trash2, Wand2 } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import KPIDataEntrySheet, { KPI_SECTIONS_CONFIG } from '../../kpi/components/KPIDataEntrySheet';
import {
  CALC_TYPES, PRESET_FORMULA_EXPR, KPI_DRAFT_KEY, KPI_LIVE_SYNC_KEY,
  createId, normalizeKpiSections, publishKpiSections, readKpiHistory,
  readPublishedKpiConfig, validateKpiSections, computeKpiItem, formatIndonesianNumber,
} from '../../kpi/kpiSchema';
import { validateKpiFormula } from '../../kpi/formulaEngine';
import { distributeKpiForm } from '../../kpi/kpiWorkflowStore';
import './KPITableDesigner.css';

const clone = (value) => JSON.parse(JSON.stringify(value));
const newSub = (index = 1) => ({ key: createId('input'), label: `Isian ${index}`, placeholder: '0' });
const blankItem = (code, no) => ({
  id: createId(code), no: String(no), excelNo: String(no), indikator: 'Indikator baru',
  formula: 'Realisasi ÷ Target × 100%', formulaExpr: PRESET_FORMULA_EXPR.single_target,
  bobot: 0, targetNum: 100, targetDisplay: '100', satuan: '%',
  calcType: 'single_target', hideExcelNo: false, subrows: [newSub()],
});
const groupNumber = (item) => Number(String(item.no).match(/^\d+/)?.[0]) || 0;
const nextNumber = (items) => Math.max(0, ...items.map(groupNumber)) + 1;
const letters = (index) => {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    result = String.fromCharCode(97 + (n - 1) % 26) + result;
  }
  return result;
};

function migrate(sections) {
  return normalizeKpiSections(sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item, formulaExpr: item.formulaExpr ?? PRESET_FORMULA_EXPR[item.calcType] ?? '',
    })),
  })));
}

function initialSections() {
  try {
    const draft = JSON.parse(localStorage.getItem(KPI_DRAFT_KEY) || 'null');
    return migrate(draft?.sections || readPublishedKpiConfig()?.sections || KPI_SECTIONS_CONFIG);
  } catch {
    return migrate(KPI_SECTIONS_CONFIG);
  }
}

function Field({ label, value, onChange, type = 'text', ...props }) {
  return (
    <label className="designer-field">
      <span>{label}</span>
      <input {...props} type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function IconButton({ label, children, ...props }) {
  return <button type="button" className="designer-icon" title={label} aria-label={label} {...props}>{children}</button>;
}

function move(rows, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= rows.length) return rows;
  const result = [...rows];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

export default function KPITableDesigner() {
  const rootRef = useRef(null);
  const noticeTimer = useRef(null);
  const sendingRef = useRef(false);
  const [sections, setSections] = useState(initialSections);
  const [liveSync, setLiveSync] = useState(() => localStorage.getItem(KPI_LIVE_SYNC_KEY) === 'true');
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState(readKpiHistory);
  const [showPreview, setShowPreview] = useState(false);
  const [simValues, setSimValues] = useState({});
  const [periodString, setPeriodString] = useState(() => String(new Date().getFullYear()));
  const [sending, setSending] = useState(false);
  const normalized = useMemo(() => normalizeKpiSections(sections), [sections]);
  const validation = useMemo(() => validateKpiSections(normalized), [normalized]);
  const hasBlockingError = validation.issues.some((issue) => issue.level === 'error');
  const selectedSection = normalized.find((section) => section.items.some((item) => item.id === selectedId));
  const selected = selectedSection?.items.find((item) => item.id === selectedId);
  const simulation = selected ? computeKpiItem(selected, simValues, selectedSection.isPenaltySection) : null;
  const totalRows = normalized.reduce((sum, section) => sum + section.items.length, 0);
  const notify = useCallback((message) => {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 6000);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KPI_DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), sections: normalized }));
    } catch {
      window.queueMicrotask(() => notify('Draft tidak dapat disimpan. Periksa penyimpanan browser.'));
    }
  }, [normalized, notify]);

  useEffect(() => {
    if (!liveSync || hasBlockingError) return undefined;
    const timer = window.setTimeout(() => {
      try {
        publishKpiSections(normalized, { actor: 'Superadmin PRP', note: 'Live sync', snapshot: false });
      } catch {
        notify('Live sync gagal menyimpan konfigurasi.');
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [normalized, liveSync, hasBlockingError, notify]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo('.designer-section', { opacity: 0, y: 16 }, {
      opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'expo.out', clearProps: 'all',
    });
  }, { scope: rootRef, dependencies: [normalized.length, showPreview] });

  const updateSection = (si, patch) => setSections((current) => current.map((section, index) => (
    index === si ? { ...section, ...patch } : section
  )));
  const editItems = (si, transform) => setSections((current) => current.map((section, index) => (
    index === si ? { ...section, items: transform(section.items, section) } : section
  )));
  const updateItem = (si, ii, patch) => editItems(si, (items) => items.map((item, index) => (
    index === ii ? { ...item, ...patch } : item
  )));
  const editSubs = (si, ii, transform) => editItems(si, (items) => items.map((item, index) => (
    index === ii ? { ...item, subrows: transform(item.subrows) } : item
  )));
  const insertRow = (si, ii, duplicate = false) => editItems(si, (items, section) => {
    const no = String(nextNumber(items));
    const item = duplicate ? {
      ...clone(items[ii]), id: createId(section.code), no, excelNo: no, hideExcelNo: false,
      subrows: items[ii].subrows.map((sub) => ({ ...sub, key: createId('input') })),
    } : blankItem(section.code, no);
    // Each indicator has a separate tbody in the entry sheet: no cross-item merges.
    delete item.hideIndikatorCell;
    const result = [...items];
    result.splice(ii + 1, 0, item);
    return result;
  });
  const addSubIndicator = (si, ii) => editItems(si, (items, section) => {
    const group = groupNumber(items[ii]) || nextNumber(items);
    const indexes = items.flatMap((item, index) => groupNumber(item) === group ? [index] : []);
    if (!indexes.includes(ii)) indexes.push(ii);
    indexes.sort((a, b) => a - b);
    const result = items.map((item, index) => {
      const position = indexes.indexOf(index);
      if (position < 0) return item;
      const no = `${group}${letters(position)}`;
      return { ...item, no, excelNo: no, hideExcelNo: false, hideIndikatorCell: false };
    });
    result.splice(Math.max(...indexes) + 1, 0, blankItem(section.code, `${group}${letters(indexes.length)}`));
    return result;
  });
  const changeCalcType = (si, ii, item, calcType) => updateItem(si, ii, {
    calcType,
    formulaExpr: calcType === 'custom'
      ? PRESET_FORMULA_EXPR[item.calcType] ?? item.formulaExpr ?? ''
      : PRESET_FORMULA_EXPR[calcType] ?? '',
  });
  const addSection = () => setSections((current) => {
    let number = current.length;
    let code;
    do { code = letters(number++).toUpperCase(); } while (current.some((section) => section.code === code));
    return [...current, { code, title: 'Bagian baru', totalWeight: 0, isPenaltySection: false, items: [blankItem(code, 1)] }];
  });
  const distribute = async () => {
    if (sendingRef.current) return;
    if (hasBlockingError || !periodString.trim()) {
      notify('Perbaiki error validasi dan isi periode sebelum mengirim.');
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      const result = await distributeKpiForm(normalized, { period: periodString });
      setHistory(readKpiHistory());
      notify(`Form v${result.version} dikirim ke Unit Kerja. ID: ${result.id}`);
    } catch (error) {
      notify(`Pengiriman gagal: ${error?.message || 'Silakan coba kembali.'}`);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };
  const updateSimulation = (key, value) => setSimValues((current) => ({ ...current, [key]: value }));

  return (
    <div ref={rootRef} className="kpi-designer-page" aria-busy={sending}>
      <header className="designer-hero">
        <div>
          <div className="designer-kicker"><Wand2 size={15} /> PRP / KPI GOVERNANCE</div>
          <h1>Desainer Tabel KPI</h1>
          <p>Edit struktur seperti Excel. Draft tersimpan otomatis; simulasi bukan data aktual.</p>
        </div>
        <div className="designer-actions">
          <button type="button" onClick={() => {
            setSections(migrate(KPI_SECTIONS_CONFIG));
            setSimValues({});
            notify('Draft dikembalikan ke struktur default.');
          }}><RotateCcw size={15} /> Reset draft</button>
          <Field label="Periode pengiriman" value={periodString} onChange={setPeriodString} />
          <button type="button" className="primary" disabled={sending || hasBlockingError || !periodString.trim()} onClick={distribute}>
            <Send size={15} /> {sending ? 'Mengirim…' : 'Kirim ke Unit Kerja'}
          </button>
        </div>
      </header>
      <div className="designer-toolbar">
        <span><strong>{totalRows}</strong> indikator · <strong>{normalized.length}</strong> bagian · {validation.issues.length} catatan validasi</span>
        <div className="designer-actions">
          <label className="designer-check">
            <input type="checkbox" checked={liveSync} onChange={(event) => {
              setLiveSync(event.target.checked);
              localStorage.setItem(KPI_LIVE_SYNC_KEY, String(event.target.checked));
            }} /> Live sync konfigurasi (opsional)
          </label>
          <button type="button" aria-pressed={showPreview} onClick={() => setShowPreview((value) => !value)}>
            <Eye size={15} /> {showPreview ? 'Kembali ke editor' : 'Preview user'}
          </button>
        </div>
      </div>
      <div className="designer-notice" role="status" aria-live="polite">{notice}</div>
      {showPreview ? (
        <div className="designer-preview">
          <p className="designer-sim-banner">PREVIEW SAJA — tidak membaca atau menyimpan nilai aktual Unit Kerja.</p>
          <KPIDataEntrySheet sectionsOverride={normalized} persist={false} readOnly />
        </div>
      ) : (
        <div className="designer-layout">
          <main className="designer-canvas" aria-label="Editor struktur KPI">
            {normalized.map((section, si) => (
              <section className="designer-section" key={si} aria-label={`Bagian ${section.code}`}>
                <div className="designer-section-head">
                  <Field label="Kode bagian" value={section.code} onChange={(value) => updateSection(si, { code: value.toUpperCase() })} />
                  <Field label="Judul bagian" value={section.title} onChange={(value) => updateSection(si, { title: value })} />
                  <Field label="Bobot bagian" type="number" step="any" value={section.totalWeight} onChange={(value) => updateSection(si, { totalWeight: value })} />
                  <label className="designer-check"><input type="checkbox" checked={section.isPenaltySection} onChange={(event) => updateSection(si, { isPenaltySection: event.target.checked })} /> Penalti</label>
                  <IconButton label={`Hapus bagian ${section.code}`} disabled={normalized.length <= 1} onClick={() => setSections((current) => current.filter((_, index) => index !== si))}><Trash2 size={16} /></IconButton>
                </div>
                <div className="designer-table-scroll" tabIndex={0} role="region" aria-label={`Tabel KPI bagian ${section.code}`}>
                  <table className="designer-table">
                    <caption>Bagian {section.code}: {section.title} — nilai isian hanya simulasi</caption>
                    <thead>
                      <tr>{['No.', 'Indikator kinerja', 'Formula / rumus', 'Rumusan pencapaian', 'Isian SIMULASI', 'Bobot', 'Target', 'Satuan', 'Hasil SIMULASI', 'Aksi baris'].map((title) => <th scope="col" key={title}>{title}</th>)}</tr>
                    </thead>
                    {section.items.map((item, ii) => {
                      const computed = computeKpiItem(item, simValues, section.isPenaltySection);
                      const formulaError = item.calcType === 'custom' ? validateKpiFormula(item.formulaExpr, item.subrows.length) : null;
                      const rowLabel = `${section.code}.${item.no}`;
                      return (
                        <tbody key={item.id} className={selectedId === item.id ? 'selected' : ''} onFocus={() => setSelectedId(item.id)} onClick={() => setSelectedId(item.id)}>
                          {item.subrows.map((sub, subi) => {
                            const patchSub = (patch) => editSubs(si, ii, (subs) => subs.map((entry, index) => index === subi ? { ...entry, ...patch } : entry));
                            return <tr key={sub.key} data-rumusan-key={sub.key}>
                            {subi === 0 && <>
                            <td rowSpan={item.subrows.length}><Field label={`Nomor ${rowLabel}`} value={item.no} onChange={(value) => updateItem(si, ii, { no: value, excelNo: value, hideExcelNo: false })} /></td>
                            <td rowSpan={item.subrows.length}><Field label={`Indikator ${rowLabel}`} value={item.indikator} onChange={(value) => updateItem(si, ii, { indikator: value })} /></td>
                            <td rowSpan={item.subrows.length}>
                              <Field label={`Deskripsi rumus ${rowLabel}`} value={item.formula} onChange={(value) => updateItem(si, ii, { formula: value })} />
                              <label className="designer-field">
                                <span>Tipe perhitungan {rowLabel}</span>
                                <select value={item.calcType} onChange={(event) => changeCalcType(si, ii, item, event.target.value)}>
                                  {Object.entries(CALC_TYPES).map(([key, type]) => <option key={key} value={key}>{type.label}</option>)}
                                </select>
                              </label>
                              {item.calcType === 'custom' ? (
                                <>
                                  <Field label={`Ekspresi Excel ${rowLabel}`} value={item.formulaExpr} aria-invalid={Boolean(formulaError)} aria-describedby={`formula-${item.id}`} onChange={(value) => updateItem(si, ii, { formulaExpr: value })} />
                                  <small id={`formula-${item.id}`} className={formulaError ? 'error' : 'valid'} role="status">{formulaError || 'Sintaks valid'} · I1–I{item.subrows.length}, T = target, B = bobot. Hasil = capaian %.</small>
                                </>
                              ) : <small>{CALC_TYPES[item.calcType]?.expression}</small>}
                              {PRESET_FORMULA_EXPR[item.calcType] && <button type="button" onClick={() => changeCalcType(si, ii, item, 'custom')}>Edit preset sebagai rumus bebas</button>}
                              {item.calcType === 'compliance_date_single' && <Field label={`Batas waktu ${rowLabel}`} type="date" value={item.deadlineISO} onChange={(value) => updateItem(si, ii, { deadlineISO: value })} />}
                              {item.calcType === 'compliance_date_dual' && [0, 1].map((index) => (
                                <Field key={index} label={`Batas semester ${index + 1} ${rowLabel}`} type="date" value={item.deadlinesISO?.[index]} onChange={(value) => {
                                  const deadlinesISO = [...(item.deadlinesISO || ['', ''])];
                                  deadlinesISO[index] = value;
                                  updateItem(si, ii, { deadlinesISO });
                                }} />
                              ))}
                            </td>
                            </>}
                            {/* Rumusan dan Isian memakai satu tr/key agar selalu sejajar. */}
                            <td>
                                  <div className="designer-subrow" key={sub.key}>
                                    <Field label={`Rumusan ${subi + 1} · I${subi + 1} · ${rowLabel}`} value={sub.label} onChange={(value) => patchSub({ label: value })} />
                                    <Field label={`Placeholder I${subi + 1} · ${rowLabel}`} value={sub.placeholder} onChange={(value) => patchSub({ placeholder: value })} />
                                    <label className="designer-check"><input type="checkbox" checked={Boolean(sub.isTextInput)} onChange={(event) => patchSub({ isTextInput: event.target.checked })} /> Teks / tanggal</label>
                                    <div className="designer-actions">
                                      <IconButton label={`Naikkan I${subi + 1} ${rowLabel}`} disabled={subi === 0} onClick={() => editSubs(si, ii, (subs) => move(subs, subi, -1))}><ArrowUp size={13} /></IconButton>
                                      <IconButton label={`Turunkan I${subi + 1} ${rowLabel}`} disabled={subi === item.subrows.length - 1} onClick={() => editSubs(si, ii, (subs) => move(subs, subi, 1))}><ArrowDown size={13} /></IconButton>
                                      <button type="button" aria-label={`Sisipkan baris rumusan setelah I${subi + 1} ${rowLabel}`} onClick={() => editSubs(si, ii, (subs) => [...subs.slice(0, subi + 1), newSub(subi + 2), ...subs.slice(subi + 1)])}><Plus size={13} /> Sisipkan rumusan di bawah</button>
                                      <IconButton label={`Duplikat I${subi + 1} ${rowLabel}`} onClick={() => editSubs(si, ii, (subs) => [...subs.slice(0, subi + 1), { ...sub, key: createId('input') }, ...subs.slice(subi + 1)])}><Copy size={13} /></IconButton>
                                      <IconButton label={`Hapus I${subi + 1} ${rowLabel}`} disabled={item.subrows.length <= 1} onClick={() => editSubs(si, ii, (subs) => subs.filter((_, index) => index !== subi))}><Trash2 size={13} /></IconButton>
                                    </div>
                                  </div>
                              {subi === item.subrows.length - 1 && <>
                              <button type="button" aria-label={`Tambah baris rumusan pencapaian ${rowLabel}`} onClick={() => editSubs(si, ii, (subs) => [...subs, newSub(subs.length + 1)])}><Plus size={13} /> Tambah baris rumusan</button>
                              <small style={{ display: 'block', marginTop: '.5rem' }}>
                                Menambah rincian dan kolom Isian pada indikator yang sama. Rumus tidak berubah otomatis; sesuaikan referensi I1, I2, dan seterusnya bila rincian baru ikut dihitung. Penyisipan atau pemindahan mengubah urutan referensi tersebut.
                              </small>
                              </>}
                            </td>
                            <td className="designer-sim-cell">
                              <Field label={`SIMULASI I${subi + 1} · ${rowLabel}`} value={simValues[sub.key]} placeholder={sub.placeholder} onChange={(value) => updateSimulation(sub.key, value)} />
                            </td>
                            {subi === 0 && <>
                            <td rowSpan={item.subrows.length}><Field label={`Bobot ${rowLabel}`} type="number" step="any" value={item.bobot} onChange={(value) => updateItem(si, ii, { bobot: value })} /></td>
                            <td rowSpan={item.subrows.length}><Field label={`Target ${rowLabel}`} type="number" step="any" value={item.targetNum} onChange={(value) => updateItem(si, ii, { targetNum: value, targetDisplay: value === '' ? '' : formatIndonesianNumber(Number(value)) })} /></td>
                            <td rowSpan={item.subrows.length}><Field label={`Satuan ${rowLabel}`} value={item.satuan} onChange={(value) => updateItem(si, ii, { satuan: value })} /></td>
                            <td rowSpan={item.subrows.length} className="designer-sim-cell">
                              <strong>SIMULASI</strong>
                              <p>Capaian: {computed.ratioPercent == null ? '—' : `${formatIndonesianNumber(computed.ratioPercent)}%`}</p>
                              <p>Skor: {formatIndonesianNumber(computed.weightedScore)}</p>
                              <small>{computed.extraNote}</small>
                            </td>
                            <td rowSpan={item.subrows.length}>
                              <div className="designer-row-actions">
                                <button type="button" onClick={() => addSubIndicator(si, ii)}><Plus size={13} /> Sub-indikator</button>
                                <button type="button" onClick={() => insertRow(si, ii)}><Plus size={13} /> Sisipkan di bawah</button>
                                <button type="button" onClick={() => insertRow(si, ii, true)}><Copy size={13} /> Duplikat</button>
                                <button type="button" disabled={ii === 0} onClick={() => editItems(si, (items) => move(items, ii, -1))}><ArrowUp size={13} /> Naik</button>
                                <button type="button" disabled={ii === section.items.length - 1} onClick={() => editItems(si, (items) => move(items, ii, 1))}><ArrowDown size={13} /> Turun</button>
                                <button type="button" className="danger" onClick={() => editItems(si, (items) => items.filter((_, index) => index !== ii))}><Trash2 size={13} /> Hapus</button>
                              </div>
                            </td>
                            </>}
                          </tr>;
                          })}
                        </tbody>
                      );
                    })}
                  </table>
                </div>
                <button type="button" className="designer-add" onClick={() => insertRow(si, section.items.length - 1)}><Plus size={15} /> Tambah indikator</button>
              </section>
            ))}
            <button type="button" className="designer-add" onClick={addSection}><Plus size={16} /> Tambah bagian KPI</button>
          </main>
          <aside className="designer-aside" aria-label="Validasi, simulasi, dan riwayat">
            <section className="designer-panel">
              <h2>Validasi struktur</h2>
              <p>Error memblokir pengiriman. Peringatan tetap perlu ditinjau.</p>
              {validation.issues.length ? <ul>{validation.issues.map((issue, index) => <li className={issue.level} key={index}>{issue.message}</li>)}</ul> : <p className="valid">Struktur siap dikirim.</p>}
            </section>
            <section className="designer-panel">
              <h2>Simulasi — bukan aktual</h2>
              <p>Tidak disimpan sebagai realisasi dan tidak ikut dikirim.</p>
              {selected ? (
                <>
                  <strong>{selected.no}. {selected.indikator}</strong>
                  {selected.subrows.map((sub, index) => <Field key={sub.key} label={`SIMULASI I${index + 1}: ${sub.label}`} value={simValues[sub.key]} onChange={(value) => updateSimulation(sub.key, value)} />)}
                  <p>Capaian simulasi: {simulation?.ratioPercent == null ? '—' : `${formatIndonesianNumber(simulation.ratioPercent)}%`}</p>
                  <p>Skor simulasi: {formatIndonesianNumber(simulation?.weightedScore)}</p>
                </>
              ) : <p>Pilih atau fokuskan satu baris.</p>}
              <button type="button" onClick={() => setSimValues({})}><RotateCcw size={13} /> Kosongkan simulasi</button>
            </section>
            <section className="designer-panel">
              <h2>Riwayat konfigurasi</h2>
              {history.length ? history.map((snapshot, index) => (
                <div className="designer-history" key={`${snapshot.version}-${index}`}>
                  <span>v{snapshot.version}<small>{new Date(snapshot.publishedAt).toLocaleString('id-ID')}</small></span>
                  <IconButton label={`Pulihkan v${snapshot.version} ke draft`} disabled={!snapshot.sections} onClick={() => {
                    setSections(migrate(clone(snapshot.sections)));
                    setSimValues({});
                    notify(`v${snapshot.version} dipulihkan ke draft, belum dikirim.`);
                  }}><RotateCcw size={15} /></IconButton>
                </div>
              )) : <p>Belum ada snapshot.</p>}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
