import { API_BASE, getHeaders, markDirty, markClean } from './api.js';
import { escapeHtml } from './helpers.js';
import { showToast } from './ui.js';

let pricingData = null;

export async function loadPricingEditor() {
  try {
    const res = await fetch(`${API_BASE}/pricing`, { headers: getHeaders() });
    if (res.status === 401) return;
    pricingData = await res.json();
    renderPricingEditor();
  } catch (err) { console.error('Pricing error:', err); }
}

function renderPricingEditor() {
  const container = document.getElementById('pricingEditor');
  if (!pricingData) { container.innerHTML = '<p class="empty-row">Chargement...</p>'; return; }

  let html = '<div class="pricing-editor">';

  ['construction', 'rehabilitation', 'forage'].forEach(cat => {
    const tiers = pricingData[cat] || {};
    const catLabels = { construction: 'Construction Neuve', rehabilitation: 'Études et Conception', forage: 'Forage d\'Eau' };
    html += `<div class="pricing-cat"><h4>${catLabels[cat]}</h4>`;
    const tierKeys = Object.keys(tiers);
    tierKeys.forEach((tier, ti) => {
      const t = tiers[tier];
      html += `<div class="pricing-tier" data-cat="${cat}" data-tier="${tier}">
        <div class="pricing-tier-header">
          <input class="search-input pricing-name" value="${escapeHtml(t.name || '')}" data-cat="${cat}" data-tier="${tier}" data-field="name" placeholder="Nom" oninput="markDirty()">
          <input class="search-input pricing-price" type="number" value="${t.pricePerM2 || t.pricePerML || t.price || ''}" data-cat="${cat}" data-tier="${tier}" data-field="price" placeholder="Prix" oninput="markDirty()">
          <input class="search-input pricing-unit" value="${t.unit || 'm²'}" data-cat="${cat}" data-tier="${tier}" data-field="unit" placeholder="Unité" oninput="markDirty()">
          ${tierKeys.length > 1 ? `<button class="btn-ghost pricing-delete-tier" type="button" onclick="deletePricingTier('${cat}','${tier}')" title="Supprimer ce palier">&times;</button>` : ''}
        </div>
        <div class="pricing-tier-features">
          ${(t.features || []).map((f, fi) => `<input class="search-input pricing-feature" value="${escapeHtml(f)}" data-cat="${cat}" data-tier="${tier}" data-field="feature_${fi}" placeholder="Option ${fi + 1}" oninput="markDirty()">`).join('')}
          <button class="btn-ghost" style="font-size:0.7rem;padding:0.25rem" onclick="addPricingFeature('${cat}','${tier}')">+ Ajouter option</button>
        </div>
      </div>`;
    });
    html += `<button class="btn-ghost pricing-add-tier" onclick="addPricingTier('${cat}')">+ Ajouter un palier</button>`;
    html += '</div>';
  });

  html += `<div class="pricing-cat"><h4>Taux</h4>
    <div class="pricing-tier" style="display:flex;gap:1rem;flex-wrap:wrap">
      <label style="font-size:0.8125rem">Marge sécurité (%): <input class="search-input pricing-rate" type="number" id="pricingContingency" value="${(pricingData.contingency_rate || 0.1) * 100}" oninput="markDirty()"></label>
      <label style="font-size:0.8125rem">TVA (%): <input class="search-input pricing-rate" type="number" id="pricingTax" value="${(pricingData.tax_rate || 0.2) * 100}" oninput="markDirty()"></label>
    </div>
  </div>`;

  html += '</div>';
  container.innerHTML = html;
}

export function deletePricingTier(cat, tier) {
  const els = document.querySelectorAll(`[data-cat="${cat}"][data-tier="${tier}"]`);
  const tierEl = els[0]?.closest('.pricing-tier');
  if (tierEl) tierEl.remove();
  markDirty();
}

