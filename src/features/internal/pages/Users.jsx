import { useEffect, useRef, useState } from 'react';
import {
  Plus, Search, SlidersHorizontal, ArrowUpRight, ShieldCheck, Pencil, Trash2, X, Check, KeyRound
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { MOCK_ACCOUNTS, readMergedUsers, useAuth } from '../../auth/context/AuthContext';
import { minimumPasswordLength, notifyAdminUpdated, resetUserPassword, writeAudit } from '../adminStore';
import './Users.css';

gsap.registerPlugin(ScrollTrigger);

const usersList = MOCK_ACCOUNTS;

const roleLabels = {
  all: 'Semua peran',
  iku_only: 'Otoritas IKU',
  kpi_only: 'Otoritas KPI',
  superadmin_prp: 'Superadmin PRP',
};

const readUsers = () =>
  readMergedUsers().map((user) => ({
    ...user,
    roleLabel: roleLabels[user.role] || user.role,
    accessScope: user.allowedPortals.join(' & ').toUpperCase(),
    lastActivity: user.lastActivity || 'Belum tercatat',
  }));

export default function Users() {
  const { currentUser } = useAuth();
  const pageRef = useRef(null);
  const [users, setUsers] = useState(readUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const refresh = () => setUsers(readUsers());
    window.addEventListener('prp-admin-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('prp-admin-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const persist = (next) => {
    setUsers(next);
    localStorage.setItem('prp_users', JSON.stringify(next));
    notifyAdminUpdated();
  };

  const openCreate = () =>
    setEditing({
      id: `user-${crypto.randomUUID()}`,
      name: '',
      email: '',
      password: '',
      role: 'kpi_only',
      status: 'Aktif',
      avatar: 'USR',
    });

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
      roleLabel: roleLabels[editing.role],
      accessScope:
        editing.role === 'iku_only'
          ? '8 IKU Kementerian'
          : editing.role === 'superadmin_prp'
            ? 'Platform, IKU & KPI'
            : 'KPI Unit & Fakultas',
    };
    const exists = !!original;
    persist(exists ? latest.map((item) => (item.id === normalized.id ? normalized : item)) : [...latest, normalized]);
    writeAudit(exists ? 'EDIT_AKUN' : 'TAMBAH_AKUN', `Akun ${email}: ${normalized.role}, ${normalized.status}`, currentUser?.email);
    setEditing(null);
  };

  const removeUser = (id) => {
    const latest = readUsers();
    const target = latest.find((item) => item.id === id);
    if (!target || target.email === currentUser?.email || usersList.some((base) => base.id === id)) {
      window.alert('Akun sendiri/bawaan tidak dapat dihapus.');
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

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
    return matchesSearch && (filterRole === 'all' || user.role === filterRole);
  });

  useGSAP(() => {
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
            <ShieldCheck size={12} /> DIREKTORI & OTORITAS / MANAJEMEN PENGGUNA
          </div>
          <h1 className="users-title">Manajemen Pengguna & Akses</h1>
          <p className="users-description">
            Kelola kredensial, isolasi otoritas ruang kerja (IKU, KPI, maupun Superadmin PRP), serta pemulihan kata sandi teraudit.
          </p>
        </div>
        <button className="users-action users-head-anim" type="button" onClick={openCreate}>
          <Plus size={16} /> Tambah Pengguna <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="users-stats" aria-label="Ringkasan pengguna">
        <div className="users-stat">
          <span>Total Akun</span>
          <strong>{users.length.toString().padStart(2, '0')}</strong>
          <small>Terdaftar pada sistem</small>
        </div>
        <div className="users-stat">
          <span>Sesi & Status Aktif</span>
          <strong>{users.filter((item) => item.status === 'Aktif').length.toString().padStart(2, '0')}</strong>
          <small>Siap melakukan autentikasi</small>
        </div>
        <div className="users-stat">
          <span>Isolasi Modul</span>
          <strong>03</strong>
          <small>PRP · IKU · KPI terpisah</small>
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
              placeholder="Cari nama pengguna atau alamat email…"
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
                <th>Identitas Pengguna</th>
                <th>Peran Otoritas</th>
                <th>Cakupan Ruang Kerja</th>
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
                    <td className="user-scope">{user.accessScope}</td>
                    <td className="user-activity">{user.lastActivity}</td>
                    <td>
                      <span className={`user-status ${user.status === 'Aktif' ? 'is-active' : 'is-inactive'}`}>
                        <i />{user.status}
                      </span>
                      <div className="user-row-actions">
                        <button type="button" className="user-mini-btn" title="Edit user" onClick={() => setEditing({ ...user, password: '' })}>
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
          <span>ACCESS GOVERNANCE • INTERNAL ITPLN</span>
          <span>Seluruh perubahan hak akses dan reset kredensial tercatat otomatis dalam Audit Trail</span>
        </footer>
      </div>

      {/* Modal Tambah / Edit Pengguna */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tambah atau edit pengguna"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(15, 23, 42, 0.38)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            padding: '1.25rem',
          }}
        >
          <div
            style={{
              width: 'min(520px, 100%)',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              boxShadow: '0 24px 56px rgba(15, 23, 42, 0.18)',
              padding: '1.75rem',
              animation: 'drawerSlideDown 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <div className="ent-eyebrow" style={{ marginBottom: '0.35rem' }}>KONFIGURASI AKUN</div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontFamily: 'Outfit, sans-serif', color: '#0f172a' }}>
                  {users.some((u) => u.id === editing.id) ? 'Edit Identitas Pengguna' : 'Tambah Pengguna Baru'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Tutup"
                onClick={() => setEditing(null)}
                className="ent-btn"
                style={{ padding: '0.45rem' }}
              >
                <X size={17} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                Nama Lengkap / Unit
                <input
                  className="ent-input"
                  aria-label="Nama pengguna"
                  placeholder="Contoh: Direktorat Akademik ITPLN"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>

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
                  placeholder={`Minimal ${minimumPasswordLength()} karakter (kosongkan saat edit untuk mempertahankan)`}
                  value={editing.password || ''}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                    <option value="kpi_only">Otoritas KPI</option>
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.5rem' }}>
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
