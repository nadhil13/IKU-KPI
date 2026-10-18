import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function IKUList() {
  return (
    <div className="container py-24 text-center animate-fade-in" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--primary-light)', color: 'white', padding: '1.5rem', borderRadius: '50%', display: 'inline-flex', marginBottom: '2rem' }}>
        <Clock size={64} />
      </div>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Segera Hadir</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
        Halaman Daftar IKU sedang dalam tahap pengembangan dan penyempurnaan data. Kami akan segera mempublikasikannya untuk Anda.
      </p>
      <Link to="/" className="btn btn-primary">
        Kembali ke Beranda
      </Link>
    </div>
  );
}
