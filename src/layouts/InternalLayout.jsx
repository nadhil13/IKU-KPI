import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCircle, LogOut, Menu, X, FileText,
  ShieldCheck, Bell, ExternalLink, Layers, Building2, Lock, Settings2
} from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../features/auth/context/AuthContext';
import { mountSmoothScroll, getLenis } from '../lib/smoothScroll';

export default function InternalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, activeWorkspace, activeContext, switchWorkspace, enterPRP, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [blockedModalInfo, setBlockedModalInfo] = useState(null);

  const layoutRef = useRef(null);
  const switcherPillRef = useRef(null);
  const scrollWrapperRef = useRef(null);
  const scrollContentRef = useRef(null);

  // Smooth scroll Lenis + sinkron ScrollTrigger pada area konten internal.
  useEffect(() => mountSmoothScroll(scrollWrapperRef.current, scrollContentRef.current), [currentUser]);

  // Kembali ke atas setiap pindah halaman.
  useEffect(() => {
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else if (scrollWrapperRef.current) scrollWrapperRef.current.scrollTop = 0;
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 768) {
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
    setSidebarOpen(false);
  }, [location]);

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

  useGSAP(() => {
    if (!currentUser) return;
    gsap.fromTo(
      '.sidebar-stagger',
      { x: -14, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6, stagger: 0.035, ease: 'expo.out' }
    );
    gsap.fromTo(
      '.header-stagger',
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }
    );
  }, { dependencies: [currentUser?.id], scope: layoutRef });

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
  }, { dependencies: [effectiveWorkspace, activeContext, isDual, isSuperadminPrp], scope: layoutRef });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/internal' && location.pathname === '/internal') return true;
    if (path !== '/internal' && location.pathname.startsWith(path)) return true;
    return false;
  };

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

  const handleSelectWorkspaceMenu = (targetWorkspace) => {
    if (isDual) {
      switchWorkspace(targetWorkspace);
    }
    if (location.pathname !== '/internal') {
      navigate('/internal');
    }
  };

  const handleSelectPRP = () => {
    enterPRP();
    navigate('/internal/admin');
  };

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
        background: '#f8fafc',
        overflow: 'hidden',
        color: '#0f172a',
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
            background: 'rgba(15, 23, 42, 0.25)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
          }}
        />
      )}

      {/* ─── 1. PURE CLEAN SIDEBAR (TANPA BLOK HITAM) ─── */}
      <aside
        className={`corp-sidebar ${sidebarOpen ? 'open' : ''}`}
        style={{
          width: '280px',
          minWidth: '280px',
          maxWidth: '280px',
          flexShrink: 0,
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          position: windowWidth <= 768 ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          height: '100vh',
          zIndex: 50,
          overflow: 'hidden',
          transform:
            windowWidth <= 768
              ? sidebarOpen
                ? 'translateX(0)'
                : 'translateX(-100%)'
              : 'none',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Brand Header */}
        <div
          className="sidebar-stagger"
          style={{
            padding: '1.25rem 1.4rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img src="/logo_pln.png" alt="Logo ITPLN" style={{ height: '34px' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <h2
                  style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: 0,
                    fontFamily: 'Outfit, sans-serif',
                    letterSpacing: '-0.4px',
                  }}
                >
                  PERFORMA
                </h2>
                <span
                  style={{
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    letterSpacing: '0.5px',
                  }}
                >
                  ITPLN
                </span>
              </div>
              <div
                style={{
                  fontSize: '0.62rem',
                  color: '#64748b',
                  fontWeight: 600,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  marginTop: '2px',
                }}
              >
                Portal Kinerja Terpadu
              </div>
            </div>
          </div>
          {windowWidth <= 768 && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Status Otoritas Sesi & Switcher */}
        <div
          className="sidebar-stagger"
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.45rem',
            }}
          >
            <span
              style={{
                fontSize: '0.62rem',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                fontWeight: 700,
              }}
            >
              Otoritas Sesi Aktif
            </span>
            <span
              style={{
                fontSize: '0.6rem',
                color: '#334155',
                fontWeight: 700,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '2px 7px',
                borderRadius: '99px',
                letterSpacing: '0.5px',
              }}
            >
              {isIkuOnly ? 'IKU ONLY' : isKpiOnly ? 'KPI ONLY' : isSuperadminPrp ? 'SUPERADMIN PRP' : 'DUAL ACCESS'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.8rem',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#475569',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentUser.roleTitle}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                {isIkuOnly
                  ? 'Akses Khusus Modul 8 IKU'
                  : isKpiOnly
                    ? 'Akses Khusus Modul KPI Unit'
                    : isSuperadminPrp
                      ? 'Kontrol platform, IKU & KPI'
                    : `Aktif: Menu ${effectiveWorkspace.toUpperCase()}`}
              </div>
            </div>
          </div>

          {/* Switcher 2 Ruang Kerja (White Floating Pill) */}
          {isDual && (
            <div style={{ marginTop: '0.8rem' }}>
              <div
                style={{
                  fontSize: '0.62rem',
                  color: '#64748b',
                  marginBottom: '0.35rem',
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                }}
              >
                Pindah Ruang Kerja:
              </div>
              <div
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: isSuperadminPrp ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                  background: '#e2e8f0',
                  padding: '3px',
                  borderRadius: '9px',
                }}
              >
                <div
                  ref={switcherPillRef}
                  style={{
                    position: 'absolute',
                    top: '3px',
                    bottom: '3px',
                    left: '3px',
                    width: isSuperadminPrp ? 'calc((100% - 6px) / 3)' : 'calc((100% - 6px) / 2)',
                    background: '#ffffff',
                    borderRadius: '6px',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
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
                      padding: '6px 4px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      fontFamily: 'Outfit, sans-serif',
                      color: activeContext === 'prp' ? '#0f172a' : '#64748b',
                      transition: 'color 0.25s ease',
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
                    padding: '6px 8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    color: activeContext === 'iku' ? '#0f172a' : '#64748b',
                    transition: 'color 0.25s ease',
                  }}
                >
                  01. Menu IKU
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectWorkspaceMenu('kpi')}
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: '6px 8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    fontFamily: 'Outfit, sans-serif',
                    color: activeContext === 'kpi' ? '#0f172a' : '#64748b',
                    transition: 'color 0.25s ease',
                  }}
                >
                  02. Menu KPI
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, minHeight: 0, padding: '1rem 0', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0 0.85rem' }}>
            <div className="sidebar-stagger">
              <div
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  padding: '0 0.5rem 0.4rem',
                }}
              >
                Ruang Kerja Utama
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', listStyle: 'none', padding: 0, margin: 0 }}>
                {(isIkuOnly || (isSuperadminPrp && (showPRP || showIKU))) && <li>
                  <Link to="/internal/iku-submissions" aria-current={isActive('/internal/iku-submissions') ? 'page' : undefined}
                    className="corp-nav-link"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.68rem 0.85rem', borderRadius: '9px', textDecoration: 'none', fontSize: '0.84rem', fontWeight: 700, color: '#075985', background: isActive('/internal/iku-submissions') ? '#e0f2fe' : 'transparent' }}>
                    <FileText size={17} /><span>Submission IKU</span>
                  </Link>
                </li>}
                {showPRP && <li>
                  <Link
                    to="/internal/admin"
                    onClick={handleSelectPRP}
                    className="corp-nav-link"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.68rem 0.85rem',
                      color: isActive('/internal/admin') ? '#0f172a' : '#475569',
                      background: isActive('/internal/admin') ? '#f1f5f9' : 'transparent',
                      border: isActive('/internal/admin') ? '1px solid #e2e8f0' : '1px solid transparent',
                      fontWeight: isActive('/internal/admin') ? 700 : 500, borderRadius: '9px', textDecoration: 'none',
                      transition: 'all 0.2s ease', fontSize: '0.84rem',
                    }}
                  >
                    <LayoutDashboard size={17} />
                    <span>PRP Control Center</span>
                  </Link>
                </li>}
                {showPRP && <li>
                  <Link
                    to="/internal/admin/governance"
                    className="corp-nav-link"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.85rem',
                      color: isActive('/internal/admin/governance') ? '#0f172a' : '#475569',
                      background: isActive('/internal/admin/governance') ? '#f1f5f9' : 'transparent',
                      border: isActive('/internal/admin/governance') ? '1px solid #e2e8f0' : '1px solid transparent',
                      fontWeight: isActive('/internal/admin/governance') ? 700 : 500, borderRadius: '9px', textDecoration: 'none',
                      transition: 'all 0.2s ease', fontSize: '0.82rem',
                    }}
                  ><Settings2 size={16} /><span>Konfigurasi Kinerja</span></Link>
                </li>}
                {isDual && !showPRP && <li>
                  <Link
                    to="/internal"
                    className="corp-nav-link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.68rem 0.85rem',
                      color: isActive('/internal') ? '#0f172a' : '#475569',
                      background: isActive('/internal') ? '#f1f5f9' : 'transparent',
                      border: isActive('/internal') ? '1px solid #e2e8f0' : '1px solid transparent',
                      fontWeight: isActive('/internal') ? 700 : 500,
                      borderRadius: '9px',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      fontSize: '0.84rem',
                    }}
                  >
                    <LayoutDashboard size={17} />
                    <span>
                      Dashboard {effectiveWorkspace === 'kpi' ? 'KPI Unit' : '8 IKU'}
                    </span>
                  </Link>
                </li>}
              </ul>
            </div>

            {/* Modul 8 IKU Kementerian hanya tampil untuk akun IKU dan super admin */}
            {showIKU && <div className="sidebar-stagger">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 0.5rem 0.4rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: isKpiOnly ? '#cbd5e1' : '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                  }}
                >
                  Modul 8 IKU Kementerian
                </span>
                {isKpiOnly && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.58rem',
                      color: '#64748b',
                      fontWeight: 700,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    <Lock size={10} /> Terkunci
                  </span>
                )}
              </div>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', listStyle: 'none', padding: 0, margin: 0 }}>
                <li>
                  {isKpiOnly ? (
                    <div
                      onClick={() => handleRestrictedClick('iku')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        color: '#94a3b8',
                        borderRadius: '9px',
                        cursor: 'not-allowed',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Layers size={16} />
                        <span>Capaian 8 IKU</span>
                      </div>
                      <Lock size={13} />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectWorkspaceMenu('iku')}
                      className="corp-nav-link"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0.85rem',
                        color:
                          location.pathname === '/internal' && effectiveWorkspace === 'iku'
                            ? '#0f172a'
                            : '#475569',
                        background:
                          location.pathname === '/internal' && effectiveWorkspace === 'iku'
                            ? '#f1f5f9'
                            : 'transparent',
                        border:
                          location.pathname === '/internal' && effectiveWorkspace === 'iku'
                            ? '1px solid #e2e8f0'
                            : '1px solid transparent',
                        fontWeight:
                          location.pathname === '/internal' && effectiveWorkspace === 'iku' ? 700 : 500,
                        borderRadius: '9px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontSize: '0.82rem',
                      }}
                    >
                      <Layers size={16} />
                      <span>Capaian 8 IKU</span>
                    </button>
                  )}
                </li>

                <li>
                  {isKpiOnly ? (
                    <div
                      onClick={() => handleRestrictedClick('iku')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        color: '#94a3b8',
                        borderRadius: '9px',
                        cursor: 'not-allowed',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShieldCheck size={16} />
                        <span>Tim & PIC IKU</span>
                      </div>
                      <Lock size={13} />
                    </div>
                  ) : (
                    <Link
                      to="/internal/team"
                      className="corp-nav-link"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0.85rem',
                        color: isActive('/internal/team') ? '#0f172a' : '#475569',
                        background: isActive('/internal/team') ? '#f1f5f9' : 'transparent',
                        border: isActive('/internal/team') ? '1px solid #e2e8f0' : '1px solid transparent',
                        fontWeight: isActive('/internal/team') ? 700 : 500,
                        borderRadius: '9px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        fontSize: '0.82rem',
                      }}
                    >
                      <ShieldCheck size={16} />
                      <span>Tim & PIC IKU</span>
                    </Link>
                  )}
                </li>

                <li>
                  {isKpiOnly ? (
                    <div
                      onClick={() => handleRestrictedClick('iku')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        color: '#94a3b8',
                        borderRadius: '9px',
                        cursor: 'not-allowed',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FileText size={16} />
                        <span>Dokumentasi IKU</span>
                      </div>
                      <Lock size={13} />
                    </div>
                  ) : (
                    <Link
                      to="/internal/documents"
                      className="corp-nav-link"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0.85rem',
                        color: isActive('/internal/documents') ? '#0f172a' : '#475569',
                        background: isActive('/internal/documents') ? '#f1f5f9' : 'transparent',
                        border: isActive('/internal/documents') ? '1px solid #e2e8f0' : '1px solid transparent',
                        fontWeight: isActive('/internal/documents') ? 700 : 500,
                        borderRadius: '9px',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        fontSize: '0.82rem',
                      }}
                    >
                      <FileText size={16} />
                      <span>Dokumentasi IKU</span>
                    </Link>
                  )}
                </li>
              </ul>
            </div>}

            {/* Modul KPI Unit & Fakultas */}
            {showKPI && <div className="sidebar-stagger">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 0.5rem 0.4rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: isIkuOnly ? '#cbd5e1' : '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                  }}
                >
                  Modul KPI Unit & Fakultas
                </span>
                {isIkuOnly && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.58rem',
                      color: '#64748b',
                      fontWeight: 700,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    <Lock size={10} /> Terkunci
                  </span>
                )}
              </div>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', listStyle: 'none', padding: 0, margin: 0 }}>
                <li>
                  {isIkuOnly ? (
                    <div
                      onClick={() => handleRestrictedClick('kpi')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        color: '#94a3b8',
                        borderRadius: '9px',
                        cursor: 'not-allowed',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Building2 size={16} />
                        <span>Lembar Kerja KPI</span>
                      </div>
                      <Lock size={13} />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectWorkspaceMenu('kpi')}
                      className="corp-nav-link"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0.85rem',
                        color:
                          location.pathname === '/internal' && effectiveWorkspace === 'kpi'
                            ? '#0f172a'
                            : '#475569',
                        background:
                          location.pathname === '/internal' && effectiveWorkspace === 'kpi'
                            ? '#f1f5f9'
                            : 'transparent',
                        border:
                          location.pathname === '/internal' && effectiveWorkspace === 'kpi'
                            ? '1px solid #e2e8f0'
                            : '1px solid transparent',
                        fontWeight:
                          location.pathname === '/internal' && effectiveWorkspace === 'kpi' ? 700 : 500,
                        borderRadius: '9px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontSize: '0.82rem',
                      }}
                    >
                      <Building2 size={16} />
                      <span>Lembar Kerja KPI</span>
                    </button>
                  )}
                </li>
              </ul>
            </div>}

            {/* Pengaturan Sistem */}
            {showPRP && <div className="sidebar-stagger">
              <div
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  padding: '0 0.5rem 0.4rem',
                }}
              >
                Pengaturan Sistem
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', listStyle: 'none', padding: 0, margin: 0 }}>
                {isSuperadminPrp && (
                  <li>
                    <Link
                    to="/internal/users"
                    className="corp-nav-link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      color: isActive('/internal/users') ? '#0f172a' : '#475569',
                      background: isActive('/internal/users') ? '#f1f5f9' : 'transparent',
                      border: isActive('/internal/users') ? '1px solid #e2e8f0' : '1px solid transparent',
                      fontWeight: isActive('/internal/users') ? 700 : 500,
                      borderRadius: '9px',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      fontSize: '0.82rem',
                    }}
                    >
                      <Users size={16} />
                      <span>Manajemen Pengguna</span>
                    </Link>
                  </li>
                )}
                <li>
                  <Link
                    to="/internal/profile"
                    className="corp-nav-link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      color: isActive('/internal/profile') ? '#0f172a' : '#475569',
                      background: isActive('/internal/profile') ? '#f1f5f9' : 'transparent',
                      border: isActive('/internal/profile') ? '1px solid #e2e8f0' : '1px solid transparent',
                      fontWeight: isActive('/internal/profile') ? 700 : 500,
                      borderRadius: '9px',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      fontSize: '0.82rem',
                    }}
                  >
                    <UserCircle size={16} />
                    <span>Profil Sesi Saya</span>
                  </Link>
                </li>
              </ul>
            </div>}
          </div>
        </nav>

        {/* Tautan Beranda Publik */}
        <div style={{ padding: '0 0.85rem 0.5rem 0.85rem', flexShrink: 0 }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6rem',
              borderRadius: '9px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#475569',
              textDecoration: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
          >
            <ExternalLink size={13} /> Lihat Beranda Publik
          </Link>
        </div>

        {/* Tombol Logout Bersih */}
        <div
          style={{
            padding: '0.85rem',
            borderTop: '1px solid #f1f5f9',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              width: '100%',
              padding: '0.65rem',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#334155',
              fontWeight: 700,
              fontSize: '0.78rem',
              borderRadius: '9px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.color = '#334155';
            }}
          >
            <LogOut size={15} /> Keluar Sesi (Logout)
          </button>
        </div>
      </aside>

      {/* ─── 2. MAIN CONTENT AREA (PURE ALABASTER & WHITE) ─── */}
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
          background: '#f8fafc',
        }}
      >
        {/* Top Header */}
        <header
          className="header-stagger"
          style={{
            flexShrink: 0,
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(12px)',
            padding: '0.75rem 2rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 30,
          }}
        >
          {windowWidth <= 768 ? (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0f172a',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <Menu size={22} />
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 14px',
                  borderRadius: '99px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#475569',
                  }}
                />
                <span style={{ fontSize: '0.74rem', color: '#475569', fontWeight: 500 }}>
                  Ruang Kerja Aktif:{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {effectiveWorkspace === 'kpi'
                      ? 'Modul KPI Operasional Unit & Fakultas'
                      : 'Modul 8 IKU Kementerian'}
                  </strong>
                </span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '9px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Bell size={16} color="#475569" />
            </div>

            {/* User Profile Pill (Tanpa Lingkaran Hitam) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '4px 12px 4px 5px',
                borderRadius: '999px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f172a',
                  fontWeight: 800,
                  fontSize: '0.68rem',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {currentUser.avatar}
              </div>
              <div style={{ textAlign: 'left', display: windowWidth <= 540 ? 'none' : 'block' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f172a', lineHeight: 1.1 }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  {currentUser.email}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <div
          className="internal-main-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            height: 'calc(100vh - 60px)',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 'clamp(1.5rem, 3vw, 2.25rem)',
            overscrollBehavior: 'contain',
          }}
          ref={scrollWrapperRef}
        >
          <div ref={scrollContentRef} style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            <Outlet />
          </div>
        </div>
      </main>

      {/* ─── MODAL PEMBATASAN AKSES (CLEAN LIGHT MODAL) ─── */}
      {blockedModalInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(15, 23, 42, 0.25)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 24px 48px rgba(15, 23, 42, 0.1)',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '480px',
              padding: '2rem',
              color: '#0f172a',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '99px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                fontSize: '0.65rem',
                fontWeight: 800,
                color: '#334155',
                letterSpacing: '1px',
                marginBottom: '1rem',
              }}
            >
              <Lock size={12} /> {blockedModalInfo.code}
            </div>

            <h3
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: '1.3rem',
                fontWeight: 800,
                margin: '0 0 0.6rem',
                color: '#0f172a',
                letterSpacing: '-0.4px',
              }}
            >
              {blockedModalInfo.title}
            </h3>

            <p
              style={{
                color: '#475569',
                fontSize: '0.88rem',
                lineHeight: 1.65,
                margin: '0 0 1.2rem',
              }}
            >
              {blockedModalInfo.message}
            </p>

            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '0.8rem',
                color: '#334155',
                lineHeight: 1.5,
                marginBottom: '1.5rem',
              }}
            >
              <strong>Prosedur Akses Lintas Modul:</strong> {blockedModalInfo.allowedAction}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setBlockedModalInfo(null)}
                style={{
                  padding: '0.65rem 1.35rem',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}
              >
                Tutup Pemberitahuan
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .corp-nav-link:hover {
          background: #f8fafc;
        }
        .glass-panel {
          position: relative;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.025);
          border-radius: 16px;
          overflow: hidden;
          color: #0f172a;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
        }
        .glass-panel:hover {
          border-color: #cbd5e1;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
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
          width: 6px;
          height: 6px;
        }
        .internal-main-scroll::-webkit-scrollbar-track,
        .corp-sidebar nav::-webkit-scrollbar-track {
          background: transparent;
        }
        .internal-main-scroll::-webkit-scrollbar-thumb,
        .corp-sidebar nav::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}