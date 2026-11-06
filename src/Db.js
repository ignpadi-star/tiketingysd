// Db.js – thin wrapper around SpreadsheetApp, pure‑logic helpers separate
const Db = (function () {
  'use strict';

  /** get spreadsheet by ID stored in script properties */
  function getSpreadsheet() {
    let id = Utils.getScriptProp(Utils.SCRIPT_PROP_SPREADSHEET_ID);
    if (!id) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) throw AppError('NO_SPREADSHEET', 'Spreadsheet belum tersedia.');
      id = ss.getId();
      Utils.setScriptProp(Utils.SCRIPT_PROP_SPREADSHEET_ID, id);
    }
    return SpreadsheetApp.openById(id);
  }

  /** ensure sheet exists, create with headers if missing */
  function ensureSheet(name, headers) {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
    }
    return sheet;
  }

  /** read all rows as arrays (skip header) */
  function readAll(name) {
    const sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    return data.slice(1);
  }

  /** read rows as objects keyed by header (header row first row) */
  function readObjects(name) {
    const sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const header = data[0].map(h => String(h).trim());
    const rows = data.slice(1);
    return rows.map(row => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = row[i]; });
      obj.__rowNumber = row[0] ? (row[0] instanceof Date ? null : null) : null; // placeholder, actual row index computed later if needed
      return obj;
    });
  }

  /** find row index (1‑based) for a key column value */
  function findRow(name, keyCol, value) {
    const sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    const header = data[0];
    const colIdx = header.findIndex(h => h === keyCol);
    if (colIdx < 0) return null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][colIdx] == value) return i + 1; // 1‑based row number
    }
    return null;
  }

  /** append single object */
  function appendObject(name, obj) {
    const sheet = ensureSheet(name, Object.keys(obj));
    const values = Object.values(obj);
    sheet.appendRow(values);
  }

  /** append multiple objects (same keys) */
  function appendObjects(name, objs) {
    if (!objs.length) return;
    const sheet = ensureSheet(name, Object.keys(objs[0]));
    const rows = objs.map(o => Object.values(o));
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  /** update row by row number (1‑based) with object (partial) */
  function updateRow(name, rowNum, patch) {
    const sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) throw AppError('NO_SHEET', `Sheet ${name} tidak ada`);
    const header = sheet.getDataRange().offset(0, 0, 1).getValues()[0];
    const colMap = {};
    Object.keys(patch).forEach(k => {
      const idx = header.indexOf(k);
      if (idx < 0) throw AppError('UNKNOWN_COLUMN', `Kolom ${k} tidak dikenal pada ${name}`);
      colMap[idx] = patch[k];
    });
    const cols = Object.keys(colMap).map(i => Number(i) + 1);
    const values = cols.map(i => colMap[i - 1]);
    sheet.getRange(rowNum, Math.min(...cols), 1, cols.length).setValues([values]);
  }

  /** lock wrapper for critical sections */
  function withLock(fn) {
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  return {
    getSpreadsheet,
    ensureSheet,
    readAll,
    readObjects,
    findRow,
    appendObject,
    appendObjects,
    updateRow,
    withLock
  };
})();
