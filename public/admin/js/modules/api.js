export const API_BASE = '/api/admin';
export const API_IMAGES_BASE = '/api';
export let token = '';
export const contacts = [];
export const quotes = [];
export const subscribers = [];
export const slots = [];
export const images = {};
export const activityLogs = [];
export const selectedContactIds = new Set();
export const selectedQuoteIds = new Set();

export const PER_PAGE = 10;
export const contentPage = {};

export const loadedTabs = new Set();
export let isDirty = false;

export const state = {
  contactPage: 1,
  quotePage: 1,
  contactDetailId: null,
  contactFilter: 'all',
  quoteFilter: 'all'
};

export function getHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export function markDirty() { isDirty = true; }
export function markClean() { isDirty = false; }

export function checkAuth() {
  token = '';
  localStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminLoggedIn');
  return true;
}

export function setToken(t) { token = t || ''; }
export function clearToken() {
  token = '';
  localStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminLoggedIn');
}

export function installAuthGuard() {
  if (window.__adminAuthGuardInstalled) return;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const [input, init] = args;
    const response = await nativeFetch(input, { ...(init || {}), credentials: 'same-origin' });
    const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const isAdminRequest = requestUrl.includes('/api/admin/') || requestUrl.includes('/api/images') || requestUrl.includes('/api/upload');
    if (isAdminRequest && response.status === 401) {
      clearToken();
      window.location.href = '/admin/login.html';
    }
    return response;
  };
  window.__adminAuthGuardInstalled = true;
}
