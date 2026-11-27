import { useRef, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Menu, X } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { getWindowLenis } from '../../lib/smoothScroll';
import logoPln from '../../assets/logo_pln.png';
import './Navbar.css';

gsap.registerPlugin(ScrollTrigger);

const FOLD_ENTER = 48; // px: fold into floating island
const FOLD_LEAVE = 18; // px: unfold back to edge-to-edge bar

export default function Navbar() {
  const wrapRef = useRef(null);
  const islandRef = useRef(null);
  const brandRef = useRef(null);
  const brandSubRef = useRef(null);
  const navTrackRef = useRef(null);
  const ctaRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('beranda');
  const [isFolded, setIsFolded] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isFoldedRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024) setIsOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const ids = ['beranda', 'iku', 'kpi', 'arsitektur'];
      const scrollPos = window.scrollY + 200;
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(ids[i]);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useGSAP(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.fromTo(
      wrapRef.current,
      { y: -90, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.0, ease: 'power4.out', delay: 0.1 }
    );

    tl.fromTo(
      brandRef.current,
      { opacity: 0, x: -20 },
      { opacity: 1, x: 0, duration: 0.8 },
      '-=0.7'
    );

    tl.fromTo(
      '.nav-btn-item',
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.06 },
      '-=0.6'
    );

    tl.fromTo(
      ctaRef.current,
      { opacity: 0, scale: 0.9, x: 15 },
      { opacity: 1, scale: 1, x: 0, duration: 0.7, ease: 'back.out(1.7)' },
      '-=0.5'
    );
  }, { scope: wrapRef });

  useEffect(() => {
    const performFold = (fold) => {
      if (isFoldedRef.current === fold) return;
      isFoldedRef.current = fold;
      setIsFolded(fold);

      const island = islandRef.current;
      const wrap = wrapRef.current;
      const sub = brandSubRef.current;
      if (!island || !wrap) return;

      const isMobileScreen = window.innerWidth <= 640;
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const dur = prefersReduced ? 0 : 0.45;

      if (fold) {
        gsap.to(wrap, {
          paddingTop: isMobileScreen
            ? 'calc(8px + env(safe-area-inset-top, 0px))'
            : 'calc(12px + env(safe-area-inset-top, 0px))',
          paddingLeft: isMobileScreen ? 12 : 22,
          paddingRight: isMobileScreen ? 12 : 22,
          duration: dur,
          ease: 'power3.out',
          overwrite: 'auto',
        });

        gsap.to(island, {
          maxWidth: isMobileScreen ? 640 : 1080,
          borderRadius: 8,
          height: isMobileScreen ? 56 : 60,
          paddingLeft: isMobileScreen ? '0.85rem' : '1.5rem',
          paddingRight: isMobileScreen ? '0.85rem' : '1.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderColor: '#CBD5E1',
          boxShadow: '0 10px 28px -10px rgba(7, 37, 52, 0.14)',
          duration: dur,
          ease: 'power3.out',
          overwrite: 'auto',
        });

        if (sub) {
          gsap.to(sub, {
            opacity: 0,
            maxHeight: 0,
            duration: prefersReduced ? 0 : 0.25,
            ease: 'power2.inOut',
            overwrite: 'auto',
          });
        }
      } else {
        gsap.to(wrap, {
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          duration: dur,
          ease: 'power3.out',
          overwrite: 'auto',
        });

        gsap.to(island, {
          maxWidth: '100%',
          borderRadius: 0,
          height: isMobileScreen ? 64 : 72,
          paddingLeft: isMobileScreen ? '1rem' : '2.5rem',
          paddingRight: isMobileScreen ? '1rem' : '2.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          borderColor: '#CBD5E1',
          boxShadow: '0 2px 12px rgba(7, 37, 52, 0.06)',
          duration: dur,
          ease: 'power3.out',
          overwrite: 'auto',
        });

        if (sub) {
          gsap.to(sub, {
            opacity: 1,
            maxHeight: 18,
            duration: prefersReduced ? 0 : 0.3,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        }
      }
    };

    let scheduled = false;
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (!isFoldedRef.current && y > FOLD_ENTER) {
          performFold(true);
        } else if (isFoldedRef.current && y < FOLD_LEAVE) {
          performFold(false);
        }
        scheduled = false;
      });
    };

    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (e, item) => {
    e.preventDefault();
    setIsOpen(false);
    if (item.to) {
      navigate(item.to);
      return;
    }
    if (location.pathname !== '/') {
      navigate(`/#${item.id}`);
      return;
    }
    const el = document.getElementById(item.id);
    if (el) {
      const topOffset = el.getBoundingClientRect().top + window.scrollY - 85;
      const lenis = getWindowLenis();
      if (lenis) lenis.scrollTo(topOffset, { duration: 1.0 });
      else window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
    setActiveSection(item.id);
  };

  const navLinks = [
    { label: 'Beranda', id: 'beranda' },
    { label: 'Indikator IKU', id: 'iku' },
    { label: 'Indikator KPI', id: 'kpi' },
    { label: 'Arsitektur', id: 'arsitektur' },
    { label: 'Kerangka', id: 'framework', to: '/framework' },
    { label: 'Dokumen', id: 'documents', to: '/documents' },
  ];

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pointerEvents: 'none',
      }}
    >
      <header
        ref={islandRef}
        style={{
          pointerEvents: 'auto',
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          height: 'clamp(64px, 8vw, 72px)',
          padding: '0 clamp(0.85rem, 2.5vw, 2.5rem)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          borderRadius: '0px',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid #CBD5E1',
          borderTop: 'none',
          boxShadow: '0 2px 12px rgba(7, 37, 52, 0.06)',
          willChange: 'border-radius, max-width, height, box-shadow',
          transformOrigin: 'center top',
        }}
      >
        <Link
          to="/"
          ref={brandRef}
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(0.45rem, 2vw, 0.85rem)',
            textDecoration: 'none',
            flexShrink: 1,
            minWidth: 0,
            userSelect: 'none',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <img
              src={logoPln}
              alt="Logo Institut Teknologi PLN"
              onError={(e) => {
                e.currentTarget.src = '/logo_pln.png';
              }}
              style={{
                height: isFolded ? '32px' : '38px',
                width: 'auto',
                objectFit: 'contain',
                transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>

          <div
            style={{
              width: '1px',
              height: isFolded ? '20px' : '24px',
              background: '#BFD2DC',
              flexShrink: 0,
              transition: 'height 0.4s ease',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
              <span
                style={{
                  fontSize: isFolded ? 'clamp(0.88rem, 3.5vw, 1.08rem)' : 'clamp(0.92rem, 3.8vw, 1.18rem)',
                  fontWeight: 800,
                  color: '#072534',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.1,
                  whiteSpace: 'nowrap',
                  fontFamily: 'Outfit, system-ui, sans-serif',
                  transition: 'font-size 0.4s ease',
                }}
              >
                PERFORMA ITPLN
              </span>
              <strong
                className="navbar-brand-tag"
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  color: '#094E68',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                IKU · KPI
              </strong>
            </div>
            <span
              ref={brandSubRef}
              className="navbar-brand-sub"
              style={{
                fontSize: '0.64rem',
                color: '#334155',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginTop: '1px',
                maxHeight: '18px',
                overflow: 'hidden',
                lineHeight: 1.2,
                transition: 'color 0.3s ease',
              }}
            >
              Institut Teknologi PLN
            </span>
          </div>
        </Link>

        <nav
          ref={navTrackRef}
          aria-label="Navigasi Utama"
          className="navbar-desktop-nav"
          style={{
            position: 'relative',
            zIndex: 2,
            alignItems: 'center',
            padding: '3px',
            background: 'rgba(9, 78, 104, 0.05)',
            borderRadius: '8px',
            border: '1px solid rgba(9, 78, 104, 0.12)',
          }}
        >
          {navLinks.map((item) => {
            const active = item.to ? location.pathname === item.to : location.pathname === '/' && activeSection === item.id;
            const href = item.to || `/#${item.id}`;
            return (
              <a
                key={item.id}
                href={href}
                className="nav-btn-item"
                aria-current={active ? 'page' : undefined}
                onClick={(e) => handleNavClick(e, item)}
                style={{
                  position: 'relative',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#094E68' : '#334155',
                  border: active ? '1px solid #D8E4EA' : '1px solid transparent',
                  padding: isFolded ? '0.42rem 0.95rem' : '0.48rem 1.1rem',
                  borderRadius: '6px',
                  fontSize: '0.84rem',
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: active ? '0 1px 4px rgba(7, 37, 52, 0.08)' : 'none',
                  transition:
                    'padding 0.35s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease, color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#072534';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.65)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#334155';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {active && (
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '1px',
                      background: '#0E7480',
                      display: 'inline-block',
                    }}
                  />
                )}
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div ref={ctaRef} className="navbar-desktop-cta" style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>
          <Link
            to="/login"
            style={{
              background: '#094E68',
              color: '#ffffff',
              textDecoration: 'none',
              padding: isFolded ? '0.52rem 1.2rem' : '0.6rem 1.35rem',
              fontSize: '0.83rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: '6px',
              border: '1px solid #094E68',
              transition: 'background-color 0.22s ease, border-color 0.22s ease, transform 0.22s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0E7480';
              e.currentTarget.style.borderColor = '#0E7480';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#094E68';
              e.currentTarget.style.borderColor = '#094E68';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <LogIn size={15} />
            <span>Masuk Portal</span>
          </Link>
        </div>

        <div className="navbar-mobile-toggle" style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={isOpen}
            style={{
              background: '#F7FAFB',
              border: '1px solid #64748B',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              padding: '0.45rem 0.65rem',
              color: '#072534',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              borderRadius: '6px',
              fontSize: '0.76rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
              transition: 'background 0.2s ease, border-color 0.2s ease',
            }}
          >
            {isOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
            <span>{isOpen ? 'Tutup' : 'Menu'}</span>
          </button>
        </div>
      </header>

      {isOpen && (
        <div className="navbar-mobile-drawer" role="navigation" aria-label="Menu Mobile">
          {navLinks.map((item) => {
            const isItemActive = item.to ? location.pathname === item.to : location.pathname === '/' && activeSection === item.id;
            const href = item.to || `/#${item.id}`;
            return (
              <a
                key={item.id}
                href={href}
                onClick={(e) => handleNavClick(e, item)}
                style={{
                  background: isItemActive ? '#EDF5F7' : 'transparent',
                  border: isItemActive ? '1px solid #094E68' : '1px solid transparent',
                  textAlign: 'left',
                  fontSize: '0.94rem',
                  fontWeight: isItemActive ? 700 : 500,
                  color: isItemActive ? '#094E68' : '#072534',
                  minHeight: '44px',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <span>{item.label}</span>
                {isItemActive && (
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '1px',
                      background: '#0E7480',
                    }}
                  />
                )}
              </a>
            );
          })}

          <Link
            to="/login"
            onClick={() => setIsOpen(false)}
            style={{
              marginTop: '0.4rem',
              background: '#094E68',
              color: '#ffffff',
              textDecoration: 'none',
              minHeight: '44px',
              padding: '0.75rem 1rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: '6px',
            }}
          >
            <LogIn size={15} />
            <span>Masuk Portal</span>
          </Link>
        </div>
      )}
    </div>
  );
}
