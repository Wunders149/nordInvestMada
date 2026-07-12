import { API_BASE, getHeaders, markClean } from './api.js';
import { escapeHtml } from './helpers.js';
import { showToast } from './ui.js';

let settingsData = null;
let contactInfoData = null;

export async function loadSettings() {
  try {
    const [settingsRes, contactRes] = await Promise.all([
      fetch(`${API_BASE}/settings`, { headers: getHeaders() }),
      fetch(`${API_BASE}/contact-info`, { headers: getHeaders() })
    ]);
    if (settingsRes.status === 401) return;
    settingsData = await settingsRes.json();
    contactInfoData = await contactRes.json();
    renderSettingsEditor();
  } catch (err) { console.error('Settings error:', err); }
}

function renderSettingsEditor() {
  const container = document.getElementById('settingsEditor');
  if (!settingsData || !contactInfoData) { container.innerHTML = '<p class="empty-row">Chargement...</p>'; return; }

  container.innerHTML = `
    <div class="settings-grid">
      <div class="settings-section">
        <h4>Coordonnées</h4>
        <div class="form-group">
          <label>Téléphone</label>
          <input class="search-input" id="setPhone" value="${escapeHtml(contactInfoData.contact?.phone || '')}" oninput="markDirty()">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="search-input" id="setEmail" value="${escapeHtml(contactInfoData.contact?.email || '')}" oninput="markDirty()">
        </div>
        <div class="form-group">
          <label>Adresse</label>
          <input class="search-input" id="setAddress" value="${escapeHtml(contactInfoData.contact?.address || '')}" oninput="markDirty()">
        </div>
      </div>
      <div class="settings-section">
        <h4>Réseaux sociaux</h4>
        <div class="form-group">
          <label>Facebook</label>
          <input class="search-input" id="setFacebook" value="${escapeHtml(contactInfoData.social?.facebook || '')}" oninput="markDirty()">
        </div>
        <div class="form-group">
          <label>Instagram</label>
          <input class="search-input" id="setInstagram" value="${escapeHtml(contactInfoData.social?.instagram || '')}" oninput="markDirty()">
        </div>
      </div>
      <div class="settings-section">
        <h4>Site</h4>
        <div class="form-group">
          <label>Google Analytics ID</label>
          <input class="search-input" id="setGA" value="${escapeHtml(settingsData.googleAnalyticsId || '')}" oninput="markDirty()">
        </div>
        <div class="form-group">
          <label>WhatsApp (numéro)</label>
          <input class="search-input" id="setWhatsApp" value="${escapeHtml(settingsData.whatsappNumber || '')}" oninput="markDirty()">
        </div>
        <div class="form-group">
          <label>URL du site</label>
          <input class="search-input" id="setSiteUrl" value="${escapeHtml(settingsData.siteUrl || '')}" oninput="markDirty()">
        </div>
      </div>
      <div class="settings-section" style="grid-column:1/-1">
        <h4>Vision & Mission</h4>
        <div class="form-group">
          <label>Mission</label>
          <textarea class="detail-textarea" id="setMission" rows="3" oninput="markDirty()">${escapeHtml(contactInfoData.mission || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Vision</label>
          <textarea class="detail-textarea" id="setVision" rows="3" oninput="markDirty()">${escapeHtml(contactInfoData.vision || '')}</textarea>
        </div>
      </div>
      <div class="settings-section" style="grid-column:1/-1">
        <h4>Statistiques (Hero)</h4>
        <div class="settings-inline">
          <div class="form-group">
            <label>Années d'expérience</label>
            <input class="search-input" type="number" id="setExpYears" value="${contactInfoData.experience_years || 10}" oninput="markDirty()">
          </div>
          <div class="form-group">
            <label>Année de fondation</label>
            <input class="search-input" type="number" id="setFounded" value="${contactInfoData.founded || 2015}" oninput="markDirty()">
          </div>
          <div class="form-group">
            <label>Nombre de techniciens</label>
            <input class="search-input" type="number" id="setStaff" value="${contactInfoData.team?.total_staff || 34}" oninput="markDirty()">
          </div>
          <div class="form-group">
            <label>Ingénieurs civils</label>
            <input class="search-input" type="number" id="setEngineers" value="${contactInfoData.team?.civil_engineers || 4}" oninput="markDirty()">
          </div>
        </div>
      </div>
      <div class="settings-section" style="grid-column:1/-1">
        <h4>Test d'envoi d'email</h4>
        <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
          <input class="search-input" id="testEmailTo" placeholder="Email destinataire" style="flex:1;min-width:200px" value="">
          <button class="btn-secondary" onclick="testEmail()" style="padding:0.5rem 1rem">Tester</button>
          <span id="testEmailStatus" style="font-size:0.8125rem;color:var(--gray-500)"></span>
        </div>
      </div>
    </div>
  `;
}

export async function testEmail() {
  const to = document.getElementById('testEmailTo').value.trim();
  if (!to) { showToast('Entrez un email destinataire', 'error'); return; }
  const status = document.getElementById('testEmailStatus');
  status.textContent = '⏳ Envoi...';
  try {
    const res = await fetch(`${API_BASE}/test-email`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ to })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    status.textContent = 'Email envoyé avec succès';
    status.style.color = 'var(--success)';
    showToast('Email test envoyé', 'success');
  } catch (err) {
    status.textContent = 'Erreur : ' + err.message;
    status.style.color = 'var(--danger)';
    showToast('Échec: ' + err.message, 'error');
  }
}

export async function saveSettings() {
  const btn = document.getElementById('saveSettingsBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Enregistrement...'; }
  try {
    const contactPayload = {
      contact: {
        phone: document.getElementById('setPhone')?.value || '',
        email: document.getElementById('setEmail')?.value || '',
        address: document.getElementById('setAddress')?.value || ''
      },
      social: {
        facebook: document.getElementById('setFacebook')?.value || '',
        instagram: document.getElementById('setInstagram')?.value || ''
      },
      mission: document.getElementById('setMission')?.value || '',
      vision: document.getElementById('setVision')?.value || '',
      experience_years: parseInt(document.getElementById('setExpYears')?.value) || 10,
      founded: parseInt(document.getElementById('setFounded')?.value) || 2015,
      team: {
        total_staff: parseInt(document.getElementById('setStaff')?.value) || 34,
        civil_engineers: parseInt(document.getElementById('setEngineers')?.value) || 4
      }
    };

    const settingsPayload = {
      googleAnalyticsId: document.getElementById('setGA')?.value || '',
      whatsappNumber: document.getElementById('setWhatsApp')?.value || '',
      siteUrl: document.getElementById('setSiteUrl')?.value || ''
    };

    const [ciRes, setRes] = await Promise.all([
      fetch(`${API_BASE}/contact-info`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(contactPayload) }),
      fetch(`${API_BASE}/settings`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(settingsPayload) })
    ]);
    if (!ciRes.ok || !setRes.ok) {
      const ciErr = ciRes.ok ? null : (await ciRes.json().catch(() => ({}))).error;
      const setErr = setRes.ok ? null : (await setRes.json().catch(() => ({}))).error;
      throw new Error(ciErr || setErr || 'Erreur serveur');
    }
    markClean();
    showToast('Paramètres enregistrés', 'success');
  } catch (err) {
    showToast('Erreur lors de l\'enregistrement' + (err.message ? ': ' + err.message : ''), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Enregistrer'; }
  }
}
