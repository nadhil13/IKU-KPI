import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const GUIDE_SECTIONS = [
  {
    idx: '01',
    tag: 'INDIKATOR WAJIB KEMENTERIAN',
    title: 'Pelaporan 8 Indikator Kinerja Utama (IKU)',
    desc: 'Biro, fakultas, dan lembaga penanggung jawab (PIC) menginput capaian aktual beserta angka pembilang dan penyebut sesuai formula Kepmendikbudristek No. 210/M/2023.',
    checklist: [
      'Pilih periode evaluasi aktif pada ruang kerja 8 IKU.',
      'Isi nilai capaian aktual dan uraian ringkas kegiatan.',
      'Lampirkan tautan bukti dokumen resmi berformat HTTPS (Google Drive institusi, repositori, atau SK resmi).',
    ],
  },
  {
    idx: '02',
    tag: 'EVALUASI OPERASIONAL INTERNAL',
    title: 'Pengisian Lembar Kerja KPI 4 Perspektif',
    desc: 'Unit kerja dan dekanat mengisi target serta realisasi pada Perspektif Keberlanjutan (A), Mahasiswa (B), Bisnis Internal (C), dan Kepatuhan (D). Skor terhitung otomatis sesuai rumus bobot.',
    checklist: [
      'Masukkan angka realisasi pada kolom input lembar kerja unit.',
      'Periksa hasil kalkulasi persentase capaian dan skor terbobot secara langsung.',
      'Simpan draf kerja atau ajukan ke Direktorat PRP untuk diverifikasi.',
    ],
  },
  {
    idx: '03',
    tag: 'VERIFIKASI & PENETAPAN MUTU',
    title: 'Pemeriksaan Bukti & Persetujuan Direktorat PRP',
    desc: 'Auditor dan verifikator Direktorat PRP meninjau keabsahan setiap bukti pendukung sebelum mengunci skor akhir unit pada periode berjalan.',
    checklist: [
      'Setiap tautan bukti diperiksa satu per satu oleh verifikator PRP.',
      'Jika bukti belum sesuai, pengajuan dikembalikan berstatus Revisi beserta catatan perbaikan.',
      'Pengajuan yang telah lengkap disetujui (Approved) dan terekam pada jejak audit.',
    ],
  },
];

