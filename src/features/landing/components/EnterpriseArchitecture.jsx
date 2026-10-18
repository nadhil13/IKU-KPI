import { useRef, useState, useCallback } from 'react';
import { Lock, Pencil, ShieldCheck } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

// 3 Titik Koordinat Y yang Sinkron dengan 3 Kondisi Login
const Y_NODES = [85, 210, 335];

const ROLES_DATA = [
  {
    id: '01',
    title: 'Otoritas Khusus IKU',
    tag: 'IKU ONLY',
    desc: 'Akun hanya dialihkan ke ruang kerja 8 IKU Kementerian. Jalur menuju KPI internal diputus otomatis oleh sistem.',
    iku: {
      unlocked: true,
      mode: 'READ & EDIT',
      actionText: 'Input & Evaluasi 8 IKU',
      code: 'ACTIVE WORKSPACE',
      metrics: [
        { label: 'IKU 1 • Kesiapan Kerja Lulusan', val: '88.4%' },
        { label: 'IKU 3 • Dosen Berkegiatan Industri', val: '92.0%' },
      ],
    },
    kpi: {
      unlocked: false,
      mode: 'TERKUNCI',
      actionText: 'Akses Dibatasi Sistem',
      code: 'LOCKED',
      metrics: [
        { label: 'Capaian KPI Fakultas & Unit', val: '—' },
        { label: 'Beban Kinerja Dosen (BKD)', val: '—' },
      ],
    },
  },
  {
    id: '02',
    title: 'Otoritas Khusus KPI',
    tag: 'KPI ONLY',
    desc: 'Akun difokuskan penuh pada pengisian KPI operasional internal ITPLN. Modul 8 IKU Kementerian dikunci dari sesi ini.',
    iku: {
      unlocked: false,
      mode: 'TERKUNCI',
      actionText: 'Akses Dibatasi Sistem',
      code: 'LOCKED',
      metrics: [
        { label: 'IKU 1 • Kesiapan Kerja Lulusan', val: '—' },
        { label: 'IKU 3 • Dosen Berkegiatan Industri', val: '—' },
      ],
    },
    kpi: {
      unlocked: true,
      mode: 'READ & EDIT',
      actionText: 'Input & Evaluasi KPI Unit',
      code: 'ACTIVE WORKSPACE',
      metrics: [
        { label: 'Capaian KPI Fakultas & Unit', val: '87.9%' },
        { label: 'Beban Kinerja Dosen (BKD)', val: '94.2%' },
      ],
    },
  },
  {
    id: '03',
    title: 'Integrator Utama',
    tag: 'SUPERADMIN PRP',
    desc: 'Otoritas penuh pada kedua modul. Setelah autentikasi, pengguna dapat memilih masuk ke Menu IKU atau Menu KPI secara fleksibel.',
    iku: {
      unlocked: true,
      mode: 'FULL ACCESS',
      actionText: 'Pilihan Ruang Kerja 01',
      code: 'READY TO ENTER',
      metrics: [
        { label: 'IKU 1 • Kesiapan Kerja Lulusan', val: '88.4%' },
        { label: 'IKU 3 • Dosen Berkegiatan Industri', val: '92.0%' },
      ],
    },
    kpi: {
      unlocked: true,
      mode: 'FULL ACCESS',
      actionText: 'Pilihan Ruang Kerja 02',
      code: 'READY TO ENTER',
      metrics: [
        { label: 'Capaian KPI Fakultas & Unit', val: '87.9%' },
        { label: 'Beban Kinerja Dosen (BKD)', val: '94.2%' },
      ],
    },
  },
];

const OUT_PATH_IKU = 'M 185 210 C 275 210, 280 95, 370 95';
const OUT_PATH_KPI = 'M 185 210 C 275 210, 280 325, 370 325';

