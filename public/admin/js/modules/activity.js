import { API_BASE, getHeaders, activityLogs, clearToken } from './api.js';
import { escapeHtml, formatDate } from './helpers.js';
import { emptyState } from './ui.js';

export async function loadActivityLog() {
  const tbody = document.getElementById('activityBody');
  if (!tbody) { showToast('Onglet journal non disponible', 'error'); return; }
  tbody.innerHTML = '<tr><td colspan="4"><div class="skeleton skeleton-cell" style="height:40px"></div></td></tr>';
  try {
    const res = await fetch(`${API_BASE}/activity`, { headers: getHeaders() });
    activityLogs.length = 0;
    const data = await res.json();
    activityLogs.push(...data);
    renderActivityLog();
  } catch (err) { console.error('Activity log error:', err); }
}

function renderActivityLog() {
  const tbody = document.getElementById('activityBody');
  if (!tbody) return;
  if (!activityLogs || activityLogs.length === 0) {
    tbody.innerHTML = emptyState('📋', 'Aucune activité', 'Le journal d\'activité apparaîtra ici.');
    return;
  }
  tbody.innerHTML = activityLogs.map(log => `
    <tr>
      <td data-label="Date">${formatDate(log.timestamp)}</td>
      <td data-label="Action"><span class="badge badge-info">${escapeHtml(log.action)}</span></td>
      <td data-label="Détails">${escapeHtml(log.details || '').substring(0, 120)}</td>
      <td data-label="Utilisateur">${escapeHtml(log.username || 'admin')}</td>
    </tr>
  `).join('');
}
