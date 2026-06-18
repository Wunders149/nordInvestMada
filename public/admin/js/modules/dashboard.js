import { API_BASE, getHeaders, contacts, quotes } from './api.js';
import { escapeHtml, formatDateShort } from './helpers.js';
import { showSkeletonStats, showToast } from './ui.js';

export async function loadStats() {
  showSkeletonStats();
  try {
    const res = await fetch(`${API_BASE}/stats`, { headers: getHeaders() });
    if (res.status === 401) { localStorage.removeItem('adminToken'); window.location.href = '/admin/login.html'; return; }
    const data = await res.json();
    document.getElementById('statContacts').textContent = data.totalContacts;
    document.getElementById('statUnread').textContent = data.unreadContacts;
    document.getElementById('statQuotes').textContent = data.totalQuotes;
    document.getElementById('statPending').textContent = data.pendingQuotes;
    document.getElementById('statSubscribers').textContent = data.totalSubscribers;
    document.querySelectorAll('.stat-value').forEach(el => el.style.opacity = '');
    const badge = document.getElementById('navBadgeUnread');
    if (data.unreadContacts > 0) { badge.textContent = data.unreadContacts; badge.style.display = ''; }
    else { badge.style.display = 'none'; }
    document.getElementById('lastUpdate').textContent = `Mis à jour ${formatDateShort(data.lastUpdate)}`;
  } catch (err) { console.error('Stats error:', err); showToast('Erreur lors du chargement des statistiques', 'error'); }
}

export function renderCharts() {
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#B0B3B8' : '#65676B';
  const gridColor = isDark ? '#3A3B3C' : '#E4E6EB';

  const ctx1 = document.getElementById('contactsChart');
  if (ctx1) {
    const canvas = ctx1;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = 180 * 2;
    const c = canvas.getContext('2d');
    c.scale(2, 2);
    const w = canvas.offsetWidth;
    const h = 180;

    c.clearRect(0, 0, w, h);

    const monthly = {};
    contacts.forEach(ct => {
      const d = new Date(ct.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + 1;
    });
    const months = Object.keys(monthly).sort().slice(-6);
    const values = months.map(m => monthly[m] || 0);
    const maxVal = Math.max(...values, 1);

    if (months.length === 0) {
      c.fillStyle = textColor;
      c.font = '12px Inter, sans-serif';
      c.textAlign = 'center';
      c.fillText('Aucune donnée', w / 2, h / 2);
      return;
    }

    const pad = { top: 10, bottom: 24, left: 4, right: 4 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = Math.min(40, chartW / months.length * 0.6);
    const gap = chartW / months.length;

    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (chartH / 3) * i;
      c.strokeStyle = gridColor;
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(pad.left, y);
      c.lineTo(w - pad.right, y);
      c.stroke();
    }

    months.forEach((m, i) => {
      const x = pad.left + gap * i + (gap - barW) / 2;
      const barH = (values[i] / maxVal) * chartH;
      const y = pad.top + chartH - barH;

      const grad = c.createLinearGradient(x, y, x, pad.top + chartH);
      grad.addColorStop(0, '#1877F2');
      grad.addColorStop(1, '#72AAFF');
      c.fillStyle = grad;
      if (c.roundRect) {
        c.beginPath();
        c.roundRect(x, y, barW, barH, [3, 3, 0, 0]);
        c.fill();
      } else {
        c.fillRect(x, y, barW, barH);
      }

      c.fillStyle = textColor;
      c.font = '8px Inter, sans-serif';
      c.textAlign = 'center';
      const label = m.split('-')[1] + '/' + m.split('-')[0].slice(2);
      c.fillText(label, x + barW / 2, h - 4);
    });
  }

  const ctx2 = document.getElementById('quotesChart');
  if (ctx2) {
    const canvas = ctx2;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = 180 * 2;
    const c = canvas.getContext('2d');
    c.scale(2, 2);
    const w = canvas.offsetWidth;
    const h = 180;

    c.clearRect(0, 0, w, h);

    const statuses = ['pending', 'in-progress', 'completed', 'cancelled'];
    const labels = ['En attente', 'En cours', 'Terminé', 'Annulé'];
    const colors = ['#F5A623', '#1877F2', '#31A24C', '#8A8D91'];
    const counts = statuses.map(s => quotes.filter(q => (q.status || 'pending') === s).length);
    const total = counts.reduce((a, b) => a + b, 0);

    if (total === 0) {
      c.fillStyle = textColor;
      c.font = '12px Inter, sans-serif';
      c.textAlign = 'center';
      c.fillText('Aucune donnée', w / 2, h / 2);
      return;
    }

    const cx = w * 0.33;
    const cy = h / 2;
    const radius = Math.min(cx - 10, cy - 10, 55);
    const innerRadius = radius * 0.55;

    let startAngle = -Math.PI / 2;
    counts.forEach((count, i) => {
      if (count === 0) return;
      const sliceAngle = (count / total) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + innerRadius * Math.cos(startAngle), cy + innerRadius * Math.sin(startAngle));
      c.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      c.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      c.closePath();
      c.fillStyle = colors[i];
      c.fill();
      startAngle += sliceAngle;
    });

    c.fillStyle = textColor;
    c.font = 'bold 18px Inter, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(total, cx, cy - 4);
    c.font = '8px Inter, sans-serif';
    c.fillText('Total', cx, cy + 12);

    const legendX = w * 0.55;
    let legendY = 30;
    labels.forEach((label, i) => {
      if (counts[i] === 0) return;
      c.fillStyle = colors[i];
      c.beginPath();
      c.arc(legendX, legendY, 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = textColor;
      c.font = '11px Inter, sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(`${label} (${counts[i]})`, legendX + 12, legendY);
      legendY += 22;
    });
  }
}

export function renderDashboard() {
  renderDashContacts();
  renderDashQuotes();
}

function renderDashContacts() {
  const body = document.getElementById('dashContactsBody');
  if (!body) return;
  const recent = contacts.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  if (recent.length === 0) {
    body.innerHTML = '<div class="widget-empty">Aucun message pour le moment.</div>';
    return;
  }
  body.innerHTML = recent.map(c => {
    const dotClass = c.resolved ? 'resolved' : c.read ? 'read' : 'new';
    const label = c.resolved ? 'Résolu' : c.read ? 'Lu' : 'Nouveau';
    return `<div class="widget-item" onclick="openContactDetail('${c.id}')">
      <span class="wi-dot ${dotClass}"></span>
      <div class="wi-info">
        <div class="wi-name">${escapeHtml(c.name)}</div>
        <div class="wi-sub">${escapeHtml(c.message).substring(0, 60)}${c.message.length > 60 ? '…' : ''} · ${label}</div>
      </div>
      <span class="wi-date">${formatDateShort(c.date)}</span>
    </div>`;
  }).join('');
}

function renderDashQuotes() {
  const body = document.getElementById('dashQuotesBody');
  if (!body) return;
  const recent = quotes.filter(q => (q.status || 'pending') === 'pending').slice(0, 5);
  if (recent.length === 0) {
    body.innerHTML = '<div class="widget-empty">Aucun devis en attente.</div>';
    return;
  }
  body.innerHTML = recent.map(q => `
    <div class="widget-item" onclick="switchTab('quotes')">
      <span class="wi-dot pending"></span>
      <div class="wi-info">
        <div class="wi-name">${escapeHtml(q.name)}</div>
        <div class="wi-sub">${escapeHtml(q.serviceType)} · ${escapeHtml(q.location) || 'Non spécifié'}</div>
      </div>
      <span class="wi-date">${formatDateShort(q.date)}</span>
    </div>
  `).join('');
}
