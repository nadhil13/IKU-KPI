# Arsitektur Backend PERFORMA ITPLN (Node.js + SQLite WAL + SSE Realtime)

Backend sistem manajemen kinerja terpadu Institut Teknologi PLN (ITPLN) yang menangani:
- **Autentikasi & Sesi Kriptografis**: PBKDF2-HMAC-SHA512 + Token HMAC-SHA256 + pencabutan sesi (`jti`).
- **Perisai Keamanan & Anti-Overload**: Rate Limiter Token Bucket per IP, Brute-Force Login Shield, Sanitasi XSS & Prototype Pollution, serta Rantai Hash Audit Trail (`SHA-256`).
- **Pemisahan Modul Domain**:
  - `src/modules/kpi/`: Otorisasi ketat per baris indikator berbasis kode PIC (`kpiAccessPolicy.js`) dan sinkronisasi struktur baris secara realtime ke formulir seluruh unit.
  - `src/modules/iku/`: Isolasi kepemilikan pengajuan 8 Indikator Kinerja Utama PTN (`ikuAccessPolicy.js`).
  - `src/modules/auth/`: Kredensial, sesi token, dan verifikasi identitas.
  - `src/modules/users/`: Sinkronisasi direktori akun dan pemetaan PIC unit kerja.
  - `src/modules/reports/`: Siaran instruksi terpusat (Broadcast Realtime) dan rantai log audit.
- **Mode Deployment**:
  - **Standalone Node Server**: `npm run start:prod` (`backend/src/server.js`)
  - **Vercel Serverless Hosting**: `api/v1/[...route].js`
