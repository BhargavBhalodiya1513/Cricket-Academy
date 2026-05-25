/**
 * fees.js
 * Fee management CRUD controller.
 * Crash-proof: all async calls in try/catch, all DOM access null-guarded.
 */

import {
  getDocuments, addDocument, updateDocument, deleteDocument, subscribeCollection
} from './firebase-db.js';
import {
  showToast, setButtonLoading, confirmDialog,
  exportToExcel, exportToPDF, escapeHtml, formatDate, formatCurrency, getStatusBadge, debounce
} from './main.js';

let allFees     = [];
let allPlayers  = [];
let feeModal    = null;
let currentEditId = null;
let _unsubscribe  = null;

export function initFees() {
  const feeModalEl = document.getElementById('feeModal');
  if (feeModalEl) {
    feeModal = new bootstrap.Modal(feeModalEl, { backdrop: 'static' });
    feeModalEl.addEventListener('hidden.bs.modal', resetForm);
  }

  document.getElementById('add-fee-btn')?.addEventListener('click', openAddModal);
  document.getElementById('save-fee-btn')?.addEventListener('click', handleSaveFee);
  document.getElementById('export-fees-excel')?.addEventListener('click', () => exportToExcel('fees-table', 'Fees_Export'));
  document.getElementById('export-fees-pdf')?.addEventListener('click', () => exportToPDF('fees-table', 'Fees_Export', 'Fee Records'));
  document.getElementById('clear-fee-filters')?.addEventListener('click', clearFilters);

  document.getElementById('fee-search')?.addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('fee-filter-status')?.addEventListener('change', applyFilters);

  // Set default date in modal
  const fDateEl = document.getElementById('f-date');
  if (fDateEl) fDateEl.value = new Date().toISOString().split('T')[0];

  // Load players for dropdown
  loadPlayers();

  // Real-time fees subscription
  _unsubscribe?.();
  _unsubscribe = subscribeCollection(
    'fees',
    (docs) => {
      allFees = docs;
      applyFilters();
      updateSummaryCards();
    },
    (err) => {
      showToast(err || 'Failed to load fees.', 'error');
      renderFeesTable([]);
    }
  );
}

// ─── PLAYERS DROPDOWN ─────────────────────────────────────────────────────────

async function loadPlayers() {
  const { data, error } = await getDocuments('players');
  if (error) { showToast('Could not load players list.', 'warning'); return; }
  allPlayers = data || [];
  populatePlayerDropdown();
}

function populatePlayerDropdown() {
  const select = document.getElementById('f-player');
  if (!select) return;
  select.innerHTML = '<option value="">Select player…</option>';
  allPlayers.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.dataset.name = p.name || 'Unknown';
    opt.textContent = `${escapeHtml(p.name || 'Unknown')} (${escapeHtml(p.playingType || '—')})`;
    select.appendChild(opt);
  });
}

// ─── SUMMARY CARDS ────────────────────────────────────────────────────────────

function updateSummaryCards() {
  const paidFees    = allFees.filter((f) => (f.status || '').toLowerCase() === 'paid');
  const pendingFees = allFees.filter((f) => (f.status || '').toLowerCase() === 'pending');
  const partialFees = allFees.filter((f) => (f.status || '').toLowerCase() === 'partial');

  const totalCollected = paidFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) +
                         partialFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const totalPending   = pendingFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  setText('fee-total-collected', formatCurrency(totalCollected));
  setText('fee-total-pending',   formatCurrency(totalPending));
  setText('fee-paid-count',      paidFees.length);
  setText('fee-pending-count',   pendingFees.length + partialFees.length);
}

// ─── FILTERS ─────────────────────────────────────────────────────────────────

function applyFilters() {
  const searchVal  = (document.getElementById('fee-search')?.value || '').toLowerCase().trim();
  const statusVal  = (document.getElementById('fee-filter-status')?.value || '').toLowerCase();
  const methodVal  = (document.getElementById('fee-filter-method')?.value || '').toLowerCase();

  const filtered = allFees.filter((f) => {
    const matchSearch = !searchVal || (f.playerName || '').toLowerCase().includes(searchVal);
    const matchStatus = !statusVal || (f.status || '').toLowerCase() === statusVal;
    const matchMethod = !methodVal || (f.paymentMethod || '').toLowerCase() === methodVal;
    return matchSearch && matchStatus && matchMethod;
  });

  renderFeesTable(filtered);
}

