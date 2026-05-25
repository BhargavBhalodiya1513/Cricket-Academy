/**
 * dashboard.js
 * Loads all dashboard statistics and charts from Firestore.
 * Crash-proof: all async calls in try/catch, DOM null-checked.
 */

import { getDocuments, subscribeCollection } from './firebase-db.js';
import { showToast, formatCurrency, getStatusBadge, escapeHtml } from './main.js';

let attendanceChart = null;
let _unsubPlayers   = null;
let _unsubFees      = null;

/**
 * Main entry point — called after auth resolves.
 * Uses real-time subscriptions for stats and one-time fetches for chart data.
 */
export function loadDashboard() {
  loadStats();
  loadChartData();
  loadActivityFeed();
}

// ─── STATS ──────────────────────────────────────────────────────────────────────

function loadStats() {
  // Unsubscribe previous listeners if any (prevent memory leaks on refresh)
  _unsubPlayers?.();
  _unsubFees?.();

  // Real-time player count
  _unsubPlayers = subscribeCollection(
    'players',
    (docs) => {
      setStatValue('stat-players', docs.length);
      renderRecentPlayers(docs.slice(-5).reverse());
    },
    () => setStatValue('stat-players', 'Err')
  );

  // Real-time pending fees count
  _unsubFees = subscribeCollection(
    'fees',
    (docs) => {
      const pending = docs.filter((d) => (d.status || '').toLowerCase() === 'pending');
      setStatValue('stat-pending-fees', pending.length);
      renderPendingFees(pending.slice(0, 5));
    },
    () => setStatValue('stat-pending-fees', 'Err')
  );

  // Batch count
  loadBatchCount();
  // Today's attendance
  loadTodayAttendance();
}

async function loadBatchCount() {
  const { data, error } = await getDocuments('batches');
  setStatValue('stat-batches', error ? 'Err' : data.length);
}

async function loadTodayAttendance() {
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  const { data, error } = await getDocuments('attendance');
  if (error) { setStatValue('stat-present', 'Err'); return; }
  const presentToday = data.filter((d) => {
    const dDate = d.date?.split?.('T')?.[0] || d.date || '';
    return dDate === today && (d.status || '').toLowerCase() === 'present';
  });
  setStatValue('stat-present', presentToday.length);
}

function setStatValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '0';
}

// ─── ATTENDANCE CHART ────────────────────────────────────────────────────────────

async function loadChartData() {
  const indicatorEl = document.getElementById('chart-loading-indicator');

  const { data, error } = await getDocuments('attendance');
  if (indicatorEl) indicatorEl.style.display = 'none';

  if (error) {
    showToast('Failed to load chart data.', 'warning');
    return;
  }

  // Build last 7 days labels and counts
  const labels = [];
  const presentCounts = [];
  const absentCounts  = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    labels.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));

    const dayRecords = data.filter((rec) => {
      const rDate = rec.date?.split?.('T')?.[0] || rec.date || '';
      return rDate === dateStr;
    });
    presentCounts.push(dayRecords.filter((r) => (r.status || '').toLowerCase() === 'present').length);
    absentCounts.push(dayRecords.filter((r)  => (r.status || '').toLowerCase() === 'absent').length);
  }

  renderChart(labels, presentCounts, absentCounts);
}

