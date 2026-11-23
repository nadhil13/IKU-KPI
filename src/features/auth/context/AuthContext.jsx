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
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
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

  const finalizeSessionForUser = (userObj) => {
    const normalizedRole = userObj.role || 'kpi_only';
    const sessionUser = {
      ...userObj,
      allowedPortals: Array.isArray(userObj.allowedPortals) && userObj.allowedPortals.length > 0
        ? userObj.allowedPortals
        : portalsForRole(normalizedRole),
    };
    setCurrentUser(sessionUser);
    writeAudit('LOGIN_BERHASIL', 'Login berhasil', sessionUser.email);

    if (normalizedRole === 'iku_only') {
      setActiveWorkspace('iku');
      setActiveContext('iku');
      return {
        success: true,
        user: sessionUser,
        requiresWorkspaceChoice: false,
        targetWorkspace: 'iku',
      };
    }

    if (normalizedRole === 'kpi_only' || normalizedRole === 'spi') {
      setActiveWorkspace('kpi');
      setActiveContext('kpi');
      return {
        success: true,
        user: sessionUser,
        requiresWorkspaceChoice: false,
        targetWorkspace: 'kpi',
      };
    }

    if (normalizedRole === 'superadmin_prp') {
      setActiveWorkspace('kpi');
      setActiveContext('prp');
      return {
        success: true,
        user: sessionUser,
        requiresWorkspaceChoice: false,
        targetWorkspace: 'admin',
      };
    }

    return {
      success: true,
      user: sessionUser,
      requiresWorkspaceChoice: true,
      targetWorkspace: null,
    };
  };

  const login = (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = password || '';

    const matchedUser = readMergedUsers().find(
      (acc) => acc.email.toLowerCase() === cleanEmail
    );

    const maintenanceBlocked = readSystemConfig().maintenanceMode && matchedUser?.role !== 'superadmin_prp';
    const passwordMatches = Boolean(
      matchedUser && typeof matchedUser.password === 'string' && matchedUser.password.length > 0 && cleanPass === matchedUser.password
    );

    if (!matchedUser || matchedUser.status !== 'Aktif' || !passwordMatches || maintenanceBlocked) {
      writeAudit('LOGIN_GAGAL', 'Login ditolak', cleanEmail);
      return {
        success: false,
        message: 'Email atau kata sandi tidak sesuai atau akun sedang nonaktif.'
      };
    }

    const sessionResult = finalizeSessionForUser(matchedUser);

    loginViaBackend(cleanEmail, cleanPass).then((res) => {
      if (res?.handledByBackend && !res.success) {
        setCurrentUser(null);
        localStorage.removeItem('performa_user');
        return;
      }
      connectRealtimeEngine();
    });

    return sessionResult;
  };

  const authenticate = async (email, password) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = password || '';
    if (!cleanEmail || !cleanPass) {
      return {
        success: false,
        message: 'Email dan kata sandi wajib diisi.',
      };
    }

    const matchedUser = readMergedUsers().find(
      (acc) => acc.email.toLowerCase() === cleanEmail
    );
    const maintenanceBlocked = readSystemConfig().maintenanceMode && matchedUser?.role !== 'superadmin_prp';
    if (maintenanceBlocked) {
      writeAudit('LOGIN_GAGAL', 'Login ditolak karena mode pemeliharaan', cleanEmail);
      return {
        success: false,
        message: 'Sistem sedang dalam pemeliharaan. Hanya Superadmin PRP yang dapat masuk.',
      };
    }

    const backendRes = await loginViaBackend(cleanEmail, cleanPass);
    if (backendRes?.handledByBackend) {
      if (!backendRes.success) {
        writeAudit('LOGIN_GAGAL', 'Login ditolak oleh server', cleanEmail);
        return {
          success: false,
          message: backendRes.message || 'Email atau kata sandi tidak sesuai atau akun sedang nonaktif.',
        };
      }
      const mergedUser = { ...(matchedUser || {}), ...(backendRes.user || {}) };
      delete mergedUser.password;
      const result = finalizeSessionForUser(mergedUser);
      return result;
    }

    return login(cleanEmail, cleanPass);
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
    const hadBackendToken = Boolean(getAccessToken());
    logoutViaBackend();
    setCurrentUser(null);
    setActiveWorkspace('iku');
    setActiveContext('iku');
    localStorage.removeItem('performa_user');
    localStorage.removeItem('performa_workspace');
    localStorage.removeItem('performa_context');
    localStorage.removeItem('performa_access_token');
    localStorage.removeItem('prp_access_token');
    localStorage.removeItem('performa_seen_notif_ids_v1');
    localStorage.removeItem('prp_spi_audit_v1');
    if (hadBackendToken) {
      [
        'prp_kpi_distribution_v1',
        'prp_iku_submissions_v1',
        'prp_notifications_v1',
        'prp_email_outbox_v1',
        'prp_broadcasts_v1',
        'prp_audit',
      ].forEach((k) => localStorage.removeItem(k));
    }
  };

  const canAccess = (portal) => {
    if (!currentUser) return false;
    if (portal === 'admin') return currentUser.role === 'superadmin_prp';
    if (['dual', 'superadmin_prp'].includes(currentUser.role)) return true;
    if (portal === 'iku' && currentUser.role === 'iku_only') return true;
    if (portal === 'kpi' && (currentUser.role === 'kpi_only' || currentUser.role === 'spi')) return true;
    return false;
  };

  const updateOwnPassword = async (currentPassword, nextPassword) => {
    if (!currentUser) return { ok: false, error: 'Sesi pengguna tidak ditemukan.' };
    if (!currentPassword) return { ok: false, error: 'Kata sandi saat ini wajib diisi.' };
    const minLen = minimumPasswordLength();
    if (!nextPassword || nextPassword.length < minLen) {
      return { ok: false, error: `Kata sandi baru minimal ${minLen} karakter.` };
    }
    if (currentUser.password && currentPassword !== currentUser.password) {
      return { ok: false, error: 'Kata sandi saat ini tidak sesuai.' };
    }

    const res = await changeOwnPasswordViaBackend(currentPassword, nextPassword);
    if (res.handled && !res.ok) {
      return { ok: false, error: res.error || 'Gagal memperbarui kata sandi pada server.' };
    }

    const nextUser = {
      ...currentUser,
      ...(res.user || {}),
      ...(res.handled ? {} : { password: nextPassword }),
      mustChangePassword: false,
    };
    if (res.handled) {
      delete nextUser.password;
    }
    const storedUsers = getStoredUsers().filter((u) => u.email?.toLowerCase() !== nextUser.email.toLowerCase());
    localStorage.setItem('prp_users', JSON.stringify([...storedUsers, nextUser]));
    localStorage.setItem('performa_user', JSON.stringify(nextUser));
    setCurrentUser(nextUser);
    writeAudit('PASSWORD_DIUBAH', 'Kata sandi diubah melalui halaman profil', nextUser.email);
    notifyAdminUpdated();
    return { ok: true, user: nextUser };
  };

  const isSuperadmin = currentUser?.role === 'superadmin_prp';

  const value = {
    currentUser,
    activeWorkspace: effectiveWorkspace,
    activeContext: effectiveContext,
    login,
    authenticate,
    completeDualLogin,
    switchWorkspace,
    enterPRP,
    updateProfile,
    updateOwnPassword,
    logout,
    canAccess,
    isSuperadmin,
    mockAccounts: MOCK_ACCOUNTS
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const effectiveCurrentPassword = currentPasswordInput || currentUser?.password || '';
    if (
      newPassword.length < minimumPasswordLength()
      || newPassword !== confirmation
      || (effectiveCurrentPassword && newPassword === effectiveCurrentPassword)
    ) {
      setPasswordError(`Gunakan password baru minimal ${minimumPasswordLength()} karakter, berbeda dari password lama, dan konfirmasi yang sama.`);
      return;
    }
    const account = readMergedUsers().find((user) => user.email === currentUser.email.toLowerCase());
    if (!account || account.status !== 'Aktif' || (account.password && currentUser.password && account.password !== currentUser.password)) {
      logout();
      return;
    }
    setSubmittingPassword(true);
    setPasswordError('');
    try {
      const res = await changeOwnPasswordViaBackend(effectiveCurrentPassword, newPassword);
      if (res?.handled && !res.ok) {
        setPasswordError(res.error || 'Gagal memperbarui kata sandi pada server.');
        return;
      }
      const next = {
        ...account,
        ...(res?.user || {}),
        ...(res?.handled ? {} : { password: newPassword }),
        mustChangePassword: false,
      };
      if (res?.handled) {
        delete next.password;
      }
      localStorage.setItem(
        'prp_users',
        JSON.stringify([...getStoredUsers().filter((user) => user.email?.toLowerCase() !== next.email.toLowerCase()), next])
      );
      setCurrentUser(next);
      changedPasswordActor.current = next.email;
      setCurrentPasswordInput('');
      setNewPassword('');
      setConfirmation('');
      setPasswordError('');
    } finally {
      setSubmittingPassword(false);
    }
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
              Password saat ini
              <input
                className="ent-input"
                type="password"
                autoComplete="current-password"
                placeholder="Masukkan kata sandi saat ini"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
              />
            </label>
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
              <button type="submit" className="ent-btn ent-btn-teal" style={{ minHeight: '44px' }} disabled={submittingPassword}>
                {submittingPassword ? 'Menyimpan...' : 'Simpan Password Baru'}
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
