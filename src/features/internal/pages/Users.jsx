import { useEffect, useRef, useState } from 'react';
import { Plus, Search, SlidersHorizontal, ArrowUpRight, ShieldCheck, Pencil, Trash2, X, Check } from 'lucide-react';
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

const readUsers = () => {
  return readMergedUsers().map((user) => ({ ...user, roleLabel: roleLabels[user.role] || user.role, accessScope: user.allowedPortals.join(' & ').toUpperCase(), lastActivity: user.lastActivity || 'Belum tercatat' }));
};

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
    return () => { window.removeEventListener('prp-admin-updated', refresh); window.removeEventListener('storage', refresh); };
  }, []);

  const persist = (next) => {
    setUsers(next);
    localStorage.setItem('prp_users', JSON.stringify(next));
    notifyAdminUpdated();
  };

  const openCreate = () => setEditing({ id: `user-${crypto.randomUUID()}`, name: '', email: '', password: '', role: 'kpi_only', status: 'Aktif', avatar: 'USR' });
  const saveUser = () => {
    const latest = readUsers();
    const original = latest.find((item) => item.id === editing.id);
    const email = editing.email.trim().toLowerCase();
    if (!editing.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (!original && !editing.password) || (editing.password && editing.password.length < minimumPasswordLength())) { window.alert(`Nama, email valid, dan password minimal ${minimumPasswordLength()} karakter wajib diisi (password edit boleh kosong).`); return; }
    if (latest.some((item) => item.email.toLowerCase() === email && item.id !== editing.id)) { window.alert('Email sudah digunakan.'); return; }
    if (original?.email === currentUser?.email && (email !== original.email || editing.role !== original.role || editing.status !== original.status)) { window.alert('Email, peran, dan status akun sendiri tidak dapat diubah.'); return; }
    if (original && usersList.some((base) => base.id === original.id) && email !== original.email) { window.alert('Email akun bawaan tidak dapat diubah.'); return; }
    if (original?.role === 'superadmin_prp' && original.status === 'Aktif' && (editing.role !== 'superadmin_prp' || editing.status !== 'Aktif') && !latest.some((item) => item.id !== original.id && item.role === 'superadmin_prp' && item.status === 'Aktif')) { window.alert('Minimal satu superadmin aktif harus tersedia.'); return; }
    const normalized = { ...original, ...editing, password: editing.password || original?.password, email, name: editing.name.trim(), roleLabel: roleLabels[editing.role], accessScope: editing.role === 'iku_only' ? '8 IKU Kementerian' : editing.role === 'superadmin_prp' ? 'Platform, IKU & KPI' : 'KPI Unit & Fakultas' };
    const exists = !!original;
    persist(exists ? latest.map((item) => item.id === normalized.id ? normalized : item) : [...latest, normalized]);
    writeAudit(exists ? 'EDIT_AKUN' : 'TAMBAH_AKUN', `Akun ${email}: ${normalized.role}, ${normalized.status}`, currentUser?.email);
    setEditing(null);
  };
  const removeUser = (id) => {
    const latest = readUsers();
    const target = latest.find((item) => item.id === id);
    if (!target || target.email === currentUser?.email || usersList.some((base) => base.id === id)) { window.alert('Akun sendiri/bawaan tidak dapat dihapus.'); return; }
    if (target.role === 'superadmin_prp' && target.status === 'Aktif' && !latest.some((item) => item.id !== id && item.role === 'superadmin_prp' && item.status === 'Aktif')) { window.alert('Superadmin aktif terakhir tidak dapat dihapus.'); return; }
    if (window.confirm('Hapus akun ini dari daftar akses?')) { persist(latest.filter((item) => item.id !== id)); writeAudit('HAPUS_AKUN', `Akun ${target.email} dihapus`, currentUser?.email); }
  };
  const toggleUser = (user) => {
    if (user.email === currentUser?.email) { window.alert('Akun sesi aktif tidak dapat dinonaktifkan sendiri.'); return; }
    const status = user.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    const latest = readUsers();
    if (user.role === 'superadmin_prp' && status === 'Nonaktif' && !latest.some((item) => item.id !== user.id && item.role === 'superadmin_prp' && item.status === 'Aktif')) { window.alert('Superadmin aktif terakhir tidak dapat dinonaktifkan.'); return; }
    persist(latest.map((item) => item.id === user.id ? { ...item, status } : item));
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
      .from('.users-eyebrow', { y: 12, opacity: 0, duration: 0.55 })
      .from('.users-title', { y: 24, opacity: 0, duration: 0.7 }, '-=0.3')
      .from('.users-description', { y: 16, opacity: 0, duration: 0.55 }, '-=0.45')
      .from('.users-action', { x: 18, opacity: 0, duration: 0.6 }, '<')
      .from('.users-stat', { y: 16, opacity: 0, duration: 0.45, stagger: 0.08 }, '-=0.25')
      .from('.users-toolbar', { y: 18, opacity: 0, duration: 0.6 }, '-=0.2')
      .from('.users-row', { y: 18, opacity: 0, duration: 0.5, stagger: 0.08 }, '-=0.25');

    const scroller = document.querySelector('.internal-main-scroll');
    const tableCard = pageRef.current?.querySelector('.users-table-card');

    if (scroller && tableCard) {
      gsap.from(tableCard, {
        y: 30,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: tableCard,
          scroller,
          start: 'top 86%',
          once: true,
        },
      });
    }
  }, { scope: pageRef, dependencies: [filteredUsers.length] });

  return (
    <section ref={pageRef} className="users-page">
      <div className="users-heading">
        <div>
          <div className="users-eyebrow"><ShieldCheck size={13} /> CONTROL CENTER / ACCESS MANAGEMENT</div>
          <h1 className="users-title">Manajemen pengguna</h1>
          <p className="users-description">Kelola identitas, peran, dan cakupan akses untuk ruang kerja KPI.</p>
        </div>
        <button className="users-action" type="button" onClick={openCreate}>
          <Plus size={16} /> Tambah pengguna <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="users-stats" aria-label="Ringkasan pengguna">
        <div className="users-stat"><span>Total akun</span><strong>{users.length.toString().padStart(2, '0')}</strong><small>terdaftar di sistem</small></div>
        <div className="users-stat"><span>Akses aktif</span><strong>{users.filter((item) => item.status === 'Aktif').length.toString().padStart(2, '0')}</strong><small>tidak ada anomali</small></div>
        <div className="users-stat"><span>Ruang kerja</span><strong>02</strong><small>IKU dan KPI terisolasi</small></div>
        <div className="users-stat"><span>Sesi Anda</span><strong>01</strong><small>{currentUser?.shortName || 'Administrator'}</small></div>
      </div>

      <div className="users-table-card">
        <div className="users-toolbar">
          <div className="users-search">
            <Search size={16} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cari nama atau email" aria-label="Cari pengguna" />
          </div>
          <label className="users-filter">
            <SlidersHorizontal size={15} />
            <span className="sr-only">Filter peran</span>
            <select value={filterRole} onChange={(event) => setFilterRole(event.target.value)} aria-label="Filter peran">
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <span className="users-result-count">{filteredUsers.length.toString().padStart(2, '0')} RECORDS</span>
        </div>

        <div className="users-table-wrap">
          <table className="users-table">
            <thead><tr><th>Pengguna</th><th>Peran</th><th>Cakupan akses</th><th>Aktivitas terakhir</th><th>Status</th></tr></thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isCurrent = currentUser?.email === user.email;
                return <tr className={`users-row ${isCurrent ? 'is-current' : ''}`} key={user.id} onMouseEnter={(event) => gsap.to(event.currentTarget, { x: 5, duration: 0.35, ease: 'power2.out' })} onMouseLeave={(event) => gsap.to(event.currentTarget, { x: 0, duration: 0.45, ease: 'power2.out' })}>
                  <td><div className="user-identity"><span className="user-avatar">{user.avatar}</span><span><strong>{user.name}</strong><small>{user.email}{isCurrent && ' · Sesi Anda'}</small></span></div></td>
                  <td><span className="user-role"><i />{user.roleLabel}</span></td>
                  <td className="user-scope">{user.accessScope}</td>
                  <td className="user-activity">{user.lastActivity}</td>
                  <td><span className="user-status"><i />{user.status}</span><div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}><button type="button" title="Edit user" onClick={() => setEditing({ ...user, password: '' })}><Pencil size={13} /></button><button type="button" title="Reset password" onClick={() => resetPassword(user)}>Reset</button><button type="button" title="Aktifkan atau nonaktifkan akun" onClick={() => toggleUser(user)}>{user.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}</button>{!usersList.some((base) => base.email === user.email) && <button type="button" title="Hapus user" onClick={() => removeUser(user.id)}><Trash2 size={13} /></button>}</div></td>
                </tr>;
              })}
            </tbody>
          </table>
          {filteredUsers.length === 0 && <div className="users-empty">Tidak ada pengguna yang sesuai dengan pencarian.</div>}
        </div>
        <footer className="users-footer"><span>ACCESS POLICY / INTERNAL ONLY</span><span>Perubahan akses dicatat dalam audit log</span></footer>
      </div>
      {editing && <div role="dialog" aria-modal="true" aria-label="Tambah atau edit pengguna" style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 20 }}><div style={{ width: 'min(520px, 100%)', background: '#fff', borderRadius: 16, padding: 24 }}><h2>Tambah / edit pengguna</h2><button type="button" aria-label="Tutup" onClick={() => setEditing(null)}><X size={18} /></button><div style={{ display: 'grid', gap: 12, marginTop: 18 }}><input aria-label="Nama pengguna" placeholder="Nama pengguna" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /><input aria-label="Email login" disabled={editing.email === currentUser?.email || usersList.some((base) => base.id === editing.id)} type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /><input aria-label="Password" type="password" autoComplete="new-password" minLength={minimumPasswordLength()} required={!users.some((user) => user.id === editing.id)} placeholder={`Password minimal ${minimumPasswordLength()} karakter; kosongkan saat edit untuk mempertahankan`} value={editing.password || ''} onChange={(e) => setEditing({ ...editing, password: e.target.value })} /><select aria-label="Peran" disabled={editing.email === currentUser?.email} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}><option value="iku_only">Otoritas IKU</option><option value="kpi_only">Otoritas KPI</option><option value="superadmin_prp">Superadmin PRP</option></select><select aria-label="Status" disabled={editing.email === currentUser?.email} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option>Aktif</option><option>Nonaktif</option></select></div><button className="users-action" type="button" onClick={saveUser} style={{ marginTop: 18 }}><Check size={15} /> Simpan pengguna</button></div></div>}
    </section>
  );
}
