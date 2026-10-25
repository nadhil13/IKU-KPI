import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Target, TrendingUp, Users, BookOpen, Briefcase, Globe, Award, ShieldCheck, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const IKU_PILLARS = [
  { code: 'IKU.01', icon: <Briefcase size={20} />, title: 'Lulusan Mendapat Pekerjaan Layak', desc: 'Lulusan bekerja dengan masa tunggu singkat, melanjutkan studi pascasarjana, atau berwirausaha mandiri.' },
  { code: 'IKU.02', icon: <Globe size={20} />, title: 'Pengalaman Mahasiswa di Luar Kampus', desc: 'Mahasiswa memperoleh rekognisi SKS melalui magang industri energi/PLN, riset terapan, proyek desa, atau pertukaran pelajar.' },
  { code: 'IKU.03', icon: <Users size={20} />, title: 'Dosen Berkegiatan di Luar Kampus', desc: 'Dosen tetap melaksanakan tridharma di kampus mitra, bekerja sebagai praktisi industri, atau membina mahasiswa berprestasi.' },
  { code: 'IKU.04', icon: <BookOpen size={20} />, title: 'Praktisi Mengajar di Dalam Kampus', desc: 'Pengajar berkualifikasi doktor, bersertifikat kompetensi profesi, atau berasal dari praktisi industri ketenagalistrikan.' },
  { code: 'IKU.05', icon: <TrendingUp size={20} />, title: 'Hasil Kerja Dosen Digunakan Masyarakat', desc: 'Publikasi ilmiah bereputasi, paten rekayasa energi, dan karya terapan dosen yang dimanfaatkan industri maupun masyarakat.' },
  { code: 'IKU.06', icon: <Target size={20} />, title: 'Kemitraan Program Studi', desc: 'Kerja sama aktif program studi dengan BUMN, industri ketenagalistrikan, lembaga riset, dan perguruan tinggi mitra.' },
  { code: 'IKU.07', icon: <Award size={20} />, title: 'Kelas Kolaboratif dan Partisipatif', desc: 'Evaluasi mata kuliah berbasis pemecahan studi kasus industri (Case Method) atau proyek kelompok (Team-Based Project).' },
  { code: 'IKU.08', icon: <ShieldCheck size={20} />, title: 'Program Studi Berstandar Internasional', desc: 'Program studi memperoleh akreditasi atau sertifikasi internasional yang diakui Kemendikbudristek (IABEE, ASIIN, ABET).' },
];

const PDCA_STEPS = [
  {
    phase: 'PLAN',
    actor: 'Rektorat & Direktorat PRP',
    title: 'Penetapan Target & Bobot',
    text: 'Direktorat PRP menyusun kontrak kinerja tahunan, menetapkan target 8 IKU serta bobot 4 perspektif KPI untuk setiap fakultas dan unit.',
  },
  {
    phase: 'DO',
    actor: 'Fakultas, Prodi, & Unit PIC',
    title: 'Pelaporan & Bukti Tautan',
    text: 'Setiap PIC unit menginput capaian aktual ke lembar kerja dan melampirkan tautan dokumen bukti pendukung (HTTPS) pada periode aktif.',
  },
  {
    phase: 'CHECK',
    actor: 'Verifikator Direktorat PRP',
    title: 'Pemeriksaan & Verifikasi Bukti',
    text: 'Tim verifikator PRP memeriksa kelengkapan setiap tautan bukti, memberikan status persetujuan atau catatan revisi per indikator.',
  },
  {
    phase: 'ACT',
    actor: 'Rapat Tinjauan Manajemen',
    title: 'Evaluasi & Tindak Lanjut Mutu',
    text: 'Pimpinan institusi membahas hasil rekapitulasi capaian pada Rapat Tinjauan Manajemen (RTM) untuk perbaikan sasaran periode berikutnya.',
  },
];

