import { API_BASE, getHeaders, contentPage, slots, token, clearToken } from './api.js';
import { escapeHtml } from './helpers.js';
import { showToast, showConfirm, showSkeletonGrid, emptyStateGrid, renderPagination, exportToCsv } from './ui.js';

export let teamData = [];
export let servicesData = [];
export let projectsData = [];
export let blogData = [];

const ENTITY_CONFIG = {
  team: {
    label: 'Membre', labelPlural: 'Membres', api: 'team',
    searchFields: ['name', 'role'],
    fields: [
      { key: 'name', label: 'Nom', type: 'text', required: true },
      { key: 'role', label: 'Rôle', type: 'text', required: true },
      { key: 'bio', label: 'Biographie', type: 'textarea' },
      { key: 'imageSlot', label: 'Image', type: 'slot-select', section: 'team' },
      { key: 'order', label: 'Ordre', type: 'number', default: 1 },
      { key: 'visible', label: 'Visible', type: 'checkbox', default: true }
    ]
  },
  services: {
    label: 'Service', labelPlural: 'Services', api: 'services',
    searchFields: ['title', 'description'],
    fields: [
      { key: 'title', label: 'Titre', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'icon', label: 'Icône (emoji)', type: 'text', default: '🔧' },
      { key: 'order', label: 'Ordre', type: 'number', default: 1 },
      { key: 'visible', label: 'Visible', type: 'checkbox', default: true }
    ]
  },
  projects: {
    label: 'Projet', labelPlural: 'Projets', api: 'projects',
    searchFields: ['title', 'location', 'description'],
    fields: [
      { key: 'title', label: 'Titre', type: 'text', required: true },
      { key: 'location', label: 'Localisation', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'category', label: 'Catégorie', type: 'select', options: [
        { value: 'construction', label: 'Construction' },
        { value: 'rehabilitation', label: 'Réhabilitation' },
        { value: 'forage', label: 'Forage' }
      ]},
      { key: 'imageSlot', label: 'Image', type: 'slot-select', section: 'projects' },
      { key: 'order', label: 'Ordre', type: 'number', default: 1 },
      { key: 'visible', label: 'Visible', type: 'checkbox', default: true }
    ]
  },
  blog: {
    label: 'Article', labelPlural: 'Articles', api: 'blog',
    searchFields: ['title', 'excerpt'],
    fields: [
      { key: 'title', label: 'Titre', type: 'text', required: true },
      { key: 'slug', label: 'Slug (URL)', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'excerpt', label: 'Extrait', type: 'textarea' },
      { key: 'content', label: 'Contenu (HTML)', type: 'textarea' },
      { key: 'imageSlot', label: 'Image', type: 'slot-select', section: 'blog' },
      { key: 'published', label: 'Publié', type: 'checkbox', default: true }
    ]
  }
};

let currentEntity = null;
let currentEditId = null;

export async function loadEntity(entity) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  if (!contentPage[entity]) contentPage[entity] = 1;
  showSkeletonGrid(`${entity}List`, 4);
  try {
    const res = await fetch(`${API_BASE}/${cfg.api}`, { headers: getHeaders() });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    if (entity === 'team') { teamData.length = 0; teamData.push(...data); }
    else if (entity === 'services') { servicesData.length = 0; servicesData.push(...data); }
    else if (entity === 'projects') { projectsData.length = 0; projectsData.push(...data); }
    else if (entity === 'blog') { blogData.length = 0; blogData.push(...data); }
    renderEntity(entity);
  } catch (err) { console.error(`${entity} load error:`, err); }
}

