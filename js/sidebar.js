/**
 * sidebar.js
 * Injects the shared sidebar HTML into any page that calls injectSidebar().
 * Using JS template injection avoids HTML duplication across pages.
 */
export function injectSidebar(containerId = 'sidebar') {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <!-- Brand / Logo -->
    <div class="sidebar-brand">
      <img src="assets/logo.png" alt="Cricket Academy Logo" class="sidebar-logo"
           onerror="this.src='https://placehold.co/42x42/0f4c5c/fff?text=CA'" />
      <div class="sidebar-brand-text">
        <h6>Cricket Academy</h6>
        <span>Management System</span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav" aria-label="Main navigation">
      <div class="sidebar-section-label">Main</div>

      <a href="dashboard.html" class="nav-link" id="nav-dashboard">
        <i class="bi bi-speedometer2" aria-hidden="true"></i>
        <span>Dashboard</span>
      </a>
      <a href="players.html" class="nav-link" id="nav-players">
        <i class="bi bi-people-fill" aria-hidden="true"></i>
        <span>Players</span>
      </a>
      <a href="batches.html" class="nav-link" id="nav-batches">
        <i class="bi bi-layers-fill" aria-hidden="true"></i>
        <span>Batches</span>
      </a>

      <div class="sidebar-section-label mt-2">Academy</div>

      <a href="attendance.html" class="nav-link" id="nav-attendance">
        <i class="bi bi-calendar-check-fill" aria-hidden="true"></i>
        <span>Attendance</span>
      </a>
      <a href="fees.html" class="nav-link" id="nav-fees">
        <i class="bi bi-cash-coin" aria-hidden="true"></i>
        <span>Fee Management</span>
      </a>
      <a href="coach.html" class="nav-link" id="nav-coach">
        <i class="bi bi-person-badge-fill" aria-hidden="true"></i>
        <span>Coach Profile</span>
      </a>
    </nav>

    <!-- Footer: Logout -->
    <div class="sidebar-footer">
      <a href="#" class="nav-link text-danger" data-action="logout" id="sidebar-logout-btn" role="button">
        <i class="bi bi-box-arrow-left" aria-hidden="true"></i>
        <span>Logout</span>
      </a>
    </div>
  `;

  // Highlight active link based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  el.querySelectorAll('.nav-link').forEach((link) => {
    const href = (link.getAttribute('href') || '').split('/').pop();
    if (href && href === currentPage) link.classList.add('active');
  });
}
