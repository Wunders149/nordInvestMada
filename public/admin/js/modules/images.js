import { getHeaders, token, slots, images, clearToken } from './api.js';
import { escapeHtml, humanSize } from './helpers.js';
import { showToast, showConfirm, showSkeletonGrid, emptyStateGrid, openLightbox } from './ui.js';

export async function loadSlots() {
  try {
    const res = await fetch('/api/images/slots');
    slots.length = 0;
    const data = await res.json();
    slots.push(...data);
    populateSlotSelect();
    renderImages();
  } catch (err) { console.error('Slots error:', err); }
}

function populateSlotSelect() {
  const sel = document.getElementById('uploadSlot');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Aucun —</option>';
  const section = document.getElementById('uploadSection').value;
  slots.filter(s => s.section === section).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label + (s.uploadedFile ? ' ✓' : '');
    sel.appendChild(opt);
  });
}

export async function loadImages() {
  showSkeletonGrid('imageGrid', 6);
  try {
    const res = await fetch('/api/images', { headers: getHeaders() });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    Object.keys(images).forEach(k => delete images[k]);
    Object.assign(images, data);
    renderImages();
  } catch (err) { console.error('Images error:', err); }
}

export function renderImages() {
  const grid = document.getElementById('imageGrid');
  if (!grid) return;
  const filter = document.getElementById('filterSection').value;
  const allFiles = [];
  Object.keys(images).forEach(section => {
    if (filter !== 'all' && section !== filter) return;
    (images[section] || []).forEach(f => allFiles.push({ ...f, section }));
  });
  if (allFiles.length === 0) {
    grid.innerHTML = emptyStateGrid('🖼', 'Aucune image', 'Uploader des images via le formulaire ci-dessus.');
    return;
  }
  grid.innerHTML = allFiles.map(f => {
    const imgSrc = f.cloudinaryUrl || `/${f.path}`;
    const lightboxUrl = f.cloudinaryUrl || `/${f.path}`;
    const slotInfo = slots.find(s => s.id === f.slotId);
    const sectionSlots = slots.filter(s => s.section === f.section);
    return `
      <div class="image-card">
        ${slotInfo ? `<span class="slot-badge">${escapeHtml(slotInfo.label)}</span>` : ''}
        <div class="img-wrap" onclick="openLightbox('${escapeHtml(lightboxUrl)}')">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(f.name)}" loading="lazy">
        </div>
        <div class="img-info">
          <span class="img-name">${escapeHtml(f.name)}</span>
          <span class="img-meta">${humanSize(f.size)} · ${f.type}</span>
        </div>
        <div class="img-actions">
          <select class="slot-select" onchange="assignSlot('${escapeHtml(f.section)}', '${escapeHtml(f.name)}', this.value)">
            <option value="">Assigner...</option>
            ${sectionSlots.map(s => `<option value="${s.id}" ${s.id === f.slotId ? 'selected' : ''}>${escapeHtml(s.label)}${s.id === f.slotId ? ' ✓' : ''}</option>`).join('')}
          </select>
          <button class="btn-icon info" onclick="openImageEditor('${escapeHtml(f.section)}', '${escapeHtml(f.name)}')" title="Modifier">✏</button>
          <button class="btn-icon danger" onclick="confirmDeleteImage('${escapeHtml(f.section)}', '${escapeHtml(f.name)}')" title="Supprimer">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

export async function assignSlot(section, filename, slotId) {
  if (!slotId) return;
  try {
    const res = await fetch(`/api/images/slots/${slotId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ filename })
    });
    if (!res.ok) throw new Error('Assignment failed');
    loadSlots(); loadImages();
    showToast('Image assignée', 'success');
  } catch (err) { console.error('Assign error:', err); }
}

export function confirmDeleteImage(section, filename) {
  showConfirm('Supprimer l\'image', `Supprimer ${filename} ? Cette action est irréversible.`, async () => {
    try {
      const res = await fetch(`/api/images/${encodeURIComponent(section)}/${encodeURIComponent(filename)}`, { method: 'DELETE', headers: getHeaders() });
      if (!res.ok) throw new Error('Delete failed');
      loadImages(); loadSlots();
      showToast('Image supprimée', 'success');
    } catch (err) { console.error('Delete error:', err); }
  });
}

