// Mobile menu toggle
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if (hamburger) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
  });
  navLinks.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navLinks.classList.remove('active');
  });
}

// Tab switching
function switchTab(name) {
  document.querySelectorAll('.pricing-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
}

// Auto-fill contact form from pricing card
function fillContactForm(button) {
  const card = button.closest('.price-card');
  const service = card.getAttribute('data-service');
  const tier = card.getAttribute('data-tier');
  const type = card.getAttribute('data-type');
  const price = card.getAttribute('data-price');
  const budgetRange = card.getAttribute('data-budget');

  // Map service to form values
  const serviceMap = {
    'construction': 'construction',
    'rehabilitation': 'rehabilitation',
    'forage': 'forage'
  };

  // Pre-fill form fields
  const serviceSelect = document.getElementById('serviceType');
  const projectInput = document.getElementById('projectType');
  const budgetInput = document.getElementById('budget');
  const messageTextarea = document.getElementById('message');

  serviceSelect.value = serviceMap[service] || '';
  projectInput.value = `${type} (${tier})`;

  // Set budget estimate based on tier
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

  // Pre-fill message with pricing info
  const serviceLabel = {
    'construction': 'Construction Neuve',
    'rehabilitation': 'Réhabilitation',
    'forage': 'Forage d\'Eau'
  }[service] || '';

  messageTextarea.value = `Je suis intéressé par : ${type}\nFormule : ${tier}\nTarif référence : ${price ? price + ' Ar/m²' : 'Sur devis'}\n\nMerci de me contacter pour un devis détaillé.`;

  // Scroll to contact form
  setTimeout(() => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// Form submit
function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const messageDiv = document.getElementById('formMessage');
  const form = document.getElementById('contactForm');

  // Show loading state
  btn.textContent = '⏳ Envoi en cours...';
  btn.disabled = true;
  messageDiv.style.display = 'none';

  // Collect form data
  const formData = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value || '',
    serviceType: document.getElementById('serviceType').value,
    projectType: document.getElementById('projectType').value,
    budget: document.getElementById('budget').value || '',
    message: document.getElementById('message').value
  };

  // Send to backend (or simulate if offline)
  // Use current origin if possible, fallback to localhost:3000
  const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3000' : window.location.origin;

  fetch(`${API_BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  })
  .then(response => response.json())
  .then(result => {
    btn.textContent = '✓ Message envoyé !';
    btn.style.background = '#2a7a4a';
    messageDiv.textContent = '✓ Votre demande a été reçue. Nous vous répondrons sous 24h.';
    messageDiv.style.display = 'block';
    messageDiv.style.color = '#2a7a4a';
    form.reset();

    // Track with analytics
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
    messageDiv.textContent = '❌ Erreur lors de l\'envoi. Contactez-nous au 032 82 312 80.';
    messageDiv.style.display = 'block';
    messageDiv.style.color = '#E8614A';
    btn.textContent = 'Envoyer ma Demande';
    btn.disabled = false;
  });
}

// Pricing calculator function (optional - can be called from UI)
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

// Analytics tracking
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pricing_tab_view', {
        'tab_name': this.textContent
      });
    }
  });
});

document.querySelectorAll('.btn-primary, .nav-cta').forEach(btn => {
  btn.addEventListener('click', function() {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'cta_click', {
        'button_text': this.textContent
      });
    }
  });
});

// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ─── CALCULATOR LOGIC ───
function updateCalcFields() {
  const service = document.getElementById('calc-service').value;
  const labelSurface = document.getElementById('label-surface');
  const groupSurface = document.getElementById('group-surface');
  const inputSurface = document.getElementById('calc-surface');
  const tierSelect = document.getElementById('calc-tier');
  
  // Reset options first
  Array.from(tierSelect.options).forEach(opt => opt.style.display = 'block');

  if (service === 'forage') {
    labelSurface.textContent = 'Profondeur estimée (ML)';
    inputSurface.value = 40;
    // Forage study (economic) is fixed, so surface doesn't matter there, 
    // but the API handles it.
  } else {
    labelSurface.textContent = 'Surface estimée (m²)';
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

  // Show loading
  resultPanel.innerHTML = `
    <div class="result-placeholder">
      <div class="loading-spinner">⏳</div>
      <p>Calcul de votre estimation en cours...</p>
    </div>
  `;

  const data = await calculatePricing(serviceType, squareMeters, finishingLevel, location);

  if (!data || data.error) {
    resultPanel.innerHTML = `
      <div class="result-placeholder">
        <p style="color: var(--rust-light);">❌ Erreur lors du calcul. Veuillez réessayer.</p>
      </div>
    `;
    return;
  }

  const formatPrice = (val) => new Intl.NumberFormat('fr-MG').format(val) + ' Ar';

  resultPanel.innerHTML = `
    <div class="result-header">
      <div class="result-title">Estimation Prévisionnelle</div>
      <div class="result-main">${formatPrice(data.grandTotal)}</div>
      <div class="result-unit">Toutes Taxes Comprises (TTC)</div>
    </div>
    
    <div class="result-details">
      <div class="detail-item">
        <span>Base ${data.serviceType} (${data.finishingLevel})</span>
        <span>${formatPrice(data.basePrice)} / ${data.serviceType === 'forage' ? 'ml' : 'm²'}</span>
      </div>
      <div class="detail-item">
        <span>Sous-total HT</span>
        <span>${formatPrice(data.subtotal)}</span>
      </div>
      <div class="detail-item">
        <span>Marge de sécurité (10%)</span>
        <span>${formatPrice(data.contingency)}</span>
      </div>
      <div class="detail-item">
        <span>TVA (20%)</span>
        <span>${formatPrice(data.tax)}</span>
      </div>
      <div class="detail-item total">
        <span>Total estimé</span>
        <span>${formatPrice(data.grandTotal)}</span>
      </div>
    </div>
    
    <p class="result-note">
      * Cette estimation est fournie à titre indicatif. Elle ne remplace pas un devis formel après visite technique.
    </p>
    
    <a href="#contact" class="price-cta" style="margin-top: 32px;" onclick="transferToForm('${serviceType}', '${finishingLevel}', ${squareMeters}, '${location}', ${data.grandTotal})">
      Demander un devis officiel
    </a>
  `;
}

function transferToForm(service, tier, surface, location, total) {
  const serviceSelect = document.getElementById('serviceType');
  const projectInput = document.getElementById('projectType');
  const messageTextarea = document.getElementById('message');
  
  serviceSelect.value = service;
  projectInput.value = `Simulation: ${service} ${tier} (${surface} units) à ${location}`;
  
  messageTextarea.value = `Bonjour, j'ai effectué une simulation sur votre site :\n- Service : ${service}\n- Gamme : ${tier}\n- Volume : ${surface}\n- Lieu : ${location}\n- Estimation : ${new Intl.NumberFormat('fr-MG').format(total)} Ar TTC\n\nJe souhaite obtenir un devis définitif.`;
  
  setTimeout(() => {
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}
