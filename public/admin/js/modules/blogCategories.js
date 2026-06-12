import { API_BASE, getHeaders } from './api.js';
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
        <input type="text" class="search-input cat-icon" value="${escapeHtml(cat.icon || '')}" placeholder="Icône" style="width:60px">
        <input type="text" class="search-input cat-color" value="${escapeHtml(cat.color || '')}" placeholder="Couleur CSS" style="flex:1;min-width:100px">
        <input type="text" class="search-input cat-svg" value="${escapeHtml(cat.svg || '')}" placeholder="SVG" style="flex:1;min-width:80px">
      </div>
      <button class="btn-icon danger" onclick="removeCategoryRow(this)" title="Supprimer">✕</button>
    </div>
  `).join('');

  modal.classList.add('open');
}

export function closeCategoryManager() {
  document.getElementById('categoryManagerModal')?.classList.remove('open');
}

export function addCategoryRow() {
  const list = document.getElementById('categoryManagerList');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'category-row';
  div.innerHTML = `
    <div class="category-fields">
      <input type="text" class="search-input cat-id" placeholder="ID (ex: blog-construction)" style="flex:1;min-width:120px">
      <input type="text" class="search-input cat-label" placeholder="Nom" style="flex:1;min-width:100px">
      <input type="text" class="search-input cat-icon" placeholder="Icône" style="width:60px">
      <input type="text" class="search-input cat-color" placeholder="Couleur CSS" style="flex:1;min-width:100px">
      <input type="text" class="search-input cat-svg" placeholder="SVG" style="flex:1;min-width:80px">
    </div>
    <button class="btn-icon danger" onclick="removeCategoryRow(this)" title="Supprimer">✕</button>
  `;
  list.appendChild(div);
}

export function removeCategoryRow(btn) {
  btn.closest('.category-row').remove();
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
      svg: row.querySelector('.cat-svg')?.value?.trim() || ''
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
