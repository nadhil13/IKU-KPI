import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Lock,
  ShieldCheck,
  Check,
  AlertCircle,
  RotateCcw,
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

  // State Pemilihan Ruang Kerja (khusus akun peran ganda 'dual')
  const [step, setStep] = useState('credentials'); // 'credentials' | 'workspace_gate'
  const [pendingDualUser, setPendingDualUser] = useState(null);
  const [hoveredGate, setHoveredGate] = useState(null);

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

  // 1. Desktop Wheel Scenario Switcher (dinonaktifkan di mobile/input/reduced-motion)
  useEffect(() => {
    const handleWheel = (e) => {
      if (step !== 'credentials' || loading) return;
      if (window.innerWidth <= 1024) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (Math.abs(e.deltaY) < 22) return;
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

  // 2. Master Entrance & Mouse Parallax Rig (tanpa infinite loop)
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tl = gsap.timeline();

    tl.fromTo(
      '.login-left-pane',
      { clipPath: 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0)', duration: 1.15, ease: 'expo.inOut' }
    )
      .fromTo(
        bgPhotoRef.current,
        { scale: 1.18, filter: 'blur(6px) brightness(0.88)' },
        { scale: 1.11, filter: 'blur(0px) brightness(1.02)', duration: 1.45, ease: 'expo.out' },
        '-=0.8'
      )
      .fromTo(
        '.stagger-left',
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, stagger: 0.07, ease: 'expo.out' },
        '-=1.05'
      )
      .fromTo(
        '.stagger-right',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, stagger: 0.05, ease: 'expo.out' },
        '-=0.95'
      );

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      return undefined;
    }

    const xBgTo = gsap.quickTo(bgPhotoRef.current, 'x', { duration: 1.1, ease: 'power3.out' });
    const yBgTo = gsap.quickTo(bgPhotoRef.current, 'y', { duration: 1.1, ease: 'power3.out' });
    const xHudTo = gsap.quickTo(hudCardRef.current, 'x', { duration: 0.8, ease: 'power3.out' });
    const yHudTo = gsap.quickTo(hudCardRef.current, 'y', { duration: 0.8, ease: 'power3.out' });

    const handleMouseMove = (e) => {
      const normX = e.clientX / window.innerWidth - 0.5;
      const normY = e.clientY / window.innerHeight - 0.5;
      xBgTo(normX * -18);
      yBgTo(normY * -12);
      xHudTo(normX * 8);
      yHudTo(normY * 6);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, { scope: containerRef });

  // 3. Choreographed GSAP Transition saat Skenario Berubah
  useGSAP(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const preset = CAMERA_PRESETS[selectedIdx] || CAMERA_PRESETS[2];

    if (pillIndicatorRef.current) {
      gsap.to(pillIndicatorRef.current, {
        xPercent: selectedIdx * 100,
        duration: reduced ? 0 : 0.5,
        ease: 'expo.out',
      });
    }

    if (scrollProgressRef.current) {
      gsap.to(scrollProgressRef.current, {
        scaleX: (selectedIdx + 1) / mockAccounts.length,
        duration: reduced ? 0 : 0.5,
        ease: 'expo.out',
      });
    }

    if (reduced) return undefined;

    if (bgPhotoRef.current) {
      gsap.to(bgPhotoRef.current, {
        scale: preset.scale,
        xPercent: preset.xPercent,
        yPercent: preset.yPercent,
        duration: 1.1,
        ease: 'expo.out',
        overwrite: 'auto',
      });
    }

    gsap.fromTo(
      '.morph-text-item',
      { y: 6, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, stagger: 0.03, ease: 'expo.out', overwrite: 'auto' }
    );

    if (svgLineIkuRef.current) {
      gsap.to(svgLineIkuRef.current, {
        opacity: isIkuActive ? 1 : 0.25,
        strokeWidth: isIkuActive ? 2.2 : 1.2,
        duration: 0.45,
        ease: 'expo.out',
      });
    }
    if (svgLineKpiRef.current) {
      gsap.to(svgLineKpiRef.current, {
        opacity: isKpiActive ? 1 : 0.25,
        strokeWidth: isKpiActive ? 2.2 : 1.2,
        duration: 0.45,
        ease: 'expo.out',
      });
    }
  }, { dependencies: [selectedIdx, isIkuActive, isKpiActive], scope: containerRef });

  // Submit Form Login
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.to('.submit-corp-btn', { scale: 0.985, duration: 0.1, yoyo: true, repeat: 1 });
    }

    setTimeout(() => {
      const result = login(email, password);

      if (!result.success) {
        setLoading(false);
        setErrorMessage(result.message);
        return;
      }

      if (result.requiresWorkspaceChoice) {
        setLoading(false);
        setPendingDualUser(result.user);
        transitionToWorkspaceGate();
        return;
      }

      performPortalExit('/internal');
    }, 360);
  };

  // Transisi dari Form Kredensial menuju Gerbang Pilihan Menu (IKU vs KPI)
  const transitionToWorkspaceGate = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep('workspace_gate');
      return;
    }

    if (bgPhotoRef.current) {
      gsap.to(bgPhotoRef.current, {
        scale: 1.14,
        duration: 1.0,
        ease: 'expo.out',
      });
    }

    gsap.to(formStageRef.current, {
      y: -18,
      opacity: 0,
      duration: 0.35,
      ease: 'power3.inOut',
      onComplete: () => {
        setStep('workspace_gate');
        requestAnimationFrame(() => {
          gsap.fromTo(
            '.gate-stagger',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.65, stagger: 0.06, ease: 'expo.out' }
          );
        });
      },
    });
  };

  // Kembali ke Form Login dari Gerbang Pilihan
  const handleBackToCredentials = () => {
    setHoveredGate(null);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep('credentials');
      setPendingDualUser(null);
      return;
    }

    if (bgPhotoRef.current) {
      gsap.to(bgPhotoRef.current, {
        scale: CAMERA_PRESETS[selectedIdx].scale,
        duration: 0.9,
        ease: 'expo.out',
      });
    }

    gsap.to(gateStageRef.current, {
      y: 16,
      opacity: 0,
      duration: 0.3,
      ease: 'power3.in',
      onComplete: () => {
        setStep('credentials');
        setPendingDualUser(null);
        requestAnimationFrame(() => {
          gsap.fromTo(
            formStageRef.current,
            { y: -16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.55, ease: 'expo.out' }
          );
        });
      },
    });
  };

  // Eksekusi Pilihan Menu pada Akun Peran Ganda ('iku' atau 'kpi')
  const handleChooseDualPortal = (chosenMenu) => {
    if (!pendingDualUser) return;
    completeDualLogin(pendingDualUser, chosenMenu);
    performPortalExit('/internal');
  };

  // Animasi Keluar Halaman Menuju Dashboard Internal
  const performPortalExit = (destination) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate(destination);
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => navigate(destination),
    });

    tl.to('.right-inner-wrap', {
      y: -16,
      opacity: 0,
      duration: 0.32,
      ease: 'power3.in',
    })
      .to(
        '.login-left-pane',
        { clipPath: 'inset(0 100% 0 0)', duration: 0.7, ease: 'expo.inOut' },
        '-=0.12'
      )
      .to(
        '.login-right-pane',
        { opacity: 0, duration: 0.5, ease: 'power2.inOut' },
        '<'
      );
  };

  const submitLabel = loading
    ? 'Memverifikasi Otoritas...'
    : activeAccount.role === 'superadmin_prp'
      ? 'Masuk ke Pusat Kendali PRP'
      : activeAccount.role === 'dual'
        ? 'Verifikasi & Pilih Ruang Kerja'
        : `Masuk ke Ruang Kerja ${activeAccount.role === 'iku_only' ? 'IKU' : 'KPI'}`;

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        minHeight: '100dvh',
        width: '100%',
        overflowX: 'hidden',
        background: '#ffffff',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        position: 'relative',
      }}
    >
      <style>{`
        .corp-field-wrap {
          position: relative;
          border-bottom: 1.5px solid #D8E4EA;
          transition: border-color 0.25s ease;
        }
        .corp-field-line {
          position: absolute;
          bottom: -1.5px;
          left: 0;
          right: 0;
          height: 2px;
          background: #094E68;
          transform-origin: left center;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .corp-input {
          width: 100%;
          min-height: 46px;
          padding: 0.75rem 0.25rem;
          background: transparent;
          border: none;
          font-size: 1rem;
          font-weight: 500;
          color: #072534;
          border-radius: 4px;
        }
        .corp-input:focus {
          outline: none;
        }
        .corp-input:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: 2px;
        }
        .corp-input::placeholder {
          color: #64748b;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
          -webkit-text-fill-color: #072534 !important;
        }
        .login-back-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          min-height: 44px;
          color: #ffffff;
          text-decoration: none;
          font-size: 0.74rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0.55rem 1.05rem;
          border-radius: 8px;
          background: #062C3D;
          border: 1px solid rgba(197, 222, 232, 0.35);
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        .login-back-pill:hover {
          background: #094E68;
          border-color: #C5DEE8;
        }
        .submit-corp-btn {
          margin-top: 0.5rem;
          min-height: 48px;
          padding: 0.95rem 1.5rem;
          background: #094E68;
          color: #ffffff;
          border: 1px solid #094E68;
          border-radius: 10px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        .submit-corp-btn:hover:not(:disabled) {
          background: #072534;
          border-color: #072534;
        }
        .gate-option-card {
          width: 100%;
          text-align: left;
          padding: 1.35rem 1.5rem;
          border-radius: 12px;
          border: 1.5px solid #D8E4EA;
          background: #ffffff;
          color: #072534;
          cursor: pointer;
          transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.25rem;
        }
        @media (hover: hover) {
          .gate-option-card:hover {
            background: #094E68;
            color: #ffffff;
            border-color: #094E68;
            transform: translateY(-2px);
          }
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
          .login-right-pane {
            padding-top: 5rem !important;
            align-items: flex-start !important;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════
          PANEL KIRI: KAMPUS ITPLN & HUD TELEMETRI OTORITAS
         ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="login-left-pane"
        style={{
          flex: 1.16,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'clamp(2.25rem, 3.8vw, 3.5rem)',
          color: '#ffffff',
          background: '#062C3D',
        }}
      >
        {/* 1. FOTO GEDUNG ITPLN */}
        <div
          ref={bgPhotoRef}
          style={{
            position: 'absolute',
            inset: '-8%',
            backgroundImage: 'url(/pln_view.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 28%',
            filter: 'contrast(1.04) brightness(1.02)',
            willChange: 'transform',
            zIndex: 0,
          }}
        />

        {/* 2. GRADASI MIDNIGHT PETROL PELINDUNG KONTRAS TEKS */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(6, 44, 61, 0.56) 0%, rgba(6, 44, 61, 0.14) 30%, rgba(6, 44, 61, 0.52) 58%, rgba(6, 44, 61, 0.94) 100%)',
            zIndex: 1,
          }}
        />

        {/* Bar Atas: Navigasi Beranda Publik */}
        <div
          style={{
            position: 'relative',
            zIndex: 5,
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}
        >
          <Link to="/" className="stagger-left login-back-pill">
            <ArrowLeft size={15} /> Beranda Publik
          </Link>
        </div>

        {/* Konten Bawah: Identitas Sistem & Kartu Status Otoritas */}
        <div style={{ position: 'relative', zIndex: 5, maxWidth: '560px' }}>
          <div
            className="stagger-left"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.36rem 0.85rem',
              borderRadius: '6px',
              background: '#062C3D',
              border: '1px solid rgba(197, 222, 232, 0.35)',
              fontFamily: 'var(--ent-mono)',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#C5DEE8',
              marginBottom: '1.1rem',
            }}
          >
            Institut Teknologi PLN // Gerbang Sesi Internal
          </div>

          <h2
            className="stagger-left"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(2.15rem, 3.4vw, 3.1rem)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.08,
              margin: '0 0 0.75rem',
              color: '#ffffff',
            }}
          >
            Satu gerbang akses,
            <br />
            tiga ruang kerja terukur.
          </h2>

          <p
            className="stagger-left"
            style={{
              fontSize: '0.94rem',
              color: '#C5DEE8',
              lineHeight: 1.65,
              margin: '0 0 1.45rem',
            }}
          >
            Hak akses dipetakan berdasarkan peran unit kerja: pelaporan 8 IKU Kemendikbudristek, lembar kerja KPI operasional fakultas/unit, atau pusat tata kelola Direktorat PRP.
          </p>

          {/* SINGLE GLASS TELEMETRY CARD (Maks 1 elemen blur sesuai standar performa) */}
          <div
            ref={hudCardRef}
            className="stagger-left"
            style={{
              border: '1px solid rgba(197, 222, 232, 0.32)',
              borderRadius: '14px',
              padding: '1.25rem 1.35rem',
              background: 'rgba(6, 44, 61, 0.78)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 20px 40px rgba(4, 24, 34, 0.32)',
              position: 'relative',
              overflow: 'hidden',
              willChange: 'transform',
            }}
          >
            {/* Bar Progress Skenario di Puncak Kartu */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'rgba(255, 255, 255, 0.14)',
              }}
            >
              <div
                ref={scrollProgressRef}
                style={{
                  width: '100%',
                  height: '100%',
                  background: '#1B9AAA',
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
                gap: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.64rem',
                    color: '#94B8C7',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
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
                    marginTop: '3px',
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  {activeAccount.code} // {activeAccount.roleTitle}
                </div>
              </div>

              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  background: '#ffffff',
                  color: '#072534',
                  flexShrink: 0,
                }}
              >
                {activeAccount.badge}
              </span>
            </div>

            {/* Sirkuit SVG Penghubung Peran -> Modul IKU & KPI (Statis bersih tanpa loop tak berujung) */}
            <svg
              viewBox="0 0 440 36"
              fill="none"
              aria-hidden="true"
              style={{ width: '100%', height: '32px', display: 'block', marginBottom: '0.35rem' }}
            >
              <path
                ref={svgLineIkuRef}
                d="M 220 4 C 220 20, 110 14, 110 34"
                stroke={isIkuActive ? '#C5DEE8' : 'rgba(197, 222, 232, 0.35)'}
                strokeWidth="2"
                strokeDasharray={isIkuActive ? 'none' : '4 5'}
              />
              <path
                ref={svgLineKpiRef}
                d="M 220 4 C 220 20, 330 14, 330 34"
                stroke={isKpiActive ? '#C5DEE8' : 'rgba(197, 222, 232, 0.35)'}
                strokeWidth="2"
                strokeDasharray={isKpiActive ? 'none' : '4 5'}
              />
              <circle cx="220" cy="5" r="4" fill="#1B9AAA" />
            </svg>

            {/* 2 Kotak Status Modul (IKU & KPI) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: isIkuActive ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                  border: isIkuActive
                    ? '1px solid rgba(197, 222, 232, 0.55)'
                    : '1px solid rgba(197, 222, 232, 0.16)',
                  opacity: isIkuActive ? 1 : 0.65,
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.25rem',
                    color: '#C5DEE8',
                  }}
                >
                  <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Modul 8 IKU
                  </span>
                  {isIkuActive ? <Check size={14} /> : <Lock size={13} />}
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: '#ffffff' }}>
                  {isIkuActive ? 'Akses Diizinkan' : 'Tidak Termasuk Peran'}
                </div>
              </div>

              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: isKpiActive ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                  border: isKpiActive
                    ? '1px solid rgba(197, 222, 232, 0.55)'
                    : '1px solid rgba(197, 222, 232, 0.16)',
                  opacity: isKpiActive ? 1 : 0.65,
                  transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.25rem',
                    color: '#C5DEE8',
                  }}
                >
                  <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Modul KPI Unit
                  </span>
                  {isKpiActive ? <Check size={14} /> : <Lock size={13} />}
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: '#ffffff' }}>
                  {isKpiActive ? 'Akses Diizinkan' : 'Tidak Termasuk Peran'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PANEL KANAN: FORM AUTENTIKASI & GERBANG RUANG KERJA
         ═══════════════════════════════════════════════════════════════════ */}
      <div
        className="login-right-pane"
        style={{
          flex: 1,
          background: '#ffffff',
          color: '#072534',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(2rem, 4vw, 3.5rem) clamp(1.25rem, 4vw, 3rem)',
          position: 'relative',
          overflowY: 'auto',
        }}
      >
        <Link
          to="/"
          className="mobile-back-link"
          style={{
            position: 'absolute',
            top: '1rem',
            left: 'clamp(1.25rem, 4vw, 2rem)',
            minHeight: '44px',
            padding: '0.5rem 0.85rem',
            borderRadius: '8px',
            border: '1px solid #D8E4EA',
            background: '#F7FAFB',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#072534',
            textDecoration: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          <ArrowLeft size={15} /> Beranda
        </Link>

        <div className="right-inner-wrap" style={{ width: '100%', maxWidth: '456px' }}>
          {/* Identitas Logo ITPLN */}
          <div
            className="stagger-right"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.9rem',
              marginBottom: '2rem',
            }}
          >
            <img src="/logo_pln.png" alt="Logo Institut Teknologi PLN" style={{ height: '40px', width: 'auto' }} />
            <div style={{ height: '28px', width: '1px', background: '#D8E4EA' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: '#072534',
                  }}
                >
                  PERFORMA ITPLN
                </span>
                <span
                  style={{
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: '#EDF3F6',
                    border: '1px solid #D8E4EA',
                    color: '#094E68',
                    letterSpacing: '0.05em',
                  }}
                >
                  PORTAL INTERNAL
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#475569',
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
                  fontSize: 'clamp(1.9rem, 3vw, 2.35rem)',
                  fontWeight: 800,
                  color: '#072534',
                  letterSpacing: '-0.035em',
                  margin: '0 0 0.4rem',
                  lineHeight: 1.1,
                }}
              >
                Masuk Portal Kinerja.
              </h1>
              <p
                className="stagger-right"
                style={{
                  color: '#334155',
                  fontSize: '0.9rem',
                  margin: '0 0 1.55rem',
                  lineHeight: 1.55,
                }}
              >
                Pilih akun simulasi peran di bawah ini atau masukkan email kerja beserta kata sandi Anda.
              </p>

              {/* SLIDING PILL SELECTOR: 3 PERAN PENGUJIAN */}
              <div className="stagger-right" style={{ marginBottom: '1.6rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#475569',
                    }}
                  >
                    Profil Simulasi Lokal
                  </span>
                  <span
                    className="morph-text-item"
                    style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.72rem', fontWeight: 700, color: '#0E7480' }}
                  >
                    {activeAccount.email}
                  </span>
                </div>

                {/* Track 3 Pilihan */}
                <div
                  role="group"
                  aria-label="Pilih skenario akun simulasi"
                  style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    background: '#EDF3F6',
                    padding: '4px',
                    borderRadius: '10px',
                    border: '1px solid #D8E4EA',
                  }}
                >
                  <div
                    ref={pillIndicatorRef}
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '4px',
                      bottom: '4px',
                      left: '4px',
                      width: 'calc((100% - 8px) / 3)',
                      background: '#094E68',
                      borderRadius: '7px',
                      boxShadow: '0 4px 12px rgba(9, 78, 104, 0.2)',
                      zIndex: 1,
                    }}
                  />

                  {[
                    { label: '01. PIC IKU', sub: 'Khusus IKU' },
                    { label: '02. PIC KPI', sub: 'Khusus KPI' },
                    { label: '03. Admin PRP', sub: 'Pusat Kendali' },
                  ].map((tab, idx) => {
                    const isSelected = selectedIdx === idx;
                    return (
                      <button
                        key={tab.label}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectScenario(idx)}
                        style={{
                          position: 'relative',
                          zIndex: 2,
                          minHeight: '48px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '7px',
                          padding: '0.55rem 0.35rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          color: isSelected ? '#ffffff' : '#334155',
                          transition: 'color 0.25s ease',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {tab.label}
                        </div>
                        <div
                          style={{
                            fontSize: '0.64rem',
                            color: isSelected ? '#C5DEE8' : '#475569',
                            marginTop: '1px',
                            fontWeight: 600,
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
                    padding: '0.75rem 0.95rem',
                    background: '#F7FAFB',
                    border: '1px solid #D8E4EA',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: '#334155',
                    lineHeight: 1.52,
                  }}
                >
                  <strong style={{ color: '#072534' }}>{activeAccount.roleTitle}:</strong>{' '}
                  {activeAccount.description}
                </div>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    padding: '0.8rem 1rem',
                    borderRadius: '8px',
                    background: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: '1.2rem',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form Input Kredensial */}
              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.3rem' }}>
                <div className="stagger-right">
                  <label
                    htmlFor="email-input"
                    style={{
                      display: 'block',
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: focusedField === 'email' ? '#094E68' : '#475569',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    Email Institusi
                  </label>
                  <div className="corp-field-wrap">
                    <input
                      id="email-input"
                      type="email"
                      autoComplete="username"
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
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: focusedField === 'password' ? '#094E68' : '#475569',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    Kata Sandi
                  </label>
                  <div className="corp-field-wrap">
                    <input
                      id="pass-input"
                      type="password"
                      autoComplete="current-password"
                      required
                      className="corp-input"
                      value={password}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      style={{ letterSpacing: '1.5px' }}
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
                  style={{ cursor: loading ? 'wait' : 'pointer' }}
                >
                  <span className="morph-text-item">{submitLabel}</span>
                  {!loading && <ArrowRight size={17} />}
                </button>
              </form>
            </div>
          )}

          {/* ──── TAHAP 2 (KHUSUS AKUN PERAN GANDA 'dual'): GERBANG PEMILIHAN RUANG KERJA ──── */}
          {step === 'workspace_gate' && (
            <div ref={gateStageRef}>
              <div
                className="gate-stagger"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  background: '#EDF3F6',
                  border: '1px solid #D8E4EA',
                  color: '#094E68',
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
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
                  fontSize: 'clamp(1.8rem, 2.8vw, 2.2rem)',
                  fontWeight: 800,
                  color: '#072534',
                  letterSpacing: '-0.035em',
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
                  color: '#334155',
                  lineHeight: 1.6,
                  margin: '0 0 1.55rem',
                }}
              >
                Akun <strong style={{ color: '#072534' }}>{pendingDualUser?.email}</strong> memiliki
                hak akses ke kedua modul. Pilih ruang kerja yang ingin Anda buka terlebih dahulu:
              </p>

              {/* 2 Pilihan Eksklusif: Menu IKU vs Menu KPI */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.5rem' }}>
                <button
                  type="button"
                  className="gate-stagger gate-option-card"
                  onMouseEnter={() => setHoveredGate('iku')}
                  onMouseLeave={() => setHoveredGate(null)}
                  onClick={() => handleChooseDualPortal('iku')}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: hoveredGate === 'iku' ? '#C5DEE8' : '#0E7480',
                        }}
                      >
                        01
                      </span>
                      <span
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: '1.15rem',
                          fontWeight: 800,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        Masuk Ruang Kerja IKU
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: hoveredGate === 'iku' ? 'rgba(255,255,255,0.16)' : '#EDF3F6',
                          color: hoveredGate === 'iku' ? '#ffffff' : '#094E68',
                        }}
                      >
                        8 IKU KEMENTERIAN
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.84rem',
                        color: hoveredGate === 'iku' ? '#C5DEE8' : '#334155',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: hoveredGate === 'kpi' ? '#C5DEE8' : '#0E7480',
                        }}
                      >
                        02
                      </span>
                      <span
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: '1.15rem',
                          fontWeight: 800,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        Masuk Ruang Kerja KPI
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: hoveredGate === 'kpi' ? 'rgba(255,255,255,0.16)' : '#EDF3F6',
                          color: hoveredGate === 'kpi' ? '#ffffff' : '#094E68',
                        }}
                      >
                        OPERASIONAL ITPLN
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.84rem',
                        color: hoveredGate === 'kpi' ? '#C5DEE8' : '#334155',
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
                  minHeight: '44px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.45rem 0.5rem',
                  color: '#475569',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={15} /> Kembali &amp; ganti akun pengujian
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
