const AUDIT_KEY = 'prp_audit';
const CONFIG_KEY = 'prp_system_config';
const ORG_KEY = 'prp_organization';
export const notifyAdminUpdated = () => window.dispatchEvent(new Event('prp-admin-updated'));
export const minimumPasswordLength = () => Math.max(8, Math.min(64, Number(readSystemConfig().minimumPasswordLength) || 8));

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
};

export const readSystemConfig = () => read(CONFIG_KEY, {
  institutionName: 'Institut Teknologi PLN',
  submissionDeadline: '',
  evidenceRequired: true,
  maintenanceMode: false,
});

export const saveSystemConfig = (patch, actor = 'Superadmin PRP') => {
  const next = { ...readSystemConfig(), ...patch, updatedAt: new Date().toISOString(), updatedBy: actor };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  notifyAdminUpdated();
  writeAudit('KONFIGURASI_SISTEM', 'Konfigurasi sistem diperbarui', actor);
  return next;
};

export const readOrganization = () => read(ORG_KEY, { units: [], faculties: [], bureaus: [], teams: [] });
export const saveOrganization = (organization, actor = 'Superadmin PRP') => {
  localStorage.setItem(ORG_KEY, JSON.stringify(organization));
  notifyAdminUpdated();
  writeAudit('STRUKTUR_ORGANISASI', 'Struktur unit/fakultas/biro/tim diperbarui', actor);
  return organization;
};

export const writeAudit = (action, detail, actor = 'Superadmin PRP') => {
  const entries = read(AUDIT_KEY, []);
  const entry = { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, action, detail, actor, at: new Date().toISOString() };
  localStorage.setItem(AUDIT_KEY, JSON.stringify([entry, ...entries].slice(0, 500)));
  notifyAdminUpdated();
  return entry;
};
export const readAudit = () => read(AUDIT_KEY, []);

export const resetUserPassword = (user, actor = 'Superadmin PRP') => {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.max(16, minimumPasswordLength())));
  const temporaryPassword = Array.from(bytes, (byte) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[byte & 63]).join('');
  const users = read('prp_users', []);
  const next = users.map((item) => item.email === user.email ? { ...item, password: temporaryPassword, mustChangePassword: true } : item);
  if (!users.some((item) => item.email === user.email)) next.push({ ...user, password: temporaryPassword, mustChangePassword: true });
  localStorage.setItem('prp_users', JSON.stringify(next));
  notifyAdminUpdated();
  writeAudit('RESET_PASSWORD', `Password akun ${user.email} direset`, actor);
  return temporaryPassword;
};