import { checkAuth, markDirty, markClean, contentPage, loadedTabs, isDirty, API_BASE, getHeaders, state } from './modules/api.js';
import { initDarkMode, showConfirm, showToast, confirmNavigation, exportToCsv, renderPagination, openLightbox, closeLightbox, updateDarkBtn, confirmCallback } from './modules/ui.js';
import { loadStats, renderCharts, renderDashboard } from './modules/dashboard.js';
import {
  loadContacts, renderContacts, setContactFilter, toggleContactSelect, toggleAllContacts,
  clearContactSelection, bulkMarkRead, bulkDeleteContacts, markAllRead, markRead, markResolved,
  confirmDeleteContact, openContactDetail, closeContactDetail
} from './modules/contacts.js';
import {
  loadQuotes, renderQuotes, setQuoteFilter, toggleQuoteSelect, toggleAllQuotes,
  clearQuoteSelection, bulkDeleteQuotes, updateQuoteStatus, confirmDeleteQuote
} from './modules/quotes.js';
import { loadSubscribers, renderSubscribers, confirmDeleteSubscriber } from './modules/subscribers.js';
import {
  loadSlots, loadImages, renderImages, assignSlot, confirmDeleteImage,
  openImageEditor, closeImageEditor, saveImageEdit
} from './modules/images.js';
import {
  loadEntity, renderEntity, openCrudForm, closeCrudForm, saveCrudItem, confirmDeleteItem,
  previewSlotImage, uploadSlotImage, openTeamForm, openServiceForm, openProjectForm, openBlogForm,
  exportEntity
} from './modules/content.js';
import { loadPricingEditor, addPricingFeature, savePricing } from './modules/pricing.js';
import { loadSettings, saveSettings, testEmail } from './modules/settings.js';
import { loadActivityLog } from './modules/activity.js';
import { loadDossiers, closeDossierRename, confirmDossierRename } from './modules/dossiers.js';

// ─── Tab switching ───
function _switchTab(tabId) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (navBtn) navBtn.classList.add('active');
  const tab = document.getElementById(`tab-${tabId}`);
  if (tab) tab.classList.add('active');

  const titles = {
    dashboard: 'Tableau de bord', contacts: 'Messages', quotes: 'Devis',
    subscribers: 'Newsletter', images: 'Galerie', dossiers: 'Dossiers',
    team: 'Équipe', services: 'Services', projects: 'Projets',
    blog: 'Blog', pricing: 'Tarifs', settings: 'Paramètres',
    activity: "Journal d'activité"
  };
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.innerHTML = `${titles[tabId] || tabId} <small>Gestion</small>`;

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');

  if (!loadedTabs.has(tabId)) {
    loadedTabs.add(tabId);
    switch (tabId) {
      case 'dashboard': renderDashboard(); break;
      case 'contacts': loadContacts(); break;
      case 'quotes': loadQuotes(); break;
      case 'subscribers': loadSubscribers(); break;
      case 'images': loadSlots(); loadImages(); break;
      case 'dossiers': loadDossiers(); break;
      case 'team': loadEntity('team'); break;
      case 'services': loadEntity('services'); break;
      case 'projects': loadEntity('projects'); break;
      case 'blog': loadEntity('blog'); break;
      case 'pricing': loadPricingEditor(); break;
      case 'settings': loadSettings(); break;
      case 'activity': loadActivityLog(); break;
    }
  } else {
    switch (tabId) {
      case 'dashboard': renderDashboard(); loadStats(); break;
      case 'contacts': renderContacts(); break;
      case 'quotes': renderQuotes(); break;
      case 'subscribers': renderSubscribers(); break;
      case 'images': renderImages(); break;
    }
  }
}

function switchTab(tabId) {
  confirmNavigation(() => {
    _switchTab(tabId);
  });
}

