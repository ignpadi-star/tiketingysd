// Auth.js – login, session, role checks
// Global callable from wrappers (google.script.run) – must not start with underscore
const Auth = (function () {
  'use strict';
  const ConfigObj = Config;

  /** salt length 32 hex chars */
  function createSalt() { return Utils.genSalt(); }

  /** hash pw with salt */
  function hashPassword(pw, salt) { return Utils.hashPassword(pw, salt); }

  /** create a fresh session token */
  function genToken() { return Utils.randomHex(12); }

  /** store session JSON in CacheService */
  function setSession(token, userInfo) {
    const cache = CacheService.getScriptCache();
    cache.put(`session:${token}`, JSON.stringify(userInfo), ConfigObj.CACHE_TTL_SECONDS);
  }

  /** retrieve session */
  function getSession(token) {
    const cache = CacheService.getScriptCache();
    const raw = cache.get(`session:${token}`);
    return raw ? JSON.parse(raw) : null;
  }

  /** invalidate session */
  function invalidate(token) {
    const cache = CacheService.getScriptCache();
    cache.remove(`session:${token}`);
  }

  /** require authenticated user – throws if not valid */
  function requireUser(token) {
    const user = getSession(token);
    if (!user) throw AppError('SESSION_EXPIRED', 'Token sesi tidak valid atau kadaluarsa');
    if (!user.aktif) throw AppError('USER_INACTIVE', 'User tidak aktif');
    if (user.locked) throw AppError('USER_LOCKED', 'User terkunci');
    return user;
  }

  /** role check on top of requireUser */
  function requireRole(token, allowedRoles) {
    const user = requireUser(token);
    if (!allowedRoles.includes(user.role)) {
      throw AppError('INSUFFICIENT_ROLE', 'Anda tidak memiliki role yang dibutuhkan');
    }
    return user;
  }

  /** assert event access for non‑admin users */
  function assertEventAccess(user, eventId) {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'ACC' || user.role === 'GATE') {
      const allowed = parseEventAccess(user.event_diizinkan || '');
      if (allowed.length > 0 && !allowed.includes(eventId)) {
        throw AppError('EVENT_NOT_ALLOWED', 'Event ini tidak boleh diakses user ini');
      }
    }
  }

  /** ---------- public‑facing functions (via wrappers) ---------- */

  /** login; returns {ok, token?, user?, error?} */
  function login(username, password) {
    username = (username || '').trim().toLowerCase();
    password = String(password || '');
    if (!username) return { ok: false, error: 'Masukkan username' };
    if (Utils.LOGIN_MAX_ATTEMPTS) {
      // simple lock per username
      const attemptsKey = `login_attempts:${username}`;
      const attempts = parseInt(Utils.getScriptProp(attemptsKey) || '0', 10);
      if (attempts >= ConfigObj.LOGIN_MAX_ATTEMPTS) {
        const lockKey = `login_lock:${username}`;
        const lockedSince = Utils.getScriptProp(lockKey);
        if (lockedSince) {
          const lockedTs = new Date(lockedSince).getTime();
          const nowTs = new Date().getTime();
          if (nowTs - lockedTs < ConfigObj.LOGIN_LOCK_SECONDS * 1000) {
            return { ok: false, error: `Terlalu banyak percobaan login gagal. Coba lagi setelah ${Math.ceil((lockedTs + ConfigObj.LOGIN_LOCK_SECONDS * 1000 - nowTs) / 1000)} detik.` };
          }
        } else {
          Utils.setScriptProp(lockKey, isoNow()); // lock immediate
          return { ok: false, error: `Terlalu banyak percobaan login gagal. Coba lagi setelah ${ConfigObj.LOGIN_LOCK_SECONDS / 60} menit.` };
        }
      }
    }
    // fetch users sheet
    const users = Db.readObjects('Users');
    const userRow = users.find(u => u.username.toLowerCase() === username);
    if (!userRow) {
      Utils.setScriptProp(`login_attempts:${username}`, (parseInt(Utils.getScriptProp(`login_attempts:${username}`) || '0', 10) + 1).toString());
      return { ok: false, error: 'Username atau password salah' };
    }
    // reset attempts on success
    Utils.deleteScriptProp(`login_attempts:${username}`);
    Utils.deleteScriptProp(`login_lock:${username}`);

    const { password_hash, salt, role, event_diizinkan, aktif } = userRow;
    // check password: SHA‑256(salt + pw)
    const pwHash = hashPassword(password, salt);
    if (!Utils.constantTimeEqual(pwHash, password_hash)) {
      // increment attempts and lock if threshold exceeded
      const attemptsKey = `login_attempts:${username}`;
      const newAttempts = (parseInt(Utils.getScriptProp(attemptsKey) || '0', 10) + 1).toString();
      Utils.setScriptProp(attemptsKey, newAttempts);
      if (parseInt(newAttempts, 10) >= ConfigObj.LOGIN_MAX_ATTEMPTS) {
        Utils.setScriptProp(`login_lock:${username}`, isoNow());
      }
      return { ok: false, error: 'Username atau password salah' };
    }
    if (String(aktif).toLowerCase() !== 'true') {
      return { ok: false, error: 'User tidak aktif' };
    }

    const token = genToken();
    const userInfo = {
      id_user: userRow.id_user,
      username: userRow.username,
      nama: userRow.nama,
      role: role,
      event_diizinkan: userRow.event_diizinkan ? userRow.event_diizinkan.split(',').map(s=>s.trim()) : [],
      aktif: aktif === 'true' || aktif === true,
      dibuat_pada: userRow.dibuat_pada,
      __token: token
    };
    setSession(token, userInfo);
    return { ok: true, token, user: userInfo };
  }

  /** logout */
  function logout(token) {
    invalidate(token);
    // optional audit
    // Audit.log(currentUser, 'LOGOUT', `token invalidated`);
    return { ok: true };
  }

  /** change password – validates current */
  function changePassword(token, oldPassword, newPassword) {
    const user = requireUser(token);
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ACC') {
      // only ACC can change own; but spec simplicity: allow admin only
      throw AppError('INSUFFICIENT_ROLE', 'Hanya SUPER_ADMIN yang bisa ganti password');
    }
    // old password verification
    const pwHash = hashPassword(oldPassword, user.saltFromRow);
    if (!Utils.constantTimeEqual(pwHash, user.passwordHashFromRow)) {
      throw AppError('INVALID_OLD_PASSWORD', 'Password lama salah');
    }
    const newSalt = Utils.genSalt();
    const newHash = Utils.hashPassword(newPassword, newSalt);
    // We need user row index. For simplicity, we'll only implement updateRow later when needed.
    // Here we'll just log error.
    return { ok: false, error: 'changePassword not fully wired yet' };
  }

  /** fetch current session data */
  function getCurrentUser(token) { return requireUser(token); }

  return {
    login,
    logout,
    changePassword,
    getCurrentUser,
    requireUser,
    requireRole,
    assertEventAccess
  };
})();