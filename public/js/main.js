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
    a.addEventListener('click', () => {
      if (navLinks.classList.contains('active')) {
        closeMobileMenu();
      }
    });
  });
}
function closeMobileMenu() {
  navLinks.classList.add('closing');
  navLinks.classList.remove('active');
  hamburger.classList.remove('active');
  setTimeout(() => {
    navLinks.classList.remove('closing');
  }, 350);
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

  btn.textContent = getNestedTranslation('contact.sending');
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
  const formatPrice = (val) => new Intl.NumberFormat(priceLocale).format(val) + ' Ar';

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

  const tLocale = currentLang === 'en' ? 'en-US' : 'fr-MG';
  messageTextarea.value = `Bonjour, j'ai effectu\u00e9 une simulation sur votre site :\n- Service : ${service}\n- Gamme : ${tier}\n- Volume : ${surface}\n- Lieu : ${location}\n- Estimation : ${new Intl.NumberFormat(tLocale).format(total)} Ar TTC\n\nJe souhaite obtenir un devis d\u00e9finitif.`;

  setTimeout(() => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// ═══════════════════════════════════════════════════════
// GALLERY / LIGHTBOX
// ═══════════════════════════════════════════════════════

let galleryImages = [];

function rebuildGallery() {
  galleryImages = Array.from(document.querySelectorAll('.project-card img')).map(img => ({
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
      const img = document.querySelector(`[data-image-slot="${slot.id}"]`);
      if (img) {
        img.src = slot.currentUrl;
        img.dataset.originalSrc = slot.originalFile ? `/images/${slot.section}/${slot.originalFile}` : '';
      }
    });
    rebuildGallery();
  } catch (err) {
    // Silent fail — SVGs remain as fallbacks
  }
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
    grid.innerHTML = team.map(m => `
      <div class="team-card">
        <img src="/images/placeholder.svg" alt="${escapeHtml(m.name)}" class="team-avatar img-reveal" loading="lazy" data-image-slot="${m.image_slot || ''}">
        <div class="team-name">${escapeHtml(m.name)}</div>
        <div class="team-role">${escapeHtml(m.role)}</div>
        <div class="team-desc">${escapeHtml(m.bio)}</div>
      </div>
    `).join('');
    loadImageSlots();
    initImageReveal();
  } catch (err) { console.warn('Team load error:', err); }
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
  } catch (err) { console.warn('Services load error:', err); }
}

async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    const projects = await res.json();
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;
    grid.innerHTML = projects.map(p => `
      <div class="project-card">
        <img src="/images/projects/${(p.images && p.images[0]) || 'placeholder.svg'}" alt="${escapeHtml(p.title)}" class="project-img img-reveal" loading="lazy" data-image-slot="${p.image_slot || ''}">
        <div class="project-overlay">
          <div class="project-cat">${escapeHtml(p.category || '')}</div>
          <div class="project-name">${escapeHtml(p.title)}</div>
          <div class="project-loc">📍 ${escapeHtml(p.location || '')}</div>
        </div>
      </div>
    `).join('');
    // Re-attach gallery click listeners
    document.querySelectorAll('.project-card').forEach((card, index) => {
      card.addEventListener('click', () => openGallery(index));
    });
    loadImageSlots();
    initImageReveal();
  } catch (err) { console.warn('Projects load error:', err); }
}

async function loadBlog() {
  try {
    const res = await fetch(`${API_BASE}/api/blog`);
    const posts = await res.json();
    const grid = document.getElementById('blogGrid');
    if (!grid) return;
    const blogSvgs = { 'blog-construction': 'construction.svg', 'blog-forage': 'forage.svg', 'blog-immobilier': 'immobilier.svg' };
    grid.innerHTML = posts.map(p => {
      const date = new Date(p.date);
      const dateLocale = currentLang === 'mg' ? 'mg-MG' : currentLang === 'en' ? 'en-US' : 'fr-FR';
      const dateStr = date.toLocaleDateString(dateLocale, { day: '2-digit', month: 'long', year: 'numeric' });
      const blogSvg = blogSvgs[p.image_slot] || 'construction.svg';
      return `
      <article class="blog-card">
        <img src="/images/blog/${blogSvg}" alt="${escapeHtml(p.title)}" class="blog-img img-reveal" loading="lazy" data-image-slot="${p.image_slot || ''}">
        <div class="blog-body">
          <div class="blog-date">${dateStr}</div>
          <div class="blog-title">${escapeHtml(p.title)}</div>
          <div class="blog-excerpt">${escapeHtml(p.excerpt)}</div>
          <a href="#" class="blog-link">${getNestedTranslation('blog.readmore')}</a>
        </div>
      </article>`;
    }).join('');
    loadImageSlots();
    initImageReveal();
  } catch (err) { console.warn('Blog load error:', err); }
}

