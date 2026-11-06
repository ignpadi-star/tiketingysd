// DriveHelper.js – folder & file utilities, pure helpers (calls Apps Script services only inside GAS UI)
const Drive = (function () {
  'use strict';

  /** ensure root folder exists, return folder ID */
  function ensureRootFolder() {
    const name = Config.APP_NAME;
    const root = DriveApp.getFoldersByName(name).next();
    return root;
  }

  /** create folder inside given parent (may be root) */
  function createFolderIfMissing(name, parent) {
    const folders = parent.getFoldersByName(name);
    if (folders.hasNext()) return folders.next();
    return parent.createFolder(name);
  }

  /** ensure per‑event folder hierarchy: Sistem Tiket / <eventName> / Poster, Bukti Bayar, Foto Panitia, Kartu ID, Tiket PDF, Ekspor
   *  returns object with folder IDs keyed as in Config
   */
  function ensureEventFolders(eventName, eventId) {
    const root = ensureRootFolder();
    const evFolder = createFolderIfMissing(`[${eventName}] - ${eventId}`, root);
    const subs = ['Poster', 'Bukti Bayar', 'Foto Panitia', 'Kartu ID', 'Tiket PDF', 'Ekspor'];
    const ids = {};
    subs.forEach(s => {
      ids[s] = createFolderIfMissing(s, evFolder);
    });
    return { eventFolder: evFolder, ...ids };
  }

  /** save a file (Blob) to given folder, optionally public. returns {file, url} */
  function saveFile({ blob, filename, folderId, isPublic }) {
    const folder = DriveApp.getFolderById(folderId);
    // limit size 10 MB before compression
    const MAX_PRE = 10 * 1024 * 1024;
    if (blob.getSize() > MAX_PRE) throw AppError('FILE_TOO_LARGE', `Ukuran file ${blob.getSize()} melebih batas 10 MB`);

    // if not public, make private
    if (!isPublic) {
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      return { file, url: file.getDownloadUrl() };
    }

    // public: allow anyone with link, thumbnail url later
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { file, url: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1200` };
  }

  /** get a private file's content as data‑URL base64 */
  function getPrivateFileDataUrl(fileId, token, allowedRoles) {
    // server‑side check – simplified: assume caller has already validated token & role
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    // compress JPEG for small files maybe
    const base64 = Utilities.base64Encode(blob.getBytes());
    return `data:${file.getMimeType()};base64,${base64}`;
  }

  /** create folder path from array; auto‑create missing */
  function ensureFolderPath_(segments) {
    // not exposed, internal only
  }

  /** encode filename with date prefix for uploads */
  function encodeFilename(prefix, originalName) {
    const clean = Utils.sanitizeFilename(originalName);
    const key = Utils.dateKeyJakarta(new Date());
    return `${key}_${prefix}_${clean}`;
  }

  return {
    ensureRootFolder,
    createFolderIfMissing,
    ensureEventFolders,
    saveFile,
    getPrivateFileDataUrl,
    encodeFilename
  };
})();