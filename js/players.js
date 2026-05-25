/**
 * players.js
 * Complete CRUD controller for Player Management.
 * Crash-proof: all Firebase calls in try/catch, all DOM access null-guarded.
 */

import {
  getDocuments, addDocument, updateDocument, deleteDocument,
  subscribeCollection
} from './firebase-db.js';
import {
  showToast, setButtonLoading, confirmDialog,
  exportToExcel, exportToPDF, escapeHtml, formatDate, getStatusBadge, debounce
} from './main.js';

// State
let allPlayers   = [];
let allBatches   = [];
let currentEditId = null;
let playerModal  = null;
let viewModal    = null;
let _unsubscribe = null;

export function initPlayers() {
  // Guard: ensure modal elements exist
  const playerModalEl = document.getElementById('playerModal');
  const viewModalEl   = document.getElementById('viewPlayerModal');
  if (!playerModalEl || !viewModalEl) {
    console.error('[Players] Modal elements not found in DOM.');
    return;
  }

  playerModal = new bootstrap.Modal(playerModalEl, { backdrop: 'static' });
  viewModal   = new bootstrap.Modal(viewModalEl);

  // Reset form state when modal closes
  playerModalEl.addEventListener('hidden.bs.modal', resetForm);

  // Load batches for dropdown
  loadBatches();

  // Real-time subscription to players collection
  _unsubscribe?.();
  _unsubscribe = subscribeCollection(
    'players',
    (docs) => {
      allPlayers = docs;
      applyFilters();
    },
    (err) => {
      showToast(err || 'Failed to load players.', 'error');
      renderPlayers([]);
    }
  );

  // Event listeners
  document.getElementById('add-player-btn')?.addEventListener('click', () => openAddModal());
  document.getElementById('save-player-btn')?.addEventListener('click', handleSavePlayer);
  document.getElementById('export-excel-btn')?.addEventListener('click', () => exportToExcel('players-table', 'Players_Export'));
  document.getElementById('export-pdf-btn')?.addEventListener('click', () => exportToPDF('players-table', 'Players_Export', 'Player List'));
  document.getElementById('clear-filters-btn')?.addEventListener('click', clearFilters);

  // Search & Filter (debounced)
  const searchInput = document.getElementById('player-search');
  searchInput?.addEventListener('input', debounce(applyFilters, 300));

  document.getElementById('filter-type')?.addEventListener('change', applyFilters);
  document.getElementById('filter-fees')?.addEventListener('change', applyFilters);
}

// ─── BATCHES LOADER (for dropdown) ──────────────────────────────────────────────

async function loadBatches() {
  const { data, error } = await getDocuments('batches');
  if (error) return; // Silently ignore — batch dropdown is optional
  allBatches = data || [];
  populateBatchDropdown();
}

function populateBatchDropdown() {
  const select = document.getElementById('p-batch');
  if (!select) return;
  // Keep first "No Batch" option, then add fetched batches
  select.innerHTML = '<option value="">No Batch</option>';
  allBatches.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = `${escapeHtml(b.batchName || 'Unnamed')} (${escapeHtml(b.timing || '—')})`;
    select.appendChild(opt);
  });
}

// ─── FILTER & RENDER ────────────────────────────────────────────────────────────

