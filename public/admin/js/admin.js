const API_BASE = '/api/admin';
let token = '';
let contacts = [];
let quotes = [];
let subscribers = [];
let slots = [];
let images = {};
let selectedContactIds = new Set();
let selectedQuoteIds = new Set();

// Pagination state
const PER_PAGE = 10;
let contactPage = 1;
let quotePage = 1;
let contactDetailId = null;

// Filter state
let contactFilter = 'all';
let quoteFilter = 'all';

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function getHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ══════════════════════════════════════════════
// SKELETON LOADING
// ══════════════════════════════════════════════

function showSkeletonTable(id, cols, rows = 5) {
  const tbody = document.getElementById(id);
  tbody.innerHTML = Array(rows).fill(0).map(() =>
    `<tr class="skeleton-row">${Array(cols).fill(0).map(() => '<td><div class="skeleton skeleton-cell"></div></td>').join('')}</tr>`
  ).join('');
}

function showSkeletonStats() {
  document.querySelectorAll('.stat-value').forEach(el => {
    el.textContent = '—';
    el.style.opacity = '0.3';
  });
}

function showSkeletonGrid(id, count = 6) {
  const grid = document.getElementById(id);
  grid.innerHTML = Array(count).fill(0).map(() =>
    `<div class="skeleton skeleton-card"></div>`
  ).join('');
}

// ══════════════════════════════════════════════
// PAGINATION
// ══════════════════════════════════════════════

function renderPagination(id, page, total, perPage, onPage) {
  const el = document.getElementById(id);
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

// ══════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════

function emptyState(icon, title, desc) {
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

// ══════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════════

function showToast(message, type = 'info') {
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

// ══════════════════════════════════════════════
// CONFIRM MODAL
// ══════════════════════════════════════════════

let confirmCallback = null;

function showConfirm(title, msg, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmModal').classList.add('open');
  confirmCallback = cb;
}

document.getElementById('confirmCancel').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.remove('open');
  confirmCallback = null;
});
document.getElementById('confirmOk').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.remove('open');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

// ══════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════

function checkAuth() {
  token = localStorage.getItem('adminToken');
  if (!token) { window.location.href = '/admin/login.html'; return false; }
  return true;
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  showConfirm('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', () => {
    fetch(`${API_BASE}/logout`, { method: 'POST', headers: getHeaders() })
      .catch(() => {})
      .finally(() => {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login.html';
      });
  });
});

// ─── DARK MODE ───
function initDarkMode() {
  const saved = localStorage.getItem('adminDarkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'true' || (saved === null && prefersDark)) {
    document.body.classList.add('dark');
  }
  updateDarkBtn();
}

function updateDarkBtn() {
  const btn = document.getElementById('darkModeBtn');
  if (!btn) return;
  const isDark = document.body.classList.contains('dark');
  btn.innerHTML = isDark ? '☀️ Mode clair' : '🌙 Mode sombre';
}

document.getElementById('darkModeBtn').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('adminDarkMode', isDark);
  updateDarkBtn();
  // Re-render charts with new theme
  renderCharts();
});

// ══════════════════════════════════════════════
// SIDEBAR NAVIGATION
// ══════════════════════════════════════════════

document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
});
document.getElementById('sidebarOverlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
});

function switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.add('active');
  const titles = {
    dashboard: 'Tableau de bord', contacts: 'Messages', quotes: 'Devis',
    subscribers: 'Newsletter', images: 'Galerie',
    team: 'Équipe', services: 'Services', projects: 'Projets',
    blog: 'Blog', pricing: 'Tarifs', settings: 'Paramètres'
  };
  document.getElementById('pageTitle').innerHTML = `${titles[tabId] || tabId} <small>Gestion</small>`;
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
  if (tabId === 'dashboard') renderDashboard();
  else if (tabId === 'contacts') loadContacts();
  else if (tabId === 'quotes') loadQuotes();
  else if (tabId === 'subscribers') loadSubscribers();
  else if (tabId === 'images') { loadSlots(); loadImages(); }
  else if (tabId === 'team') loadEntity('team');
  else if (tabId === 'services') loadEntity('services');
  else if (tabId === 'projects') loadEntity('projects');
  else if (tabId === 'blog') loadEntity('blog');
  else if (tabId === 'pricing') loadPricing();
  else if (tabId === 'settings') loadSettings();
}

document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// ══════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════

document.getElementById('contactSearch').addEventListener('input', () => { contactPage = 1; renderContacts(); });
document.getElementById('quoteSearch').addEventListener('input', () => { quotePage = 1; renderQuotes(); });
document.getElementById('subSearch').addEventListener('input', renderSubscribers);

// ══════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════

