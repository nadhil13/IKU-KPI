import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Target, BookOpen, ShieldCheck, Scale, Building, Activity, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const MISSIONS = [
  {
    code: 'M.01',
    icon: <BookOpen size={22} strokeWidth={1.75} />,
    text: 'Menyelenggarakan pendidikan akademik dan vokasi berbasis teknologi energi serta ketenagalistrikan berstandar internasional.',
  },
  {
    code: 'M.02',
    icon: <Activity size={22} strokeWidth={1.75} />,
    text: 'Melaksanakan penelitian terapan yang berorientasi pada transisi energi bersih, efisiensi ketenagalistrikan, dan rekayasa industri.',
  },
  {
    code: 'M.03',
    icon: <Building size={22} strokeWidth={1.75} />,
    text: 'Melakukan pengabdian kepada masyarakat secara berkelanjutan melalui penerapan teknologi tepat guna untuk kesejahteraan publik.',
  },
  {
    code: 'M.04',
    icon: <Scale size={22} strokeWidth={1.75} />,
    text: 'Menjalin kemitraan strategis dengan PLN Group, industri nasional, dan perguruan tinggi global guna memperkuat pelaksanaan tridharma.',
  },
];

const LEGAL_BASIS = [
  {
    id: 'KEPMENDIKBUDRISTEK 210/M/2023',
    title: 'Indikator Kinerja Utama Perguruan Tinggi',
    desc: 'Ketetapan resmi delapan indikator makro untuk mengukur kesiapan kerja lulusan, keterlibatan dosen di industri, dan mutu kurikulum program studi.',
  },
  {
    id: 'PERMENDIKBUDRISTEK 53/2023',
    title: 'Penjaminan Mutu Pendidikan Tinggi',
    desc: 'Landasan penyelenggaraan Sistem Penjaminan Mutu Internal (SPMI) berbasis siklus penetapan, pelaksanaan, evaluasi, pengendalian, dan peningkatan.',
  },
  {
    id: 'KEBIJAKAN MUTU SPMI ITPLN',
    title: 'Tata Kelola KPI Operasional Unit & Fakultas',
    desc: 'Instrumen turunan internal Direktorat Perencanaan dan Pengembangan (PRP) ITPLN pada perspektif Keberlanjutan, Mahasiswa, Bisnis Internal, dan Kepatuhan.',
  },
];

