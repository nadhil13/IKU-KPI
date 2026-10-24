import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowUpRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../auth/context/AuthContext';
import KPIDataEntrySheet from '../../kpi/components/KPIDataEntrySheet';

gsap.registerPlugin(ScrollTrigger);

// ─── 8 IKU DATA KEMENDIKBUDRISTEK ───
const IKU_DATA = [
  { id: 1, idx: '01', code: 'IKU.01', title: 'Kesiapan Kerja Lulusan', desc: 'Lulusan mendapat pekerjaan layak, wirausaha, atau studi lanjut.', real: 88, target: 80, pic: 'Biro Kemahasiswaan & Alumni', status: 'TERCAPAI' },
  { id: 2, idx: '02', code: 'IKU.02', title: 'Pengalaman Luar Kampus', desc: 'Mahasiswa magang industri, proyek independen, pertukaran pelajar.', real: 79, target: 75, pic: 'Pusat MBKM ITPLN', status: 'TERCAPAI' },
  { id: 3, idx: '03', code: 'IKU.03', title: 'Tridharma Dosen di Luar Kampus', desc: 'Dosen membimbing di industri energi atau berkegiatan di kampus lain.', real: 92, target: 85, pic: 'Direktorat SDM & Akademik', status: 'TERCAPAI' },
  { id: 4, idx: '04', code: 'IKU.04', title: 'Praktisi Mengajar', desc: 'Praktisi industri dan profesional BUMN mengajar di kelas.', real: 88, target: 80, pic: 'Fakultas & Program Studi', status: 'TERCAPAI' },
  { id: 5, idx: '05', code: 'IKU.05', title: 'Penerapan Riset & Inovasi', desc: 'Hasil riset dosen diterapkan oleh PLN Group dan industri energi nasional.', real: 74, target: 75, pic: 'LPPM ITPLN', status: 'VERIFIKASI' },
  { id: 6, idx: '06', code: 'IKU.06', title: 'Kemitraan Program Studi', desc: 'Kerja sama kurikulum & magang dengan mitra industri kelas dunia.', real: 83, target: 80, pic: 'Direktorat Kerjasama ITPLN', status: 'TERCAPAI' },
  { id: 7, idx: '07', code: 'IKU.07', title: 'Pembelajaran Kolaboratif', desc: 'Kelas menggunakan metode pemecahan kasus (case method) & team-based project.', real: 95, target: 90, pic: 'Biro Pengembangan Pembelajaran', status: 'TERCAPAI' },
  { id: 8, idx: '08', code: 'IKU.08', title: 'Akreditasi Internasional', desc: 'Program studi terakreditasi internasional (IABEE / ASIIN / ABET).', real: 81, target: 80, pic: 'Satuan Penjaminan Mutu (SPMI)', status: 'TERCAPAI' },
];

