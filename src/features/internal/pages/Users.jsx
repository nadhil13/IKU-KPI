import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, SlidersHorizontal, ShieldCheck, Pencil, Trash2, X, Check, KeyRound, Copy
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { MOCK_ACCOUNTS, readMergedUsers } from '../../auth/authAccounts';
import { useAuth } from '../../auth/hooks/useAuth';
import { normalizePicCodes, readMasterPicCatalog } from '../../kpi/kpiSchema';
import { syncActiveKpiFormUnits } from '../../kpi/kpiWorkflowStore';
import { deleteUserViaBackend } from '../../../lib/realtimeSync';
import { minimumPasswordLength, notifyAdminUpdated, readOrganization, resetUserPassword, saveOrganization, writeAudit } from '../adminStore';
import './Users.css';

gsap.registerPlugin(ScrollTrigger);

const usersList = MOCK_ACCOUNTS;

const roleLabels = {
  all: 'Semua peran',
  iku_only: 'Otoritas IKU',
  kpi_only: 'Otoritas KPI (Unit/PIC)',
  spi: 'Auditor SPI (View Only & Audit)',
  dual: 'Peran Ganda (IKU & KPI)',
  superadmin_prp: 'Superadmin PRP',
};

const readUsers = () =>
  readMergedUsers().map((user) => ({
    ...user,
    picCodes: Array.isArray(user.picCodes) ? user.picCodes : [],
    roleLabel: roleLabels[user.role] || user.role,
    accessScope: user.allowedPortals.join(' & ').toUpperCase(),
    lastActivity: user.lastActivity || 'Belum tercatat',
  }));

