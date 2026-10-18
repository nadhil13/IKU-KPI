# Backend IKU & KPI

Folder ini disiapkan sebagai tempat backend aplikasi IKU/KPI kampus.

Backend belum diaktifkan dan belum memiliki dependency. Struktur ini hanya menjadi fondasi agar kode backend tidak bercampur dengan frontend React.

## Rencana teknologi

- Framework: Laravel API
- Database: PostgreSQL
- Autentikasi: Laravel Sanctum atau SSO kampus
- Otorisasi: role dan permission di sisi server
- Dokumentasi API: OpenAPI/Swagger

## Struktur modul

- `app/Http/Controllers/Api/Auth`: login, logout, session, MFA
- `app/Http/Controllers/Api/Users`: pengguna, role, permission, unit kerja
- `app/Http/Controllers/Api/Iku`: indikator kinerja utama
- `app/Http/Controllers/Api/Kpi`: KPI unit/fakultas dan input realisasi
- `app/Models`: model data dan relasi database
- `app/Policies`: aturan akses per resource
- `routes/api.php`: endpoint API
- `database`: migration dan seed data
- `tests`: pengujian backend

Folder `src/` yang ada saat ini hanya placeholder rancangan modular. Implementasi backend Laravel nantinya menggunakan folder `app/`, `routes/`, dan `database/` di atas.

## Catatan keamanan

- Jangan menyimpan password, token, atau secret di repository.
- Gunakan `.env` hanya ketika backend mulai dikonfigurasi.
- Validasi hak akses wajib dilakukan di backend, bukan hanya di React.
- Database dan dokumen privat tidak boleh diakses langsung dari internet.
