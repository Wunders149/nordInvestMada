import { API_BASE, API_IMAGES_BASE, getHeaders, clearToken, markClean, token } from './api.js';
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
      { key: 'badge', label: 'Badge (label)', type: 'text' },
      { key: 'badgeYear', label: 'Badge (année)', type: 'text' },
      { key: 'stat1Label', label: 'Statistique 1 — Label', type: 'text' },
      { key: 'stat2Label', label: 'Statistique 2 — Label', type: 'text' },
      { key: 'stat3Label', label: 'Statistique 3 — Label', type: 'text' },
      { key: 'stat4Label', label: 'Statistique 4 — Label', type: 'text' },
      { key: 'btnPricing', label: 'Bouton — Voir les tarifs', type: 'text' },
      { key: 'btnContact', label: 'Bouton — Demander un devis', type: 'text' }
    ]
  },
  about: {
    label: 'À Propos',
    icon: 'ℹ️',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' },
      { key: 'feat1Title', label: 'Fonctionnalité 1 — Titre', type: 'text' },
      { key: 'feat1Desc', label: 'Fonctionnalité 1 — Description', type: 'textarea' },
      { key: 'feat2Title', label: 'Fonctionnalité 2 — Titre', type: 'text' },
      { key: 'feat2Desc', label: 'Fonctionnalité 2 — Description', type: 'textarea' },
      { key: 'feat3Title', label: 'Fonctionnalité 3 — Titre', type: 'text' },
      { key: 'feat3Desc', label: 'Fonctionnalité 3 — Description', type: 'textarea' }
    ]
  },
  standards: {
    label: 'Normes & Sécurité',
    icon: '🛡️',
    fields: [
      { key: 'tag', label: 'Tag', type: 'text' },
      { key: 'title', label: 'Titre (HTML autorisé)', type: 'textarea' },
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' },
      { key: 'item1Title', label: 'Item 1 — Titre', type: 'text' },
      { key: 'item1Desc', label: 'Item 1 — Description', type: 'textarea' },
      { key: 'item2Title', label: 'Item 2 — Titre', type: 'text' },
      { key: 'item2Desc', label: 'Item 2 — Description', type: 'textarea' },
      { key: 'item2Badge', label: 'Item 2 — Badge', type: 'text' },
      { key: 'item3Title', label: 'Item 3 — Titre', type: 'text' },
      { key: 'item3Desc', label: 'Item 3 — Description', type: 'textarea' },
      { key: 'item4Title', label: 'Item 4 — Titre', type: 'text' },
      { key: 'item4Desc', label: 'Item 4 — Description', type: 'textarea' }
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
      { key: 'tab1', label: 'Onglet 1', type: 'text' },
      { key: 'tab2', label: 'Onglet 2', type: 'text' },
      { key: 'tab3', label: 'Onglet 3', type: 'text' },
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
      { key: 'lead', label: 'Texte d\'introduction', type: 'textarea' },
      { key: 'phone', label: 'Téléphone', type: 'text' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'address', label: 'Adresse (HTML autorisé)', type: 'textarea' },
      { key: 'office', label: 'Antenne', type: 'text' },
      { key: 'mapTitle', label: 'Titre — Carte bureaux', type: 'text' },
      { key: 'mapProjectsTitle', label: 'Titre — Carte projets', type: 'text' }
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
  },
  visionMission: {
    label: 'Vision & Mission',
    icon: '👁️',
    fields: [
      { key: 'visionTitle', label: 'Vision — Titre', type: 'text' },
      { key: 'visionText', label: 'Vision — Texte', type: 'textarea' },
      { key: 'missionTitle', label: 'Mission — Titre', type: 'text' },
      { key: 'missionText', label: 'Mission — Texte', type: 'textarea' }
    ]
  },
  newsletter: {
    label: 'Newsletter',
    icon: '📧',
    fields: [
      { key: 'title', label: 'Titre', type: 'text' },
      { key: 'desc', label: 'Description', type: 'textarea' },
      { key: 'btn', label: 'Bouton', type: 'text' }
    ]
  }
};

let sectionsData = {};
let isSaving = false;
let allSlots = [];
let currentSectionLang = 'fr';
let sectionLoadSeq = 0;
const SUPPORTED_LANGS = [
  { code: 'fr', label: '🇫🇷 Français' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'mg', label: '🇲🇬 Malagasy' }
];

