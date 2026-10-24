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
    desc: 'Mahasiswa S1 dan D4/D3 yang memperoleh minimal 10–20 SKS kegiatan pembelajaran di luar program studi (magang industri BUMN/PLN, riset terapan, pertukaran pelajar, atau prestasi kompetisi).',
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
      const matchQuery = !query.trim()
        || `${item.code} ${item.title} ${item.desc} ${item.pic}`.toLowerCase().includes(query.toLowerCase());
      return matchPillar && matchQuery;
    });
  }, [activePillar, query]);

  useGSAP(() => {
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
    const cards = gsap.utils.toArray('.iku-cat-card');
    cards.forEach((card, idx) => {
      gsap.fromTo(
        card,
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.65,
          delay: (idx % 2) * 0.05,
          ease: 'expo.out',
          clearProps: 'transform',
          scrollTrigger: {
            trigger: card,
            start: 'top 92%',
            toggleActions: 'play none none none',
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
        minHeight: '100vh',
        paddingTop: '7.5rem',
        paddingBottom: '6rem',
        color: '#09090b',
      }}
    >
      <style>{`
        .iku-ledger-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          border-top: 1px solid #e4e4e7;
          border-left: 1px solid #e4e4e7;
        }
        .iku-ledger-cell {
          padding: 1.85rem 1.75rem;
          border-right: 1px solid #e4e4e7;
          border-bottom: 1px solid #e4e4e7;
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
          height: 2px;
          background: #09090b;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.34s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .iku-ledger-cell:hover {
          background: #fafafa;
        }
        .iku-ledger-cell:hover::before {
          transform: scaleX(1);
        }
        @media (max-width: 500px) {
          .iku-ledger-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '0 clamp(1.25rem, 4vw, 2.5rem)' }}>
        {/* HERO MASTHEAD */}
        <header style={{ marginBottom: '2.25rem' }}>
          <div className="iku-cat-hero" style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#71717a', marginBottom: '1rem' }}>
            KEPMENDIKBUDRISTEK NO. 210/M/2023 // DIREKTORAT PRP ITPLN
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1.5rem', paddingBottom: '1.85rem' }}>
            <div style={{ maxWidth: '760px' }}>
              <h1
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: 'clamp(2.2rem, 4.5vw, 3.6rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.045em',
                  lineHeight: 1.03,
                  margin: '0 0 0.9rem',
                  color: '#09090b',
                }}
              >
                <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.05em' }}>
                  <span className="iku-cat-mask-line" style={{ display: 'block' }}>Katalog Eksekutif</span>
                </span>
                <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.05em' }}>
                  <span className="iku-cat-mask-line" style={{ display: 'block', fontWeight: 400, color: '#52525b' }}>
                    8 Indikator Kinerja Utama.
                  </span>
                </span>
              </h1>
              <p className="iku-cat-hero" style={{ margin: 0, fontSize: '0.95rem', color: '#52525b', lineHeight: 1.65 }}>
                Referensi resmi parameter pengukuran kinerja perguruan tinggi — mencakup definisi operasional, rumusan perhitungan, standar target institusi, dan unit penanggung jawab (PIC).
              </p>
            </div>

            <div className="iku-cat-hero" style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              <Link to="/documents" className="ent-btn">
                Unduh Regulasi PDF <ArrowUpRight size={14} />
              </Link>
              <Link to="/login" className="ent-btn ent-btn-primary">
                Portal Evaluasi Internal <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="iku-cat-keyline" style={{ height: '2px', background: '#09090b', width: '100%' }} />
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
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', background: '#efeff1', padding: '3px', borderRadius: '6px', border: '1px solid #e4e4e7' }}>
            {PILLARS.map((pillar) => {
              const active = activePillar === pillar;
              return (
                <button
                  key={pillar}
                  type="button"
                  onClick={() => setActivePillar(pillar)}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: active ? '#09090b' : 'transparent',
                    color: active ? '#ffffff' : '#52525b',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {pillar}
                </button>
              );
            })}
          </div>

          <div style={{ position: 'relative', minWidth: '270px', flex: '0 1 340px' }}>
            <Search size={14} color="#71717a" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kode IKU, formula, atau unit PIC..."
              className="ent-input"
              style={{ paddingLeft: '34px' }}
            />
          </div>
        </div>

        {/* CONNECTED ARCHITECTURAL CATALOG GRID */}
        <div className="iku-ledger-grid">
          {filtered.map((item) => (
            <article
              id={`iku-${item.id}`}
              key={item.id}
              className="iku-ledger-cell iku-cat-card"
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.15rem' }}>
                  <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.72rem', fontWeight: 700, color: '#09090b', letterSpacing: '0.06em' }}>
                    {item.idx} // {item.code}
                  </span>
                  <span className="ent-badge">{item.pillar}</span>
                </div>

                <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.22rem', fontWeight: 800, color: '#09090b', margin: '0 0 0.55rem', letterSpacing: '-0.025em', lineHeight: 1.28 }}>
                  {item.title}
                </h2>

                <p style={{ margin: 0, fontSize: '0.84rem', color: '#52525b', lineHeight: 1.62 }}>
                  {item.desc}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ padding: '0.8rem 0.95rem', borderLeft: '2px solid #09090b', background: '#fafafa' }}>
                  <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#71717a', marginBottom: '0.25rem' }}>
                    FORMULA PERHITUNGAN STANDAR
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#09090b', lineHeight: 1.45 }}>
                    {item.formula}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.7rem', borderTop: '1px solid #f4f4f5', fontSize: '0.75rem' }}>
                  <span style={{ color: '#71717a' }}>
                    PIC: <strong style={{ color: '#09090b' }}>{item.pic}</strong>
                  </span>
                  <span style={{ fontFamily: 'var(--ent-mono)', fontWeight: 700, color: '#09090b', background: '#fafafa', border: '1px solid #e4e4e7', padding: '2px 8px', borderRadius: '4px', fontSize: '0.66rem' }}>
                    TARGET ≥ {item.target}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!filtered.length && (
          <div style={{ padding: '3rem', border: '1px solid #e4e4e7', textAlign: 'center', color: '#71717a' }}>
            Tidak ada indikator yang cocok dengan kata kunci pencarian Anda.
          </div>
        )}
      </div>
    </div>
  );
}
