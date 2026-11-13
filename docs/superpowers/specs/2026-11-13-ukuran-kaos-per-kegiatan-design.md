# Gambar Ukuran Kaos per Kegiatan

Tanggal: 2026-11-13
Status: menunggu persetujuan

## Tujuan

Admin dapat mengunggah gambar panduan ukuran kaos pada tiap kegiatan. Gambar
tampil ke pendaftar saat mengisi data race pack, supaya peserta memilih ukuran
kaos yang benar.

## Ruang lingkup

Termasuk:

- Unggah, pratinjau, dan hapus gambar ukuran kaos di form kegiatan admin.
- Penyimpanan gambar per kegiatan di Google Drive.
- Tampilan gambar di halaman pendaftaran publik untuk kegiatan dengan race pack aktif.

Tidak termasuk:

- Kolom ukuran kaos otomatis. Peserta tetap memakai kolom race pack yang
  dikonfigurasi di Pengaturan (mis. kolom `ukuran_kaos`).
- Gambar global di halaman Pengaturan.

## Pendekatan

Dua cara: setting global, atau kolom baru di sheet `Events`. Dipilih kolom per
kegiatan karena kebutuhan menyebut ukuran kaos berbeda tiap kegiatan, dan
form kegiatan sudah menangani unggahan gambar lain (poster, background).

Desain:

1. `SCHEMA.Events` mendapat dua kolom di akhir: `ukuran_kaos_url` dan
   `ukuran_kaos_file_id`. Ditambahkan di akhir agar sheet lama tidak bergeser.
2. `eventSave_` menerima `ukuran_kaos` (b64 + mime) dan `ukuran_kaos_hapus`.
   File disimpan di folder Drive `Tiket - Kaos` (setting `folder_kaos_id`,
   dibuat saat unggah pertama). URL memakai
   `https://drive.google.com/thumbnail?id=<id>&sz=w1200`.
3. Gambar tidak dikompres, sama seperti QRIS, agar angka ukuran tetap tajam.
   Batas 5 MB, format JPG/PNG, memakai `readFileRaw` yang sudah ada.
4. `pubEventObj_` mengirim `ukuran_kaos_url` hanya bila race pack aktif.
   `viewEvent` menampilkannya di section Data peserta di atas daftar peserta.
5. `eventDelete_` ikut menghapus file gambar dari Drive.
6. Mock dev (`dev_mock.js`) menyimpan dan mengembalikan `ukuran_kaos_url` agar
   E2E lokal berjalan tanpa Apps Script.

## Verifikasi

- E2E: unggah gambar di form kegiatan, pratinjau muncul, gambar tampil di
  halaman publik, hapus gambar menghilangkan tampilan.
- Semua tes E2E lulus.
- Deploy `npm run push:gas`, cek `/exec` memuat blok ukuran kaos.
