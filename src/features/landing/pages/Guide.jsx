import { useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function Guide() {
  const mainRef = useRef();

  useGSAP(() => {
    // Prevent layout shift bugs by refreshing scrolltrigger
    ScrollTrigger.refresh();

    // 1. Hero Parallax (Extreme Elastic Distance)
    gsap.to('.hero-parallax', {
      y: 400,
      opacity: 0,
      scale: 0.85,
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 1.5
      }
    });

    // Watermark Extreme Parallax
    gsap.to('.watermark-iku', {
      y: 500,
      x: -100,
      scrollTrigger: { trigger: '.hero-section', start: 'top top', end: 'bottom top', scrub: 2 }
    });

    // 2. Animate content blocks dynamically on scroll
    const blocks = gsap.utils.toArray('.guide-block');
    blocks.forEach((block) => {
      // Line draw perfectly synced
      gsap.fromTo(block.querySelector('.g-line'),
        { scaleX: 0 },
        {
          scaleX: 1, transformOrigin: 'left',
          scrollTrigger: { trigger: block, start: 'top 100%', end: 'top 40%', scrub: 1 }
        }
      );

      // Content slide up (Massive Travel Distance)
      gsap.fromTo(block.querySelector('.g-content'),
        { y: 250, opacity: 0 },
        {
          y: 0, opacity: 1,
          scrollTrigger: { trigger: block, start: 'top 95%', end: 'top 40%', scrub: 1.5 }
        }
      );

      // EXTREME Parallax for the massive background numbers
      gsap.fromTo(block.querySelector('.g-num'),
        { y: -250, scale: 0.7 },
        {
          y: 250, scale: 1.2,
          scrollTrigger: { trigger: block, start: 'top bottom', end: 'bottom top', scrub: 2 }
        }
      );
    });

    // 3. Bottom CTA Reveal (Massive Swing)
    gsap.fromTo('.cta-content',
      { y: 300, opacity: 0, scale: 0.85 },
      {
        y: 0, opacity: 1, scale: 1,
        scrollTrigger: { trigger: '.cta-section', start: 'top 100%', end: 'top 50%', scrub: 1.5 }
      }
    );

    // Initial page load reveals (Sharp, non-scrub)
    gsap.fromTo('.reveal-init',
      { y: 150, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.5, stagger: 0.15, ease: 'power4.out', delay: 0.1 }
    );

  }, { scope: mainRef });

  return (
    <div ref={mainRef} style={{ background: '#ffffff', minHeight: '100vh', color: '#000000' }}>

      {/* ─── HERO SECTION ─── */}
      <section className="hero-section" style={{ paddingTop: '10rem', paddingBottom: '4rem', paddingLeft: '4rem', paddingRight: '4rem', borderBottom: '1px solid #000000', position: 'relative', overflow: 'hidden' }}>

        {/* Massive Subtle Watermark to balance the space */}
        <div className="watermark-iku" style={{ position: 'absolute', top: '-5vw', right: '-2vw', fontSize: '28vw', fontWeight: 900, color: 'transparent', WebkitTextStroke: '1px rgba(0,0,0,0.04)', lineHeight: 0.8, userSelect: 'none', pointerEvents: 'none', zIndex: 0 }}>
          IKU
        </div>

        <div className="hero-parallax" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1600, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'flex-end' }}>
          <div>
            <div style={{ overflow: 'hidden' }}>
              <h1 className="reveal-init" style={{ fontSize: 'clamp(5rem, 8vw, 8.5rem)', fontWeight: 400, letterSpacing: '-4px', lineHeight: 0.9, margin: 0 }}>
                Klasifikasi
              </h1>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h1 className="reveal-init" style={{ fontSize: 'clamp(5rem, 8vw, 8.5rem)', fontWeight: 400, letterSpacing: '-4px', lineHeight: 0.9, margin: 0, color: '#999999' }}>
                Indikator.
              </h1>
            </div>
          </div>
          <div style={{ paddingBottom: '1rem', overflow: 'hidden' }}>
            <p className="reveal-init" style={{ fontSize: '1.5rem', color: '#000000', margin: 0, lineHeight: 1.6, maxWidth: 550, fontWeight: 300 }}>
              Panduan definitif untuk memahami hierarki, bobot, dan prioritas sistem. Arsitektur evaluasi murni tanpa kompromi.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SPLIT-SCREEN STICKY LAYOUT ─── */}
      <section style={{ maxWidth: 1600, margin: '0 auto', display: 'flex', padding: '0 4rem', position: 'relative' }}>

        {/* Left Sticky Column */}
        <div style={{ width: '30%', position: 'relative', display: 'none', '@media(min-width: 1024px)': { display: 'block' } }}>
          <div style={{ position: 'sticky', top: '6rem', paddingTop: '6rem', height: 'fit-content' }}>
            <div className="reveal-init" style={{ display: 'inline-flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
              <ArrowRight size={20} style={{ transform: 'rotate(45deg)' }} />
              Direktori Utama
            </div>
          </div>
        </div>

        {/* Right Scrolling Column */}
        <div style={{ width: '100%', flex: 1, paddingTop: '4rem', paddingBottom: '8rem' }}>

          {/* ITEM 1 */}
          <div className="guide-block" style={{ padding: '6rem 0 10rem', position: 'relative' }}>
            <div className="g-line" style={{ width: '100%', height: 1, background: '#000000', marginBottom: '4rem' }} />

            <div style={{ position: 'relative' }}>
              <div className="g-num" style={{ position: 'absolute', top: -100, right: 0, fontSize: 'clamp(12rem, 20vw, 25rem)', fontWeight: 400, color: '#f5f5f5', letterSpacing: '-10px', lineHeight: 0.8, zIndex: 0, userSelect: 'none' }}>
                01
              </div>

              <div className="g-content" style={{ position: 'relative', zIndex: 1, maxWidth: 850 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '2rem', color: '#000000' }}>
                  [ Mandatori ]
                </div>
                <h2 style={{ fontSize: 'clamp(3rem, 5vw, 5rem)', fontWeight: 400, color: '#000000', letterSpacing: '-2px', margin: '0 0 2rem', lineHeight: 1 }}>
                  Prioritas Absolut.
                </h2>
                <p style={{ fontSize: '1.5rem', color: '#666666', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                  Indikator hierarki tertinggi yang wajib dipenuhi oleh seluruh unit operasional. Ini adalah mandat fundamental yang menjadi jangkar evaluasi kinerja institusi dari kementerian pusat. Tidak ada negosiasi. Tuntaskan sepenuhnya.
                </p>
              </div>
            </div>
          </div>

          {/* ITEM 2 */}
          <div className="guide-block" style={{ padding: '6rem 0 10rem', position: 'relative' }}>
            <div className="g-line" style={{ width: '100%', height: 1, background: '#000000', marginBottom: '4rem' }} />

            <div style={{ position: 'relative' }}>
              <div className="g-num" style={{ position: 'absolute', top: -100, right: 0, fontSize: 'clamp(12rem, 20vw, 25rem)', fontWeight: 400, color: '#f5f5f5', letterSpacing: '-10px', lineHeight: 0.8, zIndex: 0, userSelect: 'none' }}>
                02
              </div>

              <div className="g-content" style={{ position: 'relative', zIndex: 1, maxWidth: 850 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '2rem', color: '#000000' }}>
                  [ Pilihan ]
                </div>
                <h2 style={{ fontSize: 'clamp(3rem, 5vw, 5rem)', fontWeight: 400, color: '#000000', letterSpacing: '-2px', margin: '0 0 2rem', lineHeight: 1 }}>
                  Keunggulan Fokus.
                </h2>
                <p style={{ fontSize: '1.5rem', color: '#666666', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                  Fleksibilitas taktis. Anda bebas memilih indikator yang paling resonan dengan kekuatan dan spesialisasi program studi operasional. Dimensi ini menuntut perhitungan analitis untuk memaksimalkan rasio bobot kinerja.
                </p>
              </div>
            </div>
          </div>

          {/* ITEM 3 */}
          <div className="guide-block" style={{ padding: '6rem 0 4rem', position: 'relative' }}>
            <div className="g-line" style={{ width: '100%', height: 1, background: '#000000', marginBottom: '4rem' }} />

            <div style={{ position: 'relative' }}>
              <div className="g-num" style={{ position: 'absolute', top: -100, right: 0, fontSize: 'clamp(12rem, 20vw, 25rem)', fontWeight: 400, color: '#f5f5f5', letterSpacing: '-10px', lineHeight: 0.8, zIndex: 0, userSelect: 'none' }}>
                03
              </div>

              <div className="g-content" style={{ position: 'relative', zIndex: 1, maxWidth: 850 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '2rem', color: '#000000' }}>
                  [ Partisipatif ]
                </div>
                <h2 style={{ fontSize: 'clamp(3rem, 5vw, 5rem)', fontWeight: 400, color: '#000000', letterSpacing: '-2px', margin: '0 0 2rem', lineHeight: 1 }}>
                  Ekosistem Bersama.
                </h2>
                <p style={{ fontSize: '1.5rem', color: '#666666', lineHeight: 1.6, margin: 0, fontWeight: 300 }}>
                  Metrik yang digerakkan oleh sinergi aktif mahasiswa, dosen, dan mitra industri. Penilaian murni berbasis kolaborasi lapangan. Keberhasilan diukur dari luasnya jejaring ekosistem operasional yang terbangun secara riil.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── MASSIVE CTA SECTION ─── */}
      <section className="cta-section" style={{ borderTop: '1px solid #000000', padding: '10rem 4rem 12rem', position: 'relative', overflow: 'hidden' }}>
        <div className="cta-content" style={{ maxWidth: 1600, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

          <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '3rem', color: '#666666' }}>
            [ Fase Eksekusi ]
          </div>

          <a href="#" style={{
            fontSize: 'clamp(4rem, 8vw, 8rem)', fontWeight: 400, letterSpacing: '-4px', color: '#000000', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3rem', transition: 'all 0.4s ease', lineHeight: 1
          }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#999999';
              const arrow = e.currentTarget.querySelector('.arrow');
              if (arrow) arrow.style.transform = 'rotate(-45deg) translate(20px, -20px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = '#000000';
              const arrow = e.currentTarget.querySelector('.arrow');
              if (arrow) arrow.style.transform = 'rotate(0deg) translate(0, 0)';
            }}
          >
            Lihat Matriks
            <ArrowRight className="arrow" size={96} strokeWidth={1} style={{ transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
          </a>
        </div>
      </section>

    </div>
  );
}
