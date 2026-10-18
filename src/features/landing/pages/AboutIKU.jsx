import { useRef, useEffect } from 'react';
import { Target, BookOpen, ShieldCheck, Scale, Building, Activity, ArrowDown } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function AboutIKU() {
  const containerRef = useRef();
  const visiMisiRef = useRef();
  const leftVisiRef = useRef();

  useGSAP(() => {
    // 1. Initial Hero Animations
    const tl = gsap.timeline();
    tl.fromTo('.hero-text-anim',
      { y: 80, opacity: 0, rotateX: -45 },
      { y: 0, opacity: 1, rotateX: 0, duration: 1.2, stagger: 0.15, ease: 'power4.out', delay: 0.1 }
    )
      .fromTo('.hero-light-card',
        { x: 100, opacity: 0, rotation: 5 },
        { x: 0, opacity: 1, rotation: -2, duration: 1.5, ease: 'expo.out' },
        "-=1.2"
      );

    // 2. Extreme Hero Parallax (Scroll View)
    gsap.to('.hero-light-card', {
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 1.5
      },
      y: 150, // Moves down slower than the page
      rotation: 2,
      ease: 'none'
    });

    // 3. Scrub Text Reveal for Rasionalisasi
    const paras = gsap.utils.toArray('.scrub-text');
    paras.forEach(para => {
      gsap.fromTo(para,
        { opacity: 0.2, y: 50 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: para,
            start: 'top 90%',
            end: 'top 50%',
            scrub: 1
          }
        }
      );
    });

    // 4. Pinned Section Scroll View (The "Gokil" Effect)
    // Pins the left "Visi" card while the right "Misi" list scrolls past
    ScrollTrigger.matchMedia({
      // Only pin on desktop where there's enough space
      "(min-width: 1024px)": function () {
        gsap.to(leftVisiRef.current, {
          scrollTrigger: {
            trigger: visiMisiRef.current,
            start: "top 15%",
            end: "bottom 85%", // Unpins when the bottom of the section reaches 85%
            pin: leftVisiRef.current,
            pinSpacing: false,
            scrub: 1
          }
        });
      }
    });

    // 5. Stagger Misi Cards from Right
    const missionCards = gsap.utils.toArray('.clean-mission-card');
    missionCards.forEach((card, i) => {
      gsap.fromTo(card,
        { x: 100, opacity: 0 },
        {
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
          },
          x: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out'
        }
      );
    });

    // 6. Dasar Hukum Cards Fan-Out Effect
    const hukumCards = gsap.utils.toArray('.hukum-card');
    gsap.fromTo(hukumCards,
      { y: 150, opacity: 0, rotation: 5 },
      {
        scrollTrigger: {
          trigger: '.hukum-section',
          start: 'top 75%'
        },
        y: 0,
        opacity: 1,
        rotation: 0,
        duration: 1.2,
        stagger: 0.15,
        ease: 'back.out(1.2)'
      }
    );

  }, { scope: containerRef });

  return (
    <div ref={containerRef} style={{ background: '#ffffff', minHeight: '100vh', color: 'var(--secondary)', overflow: 'hidden' }}>

      {/* Background Decor */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      </div>

      {/* HERO SECTION WITH PARALLAX */}
      <section className="hero-section" style={{ paddingTop: '10rem', paddingBottom: '6rem', position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ padding: '0 2rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4rem', alignItems: 'center' }}>

            <div style={{ flex: '1 1 500px', perspective: '1000px' }}>
              <div style={{ overflow: 'hidden' }}>
                <p className="hero-text-anim" style={{ color: 'var(--primary)', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', fontSize: '0.85rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Activity size={16} /> Pusat Kecerdasan Kinerja
                </p>
              </div>

              <div style={{ overflow: 'hidden', paddingBottom: '10px' }}>
                <h1 className="hero-text-anim" style={{ fontSize: 'clamp(3rem, 7vw, 5.5rem)', color: 'var(--secondary)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-2px', margin: '0 0 1rem 0' }}>
                  Strategi. <br />
                  <span style={{ color: 'transparent', WebkitTextStroke: '2px var(--secondary)' }}>Presisi.</span> <br />
                  Institusi.
                </h1>
              </div>

              <div style={{ overflow: 'hidden' }}>
                <p className="hero-text-anim" style={{ color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1.8, maxWidth: '500px', marginTop: '1.5rem', fontWeight: 400 }}>
                  Menyatukan visi besar ITPLN ke dalam ekosistem pengukuran kinerja yang sangat dinamis, terpusat, dan terotomatisasi.
                </p>
              </div>

              <div className="hero-text-anim" style={{ marginTop: '4rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
                Scroll ke bawah <ArrowDown size={16} className="animate-bounce" />
              </div>
            </div>

            {/* Parallax Card */}
            <div style={{ flex: '1 1 400px', position: 'relative' }}>
              <div className="hero-light-card" style={{
                position: 'relative',
                borderRadius: '24px',
                padding: '1rem',
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 30px 60px rgba(9, 78, 104, 0.1)',
                backdropFilter: 'blur(20px)'
              }}>
                <div style={{
                  width: '100%',
                  height: '450px',
                  borderRadius: '16px',
                  backgroundImage: 'url("/pln_view.jpg")',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}></div>
                <div
                  className="about-hero-target-badge"
                  style={{
                    position: 'absolute',
                    bottom: '-2rem',
                    left: '-2rem',
                    background: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    padding: '1.5rem 2rem',
                    borderRadius: '20px',
                    boxShadow: '0 20px 40px rgba(9, 78, 104, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                  }}
                >
                  <div style={{ background: 'var(--primary)', padding: '1rem', borderRadius: '12px' }}>
                    <Target size={32} color="white" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--secondary)' }}>100%</h4>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Fokus Terukur</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 01: RASIONALISASI (Scrub Motion) */}
      <section style={{ position: 'relative', zIndex: 10, padding: '10rem 0' }}>
        <div className="container" style={{ padding: '0 2rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4rem' }}>
            <div style={{ flex: '1 1 300px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem', background: 'rgba(27, 141, 153, 0.1)', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', fontSize: '0.85rem', marginBottom: '2rem' }}>
                <Building size={16} /> 01. Rasionalisasi
              </div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: 'var(--secondary)', fontWeight: 800, margin: 0, letterSpacing: '-1px', lineHeight: 1.1 }}>
                Fondasi Keunggulan Operasional.
              </h2>
            </div>
            <div style={{ flex: '2 1 500px' }}>
              <p className="scrub-text" style={{ color: 'var(--secondary)', fontSize: '1.75rem', lineHeight: 1.6, marginBottom: '2.5rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
                Dalam menghadapi dinamika pendidikan tinggi dan tuntutan industri, Institut Teknologi PLN membutuhkan instrumen kemudi strategis yang mutlak presisi.
              </p>
              <p className="scrub-text" style={{ color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1.8, margin: 0 }}>
                Indikator Kinerja Utama (IKU) dirancang bukan sekadar sebagai alat ukur administratif, melainkan sebagai kompas yang menyelaraskan seluruh elemen institusi. Melalui sistem tata kelola kinerja terpusat ini, kami menerjemahkan visi besar menjadi serangkaian tindakan terukur secara aktual dan terdigitalisasi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 02: VISI & MISI (GSAP Scroll Pinning) */}
      <section ref={visiMisiRef} style={{ position: 'relative', zIndex: 10, padding: '8rem 0', background: 'rgba(248, 250, 252, 0.8)', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="container" style={{ padding: '0 2rem' }}>

          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '3px', color: 'var(--primary)', textTransform: 'uppercase' }}>
              02. Arah Stratejik
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4rem' }}>

            {/* LEFT COLUMN: PINNED VISI */}
            <div style={{ flex: '1 1 400px' }}>
              <div ref={leftVisiRef} style={{
                background: 'white',
                borderRadius: '32px',
                padding: '4rem 3rem',
                textAlign: 'left',
                border: '1px solid rgba(0,0,0,0.03)',
                boxShadow: '0 20px 50px rgba(9, 78, 104, 0.05)',
              }}>
                <Target size={48} color="var(--primary)" style={{ marginBottom: '2rem' }} strokeWidth={1.5} />
                <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: '1.5rem' }}>Visi Institusi</h4>
                <h2 style={{ fontSize: '2.5rem', color: 'var(--secondary)', fontWeight: 800, lineHeight: 1.2, letterSpacing: '-1px', margin: 0 }}>
                  Menjadi Perguruan Tinggi Berkelas Internasional yang Unggul dan Terpercaya.
                </h2>
              </div>
            </div>

            {/* RIGHT COLUMN: SCROLLING MISI */}
            <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '2rem', paddingTop: '4rem' }}>
              {[
                { icon: <BookOpen size={28} strokeWidth={1.5} />, text: "Menyelenggarakan pendidikan akademik dan terapan berbasis teknologi berstandar internasional." },
                { icon: <Activity size={28} strokeWidth={1.5} />, text: "Melaksanakan penelitian inovatif yang berorientasi pada pengembangan industri energi dan teknologi." },
                { icon: <Building size={28} strokeWidth={1.5} />, text: "Melakukan pengabdian kepada masyarakat secara berkelanjutan dalam rangka peningkatan kualitas hidup." },
                { icon: <Scale size={28} strokeWidth={1.5} />, text: "Menjalin kerjasama strategis dengan institusi nasional maupun internasional untuk menunjang tridharma perguruan tinggi." }
              ].map((misi, idx) => (
                <div key={idx} className="clean-mission-card" style={{
                  background: 'white',
                  border: '1px solid rgba(0,0,0,0.04)',
                  padding: '3rem',
                  borderRadius: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 10px 30px rgba(9, 78, 104, 0.02)'
                }}
                  onMouseEnter={(e) => {
                    gsap.to(e.currentTarget, { y: -5, boxShadow: '0 20px 40px rgba(9, 78, 104, 0.06)', borderColor: 'rgba(27, 141, 153, 0.2)', duration: 0.3 });
                  }}
                  onMouseLeave={(e) => {
                    gsap.to(e.currentTarget, { y: 0, boxShadow: '0 10px 30px rgba(9, 78, 104, 0.02)', borderColor: 'rgba(0,0,0,0.04)', duration: 0.3 });
                  }}
                >
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(27, 141, 153, 0.05) 0%, transparent 70%)', transform: 'translate(20%, -20%)' }}></div>

                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                    <div style={{ color: 'var(--primary)', background: 'rgba(27, 141, 153, 0.1)', padding: '1rem', borderRadius: '12px' }}>
                      {misi.icon}
                    </div>
                    <div>
                      <span style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 700, letterSpacing: '2px', display: 'block', marginBottom: '0.5rem' }}>0{idx + 1}</span>
                      <p style={{ color: 'var(--secondary)', fontSize: '1.15rem', lineHeight: 1.7, margin: 0, fontWeight: 500 }}>
                        {misi.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 03: DASAR HUKUM (Fan-out Reveal) */}
      <section className="hukum-section" style={{ position: 'relative', zIndex: 10, padding: '10rem 0 10rem 0' }}>
        <div className="container" style={{ padding: '0 2rem' }}>

          <div style={{ textAlign: 'center', marginBottom: '6rem', maxWidth: '800px', margin: '0 auto 6rem auto' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '3px', color: 'var(--primary)', textTransform: 'uppercase', display: 'block', marginBottom: '1.5rem' }}>
              03. Landasan Yuridis
            </span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--secondary)', fontWeight: 800, margin: 0, letterSpacing: '-1px', lineHeight: 1.2 }}>
              Kerangka Hukum & Regulasi.
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2.5rem'
          }}>
            {[
              { id: "PERPRES 12/2025", title: "Peraturan Presiden", desc: "No. 12 Tahun 2025 tentang Penyelenggaraan Pendidikan Tinggi Strategis Nasional." },
              { id: "PERMEN 40/2025", title: "Peraturan Menteri", desc: "No. 40 Tahun 2025 tentang Standar Penjaminan Mutu dan Indikator Kinerja." },
              { id: "KEPMEN 358", title: "Keputusan Menteri", desc: "No. 358/M/KEP/2025 tentang Penetapan IKU Perguruan Tinggi Berbadan Hukum." }
            ].map((item, idx) => (
              <div key={idx} className="hukum-card" style={{
                background: 'white',
                padding: '3rem',
                borderRadius: '24px',
                border: '1px solid rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: '0 15px 35px rgba(9, 78, 104, 0.03)'
              }}
                onMouseEnter={(e) => {
                  gsap.to(e.currentTarget, { y: -10, boxShadow: '0 25px 50px rgba(9, 78, 104, 0.08)', borderColor: 'rgba(27, 141, 153, 0.3)', duration: 0.4 });
                }}
                onMouseLeave={(e) => {
                  gsap.to(e.currentTarget, { y: 0, boxShadow: '0 15px 35px rgba(9, 78, 104, 0.03)', borderColor: 'rgba(0,0,0,0.05)', duration: 0.4 });
                }}
              >
                <div style={{ marginBottom: '3rem', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <ShieldCheck size={32} color="var(--primary)" strokeWidth={1.5} />
                  <div style={{ color: 'rgba(9, 78, 104, 0.1)', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '2px' }}>
                    0{idx + 1}
                  </div>
                </div>

                <div style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1.5px', marginBottom: '1rem' }}>
                  {item.id}
                </div>
                <h3 style={{ fontSize: '1.75rem', color: 'var(--secondary)', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.5px' }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.7, margin: 0 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

    </div>
  );
}
