import { checkAuth, markDirty, markClean, contactPage, quotePage, contentPage, contacts } from './modules/api.js';
import { initDarkMode, showConfirm, showToast, confirmNavigation, exportToCsv, renderPagination, switchTab as uiSwitchTab, openLightbox } from './modules/ui.js';
import { loadStats, renderCharts } from './modules/dashboard.js';
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

// ─── Expose everything to window for inline HTML event handlers ───
Object.assign(window, {
  markDirty, markClean,
  showConfirm, showToast, confirmNavigation, exportToCsv, openLightbox,
  renderPagination,
  switchTab: uiSwitchTab,
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

// ─── Init ───
if (checkAuth()) {
  initDarkMode();
  loadStats();
  uiSwitchTab('dashboard');
}
