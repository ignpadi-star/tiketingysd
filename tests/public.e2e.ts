import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';

// Catatan: tes ini berjalan pada dev_server.py + dev_mock.js (data uji lokal).
// Tidak ada permintaan ke backend Apps Script atau spreadsheet produksi.

describe('publik', { tags: ['public'] }, () => {
  test('navigasi antarhalaman publik', async ({ app, screen }) => {
    await app.open('/Index.html');
    await expect(screen.getByRole('heading', 'Temukan Kegiatan Terbaik')).toBeVisible();
    await expect(screen.getByText('2 kegiatan tersedia')).toBeVisible();

    await screen.getByRole('button', 'Cek Pesanan').tap();
    await expect(screen.getByRole('heading', 'Cek Status Pesanan')).toBeVisible();

    await screen.getByRole('button', 'Kegiatan').tap();
    await expect(screen.getByRole('heading', 'Temukan Kegiatan Terbaik')).toBeVisible();
    await expect(screen.getByRole('button', 'Login staf')).toHaveCount(0);
  });

  test('buka detail kegiatan dan kembali', async ({ app, screen }) => {
    await app.open('/Index.html');
    await screen.getByRole('button', 'Beli Tiket').first().tap();

    await expect(screen.getByRole('heading', 'Konser Demo')).toBeVisible();
    await expect(screen.getByRole('heading', 'Pesan Tiket')).toBeVisible();

    await screen.getByRole('button', '< Semua kegiatan').tap();
    await expect(screen.getByRole('heading', 'Temukan Kegiatan Terbaik')).toBeVisible();
  });

  test('pesan 1 tiket berhasil', async ({ app, screen }) => {
    await app.open('/Index.html');
    await screen.getByRole('button', 'Beli Tiket').first().tap();

    await screen.getByText('VIP').first().tap();
    await screen.getByLabel('Nama pembeli').fill('Pembeli Uji');
    await screen.getByLabel('Email (e-tiket dikirim ke sini)').fill('pembeli.uji@example.com');
    await screen.getByLabel('Nama peserta').fill('Peserta Uji');

    await expect(screen.getByText('Rp250.000')).toHaveCount(2);
    await screen.getByRole('button', 'Pesan Sekarang').tap();

    await expect(screen.getByText('Pesanan berhasil dibuat. Simpan ID pembelian di bawah ini.')).toBeVisible();
    await expect(screen.getByText('TKT-DEMO-NEW')).toBeVisible();
    await expect(screen.getByText('VIP x 1')).toBeVisible();
    await expect(screen.getByText('Rp250.000')).toBeVisible();
  });

  test('QRIS tampil di halaman pembayaran', async ({ app, screen }) => {
    await app.open('/Index.html?qris=/tests/fixtures/qris-uji.png');
    await screen.getByRole('button', 'Beli Tiket').first().tap();

    await screen.getByText('VIP').first().tap();
    await screen.getByLabel('Nama pembeli').fill('Pembeli QRIS');
    await screen.getByLabel('Email (e-tiket dikirim ke sini)').fill('qris.uji@example.com');
    await screen.getByLabel('Nama peserta').fill('Peserta QRIS');
    await screen.getByRole('button', 'Pesan Sekarang').tap();

    await expect(screen.getByText('Petunjuk Pembayaran')).toBeVisible();
    await expect(screen.getByText('Scan QRIS untuk membayar')).toBeVisible();
    await expect(screen.getByRole('img', 'Kode QRIS pembayaran')).toBeVisible();
  });

  test('pesan 3 tiket membuat 3 kartu peserta', async ({ app, screen }) => {    await app.open('/Index.html');
    await screen.getByRole('button', 'Beli Tiket').first().tap();

    await screen.getByText('Reguler', { exact: true }).first().tap();
    await screen.getByLabel('Jumlah tiket').fill('3');

    await expect(screen.getByRole('heading', 'Peserta 1')).toBeVisible();
    await expect(screen.getByRole('heading', 'Peserta 3')).toBeVisible();
    await expect(screen.getByText('Rp450.000')).toBeVisible();

    await screen.getByLabel('Nama pembeli').fill('Pembeli Tiga');
    await screen.getByLabel('Email (e-tiket dikirim ke sini)').fill('pembeli.tiga@example.com');
    const namaPeserta = screen.getByLabel('Nama peserta');
    await expect(namaPeserta).toHaveCount(3);
    await namaPeserta.first().fill('Peserta Satu');
    await namaPeserta.last().fill('Peserta Tiga');

    await screen.getByRole('button', 'Pesan Sekarang').tap();
    await expect(screen.getByText('Reguler x 3')).toBeVisible();
  });

  test('bundling: paket duo berisi 2 tiket', async ({ app, screen }) => {
    await app.open('/Index.html');
    await screen.getByRole('button', 'Beli Tiket').first().tap();

    await screen.getByText('Paket Duo').first().tap();
    await expect(screen.getByLabel('Jumlah paket')).toBeVisible();
    await screen.getByLabel('Jumlah paket').fill('3');
    await expect(screen.getByLabel('Jumlah paket')).toHaveValue('2');
    await expect(screen.getByRole('heading', 'Peserta 4')).toBeVisible();
    await expect(screen.getByText('Rp800.000')).toBeVisible();

    await screen.getByLabel('Nama pembeli').fill('Pembeli Paket');
    await screen.getByLabel('Email (e-tiket dikirim ke sini)').fill('pembeli.paket@example.com');
    await screen.getByRole('button', 'Pesan Sekarang').tap();

    await expect(screen.getByText('Paket Duo x 4')).toBeVisible();
  });

  test('validasi: jenis tiket wajib dipilih', async ({ app, screen }) => {
    await app.open('/Index.html');
    await screen.getByRole('button', 'Beli Tiket').first().tap();

    await screen.getByLabel('Nama pembeli').fill('Tanpa Tiket');
    await screen.getByLabel('Email (e-tiket dikirim ke sini)').fill('tanpa.tiket@example.com');
    await screen.getByRole('button', 'Pesan Sekarang').tap();

    await expect(screen.getByText('Pilih jenis tiket terlebih dahulu.')).toBeVisible();
    await expect(screen.getByRole('heading', 'Pesan Tiket')).toBeVisible();
  });

  test('validasi: format email ditolak', async ({ app, screen }) => {
    await app.open('/Index.html');
    await screen.getByRole('button', 'Beli Tiket').first().tap();

    await screen.getByText('VIP').first().tap();
    await screen.getByLabel('Nama pembeli').fill('Email Salah');
    await screen.getByLabel('Email (e-tiket dikirim ke sini)').fill('bukan-email');
    await screen.getByRole('button', 'Pesan Sekarang').tap();

    await expect(screen.getByText('Format email tidak valid.')).toBeVisible();
  });

  test('validasi: jumlah tiket dibatasi maksimal', async ({ app, screen }) => {
    await app.open('/Index.html');
    await screen.getByRole('button', 'Beli Tiket').first().tap();

    await screen.getByText('VIP').first().tap();
    await screen.getByLabel('Jumlah tiket').fill('99');

    await expect(screen.getByLabel('Jumlah tiket')).toHaveValue('5');
    await expect(screen.getByRole('heading', 'Peserta 5')).toBeVisible();
    await expect(screen.getByText('Rp1.250.000')).toBeVisible();
  });

  test('landing page: musik otomatis tanpa tombol kontrol', async ({ app, screen }) => {
    await app.open('/Index.html?musik=1');
    await expect(screen.getByRole('heading', 'Temukan Kegiatan Terbaik')).toBeVisible();
    await expect(screen.getByRole('button', 'Putar musik')).toHaveCount(0);
    await expect(screen.getByText('Lagu Uji')).toHaveCount(0);
  });

  test('cek status: pesanan ditemukan dan ditolak', async ({ app, screen }) => {
    await app.open('/Index.html');
    await screen.getByRole('button', 'Cek Pesanan').tap();

    await screen.getByLabel('ID Pembelian').fill('TKT-DEMO-1');
    await screen.getByLabel('Email atau No. HP').fill('budi@example.com');
    await screen.getByRole('button', 'Cek Pesanan').last().tap();

    await expect(screen.getByText('DITERIMA')).toBeVisible();
    await expect(screen.getByText(/Pembayaran terverifikasi/)).toBeVisible();

    await screen.getByLabel('ID Pembelian').fill('TKT-SALAH');
    await screen.getByLabel('Email atau No. HP').fill('salah@example.com');
    await screen.getByRole('button', 'Cek Pesanan').last().tap();

    await expect(screen.getByText('Pesanan tidak ditemukan. Periksa ID dan kontak.')).toBeVisible();
  });
});
