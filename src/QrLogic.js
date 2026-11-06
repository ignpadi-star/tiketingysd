// QrLogic.js – QR payload / HMAC handling (pure)
const QrLogic = (function () {
  'use strict';

  /** get secret from script properties (no side‑effects) */
  function getSecret() {
    const secret = Utils.getScriptProp(Utils.SCRIPT_PROP_QR_SECRET);
    if (!secret) throw AppError('MISSING_SECRET', 'Secret QR belum di‑setup');
    return secret;
  }

  /** token = HMAC‑SHA256(secret, id_tiket) hex */
  function createToken(idTiket) {
    const secret = getSecret();
    return Utils.hmacSha256Hex(secret, idTiket);
  }

  /** verify token */
  function verifyToken(idTiket, token) {
    const expected = createToken(idTiket);
    return Utils.constantTimeEqual(expected, token);
  }

  /** QR payload string – id_tiket|token */
  function encodePayload(idTiket) {
    return `${idTiket}|${createToken(idTiket)}`;
  }

  /** decode payload, return {idTiket, valid} */
  function decodePayload(payload) {
    const parts = String(payload).split('|');
    if (parts.length !== 2) return { valid: false };
    const [id, token] = parts;
    return { idTiket: id, valid: verifyToken(id, token) };
  }

  return { createToken, verifyToken, encodePayload, decodePayload };
})();
