import { useRef, useEffect } from 'react';
import { Target, TrendingUp, Users, BookOpen, Briefcase, Globe, Award, ShieldCheck } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const ikuData = [
  { icon: <Briefcase size={28} />, title: "Lulusan Mendapat Pekerjaan Layak", desc: "Alumni berhasil diserap di industri tingkat atas, membangun wirausaha sukses, atau melanjutkan studi lanjutan dalam waktu singkat setelah kelulusan." },
  { icon: <Globe size={28} />, title: "Pengalaman Mahasiswa di Luar Kampus", desc: "Mahasiswa aktif berpartisipasi dalam magang industri, proyek desa, riset, wirausaha, atau pertukaran pelajar internasional." },
  { icon: <Users size={28} />, title: "Dosen Berkegiatan di Luar Kampus", desc: "Aktivitas tridharma dosen yang teraplikasi langsung di industri atau perguruan tinggi lain, memperluas jaringan dan dampak." },
  { icon: <BookOpen size={28} />, title: "Praktisi Mengajar di Kampus", desc: "Profesional dan pakar industri membawa studi kasus dan pengalaman riil secara langsung ke dalam ruang kelas akademik." },
  { icon: <TrendingUp size={28} />, title: "Hasil Kerja Dosen Digunakan Masyarakat", desc: "Riset terapan, paten, karya seni, atau teknologi tepat guna yang secara nyata terimplementasi dan bermanfaat bagi masyarakat." },
  { icon: <Target size={28} />, title: "Kerjasama Program Studi dengan Mitra Dunia", desc: "Kemitraan strategis tingkat global yang memfasilitasi kurikulum mutakhir, program magang, dan penyerapan lulusan." },
  { icon: <Award size={28} />, title: "Kelas Kolaboratif dan Partisipatif", desc: "Transformasi pedagogik menggunakan metode pemecahan masalah (Case Method) dan pembelajaran berbasis proyek kelompok." },
  { icon: <ShieldCheck size={28} />, title: "Program Studi Berstandar Internasional", desc: "Pengakuan resmi melalui akreditasi global bergengsi yang memposisikan program studi setara dengan standar pendidikan dunia." }
];