async function loadImageSlots() {
  try {
    const res = await fetch(`${API_IMAGES_BASE}/images/slots`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

async function loadSectionsForLang(lang) {
  const loadId = ++sectionLoadSeq;
  currentSectionLang = lang;
  const container = document.getElementById('sectionsEditor');
  if (!container) return;

  container.innerHTML = '<div class="loading-spinner" style="margin:2rem auto"></div>';

  try {
    const [sectionsRes, slots] = await Promise.all([
      fetch(`${API_BASE}/sections?lang=${lang}`, { headers: getHeaders() }),
      loadImageSlots()
    ]);
    if (loadId !== sectionLoadSeq) return;
    if (sectionsRes.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    if (!sectionsRes.ok) throw new Error('Failed to load sections');
    sectionsData = await sectionsRes.json();
    console.log(`[sections] loaded lang=${lang}:`, JSON.stringify(sectionsData.visionMission));
    allSlots = slots;
    renderSectionsEditor(container);
  } catch (err) {
    if (loadId !== sectionLoadSeq) return;
    console.error('Sections editor load error:', err);
    showToast('Erreur lors du chargement', 'error');
    container.innerHTML = '<p class="empty-row">Erreur de chargement</p>';
  }
}

export async function loadSectionsEditor() {
  await loadSectionsForLang('fr');
}

window.switchSectionLang = async function(lang) {
  document.querySelectorAll('.section-lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
  await loadSectionsForLang(lang);
};

function renderSectionsEditor(container) {
  const entries = Object.entries(SECTIONS_CONFIG);

  const langTabs = SUPPORTED_LANGS.map(l =>
    `<button class="section-lang-btn${l.code === currentSectionLang ? ' active' : ''}" data-lang="${l.code}" onclick="window.switchSectionLang('${l.code}')">${l.label}</button>`
  ).join('');

  let html = `
    <div class="section-lang-tabs">${langTabs}</div>
    <div class="sections-toolbar">
      <p class="sections-info">Modifiez les textes d'en-tête et de présentation de chaque section. Les champs sont pré-remplis avec le contenu actuel du site. <strong>Les champs laissés vides utiliseront le texte par défaut du site.</strong></p>
      <button class="btn-primary" id="saveAllSectionsBtn" onclick="window.saveAllSections()">
        💾 Enregistrer toutes les sections (${currentSectionLang.toUpperCase()})
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
      const val = data[field.key] != null ? data[field.key] : '';
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

    const sectionSlots = allSlots.filter(s => s.section === sectionKey);
    if (sectionSlots.length > 0) {
      html += `</div>
          <div class="section-image-slots">
            <div class="section-image-slots-header">
              <span class="section-image-slots-title">🖼 Images de la section</span>
              <button class="btn-icon" onclick="window.createSectionSlot('${sectionKey}')" title="Nouveau slot">＋</button>
            </div>
            <div class="section-slots-grid">`;
      for (const slot of sectionSlots) {
        const hasImage = !!(slot.uploadedFile || slot.cloudinaryUrl);
        const thumbUrl = slot.currentUrl || '';
        html += `
              <div class="section-slot-card">
                <div class="section-slot-thumb"${thumbUrl ? ` style="background-image:url('${escapeHtml(thumbUrl)}')"` : ''}>
                  ${!hasImage ? '<div class="section-slot-placeholder">📷</div>' : ''}
                  <div class="section-slot-status ${hasImage ? 'assigned' : ''}"></div>
                </div>
                <div class="section-slot-info">
                  <span class="section-slot-label">${escapeHtml(slot.label)}</span>
                  <span class="section-slot-meta">${hasImage ? 'Assigné' : 'Vide'}</span>
                </div>
                <div class="section-slot-actions">
                  <button class="btn-icon btn-icon-sm" onclick="window.uploadToSectionSlot('${slot.id}')" title="${hasImage ? 'Remplacer' : 'Uploader'}">⬆</button>
                  <button class="btn-icon btn-icon-sm danger" onclick="window.deleteSectionSlot('${slot.id}')" title="Supprimer">✕</button>
                </div>
              </div>`;
      }
      html += `</div></div>
        </div>
      </div>`;
    } else {
      html += `</div>
          <div class="section-image-slots section-image-slots-empty">
            <p class="section-slots-empty-text">Aucun slot image. Les images de cette section sont gérées via l'onglet <a href="#" onclick="window.parent.switchTab('images'); return false">Galerie</a>.</p>
            <button class="btn-secondary btn-sm" onclick="window.createSectionSlot('${sectionKey}')">＋ Créer un slot</button>
          </div>
        </div>
      </div>`;
    }
  }

  html += `
    </div>
    <div class="sections-footer">
      <button class="btn-primary" id="saveAllSectionsBtn2" onclick="window.saveAllSections()">
        💾 Enregistrer toutes les sections (${currentSectionLang.toUpperCase()})
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
      body: JSON.stringify({ ...data, lang: currentSectionLang })
    });
    if (res.status === 401) { clearToken(); window.location.href = '/admin/login.html'; return; }
    if (!res.ok) throw new Error('Save failed');
    sectionsData = data;
    markClean();
    showToast(`Contenu des sections (${currentSectionLang.toUpperCase()}) enregistré avec succès`, 'success');
  } catch (err) {
    console.error('Sections save error:', err);
    showToast('Erreur lors de l\'enregistrement', 'error');
  } finally {
    setSaving(false);
    isSaving = false;
  }
}

// ─── Image slot actions ───
window.uploadToSectionSlot = async function(slotId) {
  const slot = allSlots.find(s => s.id === slotId);
  if (!slot) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('section', slot.section);
    fd.append('slotId', slotId);
    fd.append('image', file);
    try {
      const res = await fetch(`${API_IMAGES_BASE}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Upload failed'); }
      showToast('Image uploadée avec succès', 'success');
      loadSectionsForLang(currentSectionLang);
    } catch (err) {
      showToast('Erreur: ' + err.message, 'error');
    }
  };
  input.click();
};

window.createSectionSlot = async function(section) {
  const label = prompt('Nom du nouveau slot image pour cette section :');
  if (!label || !label.trim()) return;
  try {
    const res = await fetch(`${API_IMAGES_BASE}/images/slots`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ section, label: label.trim() })
    });
    if (!res.ok) throw new Error('Échec création');
    showToast('Slot créé', 'success');
    loadSectionsForLang(currentSectionLang);
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.deleteSectionSlot = async function(slotId) {
  if (!confirm('Supprimer ce slot image ? Les images associées ne seront pas supprimées.')) return;
  try {
    const res = await fetch(`${API_IMAGES_BASE}/images/slots/${slotId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ filename: null })
    });
    if (!res.ok) throw new Error('Échec');
    showToast('Slot vidé', 'success');
    loadSectionsForLang(currentSectionLang);
  } catch (err) {
    showToast(err.message, 'error');
  }
};

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
