# DESIGN.md - PERFORMA ITPLN Design System

## 1. Identitas, Mandat Merek & Three Dials (`R-21`, `R-37`)

- **Institusi**: Institut Teknologi Perusahaan Listrik Negara (ITPLN) - Direktorat Perencanaan & Pengembangan (PRP) / SPMI.
- **Produk**: **PERFORMA ITPLN**, platform tata kelola Indikator Kinerja Utama (IKU) Perguruan Tinggi dan Key Performance Indicator (KPI) Operasional Unit & Fakultas.
- **Arah Visual**: *Swiss Architectural Editorial* berpadu palet resmi lambang kampus ITPLN (sayap kiri *Prussian Petrol Navy* dan sayap kanan *Electric Turquoise Teal* di atas kanvas putih bersih).
- **Mandat Skema Warna (`R-21`)**: Aplikasi mengunci kanvas utama terang (*Light-Only Institutional Editorial Canvas*) sesuai identitas resmi dokumen akademik dan tata kelola mutu ITPLN, dengan blok jangkar gelap (*ITPLN Midnight Petrol* `#062C3D`) khusus pada penutup portal dan `Footer`.
- **Three Dials (`R-37`)**:
  - **ENERGY: `4 / 10`** (Tenang, otoritatif, dan berfokus pada keterbacaan tabel evaluasi kinerja tanpa pendaran lampu neon atau efek kaca berlapis).
  - **RHYTHM: `6 / 10`** (Perpaduan ruang baca editorial yang lega pada halaman panduan publik dan grid buku besar *ledger* 1px yang padat namun terstruktur pada lembar kerja KPI/IKU).
  - **MOTION: `3 / 10`** (Transisi fungsional singkat saat pergantian tab/halaman dan indikator progres baca; tanpa pembajakan roda gulir, tanpa tirai penutup layar penuh, tanpa kemiringan 3D, dan patuh penuh pada `prefers-reduced-motion`).

---

## 2. Sistem Warna & Proporsi 60-30-10 (`R-20`, `R-25`, `R-29`)

Seluruh pasangan warna telah diverifikasi menggunakan `.agents/skills/antislop-human/contrast-check.py` terhadap standar WCAG 2.1 AA (`>= 4.5:1` teks normal, `>= 3.0:1` teks besar serta batas kontrol interaktif dan indikator fokus).

### A. 60% Dominan Netral (Kanvas & Permukaan)
- `--ent-bg` / `--surface`: `#FFFFFF` (Kanvas kerja dan dokumen utama)
- `--ent-surface-subtle` / `--background`: `#F7FAFB` (Permukaan seksi bergantian)
- `--ent-surface-muted`: `#EDF3F6` (Latar kontrol sekunder & header tabel)
- `--ent-border`: `#CBD5E1` (Garis pembatas struktural 1px non-interaktif)
- `--ent-control-border`: `#64748B` (Garis batas kontrol interaktif `input`, `select`, `textarea`, dan tombol sekunder; kontras **4.76:1** di atas `#FFFFFF` dan **4.53:1** di atas `#F7FAFB`, memenuhi WCAG 1.4.11 `>= 3.0:1`)

### B. 30% Tinta Struktural & Biru Kampus ITPLN
- `--ent-ink` / `--text-main`: `#072534` (Tinta utama *Deep Petrol*, kontras **15.5:1** di atas `#FFFFFF`)
- `--secondary` / `--ent-navy`: `#094E68` (*ITPLN Prussian Petrol Navy* dari sayap kiri logo, kontras **9.13:1** di atas `#FFFFFF` dan **8.70:1** di atas `#F7FAFB`)
- `--ent-ink-muted`: `#334155` (Teks deskripsi & paragraf sekunder, kontras **10.3:1** di atas `#FFFFFF`)
- `--ent-ink-subtle` / `--text-muted`: `#475569` (Metadata, label indeks, dan penanda waktu, kontras **7.58:1** di atas `#FFFFFF` dan **7.22:1** di atas `#F7FAFB`)
- **Jangkar Gelap (`Footer` & Panel Arsitektur)**: `#062C3D` (*ITPLN Midnight Petrol*) dengan teks utama `#FFFFFF` (**14.63:1**) dan teks sekunder `#B8D4E0` (**9.42:1**).