export function renderEntity(entity) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  let items;
  if (entity === 'team') items = teamData;
  else if (entity === 'services') items = servicesData;
  else if (entity === 'projects') items = projectsData;
  else if (entity === 'blog') items = blogData;
  const container = document.getElementById(`${entity}List`);
  if (!container) return;

  const searchInput = document.getElementById(`${entity}Search`);
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  if (searchTerm) {
    items = (items || []).filter(item =>
      cfg.searchFields.some(f => String(item[f] || '').toLowerCase().includes(searchTerm))
    );
  }

  if (!items || items.length === 0) {
    container.innerHTML = emptyStateGrid('📂', searchTerm ? 'Aucun résultat' : `Aucun ${cfg.label.toLowerCase()}`, searchTerm ? 'Essayez d\'autres termes de recherche.' : `Cliquez sur "Ajouter" pour créer le premier ${cfg.label.toLowerCase()}.`);
    return;
  }

  const perPage = 8;
  if (!contentPage[entity] || contentPage[entity] < 1) contentPage[entity] = 1;
  const total = items.length;
  const maxPage = Math.ceil(total / perPage);
  if (contentPage[entity] > maxPage) contentPage[entity] = maxPage;
  const start = (contentPage[entity] - 1) * perPage;
  const page = items.slice(start, start + perPage);

  container.innerHTML = page.map(item => {
    const title = item.name || item.title || item.label || 'Sans titre';
    const subtitle = item.role || item.location || '';
    const preview = item.description || item.excerpt || item.bio || '';
    return `<div class="admin-card">
      <div class="admin-card-body">
        <div class="admin-card-title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="admin-card-sub">${escapeHtml(subtitle)}</div>` : ''}
        <div class="admin-card-desc">${escapeHtml(preview).substring(0, 120)}${preview.length > 120 ? '…' : ''}</div>
      </div>
      <div class="admin-card-actions">
        <span class="badge ${item.visible !== false ? 'badge-success' : 'badge-warning'}">${item.visible !== false ? 'Visible' : 'Masqué'}</span>
        <button class="btn-icon info" onclick="openCrudForm('${entity}', '${item.id}')" title="Modifier">✏</button>
        <button class="btn-icon danger" onclick="confirmDeleteItem('${entity}', '${item.id}')" title="Supprimer">✕</button>
      </div>
    </div>`;
  }).join('');

  const paginationId = `${entity}Pagination`;
  let pagEl = document.getElementById(paginationId);
  if (!pagEl) {
    pagEl = document.createElement('div');
    pagEl.id = paginationId;
    pagEl.className = 'pagination';
    container.parentElement.appendChild(pagEl);
  }
  renderPagination(paginationId, contentPage[entity], total, perPage, `content,'${entity}'`);

  const exportBtn = document.getElementById(`${entity}Export`);
  if (exportBtn) exportBtn.style.display = 'inline-flex';
}

export async function openCrudForm(entity, editId) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  if (slots.length === 0) {
    try {
      const res = await fetch('/api/images/slots');
      const data = await res.json();
      slots.length = 0;
      slots.push(...data);
    } catch (err) {
      console.error('Failed to load slots:', err);
    }
  }
  currentEntity = entity;
  currentEditId = editId || null;

  let item = {};
  if (editId) {
    let items;
    if (entity === 'team') items = teamData;
    else if (entity === 'services') items = servicesData;
    else if (entity === 'projects') items = projectsData;
    else if (entity === 'blog') items = blogData;
    item = items.find(i => i.id === editId) || {};
  }

  document.getElementById('crudModalTitle').textContent = editId ? `Modifier ${cfg.label}` : `Ajouter ${cfg.label}`;

  let html = '';
  for (const field of cfg.fields) {
    const val = item[field.key] !== undefined ? item[field.key] : (field.default !== undefined ? field.default : '');
    html += `<div class="form-group" data-field="${field.type}">`;
    html += `<label for="crud_${field.key}">${field.label}${field.required ? ' <span style="color:var(--danger)">*</span>' : ''}</label>`;

    if (field.type === 'textarea') {
      html += `<textarea id="crud_${field.key}" class="detail-textarea" rows="4">${escapeHtml(String(val))}</textarea>`;
    } else if (field.type === 'checkbox') {
      html += `<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;margin-top:0.25rem">
        <input type="checkbox" id="crud_${field.key}" ${val ? 'checked' : ''} style="width:auto;padding:0">
        <span style="font-size:0.8125rem;color:var(--gray-600)">Afficher sur le site</span>
      </label>`;
    } else if (field.type === 'select') {
      html += `<select id="crud_${field.key}" class="status-select" style="width:100%">`;
      for (const opt of (field.options || [])) {
        html += `<option value="${opt.value}" ${val === opt.value ? 'selected' : ''}>${opt.label}</option>`;
      }
      html += `</select>`;
    } else if (field.type === 'slot-select') {
      html += `<div style="display:flex;gap:0.75rem;align-items:start;flex-wrap:wrap">`;
      html += `<div style="flex:1;min-width:160px">`;
      html += `<select id="crud_${field.key}" class="status-select" style="width:100%" onchange="previewSlotImage(this)" data-section="${field.section}">`;
      html += `<option value="">— Aucune —</option>`;
      const sectionSlots = slots.filter(s => s.section === field.section);
      for (const s of sectionSlots) {
        const hasImg = s.uploadedFile ? ' 📷' : '';
        html += `<option value="${s.id}" data-url="${escapeHtml(s.currentUrl || '')}" ${val === s.id ? 'selected' : ''}>${escapeHtml(s.label)}${hasImg}</option>`;
      }
      html += `</select>`;
      html += `</div>`;
      html += `<div id="crud_${field.key}_preview" class="slot-preview">`;
      const currentSlot = sectionSlots.find(s => s.id === val);
      if (currentSlot && currentSlot.currentUrl) {
        html += `<img src="${currentSlot.currentUrl}" alt="aperçu" style="width:100%;height:100%;object-fit:cover">`;
      } else {
        html += `<span style="opacity:0.3">🖼</span>`;
      }
      html += `</div>`;
      html += `</div>`;
      html += `<div style="margin-top:0.5rem;display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">`;
      html += `<input type="file" id="crud_${field.key}_file" accept="image/*" style="font-size:0.75rem;flex:1;min-width:120px">`;
      html += `<button type="button" class="btn-secondary" style="padding:0.3rem 0.8rem;font-size:0.75rem" onclick="uploadSlotImage('${field.key}', '${field.section}')">Upload</button>`;
      html += `<span id="crud_${field.key}_status" style="font-size:0.75rem;color:var(--gray-500)"></span>`;
      html += `</div>`;
    } else if (field.type === 'date') {
      const dateVal = val ? val.substring(0, 10) : '';
      html += `<input type="date" id="crud_${field.key}" class="search-input" value="${dateVal}">`;
    } else {
      html += `<input type="${field.type}" id="crud_${field.key}" class="search-input" value="${escapeHtml(String(val))}">`;
    }
    html += `</div>`;
  }

  document.getElementById('crudFormBody').innerHTML = html;
  const sel = document.querySelector(`#crudFormBody select[onchange="previewSlotImage(this)"]`);
  if (sel) previewSlotImage(sel);
  document.getElementById('crudModal').classList.add('open');
}

