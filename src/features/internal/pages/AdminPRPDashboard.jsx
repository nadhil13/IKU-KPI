import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Link } from 'react-router-dom';
import { readMergedUsers, useAuth } from '../../auth/context/AuthContext';
import { readAudit, readSystemConfig } from '../adminStore';
import { readKpiWorkflow } from '../../kpi/kpiWorkflowStore';
import { getIkuPeriods, listIkuSubmissions } from '../../iku/ikuWorkflowStore';

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
  const periods = getIkuPeriods();
  const kpi = readKpiWorkflow();
  const iku = listIkuSubmissions(currentUser);
  const kpiPending = Object.values(kpi.submissions).filter((record) => record.status === 'SUBMITTED').length;
  const ikuPending = iku.filter((record) => record.status === 'SUBMITTED').length;
  const active = users.filter((user) => user.status === 'Aktif').length;
  const sysConfig = readSystemConfig();
  const activePeriodLabel = periods.find((p) => p.status === 'Active')?.id || periods[0]?.id || '2025/2026';

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
      label: 'Akun Pengguna Terdaftar',
      value: users.length,
      meta: `${active} aktif · ${users.length - active} nonaktif`,
      to: '/internal/users',
    },
    {
      idx: '04',
      code: 'CYC.PER',
      label: 'Siklus Periode Evaluasi',
      value: periods.length,
      meta: `Periode berjalan: ${activePeriodLabel}`,
      to: '/internal/admin/governance?tab=periods',
    },
  ];

  const commandModules = [
    {
      idx: '01',
      title: 'Desainer Tabel & Rumus KPI',
      sub: 'Mesin formula sel lintas baris dan publikasi versi',
      to: '/internal/admin/governance?tab=kpi-builder',
    },
    {
      idx: '02',
      title: 'Pusat Review Submission Unit',
      sub: 'Verifikasi bukti HTTPS dan keputusan persetujuan',
      to: '/internal/admin/governance?tab=submissions',
    },
    {
      idx: '03',
      title: 'Manajemen Akun & Hak Akses',
      sub: 'Pengaturan peran IKU, KPI, dan Superadmin PRP',
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
      title: 'Inspeksi Ruang Kerja Evaluasi',
      sub: 'Pratinjau langsung matriks 8 IKU dan lembar kerja KPI',
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
      detail: `${entry.detail} (${entry.actor})`,
      status: 'AUDIT',
      tone: 'audit',
    })),
    ...Object.values(kpi.submissions).flatMap((record) =>
      (record.history || []).map((entry) => ({
        at: entry.at,
        title: 'SUBMISSION_KPI_UNIT',
        detail: `${record.unit || record.email}${entry.note ? `: ${entry.note}` : ''}`,
        status: entry.status,
        tone: entry.status === 'APPROVED' ? 'ok' : entry.status === 'SUBMITTED' ? 'pending' : 'neutral',
      }))
    ),
    ...iku.flatMap((record) =>
      (record.history || []).map((entry) => ({
        at: entry.at,
        title: 'SUBMISSION_8_IKU',
        detail: `${record.unit}${entry.reason ? `: ${entry.reason}` : ''}`,
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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    tl.fromTo('.prp-meta-strip', { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.5 })
      .fromTo('.prp-title-line', { yPercent: 115 }, { yPercent: 0, duration: 0.8, stagger: 0.07 }, '-=0.3')
      .fromTo('.prp-mast-sub', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05 }, '-=0.5')
      .fromTo(
        '.prp-keyline',
        { scaleX: 0 },
        { scaleX: 1, transformOrigin: 'left center', duration: 0.85, ease: 'expo.inOut' },
        '-=0.55'
      )
      .fromTo(
        '.prp-ledger-cell',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.05, clearProps: 'transform' },
        '-=0.5'
      );

    const counters = gsap.utils.toArray('.prp-odometer');
    counters.forEach((node) => {
      const target = Number(node.getAttribute('data-target') || 0);
      const state = { val: 0 };
      gsap.to(state, {
        val: target,
        duration: 0.95,
        delay: 0.15,
        ease: 'expo.out',
        onUpdate: () => {
          node.textContent = String(Math.round(state.val)).padStart(2, '0');
        },
      });
    });

    const scroller = document.querySelector('.internal-main-scroll');
    if (scroller) {
      gsap.utils.toArray('.prp-scroll-block').forEach((block) => {
        gsap.fromTo(
          block,
          { opacity: 0, y: 22 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
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
    }
  }, { scope: pageRef });

  return (
    <section ref={pageRef} className="prp-arch-page">
      <style>{`
        .prp-arch-page {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 0 4rem;
          color: #072534;
        }
        .prp-meta-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding-bottom: 0.95rem;
          border-bottom: 1px solid #D8E4EA;
          font-family: var(--ent-mono);
          font-size: 0.66rem;
          color: #475569;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .prp-masthead {
          padding: 1.85rem 0 1.75rem;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.5rem;
        }
        .prp-display-h1 {
          margin: 0;
          font-family: Outfit, sans-serif;
          font-size: clamp(2.1rem, 4vw, 3.35rem);
          font-weight: 800;
          line-height: 1.04;
          letter-spacing: -0.04em;
          color: #072534;
        }
        .prp-title-mask {
          overflow: hidden;
          display: block;
          padding-bottom: 0.05em;
        }
        .prp-title-line {
          display: block;
          will-change: transform;
        }
        .prp-mast-lede {
          margin: 0.9rem 0 0;
          max-width: 620px;
          font-size: 0.92rem;
          line-height: 1.65;
          color: #334155;
        }
        .prp-keyline {
          width: 100%;
          height: 2px;
          background: #094E68;
        }
        .prp-ledger-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-bottom: 1px solid #D8E4EA;
          background: #ffffff;
        }
        .prp-ledger-cell {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 180px;
          padding: 1.45rem 1.35rem;
          border-right: 1px solid #D8E4EA;
          text-decoration: none;
          color: inherit;
          background: #ffffff;
          transition: background-color 0.2s ease;
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
          height: 2.5px;
          background: #094E68;
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .prp-ledger-arrow {
          color: #475569;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease;
        }
        .prp-odometer {
          display: block;
          margin: 0.65rem 0 0.45rem;
          font-family: Outfit, sans-serif;
          font-size: clamp(2.4rem, 3.6vw, 3.35rem);
          font-weight: 800;
          line-height: 0.95;
          letter-spacing: -0.045em;
          color: #072534;
          font-variant-numeric: tabular-nums;
        }
        .prp-lower-grid {
          margin-top: 2.5rem;
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
          border-bottom: 2px solid #094E68;
        }
        .prp-block-head h2 {
          margin: 0.25rem 0 0;
          font-family: Outfit, sans-serif;
          font-size: 1.15rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #072534;
        }
        .prp-audit-row {
          position: relative;
          display: grid;
          grid-template-columns: 112px 1fr auto;
          gap: 1rem;
          align-items: center;
          padding: 0.95rem 0.7rem;
          border-bottom: 1px solid #D8E4EA;
          transition: background-color 0.18s ease;
        }
        .prp-mod-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          min-height: 56px;
          padding: 0.9rem 0.65rem;
          border-bottom: 1px solid #D8E4EA;
          text-decoration: none;
          color: #072534;
          transition: background-color 0.18s ease;
        }
        .prp-mod-idx {
          font-family: var(--ent-mono);
          font-size: 0.68rem;
          font-weight: 700;
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 5px;
          border: 1px solid #D8E4EA;
          color: #094E68;
          background: #F7FAFB;
          flex-shrink: 0;
          transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }
        @media (hover: hover) {
          .prp-ledger-cell:hover {
            background: #F7FAFB;
          }
          .prp-ledger-cell:hover::after {
            transform: scaleX(1);
          }
          .prp-ledger-cell:hover .prp-ledger-arrow {
            color: #094E68;
            transform: translate(3px, -3px);
          }
          .prp-audit-row:hover,
          .prp-mod-row:hover {
            background: #F7FAFB;
          }
          .prp-mod-row:hover .prp-mod-idx {
            background: #094E68;
            border-color: #094E68;
            color: #ffffff;
          }
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
            border-bottom: 1px solid #D8E4EA;
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
            border-bottom: 1px solid #D8E4EA;
          }
          .prp-audit-row {
            grid-template-columns: 1fr;
            gap: 0.4rem;
          }
        }
      `}</style>

      {/* Top System Metadata Strip */}
      <div className="prp-meta-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <span style={{ color: '#094E68', fontWeight: 700 }}>PRP // PUSAT KENDALI</span>
          <span>·</span>
          <span>PERIODE {activePeriodLabel}</span>
          {sysConfig.maintenanceMode && (
            <>
              <span>·</span>
              <span style={{ color: '#B91C1C', fontWeight: 700 }}>[PEMELIHARAAN AKTIF]</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>JAKARTA {clock} WIB</span>
          <span style={{ color: '#0E7480', fontWeight: 700 }}>[SESI AKTIF]</span>
        </div>
      </div>

      {/* Editorial Masthead */}
      <div className="prp-masthead">
        <div>
          <h1 className="prp-display-h1">
            <span className="prp-title-mask">
              <span className="prp-title-line">Pusat Kendali</span>
            </span>
            <span className="prp-title-mask">
              <span className="prp-title-line" style={{ fontWeight: 700, color: '#094E68' }}>
                Tata Kelola Kinerja.
              </span>
            </span>
          </h1>
          <p className="prp-mast-lede prp-mast-sub">
            Pengelolaan terpusat 8 Indikator Kinerja Utama Kementerian dan instrumen KPI Operasional Unit ITPLN yang mencakup penyusunan skema formula, verifikasi bukti dukung, serta otorisasi peran.
          </p>
        </div>

        <div className="prp-mast-sub" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link className="ent-btn" to="/internal/admin/governance?tab=submissions" style={{ minHeight: '44px' }}>
            Pusat Review ({kpiPending + ikuPending}) <ArrowUpRight size={14} />
          </Link>
          <Link className="ent-btn ent-btn-primary" to="/internal/admin/governance?tab=kpi-builder" style={{ minHeight: '44px' }}>
            Buka Desainer KPI <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {/* Keyline */}
      <div className="prp-keyline" />

      {/* 4-Column Connected Telemetry Ledger */}
      <div className="prp-ledger-grid">
        {controlLedger.map((item) => (
          <Link className="prp-ledger-cell" key={item.idx} to={item.to}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: '#0E7480',
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
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#072534', letterSpacing: '-0.01em' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>
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
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color: '#0E7480',
                  letterSpacing: '0.1em',
                }}
              >
                05 // JURNAL KRONOLOGIS
              </span>
              <h2>Aliran Aktivitas &amp; Audit Sistem</h2>
            </div>
            <Link
              className="ent-btn"
              to="/internal/admin/governance?tab=audit"
              style={{ minHeight: '40px', padding: '0.45rem 0.85rem', fontSize: '0.74rem' }}
            >
              Log Lengkap <ArrowUpRight size={13} />
            </Link>
          </div>

          <div>
            {activity.length > 0 ? (
              activity.map((item, idx) => (
                <div className="prp-audit-row" key={`${item.at}-${item.title}-${idx}`}>
                  <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.7rem', color: '#475569' }}>
                    {item.time}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.74rem', fontWeight: 700, color: '#072534' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '2px', lineHeight: 1.48 }}>
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
              <div style={{ padding: '2.75rem 1rem', borderBottom: '1px solid #D8E4EA', color: '#475569', fontSize: '0.84rem', lineHeight: 1.6 }}>
                Belum ada rekaman aktivitas pada sesi ini. Setiap perubahan struktur formula, pengajuan unit, maupun kebijakan sistem akan tercatat di sini.
              </div>
            )}
          </div>
        </div>

        {/* Right: 6-Module Direct Command Index */}
        <div className="prp-scroll-block">
          <div className="prp-block-head">
            <div>
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color: '#0E7480',
                  letterSpacing: '0.1em',
                }}
              >
                06 // INDEKS MODUL
              </span>
              <h2>Pintasan Tata Kelola</h2>
            </div>
          </div>

          <div>
            {commandModules.map((mod) => (
              <Link className="prp-mod-row" key={mod.idx} to={mod.to}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                  <span className="prp-mod-idx">{mod.idx}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#072534' }}>
                      {mod.title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>
                      {mod.sub}
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={15} color="#094E68" style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