export default function Guide() {
  const mainRef = useRef(null);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    gsap.fromTo(
      '.reveal-init',
      { y: 32, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.9, stagger: 0.1, ease: 'expo.out', delay: 0.08 }
    );

    gsap.utils.toArray('.guide-block').forEach((block) => {
      const line = block.querySelector('.g-line');
      const content = block.querySelector('.g-content');
      if (line) {
        gsap.fromTo(
          line,
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: 'left center',
            duration: 0.9,
            ease: 'expo.inOut',
            scrollTrigger: { trigger: block, start: 'top 88%', once: true },
          }
        );
      }
      if (content) {
        gsap.fromTo(
          content,
          { y: 32, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: { trigger: block, start: 'top 86%', once: true },
          }
        );
      }
    });
  }, { scope: mainRef });

  return (
    <div ref={mainRef} style={{ background: '#ffffff', minHeight: '100dvh', color: '#072534' }}>
      <style>{`
        .guide-hero-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: clamp(1.75rem, 4vw, 4rem);
          align-items: end;
        }
        .guide-body-layout {
          display: grid;
          grid-template-columns: 260px 1fr;
          gap: clamp(2rem, 4vw, 4rem);
          align-items: start;
        }
        .guide-sticky-aside {
          position: sticky;
          top: 6.5rem;
          padding-top: 3.5rem;
        }
        @media (max-width: 960px) {
          .guide-hero-grid,
          .guide-body-layout {
            grid-template-columns: 1fr;
          }
          .guide-sticky-aside {
            display: none;
          }
        }
      `}</style>

      {/* ─── HERO SECTION ─── */}
      <section
        className="hero-section"
        style={{
          padding: 'clamp(7.5rem, 11vw, 10rem) clamp(1.25rem, 4vw, 4rem) clamp(3rem, 5vw, 4.5rem)',
          borderBottom: '1px solid #D8E4EA',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 1400, margin: '0 auto' }} className="guide-hero-grid">
          <div>
            <div className="reveal-init ent-eyebrow" style={{ marginBottom: '1.35rem' }}>
              03 // PROSEDUR OPERASIONAL STANDAR
            </div>
            <h1
              className="reveal-init"
              style={{
                fontSize: 'clamp(2.5rem, 6vw, 5.2rem)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 1.02,
                margin: 0,
                color: '#072534',
              }}
            >
              Panduan Pelaporan
              <br />
              <span style={{ color: '#094E68', fontWeight: 500 }}>&amp; Verifikasi Mutu.</span>
            </h1>
          </div>

          <div style={{ paddingBottom: '0.35rem' }}>
            <p
              className="reveal-init"
              style={{
                fontSize: 'clamp(1rem, 1.25vw, 1.12rem)',
                color: '#334155',
                margin: 0,
                lineHeight: 1.72,
                maxWidth: 520,
              }}
            >
              Tahapan kerja resmi bagi Unit PIC, Fakultas, Program Studi, dan Direktorat PRP dalam mengisi, melampirkan bukti pendukung, serta menyetujui capaian kinerja di lingkungan ITPLN.
            </p>
          </div>
        </div>
      </section>

      {/* ─── SPLIT-SCREEN EDITORIAL GUIDE ─── */}
      <section style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(1.25rem, 4vw, 4rem)' }}>
        <div className="guide-body-layout">
          <aside className="guide-sticky-aside">
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '8px',
                background: '#F7FAFB',
                border: '1px solid #D8E4EA',
                borderLeft: '3px solid #094E68',
              }}
            >
              <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.1em', color: '#0E7480', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                TAHAPAN EVALUASI
              </div>
              <ol style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingLeft: '1.1rem', margin: 0, fontSize: '0.84rem', color: '#334155', fontWeight: 600 }}>
                <li>Pelaporan 8 IKU Makro</li>
                <li>Pengisian KPI 4 Perspektif</li>
                <li>Verifikasi Direktorat PRP</li>
              </ol>
            </div>
          </aside>

          <div style={{ padding: 'clamp(2rem, 4vw, 3.5rem) 0 clamp(4rem, 7vw, 6rem)' }}>
            {GUIDE_SECTIONS.map((item) => (
              <article key={item.idx} className="guide-block" style={{ padding: 'clamp(2.25rem, 4vw, 3.75rem) 0' }}>
                <div className="g-line" style={{ width: '100%', height: 1.5, background: '#094E68', marginBottom: '2rem' }} />

                <div className="g-content" style={{ maxWidth: 820 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontFamily: 'var(--ent-mono)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        background: '#094E68',
                        color: '#ffffff',
                      }}
                    >
                      TAHAP {item.idx}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--ent-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#0E7480',
                      }}
                    >
                      {item.tag}
                    </span>
                  </div>

                  <h2
                    style={{
                      fontSize: 'clamp(1.65rem, 3.2vw, 2.5rem)',
                      fontWeight: 800,
                      color: '#072534',
                      letterSpacing: '-0.03em',
                      margin: '0 0 1rem',
                      lineHeight: 1.15,
                    }}
                  >
                    {item.title}
                  </h2>

                  <p style={{ fontSize: '1.02rem', color: '#334155', lineHeight: 1.75, margin: '0 0 1.5rem' }}>
                    {item.desc}
                  </p>

                  <ul
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      padding: '1.25rem 1.35rem',
                      borderRadius: '8px',
                      background: '#F7FAFB',
                      border: '1px solid #D8E4EA',
                    }}
                  >
                    {item.checklist.map((point, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.9rem', color: '#072534', lineHeight: 1.55 }}>
                        <CheckCircle2 size={17} color="#0E7480" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ACTION FOOTER SECTION (VALID ROUTES, NO DEAD HREF="#") ─── */}
      <section
        className="cta-section"
        style={{
          background: '#062C3D',
          color: '#ffffff',
          borderTop: '2px solid #1B9AAA',
          padding: 'clamp(4rem, 7vw, 6rem) clamp(1.25rem, 4vw, 4rem)',
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '2rem',
          }}
        >
          <div style={{ maxWidth: 620 }}>
            <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94B8C7', marginBottom: '0.75rem' }}>
              TINDAK LANJUT PELAPORAN
            </div>
            <h2 style={{ fontSize: 'clamp(1.85rem, 3.6vw, 2.85rem)', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.035em', margin: '0 0 0.65rem', lineHeight: 1.1 }}>
              Periksa Matriks Indikator atau Mulai Pengisian.
            </h2>
            <p style={{ margin: 0, color: '#C5DEE8', fontSize: '0.96rem', lineHeight: 1.68 }}>
              Tinjau spesifikasi formula pada katalog publik atau masuk ke portal internal menggunakan akun unit Anda.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
            <Link
              to="/iku-list"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                minHeight: '46px',
                padding: '0.95rem 1.5rem',
                borderRadius: '6px',
                background: '#ffffff',
                color: '#072534',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.76rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              Lihat Matriks 8 IKU <ArrowRight size={15} />
            </Link>

            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                minHeight: '46px',
                padding: '0.95rem 1.5rem',
                borderRadius: '6px',
                background: '#094E68',
                border: '1px solid #1B9AAA',
                color: '#ffffff',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.76rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              Masuk Ruang Kerja
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
