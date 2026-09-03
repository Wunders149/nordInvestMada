import { API_BASE, API_IMAGES_BASE, getHeaders, contentPage, slots, token, clearToken } from './api.js';
import { escapeHtml } from './helpers.js';
import { showToast, showConfirm, showSkeletonGrid, emptyStateGrid, renderPagination, exportToCsv } from './ui.js';
import { blogCategories } from './blogCategories.js';
import { teamPositions } from './teamPositions.js';

export const teamData = [];
export const servicesData = [];
export const projectsData = [];
export const productsData = [];
export const blogData = [];

const ENTITY_CONFIG = {
  team: {
    label: 'Membre', labelPlural: 'Membres', api: 'team',
    searchFields: ['name', 'role'],
    fields: [
      { key: 'name', label: 'Nom', type: 'text', required: true },
      { key: 'role', label: 'Rôle/Poste', type: 'select', options: 'dynamic_team_positions', required: true },
      { key: 'groupType', label: 'Type d’équipe', type: 'select', options: [
        { value: 'office', label: 'Équipe de bureau' },
        { value: 'field', label: 'Équipe sur le terrain' }
      ], default: 'office', required: true },
      { key: 'bio', label: 'Biographie', type: 'textarea' },
      { key: 'imageSlot', label: 'Photo du membre', type: 'slot-select', section: 'team' },
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
      { key: 'imageSlot', label: 'Photo du service', type: 'slot-select', section: 'services' },
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
  products: {
    label: 'Produit', labelPlural: 'Produits', api: 'products',
    searchFields: ['name', 'description', 'price'],
    fields: [
      { key: 'name', label: 'Nom du produit', type: 'text', required: true },
      { key: 'price', label: 'Prix (Ar)', type: 'number', required: true, default: 0 },
      { key: 'description', label: 'Description', type: 'textarea', required: true },
      { key: 'mediaType', label: 'Type de média', type: 'select', options: [
        { value: 'image', label: 'Image' },
        { value: 'video', label: 'Vidéo' }
      ], default: 'image' },
      { key: 'mediaUrl', label: 'Photo ou vidéo du produit', type: 'product-media', required: true },
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

function getEntityItems(entity) {
  if (entity === 'team') return teamData;
  if (entity === 'services') return servicesData;
  if (entity === 'projects') return projectsData;
  if (entity === 'products') return productsData;
  if (entity === 'blog') return blogData;
  return [];
}

export async function reorderEntityItems(entity, sourceId, targetId = null, direction = null) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  const items = [...getEntityItems(entity)].sort((a, b) => {
    const left = Number.isFinite(a?.order) ? Number(a.order) : 99;
    const right = Number.isFinite(b?.order) ? Number(b.order) : 99;
    return left - right;
  });
  const sourceIndex = items.findIndex(item => item.id === sourceId);
  if (sourceIndex === -1) return;

  let targetIndex = sourceIndex;
  if (targetId) {
    const index = items.findIndex(item => item.id === targetId);
    if (index !== -1) targetIndex = index;
  } else if (direction === 'up') {
    targetIndex = Math.max(0, sourceIndex - 1);
  } else if (direction === 'down') {
    targetIndex = Math.min(items.length - 1, sourceIndex + 1);
  }

  if (targetIndex === sourceIndex) return;

  const [moved] = items.splice(sourceIndex, 1);
  items.splice(targetIndex, 0, moved);

  try {
    await Promise.all(items.map((item, index) => fetch(`${API_BASE}/${cfg.api}/${item.id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ order: index + 1 })
    }).then(async res => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Réordonnancement impossible');
      }
    })));
    showToast('Ordre mis à jour', 'success');
    await loadEntity(entity);
  } catch (_err) {
    showToast('Erreur lors du réordonnancement', 'error');
  }
}

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
    else if (entity === 'products') { productsData.length = 0; productsData.push(...data); }
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
  else if (entity === 'products') items = productsData;
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
    const preview = item.description || item.excerpt || item.bio || '';
    const priceText = entity === 'products' && Number(item.price) >= 0 ? `${Number(item.price).toLocaleString('fr-FR')} Ar` : '';

    let thumbUrl = '';
    let thumbIcon = '';
    if (item.image || item.mediaUrl) {
      const raw = item.image || item.mediaUrl || '';
      thumbUrl = raw.startsWith('http') || raw.startsWith('/') ? raw : `/images/blog/${raw}`;
    } else if (item.categoryId || item.imageSlot) {
      const slotId = item.categoryId || item.imageSlot;
      const slot = slots.find(s => s.id === slotId);
      if (slot && slot.currentUrl) thumbUrl = slot.currentUrl;
    }
    if (!thumbUrl) {
      if (entity === 'services') thumbIcon = 'Srv';
      else if (entity === 'team') thumbIcon = 'Eq';
      else if (entity === 'projects') thumbIcon = 'Prj';
      else if (entity === 'products') thumbIcon = 'Prod';
      else if (entity === 'blog') thumbIcon = 'Blog';
    }

    let metaHtml = '';
    if (entity === 'products' && priceText) {
      metaHtml = `<span class="admin-card-meta">${escapeHtml(priceText)}</span>`;
    } else if (entity === 'blog' && item.date) {
      const d = new Date(item.date);
      metaHtml = `<span class="admin-card-meta">${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>`;
    } else if (entity === 'projects' && item.category) {
      const catLabels = { construction: 'Construction', rehabilitation: 'Études et Conception', forage: 'Forage' };
      metaHtml = `<span class="admin-card-meta admin-card-cat">${catLabels[item.category] || item.category}</span>`;
    } else if (entity === 'team' && item.role) {
      metaHtml = `<span class="admin-card-meta">${escapeHtml(item.role)}</span>`;
    }

    return `<div class="admin-card" draggable="true" data-entity="${entity}" data-id="${item.id}" data-order="${Number(item.order) || 0}">
      <div class="admin-card-drag" title="Réordonner" aria-label="Réordonner">⋮⋮</div>
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
        <button class="admin-card-order-btn" data-order-action="up" data-entity="${entity}" data-id="${item.id}" title="Monter">↑</button>
        <button class="admin-card-order-btn" data-order-action="down" data-entity="${entity}" data-id="${item.id}" title="Descendre">↓</button>
        <button class="admin-card-btn" onclick="openCrudForm('${entity}', '${item.id}')" title="Modifier">Modifier</button>
        <button class="admin-card-btn admin-card-btn--danger" onclick="confirmDeleteItem('${entity}', '${item.id}')" title="Supprimer">Supprimer</button>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.admin-card-order-btn').forEach(button => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const { entity: entityName, id, orderAction } = button.dataset;
      await reorderEntityItems(entityName, id, null, orderAction);
    });
  });

  container.querySelectorAll('.admin-card').forEach(card => {
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', async (event) => {
      event.preventDefault();
      card.classList.remove('drag-over');
      const sourceId = event.dataTransfer?.getData('text/plain');
      if (!sourceId || sourceId === card.dataset.id) return;
      await reorderEntityItems(entity, sourceId, card.dataset.id, null);
    });
  });

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
    else if (entity === 'products') items = productsData;
    else if (entity === 'blog') items = blogData;
    item = items.find(i => i.id === editId) || {};
  }

  const previewSubtitleText = entity === 'products'
    ? (item.price !== undefined && item.price !== null && item.price !== '' ? `${Number(item.price).toLocaleString('fr-FR')} Ar` : '')
    : (item.role || item.location || '');

  const previewHtml = `
    <div class="crud-preview-panel">
      <div class="crud-preview-header">Aperçu</div>
      <div class="crud-preview-card">
        <div class="crud-preview-thumb" id="crudPreviewThumb"></div>
        <div class="crud-preview-copy">
          <div class="crud-preview-title" id="crudPreviewTitle">${escapeHtml(item.name || item.title || cfg.label || 'Nouveau')}</div>
          <div class="crud-preview-subtitle" id="crudPreviewSubtitle">${escapeHtml(previewSubtitleText)}</div>
          <div class="crud-preview-body" id="crudPreviewBody">${escapeHtml(item.description || item.bio || item.excerpt || '')}</div>
        </div>
      </div>
    </div>
  `;

  let html = '';
  for (const field of cfg.fields) {
    let val = item[field.key] !== undefined ? item[field.key] : undefined;
    if (val === undefined && (field.key === 'categoryId' || field.key === 'imageSlot')) val = item['imageSlot'];
    if (val === undefined) val = field.default !== undefined ? field.default : '';
    html += `<div class="form-group" data-field="${field.type}">`;
    html += `<label for="crud_${field.key}">${field.label}${field.required ? ' <span style="color:var(--danger)">*</span>' : ''}</label>`;

    if (field.type === 'slot-select') {
      const sectionSlots = slots.filter(s => s.section === field.section);
      const current = sectionSlots.find(s => s.id === val);
      html += `<select id="crud_${field.key}" class="status-select" style="width:100%" onchange="previewSlotImage(this)">`;
      html += '<option value="">— Aucune image —</option>';
      if (val && !current) html += `<option value="${escapeHtml(String(val))}" selected>Image existante</option>`;
      html += sectionSlots.map(s => `<option value="${escapeHtml(s.id)}" data-url="${escapeHtml(s.currentUrl || '')}" ${s.id === val ? 'selected' : ''}>${escapeHtml(s.label)}${s.uploadedFile ? ' (image)' : ''}</option>`).join('');
      html += '</select>';
      html += `<div class="blog-img-upload" style="margin-top:10px"><div class="blog-img-preview" id="crud_${field.key}_preview"><span class="blog-img-placeholder">Image</span></div><div class="blog-img-actions"><input type="file" id="crud_${field.key}_file" accept="image/*"><button type="button" class="btn-secondary" onclick="uploadSlotImage('${field.key}', '${field.section}')">Téléverser</button><span id="crud_${field.key}_status"></span></div></div>`;
    } else if (field.type === 'product-media') {
      const mediaUrl = String(val || '');
      const mediaType = document.getElementById('crud_mediaType')?.value || item.mediaType || 'image';
      const mediaPreview = mediaUrl
        ? (mediaType === 'video' ? `<video src="${escapeHtml(mediaUrl)}" controls muted></video>` : `<img src="${escapeHtml(mediaUrl)}" alt="">`)
        : '<span class="blog-img-placeholder">Média</span>';
      html += `<input type="hidden" id="crud_mediaUrl" value="${escapeHtml(mediaUrl)}">`;
      html += '<div class="blog-img-upload product-media-upload">';
      html += `<div class="blog-img-preview" id="crud_media_preview">${mediaPreview}</div>`;
      html += '<div class="blog-img-actions">';
      html += '<input type="file" id="crud_media_file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime">';
      html += '<button type="button" class="btn-secondary" onclick="uploadProductMedia()">Choisir et téléverser</button>';
      html += '<span id="crud_media_status" class="upload-status"></span>';
      html += '</div></div>';
    } else if (field.type === 'textarea') {
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

  document.getElementById('crudFormBody').innerHTML = `${previewHtml}${html}`;
  document.querySelectorAll('#crudFormBody select[id$="imageSlot"]').forEach(previewSlotImage);

  const refreshCrudPreview = () => {
    const titleId = entity === 'team' || entity === 'products' ? 'crud_name' : 'crud_title';
    const titleEl = document.getElementById(titleId);
    const subtitleEl = document.getElementById(entity === 'team' ? 'crud_role' : entity === 'projects' ? 'crud_location' : entity === 'products' ? 'crud_price' : 'crud_description');
    const bodyEl = document.getElementById(entity === 'team' ? 'crud_bio' : entity === 'services' ? 'crud_description' : entity === 'projects' ? 'crud_description' : entity === 'products' ? 'crud_description' : 'crud_excerpt');
    const previewTitle = document.getElementById('crudPreviewTitle');
    const previewSubtitle = document.getElementById('crudPreviewSubtitle');
    const previewBody = document.getElementById('crudPreviewBody');
    const previewThumb = document.getElementById('crudPreviewThumb');
    const imageSlotSelect = document.getElementById('crud_imageSlot');
    const imageInput = document.getElementById('crud_image');

    if (previewTitle && titleEl) previewTitle.textContent = titleEl.value || (entity === 'team' ? 'Nouveau membre' : entity === 'products' ? 'Nouveau produit' : 'Nouveau service');
    if (previewSubtitle && subtitleEl) {
      const value = subtitleEl.value || '';
      previewSubtitle.textContent = entity === 'products' ? (value ? `${Number(value).toLocaleString('fr-FR')} Ar` : 'Prix') : (value || (entity === 'team' ? 'Rôle' : ''));
    }
    if (previewBody && bodyEl) previewBody.textContent = bodyEl.value || 'Aucune description pour le moment.';

    let imageUrl = '';
    if (imageSlotSelect) {
      const selected = imageSlotSelect.options[imageSlotSelect.selectedIndex];
      imageUrl = selected?.dataset.url || '';
    }
    if (!imageUrl && imageInput && imageInput.value) imageUrl = imageInput.value;
    if (!imageUrl && entity === 'products') {
      const mediaUrlInput = document.getElementById('crud_mediaUrl');
      if (mediaUrlInput && mediaUrlInput.value) imageUrl = mediaUrlInput.value;
    }

    if (previewThumb) {
      if (imageUrl) {
        previewThumb.innerHTML = `<img src="${imageUrl}" alt="prévisualisation" />`;
      } else {
        previewThumb.textContent = (entity === 'team' ? 'Eq' : entity === 'services' ? 'Srv' : entity === 'products' ? 'Prod' : 'IMG');
        previewThumb.style.display = 'grid';
      }
    }
  };

  document.querySelectorAll('#crudFormBody input, #crudFormBody textarea, #crudFormBody select').forEach(el => {
    el.addEventListener('input', refreshCrudPreview);
    el.addEventListener('change', refreshCrudPreview);
  });
  refreshCrudPreview();

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

  if (currentEntity === 'team') {
    const duplicate = teamData.some(item => item.id !== currentEditId && (item.name || '').trim().toLowerCase() === String(body.name || '').trim().toLowerCase());
    if (duplicate) {
      showToast('Un membre avec ce nom existe déjà', 'error');
      return;
    }
  }

  if (currentEntity === 'services') {
    const duplicate = servicesData.some(item => item.id !== currentEditId && (item.title || '').trim().toLowerCase() === String(body.title || '').trim().toLowerCase());
    if (duplicate) {
      showToast('Un service avec ce titre existe déjà', 'error');
      return;
    }
  }

  if (currentEntity === 'products') {
    const duplicate = productsData.some(item => item.id !== currentEditId && (item.name || '').trim().toLowerCase() === String(body.name || '').trim().toLowerCase());
    if (duplicate) {
      showToast('Un produit avec ce nom existe déjà', 'error');
      return;
    }
    if (!body.mediaUrl) {
      showToast('Le média du produit est requis', 'error');
      return;
    }
  }

  const slotFields = cfg.fields.filter(f => f.type === 'slot-select');
  for (const field of slotFields) {
    const slotId = body[field.key];
    if (slotId) {
      const slot = slots.find(s => s.id === slotId);
      if (!slot) {
        showToast(`Le slot sélectionné pour "${field.label}" est introuvable.`, 'error');
        return;
      }
      if (!slot.uploadedFile && !slot.currentUrl) {
        showToast(`Le slot "${slot.label}" n'a pas d'image associée. Ajoutez une image avant d'enregistrer.`, 'error');
        return;
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
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Erreur');
    }
    closeCrudForm();
    showToast(`${cfg.label} ${currentEditId ? 'modifié' : 'ajouté'} avec succès`, 'success');
    loadEntity(currentEntity);
  } catch (_err) {
    if (_err.message === 'Erreur') _err.message = 'Erreur lors de l\'enregistrement';
    showToast(`Erreur : ${_err.message}`, 'error');
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
export function openProductForm(id) { openCrudForm('products', id); }
export function openBlogForm(id) { openCrudForm('blog', id); }

export function exportEntity(entity) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) return;
  let items;
  if (entity === 'team') items = teamData;
  else if (entity === 'services') items = servicesData;
  else if (entity === 'projects') items = projectsData;
  else if (entity === 'products') items = productsData;
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

export async function uploadProductMedia() {
  const fileInput = document.getElementById('crud_media_file');
  const status = document.getElementById('crud_media_status');
  const hiddenInput = document.getElementById('crud_mediaUrl');
  const preview = document.getElementById('crud_media_preview');
  const typeInput = document.getElementById('crud_mediaType');
  const file = fileInput?.files?.[0];
  if (!file) {
    if (status) { status.textContent = 'Sélectionnez un fichier'; status.className = 'upload-status error'; }
    return;
  }
  const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    if (status) { status.textContent = `Max ${file.type.startsWith('video/') ? '100' : '10'}MB`; status.className = 'upload-status error'; }
    return;
  }
  if (status) { status.textContent = 'Upload…'; status.className = 'upload-status loading'; }

  const fd = new FormData();
  fd.append('media', file);
  try {
    const res = await fetch(`${API_BASE}/products/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd
    });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload échoué');
    if (hiddenInput) hiddenInput.value = data.url;
    if (typeInput) typeInput.value = data.mediaType;
    if (preview) {
      preview.innerHTML = data.mediaType === 'video'
        ? `<video src="${escapeHtml(data.url)}" controls muted></video>`
        : `<img src="${escapeHtml(data.url)}" alt="">`;
    }
    if (status) { status.textContent = 'Média téléversé'; status.className = 'upload-status success'; }
    fileInput.value = '';
  } catch (err) {
    if (status) { status.textContent = 'Erreur : ' + err.message; status.className = 'upload-status error'; }
  }
}

// ─── Content pagination functions ───
window._pg_team = (p) => { contentPage['team'] = p; renderEntity('team'); };
window._pg_services = (p) => { contentPage['services'] = p; renderEntity('services'); };
window._pg_projects = (p) => { contentPage['projects'] = p; renderEntity('projects'); };
window._pg_blog = (p) => { contentPage['blog'] = p; renderEntity('blog'); };
