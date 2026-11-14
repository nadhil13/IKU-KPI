import React, { useEffect, useMemo, useRef, useState } from 'react';
import { minimumPasswordLength, notifyAdminUpdated, readSystemConfig, writeAudit } from '../../internal/adminStore';
import {
  connectRealtimeEngine,
  loginViaBackend,
  logoutViaBackend,
  getAccessToken,
  updateOwnProfileViaBackend,
  changeOwnPasswordViaBackend,
} from '../../../lib/realtimeSync';
import { AuthContext } from '../authContext';
import { MOCK_ACCOUNTS, getStoredUsers, portalsForRole, readMergedUsers } from '../authAccounts';

function isSessionConsistent(account, sessionUser) {
  if (!account || account.status !== 'Aktif') return false;
  if (readSystemConfig().maintenanceMode && account.role !== 'superadmin_prp') return false;
  if (account.mustChangePassword && !sessionUser?.mustChangePassword) return false;
  if (account.password && sessionUser?.password && account.password !== sessionUser.password) return false;
  return true;
}

export function AuthProvider({ children }) {
  const changedPasswordActor = useRef(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('performa_user');
      const saved = savedUser ? JSON.parse(savedUser) : null;
      if (!saved?.email) return null;
      const account = readMergedUsers().find((user) => user.email === saved.email.toLowerCase());
      return isSessionConsistent(account, saved) ? (saved.password && !account.password ? { ...account, password: saved.password } : account) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const revalidate = (event) => {
      if (event.type === 'storage' && event.key && !['prp_users', 'prp_system_config', 'performa_user'].includes(event.key)) return;
      setCurrentUser((previous) => {
        if (!previous) return null;
        if (event.type === 'storage' && event.key === 'performa_user' && !event.newValue) return null;
        const account = readMergedUsers().find((user) => user.email === previous.email.toLowerCase());
        if (!isSessionConsistent(account, previous)) return null;
        const merged = previous.password && !account.password ? { ...account, password: previous.password } : account;
        return JSON.stringify(merged) === JSON.stringify(previous) ? previous : merged;
      });
    };
    window.addEventListener('prp-admin-updated', revalidate);
    window.addEventListener('storage', revalidate);
    return () => {
      window.removeEventListener('prp-admin-updated', revalidate);
      window.removeEventListener('storage', revalidate);
    };
  }, []);

  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    try {
      const savedUserRaw = localStorage.getItem('performa_user');
      const savedWorkspace = localStorage.getItem('performa_workspace');
      if (savedUserRaw) {
        const parsed = JSON.parse(savedUserRaw);
        if (parsed.role === 'iku_only') return 'iku';
        if (parsed.role === 'kpi_only' || parsed.role === 'spi' || parsed.role === 'superadmin_prp') return 'kpi';
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
      return savedUser?.role === 'superadmin_prp' ? 'prp' : (savedUser?.role === 'kpi_only' || savedUser?.role === 'spi') ? 'kpi' : 'iku';
    } catch {
      return 'iku';
    }
  });

  const effectiveWorkspace = useMemo(() => {
    if (!currentUser) return activeWorkspace;
    const portals = portalsForRole(currentUser.role);
    if (currentUser.role === 'iku_only') return 'iku';
    if (currentUser.role === 'kpi_only' || currentUser.role === 'spi') return 'kpi';
    return portals.includes(activeWorkspace) ? activeWorkspace : (portals[0] || 'iku');
  }, [currentUser, activeWorkspace]);

  const effectiveContext = useMemo(() => {
    if (!currentUser) return activeContext;
    if (currentUser.role === 'superadmin_prp' && activeContext === 'prp') return 'prp';
    const portals = portalsForRole(currentUser.role);
    if (activeContext !== 'prp' && portals.includes(activeContext)) return activeContext;
    return currentUser.role === 'superadmin_prp' ? 'prp' : (portals[0] || 'iku');
  }, [currentUser, activeContext]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('performa_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('performa_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (effectiveWorkspace) {
      localStorage.setItem('performa_workspace', effectiveWorkspace);
    }
  }, [effectiveWorkspace]);

  useEffect(() => {
    localStorage.setItem('performa_context', effectiveContext);
  }, [effectiveContext]);

  const login = (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = password || '';

    const matchedUser = readMergedUsers().find(
      (acc) => acc.email.toLowerCase() === cleanEmail
    );

    const maintenanceBlocked = readSystemConfig().maintenanceMode && matchedUser?.role !== 'superadmin_prp';
    const passwordMatches = Boolean(matchedUser) && (
      matchedUser.password ? cleanPass === matchedUser.password : Boolean(cleanPass)
    );

    if (!matchedUser || matchedUser.status !== 'Aktif' || !passwordMatches || maintenanceBlocked) {
      writeAudit('LOGIN_GAGAL', 'Login ditolak', cleanEmail);
      return {
        success: false,
        message: 'Email atau kata sandi tidak sesuai atau akun sedang nonaktif.'
      };
    }

    const sessionUser = { ...matchedUser, password: matchedUser.password || cleanPass };
    setCurrentUser(sessionUser);
    writeAudit('LOGIN_BERHASIL', 'Login berhasil', cleanEmail);

    loginViaBackend(cleanEmail, cleanPass).then((res) => {
      if (res?.handledByBackend && !res.success && !matchedUser.password) {
        setCurrentUser(null);
        return;
      }
      connectRealtimeEngine();
    });

    if (matchedUser.role === 'iku_only') {
      setActiveWorkspace('iku');
      setActiveContext('iku');
      return {
        success: true,
        user: sessionUser,
        requiresWorkspaceChoice: false,
        targetWorkspace: 'iku'
      };
    }

    if (matchedUser.role === 'kpi_only' || matchedUser.role === 'spi') {
      setActiveWorkspace('kpi');
      setActiveContext('kpi');
      return {
        success: true,
        user: sessionUser,
        requiresWorkspaceChoice: false,
        targetWorkspace: 'kpi'
      };
    }

    if (matchedUser.role === 'superadmin_prp') {
      setActiveWorkspace('kpi');
      setActiveContext('prp');
      return {
        success: true,
        user: sessionUser,
        requiresWorkspaceChoice: false,
        targetWorkspace: 'admin'
      };
    }

    return {
      success: true,
      user: sessionUser,
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
    const safe = Object.fromEntries(
      ['name', 'shortName', 'avatar', 'unit']
        .filter((key) => typeof changes[key] === 'string')
        .map((key) => [key, changes[key].trim()])
    );
    const account = readMergedUsers().find((user) => user.email === currentUser.email.toLowerCase()) || currentUser;
    const next = { ...account, ...safe };
    localStorage.setItem(
      'prp_users',
      JSON.stringify([...getStoredUsers().filter((user) => user.email?.toLowerCase() !== next.email.toLowerCase()), next])
    );
    setCurrentUser(currentUser.password && !next.password ? { ...next, password: currentUser.password } : next);
    updateOwnProfileViaBackend(safe);
    notifyAdminUpdated();
    writeAudit('PROFIL_DIPERBARUI', 'Profil diperbarui', next.email);
  };

  useEffect(() => {
    if (!currentUser?.email) return undefined;
    let cleanup = () => {};
    let active = true;
    if (!getAccessToken()) {
      loginViaBackend(currentUser.email, currentUser.password || 'password').then(() => {
        if (active) cleanup = connectRealtimeEngine();
      });
    } else {
      cleanup = connectRealtimeEngine();
    }
    return () => {
      active = false;
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
    activeWorkspace: effectiveWorkspace,
    activeContext: effectiveContext,
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
    if (
      newPassword.length < minimumPasswordLength()
      || newPassword !== confirmation
      || (currentUser?.password && newPassword === currentUser.password)
    ) {
      setPasswordError(`Gunakan password baru minimal ${minimumPasswordLength()} karakter, berbeda dari password lama, dan konfirmasi yang sama.`);
      return;
    }
    const account = readMergedUsers().find((user) => user.email === currentUser.email.toLowerCase());
    if (!account || account.status !== 'Aktif' || (account.password && currentUser.password && account.password !== currentUser.password)) {
      logout();
      return;
    }
    const next = { ...account, password: newPassword, mustChangePassword: false };
    localStorage.setItem(
      'prp_users',
      JSON.stringify([...getStoredUsers().filter((user) => user.email?.toLowerCase() !== next.email.toLowerCase()), next])
    );
    changeOwnPasswordViaBackend(currentUser.password || '', newPassword);
    setCurrentUser(next);
    changedPasswordActor.current = next.email;
    setNewPassword('');
    setConfirmation('');
    setPasswordError('');
  };

  useEffect(() => {
    if (currentUser && !currentUser.mustChangePassword && changedPasswordActor.current) {
      const actor = changedPasswordActor.current;
      changedPasswordActor.current = null;
      writeAudit('PASSWORD_DIUBAH', 'Password wajib berhasil diganti', actor);
      notifyAdminUpdated();
    }
  }, [currentUser]);

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
            onSubmit={changePassword}
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
              <button type="button" className="ent-btn" style={{ minHeight: '44px' }} onClick={logout}>
                Keluar
              </button>
              <button type="submit" className="ent-btn ent-btn-teal" style={{ minHeight: '44px' }}>
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
