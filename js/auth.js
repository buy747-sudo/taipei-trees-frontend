/**
 * auth.js — taipei-trees.org 認證模組
 * 依賴：config.js（API_BASE）
 */

const AUTH_API = API_BASE.replace('/public', '') + '/api/auth';
const TOKEN_KEY = 'tt_token';
const USER_KEY  = 'tt_user';

const Auth = (() => {
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function getRole() {
    return getUser()?.role || 'public';
  }

  function _save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  /**
   * 帶 Authorization header 的 fetch。
   * token 過期（401）時自動清除登入狀態並跳登入頁。
   */
  async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    // FormData must let the browser set multipart/form-data with its boundary.
    if ((typeof FormData !== 'undefined' && options.body instanceof FormData) ||
        headers['Content-Type'] === null) {
      delete headers['Content-Type'];
    }
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      logout();
      window.location.href = '/login.html?expired=1';
      return null;
    }
    return res;
  }

  async function login(username, password) {
    const res = await fetch(`${AUTH_API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '登入失敗');
    const user = data.user || data; // 相容平層與巢狀兩種格式
    _save(data.token, {
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      contractor_id: user.contractor_id,
    });
    return data;
  }

  return { getToken, getUser, isLoggedIn, getRole, logout, authFetch, login };
})();
