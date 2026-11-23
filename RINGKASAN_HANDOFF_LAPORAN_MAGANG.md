# Handoff Penulisan Laporan Magang

Dokumen ini merangkum keputusan, konteks proyek, data kegiatan, dan revisi laporan yang telah disepakati. Gunakan dokumen ini sebagai konteks awal saat melanjutkan penulisan dengan AI agent lain.

## 1. Identitas mahasiswa

- Nama: Muhammad Nadhil Arsy Al-Wafi
- NIM: 202331303
- Program studi: S1 Teknik Informatika
- Fakultas: Fakultas Telematika Energi
- Institusi: Institut Teknologi PLN
- Lokasi pelaksanaan: Pusat Perencanaan dan Pengembangan (PRP) Institut Teknologi PLN
- Periode magang: 10 September sampai 10 Desember 2026

## 2. Judul laporan yang digunakan

Gunakan judul yang sama pada sampul, halaman judul, lembar pengesahan, daftar isi, dan bagian laporan lain:

> **PERANCANGAN DAN PENGEMBANGAN WEBSITE PENGELOLAAN KEY PERFORMANCE INDICATOR (KPI) DI PUSAT PERENCANAAN DAN PENGEMBANGAN INSTITUT TEKNOLOGI PLN**

Fokus laporan hanya pada **KPI**. IKU dapat disebut secara singkat sebagai konteks, tetapi tidak menjadi objek utama, modul utama, atau judul laporan.

## 3. Istilah dan nama unit yang wajib konsisten

Nama resmi terbaru yang digunakan:

> **Pusat Perencanaan dan Pengembangan (PRP)**

Jangan gunakan lagi istilah berikut dalam versi final:

- Pusat Riset dan Pengembangan
- Bagian atau Pusat Perencanaan dan Pengembangan
- Perusahaan, jika konteksnya ITPLN sebagai perguruan tinggi

Gunakan istilah:

- institusi
- perguruan tinggi
- unit kerja
- Pusat Perencanaan dan Pengembangan (PRP)

Jika laporan menyebut fungsi yang berhubungan dengan KPI, gunakan kalimat hati-hati:

> Proyek pengembangan website KPI berada dalam lingkup kegiatan Pusat Perencanaan dan Pengembangan (PRP), khususnya yang berkaitan dengan pengelolaan dan pengendalian kinerja.

Jangan menyatakan mahasiswa berada di Bagian Pengendalian Kinerja (BPK) kecuali ada konfirmasi resmi. Jika sudah dikonfirmasi, gunakan:

> Pelaksanaan magang dilakukan pada Bagian Pengendalian Kinerja (BPK), yang berada di bawah Pusat Perencanaan dan Pengembangan (PRP) Institut Teknologi PLN.

## 4. Struktur organisasi PRP terbaru

Gunakan bagan struktur terbaru yang diberikan pengguna, bukan struktur lama pada dokumen.

Struktur yang terlihat pada bagan:

- Rektor
- Direktur Pusat Perencanaan dan Pengembangan (PRP)
- Manager Bagian Perencanaan Strategis dan Manajemen Risiko (BPSR)
  - Staff PRP
- Manager Bagian Pengendalian Kinerja (BPK)
  - Analyst PRP
- Manager Bagian Pengembangan Institusi (BPI)
  - Staff PRP

Nama yang terlihat pada bagan terbaru:

- Direktur PRP: Pritasari Palupiningsih, S.Kom., M.Kom.
- Manager BPSR: Tiara Ramadhanti Puspo, S.Si., M.Si.
- Staff BPSR: Retfinita Sulistyowati., SE.
- Manager BPK: Dr. Nurmiati Pasra, ST., MT.
- Analyst PRP: Dira Dini Dian Kemala, S.Mat., M.Mat.
- Manager BPI: Aryo Wibowo, ST., MM.
- Staff BPI: Farhan Isnaini Zidan., ST.

Periksa kembali ejaan, tanda baca, gelar, dan nama pada dokumen resmi sebelum memasukkan nama-nama tersebut ke laporan.

## 5. Ringkasan proyek website KPI

Proyek berupa website pengelolaan Key Performance Indicator (KPI). Sumber data awal berasal dari file Excel KPI. Sistem diarahkan untuk membantu:

