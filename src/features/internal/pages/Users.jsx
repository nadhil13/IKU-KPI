import { useRef, useState } from 'react';
import { Plus, Search, SlidersHorizontal, ArrowUpRight, ShieldCheck, Pencil, Trash2, X, Check } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../auth/context/AuthContext';
import './Users.css';

gsap.registerPlugin(ScrollTrigger);

const usersList = [
  {
    id: 1,
    name: 'Biro Kemahasiswaan & Akademik',
    email: 'iku@itpln.ac.id',
    role: 'iku_only',
    roleLabel: 'Otoritas IKU',
    accessScope: '8 IKU Kementerian',
    status: 'Aktif',
    avatar: 'IK',
    lastActivity: 'Hari ini, 08:42',
  },
  {
    id: 2,
    name: 'Tim Kinerja Unit & Fakultas',
    email: 'kpi@itpln.ac.id',
    role: 'kpi_only',
    roleLabel: 'Otoritas KPI',
    accessScope: 'KPI Unit & Fakultas',
    status: 'Aktif',
    avatar: 'KP',
    lastActivity: 'Kemarin, 16:18',
  },
  {
    id: 3,
    name: 'Administrator Terpadu ITPLN',
    email: 'admin@itpln.ac.id',
    role: 'superadmin_prp',
    roleLabel: 'Superadmin PRP',
    accessScope: 'IKU & KPI',
    status: 'Aktif',
    avatar: 'AD',
    lastActivity: '17 Okt 2026, 13:06',
  },
];

const roleLabels = {
  all: 'Semua peran',
  iku_only: 'Otoritas IKU',
  kpi_only: 'Otoritas KPI',
  superadmin_prp: 'Superadmin PRP',
};

const readUsers = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('prp_users') || 'null');
    return Array.isArray(saved) ? [...usersList, ...saved.filter((item) => !usersList.some((base) => base.email === item.email))] : usersList;
  } catch { return usersList; }
};

export default function Users() {
  const { currentUser } = useAuth();
  const pageRef = useRef(null);
  const [users, setUsers] = useState(readUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [editing, setEditing] = useState(null);

  const persist = (next) => {
    setUsers(next);
    localStorage.setItem('prp_users', JSON.stringify(next.filter((item) => !usersList.some((base) => base.email === item.email))));
  };

  const openCreate = () => setEditing({ id: `user-${Date.now()}`, name: '', email: '', password: 'password', role: 'kpi_only', roleLabel: roleLabels.kpi_only, accessScope: 'KPI Unit & Fakultas', status: 'Aktif', avatar: 'USR', lastActivity: 'Belum pernah login' });
  const saveUser = () => {
    const email = editing.email.trim().toLowerCase();
    if (!editing.name.trim() || !email || !email.includes('@') || !editing.password?.trim()) return;
    if (users.some((item) => item.email.toLowerCase() === email && item.id !== editing.id)) return;
    const normalized = { ...editing, email, roleLabel: roleLabels[editing.role], accessScope: editing.role === 'iku_only' ? '8 IKU Kementerian' : editing.role === 'superadmin_prp' ? 'Platform, IKU & KPI' : 'KPI Unit & Fakultas' };
    const exists = users.some((item) => item.id === normalized.id);
    persist(exists ? users.map((item) => item.id === normalized.id ? normalized : item) : [...users, normalized]);
    setEditing(null);
  };
  const removeUser = (id) => { if (window.confirm('Hapus akun ini dari daftar akses?')) persist(users.filter((item) => item.id !== id)); };

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
                  <td><span className="user-status"><i />{user.status}</span><div style={{ display: 'flex', gap: 4, marginTop: 6 }}><button type="button" title="Edit user" onClick={() => setEditing({ ...user })}><Pencil size={13} /></button>{!usersList.some((base) => base.email === user.email) && <button type="button" title="Hapus user" onClick={() => removeUser(user.id)}><Trash2 size={13} /></button>}</div></td>
                </tr>;
              })}
            </tbody>
          </table>
          {filteredUsers.length === 0 && <div className="users-empty">Tidak ada pengguna yang sesuai dengan pencarian.</div>}
        </div>
        <footer className="users-footer"><span>ACCESS POLICY / INTERNAL ONLY</span><span>Perubahan akses dicatat dalam audit log</span></footer>
      </div>
      {editing && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 20 }}><div style={{ width: 'min(520px, 100%)', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(15,23,42,.2)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h2 style={{ margin: 0 }}>Tambah / edit pengguna</h2><button type="button" onClick={() => setEditing(null)}><X size={18} /></button></div><div style={{ display: 'grid', gap: 12, marginTop: 18 }}><input placeholder="Nama pengguna" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /><input placeholder="Email login" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /><input placeholder="Password awal" value={editing.password || ''} onChange={(e) => setEditing({ ...editing, password: e.target.value })} /><select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}><option value="iku_only">Otoritas IKU</option><option value="kpi_only">Otoritas KPI</option><option value="superadmin_prp">Superadmin PRP</option></select><select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option>Aktif</option><option>Nonaktif</option></select></div><button className="users-action" type="button" onClick={saveUser} style={{ marginTop: 18 }}><Check size={15} /> Simpan pengguna</button></div></div>}
    </section>
  );
}
