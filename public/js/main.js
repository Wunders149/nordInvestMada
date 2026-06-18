// ═══════════════════════════════════════════════════════
// THEME — Mode sombre/clair
// ═══════════════════════════════════════════════════════

function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('nim_theme', next);
  
  // Sync checkbox
  const checkbox = document.getElementById('checkbox');
  if (checkbox) {
    checkbox.checked = next === 'light';
  }

  // Update GA tracking
  if (typeof gtag !== 'undefined') {
    gtag('event', 'theme_toggle', { 'theme': next });
  }
}

function initTheme() {
  const saved = localStorage.getItem('nim_theme');
  let theme = 'light';
  if (saved === 'light' || saved === 'dark') {
    theme = saved;
  }
  document.documentElement.setAttribute('data-theme', theme);
  
  // Sync checkbox on load
  const checkbox = document.getElementById('checkbox');
  if (checkbox) {
    checkbox.checked = theme === 'light';
  }
}

// ═══════════════════════════════════════════════════════
// I18N — Traductions multilingue
// ═══════════════════════════════════════════════════════

let currentLang = localStorage.getItem('nim_lang') || 'fr';
let translations = {};

async function loadTranslations(lang) {
  try {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) throw new Error('Translation not found');
    translations = await res.json();
    currentLang = lang;
    localStorage.setItem('nim_lang', lang);
    applyTranslations();
    updateLangButtons();
    document.documentElement.lang = lang === 'en' ? 'en' : lang === 'mg' ? 'mg' : 'fr';
  } catch (e) {
    console.warn('Failed to load translations for', lang, '- falling back to fr');
    if (lang !== 'fr') loadTranslations('fr');
  }
}

async function setLanguage(lang) {
  await loadTranslations(lang);
  loadConfigData();
  if (typeof gtag !== 'undefined') {
    gtag('event', 'language_switch', { 'language': lang });
  }
}

function applyTranslations() {
  // Translate text content (data-i18n)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = getNestedTranslation(key);
    if (value) {
      el.textContent = value;
    }
  });

  // Translate HTML content (data-i18n-html)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const value = getNestedTranslation(key);
    if (value) {
      el.innerHTML = value;
    }
  });

  // Update blog toggle button text
  const btn = document.getElementById('blogToggleBtn');
  if (btn) {
    const expanded = btn.dataset.expanded === 'true';
    btn.textContent = expanded
      ? (getNestedTranslation('blog.showless') || 'Show less')
      : (getNestedTranslation('blog.showall') || 'See all articles');
  }
}

function getNestedTranslation(key) {
  return key.split('.').reduce((obj, i) => (obj && obj[i] !== undefined) ? obj[i] : null, translations);
}

function updateLangButtons() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

// ═══════════════════════════════════════════════════════
// ACTIVE NAV LINK — highlight current section on scroll
// ═══════════════════════════════════════════════════════

const navAnchors = document.querySelectorAll('.nav-links a[href^="#"]');
const sections = [];
navAnchors.forEach(a => {
  const id = a.getAttribute('href')?.replace('#', '');
  const el = document.getElementById(id);
  if (el) sections.push(el);
});
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      navAnchors.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + id);
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });
sections.forEach(s => navObserver.observe(s));

// ═══════════════════════════════════════════════════════
// MOBILE MENU
// ═══════════════════════════════════════════════════════

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const mobileMQ = window.matchMedia('(max-width: 768px)');

function closeMobileMenu() {
  if (!navLinks || !hamburger) return;
  navLinks.classList.add('closing');
  navLinks.classList.remove('active');
  hamburger.classList.remove('active');
  // Reset all open dropdowns
  document.querySelectorAll('.nav-dropdown.active').forEach(d => d.classList.remove('active'));
  setTimeout(() => {
    navLinks.classList.remove('closing');
  }, 300);
}

function closeOtherDropdowns(except) {
  document.querySelectorAll('.nav-dropdown.active').forEach(d => {
    if (d !== except) d.classList.remove('active');
  });
}

if (hamburger) {
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpening = !hamburger.classList.contains('active');
    if (isOpening) {
      navLinks.classList.remove('closing');
      hamburger.classList.add('active');
      navLinks.classList.add('active');
    } else {
      closeMobileMenu();
    }
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', (e) => {
      const parent = a.closest('.nav-dropdown');
      if (parent && a === parent.querySelector(':scope > a')) {
        // Dropdown parent link clicked - toggle submenu
        e.preventDefault();
        closeOtherDropdowns(parent);
        parent.classList.toggle('active');
        return;
      }
      if (navLinks.classList.contains('active')) {
        closeMobileMenu();
      }
    });
  });
  // Remove active on mouseleave (desktop hover cleanup)
  document.querySelectorAll('.nav-dropdown').forEach(dd => {
    dd.addEventListener('mouseleave', () => {
      dd.classList.remove('active');
    });
  });
  // Close on outside click — handles both mobile menu & desktop dropdowns
  document.addEventListener('click', (e) => {
    const isMobileMenu = navLinks.classList.contains('active');
    // Close mobile menu if click is outside
    if (isMobileMenu && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
      closeMobileMenu();
    }
    // Close dropdowns if click is outside the dropdown
    const clickedDD = e.target.closest('.nav-dropdown');
    document.querySelectorAll('.nav-dropdown.active').forEach(d => {
      if (d !== clickedDD) d.classList.remove('active');
    });
  });
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (navLinks.classList.contains('active')) {
      closeMobileMenu();
    }
    document.querySelectorAll('.nav-dropdown.active').forEach(d => d.classList.remove('active'));
  });
  // Close on resize to desktop
  mobileMQ.addEventListener('change', (e) => {
    if (!e.matches) {
      navLinks.classList.remove('active', 'closing');
      hamburger.classList.remove('active');
    }
  });
}

// ═══════════════════════════════════════════════════════
// NAV SCROLL SHADOW
// ═══════════════════════════════════════════════════════

const nav = document.querySelector('nav');
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 50);
  // Back to top button
  const btn = document.getElementById('backToTop');
  if (btn) btn.classList.toggle('visible', y > 400);
  lastScroll = y;
}, { passive: true });

// Back to top
document.getElementById('backToTop')?.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ═══════════════════════════════════════════════════════
// LOADER — Navigation loader with logo animation
// ═══════════════════════════════════════════════════════

const loaderOverlay = document.getElementById('loader-overlay');

function showLoader(targetId) {
  loaderOverlay.classList.add('active');
  setTimeout(() => {
    const target = document.getElementById(targetId);
    if (target) {
      const navHeight = document.querySelector('nav')?.offsetHeight || 70;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    setTimeout(() => {
      loaderOverlay.classList.remove('active');
    }, 400);
  }, 900);
}

document.querySelectorAll('.nav-links a[href^="#"], .footer-links a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const targetId = href.replace('#', '');
    if (document.getElementById(targetId)) {
      const parent = link.closest('.nav-dropdown');
      if (parent && link === parent.querySelector(':scope > a')) {
        return; // Dropdown parent toggle — handled separately
      }
      e.preventDefault();
      hamburger?.classList.remove('active');
      navLinks?.classList.remove('active');
      showLoader(targetId);
    }
  });
});

// ═══════════════════════════════════════════════════════
// PRICING TABS
// ═══════════════════════════════════════════════════════

