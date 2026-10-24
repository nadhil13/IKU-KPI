import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, ClipboardCheck, ExternalLink, FileCheck2, Lock, Send, ShieldCheck, Save, History
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../auth/context/AuthContext';
import { readSystemConfig } from '../../internal/adminStore';
import {
  IKU_INDICATORS, IKU_TRANSITIONS, emptyIkuValues, getIkuPeriods,
  ikuInputIssue, ikuPercentage, listIkuSubmissions, saveIkuSubmission,
  reviewIkuSubmission, verifyIkuEvidence, subscribeIku,
} from '../ikuWorkflowStore';

gsap.registerPlugin(ScrollTrigger);

const labels = {
  DRAFT: 'Draft',
  SUBMITTED: 'Menunggu review',
  NEEDS_REVISION: 'Perlu revisi',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  LOCKED: 'Dikunci',
};

const actions = {
  APPROVED: 'Setujui Submission',
  NEEDS_REVISION: 'Minta / Buka Revisi',
  REJECTED: 'Tolak Submission',
  LOCKED: 'Kunci Final',
};

const statusBadgeClass = (status) => {
  if (status === 'SUBMITTED') return 'ent-badge ent-badge-submitted';
  if (status === 'APPROVED') return 'ent-badge ent-badge-approved';
  if (status === 'NEEDS_REVISION') return 'ent-badge ent-badge-revision';
  if (status === 'REJECTED') return 'ent-badge ent-badge-rejected';
  if (status === 'LOCKED') return 'ent-badge ent-badge-locked';
  return 'ent-badge';
};

