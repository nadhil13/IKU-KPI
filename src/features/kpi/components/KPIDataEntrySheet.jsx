import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RotateCcw, FileSpreadsheet, Printer, SlidersHorizontal, Send, LockKeyhole,
  CheckCircle2, AlertTriangle, Clock3, History, RefreshCcw, ShieldCheck
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

/**
 * Parser Angka Presisi untuk Format Indonesia (Koma Desimal & Titik Ribuan)
 */
export function parseIndonesianNumber(input) {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  let s = raw.replace(/^rp\.?\s*/i, '').replace(/%\s*$/, '').trim();
  if (!s || /[a-zA-Z]/.test(s)) return null;

  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    const commaCount = (s.match(/,/g) || []).length;
    if (commaCount > 1) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else if (s.includes('.')) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      s = s.replace(/\./g, '');
    } else {
      const parts = s.split('.');
      if (parts[1] && parts[1].length === 3 && parts[0].length >= 1 && parts[0].length <= 3) {
        s = parts[0] + parts[1];
      }
    }
  }

  const num = Number(s);
  return Number.isFinite(num) ? num : null;
}

/**
 * Parser Tanggal Fleksibel untuk Bagian D (Perspektif Kepatuhan):
 * Mendukung "01-Dec-26", "25-Nov-26", "31-Mar-26", "15 Juli 2026", "2026-11-25", "25/11/2026"
 */
