# Jenis Kendaraan di Formulir Pesanan

Tanggal: 2026-11-13
Status: menunggu persetujuan

## Tujuan

Panitia dapat meminta pembeli menyebutkan jenis kendaraan yang dipakai. Daftar
jenis kendaraan diisi manual oleh admin di Pengaturan, terpisah dari kolom race
pack. Admin juga menentukan apakah jawaban wajib diisi.

## Ruang lingkup

Termasuk:

- Pengaturan baru: daftar jenis kendaraan (satu pilihan per baris) dan tombol
  wajib/tidak wajib.
- Dropdown "Jenis kendaraan" di bagian Data pembeli pada formulir pesanan publik.
- Penyimpanan jawaban per pesanan dan tampilannya di kartu pesanan admin.
- Validasi backend: wajib diisi bila diaktifkan, dan nilainya harus ada di daftar.

Tidak termasuk:

- Perubahan pada race pack. Jenis kendaraan tidak dicampur ke kolom race pack.
- Pertanyaan per peserta. Jawaban satu per pesanan.
- Laporan/ekspor khusus kendaraan. Data tetap terlihat di kartu pesanan.

## Pendekatan

Dua cara: kolom bebas di data peserta, atau setting global dengan jawaban per
pesanan. Dipilih setting global per pesanan karena permintaan menyebut
"pengaturan admin" dan jenis kendaraan menggambarkan kendaraan pembeli, bukan
tiap peserta.

Desain:

1. `DEFAULT_SETTINGS` dan `EDITABLE_SETTINGS` mendapat `kendaraan_opsi` dan
   `kendaraan_wajib`. Opsi disimpan sebagai teks satu per baris, dirapikan saat
   disimpan (buang baris kosong, maksimal 30 opsi, tiap opsi maksimal 40 huruf).
2. Boot halaman publik mengirim `kendaraan: { opsi: [...], wajib: true|false }`.
   Bila daftar opsi kosong, dropdown tidak dirender sama sekali.
3. `SCHEMA.Orders` mendapat kolom `jenis_kendaraan` di akhir.
4. `pubOrder_` memvalidasi: bila wajib, nilai tidak boleh kosong; bila daftar
   opsi ada, nilai harus salah satu opsi. Nilai disimpan ke kolom baru.
5. Kartu pesanan admin menampilkan baris "Kendaraan" bila terisi.
6. Pengaturan admin mendapat section "Jenis Kendaraan" berisi textarea daftar
   opsi dan pilihan wajib/tidak, dengan contoh format.

## Verifikasi

- E2E: isi opsi di Pengaturan, buat pesanan dengan pilihan kendaraan, kartu
  pesanan admin menampilkan nilainya; validasi wajib menolak pesanan kosong.
- Semua tes E2E lulus.
- Deploy `npm run push:gas`, cek `/exec`.