function getExt(p) { const i = p.lastIndexOf('.'); return i >= 0 ? p.slice(i) : ''; }
function getBase(p) { const i = p.lastIndexOf('.'); return i >= 0 ? p.slice(0, i) : p; }

function updatePreview() {
  const file = document.getElementById('uploadFile')?.files[0];
  const preview = document.getElementById('uploadPreview');
  if (!file) { if (preview) preview.classList.add('hidden'); return; }
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.querySelector('.drop-text').textContent = file.name;
    dropZone.querySelector('.drop-icon').textContent = '\u{1F5BC}';
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Aperçu">`;
      preview.classList.remove('hidden');
    }
  };
  reader.readAsDataURL(file);
}

const imageEditState = { section: '', filename: '' };

export function openImageEditor(section, filename) {
  imageEditState.section = section;
  imageEditState.filename = filename;
  const nameWithoutExt = getBase(filename);

  const currentSlot = slots.find(s => s.section === section && s.id === (images[section]?.find(f => f.name === filename)?.slotId || ''));
  const imgSrc = currentSlot?.cloudinaryUrl || `/images/${section}/${filename}`;

  document.getElementById('imageEditTitle').textContent = `Modifier : ${filename}`;
  document.getElementById('imageEditPreview').src = imgSrc;
  document.getElementById('imageEditName').value = nameWithoutExt;
  document.getElementById('imageEditExt').textContent = getExt(filename);
  document.getElementById('imageEditSection').value = section;
  document.getElementById('imageEditError').classList.add('hidden');
  document.getElementById('imageEditReplaceStatus').textContent = '';
  document.getElementById('imageEditFile').value = '';

  const slotSelect = document.getElementById('imageEditSlot');
  slotSelect.innerHTML = '<option value="">— Aucun —</option>';
  const sectionSlots = slots.filter(s => s.section === section);
  sectionSlots.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label + (s.id === currentSlot?.id ? ' (actuel)' : s.uploadedFile ? ' ✓' : '');
    if (currentSlot && currentSlot.id === s.id) opt.selected = true;
    slotSelect.appendChild(opt);
  });

  document.getElementById('imageEditModal').classList.add('open');
}

export function closeImageEditor() {
  document.getElementById('imageEditModal').classList.remove('open');
}

export async function saveImageEdit() {
  const btn = document.getElementById('imageEditSave');
  const errorEl = document.getElementById('imageEditError');
  btn.disabled = true;
  btn.textContent = '⏳ Enregistrement...';
  errorEl.classList.add('hidden');

  try {
    const { section, filename } = imageEditState;
    const newName = document.getElementById('imageEditName').value.trim();
    const newSlotId = document.getElementById('imageEditSlot').value;
    const replaceFile = document.getElementById('imageEditFile').files[0];

    if (newName && newName !== getBase(filename)) {
      const renameRes = await fetch(`/api/images/${encodeURIComponent(section)}/${encodeURIComponent(filename)}/rename`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ newName: newName + getExt(filename) })
      });
      const renameData = await renameRes.json();
      if (!renameRes.ok) throw new Error(renameData.error || 'Échec du renommage');
      imageEditState.filename = renameData.file.name;
    }

    if (replaceFile) {
      const currentName = imageEditState.filename;
      const fd = new FormData();
      fd.append('image', replaceFile);
      const replaceRes = await fetch(`/api/images/${encodeURIComponent(section)}/${encodeURIComponent(currentName)}/replace`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      const replaceData = await replaceRes.json();
      if (!replaceRes.ok) throw new Error(replaceData.error || 'Échec du remplacement');
      imageEditState.filename = replaceData.file.name;
    }

    if (newSlotId) {
      const currentSlot = slots.find(s => s.id === newSlotId);
      if (currentSlot && currentSlot.uploadedFile !== imageEditState.filename) {
        await assignSlot(section, imageEditState.filename, newSlotId);
      }
    } else {
      const currentAssigned = slots.find(s => s.section === section && s.uploadedFile === imageEditState.filename);
      if (currentAssigned) {
        await fetch(`/api/images/slots/${currentAssigned.id}`, {
          method: 'PUT', headers: getHeaders(), body: JSON.stringify({ filename: null })
        });
      }
    }

    showToast('Image modifiée avec succès', 'success');
    closeImageEditor();
    loadSlots();
    loadImages();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Enregistrer';
  }
}

