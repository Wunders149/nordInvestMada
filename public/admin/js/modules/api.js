export const API_BASE = '/api/admin';
export const API_IMAGES_BASE = '/api';
export let token = '';
export let contacts = [];
export let quotes = [];
export let subscribers = [];
export let slots = [];
export let images = {};
export let activityLogs = [];
export let selectedContactIds = new Set();
export let selectedQuoteIds = new Set();

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
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

export function markDirty() { isDirty = true; }
export function markClean() { isDirty = false; }

export function checkAuth() {
  token = localStorage.getItem('adminToken');
  if (!token) { window.location.href = '/admin/login.html'; return false; }
  return true;
}

export function setToken(t) { token = t; localStorage.setItem('adminToken', t); }
export function clearToken() { token = ''; localStorage.removeItem('adminToken'); }