### C. 10% Aksen Energi & Interaksi Kampus ITPLN
- `--primary` / `--ent-accent-teal`: `#0E7480` (*ITPLN Accessible Electric Teal* dari sayap kanan logo, kontras **5.49:1** terhadap `#FFFFFF` baik sebagai teks tautan di atas putih maupun latar tombol dengan teks putih)
- `--primary-light`: `#1B9AAA` (Kontras **3.36:1** terhadap `#FFFFFF`; **hanya** untuk garis aksen non-teks, indikator fokus grafis, atau teks berukuran besar `>= 24px`, dilarang untuk teks normal)
- **Status Semantik & Indikator Periode (Kontras Tinggi & Non-Warna Pendamping)**:
  - Aktif / Terbuka / Disetujui (`Active` / `Approved`): Latar hijau `#15803D` dengan teks putih bold `#FFFFFF` (kontras **5.02:1** WCAG AA), border `#14532D`.
  - Tidak Aktif / Terkunci / Ditolak (`Inactive` / `Locked` / `Rejected`): Latar merah `#B91C1C` dengan teks putih bold `#FFFFFF` (kontras **6.47:1** WCAG AA), border `#7F1D1D`.
  - Revisi (`Revision`): Teks `#78350F` (`font-weight: 700`) di atas `#FFFBEB`, border `#B45309` (kontras border **5.02:1**).

---

## 3. Tipografi & Alasan Pemilihan Font (`R-06`, `R-07`)

- **Heading (`--font-heading`)**: `'Outfit', -apple-system, BlinkMacSystemFont, sans-serif` (bobot `600`, `700`, `800`; `letter-spacing: -0.02em` s.d. `-0.035em`; `line-height: 1.1` s.d. `1.22`). Dipilih karena konstruksi geometris tegas yang selaras dengan tipografi arsitektural dokumen korporat PLN.
- **Body (`--font-body`)**: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` (bobot `400`, `500`, `600`; ukuran dasar `16px`; `line-height: 1.65`; lebar baca optimal `60ch` s.d. `72ch`). Dipilih secara khusus karena *x-height* tinggi (`0.73`) dan bukaan huruf yang menjaga keterbacaan teks regulasi bahasa Indonesia serta label sub-baris indikator pada kepadatan tabel 12 kolom (`12px-13px`).
- **Data, Kode Indikator, & Angka Tabel (`--ent-mono`)**: `'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace` dengan `font-variant-numeric: tabular-nums`. Dipilih agar seluruh kolom skor, bobot, target, persentase, kode `IKU.01`/`A_1a`, dan hash `SHA-256` sejajar vertikal dan bebas ambiguitas karakter `0`/`O` serta `1`/`l`.

---

## 4. Komponen, Sudut, Ikonografi, & Efek Kaca (`R-04`, `R-08`, `R-10`, `R-11`, `R-12`, `R-13`)

