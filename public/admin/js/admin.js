const API_BASE = '/api/admin';
let token = '';
let contacts = [];
let quotes = [];
let subscribers = [];

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
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

function getStatusBadge(status) {
  const map = {
    pending: 'badge-warning',
    'in-progress': 'badge-info',
    completed: 'badge-success',
    cancelled: 'badge-danger'
  };
  const labels = {
    pending: 'En attente',
    'in-progress': 'En cours',
    completed: 'Terminé',
    cancelled: 'Annulé'
  };
  const cls = map[status] || 'badge-warning';
  return `<span class="badge ${cls}">${labels[status] || status}</span>`;
}

// ─── AUTH ───
function checkAuth() {
  token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = '/admin/login.html';
    return false;
  }
  document.getElementById('adminUser').textContent = 'Administrateur';
  return true;
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  fetch(`${API_BASE}/logout`, { method: 'POST', headers: getHeaders() })
    .catch(() => {})
    .finally(() => {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login.html';
    });
});

// ─── TABS ───
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ─── SEARCH ───
document.getElementById('contactSearch').addEventListener('input', renderContacts);
document.getElementById('quoteSearch').addEventListener('input', renderQuotes);
document.getElementById('subSearch').addEventListener('input', renderSubscribers);

// ─── STATS ───
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
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ─── CONTACTS ───
async function loadContacts() {
  try {
    const res = await fetch(`${API_BASE}/contacts`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    contacts = await res.json();
    renderContacts();
  } catch (err) {
    console.error('Contacts error:', err);
  }
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
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Aucun message</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(c => `
    <tr class="${!c.read ? 'unread' : ''}">
      <td>${formatDate(c.date)}</td>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td><a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></td>
      <td>${c.phone ? escapeHtml(c.phone) : '—'}</td>
      <td>${escapeHtml(c.projectType)}${c.serviceType && c.serviceType !== c.projectType ? `<br><small>${escapeHtml(c.serviceType)}</small>` : ''}${c.budget ? `<br><small>Budget: ${escapeHtml(c.budget)}</small>` : ''}</td>
      <td class="msg-cell" title="${escapeHtml(c.message)}">${escapeHtml(c.message).substring(0, 80)}${c.message.length > 80 ? '...' : ''}</td>
      <td>
        ${c.resolved ? '<span class="badge badge-success">Résolu</span>' : c.read ? '<span class="badge badge-info">Lu</span>' : '<span class="badge badge-warning">Nouveau</span>'}
      </td>
      <td class="actions-cell">
        ${!c.read ? `<button class="btn-sm btn-success" onclick="markRead('${c.id}')" title="Marquer lu">✓</button>` : ''}
        ${!c.resolved ? `<button class="btn-sm btn-info" onclick="markResolved('${c.id}')" title="Résoudre">✓</button>` : ''}
        <button class="btn-sm btn-danger" onclick="deleteContact('${c.id}')" title="Supprimer">✕</button>
      </td>
    </tr>
  `).join('');
}

async function markRead(id) {
  try {
    await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ read: true })
    });
    const c = contacts.find(x => x.id === id);
    if (c) c.read = true;
    renderContacts();
    loadStats();
  } catch (err) {
    console.error(err);
  }
}

async function markResolved(id) {
  try {
    await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ read: true, resolved: true })
    });
    const c = contacts.find(x => x.id === id);
    if (c) { c.read = true; c.resolved = true; }
    renderContacts();
    loadStats();
  } catch (err) {
    console.error(err);
  }
}