const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export default function EnterpriseArchitecture() {
  const sectionRef = useRef(null);
  const pinWrapRef = useRef(null);
  const stInstanceRef = useRef(null);

  const activeInPathRef = useRef(null);
  const activeInPulseRef = useRef(null);
  const activeNodeDotRef = useRef(null);
  const ssoCoreGroupRef = useRef(null);
  const topLineFillRef = useRef(null);
  const ikuPlaneRef = useRef(null);
  const kpiPlaneRef = useRef(null);

  const [activeIdx, setActiveIdx] = useState(0);
  const current = ROLES_DATA[activeIdx];

  useGSAP(() => {
    // 1. Smooth Reveal untuk Header (Selaras dengan Section 01 & 02 di Home.jsx)
    gsap.fromTo(
      '.topo-header-item',
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.1,
        duration: 1.1,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 82%',
        },
      }
    );

    // 2. Ambient Loop untuk Aliran Data & Orbit SSO
    gsap.to('.sso-orbit-dashed', {
      rotation: 360,
      transformOrigin: '50% 50%',
      duration: 28,
      repeat: -1,
      ease: 'none',
    });

    gsap.fromTo(
      '.svg-stream-pulse',
      { strokeDashoffset: 240 },
      {
        strokeDashoffset: 0,
        duration: 1.8,
        repeat: -1,
        ease: 'none',
      }
    );

    // 3. Ultra-Smooth Inertial ScrollTrigger
    stInstanceRef.current = ScrollTrigger.create({
      trigger: pinWrapRef.current,
      start: 'top top',
      end: '+=220%',
      pin: true,
      scrub: 1.4,
      fastScrollEnd: true,
      preventOverlaps: true,
      onUpdate: (self) => {
        const p = self.progress;

        // A. Update Hairline Progress di Atas Kanvas
        if (topLineFillRef.current) {
          topLineFillRef.current.style.transform = `scaleX(${p})`;
        }

        // B. Kalkulasi Posisi Y Magnetis untuk Kabel SVG Kiri (85px -> 335px)
        const scaled = p * (Y_NODES.length - 1); // 0.0 -> 2.0
        const segIdx = Math.min(Y_NODES.length - 2, Math.floor(scaled));
        const frac = scaled - segIdx;
        const smoothFrac = easeInOutCubic(frac);

        const currentY =
          Y_NODES[segIdx] + (Y_NODES[segIdx + 1] - Y_NODES[segIdx]) * smoothFrac;
        const dynamicCurve = `M 0 ${currentY.toFixed(2)} C 95 ${currentY.toFixed(
          2
        )}, 95 210, 185 210`;

        if (activeInPathRef.current) {
          activeInPathRef.current.setAttribute('d', dynamicCurve);
        }
        if (activeInPulseRef.current) {
          activeInPulseRef.current.setAttribute('d', dynamicCurve);
        }
        if (activeNodeDotRef.current) {
          activeNodeDotRef.current.setAttribute('cy', currentY.toFixed(2));
        }

        // C. Efek Skala Halus pada Inti SSO
        if (ssoCoreGroupRef.current) {
          const transitPulse = 1 + Math.sin(frac * Math.PI) * 0.05;
          ssoCoreGroupRef.current.style.transform = `scale(${transitPulse.toFixed(3)})`;
        }

        // D. Trigger Perubahan Role
        const nextIdx = Math.min(
          ROLES_DATA.length - 1,
          Math.max(0, Math.round(scaled))
        );
        setActiveIdx((prev) => (prev !== nextIdx ? nextIdx : prev));
      },
    });
  }, { scope: sectionRef });

  // Transisi Silky (expo.out) pada Kartu Kanan setiap kali Role aktif berganti
  useGSAP(() => {
    const role = ROLES_DATA[activeIdx];

    gsap.fromTo(
      '.plane-anim-content',
      { y: 10, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        stagger: 0.04,
        ease: 'expo.out',
        overwrite: 'auto',
      }
    );

    if (ikuPlaneRef.current) {
      gsap.to(ikuPlaneRef.current, {
        scale: role.iku.unlocked ? 1 : 0.97,
        y: role.iku.unlocked ? 0 : 4,
        duration: 0.8,
        ease: 'expo.out',
        overwrite: 'auto',
      });
    }

    if (kpiPlaneRef.current) {
      gsap.to(kpiPlaneRef.current, {
        scale: role.kpi.unlocked ? 1 : 0.97,
        y: role.kpi.unlocked ? 0 : 4,
        duration: 0.8,
        ease: 'expo.out',
        overwrite: 'auto',
      });
    }

    gsap.to('.out-path-iku', {
      opacity: role.iku.unlocked ? 1 : 0.2,
      strokeWidth: role.iku.unlocked ? 2.2 : 1.5,
      duration: 0.65,
      ease: 'expo.out',
      overwrite: 'auto',
    });

    gsap.to('.out-path-kpi', {
      opacity: role.kpi.unlocked ? 1 : 0.2,
      strokeWidth: role.kpi.unlocked ? 2.2 : 1.5,
      duration: 0.65,
      ease: 'expo.out',
      overwrite: 'auto',
    });

    gsap.to('.out-pulse-iku', {
      opacity: role.iku.unlocked ? 1 : 0,
      duration: 0.45,
      ease: 'power2.out',
      overwrite: 'auto',
    });

    gsap.to('.out-pulse-kpi', {
      opacity: role.kpi.unlocked ? 1 : 0,
      duration: 0.45,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }, { dependencies: [activeIdx], scope: sectionRef });

  const handleSelectRole = useCallback((idx) => {
    const st = stInstanceRef.current;
    if (st) {
      const targetProgress = idx / (ROLES_DATA.length - 1);
      const targetScroll = st.start + (st.end - st.start) * targetProgress;
      window.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      });
    } else {
      setActiveIdx(idx);
    }
  }, []);

  const renderBadgeIcon = (mode) => {
    if (mode === 'TERKUNCI') return <Lock size={13} />;
    if (mode === 'FULL ACCESS') return <ShieldCheck size={13} />;
    return <Pencil size={13} />;
  };

  return (
    <section
      id="arsitektur"
      ref={sectionRef}
      style={{
        background: '#ffffff',
        color: '#111111',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid #f0f0f2',
      }}
    >
      <style>{`
        .topo-layout {
          display: grid;
          grid-template-columns: 1.05fr 370px 1.25fr;
          align-items: center;
          width: 100%;
          position: relative;
        }
        .role-item-row {
          cursor: pointer;
          padding: 1.15rem 0;
          will-change: transform, opacity;
          transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .role-desc-grid {
          display: grid;
          transition: grid-template-rows 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1),
                      margin-top 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .role-desc-inner {
          overflow: hidden;
        }
        .workspace-plane {
          padding: 1.5rem 1.75rem;
          border-radius: 1.5rem;
          will-change: transform, background-color, box-shadow;
          transition: background-color 0.65s cubic-bezier(0.16, 1, 0.3, 1),
                      color 0.65s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.65s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (max-width: 1080px) {
          .topo-layout {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
          .topo-svg-bridge {
            display: none;
          }
        }
      `}</style>

      <div
        ref={pinWrapRef}
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'clamp(2.25rem, 4vw, 3.5rem) clamp(1.5rem, 4vw, 3.5rem)',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* ════ 1. HEADER BERSIH (100% SELARAS DENGAN SECTION 01 & 02 HOME.JSX) ════ */}
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto' }}>
          <div
            className="topo-header-item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '1rem',
              background: '#f5f5f7',
              padding: '0.6rem 1.5rem',
              borderRadius: '2rem',
              marginBottom: '1.25rem',
            }}
          >
            <span
              style={{
                fontSize: '0.9rem',
                fontWeight: 800,
                color: '#000000',
                letterSpacing: '2px',
              }}
            >
              03
            </span>
            <div style={{ width: '1px', height: '12px', background: '#cccccc' }} />
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '2px',
                color: '#666666',
                textTransform: 'uppercase',
              }}
            >
              Arsitektur Hak Akses
            </span>
          </div>

          <h2
            className="topo-header-item"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(2rem, 4vw, 3.1rem)',
              fontWeight: 800,
              color: '#111111',
              letterSpacing: '-2px',
              lineHeight: 1.1,
              margin: '0 0 0.85rem',
            }}
          >
            Menyelaraskan 8 IKU Kementerian
            <br />
            dengan KPI operasional ITPLN.
          </h2>

          <p
            className="topo-header-item"
            style={{
              fontSize: 'clamp(0.92rem, 1.1vw, 1.02rem)',
              color: '#666666',
              lineHeight: 1.7,
              margin: '0 auto',
              maxWidth: '600px',
            }}
          >
            Satu gerbang autentikasi terpadu yang memisahkan otoritas pengelolaan
            standar makro kementerian dan target mikro unit kerja secara presisi.
          </p>
        </div>

        {/* ════ 2. OPEN TOPOLOGICAL CANVAS (TANPA DOT MATRIX YANG TERPOTONG) ════ */}
        <div className="topo-layout" style={{ margin: 'auto 0' }}>
          {/* ── KIRI: 3 SKENARIO OTORITAS LOGIN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '1rem' }}>
            {ROLES_DATA.map((item, idx) => {
              const isActive = idx === activeIdx;
              return (
                <div
                  key={item.id}
                  className="role-item-row"
                  onClick={() => handleSelectRole(idx)}
                  style={{
                    opacity: isActive ? 1 : 0.28,
                    transform: isActive ? 'translate3d(10px, 0, 0)' : 'translate3d(0px, 0, 0)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                    <span
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        letterSpacing: '1px',
                        color: '#111111',
                      }}
                    >
                      {item.id}
                    </span>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <h3
                          style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '1.35rem',
                            fontWeight: 800,
                            margin: 0,
                            letterSpacing: '-0.5px',
                            color: '#111111',
                            transform: isActive ? 'scale(1.03)' : 'scale(1)',
                            transformOrigin: 'left center',
                            transition: 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          {item.title}
                        </h3>

                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            letterSpacing: '1px',
                            padding: '0.22rem 0.65rem',
                            borderRadius: '99px',
                            background: '#111111',
                            color: '#ffffff',
                            opacity: isActive ? 1 : 0,
                            transform: isActive ? 'translateX(0)' : 'translateX(-6px)',
                            transition: 'all 0.55s cubic-bezier(0.16, 1, 0.3, 1)',
                            pointerEvents: 'none',
                          }}
                        >
                          {item.tag}
                        </span>
                      </div>

                      <div
                        className="role-desc-grid"
                        style={{
                          gridTemplateRows: isActive ? '1fr' : '0fr',
                          opacity: isActive ? 1 : 0,
                          marginTop: isActive ? '0.45rem' : '0rem',
                        }}
                      >
                        <div className="role-desc-inner">
                          <p
                            style={{
                              fontSize: '0.88rem',
                              color: '#666666',
                              lineHeight: 1.6,
                              margin: 0,
                              maxWidth: '390px',
                            }}
                          >
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── TENGAH: CONTINUOUS LIQUID BEZIER SVG ── */}
          <div className="topo-svg-bridge" style={{ width: '370px', height: '420px', position: 'relative' }}>
            <svg
              viewBox="0 0 370 420"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              {/* 3 Jalur Statis Latar Belakang */}
              {Y_NODES.map((y, i) => (
                <g key={i}>
                  <path
                    d={`M 0 ${y} C 95 ${y}, 95 210, 185 210`}
                    stroke="#f0f0f2"
                    strokeWidth="1.5"
                  />
                  <circle cx="0" cy={y} r="3.5" fill="#d4d4d8" />
                </g>
              ))}

              {/* Kabel Dinamis Mengikuti Scroll */}
              <path
                ref={activeInPathRef}
                d="M 0 85 C 95 85, 95 210, 185 210"
                stroke="#111111"
                strokeWidth="2.2"
              />
              <path
                ref={activeInPulseRef}
                className="svg-stream-pulse"
                d="M 0 85 C 95 85, 95 210, 185 210"
                stroke="#111111"
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeDasharray="16 224"
              />
              <circle ref={activeNodeDotRef} cx="0" cy="85" r="5.5" fill="#111111" />

              {/* 2 Jalur Keluar Menuju Modul IKU & KPI */}
              <path
                className="out-path-iku"
                d={OUT_PATH_IKU}
                stroke="#111111"
                strokeWidth="2.2"
                strokeDasharray={!current.iku.unlocked ? '4 6' : 'none'}
              />
              <path
                className="out-path-kpi"
                d={OUT_PATH_KPI}
                stroke="#111111"
                strokeWidth="1.5"
                strokeDasharray={!current.kpi.unlocked ? '4 6' : 'none'}
              />

              {/* Pulse Mengalir ke IKU & KPI */}
              <path
                className="svg-stream-pulse out-pulse-iku"
                d={OUT_PATH_IKU}
                stroke="#111111"
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeDasharray="16 224"
              />
              <path
                className="svg-stream-pulse out-pulse-kpi"
                d={OUT_PATH_KPI}
                stroke="#111111"
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeDasharray="16 224"
                style={{ opacity: 0 }}
              />

              {/* Titik Terminal Kanan */}
              <circle
                cx="370"
                cy="95"
                r="5"
                fill={current.iku.unlocked ? '#111111' : '#ffffff'}
                stroke={current.iku.unlocked ? '#111111' : '#cccccc'}
                strokeWidth="2"
                style={{ transition: 'all 0.5s ease' }}
              />
              <circle
                cx="370"
                cy="325"
                r="5"
                fill={current.kpi.unlocked ? '#111111' : '#ffffff'}
                stroke={current.kpi.unlocked ? '#111111' : '#cccccc'}
                strokeWidth="2"
                style={{ transition: 'all 0.5s ease' }}
              />

              {/* ── CENTRAL ORBITAL SSO GATE ── */}
              <g
                ref={ssoCoreGroupRef}
                style={{
                  transformOrigin: '185px 210px',
                  willChange: 'transform',
                }}
              >
                <circle cx="185" cy="210" r="46" fill="#ffffff" stroke="#efefef" strokeWidth="1" />
                <circle
                  className="sso-orbit-dashed"
                  cx="185"
                  cy="210"
                  r="38"
                  fill="none"
                  stroke="#bcbcc2"
                  strokeWidth="1.2"
                  strokeDasharray="4 6"
                />
                <circle cx="185" cy="210" r="28" fill="#111111" />
                <text
                  x="185"
                  y="207"
                  textAnchor="middle"
                  fill="#ffffff"
                  style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '1.5px' }}
                >
                  SSO
                </text>
                <text
                  x="185"
                  y="218"
                  textAnchor="middle"
                  fill="#aaaaaa"
                  style={{ fontSize: '6.5px', fontWeight: 600, letterSpacing: '1px' }}
                >
                  GATE
                </text>
              </g>
            </svg>
          </div>

          {/* ── KANAN: 2 FLOATING PLANES (SUDUT MEMBULAT SELARAS DENGAN HOME.JSX) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
            {/* PLANE 1: 8 IKU KEMENTERIAN */}
            <div
              ref={ikuPlaneRef}
              className="workspace-plane"
              style={{
                background: current.iku.unlocked ? '#111111' : '#fafafa',
                color: current.iku.unlocked ? '#ffffff' : '#999999',
                boxShadow: current.iku.unlocked
                  ? '0 24px 48px rgba(0, 0, 0, 0.1)'
                  : 'inset 0 0 0 1px #eeeeee',
              }}
            >
              <div
                className="plane-anim-content"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: current.iku.unlocked ? '#ffffff' : '#cccccc',
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.75 }}>
                    Dimensi Makro • Kemendikbudristek
                  </span>
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '99px',
                    background: current.iku.unlocked ? 'rgba(255,255,255,0.14)' : '#efefef',
                    color: current.iku.unlocked ? '#ffffff' : '#777777',
                  }}
                >
                  {renderBadgeIcon(current.iku.mode)}
                  {current.iku.mode}
                </span>
              </div>

              <div className="plane-anim-content" style={{ marginBottom: '0.85rem' }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.22rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                  8 Indikator Kinerja Utama (IKU)
                </div>
              </div>

              <div
                className="plane-anim-content"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  padding: '0.7rem 0',
                  borderTop: current.iku.unlocked ? '1px solid rgba(255,255,255,0.12)' : '1px solid #ececef',
                  borderBottom: current.iku.unlocked ? '1px solid rgba(255,255,255,0.12)' : '1px solid #ececef',
                  marginBottom: '0.8rem',
                }}
              >
                {current.iku.metrics.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ opacity: current.iku.unlocked ? 0.8 : 0.6 }}>{m.label}</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>{m.val}</span>
                  </div>
                ))}
              </div>

              <div className="plane-anim-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.73rem' }}>
                <span style={{ opacity: 0.75 }}>{current.iku.actionText}</span>
                <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>{current.iku.code}</span>
              </div>
            </div>

            {/* PLANE 2: KPI OPERASIONAL ITPLN */}
            <div
              ref={kpiPlaneRef}
              className="workspace-plane"
              style={{
                background: current.kpi.unlocked ? '#111111' : '#fafafa',
                color: current.kpi.unlocked ? '#ffffff' : '#999999',
                boxShadow: current.kpi.unlocked
                  ? '0 24px 48px rgba(0, 0, 0, 0.1)'
                  : 'inset 0 0 0 1px #eeeeee',
              }}
            >
              <div
                className="plane-anim-content"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: current.kpi.unlocked ? '#ffffff' : '#cccccc',
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', opacity: 0.75 }}>
                    Dimensi Mikro • Internal ITPLN
                  </span>
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '99px',
                    background: current.kpi.unlocked ? 'rgba(255,255,255,0.14)' : '#efefef',
                    color: current.kpi.unlocked ? '#ffffff' : '#777777',
                  }}
                >
                  {renderBadgeIcon(current.kpi.mode)}
                  {current.kpi.mode}
                </span>
              </div>

              <div className="plane-anim-content" style={{ marginBottom: '0.85rem' }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.22rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
                  Key Performance Indicator (KPI)
                </div>
              </div>

              <div
                className="plane-anim-content"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  padding: '0.7rem 0',
                  borderTop: current.kpi.unlocked ? '1px solid rgba(255,255,255,0.12)' : '1px solid #ececef',
                  borderBottom: current.kpi.unlocked ? '1px solid rgba(255,255,255,0.12)' : '1px solid #ececef',
                  marginBottom: '0.8rem',
                }}
              >
                {current.kpi.metrics.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ opacity: current.kpi.unlocked ? 0.8 : 0.6 }}>{m.label}</span>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700 }}>{m.val}</span>
                  </div>
                ))}
              </div>

              <div className="plane-anim-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.73rem' }}>
                <span style={{ opacity: 0.75 }}>{current.kpi.actionText}</span>
                <span style={{ fontWeight: 700, letterSpacing: '0.5px' }}>{current.kpi.code}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ════ 3. MINIMALIST ARCHITECTURAL PROGRESS LINE (TANPA KAPSUL AI) ════ */}
        <div
          style={{
            paddingTop: '1.25rem',
            borderTop: '1px solid #efefef',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          {/* Garis Progress Halus di Sepanjang Border Atas */}
          <div
            ref={topLineFillRef}
            style={{
              position: 'absolute',
              top: '-1px',
              left: 0,
              right: 0,
              height: '2px',
              background: '#111111',
              transformOrigin: 'left center',
              transform: 'scaleX(0)',
              willChange: 'transform',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '0.78rem',
                fontWeight: 800,
                color: '#111111',
                letterSpacing: '1px',
              }}
            >
              0{activeIdx + 1} / 0{ROLES_DATA.length}
            </span>
            <span style={{ width: '1px', height: '11px', background: '#dddddd' }} />
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: '#888888',
              }}
            >
              {current.title}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {ROLES_DATA.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectRole(i)}
                style={{
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.3rem 0.7rem',
                  borderRadius: '99px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  fontFamily: "'Outfit', sans-serif",
                  background: activeIdx === i ? '#111111' : '#f5f5f7',
                  color: activeIdx === i ? '#ffffff' : '#888888',
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {r.id}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}