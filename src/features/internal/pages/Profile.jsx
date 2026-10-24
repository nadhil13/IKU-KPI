import { useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Check,
  Clock3,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../auth/context/AuthContext';
import './Profile.css';

gsap.registerPlugin(ScrollTrigger);

const accessRows = [
  { label: 'Modul 8 IKU Kementerian', key: 'iku' },
  { label: 'Modul KPI Unit & Fakultas', key: 'kpi' },
  { label: 'Tata Kelola & Manajemen Pengguna', key: 'admin' },
];

export default function Profile() {
  const { currentUser, updateProfile } = useAuth();
  const pageRef = useRef(null);
  const [name, setName] = useState(currentUser?.name || 'Administrator');
  const [saved, setSaved] = useState(false);

  const isAdmin = ['dual', 'superadmin_prp'].includes(currentUser?.role);
  const canAccess = (key) => (key === 'admin' ? isAdmin : currentUser?.allowedPortals?.includes(key));

  useGSAP(() => {
    const scroller = document.querySelector('.internal-main-scroll');
    const revealItems = gsap.utils.toArray('.profile-reveal', pageRef.current);

    gsap.fromTo(
      '.profile-hero-item',
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, stagger: 0.06, ease: 'expo.out', clearProps: 'transform' }
    );

    revealItems.forEach((item, index) => {
      gsap.fromTo(
        item,
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.72,
          delay: index * 0.04,
          ease: 'expo.out',
          clearProps: 'transform',
          scrollTrigger: scroller
            ? {
                trigger: item,
                scroller,
                start: 'top 90%',
                once: true,
              }
            : undefined,
        }
      );
    });
  }, { scope: pageRef, dependencies: [currentUser?.id] });

  const handleSubmit = (event) => {
    event.preventDefault();
    updateProfile({ name: name.trim() || currentUser.name });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2800);
  };

  return (
    <section ref={pageRef} className="profile-page">
      <header className="profile-hero">
        <div className="profile-hero-copy">
          <div className="ent-eyebrow profile-hero-item">
            <ShieldCheck size={12} /> IDENTITAS & KEAMANAN SESI
          </div>
          <h1 className="profile-title profile-hero-item">Profil Sesi Saya</h1>
          <p className="profile-subtitle profile-hero-item">
            Kelola nama tampilan, periksa cakupan otorisasi modul aktif, serta pantau parameter keamanan sesi Anda.
          </p>
        </div>
        <div className="profile-live-state profile-hero-item">
          <i /> Sesi Terautentikasi · Aktif
        </div>
      </header>

      <div className="profile-overview profile-reveal">
        <div className="profile-monogram" aria-hidden="true">
          {currentUser?.avatar || 'USR'}
        </div>
        <div className="profile-overview-main">
          <span className="profile-overline">Prinsipal Terautentikasi</span>
          <h2>{currentUser?.name}</h2>
          <p>{currentUser?.unit}</p>
        </div>
        <div className="profile-overview-meta">
          <span>Otoritas</span><strong>{currentUser?.roleTitle}</strong>
          <span>ID Sesi</span><strong>{currentUser?.id}</strong>
        </div>
        <ArrowUpRight className="profile-corner-icon" size={18} />
      </div>

      <div className="profile-grid">
        <article className="profile-panel profile-reveal">
          <div className="profile-panel-heading">
            <span className="profile-index">01</span>
            <div>
              <span className="profile-overline">Identitas Pengguna</span>
              <h3>Informasi Akun</h3>
            </div>
          </div>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label>
              Nama Tampilan Resmi
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Alamat Email Autentikasi
              <div className="profile-input-locked">
                <Mail size={15} />
                {currentUser?.email}
                <span>TERKUNCI</span>
              </div>
            </label>
            <button className="profile-submit" type="submit">
              <Check size={15} /> Simpan Perubahan Identitas
            </button>
            {saved && (
              <p className="profile-feedback" role="status">
                Identitas berhasil diperbarui dan disinkronkan ke sesi aktif.
              </p>
            )}
          </form>
        </article>

        <article className="profile-panel profile-reveal">
          <div className="profile-panel-heading">
            <span className="profile-index">02</span>
            <div>
              <span className="profile-overline">Matriks Hak Akses</span>
              <h3>Cakupan Otorisasi</h3>
            </div>
          </div>
          <div className="profile-access-list">
            {accessRows.map((row) => (
              <div className="profile-access-row" key={row.key}>
                <div>
                  <span className="profile-access-dot" />
                  {row.label}
                </div>
                <span className={canAccess(row.key) ? 'profile-access-status is-active' : 'profile-access-status'}>
                  {canAccess(row.key) ? 'DIIZINKAN' : 'DIBATASI'}
                </span>
              </div>
            ))}
          </div>
          <div className="profile-note">
            <KeyRound size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              Kebijakan isolasi akses ditetapkan berdasarkan kredensial peran sesi dan dikelola terpusat oleh Superadmin PRP.
            </span>
          </div>
        </article>
      </div>

      <div className="profile-grid profile-grid-lower">
        <article className="profile-panel profile-reveal">
          <div className="profile-panel-heading">
            <span className="profile-index">03</span>
            <div>
              <span className="profile-overline">Telemetri Sesi</span>
              <h3>Status Koneksi</h3>
            </div>
          </div>
          <div className="profile-metrics">
            <div>
              <Activity size={17} />
              <strong>ONLINE</strong>
              <span>Kanal Sesi</span>
            </div>
            <div>
              <Clock3 size={17} />
              <strong>AKTIF</strong>
              <span>Validitas Sesi</span>
            </div>
            <div>
              <UserRound size={17} />
              <strong>{currentUser?.shortName || 'USER'}</strong>
              <span>Operator Aktif</span>
            </div>
          </div>
        </article>

        <article className="profile-panel profile-reveal profile-quote">
          <span className="profile-overline">Prinsip Tata Kelola ITPLN</span>
          <p>
            “Otorisasi kinerja yang unggul bukan yang paling luas, melainkan yang paling presisi, terukur, dan dapat dipertanggungjawabkan.”
          </p>
          <span className="profile-signature">
            PERFORMA ITPLN • ENTERPRISE GOVERNANCE
          </span>
        </article>
      </div>
    </section>
  );
}
