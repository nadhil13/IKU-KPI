import { Plus, Search } from 'lucide-react';

export default function TeamPIC() {
  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Tim & PIC</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manajemen penanggung jawab (Person In Charge) untuk setiap IKU</p>
        </div>
        <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
          <Plus size={18} /> Tambah PIC
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <div style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Cari tim/PIC..."
              style={{ width: '100%', padding: '0.5rem 1rem 0.5rem 2.5rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(0,0,0,0.1)', outline: 'none' }}
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--background)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Nama Unit / Prodi</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Nama PIC</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>IKU Tanggungan</th>
              <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Status Laporan</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <td colSpan={4} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Belum ada data Tim & PIC yang ditambahkan.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
