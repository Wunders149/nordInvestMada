import { API_BASE, getHeaders, clearToken, markDirty, markClean } from './api.js';
import { showToast } from './ui.js';
import { escapeHtml } from './helpers.js';

const SECTIONS_CONFIG = {
  hero: {
    label: 'Hero',
    icon: '🏠',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'subtitle', label: 'Sous-titre', type: 'textarea' },
      { key: 'badge', label: 'Badge', type: 'text' }
    ]
  },
  about: {
    label: 'À Propos',
    icon: 'ℹ️',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' }
    ]
  },
  standards: {
    label: 'Normes & Sécurité',
    icon: '🛡️',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' }
    ]
  },
  values: {
    label: 'Valeurs',
    icon: '⭐',
    fields: [
      { key: 'title1', label: 'Titre valeur 1', type: 'text' },
      { key: 'desc1', label: 'Description valeur 1', type: 'textarea' },
      { key: 'title2', label: 'Titre valeur 2', type: 'text' },
      { key: 'desc2', label: 'Description valeur 2', type: 'textarea' },
      { key: 'title3', label: 'Titre valeur 3', type: 'text' },
      { key: 'desc3', label: 'Description valeur 3', type: 'textarea' }
    ]
  },
  team: {
    label: 'Équipe',
    icon: '👥',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' }
    ]
  },
  services: {
    label: 'Services',
    icon: '🔧',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' }
    ]
  },
  pricing: {
    label: 'Tarifs',
    icon: '💰',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' },
      { key: 'note', label: 'Note en bas de page (HTML autorisé)', type: 'textarea' }
    ]
  },
  calculator: {
    label: 'Simulateur',
    icon: '📊',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' }
    ]
  },
  projects: {
    label: 'Réalisations',
    icon: '🏗️',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' }
    ]
  },
  dossiers: {
    label: 'Vente de Terrains',
    icon: '📁',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' }
    ]
  },
  blog: {
    label: 'Blog',
    icon: '📝',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' }
    ]
  },
  contact: {
    label: 'Contact',
    icon: '✉️',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' }
    ]
  },
  numbers: {
    label: 'Chiffres',
    icon: '🔢',
    fields: [
      { key: 'exp', label: 'Étiquette années d\'expérience', type: 'text' },
      { key: 'tech', label: 'Étiquette techniciens', type: 'text' },
      { key: 'engineers', label: 'Étiquette ingénieurs', type: 'text' },
      { key: 'sites', label: 'Étiquette sites', type: 'text' }
    ]
  }
};

let sectionsData = {};
let isSaving = false;

export async function loadSectionsEditor() {
  const container = document.getElementById('sectionsEditor');
  if (!container) return;

  container.innerHTML = '<div class="loading-spinner" style="margin:2rem auto"></div>';

  try {
    const res = await fetch(`${API_BASE}/sections`, { headers: getHeaders() });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    if (!res.ok) throw new Error('Failed to load sections');
    sectionsData = await res.json();
    renderSectionsEditor(container);
  } catch (err) {
    console.error('Sections editor load error:', err);
    showToast('Erreur lors du chargement du contenu des sections', 'error');
    container.innerHTML = '<p class="empty-row">Erreur de chargement</p>';
  }
}

function renderSectionsEditor(container) {
  const entries = Object.entries(SECTIONS_CONFIG);

  let html = `
    <div class="sections-toolbar">
      <p class="sections-info">Modifiez les textes d'en-tête et de présentation de chaque section. Les champs sont pré-remplis avec le contenu actuel du site. <strong>Les champs laissés vides utiliseront le texte par défaut du site.</strong></p>
      <button class="btn-primary" id="saveAllSectionsBtn" onclick="window.saveAllSections()">
        💾 Enregistrer toutes les sections
      </button>
    </div>
    <div class="sections-accordion">`;

  for (const [sectionKey, config] of entries) {
    const data = sectionsData[sectionKey] || {};
    const isFirst = entries[0][0] === sectionKey;
    html += `
      <div class="section-accordion-item ${isFirst ? 'open' : ''}">
        <div class="section-accordion-header" onclick="toggleSectionAccordion(this)">
          <span class="section-accordion-icon">${config.icon}</span>
          <span class="section-accordion-title">${config.label}</span>
          <span class="section-accordion-arrow">▼</span>
        </div>
        <div class="section-accordion-body" ${isFirst ? 'style="display:block"' : ''}>
          <div class="section-accordion-fields">`;

    for (const field of config.fields) {
      const val = data[field.key] !== undefined ? data[field.key] : '';
      const fieldId = `section_${sectionKey}_${field.key}`;
      if (field.type === 'textarea') {
        html += `
              <div class="section-field">
                <label for="${fieldId}">${field.label}</label>
                <textarea id="${fieldId}" class="section-textarea" rows="3" data-section="${sectionKey}" data-field="${field.key}">${escapeHtml(String(val))}</textarea>
              </div>`;
      } else {
        html += `
              <div class="section-field">
                <label for="${fieldId}">${field.label}</label>
                <input type="text" id="${fieldId}" class="section-input" value="${escapeHtml(String(val))}" data-section="${sectionKey}" data-field="${field.key}">
              </div>`;
      }
    }

    html += `
          </div>
        </div>
      </div>`;
  }

  html += `
    </div>
    <div class="sections-footer">
      <button class="btn-primary" id="saveAllSectionsBtn2" onclick="window.saveAllSections()">
        💾 Enregistrer toutes les sections
      </button>
    </div>`;

  container.innerHTML = html;
}

export async function saveAllSections() {
  if (isSaving) return;
  isSaving = true;

  const saveBtn = document.getElementById('saveAllSectionsBtn');
  const saveBtn2 = document.getElementById('saveAllSectionsBtn2');
  const setSaving = (saving) => {
    const btns = [saveBtn, saveBtn2].filter(Boolean);
    btns.forEach(b => {
      if (b) {
        b.disabled = saving;
        b.innerHTML = saving ? '<span class="btn-loader"></span> Enregistrement...' : '💾 Enregistrer toutes les sections';
      }
    });
  };

  setSaving(true);

  const data = {};
  document.querySelectorAll('[data-section][data-field]').forEach(el => {
    const section = el.dataset.section;
    const field = el.dataset.field;
    if (!data[section]) data[section] = {};
    data[section][field] = el.value;
  });

  try {
    const res = await fetch(`${API_BASE}/sections`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    if (!res.ok) throw new Error('Save failed');
    sectionsData = data;
    markClean();
    showToast('Contenu des sections enregistré avec succès', 'success');
  } catch (err) {
    console.error('Sections save error:', err);
    showToast('Erreur lors de l\'enregistrement', 'error');
  } finally {
    setSaving(false);
    isSaving = false;
  }
}

window.toggleSectionAccordion = function(header) {
  const item = header.closest('.section-accordion-item');
  if (!item) return;
  const body = item.querySelector('.section-accordion-body');
  const isOpen = item.classList.contains('open');
  if (isOpen) {
    item.classList.remove('open');
    body.style.display = 'none';
  } else {
    item.classList.add('open');
    body.style.display = 'block';
  }
};

window.saveAllSections = saveAllSections;
