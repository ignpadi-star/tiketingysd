/* Dev-only mock for google.script.run. Not deployed to Apps Script. */
(function () {
  var eventSeq = 0, typeSeq = 0, userSeq = 0, packSeq = 0;

  var events = [
    {
      event_id: 'EV-DEMO-1', nama_kegiatan: 'Konser Demo', jenis: 'Konser',
      tanggal: '2026-11-01', jam: '19:00', lokasi: 'Jakarta', status: 'AKTIF',
      harga_mulai: 150000, tersedia: true, racepack_aktif: 'YA',
      deskripsi: 'Konser musik tahunan dengan musisi nasional.',
      bg_halaman_url: '', bg_tiket_url: '', poster_url: '', ukuran_kaos_url: '/tests/fixtures/kaos-uji.png',
      tipe: [
        { type_id: 'TT-1', nama_tiket: 'VIP', harga: 250000, kuota: 100, terjual: 80, sisa: 20, status: 'BUKA', isi_tiket: 1 },
        { type_id: 'TT-2', nama_tiket: 'Reguler', harga: 150000, kuota: 200, terjual: 100, sisa: 100, status: 'BUKA', isi_tiket: 1 },
        { type_id: 'TT-4', nama_tiket: 'Paket Duo', harga: 400000, kuota: 40, terjual: 0, sisa: 40, status: 'BUKA', isi_tiket: 2 }
      ]
    },
    {
      event_id: 'EV-DEMO-2', nama_kegiatan: 'Festival Demo', jenis: 'Festival',
      tanggal: '2026-11-08', jam: '15:00', lokasi: 'Bandung', status: 'AKTIF',
      harga_mulai: 75000, tersedia: true, racepack_aktif: 'TIDAK',
      deskripsi: 'Festival kuliner dan musik.',
      bg_halaman_url: '', bg_tiket_url: '', poster_url: '', ukuran_kaos_url: '',
      tipe: [
        { type_id: 'TT-3', nama_tiket: 'Reguler', harga: 75000, kuota: 50, terjual: 0, sisa: 50, status: 'BUKA', isi_tiket: 1 }
      ]
    }
  ];

  var users = [
    { user_id: 'USR-1', nama: 'Admin', username: 'admin109', role: 'SUPER_ADMIN', status_aktif: 'AKTIF', dibuat_pada: '2026-10-01 09:00:00' },
    { user_id: 'USR-2', nama: 'Staf Satu', username: 'staf1', role: 'STAF', status_aktif: 'AKTIF', dibuat_pada: '2026-10-02 09:00:00' }
  ];

  var settingsData = {
    racepack_fields: JSON.stringify([
      { key: 'nama_pemegang', label: 'Nama' },
      { key: 'tgl_lahir', label: 'Tanggal Lahir' },
      { key: 'no_hp', label: 'No HP' }
    ]),
    racepack_info: 'Ambil race pack di booth A dengan menunjukkan e-tiket.',
    nama_organisasi: 'Organisasi Demo',
    warna_utama: '#1d4ed8',
    warna_aksen: '#f59e0b',
    warna_latar: '#020617',
    musik_url: '',
    musik_nama: '',
    musik_loop: 'TIDAK',
    qris_url: '',
    kendaraan_opsi: '',
    kendaraan_wajib: 'TIDAK'
  };

  var racepackRows = [
    {
      pack_id: 'RPK-DEMO-1', order_id: 'TKT-DEMO-1', ticket_id: 'TIX-DEMO-1',
      event_id: 'EV-DEMO-1', kegiatan: 'Konser Demo', nama_tiket: 'VIP',
      nama_pemegang: 'Budi Santoso', nama_pembeli: 'Budi Santoso',
      email: 'budi@example.com', no_hp: '08123456789', jumlah: 1,
      diambil_pada: '2026-10-27 10:00:00', diambil_oleh: 'Petugas A',
      status: 'DIAMBIL', data: JSON.stringify({ tgl_lahir: '1990-01-01', no_hp: '08123456789' })
    },
    {
      pack_id: '', order_id: 'TKT-DEMO-2', ticket_id: 'TIX-DEMO-2',
      event_id: 'EV-DEMO-1', kegiatan: 'Konser Demo', nama_tiket: 'Reguler',
      nama_pemegang: 'Siti Aminah', nama_pembeli: 'Siti Aminah',
      email: 'siti@example.com', no_hp: '08123456780', jumlah: 2,
      diambil_pada: '', diambil_oleh: '', status: 'BELUM_DIAMBIL', data: ''
    },
    {
      pack_id: '', order_id: 'TKT-DEMO-2', ticket_id: 'TIX-DEMO-3',
      event_id: 'EV-DEMO-1', kegiatan: 'Konser Demo', nama_tiket: 'Reguler',
      nama_pemegang: 'Siti Aminah', nama_pembeli: 'Siti Aminah',
      email: 'siti@example.com', no_hp: '08123456780', jumlah: 2,
      diambil_pada: '', diambil_oleh: '', status: 'BELUM_DIAMBIL', data: ''
    }
  ];

  var orders = [
    {
      order_id: 'TKT-DEMO-1', event_id: 'EV-DEMO-1', kegiatan: 'Konser Demo', nama_tiket: 'VIP',
      nama_pembeli: 'Budi Santoso', email: 'budi@example.com', no_hp: '08123456789',
      jumlah: 2, total_harga: 300000, status: 'DITERIMA', catatan: '', dibuat_pada: '2026-10-27 09:00:00',
      jenis_kendaraan: 'Mobil',
      diverifikasi_oleh: 'Admin', diverifikasi_pada: '2026-10-27 09:30:00', ada_bukti: true
    },
    {
      order_id: 'TKT-DEMO-2', event_id: 'EV-DEMO-1', kegiatan: 'Konser Demo', nama_tiket: 'Reguler',
      nama_pembeli: 'Siti Aminah', email: 'siti@example.com', no_hp: '08123456780',
      jumlah: 2, total_harga: 300000, status: 'MENUNGGU_VERIFIKASI', catatan: '', dibuat_pada: '2026-10-27 10:00:00',
      diverifikasi_oleh: '', diverifikasi_pada: '', ada_bukti: true
    },
    {
      order_id: 'TKT-DEMO-3', event_id: 'EV-DEMO-2', kegiatan: 'Festival Demo', nama_tiket: 'Reguler',
      nama_pembeli: 'Andi Wijaya', email: 'andi@example.com', no_hp: '08123456781',
      jumlah: 1, total_harga: 75000, status: 'DITOLAK', catatan: 'Bukti tidak sesuai', dibuat_pada: '2026-10-27 11:00:00',
      diverifikasi_oleh: 'Admin', diverifikasi_pada: '2026-10-27 12:00:00', ada_bukti: true
    },
    {
      order_id: 'TKT-DEMO-4', event_id: 'EV-DEMO-1', kegiatan: 'Konser Demo Malam Tahun Baru', nama_tiket: 'VIP',
      nama_pembeli: 'Norodom Sihanouk', email: 'norodom122@gmail.com', no_hp: '08526895426',
      jumlah: 3, total_harga: 750000, status: 'MENUNGGU_BAYAR', catatan: '', dibuat_pada: '2026-10-29 11:25:00',
      diverifikasi_oleh: '', diverifikasi_pada: '', ada_bukti: false
    },
    {
      order_id: 'TKT-DEMO-5', event_id: 'EV-DEMO-1', kegiatan: 'Konser Demo', nama_tiket: 'Reguler',
      nama_pembeli: 'Dio Pratama', email: 'diodio@mail.com', no_hp: '081222832940',
      jumlah: 1, total_harga: 150000, status: 'DITERIMA', catatan: '', dibuat_pada: '2026-10-29 11:20:00',
      diverifikasi_oleh: 'Super Admin', diverifikasi_pada: '2026-10-29 11:21:00', ada_bukti: true
    },
    {
      order_id: 'TKT-DEMO-6', event_id: 'EV-DEMO-2', kegiatan: 'Festival Demo', nama_tiket: 'Reguler',
      nama_pembeli: 'Aditiya Pratama Wijaya Kusuma', email: 'aditiyapratamawijayakusuma@example.co.id', no_hp: '082131231233',
      jumlah: 1, total_harga: 75000, status: 'BATAL', catatan: 'Dibatalkan otomatis: melewati batas waktu pembayaran', dibuat_pada: '2026-10-27 20:53:00',
      diverifikasi_oleh: '', diverifikasi_pada: '', ada_bukti: false
    },
    {
      order_id: 'TKT-DEMO-7', event_id: 'EV-DEMO-1', kegiatan: 'Konser Demo', nama_tiket: 'VIP',
      nama_pembeli: 'Rina Kartika', email: 'rina.kartika@example.com', no_hp: '081298765432',
      jumlah: 2, total_harga: 500000, status: 'DITERIMA', catatan: '', dibuat_pada: '2026-10-28 08:15:00',
      diverifikasi_oleh: 'Admin', diverifikasi_pada: '2026-10-28 08:40:00', ada_bukti: true
    }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fail(msg) { return { __fail: msg }; }
  function findEvent(id) {
    return events.filter(function (x) { return x.event_id === id; })[0] || null;
  }
  function recalcHarga(ev) {
    var open = (ev.tipe || []).filter(function (t) { return t.status === 'BUKA'; });
    ev.harga_mulai = open.length ? Math.min.apply(null, open.map(function (t) { return Number(t.harga) || 0; })) : 0;
    ev.tersedia = open.length > 0;
  }

  function mockData(action, payload) {
    payload = payload || {};

    if (action === 'auth.login') {
      if (!String(payload.username || '').trim() || !String(payload.password || '')) return fail('Isi username dan password.');
      var uname = String(payload.username).toLowerCase();
      var u = users.filter(function (x) { return x.username === uname && x.status_aktif === 'AKTIF'; })[0];
      if (!u) return fail('Username atau password salah, atau akun nonaktif.');
      return { token: 'dev-token', user: { nama: u.nama, role: u.role, username: u.username } };
    }
    if (action === 'auth.me') {
      try {
        var su = JSON.parse(sessionStorage.getItem('us') || 'null');
        if (su && su.role) return su;
      } catch (e) { /* abaikan */ }
      return { nama: 'Super Admin', role: 'SUPER_ADMIN', username: 'admin109' };
    }
    if (action === 'auth.logout') return true;

    if (action === 'public.events' || action === 'event.list') {
      return clone(action === 'public.events' ? events.filter(function (e) { return e.status === 'AKTIF'; }) : events);
    }
    if (action === 'public.event') {
      var src = findEvent(payload.event_id) || events[0];
      var ev = clone(src);
      ev.max_qty = 5;
      ev.racepack_fields = ev.racepack_aktif === 'YA' ? [
        { key: 'nama_pemegang', label: 'Nama' },
        { key: 'tgl_lahir', label: 'Tanggal Lahir' },
        { key: 'no_hp', label: 'No HP' }
      ] : [];
      if (ev.racepack_aktif !== 'YA') ev.ukuran_kaos_url = '';
      return ev;
    }
    if (action === 'public.order') {
      if (String(payload.nama || '').trim().length < 2) return fail('Nama pembeli wajib diisi.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(payload.email || ''))) return fail('Format email tidak valid.');
      var qty = parseInt(payload.jumlah, 10);
      var ev2 = findEvent(payload.event_id) || events[0];
      var t = (ev2.tipe || []).filter(function (x) { return x.type_id === payload.type_id; })[0] || (ev2.tipe || [])[0] || { nama_tiket: 'Tiket', harga: 0 };
      var isi = Math.max(1, Number(t.isi_tiket) || 1);
      var paketIn = parseInt(payload.paket, 10);
      var paket = paketIn >= 1 ? paketIn : Math.max(1, Math.ceil((qty || 1) / isi));
      qty = paket * isi;
      if (!(qty >= 1)) return fail('Jumlah tiket wajib diisi.');
      if (qty > 5) return fail('Maksimal ' + Math.max(1, Math.floor(5 / isi)) + ' paket per pesanan.');
      var kOpsi = String(settingsData.kendaraan_opsi || '').split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
      var kWajibCfg = String(settingsData.kendaraan_wajib || '').toUpperCase() === 'YA';
      if (!kOpsi.length && typeof BOOT !== 'undefined' && BOOT.kendaraan && Array.isArray(BOOT.kendaraan.opsi)) {
        kOpsi = BOOT.kendaraan.opsi;
        kWajibCfg = !!BOOT.kendaraan.wajib;
      }
      var kJenis = String(payload.jenis_kendaraan || '').trim();
      if (!kOpsi.length) kJenis = '';
      else {
        if (kJenis && kOpsi.indexOf(kJenis) < 0) return fail('Jenis kendaraan tidak valid.');
        if (!kJenis && kWajibCfg) return fail('Jenis kendaraan wajib dipilih.');
      }
      return {
        order_id: 'TKT-DEMO-NEW', total_harga: t.harga * paket, jumlah: qty, paket: paket, isi_tiket: isi, status: 'MENUNGGU_BAYAR',
        nama_kegiatan: ev2.nama_kegiatan, nama_tiket: t.nama_tiket, info_pembayaran: 'Transfer BCA 123',
        jenis_kendaraan: kJenis,
        batas_bayar_jam: 24, racepack_info: 'Ambil race pack di booth A.'
      };
    }
    if (action === 'public.status') {
      var id = String(payload.order_id || '').trim().toUpperCase();
      var kontak = String(payload.kontak || '').trim().toLowerCase();
      var o = orders.filter(function (x) { return x.order_id === id && (String(x.email).toLowerCase() === kontak || String(x.no_hp) === kontak); })[0];
      if (!o) return fail('Pesanan tidak ditemukan. Periksa ID dan kontak.');
      var ev3 = findEvent(o.event_id) || events[0];
      var res = {
        order_id: o.order_id, status: o.status, nama_pembeli: o.nama_pembeli, email: o.email,
        jumlah: o.jumlah, total_harga: o.total_harga, dibuat_pada: o.dibuat_pada,
        catatan: o.catatan, sudah_upload: true,
        event: { event_id: ev3.event_id, nama_kegiatan: ev3.nama_kegiatan, tanggal: ev3.tanggal, jam: ev3.jam, lokasi: ev3.lokasi, poster_url: ev3.poster_url },
        nama_tiket: o.nama_tiket, tiket: [], racepack_info: 'Ambil race pack di booth A.'
      };
      if (o.status === 'DITERIMA') {
        res.tiket = [
          { ticket_id: 'TIX-DEMO-1', nama_pemegang: 'Budi Santoso', status_checkin: 'BELUM' },
          { ticket_id: 'TIX-DEMO-2', nama_pemegang: 'Siti Aminah', status_checkin: 'BELUM' }
        ];
      }
      return res;
    }

    if (action === 'event.save') {
      var nama = String(payload.nama_kegiatan || '').trim();
      if (nama.length < 3) return fail('Nama kegiatan minimal 3 karakter.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(payload.tanggal || ''))) return fail('Tanggal kegiatan wajib diisi.');
      var cev = payload.event_id ? findEvent(payload.event_id) : null;
      if (payload.event_id && !cev) return fail('Kegiatan tidak ditemukan.');
      if (!cev) {
        cev = {
          event_id: 'EVT-UJI-' + (++eventSeq), tipe: [], poster_url: '', bg_halaman_url: '', bg_tiket_url: '',
          harga_mulai: 0, tersedia: true
        };
        events.push(cev);
      }
      cev.nama_kegiatan = nama;
      cev.jenis = String(payload.jenis || '');
      cev.tanggal = payload.tanggal;
      cev.jam = String(payload.jam || '');
      cev.lokasi = String(payload.lokasi || '');
      cev.status = payload.status || 'DRAFT';
      cev.deskripsi = String(payload.deskripsi || '');
      cev.info_pembayaran = String(payload.info_pembayaran || '');
      cev.racepack_aktif = payload.racepack_aktif === 'YA' ? 'YA' : 'TIDAK';
      if (payload.ukuran_kaos_hapus) cev.ukuran_kaos_url = '';
      else if (payload.ukuran_kaos && payload.ukuran_kaos.b64) {
        cev.ukuran_kaos_url = 'data:' + payload.ukuran_kaos.mime + ';base64,' + payload.ukuran_kaos.b64;
      }
      recalcHarga(cev);
      return { event_id: cev.event_id };
    }
    if (action === 'event.delete') {
      var delEv = findEvent(payload.event_id);
      if (!delEv) return fail('Kegiatan tidak ditemukan.');
      events = events.filter(function (x) { return x.event_id !== payload.event_id; });
      return { event_id: payload.event_id };
    }
    if (action === 'event.toggleReg') {
      var tev = findEvent(payload.event_id);
      if (!tev) return fail('Kegiatan tidak ditemukan.');
      tev.status = tev.status === 'AKTIF' ? 'DITUTUP' : 'AKTIF';
      return { event_id: tev.event_id, status: tev.status, message: 'Status pendaftaran ' + (tev.status === 'AKTIF' ? 'dibuka' : 'ditutup') };
    }

    if (action === 'type.save') {
      var tname = String(payload.nama_tiket || '').trim();
      if (!tname) return fail('Nama tiket wajib diisi.');
      var tev2 = findEvent(payload.event_id);
      if (!tev2) return fail('Kegiatan tidak ditemukan.');
      var tt = payload.type_id ? tev2.tipe.filter(function (x) { return x.type_id === payload.type_id; })[0] : null;
      if (!tt) {
        tt = { type_id: 'TT-UJI-' + (++typeSeq), terjual: 0, status: 'BUKA' };
        tev2.tipe.push(tt);
      }
      tt.nama_tiket = tname;
      tt.harga = Number(payload.harga) || 0;
      tt.isi_tiket = Math.max(1, Math.min(20, parseInt(payload.isi_tiket, 10) || 1));
      tt.kuota = Number(payload.kuota) || 1;
      tt.sisa = Math.max(0, tt.kuota - tt.terjual);
      tt.tanggal_buka = payload.tanggal_buka || '';
      tt.tanggal_tutup = payload.tanggal_tutup || '';
      recalcHarga(tev2);
      return { type_id: tt.type_id };
    }
    if (action === 'type.delete') {
      events.forEach(function (e) {
        e.tipe = (e.tipe || []).filter(function (x) { return x.type_id !== payload.type_id; });
        recalcHarga(e);
      });
      return { type_id: payload.type_id };
    }

    if (action === 'user.list') {
      return clone(users.map(function (u) {
        return { user_id: u.user_id, nama: u.nama, username: u.username, role: u.role, status_aktif: u.status_aktif, dibuat_pada: u.dibuat_pada };
      }));
    }
    if (action === 'admin.sessions') {
      var now = new Date();
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var ts = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
      var t1 = new Date(now.getTime() - 42 * 60000);
      var t2 = new Date(now.getTime() - 8 * 60000);
      return {
        total: 2, accounts: 2, active_accounts: 2,
        sessions: [
          { nama: 'Super Admin', username: 'admin109', role: 'SUPER_ADMIN', device: 'Chrome - Windows - Desktop', login_at: ts(t1), last_seen: ts(now), current: true },
          { nama: 'Petugas Gate', username: 'gate01', role: 'GATE', device: 'Chrome - Android - HP', login_at: ts(t2), last_seen: ts(now), current: false }
        ]
      };
    }
    if (action === 'user.save') {
      var unama = String(payload.nama || '').trim();
      if (!unama) return fail('Nama wajib diisi.');
      if (!payload.role) return fail('Role tidak valid.');
      if (payload.user_id) {
        var eu = users.filter(function (x) { return x.user_id === payload.user_id; })[0];
        if (!eu) return fail('Pengguna tidak ditemukan.');
        eu.nama = unama;
        eu.role = payload.role;
        return { user_id: eu.user_id, password_changed: !!payload.password };
      }
      var username = String(payload.username || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return fail('Username minimal 3 karakter (huruf kecil, angka, titik, strip, underscore).');
      if (users.some(function (x) { return x.username === username; })) return fail('Username sudah dipakai.');
      var nu = { user_id: 'USR-UJI-' + (++userSeq), nama: unama, username: username, role: payload.role, status_aktif: 'AKTIF', dibuat_pada: '2026-10-29 10:00:00' };
      users.push(nu);
      return { user_id: nu.user_id, password: payload.password || 'UjiPass1234' };
    }
    if (action === 'user.toggle') {
      var tu = users.filter(function (x) { return x.user_id === payload.user_id; })[0];
      if (!tu) return fail('Pengguna tidak ditemukan.');
      tu.status_aktif = tu.status_aktif === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
      return { user_id: tu.user_id, status_aktif: tu.status_aktif };
    }
    if (action === 'user.reset') {
      var ru = users.filter(function (x) { return x.user_id === payload.user_id; })[0];
      if (!ru) return fail('Pengguna tidak ditemukan.');
      return { username: ru.username, password: payload.password || 'Acak12345x', manual: !!payload.password };
    }

    if (action === 'settings.get') return clone(settingsData);
    if (action === 'settings.save') {
      Object.keys(payload.values || {}).forEach(function (k) { settingsData[k] = payload.values[k]; });
      if (payload.musik_hapus) {
        settingsData.musik_url = '';
        settingsData.musik_nama = '';
      } else if (payload.musik_url) {
        settingsData.musik_url = payload.musik_url;
        settingsData.musik_nama = String(payload.musik_url).split('?')[0].split('/').pop() || 'Lagu landing page';
      } else if (payload.musik && payload.musik.name) {
        settingsData.musik_url = 'mock://musik/' + encodeURIComponent(payload.musik.name);
        settingsData.musik_nama = payload.musik.name;
      }
      if (payload.qris_hapus) {
        settingsData.qris_url = '';
      } else if (payload.qris && payload.qris.name) {
        settingsData.qris_url = 'mock://qris/' + encodeURIComponent(payload.qris.name);
      }
      if (payload.values && payload.values.kendaraan_opsi !== undefined) {
        var seenK = {};
        settingsData.kendaraan_opsi = String(payload.values.kendaraan_opsi || '').split(/\r?\n/).map(function (x) {
          return String(x || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        }).filter(function (x) {
          if (!x || seenK[x.toLowerCase()]) return false;
          seenK[x.toLowerCase()] = true;
          return true;
        }).slice(0, 30).join('\n');
      }
      if (payload.values && payload.values.kendaraan_wajib !== undefined) {
        settingsData.kendaraan_wajib = String(payload.values.kendaraan_wajib).toUpperCase() === 'YA' ? 'YA' : 'TIDAK';
      }
      return clone(settingsData);
    }
    if (action === 'report.export') {
      if (payload.jenis === 'attendance' && payload.format === 'json') {
        var attHead = ['nama_pemegang', 'email', 'no_hp', 'ticket_id', 'jenis_tiket', 'kegiatan', 'status_checkin', 'waktu_checkin', 'petugas_gate'];
        var attAll = [
          { event_id: 'EV-DEMO-1', row: ['Budi Santoso', 'budi@example.com', '08123456789', 'TIX-DEMO-1', 'VIP', 'Konser Demo', 'BELUM', '', ''] },
          { event_id: 'EV-DEMO-1', row: ['Dio Pratama', 'diodio@mail.com', '081222832940', 'TIX-DEMO-5', 'Reguler', 'Konser Demo', 'SUDAH', '2026-11-01 18:10', 'Petugas A'] },
          { event_id: 'EV-DEMO-1', row: ['Rina Kartika', 'rina.kartika@example.com', '081298765432', 'TIX-DEMO-7', 'VIP', 'Konser Demo', 'BELUM', '', ''] }
        ];
        var attRows = attAll.filter(function (x) { return !payload.event_id || x.event_id === payload.event_id; })
          .map(function (x) { return x.row; });
        return { jenis: 'json', head: attHead, rows: attRows, jumlah_baris: attRows.length };
      }
      return fail('Format laporan tidak didukung (mock).');
    }

    if (action === 'racesack.list') return clone(racepackRows);
    if (action === 'racesack.boot') {
      return { events: clone(events), settings: mockData('settings.get', payload), items: clone(racepackRows) };
    }
    if (action === 'racesack.register') {
      var row = racepackRows.filter(function (x) { return x.ticket_id === payload.ticket_id; })[0];
      if (!row) return fail('Data peserta tidak ditemukan.');
      row.pack_id = row.pack_id || ('RPK-UJI-' + (++packSeq));
      row.nama_pemegang = payload.nama_pemegang || row.nama_pemegang;
      row.status = payload.status || 'DIAMBIL';
      row.data = JSON.stringify(payload.data || {});
      row.diambil_pada = row.status === 'DIAMBIL' ? '2026-10-29 10:00:00' : '';
      row.diambil_oleh = row.status === 'DIAMBIL' ? 'Super Admin' : '';
      return { pack_id: row.pack_id, message: 'Race pack tersimpan (mock).' };
    }
    if (action === 'racesack.update') {
      var urow = racepackRows.filter(function (x) { return x.pack_id === payload.pack_id; })[0];
      if (!urow) return fail('Race pack tidak ditemukan.');
      urow.nama_pemegang = payload.nama_pemegang || urow.nama_pemegang;
      urow.status = payload.status || urow.status;
      urow.data = JSON.stringify(payload.data || {});
      urow.diambil_pada = urow.status === 'DIAMBIL' ? '2026-10-29 10:00:00' : '';
      urow.diambil_oleh = urow.status === 'DIAMBIL' ? 'Super Admin' : '';
      return { pack_id: urow.pack_id, message: 'Race pack diperbarui (mock).' };
    }
    if (action === 'racesack.delete') {
      var drow = racepackRows.filter(function (x) { return x.pack_id === payload.pack_id; })[0];
      if (!drow) return fail('Race pack tidak ditemukan.');
      drow.pack_id = '';
      drow.status = 'BELUM_DIAMBIL';
      drow.diambil_pada = '';
      drow.diambil_oleh = '';
      drow.data = '';
      return { pack_id: payload.pack_id, message: 'Race pack dihapus (mock).' };
    }
    if (action === 'racesack.toggle') {
      var rev = findEvent(payload.event_id);
      if (!rev) return fail('Kegiatan tidak ditemukan.');
      rev.racepack_aktif = rev.racepack_aktif === 'YA' ? 'TIDAK' : 'YA';
      return { status: rev.racepack_aktif, message: 'Data race pack ' + (rev.racepack_aktif === 'YA' ? 'diaktifkan' : 'dimatikan') + ' (mock).' };
    }

    if (action === 'dash.get') {
      return {
        events: clone(events),
        ringkasan: {
          tiket_terjual: 128, pendapatan: 19200000, sisa_kuota: 372, total_kuota: 500,
          checkin: 64, total_tiket: 128, menunggu_verifikasi: 6, menunggu_bayar: 3
        },
        per_hari: [
          { tanggal: '2026-10-21', tiket: 8, pendapatan: 1200000 },
          { tanggal: '2026-10-22', tiket: 14, pendapatan: 2100000 },
          { tanggal: '2026-10-23', tiket: 11, pendapatan: 1650000 },
          { tanggal: '2026-10-24', tiket: 22, pendapatan: 3300000 },
          { tanggal: '2026-10-25', tiket: 18, pendapatan: 2700000 },
          { tanggal: '2026-10-26', tiket: 27, pendapatan: 4050000 },
          { tanggal: '2026-10-27', tiket: 28, pendapatan: 4200000 }
        ],
        per_tipe: [
          { kegiatan: 'Konser Demo', nama_tiket: 'VIP', harga: 250000, kuota: 100, terjual: 68, sisa: 32, pendapatan: 17000000 },
          { kegiatan: 'Konser Demo', nama_tiket: 'Reguler', harga: 150000, kuota: 200, terjual: 60, sisa: 140, pendapatan: 9000000 }
        ]
      };
    }

    if (action === 'order.list') {
      var q = String(payload.q || '').toLowerCase();
      var st = payload.status || '';
      var evId = payload.event_id || '';
      var items = orders.filter(function (o) {
        if (st && o.status !== st) return false;
        if (evId && o.event_id !== evId) return false;
        if (!q) return true;
        return [o.nama_pembeli, o.email, o.no_hp, o.order_id].some(function (v) {
          return String(v || '').toLowerCase().indexOf(q) >= 0;
        });
      });
      return { total: items.length, items: clone(items) };
    }
    if (action === 'order.tickets') {
      return {
        order_id: 'TKT-DEMO-1', nama_pembeli: 'Budi Santoso', email: 'budi@example.com', no_hp: '08123456789',
        nama_kegiatan: 'Konser Demo', tanggal: '2026-11-01', jam: '19:00', lokasi: 'Jakarta',
        nama_tiket: 'VIP', organisasi: 'Organisasi Demo', kontak: '081200000000',
        bg_tiket_url: '',
        tiket: [
          { ticket_id: 'TIX-DEMO-1', nama_pemegang: 'Budi Santoso', status_checkin: 'BELUM' },
          { ticket_id: 'TIX-DEMO-2', nama_pemegang: 'Siti Aminah', status_checkin: 'BELUM' }
        ]
      };
    }

    if (action === 'gate.events') return clone(events.filter(function (e) { return e.status === 'AKTIF'; }));
    if (action === 'gate.stats') return { total: 120, masuk: 47 };
    if (action === 'scan.list') return [
      { waktu: '2026-10-27 18:42:10', kegiatan: 'Konser Demo', ticket_id: 'TIX-DEMO-1', hasil: 'VALID', petugas: 'Petugas A' },
      { waktu: '2026-10-27 18:44:02', kegiatan: 'Konser Demo', ticket_id: 'TIX-DEMO-1', hasil: 'SUDAH_DIPAKAI', petugas: 'Petugas B' },
      { waktu: '2026-10-27 18:46:33', kegiatan: 'Konser Demo', ticket_id: 'TIX-XXX', hasil: 'TIDAK_DITEMUKAN', petugas: 'Petugas A' }
    ];
    return {};
  }

  /* Setiap panggilan membuat runner baru (seperti google.script.run asli),
     agar dua request bersamaan tidak saling menimpa handler. */
  function makeRunner(ok, fail) {
    return {
      withSuccessHandler: function (fn) { return makeRunner(fn, fail); },
      withFailureHandler: function (fn) { return makeRunner(ok, fn); },
      api: function (action, token, payload) {
        var data;
        try { data = mockData(action, payload); }
        catch (e) {
          if (fail) fail(e);
          return;
        }
        setTimeout(function () {
          if (data && data.__fail) {
            if (ok) ok({ ok: false, error: data.__fail });
            return;
          }
          if (ok) ok({ ok: true, data: data });
        }, 0);
      }
    };
  }

  window.google = window.google || {
    script: {
      run: {
        withSuccessHandler: function (fn) { return makeRunner(fn, null); },
        withFailureHandler: function (fn) { return makeRunner(null, fn); }
      }
    }
  };
})();