export default function IKUSubmissions() {
  const pageRef = useRef(null);
  const { currentUser } = useAuth();
  const admin = currentUser?.role === 'superadmin_prp';
  const [tick, refresh] = useState(0);
  const periods = getIkuPeriods();
  const [params] = useSearchParams();

  const [period, setPeriod] = useState(() =>
    periods.some((p) => p.id === params.get('period'))
      ? params.get('period')
      : periods.find((p) => p.status === 'Active')?.id || periods[0].id
  );
  const [selected, setSelected] = useState(() => params.get('id') || '');
  const [draftValues, setDraftValues] = useState(null);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [checked, setChecked] = useState(false);

  const records = listIkuSubmissions(currentUser).filter((r) => r.period === period);
  const record = admin ? records.find((r) => r.id === selected) : records[0];
  const issue = ikuInputIssue(period);
  const editable = !admin && !issue && (!record || ['DRAFT', 'NEEDS_REVISION'].includes(record.status));
  const values = draftValues || record?.values || emptyIkuValues();
  const dirty = draftValues !== null;

  useEffect(() => subscribeIku(() => refresh((n) => n + 1)), []);
  useEffect(() => {
    const timer = window.setInterval(() => refresh((n) => n + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  void tick;

  const run = (operation, message, clearDraft = false) => {
    try {
      operation();
      if (clearDraft) setDraftValues(null);
      setFeedback({ ok: true, text: message });
      setReason('');
      setChecked(false);
      refresh((n) => n + 1);
    } catch (error) {
      setFeedback({ ok: false, text: error.message });
    }
  };

  const change = (id, field, value) => {
    setDraftValues((prev) => {
      const base = prev || record?.values || emptyIkuValues();
      return base.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    });
  };

  const display = admin ? record?.values || [] : values;
  const maintenance = readSystemConfig().maintenanceMode;

  const completeness = record
    ? {
        filled: record.values.filter((r) => r.actual !== '' && r.target !== '').length,
        withEvidence: record.values.filter((r) => r.evidence).length,
        verified: record.values.filter((r) => r.evidence && r.verification === 'VERIFIED').length,
        total: record.values.length,
      }
    : null;

  const decide = (status) => {
    if (record.status === 'LOCKED' && !window.confirm('Buka kembali submission yang sudah dikunci? Unit dapat mengubah data lagi.')) return;
    run(() => reviewIkuSubmission(currentUser, record.id, status, reason), 'Keputusan PRP berhasil disimpan dan diaudit.');
  };

  // GSAP Masked Masthead, Self-Drawing Keyline & Ledger Reveal
  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    tl.fromTo(
      '.iku-mask-line',
      { yPercent: 115 },
      { yPercent: 0, duration: 0.85, stagger: 0.07 }
    )
      .fromTo(
        '.iku-keyline',
        { scaleX: 0 },
        { scaleX: 1, transformOrigin: 'left center', duration: 0.9 },
        '-=0.6'
      )
      .fromTo(
        '.iku-sub-head',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65, stagger: 0.05, clearProps: 'transform' },
        '-=0.65'
      );

    gsap.utils.toArray('.iku-ind-card').forEach((card, idx) => {
      gsap.fromTo(
        card,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          delay: (idx % 2) * 0.05,
          ease: 'expo.out',
          clearProps: 'transform',
          scrollTrigger: {
            trigger: card,
            start: 'top 92%',
            once: true,
          },
        }
      );
    });

    gsap.fromTo(
      '.iku-bar-fill',
      { scaleX: 0 },
      { scaleX: 1, transformOrigin: 'left center', duration: 0.95, stagger: 0.04, ease: 'expo.out', delay: 0.12 }
    );
  }, { scope: pageRef, dependencies: [period, record?.id] });

  const filledCount = display.filter((r) => r.actual !== '' && r.target !== '').length;
  const evidenceCount = display.filter((r) => r.evidence).length;

  return (
    <section ref={pageRef} className="iku-submissions-page">
      <style>{`
        .iku-submissions-page {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 0 4rem;
          color: #09090b;
          background: #ffffff;
        }
        .iku-sub-hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 1.5rem;
          padding-bottom: 1.4rem;
          position: relative;
          margin-bottom: 1.5rem;
        }
        .iku-keyline {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 2px;
          background: #09090b;
        }
        .iku-sub-title {
          margin: 0.45rem 0 0.4rem;
          font: 800 clamp(1.85rem, 3vw, 2.55rem)/1.04 'Outfit', sans-serif;
          letter-spacing: -0.04em;
          color: #09090b;
        }
        .iku-mask-wrap {
          overflow: hidden;
          display: block;
        }
        .iku-mask-line {
          display: block;
          will-change: transform;
        }
        .iku-sub-desc {
          max-width: 680px;
          margin: 0;
          color: #52525b;
          font-size: 0.85rem;
          line-height: 1.65;
        }
        .iku-mini-ledger {
          display: grid;
          grid-template-columns: repeat(2, minmax(130px, 1fr));
          gap: 1px;
          background: #e4e4e7;
          border: 1px solid #e4e4e7;
        }
        .iku-mini-cell {
          background: #ffffff;
          padding: 0.7rem 1rem;
        }
        .iku-mini-cell span {
          display: block;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 0.62rem;
          color: #71717a;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 0.2rem;
        }
        .iku-mini-cell strong {
          font-family: 'Outfit', sans-serif;
          font-size: 1.25rem;
          font-weight: 800;
          color: #09090b;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.03em;
        }
        .iku-toolbar-card {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          align-items: end;
          padding: 1.1rem 1.25rem;
          border-radius: 6px;
          background: #fafafa;
          border: 1px solid #e4e4e7;
          margin-bottom: 1.35rem;
        }
        .iku-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr));
          gap: 1px;
          background: #e4e4e7;
          border: 1px solid #e4e4e7;
        }
        .iku-ind-card {
          position: relative;
          background: #ffffff;
          padding: 1.45rem;
          display: flex;
          flex-direction: column;
          gap: 0.95rem;
          transition: background-color 0.2s ease;
        }
        .iku-ind-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: #09090b;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .iku-ind-card:hover {
          background: #fafafa;
        }
        .iku-ind-card:hover::before {
          transform: scaleX(1);
        }
        .iku-field-label {
          display: flex;
          flex-direction: column;
          gap: 0.38rem;
          font-size: 0.74rem;
          font-weight: 700;
          color: #27272a;
        }
        .iku-alert {
          padding: 0.85rem 1.1rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 1.15rem;
        }
        .iku-alert.ok {
          background: #fafafa;
          border: 1px solid #09090b;
          color: #09090b;
        }
        .iku-alert.err {
          background: #fffbeb;
          border: 1px solid #fcd34d;
          color: #92400e;
        }
      `}</style>

      {/* Header */}
      <header className="iku-sub-hero">
        <div>
          <div className="ent-eyebrow iku-sub-head">
            <ShieldCheck size={12} /> {admin ? '02 // PRP REVIEW — SUBMISSION 8 IKU' : '02 // WORKSPACE UNIT — SUBMISSION 8 IKU'}
          </div>
          <h1 className="iku-sub-title">
            <span className="iku-mask-wrap">
              <span className="iku-mask-line">Submission & Verifikasi 8 IKU</span>
            </span>
          </h1>
          <p className="iku-sub-desc iku-sub-head">
            Pencatatan capaian aktual terhadap target indikator strategis beserta verifikasi tautan bukti pendukung HTTPS. Rumus capaian = Aktual ÷ Target × 100%.
          </p>
        </div>

        {display.length > 0 && (
          <div className="iku-mini-ledger iku-sub-head">
            <div className="iku-mini-cell">
              <span>INDIKATOR TERISI</span>
              <strong>{filledCount}/{display.length}</strong>
            </div>
            <div className="iku-mini-cell">
              <span>TAUTAN BUKTI</span>
              <strong>{evidenceCount}/{display.length}</strong>
            </div>
          </div>
        )}
        <div className="iku-keyline" />
      </header>

      {/* Feedback Banner */}
      {feedback && (
        <div role={feedback.ok ? 'status' : 'alert'} className={`iku-alert ${feedback.ok ? 'ok' : 'err'}`}>
          {feedback.text}
        </div>
      )}

      {/* Control Toolbar */}
      <div className="iku-toolbar-card iku-sub-head">
        <label className="iku-field-label">
          Periode Evaluasi
          <select
            className="ent-select"
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setSelected('');
              setDraftValues(null);
              setReason('');
              setChecked(false);
              setFeedback(null);
            }}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.label} • {p.status}</option>
            ))}
          </select>
        </label>

        {admin && (
          <label className="iku-field-label">
            Pilih Submission Unit Kerja
            <select
              className="ent-select"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setDraftValues(null);
                setReason('');
                setChecked(false);
                setFeedback(null);
              }}
            >
              <option value="">Pilih submission unit ({records.length})</option>
              {records.map((r) => (
                <option key={r.id} value={r.id}>{r.unit} — {r.owner} — {labels[r.status]}</option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', paddingBottom: '2px' }}>
          <div style={{ fontSize: '0.76rem', color: '#475569' }}>
            Kebijakan bukti: <strong style={{ color: '#0f172a' }}>{readSystemConfig().evidenceRequired !== false ? 'Wajib per indikator' : 'Opsional'}</strong>
          </div>
          <span className={statusBadgeClass(record?.status)}>
            <span className="ent-badge-dot" />
            {labels[record?.status] || (admin ? 'Belum dipilih' : 'Draft baru')}
            {dirty ? ' • Belum disimpan' : ''}
          </span>
        </div>
      </div>

      {issue && (
        <div role="status" className="iku-alert err">
          {issue} {!admin && 'Input dan pengiriman dinonaktifkan untuk periode ini.'}
        </div>
      )}

      {!admin && !editable && record && !issue && (
        <div className="iku-alert" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Lock size={15} color="#64748b" />
          <span>Submission sedang terkunci dalam alur review ({labels[record.status]}). Hubungi Superadmin PRP apabila memerlukan pembukaan revisi.</span>
        </div>
      )}

      {admin && !record && (
        <div className="ent-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
          <ClipboardCheck size={28} color="#94a3b8" style={{ margin: '0 auto 0.6rem' }} />
          <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>Pilih Submission Unit untuk Ditinjau</div>
          <div>
            {records.length === 0
              ? 'Belum ada unit kerja yang mengirimkan submission IKU pada periode ini.'
              : 'Gunakan pemilih unit di atas untuk memeriksa nilai aktual, memverifikasi tautan bukti, dan menetapkan keputusan review.'}
          </div>
        </div>
      )}

      {/* 8 Indicator Cards Grid */}
      {display.length > 0 && (
        <div className="iku-cards-grid">
          {display.map((row, i) => {
            const pct = ikuPercentage(row);
            const barWidth = pct === null ? 0 : Math.min(100, Math.max(0, pct));
            return (
              <article className="iku-ind-card" key={row.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <span style={{ display: 'inline-block', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#09090b', background: '#fafafa', border: '1px solid #e4e4e7', padding: '2px 7px', borderRadius: '4px', marginBottom: '0.4rem' }}>
                      IKU // 0{i + 1}
                    </span>
                    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: '#09090b', letterSpacing: '-0.02em' }}>
                      {IKU_INDICATORS[i].label}
                    </h2>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: '0.6rem', color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>CAPAIAN</span>
                    <strong style={{ fontSize: '1.2rem', fontFamily: 'Outfit, sans-serif', color: pct !== null && pct >= 100 ? '#047857' : '#09090b', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
                      {pct === null ? '—' : `${pct.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`}
                    </strong>
                  </div>
                </div>

                {/* Progress Bar Visual */}
                <div style={{ height: '3px', background: '#e4e4e7', overflow: 'hidden' }}>
                  <div
                    className="iku-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      height: '100%',
                      background: '#09090b',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <label className="iku-field-label">
                    Realisasi Aktual
                    <input
                      className="ent-input"
                      aria-label={`Aktual indikator ${i + 1}`}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={row.actual}
                      disabled={!editable}
                      onChange={(e) => change(row.id, 'actual', e.target.value)}
                    />
                  </label>
                  <label className="iku-field-label">
                    Target Indikator
                    <input
                      className="ent-input"
                      aria-label={`Target indikator ${i + 1}`}
                      type="number"
                      min="0.000000001"
                      step="any"
                      placeholder="100"
                      value={row.target}
                      disabled={!editable}
                      onChange={(e) => change(row.id, 'target', e.target.value)}
                    />
                  </label>
                </div>

                <label className="iku-field-label">
                  Catatan Evaluasi Unit
                  <textarea
                    className="ent-textarea"
                    rows={2}
                    aria-label={`Catatan indikator ${i + 1}`}
                    placeholder="Ringkasan capaian atau penjelasan metodologi…"
                    value={row.notes}
                    disabled={!editable}
                    onChange={(e) => change(row.id, 'notes', e.target.value)}
                  />
                </label>

                <label className="iku-field-label">
                  Tautan Bukti Pendukung (HTTPS)
                  <input
                    className="ent-input"
                    aria-label={`Bukti indikator ${i + 1}`}
                    type="url"
                    placeholder="https://drive.itpln.ac.id/..."
                    value={row.evidence}
                    disabled={!editable}
                    onChange={(e) => change(row.id, 'evidence', e.target.value)}
                  />
                </label>

                {row.evidence && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', padding: '0.55rem 0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.73rem' }}>
                    {/^https:\/\//i.test(row.evidence) ? (
                      <a href={row.evidence} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: '#094E68', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <FileCheck2 size={14} /> Buka Dokumen Bukti {i + 1} <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span style={{ color: '#b45309' }}>Format tautan wajib diawali https://</span>
                    )}
                    <span className={row.verification === 'VERIFIED' ? 'ent-badge ent-badge-approved' : row.verification === 'REJECTED' ? 'ent-badge ent-badge-rejected' : 'ent-badge'}>
                      Bukti: {row.verification || 'PENDING'}
                      {row.verificationNote ? ` · ${row.verificationNote}` : ''}
                    </span>
                  </div>
                )}

                {admin && record?.status === 'SUBMITTED' && row.evidence && (
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {['VERIFIED', 'REJECTED'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`ent-btn ${st === 'VERIFIED' ? 'ent-btn-teal' : ''}`}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.72rem' }}
                        disabled={maintenance || !reason.trim()}
                        title={!reason.trim() ? 'Isi catatan pada panel Keputusan & Verifikasi di bawah terlebih dahulu' : ''}
                        onClick={() => run(() => verifyIkuEvidence(currentUser, record.id, row.id, st, reason), 'Hasil verifikasi bukti berhasil disimpan.')}
                      >
                        {st === 'VERIFIED' ? 'Verifikasi Bukti' : 'Tolak Bukti'}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Action Footer untuk Unit */}
      {!admin && (
        <div
          className="ent-card"
          style={{
            marginTop: '1.25rem',
            padding: '1.15rem 1.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Pastikan seluruh 8 indikator dan tautan bukti HTTPS telah lengkap sebelum mengirim submission ke PRP.
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ent-btn"
              disabled={!editable}
              onClick={() => run(() => saveIkuSubmission(currentUser, period, values), 'Draft pengisian IKU berhasil disimpan.', true)}
            >
              <Save size={15} /> Simpan Draft
            </button>
            <button
              type="button"
              className="ent-btn ent-btn-teal"
              disabled={!editable}
              onClick={() => run(() => saveIkuSubmission(currentUser, period, values, true), 'Submission IKU berhasil dikirim ke PRP. Input kini dikunci.', true)}
            >
              <Send size={15} /> Kirim Submission ke PRP
            </button>
          </div>
        </div>
      )}

      {/* Panel Keputusan Reviewer Superadmin PRP */}
      {admin && record && (
        <div className="ent-card" style={{ marginTop: '1.35rem', padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontFamily: 'Outfit, sans-serif', color: '#0f172a' }}>
                Panel Keputusan & Verifikasi PRP
              </h2>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Kelengkapan isian: <strong>{completeness.filled}/{completeness.total}</strong> indikator · Bukti terverifikasi: <strong>{completeness.verified}/{completeness.withEvidence}</strong>
              </span>
            </div>
            <span className={statusBadgeClass(record.status)}>{labels[record.status]}</span>
          </div>

          <label className="iku-field-label">
            Alasan Keputusan / Catatan Pemeriksaan Bukti (Wajib diisi)
            <textarea
              className="ent-textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tuliskan dasar persetujuan, permintaan revisi, atau catatan pemeriksaan dokumen bukti…"
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', fontSize: '0.8rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            Saya telah memeriksa kelengkapan seluruh angka capaian dan memvalidasi bukti pendukung unit.
          </label>

          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
            {(IKU_TRANSITIONS[record.status] || []).map((status) => (
              <button
                key={status}
                type="button"
                className={`ent-btn ${status === 'APPROVED' ? 'ent-btn-teal' : status === 'LOCKED' ? 'ent-btn-primary' : ''}`}
                disabled={maintenance || !reason.trim() || (status === 'APPROVED' && !checked)}
                onClick={() => decide(status)}
              >
                {status === 'APPROVED' && <CheckCircle2 size={15} />}
                {record.status === 'LOCKED' && status === 'NEEDS_REVISION' ? 'Buka Kembali (Unlock)' : actions[status]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Riwayat & Snapshot */}
      {record && record.history?.length > 0 && (
        <div className="ent-card" style={{ marginTop: '1.25rem', padding: '1.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <History size={16} color="#094E68" />
            <h2 style={{ margin: 0, fontSize: '0.96rem', fontFamily: 'Outfit, sans-serif', color: '#0f172a' }}>
              Riwayat Perubahan & Snapshot ({record.history.length})
            </h2>
          </div>
          {[...record.history].reverse().map((entry, i) => (
            <details
              key={`${entry.at}-${i}`}
              style={{ padding: '0.7rem 0', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none', fontSize: '0.76rem' }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#334155' }}>
                {new Date(entry.at).toLocaleString('id-ID')} · {entry.action} · {entry.actor.email} ({entry.from || 'Baru'} → {entry.status})
              </summary>
              {entry.reason && <p style={{ margin: '0.4rem 0', color: '#475569' }}>Catatan: {entry.reason}</p>}
              <pre style={{ marginTop: '0.45rem', padding: '0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', fontSize: '0.68rem', color: '#475569' }}>
                {JSON.stringify(entry.snapshot, null, 2)}
              </pre>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
