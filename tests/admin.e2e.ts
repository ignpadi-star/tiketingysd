import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Catatan: tes ini berjalan pada dev_server.py + dev_mock.js (data uji lokal).
// Tidak ada permintaan ke backend Apps Script atau spreadsheet produksi.

type Sesi = { nama: string; role: string; username: string };

async function masukSebagai(browser: any, user: Sesi) {
  await browser.addInitScript((u: Sesi) => {
    try {
      sessionStorage.setItem('tk', 'dev-token');
      sessionStorage.setItem('us', JSON.stringify(u));
    } catch (e) { /* abaikan */ }
  }, user);
}

const ADMIN: Sesi = { nama: 'Super Admin', role: 'SUPER_ADMIN', username: 'admin109' };
const STAF: Sesi = { nama: 'Staf Satu', role: 'STAF', username: 'staf1' };

function menu(screen: any) {
  return screen.getByRole('navigation', 'Menu admin');
}

describe('admin', { tags: ['admin'] }, () => {
  test('login: validasi kosong, masuk, lalu keluar', async ({ app, screen }) => {
    await app.open('/Admin.html');
    await expect(screen.getByRole('heading', 'Login Staf')).toBeVisible();

    await screen.getByRole('button', 'Masuk').tap();
    await expect(screen.getByText('Isi username dan password.')).toBeVisible();

    await screen.getByLabel('Username').fill('admin109');
    await screen.getByLabel('Password').fill('uji-lokal-123');
    await screen.getByRole('button', 'Masuk').tap();

    await expect(screen.getByRole('heading', 'Dashboard')).toBeVisible();
    await expect(screen.getByRole('button', 'Keluar')).toBeVisible();

    await screen.getByRole('button', 'Keluar').tap();
    await expect(screen.getByRole('heading', 'Login Staf')).toBeVisible();
  });

  test('navigasi seluruh menu admin', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await expect(screen.getByRole('heading', 'Dashboard')).toBeVisible();

    const tujuan: Array<[string, string]> = [
      ['Kegiatan', 'Kegiatan'],
      ['Verifikasi', 'Verifikasi Pembayaran'],
      ['Pesanan', 'Semua Pesanan'],
      ['Gate', 'Pilih Kegiatan'],
      ['Scan Log', 'Scan Log'],
      ['Pengguna', 'Pengguna'],
      ['Pengaturan', 'Pengaturan'],
      ['Race Pack', 'Race Pack'],
      ['Dashboard', 'Dashboard'],
    ];

    for (const [tombol, judul] of tujuan) {
      await menu(screen).getByRole('button', tombol).tap();
      await expect(screen.getByRole('heading', judul)).toBeVisible();
    }
  });

  test('pesanan: pencarian dan filter status', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await menu(screen).getByRole('button', 'Pesanan').tap();

    await expect(screen.getByText('7 pesanan')).toBeVisible();

    await screen.getByLabel('Pencarian').fill('Budi');
    await screen.getByRole('button', 'Cari').tap();
    await expect(screen.getByText('1 pesanan')).toBeVisible();
    await expect(screen.getByText('TKT-DEMO-1')).toBeVisible();

    await screen.getByLabel('Status').selectOption('Diterima');
    await expect(screen.getByText('1 pesanan')).toBeVisible();

    await screen.getByLabel('Pencarian').fill('Siti');
    await screen.getByRole('button', 'Cari').tap();
    await expect(screen.getByText('0 pesanan')).toBeVisible();
    await expect(screen.getByText('Pesanan tidak ditemukan.')).toBeVisible();
  });

  test('race pack: cari, filter, serahkan, ubah, hapus', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await menu(screen).getByRole('button', 'Race Pack').tap();

    await expect(screen.getByRole('row')).toHaveCount(4);

    await screen.getByLabel('Pencarian').fill('siti');
    await expect(screen.getByRole('row')).toHaveCount(3);

    await screen.getByLabel('Pencarian').fill('');
    await screen.getByLabel('Status').selectOption('Sudah diambil');
    await expect(screen.getByRole('row')).toHaveCount(2);

    await screen.getByLabel('Status').selectOption('Semua status');
    await screen.getByLabel('Pencarian').fill('siti');
    await expect(screen.getByRole('row')).toHaveCount(3);

    await screen.getByRole('button', 'Serahkan').first().tap();
    const dialogSerah = screen.getByRole('dialog', 'Serahkan Race Pack');
    await expect(dialogSerah).toBeVisible();
    await dialogSerah.getByLabel('Status').selectOption('Sudah diambil');
    await dialogSerah.getByRole('button', 'Serahkan').tap();

    await expect(screen.getByRole('dialog')).toHaveCount(0);
    await expect(screen.getByText('Race pack tersimpan (mock).')).toBeVisible();
    await expect(screen.getByRole('button', 'Edit')).toHaveCount(1);

    await screen.getByRole('row').filter({ hasText: 'TIX-DEMO-2' }).getByRole('button', 'Edit').tap();
    const dialogEdit = screen.getByRole('dialog', 'Edit Race Pack');
    await dialogEdit.getByLabel('Nama Penerima').fill('Siti Aminah Uji');
    await dialogEdit.getByRole('button', 'Simpan').tap();

    await expect(screen.getByText('Race pack diperbarui (mock).')).toBeVisible();
    await expect(screen.getByText('Siti Aminah Uji')).toBeVisible();

    await screen.getByRole('row').filter({ hasText: 'Siti Aminah Uji' }).getByRole('button', 'Hapus').tap();
    const dialogHapus = screen.getByRole('dialog');
    await expect(dialogHapus).toBeVisible();
    await dialogHapus.getByRole('button', 'Hapus').tap();

    await expect(screen.getByText('Race pack dihapus (mock).')).toBeVisible();
    await expect(screen.getByRole('button', 'Edit')).toHaveCount(0);
  });

  test('pengguna: tambah dengan password manual, ubah role, nonaktifkan', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await menu(screen).getByRole('button', 'Pengguna').tap();

    await screen.getByRole('button', '+ Tambah Pengguna').tap();
    const dialogTambah = screen.getByRole('dialog', 'Tambah Pengguna');
    await dialogTambah.getByLabel('Nama').fill('Petugas Uji');
    await dialogTambah.getByLabel('Username').fill('petugas.uji');
    await dialogTambah.getByLabel('Password awal (opsional)').fill('Rahasia123');
    await dialogTambah.getByRole('button', 'Simpan').tap();

    const dialogAkun = screen.getByRole('dialog', 'Akun dibuat');
    await expect(dialogAkun).toBeVisible();
    await expect(dialogAkun.getByText('petugas.uji')).toBeVisible();
    await expect(dialogAkun.getByText('Rahasia123')).toBeVisible();
    await dialogAkun.getByRole('button', 'Tutup').last().tap();

    const baris = screen.getByRole('row').filter({ hasText: 'Petugas Uji' });
    await expect(baris).toBeVisible();

    await baris.getByRole('button', 'Ubah').tap();
    const dialogUbah = screen.getByRole('dialog', 'Ubah Pengguna');
    await dialogUbah.getByLabel('Role').selectOption('Gate (cek tiket)');
    await dialogUbah.getByRole('button', 'Simpan').tap();
    await expect(screen.getByText('Pengguna tersimpan.')).toBeVisible();
    await expect(baris.getByText('GATE')).toBeVisible();

    await baris.getByRole('button', 'Nonaktifkan').tap();
    await expect(screen.getByText('Status diperbarui.')).toBeVisible();
    await expect(baris.getByText('NONAKTIF')).toBeVisible();
  });

  test('kegiatan: validasi, tambah, ubah dan hapus jenis tiket, hapus kegiatan', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await menu(screen).getByRole('button', 'Kegiatan').tap();
    await screen.getByRole('button', '+ Kegiatan Baru').tap();
    await expect(screen.getByRole('heading', 'Kegiatan Baru')).toBeVisible();

    await screen.getByRole('button', 'Simpan Kegiatan').tap();
    await expect(screen.getByText('Nama kegiatan minimal 3 karakter.')).toBeVisible();

    await screen.getByLabel('Nama kegiatan').fill('Kegiatan Uji');
    await screen.getByLabel('Jenis').fill('Seminar');
    await screen.getByLabel('Tanggal').fill('2026-12-01');
    await screen.getByLabel('Jam').fill('10:00');
    await screen.getByLabel('Lokasi').fill('Bandung');
    await screen.getByRole('button', 'Simpan Kegiatan').tap();

    await expect(screen.getByRole('heading', 'Kelola Kegiatan')).toBeVisible();
    await expect(screen.getByText('Kegiatan tersimpan.')).toBeVisible();
    await expect(screen.getByLabel('Nama kegiatan')).toHaveValue('Kegiatan Uji');

    await screen.getByRole('button', '+ Tambah').tap();
    const dialogTambah = screen.getByRole('dialog', 'Tambah Jenis Tiket');
    await dialogTambah.getByLabel('Nama tiket').fill('Reguler Uji');
    await dialogTambah.getByLabel('Harga (Rp)').fill('100000');
    await dialogTambah.getByLabel('Kuota (tiket)').fill('50');
    await dialogTambah.getByRole('button', 'Simpan').tap();

    await expect(screen.getByText('Jenis tiket tersimpan.')).toBeVisible();
    const barisTiket = screen.getByRole('row').filter({ hasText: 'Reguler Uji' });
    await expect(barisTiket).toBeVisible();

    await barisTiket.getByRole('button', 'Ubah').tap();
    const dialogUbah = screen.getByRole('dialog', 'Ubah Jenis Tiket');
    await dialogUbah.getByLabel('Nama tiket').fill('Reguler Ubah');
    await dialogUbah.getByRole('button', 'Simpan').tap();
    await expect(screen.getByText('Reguler Ubah')).toBeVisible();

    await screen.getByRole('row').filter({ hasText: 'Reguler Ubah' }).getByRole('button', 'Hapus').tap();
    await screen.getByRole('dialog').getByRole('button', 'Hapus').tap();
    await expect(screen.getByText('Dihapus.')).toBeVisible();
    await expect(screen.getByText('Belum ada jenis tiket. Klik "+ Tambah".')).toBeVisible();

    await screen.getByRole('button', 'Hapus').tap();
    await screen.getByRole('dialog').getByRole('button', 'Hapus').tap();
    await expect(screen.getByRole('heading', 'Kegiatan')).toBeVisible();
    await expect(screen.getByText('Kegiatan Uji')).toHaveCount(0);
  });

  test('pengaturan: simpan dan terbaca kembali', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await menu(screen).getByRole('button', 'Pengaturan').tap();

    await screen.getByLabel('Nama organisasi').fill('Organisasi Uji');
    await screen.getByRole('button', 'Simpan Pengaturan').tap();
    await expect(screen.getByText(/Pengaturan tersimpan/)).toBeVisible();

    await menu(screen).getByRole('button', 'Dashboard').tap();
    await menu(screen).getByRole('button', 'Pengaturan').tap();
    await expect(screen.getByLabel('Nama organisasi')).toHaveValue('Organisasi Uji');
  });

  test('dashboard: preview daftar hadir terverifikasi dan pilih kolom', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');

    await screen.getByRole('button', 'Cetak Daftar Hadir').tap();
    const dialog = screen.getByRole('dialog', 'Daftar Hadir Terverifikasi');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Budi Santoso')).toBeVisible();
    await expect(dialog.getByText('Rina Kartika')).toBeVisible();
    await expect(dialog.getByText('Siti Aminah')).toHaveCount(0);
    await expect(dialog.getByRole('columnheader', 'Email')).toBeVisible();

    await dialog.getByRole('checkbox', 'Email').uncheck();
    await expect(dialog.getByRole('columnheader', 'Email')).toHaveCount(0);
    await expect(dialog.getByRole('columnheader', 'Nama Pemegang')).toBeVisible();

    await dialog.getByRole('button', 'Tutup').last().tap();
    await expect(screen.getByRole('dialog')).toHaveCount(0);
  });

  test('pesanan diterima: tersedia unduhan tiket PDF', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await menu(screen).getByRole('button', 'Pesanan').tap();

    await screen.getByLabel('Pencarian').fill('Budi');
    await screen.getByRole('button', 'Cari').tap();
    await screen.getByRole('button', 'Unduh Tiket').first().tap();

    const dialog = screen.getByRole('dialog', 'Tiket TKT-DEMO-1');
    await expect(dialog.getByRole('button', 'Unduh Tiket (PDF)')).toBeVisible();
    await expect(dialog.getByRole('button', 'Unduh QR').first()).toBeVisible();
  });

  test('pengaturan: unggah lagu dan atur looping', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await menu(screen).getByRole('button', 'Pengaturan').tap();

    await expect(screen.getByRole('heading', 'Lagu Landing Page')).toBeVisible();
    await expect(screen.getByText('Belum ada lagu landing page.')).toBeVisible();

    await screen.getByLabel('Ulangi lagu (looping)').selectOption('Ya (ulang terus)');
    await screen.getByLabel('Atau unggah file lagu').setInputFiles('tests/fixtures/lagu-uji.mp3');
    await screen.getByRole('button', 'Unggah Lagu').tap();

    await expect(screen.getByText('Lagu landing page tersimpan.')).toBeVisible();
    await expect(screen.getByText(/Lagu aktif: lagu-uji.mp3/)).toBeVisible();
  });

  test('pengaturan: simpan URL lagu dari GitHub', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await menu(screen).getByRole('button', 'Pengaturan').tap();

    await screen.getByLabel('URL lagu (GitHub / raw)').fill('https://raw.githubusercontent.com/contoh/repo/main/lagu-uji.mp3');
    await screen.getByRole('button', 'Simpan URL Lagu').tap();

    await expect(screen.getByText('URL lagu tersimpan.')).toBeVisible();
    await expect(screen.getByText(/Lagu aktif: lagu-uji.mp3/)).toBeVisible();
  });

  test('pengaturan: unggah dan hapus gambar QRIS', async ({ app, screen, browser }) => {
    await masukSebagai(browser, ADMIN);
    await app.open('/Admin.html');
    await menu(screen).getByRole('button', 'Pengaturan').tap();

    await expect(screen.getByRole('heading', 'QRIS Pembayaran')).toBeVisible();
    await expect(screen.getByText('Belum ada gambar QRIS.')).toBeVisible();

    await screen.getByLabel('Unggah gambar QRIS').setInputFiles('tests/fixtures/qris-uji.png');
    await screen.getByRole('button', 'Unggah Gambar QRIS').tap();

    await expect(screen.getByText('Gambar QRIS tersimpan.')).toBeVisible();
    await expect(screen.getByText('Gambar QRIS aktif.')).toBeVisible();
  });

  test('staf: menu terbatas dan aksi verifikasi tersembunyi', async ({ app, screen, browser }) => {
    await masukSebagai(browser, STAF);
    await app.open('/Admin.html');

    await expect(screen.getByRole('heading', 'Race Pack')).toBeVisible();
    await expect(menu(screen).getByRole('button')).toHaveCount(2);
    await expect(menu(screen).getByRole('button', 'Race Pack')).toBeVisible();
    await expect(menu(screen).getByRole('button', 'Pesanan')).toBeVisible();
    await expect(menu(screen).getByRole('button', 'Pengguna')).toHaveCount(0);

    await expect(screen.getByRole('button', 'Muat Ulang').first()).toBeVisible();
    await expect(screen.getByRole('button', 'Hapus')).toHaveCount(0);
    await expect(screen.getByRole('button', 'Aktifkan/Matikan Data Race Pack')).toHaveCount(0);

    await menu(screen).getByRole('button', 'Pesanan').tap();
    await expect(screen.getByRole('heading', 'Cari Pesanan')).toBeVisible();
    await expect(screen.getByRole('button', 'ACC')).toHaveCount(0);
    await expect(screen.getByRole('button', 'TOLAK')).toHaveCount(0);
    await expect(screen.getByRole('button', 'Unduh Tiket').first()).toBeVisible();
  });
});