export function addPricingTier(cat) {
  const catEl = document.querySelector(`[data-cat="${cat}"]`)?.closest('.pricing-cat');
  const addBtn = catEl?.querySelector('.pricing-add-tier');
  const existing = catEl?.querySelectorAll('.pricing-tier') || [];
  const newTier = `tier_${existing.length}`;
  const div = document.createElement('div');
  div.className = 'pricing-tier';
  div.dataset.cat = cat;
  div.dataset.tier = newTier;
  div.innerHTML = `<div class="pricing-tier-header">
    <input class="search-input pricing-name" value="" data-cat="${cat}" data-tier="${newTier}" data-field="name" placeholder="Nom" oninput="markDirty()">
    <input class="search-input pricing-price" type="number" value="" data-cat="${cat}" data-tier="${newTier}" data-field="price" placeholder="Prix" oninput="markDirty()">
    <input class="search-input pricing-unit" value="m²" data-cat="${cat}" data-tier="${newTier}" data-field="unit" placeholder="Unité" oninput="markDirty()">
    <button class="btn-ghost pricing-delete-tier" onclick="deletePricingTier('${cat}','${newTier}')" title="Supprimer ce palier">&times;</button>
  </div>
  <div class="pricing-tier-features">
    <button class="btn-ghost" style="font-size:0.7rem;padding:0.25rem" onclick="addPricingFeature('${cat}','${newTier}')">+ Ajouter option</button>
  </div>`;
  if (addBtn) addBtn.before(div);
  markDirty();
}

export function addPricingFeature(cat, tier) {
  const parent = document.querySelector(`[data-cat="${cat}"][data-tier="${tier}"]`)?.closest('.pricing-tier')?.querySelector('.pricing-tier-features');
  if (!parent) { showToast('Sélectionnez d\'abord un tier', 'error'); return; }
  const inputs = parent.querySelectorAll('[data-field^="feature_"]');
  const idx = inputs.length;
  const input = document.createElement('input');
  input.className = 'search-input pricing-feature';
  input.placeholder = `Option ${idx + 1}`;
  input.dataset.cat = cat;
  input.dataset.tier = tier;
  input.dataset.field = `feature_${idx}`;
  input.oninput = markDirty;
  parent.insertBefore(input, parent.lastElementChild);
  markDirty();
}

export async function savePricing() {
  const btn = document.getElementById('savePricingBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Enregistrement...'; }
  try {
    const pricing = {};
    ['construction', 'rehabilitation', 'forage'].forEach(cat => {
      pricing[cat] = {};
      document.querySelectorAll(`[data-cat="${cat}"]`).forEach(el => {
        const tier = el.dataset.tier;
        const field = el.dataset.field;
        if (!tier || !field) return;
        if (!pricing[cat][tier]) pricing[cat][tier] = { features: [] };
        if (field === 'name') pricing[cat][tier].name = el.value;
        else if (field === 'price') {
          const val = parseFloat(el.value);
          if (cat === 'forage') {
            if (tier === 'standard') pricing[cat][tier].pricePerML = val;
            else pricing[cat][tier].price = val;
          } else {
            pricing[cat][tier].pricePerM2 = val;
          }
        }
        else if (field === 'unit') pricing[cat][tier].unit = el.value;
        else if (field.startsWith('feature_')) {
          const idx = parseInt(field.replace('feature_', ''));
          pricing[cat][tier].features[idx] = el.value;
        }
      });
      Object.keys(pricing[cat]).forEach(tier => {
        pricing[cat][tier].features = pricing[cat][tier].features.filter(f => f && f.trim());
      });
    });

    const contingency = parseFloat(document.getElementById('pricingContingency')?.value) || 10;
    const tax = parseFloat(document.getElementById('pricingTax')?.value) || 20;

    const payload = {
      ...pricing,
      contingency_rate: contingency / 100,
      tax_rate: tax / 100
    };

    const res = await fetch(`${API_BASE}/pricing`, {
      method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Erreur');
    markClean();
    showToast('Tarifs enregistrés', 'success');
  } catch (err) {
    showToast('Erreur lors de l\'enregistrement: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Enregistrer'; }
  }
}
