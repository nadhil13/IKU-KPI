import { useState } from 'react';
import { Check, ShieldAlert, Sliders } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { readSystemConfig, saveSystemConfig } from '../adminStore';

export default function SystemSettings() {
  const { currentUser } = useAuth();
  const [config, setConfig] = useState(() => ({ minimumPasswordLength: 8, ...readSystemConfig() }));
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const change = (field, value) => {
    setConfig((previous) => ({ ...previous, [field]: value }));
    setFeedback({ type: '', text: '' });
  };

  const save = (event) => {
    event.preventDefault();
    const minimumPasswordLength = Number(config.minimumPasswordLength);
    if (
      !config.institutionName.trim() ||
      !Number.isInteger(minimumPasswordLength) ||
      minimumPasswordLength < 8 ||
      minimumPasswordLength > 64 ||
      (config.submissionDeadline && !Number.isFinite(new Date(config.submissionDeadline).getTime()))
    ) {
      setFeedback({
        type: 'error',
        text: 'Periksa nama institusi, panjang kata sandi (bilangan bulat 8 sampai 64), dan format tenggat yang valid.',
      });
      return;
    }
    const patch = {
      institutionName: config.institutionName.trim(),
      evidenceRequired: config.evidenceRequired,
      maintenanceMode: config.maintenanceMode,
      minimumPasswordLength,
      submissionDeadline: config.submissionDeadline || '',
    };
    const previous = { minimumPasswordLength: 8, ...readSystemConfig() };
    if (Object.keys(patch).every((key) => patch[key] === previous[key])) {
      setFeedback({ type: 'info', text: 'Tidak ada perubahan parameter untuk disimpan.' });
      return;
    }
    try {
      setConfig(saveSystemConfig(patch, currentUser?.name || currentUser?.email || 'Admin lokal'));
      window.dispatchEvent(new CustomEvent('prp-admin-updated'));
      setFeedback({ type: 'ok', text: 'Konfigurasi kebijakan sistem berhasil disimpan dan dicatat dalam audit.' });
    } catch {
      setFeedback({ type: 'error', text: 'Penyimpanan gagal. Periksa ketersediaan penyimpanan peramban.' });
    }
  };

  return (
    <form className="gov-table" onSubmit={save}>
      <div className="gov-table-head">
        <div>
          <h2>Kebijakan &amp; Parameter Sistem Global</h2>
          <span>Pengaturan identitas institusi, standar keamanan autentikasi, kewajiban bukti, dan mode pemeliharaan</span>
        </div>
        <span className="ent-badge ent-badge-info">
          <Sliders size={12} /> Parameter Global
        </span>
      </div>

      <div style={{ padding: 'clamp(1.1rem, 2.5vw, 1.5rem)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
            gap: '1.1rem',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#072534' }}>
            Nama Institusi Resmi
            <input
              className="ent-input"
              style={{ minHeight: '42px' }}
              required
              maxLength={200}
              value={config.institutionName}
              onChange={(event) => change('institutionName', event.target.value)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#072534' }}>
            Panjang Minimum Kata Sandi (8 sampai 64 karakter)
            <input
              className="ent-input"
              style={{ minHeight: '42px' }}
              type="number"
              min="8"
              max="64"
              step="1"
              required
              value={config.minimumPasswordLength}
              onChange={(event) => change('minimumPasswordLength', event.target.value)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#072534' }}>
            Tenggat Pengisian Global (Opsional)
            <input
              className="ent-input"
              style={{ minHeight: '42px' }}
              type="datetime-local"
              value={config.submissionDeadline || ''}
              onChange={(event) => change('submissionDeadline', event.target.value)}
            />
            <small style={{ fontWeight: 500, color: '#475569', fontSize: '0.7rem', lineHeight: 1.45 }}>
              Digunakan sebagai tenggat cadangan apabila periode evaluasi aktif tidak memiliki tenggat khusus.
            </small>
          </label>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: '0.9rem',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem 1.15rem',
              borderRadius: '8px',
              background: '#F7FAFB',
              border: '1px solid #D8E4EA',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: '3px', width: '16px', height: '16px' }}
              checked={config.evidenceRequired}
              onChange={(event) => change('evidenceRequired', event.target.checked)}
            />
            <div>
              <strong style={{ display: 'block', fontSize: '0.84rem', color: '#072534' }}>
                Bukti pendukung wajib (HTTPS)
              </strong>
              <span style={{ fontSize: '0.76rem', color: '#334155', lineHeight: 1.55 }}>
                Wajibkan setiap indikator yang dikirim oleh unit kerja menyertakan tautan dokumen bukti valid sebelum disetujui.
              </span>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem 1.15rem',
              borderRadius: '8px',
              background: config.maintenanceMode ? '#FFFBEB' : '#F7FAFB',
              border: config.maintenanceMode ? '1px solid #F59E0B' : '1px solid #D8E4EA',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: '3px', width: '16px', height: '16px' }}
              checked={config.maintenanceMode}
              onChange={(event) => change('maintenanceMode', event.target.checked)}
            />
            <div>
              <strong style={{ display: 'block', fontSize: '0.84rem', color: '#072534' }}>
                Mode pemeliharaan sistem
              </strong>
              <span style={{ fontSize: '0.76rem', color: '#334155', lineHeight: 1.55 }}>
                Batasi akses masuk hanya untuk akun Superadmin PRP dan bekukan sementara perubahan submission unit.
              </span>
            </div>
          </label>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
            padding: '0.9rem 1.1rem',
            borderRadius: '8px',
            background: '#F7FAFB',
            border: '1px solid #D8E4EA',
            color: '#334155',
            fontSize: '0.76rem',
            lineHeight: 1.6,
          }}
        >
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#094E68' }} />
          <span>
            Penyimpanan lokal peramban: pengaturan disimpan di peramban ini dan diterapkan langsung pada alur masuk, panjang kata sandi, tenggat pengisian, serta verifikasi bukti submission.
          </span>
        </div>

        {feedback.text && (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            style={{
              padding: '0.78rem 1rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: feedback.type === 'error' ? '#FEF2F2' : '#F7FAFB',
              border: feedback.type === 'error' ? '1px solid #FECACA' : '1px solid #094E68',
              color: feedback.type === 'error' ? '#B91C1C' : '#072534',
            }}
          >
            {feedback.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="ent-btn ent-btn-primary" type="submit" style={{ minHeight: '44px' }}>
            <Check size={15} /> Simpan Kebijakan Sistem
          </button>
        </div>
      </div>
    </form>
  );
}