export default function Users() {
  const { currentUser } = useAuth();
  const pageRef = useRef(null);
  const modalRef = useRef(null);
  const [users, setUsers] = useState(readUsers);
  const [picCatalog, setPicCatalog] = useState(readMasterPicCatalog);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [editing, setEditing] = useState(null);
  const [modalError, setModalError] = useState('');
  const [pageNotice, setPageNotice] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [newPicCodeInput, setNewPicCodeInput] = useState('');
  const [newPicNameInput, setNewPicNameInput] = useState('');

  useEffect(() => {
    const refresh = () => {
      setUsers(readUsers());
      setPicCatalog(readMasterPicCatalog());
    };
    window.addEventListener('prp-admin-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('prp-admin-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!editing && !confirmAction && !resetResult) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (confirmAction) setConfirmAction(null);
        else if (resetResult) setResetResult(null);
        else if (editing) {
          setEditing(null);
          setModalError('');
        }
        return;
      }
      if (event.key === 'Tab' && editing && !confirmAction && modalRef.current) {
        const focusables = [...modalRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editing, confirmAction, resetResult]);

  const editingId = editing?.id || null;
  useEffect(() => {
    if (editingId && modalRef.current) {
      const firstInput = modalRef.current.querySelector('input:not([disabled]), select:not([disabled])');
      firstInput?.focus();
    }
  }, [editingId]);

  const persist = (next) => {
    setUsers(next);
    localStorage.setItem('prp_users', JSON.stringify(next));
    syncActiveKpiFormUnits();
    notifyAdminUpdated();
  };

  const openCreate = () => {
    setPicCatalog(readMasterPicCatalog());
    setModalError('');
    setEditing({
      id: `user-${crypto.randomUUID()}`,
      name: '',
      unit: '',
      email: '',
      password: '',
      role: 'kpi_only',
      picCodes: ['BAKT'],
      status: 'Aktif',
      avatar: 'PIC',
    });
  };

  const togglePicSelection = (code) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const current = normalizePicCodes(prev.picCodes || []);
      const exists = current.some((c) => c.toLowerCase() === code.toLowerCase());
      const nextPics = exists
        ? current.filter((c) => c.toLowerCase() !== code.toLowerCase())
        : [...current, code];
      return { ...prev, picCodes: nextPics };
    });
  };

  const saveUser = () => {
    const latest = readUsers();
    const original = latest.find((item) => item.id === editing.id);
    const email = editing.email.trim().toLowerCase();
    const minLen = minimumPasswordLength();
    if (
      !editing.name.trim()
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || (!original && !editing.password)
      || (editing.password && editing.password.length < minLen)
    ) {
      setModalError(`Nama, email valid, dan kata sandi minimal ${minLen} karakter wajib diisi (kata sandi saat edit boleh dikosongkan).`);
      return;
    }
    const needsPic = editing.role === 'kpi_only' || editing.role === 'dual';
    const cleanPicCodes = needsPic
      ? normalizePicCodes(editing.picCodes || [])
      : (editing.role === 'superadmin_prp' ? ['PRP'] : editing.role === 'spi' ? ['SPI'] : []);
    if (needsPic && cleanPicCodes.length === 0) {
      setModalError('Pilih minimal satu Kode PIC Penanggung Jawab untuk akun Otoritas KPI / Peran Ganda.');
      return;
    }
    if (latest.some((item) => item.email.toLowerCase() === email && item.id !== editing.id)) {
      setModalError('Alamat email tersebut sudah digunakan oleh akun lain.');
      return;
    }
    if (original?.email === currentUser?.email && (email !== original.email || editing.role !== original.role || editing.status !== original.status)) {
      setModalError('Email, peran, dan status akun sesi aktif sendiri tidak dapat diubah.');
      return;
    }
    if (original && usersList.some((base) => base.id === original.id) && email !== original.email) {
      setModalError('Email akun bawaan sistem tidak dapat diubah.');
      return;
    }
    if (
      original?.role === 'superadmin_prp'
      && original.status === 'Aktif'
      && (editing.role !== 'superadmin_prp' || editing.status !== 'Aktif')
      && !latest.some((item) => item.id !== original.id && item.role === 'superadmin_prp' && item.status === 'Aktif')
    ) {
      setModalError('Minimal satu akun Superadmin aktif harus tetap tersedia.');
      return;
    }

    const badgeText = editing.role === 'kpi_only'
      ? `PIC: ${cleanPicCodes.join(', ')}`
      : editing.role === 'spi'
        ? 'AUDITOR SPI (VIEW ONLY)'
        : editing.role === 'dual'
          ? `DUAL: ${cleanPicCodes.join(', ')}`
          : editing.role === 'superadmin_prp'
            ? 'SUPERADMIN PRP'
            : 'IKU ONLY';

    const titleText = editing.role === 'kpi_only'
      ? `PIC Unit ${cleanPicCodes.join(', ')}`
      : editing.role === 'spi'
        ? 'Auditor SPI (View Only & Audit)'
        : editing.role === 'dual'
          ? `Peran Ganda (${cleanPicCodes.join(', ')})`
          : roleLabels[editing.role];

    const scopeText = editing.role === 'iku_only'
      ? '8 IKU Kementerian'
      : editing.role === 'spi'
        ? 'Audit KPI (View Only & Ekspor)'
        : editing.role === 'superadmin_prp'
          ? 'Platform, IKU & KPI'
          : editing.role === 'dual'
            ? `IKU & KPI (${cleanPicCodes.join(', ')})`
            : `KPI (${cleanPicCodes.join(', ')})`;

    const normalized = {
      ...original,
      ...editing,
      password: editing.password || original?.password,
      email,
      name: editing.name.trim(),
      unit: (editing.unit || editing.name).trim(),
      picCodes: cleanPicCodes,
      badge: badgeText,
      roleTitle: titleText,
      roleLabel: roleLabels[editing.role] || editing.role,
      accessScope: scopeText,
    };
    const exists = !!original;
    persist(exists ? latest.map((item) => (item.id === normalized.id ? normalized : item)) : [...latest, normalized]);
    writeAudit(
      exists ? 'EDIT_AKUN' : 'TAMBAH_AKUN',
      `Akun ${email}: ${normalized.role}${cleanPicCodes.length ? ` [PIC: ${cleanPicCodes.join(', ')}]` : ''}, ${normalized.status}`,
      currentUser?.email,
    );
    setModalError('');
    setEditing(null);
    setPageNotice({
      type: 'ok',
      text: exists ? `Akun ${email} berhasil diperbarui.` : `Akun baru ${email} berhasil ditambahkan.`,
    });
  };

  const requestRemoveUser = (target) => {
    const latest = readUsers();
    if (!target || target.email === currentUser?.email || usersList.some((base) => base.id === target.id)) {
      setPageNotice({ type: 'error', text: 'Akun sesi sendiri atau akun bawaan sistem tidak dapat dihapus.' });
      return;
    }
    if (target.role === 'superadmin_prp' && target.status === 'Aktif' && !latest.some((item) => item.id !== target.id && item.role === 'superadmin_prp' && item.status === 'Aktif')) {
      setPageNotice({ type: 'error', text: 'Superadmin aktif terakhir tidak dapat dihapus.' });
      return;
    }
    setConfirmAction({ type: 'delete', user: target });
  };

  const toggleUser = (user) => {
    if (user.email === currentUser?.email) {
      setPageNotice({ type: 'error', text: 'Akun sesi aktif tidak dapat dinonaktifkan sendiri.' });
      return;
    }
    const status = user.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    const latest = readUsers();
    if (user.role === 'superadmin_prp' && status === 'Nonaktif' && !latest.some((item) => item.id !== user.id && item.role === 'superadmin_prp' && item.status === 'Aktif')) {
      setPageNotice({ type: 'error', text: 'Superadmin aktif terakhir tidak dapat dinonaktifkan.' });
      return;
    }
    persist(latest.map((item) => (item.id === user.id ? { ...item, status } : item)));
    writeAudit(status === 'Aktif' ? 'AKTIFKAN_AKUN' : 'NONAKTIFKAN_AKUN', `Akun ${user.email} diubah menjadi ${status}`, currentUser?.email);
    setPageNotice({ type: 'ok', text: `Status akun ${user.email} diubah menjadi ${status}.` });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction?.user) return;
    const target = confirmAction.user;
    if (confirmAction.type === 'delete') {
      const latest = readUsers();
      persist(latest.filter((item) => item.id !== target.id));
      await deleteUserViaBackend(target.email);
      writeAudit('HAPUS_AKUN', `Akun ${target.email} dihapus`, currentUser?.email);
      setPageNotice({ type: 'ok', text: `Akun ${target.email} berhasil dihapus dari daftar akses.` });
    } else if (confirmAction.type === 'reset') {
      const temporaryPassword = resetUserPassword(target, currentUser?.email);
      setUsers(readUsers());
      setResetResult({ email: target.email, temporaryPassword, copied: false });
      setPageNotice({ type: 'ok', text: `Kata sandi sementara dibuat untuk ${target.email}.` });
    }
    setConfirmAction(null);
  };

  const filteredUsers = useMemo(() => users.filter((user) => {
    const query = searchQuery.toLowerCase();
    const picText = (user.picCodes || []).join(' ').toLowerCase();
    const unitText = String(user.unit || '').toLowerCase();
    const matchesSearch = user.name.toLowerCase().includes(query)
      || user.email.toLowerCase().includes(query)
      || unitText.includes(query)
      || picText.includes(query);
    return matchesSearch && (filterRole === 'all' || user.role === filterRole);
  }), [users, searchQuery, filterRole]);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const scroller = document.querySelector('.internal-main-scroll');
    gsap.fromTo(
      '.users-head-anim',
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.68, stagger: 0.06, ease: 'expo.out', clearProps: 'transform' }
    );
    gsap.fromTo(
      '.users-row',
      { y: 14, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.56,
        stagger: 0.04,
        ease: 'expo.out',
        clearProps: 'transform',
        scrollTrigger: scroller ? { trigger: '.users-table-card', scroller, start: 'top 90%', once: true } : undefined,
      }
    );
  }, { scope: pageRef });

  const kpiActiveCount = users.filter((item) => (item.role === 'kpi_only' || item.role === 'dual') && item.status === 'Aktif').length;
  const ikuAndDualCount = users.filter((item) => (item.role === 'iku_only' || item.role === 'dual') && item.status === 'Aktif').length;

  return (
    <section ref={pageRef} className="users-page">
      <div className="users-header">
        <div className="users-header-copy users-head-anim">
          <div className="ent-eyebrow">
            <ShieldCheck size={12} /> DIREKTORI & HAK AKSES PENGGUNA
          </div>
          <h1 className="users-title">Pengaturan Pengguna</h1>
          <p className="users-subtitle">
            Kelola akun akses PERFORMA ITPLN, penugasan Kode PIC baris indikator KPI, peran ganda IKU &amp; KPI, dan otoritas audit PRP.
          </p>
        </div>
        <button className="users-action users-head-anim" type="button" onClick={openCreate}>
          <Plus size={16} /> Tambah Akun Unit / PIC
        </button>
      </div>

      {pageNotice && (
        <div
          role={pageNotice.type === 'error' ? 'alert' : 'status'}
          style={{
            marginBottom: '1rem',
            padding: '0.8rem 1rem',
            borderRadius: '8px',
            border: pageNotice.type === 'error' ? '1px solid #FCA5A5' : '1px solid #B8CAD4',
            background: pageNotice.type === 'error' ? '#FEF2F2' : '#EDF3F6',
            color: pageNotice.type === 'error' ? '#B91C1C' : '#072534',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <span>{pageNotice.text}</span>
          <button
            type="button"
            onClick={() => setPageNotice(null)}
            aria-label="Tutup pemberitahuan"
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'grid', placeItems: 'center' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="users-stats" aria-label="Ringkasan pengguna">
        <div className="users-stat">
          <span>Total Akun</span>
          <strong>{users.length.toString().padStart(2, '0')}</strong>
          <small>Terdaftar pada sistem</small>
        </div>
        <div className="users-stat">
          <span>Akun Unit PIC KPI</span>
          <strong>{kpiActiveCount.toString().padStart(2, '0')}</strong>
          <small>Terkunci per kode PIC indikator</small>
        </div>
        <div className="users-stat">
          <span>Akun Otoritas 8 IKU</span>
          <strong>{ikuAndDualCount.toString().padStart(2, '0')}</strong>
          <small>Termasuk akun peran ganda aktif</small>
        </div>
        <button
          type="button"
          className="users-stat"
          style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
          aria-pressed={filterRole === 'superadmin_prp'}
          onClick={() => setFilterRole((role) => (role === 'superadmin_prp' ? 'all' : 'superadmin_prp'))}
        >
          <span>Akun Administrator</span>
          <strong>{users.filter((item) => item.role === 'superadmin_prp').length.toString().padStart(2, '0')}</strong>
          <small>
            {users.filter((item) => item.role === 'superadmin_prp' && item.status === 'Aktif').length} aktif ·{' '}
            {filterRole === 'superadmin_prp' ? 'klik untuk semua akun' : 'klik untuk saring admin'}
          </small>
        </button>
      </div>

      <div className="users-table-card">
        <div className="users-toolbar">
          <div className="users-search">
            <Search size={15} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari nama unit, email, atau kode PIC (mis. BAKT, LPPM)..."
              aria-label="Cari pengguna"
            />
          </div>
          <label className="users-filter">
            <SlidersHorizontal size={14} />
            <span className="sr-only">Filter peran</span>
            <select
              value={filterRole}
              onChange={(event) => setFilterRole(event.target.value)}
              aria-label="Filter peran"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <span className="users-result-count">{filteredUsers.length.toString().padStart(2, '0')} AKUN</span>
        </div>

        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Identitas Pengguna & Unit</th>
                <th>Peran Otoritas</th>
                <th>Hak Input PIC / Cakupan</th>
                <th>Aktivitas Terakhir</th>
                <th>Status & Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isCurrent = currentUser?.email === user.email;
                return (
                  <tr className={`users-row ${isCurrent ? 'is-current' : ''}`} key={user.id}>
                    <td>
                      <div className="user-identity">
                        <span className="user-avatar">{user.avatar}</span>
                        <span>
                          <strong>{user.name}</strong>
                          <small>{user.email}{user.unit ? ` · ${user.unit}` : ''}{isCurrent ? ' · Sesi Aktif Anda' : ''}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="user-role"><i />{user.roleLabel}</span>
                    </td>
                    <td className="user-scope">
                      <div>{user.accessScope}</div>
                      {(user.role === 'kpi_only' || user.role === 'dual') && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                          {(user.picCodes?.length ? user.picCodes : ['Belum dipetakan']).map((code) => (
                            <span
                              key={code}
                              style={{
                                fontFamily: 'var(--ent-mono)',
                                fontSize: '0.66rem',
                                fontWeight: 700,
                                padding: '0.12rem 0.42rem',
                                borderRadius: '4px',
                                background: '#EDF3F6',
                                border: '1px solid #D8E4EA',
                                color: '#094E68',
                              }}
                            >
                              PIC: {code}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="user-activity">{user.lastActivity}</td>
                    <td>
                      <span className={`user-status ${user.status === 'Aktif' ? 'is-active' : 'is-inactive'}`}>
                        <i />{user.status}
                      </span>
                      <div className="user-row-actions">
                        <button
                          type="button"
                          className="user-mini-btn"
                          title="Edit pengguna dan kode PIC"
                          onClick={() => {
                            setPicCatalog(readMasterPicCatalog());
                            setModalError('');
                            setEditing({ ...user, picCodes: user.picCodes || [], password: '' });
                          }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          className="user-mini-btn"
                          title="Reset kata sandi"
                          onClick={() => setConfirmAction({ type: 'reset', user })}
                        >
                          <KeyRound size={12} /> Reset
                        </button>
                        <button type="button" className="user-mini-btn" title="Aktifkan atau nonaktifkan akun" onClick={() => toggleUser(user)}>
                          {user.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        {!usersList.some((base) => base.email === user.email) && (
                          <button type="button" className="user-mini-btn danger" title="Hapus user" onClick={() => requestRemoveUser(user)}>
                            <Trash2 size={12} /> Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="users-empty">Tidak ada pengguna yang sesuai dengan kata kunci pencarian atau filter peran.</div>
          )}
        </div>

        <footer className="users-footer">
          <span>ACCESS GOVERNANCE · INTERNAL ITPLN</span>
          <span>Seluruh perubahan hak akses PIC dan reset kredensial tercatat otomatis dalam Audit Trail</span>
        </footer>
      </div>

      {editing && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tambah atau edit pengguna"
          data-lenis-prevent
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setEditing(null);
              setModalError('');
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1350,
            background: 'rgba(6, 44, 61, 0.56)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            overflowY: 'auto',
          }}
        >
          <div
            ref={modalRef}
            style={{
              width: 'min(580px, 100%)',
              maxHeight: '92dvh',
              overflowY: 'auto',
              background: '#FFFFFF',
              border: '1px solid #B8CAD4',
              borderRadius: '8px',
              boxShadow: '0 20px 48px rgba(7, 37, 52, 0.2)',
              padding: 'clamp(1.15rem, 3vw, 1.75rem)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <div className="ent-eyebrow" style={{ marginBottom: '0.35rem' }}>KONFIGURASI AKUN & HAK INPUT PIC</div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}>
                  {users.some((u) => u.id === editing.id) ? 'Edit Identitas & Kode PIC Pengguna' : 'Tambah Akun Unit / PIC Baru'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Tutup modal pengguna"
                onClick={() => {
                  setEditing(null);
                  setModalError('');
                }}
                className="ent-btn"
                style={{ minWidth: '44px', minHeight: '44px', padding: '0.45rem' }}
              >
                <X size={17} />
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                style={{
                  marginBottom: '0.9rem',
                  padding: '0.7rem 0.9rem',
                  borderRadius: '6px',
                  border: '1px solid #FCA5A5',
                  background: '#FEF2F2',
                  color: '#B91C1C',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                {modalError}
              </div>
            )}

            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  Nama Lengkap / Operator
                  <input
                    className="ent-input"
                    aria-label="Nama pengguna"
                    placeholder="Contoh: Biro Akuntansi ITPLN"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  Nama Unit Kerja
                  <input
                    className="ent-input"
                    aria-label="Unit kerja pengguna"
                    placeholder="Contoh: Biro Keuangan & Akuntansi"
                    value={editing.unit || ''}
                    onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  Alamat Email Institusi
                  <input
                    className="ent-input"
                    aria-label="Email login"
                    disabled={editing.email === currentUser?.email || usersList.some((base) => base.id === editing.id)}
                    type="email"
                    placeholder="nama.unit@itpln.ac.id"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  Kata Sandi
                  <input
                    className="ent-input"
                    aria-label="Password"
                    type="password"
                    autoComplete="new-password"
                    minLength={minimumPasswordLength()}
                    required={!users.some((user) => user.id === editing.id)}
                    placeholder={`Min. ${minimumPasswordLength()} karakter`}
                    value={editing.password || ''}
                    onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  Peran Otoritas
                  <select
                    className="ent-select"
                    aria-label="Peran"
                    disabled={editing.email === currentUser?.email}
                    value={editing.role}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  >
                    <option value="iku_only">Otoritas IKU</option>
                    <option value="kpi_only">Otoritas KPI (Unit/PIC)</option>
                    <option value="spi">Auditor SPI (View Only &amp; Audit)</option>
                    <option value="dual">Peran Ganda (IKU &amp; KPI)</option>
                    <option value="superadmin_prp">Superadmin PRP</option>
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  Status Akun
                  <select
                    className="ent-select"
                    aria-label="Status"
                    disabled={editing.email === currentUser?.email}
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  >
                    <option>Aktif</option>
                    <option>Nonaktif</option>
                  </select>
                </label>
              </div>

              {(editing.role === 'kpi_only' || editing.role === 'dual') && (
                <div
                  style={{
                    border: '1px solid #D8E4EA',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    background: '#F7FAFB',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
                      Kode PIC Penanggung Jawab KPI (Isolasi Data &amp; Hak Input Unit)
                    </span>
                    <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', color: '#0E7480', fontWeight: 700 }}>
                      {(editing.picCodes || []).length} dipilih
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.73rem', color: '#475569', lineHeight: 1.45 }}>
                    Setiap akun unit hanya dapat mengakses, melihat, mengisi, dan mengekspor baris indikator KPI yang sesuai dengan kode PIC miliknya sendiri (terisolasi dari unit lain).
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '160px', overflowY: 'auto' }}>
                    {picCatalog.map((entry) => {
                      const active = (editing.picCodes || []).some((c) => c.toLowerCase() === entry.code.toLowerCase());
                      return (
                        <button
                          key={entry.code}
                          type="button"
                          aria-pressed={active}
                          title={entry.name}
                          onClick={() => togglePicSelection(entry.code)}
                          style={{
                            minHeight: '44px',
                            padding: '0.35rem 0.72rem',
                            borderRadius: '6px',
                            border: active ? '1px solid #094E68' : '1px solid #CBD5E1',
                            background: active ? '#094E68' : '#FFFFFF',
                            color: active ? '#FFFFFF' : '#072534',
                            fontFamily: 'var(--ent-mono)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {entry.code}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: '0.7rem', paddingTop: '0.65rem', borderTop: '1px solid #D8E4EA', display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="ent-input"
                      placeholder="Kode Bagian Baru (mis. BBTI)"
                      value={newPicCodeInput}
                      onChange={(e) => setNewPicCodeInput(e.target.value)}
                      style={{ flex: '1 1 130px', minHeight: '38px', fontSize: '0.74rem' }}
                    />
                    <input
                      type="text"
                      className="ent-input"
                      placeholder="Nama Unit/Bagian Baru"
                      value={newPicNameInput}
                      onChange={(e) => setNewPicNameInput(e.target.value)}
                      style={{ flex: '2 1 180px', minHeight: '38px', fontSize: '0.74rem' }}
                    />
                    <button
                      type="button"
                      className="ent-btn"
                      style={{ minHeight: '38px', fontSize: '0.72rem', fontWeight: 700 }}
                      onClick={() => {
                        const code = newPicCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
                        if (!code) return;
                        const label = newPicNameInput.trim() ? `${newPicNameInput.trim()} (${code})` : `Bagian ${code} (${code})`;
                        const org = readOrganization();
                        const nextUnits = [...new Set([...(org.units || []), label])];
                        saveOrganization({ ...org, units: nextUnits }, currentUser?.email || 'Superadmin PRP');
                        setPicCatalog(readMasterPicCatalog());
                        togglePicSelection(code);
                        if (!editing.unit) {
                          setEditing((prev) => (prev ? { ...prev, unit: label } : prev));
                        }
                        setNewPicCodeInput('');
                        setNewPicNameInput('');
                      }}
                    >
                      <Plus size={13} /> Tambah Bagian/PIC Baru
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="ent-btn"
                style={{ minHeight: '44px' }}
                onClick={() => {
                  setEditing(null);
                  setModalError('');
                }}
              >
                Batal
              </button>
              <button className="users-action" type="button" onClick={saveUser}>
                <Check size={15} /> Simpan Pengguna
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmAction && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="users-confirm-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            background: 'rgba(6, 44, 61, 0.56)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
        >
          <div style={{ width: 'min(430px, 100%)', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #D8E4EA', padding: '1.35rem', boxShadow: '0 20px 48px rgba(7, 37, 52, 0.22)' }}>
            <h2 id="users-confirm-title" style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}>
              {confirmAction.type === 'delete' ? 'Hapus Akun Pengguna?' : 'Reset Kata Sandi Akun?'}
            </h2>
            <p style={{ margin: '0 0 1.15rem', fontSize: '0.82rem', color: '#334155', lineHeight: 1.55 }}>
              {confirmAction.type === 'delete'
                ? `Akun ${confirmAction.user.email} akan dihapus permanen dari daftar akses PERFORMA ITPLN.`
                : `Sistem akan membuat kata sandi sementara untuk ${confirmAction.user.email} dan mewajibkan penggantian pada login berikutnya.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
              <button type="button" className="ent-btn" style={{ minHeight: '44px' }} onClick={() => setConfirmAction(null)}>
                Batal
              </button>
              <button
                type="button"
                className="ent-btn ent-btn-primary"
                style={{ minHeight: '44px', ...(confirmAction.type === 'delete' ? { background: '#B91C1C', borderColor: '#B91C1C' } : {}) }}
                onClick={executeConfirmAction}
              >
                {confirmAction.type === 'delete' ? 'Ya, Hapus Akun' : 'Buat Kata Sandi Baru'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {resetResult && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="users-reset-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            background: 'rgba(6, 44, 61, 0.56)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
        >
          <div style={{ width: 'min(450px, 100%)', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #D8E4EA', padding: '1.35rem', boxShadow: '0 20px 48px rgba(7, 37, 52, 0.22)' }}>
            <h2 id="users-reset-title" style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}>
              Kata Sandi Sementara Dibuat
            </h2>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#334155', lineHeight: 1.55 }}>
              Salin kredensial sementara untuk <strong>{resetResult.email}</strong> dan serahkan secara privat kepada pemilik akun:
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.7rem 0.9rem', background: '#EDF3F6', border: '1px solid #B8CAD4', borderRadius: '6px', marginBottom: '1.1rem' }}>
              <code style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.92rem', fontWeight: 700, color: '#072534', wordBreak: 'break-all' }}>
                {resetResult.temporaryPassword}
              </code>
              <button
                type="button"
                className="ent-btn"
                style={{ minHeight: '44px' }}
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(resetResult.temporaryPassword);
                    setResetResult((prev) => (prev ? { ...prev, copied: true } : prev));
                  } catch {
                    // Clipboard API mungkin tidak tersedia di konteks non-HTTPS
                  }
                }}
              >
                <Copy size={14} /> {resetResult.copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="ent-btn ent-btn-primary" style={{ minHeight: '44px' }} onClick={() => setResetResult(null)}>
                Selesai
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
