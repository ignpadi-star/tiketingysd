# Panduan Sistem Penjualan Tiket Kegiatan (Google Apps Script)

## 1. Deploy

1. Buat Google Spreadsheet baru.
2. **Extensions > Apps Script**.
3. Buat 5 file: `Code.gs`, `Index.html`, `Admin.html`, `Style.html`, `JavaScript.html`. Tempel isi masing-masing.
4. **Project Settings** (gear):
   - Time zone: `Asia/Jakarta`
   - Centang "Show appsscript.json manifest", pastikan:
     ```json
     {
       "timeZone": "Asia/Jakarta",
       "exceptionLogging": "STACKDRIVER",
       "runtimeVersion": "V8",
       "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }
     }
     ```
5. **Run** fungsi `setupDatabase`. Setujui izin.
   - Buat 8 sheet (Users, Events, TicketTypes, Orders, Tickets, ScanLog, Settings, RacePack), 3 folder Drive, akun awal.
   - Akun Super Admin: **username `admin109` / password `20224092`** (muncul juga di dialog + Execution log). Segera ganti lewat menu Pengguna > Reset PW.
   - `setupDatabase` juga merapikan status lama `TRUE/FALSE` menjadi `AKTIF/NONAKTIF` dan memastikan akun `admin109` aktif.
   - Catatan: menjalankan `setupDatabase` ulang akan mengembalikan password `admin109` ke `20224092`. Setelah login, ganti password; jangan jalankan setup ulang tanpa alasan.
6. (Opsional) Jalankan `installTriggers`: auto-batalkan pesanan belum bayar tiap jam, auto-simpan video Veo tiap 5 menit.
7. **Deploy > New deployment > Web app**: Execute as **Me**, Access **Anyone**. Salin URL `/exec`.
8. Buka URL publik untuk pembelian tiket (tanpa tombol login). Untuk halaman admin, buka `URL/exec?page=admin`, lalu login `admin109`.

> Edit kode → **Deploy > Manage deployments > Edit > New version** agar URL tetap sama.

### Veo 3 (opsional)
Project Settings > **Script Properties** → tambah `GEMINI_API_KEY`. Butuh billing aktif. Nama model ubah di menu Pengaturan (`video_model`).

## 2. Kegiatan Baru

Tak perlu ubah kode.
1. Login Super Admin > **Kegiatan > Kegiatan Baru**.
2. Isi nama, jenis, tanggal, jam, lokasi, deskripsi, **info pembayaran**, upload poster, status `DRAFT`. Simpan.
3. **Tambah Jenis Tiket**: nama, harga (0 = gratis), kuota, periode jual.
4. Status jadi **AKTIF**: kegiatan tampil di publik + Gate.
5. **Salin tautan** (`URL/exec?event=ID`) untuk bagikan.
6. Selesai → status **SELESAI** atau **DITUTUP**.

Alur harian: pembeli pesan > bayar & upload bukti > Verifikator ACC (tiket + e-tiket email) > Gate scan.

## 3. Catatan Penting

| Hal | Penjelasan | Solusi |
|---|---|---|
| **Kuota email** | MailApp: ~100/hari (Gmail biasa), ~1.500 (Workspace). Tiap ACC = 1 email. | Kalau habis, tiket tetap dibuat; pembeli unduh di "Cek Status", Verifikator kirim ulang besok. Acara besar pakai Workspace. |
| **Kamera** | Web app di iframe; browser/HP blokir kamera. | Buka URL `/exec` langsung di tab browser penuh (Chrome/Safari, HTTPS). Pakai **Scan dari foto** atau **input manual** ID tiket/ID pembelian. |
| **Sesi login** | CacheService, maks 6 jam idle. Super Admin bisa memantau jumlah dan detail sesi aktif (perangkat, jam login, aktivitas terakhir) di menu **Pengguna**. | Login ulang kalau diminta. Nonaktifkan/reset user = akhiri sesi langsung. |
| **Kecepatan** | LockService: satu proses tulis, anti oversell + anti check-in ganda. | Pakai beberapa HP gate; cukup untuk ratusan s/d ribuan tiket. |
| **Skala data** | Sheets nyaman sampai puluhan ribu baris. | Kegiatan sangat besar → arsipkan ke Spreadsheet lain. |
| **Unduh laporan** | Excel/PDF diunduh lewat tautan file Drive; alternatifnya buat sheet baru di spreadsheet utama. | Pilih format **Excel (.xlsx)** atau **PDF** di menu export. |
| **Password** | SHA-256 + salt acak. 5 percobaan / 10 menit per username. | Gunakan password panjang + unik. |
| **Bukti bayar** | Tersimpan privat di Drive pemilik skrip; Verifikator lihat via server. | - |
| **Kolom tambahan** | Events: `video_operation`, `video_status`, `video_file_id`, `video_pesan`. ScanLog: `event_id`. | Jangan hapus/urut ulang kolom. |
| **Kuota dipesan** | `terjual` = tiket sudah dipesan (termasuk belum bayar), anti oversell; dikembalikan kalau ditolak/dibatalkan. Dashboard "terjual" hanya hitung DITERIMA. | - |
| **Veo 3** | Butuh billing aktif. Video diproses 1-5 menit. | Klik "Cek Hasil" atau pasang `installTriggers`. |

## 4. Peran Akun

- **SUPER_ADMIN**: semua menu (dashboard, kegiatan, tiket, pengguna, pesanan, scan log, pengaturan, verifikasi, gate).
- **VERIFIKATOR**: menunggu verifikasi (preview bukti, ACC/TOLAK), cari pesanan, kirim ulang e-tiket.
- **STAF**: data race pack (serahkan/ambil), cari pesanan, unduh tiket, kirim ulang e-tiket.
- **GATE**: pilih kegiatan, scan QR / input manual, hasil hijau/kuning/merah, check-in satuan atau semua untuk ID pembelian multi-tiket, statistik masuk/total.
