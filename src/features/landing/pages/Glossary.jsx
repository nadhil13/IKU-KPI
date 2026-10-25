import { useRef, useState, useMemo } from 'react';
import { Search, BookMarked, X } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const GLOSSARY_TERMS = [
  {
    term: 'IKU',
    expansion: 'Indikator Kinerja Utama Perguruan Tinggi',
    category: 'Regulasi Nasional',
    description:
      'Delapan ukuran kinerja utama perguruan tinggi yang ditetapkan melalui Kepmendikbudristek Nomor 210/M/2023 untuk menilai kualitas lulusan, dosen, dan kurikulum.',
  },
  {
    term: 'KPI',
    expansion: 'Key Performance Indicator Operasional',
    category: 'Kinerja Internal',
    description:
      'Indikator kinerja turunan yang berlaku pada fakultas, program studi, lembaga, dan biro di lingkungan ITPLN guna mendukung pencapaian Rencana Strategis institusi.',
  },
  {
    term: 'PRP',
    expansion: 'Perencanaan dan Pengembangan / Pengendalian Kinerja',
    category: 'Tata Kelola',
    description:
      'Unit pengelola pusat yang mengatur periode pelaporan, memvalidasi bukti dukung capaian unit kerja, dan mengonsolidasikan pelaporan kinerja tingkat rektorat.',
  },
  {
    term: 'SPMI',
    expansion: 'Sistem Penjaminan Mutu Internal',
    category: 'Mutu Akademik',
    description:
      'Siklus penetapan, pelaksanaan, evaluasi, pengendalian, dan peningkatan standar pendidikan tinggi secara otonom oleh ITPLN sesuai Permendikbudristek Nomor 53 Tahun 2023.',
  },
  {
    term: 'PIC',
    expansion: 'Person In Charge (Penanggung Jawab Indikator)',
    category: 'Peran Operasional',
    description:
      'Pejabat atau staf unit kerja yang ditugaskan menghimpun data realisasi, mengunggah tautan bukti dukung sah, dan menindaklanjuti catatan verifikasi pada indikator terkait.',
  },
  {
    term: 'PDDikti',
    expansion: 'Pangkalan Data Pendidikan Tinggi',
    category: 'Basis Data Nasional',
    description:
      'Repositori data nasional penyelenggaraan pendidikan tinggi yang menjadi rujukan rekonsiliasi jumlah mahasiswa aktif, lulusan, dosen NIDN/NIDK, dan kelas perkuliahan.',
  },
  {
    term: 'MBKM',
    expansion: 'Merdeka Belajar Kampus Merdeka',
    category: 'Akademik & Lulusan',
    description:
      'Program pembelajaran mahasiswa di luar program studi melalui magang industri ketenagalistrikan, riset terapan, pertukaran mahasiswa, atau proyek independen terrekognisi SKS.',
  },
  {
    term: 'AEE',
    expansion: 'Anugerah Energi Edukasi',
    category: 'Apresiasi Internal',
    description:
      'Penghargaan evaluasi kinerja internal ITPLN bagi fakultas, program studi, dan unit kerja dengan kepatuhan pelaporan serta capaian target IKU terbaik.',
  },
  {
    term: 'SAKIP',
    expansion: 'Sistem Akuntabilitas Kinerja Instansi',
    category: 'Akuntabilitas',
    description:
      'Rangkaian integrasi perencanaan strategis, penganggaran berbasis kinerja, pengukuran indikator, serta pelaporan evaluasi capaian organisasi secara berkala.',
  },
  {
    term: 'SDGs',
    expansion: 'Sustainable Development Goals',
    category: 'Keberlanjutan',
    description:
      'Tujuan Pembangunan Berkelanjutan yang menjadi acuan riset transisi energi bersih, pengabdian masyarakat, dan kolaborasi mitra strategis di lingkungan ITPLN.',
  },
];

