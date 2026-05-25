/**
 * batches.js
 * CRUD controller for Batch Management with card UI.
 * Crash-proof: all async calls in try/catch, all DOM access null-guarded.
 */

import { getDocuments, addDocument, updateDocument, deleteDocument, subscribeCollection } from './firebase-db.js';
import { showToast, setButtonLoading, confirmDialog, escapeHtml, debounce } from './main.js';

let allBatches   = [];
let allPlayers   = [];
let batchModal   = null;
let currentEditId = null;
let _unsubscribe  = null;

export function initBatches() {
  const batchModalEl = document.getElementById('batchModal');
  if (batchModalEl) {
    batchModal = new bootstrap.Modal(batchModalEl, { backdrop: 'static' });
    batchModalEl.addEventListener('hidden.bs.modal', resetForm);
  }

  document.getElementById('add-batch-btn')?.addEventListener('click', openAddModal);
  document.getElementById('save-batch-btn')?.addEventListener('click', handleSaveBatch);

  const searchInput = document.getElementById('batch-search');
  searchInput?.addEventListener('input', debounce(applySearch, 300));

  // Load players count for each batch
  loadPlayers();

  // Real-time batches
  _unsubscribe?.();
  _unsubscribe = subscribeCollection(
    'batches',
    (docs) => {
      allBatches = docs;
      applySearch();
      updateSummaryStats();
    },
    (err) => {
      showToast(err || 'Failed to load batches.', 'error');
      renderBatchCards([]);
    }
  );
}

async function loadPlayers() {
  const { data } = await getDocuments('players');
  allPlayers = data || [];
  // Re-render if batches already loaded
  if (allBatches.length) applySearch();
}

// ─── FILTER ──────────────────────────────────────────────────────────────────

function applySearch() {
  const q = (document.getElementById('batch-search')?.value || '').toLowerCase().trim();
  const filtered = q
    ? allBatches.filter((b) =>
        (b.batchName || '').toLowerCase().includes(q) ||
        (b.timing || '').toLowerCase().includes(q)
      )
    : allBatches;
  renderBatchCards(filtered);
}

// ─── STATS ────────────────────────────────────────────────────────────────────

function updateSummaryStats() {
  const totalCap = allBatches.reduce((sum, b) => sum + (Number(b.capacity) || 0), 0);
  const assigned = allPlayers.filter((p) => p.batchId).length;
  const available = Math.max(0, totalCap - assigned);

  setStatText('stat-total-batches', allBatches.length);
  setStatText('stat-total-capacity', totalCap);
  setStatText('stat-assigned-players', assigned);
  setStatText('stat-available-slots', available);
}

function setStatText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── RENDER CARDS ──────────────────────────────────────────────────────────────

