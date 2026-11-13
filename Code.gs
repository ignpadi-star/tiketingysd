/**
 * SISTEM PENJUALAN TIKET KEGIATAN (reusable) - Google Apps Script Web App
 * File: Code.gs  (backend: doGet, API, logika bisnis)
 *
 * Alur singkat:
 *  1. Jalankan setupDatabase() sekali  -> membuat semua sheet, folder Drive, dan akun admin awal.
 *  2. Deploy sebagai Web App (Execute as: Me, Access: Anyone).
 *  3. Semua aksi klien lewat satu pintu: api(action, token, payload) dengan whitelist ROUTES.
 */

/* ============================== KONFIGURASI ============================== */

const ROLES = ['SUPER_ADMIN', 'VERIFIKATOR', 'GATE', 'STAF'];
const EVENT_STATUS = ['DRAFT', 'AKTIF', 'SELESAI', 'DITUTUP'];
const MAX_IMG_MB = 10;
const SESSION_TTL = 21600; // 6 jam (batas maksimum CacheService)

// num = kolom bertipe angka; kolom lain disimpan sebagai TEKS (menjaga 08xx, tanggal, jam, dll.)
const SCHEMA = {
  Users: {
    cols: ['user_id', 'nama', 'username', 'password_hash', 'role', 'status_aktif', 'dibuat_pada'],
    num: []
  },
  Events: {
    cols: ['event_id', 'nama_kegiatan', 'jenis', 'deskripsi', 'tanggal', 'jam', 'lokasi', 'poster_url',
      'poster_file_id', 'status', 'info_pembayaran', 'dibuat_oleh',
      // kolom tambahan untuk fitur Veo 3 (opsional)
      'video_operation', 'video_status', 'video_file_id', 'video_pesan',
      // YA = pendaftar wajib mengisi data peserta/race pack; TIDAK = tidak diminta
      'racepack_aktif',
      // background halaman kegiatan & background tiket (diunggah admin)
      'bg_halaman_url', 'bg_halaman_file_id', 'bg_tiket_url', 'bg_tiket_file_id',
      // gambar panduan ukuran kaos per kegiatan (opsional)
      'ukuran_kaos_url', 'ukuran_kaos_file_id'],
    num: []
  },
  TicketTypes: {
    // isi_tiket: 1 = tiket satuan, 2+ = paket bundling berisi beberapa tiket.
    cols: ['type_id', 'event_id', 'nama_tiket', 'harga', 'kuota', 'terjual', 'tanggal_buka', 'tanggal_tutup', 'isi_tiket'],
    num: ['harga', 'kuota', 'terjual', 'isi_tiket']
  },
  Orders: {
    cols: ['order_id', 'event_id', 'type_id', 'nama_pembeli', 'email', 'no_hp', 'jumlah', 'total_harga',
      'bukti_bayar_url', 'status', 'catatan', 'dibuat_pada', 'diverifikasi_oleh', 'diverifikasi_pada',
      // JSON array [{nama, data:{...}}] = data peserta yang diisi saat pendaftaran
      'data_peserta',
      // jumlah paket yang dibeli (1 paket bisa berisi beberapa tiket)
      'paket'],
    num: ['jumlah', 'total_harga', 'paket']
  },
  Tickets: {
    // status_checkin, waktu_checkin, petugas_gate HARUS berurutan (dipakai updateCheckin_)
    cols: ['ticket_id', 'order_id', 'event_id', 'type_id', 'nama_pemegang', 'status_checkin', 'waktu_checkin', 'petugas_gate'],
    num: []
  },
  ScanLog: {
    cols: ['log_id', 'ticket_id', 'hasil', 'petugas', 'waktu', 'event_id'],
    num: []
  },
  Settings: {
    cols: ['key', 'value'],
    num: []
  },
  RacePack: {
    // ticket_id sengaja di akhir agar sheet lama tidak bergeser saat setupDatabase() dijalankan ulang.
    cols: ['pack_id', 'order_id', 'event_id', 'nama_pemegang', 'diambil_pada', 'diambil_oleh', 'status', 'data', 'ticket_id'],
    num: []
  }
};

const DEFAULT_SETTINGS = {
  nama_organisasi: 'Panitia Kegiatan',
  warna_utama: '#1d4ed8',
  warna_aksen: '#f59e0b',
  warna_latar: '#020617',
  kontak_panitia: '',
  logo_url: '',
  folder_poster_id: '',
  folder_bukti_id: '',
  folder_video_id: '',
  folder_musik_id: '',
  folder_qris_id: '',
  folder_kaos_id: '',
  qris_url: '',
  qris_file_id: '',
  musik_url: '',
  musik_file_id: '',
  musik_nama: '',
  musik_loop: 'TIDAK',
  max_tiket_per_order: '10',
  batas_bayar_jam: '24',
  racepack_fields_required: 'TIDAK',
  email_pengirim_nama: 'Panitia Kegiatan',
  video_model: 'veo-3.0-generate-001',
  video_pakai_poster: 'YA',
  racepack_info: '',
  racepack_fields: JSON.stringify([
    { key: 'nama_pemegang', label: 'Nama' },
    { key: 'tgl_lahir', label: 'Tanggal Lahir' },
    { key: 'no_hp', label: 'No HP' }
  ]),
};

// Setting yang boleh diubah dari tampilan Super Admin
const EDITABLE_SETTINGS = ['nama_organisasi', 'warna_utama', 'warna_aksen', 'warna_latar', 'kontak_panitia', 'logo_url', 'qris_url', 'racepack_info', 'racepack_fields', 'racepack_fields_required',
  'max_tiket_per_order', 'batas_bayar_jam', 'email_pengirim_nama', 'video_model', 'video_pakai_poster', 'musik_loop'];

/* ============================== ROUTING API ============================== */

const SA = ['SUPER_ADMIN'];
const VERIF = ['SUPER_ADMIN', 'VERIFIKATOR'];
const STAFF_ORDER = ['SUPER_ADMIN', 'VERIFIKATOR', 'STAF'];
const STAFF_GATE = ['GATE', 'SUPER_ADMIN'];

const ROUTES = {
  'auth.login': { fn: authLogin_ },
  'auth.logout': { roles: ROLES, fn: authLogout_ },
  'auth.me': { roles: ROLES, fn: function (p, s) { return { nama: s.nama, role: s.role, username: s.username }; } },

  'public.events': { fn: pubEvents_ },
  'public.event': { fn: pubEventDetail_ },
  'public.order': { fn: pubOrder_ },
  'public.proof': { fn: pubProof_ },
  'public.status': { fn: pubStatus_ },

  'dash.get': { roles: SA, fn: dashGet_ },
  'event.list': { roles: STAFF_ORDER, fn: eventList_ },
  'event.save': { roles: SA, fn: eventSave_ },
  'event.delete': { roles: SA, fn: eventDelete_ },
  'event.toggleReg': { roles: SA, fn: eventToggleReg_ },
  'type.save': { roles: SA, fn: typeSave_ },
  'type.delete': { roles: SA, fn: typeDelete_ },
  'video.create': { roles: SA, fn: videoCreate_ },
  'video.check': { roles: SA, fn: videoCheck_ },

  'user.list': { roles: SA, fn: userList_ },
  'user.save': { roles: SA, fn: userSave_ },
  'user.toggle': { roles: SA, fn: userToggle_ },
  'user.reset': { roles: SA, fn: userReset_ },
  'admin.sessions': { roles: SA, fn: activeSessions_ },

  'order.list': { roles: STAFF_ORDER, fn: orderList_ },
  'order.proof': { roles: VERIF, fn: orderProof_ },
  'order.accept': { roles: VERIF, fn: orderAccept_ },
  'order.reject': { roles: VERIF, fn: orderReject_ },
  'order.resend': { roles: STAFF_ORDER, fn: orderResend_ },
  'order.tickets': { roles: STAFF_ORDER, fn: orderTickets_ },

  'scan.list': { roles: SA, fn: scanList_ },
  'report.export': { roles: SA, fn: reportExport_ },
  'settings.get': { roles: STAFF_ORDER, fn: settingsGet_ },
  'settings.save': { roles: SA, fn: settingsSave_ },

  'gate.events': { roles: STAFF_GATE, fn: gateEvents_ },
  'gate.scan': { roles: STAFF_GATE, fn: gateScan_ },
  'gate.checkin': { roles: STAFF_GATE, fn: gateCheckin_ },
  'gate.stats': { roles: STAFF_GATE, fn: gateStats_ },

  'racesack.register': { roles: STAFF_ORDER, fn: raceSackRegister_ },
  'racesack.list': { roles: STAFF_ORDER, fn: raceSackList_ },
  'racesack.boot': { roles: STAFF_ORDER, fn: raceSackBoot_ },
  'racesack.toggle': { roles: SA, fn: raceSackToggle_ },
  'racesack.update': { roles: STAFF_ORDER, fn: raceSackUpdate_ },
  'racesack.delete': { roles: SA, fn: raceSackDelete_ }
};

/** Satu-satunya pintu masuk dari klien (google.script.run.api). Selalu mengembalikan {ok, data|error}. */
function api(action, token, payload) {
  try {
    const r = ROUTES[String(action)];
    if (!r) throw userErr_('Aksi tidak dikenal.');
    let sess = null;
    if (r.roles) {
      sess = getSession_(token);
      if (!sess) throw userErr_('Sesi berakhir. Silakan login kembali.', 'AUTH');
      if (r.roles.indexOf(sess.role) < 0) throw userErr_('Anda tidak memiliki akses untuk aksi ini.', 'FORBIDDEN');
    }
    const data = r.fn(payload || {}, sess, token);
    return { ok: true, data: data === undefined ? null : data,
};
  } catch (e) {
    if (e && e.user) return { ok: false, error: e.message, code: e.code || '',
};
    console.error((e && e.stack) || e);
    return { ok: false, error: 'Terjadi kesalahan pada server. Silakan coba lagi.',
};
  }
}

/* ============================== WEB APP ENTRY ============================== */

function doGet(e) {
  try {
    const st = settings_();
    const pageParam = String((e && e.parameter && e.parameter.page) || '').trim().toLowerCase();
    const isAdminPage = pageParam === 'admin';
    const t = HtmlService.createTemplateFromFile(isAdminPage ? 'Admin' : 'Index');
    const startEvent = !isAdminPage && e && e.parameter && /^[A-Za-z0-9-]{3,40}$/.test(e.parameter.event || '') ? e.parameter.event : '';
    t.boot = JSON.stringify({
      org: st.nama_organisasi, warna: st.warna_utama, aksen: st.warna_aksen, latar: st.warna_latar,
      logo: st.logo_url, qris: st.qris_url || '', kontak: st.kontak_panitia, url: ScriptApp.getService().getUrl() || '',
      maxQty: Number(st.max_tiket_per_order) || 10, startEvent: startEvent,
      musik: st.musik_url || '', musikLoop: String(st.musik_loop || '').toUpperCase() === 'YA', musikNama: st.musik_nama || ''
    }).replace(/</g, '\\u003c');
    return t.evaluate()
      .setTitle(st.nama_organisasi + (isAdminPage ? ' - Admin' : ' - Tiket Kegiatan'))
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    console.error(err);
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:24px">Sistem belum siap. ' +
      'Admin: jalankan fungsi <b>setupDatabase()</b> dari editor Apps Script, lalu deploy ulang.</p>');
  }
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* ============================== SETUP DATABASE ============================== */

/** Jalankan SEKALI dari editor Apps Script. Aman dijalankan ulang (idempoten). */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Jalankan dari Apps Script yang dibuat lewat Spreadsheet (Extensions > Apps Script).');
  PropertiesService.getScriptProperties().setProperty('SS_ID', ss.getId());
  _ss = ss;

  Object.keys(SCHEMA).forEach(function (name) {
    const def = SCHEMA[name];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getMaxColumns() < def.cols.length) sh.insertColumnsAfter(sh.getMaxColumns(), def.cols.length - sh.getMaxColumns());
    def.cols.forEach(function (c, i) {
      if (def.num.indexOf(c) < 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols]).setFontWeight('bold').setBackground('#e8eefc');
    sh.setFrozenRows(1);
  });

  ['Sheet1', 'Lembar1', 'Sheet 1'].forEach(function (n) {
    const d = ss.getSheetByName(n);
    if (d && ss.getSheets().length > 1 && d.getLastRow() === 0) ss.deleteSheet(d);
  });

  // Settings default (tidak menimpa yang sudah ada)
  const have = {};
  readAll_('Settings').forEach(function (r) { have[r.key] = true; });
  const add = [];
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    if (!have[k]) add.push({ key: k, value: DEFAULT_SETTINGS[k] });
  });
  appendRows_('Settings', add);
  CacheService.getScriptCache().remove('SETTINGS_V1');

  // Folder Drive
  const folderKeys = [['folder_poster_id', 'Poster'], ['folder_bukti_id', 'Bukti Bayar'], ['folder_video_id', 'Video Promo'], ['folder_musik_id', 'Lagu']];
  folderKeys.forEach(function (fk) {
    const cur = settings_();
    let ok = false;
    if (cur[fk[0]]) { try { DriveApp.getFolderById(cur[fk[0]]); ok = true; } catch (e) { ok = false; } }
    if (!ok) setSetting_(fk[0], DriveApp.createFolder('Tiket - ' + fk[1] + ' (' + ss.getName() + ')').getId());
  });

  // Akun Super Admin: pastikan admin109 tersedia dan status lama (TRUE/FALSE) dirapikan.
  let msg = 'Database siap.';

  readAll_('Users').forEach(function (u) {
    const raw = String(u.status_aktif || '').trim().toUpperCase();
    let next = '';
    if (['TRUE', '1', 'YA', 'AKTIF', 'ACTIVE'].indexOf(raw) >= 0) next = 'AKTIF';
    else if (['FALSE', '0', 'TIDAK', 'NONAKTIF', 'INACTIVE'].indexOf(raw) >= 0) next = 'NONAKTIF';
    if (next && next !== u.status_aktif) { u.status_aktif = next; updateRow_('Users', u); }
  });

  const pw = '20224092';
  const adminUser = readAll_('Users').filter(function (u) { return u.username === 'admin109'; })[0];
  if (!adminUser) {
    appendRows_('Users', [{
      user_id: 'USR-' + randHex_(6), nama: 'Super Admin', username: 'admin109',
      password_hash: makeHash_(pw), role: 'SUPER_ADMIN', status_aktif: 'AKTIF', dibuat_pada: nowStr_()
    }]);
    msg += '\n\nAKUN SUPER ADMIN\nUsername: admin109\nPassword: ' + pw +
      '\n\nCatat password ini lalu segera ganti lewat menu Pengguna > Reset Password.';
  } else {
    adminUser.role = 'SUPER_ADMIN';
    adminUser.status_aktif = 'AKTIF';
    if (!checkPw_(pw, adminUser.password_hash)) adminUser.password_hash = makeHash_(pw);
    updateRow_('Users', adminUser);
    msg += '\n\nAKUN SUPER ADMIN\nUsername: admin109\nPassword: ' + pw +
      '\n\nPassword admin109 disetel ulang. Segera ganti lewat menu Pengguna > Reset Password.';
  }
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* konteks tanpa UI: lihat Execution log */ }
  return msg;
}

