import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer" style={{ background: 'var(--secondary)', color: 'var(--text-light)', marginTop: 'auto' }}>
      <div className="container footer-grid">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <img src="/logo_pln.png" alt="ITPLN Logo" style={{ height: '36px', filter: 'brightness(0) invert(1)' }} />
            <h2 style={{ color: 'white', fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)' }}>PERFORMA ITPLN</h2>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.7 }}>
            Sistem Informasi Indikator Kinerja Utama (IKU) & Key Performance Indicator (KPI) Institut Teknologi PLN.
            Mendorong transparansi dan akuntabilitas kinerja institusi menuju universitas berkelas dunia.
          </p>
        </div>

        <div>
          <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1rem' }}>Tautan Cepat</h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li><Link to="/about" style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>Tentang IKU</Link></li>
            <li><Link to="/framework" style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>Kerangka Strategis</Link></li>
            <li><Link to="/documents" style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>Dokumen & Unduhan</Link></li>
            <li><Link to="/faq" style={{ color: '#cbd5e1', fontSize: '0.88rem' }}>FAQ & Kontak</Link></li>
          </ul>
        </div>

        <div>
          <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '1rem' }}>Kontak</h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.6 }}>
            <li>Jl. Lingkar Luar Barat, Menara PLN, Duri Kosambi, Cengkareng, Jakarta Barat</li>
            <li>Email: info@itpln.ac.id</li>
            <li>Telepon: (021) 5440342</li>
          </ul>
        </div>
      </div>

      <div className="container mt-8 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
        &copy; {new Date().getFullYear()} Institut Teknologi PLN. All rights reserved.
      </div>
    </footer>
  );
}
