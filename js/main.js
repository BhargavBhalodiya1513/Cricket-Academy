/**
 * main.js
 * Shared UI utilities — theme toggle, sidebar, toast notifications,
 * logout handler, and export helpers (PDF + Excel).
 * Safe to import on every page. All DOM access is null-checked.
 */

import { logoutAdmin } from "./firebase-db.js";

// ─── THEME ─────────────────────────────────────────────────────────────────────
const THEME_KEY = "cams_theme";

export function initTheme() {
  const saved = (() => { try { return localStorage.getItem(THEME_KEY); } catch (_) { return null; } })();
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const theme = saved || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
  }
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

// ─── SIDEBAR ───────────────────────────────────────────────────────────────────
export function initSidebar() {
  const toggleBtn = document.getElementById("sidebar-toggle");
  const sidebar   = document.getElementById("sidebar");
  const overlay   = document.getElementById("sidebar-overlay");

  if (!sidebar) return;

  function openSidebar() {
    sidebar?.classList.add("open");
    overlay?.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("active");
    document.body.style.overflow = "";
  }

  toggleBtn?.addEventListener("click", () => {
    sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
  });

  overlay?.addEventListener("click", closeSidebar);

  // Close sidebar on navigation link click (mobile UX)
  sidebar?.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth < 992) closeSidebar();
    });
  });

  // Highlight active nav link
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  sidebar?.querySelectorAll(".nav-link").forEach((link) => {
    const href = link.getAttribute("href")?.split("/").pop();
    if (href && href === currentPage) {
      link.classList.add("active");
    }
  });
}

// ─── TOAST NOTIFICATIONS ───────────────────────────────────────────────────────
let _toastContainer = null;

function getToastContainer() {
  if (_toastContainer) return _toastContainer;
  _toastContainer = document.getElementById("toast-container");
  if (!_toastContainer) {
    _toastContainer = document.createElement("div");
    _toastContainer.id = "toast-container";
    _toastContainer.setAttribute("aria-live", "polite");
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration - ms before auto-dismiss
 */
export function showToast(message, type = "info", duration = 4000) {
  const icons = { success: "bi-check-circle-fill", error: "bi-x-circle-fill", info: "bi-info-circle-fill", warning: "bi-exclamation-triangle-fill" };
  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast-msg toast-${type}`;
  toast.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span><button class="toast-close" aria-label="Close">&times;</button>`;

  const closeBtn = toast.querySelector(".toast-close");
  closeBtn?.addEventListener("click", () => dismissToast(toast));

  container.appendChild(toast);
  // Trigger animation
  requestAnimationFrame(() => { requestAnimationFrame(() => { toast.classList.add("show"); }); });
  if (duration > 0) setTimeout(() => dismissToast(toast), duration);
}

function dismissToast(toast) {
  toast.classList.remove("show");
  toast.classList.add("hide");
  setTimeout(() => toast.parentNode?.removeChild(toast), 400);
}

// ─── LOADING BUTTON HELPERS ────────────────────────────────────────────────────
export function setButtonLoading(btn, isLoading, originalText = "") {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading…`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || originalText || "Submit";
  }
}

// ─── CONFIRM DIALOG ────────────────────────────────────────────────────────────
/**
 * Show a styled confirmation dialog.
 * @param {string} message
 * @param {string} title
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, title = "Confirm Action") {
  return new Promise((resolve) => {
    const existing = document.getElementById("global-confirm-modal");
    existing?.remove();

    const modal = document.createElement("div");
    modal.id = "global-confirm-modal";
    modal.className = "modal fade";
    modal.tabIndex = -1;
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header border-0">
            <h5 class="modal-title"><i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>${escapeHtml(title)}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">${escapeHtml(message)}</div>
          <div class="modal-footer border-0">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" id="confirm-cancel-btn">Cancel</button>
            <button type="button" class="btn btn-danger" id="confirm-ok-btn">Delete</button>
          </div>
        </div>
      </div>`;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal, { backdrop: "static" });
    bsModal.show();

    const cleanup = (result) => { bsModal.hide(); modal.addEventListener("hidden.bs.modal", () => { modal.remove(); resolve(result); }, { once: true }); };
    modal.querySelector("#confirm-ok-btn")?.addEventListener("click", () => cleanup(true));
    modal.querySelector("#confirm-cancel-btn")?.addEventListener("click", () => cleanup(false));
    modal.addEventListener("hidden.bs.modal", () => { modal.remove(); resolve(false); }, { once: true });
  });
}

// ─── LOGOUT ────────────────────────────────────────────────────────────────────
export function initLogout() {
  document.querySelectorAll("[data-action='logout']").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const confirmed = await confirmDialog("Are you sure you want to logout?", "Logout");
      if (!confirmed) return;
      setButtonLoading(btn, true);
      const { error } = await logoutAdmin();
      if (error) {
        showToast(error, "error");
        setButtonLoading(btn, false);
      } else {
        window.location.replace("index.html");
      }
    });
  });
}

// ─── EXPORT HELPERS ────────────────────────────────────────────────────────────
/**
 * Export an HTML table to Excel using SheetJS.
 * @param {string} tableId - ID of the <table> element
 * @param {string} filename - Output filename without extension
 */
export function exportToExcel(tableId, filename = "export") {
  try {
    const table = document.getElementById(tableId);
    if (!table) { showToast("No table data to export.", "warning"); return; }
    if (typeof XLSX === "undefined") { showToast("Excel library not loaded.", "error"); return; }
    const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
    XLSX.writeFile(wb, `${filename}.xlsx`);
    showToast("Excel file exported successfully!", "success");
  } catch (err) {
    console.error("[Export] Excel export failed:", err);
    showToast("Excel export failed. Please try again.", "error");
  }
}

/**
 * Export an HTML table to PDF using jsPDF + autoTable.
 * @param {string} tableId - ID of the <table> element
 * @param {string} filename - Output filename without extension
 * @param {string} title - Title shown in the PDF header
 */
export function exportToPDF(tableId, filename = "export", title = "Report") {
  try {
    const table = document.getElementById(tableId);
    if (!table) { showToast("No table data to export.", "warning"); return; }
    if (typeof window.jspdf === "undefined") { showToast("PDF library not loaded.", "error"); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    doc.autoTable({ html: `#${tableId}`, startY: 28, styles: { fontSize: 9 }, headStyles: { fillColor: [15, 76, 92] } });
    doc.save(`${filename}.pdf`);
    showToast("PDF exported successfully!", "success");
  } catch (err) {
    console.error("[Export] PDF export failed:", err);
    showToast("PDF export failed. Please try again.", "error");
  }
}

// ─── UTILITIES ─────────────────────────────────────────────────────────────────
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch (_) { return "—"; }
}

export function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);
}

export function getStatusBadge(status) {
  const map = {
    paid: "badge-paid",
    pending: "badge-pending",
    partial: "badge-partial",
    present: "badge-present",
    absent: "badge-absent",
    excused: "badge-excused",
  };
  const cls = map[(status || "").toLowerCase()] || "bg-secondary";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSidebar();
  initLogout();

  const themeBtn = document.getElementById("theme-toggle-btn");
  themeBtn?.addEventListener("click", toggleTheme);
});
