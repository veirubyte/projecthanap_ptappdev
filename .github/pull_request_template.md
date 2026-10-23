## Pull Request Description

### What Was Implemented
<!-- Provide a clear, concise overview of the features, routes, views, middleware, or database changes introduced in this PR. -->
- 

### Files Changed
<!-- List the key files added, modified, or removed, noting their specific purpose in the MVC architecture. -->
- `path/to/file1`: 
- `path/to/file2`: 

### Issue Addressed
<!-- Specify the issue number closed by this pull request. Example: Closes #12 -->
Closes #

---

## How the Feature Was Tested

Please check off all applicable verification tests performed prior to opening this pull request:

- [ ] **Valid Input Submission:** Tested forms with well-formatted, standard data and confirmed successful processing.
- [ ] **Empty Fields Validation:** Confirmed that leaving required fields blank triggers server-side validation error banners without crashing the server.
- [ ] **Invalid Format Handling:** Tested invalid email formats, out-of-bounds character lengths, or non-numeric values to confirm rejection.
- [ ] **Duplicate Data Prevention:** Verified that submitting duplicate unique keys (e.g., existing email or item code) displays appropriate user warnings.
- [ ] **Database Persistence Across Page Refresh:** Verified in MySQL / phpMyAdmin that data persists properly after browser reload and server restart.
- [ ] **Unauthorized Direct-URL Role Check:** Attempted direct URL navigation into restricted routes (e.g. accessing `/admin` as a Student or Guest) and verified that the `authorizeRole` middleware blocks access with a 403 Forbidden or redirect.

---

## Peer Code Review Reminder

> [!IMPORTANT]
> **To the Peer Reviewer:**  
> Please perform a substantive, critical technical evaluation before approving this PR. Do not submit generic one-line approvals (e.g., "Looks good" or "LGTM").
> 
> Review checklist for approval:
> 1. **Functionality:** Does the implementation fulfill its intended requirement completely?
> 2. **Code Clarity:** Are variables, functions, and routes cleanly named and documented?
> 3. **Input Validation:** Are all external inputs properly sanitized and validated on the server?
> 4. **Architecture & Structure:** Does the code strictly adhere to the project's MVC folder boundaries?
> 5. **Security:** Are password hashes, session cookies, and SQL queries protected against tampering and injection?
