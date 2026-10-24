/**
 * Project HANAP - Frontend Client Script
 * Handles UI interactions, client validation enhancements, and auto-dismiss alerts.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Bootstrap tooltips if bootstrap library is loaded
  if (typeof bootstrap !== 'undefined') {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl));

    // Auto-dismiss alerts after 6 seconds
    const autoAlerts = document.querySelectorAll('.alert-dismissible');
    autoAlerts.forEach((alert) => {
      setTimeout(() => {
        try {
          const bsAlert = new bootstrap.Alert(alert);
          bsAlert.close();
        } catch (e) {
          // Ignored if already dismissed
        }
      }, 6000);
    });
  }

  // Client-side quick filter for catalog table
  const searchInput = document.querySelector('input[placeholder*="Search item"]');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      const rows = document.querySelectorAll('tbody tr');
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }
});
