import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  LogOut,
  Menu,
  X,
  FileText,
  ShieldCheck,
  Bell,
  ArrowUpRight,
  Layers,
  Building2,
  Lock,
  ChevronDown,
  ChevronRight,
  Search,
  CornerDownLeft,
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
  const blockedCloseBtnRef = useRef(null);

  // Smooth scroll Lenis + sinkron ScrollTrigger pada area konten internal
  useEffect(() => mountSmoothScroll(scrollWrapperRef.current, scrollContentRef.current), [currentUser]);

  // Reset posisi gulir saat pindah rute
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
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(scrollProgressRef.current, { scaleX: ratio });
      } else {
        gsap.to(scrollProgressRef.current, { scaleX: ratio, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
      }
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

  // Global Keyboard Shortcut Ctrl+K / Meta+K & Escape untuk semua dialog/drawer
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
        setBlockedModalInfo(null);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Fokus otomatis saat Command Palette dibuka
  useEffect(() => {
    if (!cmdOpen) return;
    requestAnimationFrame(() => {
      cmdInputRef.current?.focus();
      if (cmdPanelRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.fromTo(
          cmdPanelRef.current,
          { y: -14, opacity: 0, scale: 0.99 },
          { y: 0, opacity: 1, scale: 1, duration: 0.28, ease: 'expo.out' }
        );
      }
    });
  }, [cmdOpen]);

  // Fokus otomatis ke tombol tutup saat Modal Isolasi Akses muncul
  useEffect(() => {
    if (!blockedModalInfo) return;
    requestAnimationFrame(() => {
      blockedCloseBtnRef.current?.focus();
    });
  }, [blockedModalInfo]);

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
  const showIKU = !showPRP && !isKpiOnly && activeContext === 'iku';
  const showKPI = !showPRP && !isIkuOnly && activeContext === 'kpi';

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
    } catch {
      /* fallback */
    }
    try {
      if (['iku_only', 'superadmin_prp'].includes(currentUser.role)) {
        const iku = listIkuSubmissions(currentUser);
        ikuPending = iku.filter((r) => r.status === 'SUBMITTED').length;
      }
    } catch {
      /* fallback */
    }
    try {
      recentAudit = readAudit().slice(0, 4);
    } catch {
      /* fallback */
    }
    return {
      kpiPending,
      ikuPending,
      totalPending: kpiPending + ikuPending,
      recentAudit,
    };
  }, [currentUser, telemetryTick]);

  // Sinkronisasi Posisi Indikator Aktif di Sidebar
  const syncActiveLaser = useCallback(() => {
    const navEl = navScrollRef.current;
    const laserEl = activeLaserRef.current;
    if (!navEl || !laserEl) return;
    const activeNode = navEl.querySelector('[data-nav-active="true"]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!activeNode) {
      gsap.to(laserEl, { opacity: 0, duration: reduced ? 0 : 0.2 });
      return;
    }
    const navRect = navEl.getBoundingClientRect();
    const itemRect = activeNode.getBoundingClientRect();
    const top = itemRect.top - navRect.top + navEl.scrollTop;
    gsap.to(laserEl, {
      y: top + 6,
      height: Math.max(16, itemRect.height - 12),
      opacity: 1,
      duration: reduced ? 0 : 0.4,
      ease: 'expo.out',
      overwrite: 'auto',
    });
  }, []);

  // Hover Follower (khusus perangkat pointer presisi)
  const handleNavItemEnter = useCallback((e) => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const navEl = navScrollRef.current;
    const follower = hoverFollowerRef.current;
    if (!navEl || !follower) return;
    const navRect = navEl.getBoundingClientRect();
    const itemRect = e.currentTarget.getBoundingClientRect();
    const top = itemRect.top - navRect.top + navEl.scrollTop;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.to(follower, {
      y: top,
      height: itemRect.height,
      opacity: 1,
      duration: reduced ? 0 : 0.24,
      ease: 'expo.out',
      overwrite: 'auto',
    });
  }, []);

  const handleNavLeave = useCallback(() => {
    if (hoverFollowerRef.current) {
      gsap.to(hoverFollowerRef.current, { opacity: 0, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
    }
  }, []);

  // 1. Entrance Choreography saat Sesi Dimuat
  useGSAP(() => {
    if (!currentUser) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo(
      '.sidebar-stagger',
      { x: -16, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.65, stagger: 0.04, clearProps: 'transform' }
    ).fromTo(
      '.header-stagger',
      { y: -12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.55, clearProps: 'transform' },
      '-=0.5'
    );
  }, { dependencies: [currentUser?.id], scope: layoutRef });

  // 2. Animasi Workspace Switcher Pill & Konteks Menu
  useGSAP(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isDual && switcherPillRef.current) {
      gsap.to(switcherPillRef.current, {
        xPercent: isSuperadminPrp
          ? activeContext === 'prp'
            ? 0
            : activeContext === 'kpi'
              ? 200
              : 100
          : effectiveWorkspace === 'kpi'
            ? 100
            : 0,
        duration: reduced ? 0 : 0.45,
        ease: 'expo.out',
      });
    }
    if (reduced) {
      requestAnimationFrame(syncActiveLaser);
      return undefined;
    }
    gsap.fromTo(
      '.nav-context-item',
      { x: -10, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: 0.42,
        stagger: 0.035,
        ease: 'expo.out',
        overwrite: 'auto',
        clearProps: 'transform',
        onComplete: syncActiveLaser,
      }
    );
  }, { dependencies: [effectiveWorkspace, activeContext, isDual, isSuperadminPrp], scope: layoutRef });

  // 3. Animasi Accordion Submenu PRP Control Center
  useGSAP(() => {
    if (!showPRP) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prpChevronRef.current) {
      gsap.to(prpChevronRef.current, {
        rotate: prpTreeOpen ? 0 : -90,
        duration: reduced ? 0 : 0.3,
        ease: 'expo.out',
      });
    }
    if (prpSubmenuRef.current) {
      if (prpTreeOpen) {
        if (reduced) {
          gsap.set(prpSubmenuRef.current, { height: 'auto', opacity: 1 });
          requestAnimationFrame(syncActiveLaser);
          return undefined;
        }
        gsap.fromTo(
          prpSubmenuRef.current,
          { height: 0, opacity: 0 },
          {
            height: 'auto',
            opacity: 1,
            duration: 0.4,
            ease: 'expo.out',
            overwrite: 'auto',
            onComplete: syncActiveLaser,
          }
        );
        if (prpSpineRef.current) {
          gsap.fromTo(
            prpSpineRef.current,
            { scaleY: 0 },
            { scaleY: 1, transformOrigin: 'top center', duration: 0.5, ease: 'expo.out', delay: 0.03 }
          );
        }
        gsap.fromTo(
          '.prp-tree-item',
          { x: -10, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.36,
            stagger: 0.028,
            ease: 'expo.out',
            delay: 0.04,
            overwrite: 'auto',
            clearProps: 'transform',
          }
        );
      } else {
        gsap.to(prpSubmenuRef.current, {
          height: 0,
          opacity: 0,
          duration: reduced ? 0 : 0.28,
          ease: 'power3.inOut',
          overwrite: 'auto',
          onComplete: syncActiveLaser,
        });
      }
    }
  }, { dependencies: [prpTreeOpen, showPRP], scope: layoutRef });

  // 4. Transisi Rute & Konteks Halaman
  useGSAP(() => {
    requestAnimationFrame(syncActiveLaser);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ScrollTrigger.refresh();
      return undefined;
    }

    if (routeLaserRef.current) {
      const laserTl = gsap.timeline();
      laserTl
        .set(routeLaserRef.current, { transformOrigin: 'left center', scaleX: 0, opacity: 1 })
        .to(routeLaserRef.current, { scaleX: 1, duration: 0.3, ease: 'expo.out' })
        .set(routeLaserRef.current, { transformOrigin: 'right center' })
        .to(routeLaserRef.current, { scaleX: 0, opacity: 0, duration: 0.34, ease: 'power3.inOut' });
    }

    if (scrollContentRef.current) {
      gsap.fromTo(
        scrollContentRef.current,
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.48,
          ease: 'expo.out',
          clearProps: 'transform',
          onComplete: () => ScrollTrigger.refresh(),
        }
      );
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

  const handleSelectWorkspaceMenu = useCallback(
    (targetWorkspace) => {
      if (isDual) {
        switchWorkspace(targetWorkspace);
      }
      if (windowWidth <= 920) setSidebarOpen(false);
      if (location.pathname !== '/internal') {
        navigate('/internal');
      }
    },
    [isDual, switchWorkspace, windowWidth, location.pathname, navigate]
  );

  const handleSelectPRP = useCallback(() => {
    enterPRP();
    if (windowWidth <= 920) setSidebarOpen(false);
    navigate('/internal/admin');
  }, [enterPRP, windowWidth, navigate]);

  // Daftar Perintah untuk Command Palette (Ctrl+K) sesuai isolasi peran aktif
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
        { code: 'DIR.01', group: 'Direktori', label: 'Manajemen Pengguna & Hak Akses', run: () => navigate('/internal/users') }
      );
    }
    if (!isKpiOnly) {
      list.push({
        code: 'IKU.00',
        group: 'Ruang Kerja 8 IKU',
        label: 'Dashboard Capaian 8 IKU Kementerian',
        run: () => handleSelectWorkspaceMenu('iku'),
      });
      if (isIkuOnly || isSuperadminPrp) {
        list.push({
          code: 'IKU.01',
          group: 'Ruang Kerja 8 IKU',
          label: 'Submission & Verifikasi Bukti 8 IKU',
          run: () => navigate('/internal/iku-submissions'),
        });
      }
    }
    if (!isIkuOnly) {
      list.push({
        code: 'KPI.00',
        group: 'Ruang Kerja KPI',
        label: 'Lembar Kerja KPI Operasional Unit',
        run: () => handleSelectWorkspaceMenu('kpi'),
      });
    }
    list.push(
      { code: 'ORG.01', group: 'Organisasi', label: 'Struktur Organisasi & Unit PIC', run: () => navigate('/internal/team') },
      { code: 'DOC.01', group: 'Referensi', label: 'Dokumen & Regulasi Resmi', run: () => navigate('/internal/documents') },
      { code: 'USR.01', group: 'Akun', label: 'Profil & Keamanan Sesi Saya', run: () => navigate('/internal/profile') },
      { code: 'PUB.01', group: 'Eksternal', label: 'Buka Beranda Publik ITPLN', run: () => navigate('/') }
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
        code: '403 // OTORITAS KHUSUS IKU',
        title: 'Akses Dibatasi: Otoritas Khusus IKU',
        message:
          'Akun Anda terdaftar dengan hak akses khusus 8 Indikator Kinerja Utama (Kemendikbudristek). Modul KPI internal unit dan fakultas tidak termasuk dalam cakupan peran sesi ini.',
        allowedAction:
          'Gunakan akun Superadmin PRP (admin@itpln.ac.id) pada halaman masuk untuk mengakses dan berpindah antara modul IKU serta KPI.',
      });
    } else if (isKpiOnly && targetFeature === 'iku') {
      setBlockedModalInfo({
        code: '403 // OTORITAS KHUSUS KPI',
        title: 'Akses Dibatasi: Otoritas Khusus KPI',
        message:
          'Akun Anda terdaftar dengan hak akses operasional Key Performance Indicator (Unit & Fakultas). Modul 8 IKU Kementerian tidak termasuk dalam cakupan peran sesi ini.',
        allowedAction:
          'Gunakan akun Superadmin PRP (admin@itpln.ac.id) pada halaman masuk untuk mengakses dan berpindah antara modul IKU serta KPI.',
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
        width: '100%',
        height: '100dvh',
        background: '#ffffff',
        overflow: 'hidden',
        color: '#072534',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        zIndex: 1,
      }}
    >
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 44, 61, 0.48)',
            zIndex: 40,
          }}
        />
      )}

      {/* ─── 1. SIDEBAR NAVIGASI INTERNAL ITPLN ─── */}
      <aside
        aria-label="Navigasi ruang kerja internal"
        className={`corp-sidebar ${sidebarOpen ? 'open' : ''}`}
        style={{
          width: '284px',
          minWidth: '284px',
          maxWidth: '284px',
          flexShrink: 0,
          background: '#F7FAFB',
          borderRight: '1px solid #D8E4EA',
          display: 'flex',
          flexDirection: 'column',
          position: isMobile ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          height: '100dvh',
          zIndex: 50,
          overflow: 'hidden',
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.34s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Brand Header */}
        <div
          className="sidebar-stagger"
          style={{
            height: '60px',
            padding: '0 1.1rem',
            borderBottom: '1px solid #D8E4EA',
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.68rem',
              textDecoration: 'none',
              minHeight: '44px',
            }}
          >
            <img src="/logo_pln.png" alt="Logo ITPLN" style={{ height: '26px', width: 'auto' }} />
            <div style={{ width: '1px', height: '18px', background: '#D8E4EA' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
              <span
                style={{
                  fontSize: '0.94rem',
                  fontWeight: 800,
                  color: '#072534',
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '-0.03em',
                }}
              >
                PERFORMA
              </span>
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  color: '#0E7480',
                  letterSpacing: '0.06em',
                }}
              >
                ITPLN
              </span>
            </div>
          </Link>

          {isMobile && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Tutup navigasi"
              style={{
                background: '#ffffff',
                border: '1px solid #D8E4EA',
                borderRadius: '8px',
                width: '44px',
                height: '44px',
                display: 'grid',
                placeItems: 'center',
                color: '#072534',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Quick Command Trigger + Workspace Switcher */}
        <div
          className="sidebar-stagger"
          style={{
            padding: '0.85rem 0.95rem',
            borderBottom: '1px solid #D8E4EA',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.7rem',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setCmdQuery('');
              setCmdIdx(0);
              setCmdOpen(true);
            }}
            className="arch-cmd-trigger"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#334155' }}>
              <Search size={14} strokeWidth={2} color="#0E7480" />
              <span>Navigasi cepat...</span>
            </span>
            <kbd className="arch-kbd">Ctrl K</kbd>
          </button>

          {/* Segmented Switcher */}
          {isDual ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.38rem',
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.6rem',
                  color: '#475569',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                <span>KONTEKS OTORITAS</span>
                <span style={{ color: '#094E68', fontWeight: 700 }}>
                  {isSuperadminPrp ? 'PRP // PENUH' : 'DUAL'}
                </span>
              </div>
              <div
                role="group"
                aria-label="Pemilih konteks ruang kerja"
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: isSuperadminPrp ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                  background: '#EDF3F6',
                  border: '1px solid #D8E4EA',
                  padding: '3px',
                  borderRadius: '8px',
                }}
              >
                <div
                  ref={switcherPillRef}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '3px',
                    bottom: '3px',
                    left: '3px',
                    width: isSuperadminPrp ? 'calc((100% - 6px) / 3)' : 'calc((100% - 6px) / 2)',
                    background: '#094E68',
                    borderRadius: '6px',
                    zIndex: 1,
                  }}
                />
                {isSuperadminPrp && (
                  <button
                    type="button"
                    aria-pressed={activeContext === 'prp'}
                    onClick={handleSelectPRP}
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      minHeight: isMobile ? '40px' : '34px',
                      padding: '5px 4px',
                      border: 'none',
                      borderRadius: '6px',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      color: activeContext === 'prp' ? '#ffffff' : '#334155',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    PRP
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={activeContext === 'iku'}
                  onClick={() => handleSelectWorkspaceMenu('iku')}
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    minHeight: isMobile ? '40px' : '34px',
                    padding: '5px 4px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: activeContext === 'iku' ? '#ffffff' : '#334155',
                    transition: 'color 0.2s ease',
                  }}
                >
                  01·IKU
                </button>
                <button
                  type="button"
                  aria-pressed={activeContext === 'kpi'}
                  onClick={() => handleSelectWorkspaceMenu('kpi')}
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    minHeight: isMobile ? '40px' : '34px',
                    padding: '5px 4px',
                    border: 'none',
                    borderRadius: '6px',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--ent-mono)',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    color: activeContext === 'kpi' ? '#ffffff' : '#334155',
                    transition: 'color 0.2s ease',
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
                padding: '0.5rem 0.7rem',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #D8E4EA',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.65rem',
              }}
            >
              <span style={{ color: '#334155', fontWeight: 600 }}>{currentUser.roleTitle}</span>
              <span style={{ fontWeight: 700, color: '#094E68' }}>{isIkuOnly ? '[IKU]' : '[KPI]'}</span>
            </div>
          )}
        </div>

        {/* Navigation Ledger */}
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
          {/* Hover Follower */}
          <div
            ref={hoverFollowerRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '0.75rem',
              right: '0.75rem',
              top: 0,
              height: '36px',
              borderRadius: '6px',
              background: '#EDF3F6',
              opacity: 0,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Sliding Active Prussian Petrol Bar */}
          <div
            ref={activeLaserRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: 0,
              width: '3px',
              height: '22px',
              background: '#094E68',
              borderRadius: '2px',
              opacity: 0,
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
            {/* ═══ KONTEKS 1: SUPERADMIN PRP CONTROL CENTER ═══ */}
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
                    aria-expanded={prpTreeOpen}
                    aria-controls="prp-submenu-tree"
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
                    <span ref={prpChevronRef} style={{ display: 'inline-flex', color: '#475569' }}>
                      <ChevronDown size={14} />
                    </span>
                  </button>

                  {/* Collapsible Indented Tree Ledger */}
                  <div id="prp-submenu-tree" ref={prpSubmenuRef} style={{ overflow: 'hidden' }}>
                    <div style={{ position: 'relative', marginLeft: '1.05rem', paddingLeft: '0.85rem', marginTop: '0.2rem' }}>
                      <div
                        ref={prpSpineRef}
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '4px',
                          bottom: '4px',
                          width: '1.5px',
                          background: '#D8E4EA',
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
                              {sub.badge && <span className="corp-nav-counter">{sub.badge}</span>}
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
                    <span>02 // OPERASIONAL &amp; DIREKTORI</span>
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
                        {telemetry.ikuPending > 0 && <span className="corp-nav-counter">{telemetry.ikuPending}</span>}
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
                        <span>Organisasi &amp; Unit PIC</span>
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
                      <span>Struktur &amp; PIC IKU</span>
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
                      <span>Dokumen &amp; Regulasi</span>
                    </Link>
                  </li>
                </ul>

                {isIkuOnly && (
                  <div style={{ marginTop: '1.15rem' }}>
                    <div className="corp-nav-section-label">
                      <span>ISOLASI PERAN</span>
                      <span>[TERKUNCI]</span>
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
                      <Lock size={13} />
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
                      <span>Struktur Unit &amp; PIC</span>
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
                      <span>Panduan &amp; Referensi</span>
                    </Link>
                  </li>
                </ul>

                {isKpiOnly && (
                  <div style={{ marginTop: '1.15rem' }}>
                    <div className="corp-nav-section-label">
                      <span>ISOLASI PERAN</span>
                      <span>[TERKUNCI]</span>
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
                      <Lock size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ═══ IDENTITAS & SESI (SELALU TERSEDIA) ═══ */}
            <div className="sidebar-stagger">
              <div className="corp-nav-section-label">
                <span>AKUN &amp; SESI</span>
                <span>[AKTIF]</span>
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

        {/* Sidebar Footer */}
        <div
          style={{
            padding: '0.75rem 0.85rem',
            borderTop: '1px solid #D8E4EA',
            background: '#ffffff',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '0.5rem',
            flexShrink: 0,
          }}
        >
          <Link to="/" className="corp-footer-link">
            <span>Portal Publik</span>
            <ArrowUpRight size={14} />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title="Keluar Sesi"
            className="corp-logout-btn"
          >
            <LogOut size={14} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* ─── 2. MAIN WORKSPACE AREA ─── */}
      <main
        style={{
          flex: 1,
          height: '100dvh',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 10,
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        {/* Top Header (60px, Solid Clean Surface) */}
        <header
          className="header-stagger"
          style={{
            position: 'relative',
            height: '60px',
            flexShrink: 0,
            background: '#ffffff',
            padding: '0 clamp(0.9rem, 2.5vw, 2.25rem)',
            borderBottom: '1px solid #D8E4EA',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            zIndex: 30,
          }}
        >
          {/* Left: Hamburger + Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
            {isMobile && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Buka navigasi"
                style={{
                  background: '#F7FAFB',
                  border: '1px solid #D8E4EA',
                  borderRadius: '8px',
                  width: '44px',
                  height: '44px',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#072534',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <Menu size={19} />
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0, overflow: 'hidden' }}>
              <span
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: '4px',
                  background: '#094E68',
                  color: '#ffffff',
                  letterSpacing: '0.06em',
                  flexShrink: 0,
                }}
              >
                {breadcrumb.code}
              </span>
              {windowWidth > 640 && (
                <>
                  <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {breadcrumb.group}
                  </span>
                  <ChevronRight size={14} color="#475569" style={{ flexShrink: 0 }} />
                </>
              )}
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#072534',
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

          {/* Right: Activity Bell + User Session Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                type="button"
                aria-label="Log aktivitas dan antrean review"
                aria-expanded={notifOpen}
                aria-haspopup="dialog"
                onClick={() => setNotifOpen((prev) => !prev)}
                style={{
                  position: 'relative',
                  width: isMobile ? '44px' : '38px',
                  height: isMobile ? '44px' : '38px',
                  borderRadius: '8px',
                  background: notifOpen ? '#EDF3F6' : '#ffffff',
                  border: '1px solid #D8E4EA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.18s ease, background-color 0.18s ease',
                }}
              >
                <Bell size={16} color="#072534" />
                {telemetry.totalPending > 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '7px',
                      right: '7px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#0E7480',
                    }}
                  />
                )}
              </button>

              {notifOpen && (
                <div
                  role="dialog"
                  aria-label="Ringkasan antrean dan aktivitas"
                  data-lenis-prevent
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 'min(340px, 88vw)',
                    background: '#ffffff',
                    border: '1px solid #094E68',
                    borderRadius: '10px',
                    boxShadow: '0 20px 44px -12px rgba(7, 37, 52, 0.18)',
                    padding: '0.95rem',
                    zIndex: 80,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: '0.6rem',
                      marginBottom: '0.65rem',
                      borderBottom: '1px solid #D8E4EA',
                    }}
                  >
                    <strong
                      style={{
                        fontSize: '0.74rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontFamily: 'var(--ent-mono)',
                        color: '#072534',
                      }}
                    >
                      ANTREAN &amp; AKTIVITAS
                    </strong>
                    <span className="ent-badge ent-badge-info">{telemetry.totalPending} MENUNGGU</span>
                  </div>

                  {isSuperadminPrp && (
                    <Link
                      to="/internal/admin/governance?tab=submissions"
                      onClick={() => setNotifOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: '42px',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '8px',
                        background: '#F7FAFB',
                        border: '1px solid #D8E4EA',
                        textDecoration: 'none',
                        color: '#094E68',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        marginBottom: '0.65rem',
                      }}
                    >
                      <span>
                        {telemetry.kpiPending} KPI · {telemetry.ikuPending} IKU menunggu review
                      </span>
                      <ArrowUpRight size={14} />
                    </Link>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {telemetry.recentAudit.length > 0 ? (
                      telemetry.recentAudit.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: '0.5rem 0.6rem',
                            borderLeft: '2.5px solid #094E68',
                            background: '#F7FAFB',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.72rem',
                          }}
                        >
                          <div style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.64rem', fontWeight: 700, color: '#072534' }}>
                            {item.action}
                          </div>
                          <div style={{ color: '#334155', fontSize: '0.7rem', marginTop: '2px' }}>{item.detail}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '0.85rem 0.25rem', color: '#475569', fontSize: '0.76rem', textAlign: 'center' }}>
                        Belum ada aktivitas baru pada sesi ini.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Session Identity */}
            <Link
              to="/internal/profile"
              aria-label={`Profil pengguna ${currentUser.name}`}
              className="corp-profile-chip"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                minWidth: isMobile ? '44px' : 'auto',
                height: isMobile ? '44px' : '38px',
                padding: isMobile && windowWidth <= 600 ? '0 0.55rem' : '0 0.7rem 0 0.4rem',
                justifyContent: 'center',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #D8E4EA',
                textDecoration: 'none',
                transition: 'border-color 0.18s ease, background-color 0.18s ease',
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '5px',
                  background: '#094E68',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.62rem',
                  fontFamily: 'var(--ent-mono)',
                  flexShrink: 0,
                }}
              >
                {currentUser.avatar}
              </div>
              <span
                style={{
                  display: windowWidth <= 600 ? 'none' : 'block',
                  fontWeight: 600,
                  fontSize: '0.76rem',
                  color: '#072534',
                }}
              >
                {currentUser.name}
              </span>
            </Link>
          </div>

          {/* Route Sweep + Scroll Progress Hairline */}
          <div
            aria-hidden="true"
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
                background: '#0E7480',
                transformOrigin: 'left center',
                transform: 'scaleX(0)',
              }}
            />
            <div
              ref={routeLaserRef}
              style={{
                position: 'absolute',
                inset: 0,
                background: '#094E68',
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
            height: 'calc(100dvh - 60px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 'clamp(1.25rem, 3vw, 2.5rem)',
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
            background: 'rgba(6, 44, 61, 0.48)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '10dvh 1rem 2rem',
          }}
        >
          <div
            ref={cmdPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigasi cepat modul"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#ffffff',
              border: '1px solid #094E68',
              borderRadius: '10px',
              boxShadow: '0 28px 56px -14px rgba(7, 37, 52, 0.24)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.85rem 1rem',
                borderBottom: '1px solid #D8E4EA',
              }}
            >
              <Search size={17} color="#0E7480" aria-hidden="true" />
              <label
                htmlFor="cmd-palette-input"
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                }}
              >
                Cari modul atau ruang kerja
              </label>
              <input
                id="cmd-palette-input"
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
                className="cmd-palette-field"
                style={{
                  flex: 1,
                  border: 'none',
                  fontSize: '0.88rem',
                  color: '#072534',
                  background: 'transparent',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="arch-kbd"
                style={{ cursor: 'pointer', minHeight: '28px' }}
              >
                ESC
              </button>
            </div>

            <div data-lenis-prevent style={{ maxHeight: '340px', overflowY: 'auto', padding: '0.45rem' }}>
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
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.62rem 0.8rem',
                        borderRadius: '7px',
                        border: 'none',
                        background: selected ? '#094E68' : 'transparent',
                        color: selected ? '#ffffff' : '#072534',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <span
                          style={{
                            fontFamily: 'var(--ent-mono)',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: selected ? '#C5DEE8' : '#0E7480',
                            minWidth: '52px',
                          }}
                        >
                          {item.code}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.label}</span>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontFamily: 'var(--ent-mono)',
                          fontSize: '0.62rem',
                          color: selected ? '#C5DEE8' : '#475569',
                          flexShrink: 0,
                        }}
                      >
                        {item.group}
                        {selected && <CornerDownLeft size={12} />}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#475569', fontSize: '0.84rem' }}>
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
          onClick={() => setBlockedModalInfo(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 130,
            background: 'rgba(6, 44, 61, 0.48)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="blocked-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              border: '1px solid #094E68',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '460px',
              padding: '1.85rem',
              color: '#072534',
              boxShadow: '0 24px 48px -12px rgba(7, 37, 52, 0.24)',
            }}
          >
            <div className="ent-eyebrow" style={{ marginBottom: '0.85rem' }}>
              <Lock size={12} /> {blockedModalInfo.code}
            </div>

            <h2
              id="blocked-modal-title"
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 800,
                margin: '0 0 0.55rem',
                color: '#072534',
                letterSpacing: '-0.025em',
              }}
            >
              {blockedModalInfo.title}
            </h2>

            <p style={{ color: '#334155', fontSize: '0.86rem', lineHeight: 1.65, margin: '0 0 1.15rem' }}>
              {blockedModalInfo.message}
            </p>

            <div
              style={{
                padding: '0.85rem 1rem',
                borderLeft: '2.5px solid #094E68',
                background: '#F7FAFB',
                borderRadius: '0 6px 6px 0',
                fontSize: '0.78rem',
                color: '#334155',
                lineHeight: 1.55,
                marginBottom: '1.4rem',
              }}
            >
              <strong style={{ color: '#072534' }}>Prosedur Lintas Modul:</strong> {blockedModalInfo.allowedAction}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                ref={blockedCloseBtnRef}
                type="button"
                onClick={() => setBlockedModalInfo(null)}
                className="ent-btn ent-btn-primary"
                style={{ minHeight: '44px' }}
              >
                Tutup Dialog
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cmd-palette-field:focus {
          outline: none;
        }
        .cmd-palette-field:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: 2px;
          border-radius: 4px;
        }
        .cmd-palette-field::placeholder {
          color: #64748b;
        }
        .corp-profile-chip:hover {
          border-color: #094E68 !important;
          background: #F7FAFB !important;
        }
        .arch-cmd-trigger {
          width: 100%;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.48rem 0.7rem;
          border-radius: 7px;
          background: #ffffff;
          border: 1px solid #D8E4EA;
          font-size: 0.76rem;
          cursor: pointer;
          transition: border-color 0.18s ease;
        }
        .arch-cmd-trigger:hover {
          border-color: #094E68;
        }
        .arch-kbd {
          font-family: var(--ent-mono);
          font-size: 0.6rem;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          background: #F7FAFB;
          border: 1px solid #D8E4EA;
          color: #475569;
        }
        .corp-nav-section-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: var(--ent-mono);
          font-size: 0.6rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0 0.6rem 0.42rem;
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
          min-height: 40px;
          display: flex;
          align-items: center;
          gap: 0.62rem;
          padding: 0.52rem 0.68rem;
          border: none;
          background: transparent;
          color: #072534;
          font-size: 0.82rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: color 0.18s ease;
        }
        .corp-parent-hub-btn.hub-active {
          color: #094E68;
          font-weight: 700;
        }
        .corp-tree-row {
          position: relative;
          min-height: 38px;
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.46rem 0.6rem;
          border-radius: 6px;
          text-decoration: none;
          font-size: 0.78rem;
          font-weight: 500;
          color: #334155;
          transition: color 0.18s ease;
        }
        .corp-tree-row:hover {
          color: #072534;
        }
        .corp-tree-row.active {
          color: #094E68;
          font-weight: 700;
        }
        .corp-tree-idx {
          font-family: var(--ent-mono);
          font-size: 0.64rem;
          color: #475569;
          font-weight: 600;
          min-width: 18px;
        }
        .corp-tree-row.active .corp-tree-idx {
          color: #0E7480;
          font-weight: 700;
        }
        .corp-nav-item {
          width: 100%;
          min-height: 40px;
          text-align: left;
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.62rem;
          padding: 0.5rem 0.68rem;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: #334155;
          font-size: 0.81rem;
          font-weight: 500;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.18s ease;
        }
        .corp-nav-item:hover {
          color: #072534;
        }
        .corp-nav-item.active {
          color: #094E68;
          font-weight: 700;
        }
        .corp-item-icon {
          flex-shrink: 0;
          color: #475569;
          transition: color 0.18s ease;
        }
        .corp-nav-item:hover .corp-item-icon,
        .corp-nav-item.active .corp-item-icon {
          color: #094E68;
        }
        .corp-nav-counter {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 18px;
          padding: 0 5px;
          border-radius: 4px;
          background: #094E68;
          color: #ffffff;
          font-family: var(--ent-mono);
          font-size: 0.6rem;
          font-weight: 700;
        }
        .corp-nav-locked {
          width: 100%;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.48rem 0.68rem;
          border-radius: 6px;
          border: 1px dashed #94a3b8;
          background: #ffffff;
          color: #475569;
          font-size: 0.77rem;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 0.18s ease, background-color 0.18s ease;
        }
        .corp-nav-locked:hover {
          border-color: #094E68;
          background: #EDF3F6;
          color: #072534;
        }
        .corp-footer-link {
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.4rem;
          padding: 0.48rem 0.7rem;
          border-radius: 6px;
          background: #F7FAFB;
          border: 1px solid #D8E4EA;
          color: #072534;
          text-decoration: none;
          font-size: 0.74rem;
          font-weight: 600;
          transition: border-color 0.18s ease, background-color 0.18s ease;
        }
        .corp-footer-link:hover {
          border-color: #094E68;
          background: #EDF3F6;
        }
        .corp-logout-btn {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.48rem 0.75rem;
          border: 1px solid #D8E4EA;
          background: #ffffff;
          color: #072534;
          font-weight: 600;
          font-size: 0.74rem;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }
        .corp-logout-btn:hover {
          background: #094E68;
          border-color: #094E68;
          color: #ffffff;
        }
        .glass-panel {
          position: relative;
          background: #ffffff;
          border: 1px solid #D8E4EA;
          border-radius: 8px;
          overflow: hidden;
          color: #072534;
          transition: border-color 0.2s ease;
        }
        .glass-panel:hover {
          border-color: #094E68;
        }
        .glass-panel-content {
          position: relative;
          z-index: 5;
        }
        @media (max-width: 920px) {
          .arch-cmd-trigger,
          .corp-parent-hub-btn,
          .corp-tree-row,
          .corp-nav-item,
          .corp-nav-locked,
          .corp-footer-link,
          .corp-logout-btn {
            min-height: 44px;
          }
        }
        html:has(.internal-wrapper),
        body:has(.internal-wrapper) {
          overflow: hidden !important;
          height: 100% !important;
          max-height: 100dvh !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .internal-main-scroll::-webkit-scrollbar,
        .corp-sidebar nav::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .internal-main-scroll::-webkit-scrollbar-track,
        .corp-sidebar nav::-webkit-scrollbar-track {
          background: transparent;
        }
        .internal-main-scroll::-webkit-scrollbar-thumb,
        .corp-sidebar nav::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