- menampilkan indikator KPI;
- mengelola target;
- mencatat realisasi atau capaian;
- menampilkan satuan pengukuran;
- mengelola bobot;
- menyimpan periode pelaporan;
- menerapkan rumus perhitungan;
- menyimpan bukti pendukung;
- mengelola status data;
- mengirimkan data untuk diperiksa;
- mengembalikan data untuk diperbaiki;
- menampilkan dashboard;
- mengatur hak akses sesuai peran pengguna.

Fitur yang benar-benar sudah ada harus dibedakan dari fitur yang masih menjadi kebutuhan atau rencana. Jangan menulis fitur sebagai fitur selesai jika belum dapat ditunjukkan pada website.

Teknologi proyek:

- React
- Vite
- JavaScript
- Komponen antarmuka modular
- Pengelolaan data KPI dan logika perhitungan

## 6. BAB I yang telah disusun

### 1.1 Latar Belakang

Isi harus menjelaskan:

1. kebutuhan pengelolaan data kinerja yang terstruktur;
2. KPI sebagai indikator berbasis target dan realisasi;
3. penggunaan file Excel sebagai sumber data awal;
4. kendala pengelolaan data secara berulang dan terpisah;
5. kebutuhan website pengelolaan KPI;
6. fitur utama website;
7. tahapan magang;
8. batasan bahwa website belum boleh diklaim telah diterapkan penuh jika belum ada bukti.

Versi inti yang dapat digunakan:

> Perkembangan teknologi informasi mendorong institusi untuk mengelola data kinerja secara terstruktur, akurat, dan mudah dipantau. Pengelolaan data kinerja membutuhkan informasi yang saling berkaitan, seperti indikator, target, realisasi, satuan pengukuran, bobot, periode pelaporan, rumus perhitungan, serta bukti pendukung. Apabila data tersebut dikelola secara terpisah, proses pencatatan, perhitungan, pemeriksaan, dan penyusunan laporan dapat membutuhkan waktu serta ketelitian yang lebih besar.
>
> Key Performance Indicator (KPI) merupakan indikator yang digunakan untuk mengukur pencapaian kinerja berdasarkan target yang telah ditetapkan. Data KPI dapat menunjukkan tingkat pencapaian suatu unit melalui perbandingan antara target dan realisasi. Oleh karena itu, pengelolaan KPI perlu dilakukan secara sistematis agar setiap data dapat dicatat, dihitung, diperiksa, dan dipantau sesuai dengan kebutuhan organisasi.
>
> Dalam pelaksanaannya, data KPI yang menjadi dasar pengembangan website disusun dalam file Excel. File tersebut memuat informasi berupa indikator, target, satuan pengukuran, bobot, rumus perhitungan, periode pelaporan, serta data pendukung lainnya. File Excel dapat digunakan untuk mengolah data, tetapi pengelolaan data dengan struktur yang beragam dapat menjadi kurang praktis ketika pengguna perlu mengisi, memperbarui, menghitung, mengirimkan, dan memeriksa data secara berulang.
>
> Berdasarkan kebutuhan tersebut, diperlukan website yang dapat membantu proses pengelolaan data KPI secara lebih terarah. Website ini dirancang untuk menampilkan indikator dan target, mencatat realisasi, menghitung capaian, mengelola status data, menyimpan bukti pendukung, serta mendukung proses pengajuan dan pemeriksaan data. Pengelolaan tersebut diharapkan dapat membantu pihak yang terlibat memperoleh informasi KPI dalam satu sistem yang lebih terstruktur.
>
> Kegiatan magang ini berfokus pada perancangan dan pengembangan website pengelolaan Key Performance Indicator (KPI) dalam lingkup Pusat Perencanaan dan Pengembangan (PRP) Institut Teknologi PLN. Tahapan kegiatan meliputi pemahaman konsep KPI, analisis file Excel, identifikasi kebutuhan sistem, perancangan alur dan tampilan, pengembangan komponen website, pembuatan tabel dan formulir, pengaturan perhitungan, pengelolaan status data, serta pengujian website.

### 1.2 Ruang Lingkup

Pembuka:

> Ruang lingkup kegiatan magang ini berfokus pada perancangan dan pengembangan website pengelolaan Key Performance Indicator (KPI) dalam lingkup Pusat Perencanaan dan Pengembangan (PRP) Institut Teknologi PLN. Pengembangan website dilakukan berdasarkan kebutuhan pengelolaan data KPI dan struktur informasi yang terdapat pada file Excel sebagai sumber data awal.

