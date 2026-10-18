import { useRef, useState } from 'react';
import { Plus, Search, SlidersHorizontal, ArrowUpRight, ShieldCheck } from 'lucide-react';
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

export default function Users() {
  const { currentUser } = useAuth();
  const pageRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const filteredUsers = usersList.filter((user) => {
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
        <button className="users-action" type="button" onClick={() => alert('Fitur penambahan pengguna terintegrasi dengan LDAP ITPLN.')}>
          <Plus size={16} /> Tambah pengguna <ArrowUpRight size={15} />
        </button>
      </div>

      <div className="users-stats" aria-label="Ringkasan pengguna">
        <div className="users-stat"><span>Total akun</span><strong>03</strong><small>terdaftar di sistem</small></div>
        <div className="users-stat"><span>Akses aktif</span><strong>03</strong><small>tidak ada anomali</small></div>
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
                  <td><span className="user-status"><i />{user.status}</span></td>
                </tr>;
              })}
            </tbody>
          </table>
          {filteredUsers.length === 0 && <div className="users-empty">Tidak ada pengguna yang sesuai dengan pencarian.</div>}
        </div>
        <footer className="users-footer"><span>ACCESS POLICY / INTERNAL ONLY</span><span>Perubahan akses dicatat dalam audit log</span></footer>
      </div>
    </section>
  );
}