export default function Dashboard() {
  const { currentUser, activeWorkspace, switchWorkspace } = useAuth();
  const [periods, setPeriods] = useState(() => {
    try { return JSON.parse(localStorage.getItem('prp_periods')) || []; } catch { return []; }
  });
  const activePeriod = useMemo(() => periods.find((period) => period.status === 'Active') || periods[0], [periods]);
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
  const effectiveYear = periods.length && !periods.some((period) => period.id === selectedYear)
    ? (activePeriod?.id || selectedYear)
    : selectedYear;
  const selectedPeriod = periods.find((period) => period.id === effectiveYear) || activePeriod;
  const isPeriodOpen = selectedPeriod?.inputOpen !== false && selectedPeriod?.status !== 'Archived';

  useEffect(() => {
    const refreshPeriods = () => {
      try { setPeriods(JSON.parse(localStorage.getItem('prp_periods')) || []); } catch { setPeriods([]); }
    };
    window.addEventListener('storage', refreshPeriods);
    window.addEventListener('prp-admin-updated', refreshPeriods);
    return () => {
      window.removeEventListener('storage', refreshPeriods);
      window.removeEventListener('prp-admin-updated', refreshPeriods);
    };
  }, []);

  const currentView = isIkuOnly
    ? 'iku'
    : isKpiOnly
      ? 'kpi'
      : activeWorkspace === 'kpi'
        ? 'kpi'
        : 'iku';

  useGSAP(() => {
    const scrollerEl = document.querySelector('.internal-main-scroll');

    if (isDual && workspacePillRef.current) {
      gsap.to(workspacePillRef.current, {
        xPercent: currentView === 'kpi' ? 100 : 0,
        duration: 0.5,
        ease: 'expo.out',
      });
    }

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(
      '.dash-title-line',
      { yPercent: 115 },
      { yPercent: 0, duration: 0.82, stagger: 0.07, overwrite: 'auto' }
    )
      .fromTo(
        '.dash-header-anim',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.04, overwrite: 'auto', clearProps: 'transform' },
        '-=0.55'
      )
      .fromTo(
        '.dash-keyline',
        { scaleX: 0 },
        { scaleX: 1, transformOrigin: 'left center', duration: 0.9, ease: 'expo.inOut', overwrite: 'auto' },
        '-=0.6'
      )
      .fromTo(
        '.dash-stat-cell',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65, stagger: 0.05, overwrite: 'auto', clearProps: 'transform' },
        '-=0.55'
      );

    // Live numeric roll-up for IKU realisasi %
    if (currentView === 'iku') {
      gsap.utils.toArray('.dash-real-num').forEach((el) => {
        const target = Number(el.getAttribute('data-val') || 0);
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.1,
          delay: 0.15,
          ease: 'expo.out',
          onUpdate: () => {
            el.textContent = `${Math.round(obj.v)}%`;
          },
        });
      });

      gsap.fromTo(
        '.dash-detail-card',
        { y: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.72, stagger: 0.045, ease: 'expo.out', delay: 0.08, overwrite: 'auto', clearProps: 'transform' }
      );

      gsap.fromTo(
        '.dash-progress-fill',
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: 'left center',
          duration: 1.05,
          stagger: 0.045,
          ease: 'expo.out',
          delay: 0.15,
          overwrite: 'auto',
        }
      );

      if (scrollerEl) {
        gsap.utils.toArray('.dash-detail-card').forEach((card) => {
          gsap.fromTo(
            card,
            { y: 18 },
            {
              y: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: card,
                scroller: scrollerEl,
                start: 'top 98%',
                end: 'top 72%',
                scrub: 0.6,
              },
            }
          );
        });
      }
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
          color: #09090b;
        }
        .dash-meta-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding-bottom: 0.9rem;
          border-bottom: 1px solid #e4e4e7;
          font-family: var(--ent-mono);
          font-size: 0.65rem;
          color: #71717a;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .dash-masthead {
          padding: 1.85rem 0 1.65rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 1.5rem;
        }
        .dash-title-h1 {
          margin: 0;
          font-family: Outfit, sans-serif;
          font-size: clamp(2rem, 3.8vw, 3.15rem);
          font-weight: 800;
          line-height: 1.03;
          letter-spacing: -0.042em;
          color: #09090b;
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
          background: #09090b;
        }
        .dash-ledger-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          border-bottom: 1px solid #e4e4e7;
          background: #ffffff;
        }
        .dash-stat-cell {
          padding: 1.4rem 1.35rem;
          border-right: 1px solid #e4e4e7;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .dash-stat-cell:last-child {
          border-right: none;
        }
        .dash-iku-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
          border-top: 1px solid #e4e4e7;
          border-left: 1px solid #e4e4e7;
        }
        .dash-iku-cell {
          padding: 1.55rem 1.5rem;
          border-right: 1px solid #e4e4e7;
          border-bottom: 1px solid #e4e4e7;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1.4rem;
          position: relative;
          transition: background-color 0.22s ease;
        }
        .dash-iku-cell::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: -1px;
          height: 2px;
          background: #09090b;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dash-iku-cell:hover {
          background: #fafafa;
        }
        .dash-iku-cell:hover::before {
          transform: scaleX(1);
        }
        @media (max-width: 860px) {
          .dash-stat-cell {
            border-right: none;
            border-bottom: 1px solid #e4e4e7;
          }
        }
      `}</style>

      {/* Top System Metadata Strip */}
      <div className="dash-meta-top dash-header-anim">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#09090b', fontWeight: 700 }}>
            {isIkuOnly
              ? '01 // ISOLATED IKU AUTHORITY'
              : isKpiOnly
                ? '02 // ISOLATED KPI AUTHORITY'
                : currentUser?.role === 'superadmin_prp'
                  ? `ROOT // ${currentView.toUpperCase()} WORKSPACE`
                  : '03 // DUAL INTEGRATOR'}
          </span>
          <span>·</span>
          <span>
            {currentView === 'iku'
              ? 'KEPMENDIKBUDRISTEK NO. 210/M/2023'
              : 'PERSPEKTIF A · B · C · D'}
          </span>
        </div>

        {/* Pemilih Tahun Akademik */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              padding: '3px 9px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderRadius: '4px',
              background: '#fafafa',
              border: '1px solid #e4e4e7',
            }}
          >
            <Calendar size={12} color="#52525b" />
            <select
              value={effectiveYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#09090b',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {periods.length
                ? periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.label} [{period.status === 'Active' ? 'AKTIF' : period.status === 'Archived' ? 'ARSIP' : 'DRAFT'}]
                    </option>
                  ))
                : <option value="2025/2026">T.A 2025/2026 [AKTIF]</option>}
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
                {currentView === 'iku' ? 'Matriks Eksekutif' : 'Evaluasi Operasional'}
              </span>
            </span>
            <span className="dash-title-mask">
              <span className="dash-title-line" style={{ fontWeight: 400, color: '#52525b' }}>
                {currentView === 'iku' ? '8 IKU Kementerian.' : 'KPI Unit & Fakultas.'}
              </span>
            </span>
          </h1>
          <p className="dash-header-anim" style={{ color: '#52525b', margin: '0.85rem 0 0', fontSize: '0.88rem', maxWidth: '620px', lineHeight: 1.65 }}>
            {currentView === 'iku'
              ? 'Pemantauan realisasi strategis 8 Indikator Kinerja Utama Institut Teknologi PLN terhadap standar capaian nasional.'
              : 'Pengukuran terstruktur capaian Keberlanjutan (A), Mahasiswa (B), Bisnis Internal (C), serta Kepatuhan (D).'}
          </p>
        </div>

        {/* Pemilih Ruang Kerja Segmented Architectural */}
        {isDual && (
          <div
            className="dash-header-anim"
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              background: '#efeff1',
              border: '1px solid #e4e4e7',
              padding: '3px',
              borderRadius: '6px',
              minWidth: '340px',
            }}
          >
            <div
              ref={workspacePillRef}
              style={{
                position: 'absolute',
                top: '3px',
                bottom: '3px',
                left: '3px',
                width: 'calc((100% - 6px) / 2)',
                background: '#09090b',
                borderRadius: '4px',
                zIndex: 1,
              }}
            />
            <button
              type="button"
              onClick={() => switchWorkspace('iku')}
              style={{
                position: 'relative',
                zIndex: 2,
                padding: '0.48rem 0.9rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.03em',
                color: currentView === 'iku' ? '#ffffff' : '#52525b',
                transition: 'color 0.22s ease',
              }}
            >
              01 // WORKSPACE IKU
            </button>
            <button
              type="button"
              onClick={() => switchWorkspace('kpi')}
              style={{
                position: 'relative',
                zIndex: 2,
                padding: '0.48rem 0.9rem',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.03em',
                color: currentView === 'kpi' ? '#ffffff' : '#52525b',
                transition: 'color 0.22s ease',
              }}
            >
              02 // WORKSPACE KPI
            </button>
          </div>
        )}
      </div>

      {/* Self-Drawing Keyline */}
      <div className="dash-keyline" />

      {/* Connected Architectural Metric Ledger */}
      {currentView === 'iku' ? (
        <div className="dash-ledger-strip">
          {[
            { code: '01 // TOTAL', label: 'Indikator Makro IKU', val: '08', sub: '100% selaras standar kementerian' },
            { code: '02 // ON-TARGET', label: 'Melampaui Target', val: '07/08', sub: '87,5% tercapai pada siklus ini' },
            { code: '03 // AUDIT', label: 'Tahap Verifikasi SPMI', val: '01', sub: 'Validasi eviden riset LPPM' },
            { code: '04 // CRITICAL', label: 'Indikator Kritis', val: '00', sub: 'Seluruh indikator terkendali' },
          ].map((stat) => (
            <div key={stat.code} className="dash-stat-cell">
              <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.62rem', fontWeight: 600, color: '#71717a', letterSpacing: '0.08em' }}>
                {stat.code}
              </span>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(2.2rem, 3.2vw, 3rem)', fontWeight: 700, color: '#09090b', letterSpacing: '-0.045em', lineHeight: 1, margin: '0.55rem 0 0.35rem', fontVariantNumeric: 'tabular-nums' }}>
                {stat.val}
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#09090b' }}>{stat.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '2px' }}>{stat.sub}</div>
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
              <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.6rem', fontWeight: 600, color: '#71717a', letterSpacing: '0.08em' }}>
                {stat.code}
              </span>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.85rem, 2.6vw, 2.4rem)', fontWeight: 700, color: '#09090b', letterSpacing: '-0.04em', lineHeight: 1, margin: '0.5rem 0 0.3rem', fontVariantNumeric: 'tabular-nums' }}>
                {stat.val}
              </div>
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#09090b' }}>{stat.label}</div>
                <div style={{ fontSize: '0.69rem', color: '#71717a', marginTop: '2px' }}>{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Content: 8 IKU Ledger Grid OR KPI Data Entry Sheet */}
      {currentView === 'iku' ? (
        <div style={{ marginTop: '2.5rem' }}>
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
              <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.62rem', color: '#71717a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                INDEX // 01 — 08
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0.2rem 0 0', color: '#09090b', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.025em' }}>
                Rincian Capaian 8 Indikator Kinerja Utama
              </h2>
            </div>

            {['iku_only', 'superadmin_prp'].includes(currentUser?.role) ? (
              <Link to="/internal/iku-submissions" className="ent-btn ent-btn-primary">
                Kelola Submission &amp; Eviden IKU <ArrowUpRight size={14} />
              </Link>
            ) : (
              <Link to="/iku-list" className="ent-btn">
                Katalog Standar 8 IKU <ArrowUpRight size={14} />
              </Link>
            )}
          </div>

          <div className="dash-iku-grid">
            {IKU_DATA.map((item) => {
              const isAchieved = item.status === 'TERCAPAI';
              return (
                <article key={item.id} className="dash-iku-cell dash-detail-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 700, color: '#09090b', letterSpacing: '0.06em' }}>
                        {item.idx} // {item.code}
                      </span>
                      <span className={isAchieved ? 'ent-badge ent-badge-approved' : 'ent-badge ent-badge-revision'}>
                        {item.status}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#09090b', margin: '0 0 0.4rem', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#52525b', margin: 0, lineHeight: 1.58 }}>
                      {item.desc}
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                      <span
                        className="dash-real-num"
                        data-val={item.real}
                        style={{
                          fontFamily: 'Outfit, sans-serif',
                          fontSize: '1.85rem',
                          fontWeight: 700,
                          color: '#09090b',
                          letterSpacing: '-0.04em',
                          lineHeight: 1,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {item.real}%
                      </span>
                      <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', color: '#71717a' }}>
                        TARGET {item.target}%
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '3px', background: '#e4e4e7', overflow: 'hidden' }}>
                      <div
                        className="dash-progress-fill"
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (item.real / item.target) * 100)}%`,
                          background: '#09090b',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '0.85rem',
                        paddingTop: '0.7rem',
                        borderTop: '1px solid #f4f4f5',
                        fontSize: '0.73rem',
                        color: '#71717a',
                      }}
                    >
                      <span>{item.pic}</span>
                      <Link
                        to={['iku_only', 'superadmin_prp'].includes(currentUser?.role) ? '/internal/iku-submissions' : `/iku-list#iku-${item.id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          color: '#09090b',
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textDecoration: 'none',
                        }}
                      >
                        DETAIL <ArrowUpRight size={12} />
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
