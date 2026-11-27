import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Layers,
  Lock,
  LogIn,
  ShieldCheck,
  Check,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { readMergedUsers } from '../authAccounts';
import { useAuth } from '../hooks/useAuth';
import { requestOsNotificationPermission } from '../../../lib/pwaNotifications';

export default function Login() {
  const navigate = useNavigate();
  const { login, authenticate, completeDualLogin, mockAccounts } = useAuth();

  const [usersRevision, setUsersRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setUsersRevision((n) => n + 1);
    window.addEventListener('prp-admin-updated', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('performa:state-updated', refresh);
    return () => {
      window.removeEventListener('prp-admin-updated', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('performa:state-updated', refresh);
    };
  }, []);

  const unitAccounts = useMemo(() => {
    void usersRevision;
    return readMergedUsers().filter((acc) => acc.status !== 'Nonaktif');
  }, [usersRevision]);

  const defaultAccount = useMemo(
    () =>
      unitAccounts.find((acc) => acc.email.toLowerCase() === 'admin@itpln.ac.id')
      || unitAccounts[0]
      || mockAccounts[0],
    [unitAccounts, mockAccounts],
  );

  const [email, setEmail] = useState(() => defaultAccount?.email || 'admin@itpln.ac.id');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const [step, setStep] = useState('credentials');
  const [pendingDualUser, setPendingDualUser] = useState(null);
  const [hoveredGate, setHoveredGate] = useState(null);

  const containerRef = useRef(null);
  const bgPhotoRef = useRef(null);
  const hudCardRef = useRef(null);
  const formStageRef = useRef(null);
  const gateStageRef = useRef(null);
  const svgLineIkuRef = useRef(null);
  const svgLineKpiRef = useRef(null);

  const matchedByEmail = unitAccounts.find(
    (acc) => acc.email.toLowerCase() === email.trim().toLowerCase(),
  );
  const activeAccount = matchedByEmail || defaultAccount;

  const isIkuActive =
    step === 'workspace_gate' && hoveredGate
      ? hoveredGate === 'iku'
      : activeAccount.role === 'iku_only'
        || activeAccount.role === 'spi'
        || ['dual', 'superadmin_prp'].includes(activeAccount.role);

  const isKpiActive =
    step === 'workspace_gate' && hoveredGate
      ? hoveredGate === 'kpi'
      : activeAccount.role === 'kpi_only'
        || activeAccount.role === 'spi'
        || ['dual', 'superadmin_prp'].includes(activeAccount.role);

  const handleSelectUnitWorkAccount = (targetEmail) => {
    const found = unitAccounts.find((acc) => acc.email.toLowerCase() === targetEmail.toLowerCase());
    if (!found) return;
    setEmail(found.email);
    setPassword('');
    setErrorMessage('');
  };

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return undefined;
      }

      const tl = gsap.timeline();
      tl.fromTo(
        '.login-left-pane',
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'expo.inOut' },
      )
        .fromTo(
          bgPhotoRef.current,
          { scale: 1.12, filter: 'brightness(0.9)' },
          { scale: 1.05, filter: 'brightness(1.0)', duration: 1.1, ease: 'expo.out' },
          '-=0.65',
        )
        .fromTo(
          '.stagger-left',
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.65, stagger: 0.06, ease: 'expo.out' },
          '-=0.8',
        )
        .fromTo(
          '.stagger-right',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.65, stagger: 0.05, ease: 'expo.out' },
          '-=0.7',
        );
    },
    { scope: containerRef },
  );

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

      gsap.fromTo(
        '.morph-text-item',
        { y: 5, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.03, ease: 'expo.out', overwrite: 'auto' },
      );

      if (svgLineIkuRef.current) {
        gsap.to(svgLineIkuRef.current, {
          opacity: isIkuActive ? 1 : 0.25,
          strokeWidth: isIkuActive ? 2.2 : 1.2,
          duration: 0.35,
          ease: 'expo.out',
        });
      }
      if (svgLineKpiRef.current) {
        gsap.to(svgLineKpiRef.current, {
          opacity: isKpiActive ? 1 : 0.25,
          strokeWidth: isKpiActive ? 2.2 : 1.2,
          duration: 0.35,
          ease: 'expo.out',
        });
      }
    },
    { dependencies: [activeAccount.email, isIkuActive, isKpiActive], scope: containerRef },
  );

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);
    requestOsNotificationPermission().catch(() => undefined);

    setTimeout(async () => {
      try {
        const result =
          typeof authenticate === 'function'
            ? await authenticate(email, password)
            : login(email, password);

        if (!result?.success) {
          setLoading(false);
          setErrorMessage(
            result?.message || 'Gagal melakukan autentikasi. Periksa kembali kredensial Unit Kerja Anda.',
          );
          return;
        }

        if (result.requiresWorkspaceChoice) {
          setLoading(false);
          setPendingDualUser(result.user);
          transitionToWorkspaceGate();
          return;
        }

        performPortalExit('/internal');
      } catch (err) {
        setLoading(false);
        setErrorMessage(err?.message || 'Terjadi gangguan jaringan saat menghubungi server autentikasi.');
      }
    }, 280);
  };

  const transitionToWorkspaceGate = () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep('workspace_gate');
      return;
    }

    gsap.to(formStageRef.current, {
      y: -14,
      opacity: 0,
      duration: 0.28,
      ease: 'power3.inOut',
      onComplete: () => {
        setStep('workspace_gate');
        requestAnimationFrame(() => {
          gsap.fromTo(
            '.gate-stagger',
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'expo.out' },
          );
        });
      },
    });
  };

  const handleBackToCredentials = () => {
    setHoveredGate(null);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep('credentials');
      setPendingDualUser(null);
      return;
    }

    gsap.to(gateStageRef.current, {
      y: 14,
      opacity: 0,
      duration: 0.25,
      ease: 'power3.in',
      onComplete: () => {
        setStep('credentials');
        setPendingDualUser(null);
        requestAnimationFrame(() => {
          gsap.fromTo(
            formStageRef.current,
            { y: -14, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.45, ease: 'expo.out' },
          );
        });
      },
    });
  };

  const handleChooseDualPortal = (chosenMenu) => {
    if (!pendingDualUser) return;
    completeDualLogin(pendingDualUser, chosenMenu);
    performPortalExit('/internal');
  };

  const performPortalExit = (destination) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate(destination);
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => navigate(destination),
    });

    tl.to('.right-inner-wrap', {
      y: -12,
      opacity: 0,
      duration: 0.25,
      ease: 'power3.in',
    }).to(
      '.login-right-pane',
      { opacity: 0, duration: 0.35, ease: 'power2.inOut' },
      '<',
    );
  };

  const submitLabel = loading
    ? 'Memverifikasi Kredensial Unit...'
    : activeAccount.role === 'superadmin_prp'
      ? 'Masuk Dashboard Eksekutif & PRP'
      : activeAccount.role === 'spi'
        ? 'Masuk Ruang Verifikasi SPI'
        : activeAccount.role === 'dual'
          ? `Masuk Unit ${activeAccount.unit || activeAccount.name}`
          : `Masuk Portal Unit (${activeAccount.unit || activeAccount.name})`;

  const formatUnitOptionLabel = (acc) => {
    const unitLabel = acc.unit || acc.name;
    if (acc.role === 'superadmin_prp') return `${unitLabel} - Pusat Kendali & Eksekutif`;
    if (acc.role === 'spi') return `${unitLabel} - Verifikasi SPI (Read-Only)`;
    return `${unitLabel} (${acc.email})`;
  };

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
          border-bottom: 1.5px solid #64748B;
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
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
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
          color: #475569;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
          -webkit-text-fill-color: #072534 !important;
        }
        a.login-back-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          min-height: 44px;
          color: #ffffff !important;
          text-decoration: none;
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 0.55rem 1.1rem;
          border-radius: 6px;
          background: #062C3D;
          border: 1.5px solid rgba(197, 222, 232, 0.55);
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        a.login-back-pill:hover,
        a.login-back-pill:focus-visible,
        a.login-back-pill:active,
        a.login-back-pill * {
          color: #ffffff !important;
        }
        a.login-back-pill:hover {
          background: #094E68;
          border-color: #ffffff;
        }
        .submit-corp-btn {
          margin-top: 0.5rem;
          min-height: 48px;
          padding: 0.9rem 1.5rem;
          background: #094E68;
          color: #ffffff !important;
          border: 1px solid #094E68;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        .submit-corp-btn:hover:not(:disabled) {
          background: #072534;
          border-color: #072534;
          color: #ffffff !important;
        }
        .gate-option-card {
          width: 100%;
          text-align: left;
          padding: 1.3rem 1.45rem;
          border-radius: 8px;
          border: 1.5px solid #64748B;
          background: #ffffff;
          color: #072534;
          cursor: pointer;
          transition: background-color 0.22s ease, color 0.22s ease, border-color 0.22s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.25rem;
        }
        @media (hover: hover) {
          .gate-option-card:hover {
            background: #094E68;
            color: #ffffff !important;
            border-color: #094E68;
          }
          .gate-option-card:hover * {
            color: #ffffff !important;
          }
        }
        a.mobile-back-link {
          display: none;
          color: #072534 !important;
        }
        a.mobile-back-link:hover {
          background: #EDF3F6 !important;
          color: #094E68 !important;
        }
        @media (max-width: 1024px) {
          .login-left-pane {
            display: none !important;
          }
          .mobile-back-link {
            display: inline-flex !important;
            top: max(1rem, env(safe-area-inset-top, 0px)) !important;
          }
          .login-right-pane {
            padding-top: max(5rem, calc(env(safe-area-inset-top, 0px) + 4.25rem)) !important;
            padding-bottom: max(1.75rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem)) !important;
            align-items: flex-start !important;
          }
        }
      `}</style>

      <div
        className="login-left-pane"
        style={{
          flex: 1.14,
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
        <div
          ref={bgPhotoRef}
          style={{
            position: 'absolute',
            inset: '-6%',
            backgroundImage: 'url(/pln_view.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 28%',
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(6, 44, 61, 0.86) 0%, rgba(6, 44, 61, 0.78) 38%, rgba(6, 44, 61, 0.9) 70%, rgba(6, 44, 61, 0.96) 100%)',
            zIndex: 1,
          }}
        />

        <div style={{ position: 'relative', zIndex: 5, display: 'flex', justifyContent: 'flex-start' }}>
          <Link to="/" className="stagger-left login-back-pill">
            <ArrowLeft size={15} />
            <span>Beranda Publik</span>
          </Link>
        </div>

        <div style={{ position: 'relative', zIndex: 5, maxWidth: '560px' }}>
          <div
            className="stagger-left"
            style={{
              fontFamily: 'var(--ent-mono)',
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: '#B8D4E0',
              marginBottom: '0.75rem',
            }}
          >
            Institut Teknologi PLN · Tata Kelola Berbasis Unit Kerja
          </div>

          <h2
            className="stagger-left"
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 'clamp(2.1rem, 3.3vw, 3rem)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.08,
              margin: '0 0 0.75rem',
              color: '#ffffff',
            }}
          >
            Satu akun per Unit Kerja,
            <br />
            tanggung jawab terukur.
          </h2>

          <p
            className="stagger-left"
            style={{
              fontSize: '0.92rem',
              color: '#C5DEE8',
              lineHeight: 1.65,
              margin: '0 0 1.45rem',
            }}
          >
            Setiap indikator dikelola oleh 1 PIC Utama sebagai penanggung jawab pengisian data dan dokumen bukti, sementara unit kolaborator tercatat sebagai Co-PIC tanpa duplikasi akun maupun tumpang tindih isian.
          </p>

          <div
            ref={hudCardRef}
            className="stagger-left"
            style={{
              border: '1px solid rgba(197, 222, 232, 0.34)',
              borderRadius: '8px',
              padding: '1.25rem 1.35rem',
              background: 'rgba(6, 44, 61, 0.94)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              className="morph-text-item"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
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
                    color: '#B8D4E0',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Unit Kerja Terpilih
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
                  {activeAccount.unit || activeAccount.name}
                </div>
              </div>

              <strong
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  color: '#B8D4E0',
                  flexShrink: 0,
                }}
              >
                {activeAccount.role === 'superadmin_prp'
                  ? 'ADMIN PUSAT'
                  : activeAccount.role === 'spi'
                    ? 'AUDITOR VIEW-ONLY'
                    : activeAccount.picCodes?.length
                      ? `KODE UNIT: ${activeAccount.picCodes[0]}`
                      : 'UNIT AKTIF'}
              </strong>
            </div>

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  background: isIkuActive ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                  border: isIkuActive
                    ? '1px solid rgba(197, 222, 232, 0.55)'
                    : '1px solid rgba(197, 222, 232, 0.16)',
                  opacity: isIkuActive ? 1 : 0.68,
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
                  {activeAccount.role === 'spi'
                    ? 'Verifikasi SPI (View-Only)'
                    : isIkuActive
                      ? 'Akses Diizinkan'
                      : 'Tidak Termasuk Cakupan Unit'}
                </div>
              </div>

              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  background: isKpiActive ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                  border: isKpiActive
                    ? '1px solid rgba(197, 222, 232, 0.55)'
                    : '1px solid rgba(197, 222, 232, 0.16)',
                  opacity: isKpiActive ? 1 : 0.68,
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
                  {isKpiActive
                    ? activeAccount.role === 'spi'
                      ? 'Verifikasi SPI (View-Only & Unduh Bukti)'
                      : activeAccount.picCodes?.length && activeAccount.role !== 'superadmin_prp'
                        ? `PIC Utama Unit ${activeAccount.picCodes[0]}`
                        : 'Akses Penuh Direktorat PRP'
                    : 'Tidak Termasuk Cakupan Unit'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            borderRadius: '6px',
            border: '1px solid #64748B',
            background: '#F7FAFB',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#072534',
            textDecoration: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          <ArrowLeft size={15} />
          <span>Beranda</span>
        </Link>

        <div className="right-inner-wrap" style={{ width: '100%', maxWidth: '456px' }}>
          <div
            className="stagger-right"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.9rem',
              marginBottom: '1.75rem',
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
                <strong
                  style={{
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.64rem',
                    fontWeight: 800,
                    color: '#094E68',
                    letterSpacing: '0.05em',
                  }}
                >
                  PORTAL INTERNAL
                </strong>
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
                Masuk per Unit Kerja.
              </h1>
              <p
                className="stagger-right"
                style={{
                  color: '#334155',
                  fontSize: '0.9rem',
                  margin: '0 0 1.35rem',
                  lineHeight: 1.55,
                }}
              >
                Pilih Unit Kerja Anda atau masukkan alamat email resmi unit beserta kata sandi untuk mengakses modul kinerja.
              </p>

              {/* Single Clean Unit Kerja Selector (No Stacked Roles or PIC Tabs) */}
              <div className="stagger-right" style={{ marginBottom: '1.35rem' }}>
                <label
                  htmlFor="unit-kerja-select"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.42rem',
                    padding: '0.85rem 0.95rem',
                    background: '#F7FAFB',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: '#072534',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Building2 size={15} color="#094E68" />
                      <span>Pilih Unit Kerja</span>
                    </span>
                    <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', color: '#094E68', fontWeight: 700 }}>
                      {unitAccounts.length} Unit Terdaftar
                    </span>
                  </span>

                  <select
                    id="unit-kerja-select"
                    aria-label="Pilih Unit Kerja"
                    className="ent-select"
                    value={activeAccount.email}
                    onChange={(e) => handleSelectUnitWorkAccount(e.target.value)}
                    style={{ minHeight: '44px', background: '#FFFFFF', fontSize: '0.83rem', fontWeight: 700 }}
                  >
                    {unitAccounts.map((acc) => (
                      <option key={acc.email} value={acc.email}>
                        {formatUnitOptionLabel(acc)}
                      </option>
                    ))}
                  </select>

                  <div
                    className="morph-text-item"
                    style={{
                      marginTop: '0.3rem',
                      fontSize: '0.77rem',
                      color: '#334155',
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ color: '#094E68' }}>{activeAccount.unit || activeAccount.name}:</strong>{' '}
                    {activeAccount.description || 'Hak akses terisolasi sesuai tanggung jawab Unit Kerja.'}
                  </div>
                </label>
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
                    fontWeight: 700,
                    marginBottom: '1.2rem',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                    }}
                  >
                    Email Unit Kerja
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
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="unit@itpln.ac.id"
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
                  <LogIn size={17} />
                  <span className="morph-text-item">{submitLabel}</span>
                </button>
              </form>
            </div>
          )}

          {step === 'workspace_gate' && (
            <div ref={gateStageRef}>
              <div
                className="gate-stagger"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#166534',
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: '0.75rem',
                }}
              >
                <ShieldCheck size={15} /> Kredensial Unit Kerja Terverifikasi
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
                  margin: '0 0 1.45rem',
                }}
              >
                Unit <strong style={{ color: '#072534' }}>{pendingDualUser?.unit || pendingDualUser?.email}</strong> memiliki wewenang pelaporan pada kedua instrumen. Pilih ruang kerja yang ingin dibuka terlebih dahulu:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.4rem' }}>
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
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: '1.12rem',
                          fontWeight: 800,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        Masuk Ruang Kerja 8 IKU
                      </span>
                      <strong
                        style={{
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          color: hoveredGate === 'iku' ? '#C5DEE8' : '#094E68',
                        }}
                      >
                        STANDAR KEMENTERIAN
                      </strong>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.83rem',
                        color: hoveredGate === 'iku' ? '#C5DEE8' : '#334155',
                        lineHeight: 1.5,
                      }}
                    >
                      Kelola dan pantau capaian 8 Indikator Kinerja Utama standar Kemendikbudristek.
                    </p>
                  </div>
                  <Layers size={20} style={{ flexShrink: 0 }} />
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
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: '1.12rem',
                          fontWeight: 800,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        Masuk Lembar Kerja KPI Unit
                      </span>
                      <strong
                        style={{
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.64rem',
                          fontWeight: 800,
                          color: hoveredGate === 'kpi' ? '#C5DEE8' : '#094E68',
                        }}
                      >
                        OPERASIONAL ITPLN
                      </strong>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.83rem',
                        color: hoveredGate === 'kpi' ? '#C5DEE8' : '#334155',
                        lineHeight: 1.5,
                      }}
                    >
                      Isi indikator KPI sesuai tanggung jawab PIC Utama serta pantau indikator kolaborasi Co-PIC.
                    </p>
                  </div>
                  <Building2 size={20} style={{ flexShrink: 0 }} />
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
                <RotateCcw size={15} />
                <span>Kembali &amp; ganti Unit Kerja</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
