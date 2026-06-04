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
  let theme = 'dark';
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

function setLanguage(lang) {
  loadTranslations(lang);
  // Track analytics
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
// MOBILE MENU
// ═══════════════════════════════════════════════════════

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if (hamburger) {
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
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
      target.scrollIntoView({ behavior: 'smooth' });
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
  const tier = card.getAttribute('data-tier');
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
  const messageTextarea = document.getElementById('message');

  serviceSelect.value = serviceMap[service] || '';
  projectInput.value = `${type} (${tier})`;

  if (budgetRange) {
    const budgetLabel = {
      '10-25': '10-25 millions Ar',
      '25-100': '25-100 millions Ar',
      '100+': '100+ millions Ar',
      '5-15': '5-15 millions Ar',
      '15-50': '15-50 millions Ar',
      '50+': '50+ millions Ar',
      '2.5-5': '2.5-5 millions Ar'
    }[budgetRange] || '';
    budgetInput.value = budgetLabel;
  }

  const serviceLabel = {
    'construction': 'Construction Neuve',
    'rehabilitation': 'Réhabilitation',
    'forage': 'Forage d\'Eau'
  }[service] || '';

  messageTextarea.value = `Je suis intéressé par : ${type}\nFormule : ${tier}\nTarif référence : ${price ? price + ' Ar/m²' : 'Sur devis'}\n\nMerci de me contacter pour un devis détaillé.`;

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

  btn.textContent = '⏳ Envoi en cours...';
  btn.disabled = true;
  messageDiv.style.display = 'none';

  const formData = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value || '',
    serviceType: document.getElementById('serviceType').value,
    projectType: document.getElementById('projectType').value,
    budget: document.getElementById('budget').value || '',
    message: document.getElementById('message').value
  };

  const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin;

  fetch(`${API_BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  })
  .then(response => response.json())
  .then(result => {
    btn.textContent = '\u2713 Message envoy\u00e9 !';
    btn.style.background = '#2a7a4a';
    messageDiv.textContent = '\u2713 Votre demande a \u00e9t\u00e9 re\u00e7ue. Nous vous r\u00e9pondrons sous 24h.';
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
      btn.textContent = 'Envoyer ma Demande';
      btn.style.background = '';
      btn.disabled = false;
      messageDiv.style.display = 'none';
    }, 5000);
  })
  .catch(error => {
    console.error('Error:', error);
    messageDiv.textContent = '\u274c Erreur lors de l\'envoi. Contactez-nous au 032 82 312 80.';
    messageDiv.style.display = 'block';
    messageDiv.style.color = '#E8614A';
    btn.textContent = 'Envoyer ma Demande';
    btn.disabled = false;
  });
}

// ═══════════════════════════════════════════════════════
// PRICING CALCULATOR
// ═══════════════════════════════════════════════════════

async function calculatePricing(serviceType, squareMeters, finishingLevel, location) {
  const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin;
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
    const depthKey = currentLang === 'en' ? 'calculator.depthLabel' : currentLang === 'mg' ? 'calculator.depthLabel' : 'calculator.depthLabel';
    labelSurface.textContent = getNestedTranslation(`calculator.depthLabel`) || 'Profondeur estimée (ML)';
    inputSurface.value = 40;
  } else {
    labelSurface.textContent = getNestedTranslation(`calculator.surfaceLabel`) || 'Surface estimée (m²)';
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
    alert('Veuillez entrer une surface valide.');
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

  const formatPrice = (val) => new Intl.NumberFormat('fr-MG').format(val) + ' Ar';

  const rTitle = getNestedTranslation('calculator.resultTitle') || 'Estimation Prévisionnelle';
  const rUnit = getNestedTranslation('calculator.resultUnit') || 'Toutes Taxes Comprises (TTC)';
  const dBase = getNestedTranslation('calculator.detailBase') || 'Base';
  const dSub = getNestedTranslation('calculator.detailSubtotal') || 'Sous-total HT';
  const dCont = getNestedTranslation('calculator.detailContingency') || 'Marge de sécurité (10%)';
  const dTax = getNestedTranslation('calculator.detailTax') || 'TVA (20%)';
  const dTotal = getNestedTranslation('calculator.detailTotal') || 'Total estimé';
  const rNote = getNestedTranslation('calculator.resultNote') || '* Cette estimation est fournie à titre indicatif.';
  const rCTA = getNestedTranslation('calculator.resultCTA') || 'Demander un devis officiel';

  resultPanel.innerHTML = `
    <div class="result-header">
      <div class="result-title">${rTitle}</div>
      <div class="result-main">${formatPrice(data.grandTotal)}</div>
      <div class="result-unit">${rUnit}</div>
    </div>
    <div class="result-details">
      <div class="detail-item">
        <span>${dBase} ${data.serviceType} (${data.finishingLevel})</span>
        <span>${formatPrice(data.basePrice)} / ${data.serviceType === 'forage' ? 'ml' : 'm²'}</span>
      </div>
      <div class="detail-item">
        <span>${dSub}</span>
        <span>${formatPrice(data.subtotal)}</span>
      </div>
      <div class="detail-item">
        <span>${dCont}</span>
        <span>${formatPrice(data.contingency)}</span>
      </div>
      <div class="detail-item">
        <span>${dTax}</span>
        <span>${formatPrice(data.tax)}</span>
      </div>
      <div class="detail-item total">
        <span>${dTotal}</span>
        <span>${formatPrice(data.grandTotal)}</span>
      </div>
    </div>
    <p class="result-note">${rNote}</p>
    <a href="#contact" class="price-cta" style="margin-top:32px;" onclick="transferToForm('${serviceType}', '${finishingLevel}', ${squareMeters}, '${location}', ${data.grandTotal})">${rCTA}</a>
  `;
}

function transferToForm(service, tier, surface, location, total) {
  const serviceSelect = document.getElementById('serviceType');
  const projectInput = document.getElementById('projectType');
  const messageTextarea = document.getElementById('message');

  serviceSelect.value = service;
  projectInput.value = `Simulation: ${service} ${tier} (${surface} units) \u00e0 ${location}`;

  messageTextarea.value = `Bonjour, j'ai effectu\u00e9 une simulation sur votre site :\n- Service : ${service}\n- Gamme : ${tier}\n- Volume : ${surface}\n- Lieu : ${location}\n- Estimation : ${new Intl.NumberFormat('fr-MG').format(total)} Ar TTC\n\nJe souhaite obtenir un devis d\u00e9finitif.`;

  setTimeout(() => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// ═══════════════════════════════════════════════════════
// GALLERY / LIGHTBOX
// ═══════════════════════════════════════════════════════

const galleryImages = Array.from(document.querySelectorAll('.project-card img')).map(img => ({
  src: img.src,
  alt: img.alt
}));

let galleryIndex = 0;

function openGallery(index) {
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

// Attach click listeners to project cards
document.querySelectorAll('.project-card').forEach((card, index) => {
  card.addEventListener('click', () => openGallery(index));
});

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
// ANIMATED COUNTERS
// ═══════════════════════════════════════════════════════

function animateCounters() {
  document.querySelectorAll('#numbers .num-val').forEach(el => {
    const text = el.textContent.trim();
    const suffix = text.includes('+') ? '+' : '';
    const target = parseInt(text.replace('+', '').replace(/\s/g, ''), 10);
    if (isNaN(target)) return;
    const duration = 1500;
    const start = performance.now();
    el.innerHTML = `<span class="num-count">0</span>${suffix}`;
    const countEl = el.querySelector('.num-count');
    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      countEl.textContent = current;
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
  msg.textContent = '...';
  msg.className = 'newsletter-msg';
  const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin;
  try {
    const res = await fetch(`${API_BASE}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.success) {
      msg.textContent = '\u2713 Merci pour votre inscription !';
      msg.className = 'newsletter-msg success';
      document.getElementById('newsletterForm').reset();
    } else {
      msg.textContent = data.error || 'Erreur. R\u00e9essayez.';
      msg.className = 'newsletter-msg error';
    }
  } catch {
    msg.textContent = 'Erreur de connexion. R\u00e9essayez.';
    msg.className = 'newsletter-msg error';
  }
}

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

document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => observer.observe(el));

// ═══════════════════════════════════════════════════════
// IMAGE SLOT SWAP — Replace SVG placeholders with uploaded images
// ═══════════════════════════════════════════════════════

async function loadImageSlots() {
  try {
    const res = await fetch('/api/images/slots');
    if (!res.ok) return;
    const slots = await res.json();
    slots.forEach(slot => {
      if (!slot.uploadedFile) return;
      const img = document.querySelector(`[data-image-slot="${slot.id}"]`);
      if (img) {
        img.src = slot.currentUrl;
        img.dataset.originalSrc = `/images/${slot.section}/${slot.originalFile}`;
      }
    });
  } catch (err) {
    // Silent fail — SVGs remain as fallbacks
  }
}

// ═══════════════════════════════════════════════════════
// INIT — Load default language
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadTranslations(currentLang);
  loadImageSlots();
});