/** Opsional: pasang trigger otomatis (batalkan pesanan kedaluwarsa tiap jam, polling video tiap 5 menit). */
function installTriggers() {
  const handlers = ['expireUnpaidOrders', 'pollVideoOperations'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('expireUnpaidOrders').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('pollVideoOperations').timeBased().everyMinutes(5).create();
  Logger.log('Trigger terpasang.');
}

function expireUnpaidOrders() {
  withLock_(function () { expireUnpaid_(true); });
}

/* ============================== HELPER DATA ============================== */

let _ss = null;

function ss_() {
  if (_ss) return _ss;
  const id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  _ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!_ss) throw new Error('Spreadsheet tidak ditemukan');
  return _ss;
}

// Cache per-eksekusi: sheet object, status kolom, dan isi sheet.
// Tujuan: satu permintaan API cukup sekali membaca tiap sheet, tidak berulang.
const _sheets = {};
const _colsOk = {};
const _mem = {};

function sheet_(name) {
  let sh = _sheets[name];
  if (!sh) {
    sh = ss_().getSheetByName(name);
    if (!sh) throw new Error('Sheet ' + name + ' belum ada. Jalankan setupDatabase().');
    _sheets[name] = sh;
  }
  // Kolom baru (mis. RacePack.ticket_id) ditambahkan otomatis agar sheet lama tidak membuat baca/tulis gagal.
  const def = SCHEMA[name];
  if (def && !_colsOk[name]) {
    const max = sh.getMaxColumns();
    if (max < def.cols.length) sh.insertColumnsAfter(max, def.cols.length - max);
    _colsOk[name] = true;
  }
  return sh;
}

function tz_() { return Session.getScriptTimeZone() || 'Asia/Jakarta'; }
function nowStr_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm:ss'); }
function nowMin_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm'); }

function norm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd HH:mm:ss');
  return v;
}

function toObj_(def, row, rowNum) {
  const o = { _row: rowNum,
};
  for (let j = 0; j < def.cols.length; j++) {
    const c = def.cols[j];
    let v = norm_(row[j]);
    if (def.num.indexOf(c) >= 0) v = Number(v) || 0;
    else v = (v === null || v === undefined) ? '' : String(v);
    o[c] = v;
  }
  return o;
}

/** Buang cache sheet setelah ada penulisan, agar baca berikutnya mengambil data terbaru. */
function invalidate_(name) {
  delete _mem[name];
}

function readAll_(name) {
  if (_mem[name]) return _mem[name];
  const def = SCHEMA[name], sh = sheet_(name), last = sh.getLastRow();
  if (last < 2) { _mem[name] = []; return _mem[name]; }
  const vals = sh.getRange(2, 1, last - 1, def.cols.length).getValues();
  const out = [];
  for (let i = 0; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] === null) continue;
    out.push(toObj_(def, vals[i], i + 2));
  }
  _mem[name] = out;
  return out;
}

function appendRows_(name, objs) {
  if (!objs || !objs.length) return;
  const def = SCHEMA[name], sh = sheet_(name);
  const start = sh.getLastRow() + 1, need = start + objs.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 100);
  sh.getRange(start, 1, objs.length, def.cols.length).setValues(objs.map(function (o) {
    return def.cols.map(function (c) { return o[c] === undefined || o[c] === null ? '' : o[c]; });
  }));
  invalidate_(name);
}

function updateRow_(name, o) {
  const def = SCHEMA[name];
  sheet_(name).getRange(o._row, 1, 1, def.cols.length).setValues([def.cols.map(function (c) {
    return o[c] === undefined || o[c] === null ? '' : o[c];
  })]);
  invalidate_(name);
}

function colIdx_(name, col) { return SCHEMA[name].cols.indexOf(col) + 1; }

/** Cari 1 baris berdasarkan nilai kolom (memakai cache baca sheet). */
function findBy_(name, col, val) {
  if (val === undefined || val === null || val === '') return null;
  const def = SCHEMA[name];
  if (!def || def.cols.indexOf(col) < 0) return null;
  const v = String(val), rows = readAll_(name);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][col]) === v) return rows[i];
  }
  return null;
}

function findAllBy_(name, col, val) {
  if (val === undefined || val === null || val === '') return [];
  const def = SCHEMA[name];
  if (!def || def.cols.indexOf(col) < 0) return [];
  const v = String(val);
  return readAll_(name).filter(function (x) { return String(x[col]) === v; });
}

function deleteRows_(name, rowNums) {
  const sh = sheet_(name);
  rowNums.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  invalidate_(name);
}

function indexBy_(arr, key) {
  const m = {};
  arr.forEach(function (x) { m[x[key]] = x; });
  return m;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw userErr_('Sistem sedang sibuk. Silakan coba lagi sesaat lagi.');
  try { return fn(); } finally { lock.releaseLock(); }
}

function userErr_(msg, code) {
  const e = new Error(msg);
  e.user = true;
  e.code = code || '';
  return e;
}

/* ============================== SETTINGS ============================== */

function settings_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('SETTINGS_V1');
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* lanjut baca sheet */ } }
  const out = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
  readAll_('Settings').forEach(function (r) { out[r.key] = r.value; });
  cache.put('SETTINGS_V1', JSON.stringify(out), 300);
  return out;
}

function setSetting_(key, value) {
  const rows = readAll_('Settings');
  const r = rows.filter(function (x) { return x.key === key; })[0];
  if (r) { r.value = String(value); updateRow_('Settings', r); }
  else appendRows_('Settings', [{ key: key, value: String(value) }]);
  CacheService.getScriptCache().remove('SETTINGS_V1');
}

function settingsGet_() {
  const st = settings_(), out = {};
  EDITABLE_SETTINGS.forEach(function (k) { out[k] = st[k]; });
  // Field musik hanya diubah lewat unggahan, bukan input teks biasa.
  out.musik_url = st.musik_url || '';
  out.musik_nama = st.musik_nama || '';
  return out;
}

/** Daftar kolom data race pack yang dipakai form pendaftaran & pembagian. */
function racepackFieldsList_() {
  let arr;
  try { arr = JSON.parse(settings_().racepack_fields || '[]'); } catch (e) { arr = []; }
  if (!Array.isArray(arr) || !arr.length) {
    arr = [{ key: 'nama_pemegang', label: 'Nama', required: false }, { key: 'tgl_lahir', label: 'Tanggal Lahir', required: false }, { key: 'no_hp', label: 'No HP', required: false }];
  }
  return arr.map(function (f) {
    if (Array.isArray(f)) return { key: String(f[0]), label: String(f[1] || f[0]), required: false };
    return { key: String(f.key || ''), label: String(f.label || f.key || ''), required: f.required === true || String(f.required || '').toUpperCase() === 'YA' };
  }).filter(function (f) { return f.key; });
}

/** Race pack (permintaan data peserta) aktif untuk kegiatan ini? */
function racepackAktif_(ev) {
  return String((ev && ev.racepack_aktif) || '').trim().toUpperCase() === 'YA';
}

/** Apakah seluruh kolom data race pack wajib diisi pendaftar? */
function racepackFieldsRequired_() {
  return String(settings_().racepack_fields_required || 'TIDAK').trim().toUpperCase() === 'YA';
}

function normalizeRacepackFields_(raw) {
  let arr;
  try { arr = JSON.parse(String(raw || '[]')); }
  catch (e) { throw userErr_('Format kolom race pack harus berupa JSON array.'); }
  if (!Array.isArray(arr)) throw userErr_('Kolom race pack harus berupa array.');
  const out = [], seen = {};
  arr.forEach(function (f) {
    let key = '', label = '', required = false;
    if (Array.isArray(f)) { key = f[0]; label = f[1]; }
    else if (f && typeof f === 'object') { key = f.key; label = f.label; required = f.required === true || String(f.required || '').toUpperCase() === 'YA'; }
    key = String(key || '').replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push({ key: key, label: String(label || key).slice(0, 60), required });
  });
  if (!out.length) throw userErr_('Minimal satu kolom data race pack.');
  return JSON.stringify(out);
}