// ─── Expose everything to window for inline HTML event handlers ───
Object.assign(window, {
  markDirty, markClean,
  showConfirm, showToast, confirmNavigation, exportToCsv, openLightbox, closeLightbox,
  renderPagination,
  switchTab,
  loadStats, renderCharts,
  loadContacts, renderContacts, setContactFilter, toggleContactSelect, toggleAllContacts,
  clearContactSelection, bulkMarkRead, bulkDeleteContacts, markAllRead, markRead, markResolved,
  confirmDeleteContact, openContactDetail, closeContactDetail,
  loadQuotes, renderQuotes, setQuoteFilter, toggleQuoteSelect, toggleAllQuotes,
  clearQuoteSelection, bulkDeleteQuotes, updateQuoteStatus, confirmDeleteQuote,
  loadSubscribers, renderSubscribers, confirmDeleteSubscriber,
  loadSlots, loadImages, renderImages, assignSlot, confirmDeleteImage,
  openImageEditor, closeImageEditor, saveImageEdit,
  loadEntity, renderEntity, openCrudForm, closeCrudForm, saveCrudItem, confirmDeleteItem,
  previewSlotImage, uploadSlotImage, openTeamForm, openServiceForm, openProjectForm, openBlogForm,
  exportEntity,
  loadPricingEditor, addPricingFeature, savePricing,
  loadSettings, saveSettings, testEmail,
  loadActivityLog,
  loadDossiers, closeDossierRename, confirmDossierRename
});

// ─── Pagination globals ───
window._pg_contact = (p) => { state.contactPage = p; renderContacts(); };
window._pg_quote = (p) => { state.quotePage = p; renderQuotes(); };
window._pg_content = (entity, p) => { contentPage[entity] = p; renderEntity(entity); };

// ─── Sidebar toggle (mobile) ───
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');

if (sidebarToggle && sidebar && overlay) {
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

// ─── Global event listeners ───

// Unsaved changes warning
window.addEventListener('beforeunload', (e) => {
  if (isDirty) { e.preventDefault(); e.returnValue = ''; }
});

// Confirm modal buttons
document.getElementById('confirmCancel')?.addEventListener('click', () => {
  document.getElementById('confirmModal')?.classList.remove('open');
  confirmCallback = null;
});
document.getElementById('confirmOk')?.addEventListener('click', () => {
  document.getElementById('confirmModal')?.classList.remove('open');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  showConfirm('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', () => {
    fetch(`${API_BASE}/logout`, { method: 'POST', headers: getHeaders() })
      .catch(() => {})
      .finally(() => {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login.html';
      });
  });
});

// Dark mode toggle
document.getElementById('darkModeBtn')?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('adminDarkMode', isDark);
  updateDarkBtn();
  renderCharts();
});

// Sidebar navigation
document.querySelectorAll('.nav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => { switchTab(btn.dataset.tab); });
});

// Window resize — debounced chart re-render
let chartResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(renderCharts, 150);
});
window.addEventListener('orientationchange', () => {
  setTimeout(renderCharts, 300);
});

// Auto-close sidebar on desktop resize
let sidebarTimer;
window.addEventListener('resize', () => {
  clearTimeout(sidebarTimer);
  sidebarTimer = setTimeout(() => {
    if (window.innerWidth > 900) {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('open');
    }
  }, 200);
});

// Search inputs
document.getElementById('contactSearch')?.addEventListener('input', () => { contactPage = 1; renderContacts(); });
document.getElementById('quoteSearch')?.addEventListener('input', () => { quotePage = 1; renderQuotes(); });
document.getElementById('subSearch')?.addEventListener('input', renderSubscribers);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  const tabs = ['dashboard', 'contacts', 'quotes', 'subscribers', 'images', 'team', 'services', 'projects', 'blog'];
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9 && tabs[num - 1]) { switchTab(tabs[num - 1]); return; }
  if (num === 0) { switchTab('pricing'); return; }
  if (e.key === '?') { document.getElementById('shortcutsModal')?.classList.toggle('open'); }
});

// ─── Init ───
if (checkAuth()) {
  initDarkMode();
  loadStats();

  _switchTab('dashboard');
}
