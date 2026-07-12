import { API_BASE, API_IMAGES_BASE, getHeaders, contentPage, slots, token, clearToken } from './api.js';
import { escapeHtml } from './helpers.js';
import { showToast, showConfirm, showSkeletonGrid, emptyStateGrid, renderPagination, exportToCsv } from './ui.js';
import { blogCategories } from './blogCategories.js';
import { teamPositions } from './teamPositions.js';

export const teamData = [];
export const servicesData = [];
export const projectsData = [];
export const blogData = [];

const ENTITY_CONFIG = {
  team: {
    label: 'Membre', labelPlural: 'Membres', api: 'team',
    searchFields: ['name', 'role'],
    fields: [
      { key: 'name', label: 'Nom', type: 'text', required: true },
      { key: 'role', label: 'Rôle/Poste', type: 'select', options: 'dynamic_team_positions', required: true },
      { key: 'bio', label: 'Biographie', type: 'textarea' },
      { key: 'image', label: 'Image', type: 'text' },
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
      { key: 'icon', label: 'Marque courte', type: 'text', default: '' },
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
        { value: 'rehabilitation', label: 'Études et Conception' },
        { value: 'forage', label: 'Forage' }
      ]},
      { key: 'image', label: 'Image', type: 'text' },
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
      { key: 'categoryId', label: 'Catégorie', type: 'select', options: 'dynamic_blog_categories' },
      { key: 'image', label: 'URL de l\'image (optionnelle)', type: 'text' },
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
  if (slots.length === 0) {
    try {
      const res = await fetch(`${API_IMAGES_BASE}/images/slots`);
      const data = await res.json();
      slots.length = 0;
      slots.push(...data);
    } catch (_err) { console.error('Failed to load slots:', _err); }
  }
  showSkeletonGrid(`${entity}List`, 4);
  try {
    const res = await fetch(`${API_BASE}/${cfg.api}`, { headers: getHeaders() });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.error || `HTTP ${res.status}`); }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Expected array response');
    if (entity === 'team') { teamData.length = 0; teamData.push(...data); }
    else if (entity === 'services') { servicesData.length = 0; servicesData.push(...data); }
    else if (entity === 'projects') { projectsData.length = 0; projectsData.push(...data); }
    else if (entity === 'blog') { blogData.length = 0; blogData.push(...data); }
    renderEntity(entity);
  } catch (_err) { console.error(`${entity} load error:`, _err); showToast(`Erreur lors du chargement des ${cfg.labelPlural.toLowerCase()}`, 'error'); }
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
    container.innerHTML = emptyStateGrid('', searchTerm ? 'Aucun résultat' : `Aucun ${cfg.label.toLowerCase()}`, searchTerm ? 'Essayez d\'autres termes de recherche.' : `Cliquez sur "Ajouter" pour créer le premier ${cfg.label.toLowerCase()}.`);
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
    const _subtitle = item.role || item.location || '';
    const preview = item.description || item.excerpt || item.bio || '';

    let thumbUrl = '';
    let thumbIcon = '';
    if (item.image) {
      thumbUrl = item.image.startsWith('http') || item.image.startsWith('/') ? item.image : `/images/blog/${item.image}`;
    } else if (item.categoryId || item.imageSlot) {
      const slotId = item.categoryId || item.imageSlot;
      const slot = slots.find(s => s.id === slotId);
      if (slot && slot.currentUrl) thumbUrl = slot.currentUrl;
    }
    if (!thumbUrl) {
      if (entity === 'services') thumbIcon = 'Srv';
      else if (entity === 'team') thumbIcon = 'Eq';
      else if (entity === 'projects') thumbIcon = 'Prj';
      else if (entity === 'blog') thumbIcon = 'Blog';
    }

    let metaHtml = '';
    if (entity === 'blog' && item.date) {
      const d = new Date(item.date);
      metaHtml = `<span class="admin-card-meta">${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>`;
    } else if (entity === 'projects' && item.category) {
      const catLabels = { construction: 'Construction', rehabilitation: 'Études et Conception', forage: 'Forage' };
      metaHtml = `<span class="admin-card-meta admin-card-cat">${catLabels[item.category] || item.category}</span>`;
    } else if (entity === 'team' && item.role) {
      metaHtml = `<span class="admin-card-meta">${escapeHtml(item.role)}</span>`;
    }

    return `<div class="admin-card">
      <div class="admin-card-body">
        <div class="admin-card-top">
          <div class="admin-card-thumb${thumbUrl ? ' has-img' : ''}">
            ${thumbUrl ? `<img src="${thumbUrl}" alt="" loading="lazy">` : thumbIcon}
          </div>
          <div class="admin-card-info">
            <div class="admin-card-title">${escapeHtml(title)}</div>
            ${metaHtml}
          </div>
        </div>
        ${preview ? `<div class="admin-card-desc">${escapeHtml(preview).substring(0, 120)}${preview.length > 120 ? '…' : ''}</div>` : ''}
      </div>
      <div class="admin-card-actions">
        <span class="badge ${item.visible !== false ? 'badge-success' : 'badge-warning'}">${item.visible !== false ? 'Visible' : 'Masqué'}</span>
        <button class="admin-card-btn" onclick="openCrudForm('${entity}', '${item.id}')" title="Modifier">Modifier</button>
        <button class="admin-card-btn admin-card-btn--danger" onclick="confirmDeleteItem('${entity}', '${item.id}')" title="Supprimer">Supprimer</button>
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
  renderPagination(paginationId, contentPage[entity], total, perPage, entity);

  const exportBtn = document.getElementById(`${entity}Export`);
  if (exportBtn) exportBtn.style.display = 'inline-flex';
}

export async function openCrudForm(entity, editId) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  if (slots.length === 0) {
    try {
      const res = await fetch(`${API_IMAGES_BASE}/images/slots`);
      const data = await res.json();
      slots.length = 0;
      slots.push(...data);
    } catch (_err) {
      console.error('Failed to load slots:', _err);
    }
  }
  if (entity === 'team' && teamPositions.length === 0) {
    const { loadTeamPositions } = await import('./teamPositions.js');
    await loadTeamPositions();
  }
  if (entity === 'blog' && blogCategories.length === 0) {
    const { loadBlogCategories } = await import('./blogCategories.js');
    await loadBlogCategories();
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
    let val = item[field.key] !== undefined ? item[field.key] : undefined;
    if (val === undefined && field.key === 'categoryId') val = item['imageSlot'];
    if (val === undefined) val = field.default !== undefined ? field.default : '';
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
      const opts = field.options === 'dynamic_blog_categories'
        ? blogCategories.map(c => ({ value: c.id, label: `${c.icon || ''} ${c.label}`.trim() }))
        : field.options === 'dynamic_team_positions'
        ? teamPositions.map(p => ({ value: p.id, label: p.label }))
        : (field.options || []);
      const hasMatch = val ? opts.some(o => o.value === val) : true;
      html += `<select id="crud_${field.key}" class="status-select" style="width:100%">`;
      html += '<option value="">— Aucune —</option>';
      for (const opt of opts) {
        html += `<option value="${opt.value}" ${val === opt.value ? 'selected' : ''}>${opt.label}</option>`;
      }
      if (val && !hasMatch) {
        html += `<option value="${escapeHtml(String(val))}" selected>${escapeHtml(String(val))} (ancien)</option>`;
      }
      html += '</select>';
    } else if (field.type === 'date') {
      const dateVal = val ? val.substring(0, 10) : '';
      html += `<input type="date" id="crud_${field.key}" class="search-input" value="${dateVal}">`;
    } else if (field.key === 'image' && (entity === 'blog' || entity === 'team' || entity === 'projects')) {
      const imgSrc = val && (val.startsWith('http') || val.startsWith('/')) ? val : val ? `/images/blog/${val}` : '';
      html += `<input type="hidden" id="crud_${field.key}" value="${escapeHtml(String(val))}">`;
      html += '<div class="blog-img-upload">';
      html += `<div class="blog-img-preview" id="crud_image_preview">${imgSrc ? `<img src="${imgSrc}" alt="">` : '<span class="blog-img-placeholder">Image</span>'}</div>`;
      html += '<div class="blog-img-actions">';
      html += '<input type="file" id="crud_image_file" accept="image/*">';
      html += '<button type="button" class="btn-secondary" onclick="uploadBlogImage()">Upload</button>';
      html += '<span id="crud_image_status"></span>';
      html += '</div></div>';
    } else {
      html += `<input type="${field.type}" id="crud_${field.key}" class="search-input" value="${escapeHtml(String(val))}">`;
    }
    html += '</div>';
  }

  document.getElementById('crudFormBody').innerHTML = html;

  if (entity === 'blog') {
    const titleInput = document.getElementById('crud_title');
    const slugInput = document.getElementById('crud_slug');
    if (titleInput && slugInput && !currentEditId) {
      titleInput.addEventListener('input', function autoSlug() {
        const slug = this.value
          .toLowerCase()
          .replace(/[^a-z0-9-\s\u00e0-\u00fc]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        slugInput.value = slug;
      });
    }
  }

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
    : '<span style="opacity:0.45;font-size:0.75rem">Image</span>';
}

export async function uploadSlotImage(fieldKey, section) {
  const fileInput = document.getElementById(`crud_${fieldKey}_file`);
  const file = fileInput.files[0];
  const status = document.getElementById(`crud_${fieldKey}_status`);
  if (!file) { status.textContent = 'Sélectionnez un fichier'; return; }
  if (file.size > 10 * 1024 * 1024) { status.textContent = 'Max 10MB'; return; }

  const select = document.getElementById(`crud_${fieldKey}`);
  let slotId = select.value;
  const fd = new FormData();
  fd.append('section', section);
  fd.append('image', file);

  if (!slotId) {
    const nameInput = document.getElementById('crud_name');
    const name = nameInput?.value?.trim() || file.name.replace(/\.[^.]+$/, '');
    fd.append('newSlotLabel', `${name} - ${section}`);
    status.textContent = 'Création du slot…';
  } else {
    fd.append('slotId', slotId);
  }

  status.textContent = 'Upload…';
  try {
    const res = await fetch(`${API_IMAGES_BASE}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd
    });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload échoué');

    status.textContent = 'Uploadé';
    status.style.color = 'var(--success)';

    const sr = await fetch(`${API_IMAGES_BASE}/images/slots`);
    const newSlots = await sr.json();
    const previousIds = slots.map(s => s.id);
    slots.length = 0;
    slots.push(...newSlots);

    if (!slotId) {
      const created = newSlots.find(s => !previousIds.includes(s.id));
      if (created) slotId = created.id;
    }

    if (slotId) {
      select.innerHTML = '<option value="">— Aucune —</option>';
      for (const s of slots) {
        if (s.section !== section) continue;
        const hasImg = s.uploadedFile ? ' (image)' : '';
        const sel = s.id === slotId ? 'selected' : '';
        select.innerHTML += `<option value="${s.id}" data-url="${escapeHtml(s.currentUrl || '')}" ${sel}>${escapeHtml(s.label)}${hasImg}</option>`;
      }
      previewSlotImage(select);
    }
    fileInput.value = '';
  } catch (_err) {
    status.textContent = 'Erreur : ' + _err.message;
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

  const slotFields = cfg.fields.filter(f => f.type === 'slot-select');
  for (const field of slotFields) {
    const slotId = body[field.key];
    if (slotId) {
      const slot = slots.find(s => s.id === slotId);
      if (slot && !slot.uploadedFile) {
        const proceed = confirm(`Le slot "${slot.label}" n'a pas d'image uploadée. Voulez-vous quand même enregistrer ?`);
        if (!proceed) return;
      }
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
  } catch (_err) {
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
    } catch (_err) {
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

// ─── ENTITY IMAGE UPLOAD (blog, team, etc.) ───
export async function uploadBlogImage() {
  const fileInput = document.getElementById('crud_image_file');
  const status = document.getElementById('crud_image_status');
  const hiddenInput = document.getElementById('crud_image');
  const preview = document.getElementById('crud_image_preview');
  if (!fileInput || !fileInput.files[0]) { if (status) { status.textContent = 'Sélectionnez un fichier'; status.className = 'upload-status error'; } return; }
  const file = fileInput.files[0];
  if (file.size > 10 * 1024 * 1024) { if (status) { status.textContent = 'Max 10MB'; status.className = 'upload-status error'; } return; }
  if (status) { status.textContent = 'Upload…'; status.className = 'upload-status loading'; }

  const section = currentEntity === 'blog' ? 'blog' : (currentEntity === 'team' ? 'team' : (currentEntity === 'projects' ? 'projects' : 'blog'));
  const fd = new FormData();
  fd.append('section', section);
  fd.append('image', file);

  try {
    const res = await fetch(`${API_IMAGES_BASE}/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd
    });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload échoué');

    if (hiddenInput) hiddenInput.value = data.url;
    if (preview) preview.innerHTML = `<img src="${data.url}" alt="">`;
    if (status) { status.textContent = 'OK'; status.className = 'upload-status success'; }
    fileInput.value = '';
  } catch (_err) {
    if (status) { status.textContent = 'Erreur : ' + _err.message; status.className = 'upload-status error'; }
  }
}

// ─── Content pagination functions ───
window._pg_team = (p) => { contentPage['team'] = p; renderEntity('team'); };
window._pg_services = (p) => { contentPage['services'] = p; renderEntity('services'); };
window._pg_projects = (p) => { contentPage['projects'] = p; renderEntity('projects'); };
window._pg_blog = (p) => { contentPage['blog'] = p; renderEntity('blog'); };
