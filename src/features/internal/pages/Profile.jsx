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
  { label: 'Manajemen pengguna', key: 'admin' },
];

export default function Profile() {
  const { currentUser, updateProfile } = useAuth();
  const pageRef = useRef(null);
  const [name, setName] = useState(currentUser?.name || 'Administrator');
  const [saved, setSaved] = useState(false);

  const isAdmin = ['dual', 'superadmin_prp'].includes(currentUser?.role);
  const canAccess = (key) => key === 'admin'
    ? isAdmin
    : currentUser?.allowedPortals?.includes(key);

  useGSAP(() => {
    const scroller = document.querySelector('.internal-main-scroll');
    const revealItems = gsap.utils.toArray('.profile-reveal', pageRef.current);

    gsap.fromTo(
      '.profile-hero-item',
      { y: 24, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.08,
        ease: 'expo.out',
      },
    );

    revealItems.forEach((item, index) => {
      gsap.fromTo(
        item,
        { y: 34, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          delay: index * 0.04,
          ease: 'expo.out',
          scrollTrigger: scroller
            ? {
              trigger: item,
              scroller,
              start: 'top 88%',
              end: 'top 58%',
              toggleActions: 'play none none reverse',
            }
            : undefined,
        },
      );
    });

    gsap.to('.profile-monogram', {
      y: -18,
      rotate: 2,
      ease: 'none',
      scrollTrigger: scroller
        ? {
          trigger: pageRef.current,
          scroller,
          start: 'top top',
          end: 'bottom top',
          scrub: 1.2,
        }
        : undefined,
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
          <div className="profile-kicker profile-hero-item">
            <ShieldCheck size={14} /> SESSION / IDENTITY
          </div>
          <h1 className="profile-title profile-hero-item">Profil sesi saya</h1>
          <p className="profile-subtitle profile-hero-item">
            Pusat kendali identitas, otorisasi, dan jejak akses untuk ruang kerja KPI.
          </p>
        </div>
        <div className="profile-live-state profile-hero-item">
          <i /> Sesi aktif <span>·</span> diperbarui langsung
        </div>
      </header>

      <div className="profile-overview profile-reveal">
        <div className="profile-monogram" aria-hidden="true">
          {currentUser?.avatar || 'USR'}
        </div>
        <div className="profile-overview-main">
          <span className="profile-overline">Authenticated principal</span>
          <h2>{currentUser?.name}</h2>
          <p>{currentUser?.unit}</p>
        </div>
        <div className="profile-overview-meta">
          <span>Role</span><strong>{currentUser?.roleTitle}</strong>
          <span>Account ID</span><strong>{currentUser?.id}</strong>
        </div>
        <ArrowUpRight className="profile-corner-icon" size={18} />
      </div>

      <div className="profile-grid">
        <article className="profile-panel profile-reveal">
          <div className="profile-panel-heading">
            <span className="profile-index">01</span>
            <div>
              <span className="profile-overline">Editable record</span>
              <h3>Informasi akun</h3>
            </div>
          </div>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label>
              Nama tampilan
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Email autentikasi
              <div className="profile-input-locked">
                <Mail size={15} />
                {currentUser?.email}
                <span>LOCKED</span>
              </div>
            </label>
            <button className="profile-submit" type="submit">
              <Check size={15} /> Simpan perubahan
            </button>
            {saved && (
              <p className="profile-feedback" role="status">
                Identitas diperbarui dan disinkronkan ke sesi aktif.
              </p>
            )}
          </form>
        </article>

        <article className="profile-panel profile-reveal">
          <div className="profile-panel-heading">
            <span className="profile-index">02</span>
            <div>
              <span className="profile-overline">Authorization matrix</span>
              <h3>Cakupan otorisasi</h3>
            </div>
          </div>
          <div className="profile-access-list">
            {accessRows.map((row) => (
              <div className="profile-access-row" key={row.key}>
                <div>
                  <span className="profile-access-dot" />
                  {row.label}
                </div>
                <span className={canAccess(row.key)
                  ? 'profile-access-status is-active'
                  : 'profile-access-status'}>
                  {canAccess(row.key) ? 'ACTIVE' : 'RESTRICTED'}
                </span>
              </div>
            ))}
          </div>
          <div className="profile-note">
            <KeyRound size={15} />
            Kebijakan akses diterapkan berdasarkan peran sesi dan tidak dapat diubah
            dari halaman ini.
          </div>
        </article>
      </div>

      <div className="profile-grid profile-grid-lower">
        <article className="profile-panel profile-reveal profile-session-panel">
          <div className="profile-panel-heading">
            <span className="profile-index">03</span>
            <div>
              <span className="profile-overline">Live session</span>
              <h3>Status koneksi</h3>
            </div>
          </div>
          <div className="profile-metrics">
            <div>
              <Activity size={17} />
              <strong>ONLINE</strong>
              <span>Session channel</span>
            </div>
            <div>
              <Clock3 size={17} />
              <strong>AKTIF</strong>
              <span>Token lifetime</span>
            </div>
            <div>
              <UserRound size={17} />
              <strong>{currentUser?.shortName || 'USER'}</strong>
              <span>Current operator</span>
            </div>
          </div>
        </article>
        <article className="profile-panel profile-reveal profile-quote">
          <span className="profile-overline">Operational principle</span>
          <p>
            “Akses yang baik bukan yang paling luas, tetapi yang paling tepat,
            tercatat, dan dapat dipertanggungjawabkan.”
          </p>
          <span className="profile-signature">
            PERFORMA ITPLN / INTERNAL CONTROL
          </span>
        </article>
      </div>
    </section>
  );
}
