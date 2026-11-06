# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Super admin** — mengatur seluruh sistem: kegiatan, jenis tiket, pengguna & peran, pesanan, verifikasi, pengaturan, scan log, dan ekspor laporan.
- **Verifikator** — memeriksa bukti pembayaran, meng-ACC atau menolak pesanan, dan mengirim ulang e-tiket.
- **Staf** — menyerahkan/mengambil race pack, mencari pesanan, mengunduh tiket, dan mengirim ulang e-tiket.
- **Gate** — memilih kegiatan, memindai QR atau memasukkan ID tiket secara manual, mencatat check-in, dan memantau statistik masuk.
- **Pembeli (publik)** — melihat kegiatan, memesan tiket, mengunggah bukti transfer, memeriksa status pesanan, dan mengunduh e-tiket.

## Product Purpose

Sistem penjualan tiket kegiatan yang sederhana dan cepat di-deploy. Membantu panitia mengelola penjualan, pembayaran manual (bukti transfer), verifikasi, penerbitan e-tiket, pembagian race pack, dan check-in di pintu masuk. Keberhasilan berarti pembeli bisa menyelesaikan pembelian tanpa akun dan panitia bisa menjalankan seluruh alur dari satu spreadsheet.

## Positioning

Template tiket berbasis Google Apps Script yang disalin per panitia/kegiatan: data di Google Sheets, file di Drive, e-tiket lewat Gmail. Tanpa backend custom dan tanpa infrastruktur tambahan, sehingga satu panitia bisa men-deploy instance-nya sendiri dari spreadsheet kosong.

## Operating Context

- UI berjalan sebagai web app Apps Script (Execute as: Me, Access: Anyone); halaman admin di `?page=admin`, halaman publik di `/exec` dan `?event=ID`.
- Semua aksi klien melewati satu pintu `api(action, token, payload)` dengan whitelist rute dan pembatasan peran.
- Login memakai sesi CacheService (TTL 6 jam); sesi pengguna bisa dicabut saat akun dinonaktifkan atau password direset. Super Admin dapat melihat jumlah dan detail sesi aktif (perangkat, waktu login, aktivitas terakhir) di menu Pengguna dan widget **Perangkat Aktif** di header admin.
- Alur pesanan: `MENUNGGU_BAYAR` → `MENUNGGU_VERIFIKASI` → `DITERIMA` / `DITOLAK`, plus `BATAL` (otomatis saat melewati batas bayar, default 24 jam).
- Status kegiatan: `DRAFT`, `AKTIF`, `SELESAI`, `DITUTUP`; hanya `AKTIF` yang tampil di publik dan Gate.
- Data utama: Users, Events, TicketTypes, Orders, Tickets, ScanLog, Settings, RacePack.
- Poster, background halaman/tiket, bukti bayar, dan video promo disimpan di folder Drive terpisah.
- E-tiket dikirim ke email pembeli setelah ACC; pengiriman ulang tersedia untuk staf.
- Pekerjaan terjadwal opsional: pembatalan otomatis pesanan belum bayar (tiap jam) dan polling video (tiap 5 menit).

## Capabilities and Constraints

- CRUD kegiatan dan jenis tiket, kuota, serta periode penjualan; hapus kegiatan ditolak bila sudah ada pesanan.
- Pembelian tiket tanpa akun, batas jumlah per pesanan (default 10), penguncian kuota dengan LockService untuk mencegah oversell dan check-in ganda.
- Verifikasi pembayaran manual; tiket dan e-tiket dibuat saat ACC, kuota dikembalikan saat ditolak.
- Race pack: pendaftaran data peserta yang field-nya dapat dikonfigurasi, status `BELUM_DIAMBIL`, pencatatan pengambilan oleh staf.
- Video promo kegiatan opsional lewat Veo 3 (butuh `GEMINI_API_KEY` dan billing aktif; model diatur di Pengaturan).
- Pengaturan dari UI: nama organisasi, warna utama/aksen, logo, kontak panitia, nama pengirim email, batas tiket per pesanan, batas jam bayar, info & field race pack.
- Ekspor laporan: unduh **Excel (.xlsx)** atau **PDF** lewat tautan Drive, plus opsi buat sheet baru di spreadsheet utama dan fallback CSV.
- Keamanan: password SHA-256 + salt acak, 5 percobaan login per 10 menit per username, validasi input, dan log aktivitas/scan.
- Keterbatasan platform: kuota MailApp harian (tiket tetap dibuat bila kuota habis), ukuran data Sheets (puluhan ribu baris), batas eksekusi Apps Script, dan kamera yang sering diblokir di dalam iframe (tersedia scan dari foto dan input manual).
- `Code.gs` di root adalah backend yang benar-benar di-deploy; refactor modular di `src/` (Config, Utils, Db, Auth, CoreLogic, QrLogic, DriveHelper) adalah arah pengembangan, bukan sumber kebenaran produksi.
- Bahasa produk dan seluruh copy UI: Indonesia.

## Brand Commitments

- Nama organisasi, logo, kontak, warna utama, dan warna aksen berasal dari `Settings`; nilai default `#1d4ed8` (utama) dan `#f59e0b` (aksen).
- Nada bahasa: jelas, ringkas, dan operasional — dipakai panitia sukarela, bukan tim teknis.
- Tampilan responsif untuk mobile dan desktop; gate dipakai di HP.

## Evidence on Hand

- `Code.gs` — backend produksi: schema, routing API, logika bisnis, `setupDatabase()`, `installTriggers()`.
- `Index.html`, `Admin.html`, `Style.html`, `JavaScript.html` — shell halaman, CSS, dan seluruh UI klien.
- `src/*.js` — refactor modular (belum menjadi sumber kebenaran).
- `dev_server.py`, `dev_mock.js` — server lokal untuk pratinjau UI tanpa deploy Apps Script.
- `PANDUAN (1).md` — panduan deploy & operasional; akun awal, URL admin, dan ekspor sudah diselaraskan dengan `Code.gs`.
- `DESIGN.md` — sistem visual incumbent.
- `arsitektur-aplikasi-tiket.html` — dokumen arsitektur.
- Tidak ada testimoni, studi kasus, atau metrik pelanggan; jangan mengarang.

## Product Principles

1. **Sederhana** — minim langkah dari beli hingga masuk; pembeli tidak perlu membuat akun.
2. **Transparan** — status pesanan, bukti bayar, dan check-in selalu bisa dilihat semua pihak.
3. **Aman** — sesi terbatas, validasi input, kuota terkunci, dan setiap tindakan tercatat.
4. **Mudah dikelola** — tanpa setup infrastruktur; satu spreadsheet adalah seluruh database.

## Accessibility & Inclusion

- HTML semantik dengan heading dan landmark yang jelas.
- Tombol dan form memiliki label serta focus state; skip-link tersedia.
- Warna status (hijau/kuning/merah) tidak menjadi satu-satunya indikator.
- Responsif dan dapat dinavigasi keyboard.
