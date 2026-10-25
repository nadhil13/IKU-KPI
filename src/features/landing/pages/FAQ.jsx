import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const FAQS = [
  {
    q: 'Bagaimana alur pengajuan dan verifikasi capaian IKU maupun KPI di ITPLN?',
    a: 'Penanggung jawab indikator (PIC) pada fakultas, program studi, atau unit kerja mengisi realisasi capaian beserta tautan bukti dukung resmi, lalu mengirimkannya melalui portal internal. Tim Direktorat Perencanaan dan Pengembangan (PRP) kemudian meninjau kelengkapan bukti untuk memberikan persetujuan atau mengembalikan pengajuan disertai catatan revisi.',
  },
  {
    q: 'Format bukti dukung apa yang diterima saat pengiriman data kinerja?',
    a: 'Setiap pengajuan wajib menyertakan tautan dokumen berprotokol HTTPS (seperti repositori cloud resmi institusi atau surat keputusan terpublikasi) yang dapat diakses oleh verifikator PRP, dilengkapi ringkasan keterangan capaian pada kolom catatan.',
  },
  {
    q: 'Apa perbedaan hak akses antara akun PIC IKU, PIC KPI, dan Superadmin PRP?',
    a: 'Akun PIC IKU difokuskan pada pemantauan dan pelaporan 8 Indikator Kinerja Utama standar Kemendikbudristek. Akun PIC KPI mengelola lembar kerja Key Performance Indicator operasional unit dan fakultas. Sementara itu, Superadmin PRP mengelola periode aktif, skema tabel rumus KPI, akun pengguna, dan verifikasi lintas ruang kerja.',
  },
  {
    q: 'Bagaimana penyimpanan dan pencadangan data kerja dilakukan pada portal ini?',
    a: 'Pada lingkungan operasional peramban saat ini, perubahan lembar kerja, pengajuan bukti, dan log audit disimpan di penyimpanan lokal peramban (localStorage). Untuk pencadangan atau pemindahan data antarperangkat, Superadmin PRP dapat mengunduh dan mengimpor arsip konfigurasi berformat JSON pada menu Tata Kelola.',
  },
  {
    q: 'Apa yang harus dilakukan jika batas waktu (deadline) periode pelaporan telah terkunci?',
    a: 'Apabila tenggat pelaporan triwulan atau kebijakan penguncian periode telah aktif, tombol pengiriman dan penyuntingan nilai akan dinonaktifkan untuk menjaga konsistensi rekapitulasi. Unit kerja yang memerlukan koreksi data susulan dapat menghubungi tim PRP melalui kanal bantuan resmi di bawah ini.',
  },
  {
    q: 'Kapan target dan skema perhitungan indikator tahunan diperbarui?',
    a: 'Evaluasi bobot, rumus perhitungan, dan standar target tahunan dilakukan mengikuti penetapan Rencana Kerja dan Anggaran Tahunan (RKAT) ITPLN serta pembaruan buku panduan teknis IKU Diktisaintek.',
  },
];

