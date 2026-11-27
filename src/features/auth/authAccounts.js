// Direktori akun resmi berbasis Unit Kerja pada portal PERFORMA ITPLN.
// Setiap indikator KPI dikelola oleh 1 PIC Utama per Unit Kerja, tanpa penggabungan akun ganda.
export const MOCK_ACCOUNTS = [
  {
    id: 'user-dual',
    code: '01',
    email: 'admin@itpln.ac.id',
    password: 'password',
    name: 'Direktorat Perencanaan & Pengembangan (PRP)',
    shortName: 'Direktorat PRP',
    role: 'superadmin_prp',
    roleTitle: 'Superadmin Direktorat PRP',
    badge: 'DIREKTORAT PRP',
    allowedPortals: ['iku', 'kpi'],
    picCodes: ['PRP'],
    unit: 'Direktorat Perencanaan & Pengembangan (PRP)',
    avatar: 'PRP',
    description: 'Pusat kendali eksekutif, desainer struktur & rumus KPI, verifikasi bukti dukung, dan tata kelola periode.'
  },
  {
    id: 'user-iku',
    code: '02',
    email: 'iku@itpln.ac.id',
    password: 'password',
    name: 'Biro Administrasi Akademik (BAA)',
    shortName: 'BAA',
    role: 'iku_only',
    roleTitle: 'Unit Kerja BAA (8 IKU)',
    badge: 'UNIT: BAA',
    allowedPortals: ['iku'],
    picCodes: ['BAA'],
    unit: 'Biro Administrasi Akademik (BAA)',
    avatar: 'BAA',
    description: 'Unit penanggung jawab pelaporan dan pemantauan 8 Indikator Kinerja Utama Perguruan Tinggi.'
  },
  {
    id: 'user-kpi-ppa',
    code: '03',
    email: 'ppa@itpln.ac.id',
    password: 'password',
    name: 'Pusat Pelayanan Akademik (PPA)',
    shortName: 'PPA',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja PPA',
    badge: 'UNIT: PPA',
    allowedPortals: ['kpi'],
    picCodes: ['PPA'],
    unit: 'Pusat Pelayanan Akademik (PPA)',
    avatar: 'PPA',
    description: 'PIC Utama indikator penerimaan mahasiswa baru pada Perspektif Keberlanjutan.'
  },
  {
    id: 'user-kpi-bakt',
    code: '04',
    email: 'bakt@itpln.ac.id',
    password: 'password',
    name: 'Biro Akuntansi (BAKT)',
    shortName: 'BAKT',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja BAKT',
    badge: 'UNIT: BAKT',
    allowedPortals: ['kpi'],
    picCodes: ['BAKT'],
    unit: 'Biro Akuntansi (BAKT)',
    avatar: 'BAK',
    description: 'PIC Utama indikator realisasi pendapatan, efisiensi biaya operasi, dan ketepatan laporan keuangan.'
  },
  {
    id: 'user-kpi-bag',
    code: '05',
    email: 'bag@itpln.ac.id',
    password: 'password',
    name: 'Biro Anggaran (BAG)',
    shortName: 'BAG',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja BAG',
    badge: 'UNIT: BAG',
    allowedPortals: ['kpi'],
    picCodes: ['BAG'],
    unit: 'Biro Anggaran (BAG)',
    avatar: 'BAG',
    description: 'PIC Utama ketepatan waktu dokumen RKA serta Co-PIC kolaborasi anggaran.'
  },
  {
    id: 'user-kpi-bku',
    code: '06',
    email: 'bku@itpln.ac.id',
    password: 'password',
    name: 'Biro Keuangan (BKU)',
    shortName: 'BKU',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja BKU',
    badge: 'UNIT: BKU',
    allowedPortals: ['kpi'],
    picCodes: ['BKU'],
    unit: 'Biro Keuangan (BKU)',
    avatar: 'BKU',
    description: 'PIC Utama indikator kesehatan arus kas dari aktivitas operasi.'
  },
  {
    id: 'user-kpi-pjm',
    code: '07',
    email: 'pjm@itpln.ac.id',
    password: 'password',
    name: 'Pusat Jaminan Mutu (PJM)',
    shortName: 'PJM',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja PJM',
    badge: 'UNIT: PJM',
    allowedPortals: ['kpi'],
    picCodes: ['PJM'],
    unit: 'Pusat Jaminan Mutu (PJM)',
    avatar: 'PJM',
    description: 'PIC Utama indikator tata kelola SOP, kepuasan pengajaran (EDOM), dan kepuasan layanan kampus.'
  },
  {
    id: 'user-kpi-prp',
    code: '08',
    email: 'prp.unit@itpln.ac.id',
    password: 'password',
    name: 'Unit Pelaporan Manajemen PRP',
    shortName: 'Pelaporan PRP',
    role: 'kpi_only',
    roleTitle: 'Unit Pelaporan PRP',
    badge: 'UNIT: PRP',
    allowedPortals: ['kpi'],
    picCodes: ['PRP'],
    unit: 'Unit Pelaporan Manajemen (PRP)',
    avatar: 'UPR',
    description: 'PIC Utama indikator ketepatan waktu pelaporan manajemen semesteran.'
  },
  {
    id: 'user-kpi-bpka',
    code: '09',
    email: 'bpka@itpln.ac.id',
    password: 'password',
    name: 'Biro Pengembangan Karir & Alumni (BPKA)',
    shortName: 'BPKA',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja BPKA',
    badge: 'UNIT: BPKA',
    allowedPortals: ['kpi'],
    picCodes: ['BPKA'],
    unit: 'Biro Pengembangan Karir & Alumni (BPKA)',
    avatar: 'BPK',
    description: 'PIC Utama indikator Tracer Study dan penerimaan lulusan melalui program kerjasama offtaker.'
  },
  {
    id: 'user-kpi-bkk',
    code: '10',
    email: 'bkk@itpln.ac.id',
    password: 'password',
    name: 'Biro Kemahasiswaan & Konseling (BKK)',
    shortName: 'BKK',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja BKK',
    badge: 'UNIT: BKK',
    allowedPortals: ['kpi'],
    picCodes: ['BKK'],
    unit: 'Biro Kemahasiswaan & Konseling (BKK)',
    avatar: 'BKK',
    description: 'PIC Utama indikator mahasiswa berprestasi tingkat nasional dan internasional.'
  },
  {
    id: 'user-kpi-bkai',
    code: '11',
    email: 'bkai@itpln.ac.id',
    password: 'password',
    name: 'Biro Kerja Sama Akademik Internasional (BKAI)',
    shortName: 'BKAI',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja BKAI',
    badge: 'UNIT: BKAI',
    allowedPortals: ['kpi'],
    picCodes: ['BKAI'],
    unit: 'Biro Kerja Sama Akademik Internasional (BKAI)',
    avatar: 'BKI',
    description: 'PIC Utama indikator kerjasama program internasional dengan perguruan tinggi luar negeri.'
  },
  {
    id: 'user-kpi-bpik',
    code: '12',
    email: 'bpik@itpln.ac.id',
    password: 'password',
    name: 'Biro Pemasaran, Informasi & Komunikasi (BPIK)',
    shortName: 'BPIK',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja BPIK',
    badge: 'UNIT: BPIK',
    allowedPortals: ['kpi'],
    picCodes: ['BPIK'],
    unit: 'Biro Pemasaran, Informasi & Komunikasi (BPIK)',
    avatar: 'BPK',
    description: 'PIC Utama efektivitas penjaringan calon mahasiswa baru dari sekolah unggulan dan seleksi industri/pemda.'
  },
  {
    id: 'user-kpi-fak',
    code: '13',
    email: 'fak@itpln.ac.id',
    password: 'password',
    name: 'Fakultas & Program Studi (FAK)',
    shortName: 'Fakultas',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja Fakultas (FAK)',
    badge: 'UNIT: FAK',
    allowedPortals: ['kpi'],
    picCodes: ['FAK'],
    unit: 'Fakultas & Program Studi (FAK)',
    avatar: 'FAK',
    description: 'PIC Utama indikator penerapan kurikulum OBE dan peningkatan akreditasi program studi.'
  },
  {
    id: 'user-kpi-lppm',
    code: '14',
    email: 'lppm@itpln.ac.id',
    password: 'password',
    name: 'Lembaga Penelitian & Pengabdian kepada Masyarakat (LPPM)',
    shortName: 'LPPM',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja LPPM',
    badge: 'UNIT: LPPM',
    allowedPortals: ['kpi'],
    picCodes: ['LPPM'],
    unit: 'Lembaga Penelitian & Pengabdian kepada Masyarakat (LPPM)',
    avatar: 'LPM',
    description: 'PIC Utama indikator penelitian, publikasi ilmiah, sitasi, PKM, HKI, dan kapasitas reviewer dosen.'
  },
  {
    id: 'user-kpi-sdm',
    code: '15',
    email: 'sdm@itpln.ac.id',
    password: 'password',
    name: 'Biro Sumber Daya Manusia (SDM)',
    shortName: 'SDM',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja SDM',
    badge: 'UNIT: SDM',
    allowedPortals: ['kpi'],
    picCodes: ['SDM'],
    unit: 'Biro Sumber Daya Manusia (SDM)',
    avatar: 'SDM',
    description: 'PIC Utama indikator peningkatan kualitas jabatan fungsional dosen.'
  },
  {
    id: 'user-kpi-bkan',
    code: '16',
    email: 'bkan@itpln.ac.id',
    password: 'password',
    name: 'Biro Kerja Sama Akademik Nasional (BKAN)',
    shortName: 'BKAN',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja BKAN',
    badge: 'UNIT: BKAN',
    allowedPortals: ['kpi'],
    picCodes: ['BKAN'],
    unit: 'Biro Kerja Sama Akademik Nasional (BKAN)',
    avatar: 'BKN',
    description: 'PIC Utama indikator kerjasama akademik nasional dengan industri dan perguruan tinggi.'
  },
  {
    id: 'user-kpi-bpti',
    code: '17',
    email: 'bpti@itpln.ac.id',
    password: 'password',
    name: 'Biro Pengembangan Teknologi Informasi (BPTI)',
    shortName: 'BPTI',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja BPTI',
    badge: 'UNIT: BPTI',
    allowedPortals: ['kpi'],
    picCodes: ['BPTI'],
    unit: 'Biro Pengembangan Teknologi Informasi (BPTI)',
    avatar: 'BTI',
    description: 'PIC Utama indikator integrasi sistem informasi akademik dan keuangan (Siakad & SimKug).'
  },
  {
    id: 'user-kpi-wbs',
    code: '18',
    email: 'wbs@itpln.ac.id',
    password: 'password',
    name: 'Unit Kepatuhan & Tindak Lanjut Audit (WBS)',
    shortName: 'WBS',
    role: 'kpi_only',
    roleTitle: 'Unit Kerja WBS',
    badge: 'UNIT: WBS',
    allowedPortals: ['kpi'],
    picCodes: ['WBS'],
    unit: 'Unit Kepatuhan & Tindak Lanjut Audit (WBS)',
    avatar: 'WBS',
    description: 'PIC Utama indikator tindak lanjut rekomendasi audit dan temuan pada Perspektif Kepatuhan.'
  },
  {
    id: 'user-kpi-spi',
    code: '19',
    email: 'spi@itpln.ac.id',
    password: 'password',
    name: 'Satuan Pengawasan Internal (SPI)',
    shortName: 'SPI',
    role: 'spi',
    roleTitle: 'Verifikasi SPI (Auditor View-Only)',
    badge: 'VERIFIKASI SPI',
    allowedPortals: ['kpi', 'iku'],
    picCodes: [],
    unit: 'Satuan Pengawasan Internal (SPI)',
    avatar: 'SPI',
    description: 'Akses pemeriksaan komprehensif seluruh data KPI, IKU, dan berkas bukti dukung secara ketat Hanya Lihat (Read-Only) beserta unduh laporan ekspor.'
  }
];


export const getStoredUsers = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('prp_users') || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

export const portalsForRole = (role) =>
  role === 'superadmin_prp' || role === 'dual' || role === 'spi'
    ? ['iku', 'kpi']
    : role === 'iku_only'
      ? ['iku']
      : role === 'kpi_only'
        ? ['kpi']
        : [];

export const readMergedUsers = () => {
  const merged = new Map(MOCK_ACCOUNTS.map((user) => [user.email.toLowerCase(), { ...user, status: 'Aktif' }]));
  getStoredUsers().forEach((user) => {
    if (typeof user.email !== 'string') return;
    const email = user.email.toLowerCase();
    const base = merged.get(email);
    const picCodes = Array.isArray(user.picCodes)
      ? user.picCodes
      : (Array.isArray(base?.picCodes) ? base.picCodes : []);
    merged.set(email, { ...base, ...user, email, picCodes });
  });
  return [...merged.values()].map((user) => ({
    ...user,
    picCodes: Array.isArray(user.picCodes) ? user.picCodes : [],
    allowedPortals: portalsForRole(user.role),
  }));
};
