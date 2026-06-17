import { API_BASE, getHeaders, subscribers, clearToken } from './api.js';
import { escapeHtml, formatDate } from './helpers.js';
import { showToast, showConfirm, showSkeletonTable, renderPagination, emptyState } from './ui.js';
import { loadStats } from './dashboard.js';

let subPage = 1;
const SUB_PER_PAGE = 20;

export async function loadSubscribers() {
  showSkeletonTable('subscribersBody', 3, 4);
  try {
    const res = await fetch(`${API_BASE}/subscribers`, { headers: getHeaders() });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    subscribers.length = 0;
    const data = await res.json();
    subscribers.push(...data);
    subPage = 1;
    renderSubscribers();
  } catch (err) { console.error('Subscribers error:', err); showToast('Erreur lors du chargement', 'error'); }
}

export function renderSubscribers() {
  const search = document.getElementById('subSearch').value.toLowerCase();
  const tbody = document.getElementById('subscribersBody');
  if (!tbody) return;
  const filtered = subscribers.filter(s => s.email.toLowerCase().includes(search));
  if (filtered.length === 0) {
    tbody.innerHTML = emptyState('📧', 'Aucun abonné', 'Les inscrits à la newsletter apparaîtront ici.');
    document.getElementById('subPagination').innerHTML = '';
    return;
  }
  const total = filtered.length;
  if (subPage > Math.ceil(total / SUB_PER_PAGE)) subPage = 1;
  const start = (subPage - 1) * SUB_PER_PAGE;
  const page = filtered.slice(start, start + SUB_PER_PAGE);
  tbody.innerHTML = page.map(s => `
    <tr>
      <td data-label="Date">${formatDate(s.date)}</td>
      <td data-label="Email"><a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a></td>
      <td class="actions-cell">
        <button class="btn-icon danger" onclick="confirmDeleteSubscriber('${escapeHtml(s.email)}')" title="Supprimer">✕</button>
      </td>
    </tr>
  `).join('');
  renderPagination('subPagination', subPage, total, SUB_PER_PAGE, 'sub');
}

window._pg_sub = (p) => { subPage = p; renderSubscribers(); };

export function confirmDeleteSubscriber(email) {
  showConfirm('Supprimer l\'abonné', `Retirer ${email} de la liste ?`, async () => {
    try {
      await fetch(`${API_BASE}/subscribers/${encodeURIComponent(email)}`, { method: 'DELETE', headers: getHeaders() });
      const idx = subscribers.findIndex(s => s.email === email);
      if (idx >= 0) subscribers.splice(idx, 1);
      renderSubscribers(); loadStats();
      showToast('Abonné supprimé', 'success');
    } catch (err) { console.error(err); showToast('Erreur lors de la suppression', 'error'); }
  });
}
