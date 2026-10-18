import { useRef, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import LiquidGlassCanvas from './LiquidGlassCanvas';
import logoPln from '../../assets/logo_pln.png';
import './Navbar.css';

gsap.registerPlugin(ScrollTrigger);

const FOLD_ENTER = 48; // px — fold into floating island
const FOLD_LEAVE = 18; // px — unfold back to edge-to-edge bar

export default function Navbar() {
  const wrapRef = useRef(null);
  const islandRef = useRef(null);
  const brandRef = useRef(null);
  const brandSubRef = useRef(null);
  const navTrackRef = useRef(null);
  const ctaRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activeSection, setActiveSection] = useState('beranda');
  const [isFolded, setIsFolded] = useState(false);
  const location = useLocation();

  const isFoldedRef = useRef(false);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 1024) setIsOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ScrollSpy for sections
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

  // Initial Entry Animation
  useGSAP(() => {
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

  // Ultra-Smooth GSAP Liquid Fold Motion with Hysteresis & Overwrite Protection
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

      if (fold) {
        // ─── SMOOTH MORPH TO FLOATING ISLAND (BUTTERY LUXURY EASING) ───
        gsap.to(wrap, {
          paddingTop: isMobileScreen ? 8 : 14,
          paddingLeft: isMobileScreen ? 12 : 22,
          paddingRight: isMobileScreen ? 12 : 22,
          duration: 0.75,
          ease: 'power4.out',
          overwrite: 'auto',
        });

        gsap.to(island, {
          maxWidth: isMobileScreen ? 640 : 1040,
          borderRadius: 9999,
          height: isMobileScreen ? 56 : 60,
          paddingLeft: isMobileScreen ? '0.85rem' : '1.5rem',
          paddingRight: isMobileScreen ? '0.85rem' : '1.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          borderColor: 'rgba(255, 255, 255, 0.92)',
          boxShadow:
            '0 20px 48px -12px rgba(11, 23, 44, 0.16), 0 0 0 1px rgba(255, 255, 255, 0.75) inset, 0 1px 2px rgba(0,0,0,0.04)',
          duration: 0.75,
          ease: 'power4.out',
          overwrite: 'auto',
        });

        // Subtle tactile 3D fluid dip
        gsap.fromTo(
          island,
          { rotateX: -2.0, scale: 0.99 },
          { rotateX: 0, scale: 1, duration: 0.65, ease: 'power3.out', overwrite: 'auto' }
        );

        if (sub) {
          gsap.to(sub, {
            opacity: 0,
            maxHeight: 0,
            duration: 0.35,
            ease: 'power2.inOut',
            overwrite: 'auto',
          });
        }
      } else {
        // ─── SMOOTH MORPH BACK TO FULL-WIDTH BAR ───
        gsap.to(wrap, {
          paddingTop: 0,
          paddingLeft: 0,
          paddingRight: 0,
          duration: 0.65,
          ease: 'power4.out',
          overwrite: 'auto',
        });

        gsap.to(island, {
          maxWidth: '100%',
          borderRadius: 0,
          height: isMobileScreen ? 64 : 72,
          paddingLeft: isMobileScreen ? '1rem' : '2.5rem',
          paddingRight: isMobileScreen ? '1rem' : '2.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.70)',
          borderColor: 'rgba(255, 255, 255, 0.40)',
          boxShadow:
            '0 4px 24px rgba(11, 23, 44, 0.05), 0 -1px 0 rgba(255, 255, 255, 0.7) inset',
          duration: 0.65,
          ease: 'power4.out',
          overwrite: 'auto',
        });

        gsap.fromTo(
          island,
          { rotateX: 1.4, scale: 0.995 },
          { rotateX: 0, scale: 1, duration: 0.6, ease: 'power3.out', overwrite: 'auto' }
        );

        if (sub) {
          gsap.to(sub, {
            opacity: 1,
            maxHeight: 18,
            duration: 0.45,
            ease: 'power2.out',
            overwrite: 'auto',
            delay: 0.1,
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

    // Initial check on mount
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Smooth scroll to section
  const gotoSection = (e, id) => {
    e.preventDefault();
    if (location.pathname !== '/') {
      window.location.href = `/#${id}`;
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const topOffset = el.getBoundingClientRect().top + window.pageYOffset - 85;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
    setActiveSection(id);
    setIsOpen(false);
  };

  const navLinks = [
    { label: 'Beranda', id: 'beranda' },
    { label: 'Indikator IKU', id: 'iku' },
    { label: 'Indikator KPI', id: 'kpi' },
    { label: 'Arsitektur Sistem', id: 'arsitektur' },
  ];

  const isDesktop = windowWidth > 1024;

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        perspective: '1400px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* ════════════════════════════════════════
          LIQUID GLASS NAVBAR CONTAINER
          ════════════════════════════════════════ */}
      <header
        ref={islandRef}
        style={{
          pointerEvents: 'auto',
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          height: 'clamp(64px, 8vw, 72px)',
          padding: '0 clamp(1rem, 2.5vw, 2.5rem)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '0px',
          background: 'rgba(255, 255, 255, 0.70)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
          border: '1px solid rgba(255, 255, 255, 0.45)',
          borderTop: 'none',
          boxShadow: '0 4px 24px rgba(11, 23, 44, 0.05), 0 -1px 0 rgba(255, 255, 255, 0.7) inset',
          willChange: 'transform, border-radius, max-width, height, box-shadow',
          transformOrigin: 'center top',
        }}
      >
        {/* Three.js Liquid Caustic & Fluid Sheen Canvas */}
        <LiquidGlassCanvas navbarRef={islandRef} isFolded={isFolded} />

        {/* ── Top Specular Prismatic Rim Highlight ── */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '2%',
            right: '2%',
            height: '1px',
            zIndex: 1,
            pointerEvents: 'none',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.95) 25%, rgba(255,255,255,1) 50%, rgba(255,255,255,0.95) 75%, transparent 100%)',
          }}
        />

        {/* ── Subtle Bottom Ambient Edge Line ── */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '1px',
            zIndex: 1,
            pointerEvents: 'none',
            background:
              'linear-gradient(90deg, transparent 5%, rgba(0, 155, 185, 0.25) 30%, rgba(0, 155, 185, 0.35) 50%, rgba(0, 155, 185, 0.25) 70%, transparent 95%)',
          }}
        />

        {/* ════ BRAND IDENTITY ════ */}
        <Link
          to="/"
          ref={brandRef}
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            textDecoration: 'none',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={logoPln}
              alt="ITPLN"
              onError={(e) => {
                e.currentTarget.src = '/logo_pln.png';
              }}
              style={{
                height: isFolded ? '32px' : '38px',
                width: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.12))',
                transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>

          <div
            style={{
              width: '1px',
              height: isFolded ? '20px' : '24px',
              background: 'rgba(15, 23, 42, 0.12)',
              transition: 'height 0.4s ease',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  fontSize: isFolded ? 'clamp(0.95rem, 3.5vw, 1.08rem)' : 'clamp(1rem, 4vw, 1.18rem)',
                  fontWeight: 800,
                  color: '#0b172a',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.1,
                  fontFamily: 'Outfit, system-ui, sans-serif',
                  transition: 'font-size 0.4s ease',
                }}
              >
                PERFORMA ITPLN
              </span>
              <span
                style={{
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  padding: '1.5px 5.5px',
                  borderRadius: '4px',
                  background: 'rgba(0, 155, 185, 0.12)',
                  color: '#007a93',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                IKU • KPI
              </span>
            </div>
            <span
              ref={brandSubRef}
              className="navbar-brand-sub"
              style={{
                fontSize: '0.64rem',
                color: '#526581',
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
              Portal Kinerja Terpadu ITPLN
            </span>
          </div>
        </Link>

        {/* ════ DESKTOP NAVIGATION (REFINED SEGMENTED PILL TRACK) ════ */}
        <nav
          ref={navTrackRef}
          className="navbar-desktop-nav"
          style={{
            position: 'relative',
            zIndex: 2,
            alignItems: 'center',
            padding: '3px',
            background: 'rgba(15, 23, 42, 0.04)',
            borderRadius: '9999px',
            border: '1px solid rgba(255, 255, 255, 0.65)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03) inset',
          }}
        >
          {navLinks.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                className="nav-btn-item"
                onClick={(e) => gotoSection(e, item.id)}
                style={{
                  position: 'relative',
                  background: active ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
                  color: active ? '#0b172a' : '#475569',
                  border: 'none',
                  outline: 'none',
                  padding: isFolded ? '0.40rem 0.95rem' : '0.48rem 1.15rem',
                  borderRadius: '9999px',
                  fontSize: '0.85rem',
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: active
                    ? '0 2px 10px rgba(11, 23, 44, 0.08), 0 1px 0 rgba(255, 255, 255, 1) inset'
                    : 'none',
                  transition:
                    'padding 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.25s ease, color 0.25s ease, box-shadow 0.25s ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#0b172a';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.50)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = '#475569';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {/* Subtle active dot indicator */}
                {active && (
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #009bb9, #007a93)',
                      boxShadow: '0 0 6px rgba(0, 155, 185, 0.6)',
                      display: 'inline-block',
                    }}
                  />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ════ CTA BUTTON ════ */}
        <div ref={ctaRef} className="navbar-desktop-cta" style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>
          <Link
            to="/login"
            style={{
              background: 'linear-gradient(135deg, #094e68 0%, #007a93 50%, #009bb9 100%)',
              color: '#ffffff',
              textDecoration: 'none',
              padding: isFolded ? '0.48rem 1.25rem' : '0.58rem 1.45rem',
              fontSize: '0.84rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: '9999px',
              border: '1px solid rgba(255, 255, 255, 0.30)',
              boxShadow:
                '0 4px 16px -2px rgba(0, 122, 147, 0.35), 0 1px 0 rgba(255, 255, 255, 0.25) inset',
              transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)';
              e.currentTarget.style.boxShadow =
                '0 8px 24px -2px rgba(0, 122, 147, 0.50), 0 1px 0 rgba(255, 255, 255, 0.35) inset';
              const arrow = e.currentTarget.querySelector('.cta-arrow');
              if (arrow) arrow.style.transform = 'translateX(4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow =
                '0 4px 16px -2px rgba(0, 122, 147, 0.35), 0 1px 0 rgba(255, 255, 255, 0.25) inset';
              const arrow = e.currentTarget.querySelector('.cta-arrow');
              if (arrow) arrow.style.transform = 'translateX(0)';
            }}
          >
            <span>Masuk Portal</span>
            <ArrowRight
              className="cta-arrow"
              size={14}
              strokeWidth={2.5}
              style={{ transition: 'transform 0.25s ease' }}
            />
          </Link>
        </div>

        {/* ════ MOBILE HAMBURGER TOGGLE ════ */}
        <div className="navbar-mobile-toggle" style={{ position: 'relative', zIndex: 2 }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle Navigation"
            style={{
              background: 'rgba(15, 23, 42, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              padding: '0.45rem',
              color: '#0b172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              transition: 'background 0.2s ease',
            }}
          >
            {isOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
        </div>
      </header>

      {/* ════ MOBILE DRAWER ════ */}
      {isOpen && (
        <div className="navbar-mobile-drawer">
          {navLinks.map((item) => (
            <button
              key={item.id}
              onClick={(e) => gotoSection(e, item.id)}
              style={{
                background: activeSection === item.id ? 'rgba(0, 155, 185, 0.08)' : 'transparent',
                border: 'none',
                textAlign: 'left',
                fontSize: '0.96rem',
                fontWeight: activeSection === item.id ? 700 : 500,
                color: activeSection === item.id ? '#007a93' : '#334155',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
              }}
            >
              <span>{item.label}</span>
              {activeSection === item.id && (
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#007a93',
                  }}
                />
              )}
            </button>
          ))}

          <Link
            to="/login"
            onClick={() => setIsOpen(false)}
            style={{
              marginTop: '0.5rem',
              background: 'linear-gradient(135deg, #094e68 0%, #007a93 100%)',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '0.85rem',
              fontSize: '0.90rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: '14px',
              boxShadow: '0 4px 14px rgba(0, 122, 147, 0.3)',
            }}
          >
            <span>Masuk Portal</span>
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>
      )}
    </div>
  );
}
