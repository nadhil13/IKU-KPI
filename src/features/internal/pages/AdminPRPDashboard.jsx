import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Link } from 'react-router-dom';
import { readMergedUsers, useAuth } from '../../auth/context/AuthContext';
import { readAudit, readSystemConfig } from '../adminStore';
import { readKpiWorkflow } from '../../kpi/kpiWorkflowStore';
import { listIkuSubmissions } from '../../iku/ikuWorkflowStore';

gsap.registerPlugin(ScrollTrigger);

const formatClock = () =>
  new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

export default function AdminPRPDashboard() {
  const pageRef = useRef(null);
  const { currentUser } = useAuth();
  const [, refresh] = useState(0);
  const [clock, setClock] = useState(formatClock);

  useEffect(() => {
    const update = () => refresh((value) => value + 1);
    const events = ['storage', 'focus', 'prp-admin-updated', 'prp-kpi-workflow-updated', 'prp-iku-updated'];
    events.forEach((event) => window.addEventListener(event, update));
    return () => events.forEach((event) => window.removeEventListener(event, update));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(timer);
  }, []);

  const users = readMergedUsers();
  let periods = [];
  try {
    const saved = JSON.parse(localStorage.getItem('prp_periods') || '[]');
    if (Array.isArray(saved)) periods = saved;
  } catch { /* No persisted periods. */ }

  const kpi = readKpiWorkflow();
  const iku = listIkuSubmissions(currentUser);
  const kpiPending = Object.values(kpi.submissions).filter((record) => record.status === 'SUBMITTED').length;
  const ikuPending = iku.filter((record) => record.status === 'SUBMITTED').length;
  const active = users.filter((user) => user.status === 'Aktif').length;
  const sysConfig = readSystemConfig();
  const activePeriodLabel = periods.find((p) => p.status === 'Active')?.id || '2025/2026';

  const controlLedger = [
    {
      idx: '01',
      code: 'QUEUE.REV',
      label: 'Submission Menunggu Review',
      value: kpiPending + ikuPending,
      meta: `${kpiPending} KPI · ${ikuPending} IKU siap diverifikasi`,
      to: '/internal/admin/governance?tab=submissions',
    },
    {
      idx: '02',
      code: 'DIST.KPI',
      label: 'Formulir KPI Terdistribusi',
      value: kpi.forms.length,
      meta: 'Snapshot versi tersimpan per siklus',
      to: '/internal/admin/governance?tab=kpi-builder',
    },
    {
      idx: '03',
      code: 'AUTH.USR',
      label: 'Entitas Pengguna Terdaftar',
      value: users.length,
      meta: `${active} aktif · ${users.length - active} dinonaktifkan`,
      to: '/internal/users',
    },
    {
      idx: '04',
      code: 'CYC.PER',
      label: 'Siklus Periode Evaluasi',
      value: periods.length || 2,
      meta: `Periode berjalan: ${activePeriodLabel}`,
      to: '/internal/admin/governance?tab=periods',
    },
  ];

  const commandModules = [
    {
      idx: '01',
      title: 'Desainer Tabel & Rumus KPI',
      sub: 'Mesin formula sel lintas baris & publikasi versi',
      to: '/internal/admin/governance?tab=kpi-builder',
    },
    {
      idx: '02',
      title: 'Pusat Review Submission Unit',
      sub: 'Verifikasi eviden HTTPS & keputusan persetujuan',
      to: '/internal/admin/governance?tab=submissions',
    },
    {
      idx: '03',
      title: 'Manajemen Akun & Hak Akses',
      sub: 'Otoritas terisolasi IKU, KPI, dan Superadmin PRP',
      to: '/internal/users',
    },
    {
      idx: '04',
      title: 'Struktur Organisasi & Unit PIC',
      sub: 'Hierarki rektorat, fakultas, direktorat, dan biro',
      to: '/internal/team',
    },
    {
      idx: '05',
      title: 'Inspeksi Workspace Evaluasi',
      sub: 'Pratinjau langsung dasbor 8 IKU & lembar kerja KPI',
      to: '/internal',
    },
    {
      idx: '06',
      title: 'Kebijakan & Parameter Sistem',
      sub: 'Tenggat global, sandi minimum, dan mode pemeliharaan',
      to: '/internal/admin/governance?tab=settings',
    },
  ];

  const activity = [
    ...readAudit().map((entry) => ({
      at: entry.at,
      title: entry.action,
      detail: `${entry.detail} — ${entry.actor}`,
      status: 'AUDIT',
      tone: 'audit',
    })),
    ...Object.values(kpi.submissions).flatMap((record) =>
      (record.history || []).map((entry) => ({
        at: entry.at,
        title: 'SUBMISSION_KPI_UNIT',
        detail: `${record.unit || record.email}${entry.note ? ` — ${entry.note}` : ''}`,
        status: entry.status,
        tone: entry.status === 'APPROVED' ? 'ok' : entry.status === 'SUBMITTED' ? 'pending' : 'neutral',
      }))
    ),
    ...iku.flatMap((record) =>
      (record.history || []).map((entry) => ({
        at: entry.at,
        title: 'SUBMISSION_8_IKU',
        detail: `${record.unit}${entry.reason ? ` — ${entry.reason}` : ''}`,
        status: entry.status,
        tone: entry.status === 'APPROVED' ? 'ok' : entry.status === 'SUBMITTED' ? 'pending' : 'neutral',
      }))
    ),
  ]
    .filter((entry) => entry.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 8)
    .map((entry) => ({
      ...entry,
      time: new Date(entry.at).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    // 1. Editorial Masthead Choreography (Masked Split Reveal + Hairline Draw)
    tl.fromTo(
      '.prp-meta-strip',
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.55 }
    )
      .fromTo(
        '.prp-title-line',
        { yPercent: 115 },
        { yPercent: 0, duration: 0.85, stagger: 0.08 },
        '-=0.35'
      )
      .fromTo(
        '.prp-mast-sub',
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.65, stagger: 0.06 },
        '-=0.55'
      )
      .fromTo(
        '.prp-keyline',
        { scaleX: 0 },
        { scaleX: 1, transformOrigin: 'left center', duration: 0.95, ease: 'expo.inOut' },
        '-=0.65'
      )
      .fromTo(
        '.prp-ledger-cell',
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.06, clearProps: 'transform' },
        '-=0.55'
      );

    // 2. Live Numeric Odometer Counter Roll-Up
    const counters = gsap.utils.toArray('.prp-odometer');
    counters.forEach((node) => {
      const target = Number(node.getAttribute('data-target') || 0);
      const state = { val: 0 };
      gsap.to(state, {
        val: target,
        duration: 1.15,
        delay: 0.2,
        ease: 'expo.out',
        onUpdate: () => {
          node.textContent = String(Math.round(state.val)).padStart(2, '0');
        },
      });
    });

    // 3. ScrollTrigger Choreographed Lower Panels & Rows
    const scroller = document.querySelector('.internal-main-scroll');
    if (scroller) {
      gsap.utils.toArray('.prp-scroll-block').forEach((block) => {
        gsap.fromTo(
          block,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: 0.75,
            ease: 'expo.out',
            clearProps: 'transform',
            scrollTrigger: {
              trigger: block,
              scroller,
              start: 'top 90%',
              once: true,
            },
          }
        );
      });

      gsap.fromTo(
        '.prp-row-stagger',
        { opacity: 0, x: -14 },
        {
          opacity: 1,
          x: 0,
          duration: 0.55,
          stagger: 0.045,
          ease: 'expo.out',
          clearProps: 'transform',
          scrollTrigger: {
            trigger: '.prp-lower-grid',
            scroller,
            start: 'top 88%',
            once: true,
          },
        }
      );
    }
  }, { scope: pageRef });

  return (
    <section ref={pageRef} className="prp-arch-page">
      <style>{`
        .prp-arch-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 0 4rem;
          color: #09090b;
        }
        .prp-meta-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e4e4e7;
          font-family: var(--ent-mono);
          font-size: 0.66rem;
          color: #71717a;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .prp-masthead {
          padding: 2rem 0 1.85rem;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 2rem;
        }
        .prp-display-h1 {
          margin: 0;
          font-family: Outfit, sans-serif;
          font-size: clamp(2.15rem, 4.2vw, 3.45rem);
          font-weight: 800;
          line-height: 1.02;
          letter-spacing: -0.045em;
          color: #09090b;
        }
        .prp-title-mask {
          overflow: hidden;
          display: block;
          padding-bottom: 0.06em;
        }
        .prp-title-line {
          display: block;
          will-change: transform;
        }
        .prp-mast-lede {
          margin: 1rem 0 0;
          max-width: 600px;
          font-size: 0.9rem;
          line-height: 1.65;
          color: #52525b;
        }
        .prp-keyline {
          width: 100%;
          height: 2px;
          background: #09090b;
        }
        /* Connected 4-Column Architectural Telemetry Ledger */
        .prp-ledger-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid #e4e4e7;
          background: #ffffff;
        }
        .prp-ledger-cell {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 184px;
          padding: 1.5rem 1.4rem;
          border-right: 1px solid #e4e4e7;
          text-decoration: none;
          color: inherit;
          background: #ffffff;
          transition: background-color 0.24s ease;
        }
        .prp-ledger-cell:last-child {
          border-right: none;
        }
        .prp-ledger-cell::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 2px;
          background: #09090b;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .prp-ledger-cell:hover {
          background: #fafafa;
        }
        .prp-ledger-cell:hover::after {
          transform: scaleX(1);
        }
        .prp-ledger-arrow {
          color: #a1a1aa;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease;
        }
        .prp-ledger-cell:hover .prp-ledger-arrow {
          color: #09090b;
          transform: translate(3px, -3px);
        }
        .prp-odometer {
          display: block;
          margin: 0.65rem 0 0.45rem;
          font-family: Outfit, sans-serif;
          font-size: clamp(2.5rem, 3.8vw, 3.45rem);
          font-weight: 700;
          line-height: 0.95;
          letter-spacing: -0.05em;
          color: #09090b;
          font-variant-numeric: tabular-nums;
        }
        /* Lower Split Architectural Workspace */
        .prp-lower-grid {
          margin-top: 2.75rem;
          display: grid;
          grid-template-columns: 1.35fr 0.65fr;
          gap: 2.25rem;
          align-items: start;
        }
        .prp-block-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: 0.85rem;
          border-bottom: 1.5px solid #09090b;
        }
        .prp-block-head h2 {
          margin: 0.25rem 0 0;
          font-family: Outfit, sans-serif;
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: -0.025em;
          color: #09090b;
        }
        .prp-audit-row {
          position: relative;
          display: grid;
          grid-template-columns: 106px 1fr auto;
          gap: 1rem;
          align-items: center;
          padding: 0.95rem 0.65rem;
          border-bottom: 1px solid #e4e4e7;
          transition: background-color 0.18s ease, padding-left 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .prp-audit-row::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #09090b;
          transform: scaleY(0);
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .prp-audit-row:hover {
          background: #fafafa;
          padding-left: 1rem;
        }
        .prp-audit-row:hover::before {
          transform: scaleY(1);
        }
        .prp-mod-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          padding: 0.95rem 0.55rem;
          border-bottom: 1px solid #e4e4e7;
          text-decoration: none;
          color: #09090b;
          transition: padding-left 0.25s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease;
        }
        .prp-mod-row:hover {
          background: #fafafa;
          padding-left: 0.95rem;
        }
        .prp-mod-idx {
          font-family: var(--ent-mono);
          font-size: 0.66rem;
          font-weight: 700;
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 4px;
          border: 1px solid #e4e4e7;
          color: #52525b;
          background: #ffffff;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }
        .prp-mod-row:hover .prp-mod-idx {
          background: #09090b;
          border-color: #09090b;
          color: #ffffff;
        }
        @media (max-width: 1060px) {
          .prp-ledger-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .prp-ledger-cell:nth-child(2) {
            border-right: none;
          }
          .prp-ledger-cell:nth-child(1),
          .prp-ledger-cell:nth-child(2) {
            border-bottom: 1px solid #e4e4e7;
          }
          .prp-lower-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 580px) {
          .prp-ledger-grid {
            grid-template-columns: 1fr;
          }
          .prp-ledger-cell {
            border-right: none !important;
            border-bottom: 1px solid #e4e4e7;
          }
          .prp-audit-row {
            grid-template-columns: 1fr;
            gap: 0.35rem;
          }
        }
      `}</style>

      {/* Top System Metadata Strip */}
      <div className="prp-meta-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#09090b', fontWeight: 700 }}>SYS // PRP.CONTROL</span>
          <span>·</span>
          <span>PERIODE {activePeriodLabel}</span>
          {sysConfig.maintenanceMode && (
            <>
              <span>·</span>
              <span style={{ color: '#991b1b', fontWeight: 700 }}>[MAINTENANCE ACTIVE]</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span>JAKARTA {clock} WIB</span>
          <span style={{ color: '#09090b', fontWeight: 700 }}>[LIVE]</span>
        </div>
      </div>

      {/* Monumental Editorial Masthead */}
      <div className="prp-masthead">
        <div>
          <h1 className="prp-display-h1">
            <span className="prp-title-mask">
              <span className="prp-title-line">Pusat Kendali</span>
            </span>
            <span className="prp-title-mask">
              <span className="prp-title-line" style={{ fontWeight: 400, color: '#52525b' }}>
                Tata Kelola Kinerja.
              </span>
            </span>
          </h1>
          <p className="prp-mast-lede prp-mast-sub">
            Orkestrasi terpusat 8 Indikator Kinerja Utama Kementerian dan instrumen KPI Operasional Unit ITPLN — mencakup arsitektur formula, verifikasi eviden, dan otorisasi peran.
          </p>
        </div>

        <div className="prp-mast-sub" style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
          <Link className="ent-btn" to="/internal/admin/governance?tab=submissions">
            Pusat Review ({kpiPending + ikuPending}) <ArrowUpRight size={14} />
          </Link>
          <Link className="ent-btn ent-btn-primary" to="/internal/admin/governance?tab=kpi-builder">
            Buka Desainer KPI <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {/* Self-Drawing Architectural Keyline */}
      <div className="prp-keyline" />

      {/* 4-Column Connected Architectural Telemetry Ledger */}
      <div className="prp-ledger-grid">
        {controlLedger.map((item) => (
          <Link className="prp-ledger-cell" key={item.idx} to={item.to}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.64rem',
                  fontWeight: 600,
                  color: '#71717a',
                  letterSpacing: '0.08em',
                }}
              >
                {item.idx} // {item.code}
              </span>
              <ArrowUpRight size={15} className="prp-ledger-arrow" />
            </div>

            <div>
              <span className="prp-odometer" data-target={item.value}>
                {String(item.value).padStart(2, '0')}
              </span>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#09090b', letterSpacing: '-0.01em' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#71717a', marginTop: '0.2rem' }}>
                {item.meta}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Lower 2-Column Ledger: Audit Stream & Module Index */}
      <div className="prp-lower-grid">
        {/* Left: Live Audit & Submission Stream */}
        <div className="prp-scroll-block">
          <div className="prp-block-head">
            <div>
              <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.62rem', color: '#71717a', letterSpacing: '0.1em' }}>
                05 // CHRONOLOGICAL LEDGER
              </span>
              <h2>Aliran Aktivitas & Audit Sistem</h2>
            </div>
            <Link className="ent-btn" to="/internal/admin/governance?tab=audit" style={{ padding: '0.42rem 0.75rem', fontSize: '0.72rem' }}>
              Log Lengkap <ArrowUpRight size={13} />
            </Link>
          </div>

          <div>
            {activity.length > 0 ? (
              activity.map((item, idx) => (
                <div className="prp-audit-row prp-row-stagger" key={`${item.at}-${item.title}-${idx}`}>
                  <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', color: '#71717a' }}>
                    {item.time}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.73rem', fontWeight: 700, color: '#09090b' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#52525b', marginTop: '2px', lineHeight: 1.45 }}>
                      {item.detail}
                    </div>
                  </div>
                  <span
                    className={
                      item.tone === 'ok'
                        ? 'ent-badge ent-badge-approved'
                        : item.tone === 'pending'
                          ? 'ent-badge ent-badge-submitted'
                          : 'ent-badge'
                    }
                  >
                    {item.status}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '3rem 1rem', borderBottom: '1px solid #e4e4e7', color: '#71717a', fontSize: '0.82rem' }}>
                Belum ada rekaman aktivitas pada sesi ini. Setiap perubahan struktur formula, pengajuan unit, maupun kebijakan sistem tercatat otomatis di sini.
              </div>
            )}
          </div>
        </div>

        {/* Right: 6-Module Direct Command Index */}
        <div className="prp-scroll-block">
          <div className="prp-block-head">
            <div>
              <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.62rem', color: '#71717a', letterSpacing: '0.1em' }}>
                06 // ARCHITECTURE INDEX
              </span>
              <h2>Indeks Modul Eksekutif</h2>
            </div>
          </div>

          <div>
            {commandModules.map((mod) => (
              <Link className="prp-mod-row prp-row-stagger" key={mod.idx} to={mod.to}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                  <span className="prp-mod-idx">{mod.idx}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#09090b' }}>
                      {mod.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#71717a', marginTop: '2px' }}>
                      {mod.sub}
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={15} color="#71717a" style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
