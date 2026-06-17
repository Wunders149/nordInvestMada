import { API_BASE, getHeaders, activityLogs } from './api.js';
import { escapeHtml, formatDate } from './helpers.js';
import { emptyState, renderPagination, showToast } from './ui.js';

let activityPage = 1;
const ACTIVITY_PER_PAGE = 20;

export async function loadActivityLog() {
  const tbody = document.getElementById('activityBody');
  if (!tbody) { showToast('Onglet journal non disponible', 'error'); return; }
  tbody.innerHTML = '<tr><td colspan="4"><div class="skeleton skeleton-cell" style="height:40px"></div></td></tr>';
  try {
    const res = await fetch(`${API_BASE}/activity`, { headers: getHeaders() });
    activityLogs.length = 0;
    const data = await res.json();
    activityLogs.push(...data);
    activityPage = 1;
    renderActivityLog();
  } catch (err) { console.error('Activity log error:', err); showToast('Erreur lors du chargement du journal', 'error'); }
}

function renderActivityLog() {
  const tbody = document.getElementById('activityBody');
  if (!tbody) return;
  if (!activityLogs || activityLogs.length === 0) {
    tbody.innerHTML = emptyState('📋', 'Aucune activité', 'Le journal d\'activité apparaîtra ici.');
    document.getElementById('activityPagination').innerHTML = '';
    return;
  }
  const total = activityLogs.length;
  if (activityPage > Math.ceil(total / ACTIVITY_PER_PAGE)) activityPage = 1;
  const start = (activityPage - 1) * ACTIVITY_PER_PAGE;
  const page = activityLogs.slice(start, start + ACTIVITY_PER_PAGE);
  tbody.innerHTML = page.map(log => `
    <tr>
      <td data-label="Date">${formatDate(log.timestamp)}</td>
      <td data-label="Action"><span class="badge badge-info">${escapeHtml(log.action)}</span></td>
      <td data-label="Détails">${escapeHtml(log.details || '').substring(0, 120)}</td>
      <td data-label="Utilisateur">${escapeHtml(log.username || 'admin')}</td>
    </tr>
  `).join('');
  renderPagination('activityPagination', activityPage, total, ACTIVITY_PER_PAGE, 'activity');
}

window._pg_activity = (p) => { activityPage = p; renderActivityLog(); };