Poin ruang lingkup:

1. Mempelajari konsep dan struktur KPI, termasuk indikator, target, realisasi, satuan pengukuran, bobot, periode pelaporan, dan rumus perhitungan.
2. Menganalisis file Excel KPI untuk memahami susunan data dan kebutuhan informasi pada website.
3. Mengidentifikasi kebutuhan pengguna, kebutuhan data, dan fitur yang diperlukan dalam pengelolaan KPI.
4. Menyusun alur pengelolaan data mulai dari pengisian, penyimpanan, pengajuan, pemeriksaan, perbaikan, hingga pemantauan status data.
5. Merancang tampilan antarmuka website, termasuk dashboard, tabel KPI, formulir pengisian, halaman detail indikator, dan halaman pengajuan.
6. Mengembangkan modul KPI untuk menampilkan indikator, target, realisasi, satuan, bobot, periode, rumus, dan keterangan pendukung.
7. Mengembangkan formulir pengisian data KPI sesuai dengan jenis indikator dan kebutuhan informasi.
8. Mengembangkan proses perhitungan capaian berdasarkan rumus yang digunakan pada setiap indikator.
9. Mengembangkan pengelolaan status data, seperti draf, telah dikirim, perlu diperbaiki, dan telah diperiksa.
10. Mengembangkan dashboard untuk menampilkan ringkasan informasi indikator, target, capaian, dan status data.
11. Menyesuaikan tampilan menu dan fitur berdasarkan peran pengguna dalam proses pengelolaan KPI.
12. Melakukan pengujian terhadap tampilan, navigasi, tabel, formulir, perhitungan, penyimpanan, pengajuan, dan perubahan status data.

Batasan:

> Kegiatan ini tidak mencakup pengembangan seluruh sistem informasi institusi, integrasi dengan seluruh sistem akademik dan administrasi, perubahan struktur organisasi, maupun penerapan sistem secara penuh pada lingkungan produksi. Pembahasan laporan difokuskan pada analisis kebutuhan, perancangan, pengembangan, dan pengujian website pengelolaan KPI sesuai dengan kebutuhan proyek selama pelaksanaan magang.

### 1.3 Tujuan dan Manfaat

Tujuan:

1. Memahami konsep, struktur, dan komponen data KPI.
2. Menganalisis file Excel KPI untuk mengidentifikasi indikator, target, realisasi, satuan, bobot, periode, dan rumus perhitungan.
3. Mengidentifikasi kebutuhan pengguna dan fitur website pengelolaan KPI.
4. Merancang alur pengelolaan data KPI dari pengisian sampai pemantauan status.
5. Merancang tampilan antarmuka website.
6. Mengembangkan tabel, formulir, dashboard, perhitungan capaian, dan status data KPI.
7. Menerapkan pengetahuan pemrograman dan pengembangan website.
8. Melakukan pengujian terhadap fungsi website.

Manfaat ditulis sebagai paragraf di dalam subbab 1.3, tanpa harus membuat subbab 1.3.1 dan 1.3.2, kecuali pedoman kampus mewajibkannya:

> Pelaksanaan kegiatan magang ini memberikan manfaat bagi Pusat Perencanaan dan Pengembangan (PRP) Institut Teknologi PLN, mahasiswa, program studi, dan pengembangan proyek. Bagi PRP, website yang dikembangkan dapat menjadi rancangan awal untuk membantu pengelolaan data KPI secara lebih terstruktur. Informasi mengenai indikator, target, realisasi, satuan, bobot, periode, bukti pendukung, dan status data dapat disusun dalam satu sistem.
>
> Bagi mahasiswa, kegiatan ini memberikan pengalaman dalam menganalisis kebutuhan sistem, memahami struktur data KPI, merancang alur pengelolaan data, mengembangkan antarmuka website, menerapkan logika perhitungan, serta melakukan pengujian perangkat lunak.
>
> Bagi program studi, kegiatan magang menjadi sarana menerapkan pengetahuan perkuliahan dalam proyek pengembangan sistem informasi.
>
> Bagi pengembangan proyek, hasil kegiatan dapat menjadi dasar penyempurnaan fitur berdasarkan hasil pengujian, arahan pembimbing, dan kebutuhan pengguna. Manfaat ini tidak menyatakan bahwa sistem telah diterapkan sepenuhnya pada lingkungan produksi.

