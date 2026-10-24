import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import { readKpiWorkflow, readUnitEvidence, readUnitSubmission, subscribeKpiWorkflow } from '../../kpi/kpiWorkflowStore';
import { getIkuPeriods, listIkuSubmissions, subscribeIku } from '../../iku/ikuWorkflowStore';
import { readSystemConfig } from '../adminStore';

/** Label status lintas modul (IKU & KPI memakai kode status yang sama). */
const STATUS = { EMPTY: 'Belum submit', DRAFT: 'Draft', SUBMITTED: 'Menunggu review', NEEDS_REVISION: 'Perlu revisi', APPROVED: 'Disetujui', REJECTED: 'Ditolak', LOCKED: 'Dikunci' };
const TONE = { SUBMITTED: '#0369a1', APPROVED: '#047857', LOCKED: '#334155', REJECTED: '#b91c1c', NEEDS_REVISION: '#b45309' };

/** Gabungkan submission KPI (per form × unit) dan IKU menjadi satu daftar baris seragam. */
function collectRows(user) {
  const kpi = readKpiWorkflow();
  const kpiRows = kpi.forms.flatMap((form) => form.units.map((unit) => {
    const record = readUnitSubmission(form.id, unit.email, kpi);
    const evidence = readUnitEvidence(form.id, unit.email, kpi);
    return {
      key: `kpi:${form.id}:${unit.email}`, module: 'KPI', unit: record?.unit || unit.name, email: unit.email,
      period: `${form.period} · v${form.version}`, status: record?.status || 'EMPTY', updatedAt: record?.history?.at(-1)?.at || record?.submittedAt || '',
      // KPI hanya bisa dikirim bila seluruh isian valid, jadi kelengkapan ditampilkan sebagai skor total.
      filled: record ? `Skor ${record.totalScore ?? '—'}` : '—', evidence: evidence.length ? `${evidence.filter((e) => e.status === 'VERIFIED').length}/${evidence.length} terverifikasi` : 'Belum ada',
      formId: form.id,
    };
  }));
  const periods = getIkuPeriods();
  const periodLabel = (id) => periods.find((p) => p.id === id)?.label || id;
  let ikuRows = [];
  try {
    ikuRows = listIkuSubmissions(user).map((record) => {
      const withEvidence = record.values.filter((row) => row.evidence);
      const filled = record.values.filter((row) => row.actual !== '' && row.target !== '').length;
      return {
        key: `iku:${record.id}`, id: record.id, periodId: record.period, module: 'IKU', unit: record.unit, email: record.owner,
        period: periodLabel(record.period), status: record.status,
        updatedAt: record.updatedAt || '', filled: `${filled}/${record.values.length} indikator`,
        evidence: withEvidence.length ? `${withEvidence.filter((row) => row.verification === 'VERIFIED').length}/${withEvidence.length} terverifikasi` : 'Belum ada',
      };
    });
  } catch { /* Akses IKU ditolak: tampilkan KPI saja. */ }
  return [...kpiRows, ...ikuRows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export default function AllSubmissionsTable({ onReviewKpi }) {
  const { currentUser } = useAuth();
  const [tick, setTick] = useState(0);
  const [module, setModule] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    const offKpi = subscribeKpiWorkflow(refresh);
    const offIku = subscribeIku(refresh);
    return () => { offKpi(); offIku(); };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => collectRows(currentUser), [currentUser, tick]);
  const visible = rows.filter((row) => (!module || row.module === module) && (!status || row.status === status)
    && `${row.unit} ${row.email} ${row.period}`.toLowerCase().includes(search.trim().toLowerCase()));
  const count = (value) => rows.filter((row) => row.status === value).length;
  const deadline = readSystemConfig().submissionDeadline;

  return <div className="gov-table" style={{ marginBottom: '1rem' }}>
    <div className="gov-table-head">
      <div><h2>Semua submission IKU & KPI</h2><span>{rows.length} baris · {count('SUBMITTED')} menunggu review · {count('NEEDS_REVISION')} revisi · {count('LOCKED')} dikunci{deadline ? ` · tenggat global ${new Date(deadline).toLocaleString('id-ID')}` : ''}</span></div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '.6rem', padding: '.8rem 1rem' }}>
      <input className="gov-field" type="search" aria-label="Cari submission" placeholder="Cari unit, email, periode…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select className="gov-field" aria-label="Filter modul" value={module} onChange={(e) => setModule(e.target.value)}><option value="">Semua modul</option><option>IKU</option><option>KPI</option></select>
      <select className="gov-field" aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua status</option>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </div>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.74rem' }}>
        <thead><tr style={{ textAlign: 'left', color: '#64748b' }}>{['Modul', 'Unit', 'Periode', 'Status', 'Kelengkapan', 'Bukti', 'Diperbarui', ''].map((h) => <th key={h} style={{ padding: '.6rem 1rem' }}>{h}</th>)}</tr></thead>
        <tbody>
          {visible.map((row) => <tr key={row.key} style={{ borderTop: '1px solid #f1f5f9' }}>
            <td style={{ padding: '.6rem 1rem', fontWeight: 800 }}>{row.module}</td>
            <td style={{ padding: '.6rem 1rem' }}>{row.unit}<small style={{ display: 'block', color: '#94a3b8' }}>{row.email}</small></td>
            <td style={{ padding: '.6rem 1rem' }}>{row.period}</td>
            <td style={{ padding: '.6rem 1rem', color: TONE[row.status] || '#64748b', fontWeight: 750 }}>{STATUS[row.status] || row.status}</td>
            <td style={{ padding: '.6rem 1rem' }}>{row.filled}</td>
            <td style={{ padding: '.6rem 1rem' }}>{row.evidence}</td>
            <td style={{ padding: '.6rem 1rem' }}>{row.updatedAt ? new Date(row.updatedAt).toLocaleString('id-ID') : '—'}</td>
            <td style={{ padding: '.6rem 1rem' }}>
              {row.module === 'IKU'
                ? <Link className="gov-button" to={`/internal/iku-submissions?period=${encodeURIComponent(row.periodId)}&id=${encodeURIComponent(row.id)}`}>Tinjau</Link>
                : row.status !== 'EMPTY' && <button type="button" className="gov-button" onClick={() => onReviewKpi?.({ formId: row.formId, email: row.email })}>Tinjau</button>}
            </td>
          </tr>)}
        </tbody>
      </table>
      {!visible.length && <div className="gov-placeholder">Tidak ada submission yang sesuai.</div>}
    </div>
  </div>;
}
