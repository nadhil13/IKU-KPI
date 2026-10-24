import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer
      className="site-footer"
      style={{
        background: '#09090b',
        color: '#fafafa',
        marginTop: 'auto',
        borderTop: '1px solid #27272a',
        padding: '4.5rem 0 2rem',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '2.75rem',
            paddingBottom: '3.25rem',
            borderBottom: '1px solid #27272a',
          }}
        >
          {/* Brand Column */}
          <div style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.1rem' }}>
              <img src="/logo_pln.png" alt="ITPLN Logo" style={{ height: '32px', filter: 'brightness(0) invert(1)' }} />
              <div style={{ width: '1px', height: '20px', background: '#27272a' }} />
              <div>
                <h2 style={{ color: '#ffffff', fontSize: '1.08rem', margin: 0, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.03em' }}>
                  PERFORMA ITPLN
                </h2>
                <span style={{ fontFamily: 'var(--ent-mono)', fontSize: '0.58rem', color: '#a1a1aa', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  ENTERPRISE PERFORMANCE ARCHITECTURE
                </span>
              </div>
            </div>
            <p style={{ color: '#a1a1aa', fontSize: '0.84rem', lineHeight: 1.75, margin: '0 0 1.25rem' }}>
              Platform tata kelola Indikator Kinerja Utama (IKU) Kementerian dan Key Performance Indicator (KPI) Operasional Institut Teknologi PLN.
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.28rem 0.65rem',
                borderRadius: '4px',
                background: '#18181b',
                border: '1px solid #27272a',
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.62rem',
                color: '#d4d4d8',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              SPMI // DIREKTORAT PRP ITPLN
            </div>
          </div>

          {/* Navigation Column 1 */}
          <div>
            <h3 style={{ color: '#ffffff', marginBottom: '1rem', fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
              01 // EKOSISTEM KINERJA
            </h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <li><Link to="/about" style={{ color: '#a1a1aa', fontSize: '0.84rem' }}>Tentang 8 IKU</Link></li>
              <li><Link to="/iku-list" style={{ color: '#a1a1aa', fontSize: '0.84rem' }}>Katalog Indikator IKU</Link></li>
              <li><Link to="/framework" style={{ color: '#a1a1aa', fontSize: '0.84rem' }}>Kerangka Strategis PDCA</Link></li>
              <li><Link to="/login" style={{ color: '#ffffff', fontSize: '0.84rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Portal Autentikasi SSO <ArrowUpRight size={13} /></Link></li>
            </ul>
          </div>

          {/* Navigation Column 2 */}
          <div>
            <h3 style={{ color: '#ffffff', marginBottom: '1rem', fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
              02 // PANDUAN &amp; REGULASI
            </h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <li><Link to="/guide" style={{ color: '#a1a1aa', fontSize: '0.84rem' }}>Panduan Pengisian</Link></li>
              <li><Link to="/documents" style={{ color: '#a1a1aa', fontSize: '0.84rem' }}>Dokumen &amp; Kepmendikbud</Link></li>
              <li><Link to="/glossary" style={{ color: '#a1a1aa', fontSize: '0.84rem' }}>Glosarium Kinerja</Link></li>
              <li><Link to="/faq" style={{ color: '#a1a1aa', fontSize: '0.84rem' }}>Pusat Bantuan &amp; FAQ</Link></li>
            </ul>
          </div>

          {/* Contact Column */}
          <div>
            <h3 style={{ color: '#ffffff', marginBottom: '1rem', fontFamily: 'var(--ent-mono)', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
              03 // KANTOR PUSAT ITPLN
            </h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', color: '#a1a1aa', fontSize: '0.83rem', lineHeight: 1.65 }}>
              <li>Menara PLN, Jl. Lingkar Luar Barat, Duri Kosambi, Cengkareng, Jakarta Barat 11750</li>
              <li>spmi@itpln.ac.id · info@itpln.ac.id</li>
              <li>(021) 5440342</li>
            </ul>
          </div>
        </div>

        <div
          style={{
            paddingTop: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            color: '#71717a',
            fontFamily: 'var(--ent-mono)',
            fontSize: '0.68rem',
            letterSpacing: '0.04em',
          }}
        >
          <span>&copy; {CURRENT_YEAR} INSTITUT TEKNOLOGI PLN. ALL RIGHTS RESERVED.</span>
          <span>PERFORMA // ENTERPRISE GOVERNANCE PLATFORM</span>
        </div>
      </div>
    </footer>
  );
}