### 1.4 Rencana Waktu dan Penjadwalan Kerja Magang

Periode magang:

> 10 September sampai 10 Desember 2026

Tahapan:

| No. | Tahapan | Alokasi | Periode |
|---|---|---:|---|
| I | Pengenalan dan Analisis: pengenalan tugas, mentor, konsep KPI, dan analisis file Excel KPI | 3 minggu | 10 sampai 25 September 2026 |
| II | Perancangan Sistem: kebutuhan fitur, alur sistem, struktur halaman, navigasi, tabel, formulir, dashboard, dan struktur proyek | 2 minggu | 21 September sampai 2 Oktober 2026 |
| III | Pengembangan Website KPI: modul KPI, tabel, formulir, pengelolaan data, perhitungan, status, dashboard, pengajuan, dan hak akses | 6 minggu | 28 September sampai 6 November 2026 |
| IV | Pengujian dan Penyempurnaan: pengujian fitur, perhitungan, pengajuan, status, perbaikan, dan evaluasi | 3 minggu | 9 sampai 27 November 2026 |
| V | Dokumentasi dan Penyelesaian: dokumentasi fitur, pemeriksaan akhir, laporan, dan presentasi | 2 minggu | 30 November sampai 10 Desember 2026 |

Catatan jadwal:

> Periode pelaksanaan kerja magang berlangsung dari 10 September sampai 10 Desember 2026. Beberapa tahapan memiliki periode yang saling beririsan karena proses analisis, perancangan, dan pengembangan website dilakukan secara bertahap. Alokasi waktu pada setiap aktivitas menunjukkan perkiraan waktu pengerjaan dan bukan penjumlahan durasi kalender secara keseluruhan.

Jangan menulis **Total Periode Kerja Magang: 16 Minggu**, karena 16 minggu adalah hasil penjumlahan alokasi tahapan yang beririsan, bukan durasi kalender magang.

### 1.5 Sistematika Penulisan

Gunakan judul subbab:

> **1.5 Sistematika Penulisan**

Uraian bab:

- **BAB I PENDAHULUAN**: latar belakang, ruang lingkup, tujuan dan manfaat, rencana waktu, serta sistematika penulisan.
- **BAB II GAMBARAN UMUM INSTITUSI DAN PROYEK**: ITPLN, PRP, struktur organisasi PRP, dan proyek website pengelolaan KPI.
- **BAB III METODE PELAKSANAAN KEGIATAN**: pengumpulan informasi, analisis file Excel KPI, identifikasi kebutuhan, perancangan, pengembangan, pengujian, evaluasi, dan dokumentasi.
- **BAB IV KONSEP TEORI DAN PENERAPAN**: KPI, target dan realisasi, sistem informasi berbasis web, React, Vite, antarmuka, perhitungan capaian, status data, dan fitur website KPI.
- **BAB V PENUTUP**: kesimpulan dan saran.

## 7. BAB II yang perlu direvisi

### 2.1 Sejarah Singkat ITPLN

Gunakan sumber resmi untuk sejarah. Jangan menambahkan tanggal, nama, atau klaim yang tidak memiliki sumber. Gunakan istilah ITPLN sebagai institusi atau perguruan tinggi, bukan perusahaan.

### 2.2 Profil Umum ITPLN dan Proyek Website KPI

Versi yang dapat digunakan:

> Institut Teknologi PLN (ITPLN) merupakan perguruan tinggi yang menyelenggarakan pendidikan, penelitian, pengabdian kepada masyarakat, serta pengembangan teknologi yang berkaitan dengan energi dan ketenagalistrikan. Dalam mendukung pengelolaan institusi, ITPLN memiliki Pusat Perencanaan dan Pengembangan (PRP) yang menjalankan fungsi perencanaan, pengembangan institusi, pengelolaan data, pengendalian kinerja, serta manajemen risiko sesuai dengan struktur organisasi yang berlaku.
>
> Salah satu kebutuhan dalam pengelolaan kinerja adalah tersedianya data indikator yang dapat dikelola secara terstruktur. Oleh karena itu, dikembangkan website pengelolaan Key Performance Indicator (KPI) untuk mendukung proses pencatatan indikator, target, capaian, bukti pendukung, pengajuan, pemeriksaan, dan pemantauan status data.
>
> Website yang dikembangkan memiliki keterkaitan dengan kegiatan pengendalian kinerja dalam lingkup PRP. Meskipun proyek awal mencakup pembahasan IKU dan KPI, laporan ini difokuskan pada pengembangan modul KPI sesuai arahan pembimbing dan ruang lingkup pekerjaan selama kegiatan magang.

