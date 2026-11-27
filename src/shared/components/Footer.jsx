import { Link } from 'react-router-dom';

const CURRENT_YEAR = new Date().getFullYear();

const footerLinkStyle = {
  color: '#C5DEE8',
  fontSize: '0.84rem',
  minHeight: '44px',
  display: 'inline-flex',
  alignItems: 'center',
};

export default function Footer() {
  return (
    <footer
      className="site-footer"
      style={{
        background: '#062C3D',
        color: '#F7FAFB',
        marginTop: 'auto',
        borderTop: '2px solid #1B9AAA',
      }}
    >
      <div className="container">
        <div
          className="footer-grid"
          style={{
            paddingBottom: '2.75rem',
            borderBottom: '1px solid #12485E',
          }}
        >
          <div style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <img src="/logo_pln.png" alt="Logo Institut Teknologi PLN" style={{ height: '32px', filter: 'brightness(0) invert(1)' }} />
              <div style={{ width: '1px', height: '20px', background: '#1D5E78' }} />
              <div>
                <h2 style={{ color: '#ffffff', fontSize: '1.08rem', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
                  PERFORMA ITPLN
                </h2>
                <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.58rem', color: '#B8D4E0', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  INSTITUT TEKNOLOGI PLN
                </span>
              </div>
            </div>
            <p style={{ color: '#C5DEE8', fontSize: '0.84rem', lineHeight: 1.72, margin: '0 0 1.15rem' }}>
              Portal evaluasi Indikator Kinerja Utama (IKU) Perguruan Tinggi dan Key Performance Indicator (KPI) Operasional Unit serta Fakultas di lingkungan Institut Teknologi PLN.
            </p>
            <div
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.66rem',
                fontWeight: 700,
                color: '#B8D4E0',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              SPMI · DIREKTORAT PRP ITPLN
            </div>
          </div>

          <div>
            <h3 style={{ color: '#ffffff', marginBottom: '0.65rem', fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
              NAVIGASI PORTAL &amp; REGULASI
            </h3>
            <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', columnGap: '1.25rem', rowGap: '0.15rem' }}>
              <li><Link to="/about" style={footerLinkStyle}>Tentang 8 IKU</Link></li>
              <li><Link to="/iku-list" style={footerLinkStyle}>Katalog Indikator IKU</Link></li>
              <li><Link to="/framework" style={footerLinkStyle}>Kerangka Strategis PDCA</Link></li>
              <li><Link to="/guide" style={footerLinkStyle}>Panduan Pengisian</Link></li>
              <li><Link to="/documents" style={footerLinkStyle}>Dokumen &amp; Kepmendikbud</Link></li>
              <li><Link to="/glossary" style={footerLinkStyle}>Glosarium Kinerja</Link></li>
              <li><Link to="/faq" style={footerLinkStyle}>Pusat Bantuan &amp; FAQ</Link></li>
              <li><Link to="/login" style={{ ...footerLinkStyle, color: '#ffffff', fontWeight: 700 }}>Portal Masuk Kinerja</Link></li>
            </ul>
          </div>

          <div>
            <h3 style={{ color: '#ffffff', marginBottom: '0.85rem', fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
              KAMPUS UTAMA ITPLN
            </h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', color: '#C5DEE8', fontSize: '0.83rem', lineHeight: 1.65 }}>
              <li>Menara PLN, Jl. Lingkar Luar Barat, Duri Kosambi, Cengkareng, Jakarta Barat 11750</li>
              <li>spmi@itpln.ac.id · info@itpln.ac.id</li>
              <li>(021) 5440342</li>
            </ul>
          </div>
        </div>

        <div
          style={{
            paddingTop: '1.35rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            color: '#B8D4E0',
            fontFamily: 'var(--ent-mono)',
            fontSize: '0.68rem',
            letterSpacing: '0.04em',
          }}
        >
          <span>&copy; {CURRENT_YEAR} INSTITUT TEKNOLOGI PLN. SELURUH HAK CIPTA DILINDUNGI.</span>
          <span>PERFORMA · DIREKTORAT PERENCANAAN &amp; PENGEMBANGAN</span>
        </div>
      </div>
    </footer>
  );
}