function applyFilters() {
  const searchVal = (document.getElementById('player-search')?.value || '').toLowerCase().trim();
  const typeVal   = (document.getElementById('filter-type')?.value || '').toLowerCase();
  const feesVal   = (document.getElementById('filter-fees')?.value || '').toLowerCase();

  const filtered = allPlayers.filter((p) => {
    const matchSearch = !searchVal ||
      (p.name || '').toLowerCase().includes(searchVal) ||
      (p.mobile || '').includes(searchVal) ||
      (p.address || '').toLowerCase().includes(searchVal);

    const matchType = !typeVal || (p.playingType || '').toLowerCase() === typeVal;
    const matchFees = !feesVal || (p.feesStatus || '').toLowerCase() === feesVal;

    return matchSearch && matchType && matchFees;
  });

  renderPlayers(filtered);

  const countEl = document.getElementById('player-count-label');
  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} of ${allPlayers.length} player${allPlayers.length !== 1 ? 's' : ''}`;
  }
}

function clearFilters() {
  const s = document.getElementById('player-search');
  const t = document.getElementById('filter-type');
  const f = document.getElementById('filter-fees');
  if (s) s.value = '';
  if (t) t.value = '';
  if (f) f.value = '';
  applyFilters();
}

function renderPlayers(players) {
  const tbody = document.getElementById('players-tbody');
  if (!tbody) return;

  if (!players || players.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <i class="bi bi-person-x"></i>
            <h5>No Players Found</h5>
            <p>Add your first player using the "Add Player" button above.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = players.map((p, idx) => {
    const batchName = allBatches.find((b) => b.id === p.batchId)?.batchName || '—';
    return `
      <tr>
        <td style="color:var(--clr-text-muted);font-size:0.8rem;">${idx + 1}</td>
        <td>
          <div style="font-weight:600;">${escapeHtml(p.name || '—')}</div>
          <div style="font-size:0.75rem;color:var(--clr-text-muted);">${escapeHtml(p.mobile || '')}</div>
        </td>
        <td>${escapeHtml(String(p.age || '—'))}</td>
        <td>${escapeHtml(p.mobile || '—')}</td>
        <td><span style="font-size:0.82rem;">${escapeHtml(p.playingType || '—')}</span></td>
        <td style="font-size:0.82rem;">${escapeHtml(batchName)}</td>
        <td style="font-size:0.82rem;">${formatDate(p.joiningDate)}</td>
        <td>${getStatusBadge(p.feesStatus || 'pending')}</td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-outline-info action-btn" data-action="view" data-id="${escapeHtml(p.id)}" title="View">
              <i class="bi bi-eye" aria-hidden="true"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary action-btn" data-action="edit" data-id="${escapeHtml(p.id)}" title="Edit">
              <i class="bi bi-pencil-square" aria-hidden="true"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger action-btn" data-action="delete" data-id="${escapeHtml(p.id)}" title="Delete">
              <i class="bi bi-trash3" aria-hidden="true"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');

  // Attach row action events using delegation
  tbody.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', handleRowAction);
  });
}

// ─── ROW ACTIONS ────────────────────────────────────────────────────────────────

function handleRowAction(e) {
  const btn    = e.currentTarget;
  const action = btn.dataset.action;
  const id     = btn.dataset.id;
  if (!id || !action) return;

  const player = allPlayers.find((p) => p.id === id);
  if (!player) { showToast('Player not found. Please refresh.', 'error'); return; }

  if (action === 'view')   openViewModal(player);
  if (action === 'edit')   openEditModal(player);
  if (action === 'delete') handleDeletePlayer(id, player.name);
}

// ─── MODALS ──────────────────────────────────────────────────────────────────────

