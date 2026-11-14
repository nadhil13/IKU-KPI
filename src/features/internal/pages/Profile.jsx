import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Check,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../auth/hooks/useAuth';
import { getStoredUsers } from '../../auth/authAccounts';
import { minimumPasswordLength, notifyAdminUpdated, writeAudit } from '../adminStore';
import { changeOwnPasswordViaBackend, getRealtimeStatus, subscribeRealtimeStatus } from '../../../lib/realtimeSync';
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
  const [nameDraft, setNameDraft] = useState(null);
  const [saved, setSaved] = useState(false);
  const [rtStatus, setRtStatus] = useState(() => getRealtimeStatus());
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordStatus, setPasswordStatus] = useState(null);

  const displayName = nameDraft ?? (currentUser?.name || '');
  const isSuperadmin = currentUser?.role === 'superadmin_prp';
  const canAccess = (key) => (key === 'admin' ? isSuperadmin : currentUser?.allowedPortals?.includes(key));

  useEffect(() => subscribeRealtimeStatus((next) => setRtStatus({ ...next })), []);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
    const cleaned = displayName.trim();
    if (!cleaned) return;
    updateProfile({ name: cleaned });
    setNameDraft(null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2800);
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    const minLen = minimumPasswordLength();
    if (!currentUser) return;
    if (currentUser.password && currentPasswordInput !== currentUser.password) {
      setPasswordStatus({ type: 'error', text: 'Kata sandi saat ini tidak sesuai.' });
      return;
    }
    if (newPasswordInput.length < minLen) {
      setPasswordStatus({ type: 'error', text: `Kata sandi baru minimal ${minLen} karakter.` });
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordStatus({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok.' });
      return;
    }
    if (currentPasswordInput && newPasswordInput === currentPasswordInput) {
      setPasswordStatus({ type: 'error', text: 'Kata sandi baru harus berbeda dari kata sandi sebelumnya.' });
      return;
    }

    const res = await changeOwnPasswordViaBackend(currentPasswordInput, newPasswordInput);
    if (res.handled && !res.ok) {
      setPasswordStatus({ type: 'error', text: res.error || 'Gagal memperbarui kata sandi pada server.' });
      return;
    }

    const nextUser = { ...currentUser, password: newPasswordInput, mustChangePassword: false };
    const storedUsers = getStoredUsers().filter((u) => u.email?.toLowerCase() !== nextUser.email.toLowerCase());
    localStorage.setItem('prp_users', JSON.stringify([...storedUsers, nextUser]));
    localStorage.setItem('performa_user', JSON.stringify(nextUser));
    writeAudit('PASSWORD_DIUBAH', 'Kata sandi diubah melalui halaman profil', nextUser.email);
    notifyAdminUpdated();
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setPasswordStatus({ type: 'success', text: 'Kata sandi berhasil diperbarui untuk sesi dan login berikutnya.' });
  };

  const picText = currentUser?.picCodes?.length ? currentUser.picCodes.join(', ') : 'Tidak khusus';
  const portalText = currentUser?.allowedPortals?.length
    ? currentUser.allowedPortals.map((p) => p.toUpperCase()).join(' & ')
    : '-';

  return (
    <section ref={pageRef} className="profile-page">
      <header className="profile-hero">
        <div className="profile-hero-copy">
          <div className="ent-eyebrow profile-hero-item">
            <ShieldCheck size={12} /> IDENTITAS & KEAMANAN SESI
          </div>
          <h1 className="profile-title profile-hero-item">Profil Sesi Saya</h1>
          <p className="profile-subtitle profile-hero-item">
            Kelola nama tampilan, periksa cakupan otorisasi modul aktif, serta pantau status sinkronisasi dan kredensial Anda.
          </p>
        </div>
        <div className="profile-live-state profile-hero-item">
          <i /> {rtStatus.mode === 'server-sse' ? 'Sesi Terhubung Server' : 'Sesi Lokal Aktif'}
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
              <input value={displayName} onChange={(event) => setNameDraft(event.target.value)} required />
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
              <span className="profile-overline">Telemetri & Penugasan</span>
              <h3>Parameter Sesi</h3>
            </div>
          </div>
          <div className="profile-metrics">
            <div>
              <Activity size={17} />
              <strong>{rtStatus.mode === 'server-sse' ? 'SERVER SSE' : 'LOKAL TAB'}</strong>
              <span>Mode Sinkronisasi</span>
            </div>
            <div>
              <KeyRound size={17} />
              <strong>{picText}</strong>
              <span>Penugasan PIC KPI</span>
            </div>
            <div>
              <UserRound size={17} />
              <strong>{portalText}</strong>
              <span>Portal Diizinkan</span>
            </div>
          </div>
        </article>

        <article className="profile-panel profile-reveal">
          <div className="profile-panel-heading">
            <span className="profile-index">04</span>
            <div>
              <span className="profile-overline">Kredensial Akses</span>
              <h3>Ubah Kata Sandi</h3>
            </div>
          </div>
          <form className="profile-form" onSubmit={handlePasswordChange}>
            <label>
              Kata Sandi Saat Ini
              <input
                type="password"
                autoComplete="current-password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                required
              />
            </label>
            <label>
              Kata Sandi Baru (min. {minimumPasswordLength()} karakter)
              <input
                type="password"
                autoComplete="new-password"
                minLength={minimumPasswordLength()}
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                required
              />
            </label>
            <label>
              Konfirmasi Kata Sandi Baru
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPasswordInput}
                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                required
              />
            </label>
            <button className="profile-submit" type="submit">
              <LockKeyhole size={15} /> Perbarui Kata Sandi
            </button>
            {passwordStatus && (
              <p
                role={passwordStatus.type === 'error' ? 'alert' : 'status'}
                className="profile-feedback"
                style={
                  passwordStatus.type === 'error'
                    ? { background: '#FEF2F2', borderColor: '#FCA5A5', color: '#B91C1C' }
                    : undefined
                }
              >
                {passwordStatus.text}
              </p>
            )}
          </form>
        </article>
      </div>
    </section>
  );
}