// ─── CHARTS ───
function renderCharts() {
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  // Contacts bar chart
  const ctx1 = document.getElementById('contactsChart');
  if (ctx1) {
    const canvas = ctx1;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = 180 * 2;
    const c = canvas.getContext('2d');
    c.scale(2, 2);
    const w = canvas.offsetWidth;
    const h = 180;

    c.clearRect(0, 0, w, h);

    // Aggregate contacts by month
    const monthly = {};
    contacts.forEach(ct => {
      const d = new Date(ct.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + 1;
    });
    const months = Object.keys(monthly).sort().slice(-6);
    const values = months.map(m => monthly[m] || 0);
    const maxVal = Math.max(...values, 1);

    if (months.length === 0) {
      c.fillStyle = textColor;
      c.font = '12px Inter, sans-serif';
      c.textAlign = 'center';
      c.fillText('Aucune donnée', w / 2, h / 2);
      return;
    }

    const pad = { top: 10, bottom: 24, left: 4, right: 4 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = Math.min(40, chartW / months.length * 0.6);
    const gap = chartW / months.length;

    // Grid lines
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (chartH / 3) * i;
      c.strokeStyle = gridColor;
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(pad.left, y);
      c.lineTo(w - pad.right, y);
      c.stroke();
    }

    // Bars
    months.forEach((m, i) => {
      const x = pad.left + gap * i + (gap - barW) / 2;
      const barH = (values[i] / maxVal) * chartH;
      const y = pad.top + chartH - barH;

      const grad = c.createLinearGradient(x, y, x, pad.top + chartH);
      grad.addColorStop(0, '#8B4513');
      grad.addColorStop(1, '#A0522D');
      c.fillStyle = grad;
      if (c.roundRect) {
        c.beginPath();
        c.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
        c.fill();
      } else {
        c.fillRect(x, y, barW, barH);
      }

      // Label
      c.fillStyle = textColor;
      c.font = '8px Inter, sans-serif';
      c.textAlign = 'center';
      const label = m.split('-')[1] + '/' + m.split('-')[0].slice(2);
      c.fillText(label, x + barW / 2, h - 4);
    });
  }

  // Quotes donut chart
  const ctx2 = document.getElementById('quotesChart');
  if (ctx2) {
    const canvas = ctx2;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = 180 * 2;
    const c = canvas.getContext('2d');
    c.scale(2, 2);
    const w = canvas.offsetWidth;
    const h = 180;

    c.clearRect(0, 0, w, h);

    const statuses = ['pending', 'in-progress', 'completed', 'cancelled'];
    const labels = ['En attente', 'En cours', 'Terminé', 'Annulé'];
    const colors = ['#d97706', '#2563eb', '#059669', '#94a3b8'];
    const counts = statuses.map(s => quotes.filter(q => (q.status || 'pending') === s).length);
    const total = counts.reduce((a, b) => a + b, 0);

    if (total === 0) {
      c.fillStyle = textColor;
      c.font = '12px Inter, sans-serif';
      c.textAlign = 'center';
      c.fillText('Aucune donnée', w / 2, h / 2);
      return;
    }

    const cx = w * 0.33;
    const cy = h / 2;
    const radius = Math.min(cx - 10, cy - 10, 55);
    const innerRadius = radius * 0.55;

    let startAngle = -Math.PI / 2;
    counts.forEach((count, i) => {
      if (count === 0) return;
      const sliceAngle = (count / total) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + innerRadius * Math.cos(startAngle), cy + innerRadius * Math.sin(startAngle));
      c.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      c.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      c.closePath();
      c.fillStyle = colors[i];
      c.fill();
      startAngle += sliceAngle;
    });

    // Center text
    c.fillStyle = textColor;
    c.font = 'bold 18px Inter, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(total, cx, cy - 4);
    c.font = '8px Inter, sans-serif';
    c.fillText('Total', cx, cy + 12);

    // Legend
    const legendX = w * 0.55;
    let legendY = 30;
    labels.forEach((label, i) => {
      if (counts[i] === 0) return;
      c.fillStyle = colors[i];
      c.beginPath();
      c.arc(legendX, legendY, 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = textColor;
      c.font = '11px Inter, sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(`${label} (${counts[i]})`, legendX + 12, legendY);
      legendY += 22;
    });
  }
}

async function loadStats() {
  showSkeletonStats();
  try {
    const res = await fetch(`${API_BASE}/stats`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    document.getElementById('statContacts').textContent = data.totalContacts;
    document.getElementById('statUnread').textContent = data.unreadContacts;
    document.getElementById('statQuotes').textContent = data.totalQuotes;
    document.getElementById('statPending').textContent = data.pendingQuotes;
    document.getElementById('statSubscribers').textContent = data.totalSubscribers;
    document.querySelectorAll('.stat-value').forEach(el => el.style.opacity = '');
    const badge = document.getElementById('navBadgeUnread');
    if (data.unreadContacts > 0) { badge.textContent = data.unreadContacts; badge.style.display = ''; }
    else { badge.style.display = 'none'; }
    document.getElementById('lastUpdate').textContent = `Mis à jour ${formatDateShort(data.lastUpdate)}`;
  } catch (err) { console.error('Stats error:', err); }
}

// ══════════════════════════════════════════════
// CONTACTS CRUD
// ══════════════════════════════════════════════

function setContactFilter(filter) {
  contactFilter = filter;
  document.querySelectorAll('#contactFilterBar .filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`#contactFilterBar .filter-btn[data-filter="${filter}"]`).classList.add('active');
  contactPage = 1;
  renderContacts();
}

function setQuoteFilter(filter) {
  quoteFilter = filter;
  document.querySelectorAll('#quoteFilterBar .filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`#quoteFilterBar .filter-btn[data-filter="${filter}"]`).classList.add('active');
  quotePage = 1;
  renderQuotes();
}

async function markAllRead() {
  const unread = contacts.filter(c => !c.read);
  if (unread.length === 0) { showToast('Tous les messages sont déjà lus', 'info'); return; }
  try {
    await Promise.all(unread.map(c =>
      fetch(`${API_BASE}/contacts/${c.id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ read: true }) })
    ));
    unread.forEach(c => c.read = true);
    renderContacts(); loadStats();
    showToast(`${unread.length} message(s) marqué(s) comme lu`, 'success');
  } catch (err) { showToast('Erreur', 'error'); }
}

async function loadContacts() {
  showSkeletonTable('contactsBody', 7);
  try {
    const res = await fetch(`${API_BASE}/contacts`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    contacts = await res.json();
    contactPage = 1;
    renderContacts();
    renderDashboard();
  } catch (err) { console.error('Contacts error:', err); }
}

window._pg_contact = (p) => { contactPage = p; renderContacts(); };

// ─── BULK CONTACT ACTIONS ───
function toggleContactSelect(id, checked) {
  if (checked) selectedContactIds.add(id);
  else selectedContactIds.delete(id);
  updateContactBulkBar();
}
function toggleAllContacts(checked) {
  const search = document.getElementById('contactSearch').value.toLowerCase();
  let filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search) ||
    c.email.toLowerCase().includes(search) ||
    c.phone.toLowerCase().includes(search)
  );
  if (contactFilter !== 'all') {
    if (contactFilter === 'new') filtered = filtered.filter(c => !c.read);
    else if (contactFilter === 'read') filtered = filtered.filter(c => c.read && !c.resolved);
    else if (contactFilter === 'resolved') filtered = filtered.filter(c => c.resolved);
  }
  if (checked) {
    filtered.forEach(c => selectedContactIds.add(c.id));
  } else {
    selectedContactIds.clear();
  }
  renderContacts();
}
function clearContactSelection() {
  selectedContactIds.clear();
  document.getElementById('contactSelectAll').checked = false;
  renderContacts();
}
function updateContactBulkBar() {
  const bar = document.getElementById('contactBulkBar');
  const count = document.getElementById('contactBulkCount');
  const total = selectedContactIds.size;
  if (total === 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  count.textContent = `${total} sélectionné(s)`;
}
async function bulkMarkRead() {
  const ids = [...selectedContactIds];
  if (ids.length === 0) return;
  try {
    await Promise.all(ids.map(id =>
      fetch(`${API_BASE}/contacts/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ read: true }) })
    ));
    ids.forEach(id => { const c = contacts.find(x => x.id === id); if (c) c.read = true; });
    selectedContactIds.clear();
    document.getElementById('contactSelectAll').checked = false;
    renderContacts(); loadStats();
    showToast(`${ids.length} message(s) marqué(s) comme lu`, 'success');
  } catch (err) { showToast('Erreur', 'error'); }
}
async function bulkDeleteContacts() {
  const ids = [...selectedContactIds];
  if (ids.length === 0) return;
  showConfirm('Supprimer plusieurs messages', `Supprimer ${ids.length} message(s) ? Cette action est irréversible.`, async () => {
    try {
      await Promise.all(ids.map(id =>
        fetch(`${API_BASE}/contacts/${id}`, { method: 'DELETE', headers: getHeaders() })
      ));
      contacts = contacts.filter(c => !selectedContactIds.has(c.id));
      selectedContactIds.clear();
      document.getElementById('contactSelectAll').checked = false;
      renderContacts(); loadStats();
      showToast(`${ids.length} message(s) supprimé(s)`, 'success');
    } catch (err) { showToast('Erreur', 'error'); }
  });
}

function renderContacts() {
  const search = document.getElementById('contactSearch').value.toLowerCase();
  const tbody = document.getElementById('contactsBody');
  let filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search) ||
    c.email.toLowerCase().includes(search) ||
    c.phone.toLowerCase().includes(search)
  );
  if (contactFilter !== 'all') {
    if (contactFilter === 'new') filtered = filtered.filter(c => !c.read);
    else if (contactFilter === 'read') filtered = filtered.filter(c => c.read && !c.resolved);
    else if (contactFilter === 'resolved') filtered = filtered.filter(c => c.resolved);
  }
  const totalNew = contacts.filter(c => !c.read).length;
  document.getElementById('filterContactNew').textContent = totalNew;
  if (contactPage > Math.ceil(filtered.length / PER_PAGE)) contactPage = 1;
  if (filtered.length === 0) {
    tbody.innerHTML = emptyState('✉', 'Aucun message', contactFilter === 'new' ? 'Aucun nouveau message.' : contactFilter === 'resolved' ? 'Aucun message résolu.' : 'Les messages de contact apparaîtront ici.');
    document.getElementById('contactsPagination').innerHTML = '';
    return;
  }
  const total = filtered.length;
  const start = (contactPage - 1) * PER_PAGE;
  const page = filtered.slice(start, start + PER_PAGE);
  tbody.innerHTML = page.map(c => `
    <tr class="${!c.read ? 'unread' : ''}" style="cursor:pointer" onclick="openContactDetail('${c.id}')">
      <td onclick="event.stopPropagation()" style="width:36px">
        <input type="checkbox" class="contact-check" value="${c.id}" ${selectedContactIds.has(c.id) ? 'checked' : ''} onchange="toggleContactSelect('${c.id}', this.checked)">
      </td>
      <td data-label="Date">${formatDate(c.date)}</td>
      <td data-label="Nom"><strong>${escapeHtml(c.name)}</strong></td>
      <td data-label="Email"><a href="mailto:${escapeHtml(c.email)}" onclick="event.stopPropagation()">${escapeHtml(c.email)}</a></td>
      <td data-label="Projet">${escapeHtml(c.projectType)}${c.budget ? `<br><small style="color:var(--gray-400)">Budget: ${escapeHtml(c.budget)}</small>` : ''}</td>
      <td data-label="Message" class="msg-cell" title="${escapeHtml(c.message)}">${escapeHtml(c.message).substring(0, 80)}${c.message.length > 80 ? '...' : ''}</td>
      <td data-label="Statut">
        ${c.resolved ? '<span class="badge badge-success">Résolu</span>' : c.read ? '<span class="badge badge-info">Lu</span>' : '<span class="badge badge-warning">Nouveau</span>'}
      </td>
      <td class="actions-cell" onclick="event.stopPropagation()">
        ${!c.read ? `<button class="btn-icon success" onclick="markRead('${c.id}')" title="Marquer lu">✓</button>` : ''}
        ${!c.resolved ? `<button class="btn-icon info" onclick="markResolved('${c.id}')" title="Résoudre">✓</button>` : ''}
        <button class="btn-icon danger" onclick="confirmDeleteContact('${c.id}')" title="Supprimer">✕</button>
      </td>
    </tr>
  `).join('');
  renderPagination('contactsPagination', contactPage, total, PER_PAGE, 'contact');
  updateContactBulkBar();
}