export default function Framework() {
  const containerRef = useRef();
  const stackedCardsRef = useRef();

  useGSAP(() => {
    // 1. Hero Reveal (Clean Fade Up)
    gsap.fromTo('.fw-hero-el',
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, stagger: 0.15, ease: 'power3.out', delay: 0.2 }
    );

    // 2. STACKED CARDS SCROLL MOTION (The "Apple" Effect)
    ScrollTrigger.matchMedia({
      "(min-width: 1024px)": function() {
        const cards = gsap.utils.toArray('.iku-stacked-card');
        
        // We will pin the whole wrapper
        ScrollTrigger.create({
          trigger: stackedCardsRef.current,
          pin: true,
          start: "top top",
          end: () => `+=${cards.length * 100}%`, // Scroll distance based on number of cards
          scrub: 1,
        });

        cards.forEach((card, i) => {
          if (i === 0) return; // First card is already visible

          // Animate each subsequent card to slide up and cover the previous ones
          gsap.fromTo(card,
            { y: "150vh", scale: 0.9, opacity: 0 },
            {
              y: `${i * 30}px`, // Slight offset so they look like a deck of cards
              scale: 1,
              opacity: 1,
              ease: "none",
              scrollTrigger: {
                trigger: stackedCardsRef.current,
                start: () => `top -${(i - 1) * 100}%`,
                end: () => `top -${i * 100}%`,
                scrub: 1,
              }
            }
          );
        });
      },
      // Fallback for mobile: standard fade up
      "(max-width: 1023px)": function() {
        gsap.utils.toArray('.iku-stacked-card').forEach(card => {
          gsap.fromTo(card, 
            { y: 50, opacity: 0 },
            {
              y: 0, opacity: 1,
              scrollTrigger: {
                trigger: card,
                start: "top 85%",
              }
            }
          );
        });
      }
    });

    // 3. Diagram Cycle Reveal
    gsap.fromTo('.cycle-card',
      { y: 50, opacity: 0 },
      {
        scrollTrigger: {
          trigger: '.cycle-wrapper',
          start: 'top 80%',
        },
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power3.out'
      }
    );

  }, { scope: containerRef });

  return (
    <div ref={containerRef} style={{ background: '#f8fafc', minHeight: '100vh', color: 'var(--secondary)', overflow: 'hidden' }}>
      
      {/* 1. CLEAN PREMIUM HERO */}
      <section style={{ paddingTop: '12rem', paddingBottom: '6rem', position: 'relative' }}>
        
        {/* Soft Background Gradient */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '800px', background: 'radial-gradient(circle at 80% 0%, rgba(27, 141, 153, 0.08) 0%, rgba(248, 250, 252, 0) 60%)', zIndex: 0, pointerEvents: 'none' }}></div>
        
        <div className="container relative" style={{ padding: '0 2rem', zIndex: 10 }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
            
            <div className="fw-hero-el" style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(27, 141, 153, 0.1)', color: 'var(--primary)', padding: '0.75rem 1.5rem', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '2rem' }}>
              Standardisasi Nasional
            </div>
            
            <h1 className="fw-hero-el" style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-2px', margin: '0 0 1.5rem 0', color: 'var(--secondary)' }}>
              Kerangka <br />
              <span style={{ background: 'linear-gradient(90deg, var(--secondary), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Strategis Mutu.</span>
            </h1>
            
            <p className="fw-hero-el" style={{ fontSize: 'clamp(1.1rem, 2vw, 1.35rem)', color: 'var(--text-muted)', lineHeight: 1.8, maxWidth: '700px', margin: '0 auto 4rem auto', fontWeight: 400 }}>
              Dokumen teknis dan arsitektur operasional pemantauan kinerja Institut Teknologi PLN. Dirancang khusus untuk akurasi, skalabilitas, dan transparansi data absolut.
            </p>

            {/* Quick Metrics */}
            <div className="fw-hero-el" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '3rem', background: '#ffffff', padding: '3rem', borderRadius: '32px', boxShadow: '0 20px 40px rgba(9, 78, 104, 0.04)', border: '1px solid rgba(0,0,0,0.02)' }}>
              {[
                { label: 'Indikator Utama', val: '08' },
                { label: 'Target Mutu', val: '95%' },
                { label: 'Sistem Validasi', val: 'Otomatis' }
              ].map((metric, idx) => (
                <div key={idx} style={{ padding: '0 2rem', borderRight: idx !== 2 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <div style={{ fontSize: '3rem', color: 'var(--secondary)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1, marginBottom: '0.5rem' }}>{metric.val}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>{metric.label}</div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* 2. THE 8 IKU STACKED CARDS MOTION */}
      {/* This section will be pinned. The cards will stack over each other. */}
      <section ref={stackedCardsRef} style={{ padding: '4rem 0', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ padding: '0 2rem', display: 'flex', flexWrap: 'wrap', gap: '4rem' }}>
          
          {/* Static Title Column */}
          <div className="iku-title-column" style={{ flex: '1 1 400px', paddingBottom: '4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '3px', color: 'var(--primary)', textTransform: 'uppercase', display: 'block', marginBottom: '1.5rem' }}>
              Delapan Pilar
            </span>
            <h2 style={{ fontSize: 'clamp(2.5rem, 4vw, 4rem)', fontWeight: 800, letterSpacing: '-1.5px', margin: '0 0 2rem 0', lineHeight: 1.1, color: 'var(--secondary)' }}>
              Ketetapan <br/>Kementerian.
            </h2>
            <p style={{ fontSize: '1.25rem', lineHeight: 1.8, color: 'var(--text-muted)' }}>
              Setiap poin merepresentasikan standar mutu absolut yang wajib dipenuhi oleh seluruh entitas akademik di lingkungan institusi, membangun pondasi yang kokoh untuk masa depan.
            </p>
          </div>

          {/* Stacking Cards Column */}
          <div style={{ flex: '1 1 500px', position: 'relative', height: '550px' }}>
            {ikuData.map((iku, idx) => (
              <div key={idx} className="iku-stacked-card" style={{ 
                position: 'absolute',
                top: 0, left: 0, right: 0,
                background: '#ffffff', 
                padding: '4rem',
                borderRadius: '32px',
                boxShadow: '0 30px 60px rgba(9, 78, 104, 0.08)',
                border: '1px solid rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: idx + 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                  <div style={{ background: 'rgba(27, 141, 153, 0.1)', color: 'var(--primary)', padding: '1rem', borderRadius: '16px' }}>
                    {iku.icon}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'rgba(0,0,0,0.1)', letterSpacing: '2px' }}>
                    0{idx + 1}
                  </div>
                </div>
                
                <h3 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-1px', margin: '0 0 1.5rem 0', color: 'var(--secondary)' }}>
                  {iku.title}
                </h3>
                <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                  {iku.desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 3. ARCHITECTURE CYCLE (PDCA) */}
      <section className="cycle-wrapper" style={{ padding: '10rem 0', background: 'var(--secondary)', color: 'white', borderTopLeftRadius: '60px', borderTopRightRadius: '60px' }}>
        <div className="container" style={{ padding: '0 2rem' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '6rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '3px', color: 'var(--primary-light)', textTransform: 'uppercase', display: 'block', marginBottom: '1.5rem' }}>
              Arsitektur PDCA
            </span>
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, letterSpacing: '-1.5px', margin: 0, lineHeight: 1.1 }}>
              Siklus Operasional Data.
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem' }}>
            {[
              { phase: "PLAN", title: "Pemetaan", text: "Menetapkan target metrik dari rektorat ke unit terkecil secara hierarkis." },
              { phase: "DO", title: "Eksekusi", text: "Pelaksanaan program kerja yang tercatat langsung dalam sistem basis data." },
              { phase: "CHECK", title: "Validasi", text: "Sistem otomasi memverifikasi anomali data sebelum dipublikasikan." },
              { phase: "ACT", title: "Tindak Lanjut", text: "Rekomendasi strategis dikeluarkan secara algoritmik untuk perbaikan." }
            ].map((step, idx) => (
              <div key={idx} className="cycle-card" style={{ 
                background: 'rgba(255,255,255,0.03)',
                padding: '3rem',
                borderRadius: '32px',
                border: '1px solid rgba(255,255,255,0.05)',
                position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: '-25px', left: '3rem', background: 'var(--primary)', color: 'white', width: '50px', height: '50px', borderRadius: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', boxShadow: '0 10px 20px rgba(27, 141, 153, 0.4)' }}>
                  {idx + 1}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', fontWeight: 700, marginTop: '1rem', marginBottom: '1rem' }}>
                  FASE {step.phase}
                </div>
                <h3 style={{ fontSize: '1.75rem', color: 'white', fontWeight: 800, margin: '0 0 1rem 0', letterSpacing: '-0.5px' }}>
                  {step.title}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', lineHeight: 1.6, margin: 0 }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

    </div>
  );
}
