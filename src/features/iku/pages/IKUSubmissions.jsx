import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import { readSystemConfig } from '../../internal/adminStore';
import { IKU_INDICATORS, IKU_TRANSITIONS, emptyIkuValues, getIkuPeriods, ikuInputIssue, ikuPercentage, listIkuSubmissions, saveIkuSubmission, reviewIkuSubmission, verifyIkuEvidence, subscribeIku } from '../ikuWorkflowStore';

const labels = { DRAFT: 'Draft', SUBMITTED: 'Menunggu review', NEEDS_REVISION: 'Perlu revisi', APPROVED: 'Disetujui', REJECTED: 'Ditolak', LOCKED: 'Dikunci' };
const actions = { APPROVED: 'Setujui', NEEDS_REVISION: 'Buka / minta revisi', REJECTED: 'Tolak', LOCKED: 'Kunci' };
export default function IKUSubmissions() {
  const { currentUser } = useAuth();
  const admin = currentUser?.role === 'superadmin_prp';
  const [tick, refresh] = useState(0);
  const periods = getIkuPeriods();
  const [period, setPeriod] = useState(() => periods.find((p) => p.status === 'Active')?.id || periods[0].id);
  const [selected, setSelected] = useState('');
  const [values, setValues] = useState(emptyIkuValues);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [dirty, setDirty] = useState(false);
  const records = listIkuSubmissions(currentUser).filter((r) => r.period === period);
  const record = admin ? records.find((r) => r.id === selected) : records[0];
  const issue = ikuInputIssue(period);
  const editable = !admin && !issue && (!record || ['DRAFT', 'NEEDS_REVISION'].includes(record.status));
  useEffect(() => subscribeIku(() => refresh((n) => n + 1)), []);
  useEffect(() => {
    const timer = window.setInterval(() => refresh((n) => n + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    setValues(record?.values || emptyIkuValues()); setReason(''); setDirty(false);
  }, [record?.id, record?.updatedAt, period]);
  // Configuration and permissions are also re-read on every store mutation.
  void tick;
  const run = (operation, message) => {
    try { operation(); setFeedback({ ok: true, text: message }); setReason(''); refresh((n) => n + 1); }
    catch (error) { setFeedback({ ok: false, text: error.message }); }
  };
  const change = (id, field, value) => { setDirty(true); setValues((rows) => rows.map((r) => r.id === id ? { ...r, [field]: value } : r)); };
  const display = admin ? record?.values || [] : values;
  const maintenance = readSystemConfig().maintenanceMode;
  return <section className="iku-submissions">
    <style>{`
      .iku-submissions{max-width:1320px;margin:auto;padding:clamp(16px,3vw,36px);color:#0f172a}
      .iku-submissions h1{font-size:clamp(24px,3vw,36px);margin:8px 0}.iku-submissions p{color:#475569;line-height:1.6}
      .iku-submissions .iku-card{background:white;border:1px solid #dbe3ed;border-radius:16px;padding:20px;margin:16px 0;box-shadow:0 4px 16px #0f172a05}
      .iku-submissions .iku-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px}
      .iku-submissions label{display:flex;flex-direction:column;gap:7px;font-weight:600;font-size:14px;margin:10px 0}
      .iku-submissions input,.iku-submissions textarea,.iku-submissions select{width:100%;box-sizing:border-box;padding:11px;border:1px solid #94a3b8;border-radius:8px;background:#fff;color:#0f172a;font:inherit}
      .iku-submissions textarea{min-height:76px;resize:vertical}.iku-submissions button{padding:10px 16px;border:1px solid #cbd5e1;border-radius:8px;background:#0f5265;color:white;font:inherit;cursor:pointer}
      .iku-submissions button:disabled{opacity:.5;cursor:not-allowed}.iku-submissions :focus-visible{outline:3px solid #0284c7;outline-offset:3px}
      .iku-submissions .iku-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}.iku-submissions .iku-badge{display:inline-block;padding:6px 12px;border-radius:30px;background:#e0f2fe;color:#075985;font-size:13px;font-weight:700}
      .iku-submissions .iku-feedback{padding:14px;border-radius:10px;background:#ecfdf5;color:#065f46}.iku-submissions .iku-error{background:#fff7ed;color:#9a3412}.iku-submissions a{color:#0369a1;overflow-wrap:anywhere}.iku-submissions summary{cursor:pointer;font-weight:600}.iku-submissions pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}
    `}</style>
    <span className="iku-badge">{admin ? 'PRP • Review seluruh unit' : 'Workspace IKU • Submission unit'}</span>
    <h1>Submission 8 Indikator IKU</h1>
    <p>Indikator generik untuk pencatatan internal. Capaian = aktual ÷ target × 100%, tanpa pembatasan 100%. Ini bukan rumus resmi kementerian. Data tersimpan lokal pada browser ini; bukan layanan server bersama.</p>
    {feedback && <div role={feedback.ok ? 'status' : 'alert'} className={`iku-feedback ${feedback.ok ? '' : 'iku-error'}`}>{feedback.text}</div>}
    <div className="iku-card iku-grid">
      <label>Periode<select value={period} onChange={(e) => { setPeriod(e.target.value); setSelected(''); setFeedback(null); }}>{periods.map((p) => <option key={p.id} value={p.id}>{p.label} • {p.status}</option>)}</select></label>
      {admin && <label>Submission unit<select value={selected} onChange={(e) => { setSelected(e.target.value); setFeedback(null); }}><option value="">Pilih submission ({records.length})</option>{records.map((r) => <option key={r.id} value={r.id}>{r.unit} — {r.owner} — {labels[r.status]}</option>)}</select></label>}
      <div><p>Bukti per indikator: <strong>{readSystemConfig().evidenceRequired !== false ? 'Wajib' : 'Opsional'}</strong></p><span className="iku-badge">{labels[record?.status] || (admin ? 'Belum dipilih' : 'Draft baru')}{dirty ? ' • Belum disimpan' : ''}</span></div>
    </div>
    {issue && <p role="status" className="iku-feedback iku-error">{issue} {!admin && 'Input dan pengiriman dinonaktifkan.'}</p>}
    {!admin && !editable && record && <p>Input terkunci. PRP harus meminta / membuka revisi sebelum perubahan berikutnya.</p>}
    {admin && !record && <div className="iku-card">Pilih submission untuk meninjau data, bukti, dan riwayat. {records.length === 0 && 'Belum ada submission pada periode ini.'}</div>}
    <div className="iku-grid">{display.map((row, i) => <article className="iku-card" key={row.id}>
      <h2 style={{ fontSize: 20 }}>{IKU_INDICATORS[i].label}</h2>
      <div className="iku-grid">
        <label>Aktual<input aria-label={`Aktual indikator ${i + 1}`} type="number" min="0" step="any" value={row.actual} disabled={!editable} onChange={(e) => change(row.id, 'actual', e.target.value)} /></label>
        <label>Target<input aria-label={`Target indikator ${i + 1}`} type="number" min="0.000000001" step="any" value={row.target} disabled={!editable} onChange={(e) => change(row.id, 'target', e.target.value)} /></label>
      </div>
      <p><strong>Capaian: {ikuPercentage(row) === null ? '—' : `${ikuPercentage(row).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`}</strong></p>
      <label>Catatan<textarea aria-label={`Catatan indikator ${i + 1}`} value={row.notes} disabled={!editable} onChange={(e) => change(row.id, 'notes', e.target.value)} /></label>
      <label>URL bukti HTTPS<input aria-label={`Bukti indikator ${i + 1}`} type="url" placeholder="https://…" value={row.evidence} disabled={!editable} onChange={(e) => change(row.id, 'evidence', e.target.value)} /></label>
      {row.evidence && /^https:\/\//i.test(row.evidence) && <a href={row.evidence} target="_blank" rel="noopener noreferrer">Buka bukti indikator {i + 1} (tab baru)</a>}
      {row.evidence && <p>Status bukti: {row.verification}{row.verificationNote ? ` — ${row.verificationNote}` : ''}</p>}
      {admin && record?.status === 'SUBMITTED' && row.evidence && <div className="iku-actions">{['VERIFIED', 'REJECTED'].map((status) => <button key={status} disabled={maintenance || !reason.trim()} onClick={() => run(() => verifyIkuEvidence(currentUser, record.id, row.id, status, reason), 'Hasil verifikasi bukti disimpan.')}>{status === 'VERIFIED' ? 'Verifikasi bukti' : 'Tolak bukti'}</button>)}</div>}
    </article>)}</div>
    {!admin && <div className="iku-card iku-actions"><button disabled={!editable} onClick={() => run(() => saveIkuSubmission(currentUser, period, values), 'Draft tersimpan.')}>Simpan draft</button><button disabled={!editable} onClick={() => run(() => saveIkuSubmission(currentUser, period, values, true), 'Submission terkirim. Input kini terkunci.')}>Kirim submission</button></div>}
    {admin && record && <div className="iku-card"><h2>Keputusan & verifikasi</h2><label>Alasan / catatan wajib (juga untuk verifikasi bukti)<textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tuliskan dasar keputusan atau hasil pemeriksaan bukti…" /></label><div className="iku-actions">{(IKU_TRANSITIONS[record.status] || []).map((status) => <button key={status} disabled={maintenance || !reason.trim()} onClick={() => run(() => reviewIkuSubmission(currentUser, record.id, status, reason), 'Keputusan PRP tersimpan.')}>{actions[status]}</button>)}</div><p>Reopen mengembalikan status ke Perlu revisi; batas periode dan tenggat tetap berlaku. Verifikasi URL dilakukan manual, bukan pemeriksaan otomatis isi dokumen.</p></div>}
    {record && <div className="iku-card"><h2>Riwayat & snapshot ({record.history.length})</h2>{[...record.history].reverse().map((entry, i) => <details key={`${entry.at}-${i}`} style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0' }}><summary>{new Date(entry.at).toLocaleString('id-ID')} • {entry.action} • {entry.actor.email}</summary><p>{entry.reason}</p><p>{entry.from || 'Baru'} → {entry.status}</p><pre>{JSON.stringify(entry.snapshot, null, 2)}</pre></details>)}</div>}
  </section>;
}