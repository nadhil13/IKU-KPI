import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RotateCcw, FileSpreadsheet, Printer, SlidersHorizontal, Send, LockKeyhole,
  CheckCircle2, AlertTriangle, Clock3, History, RefreshCcw, ShieldCheck,
  Upload, Link2, Eye, Trash2, X, ExternalLink, FileText, Image as ImageIcon, Download
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../auth/context/AuthContext';
import {
  getUnitKpiForm,
  readUnitSubmission,
  readUnitDraft,
  saveUnitKpiDraft,
  clearUnitKpiDraft,
  subscribeKpiWorkflow,
  submitUnitKpi,
  readUnitEvidence,
  addUnitEvidence,
  removeUnitEvidence,
  ensureDefaultKpiDistribution,
  readIntegratedKpiBoard,
  readKpiWorkflow,
  MAX_EVIDENCE_FILE_BYTES,
  ALLOWED_EVIDENCE_MIME_TYPES,
} from '../kpiWorkflowStore';
import { describeKpiFormula } from '../formulaEngine';

import {
  parseIndonesianNumber, parseFlexibleDate, formatIndonesianNumber,
  computeKpiItem, subscribeKpiConfig, readPublishedKpiConfig, normalizeKpiSections, buildKpiCellDirectory,
  canUserEditKpiItem, getUserPicCodes, formatPicDisplay, normalizePicCodes, readKpiValidationRules, createId,
} from '../kpiSchema';

gsap.registerPlugin(ScrollTrigger);

export { parseIndonesianNumber, parseFlexibleDate, formatIndonesianNumber };

// Struktur master KPI ITPLN: Bagian A bobot 25, B 26, C 49, D -12,5 beserta PIC per baris.
export const KPI_SECTIONS_CONFIG = [
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
        pics: ['PPA'],
        picDisplay: 'PPA',
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
        pics: ['BAKT', 'BAG'],
        picDisplay: 'BAKT, BAG',
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
        pics: ['BAKT', 'BAG'],
        picDisplay: 'BAKT, BAG',
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
        pics: ['BAKT', 'BAG'],
        picDisplay: 'BAKT, BAG',
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
        pics: ['BAKT', 'BAG'],
        picDisplay: 'BAKT, BAG',
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
        pics: ['BKU'],
        picDisplay: 'BKU',
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
        pics: ['PJM', 'PRP'],
        picDisplay: 'PJM dan PRP',
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
        pics: ['BPKA'],
        picDisplay: 'BPKA',
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
        pics: ['BPKA'],
        picDisplay: 'BPKA',
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
        pics: ['BKK'],
        picDisplay: 'BKK',
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
        pics: ['PJM', 'PRP'],
        picDisplay: 'PJM dan PRP',
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
        pics: ['PJM', 'PRP'],
        picDisplay: 'PJM dan PRP',
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
        pics: ['BKAI'],
        picDisplay: 'BKAI',
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
        pics: ['BPIK', 'BKM', 'BSAR', 'BPAD'],
        picDisplay: 'BPIK, BKM, BSAR, BPAD',
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
        pics: ['FAK', 'PJM'],
        picDisplay: 'FAK DAN PJM',
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
        pics: ['LPPM', 'FAK'],
        picDisplay: 'LPPM, FAK',
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
        pics: ['LPPM', 'FAK'],
        picDisplay: 'LPPM, FAK',
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
        pics: ['LPPM'],
        picDisplay: 'LPPM',
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
        pics: ['LPPM', 'FAK'],
        picDisplay: 'LPPM, FAK',
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
        pics: ['LPPM', 'FAK'],
        picDisplay: 'LPPM, FAK',
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
        pics: ['LPPM', 'FAK'],
        picDisplay: 'LPPM, FAK',
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
        pics: ['FAK', 'PJM'],
        picDisplay: 'FAK, PJM',
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
        pics: ['SDM'],
        picDisplay: 'SDM',
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
        pics: ['BKAN'],
        picDisplay: 'BKAN',
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
        pics: ['BAG'],
        picDisplay: 'BAG',
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
        pics: ['BAKT'],
        picDisplay: 'BAKT',
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
        pics: ['PRP'],
        picDisplay: 'PRP',
        bobot: -2.5,
        bobotDisplay: '-2,5',
        targetDisplay: 'Juli 2026, / Januari 2027',
        subrowTargets: ['Juli 2026,', 'Januari 2027'],
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
        pics: ['BPTI', 'BSDM'],
        picDisplay: 'BPTI, BSDM',
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
        pics: ['SPI', 'PJM', 'Akuntansi', 'WBS'],
        picDisplay: 'SPI, PJM, Akuntansi, WBS',
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

const DEFAULT_PIC_BY_ITEM_ID = new Map(
  KPI_SECTIONS_CONFIG.flatMap((sec) =>
    sec.items.map((item) => [item.id, { pics: item.pics || [], picDisplay: item.picDisplay || '' }]),
  ),
);

function hydrateSectionsWithDefaultPics(sections) {
  return (sections || []).map((sec) => ({
    ...sec,
    items: (sec.items || []).map((item) => {
      const existing = normalizePicCodes(item.pics ?? item.picDisplay ?? []);
      if (existing.length > 0 || item.picClearedByAdmin) {
        return {
          ...item,
          pics: existing,
          picDisplay: formatPicDisplay(existing, item.picDisplay),
        };
      }
      const fallback = DEFAULT_PIC_BY_ITEM_ID.get(item.id);
      if (!fallback) return item;
      const fallbackCodes = normalizePicCodes(fallback.pics);
      return {
        ...item,
        pics: fallbackCodes,
        picDisplay: formatPicDisplay(fallbackCodes, fallback.picDisplay),
      };
    }),
  }));
}

const getGovernedKpiSections = () => {
  const saved = readPublishedKpiConfig();
  const base = Array.isArray(saved?.sections) && saved.sections.length ? saved.sections : KPI_SECTIONS_CONFIG;
  return normalizeKpiSections(hydrateSectionsWithDefaultPics(base));
};

const STORAGE_KEY = 'performa_kpi_bagian_abcd_v5';
const NOTES_STORAGE_KEY = 'performa_kpi_notes_v1';
const LOCAL_EVIDENCE_STORAGE_KEY = 'performa_kpi_local_evidence_v1';
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
  [WORKFLOW_STATUS.SUBMITTED]: 'Sudah Dikirim ke Pusat',
  [WORKFLOW_STATUS.NEEDS_REVISION]: 'Perlu Revisi',
  [WORKFLOW_STATUS.APPROVED]: 'Disetujui PRP',
  [WORKFLOW_STATUS.OVERDUE]: 'Terlambat',
};

const EVIDENCE_STATUS_META = {
  VERIFIED: { label: 'Terverifikasi', bg: '#F0FDF4', border: '#86EFAC', color: '#14532D' },
  REJECTED: { label: 'Ditolak', bg: '#FEF2F2', border: '#FCA5A5', color: '#7F1D1D' },
  PENDING: { label: 'Menunggu Verifikasi', bg: '#FFFBEB', border: '#FCD34D', color: '#78350F' },
};

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function KPIDataEntrySheet(props) {
  const { currentUser } = useAuth();
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeKpiWorkflow(() => setRevision((value) => value + 1)), []);

  const shouldEnsureDefault = props.persist !== false
    && !props.sectionsOverride
    && Boolean(currentUser)
    && (currentUser.role === 'kpi_only' || currentUser.role === 'superadmin_prp');

  useEffect(() => {
    if (!shouldEnsureDefault) return;
    ensureDefaultKpiDistribution(KPI_SECTIONS_CONFIG);
  }, [shouldEnsureDefault]);

  const workflowState = useMemo(() => {
    void revision;
    if (shouldEnsureDefault) {
      const current = readKpiWorkflow();
      if (!current.forms.length) {
        ensureDefaultKpiDistribution(KPI_SECTIONS_CONFIG, '2026', { silent: true });
      }
    }
    return readKpiWorkflow();
  }, [revision, shouldEnsureDefault]);

  const isUnit = currentUser?.role === 'kpi_only' && !props.sectionsOverride;
  const activeForm = isUnit
    ? getUnitKpiForm(currentUser?.email, workflowState)
    : workflowState.forms[workflowState.forms.length - 1] || null;

  const resolvedSectionsOverride = useMemo(
    () => (isUnit && activeForm?.sections ? hydrateSectionsWithDefaultPics(activeForm.sections) : props.sectionsOverride),
    [isUnit, activeForm, props.sectionsOverride],
  );

  if (isUnit && !activeForm) {
    return (
      <div className="gov-placeholder">
        Belum ada formulir KPI aktif untuk akun unit ini. Hubungi Admin PRP untuk mendistribusikan formulir periode berjalan.
      </div>
    );
  }

  const record = isUnit && activeForm ? readUnitSubmission(activeForm.id, currentUser.email, workflowState) : null;
  const unitDraft = isUnit && activeForm ? readUnitDraft(activeForm.id, currentUser.email, workflowState) : null;
  const integratedBoard = activeForm && props.persist !== false
    ? readIntegratedKpiBoard(activeForm.id, workflowState)
    : null;

  return (
    <KPIEntryContent
      key={isUnit ? `${activeForm.id}:${currentUser.email}:${record?.status || 'DRAFT'}` : `sheet:${Boolean(props.sectionsOverride)}`}
      {...props}
      sectionsOverride={resolvedSectionsOverride}
      unitForm={isUnit ? activeForm : null}
      unitUser={currentUser}
      submission={record}
      unitDraft={unitDraft}
      integratedBoard={integratedBoard}
      workflowRevision={revision}
    />
  );
}