export default function Glossary() {
  const mainRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTerms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return GLOSSARY_TERMS;
    return GLOSSARY_TERMS.filter(
      (item) =>
        item.term.toLowerCase().includes(q) ||
        item.expansion.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tl = gsap.timeline({ delay: 0.06, defaults: { ease: 'expo.out' } });
    tl.fromTo('.glos-badge', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.65 })
      .fromTo('.glos-title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.85 }, '-=0.45')
      .fromTo('.glos-desc', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.5')
      .fromTo('.glos-search-bar', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.45');
  }, { scope: mainRef });

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const rows = gsap.utils.toArray('.glos-row');
    rows.forEach((row) => {
      gsap.fromTo(
        row,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: row,
            start: 'top 92%',
            once: true,
          },
        }
      );
    });
  }, { scope: mainRef, dependencies: [filteredTerms] });

  return (
    <div
      ref={mainRef}
      style={{
        background: '#ffffff',
        minHeight: '100dvh',
        position: 'relative',
        color: '#072534',
      }}
    >
      <style>{`
        .glos-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
          gap: clamp(1.5rem, 4vw, 3.5rem);
          align-items: end;
        }
        .glos-search-shell {
          position: sticky;
          top: 84px;
          z-index: 20;
          margin-top: clamp(2rem, 4vw, 3rem);
          background: #ffffff;
          border: 1.5px solid #D8E4EA;
          border-radius: 10px;
          box-shadow: 0 10px 24px -12px rgba(7, 37, 52, 0.1);
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .glos-search-shell:focus-within {
          border-color: #0E7480;
          box-shadow: 0 0 0 3px rgba(14, 116, 128, 0.14);
        }
        .glos-search-input {
          width: 100%;
          min-height: 58px;
          padding: 0.95rem 3.5rem 0.95rem 3.35rem;
          background: transparent;
          border: none;
          font-size: clamp(0.95rem, 1.2vw, 1.08rem);
          font-weight: 500;
          color: #072534;
          font-family: inherit;
        }
        .glos-search-input::placeholder {
          color: #64748b;
        }
        .glos-search-input:focus {
          outline: none;
        }
        .glos-clear-btn {
          position: absolute;
          top: 50%;
          right: 0.65rem;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #475569;
          cursor: pointer;
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        .glos-clear-btn:hover {
          background: #EDF3F6;
          color: #072534;
        }
        .glos-table-head {
          display: grid;
          grid-template-columns: minmax(180px, 280px) minmax(0, 1fr);
          gap: clamp(1.25rem, 3.5vw, 3rem);
          padding-bottom: 1rem;
          border-bottom: 2px solid #094E68;
        }
        .glos-row {
          display: grid;
          grid-template-columns: minmax(180px, 280px) minmax(0, 1fr);
          gap: clamp(1.25rem, 3.5vw, 3rem);
          padding: clamp(1.65rem, 3vw, 2.5rem) 0.75rem;
          border-bottom: 1px solid #D8E4EA;
          align-items: start;
          transition: background-color 0.2s ease;
        }
        @media (hover: hover) {
          .glos-row:hover {
            background-color: #F7FAFB;
          }
        }
        @media (max-width: 768px) {
          .glos-hero-grid {
            grid-template-columns: 1fr;
            align-items: start;
          }
          .glos-search-shell {
            position: relative;
            top: auto;
          }
          .glos-table-head {
            display: none;
          }
          .glos-row {
            grid-template-columns: 1fr;
            gap: 0.75rem;
            padding: 1.5rem 0.25rem;
          }
        }
      `}</style>

      {/* ─── HERO & SEARCH ─── */}
      <section
        style={{
          padding: 'clamp(7.5rem, 11vw, 10rem) clamp(1.25rem, 4vw, 4rem) clamp(2rem, 4vw, 3rem)',
        }}
      >
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div className="glos-hero-grid">
            <div>
              <div className="glos-badge ent-eyebrow" style={{ marginBottom: '1.25rem' }}>
                05 // DIREKTORI TERMINOLOGI TATA KELOLA
              </div>
              <h1
                className="glos-title"
                style={{
                  fontSize: 'clamp(2.35rem, 5.5vw, 4.5rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  margin: 0,
                  lineHeight: 1.04,
                  color: '#072534',
                }}
              >
                Glosarium <span style={{ color: '#094E68' }}>Kinerja.</span>
              </h1>
            </div>

            <div className="glos-desc">
              <p
                style={{
                  fontSize: 'clamp(0.96rem, 1.2vw, 1.08rem)',
                  color: '#334155',
                  lineHeight: 1.72,
                  margin: 0,
                }}
              >
                Daftar istilah resmi, singkatan regulasi, dan definisi operasional yang digunakan dalam pengelolaan Indikator Kinerja Utama (IKU) maupun Key Performance Indicator (KPI) di lingkungan ITPLN.
              </p>
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="glos-search-bar glos-search-shell">
            <label
              htmlFor="glossary-search"
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                border: 0,
              }}
            >
              Cari singkatan atau definisi istilah kinerja
            </label>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '50%',
                left: '1.15rem',
                transform: 'translateY(-50%)',
                color: '#0E7480',
                display: 'flex',
                pointerEvents: 'none',
              }}
            >
              <Search size={20} strokeWidth={2} />
            </div>
            <input
              id="glossary-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari singkatan (mis. SPMI, PDDikti, PRP) atau topik..."
              className="glos-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="glos-clear-btn"
                aria-label="Bersihkan kata kunci pencarian"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div
            aria-live="polite"
            style={{
              marginTop: '0.85rem',
              fontFamily: 'var(--ent-mono)',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: '#475569',
              letterSpacing: '0.04em',
            }}
          >
            Menampilkan {filteredTerms.length} dari {GLOSSARY_TERMS.length} istilah terdaftar
          </div>
        </div>
      </section>

      {/* ─── DIRECTORY LIST ─── */}
      <section style={{ padding: '0 clamp(1.25rem, 4vw, 4rem) clamp(5rem, 8vw, 8rem)' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div className="glos-table-head">
            <div
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#475569',
              }}
            >
              Singkatan &amp; Kategori
            </div>
            <div
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#475569',
              }}
            >
              Kepanjangan &amp; Definisi Operasional
            </div>
          </div>

          {filteredTerms.length > 0 ? (
            <dl style={{ margin: 0 }}>
              {filteredTerms.map((item) => (
                <div key={item.term} className="glos-row">
                  <dt style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: 'clamp(1.75rem, 3vw, 2.35rem)',
                        fontWeight: 800,
                        color: '#094E68',
                        letterSpacing: '-0.03em',
                        lineHeight: 1.05,
                      }}
                    >
                      {item.term}
                    </span>
                    <span className="ent-badge ent-badge-info">{item.category}</span>
                  </dt>

                  <dd style={{ margin: 0 }}>
                    <div
                      style={{
                        fontSize: 'clamp(1.02rem, 1.4vw, 1.18rem)',
                        fontWeight: 700,
                        color: '#072534',
                        marginBottom: '0.45rem',
                        letterSpacing: '-0.015em',
                        lineHeight: 1.35,
                      }}
                    >
                      {item.expansion}
                    </div>
                    <p
                      style={{
                        fontSize: '0.95rem',
                        color: '#334155',
                        lineHeight: 1.72,
                        margin: 0,
                        maxWidth: 780,
                      }}
                    >
                      {item.description}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <div
              style={{
                marginTop: '1.5rem',
                padding: 'clamp(2.5rem, 6vw, 4.5rem) 1.5rem',
                textAlign: 'center',
                background: '#F7FAFB',
                border: '1px solid #D8E4EA',
                borderRadius: '10px',
              }}
            >
              <BookMarked size={40} strokeWidth={1.6} color="#094E68" style={{ margin: '0 auto 1rem' }} />
              <h2
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#072534',
                  margin: '0 0 0.45rem',
                }}
              >
                Istilah tidak ditemukan
              </h2>
              <p style={{ fontSize: '0.94rem', color: '#475569', margin: '0 0 1.25rem' }}>
                Tidak ada entri glosarium yang cocok dengan kata kunci &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="ent-btn ent-btn-primary"
                style={{ minHeight: 44 }}
              >
                Tampilkan Semua Istilah
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