function clearFilters() {
  const s = document.getElementById('fee-search');
  const f = document.getElementById('fee-filter-status');
  const m = document.getElementById('fee-filter-method');
  if (s) s.value = '';
  if (f) f.value = '';
  if (m) m.value = '';
  applyFilters();
}

// ─── RENDER TABLE ─────────────────────────────────────────────────────────────

function renderFeesTable(fees) {
  const tbody = document.getElementById('fees-tbody');
  if (!tbody) return;

  if (!fees || fees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <i class="bi bi-cash-coin"></i>
            <h5>No Payment Records</h5>
            <p>Add a payment using the "Add Payment" button above.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  // Sort newest first
  const sorted = [...fees].sort((a, b) => {
    const da = new Date(a.paymentDate || a.createdAt?.toDate?.() || 0);
    const db = new Date(b.paymentDate || b.createdAt?.toDate?.() || 0);
    return db - da;
  });

  tbody.innerHTML = sorted.map((f, idx) => `
    <tr>
      <td style="color:var(--clr-text-muted);font-size:0.8rem;">${idx + 1}</td>
      <td style="font-weight:600;font-size:0.875rem;">${escapeHtml(f.playerName || '—')}</td>
      <td style="font-weight:700;color:var(--clr-primary);">${formatCurrency(f.amount)}</td>
      <td style="font-size:0.82rem;">${escapeHtml(f.paymentDate || '—')}</td>
      <td>${getMethodBadge(f.paymentMethod)}</td>
      <td>${getStatusBadge(f.status || 'pending')}</td>
      <td style="font-size:0.8rem;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(f.notes || '')}">${escapeHtml(f.notes || '—')}</td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary fee-action-btn p-1" style="width:28px;height:28px;" data-action="edit" data-id="${escapeHtml(f.id)}" title="Edit">
            <i class="bi bi-pencil-square" style="font-size:0.75rem;" aria-hidden="true"></i>
          </button>
          <button class="btn btn-sm btn-outline-success fee-action-btn p-1" style="width:28px;height:28px;" data-action="mark-paid" data-id="${escapeHtml(f.id)}" title="Mark as Paid" ${f.status === 'paid' ? 'disabled' : ''}>
            <i class="bi bi-check-circle" style="font-size:0.75rem;" aria-hidden="true"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger fee-action-btn p-1" style="width:28px;height:28px;" data-action="delete" data-id="${escapeHtml(f.id)}" title="Delete">
            <i class="bi bi-trash3" style="font-size:0.75rem;" aria-hidden="true"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  // Attach action events
  tbody.querySelectorAll('.fee-action-btn').forEach((btn) => {
    btn.addEventListener('click', handleFeeAction);
  });
}

// ─── PAYMENT METHOD BADGE ─────────────────────────────────────────────────────

function getMethodBadge(method) {
  const m = (method || '').toLowerCase();
  if (m === 'cash') {
    return `<span class="badge" style="background:rgba(27,67,50,0.12);color:#1b7a4a;border:1px solid rgba(27,122,74,0.25);font-size:0.72rem;">
      <i class="bi bi-cash me-1" aria-hidden="true"></i>Cash
    </span>`;
  }
  if (m === 'online') {
    return `<span class="badge" style="background:rgba(41,128,185,0.12);color:#2980b9;border:1px solid rgba(41,128,185,0.25);font-size:0.72rem;">
      <i class="bi bi-globe me-1" aria-hidden="true"></i>Online
    </span>`;
  }
  return `<span class="badge bg-secondary" style="font-size:0.72rem;">—</span>`;
}

// ─── ROW ACTIONS ─────────────────────────────────────────────────────────────

async function handleFeeAction(e) {
  const btn    = e.currentTarget;
  const action = btn.dataset.action;
  const id     = btn.dataset.id;
  if (!id || !action) return;

  const fee = allFees.find((f) => f.id === id);
  if (!fee) { showToast('Record not found. Please refresh.', 'error'); return; }

  if (action === 'edit') {
    openEditModal(fee);
  } else if (action === 'mark-paid') {
    btn.disabled = true;
    const { error } = await updateDocument('fees', id, { status: 'paid' });
    if (error) { showToast(error, 'error'); btn.disabled = false; }
    else showToast('Payment marked as Paid!', 'success');
  } else if (action === 'delete') {
    const confirmed = await confirmDialog(
      `Delete payment record for "${fee.playerName || 'this player'}"?`,
      'Delete Payment'
    );
    if (!confirmed) return;
    const { error } = await deleteDocument('fees', id);
    if (error) showToast(error, 'error');
    else showToast('Payment record deleted.', 'success');
  }
}

// ─── MODALS ──────────────────────────────────────────────────────────────────

function openAddModal() {
  resetForm();
  currentEditId = null;
  const titleEl = document.getElementById('feeModalLabel');
  if (titleEl) titleEl.innerHTML = '<i class="bi bi-plus-circle-fill me-2"></i>Add Payment';
  const fDateEl = document.getElementById('f-date');
  if (fDateEl) fDateEl.value = new Date().toISOString().split('T')[0];
  feeModal?.show();
}

function openEditModal(fee) {
  resetForm();
  currentEditId = fee.id;
  const titleEl = document.getElementById('feeModalLabel');
  if (titleEl) titleEl.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Edit Payment';

  // Find player select option
  const playerSelect = document.getElementById('f-player');
  if (playerSelect) {
    Array.from(playerSelect.options).forEach((opt) => {
      if (opt.dataset.name === fee.playerName || opt.value === fee.playerId) {
        opt.selected = true;
      }
    });
  }

  setVal('f-amount', fee.amount);
  setVal('f-date', fee.paymentDate || '');
  setVal('f-status', fee.status);
  setVal('f-method', fee.paymentMethod || '');
  setVal('f-notes', fee.notes);

  feeModal?.show();
}

// ─── SAVE ────────────────────────────────────────────────────────────────────

async function handleSaveFee() {
  const saveBtn = document.getElementById('save-fee-btn');
  const errors  = validateFeeForm();
  if (errors.length) { showToast(errors[0], 'warning'); return; }

  setButtonLoading(saveBtn, true);

  const playerSelect = document.getElementById('f-player');
  const selectedOpt  = playerSelect?.options[playerSelect?.selectedIndex];
  const playerName   = selectedOpt?.dataset.name || '';
  const playerId     = playerSelect?.value || '';

  const data = {
    playerId,
    playerName: playerName.trim(),
    amount:        Number(getVal('f-amount')) || 0,
    paymentDate:   getVal('f-date') || '',
    status:        getVal('f-status') || 'pending',
    paymentMethod: getVal('f-method') || '',
    notes:         (getVal('f-notes') || '').trim(),
  };

  let result;
  if (currentEditId) {
    result = await updateDocument('fees', currentEditId, data);
  } else {
    result = await addDocument('fees', data);
  }

  setButtonLoading(saveBtn, false);

  if (result.error) {
    showToast(result.error, 'error');
  } else {
    showToast(`Payment ${currentEditId ? 'updated' : 'added'} successfully!`, 'success');
    feeModal?.hide();
  }
}

// ─── VALIDATION ──────────────────────────────────────────────────────────────

function validateFeeForm() {
  const errors = [];
  if (!getVal('f-player'))                       errors.push('Please select a player.');
  const amt = Number(getVal('f-amount'));
  if (!amt || amt < 1)                           errors.push('Enter a valid amount (minimum ₹1).');
  if (!getVal('f-date'))                         errors.push('Payment date is required.');
  if (!getVal('f-status'))                       errors.push('Status is required.');
  if (!getVal('f-method'))                       errors.push('Payment method is required (Cash or Online).');
  return errors;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function resetForm() {
  const form = document.getElementById('fee-form');
  if (form) form.reset();
  currentEditId = null;
  populatePlayerDropdown();
  const fDateEl = document.getElementById('f-date');
  if (fDateEl) fDateEl.value = new Date().toISOString().split('T')[0];
}

function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
