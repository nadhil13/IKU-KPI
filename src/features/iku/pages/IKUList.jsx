import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const IKU_CATALOG = [
  {
    id: 1,
    idx: '01',
    code: 'IKU.01',
    pillar: 'Kualitas Lulusan',
    title: 'Lulusan Mendapat Pekerjaan yang Layak',
    desc: 'Persentase lulusan S1 dan D4/D3 yang berhasil mendapatkan pekerjaan layak, melanjutkan studi pascasarjana, atau menjadi wiraswasta dalam masa tunggu ≤ 12 bulan.',
    formula: '(Jumlah lulusan bekerja layak + studi lanjut + wirausaha) ÷ Total responden tracer study × 100%',
    target: '80%',
    pic: 'Biro Kemahasiswaan & Karir Alumni',
  },
  {
    id: 2,
    idx: '02',
    code: 'IKU.02',
    pillar: 'Kualitas Lulusan',
    title: 'Mahasiswa Mendapat Pengalaman di Luar Kampus',
    desc: 'Mahasiswa S1 dan D4/D3 yang memperoleh minimal 10 sampai 20 SKS kegiatan pembelajaran di luar program studi (magang industri BUMN/PLN, riset terapan, pertukaran pelajar, atau prestasi kompetisi).',
    formula: 'Jumlah mahasiswa berkegiatan MBKM rekognisi SKS ÷ Total mahasiswa aktif × 100%',
    target: '75%',
    pic: 'Pusat MBKM & Akademik ITPLN',
  },
  {
    id: 3,
    idx: '03',
    code: 'IKU.03',
    pillar: 'Kualitas Dosen',
    title: 'Dosen Berkegiatan di Luar Kampus',
    desc: 'Dosen tetap berkegiatan tridharma di kampus QS200/mitra strategis, bekerja sebagai praktisi di industri ketenagalistrikan & energi, atau membina mahasiswa berprestasi nasional/internasional.',
    formula: 'Jumlah dosen NIDN berkegiatan luar kampus ÷ Total dosen tetap NIDN/NIDK × 100%',
    target: '85%',
    pic: 'Direktorat Sumber Daya Manusia & Akademik',
  },
  {
    id: 4,
    idx: '04',
    code: 'IKU.04',
    pillar: 'Kualitas Dosen',
    title: 'Praktisi Mengajar di Dalam Kampus',
    desc: 'Dosen berkualifikasi S3, memiliki sertifikasi kompetensi/profesi internasional, atau berasal dari kalangan praktisi profesional industri dan BUMN energi.',
    formula: '(Dosen S3 + Bersertifikat Kompetensi + Praktisi Mengajar) ÷ Total pengajar × 100%',
    target: '80%',
    pic: 'Fakultas & Program Studi',
  },
  {
    id: 5,
    idx: '05',
    code: 'IKU.05',
    pillar: 'Kualitas Dosen',
    title: 'Hasil Kerja Dosen Digunakan oleh Masyarakat',
    desc: 'Karya tulis ilmiah bereputasi internasional, karya terapan/paten teknologi energi bersih, dan inovasi yang diadopsi oleh PLN Group maupun masyarakat luas.',
    formula: 'Jumlah luaran riset & inovasi terrekognisi ÷ Total dosen tetap × Rasio standar',
    target: '75%',
    pic: 'Lembaga Penelitian & Pengabdian Masyarakat (LPPM)',
  },
  {
    id: 6,
    idx: '06',
    code: 'IKU.06',
    pillar: 'Kualitas Kurikulum',
    title: 'Program Studi Bekerjasama dengan Mitra Kelas Dunia',
    desc: 'Kemitraan resmi program studi dengan perusahaan multinasional, BUMN strategis, institusi riset global, atau universitas terkemuka dalam kurikulum, magang, dan penyerapan lulusan.',
    formula: 'Jumlah program studi dengan kerja sama aktif berbobot ÷ Total program studi S1 & Vokasi × 100%',
    target: '80%',
    pic: 'Direktorat Kerjasama & Kemitraan Global',
  },
  {
    id: 7,
    idx: '07',
    code: 'IKU.07',
    pillar: 'Kualitas Kurikulum',
    title: 'Kelas yang Kolaboratif dan Partisipatif',
    desc: 'Persentase mata kuliah S1 dan D4/D3 yang menerapkan metode evaluasi berbasis pemecahan kasus riil industri (Case Method) atau proyek kelompok (Team-Based Project) minimal 50% bobot nilai akhir.',
    formula: 'Mata kuliah berbasis Case Method / Team-Based Project ÷ Total mata kuliah terselenggara × 100%',
    target: '90%',
    pic: 'Biro Pengembangan Pembelajaran & Kurikulum',
  },
  {
    id: 8,
    idx: '08',
    code: 'IKU.08',
    pillar: 'Kualitas Kurikulum',
    title: 'Program Studi Berstandar Internasional',
    desc: 'Persentase program studi S1 dan D4/D3 yang memperoleh akreditasi atau sertifikasi tingkat internasional yang diakui Kemendikbudristek (IABEE, ASIIN, ABET).',
    formula: 'Program studi terakreditasi/tersertifikasi internasional ÷ Total program studi eligible × 100%',
    target: '80%',
    pic: 'Satuan Penjaminan Mutu Internal (SPMI)',
  },
];

