import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import EnterpriseArchitecture from '../components/EnterpriseArchitecture';

gsap.registerPlugin(ScrollTrigger);

export default function Home() {
  const mainRef = useRef();

  useGSAP(() => {
    // 1. HERO REVEAL
    const tl = gsap.timeline();
    tl.fromTo(
      '.hero-watermark',
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1.5, ease: 'power3.out', delay: 0.2 }
    );
    tl.fromTo(
      '.reveal-hero',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2, stagger: 0.1, ease: 'power3.out' },
      '-=1.2'
    );
    tl.fromTo(
      '.hero-line',
      { scaleX: 0 },
      { scaleX: 1, duration: 1.5, ease: 'power3.inOut', transformOrigin: 'left center' },
      '-=1'
    );

    // Hero background subtle scale
    gsap.to('.hero-bg-inner', {
      scale: 1.15,
      duration: 25,
      ease: 'none',
      yoyo: true,
      repeat: -1,
    });

    // Hero Parallax Fade
    gsap.to('.hero-content-wrap', {
      yPercent: 30,
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });

    // 2. KINETIC SCRUB MOTION FOR ALL TEXT & CONTAINERS
    const floatElements = gsap.utils.toArray('.clean-float');
    floatElements.forEach((el) => {
      gsap.fromTo(
        el,
        { y: 70, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            end: 'top 65%',
            scrub: 1,
          },
        }
      );
    });

    // 3. ULTRA SMOOTH INTERNAL PARALLAX FOR IMAGES (SECTION 01 & 02)
    gsap.to('.card-img-1', {
      yPercent: 20,
      scale: 1.1,
      ease: 'none',
      scrollTrigger: {
        trigger: '.iku-section',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
    });
    gsap.to('.card-img-2', {
      yPercent: 20,
      scale: 1.1,
      ease: 'none',
      scrollTrigger: {
        trigger: '.kpi-section',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
    });

    // 4. CLOSING PORTAL SHOWCASE & KINETIC MARQUEE (SINKRON DENGAN SECTION ATAS)
    gsap.to('.marquee-track', {
      xPercent: -18,
      ease: 'none',
      scrollTrigger: {
        trigger: '.marquee-section',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.2,
      },
    });

    gsap.fromTo(
      '.closing-portal-card',
      { scale: 0.9, y: 60 },
      {
        scale: 1,
        y: 0,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.marquee-section',
          start: 'top 90%',
          end: 'center center',
          scrub: 1.2,
        },
      }
    );

    gsap.fromTo(
      '.closing-portal-bg',
      { scale: 1.18, yPercent: -8 },
      {
        scale: 1.04,
        yPercent: 8,
        ease: 'none',
        scrollTrigger: {
          trigger: '.marquee-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
        },
      }
    );
  }, { scope: mainRef });

  return (
    <div ref={mainRef} style={{ background: '#ffffff', overflow: 'hidden' }}>
      {/* ─── 1. HERO SECTION (Cinematic Entry) ─── */}
      <section
        id="beranda"
        className="hero-section"
        style={{ position: 'relative', height: '100vh', minHeight: '500px', overflow: 'hidden' }}
      >
        {/* Breathing Background Layer */}
        <div className="hero-bg" style={{ position: 'absolute', inset: '-10%', zIndex: 0 }}>
          <div
            className="hero-bg-inner"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'url(/pln_view.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: 'scale(1.05)',
            }}
          />
        </div>

        {/* Lighter Glass Overlays for cleaner look */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)',
            zIndex: 1,
          }}
        />

        <div
          className="container hero-content-wrap home-hero-content"
          style={{ position: 'relative', zIndex: 10, height: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
            <div
              className="hero-watermark"
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '4px',
                color: '#ffffff',
                textTransform: 'uppercase',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <div style={{ width: '40px', height: '1px', background: '#ffffff' }} />
              Sistem Terpadu ITPLN
            </div>

            <h1
              className="reveal-hero home-hero-title"
              style={{
                color: '#ffffff',
                fontWeight: 300,
                margin: '0 0 1rem',
                lineHeight: 1.1,
                letterSpacing: '-3px',
              }}
            >
              Performance
              <br />
              <strong style={{ fontWeight: 800 }}>Portal.</strong>
            </h1>

            <div
              className="hero-line reveal-hero"
              style={{
                height: '1px',
                background: 'rgba(255,255,255,0.2)',
                margin: '3rem 0',
                width: '100%',
                maxWidth: '800px',
              }}
            />

            <p
              className="reveal-hero home-hero-desc"
              style={{
                color: '#eaeaea',
                maxWidth: '650px',
                fontWeight: 300,
                lineHeight: 1.7,
                marginBottom: '3rem',
              }}
            >
              Platform evaluasi kinerja institusional. Mengharmoniskan pencapaian Indikator Kinerja Utama
              skala makro dengan Key Performance Indicator level operasional.
            </p>

            <div className="reveal-hero" style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
              <Link
                to="/login"
                className="home-hero-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1rem',
                  background: '#ffffff',
                  color: '#000000',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  borderRadius: '2rem',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e5e5e5';
                  const arrow = e.currentTarget.querySelector('.arrow');
                  if (arrow) arrow.style.transform = 'translateX(6px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  const arrow = e.currentTarget.querySelector('.arrow');
                  if (arrow) arrow.style.transform = 'translateX(0)';
                }}
              >
                Autentikasi Akses{' '}
                <ArrowRight className="arrow" size={18} strokeWidth={1.5} style={{ transition: 'transform 0.4s ease' }} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. IKU SECTION (White Minimalist Card) ─── */}
      <section
        id="iku"
        className="iku-section home-content-section"
        style={{ background: '#ffffff', scrollMarginTop: '110px' }}
      >
        <div
          className="home-flex-row"
          style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}
        >
          {/* Parallax Image Block */}
          <div
            className="clean-float home-img-block"
            style={{ borderRadius: '2rem', overflow: 'hidden', position: 'relative', background: '#f5f5f7' }}
          >
            <div
              className="card-img-1"
              style={{
                position: 'absolute',
                inset: '-15%',
                backgroundImage: 'url(/pln_view.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'grayscale(20%)',
              }}
            />
          </div>

          {/* Clean Text Block */}
          <div className="clean-float home-text-block">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1rem',
                background: '#f5f5f7',
                padding: '0.6rem 1.5rem',
                borderRadius: '2rem',
                marginBottom: '2rem',
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#000000', letterSpacing: '2px' }}>01</span>
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
                Dimensi Makro
              </span>
            </div>

            <h3
              className="home-section-title"
              style={{
                fontWeight: 800,
                color: '#111111',
                letterSpacing: '-2px',
                margin: '0 0 1.5rem',
                lineHeight: 1.1,
              }}
            >
              Indikator
              <br />
              Kinerja Utama.
            </h3>

            <p className="home-section-desc" style={{ color: '#666666', fontWeight: 400, lineHeight: 1.8, margin: 0 }}>
              Berfokus pada standar Kementerian untuk mengukur kualitas kelulusan, kapasitas pengajar, dan
              keandalan kurikulum institusi secara holistik. Menjadi jembatan antara visi institusi dengan
              pencapaian nasional.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 3. KPI SECTION (Light Gray Minimalist Card) ─── */}
      <section
        id="kpi"
        className="kpi-section home-content-section"
        style={{ background: '#fafafa', scrollMarginTop: '110px' }}
      >
        <div
          className="home-flex-row home-flex-reverse"
          style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}
        >
          {/* KPI Image Block */}
          <div
            className="clean-float home-img-block"
            style={{ borderRadius: '2rem', overflow: 'hidden', position: 'relative', background: '#eeeeee' }}
          >
            <div
              className="card-img-2"
              style={{
                position: 'absolute',
                inset: '-15%',
                backgroundImage: 'url(/pln_view_2.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'grayscale(15%)',
              }}
            />
          </div>

          {/* Clean Text Block */}
          <div className="clean-float home-text-block">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1rem',
                background: '#ffffff',
                border: '1px solid #eeeeee',
                padding: '0.6rem 1.5rem',
                borderRadius: '2rem',
                marginBottom: '2rem',
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#000000', letterSpacing: '2px' }}>02</span>
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
                Dimensi Mikro
              </span>
            </div>

            <h3
              className="home-section-title"
              style={{
                fontWeight: 800,
                color: '#111111',
                letterSpacing: '-2px',
                margin: '0 0 1.5rem',
                lineHeight: 1.1,
              }}
            >
              Key Performance
              <br />
              Indicator.
            </h3>

            <p className="home-section-desc" style={{ color: '#666666', fontWeight: 400, lineHeight: 1.8, margin: 0 }}>
              Sistem operasional presisi tingkat internal. Melacak performa harian individu dosen, staf,
              hingga unit kerja spesifik secara mikroskopis di dalam ekosistem internal untuk memastikan
              target tercapai.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 4. ENTERPRISE SYSTEM ARCHITECTURE ─── */}
      <EnterpriseArchitecture />

      {/* ─── 5. ARCHITECTURAL FINALE & KINETIC MARQUEE (SEAMLESS WITH SECTIONS ABOVE) ─── */}
      <section
        className="marquee-section"
        style={{
          background: '#ffffff',
          padding: 'clamp(4rem, 7vw, 7rem) clamp(1.25rem, 4vw, 3.5rem) clamp(5rem, 8vw, 8.5rem)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Background Kinetic Marquee (Halus & Menyatu di Belakang Kartu) */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            transform: 'translateY(-50%)',
            width: '100%',
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'hidden',
          }}
        >
          <div className="marquee-track" style={{ whiteSpace: 'nowrap', display: 'flex', width: 'max-content' }}>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 'clamp(4.5rem, 13vw, 14rem)',
                  fontWeight: 800,
                  color: 'transparent',
                  WebkitTextStroke: '1.5px rgba(17, 17, 17, 0.055)',
                  letterSpacing: '-3px',
                  paddingRight: '2.5rem',
                  lineHeight: 0.9,
                  textTransform: 'uppercase',
                  userSelect: 'none',
                }}
              >
                MODERN • MANDIRI • UNGGUL •
              </div>
            ))}
          </div>
        </div>

        {/* Architectural Portal Card (Sinkron dengan Gambar & Eyebrow Section 01 & 02) */}
        <div
          className="closing-portal-card"
          style={{
            position: 'relative',
            zIndex: 5,
            maxWidth: '1320px',
            margin: '0 auto',
            borderRadius: '2rem',
            overflow: 'hidden',
            minHeight: '440px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '2.5rem',
            padding: 'clamp(2.5rem, 5vw, 4.5rem)',
            background: '#0c1220',
            boxShadow: '0 32px 64px rgba(0, 0, 0, 0.12)',
            willChange: 'transform',
          }}
        >
          {/* Parallax Photography Layer (Sama dengan Hero & Section 01) */}
          <div
            className="closing-portal-bg"
            style={{
              position: 'absolute',
              inset: '-15%',
              backgroundImage: 'url(/pln_view.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center 35%',
              filter: 'contrast(1.05) brightness(0.95)',
              zIndex: 0,
              willChange: 'transform',
            }}
          />

          {/* Cinematic Dark Glass Gradient Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(105deg, rgba(8, 12, 22, 0.92) 0%, rgba(8, 12, 22, 0.72) 55%, rgba(8, 12, 22, 0.45) 100%)',
              zIndex: 1,
            }}
          />

          {/* Kiri: Eyebrow Badge 04 & Editorial Headline */}
          <div style={{ position: 'relative', zIndex: 5, maxWidth: '620px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1rem',
                background: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                padding: '0.55rem 1.4rem',
                borderRadius: '2rem',
                marginBottom: '1.75rem',
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff', letterSpacing: '2px' }}>
                04
              </span>
              <div style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.35)' }} />
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '2px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  textTransform: 'uppercase',
                }}
              >
                Portal Eksekutif ITPLN
              </span>
            </div>

            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 'clamp(2.1rem, 4.2vw, 3.4rem)',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-2px',
                lineHeight: 1.08,
                margin: '0 0 1.15rem',
              }}
            >
              Masuki ekosistem kinerja
              <br />
              terpadu sekarang.
            </h2>

            <p
              style={{
                fontSize: 'clamp(0.95rem, 1.15vw, 1.05rem)',
                color: 'rgba(255, 255, 255, 0.78)',
                lineHeight: 1.7,
                margin: 0,
                maxWidth: '540px',
              }}
            >
              Akses ruang kerja 8 IKU Kementerian maupun KPI Operasional Unit sesuai
              kredensial otoritas Anda melalui satu gerbang autentikasi tunggal.
            </p>
          </div>

          {/* Kanan: CTA Button & Quick System Pill */}
          <div
            style={{
              position: 'relative',
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '1rem',
            }}
          >
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1rem',
                background: '#ffffff',
                color: '#111111',
                padding: '1.25rem 2.4rem',
                borderRadius: '99px',
                fontSize: '0.9rem',
                fontWeight: 800,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                textDecoration: 'none',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                e.currentTarget.style.background = '#f4f4f5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <span>Mulai Sistem</span>
              <ArrowUpRight size={19} strokeWidth={2.2} />
            </Link>

            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '1px',
                color: 'rgba(255, 255, 255, 0.65)',
                paddingLeft: '0.5rem',
              }}
            >
              SSO Terintegrasi • 3 Otoritas Akses
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}