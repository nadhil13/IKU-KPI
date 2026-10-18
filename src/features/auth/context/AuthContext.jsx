import React, { createContext, useContext, useState, useEffect } from 'react';

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

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('performa_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

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
    const cleanPass = (password || '').trim();

    const matchedUser = MOCK_ACCOUNTS.find(
      (acc) => acc.email.toLowerCase() === cleanEmail
    );

    if (!matchedUser || cleanPass !== matchedUser.password) {
      return {
        success: false,
        message: 'Email atau kata sandi tidak sesuai. Pilih salah satu dari 3 akun pengujian di atas.'
      };
    }

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
    setCurrentUser(user);
    setActiveWorkspace(validChoice);
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
    setCurrentUser((previousUser) => {
      if (!previousUser) return previousUser;
      return { ...previousUser, ...changes };
    });
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}