async function markRead(id) {
  try {
    await fetch(`${API_BASE}/contacts/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ read: true }) });
    const c = contacts.find(x => x.id === id);
    if (c) c.read = true;
    renderContacts(); loadStats();
  } catch (err) { console.error(err); }
}

async function markResolved(id) {
  try {
    await fetch(`${API_BASE}/contacts/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ read: true, resolved: true }) });
    const c = contacts.find(x => x.id === id);
    if (c) { c.read = true; c.resolved = true; }
    renderContacts(); loadStats();
    showToast('Message marqué comme résolu', 'success');
  } catch (err) { console.error(err); }
}

function confirmDeleteContact(id) {
  showConfirm('Supprimer le message', 'Cette action est irréversible.', async () => {
    try {
      await fetch(`${API_BASE}/contacts/${id}`, { method: 'DELETE', headers: getHeaders() });
      contacts = contacts.filter(c => c.id !== id);
      renderContacts(); loadStats();
      showToast('Message supprimé', 'success');
    } catch (err) { console.error(err); }
  });
}

// ══════════════════════════════════════════════
// QUOTES CRUD
// ══════════════════════════════════════════════

async function loadQuotes() {
  showSkeletonTable('quotesBody', 8);
  try {
    const res = await fetch(`${API_BASE}/quotes`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    quotes = await res.json();
    quotePage = 1;
    renderQuotes();
    renderDashboard();
  } catch (err) { console.error('Quotes error:', err); }
}

window._pg_quote = (p) => { quotePage = p; renderQuotes(); };

function renderQuotes() {
  const search = document.getElementById('quoteSearch').value.toLowerCase();
  const tbody = document.getElementById('quotesBody');
  let filtered = quotes.filter(q =>
    q.name.toLowerCase().includes(search) ||
    q.email.toLowerCase().includes(search) ||
    q.quoteNumber.toLowerCase().includes(search)
  );
  if (quoteFilter !== 'all') {
    filtered = filtered.filter(q => (q.status || 'pending') === quoteFilter);
  }
  const totalPending = quotes.filter(q => (q.status || 'pending') === 'pending').length;
  document.getElementById('filterQuotePending').textContent = totalPending;
  if (quotePage > Math.ceil(filtered.length / PER_PAGE)) quotePage = 1;
  if (filtered.length === 0) {
    tbody.innerHTML = emptyState('📋', 'Aucun devis', quoteFilter === 'pending' ? 'Aucun devis en attente.' : 'Les demandes de devis apparaîtront ici.');
    document.getElementById('quotesPagination').innerHTML = '';
    return;
  }
  const total = filtered.length;
  const start = (quotePage - 1) * PER_PAGE;
  const page = filtered.slice(start, start + PER_PAGE);
  tbody.innerHTML = page.map(q => `
    <tr>
      <td onclick="event.stopPropagation()" style="width:36px">
        <input type="checkbox" class="quote-check" value="${q.id}" ${selectedQuoteIds.has(q.id) ? 'checked' : ''} onchange="toggleQuoteSelect('${q.id}', this.checked)">
      </td>
      <td data-label="Date">${formatDate(q.date)}</td>
      <td data-label="N° Devis"><code>${escapeHtml(q.quoteNumber)}</code></td>
      <td data-label="Nom"><strong>${escapeHtml(q.name)}</strong></td>
      <td data-label="Email"><a href="mailto:${escapeHtml(q.email)}">${escapeHtml(q.email)}</a></td>
      <td data-label="Service">${escapeHtml(q.serviceType)}</td>
      <td data-label="Localisation">${escapeHtml(q.location) || '—'}</td>
      <td data-label="Statut">
        <select class="status-select" onchange="updateQuoteStatus('${q.id}', this.value)">
          <option value="pending" ${(q.status || 'pending') === 'pending' ? 'selected' : ''}>En attente</option>
          <option value="in-progress" ${q.status === 'in-progress' ? 'selected' : ''}>En cours</option>
          <option value="completed" ${q.status === 'completed' ? 'selected' : ''}>Terminé</option>
          <option value="cancelled" ${q.status === 'cancelled' ? 'selected' : ''}>Annulé</option>
        </select>
      </td>
      <td class="actions-cell">
        <button class="btn-icon danger" onclick="confirmDeleteQuote('${q.id}')" title="Supprimer">✕</button>
      </td>
    </tr>
  `).join('');
  renderPagination('quotesPagination', quotePage, total, PER_PAGE, 'quote');
  updateQuoteBulkBar();
}

async function updateQuoteStatus(id, status) {
  try {
    await fetch(`${API_BASE}/quotes/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status }) });
    const q = quotes.find(x => x.id === id);
    if (q) q.status = status;
    loadStats();
    showToast('Statut mis à jour', 'success');
  } catch (err) { console.error(err); }
}

function confirmDeleteQuote(id) {
  showConfirm('Supprimer le devis', 'Cette action est irréversible.', async () => {
    try {
      await fetch(`${API_BASE}/quotes/${id}`, { method: 'DELETE', headers: getHeaders() });
      quotes = quotes.filter(q => q.id !== id);
      renderQuotes(); loadStats();
      showToast('Devis supprimé', 'success');
    } catch (err) { console.error(err); }
  });
}

// ─── BULK QUOTE ACTIONS ───
function toggleQuoteSelect(id, checked) {
  if (checked) selectedQuoteIds.add(id);
  else selectedQuoteIds.delete(id);
  updateQuoteBulkBar();
}
function toggleAllQuotes(checked) {
  const search = document.getElementById('quoteSearch').value.toLowerCase();
  let filtered = quotes.filter(q =>
    q.name.toLowerCase().includes(search) ||
    q.email.toLowerCase().includes(search) ||
    q.quoteNumber.toLowerCase().includes(search)
  );
  if (quoteFilter !== 'all') {
    filtered = filtered.filter(q => (q.status || 'pending') === quoteFilter);
  }
  if (checked) { filtered.forEach(q => selectedQuoteIds.add(q.id)); }
  else { selectedQuoteIds.clear(); }
  renderQuotes();
}
function clearQuoteSelection() {
  selectedQuoteIds.clear();
  document.getElementById('quoteSelectAll').checked = false;
  renderQuotes();
}
function updateQuoteBulkBar() {
  const bar = document.getElementById('quoteBulkBar');
  const count = document.getElementById('quoteBulkCount');
  const total = selectedQuoteIds.size;
  if (total === 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  count.textContent = `${total} sélectionné(s)`;
}
async function bulkDeleteQuotes() {
  const ids = [...selectedQuoteIds];
  if (ids.length === 0) return;
  showConfirm('Supprimer plusieurs devis', `Supprimer ${ids.length} devis(s) ? Cette action est irréversible.`, async () => {
    try {
      await Promise.all(ids.map(id =>
        fetch(`${API_BASE}/quotes/${id}`, { method: 'DELETE', headers: getHeaders() })
      ));
      quotes = quotes.filter(q => !selectedQuoteIds.has(q.id));
      selectedQuoteIds.clear();
      document.getElementById('quoteSelectAll').checked = false;
      renderQuotes(); loadStats();
      showToast(`${ids.length} devis(s) supprimé(s)`, 'success');
    } catch (err) { showToast('Erreur', 'error'); }
  });
}

// ══════════════════════════════════════════════
// SUBSCRIBERS CRUD
// ══════════════════════════════════════════════

async function loadSubscribers() {
  showSkeletonTable('subscribersBody', 3, 4);
  try {
    const res = await fetch(`${API_BASE}/subscribers`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    subscribers = await res.json();
    renderSubscribers();
  } catch (err) { console.error('Subscribers error:', err); }
}

function renderSubscribers() {
  const search = document.getElementById('subSearch').value.toLowerCase();
  const tbody = document.getElementById('subscribersBody');
  const filtered = subscribers.filter(s => s.email.toLowerCase().includes(search));
  if (filtered.length === 0) {
    tbody.innerHTML = emptyState('📧', 'Aucun abonné', 'Les inscrits à la newsletter apparaîtront ici.');
    return;
  }
  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td data-label="Date">${formatDate(s.date)}</td>
      <td data-label="Email"><a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a></td>
      <td class="actions-cell">
        <button class="btn-icon danger" onclick="confirmDeleteSubscriber('${escapeHtml(s.email)}')" title="Supprimer">✕</button>
      </td>
    </tr>
  `).join('');
}

function confirmDeleteSubscriber(email) {
  showConfirm('Supprimer l\'abonné', `Retirer ${email} de la liste ?`, async () => {
    try {
      await fetch(`${API_BASE}/subscribers/${encodeURIComponent(email)}`, { method: 'DELETE', headers: getHeaders() });
      subscribers = subscribers.filter(s => s.email !== email);
      renderSubscribers(); loadStats();
      showToast('Abonné supprimé', 'success');
    } catch (err) { console.error(err); }
  });
}

// ══════════════════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════════════════

function exportToCsv(filename, rows) {
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

document.getElementById('markAllReadBtn').addEventListener('click', markAllRead);
document.getElementById('exportContactsBtn').addEventListener('click', () => {
  exportToCsv('contacts.csv', contacts.map(c => [
    formatDate(c.date), c.name, c.email, c.phone,
    c.projectType, c.serviceType, c.budget, c.message,
    c.read ? 'Lu' : 'Non lu', c.resolved ? 'Résolu' : 'Non résolu'
  ]));
});
document.getElementById('exportQuotesBtn').addEventListener('click', () => {
  exportToCsv('devis.csv', quotes.map(q => [
    formatDate(q.date), q.quoteNumber, q.name, q.email,
    q.serviceType, q.location, q.status, q.details
  ]));
});
document.getElementById('exportSubsBtn').addEventListener('click', () => {
  exportToCsv('newsletter.csv', subscribers.map(s => [
    formatDate(s.date), s.email
  ]));
});

// ══════════════════════════════════════════════
// IMAGE GALLERY
// ══════════════════════════════════════════════

async function loadSlots() {
  try {
    const res = await fetch('/api/images/slots');
    slots = await res.json();
    populateSlotSelect();
    renderImages();
  } catch (err) { console.error('Slots error:', err); }
}

function populateSlotSelect() {
  const sel = document.getElementById('uploadSlot');
  sel.innerHTML = '<option value="">— Aucun —</option>';
  const section = document.getElementById('uploadSection').value;
  slots.filter(s => s.section === section).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label + (s.uploadedFile ? ' ✓' : '');
    sel.appendChild(opt);
  });
}

document.getElementById('uploadSection').addEventListener('change', populateSlotSelect);

// ─── Drag & Drop ───
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('uploadFile');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    updatePreview();
  }
});
fileInput.addEventListener('change', updatePreview);

