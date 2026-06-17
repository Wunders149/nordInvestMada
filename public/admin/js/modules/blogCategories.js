import { API_BASE, API_IMAGES_BASE, getHeaders, token, clearToken } from './api.js';
import { showToast, showConfirm } from './ui.js';

export let blogCategories = [];

export async function loadBlogCategories() {
  try {
    const res = await fetch(`${API_BASE}/blog-categories`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load');
    blogCategories.length = 0;
    blogCategories.push(...(await res.json()));
    return blogCategories;
  } catch (err) {
    console.error('Load blog categories error:', err);
    return [];
  }
}

export async function saveBlogCategories(categories) {
  try {
    const res = await fetch(`${API_BASE}/blog-categories`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(categories)
    });
    if (!res.ok) throw new Error('Failed to save');
    blogCategories.length = 0;
    blogCategories.push(...categories);
    showToast('Catégories enregistrées', 'success');
    return true;
  } catch (err) {
    showToast('Erreur lors de l\'enregistrement', 'error');
    return false;
  }
}

export function openCategoryManager() {
  const modal = document.getElementById('categoryManagerModal');
  const list = document.getElementById('categoryManagerList');
  if (!modal || !list) return;

  list.innerHTML = blogCategories.map((cat, i) => `
    <div class="category-row" data-index="${i}">
      <div class="category-fields">
        <input type="text" class="search-input cat-id" value="${escapeHtml(cat.id)}" placeholder="ID (ex: blog-construction)" style="flex:1;min-width:120px">
        <input type="text" class="search-input cat-label" value="${escapeHtml(cat.label)}" placeholder="Nom" style="flex:1;min-width:100px">
        <input type="text" class="search-input cat-icon" value="${escapeHtml(cat.icon || '')}" placeholder="Icône" style="width:50px">
        <input type="text" class="search-input cat-color" value="${escapeHtml(cat.color || '')}" placeholder="Couleur" style="flex:1;min-width:80px">
        <input type="text" class="search-input cat-svg" value="${escapeHtml(cat.svg || '')}" placeholder="SVG" style="width:60px">
      </div>
      <div class="cat-img-upload">
        <input type="hidden" class="cat-image" value="${escapeHtml(cat.image || '')}">
        ${cat.image ? `<img src="${escapeHtml(cat.image)}" alt="" class="cat-img-preview">` : ''}
        <input type="file" class="cat-image-file" accept="image/*" style="display:none" data-index="${i}">
        <button class="btn-icon" onclick="catUploadClick(${i})" title="Upload image">📷</button>
        ${cat.image ? `<button class="btn-icon danger" onclick="catRemoveImage(${i})" title="Supprimer">✕</button>` : ''}
        <span class="cat-image-status" style="font-size:0.7rem;color:var(--gray-500)"></span>
      </div>
      <button class="btn-icon danger" onclick="removeCategoryRow(this)" title="Supprimer">✕</button>
    </div>
  `).join('');

  // Make upload handlers available globally
  window._catUploadHandlers = {};
  modal.classList.add('open');
}

export function closeCategoryManager() {
  window._catUploadHandlers = {};
  document.getElementById('categoryManagerModal')?.classList.remove('open');
}

export function addCategoryRow() {
  const list = document.getElementById('categoryManagerList');
  if (!list) return;
  const i = list.children.length;
  const div = document.createElement('div');
  div.className = 'category-row';
  div.innerHTML = `
    <div class="category-fields">
      <input type="text" class="search-input cat-id" placeholder="ID (ex: blog-construction)" style="flex:1;min-width:120px">
      <input type="text" class="search-input cat-label" placeholder="Nom" style="flex:1;min-width:100px">
      <input type="text" class="search-input cat-icon" placeholder="Icône" style="width:50px">
      <input type="text" class="search-input cat-color" placeholder="Couleur" style="flex:1;min-width:80px">
      <input type="text" class="search-input cat-svg" placeholder="SVG" style="width:60px">
    </div>
    <div class="cat-img-upload">
      <input type="hidden" class="cat-image" value="">
      <input type="file" class="cat-image-file" accept="image/*" style="display:none" data-index="${i}">
      <button class="btn-icon" onclick="catUploadClick(${i})" title="Upload image">📷</button>
      <span class="cat-image-status" style="font-size:0.7rem;color:var(--gray-500)"></span>
    </div>
    <button class="btn-icon danger" onclick="removeCategoryRow(this)" title="Supprimer">✕</button>
  `;
  list.appendChild(div);
}

export function removeCategoryRow(btn) {
  btn.closest('.category-row').remove();
}

export async function catUploadClick(index) {
  const row = document.querySelectorAll('#categoryManagerList .category-row')[index];
  if (!row) return;
  const fileInput = row.querySelector('.cat-image-file');
  const statusEl = row.querySelector('.cat-image-status');
  if (!fileInput) return;
  fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { statusEl.textContent = 'Max 10MB'; return; }
    statusEl.textContent = 'Upload…';
    const fd = new FormData();
    fd.append('section', 'blog');
    fd.append('image', file);
    try {
      const res = await fetch(`${API_IMAGES_BASE}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec');
      row.querySelector('.cat-image').value = data.url;
      statusEl.textContent = '✓';
      // Add preview or remove existing
      const existingImg = row.querySelector('.cat-img-preview');
      if (existingImg) {
        existingImg.src = data.url;
      } else {
        const preview = document.createElement('img');
        preview.className = 'cat-img-preview';
        preview.src = data.url;
        preview.alt = '';
        row.querySelector('.cat-img-upload').insertBefore(preview, fileInput);
      }
    } catch (err) {
      statusEl.textContent = '✗ ' + err.message;
    }
  };
}

export function catRemoveImage(index) {
  const row = document.querySelectorAll('#categoryManagerList .category-row')[index];
  if (!row) return;
  row.querySelector('.cat-image').value = '';
  const preview = row.querySelector('.cat-img-preview');
  if (preview) preview.remove();
  // Remove the X button too
  const btns = row.querySelectorAll('.cat-img-upload .btn-icon.danger');
  btns.forEach(b => b.remove());
  const status = row.querySelector('.cat-image-status');
  if (status) status.textContent = '';
}

export async function saveCategoryManager() {
  const rows = document.querySelectorAll('#categoryManagerList .category-row');
  const categories = [];
  for (const row of rows) {
    const id = row.querySelector('.cat-id')?.value?.trim();
    const label = row.querySelector('.cat-label')?.value?.trim();
    if (!id || !label) continue;
    categories.push({
      id,
      label,
      icon: row.querySelector('.cat-icon')?.value?.trim() || '',
      color: row.querySelector('.cat-color')?.value?.trim() || '',
      svg: row.querySelector('.cat-svg')?.value?.trim() || '',
      image: row.querySelector('.cat-image')?.value?.trim() || ''
    });
  }
  if (categories.length === 0) {
    showToast('Ajoutez au moins une catégorie', 'error');
    return;
  }
  const ok = await saveBlogCategories(categories);
  if (ok) closeCategoryManager();
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}