### 2.2.1 Visi dan Misi

Gunakan visi dan misi dari sumber resmi ITPLN. Jangan menggabungkan isi dari beberapa sumber tanpa mencantumkan sumber.

### 2.2.2 Filosofi dan Makna Logo ITPLN

Pedoman merek membedakan:

- lambang ITPLN atau academic seal untuk keperluan resmi, legal, dan seremonial;
- signature logo ITPLN untuk komunikasi visual dan media institusi.

Versi aman:

> Logo ITPLN merupakan identitas visual resmi Institut Teknologi PLN. Berdasarkan Brand Standard ITPLN, identitas visual ITPLN memiliki bentuk lambang akademik dan signature logo. Lambang akademik digunakan untuk dokumen resmi, legal, dan seremonial, sedangkan signature logo digunakan dalam berbagai media komunikasi visual institusi. Penggunaan logo dalam laporan ini mengikuti bentuk, warna, proporsi, dan ketentuan penggunaan yang ditetapkan dalam Brand Standard ITPLN.

Jangan menulis makna unsur logo sebagai fakta kecuali makna tersebut memiliki sumber resmi.

### 2.2.3 Lingkup Pekerjaan atau Core Business

Gunakan:

> Dalam mendukung pengelolaan institusi, ITPLN memiliki Pusat Perencanaan dan Pengembangan (PRP). Berdasarkan struktur organisasi terbaru, PRP dipimpin oleh seorang Direktur dan memiliki tiga bagian utama, yaitu Bagian Perencanaan Strategis dan Manajemen Risiko (BPSR), Bagian Pengendalian Kinerja (BPK), serta Bagian Pengembangan Institusi (BPI).
>
> BPSR menangani kegiatan yang berkaitan dengan perencanaan strategis dan manajemen risiko. BPK berkaitan dengan pengendalian dan pengelolaan kinerja. BPI berkaitan dengan pengembangan institusi. Ketiga bagian tersebut didukung oleh staf atau analis sesuai dengan pembagian tugas yang ditetapkan dalam struktur organisasi.
>
> Lingkup pekerjaan PRP yang berkaitan dengan proyek ini adalah pengelolaan dan pengendalian data kinerja. Website KPI dikembangkan sebagai sistem pendukung untuk mengelola indikator, target, capaian, bukti pendukung, pengajuan data, dan proses pemeriksaan.

### 2.2.4 Portofolio ITPLN dan Proyek Website KPI

Versi aman:

> Portofolio kegiatan ITPLN mencakup pendidikan, penelitian, pengabdian kepada masyarakat, kerja sama, pengembangan teknologi, serta pengelolaan institusi. Dalam lingkup PRP, kegiatan yang berkaitan dengan proyek ini meliputi perencanaan, pengelolaan data kinerja, pengendalian kinerja, dan pengembangan institusi.
>
> Website pengelolaan KPI dikembangkan sebagai sistem pendukung untuk mengelola indikator, target, capaian, bukti pendukung, pengajuan data, dan proses pemeriksaan. Pada laporan ini, pembahasan difokuskan pada proses analisis, perancangan, pengembangan, dan pengujian modul KPI.

### 2.3 Struktur Organisasi Perusahaan/Proyek

Jika template mengizinkan, ubah judul menjadi:

> **2.3 Struktur Organisasi Institusi dan Proyek**

Jika template wajib memakai kata perusahaan, pertahankan judul template tetapi gunakan istilah institusi di isi.

### 2.3.1 Struktur Organisasi Institusi

Jelaskan secara umum bahwa struktur ITPLN terdiri atas pimpinan institut, unsur akademik, unsur penunjang, dan unit pengelola institusi. Gunakan struktur resmi yang tersedia, bukan perkiraan.

### 2.3.2 Struktur Organisasi PRP

Gunakan:

