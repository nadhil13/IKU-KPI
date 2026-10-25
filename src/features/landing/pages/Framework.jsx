import { useRef } from 'react';
import { Target, TrendingUp, Users, BookOpen, Briefcase, Globe, Award, ShieldCheck } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const ikuData = [
  { icon: <Briefcase size={24} />, title: 'Lulusan Mendapat Pekerjaan Layak', desc: 'Pemantauan serapan alumni pada dunia kerja, wirausaha, atau studi lanjut dalam masa tunggu terukur setelah kelulusan.' },
  { icon: <Globe size={24} />, title: 'Pengalaman Mahasiswa di Luar Kampus', desc: 'Partisipasi mahasiswa dalam magang industri, proyek kemasyarakatan, riset terapan, wirausaha, atau pertukaran akademik.' },
  { icon: <Users size={24} />, title: 'Dosen Berkegiatan di Luar Kampus', desc: 'Penugasan tridharma dosen pada mitra industri atau perguruan tinggi eksternal untuk menyelaraskan bahan ajar dengan praktik lapangan.' },
  { icon: <BookOpen size={24} />, title: 'Praktisi Mengajar di Kampus', desc: 'Keterlibatan praktisi industri dan kualifikasi kompetensi dosen dalam perkuliahan program studi.' },
  { icon: <TrendingUp size={24} />, title: 'Hasil Kerja Dosen Digunakan Masyarakat', desc: 'Keluaran riset, publikasi ilmiah, HKI, dan karya terapan dosen yang dimanfaatkan mitra atau masyarakat.' },
  { icon: <Target size={24} />, title: 'Kemitraan Program Studi', desc: 'Kerja sama akademik aktif antara program studi dengan mitra industri, institusi riset, dan perguruan tinggi.' },
  { icon: <Award size={24} />, title: 'Kelas Kolaboratif dan Partisipatif', desc: 'Evaluasi mata kuliah yang menerapkan metode pemecahan kasus (Case Method) dan proyek kelompok (Team-Based Project).' },
  { icon: <ShieldCheck size={24} />, title: 'Program Studi Berstandar Internasional', desc: 'Pencapaian akreditasi atau sertifikasi internasional yang diakui pada tingkat program studi.' },
];

export default function Framework() {
  const containerRef = useRef();

  useGSAP(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      '.fw-hero-el',
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.75, stagger: 0.1, ease: 'power3.out' }
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} style={{ background: '#F7FAFB', minHeight: '100dvh', color: '#072534' }}>
      <section style={{ paddingTop: '7.5rem', paddingBottom: '4rem', borderBottom: '1px solid #D8E4EA', background: '#FFFFFF' }}>
        <div className="container" style={{ padding: '0 1.5rem' }}>
          <div style={{ maxWidth: '780px' }}>
            <h1 className="fw-hero-el" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.035em', margin: '0 0 1rem 0', color: '#072534' }}>
              Kerangka Strategis Mutu ITPLN
            </h1>
            <p className="fw-hero-el" style={{ fontSize: '1.05rem', color: '#334155', lineHeight: 1.7, maxWidth: '65ch', margin: 0 }}>
              Pemetaan delapan Indikator Kinerja Utama perguruan tinggi beserta siklus evaluasi berkala oleh Direktorat Perencanaan dan Pengembangan (PRP) ITPLN.
            </p>
          </div>
        </div>
      </section>

      <section style={{ padding: '4rem 0' }}>
        <div className="container" style={{ padding: '0 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {ikuData.map((iku, idx) => (
            <article
              key={iku.title}
              style={{
                background: '#FFFFFF',
                padding: '1.5rem',
                borderRadius: '8px',
                border: '1px solid #D8E4EA',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ background: '#EDF3F6', color: '#094E68', padding: '0.6rem', borderRadius: '6px', display: 'inline-flex' }}>
                  {iku.icon}
                </div>
                <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                  IKU-0{idx + 1}
                </span>
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#072534' }}>
                {iku.title}
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#334155', margin: 0, lineHeight: 1.6 }}>
                {iku.desc}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