function updatePreview() {
  const file = fileInput.files[0];
  const preview = document.getElementById('uploadPreview');
  if (!file) { preview.classList.add('hidden'); return; }
  // Update drop zone text
  dropZone.querySelector('.drop-text').textContent = file.name;
  dropZone.querySelector('.drop-icon').textContent = '🖼';
  // Preview
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.innerHTML = `<img src="${e.target.result}" alt="Aperçu">`;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

// ─── Upload ───
document.getElementById('imageUploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('uploadBtn');
  const errorEl = document.getElementById('uploadError');
  const file = fileInput.files[0];
  if (!file) { showToast('Sélectionnez un fichier', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('Fichier trop volumineux (max 10MB)', 'error'); return; }

  btn.querySelector('.btn-text').textContent = 'Upload en cours...';
  btn.querySelector('.btn-loader').classList.remove('hidden');
  btn.disabled = true;
  errorEl.classList.add('hidden');

  try {
    const fd = new FormData();
    fd.append('section', document.getElementById('uploadSection').value);
    fd.append('slotId', document.getElementById('uploadSlot').value);
    fd.append('newSlotLabel', document.getElementById('newSlotLabel').value.trim());
    fd.append('image', file);

    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload échoué');

    document.getElementById('imageUploadForm').reset();
    document.getElementById('newSlotLabel').value = '';
    document.getElementById('uploadPreview').innerHTML = '';
    document.getElementById('uploadPreview').classList.add('hidden');
    dropZone.querySelector('.drop-text').textContent = 'Cliquez ou glissez-déposez une image ici';
    dropZone.querySelector('.drop-icon').textContent = '📁';
    btn.querySelector('.btn-text').textContent = 'Uploader';
    showToast('Image uploadée avec succès', 'success');
    loadImages();
    loadSlots();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
    btn.querySelector('.btn-text').textContent = 'Uploader';
    showToast(err.message, 'error');
  } finally {
    btn.querySelector('.btn-loader').classList.add('hidden');
    btn.disabled = false;
  }
});

async function loadImages() {
  showSkeletonGrid('imageGrid', 6);
  try {
    const res = await fetch('/api/images', { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    images = await res.json();
    renderImages();
  } catch (err) { console.error('Images error:', err); }
}

function renderImages() {
  const grid = document.getElementById('imageGrid');
  const filter = document.getElementById('filterSection').value;
  const allFiles = [];
  Object.keys(images).forEach(section => {
    if (filter !== 'all' && section !== filter) return;
    (images[section] || []).forEach(f => allFiles.push({ ...f, section }));
  });
  if (allFiles.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🖼</div>
      <div class="empty-title">Aucune image</div>
      <div class="empty-desc">Uploader des images via le formulaire ci-dessus.</div>
    </div>`;
    return;
  }
  grid.innerHTML = allFiles.map(f => {
    const slotInfo = slots.find(s => s.section === f.section && s.uploadedFile === f.name);
    const sectionSlots = slots.filter(s => s.section === f.section);
    return `
      <div class="image-card">
        ${slotInfo ? `<span class="slot-badge">${escapeHtml(slotInfo.label)}</span>` : ''}
        <div class="img-wrap" onclick="openLightbox('/${f.path}')">
          <img src="/${f.path}" alt="${escapeHtml(f.name)}" loading="lazy">
        </div>
        <div class="img-info">
          <span class="img-name">${escapeHtml(f.name)}</span>
          <span class="img-meta">${humanSize(f.size)} · ${f.type}</span>
        </div>
        <div class="img-actions">
          <select class="slot-select" onchange="assignSlot('${escapeHtml(f.section)}', '${escapeHtml(f.name)}', this.value)">
            <option value="">Assigner...</option>
            ${sectionSlots.map(s => `<option value="${s.id}" ${s.uploadedFile === f.name ? 'selected' : ''}>${escapeHtml(s.label)}${s.uploadedFile === f.name ? ' ✓' : ''}</option>`).join('')}
          </select>
          <button class="btn-icon danger" onclick="confirmDeleteImage('${escapeHtml(f.section)}', '${escapeHtml(f.name)}')" title="Supprimer">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

async function assignSlot(section, filename, slotId) {
  if (!slotId) return;
  try {
    const res = await fetch(`/api/images/slots/${slotId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ filename })
    });
    if (!res.ok) throw new Error('Assignment failed');
    loadSlots(); loadImages();
    showToast('Image assignée', 'success');
  } catch (err) { console.error('Assign error:', err); }
}

function confirmDeleteImage(section, filename) {
  showConfirm('Supprimer l\'image', `Supprimer ${filename} ? Cette action est irréversible.`, async () => {
    try {
      const res = await fetch(`/api/images/${encodeURIComponent(section)}/${encodeURIComponent(filename)}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Delete failed');
      loadImages(); loadSlots();
      showToast('Image supprimée', 'success');
    } catch (err) { console.error('Delete error:', err); }
  });
}

document.getElementById('filterSection').addEventListener('change', renderImages);

// ══════════════════════════════════════════════
// CONTACT DETAIL MODAL
// ══════════════════════════════════════════════

function openContactDetail(id) {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  contactDetailId = id;
  document.getElementById('detailName').textContent = c.name;
  document.getElementById('detailDate').textContent = formatDate(c.date);
  document.getElementById('detailEmail').textContent = c.email;
  document.getElementById('detailEmail').href = `mailto:${c.email}`;
  document.getElementById('detailPhone').textContent = c.phone || 'Non fourni';
  document.getElementById('detailProject').textContent = c.projectType;
  document.getElementById('detailBudget').textContent = c.budget || 'Non spécifié';
  document.getElementById('detailService').textContent = c.serviceType || c.projectType;
  document.getElementById('detailMessage').textContent = c.message;
  const statusEl = document.getElementById('detailStatus');
  if (c.resolved) statusEl.innerHTML = '<span class="badge badge-success">Résolu</span>';
  else if (c.read) statusEl.innerHTML = '<span class="badge badge-info">Lu</span>';
  else statusEl.innerHTML = '<span class="badge badge-warning">Nouveau</span>';
  const notesEl = document.getElementById('detailNotes');
  const editor = document.getElementById('detailNotesEditor');
  if (c.notes) {
    notesEl.textContent = c.notes;
    notesEl.style.display = '';
  } else {
    notesEl.textContent = 'Aucune note';
    notesEl.style.display = '';
  }
  editor.classList.add('hidden');
  document.getElementById('detailNotesTextarea').value = c.notes || '';

  // Sync action buttons
  const readBtn = document.getElementById('detailMarkRead');
  const resolveBtn = document.getElementById('detailMarkResolved');
  readBtn.style.display = c.read ? 'none' : '';
  resolveBtn.style.display = c.resolved ? 'none' : '';

  document.getElementById('contactDetailModal').classList.add('open');
}

function closeContactDetail() {
  document.getElementById('contactDetailModal').classList.remove('open');
  contactDetailId = null;
}

document.getElementById('detailClose').addEventListener('click', closeContactDetail);
document.getElementById('contactDetailModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeContactDetail();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('contactDetailModal').classList.contains('open')) closeContactDetail();
});

// Detail modal actions
document.getElementById('detailMarkRead').addEventListener('click', async () => {
  if (!contactDetailId) return;
  await markRead(contactDetailId);
  const c = contacts.find(x => x.id === contactDetailId);
  if (c) c.read = true;
  openContactDetail(contactDetailId);
  renderContacts();
});

document.getElementById('detailMarkResolved').addEventListener('click', async () => {
  if (!contactDetailId) return;
  await markResolved(contactDetailId);
  const c = contacts.find(x => x.id === contactDetailId);
  if (c) { c.read = true; c.resolved = true; }
  openContactDetail(contactDetailId);
  renderContacts();
  loadStats();
});

document.getElementById('detailDelete').addEventListener('click', () => {
  if (!contactDetailId) return;
  const id = contactDetailId;
  closeContactDetail();
  confirmDeleteContact(id);
});

// Notes editing
document.getElementById('detailNotesEdit').addEventListener('click', () => {
  document.getElementById('detailNotes').style.display = 'none';
  document.getElementById('detailNotesEditor').classList.remove('hidden');
  document.getElementById('detailNotesTextarea').focus();
});

document.getElementById('detailNotesCancel').addEventListener('click', () => {
  document.getElementById('detailNotesEditor').classList.add('hidden');
  document.getElementById('detailNotes').style.display = '';
});

document.getElementById('detailNotesSave').addEventListener('click', async () => {
  const notes = document.getElementById('detailNotesTextarea').value.trim();
  if (!contactDetailId) return;
  try {
    const res = await fetch(`${API_BASE}/contacts/${contactDetailId}`, {
      method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ notes })
    });
    if (!res.ok) throw new Error('Failed');
    const c = contacts.find(x => x.id === contactDetailId);
    if (c) c.notes = notes;
    showToast('Notes enregistrées', 'success');
    openContactDetail(contactDetailId);
  } catch (err) { showToast('Erreur lors de l\'enregistrement', 'error'); }
});

// ══════════════════════════════════════════════
// LIGHTBOX
// ══════════════════════════════════════════════

function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  lb.classList.add('open');
}
document.getElementById('lightboxClose').addEventListener('click', () => {
  document.getElementById('lightbox').classList.remove('open');
});
document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) document.getElementById('lightbox').classList.remove('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('lightbox').classList.remove('open');
});

