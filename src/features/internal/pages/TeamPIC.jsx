import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Database, GitBranch, Pencil, Plus, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MOCK_ACCOUNTS, useAuth } from '../../auth/context/AuthContext';
import { MASTER_KPI_PICS, extractPicCodeFromOrgEntry } from '../../kpi/kpiSchema';
import { readOrganization, saveOrganization } from '../adminStore';
import './TeamPIC.css';

const TYPES = { units: 'Unit Kerja', faculties: 'Fakultas', bureaus: 'Biro', teams: 'Tim Kerja' };
const blank = (type = 'units') => ({ type, name: '', code: '', parentId: '', picEmail: '' });
const createOrgId = () => `org-${crypto.randomUUID()}`;

const DEFAULT_PIC_EMAIL_BY_CODE = {
  PPA: 'ppa@itpln.ac.id',
  BAKT: 'bakt@itpln.ac.id',
  BAG: 'bag@itpln.ac.id',
  BKU: 'bku@itpln.ac.id',
  PJM: 'pjm@itpln.ac.id',
  PRP: 'prp.unit@itpln.ac.id',
  BPKA: 'bpka@itpln.ac.id',
  BKK: 'bkk@itpln.ac.id',
  BKAI: 'bkai@itpln.ac.id',
  BPIK: 'bpik@itpln.ac.id',
  BKM: 'bpik@itpln.ac.id',
  BSAR: 'bpik@itpln.ac.id',
  BPAD: 'bpik@itpln.ac.id',
  FAK: 'fak@itpln.ac.id',
  LPPM: 'lppm@itpln.ac.id',
  SDM: 'sdm@itpln.ac.id',
  BSDM: 'sdm@itpln.ac.id',
  BKAN: 'bkan@itpln.ac.id',
  BPTI: 'bpti@itpln.ac.id',
  SPI: 'spi@itpln.ac.id',
  Akuntansi: 'spi@itpln.ac.id',
  WBS: 'spi@itpln.ac.id',
};

const normalizeOrgItem = (entry, idx, type) => {
  if (entry && typeof entry === 'object') {
    return {
      id: entry.id || `org-${type}-${idx}`,
      name: String(entry.name || ''),
      code: String(entry.code || ''),
      parentId: String(entry.parentId || ''),
      picEmail: String(entry.picEmail || ''),
    };
  }
  const label = String(entry || '').trim();
  const extractedCode = extractPicCodeFromOrgEntry(label);
  return {
    id: `org-${type}-${idx}-${extractedCode || 'item'}`,
    name: label,
    code: extractedCode,
    parentId: '',
    picEmail: DEFAULT_PIC_EMAIL_BY_CODE[extractedCode] || '',
  };
};

const loadOrganization = () => {
  const value = readOrganization() || {};
  return Object.fromEntries(
    Object.keys(TYPES).map((type) => [
      type,
      Array.isArray(value[type]) ? value[type].map((entry, idx) => normalizeOrgItem(entry, idx, type)) : [],
    ]),
  );
};

const loadAccounts = () => {
  let stored = [];
  try {
    const value = JSON.parse(localStorage.getItem('prp_users') || '[]');
    if (Array.isArray(value)) stored = value;
  } catch { /* fallback */ }
  const accounts = new Map();
  [...MOCK_ACCOUNTS, ...stored].forEach((account) => {
    if (typeof account?.email !== 'string') return;
    const email = account.email.trim().toLowerCase();
    if (email) accounts.set(email, { ...accounts.get(email), ...account, email });
  });
  return [...accounts.values()];
};

const flatten = (organization) => Object.entries(organization).flatMap(([type, items]) => items.map((item) => ({ ...item, type })));
const keyOf = (item) => `${item.type}:${item.id}`;

