import { useRef, useState, useMemo } from 'react';
import { Search, ArrowRight, BookMarked } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function Glossary() {
  const mainRef = useRef();
  const [searchQuery, setSearchQuery] = useState('');

  const terms = [
    { term: 'AEE', def: 'Anugerah Energi Edukasi - Penghargaan bergengsi internal ITPLN untuk unit kerja dengan pencapaian IKU terbaik.' },
    { term: 'PDDikti', def: 'Pangkalan Data Pendidikan Tinggi - Kumpulan data penyelenggaraan pendidikan tinggi seluruh perguruan tinggi yang terintegrasi secara nasional.' },
    { term: 'SAKIP', def: 'Sistem Akuntabilitas Kinerja Instansi Pemerintah - Sistem yang mengintegrasikan sistem perencanaan, sistem penganggaran dan sistem pelaporan kinerja.' },
    { term: 'SDGs', def: 'Sustainable Development Goals - Tujuan Pembangunan Berkelanjutan yang menjadi salah satu acuan partisipatif dalam IKU ITPLN terkait lingkungan.' },
    { term: 'SFO', def: 'Strategy Focused Organization - Organisasi yang berfokus pada strategi, suatu kerangka kerja untuk mengimplementasikan strategi secara komprehensif.' },
    { term: 'PIC', def: 'Person In Charge - Seseorang yang bertanggung jawab atas suatu pekerjaan atau IKU tertentu.' }
  ];

  const filteredTerms = useMemo(() => {
    return terms.filter(t => 
      t.term.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.def.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  useGSAP(() => {
    // 1. Hero Cinematic Entrance
    const tl = gsap.timeline({ delay: 0.1 });
    
    tl.fromTo('.glos-badge', 
      { opacity: 0, y: 20 }, 
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }
    )
    .fromTo('.glos-title span',
      { y: 120, opacity: 0, rotateY: 15 },
      { y: 0, opacity: 1, rotateY: 0, duration: 1.4, stagger: 0.1, ease: 'power4.out' },
      '-=0.8'
    )
    .fromTo('.glos-desc',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out' },
      '-=1'
    )
    .fromTo('.glos-search-container',
      { opacity: 0, y: 40, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 1, ease: 'back.out(1.2)' },
      '-=0.6'
    );

    // 2. Background Letter Parallax
    gsap.to('.glos-bg-letter', {
      y: 300,
      scrollTrigger: {
        trigger: '.glos-hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 1
      }
    });

    // 3. Hero Text Parallax Fade-Out
    gsap.to(['.glos-badge', '.glos-title', '.glos-desc'], {
      y: -80,
      opacity: 0,
      stagger: 0.05,
      scrollTrigger: {
        trigger: '.glos-hero',
        start: 'top top',
        end: '60% top',
        scrub: 1
      }
    });

    // 4. Pin the Search Bar
    ScrollTrigger.create({
      trigger: '.glos-search-container',
      start: 'top 100px', // Offset account for sticky Navbar
      endTrigger: 'html',
      end: 'bottom bottom',
      pin: true,
      pinSpacing: false, // Don't push content down
      zIndex: 100
    });

  }, { scope: mainRef });

  // Separate effect for rows so it re-triggers when search filters change
  useGSAP(() => {
    // Refresh ScrollTrigger to account for new element heights
    ScrollTrigger.refresh();

    // 5. Individual Row Reveal - Cascading effect
    const rows = gsap.utils.toArray('.glos-row');
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
  }, { scope: mainRef, dependencies: [filteredTerms] });

  return (
    <div ref={mainRef} style={{ background: '#ffffff', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      
      {/* ─── MASSIVE BACKGROUND WATERMARK ─── */}
      <div className="glos-bg-letter" style={{
        position: 'absolute', top: '-10vh', right: '-5vw',
        fontSize: '50vw', fontWeight: 900, color: 'rgba(27,141,153,0.02)',
        lineHeight: 0.8, letterSpacing: '-0.05em', pointerEvents: 'none', userSelect: 'none', zIndex: 0
      }}>
        G.
      </div>

      {/* ─── HERO & SEARCH ─── */}
      <section className="glos-hero" style={{ padding: '10rem 4rem 4rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '4rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '3rem' }}>
            {/* Title Block */}
            <div style={{ flex: '1 1 600px' }}>
              <div className="glos-badge" style={{ 
                display: 'inline-flex', alignItems: 'center', gap: 16, marginBottom: '2.5rem',
                fontSize: '0.75rem', fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--primary)'
              }}>
                <span style={{ width: 48, height: 1, background: 'var(--primary)' }} />
                Direktori Terminologi
              </div>
              
              <h1 className="glos-title" style={{ fontSize: 'clamp(4rem, 8vw, 7.5rem)', fontWeight: 900, letterSpacing: '-3px', margin: 0, lineHeight: 1.05, color: '#0f172a', perspective: 1000 }}>
                <div style={{ overflow: 'hidden', paddingBottom: 10 }}>
                  <span style={{ display: 'inline-block' }}>Leksikon</span>
                </div>
                <div style={{ overflow: 'hidden', paddingBottom: 10 }}>
                  <span style={{ display: 'inline-block', color: 'var(--primary)' }}>Institusi.</span>
                </div>
              </h1>
            </div>

            {/* Description Block */}
            <div className="glos-desc" style={{ flex: '0 1 450px', paddingBottom: '1rem' }}>
              <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', lineHeight: 1.8, margin: 0 }}>
                Kamus komprehensif tanpa kompromi. Eksplorasi nomenklatur, metrik absolut, dan arsitektur singkatan dalam ekosistem Indikator Kinerja Utama.
              </p>
            </div>
          </div>

          {/* MASSIVE ARCHITECTURAL SEARCH BAR */}
          <div className="glos-search-container" style={{ 
            position: 'relative', marginTop: '2rem',
            background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)', borderRadius: 0,
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
            transformOrigin: 'center center'
          }}>
            <div style={{ position: 'absolute', top: '50%', left: '3rem', transform: 'translateY(-50%)', color: 'var(--primary)' }}>
              <Search size={36} strokeWidth={1.5} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Eksplorasi kata kunci atau definisi..."
              style={{ 
                width: '100%', padding: '3rem 3rem 3rem 8rem',
                background: 'transparent', border: 'none',
                fontSize: '1.5rem', fontWeight: 500, color: '#0f172a',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
            {/* Animated Bottom Line for Focus/Glow effect */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--primary), transparent)' }} />
          </div>
        </div>
      </section>

      {/* ─── DIRECTORY LIST (Editorial Rows) ─── */}
      <section style={{ padding: '2rem 4rem 10rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          
          {/* Header Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '4rem', paddingBottom: '1.5rem', borderBottom: '2px solid #0f172a', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: '#0f172a' }}>Terminologi</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: '#0f172a' }}>Uraian & Konteks</div>
          </div>

          {/* List items */}
          <div className="glos-list-container">
            {filteredTerms.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredTerms.map((item, idx) => {
                  // Parsing the definition to separate the acronym expansion from the actual description
                  const parts = item.def.split(' - ');
                  const expansion = parts.length > 1 ? parts[0] : '';
                  const description = parts.length > 1 ? parts.slice(1).join(' - ') : item.def;

                  return (
                    <div key={idx} className="glos-row" style={{ 
                      display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '4rem', 
                      padding: '4rem 0', borderBottom: '1px solid rgba(0,0,0,0.06)',
                      alignItems: 'flex-start', cursor: 'pointer',
                      transition: 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.paddingLeft = '2.5rem';
                      e.currentTarget.style.paddingRight = '2.5rem';
                      e.currentTarget.style.marginLeft = '-2.5rem';
                      e.currentTarget.style.marginRight = '-2.5rem';
                      e.currentTarget.style.borderColor = 'transparent';
                      
                      const arrow = e.currentTarget.querySelector('.glos-arrow');
                      if(arrow) {
                        arrow.style.transform = 'translateX(15px)';
                        arrow.style.color = 'var(--primary)';
                      }
                      const termText = e.currentTarget.querySelector('.glos-term-text');
                      if(termText) {
                        termText.style.color = 'var(--primary)';
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.paddingLeft = '0';
                      e.currentTarget.style.paddingRight = '0';
                      e.currentTarget.style.marginLeft = '0';
                      e.currentTarget.style.marginRight = '0';
                      e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
                      
                      const arrow = e.currentTarget.querySelector('.glos-arrow');
                      if(arrow) {
                        arrow.style.transform = 'translateX(0)';
                        arrow.style.color = '#cbd5e1';
                      }
                      const termText = e.currentTarget.querySelector('.glos-term-text');
                      if(termText) {
                        termText.style.color = '#0f172a';
                      }
                    }}
                    >
                      {/* TERM (Massive) */}
                      <div>
                        <h2 className="glos-term-text" style={{ fontSize: '3.5rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-1px', margin: 0, lineHeight: 1, transition: 'color 0.4s ease' }}>
                          {item.term}
                        </h2>
                      </div>

                      {/* DEFINITION */}
                      <div style={{ display: 'flex', gap: '3rem', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          {expansion && (
                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', letterSpacing: '-0.5px' }}>
                              {expansion}
                            </div>
                          )}
                          <p style={{ fontSize: '1.15rem', color: 'var(--text-muted)', lineHeight: 1.8, margin: 0, maxWidth: 800 }}>
                            {description}
                          </p>
                        </div>
                        <div className="glos-arrow" style={{ color: '#cbd5e1', transition: 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' }}>
                          <ArrowRight size={36} strokeWidth={1} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '8rem 0', textAlign: 'center', color: '#94a3b8' }}>
                <BookMarked size={64} strokeWidth={1} style={{ margin: '0 auto 2rem' }} />
                <h3 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-1px', color: '#0f172a', marginBottom: '1rem' }}>Terminologi tidak ditemukan</h3>
                <p style={{ fontSize: '1.2rem' }}>Eksplorasi kata kunci atau ejaan yang berbeda.</p>
              </div>
            )}
          </div>

        </div>
      </section>

    </div>
  );
}