// ══════════════════════════════════════════════
// NEW SLOT FROM GALLERY
// ══════════════════════════════════════════════

document.getElementById('newSlotBtn').addEventListener('click', () => {
  document.getElementById('newSlotForm').classList.toggle('hidden');
});
document.getElementById('newSlotCancel').addEventListener('click', () => {
  document.getElementById('newSlotForm').classList.add('hidden');
});
document.getElementById('newSlotSubmit').addEventListener('click', async () => {
  const section = document.getElementById('newSlotSection').value;
  const label = document.getElementById('newSlotLabelInput').value.trim();
  if (!label) { showToast('Veuillez entrer un libellé', 'error'); return; }
  try {
    const res = await fetch('/api/images/slots', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ section, label })
    });
    if (!res.ok) throw new Error('Échec création');
    document.getElementById('newSlotLabelInput').value = '';
    document.getElementById('newSlotForm').classList.add('hidden');
    showToast('Slot créé', 'success');
    loadSlots();
    loadImages();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ══════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════

function renderDashboard() {
  renderDashContacts();
  renderDashQuotes();
}

function renderDashContacts() {
  const body = document.getElementById('dashContactsBody');
  const recent = contacts.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (recent.length === 0) {
    body.innerHTML = '<div class="widget-empty">Aucun message pour le moment.</div>';
    return;
  }
  body.innerHTML = recent.map(c => {
    const dotClass = c.resolved ? 'resolved' : c.read ? 'read' : 'new';
    const label = c.resolved ? 'Résolu' : c.read ? 'Lu' : 'Nouveau';
    return `<div class="widget-item" onclick="openContactDetail('${c.id}')">
      <span class="wi-dot ${dotClass}"></span>
      <div class="wi-info">
        <div class="wi-name">${escapeHtml(c.name)}</div>
        <div class="wi-sub">${escapeHtml(c.message).substring(0, 60)}${c.message.length > 60 ? '…' : ''} · ${label}</div>
      </div>
      <span class="wi-date">${formatDateShort(c.date)}</span>
    </div>`;
  }).join('');
}