function switchTab(name) {
  const panel = document.getElementById('tab-' + name);
  if (!panel) return;

  document.querySelectorAll('.pricing-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  
  panel.classList.add('active');
  
  document.querySelectorAll('.tab-btn').forEach(b => {
    if (b.getAttribute('onclick')?.includes(`'${name}'`)) {
      b.classList.add('active');
    }
  });
}

// ═══════════════════════════════════════════════════════
// CONTACT FORM AUTO-FILL
// ═══════════════════════════════════════════════════════

function fillContactForm(button) {
  const card = button.closest('.price-card');
  const service = card.getAttribute('data-service');
  const tier = card.getAttribute('data-tier-name');
  const type = card.getAttribute('data-type');
  const price = card.getAttribute('data-price');
  const budgetRange = card.getAttribute('data-budget');

  const serviceMap = {
    'construction': 'construction',
    'rehabilitation': 'rehabilitation',
    'forage': 'forage'
  };

  const serviceSelect = document.getElementById('serviceType');
  const projectInput = document.getElementById('projectType');
  const budgetInput = document.getElementById('budget');
  const budgetCurrency = document.getElementById('budgetCurrency');
  const messageTextarea = document.getElementById('message');

  serviceSelect.value = serviceMap[service] || '';
  projectInput.value = `${type} - ${tier}`;

  const budgetVal = parseInt(budgetRange, 10);
  if (budgetVal > 0) {
    budgetInput.value = budgetVal;
    budgetCurrency.value = 'Ar';
    budgetCurrency.dataset.lastCurrency = 'Ar';
  }

  const serviceLabel = {
    'construction': 'Construction Neuve',
    'rehabilitation': 'Études et Conception',
    'forage': 'Forage d\'Eau'
  }[service] || '';

  const priceDisplay = price ? Number(price).toLocaleString('fr-FR') + ' Ar/m²' : 'Sur devis';

  messageTextarea.value = `Je suis intéressé par : ${type}\nFormule : ${tier}\nTarif référence : ${priceDisplay}\n\nMerci de me contacter pour un devis détaillé.`;

  setTimeout(() => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// ═══════════════════════════════════════════════════════
// CONTACT FORM SUBMIT
// ═══════════════════════════════════════════════════════

function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const messageDiv = document.getElementById('formMessage');
  const form = document.getElementById('contactForm');

  btn.textContent = getNestedTranslation('contact.sending');
  btn.disabled = true;
  messageDiv.style.display = 'none';

  const budgetAmount = document.getElementById('budget').value;
  const budgetCurrency = document.getElementById('budgetCurrency').value;
  const formData = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value || '',
    serviceType: document.getElementById('serviceType').value,
    projectType: document.getElementById('projectType').value,
    budget: budgetAmount ? `${Number(budgetAmount).toLocaleString('fr-FR')} ${budgetCurrency}` : '',
    message: document.getElementById('message').value
  };

  const API_BASE = window.location.origin;

  fetch(`${API_BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  })
  .then(response => response.json())
  .then(result => {
    btn.textContent = getNestedTranslation('contact.sent');
    btn.style.background = '#2a7a4a';
    messageDiv.textContent = getNestedTranslation('contact.sentMessage');
    messageDiv.style.display = 'block';
    messageDiv.style.color = '#2a7a4a';
    form.reset();

    if (typeof gtag !== 'undefined') {
      gtag('event', 'form_submission', {
        'service_type': formData.serviceType,
        'project_type': formData.projectType
      });
    }

    setTimeout(() => {
      btn.textContent = getNestedTranslation('contact.formSubmit');
      btn.style.background = '';
      btn.disabled = false;
      messageDiv.style.display = 'none';
    }, 5000);
  })
  .catch(error => {
    console.error('Error:', error);
    messageDiv.textContent = getNestedTranslation('contact.errorMessage');
    messageDiv.style.display = 'block';
    messageDiv.style.color = '#E8614A';
    btn.textContent = getNestedTranslation('contact.formSubmit');
    btn.disabled = false;
  });
}

// ═══════════════════════════════════════════════════════
// PRICING CALCULATOR
// ═══════════════════════════════════════════════════════

async function calculatePricing(serviceType, squareMeters, finishingLevel, location) {
  const API_BASE = window.location.origin;
  try {
    const response = await fetch(`${API_BASE}/api/calculate-pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceType, squareMeters, finishingLevel, location })
    });
    return await response.json();
  } catch (error) {
    console.error('Pricing calculation error:', error);
    return null;
  }
}

function updateCalcFields() {
  const service = document.getElementById('calc-service').value;
  const labelSurface = document.getElementById('label-surface');
  const inputSurface = document.getElementById('calc-surface');

  if (service === 'forage') {
    labelSurface.textContent = getNestedTranslation(`calculator.depthLabel`);
    inputSurface.value = 40;
  } else {
    labelSurface.textContent = getNestedTranslation(`calculator.surfaceLabel`);
    inputSurface.value = 100;
  }
}

async function runCalculation() {
  const serviceType = document.getElementById('calc-service').value;
  const squareMeters = parseFloat(document.getElementById('calc-surface').value);
  const finishingLevel = document.getElementById('calc-tier').value;
  const location = document.getElementById('calc-location').value;
  const resultPanel = document.getElementById('calc-result-panel');

  if (isNaN(squareMeters) || squareMeters <= 0) {
    alert(getNestedTranslation('calculator.alertInvalidSurface'));
    return;
  }

  const loadingText = getNestedTranslation(`calculator.loading`) || 'Calcul de votre estimation en cours...';
  resultPanel.innerHTML = `
    <div class="result-placeholder">
      <div class="loading-spinner"></div>
      <p class="calc-placeholder-text">${loadingText}</p>
    </div>
  `;

  const data = await calculatePricing(serviceType, squareMeters, finishingLevel, location);

  if (!data || data.error) {
    const errText = getNestedTranslation(`calculator.error`) || 'Erreur lors du calcul. Veuillez réessayer.';
    resultPanel.innerHTML = `
      <div class="result-placeholder">
        <p style="color: var(--rust-light);">${errText}</p>
      </div>
    `;
    return;
  }

  const priceLocale = currentLang === 'en' ? 'en-US' : 'fr-MG';
  const fmt = (val) => new Intl.NumberFormat(priceLocale).format(val);
  const formatAr = (val) => fmt(val) + ' Ar';
  const foreignTotal = data.grandTotalEUR && data.grandTotalUSD
    ? `<div class="calc-foreign">
        <div class="calc-foreign-item">
          <span class="calc-foreign-symbol">€</span>
          <span class="calc-foreign-val">${fmt(data.grandTotalEUR)}</span>
        </div>
        <div class="calc-foreign-item">
          <span class="calc-foreign-symbol">$</span>
          <span class="calc-foreign-val">${fmt(data.grandTotalUSD)}</span>
        </div>
      </div>`
    : '';

  const rTitle = getNestedTranslation('calculator.resultTitle') || 'Estimation Prévisionnelle';
  const rUnit = getNestedTranslation('calculator.resultUnit') || 'Toutes Taxes Comprises (TTC)';
  const dBase = getNestedTranslation('calculator.detailBase') || 'Base';
  const dSub = getNestedTranslation('calculator.detailSubtotal') || 'Sous-total HT';
  const contRate = data.subtotal > 0 ? Math.round((data.contingency / data.subtotal) * 100) : 10;
  const taxRate = data.estimatedTotal > 0 ? Math.round((data.tax / data.estimatedTotal) * 100) : 20;
  const dCont = (getNestedTranslation('calculator.detailContingency') || 'Marge de sécurité').replace(/\(\d+%\)/, '') + `(${contRate}%)`;
  const dTax = (getNestedTranslation('calculator.detailTax') || 'TVA').replace(/\(\d+%\)/, '') + `(${taxRate}%)`;
  const dTotal = getNestedTranslation('calculator.detailTotal') || 'Total estimé';
  const rNote = getNestedTranslation('calculator.resultNote') || '* Cette estimation est fournie à titre indicatif.';
  const rCTA = getNestedTranslation('calculator.resultCTA') || 'Demander un devis officiel';

  resultPanel.innerHTML = `
    <div class="result-header">
      <div class="result-title">${rTitle}</div>
      <div class="result-main">${formatAr(data.grandTotal)}</div>
      ${foreignTotal}
      <div class="result-unit">${rUnit}</div>
    </div>
    <div class="result-details">
      <div class="detail-item">
        <span>${dBase} (${getNestedTranslation(`pricing.tiers.${data.serviceType}.${data.finishingLevel}`) || data.finishingLevel})</span>
        <span>${formatAr(data.basePrice)} / ${data.serviceType === 'forage' ? 'ml' : 'm²'}</span>
      </div>
      <div class="detail-item">
        <span>${dSub}</span>
        <span>${formatAr(data.subtotal)}</span>
      </div>
      <div class="detail-item">
        <span>${dCont}</span>
        <span>${formatAr(data.contingency)}</span>
      </div>
      <div class="detail-item">
        <span>${dTax}</span>
        <span>${formatAr(data.tax)}</span>
      </div>
      <div class="detail-item total">
        <span>${dTotal}</span>
        <span>${formatAr(data.grandTotal)}</span>
      </div>
    </div>
    <p class="result-note">${rNote}</p>
    <a href="#contact" class="price-cta" style="margin-top:32px;" onclick="transferToForm('${serviceType}', '${finishingLevel}', ${squareMeters}, '${location}', ${data.grandTotal})">${rCTA}</a>
  `;
}

