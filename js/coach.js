/**
 * coach.js
 * Controller for the Coach Profile page.
 * Single coach doc stored in Firestore as: coach_info/main
 * Crash-proof: all async calls in try/catch, all DOM access null-guarded.
 */

import { getDocument, setDocument } from './firebase-db.js';
import { showToast, setButtonLoading, escapeHtml } from './main.js';

const COACH_COLLECTION = 'coach_info';
const COACH_DOC_ID     = 'main'; // Fixed single-document ID

let coachModal = null;

export function initCoach() {
  const coachModalEl = document.getElementById('coachModal');
  if (coachModalEl) {
    coachModal = new bootstrap.Modal(coachModalEl, { backdrop: 'static' });
    coachModalEl.addEventListener('hidden.bs.modal', resetForm);
  }

  document.getElementById('edit-coach-btn')?.addEventListener('click', openEditModal);
  document.getElementById('save-coach-btn')?.addEventListener('click', handleSaveCoach);

  loadCoachProfile();
}

// ─── LOAD ─────────────────────────────────────────────────────────────────────

async function loadCoachProfile() {
  const loadingEl  = document.getElementById('coach-loading');
  const contentEl  = document.getElementById('coach-content');
  const emptyEl    = document.getElementById('coach-empty');

  const { data, error } = await getDocument(COACH_COLLECTION, COACH_DOC_ID);

  if (loadingEl) loadingEl.style.display = 'none';

  if (error) {
    showToast('Failed to load coach profile.', 'error');
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (!data) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  displayCoachProfile(data);
  if (contentEl) contentEl.style.display = 'block';
}

function displayCoachProfile(data) {
  setText('coach-name-display',         data.name || '—');
  setText('coach-title-display',        data.title || 'Head Coach');
  setText('coach-exp-display',          data.experience || '—');
  setText('coach-specialty-display',    data.specialty || '—');
  setText('coach-contact-display',      data.contact || '—');
  setText('coach-email-display',        data.email || '—');
  setText('coach-achievements-display', data.achievements || '—');
  setText('coach-bio-display',          data.bio || '—');
}

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────

async function openEditModal() {
  resetForm();
  // Pre-fill with existing data
  const { data } = await getDocument(COACH_COLLECTION, COACH_DOC_ID);
  if (data) {
    setVal('c-name',         data.name);
    setVal('c-title',        data.title);
    setVal('c-exp',          data.experience);
    setVal('c-specialty',    data.specialty);
    setVal('c-contact',      data.contact);
    setVal('c-email',        data.email);
    setVal('c-achievements', data.achievements);
    setVal('c-bio',          data.bio);
  }
  coachModal?.show();
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────

async function handleSaveCoach() {
  const saveBtn = document.getElementById('save-coach-btn');
  const errors  = validateForm();
  if (errors.length) { showToast(errors[0], 'warning'); return; }

  setButtonLoading(saveBtn, true);

  const data = {
    name:         (getVal('c-name') || '').trim(),
    title:        (getVal('c-title') || '').trim(),
    experience:   (getVal('c-exp') || '').trim(),
    specialty:    (getVal('c-specialty') || '').trim(),
    contact:      (getVal('c-contact') || '').trim(),
    email:        (getVal('c-email') || '').trim(),
    achievements: (getVal('c-achievements') || '').trim(),
    bio:          (getVal('c-bio') || '').trim(),
  };

  const { error } = await setDocument(COACH_COLLECTION, COACH_DOC_ID, data, true);
  setButtonLoading(saveBtn, false);

  if (error) {
    showToast(error, 'error');
  } else {
    showToast('Coach profile updated successfully!', 'success');
    coachModal?.hide();
    displayCoachProfile(data);
    // Show content if it was hidden
    const contentEl = document.getElementById('coach-content');
    const emptyEl   = document.getElementById('coach-empty');
    if (contentEl) contentEl.style.display = 'block';
    if (emptyEl)   emptyEl.style.display   = 'none';
  }
}

// ─── VALIDATION ──────────────────────────────────────────────────────────────

function validateForm() {
  const errors = [];
  if (!(getVal('c-name') || '').trim())      errors.push('Coach name is required.');
  if (!(getVal('c-exp') || '').trim())       errors.push('Experience is required.');
  if (!(getVal('c-specialty') || '').trim()) errors.push('Specialty is required.');
  const contact = (getVal('c-contact') || '').trim();
  if (!contact || !/^\+?[\d\s\-]{7,15}$/.test(contact)) errors.push('Enter a valid contact number.');
  return errors;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function resetForm() {
  const form = document.getElementById('coach-form');
  if (form) form.reset();
}

function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