export default function TeamPIC() {
  const pageRef = useRef(null);
  const { currentUser } = useAuth();
  const canEdit = currentUser?.role === 'superadmin_prp';
  const [organization, setOrganization] = useState(loadOrganization);
  const [accounts, setAccounts] = useState(loadAccounts);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState(null);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    const sync = (event) => {
      if (!event.key || event.key === 'prp_organization') setOrganization(loadOrganization());
      if (!event.key || event.key === 'prp_users') setAccounts(loadAccounts());
    };
    const local = () => sync({});
    window.addEventListener('storage', sync);
    window.addEventListener('prp-admin-updated', local);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('prp-admin-updated', local);
    };
  }, []);

  useEffect(() => {
    if (!editor) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setEditor(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.tp-anim-head', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, clearProps: 'transform' })
      .fromTo('.tp-stat', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, clearProps: 'transform' }, '-=0.35')
      .fromTo('.tp-directory', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.65, clearProps: 'transform' }, '-=0.3');
  }, { scope: pageRef });

  const rows = useMemo(() => flatten(organization), [organization]);
  const parentOf = (item) => rows.find((candidate) => keyOf(candidate) === item.parentId);
  const picOf = (item) => accounts.find((account) => account.email === item.picEmail);
  const editingKey = editor?.id == null ? null : keyOf(editor);

  const isDescendant = (candidate, target, list = rows) => {
    const visited = new Set();
    let item = candidate;
    while (item?.parentId && !visited.has(keyOf(item))) {
      visited.add(keyOf(item));
      if (item.parentId === target) return true;
      item = list.find((entry) => keyOf(entry) === item.parentId);
    }
    return false;
  };

  const parents = rows.filter((item) => keyOf(item) !== editingKey && !isDescendant(item, editingKey));
  const visible = rows.filter((item) => {
    const text = [item.name, item.code, TYPES[item.type], parentOf(item)?.name, picOf(item)?.name, item.picEmail]
      .join(' ')
      .toLowerCase();
    return (filter === 'all' || item.type === filter) && text.includes(query.trim().toLowerCase());
  });

  const openEditor = (item) => {
    if (!canEdit) return;
    setAccounts(loadAccounts());
    setEditor(item ? { ...blank(item.type), ...item } : blank(filter === 'all' ? 'units' : filter));
    setErrors({});
    setMessage('');
  };

  const handleSeedMasterPics = () => {
    if (!canEdit) return;
    const latest = loadOrganization();
    const existingCodes = new Set(flatten(latest).map((item) => String(item.code || '').toLowerCase()).filter(Boolean));
    const next = {
      units: [...latest.units],
      faculties: [...latest.faculties],
      bureaus: [...latest.bureaus],
      teams: [...latest.teams],
    };
    let addedCount = 0;
    MASTER_KPI_PICS.forEach((pic) => {
      if (existingCodes.has(pic.code.toLowerCase())) return;
      const category = TYPES[pic.category] ? pic.category : 'units';
      next[category].push({
        id: `org-master-${pic.code.toLowerCase()}`,
        name: pic.name,
        code: pic.code,
        parentId: '',
        picEmail: DEFAULT_PIC_EMAIL_BY_CODE[pic.code] || '',
      });
      existingCodes.add(pic.code.toLowerCase());
      addedCount += 1;
    });
    saveOrganization(next, currentUser?.email || currentUser?.name || 'Superadmin PRP');
    setOrganization(next);
    setMessage(
      addedCount > 0
        ? `${addedCount} master unit & kode PIC resmi ITPLN berhasil disinkronkan ke direktori.`
        : 'Seluruh 22 master unit & kode PIC resmi ITPLN sudah terdaftar dalam direktori.',
    );
  };

  const updateField = (name, value) => {
    setEditor((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!editor || !canEdit) return;
    const latest = loadOrganization();
    const list = flatten(latest);
    const trimmedCode = editor.code.trim();
    const canonicalMaster = MASTER_KPI_PICS.find((m) => m.code.toLowerCase() === trimmedCode.toLowerCase());
    const normalized = {
      ...editor,
      name: editor.name.trim(),
      code: canonicalMaster ? canonicalMaster.code : trimmedCode.toUpperCase(),
    };
    const nextErrors = {};
    if (!normalized.name) nextErrors.name = 'Nama organisasi wajib diisi.';
    if (normalized.name.length > 120) nextErrors.name = 'Nama maksimal 120 karakter.';
    if (list.some((item) => keyOf(item) !== editingKey && item.type === editor.type && item.name?.toLowerCase() === normalized.name.toLowerCase())) {
      nextErrors.name = 'Nama sudah digunakan dalam kategori ini.';
    }
    if (normalized.code && !/^[A-Za-z0-9._-]{1,24}$/.test(normalized.code)) nextErrors.code = 'Kode organisasi tidak valid.';
    if (normalized.code && list.some((item) => keyOf(item) !== editingKey && item.code?.toLowerCase() === normalized.code.toLowerCase())) {
      nextErrors.code = 'Kode organisasi sudah digunakan.';
    }
    const parent = list.find((item) => keyOf(item) === normalized.parentId);
    if (normalized.parentId && (!parent || keyOf(parent) === editingKey || isDescendant(parent, editingKey, list))) {
      nextErrors.parentId = 'Induk tidak valid atau menyebabkan siklus hierarki.';
    }
    if (normalized.picEmail && !loadAccounts().some((account) => account.email === normalized.picEmail && account.status !== 'Nonaktif')) {
      nextErrors.picEmail = 'Pilih akun PIC yang masih aktif.';
    }
    if (editingKey && !list.some((item) => keyOf(item) === editingKey)) {
      nextErrors.name = 'Organisasi telah dihapus. Tutup formulir dan coba kembali.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const { type, ...record } = normalized;
    record.id = editor.id || createOrgId();
    const next = {
      ...latest,
      [type]: editingKey
        ? latest[type].map((item) => (String(item.id) === String(record.id) ? record : item))
        : [...latest[type], record],
    };
    try {
      saveOrganization(next, currentUser.email || currentUser.name);
      setOrganization(next);
      setEditor(null);
      setMessage(editingKey ? 'Struktur organisasi & kode PIC berhasil diperbarui.' : 'Entitas organisasi & kode PIC baru berhasil ditambahkan.');
    } catch {
      setMessage('Penyimpanan gagal. Periksa penyimpanan browser lalu coba kembali.');
    }
  };

  const remove = (item) => {
    if (!canEdit) return;
    const latest = loadOrganization();
    if (flatten(latest).some((child) => child.parentId === keyOf(item))) {
      setMessage('Pindahkan atau hapus organisasi anak sebelum menghapus induknya.');
      return;
    }
    if (!window.confirm(`Hapus ${TYPES[item.type].toLowerCase()} "${item.name}"?`)) return;
    const next = { ...latest, [item.type]: latest[item.type].filter((entry) => String(entry.id) !== String(item.id)) };
    try {
      saveOrganization(next, currentUser.email || currentUser.name);
      setOrganization(next);
      if (editingKey === keyOf(item)) setEditor(null);
      setMessage('Organisasi berhasil dihapus.');
    } catch {
      setMessage('Penghapusan gagal. Periksa penyimpanan browser lalu coba kembali.');
    }
  };

  return (
    <section ref={pageRef} className="team-pic-page">
      <header className="tp-heading">
        <div className="tp-anim-head">
          <span className="ent-eyebrow"><GitBranch size={12} /> DIREKTORI & OTORITAS / MASTER PIC UNIT KERJA</span>
          <h1>Struktur Organisasi & Master PIC</h1>
          <p>Master data unit kerja, fakultas, biro, dan tim pelaksana yang tersinkronisasi langsung dengan kolom PIC pada Desainer Tabel KPI.</p>
        </div>
        {canEdit && (
          <div className="tp-anim-head" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button type="button" className="tp-secondary" onClick={handleSeedMasterPics}>
              <Database size={15} /> Muat 22 Master PIC ITPLN
            </button>
            <button type="button" className="tp-primary" onClick={() => openEditor()}>
              <Plus size={16} /> Tambah Entitas / PIC
            </button>
          </div>
        )}
      </header>

      <div className="tp-stats" role="group" aria-label="Filter kategori struktur organisasi">
        {Object.entries(TYPES).map(([type, label]) => (
          <button
            key={type}
            type="button"
            aria-pressed={filter === type}
            className={`tp-stat ${filter === type ? 'is-selected' : ''}`}
            onClick={() => setFilter(filter === type ? 'all' : type)}
          >
            <span className="tp-stat-icon"><Building2 size={18} /></span>
            <span>
              {label}
              <strong>{String(organization[type].length).padStart(2, '0')}</strong>
            </span>
          </button>
        ))}
      </div>

      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #D8E4EA',
          borderRadius: '8px',
          padding: '0.95rem 1.15rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
          <strong style={{ fontSize: '0.8rem', color: '#072534', fontFamily: 'Outfit, sans-serif' }}>
            Katalog Kode PIC Resmi Tabel KPI ITPLN ({MASTER_KPI_PICS.length} Kode Master)
          </strong>
          <span style={{ fontSize: '0.73rem', color: '#475569' }}>
            Setiap kode organisasi baru yang ditambahkan di halaman ini otomatis tersedia pada kolom PIC Desainer Tabel KPI.
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {MASTER_KPI_PICS.map((entry) => (
            <span
              key={entry.code}
              title={entry.name}
              style={{
                fontFamily: 'var(--ent-mono)',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                background: '#EDF3F6',
                border: '1px solid #D8E4EA',
                color: '#094E68',
              }}
            >
              {entry.code}
            </span>
          ))}
        </div>
      </div>

      {!canEdit && (
        <div className="tp-readonly">
          <ShieldCheck size={16} /> Mode baca direktori. Pengelolaan struktur organisasi dikhususkan bagi otoritas Superadmin PRP.
        </div>
      )}

      {message && <div className="tp-success" role="status">{message}</div>}

      {canEdit && editor && (
        <form className="tp-editor" onSubmit={submit} noValidate>
          <div className="tp-editor-heading">
            <div>
              <h2>{editingKey ? 'Perbarui Entitas Organisasi & Kode PIC' : 'Registrasi Entitas Organisasi & Kode PIC Baru'}</h2>
              <p>Kode Organisasi berfungsi sebagai kode PIC pada Desainer Tabel KPI serta hak akses input lembar kerja unit.</p>
            </div>
            <button type="button" className="tp-icon" aria-label="Tutup editor" onClick={() => setEditor(null)}>
              <X size={17} />
            </button>
          </div>
          <div className="tp-fields">
            <label>
              Kategori *
              <select value={editor.type} disabled={!!editingKey} onChange={(event) => updateField('type', event.target.value)}>
                {Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Nama Organisasi *
              <input autoFocus maxLength={120} placeholder="Contoh: Biro Akuntansi (BAKT)" value={editor.name} onChange={(event) => updateField('name', event.target.value)} />
              {errors.name && <small className="tp-field-error">{errors.name}</small>}
            </label>
            <label>
              Kode PIC / Organisasi
              <input maxLength={24} placeholder="Contoh: BAKT" value={editor.code} onChange={(event) => updateField('code', event.target.value)} />
              {errors.code && <small className="tp-field-error">{errors.code}</small>}
            </label>
            <label>
              Organisasi Induk
              <select value={editor.parentId} onChange={(event) => updateField('parentId', event.target.value)}>
                <option value="">Tingkat Utama (Tanpa Induk)</option>
                {parents.map((item) => <option key={keyOf(item)} value={keyOf(item)}>{TYPES[item.type]} · {item.name}</option>)}
              </select>
              {errors.parentId && <small className="tp-field-error">{errors.parentId}</small>}
            </label>
            <label className="tp-wide">
              Akun Penanggung Jawab (PIC)
              <select value={editor.picEmail} onChange={(event) => updateField('picEmail', event.target.value)}>
                <option value="">Belum ditugaskan</option>
                {accounts.map((account) => (
                  <option key={account.email} value={account.email} disabled={account.status === 'Nonaktif'}>
                    {account.name || account.email} · {account.email}{account.picCodes?.length ? ` (PIC: ${account.picCodes.join(', ')})` : ''}
                  </option>
                ))}
              </select>
              {errors.picEmail && <small className="tp-field-error">{errors.picEmail}</small>}
            </label>
          </div>
          <div className="tp-form-actions">
            <button type="button" className="tp-secondary" onClick={() => setEditor(null)}>Batal</button>
            <button type="submit" className="tp-primary">Simpan Organisasi</button>
          </div>
        </form>
      )}

      <div className="tp-directory">
        <div className="tp-toolbar">
          <label className="tp-search">
            <Search size={16} color="#475569" />
            <input
              aria-label="Cari organisasi atau PIC"
              placeholder="Cari nama organisasi, kode PIC, atau email akun..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select aria-label="Filter kategori organisasi" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Semua kategori</option>
            {Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <span className="tp-toolbar-count">{visible.length} dari {rows.length} entitas</span>
        </div>

        <div className="tp-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Entitas Organisasi</th>
                <th>Kode PIC</th>
                <th>Kategori</th>
                <th>Hierarki Induk</th>
                <th>Akun Penanggung Jawab</th>
                {canEdit && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const pic = picOf(item);
                const children = rows.filter((child) => child.parentId === keyOf(item)).length;
                return (
                  <tr key={keyOf(item)}>
                    <td>
                      <div className="tp-identity">
                        <span className="tp-avatar"><Building2 size={17} /></span>
                        <div>
                          <strong>{item.name}</strong>
                          <small>{TYPES[item.type]}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {item.code ? (
                        <span
                          style={{
                            fontFamily: 'var(--ent-mono)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: '#EDF3F6',
                            border: '1px solid #D8E4EA',
                            color: '#094E68',
                          }}
                        >
                          {item.code}
                        </span>
                      ) : (
                        <span style={{ color: '#475569', fontSize: '0.76rem' }}>Tanpa kode</span>
                      )}
                    </td>
                    <td>
                      <span className={`tp-badge tp-${item.type}`}>{TYPES[item.type]}</span>
                    </td>
                    <td style={{ color: '#334155' }}>{parentOf(item)?.name || 'Tingkat Utama'}</td>
                    <td>
                      {item.picEmail ? (
                        <div className="tp-pic">
                          <strong>{pic?.name || 'Akun terdaftar'}</strong>
                          <small>{item.picEmail}</small>
                        </div>
                      ) : (
                        <span className="tp-unassigned"><Users size={14} /> Belum ditugaskan</span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button type="button" className="tp-icon" aria-label={`Edit organisasi ${item.name}`} title="Edit organisasi" onClick={() => openEditor(item)}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="tp-icon tp-danger" aria-label={`Hapus organisasi ${item.name}`} title="Hapus organisasi" disabled={children > 0} onClick={() => remove(item)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!visible.length && (
          <div className="tp-empty">
            <GitBranch size={30} color="#475569" style={{ margin: '0 auto' }} />
            <h2>{rows.length ? 'Tidak ada entitas yang cocok' : 'Direktori organisasi masih kosong'}</h2>
            <p>
              {rows.length
                ? 'Gunakan kata kunci berbeda atau atur ulang filter kategori.'
                : 'Klik tombol "Muat 22 Master PIC ITPLN" di bagian atas untuk mengisi seluruh master unit kerja resmi secara instan.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
