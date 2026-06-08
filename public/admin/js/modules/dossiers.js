import { API_BASE, getHeaders } from './api.js';
import { escapeHtml, humanSize } from './helpers.js';
import { showToast, showConfirm } from './ui.js';

let dossiers = [];
let renameTarget = null;

export async function loadDossiers() {
  try {
    const res = await fetch(`${API_BASE}/dossiers`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load');
    dossiers = await res.json();
    renderDossiers();
  } catch (err) {
    console.error('loadDossiers error:', err);
    document.getElementById('dossiersList').innerHTML = '<p class="empty-row">Erreur de chargement</p>';
  }
}

export function renderDossiers() {
  const el = document.getElementById('dossiersList');
  if (!el) return;
  if (!dossiers.length) {
    el.innerHTML = '<p class="empty-row">Aucun dossier. Cliquez sur "Upload PDF" pour ajouter un fichier.</p>';
    return;
  }
  el.innerHTML = dossiers.map(d => {
    const thumbSrc = `/api/dossiers/${encodeURIComponent(d.name)}/thumbnail`;
    return `<div class="admin-card dossier-card" data-file="${escapeHtml(d.name)}">
      <div class="dossier-thumb-wrap">
        <img src="${thumbSrc}" alt="${escapeHtml(d.name)}" loading="lazy" class="dossier-thumb">
      </div>
      <div class="dossier-info">
        <div class="dossier-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</div>
        <div class="dossier-meta">${humanSize(d.size)} · ${new Date(d.mtime).toLocaleDateString('fr-FR')}</div>
      </div>
      <div class="dossier-actions">
        <button class="btn-icon" title="Renommer" data-action="rename">✏️</button>
        <button class="btn-icon" title="Supprimer" data-action="delete">🗑️</button>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-action="rename"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.dossier-card');
      openDossierRename(card.dataset.file);
    });
  });
  el.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.dossier-card');
      confirmDeleteDossier(card.dataset.file);
    });
  });

  // Upload handler
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

function openDossierRename(name) {
  renameTarget = name;
  document.getElementById('dossierRenameInput').value = name.replace(/\.pdf$/i, '');
  document.getElementById('dossierRenameModal').style.display = 'flex';
}

export function closeDossierRename() {
  renameTarget = null;
  document.getElementById('dossierRenameModal').style.display = 'none';
}

export async function confirmDossierRename() {
  if (!renameTarget) return;
  const newName = document.getElementById('dossierRenameInput').value.trim();
  if (!newName) { showToast('Veuillez entrer un nom', 'error'); return; }
  try {
    const res = await fetch(`${API_BASE}/dossiers/${encodeURIComponent(renameTarget)}`, {
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

function confirmDeleteDossier(name) {
  showConfirm(
    'Supprimer le dossier',
    `Voulez-vous vraiment supprimer <strong>${escapeHtml(name)}</strong> ?`,
    async () => {
      try {
        const res = await fetch(`${API_BASE}/dossiers/${encodeURIComponent(name)}`, {
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
