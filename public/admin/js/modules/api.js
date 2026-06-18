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
  token = localStorage.getItem('adminToken');
  if (!token && !sessionStorage.getItem('adminLoggedIn')) {
    window.location.href = '/admin/login.html';
    return false;
  }
  return true;
}

export function setToken(t) { token = t; localStorage.setItem('adminToken', t); }
export function clearToken() {
  token = '';
  localStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminLoggedIn');
}