const PILLARS = ['Semua Pilar', 'Kualitas Lulusan', 'Kualitas Dosen', 'Kualitas Kurikulum'];

export default function IKUList() {
  const pageRef = useRef(null);
  const [activePillar, setActivePillar] = useState('Semua Pilar');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return IKU_CATALOG.filter((item) => {
      const matchPillar = activePillar === 'Semua Pilar' || item.pillar === activePillar;
      const matchQuery =
        !query.trim() ||
        `${item.code} ${item.title} ${item.desc} ${item.pic}`
          .toLowerCase()
          .includes(query.toLowerCase());
      return matchPillar && matchQuery;
    });
  }, [activePillar, query]);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(
      '.iku-cat-mask-line',
      { yPercent: 115 },
      { yPercent: 0, duration: 0.9, stagger: 0.08 }
    )
      .fromTo(
        '.iku-cat-hero',
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65, stagger: 0.06, clearProps: 'transform' },
        '-=0.55'
      )
      .fromTo(
        '.iku-cat-keyline',
        { scaleX: 0 },
        { scaleX: 1, transformOrigin: 'left center', duration: 0.95, ease: 'expo.inOut' },
        '-=0.6'
      );
  }, { scope: pageRef });

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const cards = gsap.utils.toArray('.iku-cat-card');
    cards.forEach((card, idx) => {
      gsap.fromTo(
        card,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          delay: (idx % 2) * 0.05,
          ease: 'expo.out',
          clearProps: 'transform',
          scrollTrigger: {
            trigger: card,
            start: 'top 92%',
            once: true,
          },
        }
      );
    });
  }, { dependencies: [activePillar, query], scope: pageRef });

  return (
    <div
      ref={pageRef}
      style={{
        background: '#ffffff',
        minHeight: '100dvh',
        paddingTop: 'clamp(6.75rem, 10vw, 8rem)',
        paddingBottom: 'clamp(4.5rem, 8vw, 6.5rem)',
        color: '#072534',
      }}
    >
      <style>{`
        .iku-ledger-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
          border-top: 1px solid #D8E4EA;
          border-left: 1px solid #D8E4EA;
        }
        .iku-ledger-cell {
          padding: clamp(1.4rem, 3vw, 1.85rem);
          border-right: 1px solid #D8E4EA;
          border-bottom: 1px solid #D8E4EA;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1.5rem;
          position: relative;
          transition: background-color 0.22s ease;
        }
        .iku-ledger-cell::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: -1px;
          height: 2.5px;
          background: #094E68;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .iku-filter-btn {
          min-height: 40px;
          padding: 0.45rem 0.95rem;
          border-radius: 6px;
          border: none;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        @media (hover: hover) {
          .iku-ledger-cell:hover {
            background: #F7FAFB;
          }
          .iku-ledger-cell:hover::before {
            transform: scaleX(1);
          }
        }
        @media (max-width: 640px) {
          .iku-filter-track {
            width: 100%;
          }
          .iku-filter-btn {
            flex: 1 1 calc(50% - 4px);
            min-height: 44px;
            text-align: center;
          }
          .iku-search-wrap {
            flex: 1 1 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '0 clamp(1.25rem, 4vw, 2.5rem)' }}>
        {/* HERO MASTHEAD */}
        <header style={{ marginBottom: '2.25rem' }}>
          <div className="iku-cat-hero ent-eyebrow" style={{ marginBottom: '1rem' }}>
            KEPMENDIKBUDRISTEK NO. 210/M/2023 // DIREKTORAT PRP ITPLN
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '1.5rem',
              paddingBottom: '1.85rem',
            }}
          >
            <div style={{ maxWidth: '760px' }}>
              <h1
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 'clamp(2.2rem, 4.5vw, 3.6rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  lineHeight: 1.04,
                  margin: '0 0 0.9rem',
                  color: '#072534',
                }}
              >
                <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.05em' }}>
                  <span className="iku-cat-mask-line" style={{ display: 'block' }}>
                    Katalog Resmi
                  </span>
                </span>
                <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.05em' }}>
                  <span className="iku-cat-mask-line" style={{ display: 'block', fontWeight: 700, color: '#094E68' }}>
                    8 Indikator Kinerja Utama.
                  </span>
                </span>
              </h1>
              <p className="iku-cat-hero" style={{ margin: 0, fontSize: '0.96rem', color: '#334155', lineHeight: 1.68 }}>
                Referensi resmi parameter pengukuran kinerja perguruan tinggi yang mencakup definisi operasional, rumusan perhitungan, standar target institusi, dan unit penanggung jawab (PIC).
              </p>
            </div>

            <div className="iku-cat-hero" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Link to="/documents" className="ent-btn" style={{ minHeight: 44 }}>
                Unduh Regulasi PDF <ArrowUpRight size={15} />
              </Link>
              <Link to="/login" className="ent-btn ent-btn-primary" style={{ minHeight: 44 }}>
                Portal Evaluasi Internal <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="iku-cat-keyline" style={{ height: '2px', background: '#094E68', width: '100%' }} />
        </header>

        {/* FILTER & SEARCH TOOLBAR */}
        <div
          className="iku-cat-hero"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div
            role="group"
            aria-label="Filter pilar indikator kinerja utama"
            className="iku-filter-track"
            style={{
              display: 'flex',
              gap: '4px',
              flexWrap: 'wrap',
              background: '#EDF3F6',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid #D8E4EA',
            }}
          >
            {PILLARS.map((pillar) => {
              const active = activePillar === pillar;
              return (
                <button
                  key={pillar}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActivePillar(pillar)}
                  className="iku-filter-btn"
                  style={{
                    background: active ? '#094E68' : 'transparent',
                    color: active ? '#ffffff' : '#334155',
                  }}
                >
                  {pillar}
                </button>
              );
            })}
          </div>

          <div
            className="iku-search-wrap"
            style={{ position: 'relative', minWidth: 'min(100%, 260px)', flex: '0 1 340px' }}
          >
            <Search
              size={15}
              color="#0E7480"
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="search"
              aria-label="Cari kode IKU, formula, atau unit PIC"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kode IKU, formula, atau unit PIC..."
              className="ent-input"
              style={{ paddingLeft: '36px', minHeight: 44 }}
            />
          </div>
        </div>

        {/* CONNECTED ARCHITECTURAL CATALOG GRID */}
        <div className="iku-ledger-grid">
          {filtered.map((item) => (
            <article id={`iku-${item.id}`} key={item.id} className="iku-ledger-cell iku-cat-card">
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1.15rem',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#0E7480',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {item.idx} // {item.code}
                  </span>
                  <span className="ent-badge ent-badge-info">{item.pillar}</span>
                </div>

                <h2
                  style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '1.24rem',
                    fontWeight: 800,
                    color: '#072534',
                    margin: '0 0 0.55rem',
                    letterSpacing: '-0.025em',
                    lineHeight: 1.28,
                  }}
                >
                  {item.title}
                </h2>

                <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.65 }}>
                  {item.desc}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderLeft: '2.5px solid #094E68',
                    background: '#F7FAFB',
                    borderRadius: '0 6px 6px 0',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      color: '#475569',
                      marginBottom: '0.3rem',
                    }}
                  >
                    FORMULA PERHITUNGAN STANDAR
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#072534', lineHeight: 1.48 }}>
                    {item.formula}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #EDF3F6',
                    fontSize: '0.76rem',
                  }}
                >
                  <span style={{ color: '#475569' }}>
                    PIC: <strong style={{ color: '#072534' }}>{item.pic}</strong>
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--ent-mono)',
                      fontWeight: 700,
                      color: '#094E68',
                      background: '#EDF3F6',
                      border: '1px solid #D8E4EA',
                      padding: '3px 9px',
                      borderRadius: '4px',
                      fontSize: '0.68rem',
                    }}
                  >
                    TARGET ≥ {item.target}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!filtered.length && (
          <div
            style={{
              padding: '3rem 1.5rem',
              border: '1px solid #D8E4EA',
              borderRadius: '8px',
              background: '#F7FAFB',
              textAlign: 'center',
              color: '#475569',
            }}
          >
            <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: '#072534' }}>
              Tidak ada indikator yang cocok dengan kata kunci atau filter pilar saat ini.
            </p>
            <button
              type="button"
              onClick={() => {
                setActivePillar('Semua Pilar');
                setQuery('');
              }}
              className="ent-btn ent-btn-primary"
              style={{ minHeight: 44 }}
            >
              Reset Filter Katalog
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
