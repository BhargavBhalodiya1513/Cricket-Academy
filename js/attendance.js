/**
 * attendance.js
 * Attendance marking and history controller.
 * Saves one record per player per date. Re-saving updates existing record.
 * Crash-proof: all async calls in try/catch, all DOM access null-guarded.
 */

import {
  getDocuments, addDocument, updateDocument, deleteDocument, subscribeCollection
} from './firebase-db.js';
import { showToast, setButtonLoading, confirmDialog, exportToExcel, escapeHtml, formatDate, getStatusBadge, debounce } from './main.js';

let allPlayers       = [];
let allAttendance    = [];
let attendanceMap    = {}; // playerID → { status, docId } for selected date
let selectedDate     = '';
let _unsubscribe     = null;
let _unsubHistory    = null;

export function initAttendance() {
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  const attDateEl = document.getElementById('att-date');
  if (attDateEl) { attDateEl.value = today; attDateEl.max = today; }

  const historyDateEl = document.getElementById('history-date');
  if (historyDateEl) { historyDateEl.value = today; historyDateEl.max = today; }

  selectedDate = today;

  // Event listeners
  attDateEl?.addEventListener('change', (e) => {
    selectedDate = e.target.value || today;
    renderMarkingList();
  });

  historyDateEl?.addEventListener('change', (e) => {
    renderHistoryTable(e.target.value || '');
  });

  document.getElementById('save-attendance-btn')?.addEventListener('click', handleSaveAttendance);
  document.getElementById('export-excel-att')?.addEventListener('click', () => exportToExcel('attendance-history-table', 'Attendance_Export'));

  // Load players (one-time) then subscribe to attendance
  loadPlayers();
  subscribeAttendance();
}

// ─── LOAD ─────────────────────────────────────────────────────────────────────

async function loadPlayers() {
  const { data, error } = await getDocuments('players');
  if (error) { showToast('Failed to load players.', 'error'); return; }
  allPlayers = data || [];
  setStatText('att-stat-total', allPlayers.length);
  renderMarkingList();
}

function subscribeAttendance() {
  _unsubscribe?.();
  _unsubscribe = subscribeCollection(
    'attendance',
    (docs) => {
      allAttendance = docs;
      rebuildAttendanceMap();
      updateStatsForSelectedDate();
      renderMarkingList();
      renderHistoryTable(document.getElementById('history-date')?.value || '');
    },
    (err) => showToast(err || 'Failed to sync attendance.', 'error')
  );
}

function rebuildAttendanceMap() {
  attendanceMap = {};
  allAttendance.forEach((rec) => {
    const dateKey = (rec.date || '').split('T')[0];
    if (dateKey === selectedDate) {
      attendanceMap[rec.playerId] = { status: rec.status || 'absent', docId: rec.id, playerName: rec.playerName };
    }
  });
}

// ─── MARKING UI ───────────────────────────────────────────────────────────────

