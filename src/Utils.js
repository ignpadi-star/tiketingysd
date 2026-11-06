// Utils.js – pure‑logic helpers, no side effects
const Utils = (function () {
  'use strict';
  const HEX = '0123456789abcdef';

  /** current time */
  function now() { return new Date(); }

  /** ISO‑8601 string in UTC */
  function isoNow() { return now().toISOString(); }

  /** format date for UI (dd MMM yyyy) */
  function formatDate(d) { return Utilities.formatDate(d, Config.TIMEZONE, 'dd MMM yyyy'); }

  /** SHA‑256 hex */
  function sha256Hex(text) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text).map(b => HEX[(b & 0xf0) >> 4] + HEX[b & 0x0f]).join(''); }

  /** HMAC‑SHA256 hex */
  function hmacSha256Hex(key, data) { return Utilities.computeHmacSha256Signature(key, data).map(b => HEX[(b & 0xf0) >> 4] + HEX[b & 0x0f]).join(''); }

  /** random hex string */
  function randomHex(bytes) {
    let out = '';
    while (out.length < bytes * 2) {
      out += Utilities.getUuid().replace(/-/g, '');
    }
    return out.slice(0, bytes * 2);
  }

  /** generate salt (32 hex chars) */
  function genSalt() { return randomHex(16); }

  /** generate secret for QR HMAC (64 hex chars) */
  function genQrSecret() { return randomHex(32); }

  /** secure password hash */
  function hashPassword(pw, salt) { return sha256Hex(salt + pw); }

  /** constant‑time string equality */
  function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /** normalize Indonesian phone, produce 62‑prefixed digits */
  function normalizePhone(raw) {
    let digits = raw.replace(/[\s+\-().]/g, '').replace(/^0/, '62');
    if (!/^62\d{8,12}$/.test(digits)) throw AppError('INVALID_PHONE', 'Nomor WA tidak valid');
    return digits;
  }

  /** display phone in +62 xxx‑xxxx‑xxxx */
  function formatPhoneDisplay(d) {
    const m = d.match(/^62(\d{3})(\d{3})(\d{4,5})$/);
    return m ? `+62 ${m[1]}-${m[2]}-${m[3]}` : d;
  }

  /** sanitize filename – keep alnum, dot, dash, underscore */
  function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 120);
  }

  /** parse event‑access list */
  function parseEventAccess(str) {
    if (!str) return [];
    return str.split(/[;,\n]/).map(s => s.trim().toUpperCase()).filter(Boolean);
  }

  /** event access check */
  function hasEventAccess(user, eventId) {
    if (user.role === 'SUPER_ADMIN') return true;
    if (!user.event_diizinkan) return true;
    const allowed = parseEventAccess(user.event_diizinkan);
    return allowed.length === 0 || allowed.includes(eventId);
  }

  /** random code with given alphabet */
  function randomCode(len, alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    const rnd = Math.random(); // caller may supply own
    let out = '';
    for (let i = 0; i < len; i++) {
      out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return out;
  }

  /** to boolean */
  function toBool(v) {
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase();
    return ['true', '1', 'yes', 'ya', 'on'].includes(s);
  }

  /** format rupiah with thousands separator */
  function formatRupiah(num) {
    const n = Number(num);
    if (isNaN(n)) return '';
    return 'Rp ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /** Jakarta date key yyyyMMdd */
  function dateKeyJakarta(date) {
    const d = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const y = d.getUTCFullYear();
    const m = ('0' + (d.getUTCMonth() + 1)).slice(-2);
    const dd = ('0' + d.getUTCDate()).slice(-2);
    return `${y}${m}${dd}`;
  }

  /** generate password of length 12 + suffix */
  function generatePassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%^&*';
    const all = upper + lower + digits + special;
    let pw = '';
    for (let i = 0; i < 12; i++) pw += all.charAt(Math.floor(Math.random() * all.length));
    return pw + 'A7!'; // ensures required classes
  }

  /** simple assert */
  function assert(cond, code, msg) { if (!cond) throw AppError(code, msg); }

  /** friendly error wrapper */
  function friendlyError(err) { return err && err.message ? err.message : 'Terjadi kesalahan pada server.'; }

  /** script properties helpers */
  function getScriptProp(key) { return PropertiesService.getScriptProperties().getProperty(key); }
  function setScriptProp(key, value) { PropertiesService.getScriptProperties().setProperty(key, value); }
  function deleteScriptProp(key) { PropertiesService.getScriptProperties().deleteProperty(key); }

  return {
    now, isoNow, formatDate, sha256Hex, hmacSha256Hex, randomHex,
    genSalt, genQrSecret, hashPassword, constantTimeEqual,
    normalizePhone, formatPhoneDisplay, sanitizeFilename,
    parseEventAccess, hasEventAccess, randomCode, toBool,
    formatRupiah, dateKeyJakarta, generatePassword,
    assert, friendlyError, getScriptProp, setScriptProp, deleteScriptProp
  };
})();