export default function FAQ() {
  const mainRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tl = gsap.timeline({ delay: 0.06, defaults: { ease: 'expo.out' } });
    tl.fromTo('.faq-hero-eyebrow', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.65 })
      .fromTo('.faq-hero-title', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.85 }, '-=0.45')
      .fromTo('.faq-hero-desc', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.5');

    gsap.utils.toArray('.faq-row').forEach((row) => {
      gsap.fromTo(
        row,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: row,
            start: 'top 92%',
            once: true,
          },
        }
      );
    });

    gsap.utils.toArray('.contact-card').forEach((card) => {
      gsap.fromTo(
        card,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 92%',
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
        minHeight: '100dvh',
        color: '#072534',
      }}
    >
      <style>{`
        .faq-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
          gap: clamp(1.5rem, 4vw, 3.5rem);
          align-items: end;
        }
        .faq-layout-grid {
          display: grid;
          grid-template-columns: minmax(190px, 260px) minmax(0, 1fr);
          gap: clamp(1.5rem, 4vw, 3.5rem);
          align-items: start;
        }
        .faq-trigger-btn {
          width: 100%;
          min-height: 56px;
          padding: clamp(1.35rem, 2.5vw, 1.85rem) 0.5rem;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.25rem;
          text-align: left;
          color: #072534;
          font-family: inherit;
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        .faq-trigger-btn:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: -2px;
          border-radius: 6px;
        }
        .faq-plus-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid #D8E4EA;
          background: #F7FAFB;
          color: #094E68;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .faq-trigger-btn[aria-expanded="true"] .faq-plus-icon {
          transform: rotate(45deg);
          background: #094E68;
          border-color: #094E68;
          color: #ffffff;
        }
        .contact-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.25rem;
        }
        .contact-card-link {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1rem;
          padding: clamp(1.35rem, 2.5vw, 1.85rem);
          border-radius: 10px;
          border: 1px solid #D8E4EA;
          background: #F7FAFB;
          color: #072534;
          text-decoration: none;
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }
        @media (hover: hover) {
          .faq-trigger-btn:hover {
            background-color: #F7FAFB;
          }
          .faq-trigger-btn:hover .faq-q-text {
            color: #094E68;
          }
          .contact-card-link:hover {
            background-color: #ffffff;
            border-color: #094E68;
          }
        }
        @media (max-width: 860px) {
          .faq-hero-grid,
          .faq-layout-grid,
          .contact-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ─── HERO SECTION ─── */}
      <section
        style={{
          padding: 'clamp(7.5rem, 11vw, 10rem) clamp(1.25rem, 4vw, 4rem) clamp(2.5rem, 5vw, 4rem)',
        }}
      >
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div className="faq-hero-grid">
            <div>
              <div className="faq-hero-eyebrow ent-eyebrow" style={{ marginBottom: '1.25rem' }}>
                06 // PUSAT BANTUAN &amp; KONTAK TEKNIS
              </div>
              <h1
                className="faq-hero-title"
                style={{
                  fontSize: 'clamp(2.35rem, 5.5vw, 4.5rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  lineHeight: 1.04,
                  margin: 0,
                  color: '#072534',
                }}
              >
                Pertanyaan Umum &amp; <span style={{ color: '#094E68' }}>Layanan PRP.</span>
              </h1>
            </div>

            <div className="faq-hero-desc">
              <p
                style={{
                  fontSize: 'clamp(0.96rem, 1.2vw, 1.08rem)',
                  color: '#334155',
                  margin: '0 0 1.25rem',
                  lineHeight: 1.72,
                }}
              >
                Penjelasan teknis mengenai prosedur pengiriman bukti dukung, pembagian hak akses peran, mekanisme penyimpanan data, serta saluran koordinasi resmi Direktorat PRP ITPLN.
              </p>
              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <Link to="/guide" className="ent-btn" style={{ minHeight: 44 }}>
                  Baca SOP Pelaporan
                </Link>
                <Link to="/documents" className="ent-btn ent-btn-primary" style={{ minHeight: 44 }}>
                  Unduh Buku Panduan <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ACCORDION SECTION ─── */}
      <section style={{ padding: '0 clamp(1.25rem, 4vw, 4rem) clamp(4rem, 7vw, 6rem)' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div style={{ height: 2, background: '#094E68', width: '100%', marginBottom: 'clamp(2rem, 4vw, 3rem)' }} />

          <div className="faq-layout-grid">
            <div>
              <div
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#0E7480',
                  marginBottom: '0.5rem',
                }}
              >
                Direktori Tanya Jawab
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.6 }}>
                Pilih topik pertanyaan untuk membaca ketentuan operasional secara lengkap.
              </p>
            </div>

            <div>
              {FAQS.map((faq, idx) => {
                const isActive = activeIndex === idx;
                const buttonId = `faq-trigger-${idx}`;
                const panelId = `faq-panel-${idx}`;

                return (
                  <div
                    key={faq.q}
                    className="faq-row"
                    style={{ borderBottom: '1px solid #D8E4EA' }}
                  >
                    <h2 style={{ margin: 0, fontSize: 'inherit', fontWeight: 'inherit' }}>
                      <button
                        id={buttonId}
                        type="button"
                        aria-expanded={isActive}
                        aria-controls={panelId}
                        onClick={() => setActiveIndex(isActive ? -1 : idx)}
                        className="faq-trigger-btn"
                      >
                        <span
                          className="faq-q-text"
                          style={{
                            fontFamily: 'Outfit, sans-serif',
                            fontSize: 'clamp(1.12rem, 1.8vw, 1.42rem)',
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            lineHeight: 1.32,
                            transition: 'color 0.2s ease',
                          }}
                        >
                          {faq.q}
                        </span>
                        <span className="faq-plus-icon" aria-hidden="true">
                          <Plus size={18} strokeWidth={2.2} />
                        </span>
                      </button>
                    </h2>

                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      hidden={!isActive}
                      style={{
                        padding: '0 0.5rem 1.75rem',
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          color: '#334155',
                          fontSize: '0.96rem',
                          lineHeight: 1.75,
                          maxWidth: 780,
                        }}
                      >
                        {faq.a}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── ESCALATION & CONTACT SECTION ─── */}
      <section style={{ padding: '0 clamp(1.25rem, 4vw, 4rem) clamp(5rem, 9vw, 8rem)' }}>
        <div style={{ maxWidth: 1320, margin: '0 auto' }}>
          <div style={{ height: 1, background: '#D8E4EA', width: '100%', marginBottom: 'clamp(2.5rem, 5vw, 3.5rem)' }} />

          <div className="faq-layout-grid">
            <div>
              <div
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#0E7480',
                  marginBottom: '0.5rem',
                }}
              >
                Kanal Koordinasi Resmi
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.6 }}>
                Hubungi tim administrasi kinerja ITPLN pada jam kerja operasional untuk kendala akun, koreksi bukti, atau konsultasi perhitungan indikator.
              </p>
            </div>

            <div className="contact-cards-grid">
              {/* Primary Email Full Span */}
              <a
                href="mailto:iku-support@itpln.ac.id"
                className="contact-card contact-card-link"
                style={{
                  gridColumn: '1 / -1',
                  background: '#062C3D',
                  borderColor: '#094E68',
                  color: '#ffffff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#C5DEE8',
                    }}
                  >
                    <Mail size={15} /> Surat Elektronik Bantuan Teknis
                  </span>
                  <ArrowUpRight size={20} color="#C5DEE8" style={{ flexShrink: 0 }} />
                </div>

                <div
                  style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: 'clamp(1.25rem, 3.6vw, 2.35rem)',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.15,
                    color: '#ffffff',
                    overflowWrap: 'anywhere',
                  }}
                >
                  iku-support@itpln.ac.id
                </div>

                <div style={{ fontSize: '0.86rem', color: '#94B8C7', lineHeight: 1.5 }}>
                  Sertakan kode indikator (mis. IKU.03 atau kode KPI) dan nama unit kerja pada subjek pesan untuk mempercepat penanganan.
                </div>
              </a>

              {/* Campus Address */}
              <a
                href="https://maps.google.com/?q=Menara+PLN,+Jl.+Lingkar+Luar+Barat,+Duri+Kosambi,+Cengkareng,+Jakarta+Barat+11750"
                target="_blank"
                rel="noreferrer"
                className="contact-card contact-card-link"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#0E7480',
                    }}
                  >
                    <MapPin size={15} /> Kampus Pusat ITPLN
                  </span>
                  <ArrowUpRight size={18} color="#094E68" style={{ flexShrink: 0 }} />
                </div>

                <div>
                  <div
                    style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#072534',
                      marginBottom: '0.35rem',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    Menara PLN
                  </div>
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
                    Jl. Lingkar Luar Barat, Duri Kosambi, Cengkareng, Jakarta Barat 11750
                  </div>
                </div>
              </a>

              {/* Phone */}
              <a href="tel:+62215440342" className="contact-card contact-card-link">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#0E7480',
                    }}
                  >
                    <Phone size={15} /> Telepon Sekretariat
                  </span>
                  <ArrowUpRight size={18} color="#094E68" style={{ flexShrink: 0 }} />
                </div>

                <div>
                  <div
                    style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#072534',
                      marginBottom: '0.35rem',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    (021) 5440342
                  </div>
                  <div style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6 }}>
                    Ekstensi Layanan Kinerja: 123
                    <br />
                    Senin s.d. Jumat, 08.00 - 16.00 WIB
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
