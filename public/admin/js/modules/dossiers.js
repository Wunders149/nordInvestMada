import { API_BASE, getHeaders } from './api.js';
import { escapeHtml, humanSize } from './helpers.js';
import { showToast, showConfirm } from './ui.js';

let dossiers = [];
let filteredDossiers = [];
let renameTargetId = null;

export async function loadDossiers() {
  try {
    const res = await fetch(`${API_BASE}/dossiers`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load');
    dossiers = await res.json();
    filteredDossiers = [...dossiers];
    filterDossiers();
  } catch (err) {
    console.error('loadDossiers error:', err);
    document.getElementById('dossiersList').innerHTML = '<p class="empty-row">Erreur de chargement</p>';
  }
}

export function filterDossiers() {
  const term = (document.getElementById('dossierSearch')?.value || '').toLowerCase();
  filteredDossiers = term ? dossiers.filter(d => d.name.toLowerCase().includes(term)) : [...dossiers];
  renderDossiersList();
}

function renderDossiersList() {
  const el = document.getElementById('dossiersList');
  if (!el) return;
  const items = filteredDossiers;
  if (!items.length) {
    el.innerHTML = '<p class="empty-row">Aucun dossier. Cliquez sur "Upload PDF" pour ajouter un fichier.</p>';
    return;
  }
  el.innerHTML = items.map(d => {
    const thumbSrc = d.thumbnail_url || '';
    return `<div class="admin-card dossier-card" data-id="${escapeHtml(d.id)}" data-name="${escapeHtml(d.name)}">
      <div class="dossier-thumb-wrap">
        <img src="${thumbSrc}" alt="${escapeHtml(d.name)}" loading="lazy" class="dossier-thumb" onerror="this.style.display='none'">
      </div>
      <div class="dossier-info">
        <div class="dossier-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</div>
        <div class="dossier-meta">${humanSize(d.size)} · ${d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : ''}</div>
      </div>
      <div class="dossier-actions">
        <button class="btn-icon" title="Voir" data-action="view">👁️</button>
        <button class="btn-icon" title="Renommer" data-action="rename">✏️</button>
        <button class="btn-icon danger" title="Supprimer" data-action="delete">🗑️</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-action="view"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.dossier-card');
      window.open(`/api/dossiers/${card.dataset.id}/view`, '_blank');
    });
  });
  el.querySelectorAll('[data-action="rename"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.dossier-card');
      openDossierRename(card.dataset.id, card.dataset.name);
    });
  });
  el.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.dossier-card');
      confirmDeleteDossier(card.dataset.id, card.dataset.name);
    });
  });

  const input = document.getElementById('dossierUploadInput');
  input.onchange = () => {
    if (input.files && input.files[0]) uploadDossier(input.files[0]);
  };
}

async function uploadDossier(file) {
  const formData = new FormData();
  formData.append('pdf', file);
  try {
    const res = await fetch(`${API_BASE}/dossiers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }
    showToast('Dossier uploadé avec succès');
    document.getElementById('dossierUploadInput').value = '';
    loadDossiers();
  } catch (err) {
    showToast(`Erreur: ${err.message}`, 'error');
  }
}

function openDossierRename(id, name) {
  renameTargetId = id;
  document.getElementById('dossierRenameInput').value = name.replace(/\.pdf$/i, '');
  document.getElementById('dossierRenameModal').style.display = 'flex';
}

export function closeDossierRename() {
  renameTargetId = null;
  document.getElementById('dossierRenameInput').value = '';
  document.getElementById('dossierRenameModal').style.display = 'none';
}

export async function confirmDossierRename() {
  if (!renameTargetId) return;
  const newName = document.getElementById('dossierRenameInput').value.trim();
  if (!newName) { showToast('Veuillez entrer un nom', 'error'); return; }
  try {
    const res = await fetch(`${API_BASE}/dossiers/${encodeURIComponent(renameTargetId)}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ name: newName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Rename failed');
    }
    showToast('Dossier renommé avec succès');
    closeDossierRename();
    loadDossiers();
  } catch (err) {
    showToast(`Erreur: ${err.message}`, 'error');
  }
}

function confirmDeleteDossier(id, name) {
  showConfirm(
    'Supprimer le dossier',
    `Voulez-vous vraiment supprimer <strong>${escapeHtml(name)}</strong> ?`,
    async () => {
      try {
        const res = await fetch(`${API_BASE}/dossiers/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: getHeaders()
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Delete failed');
        }
        showToast('Dossier supprimé');
        loadDossiers();
      } catch (err) {
        showToast(`Erreur: ${err.message}`, 'error');
      }
    }
  );
}
