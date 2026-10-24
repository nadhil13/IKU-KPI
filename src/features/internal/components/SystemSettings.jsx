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
      !config.institutionName.trim()
      || !Number.isInteger(minimumPasswordLength)
      || minimumPasswordLength < 8
      || minimumPasswordLength > 64
      || (config.submissionDeadline && !Number.isFinite(new Date(config.submissionDeadline).getTime()))
    ) {
      setFeedback({ type: 'error', text: 'Periksa nama institusi, panjang password (bilangan bulat 8–64), dan format tenggat yang valid.' });
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
      setFeedback({ type: 'error', text: 'Penyimpanan gagal. Periksa ketersediaan penyimpanan browser.' });
    }
  };

  return (
    <form className="gov-table" onSubmit={save}>
      <div className="gov-table-head">
        <div>
          <h2>Kebijakan & Parameter Sistem Global</h2>
          <span>Pengaturan identitas institusi, standar keamanan autentikasi, kewajiban bukti, dan mode pemeliharaan</span>
        </div>
        <span className="ent-badge">
          <Sliders size={12} /> Policy Engine
        </span>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
            Nama Institusi Resmi
            <input
              className="ent-input"
              required
              maxLength={200}
              value={config.institutionName}
              onChange={(event) => change('institutionName', event.target.value)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
            Panjang Minimum Password (8–64 karakter)
            <input
              className="ent-input"
              type="number"
              min="8"
              max="64"
              step="1"
              required
              value={config.minimumPasswordLength}
              onChange={(event) => change('minimumPasswordLength', event.target.value)}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
            Tenggat Pengisian Global (Opsional)
            <input
              className="ent-input"
              type="datetime-local"
              value={config.submissionDeadline || ''}
              onChange={(event) => change('submissionDeadline', event.target.value)}
            />
            <small style={{ fontWeight: 500, color: '#64748b', fontSize: '0.68rem' }}>
              Digunakan sebagai fallback apabila periode evaluasi aktif tidak memiliki tenggat khusus.
            </small>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem 1.15rem',
              borderRadius: '6px',
              background: '#fafafa',
              border: '1px solid #e4e4e7',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: '3px' }}
              checked={config.evidenceRequired}
              onChange={(event) => change('evidenceRequired', event.target.checked)}
            />
            <div>
              <strong style={{ display: 'block', fontSize: '0.82rem', color: '#09090b' }}>Bukti pendukung wajib (HTTPS)</strong>
              <span style={{ fontSize: '0.73rem', color: '#52525b', lineHeight: 1.5 }}>
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
              borderRadius: '6px',
              background: config.maintenanceMode ? '#fffbeb' : '#fafafa',
              border: config.maintenanceMode ? '1px solid #fcd34d' : '1px solid #e4e4e7',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              style={{ marginTop: '3px' }}
              checked={config.maintenanceMode}
              onChange={(event) => change('maintenanceMode', event.target.checked)}
            />
            <div>
              <strong style={{ display: 'block', fontSize: '0.82rem', color: '#09090b' }}>Mode pemeliharaan sistem</strong>
              <span style={{ fontSize: '0.73rem', color: '#52525b', lineHeight: 1.5 }}>
                Batasi login hanya untuk akun Superadmin PRP dan bekukan sementara perubahan submission unit.
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
            borderRadius: '6px',
            background: '#fafafa',
            border: '1px solid #e4e4e7',
            color: '#52525b',
            fontSize: '0.74rem',
            lineHeight: 1.6,
          }}
        >
          <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#09090b' }} />
          <span>
            Mode prototipe lokal: kebijakan disimpan pada penyimpanan browser ini dan ditegakkan langsung pada alur login, panjang kata sandi, tenggat pengisian, serta verifikasi bukti submission.
          </span>
        </div>

        {feedback.text && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: feedback.type === 'error' ? '#fef2f2' : '#fafafa',
              border: feedback.type === 'error' ? '1px solid #fecaca' : '1px solid #09090b',
              color: feedback.type === 'error' ? '#b91c1c' : '#09090b',
            }}
          >
            {feedback.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="ent-btn ent-btn-teal" type="submit">
            <Check size={15} /> Simpan Kebijakan Sistem
          </button>
        </div>
      </div>
    </form>
  );
}
