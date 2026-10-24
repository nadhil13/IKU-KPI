import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCircle, LogOut, Menu, X, FileText,
  ShieldCheck, Bell, ArrowUpRight, Layers, Building2, Lock,
  ChevronDown, ChevronRight, Search, CornerDownLeft
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../features/auth/context/AuthContext';
import { readKpiWorkflow } from '../features/kpi/kpiWorkflowStore';
import { listIkuSubmissions } from '../features/iku/ikuWorkflowStore';
import { readAudit } from '../features/internal/adminStore';
import { mountSmoothScroll, getLenis } from '../lib/smoothScroll';

gsap.registerPlugin(ScrollTrigger);

export default function InternalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, activeWorkspace, activeContext, switchWorkspace, enterPRP, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prpTreeOpen, setPrpTreeOpen] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdIdx, setCmdIdx] = useState(0);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [blockedModalInfo, setBlockedModalInfo] = useState(null);
  const [telemetryTick, setTelemetryTick] = useState(0);

  const layoutRef = useRef(null);
  const navScrollRef = useRef(null);
  const hoverFollowerRef = useRef(null);
  const activeLaserRef = useRef(null);
  const switcherPillRef = useRef(null);
  const scrollWrapperRef = useRef(null);
  const scrollContentRef = useRef(null);
  const scrollProgressRef = useRef(null);
  const routeLaserRef = useRef(null);
  const prpSubmenuRef = useRef(null);
  const prpSpineRef = useRef(null);
  const prpChevronRef = useRef(null);
  const notifRef = useRef(null);
  const cmdPanelRef = useRef(null);
  const cmdInputRef = useRef(null);

  // Smooth scroll Lenis + sinkron ScrollTrigger pada area konten internal.
  useEffect(() => mountSmoothScroll(scrollWrapperRef.current, scrollContentRef.current), [currentUser]);

  // Reset scroll posisi saat pindah rute
  useEffect(() => {
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else if (scrollWrapperRef.current) scrollWrapperRef.current.scrollTop = 0;
    if (scrollProgressRef.current) gsap.set(scrollProgressRef.current, { scaleX: 0 });
  }, [location.pathname, location.search]);

  // Scroll progress hairline
  useEffect(() => {
    const scroller = scrollWrapperRef.current;
    if (!scroller) return undefined;
    const onScroll = () => {
      if (!scrollProgressRef.current) return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const ratio = max > 8 ? Math.min(1, Math.max(0, scroller.scrollTop / max)) : 0;
      gsap.to(scrollProgressRef.current, { scaleX: ratio, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [currentUser]);

  // Live telemetry listener
  useEffect(() => {
    const bump = () => setTelemetryTick((v) => v + 1);
    const events = ['storage', 'prp-admin-updated', 'prp-kpi-workflow-updated', 'prp-iku-updated'];
    events.forEach((ev) => window.addEventListener(ev, bump));
    return () => events.forEach((ev) => window.removeEventListener(ev, bump));
  }, []);

  // Global Keyboard Shortcut Ctrl+K / Meta+K untuk Command Palette
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => {
          const next = !prev;
          if (next) {
            setCmdQuery('');
            setCmdIdx(0);
          }
          return next;
        });
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Animasi fokus Command Palette saat dibuka
  useEffect(() => {
    if (!cmdOpen) return;
    requestAnimationFrame(() => {
      cmdInputRef.current?.focus();
      if (cmdPanelRef.current) {
        gsap.fromTo(
          cmdPanelRef.current,
          { y: -18, opacity: 0, scale: 0.985 },
          { y: 0, opacity: 1, scale: 1, duration: 0.34, ease: 'expo.out' }
        );
      }
    });
  }, [cmdOpen]);

  // Tutup popover notifikasi saat klik di luar
  useEffect(() => {
    if (!notifOpen) return undefined;
    const onDown = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [notifOpen]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 920) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  const isIkuOnly = currentUser?.role === 'iku_only';
  const isKpiOnly = currentUser?.role === 'kpi_only';
  const isSuperadminPrp = currentUser?.role === 'superadmin_prp';
  const isDual = ['dual', 'superadmin_prp'].includes(currentUser?.role);
  const showPRP = isSuperadminPrp && activeContext === 'prp';
  const showIKU = !showPRP && (!isKpiOnly && activeContext === 'iku');
  const showKPI = !showPRP && (!isIkuOnly && activeContext === 'kpi');

  const effectiveWorkspace = isIkuOnly
    ? 'iku'
    : isKpiOnly
      ? 'kpi'
      : activeWorkspace === 'kpi'
        ? 'kpi'
        : 'iku';

  const telemetry = useMemo(() => {
    void telemetryTick;
    if (!currentUser) return { kpiPending: 0, ikuPending: 0, totalPending: 0, recentAudit: [] };
    let kpiPending = 0;
    let ikuPending = 0;
    let recentAudit = [];
    try {
      const kpi = readKpiWorkflow();
      kpiPending = Object.values(kpi.submissions || {}).filter((r) => r.status === 'SUBMITTED').length;
    } catch { /* fallback */ }
    try {
      if (['iku_only', 'superadmin_prp'].includes(currentUser.role)) {
        const iku = listIkuSubmissions(currentUser);
        ikuPending = iku.filter((r) => r.status === 'SUBMITTED').length;
      }
    } catch { /* fallback */ }
    try {
      recentAudit = readAudit().slice(0, 4);
    } catch { /* fallback */ }
    return {
      kpiPending,
      ikuPending,
      totalPending: kpiPending + ikuPending,
      recentAudit,
    };
  }, [currentUser, telemetryTick]);

  // Sinkronisasi Posisi Laser Bar Aktif di Sidebar
  const syncActiveLaser = useCallback(() => {
    const navEl = navScrollRef.current;
    const laserEl = activeLaserRef.current;
    if (!navEl || !laserEl) return;
    const activeNode = navEl.querySelector('[data-nav-active="true"]');
    if (!activeNode) {
      gsap.to(laserEl, { opacity: 0, duration: 0.2 });
      return;
    }
    const navRect = navEl.getBoundingClientRect();
    const itemRect = activeNode.getBoundingClientRect();
    const top = itemRect.top - navRect.top + navEl.scrollTop;
    gsap.to(laserEl, {
      y: top + 5,
      height: Math.max(16, itemRect.height - 10),
      opacity: 1,
      duration: 0.45,
      ease: 'expo.out',
      overwrite: 'auto',
    });
  }, []);

  // Magnetic Hover Follower (120fps gsap.quickTo)
  const handleNavItemEnter = useCallback((e) => {
    const navEl = navScrollRef.current;
    const follower = hoverFollowerRef.current;
    if (!navEl || !follower) return;
    const navRect = navEl.getBoundingClientRect();
    const itemRect = e.currentTarget.getBoundingClientRect();
    const top = itemRect.top - navRect.top + navEl.scrollTop;
    gsap.to(follower, {
      y: top,
      height: itemRect.height,
      opacity: 1,
      duration: 0.26,
      ease: 'expo.out',
      overwrite: 'auto',
    });
  }, []);

  const handleNavLeave = useCallback(() => {
    if (hoverFollowerRef.current) {
      gsap.to(hoverFollowerRef.current, { opacity: 0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    }
  }, []);

  // 1. Entrance Choreography saat Sesi Dimuat
  useGSAP(() => {
    if (!currentUser) return;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(
      '.sidebar-stagger',
      { x: -20, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.72, stagger: 0.045, clearProps: 'transform' }
    ).fromTo(
      '.header-stagger',
      { y: -14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, clearProps: 'transform' },
      '-=0.55'
    );
  }, { dependencies: [currentUser?.id], scope: layoutRef });

  // 2. Animasi Workspace Switcher Pill & Konteks Menu
  useGSAP(() => {
    if (isDual && switcherPillRef.current) {
      gsap.to(switcherPillRef.current, {
        xPercent: isSuperadminPrp
          ? activeContext === 'prp'
            ? 0
            : activeContext === 'kpi'
              ? 200
              : 100
          : effectiveWorkspace === 'kpi' ? 100 : 0,
        duration: 0.5,
        ease: 'expo.out',
      });
    }
    gsap.fromTo(
      '.nav-context-item',
      { x: -12, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.48,
        stagger: 0.04,
        ease: 'expo.out',
        overwrite: 'auto',
        clearProps: 'transform',
        onComplete: syncActiveLaser,
      }
    );
  }, { dependencies: [effectiveWorkspace, activeContext, isDual, isSuperadminPrp], scope: layoutRef });

  // 3. Animasi Accordion Ledger Tree Submenu PRP Control Center
  useGSAP(() => {
    if (!showPRP) return;
    if (prpChevronRef.current) {
      gsap.to(prpChevronRef.current, {
        rotate: prpTreeOpen ? 0 : -90,
        duration: 0.36,
        ease: 'expo.out',
      });
    }
    if (prpSubmenuRef.current) {
      if (prpTreeOpen) {
        gsap.fromTo(
          prpSubmenuRef.current,
          { height: 0, opacity: 0 },
          {
            height: 'auto',
            opacity: 1,
            duration: 0.46,
            ease: 'expo.out',
            overwrite: 'auto',
            onComplete: syncActiveLaser,
          }
        );
        if (prpSpineRef.current) {
          gsap.fromTo(
            prpSpineRef.current,
            { scaleY: 0 },
            { scaleY: 1, transformOrigin: 'top center', duration: 0.58, ease: 'expo.out', delay: 0.04 }
          );
        }
        gsap.fromTo(
          '.prp-tree-item',
          { x: -12, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.42,
            stagger: 0.032,
            ease: 'expo.out',
            delay: 0.05,
            overwrite: 'auto',
            clearProps: 'transform',
          }
        );
      } else {
        gsap.to(prpSubmenuRef.current, {
          height: 0,
          opacity: 0,
          duration: 0.32,
          ease: 'power3.inOut',
          overwrite: 'auto',
          onComplete: syncActiveLaser,
        });
      }
    }
  }, { dependencies: [prpTreeOpen, showPRP], scope: layoutRef });

  // 4. MAX-LEVEL GSAP PAGE & MENU TRANSITION (Kinetic Laser Sweep + Masked Stage + Self-Drawing Rules)
  useGSAP(() => {
    requestAnimationFrame(syncActiveLaser);

    if (routeLaserRef.current) {
      const laserTl = gsap.timeline();
      laserTl
        .set(routeLaserRef.current, { transformOrigin: 'left center', scaleX: 0, opacity: 1 })
        .to(routeLaserRef.current, { scaleX: 1, duration: 0.34, ease: 'expo.out' })
        .set(routeLaserRef.current, { transformOrigin: 'right center' })
        .to(routeLaserRef.current, { scaleX: 0, opacity: 0, duration: 0.38, ease: 'power3.inOut' });
    }

    if (scrollContentRef.current) {
      gsap.fromTo(
        scrollContentRef.current,
        { opacity: 0, y: 22, clipPath: 'inset(0% 0% 4% 0%)' },
        {
          opacity: 1,
          y: 0,
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 0.58,
          ease: 'expo.out',
          clearProps: 'transform,clipPath',
          onComplete: () => ScrollTrigger.refresh(),
        }
      );

      const rules = scrollContentRef.current.querySelectorAll('.arch-rule, .arch-rule-strong');
      if (rules.length) {
        gsap.fromTo(
          rules,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.85, stagger: 0.06, ease: 'expo.out', delay: 0.06 }
        );
      }
    }
  }, { dependencies: [location.pathname, location.search, activeContext, effectiveWorkspace] });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const searchParams = new URLSearchParams(location.search);
  const currentGovTab = searchParams.get('tab') || 'kpi-builder';

  const isExactPath = (path) => location.pathname === path;
  const isActivePrefix = (path) => {
    if (path === '/internal' || path === '/internal/admin') return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const isPrpHubChildActive =
    location.pathname === '/internal/admin' || location.pathname.startsWith('/internal/admin/governance');

  // Seluruh 6 Sub-Menu PRP Tersusun 1-ke-1 dengan Index Numerik Presisi
  const prpSubItems = [
    {
      idx: '01',
      id: 'overview',
      label: 'Ikhtisar Eksekutif',
      to: '/internal/admin',
      active: isExactPath('/internal/admin'),
    },
    {
      idx: '02',
      id: 'kpi-builder',
      label: 'Desainer Tabel KPI',
      to: '/internal/admin/governance?tab=kpi-builder',
      active: isExactPath('/internal/admin/governance') && currentGovTab === 'kpi-builder',
    },
    {
      idx: '03',
      id: 'submissions',
      label: 'Pusat Review Unit',
      to: '/internal/admin/governance?tab=submissions',
      badge: telemetry.totalPending > 0 ? telemetry.totalPending : null,
      active: isExactPath('/internal/admin/governance') && currentGovTab === 'submissions',
    },
    {
      idx: '04',
      id: 'periods',
      label: 'Periode & Tenggat',
      to: '/internal/admin/governance?tab=periods',
      active: isExactPath('/internal/admin/governance') && currentGovTab === 'periods',
    },
    {
      idx: '05',
      id: 'audit',
      label: 'Audit Trail',
      to: '/internal/admin/governance?tab=audit',
      active: isExactPath('/internal/admin/governance') && currentGovTab === 'audit',
    },
    {
      idx: '06',
      id: 'settings',
      label: 'Kebijakan Sistem',
      to: '/internal/admin/governance?tab=settings',
      active: isExactPath('/internal/admin/governance') && currentGovTab === 'settings',
    },
  ];

  const closeMobileSidebar = () => {
    if (windowWidth <= 920) setSidebarOpen(false);
  };

  const handleSelectWorkspaceMenu = useCallback((targetWorkspace) => {
    if (isDual) {
      switchWorkspace(targetWorkspace);
    }
    if (windowWidth <= 920) setSidebarOpen(false);
    if (location.pathname !== '/internal') {
      navigate('/internal');
    }
  }, [isDual, switchWorkspace, windowWidth, location.pathname, navigate]);

  const handleSelectPRP = useCallback(() => {
    enterPRP();
    if (windowWidth <= 920) setSidebarOpen(false);
    navigate('/internal/admin');
  }, [enterPRP, windowWidth, navigate]);

  // Daftar Perintah untuk Command Palette (Ctrl+K) — menghormati isolasi peran 100%
  const commandItems = useMemo(() => {
    const list = [];
    if (isSuperadminPrp) {
      list.push(
        { code: 'PRP.01', group: 'PRP Control Center', label: 'Ikhtisar Eksekutif PRP', run: () => { enterPRP(); navigate('/internal/admin'); } },
        { code: 'PRP.02', group: 'PRP Control Center', label: 'Desainer Tabel & Formula KPI', run: () => { enterPRP(); navigate('/internal/admin/governance?tab=kpi-builder'); } },
        { code: 'PRP.03', group: 'PRP Control Center', label: 'Pusat Review Submission Unit', run: () => { enterPRP(); navigate('/internal/admin/governance?tab=submissions'); } },
        { code: 'PRP.04', group: 'PRP Control Center', label: 'Periode & Tenggat Evaluasi', run: () => { enterPRP(); navigate('/internal/admin/governance?tab=periods'); } },
        { code: 'PRP.05', group: 'PRP Control Center', label: 'Audit Trail Aktivitas', run: () => { enterPRP(); navigate('/internal/admin/governance?tab=audit'); } },
        { code: 'PRP.06', group: 'PRP Control Center', label: 'Kebijakan & Parameter Sistem', run: () => { enterPRP(); navigate('/internal/admin/governance?tab=settings'); } },
        { code: 'DIR.01', group: 'Direktori', label: 'Manajemen Pengguna & Hak Akses', run: () => navigate('/internal/users') },
      );
    }
    if (!isKpiOnly) {
      list.push(
        { code: 'IKU.00', group: 'Workspace 8 IKU', label: 'Dashboard Capaian 8 IKU Kementerian', run: () => handleSelectWorkspaceMenu('iku') },
      );
      if (isIkuOnly || isSuperadminPrp) {
        list.push({ code: 'IKU.01', group: 'Workspace 8 IKU', label: 'Submission & Verifikasi Bukti 8 IKU', run: () => navigate('/internal/iku-submissions') });
      }
    }
    if (!isIkuOnly) {
      list.push(
        { code: 'KPI.00', group: 'Workspace KPI', label: 'Lembar Kerja KPI Operasional Unit', run: () => handleSelectWorkspaceMenu('kpi') },
      );
    }
    list.push(
      { code: 'ORG.01', group: 'Organisasi', label: 'Struktur Organisasi & Unit PIC', run: () => navigate('/internal/team') },
      { code: 'DOC.01', group: 'Referensi', label: 'Dokumen & Regulasi Resmi', run: () => navigate('/internal/documents') },
      { code: 'USR.01', group: 'Akun', label: 'Profil & Keamanan Sesi Saya', run: () => navigate('/internal/profile') },
      { code: 'PUB.01', group: 'Eksternal', label: 'Buka Beranda Publik ITPLN', run: () => navigate('/') },
    );
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => `${item.code} ${item.group} ${item.label}`.toLowerCase().includes(q));
  }, [isSuperadminPrp, isKpiOnly, isIkuOnly, cmdQuery, enterPRP, navigate, handleSelectWorkspaceMenu]);

  const breadcrumb = useMemo(() => {
    const p = location.pathname;
    if (p === '/internal/admin') {
      return { code: 'PRP.01', group: 'PRP Control Center', current: 'Ikhtisar Eksekutif' };
    }
    if (p.startsWith('/internal/admin/governance')) {
      const tabMap = {
        'kpi-builder': { code: 'PRP.02', title: 'Desainer Tabel & Formula KPI' },
        submissions: { code: 'PRP.03', title: 'Pusat Review Submission' },
        periods: { code: 'PRP.04', title: 'Periode & Tenggat Evaluasi' },
        audit: { code: 'PRP.05', title: 'Audit Trail Sistem' },
        settings: { code: 'PRP.06', title: 'Kebijakan Sistem' },
      };
      const found = tabMap[currentGovTab] || { code: 'PRP.02', title: 'Konfigurasi Kinerja' };
      return { code: found.code, group: 'PRP Control Center', current: found.title };
    }
    if (p.startsWith('/internal/iku-submissions')) {
      return { code: 'IKU.SUB', group: showPRP ? 'Operasional PRP' : 'Modul 8 IKU', current: 'Submission & Verifikasi IKU' };
    }
    if (p.startsWith('/internal/users')) {
      return { code: 'DIR.USR', group: 'Direktori', current: 'Manajemen Pengguna' };
    }
    if (p.startsWith('/internal/team')) {
      return { code: 'DIR.ORG', group: 'Direktori', current: 'Struktur Organisasi & PIC' };
    }
    if (p.startsWith('/internal/documents')) {
      return { code: 'REF.DOC', group: 'Referensi', current: 'Dokumen & Regulasi' };
    }
    if (p.startsWith('/internal/profile')) {
      return { code: 'ACC.SES', group: 'Sesi Aktif', current: 'Profil & Keamanan Akun' };
    }
    return {
      code: effectiveWorkspace === 'kpi' ? 'WS.KPI' : 'WS.IKU',
      group: effectiveWorkspace === 'kpi' ? 'Ruang Kerja KPI' : 'Ruang Kerja IKU',
      current: effectiveWorkspace === 'kpi' ? 'Evaluasi Operasional Unit & Fakultas' : 'Capaian 8 IKU Kementerian',
    };
  }, [location.pathname, currentGovTab, effectiveWorkspace, showPRP]);

  if (!currentUser) {
    return null;
  }

  const handleRestrictedClick = (targetFeature) => {
    if (isIkuOnly && targetFeature === 'kpi') {
      setBlockedModalInfo({
        code: '403 // ISOLATED IKU AUTHORITY',
        title: 'Akses Dibatasi — Otoritas Khusus IKU',
        message:
          'Akun Anda terdaftar dengan hak akses tunggal 8 Indikator Kinerja Utama (Kemendikbudristek). Modul KPI internal unit dan fakultas dikunci secara otomatis oleh sistem.',
        allowedAction:
          'Gunakan akun Integrator (admin@itpln.ac.id) pada halaman login untuk mengakses dan berpindah antara modul IKU serta KPI.',
      });
    } else if (isKpiOnly && targetFeature === 'iku') {
      setBlockedModalInfo({
        code: '403 // ISOLATED KPI AUTHORITY',
        title: 'Akses Dibatasi — Otoritas Khusus KPI',
        message:
          'Akun Anda terdaftar dengan hak akses operasional Key Performance Indicator (Unit & Fakultas). Modul 8 IKU Kementerian dikunci secara otomatis untuk sesi ini.',
        allowedAction:
          'Gunakan akun Integrator (admin@itpln.ac.id) pada halaman login untuk mengakses dan berpindah antara modul IKU serta KPI.',
      });
    }
  };

  const isMobile = windowWidth <= 920;

  return (
    <div
      ref={layoutRef}
      className="internal-wrapper"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: '#ffffff',
        overflow: 'hidden',
        color: '#09090b',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        zIndex: 1,
      }}
    >
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 9, 11, 0.42)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
          }}
        />
      )}

      {/* ─── 1. SWISS ARCHITECTURAL STUDIO SIDEBAR ─── */}
      <aside
        className={`corp-sidebar ${sidebarOpen ? 'open' : ''}`}
        style={{
          width: '282px',
          minWidth: '282px',
          maxWidth: '282px',
          flexShrink: 0,
          background: '#fafafa',
          borderRight: '1px solid #e4e4e7',
          display: 'flex',
          flexDirection: 'column',
          position: isMobile ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          height: '100vh',
          zIndex: 50,
          overflow: 'hidden',
          transform: isMobile
            ? sidebarOpen
              ? 'translateX(0)'
              : 'translateX(-100%)'
            : 'none',
          transition: 'transform 0.36s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Brand Architectural Header */}
        <div
          className="sidebar-stagger"
          style={{
            height: '58px',
            padding: '0 1.15rem',
            borderBottom: '1px solid #e4e4e7',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <Link
            to={showPRP ? '/internal/admin' : '/internal'}
            onClick={closeMobileSidebar}
            style={{ display: 'flex', alignItems: 'center', gap: '0.68rem', textDecoration: 'none' }}
          >
            <img src="/logo_pln.png" alt="ITPLN" style={{ height: '24px', width: 'auto' }} />
            <div style={{ width: '1px', height: '18px', background: '#e4e4e7' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                <span
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    color: '#09090b',
                    fontFamily: 'Outfit, sans-serif',
                    letterSpacing: '-0.035em',
                  }}
                >
                  PERFORMA
                </span>
                <span
                  style={{
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.58rem',
                    fontWeight: 600,
                    color: '#71717a',
                    letterSpacing: '0.06em',
                  }}
                >
                  ITPLN
                </span>
              </div>
            </div>
          </Link>

          {isMobile && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Tutup navigasi"
              style={{
                background: '#ffffff',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
                width: '30px',
                height: '30px',
                display: 'grid',
                placeItems: 'center',
                color: '#09090b',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Quick Command Trigger + Workspace Switcher */}
        <div
          className="sidebar-stagger"
          style={{
            padding: '0.85rem 0.95rem',
            borderBottom: '1px solid #e4e4e7',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.7rem',
            flexShrink: 0,
          }}
        >
          {/* Spotlight Command Bar Trigger */}
          <button
            type="button"
            onClick={() => {
              setCmdQuery('');
              setCmdIdx(0);
              setCmdOpen(true);
            }}
            className="arch-cmd-trigger"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#52525b' }}>
              <Search size={13} strokeWidth={2} />
              <span>Navigasi cepat...</span>
            </span>
            <kbd className="arch-kbd">Ctrl K</kbd>
          </button>

          {/* Segmented Architectural Switcher */}
          {isDual ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.35rem',
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.58rem',
                  color: '#71717a',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                <span>KONTEKS OTORITAS</span>
                <span style={{ color: '#09090b', fontWeight: 700 }}>
                  {isSuperadminPrp ? 'ROOT // PRP' : 'DUAL'}
                </span>
              </div>
              <div
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: isSuperadminPrp ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                  background: '#efeff1',
                  border: '1px solid #e4e4e7',
                  padding: '2px',
                  borderRadius: '6px',
                }}
              >
                <div
                  ref={switcherPillRef}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    bottom: '2px',
                    left: '2px',
                    width: isSuperadminPrp ? 'calc((100% - 4px) / 3)' : 'calc((100% - 4px) / 2)',
                    background: '#09090b',
                    borderRadius: '4px',
                    zIndex: 1,
                  }}
                />
                {isSuperadminPrp && (
                  <button
                    type="button"
                    onClick={handleSelectPRP}
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      padding: '5px 4px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.64rem',
                      fontWeight: 600,
                      letterSpacing: '0.03em',
                      color: activeContext === 'prp' ? '#ffffff' : '#52525b',
                      transition: 'color 0.22s ease',
                    }}
                  >
                    PRP
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSelectWorkspaceMenu('iku')}
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: '5px 4px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.64rem',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    color: activeContext === 'iku' ? '#ffffff' : '#52525b',
                    transition: 'color 0.22s ease',
                  }}
                >
                  01·IKU
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectWorkspaceMenu('kpi')}
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: '5px 4px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.64rem',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    color: activeContext === 'kpi' ? '#ffffff' : '#52525b',
                    transition: 'color 0.22s ease',
                  }}
                >
                  02·KPI
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #e4e4e7',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.63rem',
              }}
            >
              <span style={{ color: '#52525b' }}>{currentUser.roleTitle}</span>
              <span style={{ fontWeight: 700, color: '#09090b' }}>
                {isIkuOnly ? '[IKU]' : '[KPI]'}
              </span>
            </div>
          )}
        </div>

        {/* Architectural Navigation Ledger with Magnetic Hover & Laser Rail */}
        <nav
          ref={navScrollRef}
          onMouseLeave={handleNavLeave}
          data-lenis-prevent
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            padding: '0.85rem 0.75rem',
            overflowY: 'auto',
          }}
        >
          {/* Floating Magnetic Hover Follower */}
          <div
            ref={hoverFollowerRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '0.75rem',
              right: '0.75rem',
              top: 0,
              height: '34px',
              borderRadius: '6px',
              background: '#efeff1',
              opacity: 0,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Sliding Active Obsidian Laser Bar */}
          <div
            ref={activeLaserRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: 0,
              width: '2.5px',
              height: '22px',
              background: '#09090b',
              borderRadius: '2px',
              opacity: 0,
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
            {/* ═══ KONTEKS 1: SUPERADMIN PRP CONTROL CENTER (ARCHITECTURAL TREE LEDGER) ═══ */}
            {showPRP && (
              <>
                <div className="sidebar-stagger nav-context-item">
                  <div className="corp-nav-section-label">
                    <span>01 // TATA KELOLA PUSAT</span>
                    <span>[06]</span>
                  </div>

                  {/* Accordion Parent Header */}
                  <button
                    type="button"
                    onMouseEnter={handleNavItemEnter}
                    data-nav-active={isPrpHubChildActive && !prpTreeOpen ? 'true' : undefined}
                    onClick={() => {
                      if (!isPrpHubChildActive) {
                        handleSelectPRP();
                        setPrpTreeOpen(true);
                      } else {
                        setPrpTreeOpen((prev) => !prev);
                      }
                    }}
                    className={`corp-parent-hub-btn ${isPrpHubChildActive ? 'hub-active' : ''}`}
                  >
                    <LayoutDashboard size={15} strokeWidth={1.9} />
                    <span style={{ flex: 1, textAlign: 'left' }}>PRP Control Center</span>
                    <span ref={prpChevronRef} style={{ display: 'inline-flex', color: '#71717a' }}>
                      <ChevronDown size={14} />
                    </span>
                  </button>

                  {/* Collapsible Indented Architectural Tree Ledger */}
                  <div ref={prpSubmenuRef} style={{ overflow: 'hidden' }}>
                    <div style={{ position: 'relative', marginLeft: '1.05rem', paddingLeft: '0.85rem', marginTop: '0.2rem' }}>
                      {/* Self-Drawing Vertical Hairline Spine */}
                      <div
                        ref={prpSpineRef}
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '4px',
                          bottom: '4px',
                          width: '1px',
                          background: '#d4d4d8',
                        }}
                      />
                      <ul className="corp-nav-ul">
                        {prpSubItems.map((sub) => (
                          <li key={sub.id} className="prp-tree-item">
                            <Link
                              to={sub.to}
                              onClick={closeMobileSidebar}
                              onMouseEnter={handleNavItemEnter}
                              data-nav-active={sub.active ? 'true' : undefined}
                              aria-current={sub.active ? 'page' : undefined}
                              className={`corp-tree-row ${sub.active ? 'active' : ''}`}
                            >
                              <span className="corp-tree-idx">{sub.idx}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {sub.label}
                              </span>
                              {sub.badge && (
                                <span className="corp-nav-counter">{sub.badge}</span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Grup 2: Operasional & Direktori */}
                <div className="sidebar-stagger nav-context-item">
                  <div className="corp-nav-section-label">
                    <span>02 // OPERASIONAL & DIREKTORI</span>
                    <span>[03]</span>
                  </div>
                  <ul className="corp-nav-ul">
                    <li>
                      <Link
                        to="/internal/iku-submissions"
                        onClick={closeMobileSidebar}
                        onMouseEnter={handleNavItemEnter}
                        data-nav-active={isActivePrefix('/internal/iku-submissions') ? 'true' : undefined}
                        aria-current={isActivePrefix('/internal/iku-submissions') ? 'page' : undefined}
                        className={`corp-nav-item ${isActivePrefix('/internal/iku-submissions') ? 'active' : ''}`}
                      >
                        <FileText size={15} strokeWidth={1.85} className="corp-item-icon" />
                        <span style={{ flex: 1 }}>Submission 8 IKU</span>
                        {telemetry.ikuPending > 0 && (
                          <span className="corp-nav-counter">{telemetry.ikuPending}</span>
                        )}
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/internal/team"
                        onClick={closeMobileSidebar}
                        onMouseEnter={handleNavItemEnter}
                        data-nav-active={isActivePrefix('/internal/team') ? 'true' : undefined}
                        aria-current={isActivePrefix('/internal/team') ? 'page' : undefined}
                        className={`corp-nav-item ${isActivePrefix('/internal/team') ? 'active' : ''}`}
                      >
                        <Building2 size={15} strokeWidth={1.85} className="corp-item-icon" />
                        <span>Organisasi & Unit PIC</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/internal/users"
                        onClick={closeMobileSidebar}
                        onMouseEnter={handleNavItemEnter}
                        data-nav-active={isActivePrefix('/internal/users') ? 'true' : undefined}
                        aria-current={isActivePrefix('/internal/users') ? 'page' : undefined}
                        className={`corp-nav-item ${isActivePrefix('/internal/users') ? 'active' : ''}`}
                      >
                        <Users size={15} strokeWidth={1.85} className="corp-item-icon" />
                        <span>Manajemen Pengguna</span>
                      </Link>
                    </li>
                  </ul>
                </div>
              </>
            )}

            {/* ═══ KONTEKS 2: RUANG KERJA IKU KEMENTERIAN ═══ */}
            {showIKU && (
              <div className="sidebar-stagger nav-context-item">
                <div className="corp-nav-section-label">
                  <span>01 // MODUL 8 IKU</span>
                  <span>[MAKRO]</span>
                </div>
                <ul className="corp-nav-ul">
                  <li>
                    <button
                      type="button"
                      onMouseEnter={handleNavItemEnter}
                      onClick={() => handleSelectWorkspaceMenu('iku')}
                      data-nav-active={isExactPath('/internal') && effectiveWorkspace === 'iku' ? 'true' : undefined}
                      className={`corp-nav-item ${isExactPath('/internal') && effectiveWorkspace === 'iku' ? 'active' : ''}`}
                    >
                      <Layers size={15} strokeWidth={1.85} className="corp-item-icon" />
                      <span>Capaian 8 IKU</span>
                    </button>
                  </li>
                  {(isIkuOnly || isSuperadminPrp) && (
                    <li>
                      <Link
                        to="/internal/iku-submissions"
                        onClick={closeMobileSidebar}
                        onMouseEnter={handleNavItemEnter}
                        data-nav-active={isActivePrefix('/internal/iku-submissions') ? 'true' : undefined}
                        aria-current={isActivePrefix('/internal/iku-submissions') ? 'page' : undefined}
                        className={`corp-nav-item ${isActivePrefix('/internal/iku-submissions') ? 'active' : ''}`}
                      >
                        <ShieldCheck size={15} strokeWidth={1.85} className="corp-item-icon" />
                        <span style={{ flex: 1 }}>Submission IKU</span>
                        {telemetry.ikuPending > 0 && isSuperadminPrp && (
                          <span className="corp-nav-counter">{telemetry.ikuPending}</span>
                        )}
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link
                      to="/internal/team"
                      onClick={closeMobileSidebar}
                      onMouseEnter={handleNavItemEnter}
                      data-nav-active={isActivePrefix('/internal/team') ? 'true' : undefined}
                      aria-current={isActivePrefix('/internal/team') ? 'page' : undefined}
                      className={`corp-nav-item ${isActivePrefix('/internal/team') ? 'active' : ''}`}
                    >
                      <Building2 size={15} strokeWidth={1.85} className="corp-item-icon" />
                      <span>Struktur & PIC IKU</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/internal/documents"
                      onClick={closeMobileSidebar}
                      onMouseEnter={handleNavItemEnter}
                      data-nav-active={isActivePrefix('/internal/documents') ? 'true' : undefined}
                      aria-current={isActivePrefix('/internal/documents') ? 'page' : undefined}
                      className={`corp-nav-item ${isActivePrefix('/internal/documents') ? 'active' : ''}`}
                    >
                      <FileText size={15} strokeWidth={1.85} className="corp-item-icon" />
                      <span>Dokumen & Regulasi</span>
                    </Link>
                  </li>
                </ul>

                {isIkuOnly && (
                  <div style={{ marginTop: '1.15rem' }}>
                    <div className="corp-nav-section-label">
                      <span>ISOLASI SISTEM</span>
                      <span>[LOCKED]</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestrictedClick('kpi')}
                      className="corp-nav-locked"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Building2 size={14} />
                        <span>Lembar Kerja KPI</span>
                      </span>
                      <Lock size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ KONTEKS 3: RUANG KERJA KPI OPERASIONAL ═══ */}
            {showKPI && (
              <div className="sidebar-stagger nav-context-item">
                <div className="corp-nav-section-label">
                  <span>01 // MODUL KPI UNIT</span>
                  <span>[MIKRO]</span>
                </div>
                <ul className="corp-nav-ul">
                  <li>
                    <button
                      type="button"
                      onMouseEnter={handleNavItemEnter}
                      onClick={() => handleSelectWorkspaceMenu('kpi')}
                      data-nav-active={isExactPath('/internal') && effectiveWorkspace === 'kpi' ? 'true' : undefined}
                      className={`corp-nav-item ${isExactPath('/internal') && effectiveWorkspace === 'kpi' ? 'active' : ''}`}
                    >
                      <Building2 size={15} strokeWidth={1.85} className="corp-item-icon" />
                      <span>Lembar Kerja KPI</span>
                    </button>
                  </li>
                  <li>
                    <Link
                      to="/internal/team"
                      onClick={closeMobileSidebar}
                      onMouseEnter={handleNavItemEnter}
                      data-nav-active={isActivePrefix('/internal/team') ? 'true' : undefined}
                      aria-current={isActivePrefix('/internal/team') ? 'page' : undefined}
                      className={`corp-nav-item ${isActivePrefix('/internal/team') ? 'active' : ''}`}
                    >
                      <ShieldCheck size={15} strokeWidth={1.85} className="corp-item-icon" />
                      <span>Struktur Unit & PIC</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/internal/documents"
                      onClick={closeMobileSidebar}
                      onMouseEnter={handleNavItemEnter}
                      data-nav-active={isActivePrefix('/internal/documents') ? 'true' : undefined}
                      aria-current={isActivePrefix('/internal/documents') ? 'page' : undefined}
                      className={`corp-nav-item ${isActivePrefix('/internal/documents') ? 'active' : ''}`}
                    >
                      <FileText size={15} strokeWidth={1.85} className="corp-item-icon" />
                      <span>Panduan & Referensi</span>
                    </Link>
                  </li>
                </ul>

                {isKpiOnly && (
                  <div style={{ marginTop: '1.15rem' }}>
                    <div className="corp-nav-section-label">
                      <span>ISOLASI SISTEM</span>
                      <span>[LOCKED]</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestrictedClick('iku')}
                      className="corp-nav-locked"
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Layers size={14} />
                        <span>Capaian 8 IKU</span>
                      </span>
                      <Lock size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ IDENTITAS & SESI (SELALU TERSEDIA) ═══ */}
            <div className="sidebar-stagger">
              <div className="corp-nav-section-label">
                <span>AKUN & OTENTIKASI</span>
                <span>[SSO]</span>
              </div>
              <ul className="corp-nav-ul">
                <li>
                  <Link
                    to="/internal/profile"
                    onClick={closeMobileSidebar}
                    onMouseEnter={handleNavItemEnter}
                    data-nav-active={isActivePrefix('/internal/profile') ? 'true' : undefined}
                    aria-current={isActivePrefix('/internal/profile') ? 'page' : undefined}
                    className={`corp-nav-item ${isActivePrefix('/internal/profile') ? 'active' : ''}`}
                  >
                    <UserCircle size={15} strokeWidth={1.85} className="corp-item-icon" />
                    <span>Profil Sesi Saya</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </nav>

        {/* Architectural Sidebar Footer */}
        <div
          style={{
            padding: '0.75rem 0.85rem',
            borderTop: '1px solid #e4e4e7',
            background: '#ffffff',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '0.45rem',
            flexShrink: 0,
          }}
        >
          <Link to="/" className="corp-footer-link">
            <span>Portal Publik</span>
            <ArrowUpRight size={13} />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title="Keluar Sesi (Logout)"
            className="corp-logout-btn"
          >
            <LogOut size={14} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ─── 2. PURE CLEAN VIEW MAIN WORKSPACE ─── */}
      <main
        style={{
          flex: 1,
          height: '100vh',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 10,
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        {/* Top Architectural Header (58px, Crisp Hairline) */}
        <header
          className="header-stagger"
          style={{
            position: 'relative',
            height: '58px',
            flexShrink: 0,
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '0 clamp(1rem, 2.5vw, 2.25rem)',
            borderBottom: '1px solid #e4e4e7',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            zIndex: 30,
          }}
        >
          {/* Left: Hamburger + Architectural Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Buka navigasi"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  borderRadius: '6px',
                  width: '34px',
                  height: '34px',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#09090b',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Menu size={17} />
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, overflow: 'hidden' }}>
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.63rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: '#09090b',
                  color: '#ffffff',
                  letterSpacing: '0.06em',
                  flexShrink: 0,
                }}
              >
                {breadcrumb.code}
              </span>
              {windowWidth > 620 && (
                <>
                  <span style={{ fontSize: '0.76rem', color: '#71717a', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {breadcrumb.group}
                  </span>
                  <ChevronRight size={13} color="#a1a1aa" style={{ flexShrink: 0 }} />
                </>
              )}
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#09090b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '-0.01em',
                }}
              >
                {breadcrumb.current}
              </span>
            </div>
          </div>

          {/* Right: Activity Bell + Crisp Monospace Session Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                type="button"
                aria-label="Log aktivitas & antrean"
                onClick={() => setNotifOpen((prev) => !prev)}
                style={{
                  position: 'relative',
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  background: notifOpen ? '#f4f4f5' : '#ffffff',
                  border: '1px solid #e4e4e7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.18s ease',
                }}
              >
                <Bell size={15} color="#09090b" />
                {telemetry.totalPending > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '1px',
                      background: '#09090b',
                    }}
                  />
                )}
              </button>

              {notifOpen && (
                <div
                  data-lenis-prevent
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 'min(340px, 88vw)',
                    background: '#ffffff',
                    border: '1px solid #09090b',
                    borderRadius: '8px',
                    boxShadow: '0 24px 48px -12px rgba(9, 9, 11, 0.16)',
                    padding: '0.9rem',
                    zIndex: 80,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', marginBottom: '0.6rem', borderBottom: '1px solid #e4e4e7' }}>
                    <strong style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--ent-mono)', color: '#09090b' }}>
                      TELEMETRI ANTREAN
                    </strong>
                    <span className="ent-badge">{telemetry.totalPending} PENDING</span>
                  </div>

                  {isSuperadminPrp && (
                    <Link
                      to="/internal/admin/governance?tab=submissions"
                      onClick={() => setNotifOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.7rem',
                        borderRadius: '6px',
                        background: '#fafafa',
                        border: '1px solid #e4e4e7',
                        textDecoration: 'none',
                        color: '#09090b',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        marginBottom: '0.6rem',
                      }}
                    >
                      <span>{telemetry.kpiPending} KPI · {telemetry.ikuPending} IKU menunggu review</span>
                      <ArrowUpRight size={13} />
                    </Link>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {telemetry.recentAudit.length > 0 ? (
                      telemetry.recentAudit.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: '0.45rem 0.55rem',
                            borderLeft: '2px solid #09090b',
                            background: '#fafafa',
                            fontSize: '0.7rem',
                          }}
                        >
                          <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.62rem', fontWeight: 700, color: '#09090b' }}>
                            {item.action}
                          </div>
                          <div style={{ color: '#52525b', fontSize: '0.66rem', marginTop: '2px' }}>{item.detail}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '0.75rem 0.25rem', color: '#71717a', fontSize: '0.72rem', textAlign: 'center' }}>
                        Belum ada aktivitas baru pada sesi ini.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Clean Architectural User Identity */}
            <Link
              to="/internal/profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                height: '34px',
                padding: '0 0.65rem 0 0.35rem',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #e4e4e7',
                textDecoration: 'none',
                transition: 'border-color 0.18s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#09090b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e4e4e7';
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  background: '#09090b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.62rem',
                  fontFamily: 'var(--ent-mono)',
                }}
              >
                {currentUser.avatar}
              </div>
              <span
                style={{
                  display: windowWidth <= 600 ? 'none' : 'block',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  color: '#09090b',
                }}
              >
                {currentUser.name}
              </span>
            </Link>
          </div>

          {/* Route Kinetic Laser Sweep + Scroll Progress Hairline */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: -1,
              height: '2px',
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            <div
              ref={scrollProgressRef}
              style={{
                position: 'absolute',
                inset: 0,
                background: '#09090b',
                transformOrigin: 'left center',
                transform: 'scaleX(0)',
              }}
            />
            <div
              ref={routeLaserRef}
              style={{
                position: 'absolute',
                inset: 0,
                background: '#09090b',
                transformOrigin: 'left center',
                transform: 'scaleX(0)',
                opacity: 0,
              }}
            />
          </div>
        </header>

        {/* Scrollable Pure White Canvas */}
        <div
          className="internal-main-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            height: 'calc(100vh - 58px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 'clamp(1.5rem, 3vw, 2.5rem)',
            overscrollBehavior: 'contain',
            background: '#ffffff',
          }}
          ref={scrollWrapperRef}
        >
          <div ref={scrollContentRef} style={{ maxWidth: '1420px', margin: '0 auto', width: '100%' }}>
            <Outlet />
          </div>
        </div>
      </main>

      {/* ─── 3. COMMAND PALETTE MODAL (Ctrl+K) ─── */}
      {cmdOpen && (
        <div
          onClick={() => setCmdOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 140,
            background: 'rgba(9, 9, 11, 0.38)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '11vh 1rem 2rem',
          }}
        >
          <div
            ref={cmdPanelRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#ffffff',
              border: '1px solid #09090b',
              borderRadius: '8px',
              boxShadow: '0 32px 64px -16px rgba(9, 9, 11, 0.24)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.85rem 1rem',
                borderBottom: '1px solid #e4e4e7',
              }}
            >
              <Search size={16} color="#09090b" />
              <input
                ref={cmdInputRef}
                type="text"
                value={cmdQuery}
                onChange={(e) => {
                  setCmdQuery(e.target.value);
                  setCmdIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCmdIdx((prev) => (commandItems.length ? (prev + 1) % commandItems.length : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCmdIdx((prev) => (commandItems.length ? (prev - 1 + commandItems.length) % commandItems.length : 0));
                  } else if (e.key === 'Enter' && commandItems[cmdIdx]) {
                    e.preventDefault();
                    commandItems[cmdIdx].run();
                    setCmdOpen(false);
                  }
                }}
                placeholder="Ketik modul, kode rute, atau ruang kerja..."
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.86rem',
                  color: '#09090b',
                  background: 'transparent',
                  fontFamily: 'inherit',
                }}
              />
              <kbd className="arch-kbd">ESC</kbd>
            </div>

            <div data-lenis-prevent style={{ maxHeight: '340px', overflowY: 'auto', padding: '0.4rem' }}>
              {commandItems.length ? (
                commandItems.map((item, idx) => {
                  const selected = idx === cmdIdx;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onMouseEnter={() => setCmdIdx(idx)}
                      onClick={() => {
                        item.run();
                        setCmdOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.62rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: selected ? '#09090b' : 'transparent',
                        color: selected ? '#ffffff' : '#09090b',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <span
                          style={{
                            fontFamily: 'var(--ent-mono)',
                            fontSize: '0.64rem',
                            color: selected ? '#a1a1aa' : '#71717a',
                            minWidth: '52px',
                          }}
                        >
                          {item.code}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.label}</span>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.6rem',
                          color: selected ? '#d4d4d8' : '#71717a',
                        }}
                      >
                        {item.group}
                        {selected && <CornerDownLeft size={12} />}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#71717a', fontSize: '0.8rem' }}>
                  Tidak ada modul yang cocok dengan pencarian Anda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. MODAL ISOLASI AKSES ─── */}
      {blockedModalInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 130,
            background: 'rgba(9, 9, 11, 0.42)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #09090b',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '460px',
              padding: '1.85rem',
              color: '#09090b',
            }}
          >
            <div className="ent-eyebrow" style={{ marginBottom: '0.9rem' }}>
              <Lock size={11} /> {blockedModalInfo.code}
            </div>

            <h3
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 800,
                margin: '0 0 0.55rem',
                color: '#09090b',
                letterSpacing: '-0.03em',
              }}
            >
              {blockedModalInfo.title}
            </h3>

            <p style={{ color: '#52525b', fontSize: '0.84rem', lineHeight: 1.65, margin: '0 0 1.15rem' }}>
              {blockedModalInfo.message}
            </p>

            <div
              style={{
                padding: '0.8rem 0.95rem',
                borderLeft: '2px solid #09090b',
                background: '#fafafa',
                fontSize: '0.76rem',
                color: '#27272a',
                lineHeight: 1.55,
                marginBottom: '1.4rem',
              }}
            >
              <strong>Prosedur Lintas Modul:</strong> {blockedModalInfo.allowedAction}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setBlockedModalInfo(null)}
                className="ent-btn ent-btn-primary"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .arch-cmd-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.46rem 0.65rem;
          border-radius: 6px;
          background: #ffffff;
          border: 1px solid #e4e4e7;
          font-size: 0.75rem;
          cursor: pointer;
          transition: border-color 0.18s ease;
        }
        .arch-cmd-trigger:hover {
          border-color: #09090b;
        }
        .arch-kbd {
          font-family: var(--ent-mono);
          font-size: 0.58rem;
          font-weight: 600;
          padding: 2px 5px;
          border-radius: 3px;
          background: #fafafa;
          border: 1px solid #e4e4e7;
          color: #52525b;
        }
        .corp-nav-section-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--ent-mono);
          font-size: 0.58rem;
          font-weight: 600;
          color: #71717a;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          padding: 0 0.6rem 0.4rem;
        }
        .corp-nav-ul {
          display: flex;
          flex-direction: column;
          gap: 2px;
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .corp-parent-hub-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.62rem;
          padding: 0.52rem 0.68rem;
          border: none;
          background: transparent;
          color: #27272a;
          font-size: 0.81rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: color 0.18s ease;
        }
        .corp-parent-hub-btn.hub-active {
          color: #09090b;
          font-weight: 700;
        }
        .corp-tree-row {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.44rem 0.6rem;
          border-radius: 6px;
          text-decoration: none;
          font-size: 0.77rem;
          font-weight: 500;
          color: #52525b;
          transition: color 0.18s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .corp-tree-row:hover {
          color: #09090b;
        }
        .corp-tree-row.active {
          color: #09090b;
          font-weight: 700;
        }
        .corp-tree-idx {
          font-family: var(--ent-mono);
          font-size: 0.62rem;
          color: #a1a1aa;
          font-weight: 600;
          min-width: 16px;
        }
        .corp-tree-row.active .corp-tree-idx {
          color: #09090b;
          font-weight: 700;
        }
        .corp-nav-item {
          width: 100%;
          text-align: left;
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.62rem;
          padding: 0.5rem 0.68rem;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #52525b;
          font-size: 0.8rem;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.18s ease;
        }
        .corp-nav-item:hover {
          color: #09090b;
        }
        .corp-nav-item.active {
          color: #09090b;
          font-weight: 700;
        }
        .corp-item-icon {
          flex-shrink: 0;
          color: #71717a;
          transition: color 0.18s ease;
        }
        .corp-nav-item:hover .corp-item-icon,
        .corp-nav-item.active .corp-item-icon {
          color: #09090b;
        }
        .corp-nav-counter {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 17px;
          padding: 0 5px;
          border-radius: 3px;
          background: #09090b;
          color: #ffffff;
          font-family: var(--ent-mono);
          font-size: 0.6rem;
          font-weight: 700;
        }
        .corp-nav-locked {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.48rem 0.68rem;
          border-radius: 6px;
          border: 1px dashed #d4d4d8;
          background: transparent;
          color: #a1a1aa;
          font-size: 0.77rem;
          cursor: not-allowed;
        }
        .corp-footer-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.4rem;
          padding: 0.48rem 0.65rem;
          border-radius: 6px;
          background: #fafafa;
          border: 1px solid #e4e4e7;
          color: #27272a;
          text-decoration: none;
          font-size: 0.73rem;
          font-weight: 600;
          transition: border-color 0.18s ease, color 0.18s ease;
        }
        .corp-footer-link:hover {
          border-color: #09090b;
          color: #09090b;
        }
        .corp-logout-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.48rem 0.7rem;
          border: 1px solid #e4e4e7;
          background: #ffffff;
          color: #27272a;
          font-weight: 600;
          font-size: 0.73rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .corp-logout-btn:hover {
          background: #09090b;
          border-color: #09090b;
          color: #ffffff;
        }
        .glass-panel {
          position: relative;
          background: #ffffff;
          border: 1px solid #e4e4e7;
          border-radius: 8px;
          overflow: hidden;
          color: #09090b;
          transition: border-color 0.22s ease, transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-panel:hover {
          border-color: #09090b;
        }
        .glass-panel-content {
          position: relative;
          z-index: 5;
        }
        html:has(.internal-wrapper),
        body:has(.internal-wrapper) {
          overflow: hidden !important;
          height: 100% !important;
          max-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .internal-main-scroll::-webkit-scrollbar,
        .corp-sidebar nav::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .internal-main-scroll::-webkit-scrollbar-track,
        .corp-sidebar nav::-webkit-scrollbar-track {
          background: transparent;
        }
        .internal-main-scroll::-webkit-scrollbar-thumb,
        .corp-sidebar nav::-webkit-scrollbar-thumb {
          background: #d4d4d8;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
