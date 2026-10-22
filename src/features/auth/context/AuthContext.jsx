import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { minimumPasswordLength, notifyAdminUpdated, readSystemConfig, writeAudit } from '../../internal/adminStore';

/**
 * Akun Resmi Pengujian Lokal:
 * 1. iku@itpln.ac.id   -> Hanya bisa akses Menu IKU
 * 2. kpi@itpln.ac.id   -> Hanya bisa akses Menu KPI
 * 3. admin@itpln.ac.id -> Superadmin PRP untuk seluruh platform, IKU, dan KPI
 */
export const MOCK_ACCOUNTS = [
  {
    id: 'user-iku',
    code: '01',
    email: 'iku@itpln.ac.id',
    password: 'password',
    name: 'Biro Kemahasiswaan & Akademik',
    shortName: 'PIC IKU',
    role: 'iku_only',
    roleTitle: 'Otoritas Khusus IKU',
    badge: 'IKU ONLY',
    allowedPortals: ['iku'],
    unit: 'Biro Akademik & Kemahasiswaan ITPLN',
    avatar: 'IKU',
    description: 'Akses terkunci khusus untuk pengelolaan dan pemantauan 8 IKU Kementerian.'
  },
  {
    id: 'user-kpi',
    code: '02',
    email: 'kpi@itpln.ac.id',
    password: 'password',
    name: 'Tim Kinerja Unit & Fakultas',
    shortName: 'PIC KPI',
    role: 'kpi_only',
    roleTitle: 'Otoritas Khusus KPI',
    badge: 'KPI ONLY',
    allowedPortals: ['kpi'],
    unit: 'Fakultas & Unit Operasional ITPLN',
    avatar: 'KPI',
    description: 'Akses terkunci khusus untuk pengelolaan Key Performance Indicator internal unit & fakultas.'
  },
  {
    id: 'user-dual',
    code: '03',
    email: 'admin@itpln.ac.id',
    password: 'password',
    name: 'Administrator Terpadu ITPLN',
    shortName: 'Integrator',
    role: 'superadmin_prp',
    roleTitle: 'Superadmin PRP',
    badge: 'SUPERADMIN PRP',
    allowedPortals: ['iku', 'kpi'],
    unit: 'Satuan Penjaminan Mutu Internal (SPMI)',
    avatar: 'ADM',
    description: 'Mengelola platform, submission, konfigurasi tabel, rumus, periode, dan akses IKU serta KPI.'
  }
];

const getStoredUsers = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('prp_users') || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const AuthContext = createContext(null);
export const portalsForRole = (role) => role === 'superadmin_prp' || role === 'dual' ? ['iku', 'kpi'] : role === 'iku_only' ? ['iku'] : role === 'kpi_only' ? ['kpi'] : [];
export const readMergedUsers = () => {
  const merged = new Map(MOCK_ACCOUNTS.map((user) => [user.email.toLowerCase(), { ...user, status: 'Aktif' }]));
  getStoredUsers().forEach((user) => {
    if (typeof user.email !== 'string') return;
    const email = user.email.toLowerCase();
    merged.set(email, { ...merged.get(email), ...user, email });
  });
  return [...merged.values()].map((user) => ({ ...user, allowedPortals: portalsForRole(user.role) }));
};

