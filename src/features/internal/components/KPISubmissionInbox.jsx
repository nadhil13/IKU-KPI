import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import KPIDataEntrySheet from '../../kpi/components/KPIDataEntrySheet';
import { KPI_TRANSITIONS, readKpiWorkflow, readUnitSubmission, readUnitEvidence, reviewUnitKpi, reviewUnitEvidence, subscribeKpiWorkflow } from '../../kpi/kpiWorkflowStore';
import { formatIndonesianNumber } from '../../kpi/kpiSchema';

const labels = { SUBMITTED: 'Dikirim unit', APPROVED: 'Disetujui', NEEDS_REVISION: 'Perlu revisi / buka kembali', REJECTED: 'Ditolak', LOCKED: 'Dikunci' };
/** Label tombol transisi: dari LOCKED, NEEDS_REVISION berarti membuka kembali submission. */
const actionLabel = (from, to) => (from === 'LOCKED' && to === 'NEEDS_REVISION' ? 'Buka kembali (unlock)' : labels[to]);

export default function KPISubmissionInbox({ focus }) {
  const { currentUser } = useAuth();
  const [state, setState] = useState(readKpiWorkflow);
  const [selected, setSelected] = useState(focus || null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [note, setNote] = useState('');
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => subscribeKpiWorkflow(() => setState(readKpiWorkflow())), []);
  // Buka detail saat dipilih dari daftar submission terpadu.
  useEffect(() => { if (focus) { setSelected(focus); setNote(''); setComplete(false); setError(''); } }, [focus]);
  const mutate = (action) => {
    setError('');
    try {
      if (!currentUser) throw new Error('Silakan masuk kembali.');
      action(); setComplete(false);
    } catch (err) { setError(err.message); }
  };
  const form = state.forms.find((f) => f.id === selected?.formId);
  const record = selected && readUnitSubmission(selected.formId, selected.email, state);
  return <div className="gov-table">
    <h2>Submission Unit Kerja</h2>
    <label>Cari unit/periode <input value={search} onChange={(e) => setSearch(e.target.value)} /></label>
    <label>Status <select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Semua</option><option value="EMPTY">Belum submit</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {error && <p role="alert">{error}</p>}
    {!state.forms.length && <p>Belum ada distribusi.</p>}
    {[...state.forms].reverse().map((f) => <section key={f.id} style={{ padding: '1rem', overflowX: 'auto' }}>
      <h3>Periode {f.period} · v{f.version}</h3>
      <table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>Unit</th><th>Status</th><th>Skor</th><th>Tindakan</th></tr></thead><tbody>
        {f.units.filter((u) => `${u.name} ${u.email} ${f.period}`.toLowerCase().includes(search.toLowerCase())).map((u) => {
          const r = readUnitSubmission(f.id, u.email, state);
          if (filter && (r?.status || 'EMPTY') !== filter) return null;
          return <tr key={u.email}><td>{u.name}<small style={{ display: 'block' }}>{u.email}</small></td><td>{labels[r?.status] || 'Belum submit'}</td><td>{r ? formatIndonesianNumber(r.totalScore) : '—'}</td><td>{r && <button onClick={() => { setSelected({ formId: f.id, email: u.email }); setNote(''); setComplete(false); setError(''); }}>Tinjau</button>}</td></tr>;
        })}
      </tbody></table>
    </section>)}
    {record && form && <div role="dialog" aria-modal="true" aria-label="Tinjauan KPI" style={{ position: 'fixed', inset: '3vh 3vw', zIndex: 1000, overflow: 'auto', padding: '1.5rem', background: 'white', border: '2px solid #cbd5e1', borderRadius: 12 }}>
      <button onClick={() => setSelected(null)}>Tutup detail</button>
      <h3>{record.unit} · {form.period} · {labels[record.status]}</h3>
      {error && <p role="alert">{error}</p>}
      <label>Catatan / alasan wajib untuk revisi, buka kembali, atau penolakan<textarea value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <h4>Bukti pendukung</h4>
      {!readUnitEvidence(form.id, record.email, state).length && <p>Belum ada bukti.</p>}
      {readUnitEvidence(form.id, record.email, state).map((e) => <div key={e.id} style={{ marginBottom: 12 }}>
        <a href={e.url} target="_blank" rel="noopener noreferrer">{e.label}</a> · {e.indicatorId} · {e.status} · {e.note}
        {record.status === 'SUBMITTED' && <><button disabled={!note.trim()} title={note.trim() ? '' : 'Isi catatan pemeriksaan terlebih dahulu'} onClick={() => mutate(() => reviewUnitEvidence(form.id, record.email, e.id, 'VERIFIED', note, currentUser))}>Verifikasi bukti</button><button disabled={!note.trim()} onClick={() => mutate(() => reviewUnitEvidence(form.id, record.email, e.id, 'REJECTED', note, currentUser))}>Tolak bukti</button></>}
      </div>)}
      <label><input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />Saya telah memeriksa kelengkapan isian dan bukti.</label>
      {(() => {
        // Ringkasan kelengkapan bukti sebagai dasar keputusan persetujuan.
        const items = readUnitEvidence(form.id, record.email, state);
        const verified = items.filter((e) => e.status === 'VERIFIED').length;
        return <p>Bukti terverifikasi: {verified}/{items.length}{items.length && verified < items.length ? ' — setujui setelah semua bukti terverifikasi.' : ''}</p>;
      })()}
      <div>{(KPI_TRANSITIONS[record.status] || []).filter((s) => s !== 'SUBMITTED').map((status) => <button key={status} disabled={(status === 'APPROVED' && !complete) || (status !== 'APPROVED' && status !== 'LOCKED' && !note.trim())} onClick={() => {
        // Membuka kembali data terkunci adalah aksi sensitif: minta konfirmasi eksplisit.
        if (record.status === 'LOCKED' && !window.confirm('Buka kembali submission yang sudah dikunci? Unit dapat mengubah data lagi.')) return;
        mutate(() => reviewUnitKpi(form.id, record.email, status, note, currentUser));
      }}>{actionLabel(record.status, status)}</button>)}</div>
      <h4>Riwayat dan snapshot</h4>
      {(record.history || []).map((h, index) => <details key={index}><summary>{h.at} · {h.from} → {h.status} · {h.actor?.email || 'Legacy'} · {h.note}</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(h.snapshot, null, 2)}</pre></details>)}
      <KPIDataEntrySheet key={`${form.id}:${record.email}`} sectionsOverride={form.sections} valuesOverride={record.values} persist={false} readOnly />
    </div>}
  </div>;
}