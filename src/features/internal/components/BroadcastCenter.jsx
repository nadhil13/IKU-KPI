import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Radio,
  Send,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Trash2,
  ArrowUpRight,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { useAuth, readMergedUsers } from '../../auth/context/AuthContext';
import { MASTER_KPI_PICS } from '../../kpi/kpiSchema';
import {
  getActiveBroadcastsForUser,
  sendRealtimeBroadcast,
  acknowledgeRealtimeBroadcast,
  stopRealtimeBroadcast,
  subscribeBroadcasts,
} from '../../../lib/realtimeSync';

const PRIORITY_STYLES = {
  URGENT: {
    label: 'INSTRUKSI MENDESAK',
    bg: '#FEF2F2',
    border: '#FCA5A5',
    badgeBg: '#991B1B',
    badgeText: '#FFFFFF',
    titleColor: '#7F1D1D',
    bodyColor: '#072534',
    icon: ShieldAlert,
  },
  IMPORTANT: {
    label: 'PENGINGAT PENTING',
    bg: '#FFFBEB',
    border: '#FCD34D',
    badgeBg: '#78350F',
    badgeText: '#FFFFFF',
    titleColor: '#78350F',
    bodyColor: '#072534',
    icon: AlertTriangle,
  },
  INFO: {
    label: 'INFORMASI TERPUSAT',
    bg: '#F7FAFB',
    border: '#94B8C7',
    badgeBg: '#094E68',
    badgeText: '#FFFFFF',
    titleColor: '#072534',
    bodyColor: '#334155',
    icon: Info,
  },
};

const QUICK_TEMPLATES = [
  {
    id: 'tpl-urgent-input',
    label: 'Segera Input & Submit KPI',
    priority: 'URGENT',
    targetType: 'ROLE',
    targetValue: 'kpi_only',
    title: 'Instruksi Pengisian & Submit Capaian KPI Periode Berjalan',
    message:
      'Dimohon kepada seluruh Penanggung Jawab (PIC) Unit untuk segera melengkapi angka realisasi, keterangan, serta bukti dukung pada baris indikator masing-masing dan menekan tombol Submit ke Sistem Pusat hari ini.',
    actionUrl: '/internal',
    actionLabel: 'Buka Lembar Kerja KPI',
  },
  {
    id: 'tpl-evidence-check',
    label: 'Lampirkan Bukti Per Baris',
    priority: 'IMPORTANT',
    targetType: 'ALL',
    targetValue: '',
    title: 'Kelengkapan Bukti Capaian (Evidence) Wajib Per Baris Indikator',
    message:
      'Setiap baris indikator wajib dilampiri dokumen resmi (unggah PDF/gambar atau tautan penyimpanan berkas HTTPS) sebelum diverifikasi oleh Direktorat PRP.',
    actionUrl: '/internal',
    actionLabel: 'Periksa Bukti Capaian',
  },
  {
    id: 'tpl-iku-reminder',
    label: 'Pengingat Capaian 8 IKU',
    priority: 'IMPORTANT',
    targetType: 'ROLE',
    targetValue: 'iku_only',
    title: 'Pemutakhiran Data Realisasi 8 Indikator Kinerja Utama (IKU)',
    message:
      'Mohon segera memperbarui angka capaian aktual dan tautan bukti pendukung pada 8 Indikator Kinerja Utama untuk keperluan rapat tinjauan manajemen.',
    actionUrl: '/internal/iku-submissions',
    actionLabel: 'Buka Pengajuan IKU',
  },
];

function formatBroadcastTargetLabel(b) {
  if (!b) return 'Semua Akun';
  if (b.targetType === 'ALL') return 'Semua Akun (IKU & PIC KPI)';
  if (b.targetType === 'ROLE') {
    return b.targetValue === 'iku_only' ? 'Otoritas Khusus IKU' : 'Seluruh Unit PIC KPI (16 Unit)';
  }
  if (b.targetType === 'PIC') return `Khusus PIC: ${b.targetValue}`;
  if (b.targetType === 'USER') return `Akun Tujuan: ${b.targetValue}`;
  return 'Semua Akun';
}