> Berdasarkan bagan struktur organisasi terbaru, Pusat Perencanaan dan Pengembangan (PRP) berada di bawah Rektor Institut Teknologi PLN dan dipimpin oleh seorang Direktur. PRP memiliki tiga bagian utama, yaitu Bagian Perencanaan Strategis dan Manajemen Risiko (BPSR), Bagian Pengendalian Kinerja (BPK), dan Bagian Pengembangan Institusi (BPI).
>
> BPSR menangani perencanaan strategis dan manajemen risiko. BPK berkaitan dengan pengendalian dan pengelolaan kinerja. BPI berkaitan dengan pengembangan institusi. Setiap bagian didukung oleh staf atau analis sesuai dengan pembagian tugas pada struktur organisasi.
>
> Struktur organisasi PRP yang digunakan dalam laporan ini mengacu pada bagan organisasi terbaru yang diberikan oleh pihak Institut Teknologi PLN.

Keterangan gambar:

> **Gambar 2.3 Struktur Organisasi Pusat Perencanaan dan Pengembangan (PRP) Institut Teknologi PLN**

### 2.3.3 Posisi Mahasiswa dalam Struktur

Gunakan:

> Mahasiswa ditempatkan sebagai peserta magang dalam lingkungan Pusat Perencanaan dan Pengembangan (PRP) Institut Teknologi PLN. Dalam pelaksanaan magang, mahasiswa terlibat dalam proyek pengembangan website pengelolaan KPI.
>
> Secara operasional, mahasiswa mengikuti arahan pembimbing lapangan dan berkoordinasi dengan pihak yang berkaitan dengan proyek. Mahasiswa tidak dicantumkan sebagai bagian dari jabatan struktural PRP karena status mahasiswa merupakan peserta magang, bukan pegawai tetap atau pejabat organisasi.

## 8. Kebutuhan proyek dari file revisi KPI

File revisi proyek memuat kebutuhan berikut. Gunakan sebagai konteks pengembangan, bukan otomatis sebagai klaim fitur selesai:

### Data dan periode

- data unit harus terisolasi;
- akun unit hanya melihat indikator milik unitnya;
- tabel KPI dinamis seperti spreadsheet;
- admin dapat menyisipkan atau menghapus baris;
- master tabel perlu disinkronkan saat periode baru;
- periode memiliki status aktif atau terkunci;
- data historis tetap tersimpan.

### Hak akses

- Admin PRP memiliki akses luas dan dapat mengelola data;
- Admin PRP dapat melihat evidence dan memberikan komentar revisi;
- Admin dapat mengelola akun dan unit;
- Admin dapat mengekspor rekap Excel;
- SPI bersifat read-only, dapat mengunduh rekap dan evidence;
- unit hanya dapat melihat, mengisi, memperbaiki, dan mengekspor data miliknya.

### Notifikasi

- notifikasi pembaruan dan revisi di dalam aplikasi;
- broadcast dapat ditujukan ke akun tertentu;
- notifikasi email dapat dipertimbangkan sebagai pengembangan lanjutan.

### Admin

- dashboard monitoring;
- verifikasi laporan triwulan;
- verifikasi sasaran kinerja;
- arsip dan rekapitulasi;
- pengaturan periode dan tenggat.

### Penting

Selalu bedakan:

- **sudah dikembangkan**: dapat dibuktikan pada website;
- **sedang dikembangkan**: masih dikerjakan;
- **direncanakan**: belum menjadi fitur yang selesai;
- **kebutuhan proyek**: berasal dari arahan atau dokumen revisi.

## 9. Pedoman logo dan identitas ITPLN

File rujukan:

`C:\Users\USER\Downloads\Brand Guidelines\Brand Standard ITPLN.pdf`

Ketentuan yang perlu diingat:

- lambang akademik dan signature logo memiliki fungsi berbeda;
- lambang akademik digunakan untuk kebutuhan resmi, legal, dan seremonial;
- signature logo digunakan pada media komunikasi visual;
- logo tidak boleh dimodifikasi, diubah bentuk, proporsi, atau warnanya;
- gunakan logo resmi pada sampul dan dokumen sesuai pedoman;
- jangan membuat ulang logo.

## 10. Jadwal dan logbook

Tanggal yang telah disusun:

