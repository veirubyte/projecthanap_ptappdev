const { requireAuth, denyAdmin, requireNonAdminAuth, requireAdmin } = require('../middleware/auth');
const controller = require('../controllers/itemController');

const router = require('express').Router();

/* ==========================================================================
   PUBLIC & USER FEED / CATALOG
   ========================================================================== */

router.get('/dashboard', denyAdmin, controller.showDashboard);
router.get('/catalog', controller.showDashboard);

/* ==========================================================================
   REPORT ITEM (LOST OR FOUND)
   ========================================================================== */

// Dedicated full-page Report Item form
router.get('/items/new', requireNonAdminAuth, controller.showNewReportForm);

router.post('/items/report', requireNonAdminAuth, controller.createItemReport);

// Guest route to security desk protocol
router.get('/claims/guest-claim', controller.showGuestClaimGuide);

/* ==========================================================================
   ITEM DETAILS & CLAIM SUBMISSION
   ========================================================================== */

router.get('/items/:id', controller.showItemDetails);

// Live Match Preview Endpoint for Real-time Answer Progression Circle
router.post('/items/:id/match-preview', requireNonAdminAuth, controller.previewOwnershipMatch);

router.post('/items/:id/claim', requireNonAdminAuth, controller.createClaim);

/* ==========================================================================
   CLAIMS HUB & CHAT
   ========================================================================== */

router.get('/claims', requireNonAdminAuth, controller.listClaims);

// Single Claim Chat
router.get('/claims/:id', requireNonAdminAuth, controller.showClaimChat);

// Post message in claim chat
router.post('/claims/:id/messages', requireNonAdminAuth, controller.sendClaimMessage);

// Update Claim Status (Approve or Reject)
router.post('/claims/:id/status', requireNonAdminAuth, controller.updateClaimStatus);

// Withdraw / Cancel Pending Claim
router.post('/claims/:id/cancel', requireNonAdminAuth, controller.cancelClaim);

/* ==========================================================================
   MY REPORTS MANAGEMENT
   ========================================================================== */

router.get('/my-reports', requireNonAdminAuth, controller.listMyReports);

// Update item status (e.g., mark claimed or archived)
router.post('/items/:id/status', requireAuth, controller.updateItemStatus);

// Delete item report
router.post('/items/:id/delete', requireAuth, controller.deleteItemReport);

// Edit Report Form Page
router.get('/items/:id/edit', requireAuth, controller.showEditItemForm);

// Process Report Edit
router.post('/items/:id/edit', requireAuth, controller.updateItemReport);

/* ==========================================================================
   ACCOUNT SETTINGS & CONFIGURATIONS
   ========================================================================== */

// GET /settings - Full Account Settings Studio
router.get('/settings', requireAuth, controller.showSettings);

router.post('/settings/guardian-links', requireNonAdminAuth, controller.createGuardianLink);

router.post('/settings/guardian-links/:id/:decision', requireNonAdminAuth, controller.decideGuardianLink);

// POST /settings/profile - Update Personal Details
router.post('/settings/profile', requireAuth, requireNonAdminAuth, controller.updateProfile);

router.post('/settings/delete-account', requireAuth, requireNonAdminAuth, controller.deleteAccount);

// POST /settings/security - Update Password & Security Credentials
router.post('/settings/security', requireAuth, controller.updateSecurity);

router.post('/settings/mfa/enable', requireAuth, controller.enableMfa);

router.post('/settings/mfa/disable', requireAuth, controller.disableMfa);

// POST /settings/notifications - Save Preferences
router.post('/settings/notifications', requireAuth, controller.updateNotificationSettings);

/* ==========================================================================
   ADMINISTRATOR PLATFORM FUNCTIONALITY
   ========================================================================== */

router.get('/admin/dashboard', requireAdmin, controller.showAdminDashboard);
router.post('/admin/items/:id/accept-custody', requireAdmin, controller.acceptItemCustody);

// Admin User Management Directory (ZIP B)
router.get('/admin/users', requireAdmin, controller.listAdminUsers);

// Admin Add User
router.post('/admin/users/add', requireAdmin, controller.createAdminUser);

// Admin User Quota Reset
router.post('/admin/users/:id/quota-reset', requireAdmin, controller.resetUserQuota);

// Admin User Role Toggle
router.post('/admin/users/:id/role', requireAdmin, controller.updateUserRole);

// Admin Physical Custody Handover Terminal (ZIP C)
router.get('/admin/handover', requireAdmin, controller.listHandoverClaims);

// Admin Single Physical Handover Item Terminal (ZIP C)
router.get('/admin/handover/:claimId', requireAdmin, controller.showHandoverClaim);

// Admin Confirm Release Handover
router.post('/admin/handover/:claimId/confirm', requireAdmin, controller.confirmHandover);

// Admin Reject Handover
router.post('/admin/handover/:claimId/reject', requireAdmin, controller.rejectHandover);

// Test 403 Forbidden Screen
router.get('/admin/test-403', requireAdmin, controller.showForbiddenPage);

// Admin All Reports Management & 60-Day Archive
router.get('/admin/reports', requireAdmin, controller.listAdminReports);

// Admin Approve Item Disposition / Archive
router.post('/admin/reports/:id/archive-approve', requireAdmin, controller.approveReportArchive);
router.post('/admin/reports/batch-approve', requireAdmin, controller.batchApproveReportArchive);

// Admin Statistical Overview: P2P vs Centralized Handover Performance
router.get('/admin/analytics', requireAdmin, controller.showAdminAnalytics);

// Admin Audit Logs Viewer
router.get('/admin/audit-logs', requireAdmin, controller.listAuditLogs);

// Admin Office Turn-in Log Form Submission
router.post('/admin/items/log', requireAdmin, controller.createAdminItemReport);

module.exports = router;