function renderDashQuotes() {
  const body = document.getElementById('dashQuotesBody');
  const recent = quotes.filter(q => (q.status || 'pending') === 'pending').slice(0, 5);
  if (recent.length === 0) {
    body.innerHTML = '<div class="widget-empty">Aucun devis en attente.</div>';
    return;
  }
  body.innerHTML = recent.map(q => `
    <div class="widget-item" onclick="switchTab('quotes')">
      <span class="wi-dot pending"></span>
      <div class="wi-info">
        <div class="wi-name">${escapeHtml(q.name)}</div>
        <div class="wi-sub">${escapeHtml(q.serviceType)} · ${escapeHtml(q.location) || 'Non spécifié'}</div>
      </div>
      <span class="wi-date">${formatDateShort(q.date)}</span>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════
// CONTENT MANAGEMENT (Team, Services, Projects, Blog)
// ══════════════════════════════════════════════

let teamData = [];
let servicesData = [];
let projectsData = [];
let blogData = [];

const ENTITY_CONFIG = {
  team: {
    label: 'Membre', labelPlural: 'Membres', api: 'team',
    fields: [
      { key: 'name', label: 'Nom', type: 'text', required: true },
      { key: 'role', label: 'Rôle', type: 'text', required: true },
      { key: 'bio', label: 'Biographie', type: 'textarea' },
      { key: 'imageSlot', label: 'Image', type: 'slot-select', section: 'team' },
      { key: 'order', label: 'Ordre', type: 'number', default: 1 },
      { key: 'visible', label: 'Visible', type: 'checkbox', default: true }
    ]
  },
  services: {
    label: 'Service', labelPlural: 'Services', api: 'services',
    fields: [
      { key: 'title', label: 'Titre', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'icon', label: 'Icône (emoji)', type: 'text', default: '🔧' },
      { key: 'order', label: 'Ordre', type: 'number', default: 1 },
      { key: 'visible', label: 'Visible', type: 'checkbox', default: true }
    ]
  },
  projects: {
    label: 'Projet', labelPlural: 'Projets', api: 'projects',
    fields: [
      { key: 'title', label: 'Titre', type: 'text', required: true },
      { key: 'location', label: 'Localisation', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'category', label: 'Catégorie', type: 'select', options: [
        { value: 'construction', label: 'Construction' },
        { value: 'rehabilitation', label: 'Réhabilitation' },
        { value: 'forage', label: 'Forage' }
      ]},
      { key: 'order', label: 'Ordre', type: 'number', default: 1 },
      { key: 'visible', label: 'Visible', type: 'checkbox', default: true }
    ]
  },
  blog: {
    label: 'Article', labelPlural: 'Articles', api: 'blog',
    fields: [
      { key: 'title', label: 'Titre', type: 'text', required: true },
      { key: 'slug', label: 'Slug (URL)', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'excerpt', label: 'Extrait', type: 'textarea' },
      { key: 'content', label: 'Contenu (HTML)', type: 'textarea' },
      { key: 'imageSlot', label: 'Image', type: 'slot-select', section: 'blog' },
      { key: 'published', label: 'Publié', type: 'checkbox', default: true }
    ]
  }
};

let currentEntity = null;
let currentEditId = null;

function entityLabel(entity) {
  return entity.charAt(0).toUpperCase() + (entity.endsWith('s') ? entity.slice(1, -1) : entity.slice(1));
}

async function loadEntity(entity) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  showSkeletonGrid(`${entity}List`, 4);
  try {
    const res = await fetch(`${API_BASE}/${cfg.api}`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    if (entity === 'team') teamData = data;
    else if (entity === 'services') servicesData = data;
    else if (entity === 'projects') projectsData = data;
    else if (entity === 'blog') blogData = data;
    renderEntity(entity);
  } catch (err) { console.error(`${entity} load error:`, err); }
}

function renderEntity(entity) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  let items;
  if (entity === 'team') items = teamData;
  else if (entity === 'services') items = servicesData;
  else if (entity === 'projects') items = projectsData;
  else if (entity === 'blog') items = blogData;
  const container = document.getElementById(`${entity}List`);
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-title">Aucun ${cfg.label.toLowerCase()}</div><div class="empty-desc">Cliquez sur "Ajouter" pour créer le premier ${cfg.label.toLowerCase()}.</div></div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const deleteFn = `confirmDeleteItem('${entity}', '${item.id}')`;
    const title = item.name || item.title || item.label || 'Sans titre';
    const subtitle = item.role || item.location || '';
    const preview = item.description || item.excerpt || item.bio || '';
    return `<div class="admin-card">
      <div class="admin-card-body">
        <div class="admin-card-title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="admin-card-sub">${escapeHtml(subtitle)}</div>` : ''}
        <div class="admin-card-desc">${escapeHtml(preview).substring(0, 120)}${preview.length > 120 ? '…' : ''}</div>
      </div>
      <div class="admin-card-actions">
        <span class="badge ${item.visible !== false ? 'badge-success' : 'badge-warning'}">${item.visible !== false ? 'Visible' : 'Masqué'}</span>
        <button class="btn-icon info" onclick="open${entityLabel(entity)}Form('${item.id}')" title="Modifier">✏</button>
        <button class="btn-icon danger" onclick="${deleteFn}" title="Supprimer">✕</button>
      </div>
    </div>`;
  }).join('');
}

// ─── CRUD Form ───

function openCrudForm(entity, editId) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  currentEntity = entity;
  currentEditId = editId || null;

  let item = {};
  if (editId) {
    let items;
    if (entity === 'team') items = teamData;
    else if (entity === 'services') items = servicesData;
    else if (entity === 'projects') items = projectsData;
    else if (entity === 'blog') items = blogData;
    item = items.find(i => i.id === editId) || {};
  }

  document.getElementById('crudModalTitle').textContent = editId ? `Modifier ${cfg.label}` : `Ajouter ${cfg.label}`;

  let html = '';
  for (const field of cfg.fields) {
    const val = item[field.key] !== undefined ? item[field.key] : (field.default !== undefined ? field.default : '');
    html += `<div class="form-group" data-field="${field.type}">`;
    html += `<label for="crud_${field.key}">${field.label}${field.required ? ' <span style="color:var(--danger)">*</span>' : ''}</label>`;

    if (field.type === 'textarea') {
      html += `<textarea id="crud_${field.key}" class="detail-textarea" rows="4">${escapeHtml(String(val))}</textarea>`;
    } else if (field.type === 'checkbox') {
      html += `<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;margin-top:0.25rem">
        <input type="checkbox" id="crud_${field.key}" ${val ? 'checked' : ''} style="width:auto;padding:0">
        <span style="font-size:0.8125rem;color:var(--gray-600)">Afficher sur le site</span>
      </label>`;
    } else if (field.type === 'select') {
      html += `<select id="crud_${field.key}" class="status-select" style="width:100%">`;
      for (const opt of (field.options || [])) {
        html += `<option value="${opt.value}" ${val === opt.value ? 'selected' : ''}>${opt.label}</option>`;
      }
      html += `</select>`;
    } else if (field.type === 'slot-select') {
      html += `<div style="display:flex;gap:0.75rem;align-items:start;flex-wrap:wrap">`;
      html += `<div style="flex:1;min-width:160px">`;
      html += `<select id="crud_${field.key}" class="status-select" style="width:100%" onchange="previewSlotImage(this)" data-section="${field.section}">`;
      html += `<option value="">— Aucune —</option>`;
      const sectionSlots = slots.filter(s => s.section === field.section);
      for (const s of sectionSlots) {
        const hasImg = s.uploadedFile ? ' 📷' : '';
        html += `<option value="${s.id}" data-url="${escapeHtml(s.currentUrl || '')}" ${val === s.id ? 'selected' : ''}>${escapeHtml(s.label)}${hasImg}</option>`;
      }
      html += `</select>`;
      html += `</div>`;
      html += `<div id="crud_${field.key}_preview" class="slot-preview">`;
      const currentSlot = sectionSlots.find(s => s.id === val);
      if (currentSlot && currentSlot.currentUrl) {
        html += `<img src="${currentSlot.currentUrl}" alt="aperçu" style="width:100%;height:100%;object-fit:cover">`;
      } else {
        html += `<span style="opacity:0.3">🖼</span>`;
      }
      html += `</div>`;
      html += `</div>`;
      html += `<div style="margin-top:0.5rem;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">`;
      html += `<input type="file" id="crud_${field.key}_file" accept="image/*" style="font-size:0.75rem;flex:1;min-width:120px">`;
      html += `<button type="button" class="btn-secondary" style="padding:0.3rem 0.8rem;font-size:0.75rem" onclick="uploadSlotImage('${field.key}', '${field.section}')">Upload</button>`;
      html += `<span id="crud_${field.key}_status" style="font-size:0.75rem;color:var(--gray-500)"></span>`;
      html += `</div>`;
    } else if (field.type === 'date') {
      const dateVal = val ? val.substring(0, 10) : '';
      html += `<input type="date" id="crud_${field.key}" class="search-input" value="${dateVal}">`;
    } else {
      html += `<input type="${field.type}" id="crud_${field.key}" class="search-input" value="${escapeHtml(String(val))}">`;
    }

    html += `</div>`;
  }

  document.getElementById('crudFormBody').innerHTML = html;
  // Preview initial selected slot
  const sel = document.querySelector(`#crudFormBody select[onchange="previewSlotImage(this)"]`);
  if (sel) previewSlotImage(sel);
  document.getElementById('crudModal').classList.add('open');
}

function previewSlotImage(sel) {
  if (!sel) return;
  const preview = document.getElementById(`${sel.id}_preview`);
  if (!preview) return;
  const opt = sel.options[sel.selectedIndex];
  const url = opt ? opt.dataset.url : '';
  preview.innerHTML = url
    ? `<img src="${url}" alt="aperçu" style="width:100%;height:100%;object-fit:cover">`
    : `<span style="opacity:0.3;font-size:1.5rem">🖼</span>`;
}

async function uploadSlotImage(fieldKey, section) {
  const fileInput = document.getElementById(`crud_${fieldKey}_file`);
  const file = fileInput.files[0];
  const status = document.getElementById(`crud_${fieldKey}_status`);
  if (!file) { status.textContent = 'Sélectionnez un fichier'; return; }
  if (file.size > 10 * 1024 * 1024) { status.textContent = 'Max 10MB'; return; }

  const select = document.getElementById(`crud_${fieldKey}`);
  const slotId = select.value;
  if (!slotId) { status.textContent = 'Choisissez un slot d\'abord'; return; }

  status.textContent = 'Upload…';
  const fd = new FormData();
  fd.append('section', section);
  fd.append('slotId', slotId);
  fd.append('image', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd
    });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload échoué');
    status.textContent = '✓ Uploadé';
    status.style.color = 'var(--success)';
    // Refresh slots and update preview
    const sr = await fetch('/api/images/slots');
    slots = await sr.json();
    const updatedSlot = slots.find(s => s.id === slotId);
    if (updatedSlot) {
      const opt = select.querySelector(`option[value="${slotId}"]`);
      if (opt) { opt.dataset.url = updatedSlot.currentUrl || ''; opt.textContent = updatedSlot.label + ' 📷'; }
      previewSlotImage(select);
    }
    fileInput.value = '';
  } catch (err) {
    status.textContent = '✗ ' + err.message;
    status.style.color = 'var(--danger)';
  }
}