function transferToForm(service, tier, surface, location, total) {
  const serviceSelect = document.getElementById('serviceType');
  const projectInput = document.getElementById('projectType');
  const budgetInput = document.getElementById('budget');
  const budgetCurrency = document.getElementById('budgetCurrency');
  const messageTextarea = document.getElementById('message');

  const serviceDisplay = {
    construction: 'Construction Neuve',
    rehabilitation: 'Études et Conception',
    forage: 'Forage d\'Eau'
  }[service] || service;
  const tierDisplay = getNestedTranslation(`pricing.tiers.${service}.${tier}`) || tier;

  serviceSelect.value = service;
  projectInput.value = `${serviceDisplay} - ${tierDisplay} (${surface} ${service === 'forage' ? 'ml' : 'm²'})`;

  if (total > 0) {
    budgetInput.value = total;
    budgetCurrency.value = 'Ar';
    budgetCurrency.dataset.lastCurrency = 'Ar';
  }

  const tLocale = currentLang === 'en' ? 'en-US' : 'fr-MG';
  const locationSelect = document.getElementById('calc-location');
  const locationDisplay = locationSelect ? locationSelect.options[locationSelect.selectedIndex]?.text : location;

  messageTextarea.value = `Bonjour, j'ai effectué une simulation sur votre site :\n- Service : ${serviceDisplay}\n- Gamme : ${tierDisplay}\n- Surface : ${surface} ${service === 'forage' ? 'ml' : 'm²'}\n- Lieu : ${locationDisplay}\n- Estimation : ${new Intl.NumberFormat(tLocale).format(total)} Ar TTC\n\nJe souhaite obtenir un devis définitif.`;

  setTimeout(() => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// ═══════════════════════════════════════════════════════
// GALLERY / LIGHTBOX
// ═══════════════════════════════════════════════════════

let galleryImages = [];

function rebuildGallery() {
  const grid = document.getElementById('projectsGrid');
  if (!grid || !grid.querySelector('.project-card')) return;
  galleryImages = Array.from(grid.querySelectorAll('.project-card img')).map(img => ({
    src: img.src,
    alt: img.alt
  }));
}

let galleryIndex = 0;

function openGallery(index) {
  rebuildGallery();
  galleryIndex = index;
  const modal = document.getElementById('galleryModal');
  const img = document.getElementById('galleryImg');
  const caption = document.getElementById('galleryCaption');
  if (!modal || !img || !caption) return;
  
  img.src = galleryImages[index].src;
  img.alt = galleryImages[index].alt;
  caption.textContent = galleryImages[index].alt;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeGallery(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById('galleryModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
}

function changeGallery(dir) {
  galleryIndex = (galleryIndex + dir + galleryImages.length) % galleryImages.length;
  const img = document.getElementById('galleryImg');
  const caption = document.getElementById('galleryCaption');
  if (!img || !caption) return;
  
  img.style.opacity = '0';
  setTimeout(() => {
    img.src = galleryImages[galleryIndex].src;
    img.alt = galleryImages[galleryIndex].alt;
    caption.textContent = galleryImages[galleryIndex].alt;
    img.style.opacity = '1';
  }, 150);
}

// Touch/swipe support for gallery
(function initGalleryTouch() {
  const galleryContent = document.getElementById('galleryImg');
  if (!galleryContent) return;
  let touchStartX = 0;
  let touchStartY = 0;
  galleryContent.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  galleryContent.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].screenX - touchStartX;
    const deltaY = e.changedTouches[0].screenY - touchStartY;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      changeGallery(deltaX < 0 ? 1 : -1);
    }
  }, { passive: true });
})();

// Keyboard support for gallery
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('galleryModal');
  if (!modal || !modal.classList.contains('active')) return;
  if (e.key === 'Escape') closeGallery();
  if (e.key === 'ArrowLeft') changeGallery(-1);
  if (e.key === 'ArrowRight') changeGallery(1);
});

// ═══════════════════════════════════════════════════════
// ANALYTICS TRACKING
// ═══════════════════════════════════════════════════════

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pricing_tab_view', { 'tab_name': this.textContent });
    }
  });
});

document.querySelectorAll('.btn-primary, .nav-cta').forEach(btn => {
  btn.addEventListener('click', function() {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'cta_click', { 'button_text': this.textContent });
    }
  });
});

// ═══════════════════════════════════════════════════════
// ANIMATED COUNTERS with progress bar
// ═══════════════════════════════════════════════════════

function animateCounters() {
  const progressBar = document.getElementById('counterProgressBar');
  const countItems = document.querySelectorAll('#numbers .num-val');

  countItems.forEach(el => {
    const text = el.textContent.trim();
    const suffix = text.includes('+') ? '+' : '';
    const target = parseInt(text.replace('+', '').replace(/\s/g, ''), 10);
    if (isNaN(target)) return;
    const duration = 1800;
    const start = performance.now();
    el.innerHTML = `<span class="num-count">0</span>${suffix}`;
    const countEl = el.querySelector('.num-count');
    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      countEl.textContent = current;
      if (progressBar) {
        progressBar.style.width = `${eased * 100}%`;
      }
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  });
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounters();
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });

const numbersSection = document.getElementById('numbers');
if (numbersSection) counterObserver.observe(numbersSection);

// ═══════════════════════════════════════════════════════
// NEWSLETTER
// ═══════════════════════════════════════════════════════

