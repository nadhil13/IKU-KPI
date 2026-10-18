import { useRef } from 'react';
import { FileDown, Layers } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function Documents() {
  const mainRef = useRef();

  const docs = [
    {
      id: '01',
      name: '2026.06.23 IKU Perguruan Tinggi',
      desc: 'Keputusan Menteri Pendidikan, Kebudayaan, Riset, dan Teknologi Republik Indonesia tentang Indikator Kinerja Utama Perguruan Tinggi Negeri.',
      filename: '2026.06.23 IKU Perguruan Tinggi.pdf',
      type: 'PDF',
      size: '4.8 MB',
      date: '23 Jun 2026'
    },
    {
      id: '02',
      name: 'Buku IKU Diktisaintek Berdampak V1-1',
      desc: 'Buku panduan komprehensif implementasi operasional IKU Berdampak yang dirilis oleh Direktorat Jenderal Pendidikan Tinggi.',
      filename: 'Buku IKU Diktisaintek Berdampak_V1-1.pdf',
      type: 'PDF',
      size: '9.3 MB',
      date: 'Versi 1.1'
    }
  ];

  useGSAP(() => {
    // 1. Hero Cinematic Entrance
    const tl = gsap.timeline({ delay: 0.1 });

    tl.fromTo('.doc-badge',
      { opacity: 0, x: -30 },
      { opacity: 1, x: 0, duration: 1, ease: 'power3.out' }
    )
      .fromTo('.doc-title span',
        { y: 150, opacity: 0, skewY: 8 },
        { y: 0, opacity: 1, skewY: 0, duration: 1.4, stagger: 0.1, ease: 'power4.out' },
        '-=0.8'
      )
      .fromTo('.doc-desc',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out' },
        '-=1'
      );

    // 2. Background Letter Parallax
    gsap.to('.doc-bg-letter', {
      y: 350,
      scrollTrigger: {
        trigger: '.doc-hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 1
      }
    });

    // 3. Hero Text Parallax Fade-Out
    gsap.to(['.doc-badge', '.doc-title', '.doc-desc'], {
      y: -80,
      opacity: 0,
      stagger: 0.05,
      scrollTrigger: {
        trigger: '.doc-hero',
        start: 'top top',
        end: '60% top',
        scrub: 1
      }
    });

    // 4. Stagger List Reveal for Documents
    const rows = gsap.utils.toArray('.doc-row-container');
    rows.forEach((row, i) => {
      gsap.fromTo(row,
        { opacity: 0, y: 60, scale: 0.98 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out',
          scrollTrigger: {
            trigger: row,
            start: 'top 90%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });

    // 5. Line drawing for architectural borders
    gsap.utils.toArray('.doc-divider').forEach((divider) => {
      gsap.fromTo(divider,
        { scaleX: 0, transformOrigin: 'left' },
        {
          scaleX: 1, duration: 1, ease: 'power4.out',
          scrollTrigger: {
            trigger: divider,
            start: 'top 95%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    });

  }, { scope: mainRef });

  return (
    <div ref={mainRef} style={{ background: '#ffffff', minHeight: '100vh', position: 'relative', overflow: 'hidden', color: '#0f172a' }}>

      {/* ─── MASSIVE BACKGROUND WATERMARK ─── */}
      <div className="doc-bg-letter" style={{
        position: 'absolute', top: '-10vh', right: '-5vw',
        fontSize: '60vw', fontWeight: 900, color: 'rgba(27,141,153,0.02)',
        lineHeight: 0.8, letterSpacing: '-0.05em', pointerEvents: 'none', userSelect: 'none', zIndex: 0
      }}>
        D.
      </div>

      {/* ─── HERO SECTION ─── */}
      <section className="doc-hero" style={{ padding: '12rem 4rem 6rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          <div className="doc-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 16,
            fontSize: '0.8rem', fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--primary)'
          }}>
            <span style={{ width: 48, height: 2, background: 'var(--primary)' }} />
            Pusat Arsip Digital
          </div>

          <h1 className="doc-title" style={{ fontSize: 'clamp(4rem, 9vw, 8.5rem)', fontWeight: 900, letterSpacing: '-4px', margin: 0, lineHeight: 1.05, perspective: 1000 }}>
            <div style={{ overflow: 'hidden', paddingBottom: 10 }}>
              <span style={{ display: 'inline-block' }}>Pustaka</span>
            </div>
            <div style={{ overflow: 'hidden', paddingBottom: 10 }}>
              <span style={{ display: 'inline-block', color: 'var(--primary)' }}>Eksekutif.</span>
            </div>
          </h1>

          <div className="doc-desc" style={{ maxWidth: 650, marginTop: '1rem' }}>
            <p style={{ fontSize: '1.25rem', color: '#64748b', lineHeight: 1.8, margin: 0 }}>
              Akses eksklusif ke dokumen regulasi menteri, buku panduan implementasi, dan standar operasional IKU. Seluruh data diarsipkan dalam resolusi tinggi.
            </p>
          </div>

        </div>
      </section>

      {/* ─── ARCHITECTURAL LIST ─── */}
      <section style={{ padding: '2rem 4rem 12rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>

          {/* Header */}
          <div className="doc-divider" style={{ height: 2, background: '#0f172a', marginBottom: '1rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: '2rem', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: '#0f172a' }}>Indeks</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: '#0f172a' }}>Nomenklatur Dokumen</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: '#0f172a', textAlign: 'right' }}>Aksi</div>
          </div>

          {/* List items */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {docs.map((doc, idx) => (
              <div key={idx} className="doc-row-container" style={{ position: 'relative' }}>
                <div className="doc-divider" style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />

                <a href={`/panduan/${doc.filename}`} download className="doc-row" style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: '2rem',
                  padding: '4rem 0', alignItems: 'flex-start', cursor: 'pointer',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.paddingLeft = '1.5rem';
                    e.currentTarget.style.paddingRight = '1.5rem';
                    e.currentTarget.style.marginLeft = '-1.5rem';
                    e.currentTarget.style.marginRight = '-1.5rem';

                    e.currentTarget.querySelector('.doc-num').style.color = 'var(--primary)';
                    e.currentTarget.querySelector('.doc-name').style.transform = 'translateX(20px)';
                    e.currentTarget.querySelector('.doc-name').style.color = 'var(--primary)';

                    e.currentTarget.querySelector('.doc-dl-box').style.background = 'var(--primary)';
                    e.currentTarget.querySelector('.doc-dl-box').style.color = 'white';
                    e.currentTarget.querySelector('.doc-dl-box').style.transform = 'scale(1.05)';
                    e.currentTarget.querySelector('.doc-dl-box').style.borderColor = 'var(--primary)';
                    e.currentTarget.querySelector('.doc-arrow').style.transform = 'translateY(5px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.paddingLeft = '0';
                    e.currentTarget.style.paddingRight = '0';
                    e.currentTarget.style.marginLeft = '0';
                    e.currentTarget.style.marginRight = '0';

                    e.currentTarget.querySelector('.doc-num').style.color = '#cbd5e1';
                    e.currentTarget.querySelector('.doc-name').style.transform = 'translateX(0)';
                    e.currentTarget.querySelector('.doc-name').style.color = '#0f172a';

                    e.currentTarget.querySelector('.doc-dl-box').style.background = 'transparent';
                    e.currentTarget.querySelector('.doc-dl-box').style.color = 'var(--primary)';
                    e.currentTarget.querySelector('.doc-dl-box').style.transform = 'scale(1)';
                    e.currentTarget.querySelector('.doc-dl-box').style.borderColor = 'rgba(0,0,0,0.08)';
                    e.currentTarget.querySelector('.doc-arrow').style.transform = 'translateY(0)';
                  }}
                >
                  {/* INDEX */}
                  <div className="doc-num" style={{ fontSize: '2.5rem', fontWeight: 900, color: '#cbd5e1', transition: 'color 0.4s ease', lineHeight: 1 }}>
                    {doc.id}.
                  </div>

                  {/* DETAILS */}
                  <div>
                    <h2 className="doc-name" style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 1rem', lineHeight: 1.1, color: '#0f172a', transition: 'all 0.4s ease' }}>
                      {doc.name}
                    </h2>
                    <p style={{ fontSize: '1.2rem', color: '#64748b', lineHeight: 1.7, margin: '0 0 2rem', maxWidth: 800 }}>
                      {doc.desc}
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 2, background: 'rgba(0,0,0,0.03)', padding: '0.5rem 1rem', borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', textTransform: 'uppercase' }}>
                        {doc.type}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 2, background: 'rgba(0,0,0,0.03)', padding: '0.5rem 1rem', borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', textTransform: 'uppercase' }}>
                        {doc.size}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 2, color: '#94a3b8', textTransform: 'uppercase' }}>
                        Rev: {doc.date}
                      </span>
                    </div>
                  </div>

                  {/* DOWNLOAD BUTTON */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                    <div className="doc-dl-box" style={{
                      width: 90, height: 90, borderRadius: 0,
                      background: 'transparent', border: '1px solid rgba(0,0,0,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--primary)',
                      transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                    }}>
                      <div className="doc-arrow" style={{ transition: 'transform 0.4s ease' }}>
                        <FileDown size={36} strokeWidth={1.2} />
                      </div>
                    </div>
                  </div>

                </a>
              </div>
            ))}
            <div className="doc-divider" style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />
          </div>

        </div>
      </section>

    </div>
  );
}
