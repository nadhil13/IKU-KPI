import { useRef } from 'react';
import { Target, TrendingUp, Users, BookOpen, Briefcase, Globe, Award, ShieldCheck, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const ikuData = [
  { icon: <Briefcase size={24} />, title: "Lulusan Mendapat Pekerjaan Layak", desc: "Alumni diserap di industri tingkat atas, membangun wirausaha sukses, atau melanjutkan studi lanjutan." },
  { icon: <Globe size={24} />, title: "Pengalaman Mahasiswa di Luar Kampus", desc: "Mahasiswa aktif berpartisipasi dalam magang industri, proyek desa, riset, wirausaha, atau pertukaran pelajar." },
  { icon: <Users size={24} />, title: "Dosen Berkegiatan di Luar Kampus", desc: "Tridharma dosen yang teraplikasi langsung di industri atau perguruan tinggi lain secara profesional." },
  { icon: <BookOpen size={24} />, title: "Praktisi Mengajar di Kampus", desc: "Profesional industri membawa studi kasus dan pengalaman riil ke dalam ruang kelas akademik." },
  { icon: <TrendingUp size={24} />, title: "Hasil Kerja Dosen Digunakan Masyarakat", desc: "Riset terapan, paten, atau teknologi tepat guna yang terimplementasi dan bermanfaat bagi masyarakat." },
  { icon: <Target size={24} />, title: "Kerjasama Program Studi", desc: "Kemitraan strategis global yang memfasilitasi kurikulum mutakhir dan penyerapan lulusan." },
  { icon: <Award size={24} />, title: "Kelas Kolaboratif dan Partisipatif", desc: "Transformasi pedagogik menggunakan Case Method dan pembelajaran berbasis proyek kelompok." },
  { icon: <ShieldCheck size={24} />, title: "Program Studi Berstandar Internasional", desc: "Akreditasi global bergengsi yang memposisikan program studi setara standar pendidikan dunia." }
];

const pdcaData = [
  { phase: 'PLAN', title: 'Pemetaan', text: 'Menetapkan target metrik dari rektorat ke unit terkecil secara hierarkis.' },
  { phase: 'DO', title: 'Eksekusi', text: 'Pelaksanaan program kerja yang tercatat langsung dalam sistem basis data.' },
  { phase: 'CHECK', title: 'Validasi', text: 'Sistem otomasi memverifikasi anomali data sebelum dipublikasikan.' },
  { phase: 'ACT', title: 'Tindak Lanjut', text: 'Rekomendasi strategis dikeluarkan secara algoritmik untuk perbaikan kuartal.' }
];

export default function StrategicFramework() {
  const mainRef = useRef();

  useGSAP(() => {

    /* ═══════════════════════════════════════════════
       HERO — Cinematic entrance + line-draw + parallax
       ═══════════════════════════════════════════════ */

    const heroTl = gsap.timeline({ delay: 0.1 });

    // 1. Decorative line draws in from center
    heroTl.fromTo('.sf-hero-line',
      { scaleX: 0 },
      { scaleX: 1, duration: 1.2, ease: 'expo.inOut' }
    );

    // 2. Badge fades up
    heroTl.from('.sf-badge',
      { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.6'
    );

    // 3. Each title line clips up from its overflow mask
    heroTl.from('.sf-title-line',
      { yPercent: 110, duration: 1, stagger: 0.12, ease: 'expo.out' }, '-=0.4'
    );

    // 4. Subtitle and stat items stagger in
    heroTl.from('.sf-subtitle',
      { y: 16, opacity: 0, duration: 0.7, ease: 'power3.out' }, '-=0.5'
    );
    heroTl.from('.sf-stat-item',
      { y: 24, opacity: 0, duration: 0.6, stagger: 0.06, ease: 'power3.out' }, '-=0.4'
    );

    // 5. Number counter
    const el8 = mainRef.current?.querySelector('.counter-8');
    const el95 = mainRef.current?.querySelector('.counter-95');
    if (el8 && el95) {
      const c = { a: 0, b: 0 };
      gsap.to(c, {
        a: 8, b: 95, duration: 2, ease: 'power2.out', delay: 0.9,
        onUpdate() {
          el8.textContent = '0' + Math.floor(c.a);
          el95.textContent = Math.floor(c.b) + '%';
        }
      });
    }

    // 6. Parallax on scroll — content drifts upward at different rates
    gsap.to('.sf-hero-content', {
      y: -60, ease: 'none',
      scrollTrigger: { trigger: '.sf-hero', start: 'top top', end: 'bottom top', scrub: 1 }
    });
    gsap.to('.sf-hero-stats', {
      y: -25, ease: 'none',
      scrollTrigger: { trigger: '.sf-hero', start: 'top top', end: 'bottom top', scrub: 1.5 }
    });

    /* ╔══════════════════════════════════════════════╗
       ║  PILLARS — Horizontal pinned scroll           ║
       ╚══════════════════════════════════════════════╝ */

    const hSection = mainRef.current?.querySelector('.sf-pillars');
    const hTrack = mainRef.current?.querySelector('.sf-pillars-track');

    if (hSection && hTrack) {
      const sidebarW = () => hSection.querySelector('.sf-pillars-sidebar')?.offsetWidth || 0;
      const dist = () => hTrack.scrollWidth - (window.innerWidth - sidebarW());

      // Sidebar content reveal — opens on approach, closes when leaving
      gsap.from('.sf-pillars-sidebar-inner > *', {
        y: 30, opacity: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out',
        scrollTrigger: {
          trigger: hSection, start: 'top 80%',
          toggleActions: 'play none none reverse'
        }
      });

      // Main horizontal pin
      gsap.to(hTrack, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: hSection,
          pin: true,
          pinSpacing: true,
          scrub: 0.6,
          start: 'top top',
          end: () => `+=${dist()}`,
          invalidateOnRefresh: true
        }
      });
    }

    /* ╔══════════════════════════════════════════════╗
       ║  PDCA — Timeline & Stagger open/close         ║
       ╚══════════════════════════════════════════════╝ */

    // 1. Headings Reveal
    gsap.fromTo(['.sf-pdca-badge', '.sf-pdca-title'],
      { y: 30, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power3.out',
        scrollTrigger: {
          trigger: '.sf-pdca',
          start: 'top 80%',
          toggleActions: 'play none none reverse'
        }
      }
    );

    // 2. Cards Reveal
    gsap.fromTo('.sf-pdca-card',
      { y: 60, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.8, stagger: 0.12, ease: 'back.out(1.2)',
        scrollTrigger: {
          trigger: '.sf-pdca-grid',
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        }
      }
    );

    // 3. Dots Reveal
    gsap.fromTo('.sf-pdca-dot',
      { scale: 0, opacity: 0 },
      {
        scale: 1, opacity: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(2)',
        delay: 0.2, // slight delay after cards start
        scrollTrigger: {
          trigger: '.sf-pdca-grid',
          start: 'top 85%',
          toggleActions: 'play none none reverse'
        }
      }
    );

    // 4. Scrubbed line draw across the top of the cards
    gsap.fromTo('.sf-pdca-line',
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: '.sf-pdca-grid',
          start: 'top 85%',
          end: 'top 20%',
          scrub: 1
        }
      }
    );

  }, { scope: mainRef });

  // ─── Inline style objects (clean & reusable) ────────────────────────────

  const sectionBg = '#f8fafc';
  const white = '#ffffff';
  const borderLight = '1px solid rgba(0,0,0,0.05)';

  const cardStyle = (idx) => ({
    width: 360,
    minHeight: 400,
    background: white,
    borderRadius: 24,
    padding: '2.5rem 2.25rem',
    display: 'flex',
    flexDirection: 'column',
    border: borderLight,
    boxShadow: '0 12px 40px rgba(0,0,0,0.04)',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
    transition: 'transform 0.35s cubic-bezier(.25,.46,.45,.94), box-shadow 0.35s ease'
  });

  return (
    <div ref={mainRef} style={{ background: sectionBg, color: 'var(--secondary)' }}>

      {/* ───────────── 1 · HERO ───────────── */}
      <section
        className="sf-hero"
        style={{
          minHeight: 'calc(100vh - 72px)',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          padding: '6rem 2.5rem 4rem',
          position: 'relative', overflow: 'hidden',
          background: sectionBg, textAlign: 'center'
        }}
      >
        {/* Ambient glows */}
        <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 1100, height: 1100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(27,141,153,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />

        {/* Main content block */}
        <div className="sf-hero-content" style={{ position: 'relative', zIndex: 1, maxWidth: 900, width: '100%' }}>

          {/* Badge */}
          <div className="sf-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(27,141,153,0.05)', color: 'var(--primary)',
            padding: '0.4rem 1.2rem', borderRadius: 100,
            fontSize: '0.68rem', fontWeight: 700, letterSpacing: 3.5,
            textTransform: 'uppercase', marginBottom: '3rem',
            border: '1px solid rgba(27,141,153,0.08)'
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', opacity: 0.7 }} />
            Standardisasi Nasional
          </div>

          {/* Title — each line in its own overflow clip mask */}
          <h1 style={{ fontSize: 'clamp(3.5rem, 7.5vw, 7rem)', fontWeight: 800, lineHeight: 1, letterSpacing: '-3px', margin: '0 0 2.5rem', color: 'var(--secondary)' }}>
            <div style={{ overflow: 'hidden', paddingBottom: 4 }}>
              <div className="sf-title-line">Kerangka</div>
            </div>
            <div style={{ overflow: 'hidden', paddingBottom: 4 }}>
              <div className="sf-title-line" style={{ color: 'var(--primary)' }}>Strategis.</div>
            </div>
          </h1>

          {/* Decorative line — draws in from center via GSAP */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <div className="sf-hero-line" style={{ width: 80, height: 2, background: 'var(--primary)', opacity: 0.3, transformOrigin: 'center' }} />
          </div>

          {/* Subtitle */}
          <p className="sf-subtitle" style={{
            fontSize: 'clamp(1rem, 1.5vw, 1.15rem)',
            color: 'var(--text-muted)', lineHeight: 1.85,
            maxWidth: 560, margin: '0 auto',
          }}>
            Dokumen teknis dan arsitektur operasional pemantauan kinerja Institut Teknologi PLN.
            Dirancang untuk <strong style={{ color: 'var(--secondary)' }}>akurasi, skalabilitas, dan transparansi absolut.</strong>
          </p>
        </div>

        {/* Stats bar — horizontal, sits below title */}
        <div
          className="sf-hero-stats"
          style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'stretch',
            gap: 0, marginTop: '4rem',
            background: white, borderRadius: 20,
            border: borderLight,
            boxShadow: '0 16px 60px rgba(0,0,0,0.05)',
            overflow: 'hidden',
            maxWidth: 680, width: '100%'
          }}
        >
          {/* Stat 1 */}
          <div className="sf-stat-item" style={{ flex: 1, padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: borderLight }}>
            <div className="counter-8" style={{ fontSize: '3.2rem', fontWeight: 800, color: 'var(--secondary)', letterSpacing: -3, lineHeight: 1 }}>00</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 6 }}>Indikator</div>
          </div>

          {/* Stat 2 */}
          <div className="sf-stat-item" style={{ flex: 1, padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: borderLight }}>
            <div className="counter-95" style={{ fontSize: '3.2rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: -2, lineHeight: 1 }}>0%</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 6 }}>Target Mutu</div>
          </div>

          {/* Stat 3 */}
          <div className="sf-stat-item" style={{ flex: 1, padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--secondary)', letterSpacing: -0.5, lineHeight: 1 }}>Otomatis</div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 6 }}>Validasi</div>
          </div>
        </div>

      </section>

      {/* ───────────── 2 · HORIZONTAL SCROLL PILLARS ───────────── */}
      <section
        className="sf-pillars"
        style={{
          height: '100vh',
          display: 'flex',
          overflow: 'hidden',
          background: sectionBg
        }}
      >
        {/* Sidebar */}
        <div
          className="sf-pillars-sidebar"
          style={{
            width: '32vw', minWidth: 340, maxWidth: 480,
            flexShrink: 0, padding: '0 4vw',
            background: sectionBg,
            borderRight: borderLight,
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            zIndex: 5
          }}
        >
          <div className="sf-pillars-sidebar-inner" style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: 4,
              color: 'var(--primary)', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem'
            }}>
              <span style={{ width: 28, height: 2, background: 'var(--primary)', display: 'inline-block', flexShrink: 0 }} />
              Delapan Pilar
            </span>

            <h2 style={{
              fontSize: 'clamp(1.8rem, 3vw, 3.2rem)',
              fontWeight: 800, letterSpacing: -1.5,
              margin: '0 0 1.25rem', lineHeight: 1.05, color: 'var(--secondary)'
            }}>
              Ketetapan<br />Kementerian.
            </h2>

            <p style={{ fontSize: '0.95rem', lineHeight: 1.8, color: 'var(--text-muted)', maxWidth: 270, marginBottom: '2.5rem' }}>
              Standar mutu absolut yang wajib dipenuhi seluruh entitas akademik di lingkungan institusi.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 1, background: 'var(--text-muted)', opacity: 0.3 }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Scroll untuk menjelajahi
              </span>
              <ArrowRight size={12} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            </div>
          </div>
        </div>

        {/* Track */}
        <div
          className="sf-pillars-track"
          style={{
            display: 'flex', alignItems: 'center',
            gap: '1.75rem', paddingLeft: '2.5rem', paddingRight: '15vw',
            flexShrink: 0, willChange: 'transform'
          }}
        >
          {ikuData.map((iku, idx) => (
            <div
              key={idx}
              className="sf-pillar-card"
              style={cardStyle(idx)}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 24px 64px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.04)';
              }}
            >
              {/* Top accent line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, var(--primary) ${(idx + 1) * 12}%, transparent)`, opacity: 0.5 }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem' }}>
                <div style={{ background: 'rgba(27,141,153,0.06)', color: 'var(--primary)', padding: '0.8rem', borderRadius: 14, border: '1px solid rgba(27,141,153,0.08)' }}>
                  {iku.icon}
                </div>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: 'rgba(0,0,0,0.03)', letterSpacing: -2, lineHeight: 1 }}>
                  0{idx + 1}
                </span>
              </div>

              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: -0.5, margin: '0 0 0.75rem', color: 'var(--secondary)', lineHeight: 1.25 }}>
                {iku.title}
              </h3>

              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.75, flex: 1 }}>
                {iku.desc}
              </p>

              {/* Bottom link */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '1.5rem', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: 0.5 }}>
                <span>Lihat detail</span>
                <ArrowRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── 3 · PDCA CYCLE ───────────── */}
      <section className="sf-pdca" style={{ padding: '10rem 0', background: white, position: 'relative', zIndex: 10 }}>

        {/* Subtle background separator */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent)' }} />

        <div className="container" style={{ padding: '0 2.5rem', maxWidth: 1200, margin: '0 auto' }}>

          <div className="sf-pdca-head" style={{ marginBottom: '6rem', textAlign: 'center' }}>
            <div className="sf-pdca-badge" style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: 4,
              color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1.5rem'
            }}>
              <span style={{ width: 16, height: 2, background: 'var(--primary)', opacity: 0.5 }} />
              Arsitektur PDCA
              <span style={{ width: 16, height: 2, background: 'var(--primary)', opacity: 0.5 }} />
            </div>
            <h2 className="sf-pdca-title" style={{ fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', fontWeight: 800, letterSpacing: -2, margin: 0, lineHeight: 1.05, color: 'var(--secondary)' }}>
              Siklus Operasional.
            </h2>
          </div>

          <div style={{ position: 'relative' }}>
            {/* Background Track Line */}
            <div style={{ position: 'absolute', top: 0, left: '2rem', right: '2rem', height: 2, background: 'rgba(0,0,0,0.04)', borderRadius: 2 }} />

            {/* The Scrubbed Animated Line */}
            <div className="sf-pdca-line" style={{ position: 'absolute', top: 0, left: '2rem', right: '2rem', height: 2, background: 'var(--primary)', transformOrigin: 'left center', borderRadius: 2 }} />

            <div
              className="sf-pdca-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '2rem',
                paddingTop: '3rem'
              }}
            >
              {pdcaData.map((step, idx) => (
                <div
                  key={idx}
                  className="sf-pdca-card"
                  style={{
                    display: 'flex', flexDirection: 'column',
                    position: 'relative',
                    padding: '2.5rem 2rem',
                    background: 'rgba(248, 250, 252, 0.4)',
                    borderRadius: 24,
                    border: '1px solid rgba(0,0,0,0.03)',
                    transition: 'all 0.4s cubic-bezier(.25,.46,.45,.94)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.boxShadow = '0 24px 48px rgba(0,0,0,0.06)';
                    e.currentTarget.style.borderColor = 'rgba(27,141,153,0.15)';
                    e.currentTarget.style.transform = 'translateY(-8px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(248, 250, 252, 0.4)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.03)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Connecting dot to the line above */}
                  <div className="sf-pdca-dot" style={{
                    position: 'absolute', top: '-3.35rem', left: '2rem',
                    width: 12, height: 12, borderRadius: '50%',
                    background: '#fff',
                    border: '3px solid var(--primary)',
                    boxShadow: '0 0 0 4px rgba(27,141,153,0.1)'
                  }} />

                  <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'rgba(27,141,153,0.08)', lineHeight: 0.8, letterSpacing: -2, marginBottom: '2rem', fontFamily: 'system-ui' }}>
                    0{idx + 1}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', letterSpacing: 3, fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase' }}>
                    Fase {step.phase}
                  </div>
                  <h3 style={{ fontSize: '1.4rem', color: 'var(--secondary)', fontWeight: 800, margin: '0 0 0.8rem', letterSpacing: -0.5 }}>
                    {step.title}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.7, margin: 0 }}>
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