export function parseFlexibleDate(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const monthMap = {
    jan: 0, januari: 0, january: 0,
    feb: 1, februari: 1, february: 1,
    mar: 2, maret: 2, march: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5, june: 5,
    jul: 6, juli: 6, july: 6,
    agu: 7, agustus: 7, aug: 7, august: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9, oct: 9, october: 9,
    nov: 10, november: 10,
    des: 11, desember: 11, dec: 11, december: 11,
  };

  // Pola 1: YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  // Pola 2: DD-MMM-YY atau DD Bulan YYYY (contoh: 01-Dec-26, 25 Nov 2026)
  const textMatch = raw.replace(/,/g, '').match(/^(\d{1,2})[\s\-/]+([a-zA-Z]+)[\s\-/]+(\d{2,4})$/);
  if (textMatch) {
    const day = Number(textMatch[1]);
    const mKey = textMatch[2].toLowerCase();
    let year = Number(textMatch[3]);
    if (year < 100) year += 2000;
    if (monthMap[mKey] !== undefined) {
      return new Date(year, monthMap[mKey], day);
    }
  }

  // Pola 3: Bulan YYYY saja (contoh: "Juli 2026" atau "Januari 2027")
  const monthYearMatch = raw.replace(/,/g, '').match(/^([a-zA-Z]+)[\s\-/]+(\d{2,4})$/);
  if (monthYearMatch) {
    const mKey = monthYearMatch[1].toLowerCase();
    let year = Number(monthYearMatch[2]);
    if (year < 100) year += 2000;
    if (monthMap[mKey] !== undefined) {
      return new Date(year, monthMap[mKey] + 1, 0); // Akhir bulan tersebut
    }
  }

  // Pola 4: DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyMatch) {
    let year = Number(dmyMatch[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
  }

  return null;
}

export function formatIndonesianNumber(num, maxDecimals = 2) {
  if (num === null || num === undefined || !Number.isFinite(num)) return '—';
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MASTER STRUKTUR KPI BAGIAN A (25), B (26), C (49) & D (-12,5)
// ═══════════════════════════════════════════════════════════════════════════
export const KPI_SECTIONS_CONFIG = [
  // ─── BAGIAN A: PERSPEKTIF KEBERLANJUTAN (BOBOT 25) ───
  {
    code: 'A',
    title: 'PERSPEKTIF KEBERLANJUTAN',
    totalWeight: 25,
    weightDisplay: '25',
    isPenaltySection: false,
    items: [
      {
        id: 'A_1a',
        no: '1a',
        excelNo: '1a',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Pendapatan Vertikal (Mahasiswa)',
        indikatorRowSpan: 4,
        hideIndikatorCell: false,
        formula: 'Jumlah realisasi mahasiswa baru T.A 2026/2027 / Target Mahasiswa Baru',
        bobot: 10,
        bobotDisplay: '10',
        targetDisplay: '2.000',
        targetNum: 2000,
        satuan: 'Mahasiswa',
        calcType: 'ratio_two',
        subrows: [
          { key: 'a_1a_num', label: 'Jumlah realisasi mahasiswa baru T.A 2026/2027' },
          { key: 'a_1a_den', label: 'Target Mahasiswa Baru' },
        ],
      },
      {
        id: 'A_1b',
        no: '1b',
        excelNo: '1b',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Pendapatan Vertikal (Mahasiswa)',
        indikatorRowSpan: 0,
        hideIndikatorCell: true,
        formula: 'Realisasi Pendapatan Mahasiswa / Target RKA',
        bobot: 10,
        bobotDisplay: '10',
        targetDisplay: '100',
        targetNum: 100,
        satuan: 'Milyar Rupiah',
        calcType: 'ratio_two',
        subrows: [
          { key: 'a_1b_num', label: 'Realisasi Pendapatan Mahasiswa' },
          { key: 'a_1b_den', label: 'Target RKA' },
        ],
      },
      {
        id: 'A_2',
        no: '2',
        excelNo: '2',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Pendapatan Horisontal (Non-mahasiswa)',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula: 'Realisasi Pendapatan Non Mahasiswa / Target RKA',
        bobot: 5,
        bobotDisplay: '5',
        targetDisplay: '80',
        targetNum: 80,
        satuan: 'Milyar Rupiah',
        calcType: 'ratio_two',
        subrows: [
          { key: 'a_2_num', label: 'Realisasi Pendapatan Non Mahasiswa' },
          { key: 'a_2_den', label: 'Target RKA' },
        ],
      },
      {
        id: 'A_3',
        no: '3',
        excelNo: '3',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Efisiensi Biaya Penyelenggaraan Institut',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula: 'Realisasi Biaya Operasi / Realisasi Pendapatan x 100%',
        bobot: 3,
        bobotDisplay: '3',
        targetDisplay: '90',
        targetNum: 90,
        satuan: '%',
        calcType: 'ratio_two',
        subrows: [
          { key: 'a_3_num', label: 'Realisasi Biaya Operasi' },
          { key: 'a_3_den', label: 'Realisasi Pendapatan' },
        ],
      },
      {
        id: 'A_4',
        no: '4',
        excelNo: '4',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Efisiensi Biaya Adm & Umum',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula: 'Realisasi Biaya Adm & Umum / Realisasi Pendapatan x 100%',
        bobot: 2,
        bobotDisplay: '2',
        targetDisplay: '25',
        targetNum: 25,
        satuan: '%',
        calcType: 'ratio_two',
        subrows: [
          { key: 'a_4_num', label: 'Realisasi Biaya Adm & Umum' },
          { key: 'a_4_den', label: 'Realisasi Pendapatan' },
        ],
      },
      {
        id: 'A_5',
        no: '5',
        excelNo: '5',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Kesehatan Arus Kas dari Aktivitas Operasi',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula: 'Arus Kas Pengeluaran Aktivitas Operasi / Arus Kas Penerimaan Aktivitas Operasi x100 %',
        bobot: 2,
        bobotDisplay: '2',
        targetDisplay: '89',
        targetNum: 89,
        satuan: '%',
        calcType: 'ratio_two',
        subrows: [
          { key: 'a_5_num', label: 'Arus Kas Pengeluaran Aktivitas Operasi' },
          { key: 'a_5_den', label: 'Arus Kas Penerimaan Aktivitas Operasi' },
        ],
      },
      {
        id: 'A_6',
        no: '6',
        excelNo: '6',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Perbaikan Tata Kelola',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula: 'Jumlah SOP Probis yang direncanakan terimplementasikan',
        bobot: 3,
        bobotDisplay: '3',
        targetDisplay: '100',
        targetNum: 100,
        satuan: '%',
        calcType: 'ratio_two',
        subrows: [
          { key: 'a_6_num', label: 'Jumlah SOP Probis yang direncanakan terimplementasikan' },
          { key: 'a_6_den', label: 'Jumlah SOP Probis yang direncanakan' },
        ],
      },
    ],
  },

  // ─── BAGIAN B: PERSPEKTIF MAHASISWA (BOBOT 26) ───
  {
    code: 'B',
    title: 'PERSPEKTIF MAHASISWA',
    totalWeight: 26,
    weightDisplay: '26',
    isPenaltySection: false,
    items: [
      {
        id: 'B_1a',
        no: '1a',
        excelNo: '1',
        excelNoRowSpan: 8,
        hideExcelNo: false,
        indikator: 'a. Tracer Study',
        indikatorRowSpan: 7,
        hideIndikatorCell: false,
        formula:
          'Jumlah lulusan S1 dan D3 di tahun 2025 yang berhasil menjadi wirausaha, diterima kerja, atau melanjutkan studi dengan masa tunggu <= 6 bulan (pakai formula akreditasi) / Jumlah responden x 100%',
        bobot: 3,
        bobotDisplay: '3',
        targetDisplay: '65',
        targetNum: 65,
        satuan: '%',
        calcType: 'tracer_study',
        subrows: [
          { key: 'b_1a_1', label: 'masa tunggu < 6 bulan dan gaji > 1,2x UMP' },
          { key: 'b_1a_2', label: '6 bulan > masa tunggu dan gaji > 1,2x UMP' },
          { key: 'b_1a_3', label: 'masa tunggu < 6 bulan dan gaji < 1,2x UMP' },
          { key: 'b_1a_4', label: '6 bulan > masa tunggu dan gaji < 1,2x UMP' },
          { key: 'b_1a_5', label: 'Melanjutkan studi' },
          { key: 'b_1a_6', label: 'Wirausaha' },
          { key: 'b_1a_resp', label: 'Jumlah Responden', isDenominator: true },
        ],
      },
      {
        id: 'B_1b',
        no: '1b',
        excelNo: '',
        excelNoRowSpan: 0,
        hideExcelNo: true,
        indikator: 'b. Penerimaan Lulusan pada Dunia Kerja melalui program kerjasama offtaker',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula:
          'Jumlah lulusan S1 dan D3 yang diterima di dunia kerja melalui program kerjasama offtaker dengan Industri di Tahun 2026',
        bobot: 5,
        bobotDisplay: '5',
        targetDisplay: '100*)',
        targetNum: 100,
        satuan: 'Lulusan',
        calcType: 'single_target',
        subrows: [{ key: 'b_1b_val', label: 'Jumlah lulusan S1 dan D3' }],
      },
      {
        id: 'B_2',
        no: '2',
        excelNo: '2',
        excelNoRowSpan: 1,
        hideExcelNo: false,
        indikator: 'Mahasiswa berprestasi',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Jumlah Mahasiswa yang berprestasi nasional & Internasional',
        bobot: 3,
        bobotDisplay: '3',
        targetDisplay: '120',
        targetNum: 120,
        satuan: 'Mahasiswa',
        calcType: 'single_target',
        subrows: [
          { key: 'b_2_val', label: 'Jumlah Mahasiswa yang berprestasi nasional dan Internasional' },
        ],
      },
      {
        id: 'B_3',
        no: '3',
        excelNo: '3',
        excelNoRowSpan: 1,
        hideExcelNo: false,
        indikator: 'Tingkat Kepuasan Mahasiswa terhadap pengajaran (EDOM)',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Survey Kepuasan Akademik dan Administrasi dengan indeks 1-4 (Periode Februari dan Agustus)',
        bobot: 3,
        bobotDisplay: '3',
        targetDisplay: '3,5',
        targetNum: 3.5,
        satuan: 'indeks',
        calcType: 'single_target',
        subrows: [
          { key: 'b_3_val', label: 'Survey Kepuasan Akademik dan Administrasi dengan indeks' },
        ],
      },
      {
        id: 'B_4',
        no: '4',
        excelNo: '4',
        excelNoRowSpan: 1,
        hideExcelNo: false,
        indikator: 'Tingkat Kepuasan Mahasiswa terhadap layanan kampus',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Survey kepuasan layanan dan fasilitas dengan indeks 1 - 5',
        bobot: 3,
        bobotDisplay: '3',
        targetDisplay: '3,5',
        targetNum: 3.5,
        satuan: 'indeks',
        calcType: 'single_target',
        subrows: [{ key: 'b_4_val', label: 'Survey kepuasan layanan dan fasilitas' }],
      },
      {
        id: 'B_5',
        no: '5',
        excelNo: '5',
        excelNoRowSpan: 1,
        hideExcelNo: false,
        indikator:
          'Kerjasama Internasional Program dengan Perguruan Tinggi luar negeri seperti: Sandwich Program, E-Mobility, International student',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Terkirim mahasiswa dalam Internasional Program',
        bobot: 5,
        bobotDisplay: '5',
        targetDisplay: '2',
        targetNum: 2,
        satuan: 'jumlah',
        calcType: 'single_target',
        subrows: [{ key: 'b_5_val', label: 'Jumlah orang' }],
      },
      {
        id: 'B_6',
        no: '6',
        excelNo: '6',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator:
          'Efektivitas penjaringan calon mahasiswa dari Sekolah Unggulan dan seleksi Industri / Pemerintah Daerah',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula:
          'Jumlah mahasiswa baru yang berasal dari Ikker, SMA Unggulan dan seleksi Industri / Pemerintah Daerah',
        bobot: 4,
        bobotDisplay: '4',
        targetDisplay: '300',
        targetNum: 300,
        satuan: 'jumlah',
        calcType: 'primary_with_meta',
        subrows: [
          { key: 'b_6_orang', label: 'jumlah orang' },
          { key: 'b_6_pemda', label: 'Jumlah Pemerintah Daerah' },
        ],
      },
    ],
  },

  // ─── BAGIAN C: PERSPEKTIF BISNIS INTERNAL, LEARNING & DEVELOPMENT (BOBOT 49) ───
  {
    code: 'C',
    title: 'PERSPEKTIF BISNIS INTERNAL, LEARNING & DEVELOPMENT',
    totalWeight: 49,
    weightDisplay: '49',
    isPenaltySection: false,
    items: [
      {
        id: 'C_1',
        no: '1',
        excelNo: '1',
        excelNoRowSpan: 1,
        hideExcelNo: false,
        indikator: 'Penerapan Kurikulum berbasis Outcome Based Education (OBE)',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula:
          'Persentase Jumlah Mata Kuliah Prodi S1 dan D3 pada semester 1 dan 2 yang sudah menerapkan kurikulum berbasis OBE',
        bobot: 4,
        bobotDisplay: '4',
        targetDisplay: '100',
        targetNum: 100,
        satuan: '%',
        calcType: 'single_target',
        subrows: [
          {
            key: 'c_1_val',
            label:
              'Persentase Jumlah Mata Kuliah Prodi S1 dan D3 pada semester 1 dan 2 yang sudah menerapkan kurikulum berbasis OBE',
          },
        ],
      },
      {
        id: 'C_2a',
        no: '2a',
        excelNo: '2',
        excelNoRowSpan: 9,
        hideExcelNo: false,
        groupBannerTitle: 'Klasterisasi Perguruan Tinggi Menuju Mandiri',
        indikator: 'a. Penelitian',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Jumlah Kegiatan Penelitian yang didanai dari Hibah Internal & Eksternal',
        bobot: 7,
        bobotDisplay: '7',
        targetDisplay: '135',
        targetNum: 135,
        satuan: 'Penelitian',
        calcType: 'single_target',
        subrows: [
          {
            key: 'c_2a_val',
            label: 'Jumlah Kegiatan Penelitian yang didanai dari Hibah Internal & Eksternal',
          },
        ],
      },
      {
        id: 'C_2b',
        no: '2b',
        excelNo: '',
        excelNoRowSpan: 0,
        hideExcelNo: true,
        indikator: 'b. Publikasi ilmiah',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula:
          'Jumlah karya dosen di jurnal ilmiah atau Prosiding Bereputasi Nasional maupun SCOPUS (Submitted)',
        bobot: 6,
        bobotDisplay: '6',
        targetDisplay: '245',
        targetNum: 245,
        satuan: 'Artikel Ilmiah',
        calcType: 'single_target',
        subrows: [
          {
            key: 'c_2b_val',
            label:
              'Jumlah karya dosen di jurnal ilmiah atau Prosiding Bereputasi Nasional maupun SCOPUS (Submitted)',
          },
        ],
      },
      {
        id: 'C_2c',
        no: '2c',
        excelNo: '',
        excelNoRowSpan: 0,
        hideExcelNo: true,
        indikator: 'c. Sitasi',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula:
          '(Jumlah artikel ilmiah di Jurnal atau Prosiding terakreditasi di nasional dan internasional yang tersitasi pada artikel ilmiah lain) / (Jumlah seluruh artikel ilmiah di Jurnal atau Prosiding terakreditasi di nasional dan internasional ) x 100%',
        bobot: 6,
        bobotDisplay: '6',
        targetDisplay: '28',
        targetNum: 28,
        satuan: '%',
        calcType: 'ratio_target_pct',
        subrows: [
          {
            key: 'c_2c_num',
            label:
              '(Jumlah artikel ilmiah di Jurnal atau Prosiding terakreditasi di nasional dan internasional yang tersitasi pada artikel ilmiah lain) /',
          },
          {
            key: 'c_2c_den',
            label:
              '(Jumlah seluruh artikel ilmiah di Jurnal atau Prosiding terakreditasi di nasional dan internasional ) x 100%',
            isDenominator: true,
          },
        ],
      },
      {
        id: 'C_2d',
        no: '2d',
        excelNo: '',
        excelNoRowSpan: 0,
        hideExcelNo: true,
        indikator: 'd. PKM',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Jumlah Pengabdian Masyarakat (Internal Institusi dan atau Eksternal)',
        bobot: 4,
        bobotDisplay: '4',
        targetDisplay: '55',
        targetNum: 55,
        satuan: 'Kegiatan',
        calcType: 'single_target',
        subrows: [
          {
            key: 'c_2d_val',
            label: 'Jumlah Pengabdian Masyarakat (Internal Institusi dan atau Eksternal)',
          },
        ],
      },
      {
        id: 'C_2e',
        no: '2e',
        excelNo: '',
        excelNoRowSpan: 0,
        hideExcelNo: true,
        indikator: 'e. HKI',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Jumlah HKI (Hak Cipta & Paten)',
        bobot: 4,
        bobotDisplay: '4',
        targetDisplay: '60',
        targetNum: 60,
        satuan: 'HKI',
        calcType: 'single_target',
        subrows: [{ key: 'c_2e_val', label: 'Jumlah HKI (Hak Cipta & Paten)' }],
      },
      {
        id: 'C_2f',
        no: '2f',
        excelNo: '',
        excelNoRowSpan: 0,
        hideExcelNo: true,
        indikator: 'f. Kapasitas Dosen',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Jumlah Dosen yang menjadi Reviewer Jurnal Nasional / Internasional',
        bobot: 3,
        bobotDisplay: '3',
        targetDisplay: '70',
        targetNum: 70,
        satuan: 'Dosen',
        calcType: 'single_target',
        subrows: [
          {
            key: 'c_2f_val',
            label: 'Jumlah Dosen yang menjadi Reviewer Jurnal Nasional / Internasional',
          },
        ],
      },
      {
        id: 'C_2g',
        no: '2g',
        excelNo: '',
        excelNoRowSpan: 0,
        hideExcelNo: true,
        indikator: 'g. Akreditasi Program',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula:
          'Jumlah Prodi yang sudah meningkatkan rekomendasi improvement dari hasil self assesment untuk tercapai akreditasi unggul',
        bobot: 4,
        bobotDisplay: '4',
        targetDisplay: '2',
        targetNum: 2,
        satuan: 'Prodi',
        calcType: 'single_target',
        subrows: [
          {
            key: 'c_2g_val',
            label:
              'Jumlah Prodi yang sudah meningkatkan rekomendasi improvement dari hasil self assesment untuk tercapai akreditasi unggul',
          },
        ],
      },
      {
        id: 'C_3',
        no: '3',
        excelNo: '3',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Peningkatan kualitas Dosen',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula:
          'Jumlah dosen dengan jabatan fungsional dosen (Lektor, Lektor Kepala, Guru Besar) / Jumlah dosen tetap Ber-NIDN ITPLN (diluar Dosen PLN) x 100%',
        bobot: 6,
        bobotDisplay: '6',
        targetDisplay: '60',
        targetNum: 60,
        satuan: '%',
        calcType: 'ratio_target_pct',
        subrows: [
          { key: 'c_3_num', label: 'Jumlah Dosen dg JF Lektor, Lektor Kepala dan GB' },
          {
            key: 'c_3_den',
            label: 'Jumlah Dosen Tetap (Diluar DOSEN PLN)',
            isDenominator: true,
          },
        ],
      },
      {
        id: 'C_4',
        no: '4',
        excelNo: '4',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator:
          'Kerjasama Akademik dengan Industri dan atau Perguruan Tinggi terkait dengan Penelitian, Magang, Pengabdian Kepada Masyarakat dan guest lecture',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula:
          'Jumlah kerjasama akademik dengan Industri atau Perguruan Tinggi pada program studi S1 dan D3',
        bobot: 5,
        bobotDisplay: '5',
        targetDisplay: '65',
        targetNum: 65,
        satuan: 'Jumlah',
        calcType: 'sum_two_target',
        subrows: [
          { key: 'c_4_bkan', label: 'BKAN =' },
          { key: 'c_4_bpkl', label: 'BPKL =' },
        ],
      },
    ],
  },

  // ─── BAGIAN D: PERSPEKTIF KEPATUHAN / COMPLIANCE (BOBOT -12,5) ───
  {
    code: 'D',
    title: 'PERSPEKTIF KEPATUHAN (COMPLIANCE)',
    totalWeight: -12.5,
    weightDisplay: '-12,5',
    isPenaltySection: true,
    items: [
      {
        id: 'D_1',
        no: '1',
        excelNo: '1',
        excelNoRowSpan: 1,
        hideExcelNo: false,
        indikator: 'Ketepatan Waktu Penyampaian Dokumen RKA 2027',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Dokumen RKA 2027 diterima YPK PLN paling Lambat pada Tanggal Target',
        bobot: -2.5,
        bobotDisplay: '-2,5',
        targetDisplay: '01-Dec-26',
        deadlineISO: '2026-12-01',
        satuan: '-',
        calcType: 'compliance_date_single',
        subrows: [
          {
            key: 'd_1_date',
            label: 'Tanggal Kirim Dokumen',
            placeholder: 'Contoh: 28-Nov-26',
            isTextInput: true,
          },
        ],
      },
      {
        id: 'D_2',
        no: '2',
        excelNo: '2',
        excelNoRowSpan: 1,
        hideExcelNo: false,
        indikator: 'Ketepatan Waktu Penyampaian Dokumen LK 2025',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Dokumen LK Audited 2025 diterima YPK PLN paling Lambat pada Tanggal Target',
        bobot: -2.5,
        bobotDisplay: '-2,5',
        targetDisplay: '31-Mar-26',
        deadlineISO: '2026-03-31',
        satuan: '-',
        calcType: 'compliance_date_single',
        subrows: [
          {
            key: 'd_2_date',
            label: 'Tanggal Kirim Dokumen',
            placeholder: 'Contoh: 25-Mar-26',
            isTextInput: true,
          },
        ],
      },
      {
        id: 'D_3',
        no: '3',
        excelNo: '3',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Ketepatan waktu pelaporan manajemen',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula: 'Dokumen LM diterima YPK PLN paling Lambat pada Tanggal Target (Semesteran)',
        bobot: -2.5,
        bobotDisplay: '-2,5',
        targetDisplay: 'Juli 2026, / Januari 2027',
        subrowTargets: ['Juli 2026,', 'Januari 2027'], // Sesuai Excel: kolom Target terpecah 2 baris
        deadlinesISO: ['2026-07-31', '2027-01-31'],
        satuan: '-',
        calcType: 'compliance_date_dual',
        subrows: [
          {
            key: 'd_3_sem1',
            label: 'Tanggal Kirim Dokumen',
            placeholder: 'Contoh: 20-Jul-26',
            isTextInput: true,
          },
          {
            key: 'd_3_sem2',
            label: 'Tanggal Kirim Dokumen',
            placeholder: 'Contoh: 22-Jan-27',
            isTextInput: true,
          },
        ],
      },
      {
        id: 'D_4',
        no: '4',
        excelNo: '4',
        excelNoRowSpan: 1,
        hideExcelNo: false,
        indikator: 'Integrasi Siakad & SimKug',
        indikatorRowSpan: 1,
        hideIndikatorCell: false,
        formula: 'Siakad & SimKug terintegrasi penuh',
        bobot: -2.5,
        bobotDisplay: '-2,5',
        targetDisplay: '100',
        targetNum: 100,
        satuan: '%',
        calcType: 'compliance_integration_pct',
        subrows: [
          {
            key: 'd_4_val',
            label: 'Siakad & SimKug terintegrasi penuh',
            placeholder: '0 - 100',
          },
        ],
      },
      {
        id: 'D_5',
        no: '5',
        excelNo: '5',
        excelNoRowSpan: 2,
        hideExcelNo: false,
        indikator: 'Tindaklanjut Rekomendasi Audit & Temuan (SPI, PJM, KAP, WBS)',
        indikatorRowSpan: 2,
        hideIndikatorCell: false,
        formula:
          'Jumlah Rekomendasi Audit atau Temuan yg belum Ditindaklanjuti / Jumlah Rekomendasi * Bobot',
        bobot: -2.5,
        bobotDisplay: '-2,5',
        targetDisplay: '0',
        targetNum: 0,
        satuan: '%',
        calcType: 'compliance_audit_ratio',
        subrows: [
          {
            key: 'd_5_un',
            label: 'Jumlah Rekomendasi Audit atau Temuan yg belum Ditindaklanjuti',
            placeholder: '0',
          },
          {
            key: 'd_5_tot',
            label: 'Jumlah Rekomendasi',
            placeholder: '0',
            isDenominator: true,
          },
        ],
      },
    ],
  },
];

const ALL_ORDERED_KEYS = KPI_SECTIONS_CONFIG.flatMap((sec) =>
  sec.items.flatMap((item) => item.subrows.map((s) => s.key))
);

const STORAGE_KEY = 'performa_kpi_bagian_abcd_v5';
const WORKFLOW_KEY = 'performa_kpi_workflow_v1';

const WORKFLOW_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  NEEDS_REVISION: 'NEEDS_REVISION',
  APPROVED: 'APPROVED',
  OVERDUE: 'OVERDUE',
};

const WORKFLOW_LABELS = {
  [WORKFLOW_STATUS.NOT_STARTED]: 'Belum Diisi',
  [WORKFLOW_STATUS.DRAFT]: 'Sedang Dikerjakan',
  [WORKFLOW_STATUS.SUBMITTED]: 'Sudah Dikirim',
  [WORKFLOW_STATUS.NEEDS_REVISION]: 'Perlu Revisi',
  [WORKFLOW_STATUS.APPROVED]: 'Disetujui',
  [WORKFLOW_STATUS.OVERDUE]: 'Terlambat',
};

export default function KPIDataEntrySheet({ onMetricsUpdate }) {
  const containerRef = useRef(null);
  const inputRefs = useRef({});
  const fillProgressRef = useRef(null);
  const scrollReadBarRef = useRef(null);
  const tabPillRef = useRef(null);

  // Filter tab: 'ALL' | 'A' | 'B' | 'C' | 'D'
  const [activeSectionTab, setActiveSectionTab] = useState('ALL');
  const [focusedKey, setFocusedKey] = useState(null);
  const [lastSaved, setLastSaved] = useState('Siap');
  const [workflow, setWorkflow] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(WORKFLOW_KEY)) || {
        status: WORKFLOW_STATUS.NOT_STARTED,
        submittedAt: null,
        submittedBy: 'PIC KPI Unit',
        revisionNote: '',
        history: [],
      };
    } catch {
      return { status: WORKFLOW_STATUS.NOT_STARTED, submittedAt: null, submittedBy: 'PIC KPI Unit', revisionNote: '', history: [] };
    }
  });

  const emptyDefaults = useMemo(() => {
    const map = {};
    ALL_ORDERED_KEYS.forEach((k) => {
      map[k] = '';
    });
    return map;
  }, []);

  const [values, setValues] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...emptyDefaults, ...JSON.parse(saved) };
    } catch {
      // Ignore storage error
    }
    return emptyDefaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      setLastSaved(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    } catch {
      // Ignore
    }
  }, [values]);

  useEffect(() => {
    try {
      localStorage.setItem(WORKFLOW_KEY, JSON.stringify(workflow));
    } catch {
      // Ignore storage error
    }
  }, [workflow]);

  // ─── KALKULASI REAL-TIME BAGIAN A, B, C, DAN D ───
  const calculated = useMemo(() => {
    let totalFilledInputs = 0;
    let totalInvalidInputs = 0;
    let totalCompletedIndicators = 0;
    let totalIndicatorsCount = 0;
    let positiveScoreABC = 0;
    let penaltyScoreD = 0;

    const sections = KPI_SECTIONS_CONFIG.map((sec) => {
      let secScore = 0;
      let secCompleted = 0;

      const computedItems = sec.items.map((item) => {
        totalIndicatorsCount += 1;

        const parsedSubs = item.subrows.map((sub) => {
          const raw = values[sub.key] ?? '';
          const trimmed = String(raw).trim();
          const num = parseIndonesianNumber(raw);
          const dateObj = sub.isTextInput ? parseFlexibleDate(raw) : null;

          const isFilled = sub.isTextInput
            ? trimmed !== '' && (dateObj !== null || num !== null)
            : num !== null;

          const isInvalid = sub.isTextInput
            ? trimmed !== '' && dateObj === null && num === null
            : trimmed !== '' && num === null;

          if (isFilled) totalFilledInputs += 1;
          if (isInvalid) totalInvalidInputs += 1;

          return {
            ...sub,
            raw,
            num,
            dateObj,
            isInvalid,
          };
        });

        let ratioPercent = null;
        let weightedScore = null;
        let extraNote = null;

        if (item.calcType === 'ratio_two') {
          const n1 = parsedSubs[0]?.num;
          const n2 = parsedSubs[1]?.num;
          if (n1 !== null && n2 !== null && n2 !== 0) {
            ratioPercent = (n1 / n2) * 100;
            weightedScore = (ratioPercent / 100) * item.bobot;
          }
        } else if (item.calcType === 'ratio_target_pct') {
          const n1 = parsedSubs[0]?.num;
          const n2 = parsedSubs[1]?.num;
          if (n1 !== null && n2 !== null && n2 !== 0 && item.targetNum > 0) {
            const actualPct = (n1 / n2) * 100;
            ratioPercent = (actualPct / item.targetNum) * 100;
            weightedScore = (ratioPercent / 100) * item.bobot;
            extraNote = `Rasio Aktual: ${formatIndonesianNumber(actualPct, 2)}% (Target: ${item.targetDisplay}%)`;
          }
        } else if (item.calcType === 'sum_two_target') {
          const n1 = parsedSubs[0]?.num;
          const n2 = parsedSubs[1]?.num;
          if ((n1 !== null || n2 !== null) && item.targetNum > 0) {
            const totalSum = (n1 || 0) + (n2 || 0);
            ratioPercent = (totalSum / item.targetNum) * 100;
            weightedScore = (ratioPercent / 100) * item.bobot;
            extraNote = `Total Kerjasama (BKAN + BPKL): ${formatIndonesianNumber(totalSum, 0)} dari ${item.targetDisplay}`;
          }
        } else if (item.calcType === 'tracer_study') {
          const compNums = parsedSubs.slice(0, 6).map((s) => s.num);
          const respNum = parsedSubs[6]?.num;
          const hasAtLeastOneComp = compNums.some((n) => n !== null);

          if (hasAtLeastOneComp && respNum !== null && respNum > 0) {
            const sumLulusan = compNums.reduce((acc, curr) => acc + (curr || 0), 0);
            const rawTracerPct = (sumLulusan / respNum) * 100;
            ratioPercent = (rawTracerPct / item.targetNum) * 100;
            weightedScore = (ratioPercent / 100) * item.bobot;
            extraNote = `Serapan Tracer: ${formatIndonesianNumber(rawTracerPct, 2)}% (${formatIndonesianNumber(sumLulusan, 0)} / ${formatIndonesianNumber(respNum, 0)} responden)`;
          }
        } else if (item.calcType === 'single_target') {
          const valNum = parsedSubs[0]?.num;
          if (valNum !== null && item.targetNum > 0) {
            ratioPercent = (valNum / item.targetNum) * 100;
            weightedScore = (ratioPercent / 100) * item.bobot;
          }
        } else if (item.calcType === 'primary_with_meta') {
          const mainNum = parsedSubs[0]?.num;
          const metaNum = parsedSubs[1]?.num;
          if (mainNum !== null && item.targetNum > 0) {
            ratioPercent = (mainNum / item.targetNum) * 100;
            weightedScore = (ratioPercent / 100) * item.bobot;
            if (metaNum !== null) {
              extraNote = `${formatIndonesianNumber(metaNum, 0)} Pemda Mitra`;
            }
          }
        } else if (item.calcType === 'compliance_date_single') {
          // Bagian D No 1 & 2: Bandingkan Tanggal Kirim vs Tanggal Target
          const sub = parsedSubs[0];
          const targetDate = new Date(item.deadlineISO + 'T23:59:59');
          if (sub.dateObj) {
            const isOnTime = sub.dateObj.getTime() <= targetDate.getTime();
            ratioPercent = isOnTime ? 100 : 0;
            weightedScore = isOnTime ? 0 : item.bobot; // 0 jika tepat waktu, -2.5 jika terlambat
            extraNote = isOnTime ? 'Status: Tepat Waktu (Penalti 0)' : 'Status: Melewati Target (-2,5)';
          } else if (sub.num !== null) {
            const pct = Math.min(100, Math.max(0, sub.num));
            ratioPercent = pct;
            weightedScore = ((100 - pct) / 100) * item.bobot;
          }
        } else if (item.calcType === 'compliance_date_dual') {
          // Bagian D No 3: 2 Tanggal Semesteran (Juli 2026 & Januari 2027)
          const sub1 = parsedSubs[0];
          const sub2 = parsedSubs[1];
          const t1 = new Date(item.deadlinesISO[0] + 'T23:59:59');
          const t2 = new Date(item.deadlinesISO[1] + 'T23:59:59');

          const has1 = sub1.dateObj !== null || sub1.num !== null;
          const has2 = sub2.dateObj !== null || sub2.num !== null;

          if (has1 || has2) {
            const ok1 = sub1.dateObj
              ? sub1.dateObj.getTime() <= t1.getTime()
              : sub1.num !== null
                ? sub1.num >= 100
                : true;
            const ok2 = sub2.dateObj
              ? sub2.dateObj.getTime() <= t2.getTime()
              : sub2.num !== null
                ? sub2.num >= 100
                : true;

            const onTimeCount = (has1 && ok1 ? 1 : 0) + (has2 && ok2 ? 1 : 0);
            const lateCount = (has1 && !ok1 ? 1 : 0) + (has2 && !ok2 ? 1 : 0);
            const filledSem = (has1 ? 1 : 0) + (has2 ? 1 : 0);

            ratioPercent = (onTimeCount / filledSem) * 100;
            weightedScore = (lateCount / 2) * item.bobot; // -1.25 per semester yang terlambat
            extraNote =
              lateCount === 0
                ? 'Semesteran Tepat Waktu (Penalti 0)'
                : `${lateCount} Semester Terlambat (${formatIndonesianNumber(weightedScore, 2)})`;
          }
        } else if (item.calcType === 'compliance_integration_pct') {
          // Bagian D No 4: Integrasi Siakad & SimKug (Target 100%)
          const valNum = parsedSubs[0]?.num;
          if (valNum !== null) {
            const clamped = Math.min(100, Math.max(0, valNum));
            ratioPercent = clamped;
            weightedScore = ((100 - clamped) / 100) * item.bobot;
            if (Math.abs(weightedScore) < 1e-9) weightedScore = 0;
          }
        } else if (item.calcType === 'compliance_audit_ratio') {
          // Bagian D No 5: (Jumlah Belum Ditindaklanjuti / Jumlah Rekomendasi) * Bobot (-2,5)
          const unNum = parsedSubs[0]?.num;
          const totNum = parsedSubs[1]?.num;
          if (unNum !== null && totNum !== null && totNum > 0) {
            const unRatio = Math.min(1, Math.max(0, unNum / totNum));
            const unPct = unRatio * 100;
            ratioPercent = Math.max(0, 100 - unPct); // % Tindaklanjut selesai
            weightedScore = unRatio * item.bobot; // Sesuai formula Excel: (Belum / Total) * -2,5
            if (Math.abs(weightedScore) < 1e-9) weightedScore = 0;
            extraNote = `Belum Tindaklanjut: ${formatIndonesianNumber(unPct, 2)}% (${formatIndonesianNumber(unNum, 0)} / ${formatIndonesianNumber(totNum, 0)} rekomendasi)`;
          }
        }

        if (ratioPercent !== null && weightedScore !== null) {
          secCompleted += 1;
          totalCompletedIndicators += 1;
          secScore += weightedScore;
        }

        return {
          ...item,
          parsedSubs,
          ratioPercent,
          weightedScore,
          extraNote,
        };
      });

      if (sec.isPenaltySection) {
        penaltyScoreD += secScore;
      } else {
        positiveScoreABC += secScore;
      }

      return {
        ...sec,
        items: computedItems,
        secScore,
        secCompleted,
        secTotalItems: sec.items.length,
      };
    });

    const netTotalScore = positiveScoreABC + penaltyScoreD;
    const completionRatio = totalFilledInputs / ALL_ORDERED_KEYS.length;

    return {
      sections,
      totalFilledInputs,
      totalInvalidInputs,
      totalInputsCount: ALL_ORDERED_KEYS.length,
      totalCompletedIndicators,
      totalIndicatorsCount,
      positiveScoreABC,
      penaltyScoreD,
      netTotalScore,
      completionRatio,
    };
  }, [values]);

  useEffect(() => {
    if (onMetricsUpdate) {
      const secA = calculated.sections[0];
      const secB = calculated.sections[1];
      const secC = calculated.sections[2];
      const secD = calculated.sections[3];
      onMetricsUpdate({
        totalBobot: 100,
        totalScore: calculated.netTotalScore,
        positiveScoreABC: calculated.positiveScoreABC,
        penaltyScoreD: calculated.penaltyScoreD,
        filledCount: calculated.totalCompletedIndicators,
        totalCount: calculated.totalIndicatorsCount,
        filledInputsCount: calculated.totalFilledInputs,
        totalInputsCount: calculated.totalInputsCount,
        scoreA: secA?.secScore || 0,
        scoreB: secB?.secScore || 0,
        scoreC: secC?.secScore || 0,
        scoreD: secD?.secScore || 0,
      });
    }
  }, [calculated, onMetricsUpdate]);

  // ─── ULTRA GSAP SCROLL MOTION (TERHUBUNG KE .internal-main-scroll) ───
  useGSAP(() => {
    const scrollerEl = document.querySelector('.internal-main-scroll');

    // 1. Sliding White Pill pada 5 Tab Perspektif (ALL, A, B, C, D)
    const tabMap = { ALL: 0, A: 1, B: 2, C: 3, D: 4 };
    const tabIdx = tabMap[activeSectionTab] ?? 0;
    if (tabPillRef.current) {
      gsap.to(tabPillRef.current, {
        xPercent: tabIdx * 100,
        duration: 0.55,
        ease: 'expo.out',
      });
    }

    // 2. Staggered Entrance Halus saat Tab Berubah
    gsap.fromTo(
      '.ledger-section-card',
      { y: 24, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        stagger: 0.08,
        ease: 'expo.out',
        overwrite: 'auto',
      }
    );

    // 3. Kinetic ScrollTrigger per Kelompok Indikator di Dalam Scroller Internal
    if (scrollerEl) {
      const indicatorGroups = gsap.utils.toArray('.kpi-indicator-tbody');
      indicatorGroups.forEach((group) => {
        gsap.fromTo(
          group,
          { y: 16, opacity: 0.28 },
          {
            y: 0,
            opacity: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: group,
              scroller: scrollerEl,
              start: 'top 96%',
              end: 'top 75%',
              scrub: 0.5,
            },
          }
        );
      });

      // 4. Scroll-Scrubbed Reading Progress Line
      if (scrollReadBarRef.current) {
        gsap.fromTo(
          scrollReadBarRef.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            transformOrigin: 'left center',
            scrollTrigger: {
              trigger: containerRef.current,
              scroller: scrollerEl,
              start: 'top top',
              end: 'bottom bottom',
              scrub: 0.4,
            },
          }
        );
      }
    }

    ScrollTrigger.refresh();
  }, { dependencies: [activeSectionTab], scope: containerRef });

  useGSAP(() => {
    if (fillProgressRef.current) {
      gsap.to(fillProgressRef.current, {
        scaleX: calculated.completionRatio,
        duration: 0.65,
        ease: 'expo.out',
      });
    }
  }, { dependencies: [calculated.completionRatio], scope: containerRef });

  const handleCellChange = (key, val) => {
    if (workflow.status === WORKFLOW_STATUS.SUBMITTED || workflow.status === WORKFLOW_STATUS.APPROVED) return;

    setValues((prev) => ({
      ...prev,
      [key]: val,
    }));
    setWorkflow((prev) => ({
      ...prev,
      status: prev.status === WORKFLOW_STATUS.NOT_STARTED ? WORKFLOW_STATUS.DRAFT : prev.status,
    }));
  };

  // Navigasi Keyboard Enter / ArrowDown / ArrowUp
  const handleKeyDown = (e, currentKey) => {
    const idx = ALL_ORDERED_KEYS.indexOf(currentKey);
    if (idx === -1) return;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextKey = ALL_ORDERED_KEYS[idx + 1];
      if (nextKey && inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
        inputRefs.current[nextKey].select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevKey = ALL_ORDERED_KEYS[idx - 1];
      if (prevKey && inputRefs.current[prevKey]) {
        inputRefs.current[prevKey].focus();
        inputRefs.current[prevKey].select();
      }
    }
  };

  // Simulasi Data Lengkap Bagian A, B, C, dan D
  const handleFillSample = () => {
    if (workflow.status === WORKFLOW_STATUS.SUBMITTED || workflow.status === WORKFLOW_STATUS.APPROVED) return;
    setValues({
      // Bagian A (Bobot 25)
      'a_1a_num': '1.850',
      'a_1a_den': '2.000',
      'a_1b_num': '94,5',
      'a_1b_den': '100',
      'a_2_num': '76,25',
      'a_2_den': '80',
      'a_3_num': '82,4',
      'a_3_den': '95',
      'a_4_num': '21,5',
      'a_4_den': '95',
      'a_5_num': '78,8',
      'a_5_den': '90',
      'a_6_num': '48',
      'a_6_den': '50',
      // Bagian B (Bobot 26)
      'b_1a_1': '420',
      'b_1a_2': '85',
      'b_1a_3': '60',
      'b_1a_4': '25',
      'b_1a_5': '45',
      'b_1a_6': '35',
      'b_1a_resp': '950',
      'b_1b_val': '96',
      'b_2_val': '128',
      'b_3_val': '3,68',
      'b_4_val': '3,75',
      'b_5_val': '2',
      'b_6_orang': '285',
      'b_6_pemda': '14',
      // Bagian C (Bobot 49)
      'c_1_val': '96,5',
      'c_2a_val': '132',
      'c_2b_val': '240',
      'c_2c_num': '72',
      'c_2c_den': '250',
      'c_2d_val': '54',
      'c_2e_val': '58',
      'c_2f_val': '68',
      'c_2g_val': '2',
      'c_3_num': '118',
      'c_3_den': '195',
      'c_4_bkan': '38',
      'c_4_bpkl': '29',
      // Bagian D (Bobot Kepatuhan -12,5)
      'd_1_date': '25-Nov-26',
      'd_2_date': '26-Mar-26',
      'd_3_sem1': '20-Jul-26',
      'd_3_sem2': '22-Jan-27',
      'd_4_val': '100',
      'd_5_un': '0',
      'd_5_tot': '24',
    });
    setWorkflow((prev) => ({ ...prev, status: WORKFLOW_STATUS.DRAFT, revisionNote: '' }));
  };

  const handleReset = () => {
    if (workflow.status === WORKFLOW_STATUS.SUBMITTED || workflow.status === WORKFLOW_STATUS.APPROVED) return;
    setValues(emptyDefaults);
    setWorkflow((prev) => ({ ...prev, status: WORKFLOW_STATUS.NOT_STARTED, revisionNote: '' }));
  };

  const handleSubmit = () => {
    if (calculated.totalInvalidInputs > 0) {
      alert(`Masih ada ${calculated.totalInvalidInputs} isian dengan format tidak valid. Periksa kembali sebelum submit.`);
      return;
    }

    if (calculated.totalFilledInputs < calculated.totalInputsCount) {
      const missingCount = calculated.totalInputsCount - calculated.totalFilledInputs;
      alert(`Lembar kerja belum lengkap. Masih ada ${missingCount} isian wajib yang kosong.`);
      return;
    }

    const confirmed = window.confirm(
      'Setelah dikirim, lembar kerja akan terkunci dan tidak dapat diedit secara langsung. Anda yakin ingin submit?'
    );
    if (!confirmed) return;

    const submittedAt = new Date().toISOString();
    setWorkflow((prev) => ({
      ...prev,
      status: WORKFLOW_STATUS.SUBMITTED,
      submittedAt,
      revisionNote: '',
      history: [
        ...(prev.history || []),
        { status: WORKFLOW_STATUS.SUBMITTED, at: submittedAt, note: 'Lembar kerja dikirim oleh PIC KPI Unit.' },
      ],
    }));
  };

  const handleRequestRevision = () => {
    const note = window.prompt(
      'Jelaskan alasan permintaan pembukaan kembali lembar kerja:',
      'Terdapat kesalahan data yang perlu diperbaiki.'
    );
    if (!note?.trim()) return;

    const requestedAt = new Date().toISOString();
    setWorkflow((prev) => ({
      ...prev,
      status: WORKFLOW_STATUS.NEEDS_REVISION,
      revisionNote: note.trim(),
      history: [
        ...(prev.history || []),
        { status: WORKFLOW_STATUS.NEEDS_REVISION, at: requestedAt, note: note.trim() },
      ],
    }));
  };

  const isLocked = workflow.status === WORKFLOW_STATUS.SUBMITTED || workflow.status === WORKFLOW_STATUS.APPROVED;
  const isComplete = calculated.totalFilledInputs === calculated.totalInputsCount && calculated.totalInvalidInputs === 0;
  const workflowStatusLabel = WORKFLOW_LABELS[workflow.status] || WORKFLOW_LABELS[WORKFLOW_STATUS.DRAFT];
  const workflowStatusTone = {
    [WORKFLOW_STATUS.NOT_STARTED]: { color: '#64748b', background: '#f8fafc', border: '#e2e8f0', icon: Clock3 },
    [WORKFLOW_STATUS.DRAFT]: { color: '#334155', background: '#f8fafc', border: '#cbd5e1', icon: History },
    [WORKFLOW_STATUS.SUBMITTED]: { color: '#166534', background: '#f0fdf4', border: '#bbf7d0', icon: CheckCircle2 },
    [WORKFLOW_STATUS.NEEDS_REVISION]: { color: '#92400e', background: '#fffbeb', border: '#fde68a', icon: AlertTriangle },
    [WORKFLOW_STATUS.APPROVED]: { color: '#1e3a8a', background: '#eff6ff', border: '#bfdbfe', icon: ShieldCheck },
  }[workflow.status] || { color: '#334155', background: '#f8fafc', border: '#cbd5e1', icon: History };
  const WorkflowIcon = workflowStatusTone.icon;

  // Builder Baris Tabel untuk Export Excel & PDF (Mencakup Bagian A, B, C, dan D)
  const buildDocumentRowsHtml = (isExcel = true) => {
    let html = '';

    calculated.sections.forEach((sec) => {
      if (isExcel) {
        html += `
          <tr style="background-color: #F1F5F9; font-weight: bold; color: #0F172A;">
            <td style="border:1px solid #CBD5E1; text-align:center; padding:8px;">${sec.code}</td>
            <td colspan="4" style="border:1px solid #CBD5E1; padding:8px;">${sec.title}</td>
            <td style="border:1px solid #CBD5E1; text-align:center; padding:8px;">${sec.weightDisplay}</td>
            <td colspan="4" style="border:1px solid #CBD5E1; padding:8px;"></td>
          </tr>
        `;
      } else {
        html += `
          <tr class="cat-row">
            <td class="center">${sec.code}</td>
            <td colspan="4">${sec.title}</td>
            <td class="center">${sec.weightDisplay}</td>
            <td colspan="4"></td>
          </tr>
        `;
      }

      sec.items.forEach((item) => {
        const subCount = item.parsedSubs.length;
        const capStr =
          item.ratioPercent !== null
            ? `${formatIndonesianNumber(item.ratioPercent, 2)}%`
            : isExcel
              ? ''
              : '—';
        const skorStr =
          item.weightedScore !== null
            ? formatIndonesianNumber(item.weightedScore, 2)
            : isExcel
              ? ''
              : '—';

        const hasGroupBanner = Boolean(item.groupBannerTitle);
        const hasSplitTargets = Array.isArray(item.subrowTargets);

        if (hasGroupBanner) {
          if (isExcel) {
            html += `
              <tr>
                <td rowspan="${item.excelNoRowSpan}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#0F172A;">${item.excelNo}</td>
                <td style="border:1px solid #CBD5E1; padding:7px; font-weight:bold; text-decoration:underline; color:#0F172A;">${item.groupBannerTitle}</td>
                <td style="border:1px solid #CBD5E1;"></td>
                <td style="border:1px solid #CBD5E1;"></td>
                <td style="border:1px solid #CBD5E1;"></td>
                <td style="border:1px solid #CBD5E1;"></td>
                <td style="border:1px solid #CBD5E1;"></td>
                <td style="border:1px solid #CBD5E1;"></td>
                <td style="border:1px solid #CBD5E1;"></td>
                <td style="border:1px solid #CBD5E1;"></td>
              </tr>
            `;
          } else {
            html += `
              <tr>
                <td rowspan="${item.excelNoRowSpan}" class="center bold">${item.excelNo}</td>
                <td class="bold" style="text-decoration: underline;">${item.groupBannerTitle}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            `;
          }
        }

        item.parsedSubs.forEach((sub, sIdx) => {
          if (sIdx === 0) {
            const firstTargetText = hasSplitTargets
              ? item.subrowTargets[0]
              : item.targetDisplay;
            const targetRowSpan = hasSplitTargets ? 1 : subCount;

            if (isExcel) {
              html += `
                <tr>
                  ${!item.hideExcelNo && !hasGroupBanner
                  ? `<td rowspan="${item.excelNoRowSpan}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#0F172A;">${item.excelNo}</td>`
                  : ''
                }
                  ${!item.hideIndikatorCell
                  ? `<td rowspan="${item.indikatorRowSpan}" style="border:1px solid #CBD5E1; vertical-align:middle; padding:7px; font-weight:600; color:#0F172A;">${item.indikator}</td>`
                  : ''
                }
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; vertical-align:middle; padding:7px; color:#334155;">${item.formula}</td>
                  <td style="border:1px solid #CBD5E1; padding:7px; color:#334155;">${sub.label}</td>
                  <td style="border:1px solid #CBD5E1; text-align:right; padding:7px; font-weight:bold; color:#0F172A;">${sub.raw || ''}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#0F172A;">${item.bobotDisplay}</td>
                  <td rowspan="${targetRowSpan}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; color:#0F172A;">${firstTargetText}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; color:#475569;">${item.satuan}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#0F172A;">${capStr}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#0F172A;">${skorStr}</td>
                </tr>
              `;
            } else {
              html += `
                <tr>
                  ${!item.hideExcelNo && !hasGroupBanner
                  ? `<td rowspan="${item.excelNoRowSpan}" class="center bold">${item.excelNo}</td>`
                  : ''
                }
                  ${!item.hideIndikatorCell
                  ? `<td rowspan="${item.indikatorRowSpan}" class="bold">${item.indikator}</td>`
                  : ''
                }
                  <td rowspan="${subCount}">${item.formula}</td>
                  <td>${sub.label}</td>
                  <td class="right bold">${sub.raw || '—'}</td>
                  <td rowspan="${subCount}" class="center bold">${item.bobotDisplay}</td>
                  <td rowspan="${targetRowSpan}" class="center">${firstTargetText}</td>
                  <td rowspan="${subCount}" class="center">${item.satuan}</td>
                  <td rowspan="${subCount}" class="center bold">${capStr}</td>
                  <td rowspan="${subCount}" class="center bold">${skorStr}</td>
                </tr>
              `;
            }
          } else {
            const subTargetCellExcel = hasSplitTargets
              ? `<td style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; color:#0F172A;">${item.subrowTargets[sIdx] || ''}</td>`
              : '';
            const subTargetCellPdf = hasSplitTargets
              ? `<td class="center">${item.subrowTargets[sIdx] || ''}</td>`
              : '';

            if (isExcel) {
              html += `
                <tr>
                  <td style="border:1px solid #CBD5E1; padding:7px; color:#334155;">${sub.label}</td>
                  <td style="border:1px solid #CBD5E1; text-align:right; padding:7px; font-weight:bold; color:#0F172A;">${sub.raw || ''}</td>
                  ${subTargetCellExcel}
                </tr>
              `;
            } else {
              html += `
                <tr>
                  <td>${sub.label}</td>
                  <td class="right bold">${sub.raw || '—'}</td>
                  ${subTargetCellPdf}
                </tr>
              `;
            }
          }
        });
      });
    });

    // Baris Rekapitulasi Skor Akhir (A + B + C + D)
    const netFormatted = formatIndonesianNumber(calculated.netTotalScore, 2);
    const posFormatted = formatIndonesianNumber(calculated.positiveScoreABC, 2);
    const penFormatted = formatIndonesianNumber(calculated.penaltyScoreD, 2);

    if (isExcel) {
      html += `
        <tr style="background-color: #F8FAFC; font-weight: bold; color: #0F172A;">
          <td colspan="5" style="border:1px solid #CBD5E1; text-align:right; padding:9px;">
            SKOR AKHIR KPI BERSIH — CAPAIAN (A+B+C: ${posFormatted}) + KEPATUHAN (D: ${penFormatted}):
          </td>
          <td style="border:1px solid #CBD5E1; text-align:center; padding:9px;">100</td>
          <td colspan="3" style="border:1px solid #CBD5E1;"></td>
          <td style="border:1px solid #CBD5E1; text-align:center; padding:9px;">${netFormatted}</td>
        </tr>
      `;
    } else {
      html += `
        <tr class="cat-row">
          <td colspan="5" class="right">
            SKOR AKHIR KPI BERSIH — CAPAIAN (A+B+C: ${posFormatted}) + KEPATUHAN (D: ${penFormatted}):
          </td>
          <td class="center">100</td>
          <td colspan="3"></td>
          <td class="center">${netFormatted}</td>
        </tr>
      `;
    }

    return html;
  };

  // 1. Export Excel (.xls) Lengkap Bagian A, B, C & D
  const handleExportExcel = () => {
    const tableRowsHtml = buildDocumentRowsHtml(true);

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>KPI A B C D ITPLN</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body style="font-family: Inter, Calibri, Arial, sans-serif; font-size: 10.5pt; color: #0F172A;">
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #F8FAFC; font-weight: bold; text-align: center; color: #0F172A;">
              <th style="border:1px solid #CBD5E1; padding:10px; width:45px;">NO</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:210px;">INDIKATOR KINERJA</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:260px;">FORMULA</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:260px;">Rumusan Mencapai Capaian</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:130px;">ISIAN</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:75px;">BOBOT</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:115px;">NILAI 100% (TARGET)</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:100px;">SATUAN</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:110px;">CAPAIAN (%)</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:100px;">SKOR</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', excelTemplate], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Laporan_KPI_Lengkap_A_B_C_D_ITPLN_2026.xls';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. Export PDF Resmi Lengkap Bagian A, B, C & D
  const handleExportPDF = () => {
    const printWin = window.open('', '_blank', 'width=1240,height=880');
    if (!printWin) {
      alert('Mohon izinkan pop-up di browser Anda untuk mengunduh dokumen PDF.');
      return;
    }

    const dateStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const rowsHtml = buildDocumentRowsHtml(false);
    const secA = calculated.sections[0];
    const secB = calculated.sections[1];
    const secC = calculated.sections[2];
    const secD = calculated.sections[3];

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dokumen_Evaluasi_KPI_Lengkap_A_B_C_D_ITPLN_2026</title>
        <style>
          @page { size: A4 landscape; margin: 9mm; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 8.2pt;
          }
          .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 1.5px solid #cbd5e1;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .doc-title {
            font-size: 13pt;
            font-weight: 800;
            margin: 0 0 2px 0;
            letter-spacing: -0.4px;
            color: #0f172a;
          }
          .doc-sub {
            font-size: 8pt;
            color: #64748b;
            margin: 0;
          }
          .summary-strip {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
          }
          .summary-box {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            padding: 6px 10px;
            border-radius: 6px;
            flex: 1;
          }
          .summary-label {
            font-size: 6.5pt;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            letter-spacing: 0.04em;
          }
          .summary-val {
            font-size: 10.5pt;
            font-weight: 800;
            margin-top: 2px;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 4px 6px;
            vertical-align: middle;
            line-height: 1.25;
          }
          th {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 6.8pt;
            font-weight: 800;
            text-transform: uppercase;
            text-align: center;
            color: #334155;
          }
          .cat-row td {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-weight: 800;
            color: #0f172a;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: 700; }
          .doc-footer {
            margin-top: 14px;
            display: flex;
            justify-content: space-between;
            font-size: 7.8pt;
            color: #475569;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div>
            <div class="doc-title">LAPORAN EVALUASI CAPAIAN KPI — PERSPEKTIF A, B, C & D</div>
            <div class="doc-sub">Institut Teknologi Perusahaan Listrik Negara (ITPLN) • Keberlanjutan (25) • Mahasiswa (26) • Bisnis Internal (49) • Kepatuhan (-12,5)</div>
          </div>
          <div style="text-align: right; font-size: 7.8pt; color: #475569;">
            <div><strong>Tanggal Cetak:</strong> ${dateStr}</div>
            <div><strong>Status Dokumen:</strong> Rekapitulasi Resmi</div>
          </div>
        </div>

        <div class="summary-strip">
          <div class="summary-box">
            <div class="summary-label">Bagian A • Keberlanjutan (25)</div>
            <div class="summary-val">${formatIndonesianNumber(secA.secScore, 2)} Poin</div>
          </div>
          <div class="summary-box">
            <div class="summary-label">Bagian B • Mahasiswa (26)</div>
            <div class="summary-val">${formatIndonesianNumber(secB.secScore, 2)} Poin</div>
          </div>
          <div class="summary-box">
            <div class="summary-label">Bagian C • Bisnis Internal (49)</div>
            <div class="summary-val">${formatIndonesianNumber(secC.secScore, 2)} Poin</div>
          </div>
          <div class="summary-box">
            <div class="summary-label">Bagian D • Kepatuhan (-12,5)</div>
            <div class="summary-val">${formatIndonesianNumber(secD.secScore, 2)} Poin</div>
          </div>
          <div class="summary-box">
            <div class="summary-label">Skor Akhir KPI Bersih</div>
            <div class="summary-val">${formatIndonesianNumber(calculated.netTotalScore, 2)} / 100</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 28px;">NO</th>
              <th style="width: 155px;">INDIKATOR KINERJA</th>
              <th style="width: 195px;">FORMULA</th>
              <th style="width: 195px;">Rumusan Mencapai Capaian</th>
              <th style="width: 85px;">ISIAN</th>
              <th style="width: 44px;">BOBOT</th>
              <th style="width: 72px;">NILAI 100% (TARGET)</th>
              <th style="width: 62px;">SATUAN</th>
              <th style="width: 64px;">CAPAIAN</th>
              <th style="width: 55px;">SKOR</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="doc-footer">
          <div>Dihasilkan otomatis melalui Sistem Performa Kinerja Terpadu ITPLN.</div>
          <div style="text-align: center; width: 220px;">
            <div>Jakarta, ${dateStr}</div>
            <div style="margin-top: 40px; border-top: 1px solid #94a3b8; padding-top: 4px; font-weight: 700; color: #0f172a;">
              Otoritas Penanggung Jawab Unit
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  };

  const visibleSections = useMemo(() => {
    if (activeSectionTab === 'A') return [calculated.sections[0]];
    if (activeSectionTab === 'B') return [calculated.sections[1]];
    if (activeSectionTab === 'C') return [calculated.sections[2]];
    if (activeSectionTab === 'D') return [calculated.sections[3]];
    return calculated.sections;
  }, [activeSectionTab, calculated.sections]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <style>{`
        .clean-ledger-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03), 0 8px 24px rgba(15, 23, 42, 0.02);
          overflow: hidden;
        }
        .clean-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        .clean-editorial-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          background: #ffffff;
          color: #0f172a;
          font-size: 0.82rem;
        }
        .clean-editorial-table th {
          background: #ffffff;
          color: #64748b;
          font-family: 'Inter', sans-serif;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #f1f5f9;
          text-align: left;
          vertical-align: middle;
        }
        .clean-editorial-table th:last-child {
          border-right: none;
        }
        .clean-editorial-table td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          border-right: 1px solid #f1f5f9;
          vertical-align: middle;
          color: #1e293b;
          line-height: 1.45;
        }
        .clean-editorial-table td:last-child {
          border-right: none;
        }
        .kpi-indicator-tbody {
          border-bottom: 1px solid #e2e8f0;
          transition: background-color 0.2s ease;
        }
        .kpi-indicator-tbody:last-child {
          border-bottom: none;
        }
        .kpi-indicator-tbody:hover {
          background-color: #fcfcfd;
        }
        .clean-input-cell {
          padding: 0.45rem 0.75rem !important;
          background: #ffffff;
          transition: all 0.2s ease;
        }
        .clean-input-cell.is-denominator {
          background: #f8fafc;
        }
        .clean-input-cell.is-focused {
          background: #f8fafc;
          box-shadow: inset 0 0 0 1.5px #475569;
        }
        .clean-input-cell.is-invalid {
          background: #fffafa;
          box-shadow: inset 0 0 0 1.5px #94a3b8;
        }
        .clean-sheet-input {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          background: #f8fafc;
          padding: 0.48rem 0.75rem;
          font-family: 'Outfit', 'Inter', sans-serif;
          font-size: 0.86rem;
          font-weight: 700;
          color: #0f172a;
          text-align: right;
          font-variant-numeric: tabular-nums;
          outline: none;
          box-sizing: border-box;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .clean-sheet-input:hover {
          border-color: #cbd5e1;
          background: #ffffff;
        }
        .clean-sheet-input:focus {
          border-color: #475569;
          background: #ffffff;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
        }
        .clean-sheet-input:disabled {
          cursor: not-allowed;
          color: #64748b;
          background: #f1f5f9;
          border-color: #e2e8f0;
        }
        .clean-sheet-input::placeholder {
          color: #cbd5e1;
          font-weight: 400;
          font-size: 0.76rem;
        }
        .clean-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.58rem 0.95rem;
          border-radius: 9px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #334155;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .clean-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
          transform: translateY(-1px);
        }
        .clean-btn:disabled {
          opacity: 0.48;
          cursor: not-allowed;
          transform: none;
        }
        .clean-btn:disabled:hover {
          background: #ffffff;
          border-color: #e2e8f0;
          color: #334155;
        }
        .clean-btn-primary {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          font-weight: 700;
        }
        .clean-btn-primary:hover {
          background: #e2e8f0;
          border-color: #94a3b8;
        }
      `}</style>

      {/* ─── WORKFLOW CONTROL CENTER ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          padding: '1rem 1.2rem',
          background: workflowStatusTone.background,
          border: `1px solid ${workflowStatusTone.border}`,
          borderRadius: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '9px',
              background: '#ffffff',
              border: `1px solid ${workflowStatusTone.border}`,
              color: workflowStatusTone.color,
            }}
          >
            <WorkflowIcon size={17} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <strong style={{ color: workflowStatusTone.color, fontSize: '0.86rem' }}>{workflowStatusLabel}</strong>
              {isLocked && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', color: '#64748b' }}><LockKeyhole size={12} /> Data terkunci</span>}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: '0.18rem' }}>
              {isLocked
                ? `Dikirim ${new Date(workflow.submittedAt).toLocaleString('id-ID')}`
                : `${calculated.totalFilledInputs} dari ${calculated.totalInputsCount} isian wajib terpenuhi`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '145px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.66rem', fontWeight: 700, marginBottom: '0.3rem' }}>
              <span>KELENGKAPAN</span><span>{Math.round(calculated.completionRatio * 100)}%</span>
            </div>
            <div style={{ height: '5px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${calculated.completionRatio * 100}%`, height: '100%', background: workflowStatusTone.color, borderRadius: '99px', transition: 'width 0.3s ease' }} />
            </div>
          </div>
          {!isLocked && (
            <button type="button" onClick={handleSubmit} className="clean-btn clean-btn-primary" disabled={!isComplete} title={!isComplete ? 'Lengkapi semua isian wajib terlebih dahulu' : 'Kirim lembar kerja untuk dikunci'}>
              <Send size={14} />
              <span>Submit Lembar Kerja</span>
            </button>
          )}
          {isLocked && workflow.status !== WORKFLOW_STATUS.APPROVED && (
            <button type="button" onClick={handleRequestRevision} className="clean-btn">
              <RefreshCcw size={14} />
              <span>Ajukan Pembukaan Revisi</span>
            </button>
          )}
        </div>
      </div>

      {workflow.status === WORKFLOW_STATUS.NEEDS_REVISION && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.8rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', color: '#92400e', fontSize: '0.76rem' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div><strong>Perlu perbaikan:</strong> {workflow.revisionNote || 'Lembar kerja dibuka kembali untuk diperbaiki.'} Setelah selesai, submit ulang agar data terkunci kembali.</div>
        </div>
      )}

      {/* ─── 1. STICKY ARCHITECTURAL TOOLBAR (5 TAB: SEMUA, A, B, C, D) ─── */}
      <div
        style={{
          position: 'sticky',
          top: '-0.5rem',
          zIndex: 25,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '0.85rem 1.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Garis Scroll-Scrubbed Progress Halus di Bawah Sticky Bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: '#f1f5f9',
          }}
        >
          <div
            ref={scrollReadBarRef}
            style={{
              width: '100%',
              height: '100%',
              background: '#64748b',
              transformOrigin: 'left center',
              transform: 'scaleX(0)',
            }}
          />
        </div>

        {/* Kiri: Segmented Control 5 Pilihan (Semua / A / B / C / D) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', overflowX: 'auto' }}>
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              background: '#f1f5f9',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              minWidth: '610px',
            }}
          >
            {/* White Floating Active Pill */}
            <div
              ref={tabPillRef}
              style={{
                position: 'absolute',
                top: '3px',
                bottom: '3px',
                left: '3px',
                width: 'calc((100% - 6px) / 5)',
                background: '#ffffff',
                borderRadius: '7px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                zIndex: 1,
              }}
            />
            {[
              { id: 'ALL', label: 'Semua (A–D)', sub: 'Lengkap' },
              { id: 'A', label: 'Bagian A', sub: 'Bobot 25' },
              { id: 'B', label: 'Bagian B', sub: 'Bobot 26' },
              { id: 'C', label: 'Bagian C', sub: 'Bobot 49' },
              { id: 'D', label: 'Bagian D', sub: 'Kepatuhan (-12,5)' },
            ].map((tab) => {
              const isSelected = activeSectionTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSectionTab(tab.id)}
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    border: 'none',
                    background: 'transparent',
                    padding: '0.42rem 0.5rem',
                    cursor: 'pointer',
                    color: isSelected ? '#0f172a' : '#64748b',
                    transition: 'color 0.25s ease',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', fontWeight: 700 }}>
                    {tab.label}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: isSelected ? '#475569' : '#94a3b8' }}>
                    {tab.sub}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
            Tersimpan ({lastSaved})
          </div>
        </div>

        {/* Kanan: Tombol Aksi & Ekspor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleFillSample} className="clean-btn" disabled={isLocked}>
            <SlidersHorizontal size={13} />
            <span>Isi Simulasi A–D</span>
          </button>

          <button type="button" onClick={handleReset} className="clean-btn" disabled={isLocked}>
            <RotateCcw size={13} />
            <span>Kosongkan</span>
          </button>

          <button type="button" onClick={handleExportExcel} className="clean-btn">
            <FileSpreadsheet size={14} />
            <span>Export Excel (.xls)</span>
          </button>

          <button type="button" onClick={handleExportPDF} className="clean-btn clean-btn-primary">
            <Printer size={14} />
            <span>Export PDF Resmi</span>
          </button>
        </div>
      </div>

      {/* Bar Progres Pengisian Sel Halus */}
      <div
        style={{
          width: '100%',
          height: '2px',
          background: '#f1f5f9',
          borderRadius: '99px',
          overflow: 'hidden',
        }}
      >
        <div
          ref={fillProgressRef}
          style={{
            width: '100%',
            height: '100%',
            background: '#475569',
            transformOrigin: 'left center',
            transform: 'scaleX(0)',
          }}
        />
      </div>

      {/* ─── 2. TABEL EDITORIAL KORPORAT (BAGIAN A, B, C & D) ─── */}
      {visibleSections.map((sec) => (
        <div key={sec.code} className="clean-ledger-card ledger-section-card">
          {/* Header Perspektif Bersih (Alabaster Light #f8fafc) */}
          <div className="clean-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '9px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                }}
              >
                {sec.code}
              </div>
              <div>
                <div
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: '#64748b',
                    textTransform: 'uppercase',
                  }}
                >
                  BAGIAN {sec.code} • BOBOT PERSPEKTIF: {sec.weightDisplay} POIN
                </div>
                <h3
                  style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: '1.08rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: '1px 0 0',
                    letterSpacing: '-0.3px',
                  }}
                >
                  {sec.title}
                </h3>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                fontSize: '0.78rem',
                color: '#475569',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>
                Terisi: <strong style={{ color: '#0f172a' }}>{sec.secCompleted} / {sec.secTotalItems}</strong> Butir
              </span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '99px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Skor Bagian {sec.code}: {formatIndonesianNumber(sec.secScore, 2)} / {sec.weightDisplay}
              </span>
            </div>
          </div>

          {/* Tabel Arsitektural Rapi */}
          <div style={{ overflowX: 'auto' }}>
            <table className="clean-editorial-table" style={{ minWidth: '1060px' }}>
              <colgroup>
                <col style={{ width: '54px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '235px' }} />
                <col style={{ width: '245px' }} />
                <col style={{ width: '145px' }} />
                <col style={{ width: '68px' }} />
                <col style={{ width: '98px' }} />
                <col style={{ width: '88px' }} />
                <col style={{ width: '125px' }} />
              </colgroup>

              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>NO</th>
                  <th>INDIKATOR KINERJA</th>
                  <th>FORMULA</th>
                  <th>RUMUSAN MENCAPAI CAPAIAN</th>
                  <th style={{ textAlign: 'right', background: '#f8fafc', color: '#0f172a' }}>
                    ISIAN
                  </th>
                  <th style={{ textAlign: 'center' }}>BOBOT</th>
                  <th style={{ textAlign: 'center' }}>NILAI 100% (TARGET)</th>
                  <th style={{ textAlign: 'center' }}>SATUAN</th>
                  <th style={{ textAlign: 'right', background: '#f8fafc', color: '#0f172a' }}>
                    CAPAIAN & SKOR
                  </th>
                </tr>
              </thead>

              {sec.items.map((item) => {
                const rowCount = item.parsedSubs.length;
                const progressPct =
                  item.ratioPercent !== null ? Math.min(100, Math.max(0, item.ratioPercent)) : 0;
                const hasSplitTargets = Array.isArray(item.subrowTargets);

                return (
                  <tbody key={item.id} className="kpi-indicator-tbody">
                    {/* Baris Sub-Header Khusus Bagian C No 2: Klasterisasi Perguruan Tinggi Menuju Mandiri */}
                    {item.groupBannerTitle && (
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 800,
                            fontFamily: 'Outfit, sans-serif',
                            color: '#0f172a',
                          }}
                        >
                          2
                        </td>
                        <td
                          colSpan={8}
                          style={{
                            fontWeight: 800,
                            fontFamily: 'Outfit, sans-serif',
                            color: '#0f172a',
                            fontSize: '0.84rem',
                            letterSpacing: '-0.1px',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px',
                          }}
                        >
                          {item.groupBannerTitle}
                        </td>
                      </tr>
                    )}

                    {item.parsedSubs.map((sub, sIdx) => (
                      <tr key={sub.key}>
                        {sIdx === 0 && (
                          <>
                            {/* NO */}
                            <td
                              rowSpan={rowCount}
                              style={{
                                textAlign: 'center',
                                fontWeight: 700,
                                fontFamily: 'Outfit, sans-serif',
                                fontSize: '0.86rem',
                                color: '#475569',
                                background: '#ffffff',
                              }}
                            >
                              {item.no}
                            </td>

                            {/* INDIKATOR KINERJA */}
                            <td
                              rowSpan={rowCount}
                              style={{
                                fontWeight: 600,
                                color: '#0f172a',
                                fontSize: '0.84rem',
                                background: '#ffffff',
                              }}
                            >
                              <div>{item.indikator}</div>
                              {item.extraNote && (
                                <div
                                  style={{
                                    marginTop: '0.45rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: '#475569',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    padding: '3px 7px',
                                    borderRadius: '5px',
                                    display: 'inline-block',
                                  }}
                                >
                                  {item.extraNote}
                                </div>
                              )}
                            </td>

                            {/* FORMULA */}
                            <td
                              rowSpan={rowCount}
                              style={{
                                color: '#475569',
                                fontSize: '0.79rem',
                                background: '#ffffff',
                              }}
                            >
                              {item.formula}
                            </td>
                          </>
                        )}

                        {/* RUMUSAN MENCAPAI CAPAIAN */}
                        <td
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: sub.isDenominator ? 700 : 500,
                            color: sub.isDenominator ? '#0f172a' : '#334155',
                            background: sub.isDenominator ? '#f8fafc' : 'transparent',
                          }}
                        >
                          {sub.label}
                        </td>

                        {/* ISIAN */}
                        <td
                          className={`clean-input-cell ${sub.isDenominator ? 'is-denominator' : ''
                            } ${focusedKey === sub.key ? 'is-focused' : ''} ${sub.isInvalid ? 'is-invalid' : ''
                            }`}
                        >
                          <input
                            ref={(el) => (inputRefs.current[sub.key] = el)}
                            type="text"
                            inputMode={sub.isTextInput ? 'text' : 'decimal'}
                            className="clean-sheet-input"
                            value={sub.raw}
                            placeholder={sub.placeholder || '0'}
                            onFocus={() => setFocusedKey(sub.key)}
                            onBlur={() => setFocusedKey(null)}
                            onChange={(e) => handleCellChange(sub.key, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, sub.key)}
                            disabled={isLocked}
                          />
                        </td>

                        {/* BOBOT (Dirender pada sIdx === 0 dengan rowSpan) */}
                        {sIdx === 0 && (
                          <td
                            rowSpan={rowCount}
                            style={{
                              textAlign: 'center',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              color: '#0f172a',
                              background: '#ffffff',
                            }}
                          >
                            {item.bobotDisplay}
                          </td>
                        )}

                        {/* NILAI 100% (TARGET) — Mendukung terpecah 2 baris seperti pada Bagian D No 3 */}
                        {hasSplitTargets ? (
                          <td
                            style={{
                              textAlign: 'center',
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                              color: '#334155',
                              background: '#ffffff',
                            }}
                          >
                            {item.subrowTargets[sIdx] || ''}
                          </td>
                        ) : (
                          sIdx === 0 && (
                            <td
                              rowSpan={rowCount}
                              style={{
                                textAlign: 'center',
                                fontWeight: 600,
                                fontVariantNumeric: 'tabular-nums',
                                color: '#334155',
                                background: '#ffffff',
                              }}
                            >
                              {item.targetDisplay}
                            </td>
                          )
                        )}

                        {/* SATUAN & CAPAIAN/SKOR (Dirender pada sIdx === 0 dengan rowSpan) */}
                        {sIdx === 0 && (
                          <>
                            <td
                              rowSpan={rowCount}
                              style={{
                                textAlign: 'center',
                                fontSize: '0.76rem',
                                color: '#64748b',
                                background: '#ffffff',
                              }}
                            >
                              {item.satuan}
                            </td>

                            <td
                              rowSpan={rowCount}
                              style={{
                                textAlign: 'right',
                                background: '#fcfcfd',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              <div
                                style={{
                                  fontFamily: 'Outfit, sans-serif',
                                  fontSize: '1.05rem',
                                  fontWeight: 800,
                                  color: item.ratioPercent !== null ? '#0f172a' : '#cbd5e1',
                                }}
                              >
                                {item.ratioPercent !== null
                                  ? `${formatIndonesianNumber(item.ratioPercent, 2)}%`
                                  : '—'}
                              </div>

                              <div
                                style={{
                                  width: '100%',
                                  height: '3px',
                                  background: '#e2e8f0',
                                  borderRadius: '99px',
                                  overflow: 'hidden',
                                  margin: '0.35rem 0',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${progressPct}%`,
                                    height: '100%',
                                    background: '#475569',
                                    transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                  }}
                                />
                              </div>

                              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                                Skor:{' '}
                                <strong style={{ color: '#0f172a' }}>
                                  {item.weightedScore !== null
                                    ? formatIndonesianNumber(item.weightedScore, 2)
                                    : '—'}
                                </strong>{' '}
                                / {item.bobotDisplay}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </table>
          </div>
        </div>
      ))}

      {/* ─── 3. FOOTER REKAPITULASI LENGKAP (A + B + C + D) ─── */}
      <div
        style={{
          padding: '1rem 1.5rem',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.78rem',
          color: '#64748b',
        }}
      >
        <div>
          Navigasi cepat antar sel menggunakan tombol <code>Enter</code> atau panah <code>↑</code> <code>↓</code>.
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            flexWrap: 'wrap',
            fontWeight: 700,
            color: '#0f172a',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '0.84rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>A: {formatIndonesianNumber(calculated.sections[0].secScore, 2)} / 25</span>
          <span style={{ color: '#e2e8f0' }}>|</span>
          <span>B: {formatIndonesianNumber(calculated.sections[1].secScore, 2)} / 26</span>
          <span style={{ color: '#e2e8f0' }}>|</span>
          <span>C: {formatIndonesianNumber(calculated.sections[2].secScore, 2)} / 49</span>
          <span style={{ color: '#e2e8f0' }}>|</span>
          <span>D (Kepatuhan): {formatIndonesianNumber(calculated.sections[3].secScore, 2)} / -12,5</span>
          <span style={{ color: '#e2e8f0' }}>|</span>
          <span
            style={{
              padding: '0.3rem 0.8rem',
              borderRadius: '99px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
            }}
          >
            Skor Akhir KPI Bersih: {formatIndonesianNumber(calculated.netTotalScore, 2)} / 100 Poin
          </span>
        </div>
      </div>
    </div>
  );
}