export default function StrategicFramework() {
  const mainRef = useRef(null);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const heroTl = gsap.timeline({ delay: 0.08, defaults: { ease: 'expo.out' } });
    heroTl
      .fromTo('.sf-hero-line', { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: 'expo.inOut' })
      .from('.sf-badge', { y: 16, opacity: 0, duration: 0.6 }, '-=0.6')
      .from('.sf-title-line', { yPercent: 110, duration: 0.95, stagger: 0.1 }, '-=0.45')
      .from('.sf-subtitle', { y: 16, opacity: 0, duration: 0.65 }, '-=0.5')
      .from('.sf-stat-item', { y: 20, opacity: 0, duration: 0.6, stagger: 0.06 }, '-=0.45');

    // Horizontal pinned scroll ONLY on desktop >= 1024px (clean vertical grid on mobile/tablet)
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      const hSection = mainRef.current?.querySelector('.sf-pillars');
      const hTrack = mainRef.current?.querySelector('.sf-pillars-track');
      if (hSection && hTrack) {
        const sidebarW = () => hSection.querySelector('.sf-pillars-sidebar')?.offsetWidth || 0;
        const dist = () => Math.max(0, hTrack.scrollWidth - (window.innerWidth - sidebarW()));

        gsap.to(hTrack, {
          x: () => -dist(),
          ease: 'none',
          scrollTrigger: {
            trigger: hSection,
            pin: true,
            pinSpacing: true,
            scrub: 0.7,
            start: 'top top',
            end: () => `+=${dist()}`,
            invalidateOnRefresh: true,
          },
        });
      }
    });

    gsap.fromTo(
      '.sf-pdca-card',
      { y: 36, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.75,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.sf-pdca-grid',
          start: 'top 86%',
          once: true,
        },
      }
    );

    gsap.fromTo(
      '.sf-pdca-line',
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.sf-pdca-grid',
          start: 'top 85%',
          end: 'top 30%',
          scrub: 1,
        },
      }
    );

    return () => mm.revert();
  }, { scope: mainRef });

  return (
    <div ref={mainRef} style={{ background: '#F7FAFB', color: '#072534', overflow: 'hidden' }}>
      <style>{`
        .sf-pillars {
          min-height: 100dvh;
          display: flex;
          overflow: hidden;
          background: #F7FAFB;
          border-top: 1px solid #D8E4EA;
          border-bottom: 1px solid #D8E4EA;
        }
        .sf-pillars-sidebar {
          width: 32vw;
          min-width: 340px;
          max-width: 460px;
          flex-shrink: 0;
          padding: 3rem 3.5vw;
          background: #ffffff;
          border-right: 1px solid #D8E4EA;
          display: flex;
          flex-direction: column;
          justify-content: center;
          z-index: 5;
        }
        .sf-pillars-track {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 3rem 12vw 3rem 2.5rem;
          flex-shrink: 0;
          will-change: transform;
        }
        .sf-pillar-card {
          width: 340px;
          min-height: 360px;
          background: #ffffff;
          border-radius: 8px;
          padding: 2rem 1.85rem;
          display: flex;
          flex-direction: column;
          border: 1px solid #D8E4EA;
          border-top: 3px solid #094E68;
          flex-shrink: 0;
          text-decoration: none;
          color: #072534;
          transition: border-color 0.22s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sf-pdca-card {
          display: flex;
          flex-direction: column;
          position: relative;
          padding: 2rem 1.75rem;
          background: #F7FAFB;
          border-radius: 8px;
          border: 1px solid #D8E4EA;
          transition: border-color 0.22s ease, background-color 0.22s ease;
        }
        @media (hover: hover) {
          .sf-pillar-card:hover {
            border-color: #0E7480;
            transform: translateY(-4px);
          }
          .sf-pdca-card:hover {
            background: #ffffff;
            border-color: #094E68;
          }
        }
        @media (max-width: 1023px) {
          .sf-pillars {
            min-height: auto;
            flex-direction: column;
            padding: 4rem 1.25rem;
          }
          .sf-pillars-sidebar {
            width: 100%;
            min-width: 0;
            max-width: none;
            border-right: none;
            border: 1px solid #D8E4EA;
            border-radius: 8px;
            padding: 2rem 1.5rem;
            margin-bottom: 1.5rem;
          }
          .sf-pillars-track {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
            gap: 1.25rem;
            padding: 0;
            width: 100%;
          }
          .sf-pillar-card {
            width: 100%;
            min-height: 0;
          }
        }
      `}</style>

      {/* ─── 1. HERO ─── */}
      <section
        className="sf-hero"
        style={{
          minHeight: 'calc(100dvh - 72px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 'clamp(7.5rem, 11vw, 9.5rem) clamp(1.25rem, 4vw, 2.5rem) 4.5rem',
          position: 'relative',
          background: '#ffffff',
          textAlign: 'center',
        }}
      >
        <div className="sf-hero-content" style={{ position: 'relative', zIndex: 1, maxWidth: 880, width: '100%' }}>
          <div className="sf-badge ent-eyebrow" style={{ marginBottom: '2rem' }}>
            02 // ARSITEKTUR TATA KELOLA MUTU ITPLN
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.6rem, 6.8vw, 5.6rem)',
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: '-0.04em',
              margin: '0 0 1.75rem',
              color: '#072534',
            }}
          >
            <div style={{ overflow: 'hidden', paddingBottom: 4 }}>
              <div className="sf-title-line">Kerangka</div>
            </div>
            <div style={{ overflow: 'hidden', paddingBottom: 6 }}>
              <div className="sf-title-line" style={{ color: '#094E68' }}>Strategis PDCA.</div>
            </div>
          </h1>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.75rem' }}>
            <div className="sf-hero-line" style={{ width: 72, height: 2, background: '#0E7480', transformOrigin: 'center' }} />
          </div>

          <p
            className="sf-subtitle"
            style={{
              fontSize: 'clamp(0.98rem, 1.3vw, 1.1rem)',
              color: '#334155',
              lineHeight: 1.75,
              maxWidth: 600,
              margin: '0 auto',
            }}
          >
            Struktur kerja siklus penjaminan mutu Institut Teknologi PLN yang menyatukan sasaran 8 Indikator Kinerja Utama Kementerian dengan evaluasi 4 perspektif KPI Operasional Unit.
          </p>
        </div>

        {/* Factual Institutional Architecture Ledger */}
        <div
          className="sf-hero-stats"
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'stretch',
            marginTop: '3.25rem',
            background: '#F7FAFB',
            borderRadius: '8px',
            border: '1px solid #D8E4EA',
            borderTop: '2px solid #094E68',
            overflow: 'hidden',
            maxWidth: 720,
            width: '100%',
          }}
        >
          <div className="sf-stat-item" style={{ flex: 1, padding: '1.65rem 1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #D8E4EA' }}>
            <div className="ent-mono" style={{ fontSize: '2.5rem', fontWeight: 700, color: '#072534', letterSpacing: '-0.04em', lineHeight: 1 }}>08</div>
            <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 600, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>Indikator IKU</div>
          </div>

          <div className="sf-stat-item" style={{ flex: 1, padding: '1.65rem 1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #D8E4EA' }}>
            <div className="ent-mono" style={{ fontSize: '2.5rem', fontWeight: 700, color: '#094E68', letterSpacing: '-0.04em', lineHeight: 1 }}>04</div>
            <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 600, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>Perspektif KPI</div>
          </div>

          <div className="sf-stat-item" style={{ flex: 1, padding: '1.65rem 1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="ent-mono" style={{ fontSize: '2.5rem', fontWeight: 700, color: '#0E7480', letterSpacing: '-0.04em', lineHeight: 1 }}>04</div>
            <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 600, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>Tahap Siklus PDCA</div>
          </div>
        </div>
      </section>

      {/* ─── 2. DELAPAN PILAR KEMENTERIAN ─── */}
      <section className="sf-pillars">
        <div className="sf-pillars-sidebar">
          <div>
            <div
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: '#0E7480',
                textTransform: 'uppercase',
                marginBottom: '1rem',
              }}
            >
              KEPMENDIKBUDRISTEK 210/M/2023
            </div>

            <h2
              style={{
                fontSize: 'clamp(1.85rem, 2.8vw, 2.8rem)',
                fontWeight: 800,
                letterSpacing: '-0.035em',
                margin: '0 0 1rem',
                lineHeight: 1.08,
                color: '#072534',
              }}
            >
              Delapan Pilar
              <br />
              Indikator Utama.
            </h2>

            <p style={{ fontSize: '0.94rem', lineHeight: 1.72, color: '#334155', margin: '0 0 1.75rem' }}>
              Parameter evaluasi kinerja perguruan tinggi yang diturunkan ke fakultas, program studi, dan lembaga pelaksana di lingkungan ITPLN.
            </p>

            <Link to="/iku-list" className="ent-btn ent-btn-primary" style={{ minHeight: '44px' }}>
              Lihat Formula &amp; Target <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="sf-pillars-track">
          {IKU_PILLARS.map((iku, idx) => (
            <Link key={iku.code} to={`/iku-list#iku-${idx + 1}`} className="sf-pillar-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div
                  style={{
                    background: '#EDF5F7',
                    color: '#094E68',
                    width: '42px',
                    height: '42px',
                    borderRadius: '6px',
                    border: '1px solid #B8D9E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {iku.icon}
                </div>
                <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.74rem', fontWeight: 700, color: '#0E7480', letterSpacing: '0.06em' }}>
                  {iku.code}
                </span>
              </div>

              <h3 style={{ fontSize: '1.22rem', fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 0.75rem', color: '#072534', lineHeight: 1.28 }}>
                {iku.title}
              </h3>

              <p style={{ fontSize: '0.88rem', color: '#334155', margin: 0, lineHeight: 1.68, flex: 1 }}>
                {iku.desc}
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '1.5rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid #EDF3F6',
                  color: '#094E68',
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <span>Buka Spesifikasi</span>
                <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── 3. SIKLUS PDCA OPERASIONAL ─── */}
      <section className="sf-pdca" style={{ padding: 'clamp(4.5rem, 8vw, 7.5rem) 0', background: '#ffffff' }}>
        <div className="container">
          <div style={{ marginBottom: '3.5rem', maxWidth: '680px' }}>
            <div className="ent-eyebrow" style={{ marginBottom: '1rem' }}>
              03 // SIKLUS PENJAMINAN MUTU
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 800, letterSpacing: '-0.035em', margin: '0 0 0.75rem', lineHeight: 1.08, color: '#072534' }}>
              Alur Kerja PDCA Institusi.
            </h2>
            <p style={{ margin: 0, fontSize: '0.96rem', color: '#334155', lineHeight: 1.7 }}>
              Setiap tahapan evaluasi dijalankan oleh unit penanggung jawab yang jelas mulai dari penetapan target hingga tinjauan manajemen.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ height: 2, background: '#D8E4EA', width: '100%', position: 'relative', marginBottom: '2rem' }}>
              <div className="sf-pdca-line" style={{ position: 'absolute', inset: 0, background: '#0E7480', transformOrigin: 'left center' }} />
            </div>

            <div
              className="sf-pdca-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 245px), 1fr))',
                gap: '1.25rem',
              }}
            >
              {PDCA_STEPS.map((step, idx) => (
                <article key={step.phase} className="sf-pdca-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem' }}>
                    <span
                      style={{
                        fontFamily: 'var(--ent-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        padding: '0.22rem 0.55rem',
                        borderRadius: '4px',
                        background: '#094E68',
                        color: '#ffffff',
                      }}
                    >
                      0{idx + 1} · {step.phase}
                    </span>
                    <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 600, color: '#475569' }}>
                      {step.actor}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', color: '#072534', fontWeight: 800, margin: '0 0 0.65rem', letterSpacing: '-0.02em' }}>
                    {step.title}
                  </h3>
                  <p style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.68, margin: 0 }}>
                    {step.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
