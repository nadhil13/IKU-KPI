import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Calendar,
  ClipboardCheck,
  Eye,
  Filter,
  History,
  Settings2,
  Table2,
  Users,
} from 'lucide-react';
import { readMergedUsers } from '../../auth/authAccounts';
import { useAuth } from '../../auth/hooks/useAuth';
import HorizontalTableViewport from '../../../shared/components/HorizontalTableViewport';
import { readAudit, readSystemConfig } from '../adminStore';
import {
  clampInstitutionTotalScore,
  computeKpiItem,
  formatIndonesianNumber,
  getKpiAchievementMeta,
  normalizeKpiSections,
  readPublishedKpiConfig,
  resolveItemPicRoles,
} from '../../kpi/kpiSchema';
import { KPI_SECTIONS_CONFIG } from '../../kpi/kpiTemplateConfig';
import {
  ensureDefaultKpiDistribution,
  getFormForPeriod,
  listKpiPeriodsWithStatus,
  readIntegratedKpiBoard,
  readKpiWorkflow,
} from '../../kpi/kpiWorkflowStore';
import { getIkuPeriods, listIkuSubmissions } from '../../iku/ikuWorkflowStore';

gsap.registerPlugin(ScrollTrigger);

const formatClock = () =>
  new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

function LiveClock() {
  const [clock, setClock] = useState(formatClock);
  useEffect(() => {
    const timer = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span>JAKARTA {clock} WIB</span>;
}

export default function AdminPRPDashboard() {
  const pageRef = useRef(null);
  const { currentUser } = useAuth();
  const [tick, refresh] = useState(0);

  useEffect(() => {
    const sections = readPublishedKpiConfig()?.sections || normalizeKpiSections(KPI_SECTIONS_CONFIG);
    ensureDefaultKpiDistribution(sections, '2026', { silent: true });
    const update = () => refresh((value) => value + 1);
    const events = [
      'storage',
      'focus',
      'prp-admin-updated',
      'prp-kpi-workflow-updated',
      'prp-kpi-config-updated',
      'prp-iku-updated',
    ];
    events.forEach((event) => window.addEventListener(event, update));
    return () => events.forEach((event) => window.removeEventListener(event, update));
  }, []);

  const kpiPeriods = useMemo(() => {
    void tick;
    return listKpiPeriodsWithStatus();
  }, [tick]);

  const defaultActivePeriodId = useMemo(() => {
    const openOrActive = kpiPeriods.find((p) => p.isOpenForInput || p.status === 'Active');
    return openOrActive?.id || openOrActive?.year || kpiPeriods[0]?.id || '2026';
  }, [kpiPeriods]);

  const [userSelectedPeriod, setUserSelectedPeriod] = useState('');
  const [perspectiveFilter, setPerspectiveFilter] = useState('ALL');
  const [showIndicatorRows, setShowIndicatorRows] = useState(true);

  const selectedPeriodId = useMemo(() => {
    if (
      userSelectedPeriod
      && kpiPeriods.some((p) => String(p.id || p.year) === String(userSelectedPeriod))
    ) {
      return userSelectedPeriod;
    }
    return defaultActivePeriodId;
  }, [userSelectedPeriod, kpiPeriods, defaultActivePeriodId]);

  const selectedPeriodMeta = useMemo(
    () =>
      kpiPeriods.find((p) => String(p.id || p.year) === String(selectedPeriodId)) || {
        id: selectedPeriodId,
        year: selectedPeriodId,
        label: `Periode ${selectedPeriodId}`,
        status: 'Active',
        isOpenForInput: true,
      },
    [kpiPeriods, selectedPeriodId],
  );

  const users = readMergedUsers();
  const periods = getIkuPeriods();
  const kpi = readKpiWorkflow();
  const iku = listIkuSubmissions(currentUser);
  const kpiPending = Object.values(kpi.submissions).filter((record) => record.status === 'SUBMITTED').length;
  const ikuPending = iku.filter((record) => record.status === 'SUBMITTED').length;
  const active = users.filter((user) => user.status === 'Aktif').length;
  const sysConfig = readSystemConfig();
  const activePeriodLabel =
    periods.find((p) => p.status === 'Active')?.id || periods[0]?.id || defaultActivePeriodId;

  const execDashboard = useMemo(() => {
    void tick;
    const currentWorkflow = readKpiWorkflow();
    const fallbackSections =
      readPublishedKpiConfig()?.sections || normalizeKpiSections(KPI_SECTIONS_CONFIG);
    const periodForm = getFormForPeriod(selectedPeriodId, currentWorkflow, { fallbackToLatest: false });
    const sections = periodForm?.sections?.length
      ? normalizeKpiSections(periodForm.sections)
      : fallbackSections;

    const board = periodForm
      ? readIntegratedKpiBoard(periodForm.id, currentWorkflow, { confirmedOnly: false })
      : { values: {}, unitStatuses: [] };
    const values = board?.values || {};

    const perspectiveSummaries = sections.map((sec) => {
      const secCode = sec.code || 'A';
      const rows = (sec.items || []).map((item) => {
        const computed = computeKpiItem(item, values, Boolean(sec.isPenaltySection), sections);
        const { primaryPic, coPics } = resolveItemPicRoles(item);
        const parsedSubs = computed.parsedSubs || [];
        const hasFilledSubRow = parsedSubs.some((sr) => sr.isFilled);
        const isFilled = hasFilledSubRow && computed.ratioPercent !== null && Number.isFinite(computed.ratioPercent);

        const numericSubValues = parsedSubs
          .filter((sr) => !sr.isTextInput && sr.num !== null && Number.isFinite(sr.num))
          .map((sr) => sr.num);
        const primaryNumericActual =
          numericSubValues.length && hasFilledSubRow
            ? numericSubValues.reduce((acc, v) => acc + v, 0)
            : 0;

        const meta = isFilled
          ? getKpiAchievementMeta(computed.ratioPercent, { isPenaltySection: Boolean(sec.isPenaltySection) })
          : { tier: 'empty', label: 'Belum Diisi', color: '#475569' };

        const compactActualLabel = parsedSubs
          .map((sr) => {
            if (!sr.isFilled) return null;
            if (sr.isTextInput) return String(sr.raw);
            return sr.num !== null ? formatIndonesianNumber(sr.num, 2) : String(sr.raw);
          })
          .filter(Boolean)
          .join(' / ');

        const unitSuffix = item.satuan && item.satuan !== '-' ? ` ${item.satuan}` : '';

        return {
          id: item.id,
          sectionId: secCode,
          sectionCode: secCode,
          isPenaltySection: Boolean(sec.isPenaltySection),
          code: `${secCode}.${item.no}`,
          indikator: item.indikator,
          primaryPic,
          coPics,
          bobot: item.bobot,
          targetNum: Number(item.targetNum) || 0,
          targetLabel: `${item.targetDisplay || formatIndonesianNumber(item.targetNum, 2)}${unitSuffix}`,
          actualDisplay: compactActualLabel || '-',
          primaryNumericActual,
          ratioPercent: isFilled ? computed.ratioPercent : null,
          weightedScore: computed.weightedScore || 0,
          isFilled,
          meta,
        };
      });

      const secTotalWeight = rows.reduce((acc, r) => acc + (r.bobot || 0), 0);
      const secTotalScore = rows.reduce((acc, r) => acc + (r.weightedScore || 0), 0);
      const filledSecRows = rows.filter((r) => r.isFilled && r.ratioPercent !== null);
      const secAvgRatio = filledSecRows.length
        ? filledSecRows.reduce((acc, r) => acc + r.ratioPercent, 0) / filledSecRows.length
        : null;

      return {
        id: secCode,
        code: secCode,
        title: sec.title,
        totalItems: rows.length,
        filledItems: filledSecRows.length,
        totalWeight: secTotalWeight,
        totalScore: secTotalScore,
        avgRatio: secAvgRatio,
        avgMeta:
          secAvgRatio !== null
            ? getKpiAchievementMeta(secAvgRatio, { isPenaltySection: Boolean(sec.isPenaltySection) })
            : null,
        rows,
      };
    });

    const allRows = perspectiveSummaries.flatMap((s) => s.rows);
    const positiveScore = allRows
      .filter((r) => !r.isPenaltySection)
      .reduce((acc, r) => acc + (r.weightedScore || 0), 0);
    const penaltyScore = allRows
      .filter((r) => r.isPenaltySection)
      .reduce((acc, r) => acc + (r.weightedScore || 0), 0);
    const totalWeightPositive = allRows
      .filter((r) => !r.isPenaltySection && r.bobot > 0)
      .reduce((acc, r) => acc + r.bobot, 0);
    const filledRows = allRows.filter((r) => r.isFilled && r.ratioPercent !== null);
    const totalActualSum = allRows.reduce((acc, r) => acc + r.primaryNumericActual, 0);
    const totalTargetSum = allRows
      .filter((r) => !r.isPenaltySection)
      .reduce((acc, r) => acc + r.targetNum, 0);

    const institutionScore = Number(clampInstitutionTotalScore(positiveScore + penaltyScore).toFixed(2));
    const avgRatioPercent = filledRows.length
      ? filledRows.reduce((acc, r) => acc + r.ratioPercent, 0) / filledRows.length
      : null;

    const contributingUnitCount = Array.isArray(board?.unitStatuses)
      ? board.unitStatuses.filter((u) => u.status && u.status !== 'BELUM_MENGISI').length
      : 0;

    return {
      hasSnapshot: Boolean(periodForm),
      formVersion: periodForm?.version || null,
      contributingUnitCount,
      institutionScore,
      positiveScore,
      penaltyScore,
      totalWeightPositive,
      totalIndicators: allRows.length,
      filledCount: filledRows.length,
      greenCount: filledRows.filter((r) => r.meta.tier === 'green').length,
      yellowCount: filledRows.filter((r) => r.meta.tier === 'yellow').length,
      redCount: filledRows.filter((r) => r.meta.tier === 'red').length,
      emptyCount: allRows.length - filledRows.length,
      totalActualSum,
      totalTargetSum,
      avgRatioPercent,
      avgMeta: avgRatioPercent !== null ? getKpiAchievementMeta(avgRatioPercent) : null,
      perspectiveSummaries,
      filteredRows:
        perspectiveFilter === 'ALL'
          ? allRows
          : allRows.filter((r) => String(r.sectionId) === String(perspectiveFilter)),
    };
  }, [selectedPeriodId, perspectiveFilter, tick]);

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
      label: 'Akun Unit Kerja Terdaftar',
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
      sub: 'Sinkronisasi koordinat baris/kolom Excel (A-K) dan publikasi versi',
      to: '/internal/admin/governance?tab=kpi-builder',
      icon: Table2,
    },
    {
      idx: '02',
      title: 'Pusat Review Submission Unit',
      sub: 'Verifikasi bukti dukung dan persetujuan pengajuan unit',
      to: '/internal/admin/governance?tab=submissions',
      icon: ClipboardCheck,
    },
    {
      idx: '03',
      title: 'Manajemen Akun Unit Kerja',
      sub: 'Pengaturan akses per Unit Kerja, PIC Utama, dan Verifikasi SPI',
      to: '/internal/users',
      icon: Users,
    },
    {
      idx: '04',
      title: 'Struktur Organisasi & Master PIC',
      sub: 'Hierarki rektorat, fakultas, direktorat, dan kode biro',
      to: '/internal/team',
      icon: Building2,
    },
    {
      idx: '05',
      title: 'Inspeksi Lembar Kerja Detail KPI',
      sub: 'Pemeriksaan lengkap isian sub-baris dan lampiran dokumen unit',
      to: '/internal/kpi',
      icon: Eye,
    },
    {
      idx: '06',
      title: 'Kebijakan & Parameter Sistem',
      sub: 'Tenggat global, panjang sandi minimum, dan mode pemeliharaan',
      to: '/internal/admin/governance?tab=settings',
      icon: Settings2,
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
      })),
    ),
    ...iku.flatMap((record) =>
      (record.history || []).map((entry) => ({
        at: entry.at,
        title: 'SUBMISSION_8_IKU',
        detail: `${record.unit}${entry.reason ? `: ${entry.reason}` : ''}`,
        status: entry.status,
        tone: entry.status === 'APPROVED' ? 'ok' : entry.status === 'SUBMITTED' ? 'pending' : 'neutral',
      })),
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

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return undefined;
      }

      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.fromTo('.prp-meta-strip', { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.45 })
        .fromTo('.prp-title-line', { yPercent: 110 }, { yPercent: 0, duration: 0.7, stagger: 0.06 }, '-=0.25')
        .fromTo('.prp-mast-sub', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04 }, '-=0.45')
        .fromTo(
          '.prp-keyline',
          { scaleX: 0 },
          { scaleX: 1, transformOrigin: 'left center', duration: 0.75, ease: 'expo.inOut' },
          '-=0.45',
        );
    },
    { scope: pageRef },
  );

  const isSelectedPeriodActive = Boolean(
    selectedPeriodMeta.isOpenForInput ?? selectedPeriodMeta.inputOpen ?? selectedPeriodMeta.status === 'Active',
  );

  return (
    <section ref={pageRef} className="prp-arch-page">
      <style>{`
        .prp-arch-page {
          max-width: 1480px;
          width: 100%;
          min-width: 0;
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
          font-size: 0.68rem;
          color: #475569;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .prp-masthead {
          padding: 1.65rem 0 1.5rem;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.5rem;
        }
        .prp-display-h1 {
          margin: 0;
          font-family: Outfit, sans-serif;
          font-size: clamp(2rem, 3.8vw, 3.1rem);
          font-weight: 800;
          line-height: 1.05;
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
          margin: 0.75rem 0 0;
          max-width: 660px;
          font-size: 0.9rem;
          line-height: 1.62;
          color: #334155;
        }
        .prp-keyline {
          width: 100%;
          height: 2px;
          background: #094E68;
        }
        .prp-exec-panel {
          margin-top: 1.5rem;
          border: 1px solid #CBD5E1;
          border-radius: 8px;
          background: #FFFFFF;
          overflow: hidden;
        }
        .prp-exec-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 1.1rem 1.3rem;
          background: #F7FAFB;
          border-bottom: 1px solid #CBD5E1;
        }
        .prp-exec-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-bottom: 1px solid #CBD5E1;
          background: #FFFFFF;
        }
        .prp-exec-kpi-card {
          padding: 1.3rem 1.25rem;
          border-right: 1px solid #D8E4EA;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 0.55rem;
          min-width: 0;
        }
        .prp-exec-kpi-card:last-child {
          border-right: none;
        }
        .prp-exec-persp-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-bottom: 1px solid #CBD5E1;
          background: #F7FAFB;
        }
        .prp-exec-persp-cell {
          padding: 0.95rem 1.2rem;
          border-right: 1px solid #D8E4EA;
          min-width: 0;
        }
        .prp-exec-persp-cell:last-child {
          border-right: none;
        }
        .prp-exec-table {
          width: 100%;
          min-width: 780px;
          border-collapse: collapse;
          font-size: 0.78rem;
        }
        .prp-exec-table th {
          padding: 0.7rem 0.85rem;
          background: #EDF3F6;
          border-bottom: 1px solid #64748B;
          font-family: var(--ent-mono);
          font-size: 0.64rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #334155;
          text-align: left;
          white-space: nowrap;
        }
        .prp-exec-table td {
          padding: 0.72rem 0.85rem;
          border-bottom: 1px solid #E2E8F0;
          vertical-align: top;
          color: #072534;
        }
        .prp-exec-table tbody tr:hover {
          background: #F7FAFB;
        }
        .prp-ledger-grid {
          margin-top: 2rem;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 2px solid #094E68;
          border-bottom: 1px solid #D8E4EA;
          background: #ffffff;
        }
        .prp-ledger-cell {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 162px;
          padding: 1.3rem 1.25rem;
          border-right: 1px solid #D8E4EA;
          text-decoration: none;
          color: inherit;
          background: #ffffff;
          transition: background-color 0.2s ease;
        }
        .prp-ledger-cell:last-child {
          border-right: none;
        }
        .prp-odometer {
          display: block;
          margin: 0.55rem 0 0.35rem;
          font-family: Outfit, sans-serif;
          font-size: clamp(2.1rem, 3.2vw, 2.85rem);
          font-weight: 800;
          line-height: 0.95;
          letter-spacing: -0.045em;
          color: #072534;
          font-variant-numeric: tabular-nums;
        }
        .prp-lower-grid {
          margin-top: 2.25rem;
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.7fr);
          gap: 2.1rem;
          align-items: start;
          width: 100%;
          min-width: 0;
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
          grid-template-columns: 112px minmax(0, 1fr) auto;
          gap: 1rem;
          align-items: center;
          padding: 0.9rem 0.7rem;
          border-bottom: 1px solid #D8E4EA;
        }
        .prp-audit-row > * {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .prp-mod-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          min-height: 56px;
          padding: 0.85rem 0.65rem;
          border-bottom: 1px solid #D8E4EA;
          text-decoration: none;
          color: #072534;
          transition: background-color 0.18s ease;
        }
        .prp-mod-idx {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          border: 1px solid #CBD5E1;
          color: #094E68;
          background: #F7FAFB;
          flex-shrink: 0;
        }
        @media (hover: hover) {
          .prp-ledger-cell:hover,
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
        @media (max-width: 1200px) {
          .prp-exec-kpi-grid,
          .prp-exec-persp-grid,
          .prp-ledger-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .prp-exec-kpi-card:nth-child(2),
          .prp-exec-persp-cell:nth-child(2),
          .prp-ledger-cell:nth-child(2) {
            border-right: none;
          }
          .prp-exec-kpi-card:nth-child(1),
          .prp-exec-kpi-card:nth-child(2),
          .prp-exec-persp-cell:nth-child(1),
          .prp-exec-persp-cell:nth-child(2),
          .prp-ledger-cell:nth-child(1),
          .prp-ledger-cell:nth-child(2) {
            border-bottom: 1px solid #D8E4EA;
          }
          .prp-lower-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 640px) {
          .prp-exec-kpi-grid,
          .prp-exec-persp-grid,
          .prp-ledger-grid {
            grid-template-columns: 1fr;
          }
          .prp-exec-kpi-card,
          .prp-exec-persp-cell,
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

      {/* Top System Metadata Strip: Information as plain bold thematic text */}
      <div className="prp-meta-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <strong style={{ color: '#094E68', fontWeight: 800 }}>DASHBOARD EKSEKUTIF &amp; PUSAT KENDALI PRP</strong>
          <span>·</span>
          <span>SIKLUS AKTIF {activePeriodLabel}</span>
          {sysConfig.maintenanceMode && (
            <>
              <span>·</span>
              <strong style={{ color: '#B91C1C', fontWeight: 800 }}>MODE PEMELIHARAAN AKTIF</strong>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <LiveClock />
          <strong style={{ color: '#166534', fontWeight: 800 }}>SESI AKTIF</strong>
        </div>
      </div>

      {/* Editorial Masthead */}
      <div className="prp-masthead">
        <div>
          <h1 className="prp-display-h1">
            <span className="prp-title-mask">
              <span className="prp-title-line">Dashboard Eksekutif</span>
            </span>
            <span className="prp-title-mask">
              <span className="prp-title-line" style={{ fontWeight: 700, color: '#094E68' }}>
                Capaian &amp; Skor Institusi.
              </span>
            </span>
          </h1>
          <p className="prp-mast-lede prp-mast-sub">
            Ringkasan eksekutif metrik agregat KPI ITPLN meliputi total angka terukur, persentase capaian riil tanpa batas plafon 100%, skor per perspektif, dan skor institusi lintas periode. Lampiran dokumen bukti dukung dikelola terpisah pada Pusat Review Unit.
          </p>
        </div>

        <div className="prp-mast-sub" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <Link className="ent-btn" to="/internal/admin/governance?tab=submissions" style={{ minHeight: '44px' }}>
            <ClipboardCheck size={15} />
            <span>Pusat Review ({kpiPending + ikuPending})</span>
          </Link>
          <Link className="ent-btn ent-btn-primary" to="/internal/admin/governance?tab=kpi-builder" style={{ minHeight: '44px' }}>
            <Table2 size={15} />
            <span>Buka Desainer KPI</span>
          </Link>
        </div>
      </div>

      <div className="prp-keyline" />

      {/* Dedicated Executive KPI Dashboard Panel */}
      <div className="prp-exec-panel" aria-label="Modul Dashboard Eksekutif KPI">
        <div className="prp-exec-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <BarChart3 size={18} color="#094E68" aria-hidden="true" />
            <div>
              <h2 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '1.08rem', fontWeight: 800, color: '#072534' }}>
                Ringkasan Eksekutif Kinerja KPI Institusi
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.2rem', fontSize: '0.76rem', color: '#475569' }}>
                <span>Status siklus terpilih:</span>
                <strong style={{ color: isSelectedPeriodActive ? '#166534' : '#B91C1C', fontWeight: 800 }}>
                  {isSelectedPeriodActive ? 'PERIODE AKTIF (BERJALAN)' : 'DATA HISTORIS / ARSIP TERKUNCI'}
                </strong>
                {execDashboard.formVersion && (
                  <span>· Skema v{execDashboard.formVersion}</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
              <Calendar size={14} color="#094E68" aria-hidden="true" />
              <span>Periode / Tahun:</span>
              <select
                id="exec-kpi-period-filter"
                aria-label="Filter Periode dan Tahun Dashboard Eksekutif KPI"
                className="ent-select"
                style={{ minHeight: '44px', minWidth: '215px', fontWeight: 700 }}
                value={selectedPeriodId}
                onChange={(e) => setUserSelectedPeriod(e.target.value)}
              >
                {kpiPeriods.map((p) => {
                  const pid = p.id || p.year;
                  const openFlag = Boolean(p.isOpenForInput ?? p.inputOpen ?? p.status === 'Active');
                  return (
                    <option key={pid} value={pid}>
                      {p.label || `Periode ${pid}`} ({openFlag ? 'Aktif' : 'Historis'})
                    </option>
                  );
                })}
              </select>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
              <Filter size={14} color="#094E68" aria-hidden="true" />
              <span>Perspektif:</span>
              <select
                aria-label="Filter Perspektif KPI Eksekutif"
                className="ent-select"
                style={{ minHeight: '44px', minWidth: '175px', fontWeight: 700 }}
                value={perspectiveFilter}
                onChange={(e) => setPerspectiveFilter(e.target.value)}
              >
                <option value="ALL">Semua Perspektif (A-D)</option>
                {execDashboard.perspectiveSummaries.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.code}. {sec.title}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="ent-btn"
              style={{ minHeight: '44px' }}
              onClick={() => setShowIndicatorRows((prev) => !prev)}
            >
              <Eye size={14} />
              <span>{showIndicatorRows ? 'Ringkas ke Agregat' : 'Tampilkan Matriks Angka'}</span>
            </button>
          </div>
        </div>

        {/* 4 Aggregate Executive Metrics */}
        <div className="prp-exec-kpi-grid">
          <div className="prp-exec-kpi-card">
            <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              01 · SKOR INSTITUSI
            </span>
            <div>
              <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.35rem', fontWeight: 800, color: '#072534', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                {formatIndonesianNumber(execDashboard.institutionScore, 2)}
              </strong>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginLeft: '0.35rem' }}>
                / {formatIndonesianNumber(execDashboard.totalWeightPositive, 0)} poin
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.45 }}>
              Positif (A-C): <strong>{formatIndonesianNumber(execDashboard.positiveScore, 2)}</strong> · Penalti (D):{' '}
              <strong style={{ color: execDashboard.penaltyScore < 0 ? '#B91C1C' : '#334155' }}>
                {formatIndonesianNumber(execDashboard.penaltyScore, 2)}
              </strong>
            </div>
          </div>

          <div className="prp-exec-kpi-card">
            <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              02 · RATA-RATA CAPAIAN RIIL
            </span>
            <div>
              <strong
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '2.35rem',
                  fontWeight: 800,
                  color: execDashboard.avgMeta ? execDashboard.avgMeta.color : '#475569',
                  letterSpacing: '-0.04em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {execDashboard.avgRatioPercent !== null
                  ? `${formatIndonesianNumber(execDashboard.avgRatioPercent, 2)}%`
                  : '-'}
              </strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.45 }}>
              Status rata-rata:{' '}
              <strong style={{ color: execDashboard.avgMeta ? execDashboard.avgMeta.color : '#475569', fontWeight: 800 }}>
                {execDashboard.avgMeta ? execDashboard.avgMeta.label.toUpperCase() : 'BELUM ADA ISIAN'}
              </strong>{' '}
              (tanpa batas plafon 100%)
            </div>
          </div>

          <div className="prp-exec-kpi-card">
            <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              03 · TOTAL ANGKA &amp; CAKUPAN
            </span>
            <div>
              <strong style={{ fontFamily: 'Outfit, sans-serif', fontSize: '2.35rem', fontWeight: 800, color: '#094E68', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                {execDashboard.filledCount}/{execDashboard.totalIndicators}
              </strong>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginLeft: '0.35rem' }}>
                indikator terisi
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.45 }}>
              Total angka realisasi: <strong>{formatIndonesianNumber(execDashboard.totalActualSum, 2)}</strong> ·{' '}
              <strong>{execDashboard.contributingUnitCount}</strong> unit kerja melapor
            </div>
          </div>

          <div className="prp-exec-kpi-card">
            <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              04 · DISTRIBUSI STATUS CAPAIAN
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem 0.75rem', fontSize: '0.77rem' }}>
              <div>
                <strong style={{ color: '#166534', fontWeight: 800 }}>Hijau (&gt;= 100%): {execDashboard.greenCount}</strong>
              </div>
              <div>
                <strong style={{ color: '#92400E', fontWeight: 800 }}>Kuning (90-99%): {execDashboard.yellowCount}</strong>
              </div>
              <div>
                <strong style={{ color: '#B91C1C', fontWeight: 800 }}>Merah (&lt; 90%): {execDashboard.redCount}</strong>
              </div>
              <div>
                <strong style={{ color: '#475569', fontWeight: 700 }}>Belum Diisi: {execDashboard.emptyCount}</strong>
              </div>
            </div>
            <div style={{ fontSize: '0.73rem', color: '#475569' }}>
              Ambang batas sesuai ketetapan rapat evaluasi pimpinan
            </div>
          </div>
        </div>

        {/* Perspective Breakdown */}
        <div className="prp-exec-persp-grid">
          {execDashboard.perspectiveSummaries.map((sec) => (
            <div key={sec.id} className="prp-exec-persp-cell">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                <strong style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', color: '#094E68', fontWeight: 800 }}>
                  PERSPEKTIF {sec.code}
                </strong>
                <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', color: '#475569', fontWeight: 700 }}>
                  Bobot {formatIndonesianNumber(sec.totalWeight, 1)}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#072534', marginTop: '0.2rem' }}>
                {sec.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.45rem', fontSize: '0.75rem' }}>
                <span>
                  Skor: <strong style={{ color: '#072534' }}>{formatIndonesianNumber(sec.totalScore, 2)}</strong>
                </span>
                <strong style={{ color: sec.avgMeta ? sec.avgMeta.color : '#475569', fontWeight: 800 }}>
                  {sec.avgRatio !== null ? `Capaian ${formatIndonesianNumber(sec.avgRatio, 1)}%` : 'Belum terisi'}
                </strong>
              </div>
            </div>
          ))}
        </div>

        {!execDashboard.hasSnapshot && (
          <div
            role="status"
            style={{
              padding: '0.9rem 1.3rem',
              background: '#FFFBEB',
              borderBottom: '1px solid #FDE68A',
              color: '#92400E',
              fontSize: '0.79rem',
              fontWeight: 700,
            }}
          >
            Periode historis {selectedPeriodMeta.label} belum memiliki rekaman distribusi formulir KPI aktif. Menampilkan kerangka indikator standar dengan nilai kosong.
          </div>
        )}

        {/* Aggregate Indicator Summary Table WITHOUT Evidence Attachments */}
        {showIndicatorRows && (
          <HorizontalTableViewport panLabel="Geser tabel ringkasan eksekutif indikator KPI">
            <table className="prp-exec-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Indikator Kinerja</th>
                  <th>PIC Utama &amp; Co-PIC</th>
                  <th style={{ textAlign: 'right' }}>Bobot</th>
                  <th style={{ textAlign: 'right' }}>Target</th>
                  <th style={{ textAlign: 'right' }}>Angka Realisasi</th>
                  <th style={{ textAlign: 'right' }}>Capaian Riil (%)</th>
                  <th style={{ textAlign: 'right' }}>Skor</th>
                </tr>
              </thead>
              <tbody>
                {execDashboard.filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontFamily: 'var(--ent-mono)', fontWeight: 800, color: '#094E68', whiteSpace: 'nowrap' }}>
                      {row.code}
                    </td>
                    <td style={{ minWidth: '240px', fontWeight: 600, lineHeight: 1.45 }}>
                      {row.indikator}
                    </td>
                    <td style={{ minWidth: '155px', fontSize: '0.74rem', lineHeight: 1.45 }}>
                      <strong style={{ color: '#072534', display: 'block' }}>
                        Utama: {row.primaryPic || '-'}
                      </strong>
                      {row.coPics.length > 0 && (
                        <span style={{ color: '#475569', fontWeight: 600 }}>
                          Co-PIC: {row.coPics.join(', ')}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ent-mono)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatIndonesianNumber(row.bobot, 2)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ent-mono)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {row.targetLabel}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--ent-mono)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {row.actualDisplay}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <strong
                        style={{
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.79rem',
                          fontWeight: 800,
                          color: row.meta.color,
                          fontVariantNumeric: 'tabular-nums',
                          display: 'block',
                        }}
                      >
                        {row.ratioPercent !== null ? `${formatIndonesianNumber(row.ratioPercent, 2)}%` : '-'}
                      </strong>
                      <span style={{ fontSize: '0.66rem', fontWeight: 800, color: row.meta.color }}>
                        {row.meta.label}
                      </span>
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontFamily: 'var(--ent-mono)',
                        fontWeight: 800,
                        fontVariantNumeric: 'tabular-nums',
                        color: row.weightedScore < 0 ? '#B91C1C' : '#072534',
                      }}
                    >
                      {formatIndonesianNumber(row.weightedScore, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HorizontalTableViewport>
        )}
      </div>

      {/* Operational Control Ledger */}
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
                {item.idx} · {item.code}
              </span>
              <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.62rem', fontWeight: 700, color: '#094E68' }}>
                KELOLA
              </span>
            </div>

            <div>
              <span className="prp-odometer">{String(item.value).padStart(2, '0')}</span>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#072534', letterSpacing: '-0.01em' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>{item.meta}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Lower 2-Column Ledger: Audit Stream & Module Index */}
      <div className="prp-lower-grid">
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
                05 · JURNAL KRONOLOGIS
              </span>
              <h2>Aliran Aktivitas &amp; Audit Sistem</h2>
            </div>
            <Link
              className="ent-btn"
              to="/internal/admin/governance?tab=audit"
              style={{ minHeight: '44px', padding: '0.45rem 0.85rem', fontSize: '0.74rem' }}
            >
              <History size={14} />
              <span>Log Lengkap</span>
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
              <div
                style={{
                  padding: '2.5rem 1rem',
                  borderBottom: '1px solid #D8E4EA',
                  color: '#475569',
                  fontSize: '0.84rem',
                  lineHeight: 1.6,
                }}
              >
                Belum ada rekaman aktivitas pada sesi ini. Setiap perubahan struktur formula, pengajuan unit, maupun kebijakan sistem akan tercatat di sini.
              </div>
            )}
          </div>
        </div>

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
                06 · INDEKS MODUL
              </span>
              <h2>Pintasan Tata Kelola</h2>
            </div>
          </div>

          <div>
            {commandModules.map((mod) => {
              const IconComp = mod.icon || Settings2;
              return (
                <Link className="prp-mod-row" key={mod.idx} to={mod.to}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                    <span className="prp-mod-idx">
                      <IconComp size={15} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#072534' }}>{mod.title}</div>
                      <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>{mod.sub}</div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.64rem',
                      fontWeight: 800,
                      color: '#094E68',
                      flexShrink: 0,
                    }}
                  >
                    {mod.idx}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