export function EvidencePreviewModal({ evidence, onClose }) {
  useEffect(() => {
    if (!evidence) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape' || event.keyCode === 27) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [evidence, onClose]);

  if (!evidence) return null;
  const isPdf = evidence.mimeType === 'application/pdf' || /^data:application\/pdf/i.test(evidence.dataUrl || '');
  const isImage = /^image\//i.test(evidence.mimeType || '') || /^data:image\//i.test(evidence.dataUrl || '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau bukti ${evidence.label}`}
      data-lenis-prevent
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(6, 44, 61, 0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(0.75rem, 3vw, 2rem)',
      }}
    >
      <div
        style={{
          width: 'min(960px, 100%)',
          maxHeight: '90dvh',
          background: '#FFFFFF',
          border: '1px solid #B8CAD4',
          borderRadius: '8px',
          boxShadow: '0 24px 48px rgba(7, 37, 52, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '0.95rem 1.25rem',
            background: '#F7FAFB',
            borderBottom: '1px solid #D8E4EA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#094E68', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pratinjau Dokumen Bukti Capaian · {evidence.indicatorId}
            </div>
            <h4 style={{ margin: '0.15rem 0 0', fontSize: '0.96rem', fontFamily: 'Outfit, sans-serif', color: '#072534' }}>
              {evidence.label}
            </h4>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.1rem' }}>
              {evidence.fileName ? `${evidence.fileName} (${formatFileSize(evidence.fileSize)})` : evidence.url}
              {evidence.ownerUnit ? ` · Diunggah oleh ${evidence.ownerUnit}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {evidence.kind === 'file' && evidence.dataUrl && (
              <a
                href={evidence.dataUrl}
                download={evidence.fileName || `${evidence.label}.pdf`}
                className="clean-btn clean-btn-primary"
                style={{ textDecoration: 'none' }}
              >
                <Download size={14} />
                <span>Unduh Berkas</span>
              </a>
            )}
            {evidence.kind !== 'file' && evidence.url && (
              <a
                href={evidence.url}
                target="_blank"
                rel="noopener noreferrer"
                className="clean-btn clean-btn-primary"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink size={14} />
                <span>Buka Tautan</span>
              </a>
            )}
            <button type="button" className="clean-btn" onClick={onClose}>
              <X size={14} />
              <span>Tutup</span>
            </button>
          </div>
        </div>

        <div style={{ padding: '1rem', overflowY: 'auto', background: '#EDF3F6', flex: 1, minHeight: '320px', display: 'grid', placeItems: 'center' }}>
          {isImage && evidence.dataUrl ? (
            <img
              src={evidence.dataUrl}
              alt={evidence.label}
              style={{ maxWidth: '100%', maxHeight: '70dvh', borderRadius: '6px', border: '1px solid #D8E4EA', background: '#FFFFFF' }}
            />
          ) : isPdf && evidence.dataUrl ? (
            <iframe
              title={`Dokumen PDF ${evidence.label}`}
              src={evidence.dataUrl}
              style={{ width: '100%', height: '68dvh', border: '1px solid #D8E4EA', borderRadius: '6px', background: '#FFFFFF' }}
            />
          ) : (
            <div style={{ padding: '1.5rem', background: '#FFFFFF', border: '1px solid #D8E4EA', borderRadius: '8px', textAlign: 'center', maxWidth: '460px' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#334155' }}>
                Bukti ini berupa tautan penyimpanan eksternal dan dibuka pada tab baru peramban.
              </p>
              {evidence.url && (
                <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="clean-btn clean-btn-primary" style={{ textDecoration: 'none' }}>
                  <ExternalLink size={14} />
                  <span>Buka {evidence.label}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RowEvidenceAndNotesCell({
  sectionCode,
  item,
  canEditRow,
  isLocked,
  ownEvidence,
  sharedEvidence,
  noteValue,
  sharedNoteValue,
  contributor,
  onNoteChange,
  onAddEvidence,
  onRemoveEvidence,
  onPreviewEvidence,
}) {
  const [composerMode, setComposerMode] = useState(null);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [rowError, setRowError] = useState('');
  const fileInputRef = useRef(null);

  const visibleEvidence = useMemo(() => {
    const byId = new Map();
    (ownEvidence || []).forEach((ev) => byId.set(ev.id, { ...ev, isOwn: true }));
    (sharedEvidence || []).forEach((ev) => {
      if (!byId.has(ev.id)) byId.set(ev.id, { ...ev, isOwn: false });
    });
    return [...byId.values()];
  }, [ownEvidence, sharedEvidence]);

  const handleFilePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRowError('');
    const mime = String(file.type || '').toLowerCase();
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(mime)) {
      setRowError('Format wajib PDF, PNG, JPG, atau WEBP.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_EVIDENCE_FILE_BYTES) {
      setRowError('Ukuran berkas melebihi 2,5 MB. Gunakan opsi Tautan Drive.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        fileName: file.name,
        mimeType: mime,
        fileSize: file.size,
        dataUrl: String(reader.result || ''),
      });
      if (!label.trim()) {
        setLabel(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.onerror = () => setRowError('Gagal membaca berkas dari perangkat.');
    reader.readAsDataURL(file);
  };

  const handleSaveEvidence = () => {
    setRowError('');
    try {
      if (composerMode === 'file') {
        if (!selectedFile) {
          setRowError('Pilih dokumen PDF atau gambar terlebih dahulu.');
          return;
        }
        onAddEvidence({
          indicatorId: item.id,
          kind: 'file',
          label: label.trim() || selectedFile.fileName,
          ...selectedFile,
        });
      } else {
        onAddEvidence({
          indicatorId: item.id,
          kind: 'link',
          label: label.trim() || `Bukti ${sectionCode}.${item.no}`,
          url: url.trim(),
        });
      }
      setLabel('');
      setUrl('');
      setSelectedFile(null);
      setComposerMode(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setRowError(err.message || 'Gagal menyimpan bukti capaian.');
    }
  };

  const displayNote = canEditRow ? noteValue : (sharedNoteValue || noteValue || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {visibleEvidence.length > 0 ? (
          visibleEvidence.map((ev) => {
            const statusMeta = EVIDENCE_STATUS_META[ev.status] || EVIDENCE_STATUS_META.PENDING;
            const isFile = ev.kind === 'file' || Boolean(ev.dataUrl);
            const isImg = /^image\//i.test(ev.mimeType || '');
            return (
              <div
                key={ev.id}
                style={{
                  padding: '0.45rem 0.55rem',
                  borderRadius: '6px',
                  background: '#F7FAFB',
                  border: '1px solid #D8E4EA',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.28rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, flex: 1 }}>
                    {isFile ? (
                      isImg ? <ImageIcon size={13} color="#094E68" style={{ flexShrink: 0 }} /> : <FileText size={13} color="#094E68" style={{ flexShrink: 0 }} />
                    ) : (
                      <Link2 size={13} color="#094E68" style={{ flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#072534', wordBreak: 'break-word' }}>
                      {ev.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: statusMeta.bg,
                      border: `1px solid ${statusMeta.border}`,
                      color: statusMeta.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                {ev.fileName && (
                  <div style={{ fontSize: '0.66rem', color: '#475569' }}>
                    {ev.fileName} ({formatFileSize(ev.fileSize)})
                  </div>
                )}
                {!ev.isOwn && (ev.unitName || ev.ownerUnit) && (
                  <div style={{ fontSize: '0.65rem', color: '#094E68', fontWeight: 600 }}>
                    Dilampirkan oleh {ev.unitName || ev.ownerUnit}
                  </div>
                )}
                {ev.note && (
                  <div style={{ fontSize: '0.67rem', color: statusMeta.color, fontWeight: 600 }}>
                    Catatan PRP: {ev.note}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
                  {isFile ? (
                    <button
                      type="button"
                      className="clean-mini-btn"
                      onClick={() => onPreviewEvidence(ev)}
                    >
                      <Eye size={12} />
                      <span>Pratinjau</span>
                    </button>
                  ) : (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="clean-mini-btn"
                      style={{ textDecoration: 'none' }}
                    >
                      <ExternalLink size={12} />
                      <span>Buka Tautan</span>
                    </a>
                  )}
                  {canEditRow && !isLocked && ev.isOwn && (
                    <button
                      type="button"
                      className="clean-mini-btn clean-mini-btn-danger"
                      aria-label={`Hapus bukti ${ev.label}`}
                      onClick={() => {
                        try {
                          setRowError('');
                          onRemoveEvidence(ev.id);
                        } catch (err) {
                          setRowError(err.message);
                        }
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div
            style={{
              fontSize: '0.7rem',
              color: canEditRow && !isLocked ? '#78350F' : '#475569',
              background: canEditRow && !isLocked ? '#FFFBEB' : '#F7FAFB',
              border: `1px solid ${canEditRow && !isLocked ? '#FCD34D' : '#D8E4EA'}`,
              borderRadius: '6px',
              padding: '0.38rem 0.55rem',
            }}
          >
            {canEditRow && !isLocked
              ? 'Wajib lampirkan bukti dokumen (PDF/Gambar) atau tautan Drive.'
              : 'Belum ada bukti capaian yang diunggah PIC.'}
          </div>
        )}
      </div>

      {canEditRow && !isLocked && (
        <>
          {!composerMode ? (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="clean-mini-btn"
                onClick={() => {
                  setRowError('');
                  setComposerMode('file');
                }}
              >
                <Upload size={12} />
                <span>Unggah PDF/Gambar</span>
              </button>
              <button
                type="button"
                className="clean-mini-btn"
                onClick={() => {
                  setRowError('');
                  setComposerMode('link');
                }}
              >
                <Link2 size={12} />
                <span>Tautkan Link Drive</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: '0.55rem',
                borderRadius: '6px',
                background: '#F7FAFB',
                border: '1px solid #B8CAD4',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                <strong style={{ fontSize: '0.69rem', color: '#072534' }}>
                  {composerMode === 'file' ? 'Unggah Dokumen (PDF/PNG/JPG maks. 2,5 MB)' : 'Tautkan Penyimpanan HTTPS / Google Drive'}
                </strong>
                <button
                  type="button"
                  className="clean-mini-btn"
                  onClick={() => {
                    setComposerMode(null);
                    setRowError('');
                    setSelectedFile(null);
                  }}
                >
                  Batal
                </button>
              </div>

              <input
                type="text"
                className="clean-row-text-input"
                aria-label={`Nama bukti ${sectionCode}.${item.no}`}
                placeholder="Judul bukti (misal: SK Rektor / Rekap RKA)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />

              {composerMode === 'file' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    aria-label={`Pilih berkas bukti ${sectionCode}.${item.no}`}
                    onChange={handleFilePick}
                    style={{ fontSize: '0.7rem', width: '100%', color: '#334155' }}
                  />
                  {selectedFile && (
                    <div style={{ fontSize: '0.67rem', color: '#14532D', fontWeight: 600, marginTop: '0.2rem' }}>
                      Siap disimpan: {selectedFile.fileName} ({formatFileSize(selectedFile.fileSize)})
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="url"
                  className="clean-row-text-input"
                  aria-label={`Tautan bukti HTTPS ${sectionCode}.${item.no}`}
                  placeholder="https://drive.google.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              )}

              <button type="button" className="clean-btn clean-btn-primary" style={{ minHeight: '34px', padding: '0.35rem 0.65rem', fontSize: '0.72rem' }} onClick={handleSaveEvidence}>
                Simpan Bukti Baris {sectionCode}.{item.no}
              </button>
            </div>
          )}
        </>
      )}

      {rowError && (
        <div role="alert" style={{ fontSize: '0.68rem', fontWeight: 600, color: '#7F1D1D', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '5px', padding: '0.35rem 0.5rem' }}>
          {rowError}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '0.66rem', fontWeight: 700, color: '#475569', marginBottom: '0.22rem' }}>
          Keterangan Capaian
          {canEditRow && !isLocked ? (
            <textarea
              rows={2}
              className="clean-row-textarea"
              placeholder={`Catatan realisasi ${sectionCode}.${item.no}...`}
              value={noteValue || ''}
              onChange={(e) => onNoteChange(item.id, e.target.value)}
              style={{ marginTop: '0.22rem' }}
            />
          ) : (
            <div
              style={{
                marginTop: '0.22rem',
                padding: '0.38rem 0.5rem',
                borderRadius: '5px',
                background: '#F7FAFB',
                border: '1px solid #D8E4EA',
                color: displayNote ? '#334155' : '#475569',
                fontWeight: 500,
                fontSize: '0.71rem',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
              }}
            >
              {displayNote || 'Belum ada keterangan tambahan.'}
            </div>
          )}
        </label>
        {!canEditRow && contributor && (
          <div style={{ fontSize: '0.65rem', color: '#094E68', fontWeight: 600, marginTop: '0.2rem' }}>
            Sumber data: {contributor.unit} ({contributor.status === 'APPROVED' ? 'Disetujui PRP' : contributor.status === 'SUBMITTED' ? 'Sudah Submit' : 'Draft PIC'})
          </div>
        )}
      </div>
    </div>
  );
}

function KPIEntryContent({
  onMetricsUpdate,
  readOnly = false,
  sectionsOverride = null,
  persist = true,
  unitForm = null,
  unitUser = null,
  submission = null,
  unitDraft = null,
  integratedBoard = null,
  workflowRevision = 0,
  valuesOverride = null,
  notesOverride = null,
  evidenceOverride = null,
  contributorMapOverride = null,
  highlightPicCodes = null,
}) {
  const isUnitMode = Boolean(unitForm && unitUser?.role === 'kpi_only');
  const valuesKey = unitForm ? `${STORAGE_KEY}:${unitForm.id}:${unitUser.email}` : STORAGE_KEY;
  const notesKey = unitForm ? `${NOTES_STORAGE_KEY}:${unitForm.id}:${unitUser.email}` : NOTES_STORAGE_KEY;
  const localEvidenceKey = `${LOCAL_EVIDENCE_STORAGE_KEY}:global`;
  const workflowKey = unitForm ? `${WORKFLOW_KEY}:${unitForm.id}:${unitUser.email}` : WORKFLOW_KEY;
  const containerRef = useRef(null);
  const inputRefs = useRef({});
  const fillProgressRef = useRef(null);
  const scrollReadBarRef = useRef(null);
  const tabPillRef = useRef(null);
  const [governanceRevision, setGovernanceRevision] = useState(0);
  const [previewEvidence, setPreviewEvidence] = useState(null);
  const [rowScopeFilter, setRowScopeFilter] = useState('ALL');
  const isPreview = Boolean(sectionsOverride) && !isUnitMode;

  const governedSections = useMemo(
    () => (sectionsOverride ? normalizeKpiSections(hydrateSectionsWithDefaultPics(sectionsOverride)) : getGovernedKpiSections()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [governanceRevision, sectionsOverride]
  );

  const orderedKeys = useMemo(
    () => governedSections.flatMap((sec) => sec.items.flatMap((item) => item.subrows.map((sub) => sub.key))),
    [governedSections]
  );

  const userPicCodes = useMemo(() => getUserPicCodes(unitUser), [unitUser]);
  const highlightedPicsSet = useMemo(
    () => new Set(normalizePicCodes(highlightPicCodes || []).map((c) => c.toLowerCase())),
    [highlightPicCodes],
  );

  const editableItemIds = useMemo(() => {
    const ids = new Set();
    governedSections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (!isUnitMode || canUserEditKpiItem(item, unitUser)) {
          ids.add(item.id);
        }
      });
    });
    return ids;
  }, [governedSections, isUnitMode, unitUser]);

  const editableSubKeys = useMemo(() => {
    const keys = new Set();
    governedSections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (editableItemIds.has(item.id)) {
          item.subrows.forEach((sub) => keys.add(sub.key));
        }
      });
    });
    return keys;
  }, [governedSections, editableItemIds]);

  const [structureToast, setStructureToast] = useState(null);
  const showToast = (msg) => {
    setStructureToast(msg);
  };
  useEffect(() => {
    if (!structureToast) return undefined;
    const t = setTimeout(() => setStructureToast(null), 4600);
    return () => clearTimeout(t);
  }, [structureToast]);

  useEffect(() => {
    if (isPreview) return undefined;
    const unsubscribe = subscribeKpiConfig(() => {
      setGovernanceRevision((revision) => revision + 1);
      const config = readPublishedKpiConfig();
      showToast(config?.version ? `Struktur tabel diperbarui oleh PRP (v${config.version})` : 'Struktur tabel diperbarui oleh PRP');
    });
    return () => unsubscribe();
  }, [isPreview]);

  const [activeSectionTab, setActiveSectionTab] = useState('ALL');
  const [focusedKey, setFocusedKey] = useState(null);
  const [lastSaved, setLastSaved] = useState('Siap');
  const [workflow, setWorkflow] = useState(() => {
    if (submission) return { ...submission, history: submission.history || [] };
    if (unitDraft) return { status: WORKFLOW_STATUS.DRAFT, submittedAt: null, submittedBy: unitUser?.name || 'PIC Unit', revisionNote: '', history: [] };
    if (!persist) return { status: WORKFLOW_STATUS.NOT_STARTED, submittedAt: null, submittedBy: 'Preview PRP', revisionNote: '', history: [] };
    try {
      return JSON.parse(localStorage.getItem(workflowKey)) || {
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

  useEffect(() => {
    if (submission) {
      setWorkflow({ ...submission, history: submission.history || [] });
    }
  }, [submission]);

  const emptyDefaults = useMemo(() => {
    const map = {};
    orderedKeys.forEach((k) => {
      map[k] = '';
    });
    return map;
  }, [orderedKeys]);

  const [values, setValues] = useState(() => {
    if (valuesOverride) return { ...emptyDefaults, ...valuesOverride };
    if (submission && submission.status !== WORKFLOW_STATUS.NEEDS_REVISION) return { ...emptyDefaults, ...submission.values };
    if (unitDraft?.values && Object.keys(unitDraft.values).length > 0) {
      return { ...emptyDefaults, ...(submission?.values || {}), ...unitDraft.values };
    }
    if (!persist) return emptyDefaults;
    try {
      const saved = localStorage.getItem(valuesKey);
      if (saved) return { ...emptyDefaults, ...JSON.parse(saved) };
    } catch {
      // Abaikan kegagalan baca penyimpanan lokal
    }
    if (!isUnitMode && integratedBoard?.values && Object.keys(integratedBoard.values).length > 0) {
      return { ...emptyDefaults, ...integratedBoard.values };
    }
    return submission ? { ...emptyDefaults, ...submission.values } : emptyDefaults;
  });

  const [notes, setNotes] = useState(() => {
    if (notesOverride) return { ...notesOverride };
    if (submission && submission.status !== WORKFLOW_STATUS.NEEDS_REVISION) return { ...(submission.notes || {}) };
    if (unitDraft?.notes && Object.keys(unitDraft.notes).length > 0) {
      return { ...(submission?.notes || {}), ...unitDraft.notes };
    }
    if (!persist) return {};
    try {
      const saved = localStorage.getItem(notesKey);
      if (saved) return JSON.parse(saved) || {};
    } catch {
      // Abaikan kegagalan baca penyimpanan lokal
    }
    if (!isUnitMode && integratedBoard?.notes) {
      return { ...integratedBoard.notes };
    }
    return submission?.notes ? { ...submission.notes } : {};
  });

  const [localEvidenceList, setLocalEvidenceList] = useState(() => {
    if (Array.isArray(evidenceOverride)) return evidenceOverride;
    if (!persist || isUnitMode) return [];
    try {
      return JSON.parse(localStorage.getItem(localEvidenceKey) || '[]') || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setValues((previous) => ({ ...emptyDefaults, ...previous }));
  }, [emptyDefaults]);

  useEffect(() => {
    if (!persist) return;
    try {
      localStorage.setItem(valuesKey, JSON.stringify(values));
      localStorage.setItem(notesKey, JSON.stringify(notes));
      if (!isUnitMode && !evidenceOverride) {
        localStorage.setItem(localEvidenceKey, JSON.stringify(localEvidenceList));
      }
      setLastSaved(
        new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    } catch {
      // Abaikan batas kuota penyimpanan lokal
    }
  }, [values, notes, localEvidenceList, persist, valuesKey, notesKey, localEvidenceKey, isUnitMode, evidenceOverride]);

  const isLockedForDraft = readOnly || ['SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED'].includes(workflow.status);
  useEffect(() => {
    if (!persist || !isUnitMode || isLockedForDraft) return undefined;
    const hasAnyInput = Object.entries(values).some(([k, v]) => editableSubKeys.has(k) && String(v ?? '').trim() !== '')
      || Object.entries(notes).some(([id, v]) => editableItemIds.has(id) && String(v ?? '').trim() !== '');
    if (!hasAnyInput) return undefined;
    const timer = setTimeout(() => {
      try {
        saveUnitKpiDraft(unitForm.id, unitUser, { values, notes });
      } catch {
        // Draft tidak disimpan apabila periode ditutup
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [values, notes, persist, isUnitMode, isLockedForDraft, unitForm, unitUser, editableSubKeys, editableItemIds]);

  useEffect(() => {
    if (!persist) return;
    try {
      localStorage.setItem(workflowKey, JSON.stringify(workflow));
    } catch {
      // Abaikan kegagalan tulis status lokal
    }
  }, [workflow, persist, workflowKey]);

  const ownEvidenceList = useMemo(() => {
    void workflowRevision;
    if (Array.isArray(evidenceOverride)) return evidenceOverride;
    if (isUnitMode && unitForm && unitUser?.email) {
      return readUnitEvidence(unitForm.id, unitUser.email);
    }
    return localEvidenceList;
  }, [evidenceOverride, isUnitMode, unitForm, unitUser, localEvidenceList, workflowRevision]);

  const ownEvidenceByItem = useMemo(() => {
    const map = {};
    ownEvidenceList.forEach((ev) => {
      if (!map[ev.indicatorId]) map[ev.indicatorId] = [];
      map[ev.indicatorId].push(ev);
    });
    return map;
  }, [ownEvidenceList]);

  const effectiveValues = useMemo(() => {
    if (valuesOverride) return { ...emptyDefaults, ...(integratedBoard?.values || {}), ...valuesOverride };
    if (!isUnitMode) {
      if (integratedBoard?.values) {
        const merged = { ...emptyDefaults, ...integratedBoard.values };
        Object.entries(values).forEach(([k, v]) => {
          if (String(v ?? '').trim() !== '') merged[k] = v;
        });
        return merged;
      }
      return values;
    }
    const merged = { ...emptyDefaults };
    governedSections.forEach((sec) => {
      sec.items.forEach((item) => {
        const editable = editableItemIds.has(item.id);
        item.subrows.forEach((sub) => {
          if (editable) {
            merged[sub.key] = values[sub.key] ?? '';
          } else {
            merged[sub.key] = integratedBoard?.values?.[sub.key] ?? '';
          }
        });
      });
    });
    return merged;
  }, [valuesOverride, emptyDefaults, integratedBoard, isUnitMode, values, governedSections, editableItemIds]);

  const calculated = useMemo(() => {
    let totalFilledInputs = 0;
    let totalInvalidInputs = 0;
    let totalCompletedIndicators = 0;
    let totalIndicatorsCount = 0;
    let positiveScoreABC = 0;
    let penaltyScoreD = 0;

    let picFilledInputs = 0;
    let picInvalidInputs = 0;
    let picTotalInputs = 0;
    let picCompletedIndicators = 0;
    let picTotalIndicators = 0;
    let picScoreTotal = 0;
    const missingEvidenceIndicators = [];
    const incompleteFormulaIndicators = [];

    const valRules = readKpiValidationRules();
    const requireEvidence = valRules.requireEvidenceOnSubmit !== false;

    const sections = governedSections.map((sec) => {
      let secScore = 0;
      let secCompleted = 0;

      const computedItems = sec.items.map((item) => {
        totalIndicatorsCount += 1;
        const canEditRow = editableItemIds.has(item.id);
        const result = computeKpiItem(item, effectiveValues, sec.isPenaltySection, governedSections);
        result.parsedSubs.forEach((sub) => {
          if (sub.isFilled) totalFilledInputs += 1;
          if (sub.isInvalid) totalInvalidInputs += 1;
          if (canEditRow) {
            picTotalInputs += 1;
            if (sub.isFilled) picFilledInputs += 1;
            if (sub.isInvalid) picInvalidInputs += 1;
          }
        });
        if (result.ratioPercent !== null && result.weightedScore !== null) {
          secCompleted += 1;
          totalCompletedIndicators += 1;
          secScore += result.weightedScore;
        }
        if (canEditRow) {
          picTotalIndicators += 1;
          if (result.ratioPercent !== null && result.weightedScore !== null) {
            picCompletedIndicators += 1;
            picScoreTotal += result.weightedScore;
          } else if (result.parsedSubs.every((s) => s.isFilled && !s.isInvalid)) {
            incompleteFormulaIndicators.push(`${sec.code}.${item.no}`);
          }
          const hasRowEvidence = (ownEvidenceByItem[item.id] || []).length > 0;
          if (requireEvidence && normalizePicCodes(item.pics).length > 0 && !hasRowEvidence) {
            missingEvidenceIndicators.push(`${sec.code}.${item.no}`);
          }
        }
        return { ...item, ...result, canEditRow };
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

    const netTotalScore = Math.min(100, Math.max(0, positiveScoreABC + penaltyScoreD));
    const activeTotalInputs = isUnitMode ? picTotalInputs : orderedKeys.length;
    const activeFilledInputs = isUnitMode ? picFilledInputs : totalFilledInputs;
    const completionRatio = activeTotalInputs > 0 ? activeFilledInputs / activeTotalInputs : 0;

    return {
      sections,
      totalFilledInputs,
      totalInvalidInputs,
      totalInputsCount: orderedKeys.length,
      totalCompletedIndicators,
      totalIndicatorsCount,
      positiveScoreABC,
      penaltyScoreD,
      netTotalScore,
      completionRatio,
      picFilledInputs,
      picInvalidInputs,
      picTotalInputs,
      picCompletedIndicators,
      picTotalIndicators,
      picNetScore: Math.min(100, Math.max(0, picScoreTotal)),
      missingEvidenceIndicators,
      incompleteFormulaIndicators,
    };
  }, [effectiveValues, governedSections, orderedKeys, editableItemIds, ownEvidenceByItem, isUnitMode]);

  const lastMetricsJsonRef = useRef('');
  useEffect(() => {
    if (onMetricsUpdate) {
      const secA = calculated.sections[0];
      const secB = calculated.sections[1];
      const secC = calculated.sections[2];
      const secD = calculated.sections[3];
      const payload = {
        totalBobot: 100,
        totalScore: calculated.netTotalScore,
        positiveScoreABC: calculated.positiveScoreABC,
        penaltyScoreD: calculated.penaltyScoreD,
        filledCount: calculated.totalCompletedIndicators,
        totalCount: calculated.totalIndicatorsCount,
        filledInputsCount: calculated.totalFilledInputs,
        totalInputsCount: calculated.totalInputsCount,
        picTotalIndicators: calculated.picTotalIndicators,
        picCompletedIndicators: calculated.picCompletedIndicators,
        picNetScore: calculated.picNetScore,
        scoreA: secA?.secScore || 0,
        scoreB: secB?.secScore || 0,
        scoreC: secC?.secScore || 0,
        scoreD: secD?.secScore || 0,
        sectionScores: calculated.sections.map((sec) => ({
          code: sec.code,
          title: sec.title,
          weight: Number(sec.totalWeight) || 0,
          weightDisplay: sec.weightDisplay,
          score: sec.secScore,
          isPenaltySection: Boolean(sec.isPenaltySection),
          completed: sec.secCompleted,
          total: sec.secTotalItems,
        })),
      };
      const serialized = JSON.stringify(payload);
      if (serialized !== lastMetricsJsonRef.current) {
        lastMetricsJsonRef.current = serialized;
        onMetricsUpdate(payload);
      }
    }
  }, [calculated, onMetricsUpdate]);

  const sectionsStructureKey = useMemo(
    () => governedSections.map((sec) => `${sec.code}:${sec.items.map((item) => item.id).join(',')}`).join('|'),
    [governedSections],
  );

  useGSAP(() => {
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scrollerEl = document.querySelector('.internal-main-scroll');

    const tabIdx = activeSectionTab === 'ALL' ? 0 : Math.max(0, governedSections.findIndex((sec) => sec.code === activeSectionTab) + 1);
    if (tabPillRef.current) {
      if (prefersReduced) {
        gsap.set(tabPillRef.current, { xPercent: tabIdx * 100 });
      } else {
        gsap.to(tabPillRef.current, {
          xPercent: tabIdx * 100,
          duration: 0.55,
          ease: 'expo.out',
        });
      }
    }

    if (prefersReduced) return;

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

    if (scrollerEl && scrollReadBarRef.current) {
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

    ScrollTrigger.refresh();
  }, { dependencies: [activeSectionTab, sectionsStructureKey, rowScopeFilter], scope: containerRef });

  useEffect(() => {
    if (activeSectionTab !== 'ALL' && !governedSections.some((sec) => sec.code === activeSectionTab)) {
      setActiveSectionTab('ALL');
    }
  }, [activeSectionTab, governedSections]);

  useGSAP(() => {
    if (!fillProgressRef.current) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(fillProgressRef.current, { scaleX: calculated.completionRatio });
      return;
    }
    gsap.to(fillProgressRef.current, {
      scaleX: calculated.completionRatio,
      duration: 0.65,
      ease: 'expo.out',
    });
  }, { dependencies: [calculated.completionRatio], scope: containerRef });

  const handleCellChange = (key, val) => {
    if (readOnly) return;
    if (isUnitMode && !editableSubKeys.has(key)) return;
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

  const handleNoteChange = (itemId, text) => {
    if (readOnly) return;
    if (isUnitMode && !editableItemIds.has(itemId)) return;
    if (workflow.status === WORKFLOW_STATUS.SUBMITTED || workflow.status === WORKFLOW_STATUS.APPROVED) return;
    setNotes((prev) => ({ ...prev, [itemId]: text }));
    setWorkflow((prev) => ({
      ...prev,
      status: prev.status === WORKFLOW_STATUS.NOT_STARTED ? WORKFLOW_STATUS.DRAFT : prev.status,
    }));
  };

  const handleAddRowEvidence = (payload) => {
    if (isUnitMode && unitForm) {
      addUnitEvidence(unitForm.id, unitUser, payload);
      return;
    }
    if (!payload.label?.trim()) {
      throw new Error('Judul bukti wajib diisi.');
    }
    if (payload.kind !== 'file') {
      let parsed;
      try {
        parsed = new URL(payload.url);
      } catch {
        throw new Error('URL bukti tidak valid.');
      }
      if (parsed.protocol !== 'https:') {
        throw new Error('Gunakan URL HTTPS yang valid.');
      }
    }
    setLocalEvidenceList((prev) => [
      ...prev,
      {
        id: createId('local_ev'),
        indicatorId: payload.indicatorId,
        kind: payload.kind,
        label: payload.label.trim(),
        url: payload.url || '',
        fileName: payload.fileName || '',
        mimeType: payload.mimeType || '',
        fileSize: payload.fileSize || 0,
        dataUrl: payload.dataUrl || '',
        status: 'PENDING',
        ownerUnit: unitUser?.unit || unitUser?.name || 'Simulasi PRP',
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleRemoveRowEvidence = (evidenceId) => {
    if (isUnitMode && unitForm) {
      removeUnitEvidence(unitForm.id, unitUser, evidenceId);
      return;
    }
    setLocalEvidenceList((prev) => prev.filter((ev) => ev.id !== evidenceId));
  };

  const navigableKeys = useMemo(
    () => (isUnitMode ? orderedKeys.filter((k) => editableSubKeys.has(k)) : orderedKeys),
    [isUnitMode, orderedKeys, editableSubKeys],
  );

  const handleKeyDown = (e, currentKey) => {
    const idx = navigableKeys.indexOf(currentKey);
    if (idx === -1) return;

    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextKey = navigableKeys[idx + 1];
      if (nextKey && inputRefs.current[nextKey]) {
        inputRefs.current[nextKey].focus();
        inputRefs.current[nextKey].select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevKey = navigableKeys[idx - 1];
      if (prevKey && inputRefs.current[prevKey]) {
        inputRefs.current[prevKey].focus();
        inputRefs.current[prevKey].select();
      }
    }
  };

  const handleFillSample = () => {
    if (readOnly) return;
    if (workflow.status === WORKFLOW_STATUS.SUBMITTED || workflow.status === WORKFLOW_STATUS.APPROVED) return;
    const presetSamples = {
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
      'd_1_date': '25-Nov-26',
      'd_2_date': '26-Mar-26',
      'd_3_sem1': '20-Jul-26',
      'd_3_sem2': '22-Jan-27',
      'd_4_val': '100',
      'd_5_un': '0',
      'd_5_tot': '24',
    };
    const nextValues = { ...values };
    const nextNotes = { ...notes };
    const simulatedEvidenceItems = [];
    governedSections.forEach((sec) => sec.items.forEach((item) => {
      if (isUnitMode && !editableItemIds.has(item.id)) return;
      item.subrows.forEach((sub, subIndex) => {
        if (presetSamples[sub.key] !== undefined) {
          nextValues[sub.key] = presetSamples[sub.key];
        } else if (sub.isTextInput) {
          nextValues[sub.key] = (subIndex === 1 ? item.deadlinesISO?.[1] : item.deadlinesISO?.[0] || item.deadlineISO) || '2026-06-30';
        } else {
          const target = Number(item.targetNum) || 100;
          nextValues[sub.key] = formatIndonesianNumber(subIndex === 0 ? target * 0.85 : target, 2);
        }
      });
      if (!String(nextNotes[item.id] ?? '').trim()) {
        nextNotes[item.id] = `Realisasi capaian indikator ${sec.code}.${item.no} telah diverifikasi unit (${formatPicDisplay(item.pics, item.picDisplay) || 'PIC'}).`;
      }
      if ((ownEvidenceByItem[item.id] || []).length === 0) {
        simulatedEvidenceItems.push({ secCode: sec.code, item });
      }
    }));
    setValues(nextValues);
    setNotes(nextNotes);
    if (isUnitMode && unitForm && unitUser && simulatedEvidenceItems.length > 0) {
      simulatedEvidenceItems.forEach(({ secCode, item }) => {
        try {
          addUnitEvidence(unitForm.id, unitUser, {
            indicatorId: item.id,
            kind: 'link',
            label: `Bukti Capaian ${secCode}.${item.no} (${formatPicDisplay(item.pics, item.picDisplay) || 'PIC'})`,
            url: `https://drive.itpln.ac.id/bukti-kpi/${secCode.toLowerCase()}-${String(item.no).toLowerCase()}`,
          });
        } catch {
          // Abaikan bila lampiran simulasi ditolak karena pembatasan periode
        }
      });
    } else if (!isUnitMode && simulatedEvidenceItems.length > 0) {
      setLocalEvidenceList((prev) => {
        const nextList = [...prev];
        simulatedEvidenceItems.forEach(({ secCode, item }) => {
          if (!nextList.some((ev) => ev.indicatorId === item.id)) {
            nextList.push({
              id: createId('ev-local'),
              indicatorId: item.id,
              kind: 'link',
              label: `Bukti Capaian ${secCode}.${item.no} (${formatPicDisplay(item.pics, item.picDisplay) || 'PIC'})`,
              url: `https://drive.itpln.ac.id/bukti-kpi/${secCode.toLowerCase()}-${String(item.no).toLowerCase()}`,
              status: 'PENDING',
              uploadedAt: new Date().toISOString(),
            });
          }
        });
        return nextList;
      });
    }
    setWorkflow((prev) => ({ ...prev, status: WORKFLOW_STATUS.DRAFT, revisionNote: '' }));
    showToast(
      isUnitMode
        ? `Nilai simulasi, keterangan, dan bukti tautan diterapkan pada ${calculated.picTotalIndicators} indikator PIC Anda.`
        : 'Data simulasi demo diterapkan pada seluruh indikator.',
    );
  };

  const handleReset = () => {
    if (readOnly) return;
    if (workflow.status === WORKFLOW_STATUS.SUBMITTED || workflow.status === WORKFLOW_STATUS.APPROVED) return;
    if (isUnitMode) {
      const cleared = { ...values };
      editableSubKeys.forEach((k) => { cleared[k] = ''; });
      const clearedNotes = { ...notes };
      editableItemIds.forEach((id) => { delete clearedNotes[id]; });
      setValues(cleared);
      setNotes(clearedNotes);
      if (unitForm && unitUser) {
        clearUnitKpiDraft(unitForm.id, unitUser, { clearPendingEvidence: true });
      }
    } else {
      setValues(emptyDefaults);
      setNotes({});
      setLocalEvidenceList([]);
    }
    try {
      localStorage.removeItem(valuesKey);
      localStorage.removeItem(notesKey);
    } catch {
      // Abaikan kegagalan hapus penyimpanan lokal
    }
    setWorkflow((prev) => ({ ...prev, status: WORKFLOW_STATUS.NOT_STARTED, revisionNote: '' }));
    showToast('Isian, keterangan draf, dan lampiran simulasi telah dikosongkan.');
  };

  const handleSubmit = () => {
    if (readOnly || ['SUBMITTED', 'APPROVED', 'REJECTED', 'LOCKED'].includes(workflow.status)) return;

    const invalidCount = isUnitMode ? calculated.picInvalidInputs : calculated.totalInvalidInputs;
    const filledCount = isUnitMode ? calculated.picFilledInputs : calculated.totalFilledInputs;
    const requiredCount = isUnitMode ? calculated.picTotalInputs : calculated.totalInputsCount;

    if (isUnitMode && calculated.picTotalIndicators === 0) {
      showToast('Akun ini tidak memiliki penugasan baris indikator PIC untuk disubmit.');
      return;
    }

    if (invalidCount > 0) {
      showToast(`Masih ada ${invalidCount} isian pada indikator Anda dengan format tidak valid.`);
      return;
    }

    if (filledCount < requiredCount) {
      const missingCount = requiredCount - filledCount;
      showToast(`Lembar kerja belum lengkap. Masih ada ${missingCount} isian wajib pada indikator PIC Anda yang kosong.`);
      return;
    }

    if (isUnitMode && calculated.missingEvidenceIndicators.length > 0) {
      showToast(`Lampirkan bukti capaian terlebih dahulu pada indikator: ${calculated.missingEvidenceIndicators.join(', ')}.`);
      return;
    }

    if (unitForm && isUnitMode) {
      try {
        const sanitized = {};
        editableSubKeys.forEach((k) => { sanitized[k] = values[k] ?? ''; });
        const sanitizedNotes = {};
        editableItemIds.forEach((id) => {
          if (String(notes[id] ?? '').trim() !== '') sanitizedNotes[id] = notes[id];
        });
        const submittedRecord = submitUnitKpi(unitForm.id, unitUser, sanitized, { notes: sanitizedNotes });
        setWorkflow({ ...submittedRecord, history: submittedRecord.history || [] });
        showToast('Capaian, bukti dukung, dan keterangan berhasil terintegrasi ke sistem pusat PRP.');
      } catch (error) {
        showToast(error.message);
      }
      return;
    }

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
    showToast('Hubungi Admin PRP untuk membuka kembali pengajuan melalui ruang tinjauan.');
  };

  readOnly = readOnly || ['REJECTED', 'LOCKED'].includes(workflow.status);
  const isLocked = readOnly || workflow.status === WORKFLOW_STATUS.SUBMITTED || workflow.status === WORKFLOW_STATUS.APPROVED;
  const isReadyToSubmit = isUnitMode
    ? (
      calculated.picTotalIndicators > 0
      && calculated.picFilledInputs === calculated.picTotalInputs
      && calculated.picInvalidInputs === 0
      && calculated.incompleteFormulaIndicators.length === 0
      && calculated.missingEvidenceIndicators.length === 0
    )
    : (calculated.totalFilledInputs === calculated.totalInputsCount && calculated.totalInvalidInputs === 0);

  const workflowStatusLabel = ({ REJECTED: 'Ditolak PRP', LOCKED: 'Dikunci Final' })[workflow.status] || WORKFLOW_LABELS[workflow.status] || WORKFLOW_LABELS[WORKFLOW_STATUS.DRAFT];
  const workflowStatusTone = {
    [WORKFLOW_STATUS.NOT_STARTED]: { color: '#475569', background: '#F7FAFB', border: '#D8E4EA', icon: Clock3 },
    [WORKFLOW_STATUS.DRAFT]: { color: '#094E68', background: '#F7FAFB', border: '#B8CAD4', icon: History },
    [WORKFLOW_STATUS.SUBMITTED]: { color: '#14532D', background: '#F0FDF4', border: '#86EFAC', icon: CheckCircle2 },
    [WORKFLOW_STATUS.NEEDS_REVISION]: { color: '#78350F', background: '#FFFBEB', border: '#FCD34D', icon: AlertTriangle },
    [WORKFLOW_STATUS.APPROVED]: { color: '#094E68', background: '#EDF3F6', border: '#94B8C7', icon: ShieldCheck },
  }[workflow.status] || { color: '#094E68', background: '#F7FAFB', border: '#D8E4EA', icon: History };
  const WorkflowIcon = workflowStatusTone.icon;

  const getItemNotesAndEvidenceForExport = (item) => {
    const ownEv = ownEvidenceByItem[item.id] || [];
    const sharedEv = integratedBoard?.evidenceByItem?.[item.id] || [];
    const byId = new Map();
    ownEv.forEach((e) => byId.set(e.id, e));
    sharedEv.forEach((e) => { if (!byId.has(e.id)) byId.set(e.id, e); });
    const evSummary = [...byId.values()]
      .map((e) => `${e.label} (${e.kind === 'file' ? e.fileName || 'Dokumen' : e.url})`)
      .join('; ');
    const noteText = (editableItemIds.has(item.id) ? notes[item.id] : (integratedBoard?.notes?.[item.id] || notes[item.id])) || '';
    return {
      picText: formatPicDisplay(item.pics, item.picDisplay) || '-',
      evAndNoteText: [evSummary ? `Bukti: ${evSummary}` : '', noteText ? `Ket: ${noteText}` : ''].filter(Boolean).join(' | ') || '-',
    };
  };

  const buildDocumentRowsHtml = (isExcel = true) => {
    let html = '';

    calculated.sections.forEach((sec) => {
      if (isExcel) {
        html += `
          <tr style="background-color: #EDF3F6; font-weight: bold; color: #072534;">
            <td style="border:1px solid #CBD5E1; text-align:center; padding:8px;">${sec.code}</td>
            <td colspan="4" style="border:1px solid #CBD5E1; padding:8px;">${sec.title}</td>
            <td style="border:1px solid #CBD5E1; text-align:center; padding:8px;">${sec.weightDisplay}</td>
            <td colspan="6" style="border:1px solid #CBD5E1; padding:8px;"></td>
          </tr>
        `;
      } else {
        html += `
          <tr class="cat-row">
            <td class="center">${sec.code}</td>
            <td colspan="4">${sec.title}</td>
            <td class="center">${sec.weightDisplay}</td>
            <td colspan="6"></td>
          </tr>
        `;
      }

      sec.items.forEach((item) => {
        const subCount = item.parsedSubs.length;
        const capStr =
          item.ratioPercent !== null
            ? `${formatIndonesianNumber(Math.min(100, Math.max(0, item.ratioPercent)), 2)}%`
            : isExcel
              ? ''
              : '-';
        const skorStr =
          item.weightedScore !== null
            ? formatIndonesianNumber(item.weightedScore, 2)
            : isExcel
              ? ''
              : '-';
        const { picText, evAndNoteText } = getItemNotesAndEvidenceForExport(item);

        const hasGroupBanner = Boolean(item.groupBannerTitle);
        const hasSplitTargets = Array.isArray(item.subrowTargets);

        if (hasGroupBanner) {
          if (isExcel) {
            html += `
              <tr>
                <td rowspan="${item.excelNoRowSpan}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#072534;">${item.excelNo}</td>
                <td style="border:1px solid #CBD5E1; padding:7px; font-weight:bold; text-decoration:underline; color:#072534;">${item.groupBannerTitle}</td>
                <td colspan="10" style="border:1px solid #CBD5E1;"></td>
              </tr>
            `;
          } else {
            html += `
              <tr>
                <td rowspan="${item.excelNoRowSpan}" class="center bold">${item.excelNo}</td>
                <td class="bold" style="text-decoration: underline;">${item.groupBannerTitle}</td>
                <td colspan="10"></td>
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
                  ? `<td rowspan="${item.excelNoRowSpan}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#072534;">${item.excelNo}</td>`
                  : ''
                }
                  ${!item.hideIndikatorCell
                  ? `<td rowspan="${item.indikatorRowSpan}" style="border:1px solid #CBD5E1; vertical-align:middle; padding:7px; font-weight:600; color:#072534;">${item.indikator}</td>`
                  : ''
                }
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; vertical-align:middle; padding:7px; color:#334155;">${item.formula}</td>
                  <td style="border:1px solid #CBD5E1; padding:7px; color:#334155;">${sub.label}</td>
                  <td style="border:1px solid #CBD5E1; text-align:right; padding:7px; font-weight:bold; color:#072534;">${sub.raw || ''}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#072534;">${item.bobotDisplay}</td>
                  <td rowspan="${targetRowSpan}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; color:#072534;">${firstTargetText}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; color:#475569;">${item.satuan}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:600; color:#094E68;">${picText}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#072534;">${capStr}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; font-weight:bold; color:#072534;">${skorStr}</td>
                  <td rowspan="${subCount}" style="border:1px solid #CBD5E1; vertical-align:middle; padding:7px; color:#334155;">${evAndNoteText}</td>
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
                  <td class="right bold">${sub.raw || '-'}</td>
                  <td rowspan="${subCount}" class="center bold">${item.bobotDisplay}</td>
                  <td rowspan="${targetRowSpan}" class="center">${firstTargetText}</td>
                  <td rowspan="${subCount}" class="center">${item.satuan}</td>
                  <td rowspan="${subCount}" class="center bold">${picText}</td>
                  <td rowspan="${subCount}" class="center bold">${capStr}</td>
                  <td rowspan="${subCount}" class="center bold">${skorStr}</td>
                  <td rowspan="${subCount}">${evAndNoteText}</td>
                </tr>
              `;
            }
          } else {
            const subTargetCellExcel = hasSplitTargets
              ? `<td style="border:1px solid #CBD5E1; text-align:center; vertical-align:middle; color:#072534;">${item.subrowTargets[sIdx] || ''}</td>`
              : '';
            const subTargetCellPdf = hasSplitTargets
              ? `<td class="center">${item.subrowTargets[sIdx] || ''}</td>`
              : '';

            if (isExcel) {
              html += `
                <tr>
                  <td style="border:1px solid #CBD5E1; padding:7px; color:#334155;">${sub.label}</td>
                  <td style="border:1px solid #CBD5E1; text-align:right; padding:7px; font-weight:bold; color:#072534;">${sub.raw || ''}</td>
                  ${subTargetCellExcel}
                </tr>
              `;
            } else {
              html += `
                <tr>
                  <td>${sub.label}</td>
                  <td class="right bold">${sub.raw || '-'}</td>
                  ${subTargetCellPdf}
                </tr>
              `;
            }
          }
        });
      });
    });

    const netFormatted = formatIndonesianNumber(calculated.netTotalScore, 2);
    const posFormatted = formatIndonesianNumber(calculated.positiveScoreABC, 2);
    const penFormatted = formatIndonesianNumber(calculated.penaltyScoreD, 2);

    if (isExcel) {
      html += `
        <tr style="background-color: #F7FAFB; font-weight: bold; color: #072534;">
          <td colspan="5" style="border:1px solid #CBD5E1; text-align:right; padding:9px;">
            SKOR AKHIR KPI BERSIH: CAPAIAN (A+B+C: ${posFormatted}) + KEPATUHAN (D: ${penFormatted}):
          </td>
          <td style="border:1px solid #CBD5E1; text-align:center; padding:9px;">100</td>
          <td colspan="4" style="border:1px solid #CBD5E1;"></td>
          <td style="border:1px solid #CBD5E1; text-align:center; padding:9px;">${netFormatted}</td>
          <td style="border:1px solid #CBD5E1;"></td>
        </tr>
      `;
    } else {
      html += `
        <tr class="cat-row">
          <td colspan="5" class="right">
            SKOR AKHIR KPI BERSIH: CAPAIAN (A+B+C: ${posFormatted}) + KEPATUHAN (D: ${penFormatted}):
          </td>
          <td class="center">100</td>
          <td colspan="4"></td>
          <td class="center">${netFormatted}</td>
          <td></td>
        </tr>
      `;
    }

    return html;
  };

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
              <th style="border:1px solid #CBD5E1; padding:10px; width:200px;">INDIKATOR KINERJA</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:240px;">FORMULA</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:240px;">Rumusan Mencapai Capaian</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:125px;">ISIAN</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:70px;">BOBOT</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:110px;">NILAI 100% (TARGET)</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:95px;">SATUAN</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:130px;">PENANGGUNG JAWAB (PIC)</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:105px;">CAPAIAN (%)</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:95px;">SKOR</th>
              <th style="border:1px solid #CBD5E1; padding:10px; width:240px;">BUKTI CAPAIAN &amp; KETERANGAN</th>
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
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const sectionSummaryHtml = calculated.sections.map((sec) => `
          <div class="summary-box">
            <div class="summary-label">Bagian ${escapeHtml(sec.code)} • ${escapeHtml(sec.title)} (${escapeHtml(sec.weightDisplay ?? sec.totalWeight)})</div>
            <div class="summary-val">${formatIndonesianNumber(sec.secScore, 2)} Poin</div>
          </div>`).join('');
    const sectionSubtitle = calculated.sections.map((sec) => `${escapeHtml(sec.title)} (${escapeHtml(sec.weightDisplay ?? sec.totalWeight)})`).join(' • ');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dokumen_Evaluasi_KPI_Lengkap_A_B_C_D_ITPLN_2026</title>
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 7.8pt;
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
            font-size: 12.5pt;
            font-weight: 800;
            margin: 0 0 2px 0;
            letter-spacing: -0.4px;
            color: #0f172a;
          }
          .doc-sub {
            font-size: 7.8pt;
            color: #475569;
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
            color: #475569;
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
            padding: 4px 5px;
            vertical-align: middle;
            line-height: 1.25;
          }
          th {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 6.4pt;
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
            font-size: 7.6pt;
            color: #475569;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div>
            <div class="doc-title">LAPORAN EVALUASI CAPAIAN KPI: PERSPEKTIF ${calculated.sections.map((sec) => escapeHtml(sec.code)).join(', ')}</div>
            <div class="doc-sub">Institut Teknologi Perusahaan Listrik Negara (ITPLN) • ${sectionSubtitle}</div>
          </div>
          <div style="text-align: right; font-size: 7.6pt; color: #475569;">
            <div><strong>Tanggal Cetak:</strong> ${dateStr}</div>
            <div><strong>Status Dokumen:</strong> Rekapitulasi Terpusat</div>
          </div>
        </div>

        <div class="summary-strip">
${sectionSummaryHtml}
          <div class="summary-box">
            <div class="summary-label">Skor Akhir KPI Bersih</div>
            <div class="summary-val">${formatIndonesianNumber(calculated.netTotalScore, 2)} / 100</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 24px;">NO</th>
              <th style="width: 135px;">INDIKATOR KINERJA</th>
              <th style="width: 165px;">FORMULA</th>
              <th style="width: 165px;">Rumusan Mencapai Capaian</th>
              <th style="width: 72px;">ISIAN</th>
              <th style="width: 38px;">BOBOT</th>
              <th style="width: 62px;">TARGET</th>
              <th style="width: 52px;">SATUAN</th>
              <th style="width: 78px;">PIC</th>
              <th style="width: 54px;">CAPAIAN</th>
              <th style="width: 48px;">SKOR</th>
              <th style="width: 155px;">BUKTI &amp; KETERANGAN</th>
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
    const byTab = activeSectionTab === 'ALL'
      ? calculated.sections
      : calculated.sections.filter((sec) => sec.code === activeSectionTab);
    const base = byTab.length ? byTab : calculated.sections;
    if (!isUnitMode || rowScopeFilter !== 'MY_PIC') return base;
    return base
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => item.canEditRow),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [activeSectionTab, calculated.sections, isUnitMode, rowScopeFilter]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem', position: 'relative' }}>
      {structureToast && (
        <div className="kpi-structure-toast" role="alert" aria-live="polite">
          <RefreshCcw size={14} />
          <span>{structureToast}</span>
        </div>
      )}
      <style>{`
        .kpi-structure-toast {
          position: fixed;
          right: 1.5rem;
          bottom: 1.5rem;
          z-index: 80;
          max-width: min(440px, calc(100% - 2rem));
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          background: #062C3D;
          border: 1px solid #094E68;
          color: #FFFFFF;
          font-size: 0.78rem;
          font-weight: 600;
          box-shadow: 0 14px 32px rgba(7, 37, 52, 0.22);
          animation: kpiToastIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes kpiToastIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .clean-ledger-card {
          background: #FFFFFF;
          border: 1px solid #D8E4EA;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(7, 37, 52, 0.03);
          overflow: hidden;
        }
        .clean-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          padding: 1.15rem 1.4rem;
          background: #F7FAFB;
          border-bottom: 1px solid #D8E4EA;
        }
        .clean-editorial-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          background: #FFFFFF;
          color: #072534;
          font-size: 0.81rem;
        }
        .clean-editorial-table th {
          background: #EDF3F6;
          color: #072534;
          font-family: 'Inter', sans-serif;
          font-size: 0.67rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.8rem 0.85rem;
          border-bottom: 1px solid #D8E4EA;
          border-right: 1px solid #D8E4EA;
          text-align: left;
          vertical-align: middle;
        }
        .clean-editorial-table th:last-child {
          border-right: none;
        }
        .clean-editorial-table td {
          padding: 0.7rem 0.85rem;
          border-bottom: 1px solid #EDF3F6;
          border-right: 1px solid #EDF3F6;
          vertical-align: middle;
          color: #072534;
          line-height: 1.45;
        }
        .clean-editorial-table td:last-child {
          border-right: none;
        }
        .kpi-indicator-tbody {
          border-bottom: 1px solid #D8E4EA;
          transition: background-color 0.2s ease;
        }
        .kpi-indicator-tbody:last-child {
          border-bottom: none;
        }
        .kpi-indicator-tbody:hover {
          background-color: #F7FAFB;
        }
        .kpi-indicator-tbody.is-readonly-pic {
          background-color: #FAFDFE;
        }
        .clean-input-cell {
          padding: 0.45rem 0.65rem !important;
          background: #FFFFFF;
          transition: background-color 0.2s ease;
        }
        .clean-input-cell.is-denominator {
          background: #F7FAFB;
        }
        .clean-input-cell.is-focused {
          background: #F7FAFB;
          box-shadow: inset 0 0 0 1.5px #0E7480;
        }
        .clean-input-cell.is-invalid {
          background: #FEF2F2;
          box-shadow: inset 0 0 0 1.5px #B91C1C;
        }
        .clean-sheet-input {
          width: 100%;
          min-height: 38px;
          border: 1px solid #94A3B8;
          border-radius: 6px;
          background: #FFFFFF;
          padding: 0.45rem 0.65rem;
          font-family: 'JetBrains Mono', 'Outfit', 'Inter', monospace;
          font-size: 0.83rem;
          font-weight: 700;
          color: #072534;
          text-align: right;
          font-variant-numeric: tabular-nums;
          box-sizing: border-box;
          transition: border-color 0.18s ease, background-color 0.18s ease;
        }
        .clean-sheet-input:hover:not(:disabled) {
          border-color: #094E68;
          background: #FFFFFF;
        }
        .clean-sheet-input:focus,
        .clean-sheet-input:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: 1px;
          border-color: #094E68;
          background: #FFFFFF;
        }
        .clean-sheet-input:disabled {
          cursor: not-allowed;
          color: #475569;
          background: #EDF3F6;
          border-color: #D8E4EA;
        }
        .clean-sheet-input::placeholder {
          color: #64748B;
          font-weight: 500;
          font-size: 0.75rem;
        }
        .clean-row-text-input,
        .clean-row-textarea {
          width: 100%;
          border: 1px solid #94A3B8;
          border-radius: 6px;
          background: #FFFFFF;
          padding: 0.4rem 0.55rem;
          font-family: 'Inter', sans-serif;
          font-size: 0.73rem;
          color: #072534;
          box-sizing: border-box;
          transition: border-color 0.18s ease;
        }
        .clean-row-textarea {
          resize: vertical;
          min-height: 50px;
          line-height: 1.4;
        }
        .clean-row-text-input:focus-visible,
        .clean-row-textarea:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: 1px;
          border-color: #094E68;
        }
        .clean-mini-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          min-height: 30px;
          padding: 0.25rem 0.55rem;
          border-radius: 5px;
          font-size: 0.69rem;
          font-weight: 600;
          cursor: pointer;
          background: #FFFFFF;
          border: 1px solid #B8CAD4;
          color: #094E68;
          transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
        }
        .clean-mini-btn:hover:not(:disabled) {
          background: #EDF3F6;
          border-color: #094E68;
          color: #072534;
        }
        .clean-mini-btn:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: 2px;
        }
        .clean-mini-btn-danger {
          color: #7F1D1D;
          border-color: #FCA5A5;
          background: #FEF2F2;
        }
        .clean-mini-btn-danger:hover:not(:disabled) {
          background: #FEE2E2;
          border-color: #B91C1C;
          color: #7F1D1D;
        }
        .clean-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          min-height: 38px;
          padding: 0.55rem 0.95rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          background: #FFFFFF;
          border: 1px solid #D8E4EA;
          color: #072534;
          transition: background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }
        .clean-btn:hover:not(:disabled) {
          background: #F7FAFB;
          border-color: #094E68;
          color: #094E68;
        }
        .clean-btn:focus-visible {
          outline: 2px solid #0E7480;
          outline-offset: 2px;
        }
        .clean-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .clean-btn-primary {
          background: #094E68;
          border: 1px solid #094E68;
          color: #FFFFFF;
          font-weight: 700;
        }
        .clean-btn-primary:hover:not(:disabled) {
          background: #072534;
          border-color: #072534;
          color: #FFFFFF;
        }
        @media (max-width: 768px) {
          .clean-btn,
          .clean-sheet-input,
          .clean-mini-btn,
          .clean-row-text-input {
            min-height: 44px;
          }
          .clean-section-header {
            padding: 1rem;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .kpi-structure-toast,
          .kpi-indicator-tbody,
          .clean-sheet-input,
          .clean-mini-btn,
          .clean-btn {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

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
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', minWidth: 0, flex: '1 1 300px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '6px',
              background: '#FFFFFF',
              border: `1px solid ${workflowStatusTone.border}`,
              color: workflowStatusTone.color,
              flexShrink: 0,
            }}
          >
            <WorkflowIcon size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <strong style={{ color: workflowStatusTone.color, fontSize: '0.86rem' }}>{workflowStatusLabel}</strong>
              {isUnitMode && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: '#EDF3F6',
                    border: '1px solid #B8CAD4',
                    color: '#072534',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  PIC: {userPicCodes.join(', ') || 'BELUM DITAUTKAN'}
                </span>
              )}
              {isLocked && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', color: '#475569' }}>
                  <LockKeyhole size={12} /> Data terkunci
                </span>
              )}
            </div>
            <div style={{ color: '#334155', fontSize: '0.73rem', marginTop: '0.2rem', lineHeight: 1.45 }}>
              {isLocked
                ? `Terintegrasi ke sistem pusat ${workflow.submittedAt ? new Date(workflow.submittedAt).toLocaleString('id-ID') : 'pada sesi aktif'}`
                : isUnitMode
                  ? `Hak edit aktif pada ${calculated.picTotalIndicators} indikator PIC Anda (${calculated.picFilledInputs}/${calculated.picTotalInputs} isian terisi) · ${calculated.totalIndicatorsCount - calculated.picTotalIndicators} indikator unit lain berstatus View Only.`
                  : `${calculated.totalFilledInputs} dari ${calculated.totalInputsCount} isian terpenuhi pada keseluruhan tabel institusi.`}
              {!isLocked && isUnitMode && calculated.missingEvidenceIndicators.length > 0 && (
                <span style={{ display: 'block', color: '#78350F', fontWeight: 600, marginTop: '0.15rem' }}>
                  Bukti capaian wajib dilengkapi pada {calculated.missingEvidenceIndicators.length} baris PIC ({calculated.missingEvidenceIndicators.slice(0, 5).join(', ')}{calculated.missingEvidenceIndicators.length > 5 ? '...' : ''}).
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '150px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.66rem', fontWeight: 700, marginBottom: '0.3rem' }}>
              <span>{isUnitMode ? 'KELENGKAPAN TUGAS PIC' : 'KELENGKAPAN'}</span>
              <span>{Math.round(calculated.completionRatio * 100)}%</span>
            </div>
            <div style={{ height: '5px', background: '#D8E4EA', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${calculated.completionRatio * 100}%`, height: '100%', background: '#0E7480', borderRadius: '99px', transition: 'width 0.3s ease' }} />
            </div>
          </div>
          {!isLocked && (
            <button
              type="button"
              onClick={handleSubmit}
              className="clean-btn clean-btn-primary"
              style={!isReadyToSubmit ? { background: '#0E7480', borderColor: '#0E7480' } : undefined}
            >
              <Send size={14} />
              <span>{isUnitMode ? 'Submit ke Sistem Pusat' : 'Submit Lembar Kerja'}</span>
            </button>
          )}
          {isLocked && !readOnly && !unitForm && workflow.status !== WORKFLOW_STATUS.APPROVED && (
            <button type="button" onClick={handleRequestRevision} className="clean-btn">
              <RefreshCcw size={14} />
              <span>Ajukan Pembukaan Revisi</span>
            </button>
          )}
        </div>
      </div>

      {workflow.status === WORKFLOW_STATUS.NEEDS_REVISION && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.8rem 1rem', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', color: '#78350F', fontSize: '0.76rem' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div><strong>Perlu perbaikan:</strong> {workflow.revisionNote || 'Lembar kerja dibuka kembali oleh PRP untuk diperbaiki.'} Perbarui capaian atau bukti dukung Anda, lalu submit ulang ke sistem pusat.</div>
        </div>
      )}

      <div
        style={{
          position: 'sticky',
          top: '-0.5rem',
          zIndex: 25,
          background: '#FFFFFF',
          border: '1px solid #D8E4EA',
          borderRadius: '8px',
          padding: '0.85rem 1.15rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
          boxShadow: '0 2px 10px rgba(7, 37, 52, 0.05)',
          maxWidth: '100%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: '#EDF3F6',
          }}
        >
          <div
            ref={scrollReadBarRef}
            style={{
              width: '100%',
              height: '100%',
              background: '#0E7480',
              transformOrigin: 'left center',
              transform: 'scaleX(0)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', maxWidth: '100%', minWidth: 0 }}>
          <div style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' }}>
            <div
              role="tablist"
              aria-label="Filter bagian KPI"
              style={{
                position: 'relative',
                display: 'grid',
                gridTemplateColumns: `repeat(${governedSections.length + 1}, 1fr)`,
                background: '#EDF3F6',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid #D8E4EA',
                minWidth: `${Math.max(240, (governedSections.length + 1) * 116)}px`,
              }}
            >
              <div
                ref={tabPillRef}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '3px',
                  bottom: '3px',
                  left: '3px',
                  width: `calc((100% - 6px) / ${governedSections.length + 1})`,
                  background: '#FFFFFF',
                  borderRadius: '6px',
                  boxShadow: '0 1px 3px rgba(7, 37, 52, 0.08)',
                  border: '1px solid #D8E4EA',
                  zIndex: 1,
                }}
              />
              {[
                { id: 'ALL', label: 'Semua Bagian', sub: 'Lengkap' },
                ...governedSections.map((sec) => ({
                  id: sec.code,
                  label: `Bagian ${sec.code}`,
                  sub: sec.isPenaltySection
                    ? `Penalti (${sec.weightDisplay ?? sec.totalWeight})`
                    : `Bobot ${sec.weightDisplay ?? sec.totalWeight}`,
                })),
              ].map((tab) => {
                const isSelected = activeSectionTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setActiveSectionTab(tab.id)}
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      minHeight: '44px',
                      border: 'none',
                      borderRadius: '6px',
                      background: 'transparent',
                      padding: '0.42rem 0.5rem',
                      cursor: 'pointer',
                      color: isSelected ? '#072534' : '#334155',
                      transition: 'color 0.2s ease',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem', fontWeight: 700 }}>
                      {tab.label}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: isSelected ? '#094E68' : '#475569', fontWeight: 600 }}>
                      {tab.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {isUnitMode && (
            <div
              role="group"
              aria-label="Cakupan tampilan indikator PIC"
              style={{
                display: 'inline-flex',
                background: '#EDF3F6',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid #D8E4EA',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setRowScopeFilter('ALL')}
                style={{
                  minHeight: '38px',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '6px',
                  border: rowScopeFilter === 'ALL' ? '1px solid #D8E4EA' : '1px solid transparent',
                  background: rowScopeFilter === 'ALL' ? '#FFFFFF' : 'transparent',
                  color: '#072534',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Semua Indikator ({calculated.totalIndicatorsCount})
              </button>
              <button
                type="button"
                onClick={() => setRowScopeFilter('MY_PIC')}
                style={{
                  minHeight: '38px',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '6px',
                  border: rowScopeFilter === 'MY_PIC' ? '1px solid #D8E4EA' : '1px solid transparent',
                  background: rowScopeFilter === 'MY_PIC' ? '#FFFFFF' : 'transparent',
                  color: '#094E68',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Tugas PIC Saya ({calculated.picTotalIndicators})
              </button>
            </div>
          )}

          <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
            Tersimpan ({lastSaved})
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {!readOnly && (
            <>
              <button type="button" onClick={handleFillSample} className="clean-btn" disabled={isLocked}>
                <SlidersHorizontal size={13} />
                <span>{isUnitMode ? 'Simulasi PIC' : 'Isi Simulasi'}</span>
              </button>

              <button type="button" onClick={handleReset} className="clean-btn" disabled={isLocked}>
                <RotateCcw size={13} />
                <span>Kosongkan</span>
              </button>
            </>
          )}

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

      <div
        style={{
          width: '100%',
          height: '2px',
          background: '#EDF3F6',
          borderRadius: '99px',
          overflow: 'hidden',
        }}
      >
        <div
          ref={fillProgressRef}
          style={{
            width: '100%',
            height: '100%',
            background: '#0E7480',
            transformOrigin: 'left center',
            transform: 'scaleX(0)',
          }}
        />
      </div>

      {visibleSections.length === 0 && (
        <div className="gov-placeholder">
          Tidak ada baris indikator yang ditugaskan ke PIC ({userPicCodes.join(', ') || '-'}) pada filter bagian yang dipilih. Pilih &ldquo;Semua Indikator&rdquo; untuk melihat capaian unit lain secara transparan.
        </div>
      )}

      {visibleSections.map((sec) => (
        <div key={sec.code} className="clean-ledger-card ledger-section-card">
          <div className="clean-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  background: '#094E68',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  flexShrink: 0,
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
                    color: '#475569',
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
                    color: '#072534',
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
                flexWrap: 'wrap',
                gap: '0.75rem 1rem',
                fontSize: '0.78rem',
                color: '#475569',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>
                Terisi Lintas Unit: <strong style={{ color: '#072534' }}>{sec.secCompleted} / {sec.secTotalItems}</strong> Butir
              </span>
              <span style={{ color: '#D8E4EA' }} aria-hidden="true">|</span>
              <span
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  background: '#FFFFFF',
                  border: '1px solid #D8E4EA',
                  color: '#072534',
                  fontWeight: 700,
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Skor Bagian {sec.code}: {formatIndonesianNumber(sec.secScore, 2)} / {sec.weightDisplay}
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }} data-lenis-prevent>
            <table className="clean-editorial-table" style={{ minWidth: '1440px' }}>
              <colgroup>
                <col style={{ width: '50px' }} />
                <col style={{ width: '185px' }} />
                <col style={{ width: '205px' }} />
                <col style={{ width: '132px' }} />
                <col style={{ width: '215px' }} />
                <col style={{ width: '142px' }} />
                <col style={{ width: '64px' }} />
                <col style={{ width: '92px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '118px' }} />
                <col style={{ width: '275px' }} />
              </colgroup>

              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>NO</th>
                  <th>INDIKATOR KINERJA</th>
                  <th>FORMULA</th>
                  <th style={{ textAlign: 'center' }}>PENANGGUNG JAWAB (PIC)</th>
                  <th>RUMUSAN MENCAPAI CAPAIAN</th>
                  <th style={{ textAlign: 'right', background: '#EDF3F6', color: '#072534' }}>
                    ISIAN
                  </th>
                  <th style={{ textAlign: 'center' }}>BOBOT</th>
                  <th style={{ textAlign: 'center' }}>NILAI 100% (TARGET)</th>
                  <th style={{ textAlign: 'center' }}>SATUAN</th>
                  <th style={{ textAlign: 'right', background: '#EDF3F6', color: '#072534' }}>
                    CAPAIAN &amp; SKOR
                  </th>
                  <th>BUKTI CAPAIAN &amp; KETERANGAN</th>
                </tr>
              </thead>

              {sec.items.map((item) => {
                const rowCount = item.parsedSubs.length;
                const progressPct =
                  item.ratioPercent !== null ? Math.min(100, Math.max(0, item.ratioPercent)) : 0;
                const hasSplitTargets = Array.isArray(item.subrowTargets);
                const canEditRow = item.canEditRow;
                const isRowInputDisabled = isLocked || (isUnitMode && !canEditRow);
                const rowPics = normalizePicCodes(item.pics);
                const picDisplayLabel = formatPicDisplay(rowPics, item.picDisplay) || 'Semua Unit';
                const isHighlightedForReview = highlightedPicsSet.size > 0
                  && rowPics.some((code) => highlightedPicsSet.has(code.toLowerCase()));
                const contributor = contributorMapOverride?.[item.id] || integratedBoard?.contributorsByItem?.[item.id] || null;

                return (
                  <tbody
                    key={item.id}
                    className={`kpi-indicator-tbody ${isUnitMode && !canEditRow ? 'is-readonly-pic' : ''}`}
                  >
                    {item.groupBannerTitle && (
                      <tr style={{ background: '#F7FAFB', borderBottom: '1px solid #D8E4EA' }}>
                        <td
                          style={{
                            textAlign: 'center',
                            fontWeight: 800,
                            fontFamily: 'Outfit, sans-serif',
                            color: '#072534',
                          }}
                        >
                          {item.excelNo || item.no}
                        </td>
                        <td
                          colSpan={10}
                          style={{
                            fontWeight: 800,
                            fontFamily: 'Outfit, sans-serif',
                            color: '#072534',
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

                    {item.parsedSubs.map((sub, sIdx) => {
                      const coPicValue = isUnitMode && canEditRow && !isLocked && !sub.raw
                        ? (integratedBoard?.values?.[sub.key] || '')
                        : '';
                      return (
                        <tr key={sub.key}>
                          {sIdx === 0 && (
                            <>
                              <td
                                rowSpan={rowCount}
                                style={{
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  fontFamily: 'Outfit, sans-serif',
                                  fontSize: '0.86rem',
                                  color: '#094E68',
                                  background: isHighlightedForReview ? '#F0FDF4' : '#FFFFFF',
                                }}
                              >
                                {item.no}
                              </td>

                              <td
                                rowSpan={rowCount}
                                style={{
                                  fontWeight: 600,
                                  color: '#072534',
                                  fontSize: '0.83rem',
                                  background: isHighlightedForReview ? '#F0FDF4' : '#FFFFFF',
                                }}
                              >
                                <div>{item.indikator}</div>
                                {item.extraNote && (
                                  <div
                                    style={{
                                      marginTop: '0.45rem',
                                      fontSize: '0.69rem',
                                      fontWeight: 600,
                                      color: '#334155',
                                      background: '#F7FAFB',
                                      border: '1px solid #D8E4EA',
                                      padding: '3px 7px',
                                      borderRadius: '4px',
                                      display: 'inline-block',
                                    }}
                                  >
                                    {item.extraNote}
                                  </div>
                                )}
                              </td>

                              <td
                                rowSpan={rowCount}
                                style={{
                                  color: '#334155',
                                  fontSize: '0.78rem',
                                  background: '#FFFFFF',
                                }}
                              >
                                {item.formula}
                                {item.calcType === 'custom' && (
                                  <small style={{ display: 'block', marginTop: '.4rem', color: '#475569' }}>
                                    {describeKpiFormula(item.formulaExpr, item.subrows, buildKpiCellDirectory(governedSections).labels)}
                                  </small>
                                )}
                              </td>

                              <td
                                rowSpan={rowCount}
                                style={{
                                  textAlign: 'center',
                                  background: '#FFFFFF',
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.25rem' }}>
                                    {rowPics.length > 0 ? rowPics.map((code) => {
                                      const isUserMatch = userPicCodes.some((u) => u.toLowerCase() === code.toLowerCase())
                                        || highlightedPicsSet.has(code.toLowerCase());
                                      return (
                                        <span
                                          key={code}
                                          style={{
                                            fontSize: '0.66rem',
                                            fontWeight: 700,
                                            fontFamily: 'JetBrains Mono, monospace',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: isUserMatch ? '#094E68' : '#EDF3F6',
                                            color: isUserMatch ? '#FFFFFF' : '#072534',
                                            border: `1px solid ${isUserMatch ? '#094E68' : '#B8CAD4'}`,
                                          }}
                                        >
                                          {code}
                                        </span>
                                      );
                                    }) : (
                                      <span style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 600 }}>
                                        {picDisplayLabel}
                                      </span>
                                    )}
                                  </div>

                                  {isUnitMode && (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        fontSize: '0.63rem',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: canEditRow ? '#F0FDF4' : '#F7FAFB',
                                        border: `1px solid ${canEditRow ? '#86EFAC' : '#D8E4EA'}`,
                                        color: canEditRow ? '#14532D' : '#475569',
                                      }}
                                    >
                                      {!canEditRow && <LockKeyhole size={10} />}
                                      {canEditRow ? 'Hak Input Anda' : 'View Only'}
                                    </span>
                                  )}

                                  {!isUnitMode && isHighlightedForReview && (
                                    <span
                                      style={{
                                        fontSize: '0.63rem',
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: '#F0FDF4',
                                        border: '1px solid #86EFAC',
                                        color: '#14532D',
                                      }}
                                    >
                                      Tugas Unit Ini
                                    </span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}

                          <td
                            style={{
                              fontSize: '0.79rem',
                              fontWeight: sub.isDenominator ? 700 : 500,
                              color: sub.isDenominator ? '#072534' : '#334155',
                              background: sub.isDenominator ? '#F7FAFB' : 'transparent',
                            }}
                          >
                            {sub.label}
                          </td>

                          <td
                            className={`clean-input-cell ${sub.isDenominator ? 'is-denominator' : ''} ${focusedKey === sub.key ? 'is-focused' : ''} ${sub.isInvalid ? 'is-invalid' : ''}`}
                          >
                            <input
                              ref={(el) => (inputRefs.current[sub.key] = el)}
                              type="text"
                              inputMode={sub.isTextInput ? 'text' : 'decimal'}
                              aria-label={`${sec.code}.${item.no} ${sub.label}${isUnitMode && !canEditRow ? ' (hanya lihat)' : ''}`}
                              aria-invalid={Boolean(sub.isInvalid)}
                              className="clean-sheet-input"
                              value={sub.raw}
                              placeholder={isUnitMode && !canEditRow ? '-' : (sub.placeholder || '0')}
                              onFocus={() => setFocusedKey(sub.key)}
                              onBlur={() => setFocusedKey(null)}
                              onChange={(e) => handleCellChange(sub.key, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, sub.key)}
                              disabled={isRowInputDisabled}
                            />
                            {coPicValue && (
                              <button
                                type="button"
                                className="clean-mini-btn"
                                style={{ marginTop: '0.3rem', width: '100%', fontSize: '0.65rem' }}
                                onClick={() => handleCellChange(sub.key, coPicValue)}
                              >
                                Pakai isian rekan PIC ({coPicValue})
                              </button>
                            )}
                          </td>

                          {sIdx === 0 && (
                            <td
                              rowSpan={rowCount}
                              style={{
                                textAlign: 'center',
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                color: '#072534',
                                background: '#FFFFFF',
                              }}
                            >
                              {item.bobotDisplay}
                            </td>
                          )}

                          {hasSplitTargets ? (
                            <td
                              style={{
                                textAlign: 'center',
                                fontWeight: 600,
                                fontVariantNumeric: 'tabular-nums',
                                color: '#334155',
                                background: '#FFFFFF',
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
                                  background: '#FFFFFF',
                                }}
                              >
                                {item.targetDisplay}
                              </td>
                            )
                          )}

                          {sIdx === 0 && (
                            <>
                              <td
                                rowSpan={rowCount}
                                style={{
                                  textAlign: 'center',
                                  fontSize: '0.75rem',
                                  color: '#475569',
                                  background: '#FFFFFF',
                                }}
                              >
                                {item.satuan}
                              </td>

                              <td
                                rowSpan={rowCount}
                                style={{
                                  textAlign: 'right',
                                  background: '#F7FAFB',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                <div
                                  style={{
                                    fontFamily: 'Outfit, sans-serif',
                                    fontSize: '1.02rem',
                                    fontWeight: 800,
                                    color: item.ratioPercent !== null ? '#072534' : '#475569',
                                  }}
                                >
                                  {item.ratioPercent !== null
                                    ? `${formatIndonesianNumber(Math.min(100, Math.max(0, item.ratioPercent)), 2)}%`
                                    : '-'}
                                </div>

                                <div
                                  style={{
                                    width: '100%',
                                    height: '3px',
                                    background: '#D8E4EA',
                                    borderRadius: '99px',
                                    overflow: 'hidden',
                                    margin: '0.35rem 0',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${progressPct}%`,
                                      height: '100%',
                                      background: '#0E7480',
                                      transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                                    }}
                                  />
                                </div>

                                <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
                                  Skor:{' '}
                                  <strong style={{ color: '#072534' }}>
                                    {item.weightedScore !== null
                                      ? formatIndonesianNumber(item.weightedScore, 2)
                                      : '-'}
                                  </strong>{' '}
                                  / {item.bobotDisplay}
                                </div>
                              </td>

                              <td
                                rowSpan={rowCount}
                                style={{
                                  background: '#FFFFFF',
                                  verticalAlign: 'top',
                                }}
                              >
                                <RowEvidenceAndNotesCell
                                  sectionCode={sec.code}
                                  item={item}
                                  canEditRow={canEditRow}
                                  isLocked={isLocked}
                                  ownEvidence={ownEvidenceByItem[item.id] || []}
                                  sharedEvidence={integratedBoard?.evidenceByItem?.[item.id] || []}
                                  noteValue={notes[item.id] || ''}
                                  sharedNoteValue={integratedBoard?.notes?.[item.id] || ''}
                                  contributor={contributor}
                                  onNoteChange={handleNoteChange}
                                  onAddEvidence={handleAddRowEvidence}
                                  onRemoveEvidence={handleRemoveRowEvidence}
                                  onPreviewEvidence={setPreviewEvidence}
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        </div>
      ))}

      <div
        style={{
          padding: '1rem 1.4rem',
          background: '#FFFFFF',
          border: '1px solid #D8E4EA',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.78rem',
          color: '#475569',
        }}
      >
        <div>
          Navigasi cepat antar sel PIC aktif menggunakan tombol <code>Enter</code> atau panah <code>↑</code> <code>↓</code>.
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.9rem',
            flexWrap: 'wrap',
            fontWeight: 700,
            color: '#072534',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '0.84rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {calculated.sections.map((sec) => (
            <React.Fragment key={sec.code}>
              <span>
                {sec.code}{sec.isPenaltySection ? ' (Penalti)' : ''}: {formatIndonesianNumber(sec.secScore, 2)} / {sec.weightDisplay ?? formatIndonesianNumber(Number(sec.totalWeight) || 0, 2)}
              </span>
              <span style={{ color: '#D8E4EA' }} aria-hidden="true">|</span>
            </React.Fragment>
          ))}
          {isUnitMode && (
            <span
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                background: '#EDF3F6',
                border: '1px solid #B8CAD4',
                color: '#094E68',
              }}
            >
              Kontribusi PIC Anda: {formatIndonesianNumber(calculated.picNetScore, 2)} Poin
            </span>
          )}
          <span
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              background: '#062C3D',
              color: '#FFFFFF',
            }}
          >
            Skor Institusi Terpusat: {formatIndonesianNumber(calculated.netTotalScore, 2)} / 100 Poin
          </span>
        </div>
      </div>

      <EvidencePreviewModal
        evidence={previewEvidence}
        onClose={() => setPreviewEvidence(null)}
      />
    </div>
  );
}