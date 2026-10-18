import { useRef, useState } from 'react';
import { Plus, ArrowRight, ArrowUpRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function FAQ() {
  const mainRef = useRef();
  const [activeIndex, setActiveIndex] = useState(0);

  const faqs = [
    {
      q: 'Bagaimana IKU mengukur performa secara presisi?',
      a: 'Sistem mengekstrak data operasional secara instan dari seluruh entitas, mengubahnya menjadi matriks performa komprehensif yang divalidasi langsung oleh arsitektur pusat.'
    },
    {
      q: 'Bagaimana protokol keamanan data dijalankan?',
      a: 'Seluruh input data dienkripsi dengan standar industri. Hak akses diatur secara ketat melalui kontrol otorisasi berbasis peran (RBAC) yang diawasi sistem komando.'
    },
    {
      q: 'Apakah terjadi sinkronisasi otomatis antar unit kerja?',
      a: 'Setiap modul secara otomatis tersinkronisasi. Jika terdapat diskrepansi atau anomali data, sistem akan mengeluarkan notifikasi peringatan kepada unit terkait.'
    },
    {
      q: 'Kapan pembaruan parameter tahunan dilakukan?',
      a: 'Parameter penilaian akan dievaluasi dan diperbarui setiap bulan Desember untuk memastikan keselarasan yang presisi dengan tujuan strategis tahun berikutnya.'
    },
  ];

  useGSAP(() => {
    // 1. HERO KINETIC SCROLL (Sucked into the void on scroll down)
    gsap.to('.hero-text-wrap', {
      y: -250,
      opacity: 0,
      scale: 0.9,
      scrollTrigger: {
        trigger: '.hero-section',
        start: 'top top',
        end: 'bottom top',
        scrub: 1, // Buttery smooth 1s lag
      }
    });

    // 2. FAQ ROWS (Scrubbing cascade side-entry)
    const faqRows = gsap.utils.toArray('.faq-row');
    faqRows.forEach((row, i) => {
      gsap.fromTo(row,
        { x: -100, opacity: 0, rotateY: 15 },
        {
          x: 0, opacity: 1, rotateY: 0,
          scrollTrigger: {
            trigger: row,
            start: 'top 95%',
            end: 'top 65%',
            scrub: 1
          }
        }
      );
    });

    // 3. CONTACT GRID SCRUB
    const contactItems = gsap.utils.toArray('.contact-item');
    contactItems.forEach((item, i) => {
      gsap.fromTo(item,
        { y: 150, opacity: 0, scale: 0.95 },
        {
          y: 0, opacity: 1, scale: 1,
          scrollTrigger: {
            trigger: item,
            start: 'top 95%',
            end: 'top 60%',
            scrub: 1
          }
        }
      );
    });

    // 4. MASSIVE EMAIL 3D SCRUB (The Absolute Climax)
    gsap.fromTo('.massive-email',
      { clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)', y: 150, rotateX: -30, scale: 0.9 },
      {
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', y: 0, rotateX: 0, scale: 1,
        scrollTrigger: {
          trigger: '.massive-email-container',
          start: 'top 85%',
          end: 'bottom 80%',
          scrub: 1.5
        }
      }
    );

    // 5. EXTREME PARALLAX LABELS
    gsap.to('.faq-label', {
      y: 400, ease: 'none',
      scrollTrigger: { trigger: '.faq-section', start: 'top bottom', end: 'bottom top', scrub: true }
    });

    gsap.to('.contact-label', {
      y: 400, ease: 'none',
      scrollTrigger: { trigger: '.contact-section', start: 'top bottom', end: 'bottom top', scrub: true }
    });

    // 6. KINETIC LINE DRAWS
    gsap.fromTo('.l-draw',
      { scaleX: 0 },
      {
        scaleX: 1, transformOrigin: 'left',
        scrollTrigger: { trigger: '.faq-section', start: 'top 90%', end: 'top 60%', scrub: 1 }
      }
    );
    gsap.fromTo('.l-draw-2',
      { scaleX: 0 },
      {
        scaleX: 1, transformOrigin: 'left',
        scrollTrigger: { trigger: '.contact-section', start: 'top 90%', end: 'top 60%', scrub: 1 }
      }
    );

  }, { scope: mainRef });

  return (
    <div ref={mainRef} style={{ background: '#ffffff', minHeight: '100vh', color: '#000000' }}>

      {/* ─── PURE EDITORIAL HERO ─── */}
      <section className="hero-section" style={{ paddingTop: '12rem', paddingBottom: '6rem', paddingLeft: '4rem', paddingRight: '4rem', maxWidth: 1400, margin: '0 auto' }}>
        <div className="hero-text-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'flex-end' }}>
          <div>
            <div style={{ overflow: 'hidden', paddingBottom: '1rem' }}>
              <h1 className="t-reveal" style={{ fontSize: 'clamp(4rem, 6vw, 6.5rem)', fontWeight: 400, letterSpacing: '-3px', lineHeight: 0.9, margin: 0 }}>
                Resolusi.
              </h1>
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h1 className="t-reveal" style={{ fontSize: 'clamp(4rem, 6vw, 6.5rem)', fontWeight: 400, letterSpacing: '-3px', lineHeight: 0.9, margin: 0, color: '#666666' }}>
                Informasi.
              </h1>
            </div>
          </div>
          <div style={{ paddingBottom: '0.5rem' }}>
            <div style={{ overflow: 'hidden' }}>
              <p className="t-reveal" style={{ fontSize: '1.25rem', color: '#000000', margin: 0, lineHeight: 1.6, maxWidth: 450, fontWeight: 300 }}>
                Basis data komprehensif untuk memandu operasional Anda. Eksplorasi direktori teknis murni tanpa perantara visual yang mendistraksi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PURE STRUCTURAL FAQ ─── */}
      <section className="faq-section" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 4rem 6rem' }}>
        <div className="l-draw" style={{ height: 1, background: '#000000', width: '100%', marginBottom: '4rem' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '4rem' }}>
          <div style={{ position: 'relative' }}>
            <div className="faq-label" style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
              [ Direktori Bantuan ]
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {faqs.map((faq, idx) => {
              const isActive = activeIndex === idx;
              return (
                <div key={idx} className="faq-row" style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <div
                    onClick={() => setActiveIndex(isActive ? -1 : idx)}
                    style={{
                      padding: '2.5rem 0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.paddingLeft = '1.5rem'}
                    onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}
                  >
                    <h3 style={{ fontSize: '2rem', fontWeight: 400, color: '#000000', margin: 0, letterSpacing: '-1px' }}>
                      {faq.q}
                    </h3>
                    <div style={{ transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)', transform: isActive ? 'rotate(135deg)' : 'rotate(0deg)' }}>
                      <Plus size={32} strokeWidth={1} color="#000000" />
                    </div>
                  </div>

                  <div style={{
                    maxHeight: isActive ? 400 : 0,
                    opacity: isActive ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                  }}>
                    <div style={{ paddingBottom: '3.5rem', color: '#666666', fontSize: '1.25rem', lineHeight: 1.8, maxWidth: '85%', fontWeight: 300 }}>
                      {faq.a}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PURE STRUCTURAL CONTACT ─── */}
      <section className="contact-section" style={{ maxWidth: 1400, margin: '0 auto', padding: '4rem 4rem 12rem' }}>
        <div className="l-draw-2" style={{ height: 1, background: '#000000', width: '100%', marginBottom: '4rem' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '4rem' }}>
          <div style={{ position: 'relative' }}>
            <div className="contact-label" style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
              [ Titik Eskalasi ]
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem' }}>

            {/* Email - No Boxes, Pure Text */}
            <div className="contact-item massive-email-container" style={{ gridColumn: '1 / -1', paddingBottom: '5rem', borderBottom: '1px solid #e5e5e5' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '2rem', color: '#666666' }}>
                Koneksi Prioritas
              </div>
              <div style={{ overflow: 'hidden', paddingBottom: '2rem', paddingTop: '1rem' }}>
                <a href="mailto:iku-support@itpln.ac.id" className="massive-email" style={{
                  fontSize: 'clamp(3rem, 6vw, 5rem)', fontWeight: 400, letterSpacing: '-2px', color: '#000000', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2rem', transition: 'all 0.4s ease'
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#999999';
                    e.currentTarget.style.transform = 'translateX(30px)';
                    const arrow = e.currentTarget.querySelector('.arrow');
                    if (arrow) arrow.style.transform = 'translateX(20px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = '#000000';
                    e.currentTarget.style.transform = 'translateX(0)';
                    const arrow = e.currentTarget.querySelector('.arrow');
                    if (arrow) arrow.style.transform = 'translateX(0)';
                  }}
                >
                  iku-support@itpln.ac.id
                  <ArrowRight className="arrow" size={48} strokeWidth={1} style={{ transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
                </a>
              </div>
            </div>

            {/* Address */}
            <div className="contact-item" style={{ paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '1.5rem', color: '#666666' }}>
                Koordinat Darat
              </div>
              <a href="https://maps.google.com/?q=Menara+PLN,+Jl.+Lingkar+Luar+Barat,+Cengkareng,+Jakarta+Barat+11750" target="_blank" rel="noreferrer" style={{ display: 'inline-block', textDecoration: 'none' }}
                onMouseEnter={e => {
                  const title = e.currentTarget.querySelector('.t-title');
                  const icon = e.currentTarget.querySelector('.icon');
                  if (title) title.style.color = '#666666';
                  if (icon) icon.style.transform = 'translate(6px, -6px)';
                }}
                onMouseLeave={e => {
                  const title = e.currentTarget.querySelector('.t-title');
                  const icon = e.currentTarget.querySelector('.icon');
                  if (title) title.style.color = '#000000';
                  if (icon) icon.style.transform = 'translate(0, 0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="t-title" style={{ fontSize: '1.5rem', fontWeight: 400, color: '#000000', letterSpacing: '-0.5px', transition: 'color 0.4s ease' }}>Menara PLN</div>
                  <ArrowUpRight className="icon" size={24} strokeWidth={1} color="#000000" style={{ transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
                </div>
                <div style={{ fontSize: '1.2rem', color: '#666666', lineHeight: 1.6, fontWeight: 300 }}>Jl. Lingkar Luar Barat, Cengkareng,<br />Jakarta Barat 11750</div>
              </a>
            </div>

            {/* Phone */}
            <div className="contact-item" style={{ paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: '1.5rem', color: '#666666' }}>
                Koneksi Audio
              </div>
              <a href="tel:+62215440342" style={{ display: 'inline-block', textDecoration: 'none' }}
                onMouseEnter={e => {
                  const title = e.currentTarget.querySelector('.t-title');
                  const icon = e.currentTarget.querySelector('.icon');
                  if (title) title.style.color = '#666666';
                  if (icon) icon.style.transform = 'translate(6px, -6px)';
                }}
                onMouseLeave={e => {
                  const title = e.currentTarget.querySelector('.t-title');
                  const icon = e.currentTarget.querySelector('.icon');
                  if (title) title.style.color = '#000000';
                  if (icon) icon.style.transform = 'translate(0, 0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="t-title" style={{ fontSize: '1.5rem', fontWeight: 400, color: '#000000', letterSpacing: '-0.5px', transition: 'color 0.4s ease' }}>(021) 5440342</div>
                  <ArrowUpRight className="icon" size={24} strokeWidth={1} color="#000000" style={{ transition: 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }} />
                </div>
                <div style={{ fontSize: '1.2rem', color: '#666666', lineHeight: 1.6, fontWeight: 300 }}>Ekstensi Khusus: 123<br />Senin - Jumat (08.00 - 16.00 WIB)</div>
              </a>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
