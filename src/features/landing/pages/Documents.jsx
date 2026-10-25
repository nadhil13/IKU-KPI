import { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const DOCUMENTS = [
  {
    id: '01',
    name: 'IKU Perguruan Tinggi (2026.06.23)',
    desc: 'Dokumen pedoman dan ketetapan Indikator Kinerja Utama Perguruan Tinggi sebagai acuan pengukuran capaian institusi.',
    filename: '2026.06.23 IKU Perguruan Tinggi.pdf',
    type: 'PDF',
    size: '4.8 MB',
    date: '23 Jun 2026',
  },
  {
    id: '02',
    name: 'Buku Panduan IKU Diktisaintek Berdampak V1.1',
    desc: 'Buku panduan operasional definisi, rumusan perhitungan, dan ketentuan verifikasi bukti IKU Direktorat Jenderal Pendidikan Tinggi, Riset, dan Teknologi.',
    filename: 'Buku IKU Diktisaintek Berdampak_V1-1.pdf',
    type: 'PDF',
    size: '9.3 MB',
    date: 'Versi 1.1',
  },
];

export default function Documents({ embedded = false }) {
  const mainRef = useRef(null);
  const location = useLocation();
  const isEmbedded = embedded || location.pathname.startsWith('/internal');

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tl = gsap.timeline({ delay: 0.06, defaults: { ease: 'expo.out' } });
    tl.fromTo('.doc-badge', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.65 })
      .fromTo('.doc-title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.85 }, '-=0.45')
      .fromTo('.doc-desc', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.5');

    gsap.utils.toArray('.doc-row-container').forEach((row) => {
      gsap.fromTo(
        row,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: row,
            start: 'top 90%',
            once: true,
          },
        }
      );
    });
  }, { scope: mainRef });

  return (
    <div
      ref={mainRef}
      style={{
        background: '#ffffff',
        minHeight: isEmbedded ? 'auto' : '100dvh',
        position: 'relative',
        color: '#072534',
      }}
    >
      <style>{`
        .doc-table-head {
          display: grid;
          grid-template-columns: 84px 1fr 180px;
          gap: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #094E68;
        }
        .doc-row-link {
          display: grid;
          grid-template-columns: 84px 1fr 180px;
          gap: 1.5rem;
          padding: clamp(1.75rem, 3.5vw, 2.75rem) 1rem;
          align-items: center;
          text-decoration: none;
          color: #072534;
          border-bottom: 1px solid #D8E4EA;
          transition: background-color 0.2s ease;
        }
        .doc-dl-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          min-height: 44px;
          padding: 0.65rem 1.15rem;
          border-radius: 6px;
          border: 1px solid #094E68;
          background: #ffffff;
          color: #094E68;
          font-family: var(--ent-mono);
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        @media (hover: hover) {
          .doc-row-link:hover {
            background-color: #F7FAFB;
          }
          .doc-row-link:hover .doc-dl-btn {
            background-color: #094E68;
            border-color: #094E68;
            color: #ffffff;
          }
        }
        @media (max-width: 768px) {
          .doc-table-head {
            display: none;
          }
          .doc-row-link {
            grid-template-columns: 1fr;
            gap: 1rem;
            padding: 1.5rem 0.25rem;
          }
          .doc-dl-wrap {
            justify-content: flex-start !important;
          }
          .doc-dl-btn {
            width: 100%;
          }
        }
      `}</style>

      {/* ─── HERO SECTION ─── */}
      <section
        className="doc-hero"
        style={{
          padding: isEmbedded
            ? '0.5rem 0 2rem'
            : 'clamp(7.5rem, 11vw, 10rem) clamp(1.25rem, 4vw, 4rem) clamp(2.5rem, 5vw, 4rem)',
        }}
      >
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div className="doc-badge ent-eyebrow" style={{ marginBottom: '1.25rem' }}>
            04 // ARSIP REGULASI &amp; PEDOMAN RESMI
          </div>

          <h1
            className="doc-title"
            style={{
              fontSize: 'clamp(2.35rem, 5.5vw, 4.5rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              margin: '0 0 1rem',
              lineHeight: 1.04,
              color: '#072534',
            }}
          >
            Dokumen &amp; Pedoman <span style={{ color: '#094E68' }}>IKU.</span>
          </h1>

          <div className="doc-desc" style={{ maxWidth: 640 }}>
            <p style={{ fontSize: 'clamp(0.96rem, 1.2vw, 1.08rem)', color: '#334155', lineHeight: 1.72, margin: 0 }}>
              Unduh salinan resmi Keputusan Menteri dan buku panduan teknis perhitungan Indikator Kinerja Utama untuk referensi penyusunan bukti di tingkat fakultas, prodi, maupun unit kerja ITPLN.
            </p>
          </div>
        </div>
      </section>

      {/* ─── DOCUMENT LEDGER ─── */}
      <section
        style={{
          padding: isEmbedded
            ? '0 0 2rem'
            : '0 clamp(1.25rem, 4vw, 4rem) clamp(5rem, 8vw, 8rem)',
        }}
      >
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div className="doc-table-head">
            <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569' }}>
              Indeks
            </div>
            <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569' }}>
              Dokumen &amp; Deskripsi
            </div>
            <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>
              Unduhan
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {DOCUMENTS.map((doc) => (
              <div key={doc.id} className="doc-row-container">
                <a href={`/panduan/${encodeURIComponent(doc.filename)}`} download={doc.filename} className="doc-row-link">
                  <div
                    style={{
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '1.35rem',
                      fontWeight: 700,
                      color: '#0E7480',
                      lineHeight: 1,
                    }}
                  >
                    {doc.id}.
                  </div>

                  <div>
                    <h2
                      style={{
                        fontSize: 'clamp(1.25rem, 2.4vw, 1.75rem)',
                        fontWeight: 800,
                        letterSpacing: '-0.025em',
                        margin: '0 0 0.55rem',
                        lineHeight: 1.2,
                        color: '#072534',
                      }}
                    >
                      {doc.name}
                    </h2>
                    <p style={{ fontSize: '0.94rem', color: '#334155', lineHeight: 1.68, margin: '0 0 1rem', maxWidth: 760 }}>
                      {doc.desc}
                    </p>
                    <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="ent-badge ent-badge-info">{doc.type}</span>
                      <span className="ent-badge">{doc.size}</span>
                      <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 600, color: '#475569', letterSpacing: '0.04em' }}>
                        Edisi: {doc.date}
                      </span>
                    </div>
                  </div>

                  <div className="doc-dl-wrap" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span className="doc-dl-btn">
                      <FileDown size={16} strokeWidth={2} />
                      Unduh PDF
                    </span>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