export function AuthProvider({ children }) {
  const changedPasswordActor = useRef(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('performa_user');
      const saved = savedUser ? JSON.parse(savedUser) : null;
      const account = readMergedUsers().find((user) => user.email === saved?.email);
      return account && account.status === 'Aktif' && account.password === saved.password && (!readSystemConfig().maintenanceMode || account.role === 'superadmin_prp') ? account : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const revalidate = (event) => {
      if (event.type === 'storage' && event.key && !['prp_users', 'prp_system_config', 'performa_user'].includes(event.key)) return;
      setCurrentUser((previous) => {
        if (!previous) return null;
        const account = readMergedUsers().find((user) => user.email === previous.email);
        if (!account || account.status !== 'Aktif' || account.password !== previous.password || (readSystemConfig().maintenanceMode && account.role !== 'superadmin_prp') || (event.type === 'storage' && event.key === 'performa_user' && !event.newValue)) return null;
        return JSON.stringify(account) === JSON.stringify(previous) ? previous : account;
      });
    };
    window.addEventListener('prp-admin-updated', revalidate);
    window.addEventListener('storage', revalidate);
    return () => { window.removeEventListener('prp-admin-updated', revalidate); window.removeEventListener('storage', revalidate); };
  }, []);

  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    try {
      const savedUserRaw = localStorage.getItem('performa_user');
      const savedWorkspace = localStorage.getItem('performa_workspace');
      if (savedUserRaw) {
        const parsed = JSON.parse(savedUserRaw);
        if (parsed.role === 'iku_only') return 'iku';
        if (parsed.role === 'kpi_only') return 'kpi';
        if (parsed.role === 'superadmin_prp') return 'kpi';
      }
      return savedWorkspace === 'kpi' ? 'kpi' : 'iku';
    } catch {
      return 'iku';
    }
  });

  const [activeContext, setActiveContext] = useState(() => {
    try {
      const savedContext = localStorage.getItem('performa_context');
      if (savedContext === 'prp' || savedContext === 'iku' || savedContext === 'kpi') return savedContext;
      const savedUser = JSON.parse(localStorage.getItem('performa_user') || 'null');
      return savedUser?.role === 'superadmin_prp' ? 'prp' : savedUser?.role === 'kpi_only' ? 'kpi' : 'iku';
    } catch {
      return 'iku';
    }
  });

  useEffect(() => {
    if (!currentUser) return;
    const portals = portalsForRole(currentUser.role);
    if (!portals.includes(activeWorkspace)) setActiveWorkspace(portals[0] || 'iku');
    if ((activeContext === 'prp' && currentUser.role !== 'superadmin_prp') || (activeContext !== 'prp' && !portals.includes(activeContext))) setActiveContext(portals[0] || 'iku');
  }, [currentUser, activeWorkspace, activeContext]);

  // Sinkronisasi ketat antara Role dan Workspace di localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('performa_user', JSON.stringify(currentUser));
      if (currentUser.role === 'iku_only' && activeWorkspace !== 'iku') {
        setActiveWorkspace('iku');
      } else if (currentUser.role === 'kpi_only' && activeWorkspace !== 'kpi') {
        setActiveWorkspace('kpi');
      }
    } else {
      localStorage.removeItem('performa_user');
    }
  }, [currentUser, activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace) {
      localStorage.setItem('performa_workspace', activeWorkspace);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    localStorage.setItem('performa_context', activeContext);
  }, [activeContext]);

  /**
   * Fungsi Login Utama untuk 3 Kondisi:
   * - Kondisi 1 (iku_only): Langsung set user & arahkan ke 'iku'
   * - Kondisi 2 (kpi_only): Langsung set user & arahkan ke 'kpi'
  * - Superadmin PRP      : Langsung masuk pusat kendali admin
   */
  const login = (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = password || '';

    const matchedUser = readMergedUsers().find(
      (acc) => acc.email.toLowerCase() === cleanEmail
    );

    if (!matchedUser || matchedUser.status !== 'Aktif' || cleanPass !== matchedUser.password || (readSystemConfig().maintenanceMode && matchedUser.role !== 'superadmin_prp')) {
      writeAudit('LOGIN_GAGAL', 'Login ditolak', cleanEmail);
      return {
        success: false,
        message: 'Email atau kata sandi tidak sesuai atau akun sedang nonaktif.'
      };
    }
    setCurrentUser(matchedUser);
    writeAudit('LOGIN_BERHASIL', 'Login berhasil', cleanEmail);

    // KONDISI 1: Hanya IKU
    if (matchedUser.role === 'iku_only') {
      setCurrentUser(matchedUser);
      setActiveWorkspace('iku');
      setActiveContext('iku');
      return {
        success: true,
        user: matchedUser,
        requiresWorkspaceChoice: false,
        targetWorkspace: 'iku'
      };
    }

    // KONDISI 2: Hanya KPI
    if (matchedUser.role === 'kpi_only') {
      setCurrentUser(matchedUser);
      setActiveWorkspace('kpi');
      setActiveContext('kpi');
      return {
        success: true,
        user: matchedUser,
        requiresWorkspaceChoice: false,
        targetWorkspace: 'kpi'
      };
    }

    if (matchedUser.role === 'superadmin_prp') {
      setCurrentUser(matchedUser);
      setActiveWorkspace('kpi');
      setActiveContext('prp');
      return {
        success: true,
        user: matchedUser,
        requiresWorkspaceChoice: false,
        targetWorkspace: 'admin'
      };
    }

    // Akun dengan dua ruang kerja lama tetap diarahkan ke gerbang pilihan.
    return {
      success: true,
      user: matchedUser,
      requiresWorkspaceChoice: true,
      targetWorkspace: null
    };
  };

  /**
   * Menyelesaikan login Kondisi 3 setelah user memilih Menu IKU atau Menu KPI
   */
  const completeDualLogin = (user, chosenWorkspace) => {
    const validChoice = chosenWorkspace === 'kpi' ? 'kpi' : 'iku';
    if (!currentUser || user.email !== currentUser.email || !portalsForRole(currentUser.role).includes(validChoice)) return;
    setActiveWorkspace(validChoice);
    setActiveContext(validChoice);
  };

  /**
   * Pindah menu di dalam dashboard (Hanya diizinkan untuk akun Kondisi 3 / Dual)
   */
  const switchWorkspace = (workspace) => {
    if (['dual', 'superadmin_prp'].includes(currentUser?.role) && (workspace === 'iku' || workspace === 'kpi')) {
      setActiveWorkspace(workspace);
      setActiveContext(workspace);
    }
  };

  const enterPRP = () => {
    if (currentUser?.role === 'superadmin_prp') setActiveContext('prp');
  };

  const updateProfile = (changes) => {
    if (!currentUser) return;
    const safe = Object.fromEntries(['name', 'shortName', 'avatar', 'unit'].filter((key) => typeof changes[key] === 'string').map((key) => [key, changes[key]]));
    const account = readMergedUsers().find((user) => user.email === currentUser.email);
    if (!account) return;
    const next = { ...account, ...safe };
    localStorage.setItem('prp_users', JSON.stringify([...getStoredUsers().filter((user) => user.email !== next.email), next]));
    setCurrentUser(next);
    notifyAdminUpdated();
    writeAudit('PROFIL_DIPERBARUI', 'Profil diperbarui', next.email);
  };

  const logout = () => {
    setCurrentUser(null);
    setActiveWorkspace('iku');
    setActiveContext('iku');
    localStorage.removeItem('performa_user');
    localStorage.removeItem('performa_workspace');
    localStorage.removeItem('performa_context');
  };

  const canAccess = (portal) => {
    if (!currentUser) return false;
    if (['dual', 'superadmin_prp'].includes(currentUser.role)) return true;
    if (portal === 'iku' && currentUser.role === 'iku_only') return true;
    if (portal === 'kpi' && currentUser.role === 'kpi_only') return true;
    return false;
  };

  const isSuperadmin = currentUser?.role === 'superadmin_prp';

  const value = {
    currentUser,
    activeWorkspace,
    activeContext,
    login,
    completeDualLogin,
    switchWorkspace,
    enterPRP,
    updateProfile,
    logout,
    canAccess,
    isSuperadmin,
    mockAccounts: MOCK_ACCOUNTS
  };

  const changePassword = (event) => {
    event.preventDefault();
    if (newPassword.length < minimumPasswordLength() || newPassword !== confirmation || newPassword === currentUser.password) {
      setPasswordError(`Gunakan password baru minimal ${minimumPasswordLength()} karakter dan konfirmasi yang sama.`);
      return;
    }
    const account = readMergedUsers().find((user) => user.email === currentUser.email);
    if (!account || account.password !== currentUser.password || account.status !== 'Aktif') { logout(); return; }
    const next = { ...account, password: newPassword, mustChangePassword: false };
    localStorage.setItem('prp_users', JSON.stringify([...getStoredUsers().filter((user) => user.email !== next.email), next]));
    setCurrentUser(next);
    // Notify after React commits the new credentials so this tab keeps its session.
    changedPasswordActor.current = next.email;
    setNewPassword(''); setConfirmation(''); setPasswordError('');
  };

  useEffect(() => {
    if (currentUser && !currentUser.mustChangePassword && newPassword === '' && confirmation === '') {
      if (changedPasswordActor.current) {
        const actor = changedPasswordActor.current;
        changedPasswordActor.current = null;
        writeAudit('PASSWORD_DIUBAH', 'Password wajib berhasil diganti', actor);
      }
      notifyAdminUpdated();
    }
  }, [currentUser, newPassword, confirmation]);

  return <AuthContext.Provider value={value}>{currentUser?.mustChangePassword ? <main style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#f1f5f9', display: 'grid', placeItems: 'center', padding: 24 }}><form onSubmit={(event) => { changePassword(event); }} aria-label="Ganti password wajib" style={{ background: 'white', padding: 32, maxWidth: 460, display: 'grid', gap: 16 }}><h1>Ganti password sementara</h1><p>Wajib mengganti password sebelum mengakses aplikasi. Demo lokal: password disimpan di localStorage, bukan penyimpanan aman server.</p><label>Password baru<input type="password" autoComplete="new-password" required minLength={minimumPasswordLength()} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label><label>Konfirmasi password<input type="password" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>{passwordError && <p role="alert">{passwordError}</p>}<button type="submit">Simpan password</button><button type="button" onClick={logout}>Keluar</button></form></main> : children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}