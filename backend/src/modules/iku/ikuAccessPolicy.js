/**
 * Modul Keamanan & Validasi Pengajuan Domain IKU (8 Indikator Kinerja Utama).
 * Menjamin setiap akun unit IKU hanya dapat memperbarui submission miliknya sendiri
 * dan tidak dapat melakukan self-approval tanpa otoritas Superadmin PRP.
 */
import { appendAuditLog } from '../../services/database.js';

export function validateAndMergeIkuSubmissionsForUnit(existingList, incomingList, callerUser, ip) {
  const callerEmail = callerUser.email.toLowerCase();
  const baseArr = Array.isArray(existingList) ? existingList : [];
  const incArr = Array.isArray(incomingList) ? incomingList : [];
  const baseById = new Map(baseArr.map((r) => [r.id, r]));

  for (const rec of incArr) {
    if (!rec?.id) continue;
    const prev = baseById.get(rec.id);
    const ownerEmail = String(rec.ownerEmail || prev?.ownerEmail || '').toLowerCase();
    if (ownerEmail && ownerEmail !== callerEmail) {
      if (JSON.stringify(prev) !== JSON.stringify(rec)) {
        appendAuditLog('SECURITY_VIOLATION', `Percobaan modifikasi IKU milik ${ownerEmail} oleh ${callerEmail}`, callerEmail, ip);
        throw Object.assign(new Error('Akses ditolak: Tidak dapat mengubah submission IKU milik akun lain.'), { status: 403 });
      }
      continue;
    }
    if (['APPROVED', 'LOCKED'].includes(rec.status) && prev?.status !== rec.status) {
      appendAuditLog('SECURITY_VIOLATION', `Percobaan self-approve IKU (${rec.id}) oleh ${callerEmail}`, callerEmail, ip);
      throw Object.assign(new Error('Pelanggaran keamanan: Hanya Superadmin PRP yang berhak menyetujui IKU.'), { status: 403 });
    }
    baseById.set(rec.id, { ...rec, ownerEmail: callerEmail });
  }
  return [...baseById.values()];
}
