import { useEffect, useState } from 'react';
import { Check, ExternalLink, Search, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import KPIDataEntrySheet from '../../kpi/components/KPIDataEntrySheet';
import { KPI_TRANSITIONS, readKpiWorkflow, readUnitSubmission, readUnitEvidence, reviewUnitKpi, reviewUnitEvidence, subscribeKpiWorkflow } from '../../kpi/kpiWorkflowStore';
import { formatIndonesianNumber } from '../../kpi/kpiSchema';

const labels = {
  SUBMITTED: 'Dikirim unit',
  APPROVED: 'Disetujui',
  NEEDS_REVISION: 'Perlu revisi / buka kembali',
  REJECTED: 'Ditolak',
  LOCKED: 'Dikunci',
};

const badgeFor = (status) => {
  if (status === 'SUBMITTED') return 'ent-badge ent-badge-submitted';
  if (status === 'APPROVED') return 'ent-badge ent-badge-approved';
  if (status === 'NEEDS_REVISION') return 'ent-badge ent-badge-revision';
  if (status === 'REJECTED') return 'ent-badge ent-badge-rejected';
  if (status === 'LOCKED') return 'ent-badge ent-badge-locked';
  return 'ent-badge';
};

const actionLabel = (from, to) => (from === 'LOCKED' && to === 'NEEDS_REVISION' ? 'Buka kembali (unlock)' : labels[to]);

export default function KPISubmissionInbox({ selected: controlledSelected, onSelect }) {
  const { currentUser } = useAuth();
  const [state, setState] = useState(readKpiWorkflow);
  const [localSelected, setLocalSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [note, setNote] = useState('');
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  const selected = controlledSelected !== undefined ? controlledSelected : localSelected;
  const updateSelected = (next) => {
    if (onSelect) onSelect(next);
    else setLocalSelected(next);
    setNote('');
    setComplete(false);
    setError('');
  };

  useEffect(() => subscribeKpiWorkflow(() => setState(readKpiWorkflow())), []);

  const mutate = (action) => {
    setError('');
    try {
      if (!currentUser) throw new Error('Silakan masuk kembali.');
      action();
      setComplete(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const form = state.forms.find((f) => f.id === selected?.formId);
  const record = selected && readUnitSubmission(selected.formId, selected.email, state);

  return (
    <div className="gov-table">
      <div className="gov-table-head">
        <div>
          <h2>Inbox Distribusi Formulir KPI Unit Kerja</h2>
          <span>Pantau status pengiriman dan nilai akhir KPI pada setiap versi formulir yang telah didistribusikan</span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
            aria-label="Cari unit/periode"
            placeholder="Cari unit kerja atau periode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="gov-field" aria-label="Status" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Semua status pengisian</option>
          <option value="EMPTY">Belum submit</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && !record && (
        <div role="alert" style={{ margin: '1rem 1.3rem', padding: '0.75rem 1rem', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.78rem' }}>
          {error}
        </div>
      )}

      {!state.forms.length && (
        <div className="gov-placeholder">Belum ada distribusi formulir KPI ke Unit Kerja. Gunakan Desainer Tabel KPI untuk mengirim versi formulir.</div>
      )}

      {[...state.forms].reverse().map((f) => (
        <section key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ padding: '0.8rem 1.3rem', background: '#fcfdfe', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
              Periode {f.period} · Versi v{f.version}
            </h3>
            <span className="ent-badge">{f.units.length} unit penerima</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ padding: '0.65rem 1.3rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Unit Kerja</th>
                  <th style={{ padding: '0.65rem 1.3rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Status</th>
                  <th style={{ padding: '0.65rem 1.3rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Skor Total</th>
                  <th style={{ padding: '0.65rem 1.3rem', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {f.units.filter((u) => `${u.name} ${u.email} ${f.period}`.toLowerCase().includes(search.toLowerCase())).map((u) => {
                  const r = readUnitSubmission(f.id, u.email, state);
                  if (filter && (r?.status || 'EMPTY') !== filter) return null;
                  return (
                    <tr key={u.email} style={{ borderTop: '1px solid #f8fafc' }}>
                      <td style={{ padding: '0.75rem 1.3rem' }}>
                        <strong style={{ color: '#0f172a', display: 'block' }}>{u.name}</strong>
                        <small style={{ color: '#64748b' }}>{u.email}</small>
                      </td>
                      <td style={{ padding: '0.75rem 1.3rem' }}>
                        <span className={badgeFor(r?.status)}>
                          <span className="ent-badge-dot" />
                          {labels[r?.status] || 'Belum submit'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1.3rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>
                        {r ? formatIndonesianNumber(r.totalScore) : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1.3rem' }}>
                        {r && (
                          <button
                            type="button"
                            className="gov-button"
                            onClick={() => updateSelected({ formId: f.id, email: u.email })}
                          >
                            Tinjau Detail
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {record && form && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tinjauan KPI"
          data-lenis-prevent
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.42)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: 'clamp(1rem, 3vh, 2rem)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              width: 'min(1280px, 100%)',
              background: '#ffffff',
              border: '1px solid #09090b',
              borderRadius: '8px',
              boxShadow: '0 24px 60px rgba(9, 9, 11, 0.24)',
              overflow: 'hidden',
              animation: 'drawerSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Modal Topbar */}
            <div
              style={{
                padding: '1.15rem 1.5rem',
                borderBottom: '1px solid #e4e4e7',
                background: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div className="ent-eyebrow" style={{ marginBottom: '0.35rem' }}>
                  <ShieldCheck size={12} /> REVIEW SUBMISSION KPI UNIT
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'Outfit, sans-serif', color: '#0f172a' }}>
                  {record.unit} · {form.period}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span className={badgeFor(record.status)}>
                  <span className="ent-badge-dot" />
                  {labels[record.status]}
                </span>
                <button type="button" className="gov-button" onClick={() => updateSelected(null)}>
                  <X size={15} /> Tutup Detail
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {error && (
                <div role="alert" style={{ padding: '0.8rem 1rem', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8rem', fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.15rem' }}>
                {/* Panel Catatan & Keputusan */}
                <div className="ent-card" style={{ padding: '1.2rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                    Catatan / alasan wajib (untuk verifikasi bukti, revisi, buka kembali, atau penolakan)
                    <textarea
                      className="ent-textarea"
                      rows={3}
                      placeholder="Tuliskan catatan pemeriksaan atau alasan keputusan…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginTop: '0.95rem', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />
                    Saya telah memeriksa kelengkapan seluruh isian dan bukti pendukung unit.
                  </label>

                  {(() => {
                    const items = readUnitEvidence(form.id, record.email, state);
                    const verified = items.filter((e) => e.status === 'VERIFIED').length;
                    return (
                      <p style={{ margin: '0.65rem 0 0.95rem', fontSize: '0.75rem', color: '#64748b' }}>
                        Bukti terverifikasi: <strong>{verified}/{items.length}</strong>
                        {items.length && verified < items.length ? ' — setujui setelah seluruh bukti terverifikasi.' : ''}
                      </p>
                    );
                  })()}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {(KPI_TRANSITIONS[record.status] || []).filter((s) => s !== 'SUBMITTED').map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`ent-btn ${status === 'APPROVED' ? 'ent-btn-teal' : status === 'LOCKED' ? 'ent-btn-primary' : ''}`}
                        disabled={(status === 'APPROVED' && !complete) || (status !== 'APPROVED' && status !== 'LOCKED' && !note.trim())}
                        onClick={() => {
                          if (record.status === 'LOCKED' && !window.confirm('Buka kembali submission yang sudah dikunci? Unit dapat mengubah data lagi.')) return;
                          mutate(() => reviewUnitKpi(form.id, record.email, status, note, currentUser));
                        }}
                      >
                        {status === 'APPROVED' && <Check size={14} />}
                        {actionLabel(record.status, status)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel Bukti Pendukung */}
                <div className="ent-card" style={{ padding: '1.2rem' }}>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', fontFamily: 'Outfit, sans-serif', color: '#0f172a' }}>
                    Daftar Tautan Bukti Pendukung
                  </h4>
                  {!readUnitEvidence(form.id, record.email, state).length && (
                    <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0 }}>Belum ada tautan bukti yang dilampirkan.</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {readUnitEvidence(form.id, record.email, state).map((e) => (
                      <div
                        key={e.id}
                        style={{
                          padding: '0.7rem 0.85rem',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          fontSize: '0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: '#094E68', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {e.label} <ExternalLink size={12} />
                          </a>
                          <span className="ent-badge">{e.indicatorId} · {e.status}</span>
                        </div>
                        {e.note && <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Catatan: {e.note}</div>}
                        {record.status === 'SUBMITTED' && (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className="ent-btn ent-btn-teal"
                              style={{ padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}
                              disabled={!note.trim()}
                              title={note.trim() ? '' : 'Isi catatan pemeriksaan terlebih dahulu'}
                              onClick={() => mutate(() => reviewUnitEvidence(form.id, record.email, e.id, 'VERIFIED', note, currentUser))}
                            >
                              Verifikasi Bukti
                            </button>
                            <button
                              type="button"
                              className="ent-btn"
                              style={{ padding: '0.35rem 0.7rem', fontSize: '0.7rem', color: '#b91c1c' }}
                              disabled={!note.trim()}
                              onClick={() => mutate(() => reviewUnitEvidence(form.id, record.email, e.id, 'REJECTED', note, currentUser))}
                            >
                              Tolak Bukti
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Riwayat Snapshot */}
              {(record.history || []).length > 0 && (
                <div className="ent-card" style={{ padding: '1rem 1.2rem' }}>
                  <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.86rem', fontFamily: 'Outfit, sans-serif', color: '#0f172a' }}>
                    Riwayat Keputusan & Snapshot ({record.history.length})
                  </h4>
                  {(record.history || []).map((h, index) => (
                    <details key={index} style={{ padding: '0.55rem 0', borderTop: index > 0 ? '1px solid #f1f5f9' : 'none', fontSize: '0.74rem' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#334155' }}>
                        {new Date(h.at).toLocaleString('id-ID')} · {h.from} → {h.status} · {h.actor?.email || 'Legacy'} {h.note ? `— ${h.note}` : ''}
                      </summary>
                      <pre style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', fontSize: '0.68rem', color: '#475569' }}>
                        {JSON.stringify(h.snapshot, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              )}

              {/* Lembar Kerja KPI Read-Only */}
              <KPIDataEntrySheet key={`${form.id}:${record.email}`} sectionsOverride={form.sections} valuesOverride={record.values} persist={false} readOnly />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