export default function AboutIKU() {
  const containerRef = useRef(null);
  const visiMisiRef = useRef(null);
  const leftVisiRef = useRef(null);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(
      '.about-hero-anim',
      { y: 36, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.95, stagger: 0.1, delay: 0.08 }
    ).fromTo(
      '.hero-light-card',
      { y: 32, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.1 },
      '-=0.75'
    );

    gsap.utils.toArray('.scrub-text').forEach((para) => {
      gsap.fromTo(
        para,
        { opacity: 0.25, y: 28 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: para,
            start: 'top 90%',
            end: 'top 55%',
            scrub: 1,
          },
        }
      );
    });

    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      gsap.to(leftVisiRef.current, {
        scrollTrigger: {
          trigger: visiMisiRef.current,
          start: 'top 14%',
          end: 'bottom 82%',
          pin: leftVisiRef.current,
          pinSpacing: false,
          scrub: 1,
        },
      });
    });

    gsap.utils.toArray('.clean-mission-card').forEach((card) => {
      gsap.fromTo(
        card,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 88%',
            once: true,
          },
        }
      );
    });

    gsap.fromTo(
      '.hukum-card',
      { y: 32, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.hukum-section',
          start: 'top 82%',
          once: true,
        },
      }
    );

    return () => mm.revert();
  }, { scope: containerRef });

  return (
    <div ref={containerRef} style={{ background: '#ffffff', minHeight: '100dvh', color: '#072534', overflow: 'hidden' }}>
      <style>{`
        .about-hero-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: clamp(2rem, 4vw, 4rem);
          align-items: center;
        }
        .about-split-grid {
          display: grid;
          grid-template-columns: 0.85fr 1.15fr;
          gap: clamp(2rem, 4vw, 4rem);
          align-items: start;
        }
        .about-mission-card {
          background: #ffffff;
          border: 1px solid #D8E4EA;
          border-radius: 8px;
          padding: clamp(1.5rem, 3vw, 2.25rem);
          transition: border-color 0.22s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .about-hukum-card {
          background: #ffffff;
          border: 1px solid #D8E4EA;
          border-radius: 8px;
          padding: clamp(1.75rem, 3vw, 2.35rem);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: border-color 0.22s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (hover: hover) {
          .about-mission-card:hover,
          .about-hukum-card:hover {
            border-color: #094E68;
            transform: translateY(-2px);
          }
        }
        @media (max-width: 1024px) {
          .about-hero-grid,
          .about-split-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ─── HERO SECTION ─── */}
      <section
        className="hero-section"
        style={{
          padding: 'clamp(7.5rem, 11vw, 10rem) 0 clamp(4rem, 7vw, 6rem)',
          borderBottom: '1px solid #D8E4EA',
          background: '#ffffff',
        }}
      >
        <div className="container">
          <div className="about-hero-grid">
            <div>
              <div
                className="about-hero-anim"
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#094E68',
                  paddingBottom: '0.65rem',
                  marginBottom: '1.5rem',
                  borderBottom: '2px solid #0E7480',
                  display: 'inline-block',
                }}
              >
                01 // TENTANG SISTEM EVALUASI ITPLN
              </div>

              <h1
                className="about-hero-anim"
                style={{
                  fontSize: 'clamp(2.4rem, 5.2vw, 4.35rem)',
                  color: '#072534',
                  fontWeight: 800,
                  lineHeight: 1.04,
                  letterSpacing: '-0.04em',
                  margin: '0 0 1.35rem',
                }}
              >
                Tata Kelola Kinerja
                <br />
                <span style={{ color: '#094E68', fontWeight: 500 }}>Institut Teknologi PLN.</span>
              </h1>

              <p
                className="about-hero-anim"
                style={{
                  color: '#334155',
                  fontSize: 'clamp(1rem, 1.2vw, 1.12rem)',
                  lineHeight: 1.75,
                  maxWidth: '560px',
                  margin: '0 0 2.25rem',
                }}
              >
                PERFORMA ITPLN menghubungkan pelaporan 8 Indikator Kinerja Utama Kementerian dengan evaluasi KPI Operasional Fakultas, Program Studi, dan Unit Kerja di bawah koordinasi Direktorat Perencanaan dan Pengembangan (PRP).
              </p>

              <div className="about-hero-anim" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to="/iku-list" className="ent-btn ent-btn-primary" style={{ minHeight: '44px', padding: '0.75rem 1.35rem' }}>
                  Katalog 8 IKU <ArrowRight size={15} />
                </Link>
                <Link to="/documents" className="ent-btn" style={{ minHeight: '44px', padding: '0.75rem 1.35rem' }}>
                  Unduh Regulasi Resmi
                </Link>
              </div>
            </div>

            {/* Campus Architectural Frame */}
            <div className="hero-light-card" style={{ position: 'relative' }}>
              <div
                style={{
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #BFD2DC',
                  background: '#EDF3F6',
                }}
              >
                <img
                  src="/pln_view.jpg"
                  alt="Gedung Kampus Institut Teknologi PLN"
                  style={{
                    width: '100%',
                    height: 'clamp(260px, 38vw, 420px)',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div
                  style={{
                    background: '#062C3D',
                    color: '#ffffff',
                    padding: '1.15rem 1.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    borderTop: '2px solid #1B9AAA',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.62rem', letterSpacing: '0.1em', color: '#94B8C7', textTransform: 'uppercase' }}>
                      CAKUPAN EVALUASI INSTITUSI
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, marginTop: '2px' }}>
                      8 IKU Kementerian · 4 Perspektif KPI Unit
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      padding: '0.28rem 0.65rem',
                      borderRadius: '4px',
                      background: '#094E68',
                      border: '1px solid #1B9AAA',
                      color: '#ffffff',
                    }}
                  >
                    SPMI ITPLN
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 01: RASIONALISASI ─── */}
      <section style={{ padding: 'clamp(4.5rem, 8vw, 7.5rem) 0', borderBottom: '1px solid #D8E4EA' }}>
        <div className="container">
          <div className="about-split-grid">
            <div>
              <div className="ent-eyebrow" style={{ marginBottom: '1.15rem' }}>
                <Building size={13} /> 01 // RASIONALISASI
              </div>
              <h2
                style={{
                  fontSize: 'clamp(1.85rem, 3.5vw, 2.85rem)',
                  color: '#072534',
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: '-0.035em',
                  lineHeight: 1.1,
                }}
              >
                Penyelarasan Target Makro dan Eksekusi Unit.
              </h2>
            </div>

            <div>
              <p
                className="scrub-text"
                style={{
                  color: '#072534',
                  fontSize: 'clamp(1.2rem, 2vw, 1.55rem)',
                  lineHeight: 1.55,
                  marginBottom: '1.5rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                Perguruan tinggi berbasis ketenagalistrikan dan energi membutuhkan pengukuran capaian tridharma yang selaras antara kontrak kinerja kementerian dan program kerja fakultas.
              </p>
              <p
                className="scrub-text"
                style={{
                  color: '#334155',
                  fontSize: '1.02rem',
                  lineHeight: 1.78,
                  margin: 0,
                }}
              >
                Indikator Kinerja Utama (IKU) memetakan mutu lulusan, kontribusi dosen di industri, serta kualitas kurikulum program studi. Di sisi internal, KPI Operasional menerjemahkan sasaran tersebut ke dalam target terukur beserta lampiran bukti terverifikasi pada setiap unit pelaksana.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 02: VISI & MISI (PINNED ON DESKTOP) ─── */}
      <section
        ref={visiMisiRef}
        style={{
          padding: 'clamp(4.5rem, 8vw, 7.5rem) 0',
          background: '#F7FAFB',
          borderBottom: '1px solid #D8E4EA',
        }}
      >
        <div className="container">
          <div className="about-split-grid">
            <div>
              <div
                ref={leftVisiRef}
                style={{
                  background: '#062C3D',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: 'clamp(2rem, 4vw, 3rem)',
                  border: '1px solid #094E68',
                  borderTop: '3px solid #1B9AAA',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
                  <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.12em', color: '#94B8C7', textTransform: 'uppercase' }}>
                    02 // VISI INSTITUSI
                  </span>
                  <Target size={22} color="#38BDF8" strokeWidth={1.75} />
                </div>

                <h2
                  style={{
                    fontSize: 'clamp(1.65rem, 2.8vw, 2.25rem)',
                    color: '#ffffff',
                    fontWeight: 800,
                    lineHeight: 1.2,
                    letterSpacing: '-0.03em',
                    margin: '0 0 1.25rem',
                  }}
                >
                  Menjadi Perguruan Tinggi Berkelas Internasional yang Modern, Mandiri, dan Unggul di Bidang Energi serta Teknologi.
                </h2>

                <p style={{ margin: 0, fontSize: '0.88rem', color: '#C5DEE8', lineHeight: 1.65 }}>
                  Seluruh parameter IKU dan KPI disusun untuk mengawal pencapaian visi jangka panjang Institut Teknologi PLN secara bertahap per periode akademik.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.12em', color: '#094E68', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                EMPAT PILAR MISI TRIDHARMA ITPLN
              </div>

              {MISSIONS.map((misi) => (
                <article key={misi.code} className="clean-mission-card about-mission-card">
                  <div style={{ display: 'flex', gap: '1.15rem', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        color: '#094E68',
                        background: '#EDF5F7',
                        border: '1px solid #B8D9E2',
                        width: '44px',
                        height: '44px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {misi.icon}
                    </div>
                    <div>
                      <span
                        style={{
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.7rem',
                          color: '#0E7480',
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          display: 'block',
                          marginBottom: '0.35rem',
                        }}
                      >
                        {misi.code}
                      </span>
                      <p style={{ color: '#072534', fontSize: '0.98rem', lineHeight: 1.68, margin: 0, fontWeight: 500 }}>
                        {misi.text}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 03: DASAR HUKUM ─── */}
      <section className="hukum-section" style={{ padding: 'clamp(4.5rem, 8vw, 7.5rem) 0', background: '#ffffff' }}>
        <div className="container">
          <div style={{ maxWidth: '720px', marginBottom: '3rem' }}>
            <div className="ent-eyebrow" style={{ marginBottom: '1rem' }}>
              <ShieldCheck size={13} /> 03 // LANDASAN REGULASI
            </div>
            <h2
              style={{
                fontSize: 'clamp(1.85rem, 3.5vw, 2.75rem)',
                color: '#072534',
                fontWeight: 800,
                margin: '0 0 0.75rem',
                letterSpacing: '-0.035em',
                lineHeight: 1.1,
              }}
            >
              Acuan Hukum dan Standar Mutu.
            </h2>
            <p style={{ margin: 0, color: '#334155', fontSize: '0.96rem', lineHeight: 1.68 }}>
              Pengukuran capaian di dalam portal ini merujuk langsung pada regulasi pendidikan tinggi nasional dan pedoman penjaminan mutu internal kampus.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: '1.5rem',
            }}
          >
            {LEGAL_BASIS.map((item, idx) => (
              <article key={item.id} className="hukum-card about-hukum-card">
                <div>
                  <div
                    style={{
                      marginBottom: '1.5rem',
                      paddingBottom: '1rem',
                      borderBottom: '1px solid #D8E4EA',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--ent-mono)',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        color: '#0E7480',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {item.id}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--ent-mono)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#475569',
                      }}
                    >
                      0{idx + 1}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: '1.3rem',
                      color: '#072534',
                      fontWeight: 800,
                      marginBottom: '0.75rem',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25,
                    }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ color: '#334155', fontSize: '0.92rem', lineHeight: 1.68, margin: 0 }}>
                    {item.desc}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