// ─── Gallery: section change → populate slot select ───
document.getElementById('uploadSection')?.addEventListener('change', populateSlotSelect);

// ─── Drop zone + file input ───
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('uploadFile');
if (dropZone) {
  dropZone.addEventListener('click', () => fileInput?.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updatePreview();
    }
  });
}
if (fileInput) fileInput.addEventListener('change', updatePreview);

// ─── Upload form submit ───
document.getElementById('imageUploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('uploadBtn');
  const errorEl = document.getElementById('uploadError');
  const file = document.getElementById('uploadFile')?.files[0];
  if (!file) { showToast('Sélectionnez un fichier', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('Fichier trop volumineux (max 10MB)', 'error'); return; }

  if (btn) { btn.querySelector('.btn-text').textContent = 'Upload en cours...'; btn.querySelector('.btn-loader')?.classList.remove('hidden'); btn.disabled = true; }
  if (errorEl) errorEl.classList.add('hidden');

  try {
    const fd = new FormData();
    fd.append('section', document.getElementById('uploadSection').value);
    fd.append('slotId', document.getElementById('uploadSlot').value);
    fd.append('newSlotLabel', document.getElementById('newSlotLabel').value.trim());
    fd.append('image', file);

    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload échoué');

    document.getElementById('imageUploadForm').reset();
    document.getElementById('newSlotLabel').value = '';
    const preview = document.getElementById('uploadPreview');
    if (preview) { preview.innerHTML = ''; preview.classList.add('hidden'); }
    const dz = document.getElementById('dropZone');
    if (dz) { dz.querySelector('.drop-text').textContent = 'Cliquez ou glissez-déposez une image ici'; dz.querySelector('.drop-icon').textContent = '\uD83D\uDCC1'; }
    if (btn) btn.querySelector('.btn-text').textContent = 'Uploader';
    showToast('Image uploadée avec succès', 'success');
    loadImages();
    loadSlots();
  } catch (err) {
    if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
    if (btn) btn.querySelector('.btn-text').textContent = 'Uploader';
    showToast(err.message, 'error');
  } finally {
    if (btn) { btn.querySelector('.btn-loader')?.classList.add('hidden'); btn.disabled = false; }
  }
});

// ─── Filter section change → re-render ───
document.getElementById('filterSection')?.addEventListener('change', renderImages);

// ─── Image editor modal ───
document.getElementById('imageEditClose')?.addEventListener('click', closeImageEditor);
document.getElementById('imageEditCloseBtn')?.addEventListener('click', closeImageEditor);
document.getElementById('imageEditModal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeImageEditor();
});
document.getElementById('imageEditSave')?.addEventListener('click', saveImageEdit);

// ─── New slot ───
document.getElementById('newSlotBtn')?.addEventListener('click', () => {
  document.getElementById('newSlotForm')?.classList.toggle('hidden');
});
document.getElementById('newSlotCancel')?.addEventListener('click', () => {
  document.getElementById('newSlotForm')?.classList.add('hidden');
});
document.getElementById('newSlotSubmit')?.addEventListener('click', async () => {
  const section = document.getElementById('newSlotSection').value;
  const label = document.getElementById('newSlotLabelInput').value.trim();
  if (!label) { showToast('Veuillez entrer un libellé', 'error'); return; }
  try {
    const res = await fetch('/api/images/slots', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ section, label })
    });
    if (!res.ok) throw new Error('Échec création');
    document.getElementById('newSlotLabelInput').value = '';
    document.getElementById('newSlotForm').classList.add('hidden');
    showToast('Slot créé', 'success');
    loadSlots();
    loadImages();
  } catch (err) {
    showToast(err.message, 'error');
  }
});
