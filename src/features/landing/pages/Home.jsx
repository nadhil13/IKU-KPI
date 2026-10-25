import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import EnterpriseArchitecture from '../components/EnterpriseArchitecture';

gsap.registerPlugin(ScrollTrigger);

const CORPORATE_PILLARS = [
  { idx: '01', target: 8, suffix: '', pad: true, label: 'Indikator Makro IKU', sub: 'Standar Kepmendikbudristek No. 210/M/2023' },
  { idx: '02', target: 4, suffix: '', pad: true, label: 'Perspektif KPI Unit', sub: 'Keberlanjutan · Mahasiswa · Bisnis · Kepatuhan' },
  { idx: '03', target: 3, suffix: '', pad: true, label: 'Otoritas Terisolasi', sub: 'PRP Root · Workspace IKU · Workspace KPI' },
  { idx: '04', target: 100, suffix: '%', pad: false, label: 'Integritas Audit & Eviden', sub: 'Validasi tautan HTTPS & histori snapshot versi' },
];

const EDITORIAL_INDEX = [
  {
    code: '01',
    tag: 'LANDASAN REGULASI',
    title: 'Tentang 8 Indikator Kinerja Utama',
    desc: 'Rasionalisasi strategis, visi transformasi pendidikan tinggi, serta landasan hukum kementerian.',
    to: '/about',
  },
  {
    code: '02',
    tag: 'METODOLOGI PDCA',
    title: 'Kerangka Strategis Manajemen Kinerja',
    desc: 'Siklus terpadu Plan-Do-Check-Act yang menyelaraskan target rektorat hingga unit pelaksana.',
    to: '/framework',
  },
  {
    code: '03',
    tag: 'PROSEDUR PELAPORAN',
    title: 'Panduan Operasional & Verifikasi',
    desc: 'Tata cara pelaporan capaian, pengunggahan tautan bukti pendukung, hingga alur persetujuan PRP.',
    to: '/guide',
  },
  {
    code: '04',
    tag: 'ARSIP KEPMENDIKBUD',
    title: 'Dokumen Resmi & Instrumen Evaluasi',
    desc: 'Unduh buku panduan resmi IKU Perguruan Tinggi Negeri dan regulasi penilaian kinerja ITPLN.',
    to: '/documents',
  },
];

