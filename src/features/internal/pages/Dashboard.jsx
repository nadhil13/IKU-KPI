import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Layers, Building2, Calendar, ArrowUpRight
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../auth/context/AuthContext';
import KPIDataEntrySheet from '../../kpi/components/KPIDataEntrySheet';

gsap.registerPlugin(ScrollTrigger);

// ─── 8 IKU DATA KEMENDIKBUDRISTEK ───
const IKU_DATA = [
  { id: 1, code: 'IKU 01', title: 'Kesiapan Kerja Lulusan', desc: 'Lulusan mendapat pekerjaan layak, wirausaha, atau studi lanjut.', real: 88, target: 80, pic: 'Biro Kemahasiswaan & Alumni', status: 'Tercapai' },
  { id: 2, code: 'IKU 02', title: 'Pengalaman Luar Kampus', desc: 'Mahasiswa magang industri, proyek independen, pertukaran pelajar.', real: 79, target: 75, pic: 'Pusat MBKM ITPLN', status: 'Tercapai' },
  { id: 3, code: 'IKU 03', title: 'Tridharma Dosen di Luar Kampus', desc: 'Dosen membimbing di industri energi atau berkegiatan di kampus lain.', real: 92, target: 85, pic: 'Direktorat SDM & Akademik', status: 'Tercapai' },
  { id: 4, code: 'IKU 04', title: 'Praktisi Mengajar', desc: 'Praktisi industri dan profesional BUMN mengajar di kelas.', real: 88, target: 80, pic: 'Fakultas & Program Studi', status: 'Tercapai' },
  { id: 5, code: 'IKU 05', title: 'Penerapan Riset & Inovasi', desc: 'Hasil riset dosen diterapkan oleh PLN Group dan industri energi nasional.', real: 74, target: 75, pic: 'LPPM ITPLN', status: 'Verifikasi' },
  { id: 6, code: 'IKU 06', title: 'Kemitraan Program Studi', desc: 'Kerja sama kurikulum & magang dengan mitra industri kelas dunia.', real: 83, target: 80, pic: 'Direktorat Kerjasama ITPLN', status: 'Tercapai' },
  { id: 7, code: 'IKU 07', title: 'Pembelajaran Kolaboratif', desc: 'Kelas menggunakan metode pemecahan kasus (case method) & team-based project.', real: 95, target: 90, pic: 'Biro Pengembangan Pembelajaran', status: 'Tercapai' },
  { id: 8, code: 'IKU 08', title: 'Akreditasi Internasional', desc: 'Program studi terakreditasi internasional (IABEE / ASIIN / ABET).', real: 81, target: 80, pic: 'Satuan Penjaminan Mutu (SPMI)', status: 'Tercapai' },
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
  const selectedPeriod = periods.find((period) => period.id === selectedYear) || activePeriod;
  const isPeriodOpen = selectedPeriod?.inputOpen !== false && selectedPeriod?.status !== 'Archived';

  useEffect(() => {
    const refreshPeriods = () => {
      try { setPeriods(JSON.parse(localStorage.getItem('prp_periods')) || []); } catch { setPeriods([]); }
    };
    window.addEventListener('storage', refreshPeriods);
    return () => window.removeEventListener('storage', refreshPeriods);
  }, []);

  useEffect(() => {
    if (activePeriod?.id && !periods.some((period) => period.id === selectedYear)) setSelectedYear(activePeriod.id);
  }, [activePeriod, periods, selectedYear]);

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
        duration: 0.55,
        ease: 'expo.out',
      });
    }

    gsap.fromTo(
      '.dash-header-anim',
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, stagger: 0.04, ease: 'expo.out', overwrite: 'auto' }
    );

    gsap.fromTo(
      '.dash-stat-card',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.05, ease: 'expo.out', overwrite: 'auto' }
    );

    gsap.fromTo(
      '.dash-detail-card',
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.75, stagger: 0.04, ease: 'expo.out', delay: 0.08, overwrite: 'auto' }
    );

    gsap.fromTo(
      '.dash-progress-fill',
      { scaleX: 0 },
      {
        scaleX: 1,
        transformOrigin: 'left center',
        duration: 1.0,
        stagger: 0.04,
        ease: 'expo.out',
        delay: 0.12,
        overwrite: 'auto',
      }
    );

    if (scrollerEl && currentView === 'iku') {
      const ikuCards = gsap.utils.toArray('.dash-detail-card');
      ikuCards.forEach((card) => {
        gsap.fromTo(
          card,
          { y: 20, opacity: 0.4 },
          {
            y: 0,
            opacity: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              scroller: scrollerEl,
              start: 'top 95%',
              end: 'top 70%',
              scrub: 0.5,
            },
          }
        );
      });
    }

    ScrollTrigger.refresh();
  }, { dependencies: [currentView, selectedYear, isDual], scope: dashRef });

  return (
    <div ref={dashRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ─── 1. TOP DASHBOARD BANNER (PURE CLEAN VIEW) ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div className="dash-header-anim">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '99px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#334155',
                letterSpacing: '0.06em',
              }}
            >
              {isIkuOnly
                ? '01 // OTORITAS KHUSUS IKU'
                : isKpiOnly
                  ? '02 // OTORITAS KHUSUS KPI'
                  : currentUser?.role === 'superadmin_prp'
                    ? `SUPERADMIN PRP // ${currentView.toUpperCase()} WORKSPACE`
                    : '03 // INTEGRATOR UTAMA (IKU & KPI)'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>•</span>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>
              {currentView === 'iku'
                ? 'Standar Kepmendikbudristek No. 210/M/2023'
                : 'Evaluasi Kinerja Operasional Unit & Fakultas ITPLN (Perspektif A, B, C & D)'}
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.7rem, 2.5vw, 2.15rem)',
              fontWeight: 800,
              margin: '0 0 0.3rem',
              color: '#0f172a',
              letterSpacing: '-0.03em',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            {currentView === 'iku'
              ? 'Executive Dashboard — 8 IKU Kementerian'
              : 'Executive Dashboard — KPI Operasional Unit'}
          </h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.88rem' }}>
            {currentView === 'iku'
              ? 'Pemantauan realisasi 8 Indikator Kinerja Utama Institut Teknologi PLN terhadap target nasional.'
              : 'Kelola capaian Keberlanjutan (A), Mahasiswa (B), Bisnis Internal (C), serta Kepatuhan / Compliance (D).'}
          </p>
        </div>

        {/* Pemilih Tahun Akademik */}
        <div className="dash-header-anim" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
            }}
          >
            <Calendar size={14} color="#64748b" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0f172a',
                fontSize: '0.8rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              {periods.length ? periods.map((period) => <option key={period.id} value={period.id}>{period.label} ({period.status === 'Active' ? 'Aktif' : period.status === 'Archived' ? 'Arsip' : 'Draft'})</option>) : <option value="2025/2026">T.A 2025/2026</option>}
            </select>
          </div>
          {currentView === 'kpi' && !isPeriodOpen && <span style={{ color: '#b45309', fontSize: '.7rem', fontWeight: 700 }}>Periode ditutup untuk input</span>}
        </div>
      </div>

      {/* ─── 2. PEMILIH RUANG KERJA KHUSUS AKUN KONDISI 3 (WHITE FLOATING PILL) ─── */}
      {isDual && (
        <div
          className="dash-header-anim"
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            padding: '4px',
            borderRadius: '11px',
            width: 'fit-content',
            minWidth: '460px',
          }}
        >
          <div
            ref={workspacePillRef}
            style={{
              position: 'absolute',
              top: '4px',
              bottom: '4px',
              left: '4px',
              width: 'calc((100% - 8px) / 2)',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
              zIndex: 1,
            }}
          />
          <button
            type="button"
            onClick={() => switchWorkspace('iku')}
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.1rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 700,
              fontFamily: 'Outfit, sans-serif',
              color: currentView === 'iku' ? '#0f172a' : '#64748b',
              transition: 'color 0.25s ease',
            }}
          >
            <Layers size={14} /> 01. Ruang Kerja IKU Kementerian
          </button>
          <button
            type="button"
            onClick={() => switchWorkspace('kpi')}
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.1rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 700,
              fontFamily: 'Outfit, sans-serif',
              color: currentView === 'kpi' ? '#0f172a' : '#64748b',
              transition: 'color 0.25s ease',
            }}
          >
            <Building2 size={14} /> 02. Ruang Kerja KPI Operasional
          </button>
        </div>
      )}

      {/* ─── 3. KARTU RINGKASAN METRIK (PURE WHITE SURFACES) ─── */}
      {currentView === 'iku' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.15rem',
          }}
        >
          {[
            { label: 'Total Indikator IKU', val: '8', sub: '100% Selaras Kemendikbud' },
            { label: 'IKU Melampaui Target', val: '7 / 8', sub: '87.5% Tercapai Semester Ini' },
            { label: 'Tahap Verifikasi SPMI', val: '1', sub: 'Audit Eviden LPPM Berjalan' },
            { label: 'Indikator Kritis', val: '0', sub: 'Seluruh Indikator On-Track' },
          ].map((stat, i) => (
            <div key={i} className="glass-panel dash-stat-card" style={{ padding: '1.25rem 1.4rem' }}>
              <div className="glass-panel-content">
                <span
                  style={{
                    color: '#64748b',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {stat.label}
                </span>
                <div
                  style={{
                    fontSize: '2.1rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: '0.35rem 0 0.15rem',
                    fontFamily: 'Outfit, sans-serif',
                    letterSpacing: '-1px',
                  }}
                >
                  {stat.val}
                </div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 500 }}>
                  {stat.sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
            gap: '0.95rem',
          }}
        >
          {[
            ...(kpiLiveMetrics.sectionScores || []).map((sec) => ({
              label: sec.isPenaltySection ? `Bagian ${sec.code} (Maks ${sec.weightDisplay})` : `Bagian ${sec.code} (Bobot ${sec.weightDisplay})`,
              val: `${(Number(sec.score) || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${sec.weightDisplay}`,
              sub: `${sec.title} · ${sec.completed}/${sec.total} butir`,
            })),
            {
              label: 'Skor Akhir KPI Bersih',
              val: `${kpiLiveMetrics.totalScore.toFixed(2).replace('.', ',')} / 100`,
              sub: `Terisi: ${kpiLiveMetrics.filledCount}/${kpiLiveMetrics.totalCount} Butir (${kpiLiveMetrics.filledInputsCount}/${kpiLiveMetrics.totalInputsCount} Sel)`,
            },
          ].map((stat, i) => (
            <div key={i} className="glass-panel dash-stat-card" style={{ padding: '1.15rem 1.25rem' }}>
              <div className="glass-panel-content">
                <span
                  style={{
                    color: '#64748b',
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {stat.label}
                </span>
                <div
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: '0.3rem 0 0.15rem',
                    fontFamily: 'Outfit, sans-serif',
                    letterSpacing: '-0.8px',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {stat.val}
                </div>
                <span style={{ color: '#64748b', fontSize: '0.71rem', fontWeight: 500 }}>
                  {stat.sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── 4. KONTEN UTAMA (8 IKU ATAU MATRIKS KPI BAGIAN A, B, C & D) ─── */}
      {currentView === 'iku' ? (
        <div>
          <div
            className="dash-header-anim"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                margin: 0,
                color: '#0f172a',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              Matriks 8 Indikator Kinerja Utama (IKU)
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
              Periode Evaluasi {selectedYear}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.15rem',
            }}
          >
            {IKU_DATA.map((item) => (
              <div
                key={item.id}
                className="glass-panel dash-detail-card"
                style={{
                  padding: '1.45rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.2rem',
                }}
              >
                <div className="glass-panel-content">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        color: '#0f172a',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {item.code}
                    </span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '99px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        color: '#475569',
                      }}
                    >
                      {item.status}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: '0 0 0.35rem',
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    {item.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: '#64748b',
                      margin: 0,
                      lineHeight: 1.55,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>

                <div className="glass-panel-content">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.78rem',
                      marginBottom: '0.45rem',
                    }}
                  >
                    <span style={{ color: '#0f172a', fontWeight: 700 }}>
                      Realisasi: {item.real}%
                    </span>
                    <span style={{ color: '#64748b' }}>
                      Target: {item.target}%
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: '4px',
                      background: '#f1f5f9',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      className="dash-progress-fill"
                      style={{
                        height: '100%',
                        width: `${Math.min(100, (item.real / item.target) * 100)}%`,
                        background: '#475569',
                        borderRadius: '999px',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '0.75rem',
                      paddingTop: '0.65rem',
                      borderTop: '1px solid #f1f5f9',
                      fontSize: '0.72rem',
                      color: '#64748b',
                    }}
                  >
                    <span>PIC: {item.pic}</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        color: '#0f172a',
                        fontWeight: 700,
                      }}
                    >
                      Rincian <ArrowUpRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ─── MATRIKS EVALUASI KPI LENGKAP BAGIAN A, B, C & D ─── */
        <KPIDataEntrySheet onMetricsUpdate={setKpiLiveMetrics} readOnly={!isPeriodOpen} />
      )}
    </div>
  );
}