- Kamis, 10 September 2026: pengenalan tugas dan proyek.
- Jumat, 11 September 2026: pengenalan peserta, mentor, pembagian tugas, dan tanggung jawab.
- Senin, 14 September 2026: mempelajari pedoman KPI.
- Selasa, 15 September 2026: pemaparan materi KPI.
- Rabu, 16 September 2026: diskusi kebutuhan website.
- Kamis, 17 September 2026: mempelajari file Excel KPI.
- Jumat, 18 September 2026: identifikasi kebutuhan sistem.
- 21 sampai 25 September: analisis data dan rancangan alur.
- 24 sampai 25 September: penyiapan struktur React dan Vite.
- 28 sampai 30 September: halaman dan modul awal KPI.
- 1 sampai 2 Oktober: modul KPI dan formulir.
- 5 sampai 9 Oktober: tabel, input data, dan dashboard.
- 12 sampai 16 Oktober: pengajuan, status, pengguna, hak akses, dan evaluasi.
- 19 sampai 23 Oktober: perbaikan tampilan, penyempurnaan data, pengujian, dan dokumentasi.

Tanggal progres di laporan harus disesuaikan dengan pekerjaan yang benar-benar sudah dilakukan. Jangan menggunakan kalimat “sampai 23 Oktober” jika dokumen sudah memuat pekerjaan setelah tanggal tersebut.

## 11. Flowchart dan tabel jadwal

Flowchart telah disepakati dalam bentuk horizontal:

```text
Mulai
  →
Pengenalan dan Analisis
  →
Perancangan Sistem
  →
Pengembangan Website KPI
  →
Pengujian dan Penyempurnaan
  →
Apakah hasil pengujian sudah sesuai?
  ├── Ya → Dokumentasi dan Penyelesaian → Selesai
  └── Belum → Perbaikan Website
                ↓
             Pengujian Ulang
                ↓
          kembali ke keputusan
```

Label jalur kembali yang benar adalah **Uji ulang**, bukan “Ya”. Jika flowchart dibuat di Eraser.io, logo Eraser sebaiknya tidak ditampilkan dalam gambar final laporan jika dapat dihapus atau dipotong.

Pada tabel jadwal, beberapa tahap beririsan. Jangan menjumlahkan 3 + 2 + 6 + 3 + 2 menjadi total durasi kalender 16 minggu. Gunakan:

> Periode Pelaksanaan Kerja Magang: 10 September sampai 10 Desember 2026.

## 12. Gaya penulisan yang harus dipertahankan

- Bahasa Indonesia formal, jelas, dan tidak berlebihan.
- Fokus pada fakta proyek yang tersedia.
- Jangan mengarang nama, angka, hasil, pengguna, atau klaim keberhasilan.
- Jangan menulis bahwa sistem telah diterapkan penuh jika belum ada bukti.
- Gunakan “dirancang”, “dikembangkan”, “diuji”, atau “diharapkan dapat membantu” sesuai tahap sebenarnya.
- Jangan menggunakan em dash.
- Hindari buzzword dan kalimat promosi.
- Hindari pengulangan judul proyek secara berlebihan.
- Jangan menulis “perusahaan” jika yang dimaksud ITPLN sebagai perguruan tinggi.
- Setiap fitur yang disebut harus dapat dikategorikan sebagai selesai, sedang dikembangkan, atau rencana.

## 13. Checklist sebelum melanjutkan ke BAB III

- [ ] Semua nama unit sudah menjadi Pusat Perencanaan dan Pengembangan (PRP).
- [ ] Judul hanya membahas KPI.
- [ ] BAB I memakai istilah “Sistematika Penulisan”.
- [ ] BAB II tidak memakai struktur organisasi lama.
- [ ] Struktur PRP terbaru sudah dimasukkan sebagai Gambar 2.3.
- [ ] Posisi mahasiswa tidak ditulis sebagai jabatan struktural.
- [ ] Nama BPK hanya dikaitkan dengan proyek jika ada dasar resmi.
- [ ] Fitur proyek dibedakan antara selesai, sedang dikembangkan, dan rencana.
- [ ] Logo ITPLN mengikuti Brand Standard.
- [ ] Tidak ada klaim penerapan penuh tanpa bukti.
- [ ] Tanggal dan periode laporan konsisten.
- [ ] Tidak ada karakter em dash pada naskah.