export default function Home() {
  const mainRef = useRef(null);
  const magBtnRef = useRef(null);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    // 1. HERO MASKED LINE REVEAL & HAIRLINE DRAW
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(
      '.hero-watermark',
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.9, delay: 0.12 }
    )
      .fromTo(
        '.hero-mask-line',
        { yPercent: 115 },
        { yPercent: 0, duration: 1.15, stagger: 0.1 },
        '-=0.65'
      )
      .fromTo(
        '.hero-line',
        { scaleX: 0 },
        { scaleX: 1, duration: 1.2, ease: 'expo.inOut', transformOrigin: 'left center' },
        '-=0.85'
      )
      .fromTo(
        '.reveal-hero-sub',
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, stagger: 0.08 },
        '-=0.85'
      );

    // Subtle magnetic pull on primary hero CTA
    const magEl = magBtnRef.current;
    let cleanMagnetic = () => {};
    if (magEl) {
      const xTo = gsap.quickTo(magEl, 'x', { duration: 0.45, ease: 'power3.out' });
      const yTo = gsap.quickTo(magEl, 'y', { duration: 0.45, ease: 'power3.out' });
      const onMove = (e) => {
        const rect = magEl.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        xTo(dx * 0.18);
        yTo(dy * 0.22);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };
      magEl.addEventListener('mousemove', onMove);
      magEl.addEventListener('mouseleave', onLeave);
      cleanMagnetic = () => {
        magEl.removeEventListener('mousemove', onMove);
        magEl.removeEventListener('mouseleave', onLeave);
      };
    }

    // Hero background scroll-scrubbed depth (user-driven, no endless loop)
    gsap.fromTo(
      '.hero-bg-inner',
      { scale: 1.05, yPercent: 0 },
      {
        scale: 1.12,
        yPercent: 6,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      }
    );

    // Hero scroll-scrubbed depth recession
    gsap.to('.hero-content-wrap', {
      yPercent: 28,
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      },
    });

    // 2. TELEMETRY LEDGER ODOMETER ROLL-UP & SELF-DRAWING KEYLINE
    gsap.fromTo(
      '.ledger-top-rule',
      { scaleX: 0 },
      {
        scaleX: 1,
        transformOrigin: 'left center',
        duration: 1.1,
        ease: 'expo.inOut',
        scrollTrigger: { trigger: '.corp-pillars-strip', start: 'top 90%', once: true },
      }
    );

    gsap.utils.toArray('.pillar-odometer').forEach((el) => {
      const target = Number(el.getAttribute('data-target') || 0);
      const suffix = el.getAttribute('data-suffix') || '';
      const pad = el.getAttribute('data-pad') === 'true';
      const counter = { v: 0 };
      gsap.to(counter, {
        v: target,
        duration: 1.4,
        ease: 'expo.out',
        scrollTrigger: {
          trigger: '.corp-pillars-strip',
          start: 'top 86%',
          once: true,
        },
        onUpdate: () => {
          const n = Math.round(counter.v);
          el.textContent = `${pad ? String(n).padStart(2, '0') : n}${suffix}`;
        },
      });
    });

    gsap.fromTo(
      '.corp-pillar-cell',
      { y: 28, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.85,
        stagger: 0.08,
        ease: 'expo.out',
        clearProps: 'transform',
        scrollTrigger: { trigger: '.corp-pillars-strip', start: 'top 86%', once: true },
      }
    );

    // 3. SCRUBBED CLIP-PATH CURTAIN REVEAL & COUNTER-PARALLAX FOR SECTION 01 & 02
    gsap.utils.toArray('.arch-photo-frame').forEach((frame) => {
      gsap.fromTo(
        frame,
        { clipPath: 'inset(10% 8% 10% 8%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          ease: 'power2.out',
          scrollTrigger: {
            trigger: frame,
            start: 'top 92%',
            end: 'top 45%',
            scrub: 1,
          },
        }
      );
    });

    gsap.fromTo(
      '.card-img-1',
      { yPercent: -10, scale: 1.14 },
      {
        yPercent: 12,
        scale: 1.04,
        ease: 'none',
        scrollTrigger: { trigger: '.iku-section', start: 'top bottom', end: 'bottom top', scrub: 1 },
      }
    );

    gsap.fromTo(
      '.card-img-2',
      { yPercent: -10, scale: 1.14 },
      {
        yPercent: 12,
        scale: 1.04,
        ease: 'none',
        scrollTrigger: { trigger: '.kpi-section', start: 'top bottom', end: 'bottom top', scrub: 1 },
      }
    );

    gsap.utils.toArray('.clean-float').forEach((el) => {
      gsap.fromTo(
        el,
        { y: 54, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            end: 'top 62%',
            scrub: 1,
          },
        }
      );
    });

    // 4. EDITORIAL REFERENCE LEDGER: SELF-DRAWING DIVIDERS & ROW STAGGER
    gsap.utils.toArray('.ed-row-line').forEach((line) => {
      gsap.fromTo(
        line,
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: 'left center',
          duration: 0.95,
          ease: 'expo.inOut',
          scrollTrigger: { trigger: line, start: 'top 92%', once: true },
        }
      );
    });

    gsap.fromTo(
      '.ed-ledger-row',
      { y: 26, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.75,
        stagger: 0.08,
        ease: 'expo.out',
        clearProps: 'transform',
        scrollTrigger: { trigger: '.gov-res-section', start: 'top 84%', once: true },
      }
    );

    // 5. DUAL OPPOSING KINETIC MARQUEES & FINALE MONOLITH
    gsap.to('.marquee-track-left', {
      xPercent: -20,
      ease: 'none',
      scrollTrigger: {
        trigger: '.marquee-section',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
    });

    gsap.fromTo(
      '.marquee-track-right',
      { xPercent: -20 },
      {
        xPercent: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '.marquee-section',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      }
    );

    gsap.fromTo(
      '.closing-portal-card',
      { clipPath: 'inset(8% 4% 8% 4%)', y: 48 },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        y: 0,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.marquee-section',
          start: 'top 88%',
          end: 'center center',
          scrub: 1,
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
          scrub: 1.1,
        },
      }
    );

    return () => cleanMagnetic();
  }, { scope: mainRef });

  return (
    <div ref={mainRef} style={{ background: '#ffffff', overflow: 'hidden', color: '#072534' }}>
      <style>{`
        .home-ledger-grid {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        .corp-pillar-cell {
          padding: 2.25rem 1.85rem;
          border-right: 1px solid #D8E4EA;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: background-color 0.25s ease;
        }
        .corp-pillar-cell:last-child {
          border-right: none;
        }
        .corp-pillar-cell:hover {
          background: #F7FAFB;
        }
        .ed-ledger-row {
          display: grid;
          grid-template-columns: 72px 180px 1.2fr 1fr 48px;
          align-items: center;
          gap: 1.5rem;
          padding: 1.85rem 1.25rem;
          text-decoration: none;
          color: #072534;
          background: #ffffff;
          transition: background-color 0.28s cubic-bezier(0.16, 1, 0.3, 1),
            color 0.28s cubic-bezier(0.16, 1, 0.3, 1),
            padding-left 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ed-ledger-row:hover {
          background: #062C3D;
          color: #ffffff;
          padding-left: 1.85rem;
        }
        .ed-ledger-row .ed-code {
          color: #0E7480;
          transition: color 0.25s ease;
        }
        .ed-ledger-row:hover .ed-code {
          color: #38BDF8;
        }
        .ed-ledger-row .ed-muted {
          color: #475569;
          transition: color 0.25s ease;
        }
        .ed-ledger-row:hover .ed-muted {
          color: #94B8C7;
        }
        .ed-ledger-row .ed-arrow {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ed-ledger-row:hover .ed-arrow {
          transform: translate(5px, -5px);
        }
        .arch-inline-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          min-height: 44px;
          padding: 0.85rem 1.45rem;
          border: 1px solid #094E68;
          border-radius: 6px;
          background: #094E68;
          color: #ffffff;
          font-family: var(--ent-mono);
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background-color 0.22s ease, border-color 0.22s ease, color 0.22s ease;
        }
        .arch-inline-cta:hover {
          background: #0E7480;
          border-color: #0E7480;
          color: #ffffff;
        }
        @media (max-width: 1024px) {
          .home-ledger-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .corp-pillar-cell:nth-child(2) {
            border-right: none;
          }
          .corp-pillar-cell:nth-child(1),
          .corp-pillar-cell:nth-child(2) {
            border-bottom: 1px solid #D8E4EA;
          }
          .ed-ledger-row {
            grid-template-columns: 48px 1fr 32px;
            gap: 0.75rem;
          }
          .ed-hide-tablet {
            display: none;
          }
        }
        @media (max-width: 600px) {
          .home-ledger-grid {
            grid-template-columns: 1fr;
          }
          .corp-pillar-cell {
            border-right: none !important;
            border-bottom: 1px solid #D8E4EA;
            padding: 1.65rem 1.25rem;
          }
        }
      `}</style>

      {/* ─── 1. HERO SECTION (ITPLN Architectural Entry) ─── */}
      <section
        id="beranda"
        className="hero-section"
        style={{ position: 'relative', height: '100dvh', minHeight: '600px', overflow: 'hidden' }}
      >
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

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(6, 44, 61, 0.58) 0%, rgba(6, 44, 61, 0.42) 45%, rgba(6, 44, 61, 0.90) 100%)',
            zIndex: 1,
          }}
        />

        <div
          className="container hero-content-wrap home-hero-content"
          style={{ position: 'relative', zIndex: 10, height: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', paddingTop: '2.5rem' }}>
            <div
              className="hero-watermark"
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.2em',
                color: '#ffffff',
                textTransform: 'uppercase',
                marginBottom: '1.65rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.85rem',
              }}
            >
              <div style={{ width: '32px', height: '2px', background: '#1B9AAA' }} />
              INSTITUT TEKNOLOGI PLN · DIREKTORAT PRP
            </div>

            <h1
              className="home-hero-title"
              style={{
                color: '#ffffff',
                fontWeight: 400,
                margin: '0 0 0.5rem',
                lineHeight: 1.02,
                letterSpacing: '-0.045em',
              }}
            >
              <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.06em' }}>
                <span className="hero-mask-line" style={{ display: 'block' }}>Portal Kinerja</span>
              </span>
              <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.08em' }}>
                <span className="hero-mask-line" style={{ display: 'block' }}>
                  <strong style={{ fontWeight: 800 }}>Terpadu ITPLN.</strong>
                </span>
              </span>
            </h1>

            <div
              className="hero-line"
              style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.42)',
                margin: '2rem 0',
                width: '100%',
                maxWidth: '780px',
              }}
            />

            <p
              className="reveal-hero-sub home-hero-desc"
              style={{
                color: '#F1F7FA',
                maxWidth: '620px',
                fontWeight: 400,
                lineHeight: 1.72,
                marginBottom: '2.4rem',
              }}
            >
              Ruang evaluasi dan pelaporan kinerja resmi Institut Teknologi PLN yang menyatukan pencapaian 8 Indikator Kinerja Utama Kementerian dengan evaluasi KPI Operasional Unit dan Fakultas.
            </p>

            <div className="reveal-hero-sub" style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <Link
                ref={magBtnRef}
                to="/login"
                className="home-hero-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  minHeight: '46px',
                  background: '#ffffff',
                  color: '#072534',
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  border: '1px solid #ffffff',
                }}
              >
                Masuk Ruang Kerja
                <ArrowRight size={16} strokeWidth={2} />
              </Link>

              <Link
                to="/framework"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  minHeight: '46px',
                  padding: '1.05rem 1.75rem',
                  borderRadius: '6px',
                  background: '#062C3D',
                  border: '1px solid rgba(255, 255, 255, 0.45)',
                  color: '#ffffff',
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  transition: 'background-color 0.22s ease, border-color 0.22s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#094E68';
                  e.currentTarget.style.borderColor = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#062C3D';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.45)';
                }}
              >
                Kerangka Strategis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 1B. FULL-BLEED ARCHITECTURAL TELEMETRY LEDGER ─── */}
      <section
        className="corp-pillars-strip"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #D8E4EA',
          position: 'relative',
        }}
      >
        <div className="ledger-top-rule" style={{ height: '2px', background: '#094E68', width: '100%' }} />
        <div className="home-ledger-grid">
          {CORPORATE_PILLARS.map((pillar) => (
            <div key={pillar.idx} className="corp-pillar-cell">
              <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 600, color: '#0E7480', letterSpacing: '0.1em', marginBottom: '0.9rem' }}>
                {pillar.idx} // PARAMETER
              </div>
              <div
                className="pillar-odometer"
                data-target={pillar.target}
                data-suffix={pillar.suffix}
                data-pad={String(pillar.pad)}
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 'clamp(2.75rem, 4.5vw, 4.1rem)',
                  fontWeight: 700,
                  color: '#072534',
                  letterSpacing: '-0.05em',
                  lineHeight: 0.95,
                  marginBottom: '0.85rem',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {pillar.pad ? String(pillar.target).padStart(2, '0') : pillar.target}{pillar.suffix}
              </div>
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#072534', letterSpacing: '-0.015em' }}>
                  {pillar.label}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.22rem', lineHeight: 1.5 }}>
                  {pillar.sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 2. IKU SECTION (Architectural Split with Scrubbed Curtain Photo) ─── */}
      <section
        id="iku"
        className="iku-section home-content-section"
        style={{ background: '#ffffff', scrollMarginTop: '110px', borderBottom: '1px solid #D8E4EA' }}
      >
        <div
          className="home-flex-row"
          style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div
            className="arch-photo-frame home-img-block"
            style={{
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative',
              background: '#EDF3F6',
              border: '1px solid #D8E4EA',
            }}
          >
            <div
              className="card-img-1"
              style={{
                position: 'absolute',
                inset: '-15%',
                backgroundImage: 'url(/pln_view.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          </div>

          <div className="clean-float home-text-block">
            <div
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: '#094E68',
                textTransform: 'uppercase',
                paddingBottom: '0.75rem',
                marginBottom: '1.5rem',
                borderBottom: '2px solid #0E7480',
                display: 'inline-block',
              }}
            >
              01 // DIMENSI STRATEGIS MAKRO
            </div>

            <h3
              className="home-section-title"
              style={{
                fontWeight: 800,
                color: '#072534',
                letterSpacing: '-0.04em',
                margin: '0 0 1.25rem',
                lineHeight: 1.04,
              }}
            >
              Indikator
              <br />
              Kinerja Utama.
            </h3>

            <p className="home-section-desc" style={{ color: '#334155', fontWeight: 400, lineHeight: 1.78, margin: '0 0 2rem' }}>
              Mengukur 8 standar utama kementerian secara terukur, mencakup kesiapan kerja lulusan, pengalaman mahasiswa di luar kampus, kegiatan tridharma dosen di industri, praktisi mengajar, luaran riset, kemitraan prodi, pembelajaran kolaboratif, dan akreditasi internasional.
            </p>

            <Link to="/iku-list" className="arch-inline-cta">
              Katalog 8 Indikator IKU <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 3. KPI SECTION (Architectural Split with Scrubbed Curtain Photo) ─── */}
      <section
        id="kpi"
        className="kpi-section home-content-section"
        style={{ background: '#F7FAFB', scrollMarginTop: '110px', borderBottom: '1px solid #D8E4EA' }}
      >
        <div
          className="home-flex-row home-flex-reverse"
          style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div
            className="arch-photo-frame home-img-block"
            style={{
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative',
              background: '#EDF3F6',
              border: '1px solid #BFD2DC',
            }}
          >
            <div
              className="card-img-2"
              style={{
                position: 'absolute',
                inset: '-15%',
                backgroundImage: 'url(/pln_view_2.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          </div>

          <div className="clean-float home-text-block">
            <div
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: '#094E68',
                textTransform: 'uppercase',
                paddingBottom: '0.75rem',
                marginBottom: '1.5rem',
                borderBottom: '2px solid #0E7480',
                display: 'inline-block',
              }}
            >
              02 // DIMENSI OPERASIONAL MIKRO
            </div>

            <h3
              className="home-section-title"
              style={{
                fontWeight: 800,
                color: '#072534',
                letterSpacing: '-0.04em',
                margin: '0 0 1.25rem',
                lineHeight: 1.04,
              }}
            >
              Key Performance
              <br />
              Indicator.
            </h3>

            <p className="home-section-desc" style={{ color: '#334155', fontWeight: 400, lineHeight: 1.78, margin: '0 0 2rem' }}>
              Instrumen evaluasi unit kerja dan fakultas ITPLN dengan kalkulasi formula otomatis ala spreadsheet untuk menilai Perspektif Keberlanjutan (A), Mahasiswa (B), Bisnis Internal (C), serta Kepatuhan (D).
            </p>

            <Link to="/guide" className="arch-inline-cta">
              Pelajari Alur Evaluasi KPI <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 4. ENTERPRISE SYSTEM ARCHITECTURE ─── */}
      <EnterpriseArchitecture />

      {/* ─── 5. EDITORIAL GOVERNANCE REFERENCE LEDGER ─── */}
      <section
        className="gov-res-section"
        style={{
          background: '#ffffff',
          borderTop: '1px solid #D8E4EA',
          borderBottom: '1px solid #D8E4EA',
          padding: 'clamp(4.5rem, 7vw, 7rem) clamp(1.25rem, 4vw, 4rem)',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2.75rem' }}>
            <div>
              <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.14em', color: '#0E7480', marginBottom: '0.65rem' }}>
                04 // DIREKTORI DOKUMENTASI &amp; REGULASI
              </div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(2rem, 3.8vw, 3.1rem)', fontWeight: 800, color: '#072534', letterSpacing: '-0.04em', lineHeight: 1.04, margin: 0 }}>
                Indeks Tata Kelola Institusi.
              </h2>
            </div>
            <p style={{ margin: 0, maxWidth: '440px', color: '#334155', fontSize: '0.9rem', lineHeight: 1.65 }}>
              Referensi resmi standar penilaian kementerian, kerangka kerja PDCA, dan regulasi mutu internal Institut Teknologi PLN.
            </p>
          </div>

          <div>
            <div className="ed-row-line" style={{ height: '1.5px', background: '#094E68', width: '100%' }} />
            {EDITORIAL_INDEX.map((item) => (
              <div key={item.code}>
                <Link to={item.to} className="ed-ledger-row">
                  <span className="ed-code" style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.82rem', fontWeight: 700 }}>
                    {item.code}
                  </span>
                  <span className="ed-muted ed-hide-tablet" style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.65rem', letterSpacing: '0.1em' }}>
                    {item.tag}
                  </span>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.15rem, 2vw, 1.5rem)', fontWeight: 700, letterSpacing: '-0.025em' }}>
                    {item.title}
                  </span>
                  <span className="ed-muted ed-hide-tablet" style={{ fontSize: '0.83rem', lineHeight: 1.55 }}>
                    {item.desc}
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <ArrowUpRight size={20} className="ed-arrow" />
                  </span>
                </Link>
                <div className="ed-row-line" style={{ height: '1px', background: '#D8E4EA', width: '100%' }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. DUAL KINETIC MARQUEE & ITPLN SSO MONOLITH ─── */}
      <section
        className="marquee-section"
        style={{
          background: '#ffffff',
          padding: 'clamp(4.5rem, 7vw, 7.5rem) clamp(1.25rem, 4vw, 3.5rem) clamp(5rem, 8vw, 8.5rem)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Dual Opposing Kinetic Typography Tracks */}
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
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div className="marquee-track-left" style={{ whiteSpace: 'nowrap', display: 'flex', width: 'max-content' }}>
            {[...Array(3)].map((_, i) => (
              <div
                key={`l-${i}`}
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 'clamp(4rem, 11vw, 11.5rem)',
                  fontWeight: 800,
                  color: 'transparent',
                  WebkitTextStroke: '1px rgba(9, 78, 104, 0.08)',
                  letterSpacing: '-0.04em',
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
          <div className="marquee-track-right" style={{ whiteSpace: 'nowrap', display: 'flex', width: 'max-content' }}>
            {[...Array(3)].map((_, i) => (
              <div
                key={`r-${i}`}
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: 'clamp(4rem, 11vw, 11.5rem)',
                  fontWeight: 800,
                  color: 'transparent',
                  WebkitTextStroke: '1px rgba(14, 116, 128, 0.07)',
                  letterSpacing: '-0.04em',
                  paddingRight: '2.5rem',
                  lineHeight: 0.9,
                  textTransform: 'uppercase',
                  userSelect: 'none',
                }}
              >
                INSTITUT • TEKNOLOGI • PLN •
              </div>
            ))}
          </div>
        </div>

        <div
          className="closing-portal-card"
          style={{
            position: 'relative',
            zIndex: 5,
            maxWidth: '1320px',
            margin: '0 auto',
            borderRadius: '8px',
            border: '1px solid #094E68',
            overflow: 'hidden',
            minHeight: '420px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '2.5rem',
            padding: 'clamp(2.5rem, 5vw, 4.5rem)',
            background: '#062C3D',
            willChange: 'transform, clip-path',
          }}
        >
          <div
            className="closing-portal-bg"
            style={{
              position: 'absolute',
              inset: '-15%',
              backgroundImage: 'url(/pln_view.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center 35%',
              filter: 'contrast(1.06) brightness(0.72) saturate(0.9)',
              zIndex: 0,
              willChange: 'transform',
            }}
          />

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(100deg, rgba(6, 44, 61, 0.95) 0%, rgba(6, 44, 61, 0.82) 55%, rgba(9, 78, 104, 0.52) 100%)',
              zIndex: 1,
            }}
          />

          <div style={{ position: 'relative', zIndex: 5, maxWidth: '620px' }}>
            <div
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.18em',
                color: '#94B8C7',
                textTransform: 'uppercase',
                marginBottom: '1.35rem',
              }}
            >
              SSO // GERBANG AUTENTIKASI ITPLN
            </div>

            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: 'clamp(2.1rem, 4.2vw, 3.35rem)',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.04em',
                lineHeight: 1.05,
                margin: '0 0 1.15rem',
              }}
            >
              Masuk ke ruang kerja
              <br />
              kinerja unit Anda.
            </h2>

            <p
              style={{
                fontSize: 'clamp(0.92rem, 1.1vw, 1rem)',
                color: '#E2F1F7',
                lineHeight: 1.7,
                margin: 0,
                maxWidth: '540px',
              }}
            >
              Direktorat PRP, Dekanat, Ketua Program Studi, dan Unit Kerja dapat melaporkan serta memverifikasi capaian melalui satu pintu masuk sesuai otoritas masing-masing.
            </p>
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.85rem',
            }}
          >
            <Link
              to="/login"
              className="home-marquee-cta"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.85rem',
                minHeight: '46px',
                background: '#ffffff',
                color: '#072534',
                padding: '1.1rem 2.1rem',
                borderRadius: '6px',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = '#EDF5F7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <span>Masuk Sistem</span>
              <ArrowUpRight size={17} strokeWidth={2.2} />
            </Link>

            <div
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.64rem',
                fontWeight: 600,
                letterSpacing: '0.1em',
                color: '#94B8C7',
              }}
            >
              3 OTORITAS TERISOLASI · JEJAK AUDIT PENUH
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
