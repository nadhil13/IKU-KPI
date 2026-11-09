import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { minimumPasswordLength, notifyAdminUpdated, readSystemConfig, writeAudit } from '../../internal/adminStore';
import { connectRealtimeEngine, loginViaBackend, logoutViaBackend, getAccessToken } from '../../../lib/realtimeSync';

/**
 * Akun resmi pengujian operasional:
 * - iku@itpln.ac.id   : Otoritas khusus IKU Kementerian
 * - kpi@itpln.ac.id   : Otoritas unit KPI (default PIC BAKT & BAG) beserta akun per unit/PIC resmi ITPLN
 * - admin@itpln.ac.id : Superadmin PRP untuk tata kelola penuh, validasi bukti, dan audit terpusat
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
    picCodes: [],
    unit: 'Biro Akademik & Kemahasiswaan ITPLN',
    avatar: 'IKU',
    description: 'Akses khusus untuk pengelolaan dan pemantauan 8 IKU Kementerian.'
  },
  {
    id: 'user-kpi',
    code: '02',
    email: 'kpi@itpln.ac.id',
    password: 'password',
    name: 'Biro Akuntansi & Biro Anggaran (BAKT / BAG)',
    shortName: 'PIC BAKT/BAG',
    role: 'kpi_only',
    roleTitle: 'Otoritas Unit KPI (BAKT & BAG)',
    badge: 'PIC: BAKT, BAG',
    allowedPortals: ['kpi'],
    picCodes: ['BAKT', 'BAG'],
    unit: 'Biro Akuntansi & Anggaran (BAKT, BAG)',
    avatar: 'BKG',
    description: 'Mengisi indikator KPI yang ditugaskan ke BAKT/BAG dan memantau capaian unit lain secara transparan.'
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
    picCodes: ['PRP'],
    unit: 'Direktorat Perencanaan & Pengembangan (PRP)',
    avatar: 'ADM',
    description: 'Mengelola platform, submission, konfigurasi tabel, rumus, validasi bukti, periode, dan audit trail terpusat.'
  },
  {
    id: 'user-kpi-bakt',
    code: '04',
    email: 'bakt@itpln.ac.id',
    password: 'password',
    name: 'Biro Akuntansi ITPLN',
    shortName: 'PIC BAKT',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BAKT',
    badge: 'PIC: BAKT',
    allowedPortals: ['kpi'],
    picCodes: ['BAKT'],
    unit: 'Biro Akuntansi (BAKT)',
    avatar: 'BAK',
    description: 'Hak pengisian khusus indikator KPI dengan PIC BAKT (1b, 2, 3, 4 Bagian A & 2 Bagian D).'
  },
  {
    id: 'user-kpi-bag',
    code: '05',
    email: 'bag@itpln.ac.id',
    password: 'password',
    name: 'Biro Anggaran ITPLN',
    shortName: 'PIC BAG',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BAG',
    badge: 'PIC: BAG',
    allowedPortals: ['kpi'],
    picCodes: ['BAG'],
    unit: 'Biro Anggaran (BAG)',
    avatar: 'BAG',
    description: 'Hak pengisian khusus indikator KPI dengan PIC BAG (1b, 2, 3, 4 Bagian A & 1 Bagian D).'
  },
  {
    id: 'user-kpi-ppa',
    code: '06',
    email: 'ppa@itpln.ac.id',
    password: 'password',
    name: 'Pusat Pelayanan Akademik ITPLN',
    shortName: 'PIC PPA',
    role: 'kpi_only',
    roleTitle: 'PIC Unit PPA',
    badge: 'PIC: PPA',
    allowedPortals: ['kpi'],
    picCodes: ['PPA'],
    unit: 'Pusat Pelayanan Akademik (PPA)',
    avatar: 'PPA',
    description: 'Hak pengisian khusus indikator KPI dengan PIC PPA (1a Bagian A).'
  },
  {
    id: 'user-kpi-bku',
    code: '07',
    email: 'bku@itpln.ac.id',
    password: 'password',
    name: 'Biro Keuangan ITPLN',
    shortName: 'PIC BKU',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKU',
    badge: 'PIC: BKU',
    allowedPortals: ['kpi'],
    picCodes: ['BKU'],
    unit: 'Biro Keuangan (BKU)',
    avatar: 'BKU',
    description: 'Hak pengisian khusus indikator KPI dengan PIC BKU (5 Bagian A).'
  },
  {
    id: 'user-kpi-pjm',
    code: '08',
    email: 'pjm@itpln.ac.id',
    password: 'password',
    name: 'Pusat Jaminan Mutu ITPLN',
    shortName: 'PIC PJM',
    role: 'kpi_only',
    roleTitle: 'PIC Unit PJM',
    badge: 'PIC: PJM',
    allowedPortals: ['kpi'],
    picCodes: ['PJM'],
    unit: 'Pusat Jaminan Mutu (PJM)',
    avatar: 'PJM',
    description: 'Hak pengisian khusus indikator KPI dengan PIC PJM (tata kelola, EDOM, layanan kampus, OBE, akreditasi, tindak lanjut audit).'
  },
  {
    id: 'user-kpi-prp',
    code: '09',
    email: 'prp.unit@itpln.ac.id',
    password: 'password',
    name: 'Unit Pelaksana Pelaporan PRP',
    shortName: 'PIC PRP',
    role: 'kpi_only',
    roleTitle: 'PIC Unit PRP',
    badge: 'PIC: PRP',
    allowedPortals: ['kpi'],
    picCodes: ['PRP'],
    unit: 'Direktorat Perencanaan & Pengembangan (PRP)',
    avatar: 'PRP',
    description: 'Hak pengisian khusus indikator KPI dengan PIC PRP (tata kelola, EDOM, layanan kampus, pelaporan manajemen).'
  },
  {
    id: 'user-kpi-bpka',
    code: '10',
    email: 'bpka@itpln.ac.id',
    password: 'password',
    name: 'Biro Pengembangan Karir & Alumni',
    shortName: 'PIC BPKA',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BPKA',
    badge: 'PIC: BPKA',
    allowedPortals: ['kpi'],
    picCodes: ['BPKA'],
    unit: 'Biro Pengembangan Karir & Alumni (BPKA)',
    avatar: 'BPK',
    description: 'Hak pengisian khusus indikator KPI Tracer Study dan Penerimaan Lulusan Offtaker.'
  },
  {
    id: 'user-kpi-bkk',
    code: '11',
    email: 'bkk@itpln.ac.id',
    password: 'password',
    name: 'Biro Kemahasiswaan & Konseling',
    shortName: 'PIC BKK',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKK',
    badge: 'PIC: BKK',
    allowedPortals: ['kpi'],
    picCodes: ['BKK'],
    unit: 'Biro Kemahasiswaan & Konseling (BKK)',
    avatar: 'BKK',
    description: 'Hak pengisian khusus indikator KPI Mahasiswa Berprestasi.'
  },
  {
    id: 'user-kpi-bkai',
    code: '12',
    email: 'bkai@itpln.ac.id',
    password: 'password',
    name: 'Biro Kerja Sama Akademik Internasional',
    shortName: 'PIC BKAI',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKAI',
    badge: 'PIC: BKAI',
    allowedPortals: ['kpi'],
    picCodes: ['BKAI'],
    unit: 'Biro Kerja Sama Akademik Internasional (BKAI)',
    avatar: 'BKI',
    description: 'Hak pengisian khusus indikator KPI Kerja Sama Internasional.'
  },
  {
    id: 'user-kpi-bpik',
    code: '13',
    email: 'bpik@itpln.ac.id',
    password: 'password',
    name: 'Tim Penjaringan Mahasiswa Baru (BPIK, BKM, BSAR, BPAD)',
    shortName: 'PIC Admisi',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BPIK/BKM/BSAR/BPAD',
    badge: 'PIC: BPIK, BKM, BSAR, BPAD',
    allowedPortals: ['kpi'],
    picCodes: ['BPIK', 'BKM', 'BSAR', 'BPAD'],
    unit: 'Biro Pemasaran, Kemahasiswaan, Sarpras & Aset (BPIK, BKM, BSAR, BPAD)',
    avatar: 'PMB',
    description: 'Hak pengisian khusus indikator KPI Efektivitas Penjaringan Calon Mahasiswa Baru.'
  },
  {
    id: 'user-kpi-fak',
    code: '14',
    email: 'fak@itpln.ac.id',
    password: 'password',
    name: 'Fakultas & Program Studi ITPLN',
    shortName: 'PIC FAK',
    role: 'kpi_only',
    roleTitle: 'PIC Fakultas (FAK)',
    badge: 'PIC: FAK',
    allowedPortals: ['kpi'],
    picCodes: ['FAK'],
    unit: 'Fakultas & Program Studi (FAK)',
    avatar: 'FAK',
    description: 'Hak pengisian khusus indikator KPI Kurikulum OBE, Klasterisasi Mandiri, dan Akreditasi Program.'
  },
  {
    id: 'user-kpi-lppm',
    code: '15',
    email: 'lppm@itpln.ac.id',
    password: 'password',
    name: 'Lembaga Penelitian & Pengabdian kepada Masyarakat',
    shortName: 'PIC LPPM',
    role: 'kpi_only',
    roleTitle: 'PIC Unit LPPM',
    badge: 'PIC: LPPM',
    allowedPortals: ['kpi'],
    picCodes: ['LPPM'],
    unit: 'Lembaga Penelitian & Pengabdian kepada Masyarakat (LPPM)',
    avatar: 'LPM',
    description: 'Hak pengisian khusus indikator KPI Penelitian, Publikasi Ilmiah, Sitasi, PKM, HKI, dan Kapasitas Dosen.'
  },
  {
    id: 'user-kpi-sdm',
    code: '16',
    email: 'sdm@itpln.ac.id',
    password: 'password',
    name: 'Biro Sumber Daya Manusia (SDM & BSDM)',
    shortName: 'PIC SDM/BSDM',
    role: 'kpi_only',
    roleTitle: 'PIC Unit SDM & BSDM',
    badge: 'PIC: SDM, BSDM',
    allowedPortals: ['kpi'],
    picCodes: ['SDM', 'BSDM'],
    unit: 'Biro Sumber Daya Manusia (SDM, BSDM)',
    avatar: 'SDM',
    description: 'Hak pengisian khusus indikator KPI Peningkatan Kualitas Dosen dan Integrasi Siakad & SimKug.'
  },
  {
    id: 'user-kpi-bkan',
    code: '17',
    email: 'bkan@itpln.ac.id',
    password: 'password',
    name: 'Biro Kerja Sama Akademik Nasional',
    shortName: 'PIC BKAN',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKAN',
    badge: 'PIC: BKAN',
    allowedPortals: ['kpi'],
    picCodes: ['BKAN'],
    unit: 'Biro Kerja Sama Akademik Nasional (BKAN)',
    avatar: 'BKN',
    description: 'Hak pengisian khusus indikator KPI Kerja Sama Akademik dengan Industri dan Perguruan Tinggi.'
  },
  {
    id: 'user-kpi-bpti',
    code: '18',
    email: 'bpti@itpln.ac.id',
    password: 'password',
    name: 'Biro Pengembangan Teknologi Informasi',
    shortName: 'PIC BPTI',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BPTI',
    badge: 'PIC: BPTI',
    allowedPortals: ['kpi'],
    picCodes: ['BPTI'],
    unit: 'Biro Pengembangan Teknologi Informasi (BPTI)',
    avatar: 'BTI',
    description: 'Hak pengisian khusus indikator KPI Integrasi Siakad & SimKug.'
  },
  {
    id: 'user-kpi-spi',
    code: '19',
    email: 'spi@itpln.ac.id',
    password: 'password',
    name: 'Satuan Pengawasan Intern, Akuntansi & WBS',
    shortName: 'PIC SPI/Audit',
    role: 'kpi_only',
    roleTitle: 'PIC Unit SPI, Akuntansi & WBS',
    badge: 'PIC: SPI, Akuntansi, WBS',
    allowedPortals: ['kpi'],
    picCodes: ['SPI', 'Akuntansi', 'WBS'],
    unit: 'Satuan Pengawasan Intern (SPI, Akuntansi, WBS)',
    avatar: 'SPI',
    description: 'Hak pengisian khusus indikator KPI Tindaklanjut Rekomendasi Audit & Temuan.'
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
    const base = merged.get(email);
    const picCodes = Array.isArray(user.picCodes)
      ? user.picCodes
      : (Array.isArray(base?.picCodes) ? base.picCodes : []);
    merged.set(email, { ...base, ...user, email, picCodes });
  });
  return [...merged.values()].map((user) => ({
    ...user,
    picCodes: Array.isArray(user.picCodes) ? user.picCodes : [],
    allowedPortals: portalsForRole(user.role),
  }));
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
    loginViaBackend(cleanEmail, cleanPass).then(() => {
      connectRealtimeEngine();
    });

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

    return {
      success: true,
      user: matchedUser,
      requiresWorkspaceChoice: true,
      targetWorkspace: null
    };
  };

  const completeDualLogin = (user, chosenWorkspace) => {
    const targetUser = user || currentUser;
    const validChoice = chosenWorkspace === 'kpi' ? 'kpi' : 'iku';
    if (!targetUser || !portalsForRole(targetUser.role).includes(validChoice)) return;
    setCurrentUser(targetUser);
    setActiveWorkspace(validChoice);
    setActiveContext(validChoice);
  };

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

  useEffect(() => {
    if (!currentUser?.email) return undefined;
    let cleanup = () => {};
    if (!getAccessToken()) {
      loginViaBackend(currentUser.email, currentUser.password || 'password').then(() => {
        cleanup = connectRealtimeEngine();
      });
    } else {
      cleanup = connectRealtimeEngine();
    }
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [currentUser?.email, currentUser?.password]);

  const logout = () => {
    logoutViaBackend();
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

  return (
    <AuthContext.Provider value={value}>
      {currentUser?.mustChangePassword ? (
        <main
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#F7FAFB',
            display: 'grid',
            placeItems: 'center',
            padding: '1.5rem',
          }}
        >
          <form
            onSubmit={(event) => {
              changePassword(event);
            }}
            aria-label="Ganti password wajib"
            style={{
              background: '#FFFFFF',
              border: '1px solid #D8E4EA',
              borderRadius: '8px',
              boxShadow: '0 20px 48px rgba(7, 37, 52, 0.12)',
              padding: '2rem',
              width: 'min(460px, 100%)',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <span className="ent-eyebrow" style={{ justifySelf: 'start' }}>KEAMANAN KREDENSIAL WAJIB</span>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}>
              Perbarui Kata Sandi Sementara
            </h1>
            <p style={{ margin: 0, color: '#334155', fontSize: '0.84rem', lineHeight: 1.6 }}>
              Demi keamanan otoritas sesi, Anda wajib mengganti kata sandi sementara sebelum mengakses ruang kerja PERFORMA ITPLN.
            </p>
            <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 700, color: '#072534' }}>
              Password baru
              <input
                className="ent-input"
                type="password"
                autoComplete="new-password"
                required
                minLength={minimumPasswordLength()}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.76rem', fontWeight: 700, color: '#072534' }}>
              Konfirmasi password
              <input
                className="ent-input"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            {passwordError && (
              <p role="alert" style={{ margin: 0, padding: '0.65rem 0.85rem', borderRadius: '6px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#7F1D1D', fontSize: '0.78rem', fontWeight: 600 }}>
                {passwordError}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              <button type="button" className="ent-btn" onClick={logout}>
                Keluar
              </button>
              <button type="submit" className="ent-btn ent-btn-teal">
                Simpan Password Baru
              </button>
            </div>
          </form>
        </main>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
