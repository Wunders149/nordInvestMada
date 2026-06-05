import { escapeHtml, formatDate, formatDateShort } from './helpers.js';
import { isDirty, markClean, API_BASE, getHeaders, clearToken, contacts, quotes, contentPage, loadedTabs, selectedContactIds, selectedQuoteIds, contactPage, quotePage } from './api.js';

export let confirmCallback = null;

export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ'}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function showConfirm(title, msg, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmModal').classList.add('open');
  confirmCallback = cb;
}

export function showSkeletonTable(id, cols, rows = 5) {
  const tbody = document.getElementById(id);
  if (!tbody) return;
  tbody.innerHTML = Array(rows).fill(0).map(() =>
    `<tr class="skeleton-row">${Array(cols).fill(0).map(() => '<td><div class="skeleton skeleton-cell"></div></td>').join('')}</tr>`
  ).join('');
}

export function showSkeletonStats() {
  document.querySelectorAll('.stat-value').forEach(el => {
    el.textContent = '—';
    el.style.opacity = '0.3';
  });
}

export function showSkeletonGrid(id, count = 6) {
  const grid = document.getElementById(id);
  if (!grid) return;
  grid.innerHTML = Array(count).fill(0).map(() =>
    `<div class="skeleton skeleton-card"></div>`
  ).join('');
}

export function renderPagination(id, page, total, perPage, onPage) {
  const el = document.getElementById(id);
  if (!el) return;
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  html += `<button class="pagination-btn" ${page <= 1 ? 'disabled' : ''} onclick="window._pg_${onPage}(${page - 1})">‹</button>`;
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  if (start > 1) html += `<button class="pagination-btn" onclick="window._pg_${onPage}(1)">1</button>${start > 2 ? '<span class="pagination-info">…</span>' : ''}`;
  for (let i = start; i <= end; i++) {
    html += `<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="window._pg_${onPage}(${i})">${i}</button>`;
  }
  if (end < totalPages) html += `${end < totalPages - 1 ? '<span class="pagination-info">…</span>' : ''}<button class="pagination-btn" onclick="window._pg_${onPage}(${totalPages})">${totalPages}</button>`;
  html += `<button class="pagination-btn" ${page >= totalPages ? 'disabled' : ''} onclick="window._pg_${onPage}(${page + 1})">›</button>`;
  el.innerHTML = html;
}

export function emptyState(icon, title, desc) {
  return `
    <tr><td colspan="99">
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <div class="empty-title">${title}</div>
        <div class="empty-desc">${desc}</div>
      </div>
    </td></tr>
  `;
}

export function emptyStateGrid(icon, title, desc) {
  return `<div class="empty-state" style="grid-column:1/-1">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${title}</div>
    <div class="empty-desc">${desc}</div>
  </div>`;
}

export function exportToCsv(filename, rows) {
  if (rows.length === 0) return showToast('Aucune donnée à exporter', 'info');
  const bom = '\uFEFF';
  const csv = bom + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Fichier CSV téléchargé', 'success');
}

export function initDarkMode() {
  const saved = localStorage.getItem('adminDarkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'true' || (saved === null && prefersDark)) {
    document.body.classList.add('dark');
  }
  updateDarkBtn();
}

export function updateDarkBtn() {
  const btn = document.getElementById('darkModeBtn');
  if (!btn) return;
  const isDark = document.body.classList.contains('dark');
  btn.innerHTML = isDark ? '☀️ Mode clair' : '🌙 Mode sombre';
}

export function confirmNavigation(callback) {
  if (!isDirty) { callback(); return; }
  showConfirm('Modifications non enregistrées', 'Vous avez des modifications non enregistrées. Voulez-vous vraiment quitter ?', () => {
    markClean();
    callback();
  });
}

export function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  lb.classList.add('open');
}