function closeCrudForm() {
  document.getElementById('crudModal').classList.remove('open');
  currentEntity = null;
  currentEditId = null;
}

async function saveCrudItem() {
  const cfg = ENTITY_CONFIG[currentEntity];
  if (!cfg) return;

  const body = {};
  for (const field of cfg.fields) {
    const el = document.getElementById(`crud_${field.key}`);
    if (!el) continue;
    if (field.type === 'checkbox') {
      body[field.key] = el.checked;
    } else if (field.type === 'number') {
      body[field.key] = parseFloat(el.value) || 0;
    } else {
      body[field.key] = el.value;
    }
    if (field.required && !body[field.key]) {
      showToast(`Le champ "${field.label}" est requis`, 'error');
      return;
    }
  }

  try {
    let url = `${API_BASE}/${cfg.api}`;
    let method = 'POST';
    if (currentEditId) {
      url += `/${currentEditId}`;
      method = 'PATCH';
    }
    const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Erreur');
    closeCrudForm();
    showToast(`${cfg.label} ${currentEditId ? 'modifié' : 'ajouté'} avec succès`, 'success');
    loadEntity(currentEntity);
  } catch (err) {
    showToast('Erreur lors de l\'enregistrement', 'error');
  }
}

function confirmDeleteItem(entity, id) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  showConfirm(`Supprimer ${cfg.label.toLowerCase()}`, `Cette action est irréversible.`, async () => {
    try {
      const res = await fetch(`${API_BASE}/${cfg.api}/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Erreur');
      showToast(`${cfg.label} supprimé`, 'success');
      loadEntity(entity);
    } catch (err) {
      showToast('Erreur lors de la suppression', 'error');
    }
  });
}

// Convenience openers
function openTeamForm(id) { openCrudForm('team', id); }
function openServiceForm(id) { openCrudForm('services', id); }
function openProjectForm(id) { openCrudForm('projects', id); }
function openBlogForm(id) { openCrudForm('blog', id); }

// ─── PRICING EDITOR ───

let pricingData = null;

async function loadPricing() {
  try {
    const res = await fetch(`${API_BASE}/pricing`, { headers: getHeaders() });
    if (res.status === 401) return;
    pricingData = await res.json();
    renderPricingEditor();
  } catch (err) { console.error('Pricing error:', err); }
}

function renderPricingEditor() {
  const container = document.getElementById('pricingEditor');
  if (!pricingData) { container.innerHTML = '<p class="empty-row">Chargement...</p>'; return; }

  let html = '<div class="pricing-editor">';

  ['construction', 'rehabilitation', 'forage'].forEach(cat => {
    const tiers = pricingData[cat] || {};
    const catLabels = { construction: 'Construction Neuve', rehabilitation: 'Réhabilitation', forage: 'Forage d\'Eau' };
    html += `<div class="pricing-cat"><h4>${catLabels[cat]}</h4>`;
    Object.keys(tiers).forEach(tier => {
      const t = tiers[tier];
      html += `<div class="pricing-tier" data-cat="${cat}" data-tier="${tier}">
        <div class="pricing-tier-header">
          <input class="search-input pricing-name" value="${escapeHtml(t.name || '')}" data-cat="${cat}" data-tier="${tier}" data-field="name" placeholder="Nom">
          <input class="search-input pricing-price" type="number" value="${t.pricePerM2 || t.pricePerML || t.price || ''}" data-cat="${cat}" data-tier="${tier}" data-field="price" placeholder="Prix">
          <input class="search-input pricing-unit" value="${t.unit || 'm²'}" data-cat="${cat}" data-tier="${tier}" data-field="unit" placeholder="Unité">
        </div>
        <div class="pricing-tier-features">
          ${(t.features || []).map((f, fi) => `<input class="search-input pricing-feature" value="${escapeHtml(f)}" data-cat="${cat}" data-tier="${tier}" data-field="feature_${fi}" placeholder="Option ${fi + 1}">`).join('')}
          <button class="btn-ghost" style="font-size:0.7rem;padding:0.25rem" onclick="addPricingFeature('${cat}','${tier}')">+ Ajouter option</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });

  // Rates
  html += `<div class="pricing-cat"><h4>Taux</h4>
    <div class="pricing-tier" style="display:flex;gap:1rem;flex-wrap:wrap">
      <label style="font-size:0.8125rem">Marge sécurité (%): <input class="search-input pricing-rate" type="number" id="pricingContingency" value="${(pricingData.contingency_rate || 0.1) * 100}"></label>
      <label style="font-size:0.8125rem">TVA (%): <input class="search-input pricing-rate" type="number" id="pricingTax" value="${(pricingData.tax_rate || 0.2) * 100}"></label>
    </div>
  </div>`;

  html += '</div>';
  container.innerHTML = html;
}

function addPricingFeature(cat, tier) {
  const parent = document.querySelector(`[data-cat="${cat}"][data-tier="${tier}"]`)?.closest('.pricing-tier')?.querySelector('.pricing-tier-features');
  if (!parent) { showToast('Sélectionnez d\'abord un tier', 'error'); return; }
  const inputs = parent.querySelectorAll('[data-field^="feature_"]');
  const idx = inputs.length;
  const input = document.createElement('input');
  input.className = 'search-input pricing-feature';
  input.placeholder = `Option ${idx + 1}`;
  input.dataset.cat = cat;
  input.dataset.tier = tier;
  input.dataset.field = `feature_${idx}`;
  parent.insertBefore(input, parent.lastElementChild);
}

async function savePricing() {
  const btn = document.getElementById('savePricingBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Enregistrement...';
  try {
    const pricing = {};
    ['construction', 'rehabilitation', 'forage'].forEach(cat => {
      pricing[cat] = {};
      document.querySelectorAll(`[data-cat="${cat}"]`).forEach(el => {
        const tier = el.dataset.tier;
        const field = el.dataset.field;
        if (!tier) return;
        if (!pricing[cat][tier]) pricing[cat][tier] = { features: [] };
        if (field === 'name') pricing[cat][tier].name = el.value;
        else if (field === 'price') {
          const val = parseFloat(el.value);
          if (cat === 'forage') {
            if (tier === 'standard') pricing[cat][tier].pricePerML = val;
            else pricing[cat][tier].price = val;
          } else {
            pricing[cat][tier].pricePerM2 = val;
          }
        }
        else if (field === 'unit') pricing[cat][tier].unit = el.value;
        else if (field.startsWith('feature_')) {
          const idx = parseInt(field.replace('feature_', ''));
          pricing[cat][tier].features[idx] = el.value;
        }
      });
      // Clean up empty features
      Object.keys(pricing[cat]).forEach(tier => {
        pricing[cat][tier].features = pricing[cat][tier].features.filter(f => f && f.trim());
      });
    });

    const contingency = parseFloat(document.getElementById('pricingContingency')?.value) || 10;
    const tax = parseFloat(document.getElementById('pricingTax')?.value) || 20;

    const payload = {
      ...pricing,
      contingency_rate: contingency / 100,
      tax_rate: tax / 100
    };

    const res = await fetch(`${API_BASE}/pricing`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Erreur');
    showToast('Tarifs enregistrés', 'success');
  } catch (err) {
    showToast('Erreur lors de l\'enregistrement', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Enregistrer';
  }
}

// ─── SETTINGS EDITOR ───

let settingsData = null;
let contactInfoData = null;

async function loadSettings() {
  try {
    const [settingsRes, contactRes] = await Promise.all([
      fetch(`${API_BASE}/settings`, { headers: getHeaders() }),
      fetch(`${API_BASE}/contact-info`, { headers: getHeaders() })
    ]);
    if (settingsRes.status === 401) return;
    settingsData = await settingsRes.json();
    contactInfoData = await contactRes.json();
    renderSettingsEditor();
  } catch (err) { console.error('Settings error:', err); }
}

function renderSettingsEditor() {
  const container = document.getElementById('settingsEditor');
  if (!settingsData || !contactInfoData) { container.innerHTML = '<p class="empty-row">Chargement...</p>'; return; }

  container.innerHTML = `
    <div class="settings-grid">
      <div class="settings-section">
        <h4>Coordonnées</h4>
        <div class="form-group">
          <label>Téléphone</label>
          <input class="search-input" id="setPhone" value="${escapeHtml(contactInfoData.contact?.phone || '')}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="search-input" id="setEmail" value="${escapeHtml(contactInfoData.contact?.email || '')}">
        </div>
        <div class="form-group">
          <label>Adresse</label>
          <input class="search-input" id="setAddress" value="${escapeHtml(contactInfoData.contact?.address || '')}">
        </div>
      </div>
      <div class="settings-section">
        <h4>Réseaux sociaux</h4>
        <div class="form-group">
          <label>Facebook</label>
          <input class="search-input" id="setFacebook" value="${escapeHtml(contactInfoData.social?.facebook || '')}">
        </div>
        <div class="form-group">
          <label>Instagram</label>
          <input class="search-input" id="setInstagram" value="${escapeHtml(contactInfoData.social?.instagram || '')}">
        </div>
      </div>
      <div class="settings-section">
        <h4>Site</h4>
        <div class="form-group">
          <label>Google Analytics ID</label>
          <input class="search-input" id="setGA" value="${escapeHtml(settingsData.googleAnalyticsId || '')}">
        </div>
        <div class="form-group">
          <label>WhatsApp (numéro)</label>
          <input class="search-input" id="setWhatsApp" value="${escapeHtml(settingsData.whatsappNumber || '')}">
        </div>
        <div class="form-group">
          <label>URL du site</label>
          <input class="search-input" id="setSiteUrl" value="${escapeHtml(settingsData.siteUrl || '')}">
        </div>
      </div>
      <div class="settings-section" style="grid-column:1/-1">
        <h4>Vision & Mission</h4>
        <div class="form-group">
          <label>Mission</label>
          <textarea class="detail-textarea" id="setMission" rows="3">${escapeHtml(contactInfoData.mission || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Vision</label>
          <textarea class="detail-textarea" id="setVision" rows="3">${escapeHtml(contactInfoData.vision || '')}</textarea>
        </div>
      </div>
      <div class="settings-section" style="grid-column:1/-1">
        <h4>Statistiques (Hero)</h4>
        <div class="settings-inline">
          <div class="form-group">
            <label>Années d'expérience</label>
            <input class="search-input" type="number" id="setExpYears" value="${contactInfoData.experience_years || 10}">
          </div>
          <div class="form-group">
            <label>Année de fondation</label>
            <input class="search-input" type="number" id="setFounded" value="${contactInfoData.founded || 2015}">
          </div>
          <div class="form-group">
            <label>Nombre de techniciens</label>
            <input class="search-input" type="number" id="setStaff" value="${contactInfoData.team?.total_staff || 34}">
          </div>
          <div class="form-group">
            <label>Ingénieurs civils</label>
            <input class="search-input" type="number" id="setEngineers" value="${contactInfoData.team?.civil_engineers || 4}">
          </div>
        </div>
      </div>
    </div>
  `;
}

async function saveSettings() {
  const btn = document.getElementById('saveSettingsBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Enregistrement...';
  try {
    const contactPayload = {
      contact: {
        phone: document.getElementById('setPhone')?.value || '',
        email: document.getElementById('setEmail')?.value || '',
        address: document.getElementById('setAddress')?.value || ''
      },
      social: {
        facebook: document.getElementById('setFacebook')?.value || '',
        instagram: document.getElementById('setInstagram')?.value || ''
      },
      mission: document.getElementById('setMission')?.value || '',
      vision: document.getElementById('setVision')?.value || '',
      experience_years: parseInt(document.getElementById('setExpYears')?.value) || 10,
      founded: parseInt(document.getElementById('setFounded')?.value) || 2015,
      team: {
        total_staff: parseInt(document.getElementById('setStaff')?.value) || 34,
        civil_engineers: parseInt(document.getElementById('setEngineers')?.value) || 4
      }
    };

    const settingsPayload = {
      googleAnalyticsId: document.getElementById('setGA')?.value || '',
      whatsappNumber: document.getElementById('setWhatsApp')?.value || '',
      siteUrl: document.getElementById('setSiteUrl')?.value || ''
    };

    await Promise.all([
      fetch(`${API_BASE}/contact-info`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(contactPayload) }),
      fetch(`${API_BASE}/settings`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(settingsPayload) })
    ]);

    showToast('Paramètres enregistrés', 'success');
  } catch (err) {
    showToast('Erreur lors de l\'enregistrement', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Enregistrer';
  }
}

// ══════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  // Skip if typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

  const tabs = ['dashboard', 'contacts', 'quotes', 'subscribers', 'images', 'team', 'services', 'projects', 'blog', 'pricing'];
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9 && tabs[num - 1]) { switchTab(tabs[num - 1]); return; }
  if (num === 0) { switchTab('pricing'); return; }
  if (e.key === '?') {
    document.getElementById('shortcutsModal').classList.toggle('open');
  }
});

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════

if (checkAuth()) {
  initDarkMode();
  loadStats();
  loadContacts();
  loadQuotes();
  loadSubscribers();
  loadSlots();
  loadImages();
  loadEntity('team');
  loadEntity('services');
  loadEntity('projects');
  loadEntity('blog');
  loadPricing();
  loadSettings();
  setInterval(loadStats, 30000);
  // Debounced chart rendering after data loads
  let chartTimer;
  const originalRenderDashboard = renderDashboard;
  renderDashboard = function() {
    originalRenderDashboard();
    clearTimeout(chartTimer);
    chartTimer = setTimeout(renderCharts, 300);
  };
}
