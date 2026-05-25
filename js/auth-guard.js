/**
 * auth-guard.js
 * Route protection — must be included as the FIRST module on every protected page.
 * On login page: redirects authenticated users to dashboard.
 * On all other pages: redirects unauthenticated users to login.
 */

import { observeAuth } from "./firebase-db.js";

const currentPage = window.location.pathname.split("/").pop() || "index.html";
const isLoginPage = currentPage === "index.html" || currentPage === "";

// Show/hide a page-level loading overlay while auth state resolves
function showAuthOverlay() {
  const overlay = document.getElementById("auth-loading-overlay");
  if (overlay) overlay.style.display = "flex";
}

function hideAuthOverlay() {
  const overlay = document.getElementById("auth-loading-overlay");
  if (overlay) overlay.style.display = "none";
}

showAuthOverlay();

observeAuth((user) => {
  if (isLoginPage) {
    if (user) {
      // Already logged in → go to dashboard
      window.location.replace("dashboard.html");
    } else {
      hideAuthOverlay();
    }
  } else {
    if (!user) {
      // Not logged in → go to login
      window.location.replace("index.html");
    } else {
      hideAuthOverlay();
      // Store current user email in session for display in navbar
      try {
        sessionStorage.setItem("adminEmail", user.email || "Admin");
      } catch (_) {
        // sessionStorage might be unavailable in some browsers — graceful ignore
      }
      updateNavbarUser(user.email);
    }
  }
});

function updateNavbarUser(email) {
  const el = document.getElementById("admin-email-display");
  if (el) el.textContent = email || "Admin";
}
