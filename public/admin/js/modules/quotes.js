import { API_BASE, getHeaders, quotes, selectedQuoteIds, PER_PAGE, clearToken, state } from './api.js';
import { escapeHtml, formatDate } from './helpers.js';
import { showToast, showConfirm, showSkeletonTable, renderPagination, emptyState } from './ui.js';
import { loadStats } from './dashboard.js';

export function setQuoteFilter(filter) {
  state.quoteFilter = filter;
  document.querySelectorAll('#state.quoteFilterBar .filter-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`#state.quoteFilterBar .filter-btn[data-filter="${filter}"]`);
  if (btn) btn.classList.add('active');
  state.quotePage = 1;
  renderQuotes();
}

export async function loadQuotes() {
  showSkeletonTable('quotesBody', 8);
  try {
    const res = await fetch(`${API_BASE}/quotes`, { headers: getHeaders() });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    quotes.length = 0;
    const data = await res.json();
    quotes.push(...data);
    state.quotePage = 1;
    renderQuotes();
    loadStats();
  } catch (err) { console.error('Quotes error:', err); }
}

export function toggleQuoteSelect(id, checked) {
  if (checked) selectedQuoteIds.add(id);
  else selectedQuoteIds.delete(id);
  updateQuoteBulkBar();
}

export function toggleAllQuotes(checked) {
  const search = document.getElementById('quoteSearch').value.toLowerCase();
  let filtered = quotes.filter(q =>
    q.name.toLowerCase().includes(search) ||
    q.email.toLowerCase().includes(search) ||
    (q.quoteNumber || '').toLowerCase().includes(search)
  );
  if (state.quoteFilter !== 'all') {
    filtered = filtered.filter(q => (q.status || 'pending') === state.quoteFilter);
  }
  if (checked) { filtered.forEach(q => selectedQuoteIds.add(q.id)); }
  else { selectedQuoteIds.clear(); }
  renderQuotes();
}

export function clearQuoteSelection() {
  selectedQuoteIds.clear();
  document.getElementById('quoteSelectAll').checked = false;
  renderQuotes();
}

function updateQuoteBulkBar() {
  const bar = document.getElementById('quoteBulkBar');
  const count = document.getElementById('quoteBulkCount');
  const total = selectedQuoteIds.size;
  if (total === 0) { if (bar) bar.classList.add('hidden'); return; }
  if (bar) bar.classList.remove('hidden');
  if (count) count.textContent = `${total} sélectionné(s)`;
}

export async function bulkDeleteQuotes() {
  const ids = [...selectedQuoteIds];
  if (ids.length === 0) return;
  showConfirm('Supprimer plusieurs devis', `Supprimer ${ids.length} devis(s) ? Cette action est irréversible.`, async () => {
    try {
      await Promise.all(ids.map(id =>
        fetch(`${API_BASE}/quotes/${id}`, { method: 'DELETE', headers: getHeaders() })
      ));
      ids.forEach(id => { const idx = quotes.findIndex(x => x.id === id); if (idx >= 0) quotes.splice(idx, 1); });
      selectedQuoteIds.clear();
      document.getElementById('quoteSelectAll').checked = false;
      renderQuotes(); loadStats();
      showToast(`${ids.length} devis(s) supprimé(s)`, 'success');
    } catch (err) { showToast('Erreur', 'error'); }
  });
}

export function renderQuotes() {
  const search = document.getElementById('quoteSearch').value.toLowerCase();
  const tbody = document.getElementById('quotesBody');
  if (!tbody) return;
  let filtered = quotes.filter(q =>
    q.name.toLowerCase().includes(search) ||
    q.email.toLowerCase().includes(search) ||
    (q.quoteNumber || '').toLowerCase().includes(search)
  );
  if (state.quoteFilter !== 'all') {
    filtered = filtered.filter(q => (q.status || 'pending') === state.quoteFilter);
  }
  const totalPending = quotes.filter(q => (q.status || 'pending') === 'pending').length;
  const pendEl = document.getElementById('filterQuotePending');
  if (pendEl) pendEl.textContent = totalPending;
  if (state.quotePage > Math.ceil(filtered.length / PER_PAGE)) state.quotePage = 1;
  if (filtered.length === 0) {
    tbody.innerHTML = emptyState('📋', 'Aucun devis', state.quoteFilter === 'pending' ? 'Aucun devis en attente.' : 'Les demandes de devis apparaîtront ici.');
    document.getElementById('quotesPagination').innerHTML = '';
    return;
  }
  const total = filtered.length;
  const start = (state.quotePage - 1) * PER_PAGE;
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
  renderPagination('quotesPagination', state.quotePage, total, PER_PAGE, 'quote');
  updateQuoteBulkBar();
}

export async function updateQuoteStatus(id, status) {
  try {
    await fetch(`${API_BASE}/quotes/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ status }) });
    const q = quotes.find(x => x.id === id);
    if (q) q.status = status;
    loadStats();
    showToast('Statut mis à jour', 'success');
  } catch (err) { console.error(err); }
}

export function confirmDeleteQuote(id) {
  showConfirm('Supprimer le devis', 'Cette action est irréversible.', async () => {
    try {
      await fetch(`${API_BASE}/quotes/${id}`, { method: 'DELETE', headers: getHeaders() });
      const idx = quotes.findIndex(x => x.id === id);
      if (idx >= 0) quotes.splice(idx, 1);
      renderQuotes(); loadStats();
      showToast('Devis supprimé', 'success');
    } catch (err) { console.error(err); }
  });
}
