import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Lock,
  ShieldCheck, Check, AlertCircle, RotateCcw
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../context/AuthContext';

// Posisi fokus kamera foto gedung ITPLN untuk setiap skenario
const CAMERA_PRESETS = [
  { scale: 1.05, xPercent: -1.5, yPercent: -1.0 }, // 01: Fokus IKU
  { scale: 1.08, xPercent: 0.0, yPercent: 0.5 }, // 02: Fokus KPI
  { scale: 1.11, xPercent: 1.5, yPercent: -0.5 }, // 03: Fokus Superadmin PRP
];

export default function Login() {
  const navigate = useNavigate();
  const { login, completeDualLogin, mockAccounts } = useAuth();

  const [selectedIdx, setSelectedIdx] = useState(2); // Default: 03 Superadmin PRP
  const [email, setEmail] = useState(mockAccounts[2].email);
  const [password, setPassword] = useState(mockAccounts[2].password);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  // State Kondisi 3: Pemilihan Ruang Kerja (IKU atau KPI)
  const [step, setStep] = useState('credentials'); // 'credentials' | 'workspace_gate'
  const [pendingDualUser, setPendingDualUser] = useState(null);
  const [hoveredGate, setHoveredGate] = useState(null);

  // Refs untuk GSAP 120fps
  const containerRef = useRef(null);
  const bgPhotoRef = useRef(null);
  const hudCardRef = useRef(null);
  const pillIndicatorRef = useRef(null);
  const scrollProgressRef = useRef(null);
  const formStageRef = useRef(null);
  const gateStageRef = useRef(null);
  const svgLineIkuRef = useRef(null);
  const svgLineKpiRef = useRef(null);
  const wheelLockRef = useRef(false);

  const activeAccount = mockAccounts[selectedIdx] || mockAccounts[2];

  // Logika highlight modul di panel kiri (mendukung preview saat hover di Step 2)
  const isIkuActive =
    step === 'workspace_gate' && hoveredGate
      ? hoveredGate === 'iku'
      : activeAccount.role === 'iku_only' || ['dual', 'superadmin_prp'].includes(activeAccount.role);

  const isKpiActive =
    step === 'workspace_gate' && hoveredGate
      ? hoveredGate === 'kpi'
      : activeAccount.role === 'kpi_only' || ['dual', 'superadmin_prp'].includes(activeAccount.role);

  // Pilih Skenario Akun
  const handleSelectScenario = useCallback(
    (idx) => {
      if (idx < 0 || idx >= mockAccounts.length) return;
      const targetAcc = mockAccounts[idx];
      setSelectedIdx(idx);
      setEmail(targetAcc.email);
      setPassword(targetAcc.password);
      setErrorMessage('');
    },
    [mockAccounts]
  );

  // 1. GSAP Wheel Scroll Listener (Tetap aktif secara natural di balik layar)
  useEffect(() => {
    const handleWheel = (e) => {
      if (step !== 'credentials' || loading) return;
      if (Math.abs(e.deltaY) < 18) return;
      if (wheelLockRef.current) return;

      wheelLockRef.current = true;
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 520);

      if (e.deltaY > 0) {
        setSelectedIdx((prev) => {
          const next = (prev + 1) % mockAccounts.length;
          const acc = mockAccounts[next];
          setEmail(acc.email);
          setPassword(acc.password);
          setErrorMessage('');
          return next;
        });
      } else {
        setSelectedIdx((prev) => {
          const next = (prev - 1 + mockAccounts.length) % mockAccounts.length;
          const acc = mockAccounts[next];
          setEmail(acc.email);
          setPassword(acc.password);
          setErrorMessage('');
          return next;
        });
      }
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: true });
    }
    return () => {
      if (el) el.removeEventListener('wheel', handleWheel);
    };
  }, [step, loading, mockAccounts]);

  // 2. Master Entrance & 60fps Mouse Parallax Rig (gsap.quickTo)
  useGSAP(() => {
    const tl = gsap.timeline();

    tl.fromTo(
      '.login-left-pane',
      { clipPath: 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0)', duration: 1.35, ease: 'expo.inOut' }
    )
      .fromTo(
        bgPhotoRef.current,
        { scale: 1.22, filter: 'blur(8px) brightness(0.85)' },
        { scale: 1.11, filter: 'blur(0px) brightness(1.03)', duration: 1.8, ease: 'expo.out' },
        '-=0.9'
      )
      .fromTo(
        '.stagger-left',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.0, stagger: 0.08, ease: 'expo.out' },
        '-=1.2'
      )
      .fromTo(
        '.stagger-right',
        { y: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.0, stagger: 0.06, ease: 'expo.out' },
        '-=1.1'
      );

    // Continuous pulse stream pada jalur SVG
    gsap.fromTo(
      '.hud-svg-pulse',
      { strokeDashoffset: 180 },
      { strokeDashoffset: 0, duration: 1.6, repeat: -1, ease: 'none' }
    );

    // Setup 60fps Mouse Parallax dengan gsap.quickTo
    const xBgTo = gsap.quickTo(bgPhotoRef.current, 'x', { duration: 1.1, ease: 'power3.out' });
    const yBgTo = gsap.quickTo(bgPhotoRef.current, 'y', { duration: 1.1, ease: 'power3.out' });
    const xHudTo = gsap.quickTo(hudCardRef.current, 'x', { duration: 0.8, ease: 'power3.out' });
    const yHudTo = gsap.quickTo(hudCardRef.current, 'y', { duration: 0.8, ease: 'power3.out' });

    const handleMouseMove = (e) => {
      const normX = e.clientX / window.innerWidth - 0.5;
      const normY = e.clientY / window.innerHeight - 0.5;
      xBgTo(normX * -22);
      yBgTo(normY * -16);
      xHudTo(normX * 10);
      yHudTo(normY * 8);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, { scope: containerRef });

  // 3. Choreographed GSAP Transition saat Skenario Berubah
  useGSAP(() => {
    const preset = CAMERA_PRESETS[selectedIdx] || CAMERA_PRESETS[2];

    if (bgPhotoRef.current) {
      gsap.to(bgPhotoRef.current, {
        scale: preset.scale,
        xPercent: preset.xPercent,
        yPercent: preset.yPercent,
        duration: 1.25,
        ease: 'expo.out',
        overwrite: 'auto',
      });
    }

    if (pillIndicatorRef.current) {
      gsap.to(pillIndicatorRef.current, {
        xPercent: selectedIdx * 100,
        duration: 0.65,
        ease: 'expo.out',
      });
    }

    if (scrollProgressRef.current) {
      gsap.to(scrollProgressRef.current, {
        scaleX: (selectedIdx + 1) / mockAccounts.length,
        duration: 0.65,
        ease: 'expo.out',
      });
    }

    gsap.fromTo(
      '.morph-text-item',
      { y: 8, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, stagger: 0.04, ease: 'expo.out', overwrite: 'auto' }
    );

    if (svgLineIkuRef.current) {
      gsap.to(svgLineIkuRef.current, {
        opacity: isIkuActive ? 1 : 0.2,
        strokeWidth: isIkuActive ? 2.2 : 1.2,
        duration: 0.55,
        ease: 'expo.out',
      });
    }
    if (svgLineKpiRef.current) {
      gsap.to(svgLineKpiRef.current, {
        opacity: isKpiActive ? 1 : 0.2,
        strokeWidth: isKpiActive ? 2.2 : 1.2,
        duration: 0.55,
        ease: 'expo.out',
      });
    }
  }, { dependencies: [selectedIdx, isIkuActive, isKpiActive], scope: containerRef });

  // Submit Form Login
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    gsap.to('.submit-corp-btn', { scale: 0.985, duration: 0.12, yoyo: true, repeat: 1 });

    setTimeout(() => {
      const result = login(email, password);

      if (!result.success) {
        setLoading(false);
        setErrorMessage(result.message);
        return;
      }

      // Akun dual lama tetap dapat memilih workspace; Superadmin PRP langsung ke control center.
      if (result.requiresWorkspaceChoice) {
        setLoading(false);
        setPendingDualUser(result.user);
        transitionToWorkspaceGate();
        return;
      }

      // KONDISI 1 atau 2: Langsung masuk ke portal sesuai hak aksesnya
      performPortalExit('/internal');
    }, 420);
  };

  // Transisi GSAP dari Form Kredensial -> Gerbang Pilihan Menu (IKU vs KPI)
  const transitionToWorkspaceGate = () => {
    gsap.to(bgPhotoRef.current, {
      scale: 1.15,
      duration: 1.2,
      ease: 'expo.out',
    });

    gsap.to(formStageRef.current, {
      y: -22,
      opacity: 0,
      duration: 0.42,
      ease: 'power3.inOut',
      onComplete: () => {
        setStep('workspace_gate');
        requestAnimationFrame(() => {
          gsap.fromTo(
            '.gate-stagger',
            { y: 26, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, stagger: 0.07, ease: 'expo.out' }
          );
        });
      },
    });
  };

  // Kembali ke Form Login dari Gerbang Pilihan
  const handleBackToCredentials = () => {
    setHoveredGate(null);
    gsap.to(bgPhotoRef.current, {
      scale: CAMERA_PRESETS[selectedIdx].scale,
      duration: 1.1,
      ease: 'expo.out',
    });

    gsap.to(gateStageRef.current, {
      y: 18,
      opacity: 0,
      duration: 0.35,
      ease: 'power3.in',
      onComplete: () => {
        setStep('credentials');
        setPendingDualUser(null);
        requestAnimationFrame(() => {
          gsap.fromTo(
            formStageRef.current,
            { y: -18, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.65, ease: 'expo.out' }
          );
        });
      },
    });
  };

  // Eksekusi Pilihan Menu pada Kondisi 3 ('iku' atau 'kpi')
  const handleChooseDualPortal = (chosenMenu) => {
    if (!pendingDualUser) return;
    completeDualLogin(pendingDualUser, chosenMenu);
    performPortalExit('/internal');
  };

  // Animasi Keluar Halaman Menuju Dashboard Internal
  const performPortalExit = (destination) => {
    const tl = gsap.timeline({
      onComplete: () => navigate(destination),
    });

    tl.to('.right-inner-wrap', {
      y: -20,
      opacity: 0,
      duration: 0.4,
      ease: 'power3.in',
    })
      .to(
        '.login-left-pane',
        { clipPath: 'inset(0 100% 0 0)', duration: 0.85, ease: 'expo.inOut' },
        '-=0.15'
      )
      .to(
        '.login-right-pane',
        { opacity: 0, duration: 0.6, ease: 'power2.inOut' },
        '<'
      );
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: '#ffffff',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        position: 'relative',
      }}
    >
      <style>{`
        .corp-field-wrap {
          position: relative;
          border-bottom: 1.5px solid #e4e4e7;
          transition: border-color 0.3s ease;
        }
        .corp-field-line {
          position: absolute;
          bottom: -1.5px;
          left: 0;
          right: 0;
          height: 2px;
          background: #111111;
          transform-origin: left center;
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .corp-input {
          width: 100%;
          padding: 0.8rem 0;
          background: transparent;
          border: none;
          font-size: 1.05rem;
          font-weight: 500;
          color: #111111;
          outline: none;
          border-radius: 0;
        }
        .corp-input::placeholder {
          color: #a1a1aa;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
          -webkit-text-fill-color: #111111 !important;
        }
        .gate-option-card {
          width: 100%;
          text-align: left;
          padding: 1.45rem 1.6rem;
          border-radius: 14px;
          border: 1.5px solid #e4e4e7;
          background: #ffffff;
          color: #111111;
          cursor: pointer;
          transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.25rem;
        }
        .gate-option-card:hover {
          background: #111111;
          color: #ffffff;
          border-color: #111111;
          transform: translateY(-3px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
        }
        .mobile-back-link {
          display: none;
        }
        @media (max-width: 1024px) {
          .login-left-pane {
            display: none !important;
          }
          .mobile-back-link {
            display: inline-flex !important;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════
          PANEL KIRI: CLEAR ARCHITECTURAL PHOTOGRAPHY & CRYSTAL GLASS HUD
         ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="login-left-pane"
        style={{
          flex: 1.18,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'clamp(2.25rem, 3.8vw, 3.5rem)',
          color: '#ffffff',
          background: '#0f172a',
        }}
      >
        {/* 1. FOTO GEDUNG ITPLN JERNIH & TERANG */}
        <div
          ref={bgPhotoRef}
          style={{
            position: 'absolute',
            inset: '-8%',
            backgroundImage: 'url(/pln_view.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 28%',
            filter: 'contrast(1.04) brightness(1.03)',
            willChange: 'transform',
            zIndex: 0,
          }}
        />

        {/* 2. GRADASI HALUS PELINDUNG TEKS */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(8, 12, 22, 0.38) 0%, rgba(8, 12, 22, 0.02) 28%, rgba(8, 12, 22, 0.25) 55%, rgba(6, 10, 18, 0.9) 100%)',
            zIndex: 1,
          }}
        />

        {/* Bar Atas: Hanya Tombol Beranda Publik (Kanan Atas Bersih Tanpa Badge AI) */}
        <div
          style={{
            position: 'relative',
            zIndex: 5,
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}
        >
          <Link
            to="/"
            className="stagger-left"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '0.76rem',
              fontWeight: 700,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              padding: '0.5rem 1rem',
              borderRadius: '99px',
              background: 'rgba(10, 14, 24, 0.45)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              transition: 'background 0.25s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(10, 14, 24, 0.7)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(10, 14, 24, 0.45)')}
          >
            <ArrowLeft size={14} /> Beranda Publik
          </Link>
        </div>

        {/* Konten Bawah: Tipografi Editorial & Crystal Glass Topology HUD */}
        <div style={{ position: 'relative', zIndex: 5, maxWidth: '560px' }}>
          <div
            className="stagger-left"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.38rem 0.95rem',
              borderRadius: '99px',
              background: 'rgba(255, 255, 255, 0.14)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '1.4px',
              textTransform: 'uppercase',
              marginBottom: '1.15rem',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff' }} />
            Institut Teknologi PLN • SSO Architecture
          </div>

          <h2
            className="stagger-left"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(2.2rem, 3.5vw, 3.25rem)',
              fontWeight: 800,
              letterSpacing: '-1.8px',
              lineHeight: 1.08,
              margin: '0 0 0.75rem',
              color: '#ffffff',
              textShadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
            }}
          >
            Satu gerbang,
            <br />
            tiga otoritas presisi.
          </h2>

          <p
            className="stagger-left"
            style={{
              fontSize: '0.92rem',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: 1.6,
              margin: '0 0 1.5rem',
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.35)',
            }}
          >
            Sistem secara otomatis memisahkan ruang kerja antara 8 IKU Kementerian dan KPI Operasional
            ITPLN berdasarkan profil kredensial yang masuk.
          </p>

          {/* CRYSTAL GLASS TELEMETRY HUD */}
          <div
            ref={hudCardRef}
            className="stagger-left"
            style={{
              border: '1px solid rgba(255, 255, 255, 0.26)',
              borderRadius: '18px',
              padding: '1.25rem 1.4rem',
              background: 'rgba(10, 15, 28, 0.58)',
              backdropFilter: 'blur(20px) saturate(140%)',
              WebkitBackdropFilter: 'blur(20px) saturate(140%)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.28)',
              position: 'relative',
              overflow: 'hidden',
              willChange: 'transform',
            }}
          >
            {/* Bar Progress Skenario di Puncak Kartu HUD */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2.5px',
                background: 'rgba(255, 255, 255, 0.12)',
              }}
            >
              <div
                ref={scrollProgressRef}
                style={{
                  width: '100%',
                  height: '100%',
                  background: '#ffffff',
                  transformOrigin: 'left center',
                }}
              />
            </div>

            <div
              className="morph-text-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.64rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  Profil Otoritas Aktif ({selectedIdx + 1}/3)
                </div>
                <div
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    marginTop: '2px',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {activeAccount.code} — {activeAccount.roleTitle}
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  padding: '0.28rem 0.7rem',
                  borderRadius: '99px',
                  background: '#ffffff',
                  color: '#111111',
                }}
              >
                {activeAccount.badge}
              </span>
            </div>

            {/* Sirkuit SVG Penghubung SSO -> Modul IKU & KPI */}
            <svg
              viewBox="0 0 440 36"
              fill="none"
              style={{ width: '100%', height: '32px', display: 'block', marginBottom: '0.35rem' }}
            >
              <path
                ref={svgLineIkuRef}
                d="M 220 4 C 220 20, 110 14, 110 34"
                stroke="#ffffff"
                strokeWidth="2"
                strokeDasharray={isIkuActive ? 'none' : '4 5'}
              />
              {isIkuActive && (
                <path
                  className="hud-svg-pulse"
                  d="M 220 4 C 220 20, 110 14, 110 34"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeDasharray="12 168"
                />
              )}

              <path
                ref={svgLineKpiRef}
                d="M 220 4 C 220 20, 330 14, 330 34"
                stroke="#ffffff"
                strokeWidth="2"
                strokeDasharray={isKpiActive ? 'none' : '4 5'}
              />
              {isKpiActive && (
                <path
                  className="hud-svg-pulse"
                  d="M 220 4 C 220 20, 330 14, 330 34"
                  stroke="#ffffff"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeDasharray="12 168"
                />
              )}

              <circle cx="220" cy="5" r="4" fill="#ffffff" />
            </svg>

            {/* 2 Kotak Status Modul (IKU & KPI) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  background: isIkuActive ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                  border: isIkuActive
                    ? '1px solid rgba(255, 255, 255, 0.45)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  opacity: isIkuActive ? 1 : 0.42,
                  transform: isIkuActive ? 'scale(1)' : 'scale(0.98)',
                  transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Modul 8 IKU
                  </span>
                  {isIkuActive ? <Check size={14} /> : <Lock size={13} />}
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
                  {isIkuActive ? 'Akses Terbuka' : 'Terkunci Otomatis'}
                </div>
              </div>

              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  background: isKpiActive ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.03)',
                  border: isKpiActive
                    ? '1px solid rgba(255, 255, 255, 0.45)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  opacity: isKpiActive ? 1 : 0.42,
                  transform: isKpiActive ? 'scale(1)' : 'scale(0.98)',
                  transition: 'all 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Modul KPI Unit
                  </span>
                  {isKpiActive ? <Check size={14} /> : <Lock size={13} />}
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}>
                  {isKpiActive ? 'Akses Terbuka' : 'Terkunci Otomatis'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PANEL KANAN: SWISS CORPORATE FORM & WORKSPACE SELECTION GATE
         ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="login-right-pane"
        style={{
          flex: 1,
          background: '#ffffff',
          color: '#111111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(2rem, 4vw, 3.5rem) clamp(1.5rem, 4vw, 3rem)',
          position: 'relative',
          overflowY: 'auto',
        }}
      >
        <Link
          to="/"
          className="mobile-back-link"
          style={{
            position: 'absolute',
            top: '1.5rem',
            left: '1.5rem',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#111111',
            textDecoration: 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}
        >
          <ArrowLeft size={15} /> Beranda
        </Link>

        <div className="right-inner-wrap" style={{ width: '100%', maxWidth: '450px' }}>
          {/* Identitas Logo ITPLN */}
          <div
            className="stagger-right"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '2.1rem',
            }}
          >
            <img src="/logo_pln.png" alt="ITPLN" style={{ height: '40px' }} />
            <div style={{ height: '28px', width: '1px', background: '#e4e4e7' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    letterSpacing: '-0.5px',
                    color: '#111111',
                  }}
                >
                  PERFORMA ITPLN
                </span>
                <span
                  style={{
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#f4f4f5',
                    color: '#111111',
                    letterSpacing: '0.5px',
                  }}
                >
                  SSO
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: '#71717a',
                  marginTop: '2px',
                }}
              >
                Institut Teknologi Perusahaan Listrik Negara
              </div>
            </div>
          </div>

          {/* ──── TAHAP 1: FORM AUTENTIKASI & PEMILIH 3 SKENARIO ──── */}
          {step === 'credentials' && (
            <div ref={formStageRef}>
              <h1
                className="stagger-right"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 'clamp(1.95rem, 3vw, 2.4rem)',
                  fontWeight: 800,
                  color: '#111111',
                  letterSpacing: '-1.5px',
                  margin: '0 0 0.35rem',
                  lineHeight: 1.1,
                }}
              >
                Autentikasi Portal.
              </h1>
              <p
                className="stagger-right"
                style={{
                  color: '#71717a',
                  fontSize: '0.9rem',
                  margin: '0 0 1.65rem',
                  lineHeight: 1.5,
                }}
              >
                Pilih profil otoritas pengujian atau masukkan kredensial institusi Anda:
              </p>

              {/* SLIDING PILL SELECTOR: 3 KONDISI LOGIN */}
              <div className="stagger-right" style={{ marginBottom: '1.65rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      color: '#71717a',
                    }}
                  >
                    Skenario Pengujian Lokal
                  </span>
                  <span
                    className="morph-text-item"
                    style={{ fontSize: '0.72rem', fontWeight: 700, color: '#111111' }}
                  >
                    {activeAccount.email}
                  </span>
                </div>

                {/* Track 3 Pilihan */}
                <div
                  style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    background: '#f4f4f5',
                    padding: '4px',
                    borderRadius: '12px',
                    border: '1px solid #e4e4e7',
                  }}
                >
                  <div
                    ref={pillIndicatorRef}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      bottom: '4px',
                      left: '4px',
                      width: 'calc((100% - 8px) / 3)',
                      background: '#111111',
                      borderRadius: '9px',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.14)',
                      zIndex: 1,
                    }}
                  />

                  {[
                    { label: '01. Hanya IKU', sub: 'IKU Only' },
                    { label: '02. Hanya KPI', sub: 'KPI Only' },
                    { label: '03. Keduanya', sub: 'Pilih Menu' },
                  ].map((tab, idx) => {
                    const isSelected = selectedIdx === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectScenario(idx)}
                        style={{
                          position: 'relative',
                          zIndex: 2,
                          background: 'transparent',
                          border: 'none',
                          padding: '0.65rem 0.4rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          color: isSelected ? '#ffffff' : '#52525b',
                          transition: 'color 0.3s ease',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '0.8rem',
                            fontWeight: 800,
                            letterSpacing: '-0.2px',
                          }}
                        >
                          {tab.label}
                        </div>
                        <div
                          style={{
                            fontSize: '0.64rem',
                            opacity: isSelected ? 0.82 : 0.65,
                            marginTop: '1px',
                          }}
                        >
                          {tab.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Kotak Penjelasan Otoritas Aktif */}
                <div
                  className="morph-text-item"
                  style={{
                    marginTop: '0.65rem',
                    padding: '0.75rem 1rem',
                    background: '#fafafa',
                    border: '1px solid #e4e4e7',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    color: '#52525b',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: '#111111' }}>{activeAccount.roleTitle}:</strong>{' '}
                  {activeAccount.description}
                </div>
              </div>

              {errorMessage && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.8rem 1rem',
                    borderRadius: '10px',
                    background: '#fafafa',
                    border: '1px solid #111111',
                    color: '#111111',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginBottom: '1.2rem',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form Input Kredensial */}
              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
                <div className="stagger-right">
                  <label
                    htmlFor="email-input"
                    style={{
                      display: 'block',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      color: focusedField === 'email' ? '#111111' : '#71717a',
                      transition: 'color 0.25s ease',
                    }}
                  >
                    Email Institusi
                  </label>
                  <div className="corp-field-wrap">
                    <input
                      id="email-input"
                      type="email"
                      required
                      className="corp-input"
                      value={email}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        const foundIdx = mockAccounts.findIndex(
                          (a) => a.email.toLowerCase() === e.target.value.trim().toLowerCase()
                        );
                        if (foundIdx !== -1) setSelectedIdx(foundIdx);
                      }}
                      placeholder="nama@itpln.ac.id"
                    />
                    <div
                      className="corp-field-line"
                      style={{ transform: focusedField === 'email' ? 'scaleX(1)' : 'scaleX(0)' }}
                    />
                  </div>
                </div>

                <div className="stagger-right">
                  <label
                    htmlFor="pass-input"
                    style={{
                      display: 'block',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      color: focusedField === 'password' ? '#111111' : '#71717a',
                      transition: 'color 0.25s ease',
                    }}
                  >
                    Kata Sandi
                  </label>
                  <div className="corp-field-wrap">
                    <input
                      id="pass-input"
                      type="password"
                      required
                      className="corp-input"
                      value={password}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ letterSpacing: '2px' }}
                    />
                    <div
                      className="corp-field-line"
                      style={{ transform: focusedField === 'password' ? 'scaleX(1)' : 'scaleX(0)' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="stagger-right submit-corp-btn"
                  style={{
                    marginTop: '0.6rem',
                    padding: '1.1rem 1.5rem',
                    background: '#111111',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                    cursor: loading ? 'wait' : 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <span className="morph-text-item">
                    {loading
                      ? 'Memverifikasi Otoritas...'
                      : selectedIdx === 2
                        ? 'Verifikasi & Pilih Ruang Kerja'
                        : `Masuk ke Ruang Kerja ${selectedIdx === 0 ? 'IKU' : 'KPI'}`}
                  </span>
                  {!loading && <ArrowRight size={17} />}
                </button>
              </form>
            </div>
          )}

          {/* ──── TAHAP 2 (KHUSUS KONDISI 3): GERBANG PEMILIHAN MENU IKU ATAU KPI ──── */}
          {step === 'workspace_gate' && (
            <div ref={gateStageRef}>
              <div
                className="gate-stagger"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '99px',
                  background: '#f4f4f5',
                  color: '#111111',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '1rem',
                }}
              >
                <ShieldCheck size={14} /> Otoritas Ganda Terverifikasi
              </div>

              <h2
                className="gate-stagger"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 'clamp(1.85rem, 2.8vw, 2.25rem)',
                  fontWeight: 800,
                  color: '#111111',
                  letterSpacing: '-1.5px',
                  margin: '0 0 0.5rem',
                  lineHeight: 1.12,
                }}
              >
                Pilih Ruang Kerja Tujuan.
              </h2>

              <p
                className="gate-stagger"
                style={{
                  fontSize: '0.9rem',
                  color: '#71717a',
                  lineHeight: 1.6,
                  margin: '0 0 1.65rem',
                }}
              >
                Akun <strong style={{ color: '#111111' }}>{pendingDualUser?.email}</strong> memiliki
                hak akses penuh ke kedua modul. Pilih menu yang ingin Anda buka:
              </p>

              {/* 2 Pilihan Eksklusif: Menu IKU vs Menu KPI */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem', marginBottom: '1.65rem' }}>
                <button
                  type="button"
                  className="gate-stagger gate-option-card"
                  onMouseEnter={() => setHoveredGate('iku')}
                  onMouseLeave={() => setHoveredGate(null)}
                  onClick={() => handleChooseDualPortal('iku')}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          letterSpacing: '1px',
                          opacity: 0.6,
                        }}
                      >
                        01
                      </span>
                      <span
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: '1.18rem',
                          fontWeight: 800,
                          letterSpacing: '-0.5px',
                        }}
                      >
                        Masuk Menu IKU
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '99px',
                          background: hoveredGate === 'iku' ? 'rgba(255,255,255,0.16)' : '#f4f4f5',
                          color: hoveredGate === 'iku' ? '#ffffff' : '#52525b',
                        }}
                      >
                        8 IKU KEMENTERIAN
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        opacity: hoveredGate === 'iku' ? 0.85 : 0.65,
                        lineHeight: 1.5,
                      }}
                    >
                      Kelola dan pantau capaian 8 Indikator Kinerja Utama standar Kemendikbudristek.
                    </p>
                  </div>

                  <ArrowUpRight size={22} style={{ flexShrink: 0 }} />
                </button>

                <button
                  type="button"
                  className="gate-stagger gate-option-card"
                  onMouseEnter={() => setHoveredGate('kpi')}
                  onMouseLeave={() => setHoveredGate(null)}
                  onClick={() => handleChooseDualPortal('kpi')}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          letterSpacing: '1px',
                          opacity: 0.6,
                        }}
                      >
                        02
                      </span>
                      <span
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: '1.18rem',
                          fontWeight: 800,
                          letterSpacing: '-0.5px',
                        }}
                      >
                        Masuk Menu KPI
                      </span>
                      <span
                        style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '99px',
                          background: hoveredGate === 'kpi' ? 'rgba(255,255,255,0.16)' : '#f4f4f5',
                          color: hoveredGate === 'kpi' ? '#ffffff' : '#52525b',
                        }}
                      >
                        OPERASIONAL ITPLN
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        opacity: hoveredGate === 'kpi' ? 0.85 : 0.65,
                        lineHeight: 1.5,
                      }}
                    >
                      Kelola target Key Performance Indicator internal Fakultas, Prodi, dan Unit Kerja.
                    </p>
                  </div>

                  <ArrowUpRight size={22} style={{ flexShrink: 0 }} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleBackToCredentials}
                className="gate-stagger"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  padding: '0.4rem 0',
                  color: '#71717a',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} /> Kembali & ganti akun pengujian
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}