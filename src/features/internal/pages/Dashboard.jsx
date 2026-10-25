import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowUpRight, Info } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../auth/context/AuthContext';
import { ikuPercentage, listIkuSubmissions, subscribeIku } from '../../iku/ikuWorkflowStore';
import KPIDataEntrySheet from '../../kpi/components/KPIDataEntrySheet';

gsap.registerPlugin(ScrollTrigger);

// Referensi Baseline RKAT 8 IKU Kemendikbudristek ITPLN (digunakan saat belum ada submission pada periode terpilih)
const IKU_BASELINE = [
  {
    id: 1,
    rowId: 'iku-1',
    idx: '01',
    code: 'IKU.01',
    title: 'Kesiapan Kerja Lulusan',
    desc: 'Lulusan mendapat pekerjaan layak, berwirausaha, atau melanjutkan studi pascasarjana.',
    baselineTarget: 80,
    pic: 'Biro Kemahasiswaan & Alumni',
  },
  {
    id: 2,
    rowId: 'iku-2',
    idx: '02',
    code: 'IKU.02',
    title: 'Pengalaman Luar Kampus',
    desc: 'Mahasiswa mengikuti magang industri, riset terapan, proyek independen, atau pertukaran pelajar.',
    baselineTarget: 75,
    pic: 'Pusat MBKM ITPLN',
  },
  {
    id: 3,
    rowId: 'iku-3',
    idx: '03',
    code: 'IKU.03',
    title: 'Tridharma Dosen di Luar Kampus',
    desc: 'Dosen membina mahasiswa berprestasi, menjadi praktisi industri energi, atau berkegiatan di kampus mitra.',
    baselineTarget: 85,
    pic: 'Direktorat SDM & Akademik',
  },
  {
    id: 4,
    rowId: 'iku-4',
    idx: '04',
    code: 'IKU.04',
    title: 'Praktisi Mengajar & Kualifikasi Dosen',
    desc: 'Dosen berkualifikasi S3, bersertifikat kompetensi internasional, atau berasal dari praktisi BUMN/industri.',
    baselineTarget: 80,
    pic: 'Fakultas & Program Studi',
  },
  {
    id: 5,
    rowId: 'iku-5',
    idx: '05',
    code: 'IKU.05',
    title: 'Penerapan Riset & Inovasi',
    desc: 'Hasil riset dosen dipublikasikan bereputasi atau diterapkan oleh PLN Group serta masyarakat.',
    baselineTarget: 75,
    pic: 'LPPM ITPLN',
  },
  {
    id: 6,
    rowId: 'iku-6',
    idx: '06',
    code: 'IKU.06',
    title: 'Kemitraan Program Studi',
    desc: 'Kerja sama kurikulum, magang, dan penyerapan lulusan dengan mitra industri strategis.',
    baselineTarget: 80,
    pic: 'Direktorat Kerjasama ITPLN',
  },
  {
    id: 7,
    rowId: 'iku-7',
    idx: '07',
    code: 'IKU.07',
    title: 'Pembelajaran Kolaboratif',
    desc: 'Mata kuliah menggunakan metode pemecahan kasus (Case Method) atau proyek kelompok (Team-Based Project).',
    baselineTarget: 90,
    pic: 'Biro Pengembangan Pembelajaran',
  },
  {
    id: 8,
    rowId: 'iku-8',
    idx: '08',
    code: 'IKU.08',
    title: 'Akreditasi Internasional',
    desc: 'Program studi terakreditasi atau tersertifikasi internasional (IABEE, ASIIN, ABET).',
    baselineTarget: 80,
    pic: 'Satuan Penjaminan Mutu (SPMI)',
  },
];

const STATUS_LABELS = {
  DRAFT: 'Draft Unit',
  SUBMITTED: 'Menunggu Review PRP',
  NEEDS_REVISION: 'Perlu Revisi',
  APPROVED: 'Disetujui PRP',
  REJECTED: 'Ditolak',
  LOCKED: 'Final Terkunci',
};

