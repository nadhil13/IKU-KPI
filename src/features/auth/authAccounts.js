// Akun resmi dan utilitas resolusi otoritas portal PERFORMA ITPLN
export const MOCK_ACCOUNTS = [
  {
    id: 'user-iku',
    code: '01',
    email: 'iku@itpln.ac.id',
    password: 'password',
    name: 'Biro Kemahasiswaan & Akademik',
    shortName: 'PIC IKU',
    role: 'iku_only',
    roleTitle: 'Otoritas Khusus IKU',
    badge: 'IKU ONLY',
    allowedPortals: ['iku'],
    picCodes: [],
    unit: 'Biro Akademik & Kemahasiswaan ITPLN',
    avatar: 'IKU',
    description: 'Akses khusus untuk pengelolaan dan pemantauan 8 IKU Kementerian.'
  },
  {
    id: 'user-kpi',
    code: '02',
    email: 'kpi@itpln.ac.id',
    password: 'password',
    name: 'Biro Akuntansi & Biro Anggaran (BAKT / BAG)',
    shortName: 'PIC BAKT/BAG',
    role: 'kpi_only',
    roleTitle: 'Otoritas Unit KPI (BAKT & BAG)',
    badge: 'PIC: BAKT, BAG',
    allowedPortals: ['kpi'],
    picCodes: ['BAKT', 'BAG'],
    unit: 'Biro Akuntansi & Anggaran (BAKT, BAG)',
    avatar: 'BKG',
    description: 'Mengisi indikator KPI yang ditugaskan ke BAKT/BAG dengan privasi data terisolasi per unit.'
  },
  {
    id: 'user-dual',
    code: '03',
    email: 'admin@itpln.ac.id',
    password: 'password',
    name: 'Administrator Terpadu ITPLN',
    shortName: 'Integrator',
    role: 'superadmin_prp',
    roleTitle: 'Superadmin PRP',
    badge: 'SUPERADMIN PRP',
    allowedPortals: ['iku', 'kpi'],
    picCodes: ['PRP'],
    unit: 'Direktorat Perencanaan & Pengembangan (PRP)',
    avatar: 'ADM',
    description: 'Mengelola platform, submission, konfigurasi tabel, rumus, validasi bukti, periode, dan audit trail terpusat.'
  },
  {
    id: 'user-kpi-bakt',
    code: '04',
    email: 'bakt@itpln.ac.id',
    password: 'password',
    name: 'Biro Akuntansi ITPLN',
    shortName: 'PIC BAKT',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BAKT',
    badge: 'PIC: BAKT',
    allowedPortals: ['kpi'],
    picCodes: ['BAKT'],
    unit: 'Biro Akuntansi (BAKT)',
    avatar: 'BAK',
    description: 'Hak pengisian khusus indikator KPI dengan PIC BAKT (1b, 2, 3, 4 Bagian A & 2 Bagian D).'
  },
  {
    id: 'user-kpi-bag',
    code: '05',
    email: 'bag@itpln.ac.id',
    password: 'password',
    name: 'Biro Anggaran ITPLN',
    shortName: 'PIC BAG',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BAG',
    badge: 'PIC: BAG',
    allowedPortals: ['kpi'],
    picCodes: ['BAG'],
    unit: 'Biro Anggaran (BAG)',
    avatar: 'BAG',
    description: 'Hak pengisian khusus indikator KPI dengan PIC BAG (1b, 2, 3, 4 Bagian A & 1 Bagian D).'
  },
  {
    id: 'user-kpi-ppa',
    code: '06',
    email: 'ppa@itpln.ac.id',
    password: 'password',
    name: 'Pusat Pelayanan Akademik ITPLN',
    shortName: 'PIC PPA',
    role: 'kpi_only',
    roleTitle: 'PIC Unit PPA',
    badge: 'PIC: PPA',
    allowedPortals: ['kpi'],
    picCodes: ['PPA'],
    unit: 'Pusat Pelayanan Akademik (PPA)',
    avatar: 'PPA',
    description: 'Hak pengisian khusus indikator KPI dengan PIC PPA (1a Bagian A).'
  },
  {
    id: 'user-kpi-bku',
    code: '07',
    email: 'bku@itpln.ac.id',
    password: 'password',
    name: 'Biro Keuangan ITPLN',
    shortName: 'PIC BKU',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKU',
    badge: 'PIC: BKU',
    allowedPortals: ['kpi'],
    picCodes: ['BKU'],
    unit: 'Biro Keuangan (BKU)',
    avatar: 'BKU',
    description: 'Hak pengisian khusus indikator KPI dengan PIC BKU (5 Bagian A).'
  },
  {
    id: 'user-kpi-pjm',
    code: '08',
    email: 'pjm@itpln.ac.id',
    password: 'password',
    name: 'Pusat Jaminan Mutu ITPLN',
    shortName: 'PIC PJM',
    role: 'kpi_only',
    roleTitle: 'PIC Unit PJM',
    badge: 'PIC: PJM',
    allowedPortals: ['kpi'],
    picCodes: ['PJM'],
    unit: 'Pusat Jaminan Mutu (PJM)',
    avatar: 'PJM',
    description: 'Hak pengisian khusus indikator KPI dengan PIC PJM (tata kelola, EDOM, layanan kampus, OBE, akreditasi, tindak lanjut audit).'
  },
  {
    id: 'user-kpi-prp',
    code: '09',
    email: 'prp.unit@itpln.ac.id',
    password: 'password',
    name: 'Unit Pelaksana Pelaporan PRP',
    shortName: 'PIC PRP',
    role: 'kpi_only',
    roleTitle: 'PIC Unit PRP',
    badge: 'PIC: PRP',
    allowedPortals: ['kpi'],
    picCodes: ['PRP'],
    unit: 'Direktorat Perencanaan & Pengembangan (PRP)',
    avatar: 'PRP',
    description: 'Hak pengisian khusus indikator KPI dengan PIC PRP (tata kelola, EDOM, layanan kampus, pelaporan manajemen).'
  },
  {
    id: 'user-kpi-bpka',
    code: '10',
    email: 'bpka@itpln.ac.id',
    password: 'password',
    name: 'Biro Pengembangan Karir & Alumni',
    shortName: 'PIC BPKA',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BPKA',
    badge: 'PIC: BPKA',
    allowedPortals: ['kpi'],
    picCodes: ['BPKA'],
    unit: 'Biro Pengembangan Karir & Alumni (BPKA)',
    avatar: 'BPK',
    description: 'Hak pengisian khusus indikator KPI Tracer Study dan Penerimaan Lulusan Offtaker.'
  },
  {
    id: 'user-kpi-bkk',
    code: '11',
    email: 'bkk@itpln.ac.id',
    password: 'password',
    name: 'Biro Kemahasiswaan & Konseling',
    shortName: 'PIC BKK',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKK',
    badge: 'PIC: BKK',
    allowedPortals: ['kpi'],
    picCodes: ['BKK'],
    unit: 'Biro Kemahasiswaan & Konseling (BKK)',
    avatar: 'BKK',
    description: 'Hak pengisian khusus indikator KPI Mahasiswa Berprestasi.'
  },
  {
    id: 'user-kpi-bkai',
    code: '12',
    email: 'bkai@itpln.ac.id',
    password: 'password',
    name: 'Biro Kerja Sama Akademik Internasional',
    shortName: 'PIC BKAI',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKAI',
    badge: 'PIC: BKAI',
    allowedPortals: ['kpi'],
    picCodes: ['BKAI'],
    unit: 'Biro Kerja Sama Akademik Internasional (BKAI)',
    avatar: 'BKI',
    description: 'Hak pengisian khusus indikator KPI Kerja Sama Internasional.'
  },
  {
    id: 'user-kpi-bpik',
    code: '13',
    email: 'bpik@itpln.ac.id',
    password: 'password',
    name: 'Tim Penjaringan Mahasiswa Baru (BPIK, BKM, BSAR, BPAD)',
    shortName: 'PIC Admisi',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BPIK/BKM/BSAR/BPAD',
    badge: 'PIC: BPIK, BKM, BSAR, BPAD',
    allowedPortals: ['kpi'],
    picCodes: ['BPIK', 'BKM', 'BSAR', 'BPAD'],
    unit: 'Biro Pemasaran, Kemahasiswaan, Sarpras & Aset (BPIK, BKM, BSAR, BPAD)',
    avatar: 'PMB',
    description: 'Hak pengisian khusus indikator KPI Efektivitas Penjaringan Calon Mahasiswa Baru.'
  },
  {
    id: 'user-kpi-fak',
    code: '14',
    email: 'fak@itpln.ac.id',
    password: 'password',
    name: 'Fakultas & Program Studi ITPLN',
    shortName: 'PIC FAK',
    role: 'kpi_only',
    roleTitle: 'PIC Fakultas (FAK)',
    badge: 'PIC: FAK',
    allowedPortals: ['kpi'],
    picCodes: ['FAK'],
    unit: 'Fakultas & Program Studi (FAK)',
    avatar: 'FAK',
    description: 'Hak pengisian khusus indikator KPI Kurikulum OBE, Klasterisasi Mandiri, dan Akreditasi Program.'
  },
  {
    id: 'user-kpi-lppm',
    code: '15',
    email: 'lppm@itpln.ac.id',
    password: 'password',
    name: 'Lembaga Penelitian & Pengabdian kepada Masyarakat',
    shortName: 'PIC LPPM',
    role: 'kpi_only',
    roleTitle: 'PIC Unit LPPM',
    badge: 'PIC: LPPM',
    allowedPortals: ['kpi'],
    picCodes: ['LPPM'],
    unit: 'Lembaga Penelitian & Pengabdian kepada Masyarakat (LPPM)',
    avatar: 'LPM',
    description: 'Hak pengisian khusus indikator KPI Penelitian, Publikasi Ilmiah, Sitasi, PKM, HKI, dan Kapasitas Dosen.'
  },
  {
    id: 'user-kpi-sdm',
    code: '16',
    email: 'sdm@itpln.ac.id',
    password: 'password',
    name: 'Biro Sumber Daya Manusia (SDM & BSDM)',
    shortName: 'PIC SDM/BSDM',
    role: 'kpi_only',
    roleTitle: 'PIC Unit SDM & BSDM',
    badge: 'PIC: SDM, BSDM',
    allowedPortals: ['kpi'],
    picCodes: ['SDM', 'BSDM'],
    unit: 'Biro Sumber Daya Manusia (SDM, BSDM)',
    avatar: 'SDM',
    description: 'Hak pengisian khusus indikator KPI Peningkatan Kualitas Dosen dan Integrasi Siakad & SimKug.'
  },
  {
    id: 'user-kpi-bkan',
    code: '17',
    email: 'bkan@itpln.ac.id',
    password: 'password',
    name: 'Biro Kerja Sama Akademik Nasional',
    shortName: 'PIC BKAN',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BKAN',
    badge: 'PIC: BKAN',
    allowedPortals: ['kpi'],
    picCodes: ['BKAN'],
    unit: 'Biro Kerja Sama Akademik Nasional (BKAN)',
    avatar: 'BKN',
    description: 'Hak pengisian khusus indikator KPI Kerja Sama Akademik dengan Industri dan Perguruan Tinggi.'
  },
  {
    id: 'user-kpi-bpti',
    code: '18',
    email: 'bpti@itpln.ac.id',
    password: 'password',
    name: 'Biro Pengembangan Teknologi Informasi',
    shortName: 'PIC BPTI',
    role: 'kpi_only',
    roleTitle: 'PIC Unit BPTI',
    badge: 'PIC: BPTI',
    allowedPortals: ['kpi'],
    picCodes: ['BPTI'],
    unit: 'Biro Pengembangan Teknologi Informasi (BPTI)',
    avatar: 'BTI',
    description: 'Hak pengisian khusus indikator KPI Integrasi Siakad & SimKug.'
  },
  {
    id: 'user-kpi-spi',
    code: '19',
    email: 'spi@itpln.ac.id',
    password: 'password',
    name: 'Auditor Satuan Pengawasan Intern (SPI)',
    shortName: 'Auditor SPI',
    role: 'spi',
    roleTitle: 'Auditor SPI (View Only & Audit)',
    badge: 'AUDITOR SPI (VIEW ONLY)',
    allowedPortals: ['kpi'],
    picCodes: ['SPI'],
    unit: 'Satuan Pengawasan Intern (SPI)',
    avatar: 'SPI',
    description: 'Akses khusus audit (Read-Only) satu halaman tabel KPI terisi, buka/unduh bukti capaian semua unit, dan ekspor Excel rekapitulasi penuh.'
  },
  {
    id: 'user-kpi-wbs',
    code: '20',
    email: 'wbs@itpln.ac.id',
    password: 'password',
    name: 'Tim Tindak Lanjut Audit, Akuntansi & WBS',
    shortName: 'PIC Audit/WBS',
    role: 'kpi_only',
    roleTitle: 'PIC Unit SPI, Akuntansi & WBS',
    badge: 'PIC: SPI, Akuntansi, WBS',
    allowedPortals: ['kpi'],
    picCodes: ['SPI', 'Akuntansi', 'WBS'],
    unit: 'Tim Tindak Lanjut Audit & WBS (SPI, Akuntansi, WBS)',
    avatar: 'WBS',
    description: 'Hak pengisian khusus indikator KPI Tindaklanjut Rekomendasi Audit & Temuan (Bagian D.5).'
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
  role === 'superadmin_prp' || role === 'dual'
    ? ['iku', 'kpi']
    : role === 'iku_only'
      ? ['iku']
      : role === 'kpi_only' || role === 'spi'
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
