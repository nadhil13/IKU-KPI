import { useState } from 'react';
import { useAuth } from '../../auth/context/AuthContext';
import { readSystemConfig, saveSystemConfig } from '../adminStore';

export default function SystemSettings() {
  const { currentUser } = useAuth();
  const [config, setConfig] = useState(() => ({ minimumPasswordLength: 8, ...readSystemConfig() }));
  const [feedback, setFeedback] = useState('');
  const change = (field, value) => { setConfig((previous) => ({ ...previous, [field]: value })); setFeedback(''); };
  const save = (event) => {
    event.preventDefault();
    const minimumPasswordLength = Number(config.minimumPasswordLength);
    if (!config.institutionName.trim() || !Number.isInteger(minimumPasswordLength) || minimumPasswordLength < 8 || minimumPasswordLength > 64
      || (config.submissionDeadline && !Number.isFinite(new Date(config.submissionDeadline).getTime()))) {
      setFeedback('Periksa nama institusi, panjang password (bilangan bulat 8–64), dan tenggat yang valid.');
      return;
    }
    const patch = { institutionName: config.institutionName.trim(), evidenceRequired: config.evidenceRequired, maintenanceMode: config.maintenanceMode, minimumPasswordLength, submissionDeadline: config.submissionDeadline || '' };
    const previous = { minimumPasswordLength: 8, ...readSystemConfig() };
    if (Object.keys(patch).every((key) => patch[key] === previous[key])) { setFeedback('Tidak ada perubahan untuk disimpan.'); return; }
    try {
      setConfig(saveSystemConfig(patch, currentUser?.name || currentUser?.email || 'Admin lokal'));
      window.dispatchEvent(new CustomEvent('prp-admin-updated'));
      setFeedback('Konfigurasi berhasil disimpan dan dicatat dalam audit.');
    } catch { setFeedback('Penyimpanan gagal. Periksa ketersediaan penyimpanan browser.'); }
  };
  return (
    <form className="gov-table" onSubmit={save}>
      <div className="gov-table-head"><div><h2>Pengaturan sistem</h2><span>Konfigurasi institusi dan kebijakan pengisian</span></div></div>
      <div style={{ padding: '1.2rem', display: 'grid', gap: '1rem' }}>
        <label>Nama institusi<input className="gov-field" required maxLength={200} value={config.institutionName} onChange={(event) => change('institutionName', event.target.value)} /></label>
        <label>Panjang minimum password<input className="gov-field" type="number" min="8" max="64" step="1" required value={config.minimumPasswordLength} onChange={(event) => change('minimumPasswordLength', event.target.value)} /></label>
        <label>Tenggat global (opsional)<input className="gov-field" type="datetime-local" value={config.submissionDeadline || ''} onChange={(event) => change('submissionDeadline', event.target.value)} /></label>
        <small>Tenggat global menjadi fallback jika periode tidak memiliki tenggat sendiri. Semua waktu menggunakan zona waktu lokal browser.</small>
        <label><input type="checkbox" checked={config.evidenceRequired} onChange={(event) => change('evidenceRequired', event.target.checked)} /> Bukti pendukung wajib</label>
        <label><input type="checkbox" checked={config.maintenanceMode} onChange={(event) => change('maintenanceMode', event.target.checked)} /> Mode pemeliharaan</label>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>Demo lokal: pengaturan dan audit hanya tersimpan di browser ini, bukan kebijakan keamanan server. Mode pemeliharaan, kewajiban bukti, tenggat, dan panjang password tidak otomatis ditegakkan pada login atau submission. Integrasi backend diperlukan untuk penerapan menyeluruh. Audit lokal dapat diubah/dihapus dan dibatasi 500 entri.</p>
        <div role="status" aria-live="polite">{feedback}</div>
        <button className="gov-button" type="submit">Simpan konfigurasi</button>
      </div>
    </form>
  );
}