export default function Dashboard() {
  const { currentUser, activeWorkspace, switchWorkspace } = useAuth();
  const [periods, setPeriods] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('prp_periods')) || [];
    } catch {
      return [];
    }
  });
  const [ikuTick, setIkuTick] = useState(0);

  const activePeriod = useMemo(
    () => periods.find((period) => period.status === 'Active') || periods[0],
    [periods]
  );
  const [selectedYear, setSelectedYear] = useState(() => activePeriod?.id || '2025/2026');
  const [kpiLiveMetrics, setKpiLiveMetrics] = useState({
    totalBobot: 100,
    totalScore: 0,
    positiveScoreABC: 0,
    penaltyScoreD: 0,
    filledCount: 0,
    totalCount: 29,
    filledInputsCount: 0,
    totalInputsCount: 47,
    scoreA: 0,
    scoreB: 0,
    scoreC: 0,
    scoreD: 0,
    sectionScores: [],
  });

  const dashRef = useRef(null);
  const workspacePillRef = useRef(null);

  const isIkuOnly = currentUser?.role === 'iku_only';
  const isKpiOnly = currentUser?.role === 'kpi_only';
  const isDual = ['dual', 'superadmin_prp'].includes(currentUser?.role);
  const effectiveYear =
    periods.length && !periods.some((period) => period.id === selectedYear)
      ? activePeriod?.id || selectedYear
      : selectedYear;
  const selectedPeriod = periods.find((period) => period.id === effectiveYear) || activePeriod;
  const isPeriodOpen = selectedPeriod?.inputOpen !== false && selectedPeriod?.status !== 'Archived';

  useEffect(() => {
    const refreshPeriods = () => {
      try {
        setPeriods(JSON.parse(localStorage.getItem('prp_periods')) || []);
      } catch {
        setPeriods([]);
      }
    };
    window.addEventListener('storage', refreshPeriods);
    window.addEventListener('prp-admin-updated', refreshPeriods);
    return () => {
      window.removeEventListener('storage', refreshPeriods);
      window.removeEventListener('prp-admin-updated', refreshPeriods);
    };
  }, []);

  useEffect(() => subscribeIku(() => setIkuTick((v) => v + 1)), []);

  const currentView = isIkuOnly
    ? 'iku'
    : isKpiOnly
      ? 'kpi'
      : activeWorkspace === 'kpi'
        ? 'kpi'
        : 'iku';

  // Ambil data submission IKU riil untuk periode terpilih (bila peran memiliki akses IKU store)
  const ikuOverview = useMemo(() => {
    void ikuTick;
    let periodRecords = [];
    if (currentUser && ['iku_only', 'superadmin_prp'].includes(currentUser.role)) {
      try {
        periodRecords = listIkuSubmissions(currentUser).filter((r) => r.period === effectiveYear);
      } catch {
        periodRecords = [];
      }
    }

    // Pilih submission terbaru pada periode ini jika tersedia
    const activeRecord = periodRecords.length
      ? [...periodRecords].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0]
      : null;

    const cards = IKU_BASELINE.map((meta) => {
      const row = activeRecord?.values?.find((v) => v.id === meta.rowId);
      const pct = row ? ikuPercentage(row) : null;
      const actualVal = row && row.actual !== '' ? Number(row.actual) : null;
      const targetVal = row && row.target !== '' ? Number(row.target) : meta.baselineTarget;
      const hasEvidence = Boolean(row?.evidence);
      const verified = row?.verification === 'VERIFIED';

      let badgeLabel = 'BELUM DIISI';
      let badgeClass = 'ent-badge';
      if (pct !== null) {
        if (pct >= 100) {
          badgeLabel = verified ? 'TERVERIFIKASI' : 'MEMENUHI TARGET';
          badgeClass = 'ent-badge ent-badge-approved';
        } else {
          badgeLabel = 'DI BAWAH TARGET';
          badgeClass = 'ent-badge ent-badge-revision';
        }
      }

      return {
        ...meta,
        pct,
        actualVal,
        targetVal,
        hasEvidence,
        verified,
        badgeLabel,
        badgeClass,
      };
    });

    const filledCards = cards.filter((c) => c.pct !== null);
    const onTargetCount = filledCards.filter((c) => c.pct >= 100).length;
    const withEvidenceCount = cards.filter((c) => c.hasEvidence).length;
    const avgPct = filledCards.length
      ? filledCards.reduce((sum, c) => sum + c.pct, 0) / filledCards.length
      : null;

    return {
      activeRecord,
      totalSubmissionsInPeriod: periodRecords.length,
      cards,
      filledCount: filledCards.length,
      onTargetCount,
      withEvidenceCount,
      avgPct,
    };
  }, [currentUser, effectiveYear, ikuTick]);

  useGSAP(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isDual && workspacePillRef.current) {
      gsap.to(workspacePillRef.current, {
        xPercent: currentView === 'kpi' ? 100 : 0,
        duration: reduced ? 0 : 0.45,
        ease: 'expo.out',
      });
    }

    if (reduced) return undefined;

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(
      '.dash-title-line',
      { yPercent: 115 },
      { yPercent: 0, duration: 0.78, stagger: 0.06, overwrite: 'auto' }
    )
      .fromTo(
        '.dash-header-anim',
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.04, overwrite: 'auto', clearProps: 'transform' },
        '-=0.5'
      )
      .fromTo(
        '.dash-keyline',
        { scaleX: 0 },
        { scaleX: 1, transformOrigin: 'left center', duration: 0.85, ease: 'expo.inOut', overwrite: 'auto' },
        '-=0.55'
      )
      .fromTo(
        '.dash-stat-cell',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.58, stagger: 0.045, overwrite: 'auto', clearProps: 'transform' },
        '-=0.5'
      );

    if (currentView === 'iku') {
      gsap.fromTo(
        '.dash-detail-card',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.04, ease: 'expo.out', delay: 0.06, overwrite: 'auto', clearProps: 'transform' }
      );

      gsap.fromTo(
        '.dash-progress-fill',
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: 'left center',
          duration: 0.9,
          stagger: 0.04,
          ease: 'expo.out',
          delay: 0.12,
          overwrite: 'auto',
        }
      );
    }

    ScrollTrigger.refresh();
  }, { dependencies: [currentView, effectiveYear, isDual], scope: dashRef });

  return (
    <div ref={dashRef} className="dash-arch-root">
      <style>{`
        .dash-arch-root {
          display: flex;
          flex-direction: column;
          padding-bottom: 3.5rem;
          color: #072534;
        }
        .dash-meta-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding-bottom: 0.9rem;
          border-bottom: 1px solid #D8E4EA;
          font-family: var(--ent-mono);
          font-size: 0.66rem;
          color: #475569;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .dash-period-select {
          min-height: 38px;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          background: #F7FAFB;
          border: 1px solid #D8E4EA;
          color: #072534;
          font-family: var(--ent-mono);
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
        }
        .dash-period-select:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: 2px;
          border-color: #094E68;
        }
        .dash-masthead {
          padding: 1.75rem 0 1.6rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 1.5rem;
        }
        .dash-title-h1 {
          margin: 0;
          font-family: Outfit, sans-serif;
          font-size: clamp(2rem, 3.8vw, 3.1rem);
          font-weight: 800;
          line-height: 1.04;
          letter-spacing: -0.04em;
          color: #072534;
        }
        .dash-title-mask {
          overflow: hidden;
          display: block;
          padding-bottom: 0.05em;
        }
        .dash-title-line {
          display: block;
          will-change: transform;
        }
        .dash-keyline {
          width: 100%;
          height: 2px;
          background: #094E68;
        }
        .dash-ledger-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 205px), 1fr));
          border-bottom: 1px solid #D8E4EA;
          background: #ffffff;
        }
        .dash-stat-cell {
          padding: 1.35rem 1.3rem;
          border-right: 1px solid #D8E4EA;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .dash-stat-cell:last-child {
          border-right: none;
        }
        .dash-iku-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
          border-top: 1px solid #D8E4EA;
          border-left: 1px solid #D8E4EA;
        }
        .dash-iku-cell {
          padding: clamp(1.35rem, 2.5vw, 1.55rem);
          border-right: 1px solid #D8E4EA;
          border-bottom: 1px solid #D8E4EA;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1.35rem;
          position: relative;
          transition: background-color 0.2s ease;
        }
        .dash-iku-cell::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: -1px;
          height: 2.5px;
          background: #094E68;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (hover: hover) {
          .dash-iku-cell:hover {
            background: #F7FAFB;
          }
          .dash-iku-cell:hover::before {
            transform: scaleX(1);
          }
        }
        @media (max-width: 860px) {
          .dash-stat-cell {
            border-right: none;
            border-bottom: 1px solid #D8E4EA;
          }
          .dash-period-select {
            min-height: 44px;
          }
        }
      `}</style>

      {/* Top System Metadata Strip */}
      <div className="dash-meta-top dash-header-anim">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#094E68', fontWeight: 700 }}>
            {isIkuOnly
              ? '01 // OTORITAS KHUSUS IKU'
              : isKpiOnly
                ? '02 // OTORITAS KHUSUS KPI'
                : currentUser?.role === 'superadmin_prp'
                  ? `PRP // RUANG KERJA ${currentView.toUpperCase()}`
                  : '03 // PERAN GANDA'}
          </span>
          <span>·</span>
          <span>
            {currentView === 'iku'
              ? 'KEPMENDIKBUDRISTEK NO. 210/M/2023'
              : 'PERSPEKTIF A · B · C · D'}
          </span>
        </div>

        {/* Pemilih Tahun Akademik */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Calendar size={14} color="#0E7480" aria-hidden="true" />
            <select
              aria-label="Pilih periode evaluasi akademik"
              className="dash-period-select"
              value={effectiveYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {periods.length ? (
                periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.label} [{period.status === 'Active' ? 'AKTIF' : period.status === 'Archived' ? 'ARSIP' : 'DRAFT'}]
                  </option>
                ))
              ) : (
                <option value="2025/2026">Tahun Akademik 2025/2026 [AKTIF]</option>
              )}
            </select>
          </div>
          {currentView === 'kpi' && !isPeriodOpen && (
            <span className="ent-badge ent-badge-revision">PERIODE TERKUNCI</span>
          )}
        </div>
      </div>

      {/* Editorial Masthead */}
      <div className="dash-masthead">
        <div>
          <h1 className="dash-title-h1">
            <span className="dash-title-mask">
              <span className="dash-title-line">
                {currentView === 'iku' ? 'Matriks Capaian' : 'Evaluasi Operasional'}
              </span>
            </span>
            <span className="dash-title-mask">
              <span className="dash-title-line" style={{ fontWeight: 700, color: '#094E68' }}>
                {currentView === 'iku' ? '8 IKU Kementerian.' : 'KPI Unit & Fakultas.'}
              </span>
            </span>
          </h1>
          <p
            className="dash-header-anim"
            style={{
              color: '#334155',
              margin: '0.85rem 0 0',
              fontSize: '0.92rem',
              maxWidth: '640px',
              lineHeight: 1.65,
            }}
          >
            {currentView === 'iku'
              ? 'Pemantauan pengisian aktual, standar target RKAT, dan kelengkapan bukti 8 Indikator Kinerja Utama Institut Teknologi PLN.'
              : 'Pengukuran terstruktur capaian Keberlanjutan (A), Mahasiswa (B), Bisnis Internal (C), serta Kepatuhan (D).'}
          </p>
        </div>

        {/* Pemilih Ruang Kerja Segmented */}
        {isDual && (
          <div
            role="group"
            aria-label="Pemilih ruang kerja IKU atau KPI"
            className="dash-header-anim"
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              background: '#EDF3F6',
              border: '1px solid #D8E4EA',
              padding: '3px',
              borderRadius: '8px',
              width: 'min(100%, 356px)',
            }}
          >
            <div
              ref={workspacePillRef}
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '3px',
                bottom: '3px',
                left: '3px',
                width: 'calc((100% - 6px) / 2)',
                background: '#094E68',
                borderRadius: '6px',
                zIndex: 1,
              }}
            />
            <button
              type="button"
              aria-pressed={currentView === 'iku'}
              onClick={() => switchWorkspace('iku')}
              style={{
                position: 'relative',
                zIndex: 2,
                minHeight: '40px',
                padding: '0.48rem 0.75rem',
                border: 'none',
                borderRadius: '6px',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                color: currentView === 'iku' ? '#ffffff' : '#334155',
                transition: 'color 0.2s ease',
              }}
            >
              01 // RUANG IKU
            </button>
            <button
              type="button"
              aria-pressed={currentView === 'kpi'}
              onClick={() => switchWorkspace('kpi')}
              style={{
                position: 'relative',
                zIndex: 2,
                minHeight: '40px',
                padding: '0.48rem 0.75rem',
                border: 'none',
                borderRadius: '6px',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.03em',
                color: currentView === 'kpi' ? '#ffffff' : '#334155',
                transition: 'color 0.2s ease',
              }}
            >
              02 // RUANG KPI
            </button>
          </div>
        )}
      </div>

      {/* Keyline */}
      <div className="dash-keyline" />

      {/* Connected Metric Ledger */}
      {currentView === 'iku' ? (
        <div className="dash-ledger-strip">
          {[
            {
              code: '01 // CAKUPAN',
              label: 'Indikator Terisi',
              val: `${String(ikuOverview.filledCount).padStart(2, '0')}/08`,
              sub: ikuOverview.activeRecord
                ? `Status: ${STATUS_LABELS[ikuOverview.activeRecord.status] || ikuOverview.activeRecord.status}`
                : 'Belum ada submission pada periode ini',
            },
            {
              code: '02 // CAPAIAN',
              label: 'Memenuhi Target (≥100%)',
              val: `${String(ikuOverview.onTargetCount).padStart(2, '0')}/08`,
              sub:
                ikuOverview.avgPct !== null
                  ? `Rata-rata indikator terisi: ${ikuOverview.avgPct.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
                  : 'Menunggu input realisasi aktual unit',
            },
            {
              code: '03 // BUKTI HTTPS',
              label: 'Tautan Bukti Tercatat',
              val: `${String(ikuOverview.withEvidenceCount).padStart(2, '0')}/08`,
              sub: ikuOverview.activeRecord
                ? `Unit: ${ikuOverview.activeRecord.unit}`
                : 'Lengkapi bukti pada menu Submission IKU',
            },
            {
              code: '04 // SIKLUS',
              label: 'Status Periode Evaluasi',
              val: isPeriodOpen ? 'AKTIF' : 'KUNCI',
              sub: selectedPeriod?.label || effectiveYear,
            },
          ].map((stat) => (
            <div key={stat.code} className="dash-stat-cell">
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: '#0E7480',
                  letterSpacing: '0.08em',
                }}
              >
                {stat.code}
              </span>
              <div
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 'clamp(2rem, 3vw, 2.75rem)',
                  fontWeight: 800,
                  color: '#072534',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  margin: '0.55rem 0 0.35rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stat.val}
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#072534' }}>{stat.label}</div>
                <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dash-ledger-strip" style={{ marginBottom: '2rem' }}>
          {[
            ...(kpiLiveMetrics.sectionScores || []).map((sec, idx) => ({
              code: `0${idx + 1} // BAGIAN ${sec.code}`,
              label: sec.isPenaltySection ? `Maks ${sec.weightDisplay}` : `Bobot ${sec.weightDisplay}`,
              val: `${(Number(sec.score) || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              sub: `${sec.title} · ${sec.completed}/${sec.total} butir`,
            })),
            {
              code: 'FINAL // SKOR BERSIH',
              label: 'Total Capaian / 100',
              val: kpiLiveMetrics.totalScore.toFixed(2).replace('.', ','),
              sub: `Terisi ${kpiLiveMetrics.filledCount}/${kpiLiveMetrics.totalCount} butir (${kpiLiveMetrics.filledInputsCount}/${kpiLiveMetrics.totalInputsCount} sel)`,
            },
          ].map((stat) => (
            <div key={stat.code} className="dash-stat-cell">
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: '#0E7480',
                  letterSpacing: '0.08em',
                }}
              >
                {stat.code}
              </span>
              <div
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 'clamp(1.85rem, 2.6vw, 2.4rem)',
                  fontWeight: 800,
                  color: '#072534',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  margin: '0.5rem 0 0.3rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stat.val}
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#072534' }}>{stat.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content: 8 IKU Ledger Grid OR KPI Data Entry Sheet */}
      {currentView === 'iku' ? (
        <div style={{ marginTop: '2.25rem' }}>
          {/* Honest Data Source Notice when no submission exists yet */}
          {!ikuOverview.activeRecord && (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.7rem',
                padding: '0.9rem 1.1rem',
                marginBottom: '1.35rem',
                borderRadius: '8px',
                background: '#F7FAFB',
                border: '1px solid #D8E4EA',
                borderLeft: '3px solid #094E68',
                fontSize: '0.82rem',
                color: '#334155',
                lineHeight: 1.55,
              }}
            >
              <Info size={16} color="#094E68" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#072534' }}>Belum ada pengajuan IKU pada periode {effectiveYear}.</strong>{' '}
                Kartu di bawah menampilkan standar target referensi RKAT ITPLN. Buka menu{' '}
                {['iku_only', 'superadmin_prp'].includes(currentUser?.role) ? (
                  <Link to="/internal/iku-submissions" style={{ color: '#094E68', fontWeight: 700 }}>
                    Submission &amp; Verifikasi 8 IKU
                  </Link>
                ) : (
                  <strong>Submission 8 IKU</strong>
                )}{' '}
                untuk mencatat realisasi aktual beserta tautan bukti dukung HTTPS.
              </div>
            </div>
          )}

          <div
            className="dash-header-anim"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.15rem',
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color: '#0E7480',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                INDEKS // 01 - 08
              </span>
              <h2
                style={{
                  fontSize: '1.22rem',
                  fontWeight: 800,
                  margin: '0.2rem 0 0',
                  color: '#072534',
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '-0.025em',
                }}
              >
                Rincian 8 Indikator Kinerja Utama
              </h2>
            </div>

            {['iku_only', 'superadmin_prp'].includes(currentUser?.role) ? (
              <Link to="/internal/iku-submissions" className="ent-btn ent-btn-primary" style={{ minHeight: '42px' }}>
                {ikuOverview.activeRecord ? 'Buka Submission & Bukti IKU' : 'Isi Capaian & Bukti IKU'}{' '}
                <ArrowUpRight size={14} />
              </Link>
            ) : (
              <Link to="/iku-list" className="ent-btn" style={{ minHeight: '42px' }}>
                Katalog Standar 8 IKU <ArrowUpRight size={14} />
              </Link>
            )}
          </div>

          <div className="dash-iku-grid">
            {ikuOverview.cards.map((item) => {
              const barPct = item.pct !== null ? Math.min(100, Math.max(0, item.pct)) : 0;
              return (
                <article key={item.id} className="dash-iku-cell dash-detail-card">
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.95rem',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#0E7480',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {item.idx} // {item.code}
                      </span>
                      <span className={item.badgeClass}>{item.badgeLabel}</span>
                    </div>

                    <h3
                      style={{
                        fontSize: '1.08rem',
                        fontWeight: 800,
                        color: '#072534',
                        margin: '0 0 0.4rem',
                        fontFamily: 'Outfit, sans-serif',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: '#334155', margin: 0, lineHeight: 1.58 }}>
                      {item.desc}
                    </p>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Outfit, sans-serif',
                          fontSize: '1.75rem',
                          fontWeight: 800,
                          color: item.pct !== null ? '#072534' : '#475569',
                          letterSpacing: '-0.035em',
                          lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {item.pct !== null
                          ? `${item.pct.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
                          : 'Belum diisi'}
                      </span>
                      <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 600, color: '#475569' }}>
                        {item.actualVal !== null
                          ? `AKTUAL ${item.actualVal} / TARGET ${item.targetVal}`
                          : `TARGET RKAT ≥ ${item.baselineTarget}%`}
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '4px', background: '#EDF3F6', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        className="dash-progress-fill"
                        style={{
                          height: '100%',
                          width: `${barPct}%`,
                          background: item.pct !== null && item.pct >= 100 ? '#0E7480' : '#094E68',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.85rem',
                        paddingTop: '0.7rem',
                        borderTop: '1px solid #EDF3F6',
                        fontSize: '0.75rem',
                        color: '#475569',
                      }}
                    >
                      <span>{item.pic}</span>
                      <Link
                        to={
                          ['iku_only', 'superadmin_prp'].includes(currentUser?.role)
                            ? `/internal/iku-submissions?period=${encodeURIComponent(effectiveYear)}`
                            : `/iku-list#iku-${item.id}`
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          minHeight: '32px',
                          color: '#094E68',
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textDecoration: 'none',
                        }}
                      >
                        {['iku_only', 'superadmin_prp'].includes(currentUser?.role) ? 'INPUT' : 'DETAIL'}{' '}
                        <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <KPIDataEntrySheet onMetricsUpdate={setKpiLiveMetrics} readOnly={!isPeriodOpen} />
      )}
    </div>
  );
}
