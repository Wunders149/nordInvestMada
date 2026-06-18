import { API_BASE, getHeaders } from './api.js';
import { showToast } from './ui.js';

export const teamPositions = [];

export async function loadTeamPositions() {
  try {
    const res = await fetch(`${API_BASE}/team-positions`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load');
    teamPositions.length = 0;
    teamPositions.push(...(await res.json()));
    return teamPositions;
  } catch (_err) {
    console.error('Load team positions error:', _err);
    return [];
  }
}

export async function saveTeamPositions(positions) {
  try {
    const res = await fetch(`${API_BASE}/team-positions`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(positions)
    });
    if (!res.ok) throw new Error('Failed to save');
    teamPositions.length = 0;
    teamPositions.push(...positions);
    showToast('Postes enregistrés', 'success');
    return true;
  } catch (_err) {
    showToast('Erreur lors de l\'enregistrement', 'error');
    return false;
  }
}

export function openPositionManager() {
  const modal = document.getElementById('positionManagerModal');
  const list = document.getElementById('positionManagerList');
  if (!modal || !list) return;

  list.innerHTML = teamPositions.map((pos, i) => `
    <div class="category-row" data-index="${i}">
      <div class="category-fields">
        <input type="text" class="search-input pos-id" value="${escapeHtml(pos.id)}" placeholder="ID (ex: directeur)" style="flex:1;min-width:120px">
        <input type="text" class="search-input pos-label" value="${escapeHtml(pos.label)}" placeholder="Nom affiché" style="flex:1;min-width:160px">
      </div>
      <button class="btn-icon danger" onclick="removePositionRow(this)" title="Supprimer">✕</button>
    </div>
  `).join('');

  modal.classList.add('open');
}

export function closePositionManager() {
  document.getElementById('positionManagerModal')?.classList.remove('open');
}

export function addPositionRow() {
  const list = document.getElementById('positionManagerList');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'category-row';
  div.innerHTML = `
    <div class="category-fields">
      <input type="text" class="search-input pos-id" placeholder="ID (ex: directeur)" style="flex:1;min-width:120px">
      <input type="text" class="search-input pos-label" placeholder="Nom affiché" style="flex:1;min-width:160px">
    </div>
    <button class="btn-icon danger" onclick="removePositionRow(this)" title="Supprimer">✕</button>
  `;
  list.appendChild(div);
}

export function removePositionRow(btn) {
  btn.closest('.category-row').remove();
}

export async function savePositionManager() {
  const rows = document.querySelectorAll('#positionManagerList .category-row');
  const positions = [];
  for (const row of rows) {
    const id = row.querySelector('.pos-id')?.value?.trim();
    const label = row.querySelector('.pos-label')?.value?.trim();
    if (!id || !label) continue;
    positions.push({ id, label });
  }
  if (positions.length === 0) {
    showToast('Ajoutez au moins un poste', 'error');
    return;
  }
  const ok = await saveTeamPositions(positions);
  if (ok) closePositionManager();
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}