- **Radius Sudut (`R-11`)**: Tegas dan arsitektural (`4px` untuk badge/tag kode, `6px` untuk tombol & input, `8px` untuk panel kerja, header navigasi, & kartu data). Dilarang menggunakan kartu gelembung `20px-32px` atau header berbentuk pil `9999px`.
- **Bayangan & Border (`R-12`, `R-13`)**: Bayangan netral tipis (`rgba(7, 37, 52, 0.05..0.12)`). Dilarang menggunakan *colored glow shadow* pada tombol/badge dan dilarang memasang garis tepi kiri berwarna (`border-left: 3px/4px`) pada kartu non-status.
- **Batas `backdrop-filter` (`R-10`)**: Maksimal **1 elemen per tampilan** (hanya untuk bilah navigasi `Navbar` di rute publik, atau 1 lapisan *scrim* dialog modal aktif di rute internal). Tombol CTA, bar pencarian, dan kartu biasa wajib menggunakan permukaan solid tanpa `backdrop-filter` dan tanpa kanvas spekular tambahan.
- **Ikonografi & Alasan Pemilihan (`R-04`, `R-08`, `R-31`)**: Menggunakan `lucide-react` (`strokeWidth: 1.75` s.d. `2`) karena ketebalan garisnya konsisten dengan *hairline* tabel buku besar `1px`. Ikon hanya dipakai sebagai penanda fungsi (kunci otoritas, pencarian, unduh berkas, status verifikasi). Dilarang menambahkan ikon panah dekoratif (`ArrowRight` / `ArrowUpRight`) berulang pada tombol/kartu navigasi biasa, dan dilarang menambahkan titik status (`::before`) pada badge metadata statis.

---

## 5. Standar Aksesibilitas, Mobile, Gerak, & Kejujuran Copy (`R-02`, `R-03`, `R-17`, `R-19`, `R-25`, `R-32`, `R-36`)

- **Fokus Keyboard Kontras Ganda (`R-32`)**: Dilarang mematikan `outline` tanpa pengganti. Seluruh elemen interaktif (`a`, `button`, `input`, `select`, `textarea`, `[tabindex]`) wajib menampilkan `:focus-visible` berupa cincin ganda (`outline: 2px solid #072534; outline-offset: 2px; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #0E7480;`) sehingga mencapai kontras `>= 5.49:1` di atas latar terang maupun `14.6:1` di atas tombol gelap `#094E68`/`#062C3D`.
- **Skip Link & Navigasi Keyboard (`R-26`)**: Setiap layout menyediakan tautan `.skip-to-main` menuju `<main>` serta mendukung penutupan modal dengan tombol `Escape`.
- **Responsif & Target Sentuh (`R-03`, `antislop-layoutmobile`)**:
  - Bebas *horizontal scroll* dari lebar `320px` hingga desktop.
  - Gunakan `min-height: 100dvh` (bukan `height: 100dvh; overflow: hidden`) agar konten hero tidak terpotong pada layar pendek atau zoom 200%.
  - Ukuran target sentuh interaktif minimal `44px x 44px` pada layar mobile dan perangkat sentuh (`pointer: coarse`). Tombol menu mobile wajib menyertakan label teks `"Menu"` / `"Tutup"`.
- **Disiplin Motion (`R-19`)**:
  - Tidak ada animasi berulang tanpa henti (`repeat: -1`), tidak ada pembajakan roda gulir (*wheel-hijacking*), dan tidak ada tirai gelap penutup layar saat berpindah halaman.
  - Seluruh animasi wajib menghormati `@media (prefers-reduced-motion: reduce)`.
- **Disiplin Copy & Kejujuran Klaim (`R-02`, `R-16`, `R-17`, `R-28`, `R-36`, `R-38`)**:
  - **Nol Em Dash (`R-02`)**: Dilarang menggunakan karakter `\u2014` di seluruh teks UI, kode, komentar, maupun dokumen.
  - **Kejujuran Arsitektur & Metrik**: Jangan mengklaim integrasi SSO eksternal apabila autentikasi menggunakan sesi kredensial institusi lokal/SQLite, jangan mengklaim `"100% Integritas Audit"` tanpa rujukan terukur, dan bedakan secara jujur antara status `"Tercatat di Outbox Audit"` dengan `"Terkirim via Gateway Email"`. Sebutkan secara akurat **5 Peran Otoritas** (`Superadmin PRP`, `Peran Ganda / Dual`, `Otoritas IKU`, `PIC Unit KPI`, dan `Auditor SPI`).
