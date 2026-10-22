import { useEffect, useMemo, useState } from 'react';
import { Building2, GitBranch, Pencil, Plus, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import { MOCK_ACCOUNTS, useAuth } from '../../auth/context/AuthContext';
import { readOrganization, saveOrganization } from '../adminStore';
import './TeamPIC.css';

const TYPES = { units: 'Unit', faculties: 'Fakultas', bureaus: 'Biro', teams: 'Tim' };
const blank = (type = 'units') => ({ type, name: '', code: '', parentId: '', picEmail: '' });
const loadOrganization = () => {
  const value = readOrganization() || {};
  return Object.fromEntries(Object.keys(TYPES).map((type) => [type, Array.isArray(value[type]) ? value[type] : []]));
};
const loadAccounts = () => {
  let stored = [];
  try {
    const value = JSON.parse(localStorage.getItem('prp_users') || '[]');
    if (Array.isArray(value)) stored = value;
  } catch {}
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
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

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
  const updateField = (name, value) => {
    setEditor((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };
  const submit = (event) => {
    event.preventDefault();
    if (!editor || !canEdit) return;
    const latest = loadOrganization();
    const list = flatten(latest);
    const normalized = { ...editor, name: editor.name.trim(), code: editor.code.trim().toUpperCase() };
    const nextErrors = {};
    if (!normalized.name) nextErrors.name = 'Nama organisasi wajib diisi.';
    if (normalized.name.length > 120) nextErrors.name = 'Nama maksimal 120 karakter.';
    if (list.some((item) => keyOf(item) !== editingKey && item.type === editor.type && item.name?.toLowerCase() === normalized.name.toLowerCase())) {
      nextErrors.name = 'Nama sudah digunakan dalam kategori ini.';
    }
    if (normalized.code && !/^[A-Z0-9._-]{1,24}$/.test(normalized.code)) nextErrors.code = 'Kode organisasi tidak valid.';
    if (normalized.code && list.some((item) => keyOf(item) !== editingKey && item.code?.toUpperCase() === normalized.code)) {
      nextErrors.code = 'Kode organisasi sudah digunakan.';
    }
    const parent = list.find((item) => keyOf(item) === normalized.parentId);
    if (normalized.parentId && (!parent || keyOf(parent) === editingKey || isDescendant(parent, editingKey, list))) {
      nextErrors.parentId = 'Induk tidak valid atau menyebabkan siklus hierarki.';
    }
    if (normalized.picEmail && !loadAccounts().some((account) => account.email === normalized.picEmail && account.status !== 'Nonaktif')) {
      nextErrors.picEmail = 'Pilih akun PIC yang masih aktif.';
    }
    if (editingKey && !list.some((item) => keyOf(item) === editingKey)) nextErrors.name = 'Organisasi telah dihapus. Tutup formulir dan coba kembali.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const { type, ...record } = normalized;
    record.id = editor.id || `org-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next = {
      ...latest,
      [type]: editingKey
        ? latest[type].map((item) => String(item.id) === String(record.id) ? record : item)
        : [...latest[type], record],
    };
    try {
      saveOrganization(next, currentUser.email || currentUser.name);
      setOrganization(next);
      setEditor(null);
      setMessage(editingKey ? 'Organisasi berhasil diperbarui.' : 'Organisasi berhasil ditambahkan.');
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
    if (!window.confirm(`Hapus ${TYPES[item.type].toLowerCase()} “${item.name}”?`)) return;
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
    <section className="team-pic-page">
      <header className="tp-heading">
        <div><span className="tp-eyebrow"><GitBranch size={14} /> PUSAT KENDALI / ORGANISASI</span><h1>Struktur organisasi</h1><p>Satukan unit, fakultas, biro, dan tim dengan penanggung jawab yang jelas.</p></div>
        {canEdit && <button className="tp-primary" onClick={() => openEditor()}><Plus size={17} /> Tambah organisasi</button>}
      </header>
      <div className="tp-stats">{Object.entries(TYPES).map(([type, label]) => <button key={type} className={`tp-stat ${filter === type ? 'is-selected' : ''}`} onClick={() => setFilter(filter === type ? 'all' : type)}><Building2 size={19} /><span>{label}<strong>{organization[type].length}</strong></span></button>)}</div>
      {!canEdit && <div className="tp-readonly"><ShieldCheck size={18} /> Mode baca saja. Hanya Superadmin PRP yang dapat mengelola organisasi.</div>}
      {message && <div className="tp-success" role="status">{message}</div>}
      {canEdit && editor && <form className="tp-editor" onSubmit={submit} noValidate>
        <div className="tp-editor-heading"><div><h2>{editingKey ? 'Edit organisasi' : 'Organisasi baru'}</h2><p>Kolom bertanda * wajib diisi.</p></div><button type="button" className="tp-icon" onClick={() => setEditor(null)}><X size={20} /></button></div>
        <div className="tp-fields">
          <label>Kategori *<select value={editor.type} disabled={!!editingKey} onChange={(event) => updateField('type', event.target.value)}>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Nama organisasi *<input autoFocus maxLength={120} value={editor.name} onChange={(event) => updateField('name', event.target.value)} />{errors.name && <small className="tp-field-error">{errors.name}</small>}</label>
          <label>Kode organisasi<input maxLength={24} value={editor.code} onChange={(event) => updateField('code', event.target.value)} />{errors.code && <small className="tp-field-error">{errors.code}</small>}</label>
          <label>Organisasi induk<select value={editor.parentId} onChange={(event) => updateField('parentId', event.target.value)}><option value="">Tanpa induk</option>{parents.map((item) => <option key={keyOf(item)} value={keyOf(item)}>{TYPES[item.type]} · {item.name}</option>)}</select>{errors.parentId && <small className="tp-field-error">{errors.parentId}</small>}</label>
          <label className="tp-wide">Penanggung jawab (PIC)<select value={editor.picEmail} onChange={(event) => updateField('picEmail', event.target.value)}><option value="">Belum ditugaskan</option>{accounts.map((account) => <option key={account.email} value={account.email} disabled={account.status === 'Nonaktif'}>{account.name || account.email} · {account.email}</option>)}</select>{errors.picEmail && <small className="tp-field-error">{errors.picEmail}</small>}</label>
        </div>
        <div className="tp-form-actions"><button type="button" className="tp-secondary" onClick={() => setEditor(null)}>Batal</button><button type="submit" className="tp-primary">Simpan organisasi</button></div>
      </form>}
      <div className="tp-directory">
        <div className="tp-toolbar"><label className="tp-search"><Search size={18} /><input aria-label="Cari organisasi atau PIC" placeholder="Cari organisasi, kode, atau PIC…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Semua kategori</option>{Object.entries(TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span>{visible.length} dari {rows.length} organisasi</span></div>
        <div className="tp-table-scroll"><table><thead><tr><th>Organisasi</th><th>Kategori</th><th>Organisasi induk</th><th>PIC</th>{canEdit && <th>Aksi</th>}</tr></thead><tbody>{visible.map((item) => { const pic = picOf(item); const children = rows.filter((child) => child.parentId === keyOf(item)).length; return <tr key={keyOf(item)}><td><div className="tp-identity"><span className="tp-avatar"><Building2 size={19} /></span><div><strong>{item.name}</strong><small>{item.code || 'Tanpa kode'}</small></div></div></td><td><span className={`tp-badge tp-${item.type}`}>{TYPES[item.type]}</span></td><td>{parentOf(item)?.name || 'Tingkat utama'}</td><td>{item.picEmail ? <div className="tp-pic"><strong>{pic?.name || 'Akun tidak tersedia'}</strong><small>{item.picEmail}</small></div> : <span className="tp-unassigned"><Users size={14} /> Belum ditugaskan</span>}</td>{canEdit && <td><button className="tp-icon" onClick={() => openEditor(item)}><Pencil size={16} /></button><button className="tp-icon tp-danger" disabled={children > 0} onClick={() => remove(item)}><Trash2 size={16} /></button></td>}</tr>; })}</tbody></table></div>
        {!visible.length && <div className="tp-empty"><GitBranch size={34} /><h2>{rows.length ? 'Tidak ada hasil yang cocok' : 'Mulai bangun struktur organisasi'}</h2><p>{rows.length ? 'Coba kata kunci lain atau ubah filter kategori.' : 'Daftar organisasi akan muncul di sini.'}</p></div>}
      </div>
    </section>
  );
}