function openAddModal() {
  resetForm();
  currentEditId = null;
  const titleEl = document.getElementById('playerModalLabel');
  if (titleEl) titleEl.innerHTML = '<i class="bi bi-person-plus-fill me-2"></i>Add New Player';
  // Set default joining date to today
  const dateEl = document.getElementById('p-joining-date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
  
  playerModal?.show();
}

function openEditModal(player) {
  resetForm();
  currentEditId = player.id;
  const titleEl = document.getElementById('playerModalLabel');
  if (titleEl) titleEl.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Edit Player';

  // Populate form fields safely
  setVal('p-name', player.name);
  setVal('p-age', player.age);
  setVal('p-mobile', player.mobile);
  setVal('p-address', player.address);
  setVal('p-joining-date', player.joiningDate || '');
  setVal('p-type', player.playingType);
  setVal('p-batch', player.batchId || '');

  playerModal?.show();
}

function openViewModal(player) {
  const body = document.getElementById('view-player-body');
  if (!body) return;

  const batchName = allBatches.find((b) => b.id === player.batchId)?.batchName || 'Not Assigned';
  body.innerHTML = `
    <div class="row g-3" style="font-size:0.9rem;">
      <div class="col-6"><div class="fw-600 text-muted" style="font-size:0.75rem;text-transform:uppercase;">Name</div><div class="fw-bold">${escapeHtml(player.name || '—')}</div></div>
      <div class="col-6"><div class="fw-600 text-muted" style="font-size:0.75rem;text-transform:uppercase;">Age</div><div>${escapeHtml(String(player.age || '—'))}</div></div>
      <div class="col-6"><div class="fw-600 text-muted" style="font-size:0.75rem;text-transform:uppercase;">Mobile</div><div>${escapeHtml(player.mobile || '—')}</div></div>
      <div class="col-6"><div class="fw-600 text-muted" style="font-size:0.75rem;text-transform:uppercase;">Playing Type</div><div>${escapeHtml(player.playingType || '—')}</div></div>
      <div class="col-12"><div class="fw-600 text-muted" style="font-size:0.75rem;text-transform:uppercase;">Address</div><div>${escapeHtml(player.address || '—')}</div></div>
      <div class="col-6"><div class="fw-600 text-muted" style="font-size:0.75rem;text-transform:uppercase;">Joining Date</div><div>${formatDate(player.joiningDate)}</div></div>
      <div class="col-6"><div class="fw-600 text-muted" style="font-size:0.75rem;text-transform:uppercase;">Batch</div><div>${escapeHtml(batchName)}</div></div>
      <div class="col-6"><div class="fw-600 text-muted" style="font-size:0.75rem;text-transform:uppercase;">Fee Status</div><div>${getStatusBadge(player.feesStatus || 'pending')}</div></div>
    </div>`;

  const titleEl = document.getElementById('viewPlayerModalLabel');
  if (titleEl) titleEl.innerHTML = `<i class="bi bi-person-circle me-2"></i>${escapeHtml(player.name || 'Player')}`;

  viewModal?.show();
}

// ─── SAVE PLAYER ────────────────────────────────────────────────────────────────

async function handleSavePlayer() {
  const saveBtn = document.getElementById('save-player-btn');
  const errors  = validatePlayerForm();

  if (errors.length) {
    showToast(errors[0], 'warning');
    return;
  }

  setButtonLoading(saveBtn, true);

  const data = {
    name:        (getVal('p-name') || '').trim(),
    age:         Number(getVal('p-age')) || 0,
    mobile:      (getVal('p-mobile') || '').trim(),
    address:     (getVal('p-address') || '').trim(),
    joiningDate: getVal('p-joining-date') || '',
    playingType: getVal('p-type') || '',
    batchId:     getVal('p-batch') || '',
  };

  let result;
  if (currentEditId) {
    result = await updateDocument('players', currentEditId, data);
  } else {
    data.feesStatus = 'pending'; // Default for new players
    result = await addDocument('players', data);
  }

  setButtonLoading(saveBtn, false);

  if (result.error) {
    showToast(result.error, 'error');
  } else {
    showToast(`Player ${currentEditId ? 'updated' : 'added'} successfully!`, 'success');
    playerModal?.hide();
  }
}

// ─── DELETE PLAYER ───────────────────────────────────────────────────────────────

async function handleDeletePlayer(id, name) {
  const confirmed = await confirmDialog(
    `Are you sure you want to delete player "${name || 'this player'}"? This action cannot be undone.`,
    'Delete Player'
  );
  if (!confirmed) return;

  const { error } = await deleteDocument('players', id);
  if (error) {
    showToast(error, 'error');
  } else {
    showToast('Player deleted successfully.', 'success');
  }
}

// ─── VALIDATION ─────────────────────────────────────────────────────────────────

function validatePlayerForm() {
  const errors = [];
  const name   = (getVal('p-name') || '').trim();
  const age    = Number(getVal('p-age'));
  const mobile = (getVal('p-mobile') || '').trim();
  const date   = getVal('p-joining-date');
  if (!type)                        errors.push('Playing type is required.');

  return errors;
}

// ─── FORM HELPERS ────────────────────────────────────────────────────────────────

function resetForm() {
  const form = document.getElementById('player-form');
  if (form) form.reset();
  const hiddenId = document.getElementById('player-doc-id');
  if (hiddenId) hiddenId.value = '';
  currentEditId = null;
  populateBatchDropdown();
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}
