import { useRef } from 'react';
import { ArrowUpRight, BarChart3, CalendarDays, ClipboardCheck, Database, FileCog, ShieldCheck, Users, Workflow } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';

gsap.registerPlugin(ScrollTrigger);

const controlCards = [
  { label: 'Submission menunggu tinjauan', value: '12', meta: '8 KPI · 4 IKU', icon: ClipboardCheck, tone: 'ink' },
  { label: 'Konfigurasi aktif', value: '08', meta: '4 bagian KPI · 4 bagian IKU', icon: FileCog, tone: 'slate' },
  { label: 'Pengguna terdaftar', value: '24', meta: '22 aktif · 2 nonaktif', icon: Users, tone: 'quiet' },
  { label: 'Periode evaluasi', value: '01', meta: '2026/2027 · aktif', icon: CalendarDays, tone: 'line' },
];

const activity = [
  { time: '09:42', title: 'Submission KPI diterima', detail: 'Fakultas Teknologi Industri · KPI-2026-014', status: 'Menunggu tinjauan' },
  { time: '08:18', title: 'Konfigurasi formula diperbarui', detail: 'KPI C.2 · Versi 02 · Berlaku 2027/2028', status: 'Draft tersimpan' },
  { time: 'Kemarin', title: 'Periode evaluasi diaktifkan', detail: 'Tahun Ajaran 2026/2027 · batas 30 Okt 2026', status: 'Aktif' },
];

