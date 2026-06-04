const API_BASE = '/api/admin';
let token = '';
let contacts = [];
let quotes = [];
let subscribers = [];
let slots = [];
let images = {};

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

document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    document.getElementById(`tab-${tabId}`).classList.add('active');
    const titles = { contacts: 'Messages', quotes: 'Devis', subscribers: 'Newsletter', images: 'Galerie' };
    document.getElementById('pageTitle').innerHTML = `${titles[tabId] || tabId} <small>Gestion</small>`;
    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  });
});

// ══════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════

document.getElementById('contactSearch').addEventListener('input', renderContacts);
document.getElementById('quoteSearch').addEventListener('input', renderQuotes);
document.getElementById('subSearch').addEventListener('input', renderSubscribers);

// ══════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    document.getElementById('statContacts').textContent = data.totalContacts;
    document.getElementById('statUnread').textContent = data.unreadContacts;
    document.getElementById('statQuotes').textContent = data.totalQuotes;
    document.getElementById('statPending').textContent = data.pendingQuotes;
    document.getElementById('statSubscribers').textContent = data.totalSubscribers;
    const badge = document.getElementById('navBadgeUnread');
    if (data.unreadContacts > 0) { badge.textContent = data.unreadContacts; badge.style.display = ''; }
    else { badge.style.display = 'none'; }
    document.getElementById('lastUpdate').textContent = `Mis à jour ${formatDateShort(data.lastUpdate)}`;
  } catch (err) { console.error('Stats error:', err); }
}

// ══════════════════════════════════════════════
// CONTACTS CRUD
// ══════════════════════════════════════════════

async function loadContacts() {
  try {
    const res = await fetch(`${API_BASE}/contacts`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    contacts = await res.json();
    renderContacts();
  } catch (err) { console.error('Contacts error:', err); }
}

function renderContacts() {
  const search = document.getElementById('contactSearch').value.toLowerCase();
  const tbody = document.getElementById('contactsBody');
  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search) ||
    c.email.toLowerCase().includes(search) ||
    c.phone.toLowerCase().includes(search)
  );
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Aucun message</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(c => `
    <tr class="${!c.read ? 'unread' : ''}">
      <td data-label="Date">${formatDate(c.date)}</td>
      <td data-label="Nom"><strong>${escapeHtml(c.name)}</strong></td>
      <td data-label="Email"><a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></td>
      <td data-label="Projet">${escapeHtml(c.projectType)}${c.budget ? `<br><small style="color:var(--gray-400)">Budget: ${escapeHtml(c.budget)}</small>` : ''}</td>
      <td data-label="Message" class="msg-cell" title="${escapeHtml(c.message)}">${escapeHtml(c.message).substring(0, 80)}${c.message.length > 80 ? '...' : ''}</td>
      <td data-label="Statut">
        ${c.resolved ? '<span class="badge badge-success">Résolu</span>' : c.read ? '<span class="badge badge-info">Lu</span>' : '<span class="badge badge-warning">Nouveau</span>'}
      </td>
      <td class="actions-cell">
        ${!c.read ? `<button class="btn-icon success" onclick="markRead('${c.id}')" title="Marquer lu">✓</button>` : ''}
        ${!c.resolved ? `<button class="btn-icon info" onclick="markResolved('${c.id}')" title="Résoudre">✓</button>` : ''}
        <button class="btn-icon danger" onclick="confirmDeleteContact('${c.id}')" title="Supprimer">✕</button>
      </td>
    </tr>
  `).join('');
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
  try {
    const res = await fetch(`${API_BASE}/quotes`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    quotes = await res.json();
    renderQuotes();
  } catch (err) { console.error('Quotes error:', err); }
}

function renderQuotes() {
  const search = document.getElementById('quoteSearch').value.toLowerCase();
  const tbody = document.getElementById('quotesBody');
  const filtered = quotes.filter(q =>
    q.name.toLowerCase().includes(search) ||
    q.email.toLowerCase().includes(search) ||
    q.quoteNumber.toLowerCase().includes(search)
  );
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun devis</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(q => `
    <tr>
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

// ══════════════════════════════════════════════
// SUBSCRIBERS CRUD
// ══════════════════════════════════════════════

async function loadSubscribers() {
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
    tbody.innerHTML = '<tr><td colspan="3" class="empty-row">Aucun abonné</td></tr>';
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
  try {
    const res = await fetch('/api/images', { headers: getHeaders() });
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
    grid.innerHTML = '<p class="empty-row">Aucune image uploadée</p>';
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
// INIT
// ══════════════════════════════════════════════

if (checkAuth()) {
  loadStats();
  loadContacts();
  loadQuotes();
  loadSubscribers();
  loadSlots();
  loadImages();
  setInterval(loadStats, 30000);
}
