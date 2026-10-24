import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { readKpiWorkflow, readUnitEvidence, readUnitSubmission, subscribeKpiWorkflow } from '../../kpi/kpiWorkflowStore';
import { getIkuPeriods, listIkuSubmissions, subscribeIku } from '../../iku/ikuWorkflowStore';
import { readSystemConfig } from '../adminStore';

/** Label status lintas modul (IKU & KPI memakai kode status yang sama). */
const STATUS = {
  EMPTY: 'Belum submit',
  DRAFT: 'Draft',
  SUBMITTED: 'Menunggu review',
  NEEDS_REVISION: 'Perlu revisi',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  LOCKED: 'Dikunci',
};

const BADGE_CLASS = {
  SUBMITTED: 'ent-badge ent-badge-submitted',
  APPROVED: 'ent-badge ent-badge-approved',
  NEEDS_REVISION: 'ent-badge ent-badge-revision',
  REJECTED: 'ent-badge ent-badge-rejected',
  LOCKED: 'ent-badge ent-badge-locked',
  DRAFT: 'ent-badge',
  EMPTY: 'ent-badge',
};

/** Gabungkan submission KPI (per form × unit) dan IKU menjadi satu daftar baris seragam. */
function collectRows(user) {
  const kpi = readKpiWorkflow();
  const kpiRows = kpi.forms.flatMap((form) => form.units.map((unit) => {
    const record = readUnitSubmission(form.id, unit.email, kpi);
    const evidence = readUnitEvidence(form.id, unit.email, kpi);
    return {
      key: `kpi:${form.id}:${unit.email}`,
      module: 'KPI',
      unit: record?.unit || unit.name,
      email: unit.email,
      period: `${form.period} · v${form.version}`,
      status: record?.status || 'EMPTY',
      updatedAt: record?.history?.at(-1)?.at || record?.submittedAt || '',
      filled: record ? `Skor ${record.totalScore ?? '—'}` : '—',
      evidence: evidence.length ? `${evidence.filter((e) => e.status === 'VERIFIED').length}/${evidence.length} terverifikasi` : 'Belum ada',
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
        key: `iku:${record.id}`,
        id: record.id,
        periodId: record.period,
        module: 'IKU',
        unit: record.unit,
        email: record.owner,
        period: periodLabel(record.period),
        status: record.status,
        updatedAt: record.updatedAt || '',
        filled: `${filled}/${record.values.length} indikator`,
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

  const rows = useMemo(() => {
    void tick;
    return collectRows(currentUser);
  }, [currentUser, tick]);

  const visible = rows.filter((row) => (!module || row.module === module) && (!status || row.status === status)
    && `${row.unit} ${row.email} ${row.period}`.toLowerCase().includes(search.trim().toLowerCase()));
  const count = (value) => rows.filter((row) => row.status === value).length;
  const deadline = readSystemConfig().submissionDeadline;

  return (
    <div className="gov-table">
      <div className="gov-table-head">
        <div>
          <h2>Daftar Submission Lintas Modul (IKU & KPI)</h2>
          <span>
            {rows.length} rekaman · <strong>{count('SUBMITTED')}</strong> menunggu review · {count('NEEDS_REVISION')} perlu revisi · {count('LOCKED')} dikunci
            {deadline ? ` · Tenggat global ${new Date(deadline).toLocaleString('id-ID')}` : ''}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '0.65rem',
          padding: '0.9rem 1.3rem',
          background: '#f8fafc',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ position: 'relative' }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            className="gov-field"
            style={{ paddingLeft: '2.2rem' }}
            type="search"
            aria-label="Cari submission"
            placeholder="Cari unit, email, periode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="gov-field" aria-label="Filter modul" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="">Semua modul (IKU & KPI)</option>
          <option>IKU</option>
          <option>KPI</option>
        </select>
        <select className="gov-field" aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Semua status workflow</option>
          {Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b', background: '#fcfdfe', borderBottom: '1px solid #f1f5f9' }}>
              {['Modul', 'Unit Kerja / Pengusul', 'Periode', 'Status', 'Kelengkapan', 'Bukti Pendukung', 'Diperbarui', 'Aksi'].map((h) => (
                <th key={h} style={{ padding: '0.75rem 1.15rem', fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.key}
                style={{ borderTop: '1px solid #f1f5f9', transition: 'background 0.18s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: '0.8rem 1.15rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      background: row.module === 'IKU' ? '#09090b' : '#fafafa',
                      color: row.module === 'IKU' ? '#ffffff' : '#09090b',
                      border: '1px solid #09090b',
                    }}
                  >
                    {row.module}
                  </span>
                </td>
                <td style={{ padding: '0.8rem 1.15rem' }}>
                  <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.78rem' }}>{row.unit}</strong>
                  <small style={{ color: '#64748b', fontSize: '0.69rem' }}>{row.email}</small>
                </td>
                <td style={{ padding: '0.8rem 1.15rem', color: '#334155', whiteSpace: 'nowrap' }}>{row.period}</td>
                <td style={{ padding: '0.8rem 1.15rem' }}>
                  <span className={BADGE_CLASS[row.status] || 'ent-badge'}>
                    <span className="ent-badge-dot" />
                    {STATUS[row.status] || row.status}
                  </span>
                </td>
                <td style={{ padding: '0.8rem 1.15rem', fontWeight: 600, color: '#334155' }}>{row.filled}</td>
                <td style={{ padding: '0.8rem 1.15rem', color: '#475569' }}>{row.evidence}</td>
                <td style={{ padding: '0.8rem 1.15rem', color: '#64748b', fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {row.updatedAt ? new Date(row.updatedAt).toLocaleString('id-ID') : '—'}
                </td>
                <td style={{ padding: '0.8rem 1.15rem', whiteSpace: 'nowrap' }}>
                  {row.module === 'IKU' ? (
                    <Link className="gov-button" to={`/internal/iku-submissions?period=${encodeURIComponent(row.periodId)}&id=${encodeURIComponent(row.id)}`}>
                      Tinjau <ArrowUpRight size={13} />
                    </Link>
                  ) : (
                    row.status !== 'EMPTY' && (
                      <button type="button" className="gov-button" onClick={() => onReviewKpi?.({ formId: row.formId, email: row.email })}>
                        Tinjau <ArrowUpRight size={13} />
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <div className="gov-placeholder">Tidak ada submission unit yang sesuai dengan filter.</div>}
      </div>
    </div>
  );
}