async function loadPricingData() {
  try {
    const res = await fetch(`${API_BASE}/api/pricing`);
    const data = await res.json();
    const pricing = data.pricing || {};
    const categories = ['construction', 'rehabilitation', 'forage'];
    categories.forEach(cat => {
      const container = document.getElementById(`pricingGrid-${cat}`);
      if (!container) return;
      const tiers = pricing[cat] || {};
      const tierKeys = Object.keys(tiers);
      const catLabels = {
        construction: { unit: 'm²', budgetMap: { economic: '10-25', standard: '25-100', premium: '100+' } },
        rehabilitation: { unit: 'm²', budgetMap: { economic: '5-15', standard: '15-50', premium: '50+' } },
        forage: { unit: 'ml', budgetMap: { economic: '', standard: '2.5-5', premium: '' } }
      };
      container.innerHTML = tierKeys.map((tier, ti) => {
        const t = tiers[tier];
        const price = t.pricePerM2 || t.pricePerML || t.price || 0;
        const unit = t.unit || catLabels[cat]?.unit || 'm²';
        const budget = catLabels[cat]?.budgetMap[tier] || '';
        const type = getNestedTranslation(`pricing.tiers.${cat}.${tier}`) || t.name;
        const isFeatured = ti === 1;
        const priceLocale = currentLang === 'en' ? 'en-US' : 'fr-MG';
        const priceStr = price.toLocaleString(priceLocale);
        const badgeKey = cat === 'construction' && tier === 'standard' ? 'popular'
          : cat === 'rehabilitation' && tier === 'standard' ? 'recommended'
          : cat === 'forage' && tier === 'standard' ? 'allInclusive' : '';
        const badge = badgeKey ? getNestedTranslation(`pricing.badge.${badgeKey}`) : '';
        return `
        <div class="price-card${isFeatured ? ' featured' : ''}" data-service="${cat}" data-tier="${tier}" data-type="${escapeHtml(type)}" data-price="${price}" data-budget="${budget}">
          ${badge ? `<div class="price-badge">${badge}</div>` : ''}
          <div class="price-tier">${escapeHtml(t.name)}</div>
          <div class="price-type">${escapeHtml(type)}</div>
          <div class="price-val">
            <div class="price-num">${priceStr}</div>
            <div class="price-unit">Ar / ${unit}</div>
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
  } catch (err) { console.warn('Pricing load error:', err); }
}

async function loadConfigData() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    const cfg = await res.json();

    // Hero stats
    if (cfg.experience_years) document.getElementById('heroExpYears').textContent = cfg.experience_years;
    if (cfg.team?.total_staff) document.getElementById('heroStaff').textContent = cfg.team.total_staff;

    // Vision & Mission
    if (cfg.vision) document.getElementById('visionText').textContent = `"${cfg.vision}"`;
    if (cfg.mission) document.getElementById('missionText').textContent = `"${cfg.mission}"`;

    // Contact info
    if (cfg.contact?.phone) document.getElementById('contactPhone').textContent = cfg.contact.phone;
    if (cfg.contact?.email) document.getElementById('contactEmail').textContent = cfg.contact.email;
    if (cfg.contact?.address) document.getElementById('contactAddress').innerHTML = cfg.contact.address.replace(/\n/g, '<br>');

    // Numbers section
    if (cfg.experience_years) document.getElementById('numExpYears').textContent = cfg.experience_years;
    if (cfg.team?.total_staff) document.getElementById('numStaff').textContent = cfg.team.total_staff;
    if (cfg.team?.civil_engineers) document.getElementById('numEngineers').textContent = cfg.team.civil_engineers;
  } catch (err) { console.warn('Config load error:', err); }
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
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
  if (!modal || !viewer) return;
  title.textContent = name || '';
  viewer.src = url;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
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
}

// ═══════════════════════════════════════════════════════
// INIT — Load default language
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadTranslations(currentLang);
  loadImageSlots();
  loadTeam();
  loadServices();
  loadProjects();
  loadDossiers();
  loadBlog();
  loadPricingData();
  loadConfigData();
  initImageReveal();
});