async function handleNewsletter(e) {
  e.preventDefault();
  const email = document.getElementById('newsletterEmail').value;
  const msg = document.getElementById('newsletterMsg');
  if (!email) return;
  msg.textContent = getNestedTranslation('newsletter.sending');
  msg.className = 'newsletter-msg';
  const API_BASE = window.location.origin;
  try {
    const res = await fetch(`${API_BASE}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      msg.textContent = getNestedTranslation('newsletter.success');
      msg.className = 'newsletter-msg success';
      document.getElementById('newsletterForm').reset();
    } else {
      msg.textContent = data.error || getNestedTranslation('newsletter.error');
      msg.className = 'newsletter-msg error';
    }
  } catch {
    msg.textContent = getNestedTranslation('newsletter.errorGeneric');
    msg.className = 'newsletter-msg error';
  }
}

// ═══════════════════════════════════════════════════════
// HERO MOUSE PARALLAX
// ═══════════════════════════════════════════════════════

(function initHeroParallax() {
  const heroRight = document.querySelector('.hero-right[data-parallax]');
  if (!heroRight) return;
  const heroImg = heroRight.querySelector('.hero-img');
  const heroBadge = heroRight.querySelector('.hero-badge');
  const shapes = heroRight.querySelectorAll('.shape');

  heroRight.addEventListener('mousemove', (e) => {
    const rect = heroRight.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    if (heroImg) {
      heroImg.style.transform = `scale(1.08) translate(${x * -35}px, ${y * -35}px)`;
    }
    if (heroBadge) {
      heroBadge.style.transform = `translate(${x * 25}px, ${y * 25}px)`;
    }
    shapes.forEach((shape, i) => {
      const depth = (i + 1) * 18;
      shape.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
    });
  });

  heroRight.addEventListener('mouseleave', () => {
    if (heroImg) heroImg.style.transform = 'scale(1) translate(0, 0)';
    if (heroBadge) heroBadge.style.transform = 'translate(0, 0)';
    shapes.forEach(shape => shape.style.transform = 'translate(0, 0)');
  });

  heroRight.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = heroRight.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width - 0.5;
    const y = (touch.clientY - rect.top) / rect.height - 0.5;
    if (heroImg) {
      heroImg.style.transform = `scale(1.05) translate(${x * -20}px, ${y * -20}px)`;
    }
    if (heroBadge) {
      heroBadge.style.transform = `translate(${x * 15}px, ${y * 15}px)`;
    }
    shapes.forEach((shape, i) => {
      const depth = (i + 1) * 10;
      shape.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
    });
  }, { passive: true });

  heroRight.addEventListener('touchend', () => {
    if (heroImg) heroImg.style.transform = 'scale(1) translate(0, 0)';
    if (heroBadge) heroBadge.style.transform = 'translate(0, 0)';
    shapes.forEach(shape => shape.style.transform = 'translate(0, 0)');
  });
})();

// ═══════════════════════════════════════════════════════
// SCROLL REVEAL (IntersectionObserver)
// ═══════════════════════════════════════════════════════

const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-stagger').forEach(el => observer.observe(el));

// ═══════════════════════════════════════════════════════
// IMAGE REVEAL ON SCROLL
// ═══════════════════════════════════════════════════════

const imgObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('img-visible');
      imgObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

function initImageReveal() {
  document.querySelectorAll('.img-reveal:not(.img-visible)').forEach(el => imgObserver.observe(el));
}

// ═══════════════════════════════════════════════════════
// IMAGE SLOT SWAP — Replace SVG placeholders with uploaded images
// ═══════════════════════════════════════════════════════

async function loadImageSlots() {
  try {
    const res = await fetch('/api/images/slots');
    if (!res.ok) return;
    const slots = await res.json();
    slots.forEach(slot => {
      if (!slot.uploadedFile && !slot.cloudinaryUrl) return;
      if (!slot.currentUrl || slot.currentUrl.endsWith('placeholder.svg')) return;
      const el = document.querySelector(`[data-image-slot="${slot.id}"]`);
      if (!el) return;
      if (el.tagName === 'IMG') {
        el.src = slot.currentUrl;
        el.dataset.originalSrc = slot.originalFile ? `/images/${slot.section}/${slot.originalFile}` : '';
      } else {
        el.style.backgroundImage = `url('${slot.currentUrl}')`;
        el.dataset.originalSrc = slot.originalFile ? `/images/${slot.section}/${slot.originalFile}` : '';
      }
    });
    initHeroSwap();
    rebuildGallery();
  } catch (err) {
    // Silent fail — SVGs remain as fallbacks
  }
}

// ═══════════════════════════════════════════════════════
// HERO IMAGE SWAP — swap left bg and right img every 5s
// ═══════════════════════════════════════════════════════

let heroSwapTimer = null;
let heroSwapInitialized = false;

function initHeroSwap() {
  const heroLeftBg = document.querySelector('.hero-left-bg');
  const heroImg = document.querySelector('.hero-img');
  if (!heroLeftBg || !heroImg) return;

  if (heroSwapTimer) clearInterval(heroSwapTimer);
  heroSwapInitialized = false;

  const leftBg = getComputedStyle(heroLeftBg).backgroundImage;
  const rightSrc = heroImg.src;
  if (!leftBg || leftBg === 'none' || !rightSrc) return;
  if (leftBg.includes('placeholder.svg') || rightSrc.includes('placeholder.svg')) return;

  heroSwapInitialized = true;

  heroSwapTimer = setInterval(() => {
    const currentLeftBg = heroLeftBg.style.backgroundImage || getComputedStyle(heroLeftBg).backgroundImage;
    const currentRightSrc = heroImg.src;

    if (!currentLeftBg || currentLeftBg === 'none' || !currentRightSrc) return;
    if (currentLeftBg.includes('placeholder.svg') || currentRightSrc.includes('placeholder.svg')) return;

    const leftUrl = currentLeftBg.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
    const rightUrl = currentRightSrc;

    heroLeftBg.classList.add('swap-out');
    heroImg.classList.add('swap-out');

    setTimeout(() => {
      heroLeftBg.style.backgroundImage = `url('${rightUrl}')`;
      heroImg.src = leftUrl;

      requestAnimationFrame(() => {
        heroLeftBg.classList.remove('swap-out');
        heroImg.classList.remove('swap-out');
      });
    }, 400);
  }, 5000);
}

// ═══════════════════════════════════════════════════════
// DYNAMIC CONTENT LOADER — Fetch from API and render
// ═══════════════════════════════════════════════════════

const API_BASE = window.location.origin;

async function loadTeam() {
  try {
    const res = await fetch(`${API_BASE}/api/team`);
    const team = await res.json();
    const grid = document.getElementById('teamGrid');
    if (!grid) return;
    grid.innerHTML = team.map(m => {
      const hasOwnImg = m.image && (m.image.startsWith('http') || m.image.startsWith('/'));
      return `
      <div class="team-card">
        <img src="${hasOwnImg ? m.image : '/images/placeholder.svg'}" alt="${escapeHtml(m.name)}" class="team-avatar" loading="lazy"${!hasOwnImg ? ` data-image-slot="${m.image_slot || ''}"` : ''}>
        <div class="team-name">${escapeHtml(m.name)}</div>
        <div class="team-role">${escapeHtml(m.role)}</div>
        <div class="team-desc">${escapeHtml(m.bio)}</div>
      </div>
    `;}).join('');
    loadImageSlots();
    initTeamReveal();
    initTeamTilt();
  } catch (err) { console.warn('Team load error:', err); showSectionError('teamGrid', getNestedTranslation('dossiers.error') || 'Unable to load.'); }
}

function initTeamReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('spotlight-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.team-card').forEach(el => observer.observe(el));
}

function initTeamTilt() {
  document.querySelectorAll('.team-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      if (!card.classList.contains('spotlight-visible')) return;
      card.style.transition = 'transform 0.1s ease-out';
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotateX = ((y - rect.height / 2) / rect.height * 2) * -6;
      const rotateY = ((x - rect.width / 2) / rect.width * 2) * 6;
      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      card.classList.add('tilt-active');
    });
    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform 0.5s ease, background 0.3s, border-color 0.3s';
      card.style.transform = '';
      card.classList.remove('tilt-active');
    });
  });
}

async function loadServices() {
  try {
    const res = await fetch(`${API_BASE}/api/services`);
    const services = await res.json();
    const grid = document.getElementById('servicesGrid');
    if (!grid) return;
    grid.innerHTML = services.map((s, i) => `
      <div class="service-card">
        <div class="service-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="service-icon">${s.icon || '🔧'}</div>
        <div class="service-title">${escapeHtml(s.title)}</div>
        <p class="service-desc">${escapeHtml(s.description)}</p>
      </div>
    `).join('');
    initImageReveal();
  } catch (err) { console.warn('Services load error:', err); showSectionError('servicesGrid', getNestedTranslation('dossiers.error') || 'Unable to load.'); }
}

async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    const projects = await res.json();
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;
    grid.innerHTML = projects.map(p => {
      const hasOwnImg = p.image && (p.image.startsWith('http') || p.image.startsWith('/'));
      return `
      <div class="project-card">
        <img src="${hasOwnImg ? p.image : '/images/placeholder.svg'}" alt="${escapeHtml(p.title)}" class="project-img img-reveal" loading="lazy"${!hasOwnImg ? ` data-image-slot="${p.image_slot || ''}"` : ''}>
        <div class="project-overlay">
          <div class="project-cat">${escapeHtml(p.category || '')}</div>
          <div class="project-name">${escapeHtml(p.title)}</div>
          <div class="project-loc">📍 ${escapeHtml(p.location || '')}</div>
        </div>
      </div>
    `;}).join('');
    // Re-attach gallery click listeners
    document.querySelectorAll('.project-card').forEach((card, index) => {
      card.addEventListener('click', () => openGallery(index));
    });
    loadImageSlots();
    initImageReveal();
  } catch (err) { console.warn('Projects load error:', err); showSectionError('projectsGrid', getNestedTranslation('dossiers.error') || 'Unable to load.'); }
}

let BLOG_CATEGORIES = {};
let blogSvgs = {};

async function loadBlogCategories() {
  try {
    const res = await fetch('/api/blog-categories');
    const cats = await res.json();
    const map = {};
    const svgMap = {};
    cats.forEach(c => {
      map[c.id] = { label: c.label, icon: c.icon, color: c.color, image: c.image || '' };
      if (c.svg) svgMap[c.id] = c.svg;
    });
    BLOG_CATEGORIES = map;
    blogSvgs = svgMap;
  } catch (err) {
    console.warn('Failed to load blog categories:', err);
    BLOG_CATEGORIES = {
      'blog-construction': { label: 'Construction', icon: '🏗️', color: 'var(--rust)', image: '' },
      'blog-forage': { label: 'Forage', icon: '💧', color: 'var(--blue, #2563eb)', image: '' },
      'blog-immobilier': { label: 'Immobilier', icon: '🏡', color: 'var(--green, #16a34a)', image: '' }
    };
    blogSvgs = { 'blog-construction': 'construction.svg', 'blog-forage': 'forage.svg', 'blog-immobilier': 'immobilier.svg' };
  }
}

function readingTime(html) {
  if (!html) return 1;
  const text = html.replace(/<[^>]*>/g, '');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function loadBlog() {
  try {
    const res = await fetch(`${API_BASE}/api/blog`);
    const posts = await res.json();
    const container = document.getElementById('blogTimeline');
    if (!container) return;
    window._allPosts = posts;
    const showAll = document.getElementById('blogFooter');
    if (posts.length <= 3) {
      if (showAll) showAll.style.display = 'none';
    } else {
      if (showAll) showAll.style.display = '';
      const btn = document.getElementById('blogToggleBtn');
      if (btn) {
        btn.textContent = getNestedTranslation('blog.showall') || 'Voir tous les articles';
        btn.onclick = () => {
          const expanded = btn.dataset.expanded === 'true';
          const hidden = container.querySelectorAll('.timeline-entry.hidden');
          btn.dataset.expanded = expanded ? 'false' : 'true';
          btn.textContent = expanded
            ? (getNestedTranslation('blog.showall') || 'Voir tous les articles')
            : (getNestedTranslation('blog.showless') || 'Voir moins');
          hidden.forEach(el => {
            el.classList.toggle('hidden');
            if (!expanded) {
              el.classList.add('timeline-visible');
              el.style.display = '';
            } else {
              el.classList.remove('timeline-visible');
              el.style.display = '';
            }
          });
          if (expanded) {
            hidden.forEach(el => { el.classList.add('hidden'); });
          }
        };
      }
    }
    container.innerHTML = posts.map((p, i) => {
      const date = new Date(p.date);
      const dateLocale = currentLang === 'mg' ? 'mg-MG' : currentLang === 'en' ? 'en-US' : 'fr-FR';
      const dateStr = date.toLocaleDateString(dateLocale, { day: '2-digit', month: 'long', year: 'numeric' });
      const blogSvg = blogSvgs[p.image_slot] || 'construction.svg';
      const cat = BLOG_CATEGORIES[p.image_slot] || {};
      const catImg = cat.image || '';
      const postImg = p.image && !p.image.startsWith('http') && !p.image.startsWith('/') ? `/images/blog/${p.image}` : p.image;
      const hasOwnImg = !!postImg;
      const imgUrl = postImg || catImg || `/images/blog/${blogSvg}`;
      const rt = readingTime(p.content);
      const slotAttr = hasOwnImg ? '' : (p.image_slot || '');
      const isHidden = i >= 3 && posts.length > 3;
      return `
      <div class="timeline-entry${i === 0 ? ' timeline-visible' : ''}${isHidden ? ' hidden' : ''}" data-index="${escapeHtml(String(p.index || ''))}" data-id="${escapeHtml(p.id)}" data-title="${escapeHtml(p.title)}" data-date="${dateStr}" data-content="${escapeHtml(p.content || '')}" data-img="${escapeHtml(imgUrl)}" data-slug="${escapeHtml(p.slug || '')}" data-image-slot="${slotAttr}"${isHidden ? ' style="display:none"' : ''}>
        <div class="timeline-marker"></div>
        <div class="timeline-card">
          <div class="timeline-img-wrap">
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.title)}" loading="lazy"${slotAttr ? ` data-image-slot="${slotAttr}"` : ''}>
            ${cat.label ? `<span class="timeline-badge" style="--badge-color: ${cat.color}">${cat.icon} ${cat.label}</span>` : ''}
          </div>
          <div class="timeline-body">
            <div class="timeline-meta">
              <span class="timeline-date">${dateStr}</span>
              <span class="timeline-readtime">${rt} min</span>
            </div>
            <h3 class="timeline-title">${escapeHtml(p.title)}</h3>
            <p class="timeline-excerpt">${escapeHtml(p.excerpt)}</p>
            <a href="#" class="timeline-link">${getNestedTranslation('blog.readmore')}</a>
          </div>
        </div>
      </div>`;
    }).join('');
    container.querySelectorAll('.timeline-entry').forEach(entry => {
      entry.addEventListener('click', (e) => {
        if (e.target.closest('.timeline-link')) e.preventDefault();
        openBlogPost(
          entry.dataset.title, entry.dataset.date, entry.dataset.content,
          entry.dataset.img, entry.dataset.slug, entry.dataset.imageSlot, entry.dataset.id
        );
      });
    });
    const entries = container.querySelectorAll('.timeline-entry:not(.hidden):not(.timeline-visible)');
    if (entries.length) initBlogReveal();
    loadImageSlots();
  } catch (err) { console.warn('Blog load error:', err); showSectionError('blogTimeline', getNestedTranslation('dossiers.error') || 'Unable to load.'); }
}

function openBlogPost(title, date, content, imgUrl, slug, imageSlot, postId) {
  const modal = document.getElementById('blogModal');
  const contentEl = document.getElementById('blogModalContent');
  const titleEl = document.getElementById('blogModalTitle');
  const dateEl = document.getElementById('blogModalDate');
  const bodyEl = document.getElementById('blogModalBody');
  const authorEl = document.getElementById('blogModalAuthor');
  const shareBtns = document.getElementById('blogShare');
  const relatedEl = document.getElementById('blogRelated');
  const progressEl = document.getElementById('blogProgress');
  if (!modal || !titleEl || !bodyEl) return;
  titleEl.textContent = title;
  dateEl.textContent = date;
  if (authorEl) authorEl.textContent = `Publié par Nord Invest Madagascar`;
  if (contentEl) {
    if (imgUrl) {
      contentEl.style.backgroundImage = `url('${imgUrl}')`;
    } else {
      contentEl.style.backgroundImage = 'none';
    }
  }
  bodyEl.innerHTML = sanitizeHtml(content);
  const pageUrl = slug ? `${window.location.origin}/blog/${encodeURIComponent(slug)}` : window.location.href;
  const shareText = `${title} — Nord Invest Madagascar`;
  if (shareBtns) {
    shareBtns.innerHTML = `
      <span class="blog-share-label">${getNestedTranslation('blog.share') || 'Partager'}</span>
      <a href="https://wa.me/?text=${encodeURIComponent(shareText + ' ' + pageUrl)}" target="_blank" rel="noopener" class="blog-share-btn share-wa" title="WhatsApp">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}" target="_blank" rel="noopener" class="blog-share-btn share-fb" title="Facebook">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      </a>
      <button class="blog-share-btn share-copy" onclick="copyShareLink('${encodeURIComponent(pageUrl)}')" title="Copier le lien">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>
    `;
  }
  if (relatedEl && window._allPosts) {
    const others = window._allPosts.filter(p => p.id !== postId);
    if (others.length > 0) {
      const slotMap = window._slotMap || {};
      relatedEl.innerHTML = `
        <div class="blog-related-title">${getNestedTranslation('blog.related') || 'Articles similaires'}</div>
        <div class="blog-related-grid">${others.slice(0, 2).map(p => {
          const d = new Date(p.date);
          const dl = currentLang === 'mg' ? 'mg-MG' : currentLang === 'en' ? 'en-US' : 'fr-FR';
          const ds = d.toLocaleDateString(dl, { day: '2-digit', month: 'long', year: 'numeric' });
          const cat2 = BLOG_CATEGORIES[p.image_slot] || {};
          const svg = blogSvgs[p.image_slot] || 'construction.svg';
          const pImg = p.image && !p.image.startsWith('http') && !p.image.startsWith('/') ? `/images/blog/${p.image}` : p.image;
          const relatedImg = pImg || cat2.image || `/images/blog/${svg}`;
          return `<div class="blog-related-card" onclick="openBlogPost('${escapeHtml(p.title)}', '${ds}', '${escapeHtml(p.content || '')}', '${escapeHtml(relatedImg)}', '${escapeHtml(p.slug || '')}', '${p.image_slot || ''}', '${p.id}')">
            <div class="blog-related-img" style="background-image: url('${escapeHtml(relatedImg)}')"></div>
            <div class="blog-related-body">
              <div class="blog-related-date">${ds}</div>
              <div class="blog-related-title-text">${escapeHtml(p.title)}</div>
            </div>
          </div>`;
        }).join('')}</div>`;
      relatedEl.style.display = '';
    } else {
      relatedEl.style.display = 'none';
    }
  }
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  document.querySelector('nav')?.classList.add('hidden');
  if (progressEl) {
    progressEl.style.width = '0%';
    bodyEl.onscroll = () => {
      const pct = bodyEl.scrollTop / (bodyEl.scrollHeight - bodyEl.clientHeight) * 100;
      progressEl.style.width = Math.min(pct, 100) + '%';
    };
  }
}

function copyShareLink(encodedUrl) {
  const url = decodeURIComponent(encodedUrl);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector('.share-copy');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => btn.innerHTML = orig, 2000);
      }
    });
  }
}

function closeBlogPost(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById('blogModal');
  if (modal) modal.classList.remove('active');
  document.body.style.overflow = '';
  document.querySelector('nav')?.classList.remove('hidden');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeBlogPost();
});

let exchangeRates = {};

async function loadPricingData() {
  try {
    const res = await fetch(`${API_BASE}/api/pricing`);
    const data = await res.json();
    const pricing = data.pricing || {};
    exchangeRates = data.exchange_rates || {};
    const categories = ['construction', 'rehabilitation', 'forage'];
    categories.forEach(cat => {
      const container = document.getElementById(`pricingGrid-${cat}`);
      if (!container) return;
      const tiers = pricing[cat] || {};
      const tierKeys = Object.keys(tiers);
      const defaultProjectSize = cat === 'forage' ? 12 : 100;
      const catLabels = {
        construction: { unit: 'm²' },
        rehabilitation: { unit: 'm²' },
        forage: { unit: 'ml' }
      };
      container.innerHTML = tierKeys.map((tier, ti) => {
        const t = tiers[tier];
        const price = t.pricePerM2 || t.pricePerML || t.price || 0;
        const unit = t.unit || catLabels[cat]?.unit || 'm²';
        const budget = Math.round(price * defaultProjectSize);
        const type = getNestedTranslation(`pricing.tiers.${cat}.${tier}`) || t.name;
        const isFeatured = ti === 1;
        const priceLocale = currentLang === 'en' ? 'en-US' : 'fr-MG';
        const priceStr = price.toLocaleString(priceLocale);
        const priceEUR = exchangeRates.EUR ? Math.round(price / exchangeRates.EUR).toLocaleString(priceLocale) : null;
        const priceUSD = exchangeRates.USD ? Math.round(price / exchangeRates.USD).toLocaleString(priceLocale) : null;
        const badgeKey = cat === 'construction' && tier === 'standard' ? 'popular'
          : cat === 'rehabilitation' && tier === 'standard' ? 'recommended'
          : cat === 'forage' && tier === 'standard' ? 'allInclusive' : '';
        const badge = badgeKey ? getNestedTranslation(`pricing.badge.${badgeKey}`) : '';
        const foreignHtml = priceEUR && priceUSD ? `
          <div class="price-foreign">
            <div class="price-foreign-item">
              <span class="price-foreign-symbol">€</span>
              <span class="price-foreign-val">${priceEUR}</span>
            </div>
            <div class="price-foreign-item">
              <span class="price-foreign-symbol">$</span>
              <span class="price-foreign-val">${priceUSD}</span>
            </div>
          </div>` : '';
        return `
        <div class="price-card${isFeatured ? ' featured' : ''}" data-service="${cat}" data-tier="${tier}" data-tier-name="${escapeHtml(t.name)}" data-type="${escapeHtml(type)}" data-price="${price}" data-budget="${budget}">
          ${badge ? `<div class="price-badge">${badge}</div>` : ''}
          <div class="price-tier">${escapeHtml(t.name)}</div>
          <div class="price-type">${escapeHtml(type)}</div>
          <div class="price-val">
            <div class="price-main">
              <span class="price-num">${priceStr}</span>
              <span class="price-currency">Ar</span>
            </div>
            <div class="price-unit">/ ${unit}</div>
            ${foreignHtml}
          </div>
          <hr class="price-divider">
          <ul class="price-features">
            ${(t.features || []).map(f => `<li>${escapeHtml(f)}</li>`).join('')}
          </ul>
          <div class="price-note">${getNestedTranslation('pricing.priceNote')}</div>
          <a href="#contact" class="price-cta" onclick="fillContactForm(this)">${getNestedTranslation('pricing.cta')}</a>
        </div>`;
      }).join('');
    });
  } catch (err) { console.warn('Pricing load error:', err); ['construction', 'rehabilitation', 'forage'].forEach(cat => showSectionError('pricingGrid-' + cat, getNestedTranslation('dossiers.error') || 'Unable to load.')); }
}

async function loadConfigData() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    const cfg = await res.json();

    // Hero stats
    const heroExp = document.getElementById('heroExpYears');
    if (cfg.experience_years && heroExp) heroExp.textContent = cfg.experience_years;
    const heroStaff = document.getElementById('heroStaff');
    if (cfg.team_stats?.total_staff && heroStaff) heroStaff.textContent = cfg.team_stats.total_staff;
    const heroEng = document.getElementById('heroEngineers');
    if (cfg.team_stats?.civil_engineers && heroEng) heroEng.textContent = cfg.team_stats.civil_engineers;

    // Vision & Mission
    const visionEl = document.getElementById('visionText');
    if (visionEl) {
      if (cfg.vision) {
        visionEl.textContent = `"${cfg.vision}"`;
      } else {
        const fb = getNestedTranslation('vision.text');
        if (fb) visionEl.textContent = fb;
      }
    }
    const missionEl = document.getElementById('missionText');
    if (missionEl) {
      if (cfg.mission) {
        missionEl.textContent = `"${cfg.mission}"`;
      } else {
        const fb = getNestedTranslation('mission.text');
        if (fb) missionEl.textContent = fb;
      }
    }

    // Contact info
    const phoneEl = document.getElementById('contactPhone');
    if (phoneEl) {
      if (cfg.contact?.phone) {
        phoneEl.textContent = cfg.contact.phone;
      } else {
        const fb = getNestedTranslation('contact.phoneVal');
        if (fb) phoneEl.textContent = fb;
      }
    }
    const emailEl = document.getElementById('contactEmail');
    if (cfg.contact?.email && emailEl) emailEl.textContent = cfg.contact.email;
    const addrEl = document.getElementById('contactAddress');
    if (cfg.contact?.address && addrEl) addrEl.innerHTML = cfg.contact.address.replace(/\n/g, '<br>');

    // Numbers section
    const numExp = document.getElementById('numExpYears');
    if (cfg.experience_years && numExp) numExp.textContent = cfg.experience_years;
    const numStaff = document.getElementById('numStaff');
    if (cfg.team_stats?.total_staff && numStaff) numStaff.textContent = cfg.team_stats.total_staff;
    const numEng = document.getElementById('numEngineers');
    if (cfg.team_stats?.civil_engineers && numEng) numEng.textContent = cfg.team_stats.civil_engineers;

    // Social media links
    const socialContainer = document.getElementById('footerSocial');
    if (socialContainer && cfg.social) {
      let html = '';
      if (cfg.social.facebook) html += `<a href="${cfg.social.facebook}" target="_blank" rel="noopener" class="social-link" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>`;
      if (cfg.social.instagram) html += `<a href="${cfg.social.instagram}" target="_blank" rel="noopener" class="social-link" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg></a>`;
      if (html) socialContainer.innerHTML = html;
    }

    // Apply dynamic section content (overrides i18n defaults)
    applySectionContent(cfg);
  } catch (err) { console.warn('Config load error:', err); }
}

// ─── DYNAMIC SECTION CONTENT ───
function applySectionContent(cfg) {
  if (!cfg.sections) return;

  const s = cfg.sections;

  // Hero
  if (s.hero) {
    setElText('.hero-tag', s.hero.tag);
    setElHtml('#hero h1', s.hero.title);
    setElText('.hero-sub', s.hero.subtitle);
    setElText('.hero-badge-label', s.hero.badge);
    setElText('.hero-badge-year', s.hero.badgeYear);
  }

  // About
  if (s.about) {
    setElText('#about .section-tag', s.about.tag);
    setElHtml('#about h2', s.about.title);
    setElText('#about .section-lead', s.about.lead);
  }

  // Standards
  if (s.standards) {
    setElText('#technical-standards .section-tag', s.standards.tag);
    setElHtml('#technical-standards h2', s.standards.title);
    setElText('#technical-standards .section-lead', s.standards.lead);
  }

  // Values
  if (s.values) {
    const valueCards = document.querySelectorAll('#values .vm-card');
    if (valueCards.length >= 3) {
      const titles = valueCards[0].querySelector('.vm-label');
      const descs = valueCards[0].querySelector('.vm-text');
      if (titles && s.values.title1) titles.textContent = s.values.title1;
      if (descs && s.values.desc1) descs.textContent = s.values.desc1;
    }
    if (valueCards.length >= 3) {
      const titles = valueCards[1].querySelector('.vm-label');
      const descs = valueCards[1].querySelector('.vm-text');
      if (titles && s.values.title2) titles.textContent = s.values.title2;
      if (descs && s.values.desc2) descs.textContent = s.values.desc2;
    }
    if (valueCards.length >= 3) {
      const titles = valueCards[2].querySelector('.vm-label');
      const descs = valueCards[2].querySelector('.vm-text');
      if (titles && s.values.title3) titles.textContent = s.values.title3;
      if (descs && s.values.desc3) descs.textContent = s.values.desc3;
    }
  }

  // Team
  if (s.team) {
    setElText('#team .section-tag', s.team.tag);
    setElHtml('#team h2', s.team.title);
    setElText('#team .section-lead', s.team.lead);
  }

  // Services
  if (s.services) {
    setElText('#services .section-tag', s.services.tag);
    setElHtml('#services h2', s.services.title);
    setElText('#services .section-lead', s.services.lead);
  }

  // Pricing
  if (s.pricing) {
    setElText('#pricing .section-tag', s.pricing.tag);
    setElHtml('#pricing h2', s.pricing.title);
    setElText('#pricing .section-lead', s.pricing.lead);
    if (s.pricing.note) {
      const note = document.querySelector('.pricing-footer');
      if (note) note.innerHTML = s.pricing.note;
    }
  }

  // Calculator
  if (s.calculator) {
    setElText('#calculator .section-tag', s.calculator.tag);
    setElHtml('#calculator h2', s.calculator.title);
    setElText('#calculator .section-lead', s.calculator.lead);
  }

  // Projects
  if (s.projects) {
    setElText('#projects .section-tag', s.projects.tag);
    setElHtml('#projects h2', s.projects.title);
    setElText('#projects .section-lead', s.projects.lead);
  }

  // Dossiers
  if (s.dossiers) {
    setElText('#dossiers .section-tag', s.dossiers.tag);
    setElHtml('#dossiers h2', s.dossiers.title);
    setElText('#dossiers .section-lead', s.dossiers.lead);
  }

  // Blog
  if (s.blog) {
    setElText('#blog .section-tag', s.blog.tag);
    setElHtml('#blog h2', s.blog.title);
    setElText('#blog .section-lead', s.blog.lead);
  }

  // Contact
  if (s.contact) {
    setElText('#contact .section-tag', s.contact.tag);
    setElHtml('#contact h2', s.contact.title);
    setElText('#contact .section-lead', s.contact.lead);
  }

  // Numbers
  if (s.numbers) {
    const numLabels = document.querySelectorAll('#numbers .num-label');
    if (numLabels.length >= 4) {
      if (s.numbers.exp) numLabels[0].textContent = s.numbers.exp;
      if (s.numbers.tech) numLabels[1].textContent = s.numbers.tech;
      if (s.numbers.engineers) numLabels[2].textContent = s.numbers.engineers;
      if (s.numbers.sites) numLabels[3].textContent = s.numbers.sites;
    }
  }
}

function setElText(selector, text) {
  if (!text) return;
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function setElHtml(selector, html) {
  if (!html) return;
  const el = document.querySelector(selector);
  if (el) el.innerHTML = html;
}

function showSectionError(containerId, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-muted)"><p>${message}</p></div>`;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function sanitizeHtml(html) {
  if (!html) return '';
  const el = document.createElement('div');
  el.innerHTML = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/ on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/ on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/ on\w+\s*=\s*\S+/gi, '');
  return el.innerHTML;
}