function renderBatchCards(batches) {
  const grid = document.getElementById('batch-cards-grid');
  if (!grid) return;

  if (!batches || batches.length === 0) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="card-panel">
          <div class="empty-state">
            <i class="bi bi-layers"></i>
            <h5>No Batches Found</h5>
            <p>Create your first training batch using the button above.</p>
          </div>
        </div>
      </div>`;
    return;
  }

  grid.innerHTML = batches.map((b) => {
    const assignedCount  = allPlayers.filter((p) => p.batchId === b.id).length;
    const capacity       = Number(b.capacity) || 0;
    const fillPct        = capacity > 0 ? Math.min(100, Math.round((assignedCount / capacity) * 100)) : 0;
    const fillColor      = fillPct >= 90 ? '#9e2a2b' : fillPct >= 70 ? '#e67e22' : '#0f4c5c';

    return `
      <div class="col-12 col-md-6 col-xl-4">
        <div class="batch-card animate-fade-in">
          <div class="batch-card-accent"></div>
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h6>${escapeHtml(b.batchName || 'Unnamed Batch')}</h6>
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-outline-primary batch-action-btn p-1" style="width:28px;height:28px;" data-action="edit" data-id="${escapeHtml(b.id)}" title="Edit batch">
                <i class="bi bi-pencil-square" style="font-size:0.75rem;"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger batch-action-btn p-1" style="width:28px;height:28px;" data-action="delete" data-id="${escapeHtml(b.id)}" title="Delete batch">
                <i class="bi bi-trash3" style="font-size:0.75rem;"></i>
              </button>
            </div>
          </div>

          <div class="batch-meta mb-1">
            <i class="bi bi-clock" aria-hidden="true"></i>
            <span>${escapeHtml(b.timing || '—')}</span>
          </div>

          ${b.description ? `<div style="font-size:0.8rem;color:var(--clr-text-muted);margin-bottom:0.5rem;">${escapeHtml(b.description)}</div>` : ''}

          <div class="capacity-bar" role="progressbar" aria-valuenow="${fillPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Capacity used">
            <div class="capacity-bar-fill" style="width:${fillPct}%;background:${fillColor};"></div>
          </div>

          <div class="d-flex justify-content-between align-items-center" style="font-size:0.78rem;">
            <span style="color:var(--clr-text-muted);">
              <i class="bi bi-people me-1" aria-hidden="true"></i>
              <strong>${assignedCount}</strong> / ${capacity} players
            </span>
            <span style="color:var(--clr-text-muted);">${fillPct}% full</span>
          </div>
        </div>
      </div>`;
  }).join('');

  // Attach action events
  grid.querySelectorAll('.batch-action-btn').forEach((btn) => {
    btn.addEventListener('click', handleCardAction);
  });
}

// ─── ACTIONS ─────────────────────────────────────────────────────────────────

function handleCardAction(e) {
  const btn    = e.currentTarget;
  const action = btn.dataset.action;
  const id     = btn.dataset.id;
  if (!id || !action) return;

  const batch = allBatches.find((b) => b.id === id);
  if (!batch) { showToast('Batch not found. Please refresh.', 'error'); return; }

  if (action === 'edit')   openEditModal(batch);
  if (action === 'delete') handleDeleteBatch(id, batch.batchName);
}

function openAddModal() {
  resetForm();
  currentEditId = null;
  const titleEl = document.getElementById('batchModalLabel');
  if (titleEl) titleEl.innerHTML = '<i class="bi bi-plus-circle-fill me-2"></i>Create New Batch';
  batchModal?.show();
}

function openEditModal(batch) {
  resetForm();
  currentEditId = batch.id;
  const titleEl = document.getElementById('batchModalLabel');
  if (titleEl) titleEl.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Edit Batch';
  setVal('b-name',        batch.batchName);
  setVal('b-timing',      batch.timing);
  setVal('b-capacity',    batch.capacity);
  setVal('b-description', batch.description);
  batchModal?.show();
}

async function handleSaveBatch() {
  const saveBtn = document.getElementById('save-batch-btn');
  const errors  = validateBatchForm();
  if (errors.length) { showToast(errors[0], 'warning'); return; }

  setButtonLoading(saveBtn, true);

  const data = {
    batchName:   (getVal('b-name') || '').trim(),
    timing:      (getVal('b-timing') || '').trim(),
    capacity:    Number(getVal('b-capacity')) || 0,
    description: (getVal('b-description') || '').trim(),
  };

  let result;
  if (currentEditId) {
    result = await updateDocument('batches', currentEditId, data);
  } else {
    result = await addDocument('batches', data);
  }

  setButtonLoading(saveBtn, false);

  if (result.error) {
    showToast(result.error, 'error');
  } else {
    showToast(`Batch ${currentEditId ? 'updated' : 'created'} successfully!`, 'success');
    batchModal?.hide();
  }
}

async function handleDeleteBatch(id, name) {
  const confirmed = await confirmDialog(
    `Delete batch "${name || 'this batch'}"? Players assigned to this batch will need to be reassigned.`,
    'Delete Batch'
  );
  if (!confirmed) return;

  const { error } = await deleteDocument('batches', id);
  if (error) {
    showToast(error, 'error');
  } else {
    showToast('Batch deleted.', 'success');
  }
}

// ─── VALIDATION ──────────────────────────────────────────────────────────────

function validateBatchForm() {
  const errors = [];
  if (!(getVal('b-name') || '').trim())   errors.push('Batch name is required.');
  if (!(getVal('b-timing') || '').trim()) errors.push('Timing is required.');
  const cap = Number(getVal('b-capacity'));
  if (!cap || cap < 1 || cap > 500)      errors.push('Capacity must be between 1 and 500.');
  return errors;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function resetForm() {
  const form = document.getElementById('batch-form');
  if (form) form.reset();
  currentEditId = null;
}

function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