export function previewSlotImage(sel) {
  if (!sel) return;
  const preview = document.getElementById(`${sel.id}_preview`);
  if (!preview) return;
  const opt = sel.options[sel.selectedIndex];
  const url = opt ? opt.dataset.url : '';
  preview.innerHTML = url
    ? `<img src="${url}" alt="aperçu" style="width:100%;height:100%;object-fit:cover">`
    : `<span style="opacity:0.3;font-size:1.5rem">🖼</span>`;
}

export async function uploadSlotImage(fieldKey, section) {
  const fileInput = document.getElementById(`crud_${fieldKey}_file`);
  const file = fileInput.files[0];
  const status = document.getElementById(`crud_${fieldKey}_status`);
  if (!file) { status.textContent = 'Sélectionnez un fichier'; return; }
  if (file.size > 10 * 1024 * 1024) { status.textContent = 'Max 10MB'; return; }

  const select = document.getElementById(`crud_${fieldKey}`);
  const slotId = select.value;
  if (!slotId) { status.textContent = 'Choisissez un slot d\'abord'; return; }

  status.textContent = 'Upload…';
  const fd = new FormData();
  fd.append('section', section);
  fd.append('slotId', slotId);
  fd.append('image', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd
    });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload échoué');
    status.textContent = '✓ Uploadé';
    status.style.color = 'var(--success)';
    const sr = await fetch('/api/images/slots');
    const newSlots = await sr.json();
    slots.length = 0;
    slots.push(...newSlots);
    const updatedSlot = slots.find(s => s.id === slotId);
    if (updatedSlot) {
      const opt = select.querySelector(`option[value="${slotId}"]`);
      if (opt) { opt.dataset.url = updatedSlot.currentUrl || ''; opt.textContent = updatedSlot.label + ' 📷'; }
      previewSlotImage(select);
    }
    fileInput.value = '';
  } catch (err) {
    status.textContent = '✗ ' + err.message;
    status.style.color = 'var(--danger)';
  }
}

