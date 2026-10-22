import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, CalendarDays, ClipboardCheck, Database, FileCog, ShieldCheck, Users, Workflow } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Link } from 'react-router-dom';
import { readMergedUsers, useAuth } from '../../auth/context/AuthContext';
import { readAudit } from '../adminStore';
import { readKpiWorkflow } from '../../kpi/kpiWorkflowStore';
import { listIkuSubmissions } from '../../iku/ikuWorkflowStore';

gsap.registerPlugin(ScrollTrigger);


export default function AdminPRPDashboard() {
  const pageRef = useRef(null);
  const { currentUser } = useAuth();
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    const events = ['storage', 'focus', 'prp-admin-updated', 'prp-kpi-workflow-updated', 'prp-iku-updated'];
    events.forEach((event) => window.addEventListener(event, update));
    return () => events.forEach((event) => window.removeEventListener(event, update));
  }, []);
  const users = readMergedUsers();
  let periods = [];
  try { const saved = JSON.parse(localStorage.getItem('prp_periods') || '[]'); if (Array.isArray(saved)) periods = saved; } catch { /* No persisted periods. */ }
  const kpi = readKpiWorkflow();
  const iku = listIkuSubmissions(currentUser);
  const kpiPending = Object.values(kpi.submissions).filter((record) => record.status === 'SUBMITTED').length;
  const ikuPending = iku.filter((record) => record.status === 'SUBMITTED').length;
  const active = users.filter((user) => user.status === 'Aktif').length;
  const controlCards = [
    { label: 'Submission menunggu tinjauan', value: kpiPending + ikuPending, meta: `${kpiPending} KPI · ${ikuPending} IKU`, icon: ClipboardCheck },
    { label: 'Formulir KPI terdistribusi', value: kpi.forms.length, meta: 'Snapshot tersimpan', icon: FileCog },
    { label: 'Pengguna terdaftar', value: users.length, meta: `${active} aktif · ${users.length - active} nonaktif`, icon: Users },
    { label: 'Periode evaluasi', value: periods.length, meta: `${periods.filter((period) => period.status === 'Active').length} aktif`, icon: CalendarDays },
  ];
  const activity = [
    ...readAudit().map((entry) => ({ at: entry.at, title: entry.action, detail: `${entry.detail} · ${entry.actor}`, status: 'Audit lokal' })),
    ...Object.values(kpi.submissions).flatMap((record) => (record.history || []).map((entry) => ({ at: entry.at, title: 'Submission KPI', detail: `${record.unit || record.email} · ${entry.note || ''}`, status: entry.status }))),
    ...iku.flatMap((record) => (record.history || []).map((entry) => ({ at: entry.at, title: 'Submission IKU', detail: `${record.unit} · ${entry.reason || ''}`, status: entry.status }))),
  ].filter((entry) => entry.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8).map((entry) => ({ ...entry, time: new Date(entry.at).toLocaleString('id-ID') }));

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
        <Link className="prp-link" to="/internal/iku-submissions">Tinjau submission IKU <ArrowUpRight size={15} /></Link>
        {!activity.length && <p>Belum ada aktivitas tercatat.</p>}
        <div className="prp-panel"><div className="prp-panel-head"><h3>Aktivitas terbaru</h3><span>Audit stream</span></div>{activity.map((item) => <div className="prp-activity" key={`${item.time}-${item.title}`}><span className="prp-time">{item.time}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><span className="prp-status">{item.status}</span></div>)}</div>
        <div className="prp-panel"><div className="prp-panel-head"><h3>Akses cepat</h3><span>PRP tools</span></div><div className="prp-command"><Link to="/internal/admin/governance"><FileCog size={16} /><span><strong>Konfigurasi kinerja</strong><small>Tabel, rumus & versi</small></span></Link><Link to="/internal/users"><Users size={16} /><span><strong>Manajemen user</strong><small>Role & akses</small></span></Link><Link to="/internal"><BarChart3 size={16} /><span><strong>Evaluasi KPI</strong><small>Workspace aktif</small></span></Link><Link to="/internal/team"><Database size={16} /><span><strong>Unit & tim</strong><small>Struktur organisasi</small></span></Link><Link to="/internal/profile"><Workflow size={16} /><span><strong>Profil sesi</strong><small>Preferensi akun</small></span></Link></div></div>
      </div>
    </section>
  );
}