export function ActiveBroadcastBanner({ onOpenManager }) {
  const { currentUser } = useAuth();
  const [, setBroadcastVersion] = useState(0);
  const [incomingToast, setIncomingToast] = useState(null);

  useEffect(() => {
    const unsub = subscribeBroadcasts(() => {
      setBroadcastVersion((v) => v + 1);
    });
    const handleToast = (event) => {
      const bc = event.detail;
      if (bc && currentUser) {
        setIncomingToast(bc);
      }
    };
    window.addEventListener('prp-broadcast-incoming-toast', handleToast);
    return () => {
      unsub();
      window.removeEventListener('prp-broadcast-incoming-toast', handleToast);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!incomingToast) return undefined;
    const t = setTimeout(() => setIncomingToast(null), 7000);
    return () => clearTimeout(t);
  }, [incomingToast]);

  if (!currentUser) return null;

  const broadcasts = getActiveBroadcastsForUser(currentUser);
  const isSuperadmin = currentUser.role === 'superadmin_prp';
  const unacknowledged = broadcasts.filter((b) => {
    const acks = Array.isArray(b.acknowledgements) ? b.acknowledgements : [];
    return !acks.some((a) => a.email?.toLowerCase() === currentUser.email.toLowerCase());
  });

  if (unacknowledged.length === 0 && !incomingToast) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.15rem' }}>
      {incomingToast && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 1300,
            maxWidth: '420px',
            width: 'calc(100vw - 2.5rem)',
            background: '#072534',
            color: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #0E7480',
            padding: '0.95rem 1.1rem',
            boxShadow: '0 14px 32px rgba(7, 37, 52, 0.28)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                color: '#FCD34D',
                textTransform: 'uppercase',
              }}
            >
              SIARAN REALTIME BARU DARI PRP
            </span>
            <button
              type="button"
              onClick={() => setIncomingToast(null)}
              aria-label="Tutup notifikasi siaran"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={15} />
            </button>
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '0.9rem', marginTop: '0.3rem' }}>
            {incomingToast.title}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#E2E8F0', marginTop: '0.25rem', lineHeight: 1.45 }}>
            {incomingToast.message}
          </div>
        </div>
      )}

      {unacknowledged.slice(0, 3).map((b) => {
        const tone = PRIORITY_STYLES[b.priority] || PRIORITY_STYLES.IMPORTANT;
        const IconComp = tone.icon;
        const ackCount = Array.isArray(b.acknowledgements) ? b.acknowledgements.length : 0;

        return (
          <div
            key={b.id}
            role="region"
            aria-label={`Siaran instruksi: ${b.title}`}
            style={{
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              borderRadius: '8px',
              padding: '0.9rem 1.15rem',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', flex: '1 1 320px', minWidth: 0 }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  background: tone.badgeBg,
                  color: tone.badgeText,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                <IconComp size={17} />
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: tone.badgeBg,
                      color: tone.badgeText,
                    }}
                  >
                    {tone.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--ent-mono)',
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      color: '#072534',
                    }}
                  >
                    {formatBroadcastTargetLabel(b)}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
                    Oleh {b.senderName || 'Superadmin PRP'} ·{' '}
                    {b.createdAt
                      ? new Date(b.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                      : 'Baru saja'}
                  </span>
                </div>

                <div
                  style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    color: tone.titleColor,
                    marginTop: '0.35rem',
                  }}
                >
                  {b.title}
                </div>
                <p
                  style={{
                    margin: '0.22rem 0 0',
                    fontSize: '0.8rem',
                    color: tone.bodyColor,
                    lineHeight: 1.5,
                  }}
                >
                  {b.message}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', alignSelf: 'center' }}>
              {b.actionUrl && (
                <Link
                  to={b.actionUrl}
                  style={{
                    minHeight: '38px',
                    padding: '0.4rem 0.78rem',
                    borderRadius: '6px',
                    background: '#FFFFFF',
                    border: '1px solid #094E68',
                    color: '#094E68',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>{b.actionLabel || 'Buka Lembar Kerja'}</span>
                  <ArrowUpRight size={13} />
                </Link>
              )}

              <button
                type="button"
                onClick={() => acknowledgeRealtimeBroadcast(b.id, currentUser)}
                style={{
                  minHeight: '38px',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  background: '#094E68',
                  border: '1px solid #094E68',
                  color: '#FFFFFF',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <CheckCircle2 size={14} />
                <span>{isSuperadmin ? `Tutup (${ackCount} Konfirmasi)` : 'Siap Tindak Lanjut'}</span>
              </button>

              {isSuperadmin && onOpenManager && (
                <button
                  type="button"
                  onClick={onOpenManager}
                  style={{
                    minHeight: '38px',
                    padding: '0.4rem 0.72rem',
                    borderRadius: '6px',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#072534',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Kelola Siaran
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BroadcastComposerModal({ open, onClose }) {
  const { currentUser } = useAuth();
  const [, setBroadcastVersion] = useState(0);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('URGENT');
  const [targetType, setTargetType] = useState('ALL');
  const [targetValue, setTargetValue] = useState('');
  const [actionUrl, setActionUrl] = useState('/internal');
  const [actionLabel, setActionLabel] = useState('Buka Lembar Kerja');
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);

  const allAccounts = readMergedUsers().filter((u) => u.status !== 'Nonaktif');

  useEffect(() => {
    if (!open) return undefined;
    const unsub = subscribeBroadcasts(() => {
      setBroadcastVersion((v) => v + 1);
    });
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unsub();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !currentUser || currentUser.role !== 'superadmin_prp') return null;

  const broadcasts = getActiveBroadcastsForUser(currentUser);

  const applyTemplate = (tpl) => {
    setTitle(tpl.title);
    setMessage(tpl.message);
    setPriority(tpl.priority);
    setTargetType(tpl.targetType);
    setTargetValue(tpl.targetValue);
    setActionUrl(tpl.actionUrl);
    setActionLabel(tpl.actionLabel);
    setFeedback(`Template "${tpl.label}" diterapkan. Anda dapat menyesuaikan isi pesan sebelum mengirim.`);
  };

  const handleTargetTypeChange = (nextType) => {
    setTargetType(nextType);
    if (nextType === 'ALL') setTargetValue('');
    else if (nextType === 'ROLE') setTargetValue('kpi_only');
    else if (nextType === 'PIC') setTargetValue(MASTER_KPI_PICS[0]?.code || 'BAKT');
    else if (nextType === 'USER') setTargetValue(allAccounts.find((a) => a.role === 'kpi_only')?.email || 'bakt@itpln.ac.id');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFeedback('Judul dan isi pesan instruksi wajib diisi.');
      return;
    }
    setSending(true);
    try {
      const created = await sendRealtimeBroadcast(
        {
          title,
          message,
          priority,
          targetType,
          targetValue,
          actionUrl,
          actionLabel,
        },
        currentUser,
      );
      setTitle('');
      setMessage('');
      setFeedback(`Siaran "${created.title}" berhasil dikirim secara realtime ke ${formatBroadcastTargetLabel(created)}.`);
    } catch (err) {
      setFeedback(err.message || 'Gagal mengirim siaran.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pusat Siaran Instruksi Realtime PRP"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1250,
        background: 'rgba(6, 44, 61, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(0.75rem, 2.5vw, 2rem)',
      }}
    >
      <div
        data-lenis-prevent
        style={{
          width: 'min(860px, 100%)',
          maxHeight: '90dvh',
          overflowY: 'auto',
          background: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #D8E4EA',
          boxShadow: '0 24px 48px rgba(7, 37, 52, 0.22)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '1.1rem 1.35rem',
            borderBottom: '1px solid #D8E4EA',
            background: '#F7FAFB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#094E68',
                color: '#FFFFFF',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Radio size={18} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--ent-mono)',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color: '#0E7480',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                }}
              >
                PUSAT KOMANDO REALTIME // DIREKTORAT PRP
              </div>
              <h2
                style={{
                  margin: 0,
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: '#072534',
                }}
              >
                Kirim Siaran &amp; Instruksi Realtime ke Akun / Unit PIC
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog siaran"
            style={{
              minHeight: '38px',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#072534',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <X size={14} />
            <span>Tutup</span>
          </button>
        </div>

        <div style={{ padding: '1.25rem 1.35rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.45rem',
              }}
            >
              Template Instruksi Cepat (1-Klik)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {QUICK_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  style={{
                    minHeight: '36px',
                    padding: '0.38rem 0.75rem',
                    borderRadius: '6px',
                    background: '#EDF3F6',
                    border: '1px solid #B8CAD4',
                    color: '#072534',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '0.85rem',
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
                <span>Tujuan Penerima Siaran</span>
                <select
                  value={targetType}
                  onChange={(e) => handleTargetTypeChange(e.target.value)}
                  style={{
                    minHeight: '42px',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#072534',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="ALL">Semua Akun (Seluruh PIC KPI &amp; IKU)</option>
                  <option value="ROLE">Berdasarkan Kelompok Peran (PIC KPI / IKU)</option>
                  <option value="PIC">Spesifik Kode Unit PIC KPI (BAKT, PPA, LPPM, dll.)</option>
                  <option value="USER">Spesifik Akun Email Pengguna</option>
                </select>
              </label>

              {targetType === 'ROLE' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
                  <span>Pilih Kelompok Peran</span>
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    style={{
                      minHeight: '42px',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#072534',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    <option value="kpi_only">Seluruh Unit PIC KPI (16 Unit Kerja)</option>
                    <option value="iku_only">Otoritas Khusus IKU Institusi</option>
                  </select>
                </label>
              )}

              {targetType === 'PIC' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
                  <span>Pilih Kode PIC Tujuan</span>
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    style={{
                      minHeight: '42px',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#072534',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    {MASTER_KPI_PICS.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.code} ({u.name})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {targetType === 'USER' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
                  <span>Pilih Akun Tujuan</span>
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    style={{
                      minHeight: '42px',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#072534',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    {allAccounts.map((acc) => (
                      <option key={acc.email} value={acc.email}>
                        {acc.email} ({acc.unit || acc.name})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
                <span>Tingkat Prioritas</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{
                    minHeight: '42px',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#072534',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="URGENT">MENDESAK (Tampil Banner Merah + Toast Instan)</option>
                  <option value="IMPORTANT">PENTING (Pengingat Tenggat &amp; Verifikasi)</option>
                  <option value="INFO">INFORMASI UMUM (Pemberitahuan Regulasi)</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
              <span>Judul Siaran / Instruksi</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Instruksi Pengisian & Submit Capaian KPI Triwulan Berjalan"
                style={{
                  minHeight: '42px',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  color: '#072534',
                }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: '#072534' }}>
              <span>Isi Pesan Instruksi</span>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tulis instruksi lengkap untuk akun atau unit PIC yang dituju..."
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.82rem',
                  color: '#072534',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              {feedback ? (
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#094E68' }}>{feedback}</span>
              ) : (
                <span style={{ fontSize: '0.74rem', color: '#475569' }}>
                  Pesan akan langsung muncul secara realtime di layar akun penerima tanpa perlu muat ulang halaman.
                </span>
              )}

              <button
                type="submit"
                disabled={sending}
                style={{
                  minHeight: '42px',
                  padding: '0.5rem 1.15rem',
                  borderRadius: '6px',
                  background: '#094E68',
                  border: '1px solid #094E68',
                  color: '#FFFFFF',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <Send size={14} />
                <span>{sending ? 'Mengirim Siaran...' : 'Kirim Siaran Realtime Sekarang'}</span>
              </button>
            </div>
          </form>

          <div style={{ borderTop: '1px solid #D8E4EA', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontFamily: 'Outfit, sans-serif', fontSize: '0.92rem', fontWeight: 800, color: '#072534' }}>
                Daftar Siaran Aktif &amp; Status Konfirmasi Baca ({broadcasts.length})
              </h3>
            </div>

            {broadcasts.length === 0 ? (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: '6px',
                  background: '#F7FAFB',
                  border: '1px dashed #CBD5E1',
                  fontSize: '0.78rem',
                  color: '#475569',
                  textAlign: 'center',
                }}
              >
                Belum ada siaran instruksi aktif saat ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {broadcasts.map((b) => {
                  const acks = Array.isArray(b.acknowledgements) ? b.acknowledgements : [];
                  return (
                    <div
                      key={b.id}
                      style={{
                        padding: '0.75rem 0.95rem',
                        borderRadius: '6px',
                        border: '1px solid #D8E4EA',
                        background: '#F7FAFB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: '1 1 280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontFamily: 'var(--ent-mono)',
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#094E68',
                              color: '#FFFFFF',
                            }}
                          >
                            {b.priority}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#094E68' }}>
                            {formatBroadcastTargetLabel(b)}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Users size={12} /> {acks.length} akun telah mengonfirmasi
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#072534', marginTop: '0.2rem' }}>
                          {b.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: '0.1rem' }}>{b.message}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => stopRealtimeBroadcast(b.id, currentUser)}
                        style={{
                          minHeight: '36px',
                          padding: '0.35rem 0.7rem',
                          borderRadius: '6px',
                          border: '1px solid #FCA5A5',
                          background: '#FEF2F2',
                          color: '#991B1B',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Hentikan</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
