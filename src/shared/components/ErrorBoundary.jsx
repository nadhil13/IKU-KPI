import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReload = this.handleReload.bind(this);
    this.handleGoHome = this.handleGoHome.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined' && typeof console.error === 'function') {
      console.error('[PERFORMA ErrorBoundary]', error, info?.componentStack || '');
    }
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  handleGoHome() {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message = this.state.error?.message
      ? String(this.state.error.message)
      : 'Terjadi kendala saat memuat komponen antarmuka.';

    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: '60vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem 1.25rem',
          background: '#F4F7F9',
          color: '#072534',
          fontFamily: 'var(--ent-sans, Plus Jakarta Sans, system-ui, sans-serif)',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            background: '#FFFFFF',
            border: '1px solid #C8D9E1',
            borderRadius: '8px',
            padding: '1.75rem',
            boxShadow: '0 8px 24px rgba(7, 37, 52, 0.08)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--ent-mono, JetBrains Mono, monospace)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#991B1B',
              marginBottom: '0.5rem',
            }}
          >
            PEMULIHAN ANTARMUKA SISTEM
          </div>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#072534',
              margin: '0 0 0.65rem 0',
              lineHeight: 1.35,
            }}
          >
            Modul sedang membutuhkan pemuatan ulang
          </h1>
          <p
            style={{
              fontSize: '0.9rem',
              color: '#425E6D',
              margin: '0 0 1rem 0',
              lineHeight: 1.6,
            }}
          >
            Data kerja Anda di penyimpanan lokal tetap aman. Silakan muat ulang halaman untuk melanjutkan sesi kerja.
          </p>
          <div
            style={{
              background: '#F7FAFB',
              border: '1px solid #DCE7EC',
              borderRadius: '6px',
              padding: '0.65rem 0.85rem',
              fontFamily: 'var(--ent-mono, JetBrains Mono, monospace)',
              fontSize: '0.75rem',
              color: '#334155',
              marginBottom: '1.25rem',
              wordBreak: 'break-word',
            }}
          >
            {message}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                minHeight: '42px',
                padding: '0.55rem 1.1rem',
                borderRadius: '6px',
                border: '1px solid #094E68',
                background: '#094E68',
                color: '#FFFFFF',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Muat Ulang Halaman
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              style={{
                minHeight: '42px',
                padding: '0.55rem 1.1rem',
                borderRadius: '6px',
                border: '1px solid #C8D9E1',
                background: '#FFFFFF',
                color: '#072534',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }
}