async function deleteContact(id) {
  if (!confirm('Supprimer ce message ?')) return;
  try {
    await fetch(`${API_BASE}/contacts/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    contacts = contacts.filter(c => c.id !== id);
    renderContacts();
    loadStats();
  } catch (err) {
    console.error(err);
  }
}

// ─── QUOTES ───
async function loadQuotes() {
  try {
    const res = await fetch(`${API_BASE}/quotes`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    quotes = await res.json();
    renderQuotes();
  } catch (err) {
    console.error('Quotes error:', err);
  }
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
      <td>${formatDate(q.date)}</td>
      <td><code>${escapeHtml(q.quoteNumber)}</code></td>
      <td><strong>${escapeHtml(q.name)}</strong></td>
      <td><a href="mailto:${escapeHtml(q.email)}">${escapeHtml(q.email)}</a></td>
      <td>${escapeHtml(q.serviceType)}</td>
      <td>${escapeHtml(q.location) || '—'}</td>
      <td>
        <select class="status-select" onchange="updateQuoteStatus('${q.id}', this.value)" data-current="${q.status || 'pending'}">
          <option value="pending" ${(q.status || 'pending') === 'pending' ? 'selected' : ''}>En attente</option>
          <option value="in-progress" ${q.status === 'in-progress' ? 'selected' : ''}>En cours</option>
          <option value="completed" ${q.status === 'completed' ? 'selected' : ''}>Terminé</option>
          <option value="cancelled" ${q.status === 'cancelled' ? 'selected' : ''}>Annulé</option>
        </select>
      </td>
      <td class="actions-cell">
        <button class="btn-sm btn-danger" onclick="deleteQuote('${q.id}')" title="Supprimer">✕</button>
      </td>
    </tr>
  `).join('');
}

async function updateQuoteStatus(id, status) {
  try {
    await fetch(`${API_BASE}/quotes/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    });
    const q = quotes.find(x => x.id === id);
    if (q) q.status = status;
    loadStats();
  } catch (err) {
    console.error(err);
  }
}

async function deleteQuote(id) {
  if (!confirm('Supprimer ce devis ?')) return;
  try {
    await fetch(`${API_BASE}/quotes/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    quotes = quotes.filter(q => q.id !== id);
    renderQuotes();
    loadStats();
  } catch (err) {
    console.error(err);
  }
}

// ─── SUBSCRIBERS ───
async function loadSubscribers() {
  try {
    const res = await fetch(`${API_BASE}/subscribers`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    subscribers = await res.json();
    renderSubscribers();
  } catch (err) {
    console.error('Subscribers error:', err);
  }
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
      <td>${formatDate(s.date)}</td>
      <td><a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a></td>
      <td class="actions-cell">
        <button class="btn-sm btn-danger" onclick="deleteSubscriber('${escapeHtml(s.email)}')" title="Supprimer">✕</button>
      </td>
    </tr>
  `).join('');
}

async function deleteSubscriber(email) {
  if (!confirm(`Supprimer ${email} ?`)) return;
  try {
    await fetch(`${API_BASE}/subscribers/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    subscribers = subscribers.filter(s => s.email !== email);
    renderSubscribers();
    loadStats();
  } catch (err) {
    console.error(err);
  }
}

// ─── EXPORT CSV ───
function exportToCsv(filename, rows) {
  if (rows.length === 0) return alert('Aucune donnée à exporter');
  const bom = '\uFEFF';
  const csv = bom + rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
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

// ─── IMAGE / GALLERY ───
let slots = [];
let images = {};
let selectedSection = 'all';

async function loadSlots() {
  try {
    const res = await fetch('/api/images/slots');
    slots = await res.json();
    populateSlotSelect();
  } catch (err) {
    console.error('Slots error:', err);
  }
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

document.getElementById('uploadSection').addEventListener('change', () => {
  populateSlotSelect();
  updatePreview();
});

document.getElementById('uploadFile').addEventListener('change', updatePreview);

function updatePreview() {
  const file = document.getElementById('uploadFile').files[0];
  const preview = document.getElementById('uploadPreview');
  if (!file) { preview.classList.add('hidden'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.innerHTML = `<img src="${e.target.result}" alt="Aperçu">`;
    preview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

document.getElementById('imageUploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('uploadBtn');
  const errorEl = document.getElementById('uploadError');
  btn.querySelector('.btn-text').textContent = 'Upload en cours...';
  btn.querySelector('.btn-loader').classList.remove('hidden');
  btn.disabled = true;
  errorEl.classList.add('hidden');

  try {
    const fd = new FormData();
    fd.append('image', document.getElementById('uploadFile').files[0]);
    fd.append('section', document.getElementById('uploadSection').value);
    fd.append('slotId', document.getElementById('uploadSlot').value);

    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload échoué');

    document.getElementById('imageUploadForm').reset();
    document.getElementById('uploadPreview').classList.add('hidden');
    document.getElementById('uploadPreview').innerHTML = '';
    btn.querySelector('.btn-text').textContent = 'Uploader';
    loadImages();
    loadSlots();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
    btn.querySelector('.btn-text').textContent = 'Uploader';
  } finally {
    btn.querySelector('.btn-loader').classList.add('hidden');
    btn.disabled = false;
  }
});

async function loadImages() {
  try {
    const res = await fetch('/api/images');
    images = await res.json();
    renderImages();
  } catch (err) {
    console.error('Images error:', err);
  }
}

function renderImages() {
  const grid = document.getElementById('imageGrid');
  const filter = document.getElementById('filterSection').value;
  const allFiles = [];

  Object.keys(images).forEach(section => {
    if (filter !== 'all' && section !== filter) return;
    (images[section] || []).forEach(f => {
      allFiles.push({ ...f, section });
    });
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
        ${slotInfo ? `<span class="slot-badge" title="${escapeHtml(slotInfo.label)}">✓ ${escapeHtml(slotInfo.label)}</span>` : ''}
        <div class="img-wrap">
          <img src="/${f.path}" alt="${escapeHtml(f.name)}" loading="lazy">
        </div>
        <div class="img-info">
          <span class="img-name">${escapeHtml(f.name)}</span>
          <span class="img-meta">${(f.size / 1024).toFixed(1)} KB · ${f.type}</span>
        </div>
        <div class="img-actions">
          <select class="slot-select" onchange="assignSlot('${escapeHtml(f.section)}', '${escapeHtml(f.name)}', this.value)">
            <option value="">Assigner...</option>
            ${sectionSlots.map(s => `<option value="${s.id}" ${s.uploadedFile === f.name ? 'selected' : ''}>${escapeHtml(s.label)}${s.uploadedFile === f.name ? ' ✓' : ''}</option>`).join('')}
          </select>
          <button class="btn-sm btn-danger" onclick="deleteImage('${escapeHtml(f.section)}', '${escapeHtml(f.name)}')" title="Supprimer">✕</button>
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    if (!res.ok) throw new Error('Assignment failed');
    loadSlots();
    loadImages();
  } catch (err) {
    console.error('Assign error:', err);
  }
}

async function deleteImage(section, filename) {
  if (!confirm(`Supprimer ${filename} ?`)) return;
  try {
    const res = await fetch(`/api/images/${encodeURIComponent(section)}/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Delete failed');
    loadImages();
    loadSlots();
  } catch (err) {
    console.error('Delete error:', err);
  }
}

document.getElementById('filterSection').addEventListener('change', renderImages);

// ─── INIT ───
if (checkAuth()) {
  loadStats();
  loadContacts();
  loadQuotes();
  loadSubscribers();
  loadSlots();
  loadImages();
  setInterval(loadStats, 30000);
}
