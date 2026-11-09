import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, SlidersHorizontal, ShieldCheck, Pencil, Trash2, X, Check, KeyRound
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { MOCK_ACCOUNTS, readMergedUsers, useAuth } from '../../auth/context/AuthContext';
import { normalizePicCodes, readMasterPicCatalog } from '../../kpi/kpiSchema';
import { syncActiveKpiFormUnits } from '../../kpi/kpiWorkflowStore';
import { minimumPasswordLength, notifyAdminUpdated, resetUserPassword, writeAudit } from '../adminStore';
import './Users.css';

gsap.registerPlugin(ScrollTrigger);

const usersList = MOCK_ACCOUNTS;

const roleLabels = {
  all: 'Semua peran',
  iku_only: 'Otoritas IKU',
  kpi_only: 'Otoritas KPI (Unit/PIC)',
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
  const [users, setUsers] = useState(readUsers);
  const [picCatalog, setPicCatalog] = useState(readMasterPicCatalog);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [editing, setEditing] = useState(null);

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
    if (!editing) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setEditing(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editing]);

  const persist = (next) => {
    setUsers(next);
    localStorage.setItem('prp_users', JSON.stringify(next));
    syncActiveKpiFormUnits();
    notifyAdminUpdated();
  };

  const openCreate = () => {
    setPicCatalog(readMasterPicCatalog());
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
    if (
      !editing.name.trim()
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || (!original && !editing.password)
      || (editing.password && editing.password.length < minimumPasswordLength())
    ) {
      window.alert(`Nama, email valid, dan password minimal ${minimumPasswordLength()} karakter wajib diisi (password edit boleh kosong).`);
      return;
    }
    const cleanPicCodes = editing.role === 'kpi_only' ? normalizePicCodes(editing.picCodes || []) : (editing.role === 'superadmin_prp' ? ['PRP'] : []);
    if (editing.role === 'kpi_only' && cleanPicCodes.length === 0) {
      window.alert('Pilih minimal satu Kode PIC Penanggung Jawab untuk akun Otoritas KPI agar hak akses baris indikator dapat dipetakan.');
      return;
    }
    if (latest.some((item) => item.email.toLowerCase() === email && item.id !== editing.id)) {
      window.alert('Email sudah digunakan.');
      return;
    }
    if (original?.email === currentUser?.email && (email !== original.email || editing.role !== original.role || editing.status !== original.status)) {
      window.alert('Email, peran, dan status akun sendiri tidak dapat diubah.');
      return;
    }
    if (original && usersList.some((base) => base.id === original.id) && email !== original.email) {
      window.alert('Email akun bawaan tidak dapat diubah.');
      return;
    }
    if (
      original?.role === 'superadmin_prp'
      && original.status === 'Aktif'
      && (editing.role !== 'superadmin_prp' || editing.status !== 'Aktif')
      && !latest.some((item) => item.id !== original.id && item.role === 'superadmin_prp' && item.status === 'Aktif')
    ) {
      window.alert('Minimal satu superadmin aktif harus tersedia.');
      return;
    }
    const normalized = {
      ...original,
      ...editing,
      password: editing.password || original?.password,
      email,
      name: editing.name.trim(),
      unit: (editing.unit || editing.name).trim(),
      picCodes: cleanPicCodes,
      badge: editing.role === 'kpi_only' ? `PIC: ${cleanPicCodes.join(', ')}` : (editing.role === 'superadmin_prp' ? 'SUPERADMIN PRP' : 'IKU ONLY'),
      roleTitle: editing.role === 'kpi_only' ? `PIC Unit ${cleanPicCodes.join(', ')}` : roleLabels[editing.role],
      roleLabel: roleLabels[editing.role],
      accessScope:
        editing.role === 'iku_only'
          ? '8 IKU Kementerian'
          : editing.role === 'superadmin_prp'
            ? 'Platform, IKU & KPI'
            : `KPI (${cleanPicCodes.join(', ')})`,
    };
    const exists = !!original;
    persist(exists ? latest.map((item) => (item.id === normalized.id ? normalized : item)) : [...latest, normalized]);
    writeAudit(
      exists ? 'EDIT_AKUN' : 'TAMBAH_AKUN',
      `Akun ${email}: ${normalized.role}${cleanPicCodes.length ? ` [PIC: ${cleanPicCodes.join(', ')}]` : ''}, ${normalized.status}`,
      currentUser?.email,
    );
    setEditing(null);
  };

  const removeUser = (id) => {
    const latest = readUsers();
    const target = latest.find((item) => item.id === id);
    if (!target || target.email === currentUser?.email || usersList.some((base) => base.id === id)) {
      window.alert('Akun sendiri atau akun bawaan sistem tidak dapat dihapus.');
      return;
    }
    if (target.role === 'superadmin_prp' && target.status === 'Aktif' && !latest.some((item) => item.id !== id && item.role === 'superadmin_prp' && item.status === 'Aktif')) {
      window.alert('Superadmin aktif terakhir tidak dapat dihapus.');
      return;
    }
    if (window.confirm('Hapus akun ini dari daftar akses?')) {
      persist(latest.filter((item) => item.id !== id));
      writeAudit('HAPUS_AKUN', `Akun ${target.email} dihapus`, currentUser?.email);
    }
  };

  const toggleUser = (user) => {
    if (user.email === currentUser?.email) {
      window.alert('Akun sesi aktif tidak dapat dinonaktifkan sendiri.');
      return;
    }
    const status = user.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    const latest = readUsers();
    if (user.role === 'superadmin_prp' && status === 'Nonaktif' && !latest.some((item) => item.id !== user.id && item.role === 'superadmin_prp' && item.status === 'Aktif')) {
      window.alert('Superadmin aktif terakhir tidak dapat dinonaktifkan.');
      return;
    }
    persist(latest.map((item) => (item.id === user.id ? { ...item, status } : item)));
    writeAudit(status === 'Aktif' ? 'AKTIFKAN_AKUN' : 'NONAKTIFKAN_AKUN', `Akun ${user.email} diubah menjadi ${status}`, currentUser?.email);
  };

  const resetPassword = (user) => {
    if (!window.confirm(`Reset password akun ${user.email}?`)) return;
    const temporaryPassword = resetUserPassword(user, currentUser?.email);
    setUsers(readUsers());
    window.alert(`Password sementara ${user.email}: ${temporaryPassword}`);
  };

  const filteredUsers = useMemo(() => users.filter((user) => {
    const query = searchQuery.toLowerCase();
    const picText = (user.picCodes || []).join(' ').toLowerCase();
    const matchesSearch = user.name.toLowerCase().includes(query)
      || user.email.toLowerCase().includes(query)
      || picText.includes(query);
    return matchesSearch && (filterRole === 'all' || user.role === filterRole);
  }), [users, searchQuery, filterRole]);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const entrance = gsap.timeline({ defaults: { ease: 'expo.out' } });
    entrance
      .fromTo('.users-head-anim', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, clearProps: 'transform' })
      .fromTo('.users-stat', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, clearProps: 'transform' }, '-=0.35')
      .fromTo('.users-table-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, clearProps: 'transform' }, '-=0.3');
  }, { scope: pageRef });

  return (
    <section ref={pageRef} className="users-page">
      <div className="users-heading">
        <div className="users-head-anim">
          <div className="ent-eyebrow">
            <ShieldCheck size={12} /> DIREKTORI & OTORITAS / HAK AKSES AKUN & PIC
          </div>
          <h1 className="users-title">Manajemen Pengguna & Hak Input PIC</h1>
          <p className="users-description">
            Kelola kredensial unit kerja, pemetaan kode PIC untuk pembatasan hak input baris KPI, serta pemulihan kata sandi teraudit.
          </p>
        </div>
        <button className="users-action users-head-anim" type="button" onClick={openCreate}>
          <Plus size={16} /> Tambah Akun Unit / PIC
        </button>
      </div>

      <div className="users-stats" aria-label="Ringkasan pengguna">
        <div className="users-stat">
          <span>Total Akun</span>
          <strong>{users.length.toString().padStart(2, '0')}</strong>
          <small>Terdaftar pada sistem</small>
        </div>
        <div className="users-stat">
          <span>Akun Unit PIC KPI</span>
          <strong>{users.filter((item) => item.role === 'kpi_only' && item.status === 'Aktif').length.toString().padStart(2, '0')}</strong>
          <small>Terkunci per kode PIC indikator</small>
        </div>
        <div className="users-stat">
          <span>Isolasi Modul</span>
          <strong>03</strong>
          <small>PRP · IKU · KPI per PIC</small>
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
                          <small>{user.email}{isCurrent ? ' · Sesi Aktif Anda' : ''}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="user-role"><i />{user.roleLabel}</span>
                    </td>
                    <td className="user-scope">
                      <div>{user.accessScope}</div>
                      {user.role === 'kpi_only' && (
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
                            setEditing({ ...user, picCodes: user.picCodes || [], password: '' });
                          }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button type="button" className="user-mini-btn" title="Reset password" onClick={() => resetPassword(user)}>
                          <KeyRound size={12} /> Reset
                        </button>
                        <button type="button" className="user-mini-btn" title="Aktifkan atau nonaktifkan akun" onClick={() => toggleUser(user)}>
                          {user.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        {!usersList.some((base) => base.email === user.email) && (
                          <button type="button" className="user-mini-btn danger" title="Hapus user" onClick={() => removeUser(user.id)}>
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

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tambah atau edit pengguna"
          data-lenis-prevent
          onClick={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(6, 44, 61, 0.56)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              width: 'min(580px, 100%)',
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
                onClick={() => setEditing(null)}
                className="ent-btn"
                style={{ minWidth: '44px', minHeight: '44px', padding: '0.45rem' }}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                Nama Lengkap / Unit Kerja
                <input
                  className="ent-input"
                  aria-label="Nama pengguna"
                  placeholder="Contoh: Biro Akuntansi ITPLN"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value, unit: editing.unit || e.target.value })}
                />
              </label>

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

              {editing.role === 'kpi_only' && (
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
                      Kode PIC Penanggung Jawab KPI (Hak Input Baris)
                    </span>
                    <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.68rem', color: '#0E7480', fontWeight: 700 }}>
                      {(editing.picCodes || []).length} dipilih
                    </span>
                  </div>
                  <p style={{ margin: '0 0 0.6rem', fontSize: '0.73rem', color: '#475569', lineHeight: 1.45 }}>
                    Akun ini dapat melihat seluruh indikator KPI secara transparan (View Only), namun hanya diizinkan mengisi nilai, bukti, dan keterangan pada baris yang memiliki salah satu kode PIC terpilih di bawah ini.
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
                            minHeight: '34px',
                            padding: '0.28rem 0.6rem',
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
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.6rem', marginTop: '1.5rem' }}>
              <button type="button" className="ent-btn" onClick={() => setEditing(null)}>
                Batal
              </button>
              <button className="users-action" type="button" onClick={saveUser}>
                <Check size={15} /> Simpan Pengguna
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