// ═══════════════════════════════════════════════════════
// DOSSIERS — Vente de Terrains (Cloudinary)
// ═══════════════════════════════════════════════════════

let currentPdfId = '';
let currentPdfUrl = '';

function formatFileSize(bytes) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(0) + getNestedTranslation('format.kb');
  return (kb / 1024).toFixed(1) + getNestedTranslation('format.mb');
}

function openPdfViewer(id, name, url) {
  currentPdfId = id;
  currentPdfUrl = url;
  const modal = document.getElementById('pdfModal');
  const viewer = document.getElementById('pdfViewer');
  const title = document.getElementById('pdfModalTitle');
  const loading = document.getElementById('pdfLoading');
  if (!modal || !viewer) return;
  title.textContent = name || '';
  if (loading) loading.classList.remove('hidden');
  viewer.src = url;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { if (loading) loading.classList.add('hidden'); }, 2000);
}

function closePdfViewer(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById('pdfModal');
  const viewer = document.getElementById('pdfViewer');
  if (modal) modal.classList.remove('active');
  if (viewer) viewer.src = '';
  document.body.style.overflow = '';
}

function downloadCurrentPdf() {
  if (!currentPdfUrl) return;
  const a = document.createElement('a');
  a.href = currentPdfUrl.replace('/upload/', '/upload/fl_attachment/');
  a.download = '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePdfViewer();
});

