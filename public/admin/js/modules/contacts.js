import { API_BASE, getHeaders, contacts, selectedContactIds, contactPage, contactFilter, PER_PAGE, clearToken, contactDetailId } from './api.js';
import { escapeHtml, formatDate } from './helpers.js';
import { showToast, showConfirm, showSkeletonTable, renderPagination, emptyState, showSkeletonStats } from './ui.js';
import { loadStats } from './dashboard.js';

export function setContactFilter(filter) {
  contactFilter = filter;
  document.querySelectorAll('#contactFilterBar .filter-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`#contactFilterBar .filter-btn[data-filter="${filter}"]`);
  if (btn) btn.classList.add('active');
  contactPage = 1;
  renderContacts();
}

export async function loadContacts() {
  showSkeletonTable('contactsBody', 7);
  try {
    const res = await fetch(`${API_BASE}/contacts`, { headers: getHeaders() });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    contacts.length = 0;
    const data = await res.json();
    contacts.push(...data);
    contactPage = 1;
    renderContacts();
    loadStats();
  } catch (err) { console.error('Contacts error:', err); }
}

export function toggleContactSelect(id, checked) {
  if (checked) selectedContactIds.add(id);
  else selectedContactIds.delete(id);
  updateContactBulkBar();
}

export function toggleAllContacts(checked) {
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

export function clearContactSelection() {
  selectedContactIds.clear();
  document.getElementById('contactSelectAll').checked = false;
  renderContacts();
}

function updateContactBulkBar() {
  const bar = document.getElementById('contactBulkBar');
  const count = document.getElementById('contactBulkCount');
  const total = selectedContactIds.size;
  if (total === 0) { if (bar) bar.classList.add('hidden'); return; }
  if (bar) bar.classList.remove('hidden');
  if (count) count.textContent = `${total} sélectionné(s)`;
}

export async function bulkMarkRead() {
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

export async function bulkDeleteContacts() {
  const ids = [...selectedContactIds];
  if (ids.length === 0) return;
  showConfirm('Supprimer plusieurs messages', `Supprimer ${ids.length} message(s) ? Cette action est irréversible.`, async () => {
    try {
      await Promise.all(ids.map(id =>
        fetch(`${API_BASE}/contacts/${id}`, { method: 'DELETE', headers: getHeaders() })
      ));
      ids.forEach(id => { const idx = contacts.findIndex(x => x.id === id); if (idx >= 0) contacts.splice(idx, 1); });
      selectedContactIds.clear();
      document.getElementById('contactSelectAll').checked = false;
      renderContacts(); loadStats();
      showToast(`${ids.length} message(s) supprimé(s)`, 'success');
    } catch (err) { showToast('Erreur', 'error'); }
  });
}

export async function markAllRead() {
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

export function renderContacts() {
  const search = document.getElementById('contactSearch').value.toLowerCase();
  const tbody = document.getElementById('contactsBody');
  if (!tbody) return;
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
  const newEl = document.getElementById('filterContactNew');
  if (newEl) newEl.textContent = totalNew;
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

export async function markRead(id) {
  try {
    await fetch(`${API_BASE}/contacts/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ read: true }) });
    const c = contacts.find(x => x.id === id);
    if (c) c.read = true;
    renderContacts(); loadStats();
  } catch (err) { console.error(err); }
}

export async function markResolved(id) {
  try {
    await fetch(`${API_BASE}/contacts/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ read: true, resolved: true }) });
    const c = contacts.find(x => x.id === id);
    if (c) { c.read = true; c.resolved = true; }
    renderContacts(); loadStats();
    showToast('Message marqué comme résolu', 'success');
  } catch (err) { console.error(err); }
}

export function confirmDeleteContact(id) {
  showConfirm('Supprimer le message', 'Cette action est irréversible.', async () => {
    try {
      await fetch(`${API_BASE}/contacts/${id}`, { method: 'DELETE', headers: getHeaders() });
      const idx = contacts.findIndex(x => x.id === id);
      if (idx >= 0) contacts.splice(idx, 1);
      renderContacts(); loadStats();
      showToast('Message supprimé', 'success');
    } catch (err) { console.error(err); }
  });
}

export function openContactDetail(id) {
  const c = contacts.find(x => x.id === id);
  if (!c) return;
  contactDetailId = id;
  document.getElementById('detailName').textContent = c.name;
  const detailDate = document.getElementById('detailDate');
  if (detailDate) detailDate.textContent = formatDate(c.date);
  const detailEmail = document.getElementById('detailEmail');
  if (detailEmail) { detailEmail.textContent = c.email; detailEmail.href = `mailto:${c.email}`; }
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
  if (editor) editor.classList.add('hidden');
  const notesTextarea = document.getElementById('detailNotesTextarea');
  if (notesTextarea) notesTextarea.value = c.notes || '';

  const readBtn = document.getElementById('detailMarkRead');
  const resolveBtn = document.getElementById('detailMarkResolved');
  if (readBtn) readBtn.style.display = c.read ? 'none' : '';
  if (resolveBtn) resolveBtn.style.display = c.resolved ? 'none' : '';

  document.getElementById('contactDetailModal').classList.add('open');
}

export function closeContactDetail() {
  document.getElementById('contactDetailModal').classList.remove('open');
  contactDetailId = null;
}

// ─── Contact detail modal event listeners ───

document.getElementById('detailClose')?.addEventListener('click', closeContactDetail);
document.getElementById('contactDetailModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeContactDetail();
});

document.getElementById('detailMarkRead')?.addEventListener('click', async () => {
  if (!contactDetailId) return;
  await markRead(contactDetailId);
  const c = contacts.find(x => x.id === contactDetailId);
  if (c) c.read = true;
  openContactDetail(contactDetailId);
  renderContacts();
});

document.getElementById('detailMarkResolved')?.addEventListener('click', async () => {
  if (!contactDetailId) return;
  await markResolved(contactDetailId);
  const c = contacts.find(x => x.id === contactDetailId);
  if (c) { c.read = true; c.resolved = true; }
  openContactDetail(contactDetailId);
  renderContacts();
  loadStats();
});

document.getElementById('detailDelete')?.addEventListener('click', () => {
  if (!contactDetailId) return;
  const id = contactDetailId;
  closeContactDetail();
  confirmDeleteContact(id);
});

document.getElementById('detailNotesEdit')?.addEventListener('click', () => {
  document.getElementById('detailNotes').style.display = 'none';
  document.getElementById('detailNotesEditor')?.classList.remove('hidden');
  document.getElementById('detailNotesTextarea')?.focus();
});

document.getElementById('detailNotesCancel')?.addEventListener('click', () => {
  document.getElementById('detailNotesEditor')?.classList.add('hidden');
  document.getElementById('detailNotes').style.display = '';
});

document.getElementById('detailNotesSave')?.addEventListener('click', async () => {
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

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('contactDetailModal')?.classList.contains('open')) closeContactDetail();
});
