// CoreLogic.js – pure logic, no Apps Script services
const CoreLogic = (function () {
  'use strict';
  const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  /** remove control chars, trim, limit */
  function sanitizeText(txt, max) {
    if (typeof txt !== 'string') return '';
    const clean = txt.replace(/[\x00-\x1F\x7F]/g, '').trim();
    return max ? clean.slice(0, max) : clean;
  }

  /** generate random ID of given length */
  function randomId(len, randomFn = Math.random) {
    let out = '';
    for (let i = 0; i < len; i++) {
      out += ID_ALPHABET.charAt(Math.floor(randomFn() * ID_ALPHABET.length));
    }
    return out;
  }

  /** purchase ID: TKT-YYYYMMDD-XXXX */
  function createPurchaseId(date = new Date(), randomFn = Math.random) {
    const key = Utils.dateKeyJakarta(date);
    const suffix = randomId(4, randomFn);
    return `TKT-${key}-${suffix}`;
  }

  /** ticket ID: <purchaseId>-NN (2‑digit) */
  function createTicketId(purchaseId, index) {
    const ii = String(index).padStart(2, '0');
    return `${purchaseId}-${ii}`;
  }

  /** 3‑digit unique code (001‑999) */
  function createUniqueCode(randomFn = Math.random) {
    const n = Math.floor(randomFn() * 999) + 1; // 1‑999
    return String(n).padStart(3, '0');
  }

  /** subtotal = price * qty, total = subtotal + uniqueCode (as number) */
  function calculateTotal(price, qty, uniqueCode) {
    const p = Number(price);
    const q = Number(qty);
    const u = Number(uniqueCode);
    if (isNaN(p) || p < 0) throw AppError('INVALID_PRICE', 'Harga tidak valid');
    if (isNaN(q) || q <= 0) throw AppError('INVALID_QTY', 'Jumlah tiket tidak valid');
    const subtotal = p * q;
    const total = subtotal + u;
    return { subtotal, total };
  }

  /** parse and validate phone */
  function normalizePhoneNumber(raw) {
    return Utils.normalizePhone(raw);
  }

  /** format phone for UI */
  function formatPhoneDisplay(num) { return Utils.formatPhoneDisplay(num); }

  /** safe filename */
  function sanitizeFilename(name) { return Utils.sanitizeFilename(name); }

  /** parse event list */
  function parseEventAccess(str) { return Utils.parseEventAccess(str); }

  /** check access */
  function hasEventAccess(user, eventId) { return Utils.hasEventAccess(user, eventId); }

  /** constant‑time compare */
  function constantTimeEqual(a, b) { return Utils.constantTimeEqual(a, b); }

  /** random code helper */
  function randomCode(len, randomFn = Math.random) { return Utils.randomCode(len, randomFn); }

  /** to boolean */
  function toBool(v) { return Utils.toBool(v); }

  /** format rupiah */
  function formatRupiah(num) { return Utils.formatRupiah(num); }

  return {
    sanitizeText, randomId, createPurchaseId, createTicketId,
    createUniqueCode, calculateTotal,
    normalizePhoneNumber, formatPhoneDisplay,
    sanitizeFilename, parseEventAccess, hasEventAccess,
    constantTimeEqual, randomCode, toBool, formatRupiah
  };
})();
