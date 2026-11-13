# Warna Area Publik dan Data Kendaraan Tambahan

Tanggal: 2026-11-13
Status: menunggu persetujuan

## Tujuan

1. Admin dapat mengganti warna area besar halaman publik (header dan kartu/hero)
   yang sekarang mengikuti warna utama. Warna teks di area itu menyesuaikan
   sendiri agar tetap terbaca.
2. Pengaturan kendaraan menambah dua isian: nomor polisi dan nomor kendaraan.

## Ruang lingkup

Termasuk:

- Setting `warna_area` (hex, opsional) untuk warna permukaan/header halaman publik.
- Perhitungan otomatis warna teks, teks redup, garis, dan isian berdasarkan
  kecerahan area.
- Setting kendaraan: tampilkan dan wajibkan nomor polisi; tampilkan dan wajibkan
  nomor kendaraan.
- Penyimpanan nomor polisi dan nomor kendaraan per pesanan serta tampilannya di
  kartu pesanan admin.

Tidak termasuk:

- Perubahan warna halaman admin. Admin tetap memakai tema terang biru.
- Validasi format nomor polisi Indonesia. Hanya panjang dan kewajiban.

## Pendekatan

### Warna area

Saat ini permukaan publik diturunkan dari warna utama memakai `color-mix`.
Bila warna utama gradien oranye-pink, seluruh area jadi pink dan teks tetap
terang sehingga judul nyaris tak terbaca.

Desain:

1. `DEFAULT_SETTINGS` dan `EDITABLE_SETTINGS` mendapat `warna_area`.
   Kosong berarti otomatis dari warna utama (perilaku sekarang).
2. Boot mengirim `area`. `applyColors()` memakai `warna_area` bila ada sebagai
   `--surface`, `--surface-2`, `--surface-3`, dan `--top-bg`.
3. Fungsi baru menghitung kecerahan area, lalu memilih set warna:
   - area terang: teks `#0b1220`, teks redup `#52627a`, garis dan isian terang;
   - area gelap: teks `#e6edf7`, teks redup `#94a3b8`, garis dan isian gelap.
4. Bila `warna_area` kosong, kecerahan dihitung dari campuran warna utama dan
   latar, jadi latar terang tetap menghasilkan teks gelap. Ini memperbaiki judul
   yang pudar pada tangkapan layar.
5. Admin: di section Tema Halaman Publik ditambah pemilih warna area dan
   checkbox "Otomatis dari warna utama".

### Data kendaraan

1. Setting baru: `nopol_aktif`, `nopol_wajib`, `nomor_kendaraan_aktif`,
   `nomor_kendaraan_wajib` (masing-masing `YA`/`TIDAK`).
2. Boot mengirim konfigurasi ini. Form publik menampilkan isian teks
   "Nomor polisi" (maks 20) dan "Nomor kendaraan" (maks 40) di section Kendaraan,
   hanya bila diaktifkan.
3. Kolom baru di `Orders`: `nomor_polisi`, `nomor_kendaraan`. Nomor polisi
   disimpan huruf besar.
4. Backend memvalidasi kewajiban masing-masing isian.
5. Kartu pesanan admin menampilkan "Nomor polisi" dan "Nomor kendaraan" bila terisi.

## Verifikasi

- E2E: ganti warna area lalu cek warna teks judul kontras; isi nomor polisi dan
  nomor kendaraan saat memesan; kartu pesanan admin menampilkannya; validasi
  wajib menolak isian kosong.
- Semua tes E2E lulus, deploy `npm run push:gas`, cek `/exec`.
