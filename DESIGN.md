# DESIGN.md - PERFORMA ITPLN Design System

## 1. Identitas & Mandat Merek

- **Institusi**: Institut Teknologi Perusahaan Listrik Negara (ITPLN) - Direktorat Perencanaan & Pengembangan (PRP) / SPMI.
- **Produk**: **PERFORMA ITPLN**, platform tata kelola Indikator Kinerja Utama (IKU) Kementerian dan Key Performance Indicator (KPI) Operasional Unit & Fakultas.
- **Arah Visual**: *Swiss Architectural Editorial* berpadu palet resmi lambang kampus ITPLN (sayap kiri *Prussian Petrol Navy* dan sayap kanan *Electric Turquoise Teal* di atas kanvas putih bersih).
- **Mandat Skema Warna (`R-21`)**: Aplikasi mengunci kanvas utama terang (*Light-Only Institutional Editorial Canvas*) sesuai identitas resmi dokumen akademik dan tata kelola mutu ITPLN, dengan blok jangkar gelap (*ITPLN Midnight Petrol* `#062C3D`) khusus pada penutup portal dan `Footer`.

---

## 2. Sistem Warna & Proporsi 60-30-10 (`R-20`, `R-25`)

Seluruh pasangan warna telah diverifikasi menggunakan `.agents/skills/antislop-human/contrast-check.py` terhadap standar WCAG 2.1 AA (`>= 4.5:1` teks normal, `>= 3.0:1` teks besar dan indikator fokus/grafis).

### A. 60% Dominan Netral (Kanvas & Permukaan)
- `--ent-bg` / `--surface`: `#FFFFFF` (Kanvas kerja dan dokumen utama)
- `--ent-surface-subtle` / `--background`: `#F7FAFB` (Permukaan seksi bergantian berembun sejuk)
- `--ent-surface-muted`: `#EDF3F6` (Latar kontrol sekunder & header tabel)
- `--ent-border`: `#D8E4EA` (Garis pembatas struktural 1px)

### B. 30% Tinta Struktural & Biru Kampus ITPLN
- `--ent-ink` / `--text-main`: `#072534` (Tinta utama *Deep Petrol*, kontras **15.5:1** di atas `#FFFFFF`)
- `--secondary` / `--ent-navy`: `#094E68` (*ITPLN Prussian Petrol Navy* dari sayap kiri logo, kontras **9.13:1** di atas `#FFFFFF` dan **8.70:1** di atas `#F7FAFB`)
- `--ent-ink-muted`: `#334155` (Teks deskripsi & paragraf sekunder, kontras **10.3:1** di atas `#FFFFFF`)
- `--ent-ink-subtle` / `--text-muted`: `#475569` (Metadata, label indeks, dan penanda waktu, kontras **7.58:1** di atas `#FFFFFF` dan **7.22:1** di atas `#F7FAFB`)
- **Jangkar Gelap (`Footer` & Monolit SSO)**: `#062C3D` (*ITPLN Midnight Petrol*) dengan teks utama `#FFFFFF` (**14.63:1**) dan teks sekunder `#94B8C7` (**6.92:1**).

### C. 10% Aksen Energi & Interaksi Kampus ITPLN
- `--primary` / `--ent-accent-teal`: `#0E7480` (*ITPLN Accessible Electric Teal* dari sayap kanan logo, kontras **5.49:1** terhadap `#FFFFFF` baik sebagai teks tautan di atas putih maupun latar tombol dengan teks putih)
- `--primary-light`: `#1B9AAA` (Kontras **3.36:1** terhadap `#FFFFFF`; **hanya** untuk garis aksen non-teks, indikator fokus grafis, atau teks berukuran besar `>= 24px`, dilarang untuk teks normal)
- **Status Semantik**:
  - Disetujui (`Approved`): Teks `#14532D` di atas `#F0FDF4`, border `#86EFAC`
  - Revisi (`Revision`): Teks `#78350F` di atas `#FFFBEB`, border `#FCD34D`
  - Ditolak / Peringatan (`Rejected`): Teks `#7F1D1D` di atas `#FEF2F2`, border `#FCA5A5`

