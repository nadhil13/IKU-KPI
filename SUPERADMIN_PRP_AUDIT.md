# Audit SUPERADMIN PRP

## Pembaruan implementasi

Modul organisasi/PIC, pengaturan sistem, deadline periode, audit terintegrasi,
dashboard berbasis data, penggantian password wajib setelah reset, proteksi akun
administrator, serta lifecycle submission IKU dan KPI sekarang tersedia.
Submission mendukung catatan, bukti berupa tautan HTTPS, verifikasi bukti,
persetujuan, penolakan, revisi, penguncian, pembukaan kembali, dan snapshot riwayat.
Halaman IKU memakai indikator generik dengan perhitungan aktual/target, bukan
rumus resmi kementerian. Pengaturan bukti KPI berlaku setelah kebijakan disimpan.
Pusat review PRP menyediakan akses review KPI dan tautan ke review IKU;
keduanya belum digabung menjadi satu tabel lintas-modul.

Validasi akhir: lint dan build exit 0; 10 pengujian lulus. Peringatan ukuran bundle
masih ada. Semua fitur tetap prototipe browser-local, bukan keamanan produksi.
Bukti berupa tautan, bukan unggahan berkas. Log dibatasi 500 entri, bukan immutable.

Tabel di bawah adalah baseline audit sebelum pembaruan, bukan status terbaru.

Semua kewenangan administrator memakai satu role `superadmin_prp`. PRP, IKU,
dan KPI pada pemilih sidebar adalah konteks kerja, bukan tiga role administrator.

Audit source code 22 Oktober 2026. Status berikut membedakan UI dari fungsi nyata.

| Hak akses | Status | Temuan |
|---|---|---|
| Kelola akun user | Sebagian | Tambah/edit/hapus akun tambahan tersedia; akun bawaan tidak dihapus |
| Role dan workspace | Sebagian | IKU-only, KPI-only, Superadmin PRP tersedia; workspace mengikuti role, belum izin granular |
| Reset password | Prototipe lokal | Tombol reset password sementara; belum email reset, hash server, atau pemaksaan penggantian password |
| Aktif/nonaktif akun | Prototipe lokal | Status tersimpan dan diperiksa saat login; sesi yang sudah aktif belum otomatis dicabut |
| Unit, fakultas, biro, tim | Belum | TeamPIC masih placeholder; tombol Tambah PIC belum memiliki handler |
| Periode evaluasi | Sebagian | Tambah/edit periode, arsip dan buka/tutup input tersedia |
| Deadline pengisian | Belum lengkap | Field submissionDeadline ada pada data periode baru, belum editor dan enforcement deadline |
| Akun administrator | Sebagian | Role Superadmin PRP dapat dipilih; belum proteksi admin terakhir/self-demotion |
| Seluruh audit log | Sebagian | Pencatatan perubahan akun/reset tersedia; belum seluruh modul, bukan log immutable |
| Konfigurasi sistem | Belum lengkap | Store konfigurasi dasar tersedia; belum halaman pengaturan dan integrasi kebijakan |
| Terima submission user | KPI tersedia | Snapshot per formulir/periode dan akun unit tersimpan secara lokal |
| Daftar submission IKU dan KPI | Sebagian | Inbox KPI tersedia; pipeline submission IKU belum tersedia |
| Kelengkapan data | KPI tersedia | Submit memeriksa seluruh isian, format dan hasil rumus; belum checklist review manual |
| Bukti pendukung | Belum | Belum upload, tautan bukti per indikator, maupun verifikasi berkas |
| Kembalikan revisi | KPI tersedia | NEEDS_REVISION membuka pengisian unit kembali |
| Catatan revisi | KPI tersedia | Catatan wajib saat pengembalian melalui inbox |
| Setujui data | KPI tersedia | APPROVED tersedia di inbox |
| Tolak dengan alasan | Belum | Belum status REJECTED dan transisi yang sesuai |
| Kunci submission | Sebagian | Otomatis terkunci setelah submit/approve; belum tombol penguncian administratif |
| Buka kembali | Sebagian | PRP dapat mengembalikan submission yang sedang SUBMITTED; belum reopen APPROVED dengan alasan |
| Riwayat perubahan | Sebagian | Riwayat konfigurasi tersedia; submission belum menyimpan revisi nilai/status secara lengkap |

## Bug yang diperbaiki dalam audit ini

- Perubahan akun bawaan sebelumnya dibuang ketika disimpan. Sekarang override disimpan.
- Login sebelumnya memilih akun mock sebelum override; reset/status/role akun bawaan
  tidak berpengaruh. Sekarang akun tersimpan diprioritaskan.
- Tambah/edit/hapus/status/reset akun kini dicatat pada `prp_audit`.
- Tombol reset password dan aktif/nonaktif ditambahkan, dengan larangan menonaktifkan
  akun sesi aktif melalui tombol status.

## Prioritas lanjutan

1. Backend autentikasi, hash password, otorisasi API dan pencabutan sesi.
2. Satukan registri organisasi dan penugasan user; proteksi administrator terakhir.
3. Lengkapi lifecycle submission KPI: bukti, reject, lock/reopen, histori dan audit.
4. Bangun lifecycle IKU lalu satukan inbox IKU/KPI.
5. Terapkan deadline server-side sesuai periode/formulir, bukan hanya menonaktifkan UI.
6. Ganti angka dan aktivitas mock pada AdminPRPDashboard dengan data sebenarnya.

## Batas keamanan

Seluruh persistensi masih localStorage; role dan log dapat diubah melalui browser.
Guard React bukan pengganti otorisasi server. Tidak cocok untuk akun/data produksi.
Reset password lokal adalah demonstrasi; jangan gunakan password pribadi/produksi.