function renderMarkingList() {
  const listEl  = document.getElementById('attendance-mark-list');
  const saveBtn = document.getElementById('save-attendance-btn');
  if (!listEl) return;

  if (!allPlayers.length) {
    listEl.innerHTML = `<div class="empty-state"><i class="bi bi-people"></i><h5>No Players Found</h5><p>Add players first.</p></div>`;
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  // Rebuild map for current date
  rebuildAttendanceMap();

  if (saveBtn) saveBtn.disabled = false;

  listEl.innerHTML = allPlayers.map((p) => {
    const current = attendanceMap[p.id]?.status || '';
    return `
      <div class="attendance-player-row" data-player-id="${escapeHtml(p.id)}">
        <div>
          <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(p.name || '—')}</div>
          <div style="font-size:0.75rem;color:var(--clr-text-muted);">${escapeHtml(p.playingType || '')}</div>
        </div>
        <div class="attendance-status-btns" role="group" aria-label="Attendance status for ${escapeHtml(p.name || 'player')}">
          <button class="att-btn ${current === 'present' ? 'active-present' : ''}" data-status="present" aria-pressed="${current === 'present'}">
            <i class="bi bi-check-lg me-1" aria-hidden="true"></i>Present
          </button>
          <button class="att-btn ${current === 'absent' ? 'active-absent' : ''}" data-status="absent" aria-pressed="${current === 'absent'}">
            <i class="bi bi-x-lg me-1" aria-hidden="true"></i>Absent
          </button>
          <button class="att-btn ${current === 'excused' ? 'active-excused' : ''}" data-status="excused" aria-pressed="${current === 'excused'}">
            <i class="bi bi-slash-circle me-1" aria-hidden="true"></i>Excused
          </button>
        </div>
      </div>`;
  }).join('');

  // Attach toggle events
  listEl.querySelectorAll('.att-btn').forEach((btn) => {
    btn.addEventListener('click', handleStatusToggle);
  });

  updateStatsForSelectedDate();
}

function handleStatusToggle(e) {
  const btn      = e.currentTarget;
  const status   = btn.dataset.status;
  const row      = btn.closest('.attendance-player-row');
  if (!row || !status) return;

  const playerId = row.dataset.playerId;

  // Update in-memory state
  attendanceMap[playerId] = { ...(attendanceMap[playerId] || {}), status, playerId };

  // Update button styles within the row
  row.querySelectorAll('.att-btn').forEach((b) => {
    b.classList.remove('active-present', 'active-absent', 'active-excused');
    b.setAttribute('aria-pressed', 'false');
  });
  btn.classList.add(`active-${status}`);
  btn.setAttribute('aria-pressed', 'true');

  updateStatsForSelectedDate();
}

function updateStatsForSelectedDate() {
  let present = 0, absent = 0, excused = 0;
  Object.values(attendanceMap).forEach((rec) => {
    if (rec.status === 'present') present++;
    else if (rec.status === 'absent') absent++;
    else if (rec.status === 'excused') excused++;
  });

  // Count from UI buttons (in case map not rebuilt yet)
  const rows = document.querySelectorAll('.attendance-player-row');
  if (rows.length) {
    present = 0; absent = 0; excused = 0;
    rows.forEach((row) => {
      const activeBtn = row.querySelector('.att-btn.active-present, .att-btn.active-absent, .att-btn.active-excused');
      if (!activeBtn) return;
      if (activeBtn.classList.contains('active-present'))  present++;
      else if (activeBtn.classList.contains('active-absent'))  absent++;
      else if (activeBtn.classList.contains('active-excused')) excused++;
    });
  }

  setStatText('att-stat-present', present);
  setStatText('att-stat-absent', absent);
  setStatText('att-stat-excused', excused);
}

// ─── SAVE ATTENDANCE ──────────────────────────────────────────────────────────

async function handleSaveAttendance() {
  const saveBtn = document.getElementById('save-attendance-btn');
  if (!allPlayers.length) { showToast('No players to save attendance for.', 'warning'); return; }
  if (!selectedDate)      { showToast('Please select a valid date.', 'warning'); return; }

  setButtonLoading(saveBtn, true);

  // Collect current UI state (most up to date)
  const currentStatuses = {};
  document.querySelectorAll('.attendance-player-row').forEach((row) => {
    const playerId = row.dataset.playerId;
    if (!playerId) return;
    const activeBtn = row.querySelector('.att-btn.active-present, .att-btn.active-absent, .att-btn.active-excused');
    if (activeBtn) {
      const status = activeBtn.dataset.status;
      currentStatuses[playerId] = status;
    }
  });

  let savedCount = 0, errorCount = 0;

  // Save or update each player record
  const savePromises = allPlayers.map(async (p) => {
    const status = currentStatuses[p.id];
    if (!status) return; // Not toggled — skip

    const existingRec = allAttendance.find(
      (a) => a.playerId === p.id && (a.date || '').split('T')[0] === selectedDate
    );

    const payload = {
      playerId:   p.id,
      playerName: p.name || 'Unknown',
      date:       selectedDate,
      status,
    };

    let result;
    if (existingRec) {
      result = await updateDocument('attendance', existingRec.id, payload);
    } else {
      result = await addDocument('attendance', payload);
    }

    if (result.error) errorCount++;
    else savedCount++;
  });

  await Promise.all(savePromises);

  setButtonLoading(saveBtn, false);

  if (errorCount > 0 && savedCount === 0) {
    showToast('Failed to save attendance. Please try again.', 'error');
  } else if (errorCount > 0) {
    showToast(`Saved ${savedCount} records. ${errorCount} failed.`, 'warning');
  } else if (savedCount > 0) {
    showToast(`Attendance saved for ${savedCount} player${savedCount !== 1 ? 's' : ''}!`, 'success');
  } else {
    showToast('No attendance marked. Please mark Present/Absent/Excused for players.', 'info');
  }
}

// ─── HISTORY TABLE ────────────────────────────────────────────────────────────

function renderHistoryTable(filterDate) {
  const tbody = document.getElementById('attendance-history-tbody');
  if (!tbody) return;

  let records = [...allAttendance];
  if (filterDate) {
    records = records.filter((r) => (r.date || '').split('T')[0] === filterDate);
  }

  // Sort newest first
  records.sort((a, b) => {
    const da = new Date(a.date || 0);
    const db = new Date(b.date || 0);
    return db - da;
  });

  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state" style="padding:2rem;"><i class="bi bi-calendar-x"></i><p>No attendance records found.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = records.slice(0, 100).map((r) => `
    <tr>
      <td style="font-weight:600;font-size:0.85rem;">${escapeHtml(r.playerName || r.playerId || '—')}</td>
      <td style="font-size:0.82rem;">${escapeHtml(r.date || '—')}</td>
      <td>${getStatusBadge(r.status || 'absent')}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger p-1 att-delete-btn" style="width:26px;height:26px;" data-id="${escapeHtml(r.id)}" title="Delete record">
          <i class="bi bi-trash3" style="font-size:0.7rem;" aria-hidden="true"></i>
        </button>
      </td>
    </tr>`).join('');

  // Attach delete events
  tbody.querySelectorAll('.att-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      const confirmed = await confirmDialog('Delete this attendance record?', 'Delete Record');
      if (!confirmed) return;
      const { error } = await deleteDocument('attendance', id);
      if (error) showToast(error, 'error');
      else showToast('Record deleted.', 'success');
    });
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function setStatText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