export default function AdminPRPDashboard() {
  const pageRef = useRef(null);
  const { currentUser } = useAuth();

  useGSAP(() => {
    const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
    intro
      .from('.prp-eyebrow', { y: 14, opacity: 0, duration: 0.55 })
      .from('.prp-title', { y: 22, opacity: 0, duration: 0.7 }, '-=0.3')
      .from('.prp-lede', { y: 14, opacity: 0, duration: 0.55 }, '-=0.42')
      .from('.prp-hero-action', { x: 16, opacity: 0, duration: 0.55 }, '<')
      .from('.prp-card', { y: 24, opacity: 0, duration: 0.65, stagger: 0.08 }, '-=0.25');

    const scroller = document.querySelector('.internal-main-scroll');
    if (!scroller) return;

    gsap.utils.toArray('.prp-reveal').forEach((element) => {
      gsap.fromTo(element, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, ease: 'power3.out', scrollTrigger: { trigger: element, scroller, start: 'top 86%', once: true } });
    });

    gsap.to('.prp-grid-line', { yPercent: 12, duration: 5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }, { scope: pageRef });

  return (
    <section ref={pageRef} className="prp-page">
      <style>{`
        .prp-page { max-width: 1380px; margin: 0 auto; padding: 0.25rem 0 4rem; color: #0f172a; }
        .prp-hero { position: relative; overflow: hidden; min-height: 250px; padding: 2.4rem; border-radius: 22px; color: #f8fafc; background: #0f172a; box-shadow: 0 18px 40px rgba(15,23,42,.12); }
        .prp-hero::after { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(148,163,184,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.1) 1px, transparent 1px); background-size: 42px 42px; mask-image: linear-gradient(120deg, rgba(0,0,0,.85), transparent 75%); pointer-events: none; }
        .prp-grid-line { position: absolute; right: 10%; top: -35%; width: 1px; height: 180%; background: rgba(226,232,240,.2); transform: rotate(28deg); }
        .prp-hero-content { position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; }
        .prp-eyebrow { display: inline-flex; align-items: center; gap: .45rem; color: #cbd5e1; font-size: .68rem; letter-spacing: .13em; font-weight: 700; text-transform: uppercase; }
        .prp-title { margin: .8rem 0 .6rem; max-width: 760px; color: #fff; font: 800 clamp(2rem, 4vw, 3.5rem)/.98 Outfit, Inter, sans-serif; letter-spacing: -.055em; }
        .prp-lede { max-width: 660px; margin: 0; color: #cbd5e1; font-size: .88rem; line-height: 1.7; }
        .prp-hero-action { display: inline-flex; align-items: center; gap: .55rem; flex-shrink: 0; padding: .75rem 1rem; border: 1px solid rgba(226,232,240,.22); border-radius: 10px; color: #f8fafc; background: rgba(255,255,255,.08); text-decoration: none; font-size: .75rem; font-weight: 700; transition: .25s ease; }
        .prp-hero-action:hover { background: #fff; color: #0f172a; }
        .prp-section { margin-top: 2rem; }
        .prp-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: .85rem; }
        .prp-section-head h2 { margin: 0; font: 800 1.05rem Outfit, sans-serif; letter-spacing: -.02em; }
        .prp-section-head p { margin: .3rem 0 0; color: #64748b; font-size: .76rem; }
        .prp-link { color: #475569; font-size: .72rem; font-weight: 700; text-decoration: none; }
        .prp-link:hover { color: #0f172a; }
        .prp-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: .8rem; }
        .prp-card { min-height: 150px; padding: 1.15rem; border: 1px solid #e2e8f0; border-radius: 15px; background: #fff; box-shadow: 0 5px 20px rgba(15,23,42,.025); }
        .prp-card-icon { width: 31px; height: 31px; display: grid; place-items: center; margin-bottom: 1.15rem; border-radius: 8px; color: #334155; background: #f1f5f9; }
        .prp-card-label { color: #64748b; font-size: .7rem; font-weight: 700; line-height: 1.35; }
        .prp-card-value { display: block; margin: .35rem 0 .18rem; font: 800 1.8rem/1 Outfit, sans-serif; letter-spacing: -.04em; }
        .prp-card-meta { color: #94a3b8; font-size: .68rem; }
        .prp-lower { display: grid; grid-template-columns: 1.3fr .7fr; gap: .8rem; }
        .prp-panel { border: 1px solid #e2e8f0; border-radius: 15px; background: #fff; overflow: hidden; }
        .prp-panel-head { display: flex; justify-content: space-between; align-items: center; padding: 1.1rem 1.2rem; border-bottom: 1px solid #f1f5f9; }
        .prp-panel-head h3 { margin: 0; font: 800 .9rem Outfit, sans-serif; }
        .prp-panel-head span { color: #94a3b8; font-size: .68rem; }
        .prp-activity { display: grid; grid-template-columns: 62px 1fr auto; gap: 1rem; align-items: start; padding: 1rem 1.2rem; border-bottom: 1px solid #f1f5f9; }
        .prp-activity:last-child { border-bottom: 0; }
        .prp-time { color: #94a3b8; font-size: .68rem; font-variant-numeric: tabular-nums; }
        .prp-activity strong { display: block; font-size: .76rem; }
        .prp-activity small { display: block; margin-top: .25rem; color: #64748b; font-size: .68rem; }
        .prp-status { padding: .28rem .48rem; border: 1px solid #e2e8f0; border-radius: 5px; color: #475569; background: #f8fafc; font-size: .62rem; white-space: nowrap; }
        .prp-command { display: grid; grid-template-columns: repeat(2, 1fr); gap: .65rem; padding: 1.2rem; }
        .prp-command a { display: flex; align-items: center; gap: .65rem; min-height: 62px; padding: .8rem; border: 1px solid #e2e8f0; border-radius: 10px; color: #334155; text-decoration: none; transition: .25s ease; }
        .prp-command a:hover { border-color: #94a3b8; background: #f8fafc; transform: translateY(-2px); }
        .prp-command svg { color: #64748b; }
        .prp-command strong { display: block; font-size: .7rem; }
        .prp-command small { display: block; margin-top: .18rem; color: #94a3b8; font-size: .62rem; }
        @media (max-width: 900px) { .prp-cards { grid-template-columns: repeat(2, 1fr); } .prp-lower { grid-template-columns: 1fr; } .prp-hero-content { align-items: flex-start; flex-direction: column; } }
        @media (max-width: 560px) { .prp-hero { padding: 1.35rem; } .prp-cards { grid-template-columns: 1fr; } .prp-activity { grid-template-columns: 48px 1fr; } .prp-status { grid-column: 2; justify-self: start; } }
      `}</style>

      <div className="prp-hero">
        <span className="prp-grid-line" />
        <div className="prp-hero-content">
          <div>
            <div className="prp-eyebrow"><ShieldCheck size={13} /> PRP / PLATFORM CONTROL CENTER</div>
            <h1 className="prp-title">Satu pusat kendali untuk kinerja terpadu.</h1>
            <p className="prp-lede">Kelola submission IKU dan KPI, konfigurasi indikator, formula, periode evaluasi, serta akses pengguna dari satu ruang kerja yang terukur.</p>
          </div>
          <div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap' }}>
            <Link className="prp-hero-action" to="/internal/admin/governance">Kelola konfigurasi <ArrowUpRight size={15} /></Link>
            <Link className="prp-hero-action" to="/internal/users">Kelola akses pengguna <ArrowUpRight size={15} /></Link>
          </div>
        </div>
      </div>

      <div className="prp-section prp-reveal">
        <div className="prp-section-head"><div><h2>Ringkasan operasional</h2><p>Snapshot sistem untuk sesi {currentUser?.shortName || 'Superadmin PRP'}.</p></div><span className="prp-link">Diperbarui barusan</span></div>
        <div className="prp-cards">{controlCards.map(({ label, value, meta, icon: Icon }) => <div className="prp-card" key={label}><div className="prp-card-icon"><Icon size={16} /></div><span className="prp-card-label">{label}</span><strong className="prp-card-value">{value}</strong><span className="prp-card-meta">{meta}</span></div>)}</div>
      </div>

      <div className="prp-section prp-lower prp-reveal">
        <div className="prp-panel"><div className="prp-panel-head"><h3>Aktivitas terbaru</h3><span>Audit stream</span></div>{activity.map((item) => <div className="prp-activity" key={`${item.time}-${item.title}`}><span className="prp-time">{item.time}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><span className="prp-status">{item.status}</span></div>)}</div>
        <div className="prp-panel"><div className="prp-panel-head"><h3>Akses cepat</h3><span>PRP tools</span></div><div className="prp-command"><Link to="/internal/admin/governance"><FileCog size={16} /><span><strong>Konfigurasi kinerja</strong><small>Tabel, rumus & versi</small></span></Link><Link to="/internal/users"><Users size={16} /><span><strong>Manajemen user</strong><small>Role & akses</small></span></Link><Link to="/internal"><BarChart3 size={16} /><span><strong>Evaluasi KPI</strong><small>Workspace aktif</small></span></Link><Link to="/internal/team"><Database size={16} /><span><strong>Unit & tim</strong><small>Struktur organisasi</small></span></Link><Link to="/internal/profile"><Workflow size={16} /><span><strong>Profil sesi</strong><small>Preferensi akun</small></span></Link></div></div>
      </div>
    </section>
  );
}
