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
    desc: 'Akun dialihkan khusus ke ruang kerja 8 IKU Kementerian. Akses menuju lembar kerja KPI internal dikunci selama sesi berlangsung.',
    iku: {
      unlocked: true,
      mode: 'BACA & INPUT',
      actionText: 'Input & Evaluasi 8 IKU',
      code: 'RUANG KERJA AKTIF',
      metrics: [
        { label: 'Pengisian Realisasi & Bukti Tautan', val: 'AKTIF' },
        { label: 'Cakupan Evaluasi Indikator Makro', val: '8 IKU' },
      ],
    },
    kpi: {
      unlocked: false,
      mode: 'TERKUNCI',
      actionText: 'Akses Dibatasi Otoritas',
      code: 'ISOLASI 403',
      metrics: [
        { label: 'Lembar Kerja KPI Fakultas & Unit', val: 'TERKUNCI' },
        { label: 'Evaluasi Perspektif A, B, C, D', val: 'NONAKTIF' },
      ],
    },
  },
  {
    id: '02',
    title: 'Otoritas Khusus KPI',
    tag: 'KPI ONLY',
    desc: 'Akun difokuskan pada pengisian KPI operasional unit dan fakultas ITPLN. Modul 8 IKU Kementerian dikunci dari sesi ini.',
    iku: {
      unlocked: false,
      mode: 'TERKUNCI',
      actionText: 'Akses Dibatasi Otoritas',
      code: 'ISOLASI 403',
      metrics: [
        { label: 'Pengisian Realisasi & Bukti Tautan', val: 'TERKUNCI' },
        { label: 'Cakupan Evaluasi Indikator Makro', val: 'NONAKTIF' },
      ],
    },
    kpi: {
      unlocked: true,
      mode: 'BACA & INPUT',
      actionText: 'Input & Evaluasi KPI Unit',
      code: 'RUANG KERJA AKTIF',
      metrics: [
        { label: 'Lembar Kerja KPI Fakultas & Unit', val: 'AKTIF' },
        { label: 'Evaluasi Perspektif A, B, C, D', val: '4 ASPEK' },
      ],
    },
  },
  {
    id: '03',
    title: 'Integrator Utama PRP',
    tag: 'SUPERADMIN PRP',
    desc: 'Direktorat PRP memegang otoritas verifikasi lintas modul dan dapat berpindah antara Control Center, 8 IKU, serta KPI Unit.',
    iku: {
      unlocked: true,
      mode: 'AKSES PENUH',
      actionText: 'Verifikasi & Persetujuan IKU',
      code: 'OTORITAS ROOT',
      metrics: [
        { label: 'Verifikasi Bukti & Persetujuan Unit', val: 'AKTIF' },
        { label: 'Cakupan Evaluasi Indikator Makro', val: '8 IKU' },
      ],
    },
    kpi: {
      unlocked: true,
      mode: 'AKSES PENUH',
      actionText: 'Desainer Formula & Review KPI',
      code: 'OTORITAS ROOT',
      metrics: [
        { label: 'Desainer Tabel & Formula KPI', val: 'AKTIF' },
        { label: 'Review Submission Seluruh Unit', val: 'TERBUKA' },
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

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
          once: true,
        },
      }
    );

    // 2. Scroll-Scrubbed Topological Canvas (user-driven, tanpa loop tak terbatas)
    const orbitEl = sectionRef.current?.querySelector('.sso-orbit-dashed');
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

        // A. Update Hairline Progress & Orbit Sudut berdasar Scroll
        if (topLineFillRef.current) {
          topLineFillRef.current.style.transform = `scaleX(${p})`;
        }
        if (orbitEl) {
          orbitEl.setAttribute('transform', `rotate(${(p * 180).toFixed(1)} 185 210)`);
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
    if (mode === 'AKSES PENUH') return <ShieldCheck size={13} />;
    return <Pencil size={13} />;
  };

  return (
    <section
      id="arsitektur"
      ref={sectionRef}
      style={{
        background: '#ffffff',
        color: '#072534',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid #D8E4EA',
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
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 1.15rem 0.5rem;
          border-radius: 6px;
          will-change: transform, opacity;
          transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.55s cubic-bezier(0.16, 1, 0.3, 1),
                      background-color 0.2s ease;
        }
        .role-item-row:hover {
          background-color: #F7FAFB;
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
          border-radius: 8px;
          will-change: transform, background-color, box-shadow;
          transition: background-color 0.55s cubic-bezier(0.16, 1, 0.3, 1),
                      color 0.55s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.55s cubic-bezier(0.16, 1, 0.3, 1);
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
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'clamp(2.25rem, 4vw, 3.5rem) clamp(1.25rem, 4vw, 3.5rem)',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* ════ 1. HEADER ARSITEKTURAL ITPLN ════ */}
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto' }}>
          <div
            className="topo-header-item"
            style={{
              fontFamily: 'var(--ent-mono)',
              fontSize: '0.68rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              color: '#094E68',
              textTransform: 'uppercase',
              paddingBottom: '0.65rem',
              marginBottom: '1.25rem',
              borderBottom: '2px solid #0E7480',
              display: 'inline-block',
            }}
          >
            03 // ARSITEKTUR HAK AKSES SSO
          </div>

          <h2
            className="topo-header-item"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(2rem, 4vw, 3.1rem)',
              fontWeight: 800,
              color: '#072534',
              letterSpacing: '-0.035em',
              lineHeight: 1.08,
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
              color: '#334155',
              lineHeight: 1.7,
              margin: '0 auto',
              maxWidth: '600px',
            }}
          >
            Satu gerbang autentikasi terpadu yang memisahkan otoritas pelaporan standar makro kementerian dan evaluasi mikro unit kerja.
          </p>
        </div>

        {/* ════ 2. OPEN TOPOLOGICAL CANVAS ════ */}
        <div className="topo-layout" style={{ margin: 'auto 0' }}>
          {/* ── KIRI: 3 SKENARIO OTORITAS LOGIN (KEYBOARD ACCESSIBLE BUTTONS) ── */}
          <div style={{ display: 'flex', flexDirection: 'column', paddingRight: '1rem' }}>
            {ROLES_DATA.map((item, idx) => {
              const isActive = idx === activeIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isActive}
                  className="role-item-row"
                  onClick={() => handleSelectRole(idx)}
                  style={{
                    opacity: isActive ? 1 : 0.48,
                    transform: isActive ? 'translate3d(8px, 0, 0)' : 'translate3d(0px, 0, 0)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                    <span
                      style={{
                        fontFamily: 'var(--ent-mono)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        color: isActive ? '#0E7480' : '#475569',
                      }}
                    >
                      {item.id}
                    </span>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <h3
                          style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '1.32rem',
                            fontWeight: 800,
                            margin: 0,
                            letterSpacing: '-0.025em',
                            color: '#072534',
                          }}
                        >
                          {item.title}
                        </h3>

                        <span
                          style={{
                            fontFamily: 'var(--ent-mono)',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '4px',
                            background: '#094E68',
                            color: '#ffffff',
                            opacity: isActive ? 1 : 0,
                            transform: isActive ? 'translateX(0)' : 'translateX(-6px)',
                            transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
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
                              color: '#334155',
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
                </button>
              );
            })}
          </div>

          {/* ── TENGAH: CONTINUOUS BEZIER SVG ── */}
          <div className="topo-svg-bridge" style={{ width: '370px', height: '420px', position: 'relative' }} aria-hidden="true">
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
                    stroke="#D8E4EA"
                    strokeWidth="1.5"
                  />
                  <circle cx="0" cy={y} r="3.5" fill="#BFD2DC" />
                </g>
              ))}

              {/* Kabel Dinamis Mengikuti Scroll */}
              <path
                ref={activeInPathRef}
                d="M 0 85 C 95 85, 95 210, 185 210"
                stroke="#094E68"
                strokeWidth="2.4"
              />
              <path
                ref={activeInPulseRef}
                className="svg-stream-pulse"
                d="M 0 85 C 95 85, 95 210, 185 210"
                stroke="#0E7480"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeDasharray="24 220"
              />
              <circle ref={activeNodeDotRef} cx="0" cy="85" r="5.5" fill="#0E7480" />

              {/* 2 Jalur Keluar Menuju Modul IKU & KPI */}
              <path
                className="out-path-iku"
                d={OUT_PATH_IKU}
                stroke="#094E68"
                strokeWidth="2.2"
                strokeDasharray={!current.iku.unlocked ? '4 6' : 'none'}
              />
              <path
                className="out-path-kpi"
                d={OUT_PATH_KPI}
                stroke="#094E68"
                strokeWidth="1.5"
                strokeDasharray={!current.kpi.unlocked ? '4 6' : 'none'}
              />

              {/* Highlight Jalur ke IKU & KPI */}
              <path
                className="svg-stream-pulse out-pulse-iku"
                d={OUT_PATH_IKU}
                stroke="#0E7480"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeDasharray="24 220"
              />
              <path
                className="svg-stream-pulse out-pulse-kpi"
                d={OUT_PATH_KPI}
                stroke="#0E7480"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeDasharray="24 220"
                style={{ opacity: 0 }}
              />

              {/* Titik Terminal Kanan */}
              <circle
                cx="370"
                cy="95"
                r="5"
                fill={current.iku.unlocked ? '#0E7480' : '#ffffff'}
                stroke={current.iku.unlocked ? '#094E68' : '#94A3B8'}
                strokeWidth="2"
                style={{ transition: 'all 0.5s ease' }}
              />
              <circle
                cx="370"
                cy="325"
                r="5"
                fill={current.kpi.unlocked ? '#0E7480' : '#ffffff'}
                stroke={current.kpi.unlocked ? '#094E68' : '#94A3B8'}
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
                <circle cx="185" cy="210" r="46" fill="#ffffff" stroke="#D8E4EA" strokeWidth="1" />
                <circle
                  className="sso-orbit-dashed"
                  cx="185"
                  cy="210"
                  r="38"
                  fill="none"
                  stroke="#0E7480"
                  strokeWidth="1.2"
                  strokeDasharray="4 6"
                />
                <circle cx="185" cy="210" r="28" fill="#062C3D" />
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
                  fill="#94B8C7"
                  style={{ fontSize: '6.5px', fontWeight: 600, letterSpacing: '1px' }}
                >
                  ITPLN
                </text>
              </g>
            </svg>
          </div>

          {/* ── KANAN: 2 ARCHITECTURAL PLANES ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* PLANE 1: 8 IKU KEMENTERIAN */}
            <div
              ref={ikuPlaneRef}
              className="workspace-plane"
              style={{
                background: current.iku.unlocked ? '#062C3D' : '#F7FAFB',
                color: current.iku.unlocked ? '#ffffff' : '#475569',
                border: current.iku.unlocked ? '1px solid #094E68' : '1px solid #D8E4EA',
                boxShadow: current.iku.unlocked
                  ? '0 20px 40px -12px rgba(7, 37, 52, 0.18)'
                  : 'none',
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
                      borderRadius: '1px',
                      background: current.iku.unlocked ? '#38BDF8' : '#94A3B8',
                    }}
                  />
                  <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: current.iku.unlocked ? '#C5DEE8' : '#475569' }}>
                    Dimensi Makro · Kemendikbudristek
                  </span>
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.63rem',
                    fontWeight: 700,
                    padding: '0.22rem 0.58rem',
                    borderRadius: '4px',
                    background: current.iku.unlocked ? '#094E68' : '#EDF3F6',
                    border: current.iku.unlocked ? '1px solid #1B9AAA' : '1px solid #BFD2DC',
                    color: current.iku.unlocked ? '#ffffff' : '#334155',
                  }}
                >
                  {renderBadgeIcon(current.iku.mode)}
                  {current.iku.mode}
                </span>
              </div>

              <div className="plane-anim-content" style={{ marginBottom: '0.85rem' }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.22rem', fontWeight: 800, letterSpacing: '-0.025em', color: current.iku.unlocked ? '#ffffff' : '#334155' }}>
                  8 Indikator Kinerja Utama (IKU)
                </div>
              </div>

              <div
                className="plane-anim-content"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  padding: '0.7rem 0',
                  borderTop: current.iku.unlocked ? '1px solid #12485E' : '1px solid #D8E4EA',
                  borderBottom: current.iku.unlocked ? '1px solid #12485E' : '1px solid #D8E4EA',
                  marginBottom: '0.8rem',
                }}
              >
                {current.iku.metrics.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: current.iku.unlocked ? '#C5DEE8' : '#475569' }}>{m.label}</span>
                    <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.72rem', fontWeight: 700, color: current.iku.unlocked ? '#ffffff' : '#334155' }}>{m.val}</span>
                  </div>
                ))}
              </div>

              <div className="plane-anim-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.73rem' }}>
                <span style={{ color: current.iku.unlocked ? '#94B8C7' : '#475569' }}>{current.iku.actionText}</span>
                <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: current.iku.unlocked ? '#38BDF8' : '#475569' }}>{current.iku.code}</span>
              </div>
            </div>

            {/* PLANE 2: KPI OPERASIONAL ITPLN */}
            <div
              ref={kpiPlaneRef}
              className="workspace-plane"
              style={{
                background: current.kpi.unlocked ? '#062C3D' : '#F7FAFB',
                color: current.kpi.unlocked ? '#ffffff' : '#475569',
                border: current.kpi.unlocked ? '1px solid #094E68' : '1px solid #D8E4EA',
                boxShadow: current.kpi.unlocked
                  ? '0 20px 40px -12px rgba(7, 37, 52, 0.18)'
                  : 'none',
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
                      borderRadius: '1px',
                      background: current.kpi.unlocked ? '#38BDF8' : '#94A3B8',
                    }}
                  />
                  <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: current.kpi.unlocked ? '#C5DEE8' : '#475569' }}>
                    Dimensi Mikro · Internal ITPLN
                  </span>
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.63rem',
                    fontWeight: 700,
                    padding: '0.22rem 0.58rem',
                    borderRadius: '4px',
                    background: current.kpi.unlocked ? '#094E68' : '#EDF3F6',
                    border: current.kpi.unlocked ? '1px solid #1B9AAA' : '1px solid #BFD2DC',
                    color: current.kpi.unlocked ? '#ffffff' : '#334155',
                  }}
                >
                  {renderBadgeIcon(current.kpi.mode)}
                  {current.kpi.mode}
                </span>
              </div>

              <div className="plane-anim-content" style={{ marginBottom: '0.85rem' }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.22rem', fontWeight: 800, letterSpacing: '-0.025em', color: current.kpi.unlocked ? '#ffffff' : '#334155' }}>
                  Key Performance Indicator (KPI)
                </div>
              </div>

              <div
                className="plane-anim-content"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  padding: '0.7rem 0',
                  borderTop: current.kpi.unlocked ? '1px solid #12485E' : '1px solid #D8E4EA',
                  borderBottom: current.kpi.unlocked ? '1px solid #12485E' : '1px solid #D8E4EA',
                  marginBottom: '0.8rem',
                }}
              >
                {current.kpi.metrics.map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: current.kpi.unlocked ? '#C5DEE8' : '#475569' }}>{m.label}</span>
                    <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.72rem', fontWeight: 700, color: current.kpi.unlocked ? '#ffffff' : '#334155' }}>{m.val}</span>
                  </div>
                ))}
              </div>

              <div className="plane-anim-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.73rem' }}>
                <span style={{ color: current.kpi.unlocked ? '#94B8C7' : '#475569' }}>{current.kpi.actionText}</span>
                <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: current.kpi.unlocked ? '#38BDF8' : '#475569' }}>{current.kpi.code}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ════ 3. ARCHITECTURAL PROGRESS LINE & 44x44px STEP BUTTONS ════ */}
        <div
          style={{
            paddingTop: '1.25rem',
            borderTop: '1px solid #D8E4EA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            position: 'relative',
          }}
        >
          <div
            ref={topLineFillRef}
            style={{
              position: 'absolute',
              top: '-1px',
              left: 0,
              right: 0,
              height: '2px',
              background: '#0E7480',
              transformOrigin: 'left center',
              transform: 'scaleX(0)',
              willChange: 'transform',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#072534',
                letterSpacing: '0.08em',
              }}
            >
              0{activeIdx + 1} / 0{ROLES_DATA.length}
            </span>
            <span style={{ width: '1px', height: '12px', background: '#BFD2DC' }} />
            <span
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#475569',
              }}
            >
              {current.title}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {ROLES_DATA.map((r, i) => (
              <button
                key={r.id}
                type="button"
                aria-label={`Pilih skenario ${r.title}`}
                aria-pressed={activeIdx === i}
                onClick={() => handleSelectRole(i)}
                style={{
                  border: activeIdx === i ? '1px solid #094E68' : '1px solid #BFD2DC',
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  fontFamily: 'var(--ent-mono)',
                  background: activeIdx === i ? '#094E68' : '#F7FAFB',
                  color: activeIdx === i ? '#ffffff' : '#072534',
                  transition: 'background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease',
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