async function loadDossiers() {
  const grid = document.getElementById('dossiersGrid');
  if (!grid) return;
  try {
    const res = await fetch(`/api/dossiers`);
    const dossiers = await res.json();
    if (!dossiers.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">
        <p style="font-size:1.1rem">${getNestedTranslation('dossiers.empty')}</p>
        <p style="font-size:0.85rem;margin-top:8px">${getNestedTranslation('dossiers.emptySub')}</p>
      </div>`;
      return;
    }
    function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
    function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    grid.innerHTML = dossiers.map(d => {
      const thumbUrl = d.thumbnail_url || '';
      return `
      <div class="dossier-card" data-id="${escAttr(d.id)}" data-name="${escAttr(d.name)}" data-url="${escAttr(d.cloudinary_url || '')}">
        <div class="dossier-thumb">
          <img src="${escAttr(thumbUrl)}" alt="${escAttr(d.name)}" class="img-reveal" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="dossier-thumb-fallback" style="display:none">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
        </div>
        <div class="dossier-name">${escHtml(d.name)}</div>
        <div class="dossier-meta">${formatFileSize(d.size)} — PDF</div>
        <span class="dossier-badge">${getNestedTranslation('dossiers.badge')}</span>
      </div>`;
    }).join('');
    grid.querySelectorAll('.dossier-card').forEach(card => {
      card.addEventListener('click', () => {
        openPdfViewer(card.dataset.id, card.dataset.name, card.dataset.url);
      });
    });
    initImageReveal();
  } catch (err) {
    console.warn('Dossiers load error:', err);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted)">
      <p>${getNestedTranslation('dossiers.error')}</p>
    </div>`;
  }
  initDossiersCarousel();
}

function initDossiersCarousel() {
  const grid = document.getElementById('dossiersGrid');
  const nav = document.querySelector('.dossiers-carousel-nav');
  if (!grid || !nav) return;
  const cards = grid.querySelectorAll('.dossier-card');
  nav.style.display = cards.length < 2 ? 'none' : '';

  const dotsContainer = nav.querySelector('.carousel-dots');
  const prevBtn = nav.querySelector('.carousel-prev');
  const nextBtn = nav.querySelector('.carousel-next');
  if (!dotsContainer) return;

  dotsContainer.innerHTML = '';
  let autoTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let isDragging = false;

  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => {
      scrollToIndex(i);
    });
    dotsContainer.appendChild(dot);
  });

  function getActiveIndex() {
    const scrollLeft = grid.scrollLeft;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      const dist = Math.abs(c.offsetLeft - scrollLeft);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }

  function updateDots() {
    const idx = getActiveIndex();
    dotsContainer.querySelectorAll('.carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  }

  function scrollToIndex(idx) {
    if (idx < 0 || idx >= cards.length) return;
    const target = cards[idx].offsetLeft;
    grid.scrollTo({ left: target, behavior: 'smooth' });
  }

  if (prevBtn) prevBtn.addEventListener('click', () => scrollToIndex(getActiveIndex() - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => scrollToIndex(getActiveIndex() + 1));

  grid.addEventListener('scroll', () => {
    updateDots();
    resetAutoTimer();
  }, { passive: true });

  grid.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isDragging = true;
    resetAutoTimer();
  }, { passive: true });

  grid.addEventListener('touchend', () => {
    isDragging = false;
    startAutoTimer();
  }, { passive: true });

  nav.addEventListener('mouseenter', () => clearAutoTimer());
  nav.addEventListener('mouseleave', () => startAutoTimer());

  function clearAutoTimer() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  function startAutoTimer() {
    clearAutoTimer();
    if (cards.length < 2) return;
    autoTimer = setInterval(() => {
      const next = getActiveIndex() + 1;
      if (next >= cards.length) {
        grid.scrollTo({ left: cards[0].offsetLeft, behavior: 'smooth' });
      } else {
        scrollToIndex(next);
      }
    }, 5000);
  }

  function resetAutoTimer() {
    clearAutoTimer();
    startAutoTimer();
  }

  startAutoTimer();
}