function renderChart(labels, present, absent) {
  const canvas = document.getElementById('attendance-chart');
  if (!canvas) return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#8eabbe' : '#526475';

  // Destroy previous chart instance to avoid canvas reuse error
  if (attendanceChart) {
    try { attendanceChart.destroy(); } catch (_) {}
    attendanceChart = null;
  }

  try {
    const ctx = canvas.getContext('2d');
    attendanceChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Present',
            data: present,
            backgroundColor: 'rgba(15, 76, 92, 0.8)',
            borderColor: '#0f4c5c',
            borderWidth: 1.5,
            borderRadius: 6,
          },
          {
            label: 'Absent',
            data: absent,
            backgroundColor: 'rgba(158, 42, 43, 0.6)',
            borderColor: '#9e2a2b',
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: textColor, font: { family: 'Inter', size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} players`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor },
          },
          y: {
            beginAtZero: true,
            ticks: { color: textColor, stepSize: 1, precision: 0 },
            grid: { color: gridColor },
          },
        },
        animation: { duration: 800, easing: 'easeOutCubic' },
      },
    });
  } catch (err) {
    console.error('[Dashboard] Chart render failed:', err);
    showToast('Chart render failed.', 'warning');
  }
}

// ─── RECENT PLAYERS ──────────────────────────────────────────────────────────────

function renderRecentPlayers(players) {
  const tbody = document.getElementById('recent-players-body');
  if (!tbody) return;

  if (!players || players.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3">
      <div class="empty-state" style="padding:2rem;">
        <i class="bi bi-people"></i><p>No players yet</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = players.map((p) => `
    <tr>
      <td>
        <div style="font-weight:600;font-size:0.875rem;">${escapeHtml(p.name || '—')}</div>
        <div style="font-size:0.75rem;color:var(--clr-text-muted);">Age: ${escapeHtml(String(p.age || '—'))}</div>
      </td>
      <td><span style="font-size:0.82rem;">${escapeHtml(p.playingType || '—')}</span></td>
      <td>${getStatusBadge(p.feesStatus || 'pending')}</td>
    </tr>
  `).join('');
}

// ─── PENDING FEES ────────────────────────────────────────────────────────────────

function renderPendingFees(fees) {
  const tbody = document.getElementById('pending-fees-body');
  if (!tbody) return;

  if (!fees || fees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3">
      <div class="empty-state" style="padding:2rem;">
        <i class="bi bi-check-circle" style="color:var(--clr-success-light);"></i>
        <p>No pending fees!</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = fees.map((f) => `
    <tr>
      <td style="font-weight:600;font-size:0.875rem;">${escapeHtml(f.playerName || f.playerId || '—')}</td>
      <td style="font-size:0.875rem;">${formatCurrency(f.amount)}</td>
      <td>${getStatusBadge('pending')}</td>
    </tr>
  `).join('');
}

// ─── ACTIVITY FEED ───────────────────────────────────────────────────────────────

async function loadActivityFeed() {
  const feedEl = document.getElementById('activity-feed');
  if (!feedEl) return;

  // Fetch recent records from all major collections
  const [players, fees, attendance] = await Promise.all([
    getDocuments('players'),
    getDocuments('fees'),
    getDocuments('attendance'),
  ]);

  const activities = [];

  // Merge all activities and sort by creation time
  (players.data || []).forEach((p) => {
    if (p.createdAt) activities.push({ type: 'player', text: `Player added: <strong>${escapeHtml(p.name || 'Unknown')}</strong>`, ts: p.createdAt, dot: 'dot-player' });
  });
  (fees.data || []).forEach((f) => {
    if (f.createdAt) activities.push({ type: 'fee', text: `Fee recorded: <strong>${escapeHtml(f.playerName || 'Player')}</strong> — ${formatCurrency(f.amount)}`, ts: f.createdAt, dot: 'dot-fee' });
  });
  (attendance.data || []).forEach((a) => {
    if (a.createdAt) activities.push({ type: 'attend', text: `Attendance marked: <strong>${escapeHtml(a.playerName || 'Player')}</strong> — ${escapeHtml(a.status || '—')}`, ts: a.createdAt, dot: 'dot-attend' });
  });

  // Sort newest first
  activities.sort((a, b) => {
    const ta = a.ts?.toDate?.() || new Date(a.ts || 0);
    const tb = b.ts?.toDate?.() || new Date(b.ts || 0);
    return tb - ta;
  });

  const recent = activities.slice(0, 8);

  if (recent.length === 0) {
    feedEl.innerHTML = `<div class="empty-state" style="padding:2rem;"><i class="bi bi-clock-history"></i><p>No recent activity</p></div>`;
    return;
  }

  const iconMap = { player: 'bi-person-plus', fee: 'bi-cash-coin', attend: 'bi-calendar-check', batch: 'bi-layers' };

  feedEl.innerHTML = recent.map((act) => {
    const timeStr = (() => {
      try {
        const d = act.ts?.toDate ? act.ts.toDate() : new Date(act.ts);
        return d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
      } catch (_) { return ''; }
    })();
    return `
      <div class="activity-item">
        <div class="activity-dot ${escapeHtml(act.dot)}">
          <i class="bi ${iconMap[act.type] || 'bi-circle'}" aria-hidden="true"></i>
        </div>
        <div class="activity-content">
          <p>${act.text}</p>
          <small>${escapeHtml(timeStr)}</small>
        </div>
      </div>`;
  }).join('');
}