---

## 3. Tipografi & Hierarki

- **Heading (`--font-heading`)**: `'Outfit', -apple-system, BlinkMacSystemFont, sans-serif` (bobot `600`, `700`, `800`; `letter-spacing: -0.03em` s.d. `-0.045em`; `line-height: 1.05` s.d. `1.2`).
- **Body (`--font-body`)**: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` (bobot `400`, `500`, `600`; ukuran dasar `16px`; `line-height: 1.65`; lebar baca optimal `60ch` s.d. `72ch`).
- **Data, Kode Indikator, & Angka Tabel (`--ent-mono`)**: `'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace` dengan `font-variant-numeric: tabular-nums` agar seluruh angka skor, target, dan persentase sejajar vertikal.

---

## 4. Komponen, Sudut, Ikonografi, & Efek Kaca (`R-04`, `R-08`, `R-10`, `R-11`)

- **Radius Sudut**: Tegas dan arsitektural (`4px` untuk badge/tag kode, `6px` untuk tombol & input, `8px` untuk panel kerja & kartu data). Hindari kartu gelembung `24px-32px` dengan bayangan kabur.
- **Batas `backdrop-filter` (`R-10`)**: Maksimal **1 elemen per tampilan** (hanya untuk bilah navigasi melayang `Navbar` di rute publik, atau 1 lapisan *scrim* dialog modal aktif di rute internal). Tombol CTA, bar pencarian, dan kartu biasa wajib menggunakan permukaan solid tanpa `backdrop-filter`.
- **Ikonografi (`R-04`, `R-08`)**: Menggunakan set glif garis tipis `lucide-react` (`strokeWidth: 1.75` s.d. `2`) semata-mata untuk penanda fungsi (kunci otoritas, pencarian, unduh berkas, status verifikasi). Hindari menempelkan ikon panah dekoratif berulang di setiap tautan apabila konteks navigasi sudah jelas.

---

## 5. Standar Aksesibilitas, Mobile, Gerak, & Kejujuran Copy

- **Fokus Keyboard (`R-32`)**: Dilarang mematikan `outline` tanpa pengganti. Seluruh elemen interaktif (`a`, `button`, `input`, `select`, `textarea`, `[tabindex]`) wajib menampilkan `:focus-visible` berupa `outline: 2px solid #0E7480; outline-offset: 2px;` (rasio `5.49:1` di atas putih). Kontrol yang bisa diklik wajib berupa `<button>` atau `<a>`, bukan `<div onClick>`.
- **Responsif & Target Sentuh (`R-03`, `antislop-layoutmobile`)**:
  - Bebas *horizontal scroll* dari lebar `320px` hingga desktop.
  - Gunakan `100dvh` (dengan fallback `100vh`) untuk seksi setinggi layar, dan `100%` sebagai pengganti `100vw`.
  - Ukuran target sentuh interaktif minimal `44px x 44px` pada layar mobile.
- **Disiplin Motion (`R-19`)**:
  - Tidak ada animasi dekoratif berulang tanpa henti (`repeat: -1` atau `animate-bounce`). Gerak hanya dipicu oleh masuknya seksi (*once*), guliran pengguna (*scroll-scrub*), atau interaksi langsung.
  - Seluruh animasi wajib menghormati `@media (prefers-reduced-motion: reduce)`.
- **Disiplin Copy & Data (`R-02`, `R-16`, `R-28`, `R-36`, `R-38`)**:
  - **Nol Em Dash (`R-02`)**: Dilarang menggunakan karakter `\u2014` di seluruh teks UI, kode, komentar, maupun dokumen. Gunakan tanda titik dua (`:`), koma (`,`), tanda hubung pendek (`-`), atau titik tengah (`·`).
  - **Kejujuran Arsitektur & Metrik**: Jangan mengklaim enkripsi server atau rekomendasi algoritmik selama penyimpanan berjalan di `localStorage` peramban. Seluruh angka capaian wajib bersumber dari kalkulasi data riil atau diberi penanda eksplisit `Data Simulasi Demo`.
