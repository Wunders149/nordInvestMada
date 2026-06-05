import { checkAuth, markDirty, markClean, contactPage, quotePage, contentPage, loadedTabs } from './modules/api.js';
import { initDarkMode, showConfirm, showToast, confirmNavigation, exportToCsv, renderPagination, openLightbox } from './modules/ui.js';
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
    subscribers: 'Newsletter', images: 'Galerie',
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
  showConfirm, showToast, confirmNavigation, exportToCsv, openLightbox,
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
  loadActivityLog
});

// ─── Pagination globals ───
window._pg_contact = (p) => { contactPage = p; renderContacts(); };
window._pg_quote = (p) => { quotePage = p; renderQuotes(); };
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

// ─── Init ───
if (checkAuth()) {
  initDarkMode();
  loadStats();
  _switchTab('dashboard');
}