function settingsSave_(p) {
  return withLock_(function () {
    const v = p.values || {};
    EDITABLE_SETTINGS.forEach(function (k) {
      if (v[k] === undefined) return;
      let val;
      if (k === 'racepack_info') val = cleanMl_(v[k], 3000);
      else if (k === 'racepack_fields') val = normalizeRacepackFields_(v[k]);
      else val = clean_(v[k], 500);
      if (k === 'warna_utama' || k === 'warna_aksen') {
        const solid = /^#[0-9a-fA-F]{6}$/.test(val);
        const grad = /^linear-gradient\(\s*\d{1,3}deg\s*,\s*#[0-9a-fA-F]{6}\s*,\s*#[0-9a-fA-F]{6}\s*\)$/i.test(val);
        if (!solid && !grad) throw userErr_('Warna harus berformat #RRGGBB atau gradien linear dua warna.');
      }
      if (k === 'warna_latar' && !/^#[0-9a-fA-F]{6}$/.test(val)) {
        throw userErr_('Warna latar harus berformat #RRGGBB.');
      }
      if (k === 'max_tiket_per_order') {
        val = String(Math.max(1, Math.min(50, parseInt(val, 10) || 10)));
      }
      if (k === 'batas_bayar_jam') {
        val = String(Math.max(1, Math.min(720, parseInt(val, 10) || 24)));
      }
      if (k === 'video_pakai_poster') val = val === 'YA' ? 'YA' : 'TIDAK';
      if (k === 'musik_loop') val = val === 'YA' ? 'YA' : 'TIDAK';
      if (k === 'logo_url' && val && !/^https:\/\//i.test(val)) throw userErr_('URL logo harus diawali https://');
      if (k === 'qris_url' && val && !/^https:\/\//i.test(val)) throw userErr_('URL gambar QRIS harus diawali https://');
      setSetting_(k, val);
    });
    applyQris_(p);
    applyMusic_(p);
    return settingsGet_();
  });
}

/** Simpan / hapus gambar QRIS pembayaran (khusus administrator). */
function applyQris_(p) {
  const st = settings_();
  if (p.qris_hapus) {
    if (st.qris_file_id) { try { DriveApp.getFileById(st.qris_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
    setSetting_('qris_url', '');
    setSetting_('qris_file_id', '');
    return;
  }
  if (!p.qris || !p.qris.b64) return;
  const blob = decodeImage_(p.qris.b64, p.qris.mime, 'qris-' + Date.now(), 'gambar QRIS');
  let folder;
  try { folder = DriveApp.getFolderById(st.folder_qris_id); }
  catch (e) { folder = DriveApp.createFolder('Tiket - QRIS'); setSetting_('folder_qris_id', folder.getId()); }
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  if (st.qris_file_id) { try { DriveApp.getFileById(st.qris_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
  setSetting_('qris_file_id', file.getId());
  setSetting_('qris_url', 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200');
}

/** Simpan / hapus lagu landing page. Sumber bisa URL GitHub (raw) atau file unggahan Drive. */
function applyMusic_(p) {
  const st = settings_();
  if (p.musik_hapus) {
    if (st.musik_file_id) { try { DriveApp.getFileById(st.musik_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
    setSetting_('musik_url', '');
    setSetting_('musik_file_id', '');
    setSetting_('musik_nama', '');
    return;
  }
  if (p.musik_url !== undefined && p.musik_url !== null) {
    let url = clean_(p.musik_url, 500);
    if (!url) return;
    if (!/^https:\/\//i.test(url)) throw userErr_('URL lagu harus diawali https://');
    // Tautan file GitHub biasa diubah ke raw agar bisa diputar langsung.
    url = url.replace(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i, 'https://raw.githubusercontent.com/$1/$2/$3');
    const nama = clean_(safeDecodeURIComponent_(url.split('?')[0].split('#')[0].split('/').pop()), 120) || 'Lagu landing page';
    if (st.musik_file_id) { try { DriveApp.getFileById(st.musik_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
    setSetting_('musik_file_id', '');
    setSetting_('musik_url', url);
    setSetting_('musik_nama', nama);
    return;
  }
  if (!p.musik || !p.musik.b64) return;
  const blob = decodeAudio_(p.musik.b64, p.musik.mime, p.musik.name);
  let folder;
  try { folder = DriveApp.getFolderById(st.folder_musik_id); }
  catch (e) { folder = DriveApp.createFolder('Tiket - Lagu'); setSetting_('folder_musik_id', folder.getId()); }
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  if (st.musik_file_id) { try { DriveApp.getFileById(st.musik_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
  setSetting_('musik_file_id', file.getId());
  setSetting_('musik_url', 'https://drive.google.com/uc?export=download&id=' + file.getId());
  setSetting_('musik_nama', clean_(p.musik.name, 120) || file.getName());
}

function safeDecodeURIComponent_(s) {
  try { return decodeURIComponent(String(s || '')); } catch (e) { return String(s || ''); }
}

/* ============================== UTILITAS ============================== */

function clean_(v, max) {
  return String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 200);
}

function cleanMl_(v, max) {
  return String(v === null || v === undefined ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max || 2000);
}

function esc_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function randHex_(n) {
  let s = '';
  while (s.length < n) s += Utilities.getUuid().replace(/-/g, '');
  return s.substring(0, n).toUpperCase();
}

function randPass_(n) {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const hex = randHex_(n * 2);
  let out = '';
  for (let i = 0; i < n; i++) out += alpha.charAt(parseInt(hex.substr(i * 2, 2), 16) % alpha.length);
  return out;
}

function ticketId_() {
  const h = randHex_(12);
  return h.substr(0, 4) + '-' + h.substr(4, 4) + '-' + h.substr(8, 4);
}

function normPhone_(v) { return String(v || '').replace(/\D/g, ''); }

function rupiah_(n) { return 'Rp' + Number(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

function parseDT_(v, endOfDay) {
  let s = clean_(v, 30).replace('T', ' ');
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += endOfDay ? ' 23:59' : ' 00:00';
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return null;
  return s.substr(0, 16);
}

function saleStatus_(t) {
  const now = nowMin_();
  const buka = parseDT_(t.tanggal_buka, false) || '';
  const tutup = parseDT_(t.tanggal_tutup, true) || '';
  if (buka && now < buka) return 'BELUM';
  if (tutup && now > tutup) return 'TUTUP';
  if (t.kuota - t.terjual <= 0) return 'HABIS';
  return 'BUKA';
}

function throttle_(key, max) {
  const n = Number(CacheService.getScriptCache().get(key) || 0);
  if (n >= max) throw userErr_('Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
}

function hit_(key, ttl) {
  const c = CacheService.getScriptCache();
  c.put(key, String(Number(c.get(key) || 0) + 1), ttl);
}

function driveId_(url) {
  const m = String(url || '').match(/[-\w]{25,}/);
  return m ? m[0] : '';
}

/** Validasi & decode gambar JPG/PNG dari base64 (cek ukuran + magic number). */
function decodeImage_(b64, mime, name, label) {
  if (!b64) throw userErr_('File ' + label + ' belum dipilih.');
  if (mime !== 'image/jpeg' && mime !== 'image/png') throw userErr_('File ' + label + ' harus JPG atau PNG.');
  let bytes;
  try { bytes = Utilities.base64Decode(String(b64)); } catch (e) { throw userErr_('File tidak valid.'); }
  if (bytes.length > MAX_IMG_MB * 1024 * 1024) throw userErr_('Ukuran file ' + label + ' maksimal ' + MAX_IMG_MB + ' MB.');
  const b = bytes.slice(0, 4).map(function (x) { return x & 255; });
  const isJpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
  const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
  if ((mime === 'image/jpeg' && !isJpg) || (mime === 'image/png' && !isPng)) throw userErr_('Isi file tidak sesuai format gambar.');
  const ext = mime === 'image/png' ? '.png' : '.jpg';
  return Utilities.newBlob(bytes, mime, (name || 'file') + ext);
}

function decodeAudio_(b64, mime, name) {
  if (!b64) throw userErr_('File lagu belum dipilih.');
  const m = String(mime || '').toLowerCase();
  if (!/^audio\/[a-z0-9.+-]+$/.test(m)) throw userErr_('File lagu harus berformat audio (MP3, M4A, WAV, atau OGG).');
  let bytes;
  try { bytes = Utilities.base64Decode(String(b64)); } catch (e) { throw userErr_('File lagu tidak valid.'); }
  if (bytes.length > 15 * 1024 * 1024) throw userErr_('Ukuran file lagu maksimal 15 MB.');
  const ext = m.indexOf('mpeg') >= 0 || m.indexOf('mp3') >= 0 ? '.mp3'
    : m.indexOf('mp4') >= 0 || m.indexOf('m4a') >= 0 ? '.m4a'
      : m.indexOf('ogg') >= 0 ? '.ogg'
        : m.indexOf('wav') >= 0 ? '.wav' : '';
  return Utilities.newBlob(bytes, m, clean_(name, 80) || ('lagu-' + Date.now() + ext));
}

/** Simpan/hapus background kegiatan (halaman utama atau tiket). */
function applyBg_(ev, urlKey, fileKey, img, hapus) {
  if (hapus) {
    if (ev[fileKey]) { try { DriveApp.getFileById(ev[fileKey]).setTrashed(true); } catch (e) { /* abaikan */ } }
    ev[fileKey] = '';
    ev[urlKey] = '';
    return;
  }
  if (!img || !img.b64) return;
  const folder = DriveApp.getFolderById(settings_().folder_poster_id);
  const file = folder.createFile(decodeImage_(img.b64, img.mime, 'bg_' + Date.now(), 'background'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  if (ev[fileKey]) { try { DriveApp.getFileById(ev[fileKey]).setTrashed(true); } catch (e) { /* abaikan */ } }
  ev[fileKey] = file.getId();
  ev[urlKey] = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600';
}

/** Simpan/hapus gambar panduan ukuran kaos untuk satu kegiatan. */
function applyKaos_(ev, img, hapus) {
  if (hapus) {
    if (ev.ukuran_kaos_file_id) { try { DriveApp.getFileById(ev.ukuran_kaos_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
    ev.ukuran_kaos_file_id = '';
    ev.ukuran_kaos_url = '';
    return;
  }
  if (!img || !img.b64) return;
  const st = settings_();
  let folder;
  try { folder = DriveApp.getFolderById(st.folder_kaos_id); }
  catch (e) { folder = DriveApp.createFolder('Tiket - Kaos'); setSetting_('folder_kaos_id', folder.getId()); }
  const file = folder.createFile(decodeImage_(img.b64, img.mime, 'ukuran-kaos-' + Date.now(), 'gambar ukuran kaos'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  if (ev.ukuran_kaos_file_id) { try { DriveApp.getFileById(ev.ukuran_kaos_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
  ev.ukuran_kaos_file_id = file.getId();
  ev.ukuran_kaos_url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200';
}

/* ============================== PASSWORD & SESSION ============================== */

function hash_(pw, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pw, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function makeHash_(pw) {
  const salt = randHex_(24);
  return salt + '$' + hash_(pw, salt);
}

function checkPw_(pw, stored) {
  const p = String(stored || '').split('$');
  if (p.length !== 2) return false;
  const a = hash_(pw, p[0]), b = p[1];
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function authLogin_(p) {
  const uname = clean_(p.username, 40).toLowerCase();
  const pw = String(p.password || '');
  if (!uname || !pw) throw userErr_('Isi username dan password.');
  const key = 'LF_' + uname;
  throttle_(key, 5);
  const u = readAll_('Users').filter(function (x) { return x.username === uname; })[0];
  const ok = u && u.status_aktif === 'AKTIF' && checkPw_(pw, u.password_hash);
  if (!ok) {
    hit_(key, 600);
    throw userErr_('Username atau password salah, atau akun nonaktif.');
  }
  CacheService.getScriptCache().remove(key);
  const token = randHex_(64).toLowerCase();
  const deviceRaw = clean_(p.device || p.user_agent || '', 300);
  const now = nowStr_();
  const sess = {
    uid: u.user_id, nama: u.nama, username: u.username, role: u.role,
    device: deviceLabel_(deviceRaw), device_raw: deviceRaw,
    login_at: now, last_seen: now
  };
  const cache = CacheService.getScriptCache();
  cache.put('S_' + token, JSON.stringify(sess), SESSION_TTL);
  let list = [];
  try { list = JSON.parse(cache.get('UT_' + u.user_id) || '[]'); } catch (e) { list = []; }
  list.push(token);
  cache.put('UT_' + u.user_id, JSON.stringify(list.slice(-20)), SESSION_TTL);
  registerSession_(token);
  return { token: token, user: { nama: u.nama, role: u.role, username: u.username } };
}

function authLogout_(p, s, token) {
  CacheService.getScriptCache().remove('S_' + token);
  unregisterSession_(token);
  return true;
}

function getSession_(token) {
  if (!/^[0-9a-f]{64}$/.test(String(token || ''))) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get('S_' + token);
  if (!raw) return null;
  let sess;
  try { sess = JSON.parse(raw); } catch (e) { return null; }
  sess.last_seen = nowStr_();
  cache.put('S_' + token, JSON.stringify(sess), SESSION_TTL); // perpanjang (idle timeout bergulir)
  registerSession_(token); // jaga registry tetap hidup selama sesi aktif
  return sess;
}

/** Registry token sesi aktif. Disimpan di Script Properties agar tidak ikut kedaluwarsa cache. */
function sessionRegistry_() {
  try {
    const arr = JSON.parse(PropertiesService.getScriptProperties().getProperty('SESSION_TOKENS') || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function saveSessionRegistry_(tokens) {
  PropertiesService.getScriptProperties().setProperty('SESSION_TOKENS', JSON.stringify(tokens.slice(-100)));
}

function registerSession_(token) {
  try {
    const list = sessionRegistry_();
    if (list.indexOf(token) < 0) { list.push(token); saveSessionRegistry_(list); }
  } catch (e) { console.error(e); }
}

function unregisterSession_(token) {
  try {
    const list = sessionRegistry_().filter(function (t) { return t !== token; });
    saveSessionRegistry_(list);
  } catch (e) { console.error(e); }
}

/** Label perangkat ramah-baca dari User-Agent. */
function deviceLabel_(ua) {
  const s = String(ua || '');
  if (!s) return 'Perangkat tidak diketahui';
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(s);
  let os = 'Lainnya';
  if (/Windows/i.test(s)) os = 'Windows';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
  else if (/Mac OS X|Macintosh/i.test(s)) os = 'macOS';
  else if (/Linux/i.test(s)) os = 'Linux';
  let browser = 'Browser lain';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera';
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/Safari\//i.test(s)) browser = 'Safari';
  const jenis = /iPad|Tablet/i.test(s) ? 'Tablet' : mobile ? 'HP' : 'Desktop';
  return browser + ' - ' + os + ' - ' + jenis;
}

/** Daftar sesi login yang masih aktif, khusus Super Admin. */
function activeSessions_(p, s, token) {
  const cache = CacheService.getScriptCache();
  const reg = sessionRegistry_();
  const valid = [], sessions = [];
  reg.forEach(function (t) {
    const raw = cache.get('S_' + t);
    if (!raw) return;
    let x;
    try { x = JSON.parse(raw); } catch (e) { return; }
    valid.push(t);
    sessions.push({
      nama: x.nama || '', username: x.username || '', role: x.role || '',
      device: x.device || 'Perangkat tidak diketahui', login_at: x.login_at || '',
      last_seen: x.last_seen || x.login_at || '', current: t === token
    });
  });
  if (valid.length !== reg.length) {
    try { saveSessionRegistry_(valid); } catch (e) { console.error(e); }
  }
  sessions.sort(function (a, b) { return String(b.login_at).localeCompare(String(a.login_at)); });
  const unik = {};
  sessions.forEach(function (x) { unik[x.username] = 1; });
  const activeAccounts = readAll_('Users').filter(function (u) {
    return String(u.status_aktif || '').trim().toUpperCase() === 'AKTIF';
  }).length;
  return { total: sessions.length, accounts: Object.keys(unik).length, active_accounts: activeAccounts, sessions: sessions };
}

function revokeUserSessions_(uid) {
  const cache = CacheService.getScriptCache();
  let list = [];
  try { list = JSON.parse(cache.get('UT_' + uid) || '[]'); } catch (e) { list = []; }
  if (list.length) {
    cache.removeAll(list.map(function (t) { return 'S_' + t; }));
    try {
      const reg = sessionRegistry_().filter(function (t) { return list.indexOf(t) < 0; });
      saveSessionRegistry_(reg);
    } catch (e) { console.error(e); }
  }
  cache.remove('UT_' + uid);
}

/* ============================== PUBLIK ============================== */

function videoUrl_(ev) {
  return ev.video_file_id ? 'https://drive.google.com/file/d/' + ev.video_file_id + '/preview' : '';
}

function pubEventObj_(ev, types) {
  const mine = types.filter(function (t) { return t.event_id === ev.event_id; });
  const open = mine.filter(function (t) { return saleStatus_(t) === 'BUKA'; });
  const pool = open.length ? open : mine;
  let min = null;
  pool.forEach(function (t) { if (min === null || t.harga < min) min = t.harga; });
  const st = settings_();
  const rpOn = racepackAktif_(ev);
  return {
    event_id: ev.event_id, nama_kegiatan: ev.nama_kegiatan, jenis: ev.jenis, deskripsi: ev.deskripsi,
    tanggal: ev.tanggal, jam: ev.jam, lokasi: ev.lokasi, poster_url: ev.poster_url, video_url: videoUrl_(ev),
    harga_mulai: min, tersedia: open.length > 0,
    racepack_aktif: rpOn,
    racepack_info: rpOn ? (st.racepack_info || '') : '',
    ukuran_kaos_url: rpOn ? (ev.ukuran_kaos_url || '') : '',
    bg_halaman_url: ev.bg_halaman_url || ''
};
}

function pubEvents_() {
  const types = readAll_('TicketTypes');
  return readAll_('Events').filter(function (e) { return e.status === 'AKTIF'; })
    .sort(function (a, b) { return (a.tanggal + a.jam) < (b.tanggal + b.jam) ? -1 : 1; })
    .map(function (e) { return pubEventObj_(e, types); });
}

function pubEventDetail_(p) {
  const ev = findBy_('Events', 'event_id', clean_(p.event_id, 40));
  if (!ev || ev.status !== 'AKTIF') throw userErr_('Kegiatan tidak ditemukan atau belum dibuka.');
  const types = readAll_('TicketTypes').filter(function (t) { return t.event_id === ev.event_id; });
  const o = pubEventObj_(ev, types);
  o.tipe = types.map(function (t) {
    return {
      type_id: t.type_id, nama_tiket: t.nama_tiket, harga: t.harga, sisa: Math.max(0, t.kuota - t.terjual),
      isi_tiket: Math.max(1, Number(t.isi_tiket) || 1),
      status: saleStatus_(t), tanggal_buka: t.tanggal_buka, tanggal_tutup: t.tanggal_tutup
   ,
};
  });
  o.max_qty = Number(settings_().max_tiket_per_order) || 10;
  const requiredAll = racepackFieldsRequired_();
  o.racepack_fields = racepackAktif_(ev)
    ? racepackFieldsList_().map(function (f) { return { key: f.key, label: f.label, required: requiredAll || f.required }; })
    : [];
  return o;
}

function newOrderId_(existing) {
  const d = Utilities.formatDate(new Date(), tz_(), 'yyMMdd');
  for (let i = 0; i < 20; i++) {
    const id = 'TKT-' + d + '-' + randHex_(4);
    if (!existing[id]) return id;
  }
  throw new Error('Gagal membuat ID pesanan');
}

function newPackId_(existing) {
  const d = Utilities.formatDate(new Date(), tz_(), 'yyMMdd');
  for (let i = 0; i < 20; i++) {
    const id = 'RPK-' + d + '-' + randHex_(4);
    if (!existing[id]) return id;
  }
  throw new Error('Gagal membuat ID pack');
}

/** Rapikan data peserta yang dikirim pendaftar: satu entri per tiket. */
function normalizePeserta_(raw, jumlah, fallbackNama, fields) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (let i = 0; i < jumlah; i++) {
    const src = arr[i] || {};
    const nama = clean_(src.nama, 100) || fallbackNama;
    const dataIn = (src.data && typeof src.data === 'object') ? src.data : {};
    const data = {};
    (fields || []).forEach(function (f) {
      const v = clean_(dataIn[f.key], 120);
      if (v) { data[f.key] = v; return; }
      if (f.required && f.key !== 'nama_pemegang') {
        throw userErr_('Data peserta wajib diisi: ' + (f.label || f.key) + ' (peserta ' + (i + 1) + ').');
      }
    });
    out.push({ nama: nama, data: data });
  }
  return out;
}

function pubOrder_(p) {
  const nama = clean_(p.nama, 100);
  const email = clean_(p.email, 120).toLowerCase();
  let hp = normPhone_(p.no_hp);
  const jumlahIn = parseInt(p.jumlah, 10);
  const paketIn = parseInt(p.paket, 10);
  const st = settings_();
  const maxQty = Number(st.max_tiket_per_order) || 10;
  // Nomor pembeli boleh kosong bila nomor peserta sudah diisi.
  if (!hp && Array.isArray(p.peserta)) {
    p.peserta.some(function (ps) {
      const d = (ps && ps.data) || {};
      const cand = normPhone_(d.no_hp || d.noHP || d.telepon || d.telp || '');
      if (cand.length >= 8 && cand.length <= 16) { hp = cand; return true; }
      return false;
    });
  }
  if (nama.length < 2) throw userErr_('Nama pembeli wajib diisi.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw userErr_('Format email tidak valid.');
  if (hp && (hp.length < 8 || hp.length > 16)) throw userErr_('Nomor HP tidak valid: gunakan 8-16 angka, contoh 081234567890.');
  if (!(jumlahIn >= 1)) throw userErr_('Jumlah tiket wajib diisi.');
  const tkey = 'OC_' + email;
  throttle_(tkey, 6);

  const result = withLock_(function () {
    expireUnpaid_(false);
    const ev = findBy_('Events', 'event_id', clean_(p.event_id, 40));
    if (!ev || ev.status !== 'AKTIF') throw userErr_('Kegiatan tidak tersedia untuk pembelian.');
    const t = findBy_('TicketTypes', 'type_id', clean_(p.type_id, 40));
    if (!t || t.event_id !== ev.event_id) throw userErr_('Jenis tiket tidak valid.');
    const ss = saleStatus_(t);
    if (ss === 'BELUM') throw userErr_('Penjualan tiket ini belum dibuka.');
    if (ss === 'TUTUP') throw userErr_('Penjualan tiket ini sudah ditutup.');
    const isi = Math.max(1, parseInt(t.isi_tiket, 10) || 1);
    const paket = paketIn >= 1 ? paketIn : Math.max(1, Math.ceil(jumlahIn / isi));
    const jumlah = paket * isi;
    if (jumlah > maxQty) throw userErr_('Maksimal ' + Math.max(1, Math.floor(maxQty / isi)) + ' paket per pesanan.');
    if (t.kuota - t.terjual < jumlah) {
      throw userErr_(t.kuota - t.terjual <= 0 ? 'Maaf, tiket habis.' : 'Sisa tiket hanya ' + (t.kuota - t.terjual) + '.');
    }
    const existing = {};
    readAll_('Orders').forEach(function (o) { existing[o.order_id] = 1; });
    const total = t.harga * paket;
    const requiredAll = racepackFieldsRequired_();
    const rpFields = racepackAktif_(ev)
      ? racepackFieldsList_().map(function (f) { return { key: f.key, label: f.label, required: requiredAll || f.required }; })
      : [];
    const peserta = normalizePeserta_(p.peserta, jumlah, nama, rpFields);
    const o = {
      order_id: newOrderId_(existing), event_id: ev.event_id, type_id: t.type_id,
      nama_pembeli: nama, email: email, no_hp: hp, jumlah: jumlah, total_harga: total, paket: paket,
      bukti_bayar_url: '', status: total === 0 ? 'MENUNGGU_VERIFIKASI' : 'MENUNGGU_BAYAR',
      catatan: '', dibuat_pada: nowStr_(), diverifikasi_oleh: '', diverifikasi_pada: '',
      data_peserta: JSON.stringify(peserta)
   ,
};
    t.terjual += jumlah;
    updateRow_('TicketTypes', t);
    appendRows_('Orders', [o]);
    return {
      order_id: o.order_id, total_harga: total, jumlah: jumlah, paket: paket, isi_tiket: isi, status: o.status,
      nama_kegiatan: ev.nama_kegiatan, nama_tiket: t.nama_tiket,
      info_pembayaran: ev.info_pembayaran, batas_bayar_jam: Number(st.batas_bayar_jam) || 24,
      racepack_info: racepackAktif_(ev) ? (st.racepack_info || '') : ''
   ,
};
  });
  hit_(tkey, 3600);
  return result;
}

/** Batalkan pesanan MENUNGGU_BAYAR yang lewat batas waktu & kembalikan kuota. Panggil di dalam lock. */
function expireUnpaid_(force) {
  const cache = CacheService.getScriptCache();
  if (!force && cache.get('EXP_LAST')) return;
  cache.put('EXP_LAST', '1', 300);
  const jam = Number(settings_().batas_bayar_jam) || 24;
  const limit = Date.now() - jam * 3600 * 1000;
  const types = indexBy_(readAll_('TicketTypes'), 'type_id');
  const dirty = {};
  readAll_('Orders').forEach(function (o) {
    if (o.status !== 'MENUNGGU_BAYAR') return;
    let ts;
    try { ts = Utilities.parseDate(o.dibuat_pada, tz_(), 'yyyy-MM-dd HH:mm:ss').getTime(); } catch (e) { return; }
    if (ts > limit) return;
    o.status = 'BATAL';
    o.catatan = 'Dibatalkan otomatis: melewati batas waktu pembayaran';
    updateRow_('Orders', o);
    const t = types[o.type_id];
    if (t) { t.terjual = Math.max(0, t.terjual - o.jumlah); dirty[t.type_id] = t; }
  });
  Object.keys(dirty).forEach(function (k) { updateRow_('TicketTypes', dirty[k]); });
}

function ownOrder_(orderId, kontak) {
  const id = clean_(orderId, 40).toUpperCase();
  const k = clean_(kontak, 120).toLowerCase();
  if (!id || !k) throw userErr_('Isi ID pembelian dan email / nomor HP.');
  const key = 'OS_' + id;
  throttle_(key, 8);
  const o = findBy_('Orders', 'order_id', id);
  const kd = normPhone_(k);
  const match = o && (o.email === k || (kd.length >= 8 && o.no_hp === kd));
  if (!match) {
    hit_(key, 900);
    throw userErr_('Pesanan tidak ditemukan. Periksa ID pembelian dan email / nomor HP.');
  }
  return o;
}

function pubProof_(p) {
  const o = ownOrder_(p.order_id, p.kontak);
  if (['MENUNGGU_BAYAR', 'MENUNGGU_VERIFIKASI'].indexOf(o.status) < 0) {
    throw userErr_('Pesanan ini sudah diproses atau dibatalkan, tidak dapat menerima bukti baru.');
  }
  const blob = decodeImage_(p.file_b64, p.mime, o.order_id + '_' + Date.now(), 'bukti pembayaran');
  const folder = DriveApp.getFolderById(settings_().folder_bukti_id);
  const file = folder.createFile(blob);
  return withLock_(function () {
    const cur = findBy_('Orders', 'order_id', o.order_id);
    if (!cur || ['MENUNGGU_BAYAR', 'MENUNGGU_VERIFIKASI'].indexOf(cur.status) < 0) {
      try { file.setTrashed(true); } catch (e) { /* abaikan */ }
      throw userErr_('Status pesanan berubah. Muat ulang halaman.');
    }
    cur.bukti_bayar_url = file.getUrl();
    cur.status = 'MENUNGGU_VERIFIKASI';
    updateRow_('Orders', cur);
    return { order_id: cur.order_id, status: cur.status,
};
  });
}

function pubStatus_(p) {
  const o = ownOrder_(p.order_id, p.kontak);
  const ev = findBy_('Events', 'event_id', o.event_id) || {};
  const ty = findBy_('TicketTypes', 'type_id', o.type_id) || {};
  const res = {
    order_id: o.order_id, status: o.status, nama_pembeli: o.nama_pembeli, email: o.email,
    jumlah: o.jumlah, total_harga: o.total_harga, dibuat_pada: o.dibuat_pada,
    catatan: o.status === 'DITOLAK' || o.status === 'BATAL' ? o.catatan : '',
    sudah_upload: !!o.bukti_bayar_url,
    event: {
      event_id: ev.event_id, nama_kegiatan: ev.nama_kegiatan, tanggal: ev.tanggal, jam: ev.jam,
      lokasi: ev.lokasi, poster_url: ev.poster_url
    },
    nama_tiket: ty.nama_tiket || '-', tiket: [],
    racepack_info: racepackAktif_(ev) ? (settings_().racepack_info || '') : '',
    bg_tiket_url: ev.bg_tiket_url || ''
};
  if (o.status === 'MENUNGGU_BAYAR') res.info_pembayaran = ev.info_pembayaran || '';
  if (o.status === 'DITERIMA') {
    res.tiket = findAllBy_('Tickets', 'order_id', o.order_id).map(function (t) {
      return { ticket_id: t.ticket_id, nama_pemegang: t.nama_pemegang, status_checkin: t.status_checkin,
};
    });
  }
  return res;
}

/* ============================== DASHBOARD & LAPORAN ============================== */

function dashGet_(p) {
  const evId = clean_(p.event_id, 40);
  const events = readAll_('Events');
  const evMap = indexBy_(events, 'event_id');
  const types = readAll_('TicketTypes').filter(function (t) { return !evId || t.event_id === evId; });
  const orders = readAll_('Orders').filter(function (o) { return !evId || o.event_id === evId; });
  const tickets = readAll_('Tickets').filter(function (t) { return !evId || t.event_id === evId; });
  const acc = orders.filter(function (o) { return o.status === 'DITERIMA'; });

  let terjual = 0, pendapatan = 0, kuota = 0, reserved = 0;
  acc.forEach(function (o) { terjual += o.jumlah; pendapatan += o.total_harga; });
  types.forEach(function (t) { kuota += t.kuota; reserved += t.terjual; });
  const checkin = tickets.filter(function (t) { return t.status_checkin === 'SUDAH'; }).length;

  const perHari = {};
  acc.forEach(function (o) {
    const d = o.dibuat_pada.substr(0, 10);
    if (!perHari[d]) perHari[d] = { tanggal: d, tiket: 0, pendapatan: 0 };
    perHari[d].tiket += o.jumlah;
    perHari[d].pendapatan += o.total_harga;
  });
  const perTipe = types.map(function (t) {
    let n = 0, rp = 0;
    acc.forEach(function (o) { if (o.type_id === t.type_id) { n += o.jumlah; rp += o.total_harga; } });
    return {
      nama_tiket: t.nama_tiket, kegiatan: (evMap[t.event_id] || {}).nama_kegiatan || '-', harga: t.harga,
      kuota: t.kuota, terjual: n, sisa: Math.max(0, t.kuota - t.terjual), pendapatan: rp
   ,
};
  });
  return {
    events: events.map(function (e) { return { event_id: e.event_id, nama_kegiatan: e.nama_kegiatan,
}; }),
    ringkasan: {
      tiket_terjual: terjual, pendapatan: pendapatan, sisa_kuota: Math.max(0, kuota - reserved), total_kuota: kuota,
      total_tiket: tickets.length, checkin: checkin,
      menunggu_verifikasi: orders.filter(function (o) { return o.status === 'MENUNGGU_VERIFIKASI'; }).length,
      menunggu_bayar: orders.filter(function (o) { return o.status === 'MENUNGGU_BAYAR'; }).length
    },
    per_hari: Object.keys(perHari).sort().map(function (k) { return perHari[k]; }),
    per_tipe: perTipe
};
}

function csvCell_(v) {
  let s = String(v === null || v === undefined ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah CSV/formula injection
  return '"' + s.replace(/"/g, '""') + '"';
}

function reportExport_(p) {
  const evId = clean_(p.event_id, 40);
  const jenis = p.jenis;
  const events = indexBy_(readAll_('Events'), 'event_id');
  const types = indexBy_(readAll_('TicketTypes'), 'type_id');
  const evName = function (id) { return (events[id] || {}).nama_kegiatan || id; };
  const tyName = function (id) { return (types[id] || {}).nama_tiket || id; };
  let head, rows;
  if (jenis === 'orders') {
    head = ['order_id', 'kegiatan', 'jenis_tiket', 'nama_pembeli', 'email', 'no_hp', 'jumlah', 'total_harga', 'status', 'catatan', 'dibuat_pada', 'diverifikasi_oleh', 'diverifikasi_pada'];
    rows = readAll_('Orders').filter(function (o) { return !evId || o.event_id === evId; }).map(function (o) {
      return [o.order_id, evName(o.event_id), tyName(o.type_id), o.nama_pembeli, o.email, o.no_hp, o.jumlah, o.total_harga, o.status, o.catatan, o.dibuat_pada, o.diverifikasi_oleh, o.diverifikasi_pada];
    });
  } else if (jenis === 'tickets') {
    head = ['ticket_id', 'order_id', 'kegiatan', 'jenis_tiket', 'nama_pemegang', 'status_checkin', 'waktu_checkin', 'petugas_gate'];
    rows = readAll_('Tickets').filter(function (t) { return !evId || t.event_id === evId; }).map(function (t) {
      return [t.ticket_id, t.order_id, evName(t.event_id), tyName(t.type_id), t.nama_pemegang, t.status_checkin, t.waktu_checkin, t.petugas_gate];
    });
  } else if (jenis === 'attendance') {
    // Daftar hadir hanya memuat tiket dari pesanan yang sudah diverifikasi (DITERIMA).
    const orders = indexBy_(readAll_('Orders'), 'order_id');
    head = ['nama_pemegang', 'email', 'no_hp', 'ticket_id', 'jenis_tiket', 'kegiatan', 'status_checkin', 'waktu_checkin', 'petugas_gate'];
    rows = readAll_('Tickets').filter(function (t) {
      const o = orders[t.order_id] || {};
      return (!evId || t.event_id === evId) && o.status === 'DITERIMA';
    }).map(function (t) {
      const o = orders[t.order_id] || {};
      return [t.nama_pemegang, o.email || '', o.no_hp || '', t.ticket_id, tyName(t.type_id), evName(t.event_id), t.status_checkin, t.waktu_checkin, t.petugas_gate];
    });
  } else if (jenis === 'scanlog') {
    head = ['log_id', 'ticket_id', 'kegiatan', 'hasil', 'petugas', 'waktu'];
    rows = readAll_('ScanLog').filter(function (l) { return !evId || l.event_id === evId; }).map(function (l) {
      return [l.log_id, l.ticket_id, evName(l.event_id), l.hasil, l.petugas, l.waktu];
    });
  } else {
    throw userErr_('Jenis laporan tidak dikenal.');
  }
  const stamp = Utilities.formatDate(new Date(), tz_(), 'yyyyMMdd-HHmm');
  if (p.format === 'json') return { jenis: 'json', head: head, rows: rows, jumlah_baris: rows.length,
};
  // Excel export
  if (p.format === 'xlsx') {
    const name = ('Laporan ' + jenis + ' ' + stamp).slice(0, 90);
    const ssTmp = SpreadsheetApp.create(name);
    const sh = ssTmp.getActiveSheet();
    const all = [head].concat(rows);
    sh.getRange(1, 1, all.length, head.length).setNumberFormat('@').setValues(all.map(function (r) { return r.map(String); }));
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#e8eefc');
    sh.setFrozenRows(1);
    const blob = DriveApp.getFileById(ssTmp.getId())
      .getAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').setName(name + '.xlsx');
    const file = DriveApp.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* abaikan */ }
    DriveApp.getFileById(ssTmp.getId()).setTrashed(true);
    return { jenis: 'xlsx', filename: file.getName(), url: file.getDownloadUrl(), jumlah_baris: rows.length,
};
  }
  // PDF export
  if (p.format === 'pdf') {
    const name = ('Laporan ' + jenis + ' ' + stamp).slice(0, 90);
    const ssTmp = SpreadsheetApp.create(name);
    const sh = ssTmp.getActiveSheet();
    const all = [head].concat(rows);
    sh.getRange(1, 1, all.length, head.length).setNumberFormat('@').setValues(all.map(function (r) { return r.map(String); }));
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#e8eefc');
    sh.setFrozenRows(1);
    const pdfBlob = DriveApp.getFileById(ssTmp.getId()).getAs('application/pdf').setName(name + '.pdf');
    const file = DriveApp.createFile(pdfBlob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* abaikan */ }
    DriveApp.getFileById(ssTmp.getId()).setTrashed(true);
    return { jenis: 'pdf', filename: file.getName(), url: file.getDownloadUrl(), jumlah_baris: rows.length,
};
  }
  // Sheet export fallback (existing)
  if (p.format === 'sheet') {
    const name = ('Laporan ' + jenis + ' ' + stamp).slice(0, 90);
    const sh = ss_().insertSheet(name);
    const all = [head].concat(rows);
    sh.getRange(1, 1, all.length, head.length).setNumberFormat('@').setValues(all.map(function (r) { return r.map(String); }));
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold').setBackground('#e8eefc');
    sh.setFrozenRows(1);
    return { jenis: 'sheet', nama: name, jumlah_baris: rows.length, url: ss_().getUrl() + '#gid=' + sh.getSheetId(),
};
  }
  const csv = '\uFEFF' + [head].concat(rows).map(function (r) { return r.map(csvCell_).join(','); }).join('\r\n');
  return { jenis: 'csv', filename: 'laporan-' + jenis + '-' + stamp + '.csv', csv: csv, jumlah_baris: rows.length,
};
}

function scanList_(p) {
  const evId = clean_(p.event_id, 40), hasil = clean_(p.hasil, 30);
  const events = indexBy_(readAll_('Events'), 'event_id');
  return readAll_('ScanLog').filter(function (l) {
    return (!evId || l.event_id === evId) && (!hasil || l.hasil === hasil);
  }).sort(function (a, b) { return a.waktu < b.waktu ? 1 : -1; }).slice(0, 500).map(function (l) {
    return {
      log_id: l.log_id, ticket_id: l.ticket_id, hasil: l.hasil, petugas: l.petugas, waktu: l.waktu,
      kegiatan: (events[l.event_id] || {}).nama_kegiatan || l.event_id
   ,
};
  });
}

/* ============================== ADMIN: KEGIATAN & TIKET ============================== */

function eventList_() {
  const types = readAll_('TicketTypes');
  return readAll_('Events').sort(function (a, b) { return (a.tanggal + a.jam) < (b.tanggal + b.jam) ? 1 : -1; }).map(function (e) {
    const o = {};
    Object.keys(e).forEach(function (k) { if (k !== '_row') o[k] = e[k]; });
    o.video_url = videoUrl_(e);
    o.tipe = types.filter(function (t) { return t.event_id === e.event_id; }).map(function (t) {
      return {
        type_id: t.type_id, nama_tiket: t.nama_tiket, harga: t.harga, kuota: t.kuota, terjual: t.terjual,
        isi_tiket: Math.max(1, Number(t.isi_tiket) || 1),
        tanggal_buka: t.tanggal_buka, tanggal_tutup: t.tanggal_tutup, status: saleStatus_(t)
     ,
};
    });
    return o;
  });
}

function eventToggleReg_(p, s) {
  const ev = findBy_('Events', 'event_id', clean_(p.event_id, 40));
  if (!ev) throw userErr_('Kegiatan tidak ditemukan.');
  const newStatus = ev.status === 'AKTIF' ? 'DITUTUP' : 'AKTIF';
  ev.status = newStatus;
  updateRow_('Events', ev);
  return { event_id: ev.event_id, status: newStatus, message: 'Status pendaftaran ' + (newStatus === 'AKTIF' ? 'dibuka' : 'ditutup'),
};
}

function eventSave_(p, s) {
  const nama = clean_(p.nama_kegiatan, 150);
  if (nama.length < 3) throw userErr_('Nama kegiatan minimal 3 karakter.');
  const tanggal = clean_(p.tanggal, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw userErr_('Tanggal kegiatan wajib diisi.');
  const jam = clean_(p.jam, 5);
  if (jam && !/^\d{2}:\d{2}$/.test(jam)) throw userErr_('Format jam tidak valid (HH:MM).');
  const status = EVENT_STATUS.indexOf(p.status) >= 0 ? p.status : 'DRAFT';
  let blob = null;
  if (p.poster && p.poster.b64) blob = decodeImage_(p.poster.b64, p.poster.mime, 'poster_' + Date.now(), 'poster');

  return withLock_(function () {
    let ev = p.event_id ? findBy_('Events', 'event_id', clean_(p.event_id, 40)) : null;
    if (p.event_id && !ev) throw userErr_('Kegiatan tidak ditemukan.');
    const isNew = !ev;
    if (isNew) {
      ev = {
        event_id: 'EVT-' + randHex_(6), poster_url: '', poster_file_id: '', dibuat_oleh: s.nama,
        video_operation: '', video_status: '', video_file_id: '', video_pesan: ''
     ,
};
    }
    ev.nama_kegiatan = nama;
    ev.jenis = clean_(p.jenis, 50);
    ev.deskripsi = cleanMl_(p.deskripsi, 3000);
    ev.tanggal = tanggal;
    ev.jam = jam;
    ev.lokasi = clean_(p.lokasi, 200);
    ev.status = status;
    ev.info_pembayaran = cleanMl_(p.info_pembayaran, 1500);
    if (p.racepack_aktif !== undefined) {
      ev.racepack_aktif = String(p.racepack_aktif).trim().toUpperCase() === 'YA' ? 'YA' : 'TIDAK';
    } else if (!ev.racepack_aktif) {
      ev.racepack_aktif = 'TIDAK';
    }
    if (blob) {
      const folder = DriveApp.getFolderById(settings_().folder_poster_id);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      if (ev.poster_file_id) { try { DriveApp.getFileById(ev.poster_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
      ev.poster_file_id = file.getId();
      ev.poster_url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200';
    }
    applyBg_(ev, 'bg_halaman_url', 'bg_halaman_file_id', p.bg_halaman, p.bg_halaman_hapus);
    applyBg_(ev, 'bg_tiket_url', 'bg_tiket_file_id', p.bg_tiket, p.bg_tiket_hapus);
    applyKaos_(ev, p.ukuran_kaos, p.ukuran_kaos_hapus);
    if (isNew) appendRows_('Events', [ev]); else updateRow_('Events', ev);
    return { event_id: ev.event_id,
};
  });
}

function eventDelete_(p) {
  return withLock_(function () {
    const ev = findBy_('Events', 'event_id', clean_(p.event_id, 40));
    if (!ev) throw userErr_('Kegiatan tidak ditemukan.');
    const hasOrder = readAll_('Orders').some(function (o) { return o.event_id === ev.event_id; });
    if (hasOrder) throw userErr_('Kegiatan sudah memiliki pesanan dan tidak dapat dihapus. Ubah statusnya menjadi DITUTUP atau SELESAI.');
    const typeRows = readAll_('TicketTypes').filter(function (t) { return t.event_id === ev.event_id; }).map(function (t) { return t._row; });
    deleteRows_('TicketTypes', typeRows);
    deleteRows_('Events', [ev._row]);
    if (ev.poster_file_id) { try { DriveApp.getFileById(ev.poster_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
    ['bg_halaman_file_id', 'bg_tiket_file_id'].forEach(function (k) {
      if (ev[k]) { try { DriveApp.getFileById(ev[k]).setTrashed(true); } catch (e) { /* abaikan */ } }
    });
    if (ev.ukuran_kaos_file_id) { try { DriveApp.getFileById(ev.ukuran_kaos_file_id).setTrashed(true); } catch (e) { /* abaikan */ } }
    return true;
  });
}

function typeSave_(p) {
  const nama = clean_(p.nama_tiket, 80);
  if (!nama) throw userErr_('Nama tiket wajib diisi.');
  const harga = parseInt(p.harga, 10), kuota = parseInt(p.kuota, 10);
  if (!(harga >= 0)) throw userErr_('Harga tidak valid (minimal 0).');
  if (!(kuota >= 1)) throw userErr_('Kuota minimal 1.');
  const buka = parseDT_(p.tanggal_buka, false), tutup = parseDT_(p.tanggal_tutup, true);
  if (buka === null || tutup === null) throw userErr_('Format tanggal buka/tutup tidak valid.');
  if (buka && tutup && buka >= tutup) throw userErr_('Tanggal tutup harus setelah tanggal buka.');
  return withLock_(function () {
    const ev = findBy_('Events', 'event_id', clean_(p.event_id, 40));
    if (!ev) throw userErr_('Kegiatan tidak ditemukan.');
    let t = p.type_id ? findBy_('TicketTypes', 'type_id', clean_(p.type_id, 40)) : null;
    if (p.type_id && !t) throw userErr_('Jenis tiket tidak ditemukan.');
    const isi = Math.max(1, Math.min(20, parseInt(p.isi_tiket, 10) || 1));
    const isNew = !t;
    if (isNew) t = { type_id: 'TYP-' + randHex_(6), event_id: ev.event_id, terjual: 0,
};
    if (!isNew && kuota < t.terjual) throw userErr_('Kuota tidak boleh lebih kecil dari tiket yang sudah terjual/dipesan (' + t.terjual + ').');
    t.nama_tiket = nama; t.harga = harga; t.kuota = kuota; t.tanggal_buka = buka; t.tanggal_tutup = tutup; t.isi_tiket = isi;
    if (isNew) appendRows_('TicketTypes', [t]); else updateRow_('TicketTypes', t);
    return { type_id: t.type_id,
};
  });
}

function typeDelete_(p) {
  return withLock_(function () {
    const t = findBy_('TicketTypes', 'type_id', clean_(p.type_id, 40));
    if (!t) throw userErr_('Jenis tiket tidak ditemukan.');
    const used = readAll_('Orders').some(function (o) { return o.type_id === t.type_id; });
    if (t.terjual > 0 || used) throw userErr_('Jenis tiket sudah dipakai pesanan dan tidak dapat dihapus. Atur kuota atau tanggal tutupnya.');
    deleteRows_('TicketTypes', [t._row]);
    return true;
  });
}

/* ============================== ADMIN: PENGGUNA ============================== */

function userList_() {
  return readAll_('Users').map(function (u) {
    return { user_id: u.user_id, nama: u.nama, username: u.username, role: u.role, status_aktif: u.status_aktif, dibuat_pada: u.dibuat_pada,
};
  });
}

function userSave_(p, s) {
  const nama = clean_(p.nama, 80);
  if (!nama) throw userErr_('Nama wajib diisi.');
  if (ROLES.indexOf(p.role) < 0) throw userErr_('Role tidak valid.');
  const pwInput = String(p.password || '');
  if (pwInput && (!s || s.role !== 'SUPER_ADMIN')) throw userErr_('Hanya admin yang dapat mengisi password pengguna.');
  return withLock_(function () {
    const users = readAll_('Users');
    if (p.user_id) {
      const u = users.filter(function (x) { return x.user_id === p.user_id; })[0];
      if (!u) throw userErr_('Pengguna tidak ditemukan.');
      if (u.user_id === s.uid && p.role !== u.role) throw userErr_('Anda tidak dapat mengubah role akun sendiri.');
      const changed = u.role !== p.role;
      u.nama = nama; u.role = p.role;
      let pwChanged = false;
      if (pwInput) {
        if (pwInput.length < 8) throw userErr_('Password minimal 8 karakter.');
        u.password_hash = makeHash_(pwInput);
        pwChanged = true;
        if (u.user_id !== s.uid) revokeUserSessions_(u.user_id);
      }
      updateRow_('Users', u);
      if (changed) revokeUserSessions_(u.user_id);
      return { user_id: u.user_id, password_changed: pwChanged };
    }
    const uname = clean_(p.username, 30).toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(uname)) throw userErr_('Username 3-30 karakter: huruf kecil, angka, titik, strip, underscore.');
    if (users.some(function (x) { return x.username === uname; })) throw userErr_('Username sudah dipakai.');
    let pw = String(p.password || '');
    let generated = null;
    if (pw) { if (pw.length < 8) throw userErr_('Password minimal 8 karakter.'); }
    else { pw = randPass_(10); generated = pw; }
    const u = {
      user_id: 'USR-' + randHex_(6), nama: nama, username: uname, password_hash: makeHash_(pw),
      role: p.role, status_aktif: 'AKTIF', dibuat_pada: nowStr_()
   ,
};
    appendRows_('Users', [u]);
    return { user_id: u.user_id, password: generated,
};
  });
}

function userToggle_(p, s) {
  return withLock_(function () {
    const users = readAll_('Users');
    const u = users.filter(function (x) { return x.user_id === p.user_id; })[0];
    if (!u) throw userErr_('Pengguna tidak ditemukan.');
    if (u.user_id === s.uid) throw userErr_('Anda tidak dapat menonaktifkan akun sendiri.');
    const next = u.status_aktif === 'AKTIF' ? 'NONAKTIF' : 'AKTIF';
    if (next === 'NONAKTIF' && u.role === 'SUPER_ADMIN') {
      const others = users.filter(function (x) { return x.role === 'SUPER_ADMIN' && x.status_aktif === 'AKTIF' && x.user_id !== u.user_id; });
      if (!others.length) throw userErr_('Harus ada minimal satu Super Admin aktif.');
    }
    u.status_aktif = next;
    updateRow_('Users', u);
    if (next === 'NONAKTIF') revokeUserSessions_(u.user_id);
    return { status_aktif: next,
};
  });
}

function userReset_(p, s) {
  if (p.password && (!s || s.role !== 'SUPER_ADMIN')) throw userErr_('Hanya admin yang dapat mengisi password pengguna.');
  return withLock_(function () {
    const u = readAll_('Users').filter(function (x) { return x.user_id === p.user_id; })[0];
    if (!u) throw userErr_('Pengguna tidak ditemukan.');
    const manual = String(p.password || '');
    if (manual && manual.length < 8) throw userErr_('Password minimal 8 karakter.');
    const pw = manual || randPass_(10);
    u.password_hash = makeHash_(pw);
    updateRow_('Users', u);
    revokeUserSessions_(u.user_id);
    return { username: u.username, password: pw, manual: !!manual };
  });
}

/* ============================== VERIFIKATOR: PESANAN ============================== */

function orderList_(p) {
  const evId = clean_(p.event_id, 40), status = clean_(p.status, 30);
  const q = clean_(p.q, 80).toLowerCase();
  const qd = normPhone_(q);
  const events = indexBy_(readAll_('Events'), 'event_id');
  const types = indexBy_(readAll_('TicketTypes'), 'type_id');
  let list = readAll_('Orders').filter(function (o) {
    if (evId && o.event_id !== evId) return false;
    if (status && o.status !== status) return false;
    if (q) {
      const hit = o.order_id.toLowerCase().indexOf(q) >= 0 || o.nama_pembeli.toLowerCase().indexOf(q) >= 0 ||
        o.email.indexOf(q) >= 0 || (qd.length >= 3 && o.no_hp.indexOf(qd) >= 0);
      if (!hit) return false;
    }
    return true;
  });
  list.sort(function (a, b) {
    return p.urut === 'asc' ? (a.dibuat_pada < b.dibuat_pada ? -1 : 1) : (a.dibuat_pada < b.dibuat_pada ? 1 : -1);
  });
  const total = list.length;
  list = list.slice(0, 300).map(function (o) {
    return {
      order_id: o.order_id, event_id: o.event_id, kegiatan: (events[o.event_id] || {}).nama_kegiatan || '-',
      nama_tiket: (types[o.type_id] || {}).nama_tiket || '-', nama_pembeli: o.nama_pembeli, email: o.email, no_hp: o.no_hp,
      jumlah: o.jumlah, paket: Number(o.paket) || 0, isi_tiket: Math.max(1, Number((types[o.type_id] || {}).isi_tiket) || 1),
      total_harga: o.total_harga, status: o.status, catatan: o.catatan, dibuat_pada: o.dibuat_pada,
      diverifikasi_oleh: o.diverifikasi_oleh, diverifikasi_pada: o.diverifikasi_pada, ada_bukti: !!o.bukti_bayar_url
   ,
};
  });
  return { total: total, items: list,
};
}

function orderProof_(p) {
  const o = findBy_('Orders', 'order_id', clean_(p.order_id, 40));
  if (!o) throw userErr_('Pesanan tidak ditemukan.');
  if (!o.bukti_bayar_url) throw userErr_('Pesanan ini belum memiliki bukti pembayaran.');
  const id = driveId_(o.bukti_bayar_url);
  let blob;
  try { blob = DriveApp.getFileById(id).getBlob(); } catch (e) { throw userErr_('File bukti pembayaran tidak dapat dibuka dari Drive.'); }
  return { data_url: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()),
};
}

function orderAccept_(p, s) {
  const o = withLock_(function () {
    const cur = findBy_('Orders', 'order_id', clean_(p.order_id, 40));
    if (!cur) throw userErr_('Pesanan tidak ditemukan.');
    if (cur.status !== 'MENUNGGU_VERIFIKASI') throw userErr_('Pesanan tidak dapat di-ACC (status saat ini: ' + cur.status + ').');
    if (cur.total_harga > 0 && !cur.bukti_bayar_url) throw userErr_('Pesanan belum memiliki bukti pembayaran.');
    const used = {};
    readAll_('Tickets').forEach(function (t) { used[t.ticket_id] = 1; });
    let peserta = [];
    try { peserta = JSON.parse(cur.data_peserta || '[]'); } catch (e) { peserta = []; }
    if (!Array.isArray(peserta)) peserta = [];
    const ev = findBy_('Events', 'event_id', cur.event_id) || {};
    const pakaiRacepack = racepackAktif_(ev);
    const packUsed = {};
    readAll_('RacePack').forEach(function (x) { packUsed[x.pack_id] = 1; });
    const rows = [], packs = [];
    for (let i = 0; i < cur.jumlah; i++) {
      const ps = peserta[i] || {};
      let id = ticketId_();
      while (used[id]) id = ticketId_();
      used[id] = 1;
      const namaPeserta = clean_(ps.nama, 100) || cur.nama_pembeli;
      rows.push({
        ticket_id: id, order_id: cur.order_id, event_id: cur.event_id, type_id: cur.type_id,
        nama_pemegang: namaPeserta, status_checkin: 'BELUM', waktu_checkin: '', petugas_gate: ''
      });
      const adaData = ps.data && typeof ps.data === 'object' && Object.keys(ps.data).length > 0;
      if (pakaiRacepack) {
        const pid = newPackId_(packUsed);
        packUsed[pid] = 1;
        packs.push({
          pack_id: pid, order_id: cur.order_id, event_id: cur.event_id, nama_pemegang: namaPeserta,
          diambil_pada: '', diambil_oleh: '', status: 'BELUM_DIAMBIL',
          data: JSON.stringify(ps.data || {}), ticket_id: id
        });
      }
    }
    appendRows_('Tickets', rows);
    if (packs.length) appendRows_('RacePack', packs);
    cur.status = 'DITERIMA';
    cur.catatan = '';
    cur.diverifikasi_oleh = s.nama;
    cur.diverifikasi_pada = nowStr_();
    updateRow_('Orders', cur);
    return cur;
  });
  const mail = sendEticket_(o);
  return { order_id: o.order_id, jumlah: o.jumlah, email: mail,
};
}

function orderReject_(p, s) {
  const alasan = clean_(p.alasan, 300);
  if (alasan.length < 3) throw userErr_('Alasan penolakan wajib diisi.');
  const o = withLock_(function () {
    const cur = findBy_('Orders', 'order_id', clean_(p.order_id, 40));
    if (!cur) throw userErr_('Pesanan tidak ditemukan.');
    if (cur.status !== 'MENUNGGU_VERIFIKASI') throw userErr_('Pesanan tidak dapat ditolak (status saat ini: ' + cur.status + ').');
    const t = findBy_('TicketTypes', 'type_id', cur.type_id);
    if (t) { t.terjual = Math.max(0, t.terjual - cur.jumlah); updateRow_('TicketTypes', t); }
    cur.status = 'DITOLAK';
    cur.catatan = alasan;
    cur.diverifikasi_oleh = s.nama;
    cur.diverifikasi_pada = nowStr_();
    updateRow_('Orders', cur);
    return cur;
  });
  let mail = { sent: false, message: '',
};
  try {
    if (MailApp.getRemainingDailyQuota() > 0) {
      const ev = findBy_('Events', 'event_id', o.event_id) || {};
      MailApp.sendEmail({
        to: o.email, name: settings_().email_pengirim_nama,
        subject: 'Pesanan ' + o.order_id + ' tidak dapat diproses',
        htmlBody: '<p>Halo ' + esc_(o.nama_pembeli) + ',</p><p>Pesanan tiket <b>' + esc_(ev.nama_kegiatan || '') + '</b> dengan ID <b>' +
          esc_(o.order_id) + '</b> belum dapat kami setujui.</p><p>Alasan: ' + esc_(alasan) +
          '</p><p>Silakan hubungi panitia' + (settings_().kontak_panitia ? ' (' + esc_(settings_().kontak_panitia) + ')' : '') + ' atau lakukan pemesanan ulang.</p>'
      });
      mail = { sent: true, message: 'Pemberitahuan dikirim ke ' + o.email,
};
    }
  } catch (e) { console.error(e); }
  return { order_id: o.order_id, email: mail,
};
}

function orderResend_(p) {
  const o = findBy_('Orders', 'order_id', clean_(p.order_id, 40));
  if (!o) throw userErr_('Pesanan tidak ditemukan.');
  if (o.status !== 'DITERIMA') throw userErr_('E-tiket hanya dapat dikirim untuk pesanan berstatus DITERIMA.');
  const r = sendEticket_(o);
  if (!r.sent) throw userErr_(r.message);
  return r;
}

function orderTickets_(p) {
  const o = findBy_('Orders', 'order_id', clean_(p.order_id, 40));
  if (!o) throw userErr_('Pesanan tidak ditemukan.');
  if (o.status !== 'DITERIMA') throw userErr_('Tiket hanya tersedia untuk pesanan berstatus DITERIMA.');
  const ev = findBy_('Events', 'event_id', o.event_id) || {};
  const ty = findBy_('TicketTypes', 'type_id', o.type_id) || {};
  const st = settings_();
  const tiket = findAllBy_('Tickets', 'order_id', o.order_id).map(function (t) {
    return { ticket_id: t.ticket_id, nama_pemegang: t.nama_pemegang, status_checkin: t.status_checkin };
  });
  if (!tiket.length) throw userErr_('Tiket belum dibuat untuk pesanan ini.');
  return {
    order_id: o.order_id, nama_pembeli: o.nama_pembeli, email: o.email, no_hp: o.no_hp,
    nama_kegiatan: ev.nama_kegiatan || '-', tanggal: ev.tanggal || '', jam: ev.jam || '', lokasi: ev.lokasi || '',
    nama_tiket: ty.nama_tiket || '-', tiket: tiket,
    organisasi: st.nama_organisasi || 'Panitia Kegiatan', kontak: st.kontak_panitia || '',
    bg_tiket_url: ev.bg_tiket_url || ''
  };
}

function raceSackToggle_(p, s) {
  const evId = clean_(p.event_id, 40);
  if (!evId) throw userErr_('Event ID wajib diisi.');
  return withLock_(function () {
    const ev = findBy_('Events', 'event_id', evId);
    if (!ev) throw userErr_('Kegiatan tidak ditemukan.');
    const aktif = !racepackAktif_(ev);
    ev.racepack_aktif = aktif ? 'YA' : 'TIDAK';
    updateRow_('Events', ev);
    return {
      event_id: evId, status: aktif ? 'AKTIF' : 'TUTUP', racepack_aktif: ev.racepack_aktif,
      message: 'Permintaan data race pack ' + (aktif ? 'diaktifkan' : 'dimatikan')
    };
  });
}

/** Satu panggilan untuk membuka tab Race Pack: kegiatan + pengaturan + daftar peserta. */
function raceSackBoot_(p) {
  return { events: eventList_(), settings: settingsGet_(), items: raceSackList_(p) };
}

function raceSackRegister_(p, s) {
  const evId = clean_(p.event_id, 40);
  if (!evId) throw userErr_('Event ID wajib diisi.');
  const order = findBy_('Orders', 'order_id', clean_(p.order_id, 40));
  if (!order || order.event_id !== evId) throw userErr_('Pesanan tidak ditemukan untuk event ini.');
  if (order.status !== 'DITERIMA') throw userErr_('Pesanan belum diterima / belum diverifikasi.');
  const ticketId = clean_(p.ticket_id, 40);
  let ticket = null;
  if (ticketId) {
    ticket = findBy_('Tickets', 'ticket_id', ticketId);
    if (!ticket || ticket.order_id !== order.order_id || ticket.event_id !== evId) {
      throw userErr_('Tiket tidak ditemukan pada pesanan ini.');
    }
  }
  return withLock_(function () {
    const packs = readAll_('RacePack');
    let pack = null;
    if (ticketId) {
      pack = packs.filter(function (x) { return x.ticket_id === ticketId; })[0] || null;
    } else {
      pack = packs.filter(function (x) { return x.order_id === order.order_id && !x.ticket_id; })[0] || null;
    }
    const rawStatus = clean_(p.status, 20).toUpperCase();
    const status = ['BELUM_DAFTAR', 'BELUM_DIAMBIL', 'DIAMBIL'].indexOf(rawStatus) >= 0 ? rawStatus : 'DIAMBIL';
    const nama = clean_(p.nama_pemegang, 100) || (ticket ? ticket.nama_pemegang : '') || order.nama_pembeli;
    const dataJson = p.data !== undefined ? JSON.stringify(p.data || {}) : (pack ? pack.data : '');
    if (pack) {
      pack.nama_pemegang = nama;
      pack.status = status;
      if (ticketId) pack.ticket_id = ticketId;
      if (status === 'DIAMBIL') {
        pack.diambil_pada = p.diambil_pada ? clean_(p.diambil_pada, 50) : nowStr_();
        pack.diambil_oleh = clean_(p.diambil_oleh, 100) || (s ? s.nama : '');
      } else {
        pack.diambil_pada = '';
        pack.diambil_oleh = '';
      }
      if (p.data !== undefined) pack.data = dataJson;
      updateRow_('RacePack', pack);
      return { pack_id: pack.pack_id, message: 'Race pack diperbarui: ' + pack.pack_id };
    }
    const packId = newPackId_(packs.reduce(function (m, x) { m[x.pack_id] = true; return m; }, {}));
    const now = nowStr_();
    const packBaru = {
      pack_id: packId,
      order_id: order.order_id,
      event_id: evId,
      nama_pemegang: nama,
      diambil_pada: status === 'DIAMBIL' ? now : '',
      diambil_oleh: status === 'DIAMBIL' ? (clean_(p.diambil_oleh, 100) || (s ? s.nama : '')) : '',
      status: status,
      data: dataJson,
      ticket_id: ticketId
    };
    appendRows_('RacePack', [packBaru]);
    return { pack_id: packId, message: 'Race pack terdaftar: ' + packId };
  });
}

function raceSackList_(p) {
  const evId = clean_(p.event_id, 40);
  const norm = function (v) { return String(v === null || v === undefined ? '' : v).trim(); };
  const orders = readAll_('Orders').filter(function (o) {
    if (norm(o.status).toUpperCase() !== 'DITERIMA') return false;
    return !evId || norm(o.event_id).toUpperCase() === norm(evId).toUpperCase();
  });
  const tickets = readAll_('Tickets');
  const packs = readAll_('RacePack');
  const events = indexBy_(readAll_('Events'), 'event_id');
  const types = indexBy_(readAll_('TicketTypes'), 'type_id');
  const packByTicket = {}, packByOrder = {}, ticketsByOrder = {};
  packs.forEach(function (x) {
    if (norm(x.ticket_id)) packByTicket[norm(x.ticket_id)] = x;
    else if (norm(x.order_id)) packByOrder[norm(x.order_id)] = x;
  });
  tickets.forEach(function (t) {
    const k = norm(t.order_id);
    if (!ticketsByOrder[k]) ticketsByOrder[k] = [];
    ticketsByOrder[k].push(t);
  });
  const out = [];
  orders.forEach(function (o) {
    const ts = ticketsByOrder[norm(o.order_id)] || [];
    const rows = ts.length ? ts : [null];
    rows.forEach(function (t, idx) {
      const legacy = (!t || idx === 0) ? packByOrder[norm(o.order_id)] : null;
      const pack = (t && packByTicket[norm(t.ticket_id)]) || legacy || {};
      const ty = types[o.type_id] || {};
      out.push({
        pack_id: pack.pack_id || '',
        order_id: o.order_id,
        ticket_id: t ? t.ticket_id : '',
        event_id: o.event_id,
        kegiatan: (events[o.event_id] || {}).nama_kegiatan || o.event_id,
        nama_tiket: ty.nama_tiket || '',
        nama_pemegang: (t ? t.nama_pemegang : '') || pack.nama_pemegang || o.nama_pembeli,
        nama_pembeli: o.nama_pembeli,
        email: o.email || '',
        no_hp: o.no_hp || '',
        jumlah: o.jumlah,
        diambil_pada: pack.diambil_pada || '',
        diambil_oleh: pack.diambil_oleh || '',
        status: (pack.status && pack.status !== 'BELUM_DAFTAR') ? pack.status : 'BELUM_DIAMBIL',
        data: pack.data || ''
      });
    });
  });
  return out;
}

function raceSackUpdate_(p, s) {
  const packId = clean_(p.pack_id, 40);
  if (!packId) throw userErr_('Pack ID wajib diisi.');
  const rows = readAll_('RacePack');
  const pack = rows.filter(function (x) { return x.pack_id === packId; })[0];
  if (!pack) throw userErr_('Race pack tidak ditemukan.');
  if (p.nama_pemegang !== undefined) pack.nama_pemegang = clean_(p.nama_pemegang, 100);
  if (p.status !== undefined) {
    const st = clean_(p.status, 20).toUpperCase();
    if (['BELUM_DAFTAR', 'BELUM_DIAMBIL', 'DIAMBIL'].indexOf(st) >= 0) pack.status = st;
  }
  if (pack.status === 'DIAMBIL') {
    pack.diambil_pada = p.diambil_pada !== undefined
      ? (p.diambil_pada ? clean_(p.diambil_pada, 50) : nowStr_())
      : (pack.diambil_pada || nowStr_());
    pack.diambil_oleh = p.diambil_oleh !== undefined
      ? (clean_(p.diambil_oleh, 100) || (s ? s.nama : ''))
      : (pack.diambil_oleh || (s ? s.nama : ''));
  } else {
    pack.diambil_pada = '';
    pack.diambil_oleh = '';
  }
  if (p.data !== undefined) pack.data = JSON.stringify(p.data || {});
  updateRow_('RacePack', pack);
  return { pack_id: packId, message: 'Race pack diperbarui.' };
}

function raceSackDelete_(p) {
  const packId = clean_(p.pack_id, 40);
  if (!packId) throw userErr_('Pack ID wajib diisi.');
  const rows = readAll_('RacePack');
  const pack = rows.filter(function (x) { return x.pack_id === packId; })[0];
  if (!pack) throw userErr_('Race pack tidak ditemukan.');
  deleteRows_('RacePack', [pack._row]);
  return { pack_id: packId, message: 'Race pack dihapus.' };
}

/** Kirim e-tiket (poster + detail + QR per tiket). Tidak pernah melempar error: mengembalikan {sent, message}. */
function sendEticket_(o) {
  try {
    if (MailApp.getRemainingDailyQuota() < 1) {
      return { sent: false, message: 'Kuota email harian habis. Tiket sudah dibuat; gunakan "Kirim Ulang E-Tiket" besok.',
};
    }
    const st = settings_();
    const ev = findBy_('Events', 'event_id', o.event_id) || {};
    const ty = findBy_('TicketTypes', 'type_id', o.type_id) || {};
    const tickets = findAllBy_('Tickets', 'order_id', o.order_id);
    const inline = {};
    let poster = '';
    if (ev.poster_file_id) {
      try {
        inline.poster = DriveApp.getFileById(ev.poster_file_id).getBlob().setName('poster');
        poster = '<img src="cid:poster" alt="Poster" style="width:100%;max-width:560px;border-radius:12px;display:block;margin:0 auto 16px">';
      } catch (e) { poster = ''; }
    }
    const color = /^#[0-9a-fA-F]{6}$/.test(st.warna_utama) ? st.warna_utama : '#1d4ed8';
    let blocks = '';
    tickets.forEach(function (t, i) {
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=' + encodeURIComponent(t.ticket_id);
      let src = qrUrl;
      try { inline['qr' + i] = UrlFetchApp.fetch(qrUrl).getBlob().setName('qr' + i + '.png'); src = 'cid:qr' + i; } catch (e) { /* pakai URL langsung */ }
      blocks += '<div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:12px 0;text-align:center">' +
        '<div style="font-weight:700">Tiket ' + (i + 1) + ' dari ' + tickets.length + ' - ' + esc_(ty.nama_tiket || '') + '</div>' +
        '<div style="color:#475569;margin:4px 0">Pemegang: ' + esc_(t.nama_pemegang) + '</div>' +
        '<img src="' + src + '" width="220" height="220" alt="QR ' + esc_(t.ticket_id) + '" style="display:block;margin:8px auto">' +
        '<div style="font-family:monospace;font-size:16px;letter-spacing:1px">' + esc_(t.ticket_id) + '</div></div>';
    });
    const url = ScriptApp.getService().getUrl();
    const html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a">' + poster +
      '<h2 style="color:' + color + ';margin:0 0 8px">E-Tiket ' + esc_(ev.nama_kegiatan || '') + '</h2>' +
      '<p>Halo <b>' + esc_(o.nama_pembeli) + '</b>, pembayaran Anda sudah kami verifikasi. Berikut e-tiket Anda.</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:14px">' +
      '<tr><td style="padding:4px 0;color:#64748b">ID Pembelian</td><td><b>' + esc_(o.order_id) + '</b></td></tr>' +
      '<tr><td style="padding:4px 0;color:#64748b">Tanggal</td><td>' + esc_(ev.tanggal || '') + ' ' + esc_(ev.jam || '') + '</td></tr>' +
      '<tr><td style="padding:4px 0;color:#64748b">Lokasi</td><td>' + esc_(ev.lokasi || '') + '</td></tr>' +
      '<tr><td style="padding:4px 0;color:#64748b">Jumlah / Total</td><td>' + o.jumlah + ' tiket / ' + rupiah_(o.total_harga) + '</td></tr></table>' +
      blocks +
      '<p style="font-size:13px;color:#475569">Tunjukkan QR code di pintu masuk. Satu QR hanya berlaku untuk satu kali masuk; jangan dibagikan kepada orang lain.' +
      (url ? ' Anda juga dapat membuka e-tiket kapan saja lewat <a href="' + esc_(url) + '">halaman Cek Status Pesanan</a> memakai ID pembelian.' : '') + '</p>' +
      '<p style="font-size:13px;color:#475569">Jika email ini tidak muncul di Inbox, periksa folder <b>Spam</b> atau <b>Promosi</b>, lalu tandai bukan spam.</p>' +
      (st.kontak_panitia ? '<p style="font-size:13px;color:#475569">Kontak panitia: ' + esc_(st.kontak_panitia) + '</p>' : '') +
      '<p style="font-size:12px;color:#94a3b8">' + esc_(st.nama_organisasi) + '</p></div>';
    MailApp.sendEmail({
      to: o.email, name: st.email_pengirim_nama || st.nama_organisasi,
      subject: 'E-Tiket ' + (ev.nama_kegiatan || '') + ' - ' + o.order_id, htmlBody: html, inlineImages: inline
    });
    return { sent: true, message: 'E-tiket dikirim ke ' + o.email,
};
  } catch (err) {
    console.error(err);
    return { sent: false, message: 'Gagal mengirim email: ' + err.message,
};
  }
}

/* ============================== GATE ============================== */

function gateEvents_() {
  const today = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
  return readAll_('Events').filter(function (e) { return e.status === 'AKTIF'; }).map(function (e) {
    return { event_id: e.event_id, nama_kegiatan: e.nama_kegiatan, tanggal: e.tanggal, jam: e.jam, lokasi: e.lokasi, hari_ini: e.tanggal === today,
};
  }).sort(function (a, b) {
    if (a.hari_ini !== b.hari_ini) return a.hari_ini ? -1 : 1;
    return a.tanggal < b.tanggal ? -1 : 1;
  });
}

function gateStats_(p) {
  const evId = clean_(p.event_id, 40);
  const cache = CacheService.getScriptCache();
  const hit = cache.get('GS_' + evId);
  if (hit && !p.fresh) { try { return JSON.parse(hit); } catch (e) { /* hitung ulang */ } }
  const list = readAll_('Tickets').filter(function (t) { return t.event_id === evId; });
  const out = { total: list.length, masuk: list.filter(function (t) { return t.status_checkin === 'SUDAH'; }).length,
};
  cache.put('GS_' + evId, JSON.stringify(out), 8);
  return out;
}

function normCode_(v) {
  let c = String(v || '').toUpperCase().replace(/\s+/g, '');
  if (/^[0-9A-F]{12}$/.test(c)) c = c.substr(0, 4) + '-' + c.substr(4, 4) + '-' + c.substr(8, 4);
  return c.slice(0, 60);
}

function logObj_(ticketId, hasil, petugas, evId) {
  return { log_id: 'LOG-' + randHex_(8), ticket_id: ticketId, hasil: hasil, petugas: petugas, waktu: nowStr_(), event_id: evId,
};
}

function updateCheckin_(t) {
  sheet_('Tickets').getRange(t._row, colIdx_('Tickets', 'status_checkin'), 1, 3)
    .setValues([[t.status_checkin, t.waktu_checkin, t.petugas_gate]]);
}

function checkinTicket_(t, evId, petugas, ctx, logs) {
  const ty = ctx.types[t.type_id];
  const base = { ticket_id: t.ticket_id, nama: t.nama_pemegang, jenis_tiket: ty ? ty.nama_tiket : '-', order_id: t.order_id,
};
  if (t.event_id !== evId) {
    logs.push(logObj_(t.ticket_id, 'BUKAN_EVENT_INI', petugas, evId));
    const other = ctx.events[t.event_id];
    return Object.assign(base, { hasil: 'BUKAN_EVENT_INI', pesan: 'Tiket ini untuk kegiatan lain' + (other ? ': ' + other.nama_kegiatan : '') + '.' });
  }
  if (t.status_checkin === 'SUDAH') {
    logs.push(logObj_(t.ticket_id, 'SUDAH_DIPAKAI', petugas, evId));
    return Object.assign(base, {
      hasil: 'SUDAH_DIPAKAI', waktu_checkin: t.waktu_checkin, petugas: t.petugas_gate,
      pesan: 'Tiket sudah pernah dipakai.'
    });
  }
  t.status_checkin = 'SUDAH';
  t.waktu_checkin = nowStr_();
  t.petugas_gate = petugas;
  updateCheckin_(t);
  logs.push(logObj_(t.ticket_id, 'VALID', petugas, evId));
  return Object.assign(base, { hasil: 'VALID', waktu_checkin: t.waktu_checkin, pesan: 'Check-in berhasil.' });
}

function gateCtx_() {
  return { types: indexBy_(readAll_('TicketTypes'), 'type_id'), events: indexBy_(readAll_('Events'), 'event_id'),
};
}

function gateScan_(p, s) {
  const evId = clean_(p.event_id, 40);
  const code = normCode_(p.code);
  if (!code) throw userErr_('Kode tiket kosong.');
  const ev = findBy_('Events', 'event_id', evId);
  if (!ev) throw userErr_('Kegiatan tidak ditemukan.');
  if (ev.status !== 'AKTIF') throw userErr_('Kegiatan ini tidak berstatus AKTIF.');
  return withLock_(function () {
    const logs = [];
    const ctx = gateCtx_();
    let result;
    if (/^TKT-/.test(code)) {
      const tickets = findAllBy_('Tickets', 'order_id', code);
      if (!tickets.length) {
        const o = findBy_('Orders', 'order_id', code);
        logs.push(logObj_(code, 'TIDAK_DITEMUKAN', s.nama, evId));
        result = {
          mode: 'RESULT', hasil: 'TIDAK_DITEMUKAN',
          pesan: o ? 'Pesanan belum diverifikasi (status: ' + o.status + ').' : 'ID pembelian tidak ditemukan.'
       ,
};
      } else if (tickets[0].event_id !== evId) {
        logs.push(logObj_(code, 'BUKAN_EVENT_INI', s.nama, evId));
        const other = ctx.events[tickets[0].event_id];
        result = { mode: 'RESULT', hasil: 'BUKAN_EVENT_INI', pesan: 'Pesanan ini untuk kegiatan lain' + (other ? ': ' + other.nama_kegiatan : '') + '.',
};
      } else if (tickets.length === 1) {
        result = Object.assign({ mode: 'RESULT' }, checkinTicket_(tickets[0], evId, s.nama, ctx, logs));
      } else {
        const o = findBy_('Orders', 'order_id', code) || {};
        result = {
          mode: 'LIST', order_id: code, nama_pembeli: o.nama_pembeli || '',
          tickets: tickets.map(function (t) {
            return {
              ticket_id: t.ticket_id, nama: t.nama_pemegang, jenis_tiket: (ctx.types[t.type_id] || {}).nama_tiket || '-',
              status_checkin: t.status_checkin, waktu_checkin: t.waktu_checkin, petugas: t.petugas_gate
           ,
};
          })
       ,
};
      }
    } else {
      const t = findBy_('Tickets', 'ticket_id', code);
      if (!t) {
        logs.push(logObj_(code, 'TIDAK_DITEMUKAN', s.nama, evId));
        result = { mode: 'RESULT', hasil: 'TIDAK_DITEMUKAN', pesan: 'Tiket tidak ditemukan / tidak valid.',
};
      } else {
        result = Object.assign({ mode: 'RESULT' }, checkinTicket_(t, evId, s.nama, ctx, logs));
      }
    }
    appendRows_('ScanLog', logs);
    return result;
  });
}

function gateCheckin_(p, s) {
  const evId = clean_(p.event_id, 40);
  const ids = (Array.isArray(p.ticket_ids) ? p.ticket_ids : []).slice(0, 50).map(normCode_);
  if (!ids.length) throw userErr_('Pilih minimal satu tiket.');
  const ev = findBy_('Events', 'event_id', evId);
  if (!ev || ev.status !== 'AKTIF') throw userErr_('Kegiatan tidak tersedia untuk check-in.');
  return withLock_(function () {
    const logs = [], ctx = gateCtx_();
    const results = ids.map(function (id) {
      const t = findBy_('Tickets', 'ticket_id', id);
      if (!t) { logs.push(logObj_(id, 'TIDAK_DITEMUKAN', s.nama, evId)); return { ticket_id: id, hasil: 'TIDAK_DITEMUKAN', pesan: 'Tiket tidak ditemukan.',
}; }
      return checkinTicket_(t, evId, s.nama, ctx, logs);
    });
    appendRows_('ScanLog', logs);
    return { results: results,
};
  });
}

/* ============================== VEO 3 (OPSIONAL, SUPER ADMIN) ============================== */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/';

function geminiKey_() {
  const k = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!k) throw userErr_('GEMINI_API_KEY belum diatur. Buka Project Settings > Script Properties, tambahkan GEMINI_API_KEY.');
  return k;
}

function videoApiError_(code, text) {
  let msg = '';
  try { msg = (JSON.parse(text).error || {}).message || ''; } catch (e) { msg = String(text || '').slice(0, 200); }
  if (code === 401 || code === 403) return 'API key ditolak (' + code + '). Pastikan GEMINI_API_KEY benar dan punya akses ke model Veo. ' + msg;
  if (code === 429) return 'Kuota API Gemini/Veo habis atau terlalu banyak permintaan. Coba lagi nanti atau periksa kuota & billing di Google AI Studio.';
  if (code === 400 && /billing|FAILED_PRECONDITION|paid|free tier/i.test(msg)) return 'Veo membutuhkan akun berbayar. Aktifkan billing pada project API key Anda. ' + msg;
  if (code === 404) return 'Model video tidak ditemukan. Periksa nama model di Pengaturan (video_model). ' + msg;
  return 'Layanan video menolak permintaan (' + code + '). ' + msg;
}

function videoCreate_(p) {
  const key = geminiKey_();
  const ev = findBy_('Events', 'event_id', clean_(p.event_id, 40));
  if (!ev) throw userErr_('Kegiatan tidak ditemukan.');
  if (ev.video_status === 'PROSES') throw userErr_('Video untuk kegiatan ini masih diproses. Klik "Cek Hasil".');
  const st = settings_();
  const suasana = clean_(p.suasana, 200) || 'meriah, energik, dan hangat';
  const prompt = 'Video promosi sinematik berdurasi singkat untuk kegiatan "' + ev.nama_kegiatan + '"' +
    (ev.jenis ? ' (' + ev.jenis + ')' : '') + '. Tanggal: ' + ev.tanggal + (ev.jam ? ' pukul ' + ev.jam : '') +
    '. Lokasi: ' + ev.lokasi + '. Suasana: ' + suasana + '. Gerakan kamera halus, pencahayaan menarik, tanpa teks tertulis di layar.';
  const model = clean_(st.video_model, 80) || 'veo-3.0-generate-001';
  const url = GEMINI_BASE + 'models/' + encodeURIComponent(model) + ':predictLongRunning';
  const inst = { prompt: prompt,
};
  let withImage = false;
  if (st.video_pakai_poster === 'YA' && ev.poster_file_id) {
    try {
      const b = DriveApp.getFileById(ev.poster_file_id).getBlob();
      inst.image = { bytesBase64Encoded: Utilities.base64Encode(b.getBytes()), mimeType: b.getContentType(),
};
      withImage = true;
    } catch (e) { /* lanjut tanpa poster */ }
  }
  const call = function (instance) {
    return UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key },
      payload: JSON.stringify({ instances: [instance], parameters: { aspectRatio: '16:9' } }), muteHttpExceptions: true
    });
};
  let resp = call(inst);
  if (resp.getResponseCode() === 400 && withImage && /image/i.test(resp.getContentText())) {
    resp = call({ prompt: prompt }); // model belum mendukung gambar -> ulangi tanpa poster
  }
  if (resp.getResponseCode() !== 200) throw userErr_(videoApiError_(resp.getResponseCode(), resp.getContentText()));
  let op;
  try { op = JSON.parse(resp.getContentText()).name; } catch (e) { op = ''; }
  if (!op) throw userErr_('Respons layanan video tidak dikenali.');
  return withLock_(function () {
    const cur = findBy_('Events', 'event_id', ev.event_id);
    cur.video_operation = op;
    cur.video_status = 'PROSES';
    cur.video_pesan = '';
    updateRow_('Events', cur);
    return { status: 'PROSES', pesan: 'Video sedang dibuat (biasanya 1-5 menit). Klik "Cek Hasil" berkala.',
};
  });
}

/** Cek 1 operasi video; bila selesai, simpan ke Drive. Mengembalikan {status, pesan, video_url}. */
function pollVideo_(ev) {
  const key = geminiKey_();
  const resp = UrlFetchApp.fetch(GEMINI_BASE + ev.video_operation, { headers: { 'x-goog-api-key': key }, muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) {
    return { status: 'PROSES', pesan: videoApiError_(resp.getResponseCode(), resp.getContentText()),
};
  }
  const op = JSON.parse(resp.getContentText());
  if (!op.done) return { status: 'PROSES', pesan: 'Video masih diproses.',
};
  const fail = function (msg) {
    ev.video_status = 'GAGAL'; ev.video_pesan = msg; updateRow_('Events', ev);
    return { status: 'GAGAL', pesan: msg,
};
};
  if (op.error) return fail('Pembuatan video gagal: ' + (op.error.message || 'tidak diketahui'));
  const r = op.response || {};
  const gv = r.generateVideoResponse || r;
  const sample = (gv.generatedSamples || [])[0];
  const uri = sample && sample.video && sample.video.uri;
  if (!uri) return fail('Video tidak dihasilkan' + (gv.raiMediaFilteredReasons ? ': ' + gv.raiMediaFilteredReasons.join('; ') : '.'));
  const dl = UrlFetchApp.fetch(uri, { headers: { 'x-goog-api-key': key }, followRedirects: true, muteHttpExceptions: true });
  if (dl.getResponseCode() !== 200) return fail('Gagal mengunduh video (' + dl.getResponseCode() + ').');
  const blob = dl.getBlob().setName(ev.event_id + '-promo-' + Date.now() + '.mp4').setContentType('video/mp4');
  const file = DriveApp.getFolderById(settings_().folder_video_id).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  ev.video_file_id = file.getId();
  ev.video_status = 'SELESAI';
  ev.video_pesan = '';
  updateRow_('Events', ev);
  return { status: 'SELESAI', pesan: 'Video promo siap.', video_url: videoUrl_(ev),
};
}

function videoCheck_(p) {
  return withLock_(function () {
    const ev = findBy_('Events', 'event_id', clean_(p.event_id, 40));
    if (!ev) throw userErr_('Kegiatan tidak ditemukan.');
    if (ev.video_status !== 'PROSES' || !ev.video_operation) {
      return { status: ev.video_status || '', pesan: ev.video_pesan || '', video_url: videoUrl_(ev),
};
    }
    return pollVideo_(ev);
  });
}

/** Dipanggil trigger waktu (installTriggers) agar video tersimpan otomatis tanpa klik manual. */
function pollVideoOperations() {
  withLock_(function () {
    readAll_('Events').filter(function (e) { return e.video_status === 'PROSES' && e.video_operation; }).forEach(function (e) {
      try { pollVideo_(e); } catch (err) { console.error(err); }
    });
  });
}