export function closeCrudForm() {
  document.getElementById('crudModal').classList.remove('open');
  currentEntity = null;
  currentEditId = null;
}

export async function saveCrudItem() {
  const cfg = ENTITY_CONFIG[currentEntity];
  if (!cfg) return;

  const body = {};
  for (const field of cfg.fields) {
    const el = document.getElementById(`crud_${field.key}`);
    if (!el) continue;
    if (field.type === 'checkbox') {
      body[field.key] = el.checked;
    } else if (field.type === 'number') {
      body[field.key] = parseFloat(el.value) || 0;
    } else {
      body[field.key] = el.value;
    }
    if (field.required && !body[field.key]) {
      showToast(`Le champ "${field.label}" est requis`, 'error');
      return;
    }
  }

  try {
    let url = `${API_BASE}/${cfg.api}`;
    let method = 'POST';
    if (currentEditId) {
      url += `/${currentEditId}`;
      method = 'PATCH';
    }
    const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Erreur');
    closeCrudForm();
    showToast(`${cfg.label} ${currentEditId ? 'modifié' : 'ajouté'} avec succès`, 'success');
    loadEntity(currentEntity);
  } catch (err) {
    showToast('Erreur lors de l\'enregistrement', 'error');
  }
}

export function confirmDeleteItem(entity, id) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  showConfirm(`Supprimer ${cfg.label.toLowerCase()}`, 'Cette action est irréversible.', async () => {
    try {
      const res = await fetch(`${API_BASE}/${cfg.api}/${id}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Erreur');
      showToast(`${cfg.label} supprimé`, 'success');
      loadEntity(entity);
    } catch (err) {
      showToast('Erreur lors de la suppression', 'error');
    }
  });
}

export function openTeamForm(id) { openCrudForm('team', id); }
export function openServiceForm(id) { openCrudForm('services', id); }
export function openProjectForm(id) { openCrudForm('projects', id); }
export function openBlogForm(id) { openCrudForm('blog', id); }

export function exportEntity(entity) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  let items;
  if (entity === 'team') items = teamData;
  else if (entity === 'services') items = servicesData;
  else if (entity === 'projects') items = projectsData;
  else if (entity === 'blog') items = blogData;
  if (!items || items.length === 0) { showToast('Aucune donnée à exporter', 'info'); return; }
  const headers = cfg.fields.map(f => f.label);
  const rows = items.map(item => cfg.fields.map(f => {
    const val = item[f.key];
    if (f.type === 'checkbox') return val ? 'Oui' : 'Non';
    return val !== undefined ? String(val) : '';
  }));
  exportToCsv(`${entity}.csv`, [headers, ...rows]);
}
