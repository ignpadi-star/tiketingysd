// Config.js – immutable configuration
const Config = Object.freeze({
  APP_NAME: 'Sistem Tiket Kegiatan',
  TIMEZONE: 'Asia/Jakarta',
  CACHE_TTL_SECONDS: 6 * 60 * 60, // 6 h
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_LOCK_SECONDS: 15 * 60, // 15 min
  SCRIPT_PROP_SPREADSHEET_ID: 'SPREADSHEET_ID',
  SCRIPT_PROP_QR_SECRET: 'QR_SECRET',
  DEFAULT_SUPERADMIN_USERNAME: 'superadmin',
  DEFAULT_SUPERADMIN_PASSWORD: 'Admin#2026',
  DEFAULT_EVENT: {
    nama_event: 'Fun Walk Veritas',
    jenis_event: 'Fun Walk',
    deskripsi: 'Fun Walk Veritas – jalan santai bersama komunitas.',
    lokasi: 'Jakarta',
    tanggal_mulai: '2026-11-01',
    jam_mulai: '07:00',
    tanggal_selesai: '2026-11-01',
    jam_selesai: '12:00',
    maks_tiket_per_pesanan: '5',
    nama_pemegang_per_tiket: 'tidak',
    status: 'DRAFT'
  },
  DEFAULT_CATEGORY: {
    nama_kategori: 'Umum',
    harga: '50000',
    kuota: '500',
    label_badge: '',
    urutan: '1',
    status_aktif: 'true'
  }
});