function initBlogReveal() {
  const entries = document.querySelectorAll('.timeline-entry:not(.timeline-visible)');
  if (!entries.length) return;
  const observer = new IntersectionObserver((entries_) => {
    entries_.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('timeline-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  entries.forEach(el => observer.observe(el));
}

// ═══════════════════════════════════════════════════════
// INTERACTIVE MAPS (Leaflet)
// ═══════════════════════════════════════════════════════

const CITY_COORDS = {
  'antsiranana': [-12.2833, 49.2833],
  'diego': [-12.2833, 49.2833],
  'nosybe': [-13.3167, 48.2667],
  'sambava': [-14.2667, 50.1667],
  'antalaha': [-14.8833, 50.2667],
  'ramena': [-12.3333, 49.3667],
  'mahalina': [-12.4167, 49.4667],
  'nosyhara': [-12.2333, 49.0],
  'anjianjia': [-12.3833, 49.3],
  'djabala': [-13.4167, 48.3],
  'mahatsinjo': [-13.35, 48.25],
  'antananarivo': [-18.9333, 47.5167],
  'toamasina': [-18.1667, 49.3833],
  'fianarantsoa': [-21.45, 47.0833],
  'mahajanga': [-15.7167, 46.3167],
  'toliara': [-23.35, 43.6667],
  'antsirabe': [-19.8667, 47.0333],
  'morondava': [-20.2833, 44.2833],
  'taolagnaro': [-25.0333, 46.9833],
  'antsohihy': [-14.8833, 47.9833],
  'ambatondrazaka': [-17.8333, 48.4167],
  'manakara': [-22.15, 48.0]
};

function getCityCoords(location) {
  if (!location) return null;
  const loc = location.toLowerCase().replace(/\s/g, '');
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (loc.includes(key)) return coords;
  }
  return null;
}

let officeMap = null;
let projectMap = null;

function initOfficeMap() {
  const el = document.getElementById('officeMap');
  if (!el || officeMap) return;
  officeMap = L.map(el, { zoomControl: true, scrollWheelZoom: false }).setView([-18.0, 47.5], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(officeMap);

  L.marker([-12.2833, 49.2833]).addTo(officeMap)
    .bindPopup('<strong>Antsiranana (Siège)</strong><br>Tanambao 1, face Madahoufi');
  L.marker([-13.3167, 48.2667]).addTo(officeMap)
    .bindPopup('<strong>Nosy Be (Antenne)</strong><br>Mahatsinjo');

  setTimeout(() => officeMap.invalidateSize(), 500);
}

function initProjectMap() {
  const el = document.getElementById('projectMap');
  if (!el || projectMap) return;
  projectMap = L.map(el, { zoomControl: true, scrollWheelZoom: false }).setView([-19.5, 47.0], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(projectMap);

  Promise.all([
    fetch(`${API_BASE}/api/projects`).then(r => r.json()),
    fetch('/api/images/slots').then(r => r.json()).catch(() => [])
  ]).then(([projects, slots]) => {
    const slotMap = {};
    slots.forEach(s => { slotMap[s.id] = s; });
    projects.forEach(p => {
      const coords = getCityCoords(p.location);
      if (!coords) return;
      const slotId = p.image_slot || `project-${p.id}`;
      const slot = slotMap[slotId];
      const imgUrl = (slot && slot.currentUrl && !slot.currentUrl.endsWith('placeholder.svg')) ? slot.currentUrl : null;
      const popupHtml = `<div style="min-width:160px">
        ${imgUrl ? `<img src="${imgUrl}" alt="${escapeHtml(p.title)}" style="width:100%;height:100px;object-fit:cover;border-radius:3px;margin-bottom:6px;">` : ''}
        <strong>${escapeHtml(p.title)}</strong><br>
        <span style="font-size:0.85rem;color:#666">${escapeHtml(p.location || '')}</span>
      </div>`;
      L.marker(coords).addTo(projectMap).bindPopup(popupHtml);
    });
  }).catch(() => {});

  setTimeout(() => projectMap.invalidateSize(), 500);
}

function initMaps() {
  if (typeof L === 'undefined') return;
  initOfficeMap();
  initProjectMap();
}

// ═══════════════════════════════════════════════════════
// INIT — Load default language
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  loadTranslations(currentLang);
  loadBlogCategories();
  loadImageSlots();
  loadTeam();
  loadServices();
  loadProjects();
  loadDossiers();
  loadBlog();
  loadPricingData();
  loadConfigData();
  initImageReveal();
  initMaps();
  initBudgetCurrencyConversion();
});

// ═══════════════════════════════════════════════════════
// BUDGET CURRENCY CONVERTER
// ═══════════════════════════════════════════════════════

function convertBudget() {
  const input = document.getElementById('budget');
  const select = document.getElementById('budgetCurrency');
  const amount = parseFloat(input.value);
  if (!amount || amount <= 0 || !exchangeRates.EUR) return;

  const oldCur = select.dataset.lastCurrency || 'Ar';
  const newCur = select.value;
  if (oldCur === newCur) return;

  const rateMap = { Ar: 1, EUR: exchangeRates.EUR, USD: exchangeRates.USD };
  const oldRate = rateMap[oldCur] || 1;
  const newRate = rateMap[newCur] || 1;

  const arValue = amount * oldRate;
  const converted = Math.round(arValue / newRate);

  input.value = converted;
  select.dataset.lastCurrency = newCur;
}

function initBudgetCurrencyConversion() {
  const select = document.getElementById('budgetCurrency');
  if (select) {
    select.addEventListener('change', convertBudget);
  }
}

// ═══════════════════════════════════════════════════════
// SSE — Live refresh when admin updates content
// ═══════════════════════════════════════════════════════

const EVENT_MAP = {
  'team': loadTeam,
  'services': loadServices,
  'projects': loadProjects,
  'blog': loadBlog,
  'blog-categories': loadBlogCategories,
  'pricing': loadPricingData,
  'config': loadConfigData,
  'dossiers': loadDossiers,
  'images': loadImageSlots
};

let sseReconnectTimer = null;

function initSSE() {
  if (sseReconnectTimer) {
    clearTimeout(sseReconnectTimer);
    sseReconnectTimer = null;
  }

  if (typeof EventSource === 'undefined') return;

  const es = new EventSource(`${API_BASE}/api/events`);

  es.addEventListener('open', () => {
    console.info('[SSE] connected');
  });

  for (const [eventName, handler] of Object.entries(EVENT_MAP)) {
    es.addEventListener(eventName, () => { handler(); });
  }

  es.addEventListener('error', () => {
    if (es.readyState === EventSource.CLOSED) {
      console.warn('[SSE] disconnected, retry in 5s');
      es.close();
      sseReconnectTimer = setTimeout(initSSE, 5000);
    }
  });
}

initSSE();
