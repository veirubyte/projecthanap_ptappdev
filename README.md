# Project HANAP (*Holistic Asset Notification & Access Portal*)

[![Live Deployment](https://img.shields.io/badge/Live%20Demo-Vercel%20Production-09436B?style=for-the-badge&logo=vercel)](https://projecthanap-campus-system.vercel.app)
[![Platform](https://img.shields.io/badge/Platform-Node.js%20v18%2B%20%7C%20Express%205.x-09436B?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MySQL%20%7C%20Supabase%20Postgres-2B5B84?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Frontend](https://img.shields.io/badge/Frontend-EJS%20%2B%20Tailwind%20CSS-0D9488?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![AI](https://img.shields.io/badge/AI-Google%20Gemini%20GenAI-8E75B2?style=for-the-badge&logo=googlegemini)](https://ai.google.dev/)
[![QA Tests](https://img.shields.io/badge/QA%20Tests-100%25%20Passing%20(61%2F61)-emerald?style=for-the-badge&logo=checkmarx)](tests/)
[![Institution](https://img.shields.io/badge/Institution-CSPC%20Camarines%20Sur-1D63B8?style=for-the-badge)](https://my.cspc.edu.ph/)
[![License](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

---

## 🌐 Live Production Deployment

**Production URL:** [https://projecthanap-campus-system.vercel.app](https://projecthanap-campus-system.vercel.app)  
**Database Backend:** Supabase Managed PostgreSQL (`ap-southeast-1` Singapore) with SSL Connection Pooling  
**Hosting Architecture:** Vercel Serverless Express 5 Runtime + Persistent Database Sessions & Cloud Image Storage

### Quick Test Credentials

| Account Role | Email Address | Password | Login Portal Tab | Capabilities & Scope |
| :--- | :--- | :--- | :---: | :--- |
| **System Administrator** | `admin@cspc.edu.ph` | `password123` | **Institution** | Full access to Admin Dashboard, Custody Handover, 60-Day Archive Disposition Queue, User Management, Analytics, and Security Audit Logs. |
| **Faculty / Staff Member** | `maria@my.cspc.edu.ph` | `password123` | **Institution** | Campus catalog reporting, active claim coordination, and department-level moderation. |
| **Student (Institutional)** | `juan@my.cspc.edu.ph` | `password123` | **Institution** | Found item reporting with private challenges, match engine verification, and peer meetup coordination. |
| **Parent / Campus Guest** | `parent@gmail.com` | `password123` | **Guest / Parent** | External guest portal access, student connection requests, and guided Security Desk claim routing. |

---

## Table of Contents

1. [Project Description](#1-project-description)
2. [Team Members](#2-team-members)
3. [Assigned System](#3-assigned-system)
4. [Features](#4-features)
5. [Technologies](#5-technologies)
6. [Installation](#6-installation)
7. [Configuration](#7-configuration)
8. [Database Setup](#8-database-setup)
9. [How to Run](#9-how-to-run)
10. [Automated Testing & QA Verification](#10-automated-testing--qa-verification)
11. [Cloud Deployment (Vercel & Supabase)](#11-cloud-deployment-vercel--supabase)
12. [User Accounts](#12-user-accounts)
13. [Project Structure](#13-project-structure)
14. [Known Limitations](#14-known-limitations)
15. [AI Assistance Disclosure](#15-ai-assistance-disclosure)
16. [License](#16-license)

---

## 1. Project Description

**Project HANAP** (*Holistic Asset Notification & Access Portal*) is an institutional-grade, web-based **Campus Lost and Found, Asset Tracking, and Item Recovery System** engineered for **Camarines Sur Polytechnic Colleges (CSPC)** in Nabua, Camarines Sur.

### Problem Being Addressed
Across collegiate campus grounds, hundreds of critical personal and academic assets, such as institutional identification cards, laptops, scientific calculators, laboratory coats, keys, and wallets are misplaced each semester. Traditional lost-and-found management relies heavily on disconnected physical paper logs, unmonitored drop-off counters, and disorganized social media feeds. This disjointed workflow leads to low recovery rates, lack of privacy, fraudulent claims, and heavy administrative overhead.

### Main Purpose
Project HANAP replaces fragmented manual tracking with an auditable, role-restricted, responsive web portal featuring:
- **Direct Peer-to-Peer (P2P) Coordination** powered by an automated string-distance **Campus Match Engine** and private verification challenges.
- **Centralized Security Desk Custody Handover** workflows for official property intake receipts, physical logging, and verified releases.
- **End-to-End Auditability** with automated 60-day disposition queues, administrative batch actions, and chronological security audit logs.
- **Privacy & Account Protections** including automatic phone number masking in chat, Email Multi-Factor Authentication (MFA), password recovery with one-time verification codes, and institutional email domain verification.
- **Embedded AI Guidance** via the **HANAP AI Assistant** widget to help campus users navigate reporting, claiming, and handover protocols.

### Target Users
- **Students (`@my.cspc.edu.ph`):** Report misplaced personal belongings, log found campus items, submit ownership claims, withdraw pending claims, and coordinate peer or security handovers.
- **Faculty & Staff (`@cspc.edu.ph`):** Report and inspect surrendered items across academic buildings, laboratories, and libraries.
- **Parents & Campus Guests:** Browse public catalog listings, link accounts to verified student profiles, and follow guided Security Desk claim protocols.
- **System Administrators & Campus Security Personnel:** Manage physical item custody intake/release ledgers, arbitrate escalated claims, oversee the 60-day archive disposition queue, manage users/roles, update administrative profile contact details, and audit system logs.

---

## 2. Team Members

Project HANAP was collaboratively designed, engineered, tested, and documented by the following development team:

| Team Member | Assigned Roles | Primary Responsibilities & Contributions |
| :--- | :--- | :--- |
| **Janel Laynes** | **Lead Full-Stack Developer**<br>**Lead Deliverables Manager** | Core full-stack architecture, Express MVC integration, dual-database schema & query models, authentication/MFA & AI assistant integration, pull request verification, and milestone deliverables management. |
| **Jake Roi Eloreta** | **Project Manager**<br>**Assistant Full-Stack Developer**<br>**GitHub Manager**<br>**UI/UX Developer** | Project planning & task coordination, GitHub repository/branch/PR workflow governance, Campus Match Engine & verification stepper implementation, and UI/UX design system refinement. |
| **John Paul Rendon** | **Lead Backend Developer**<br>**Assistant Deliverables Manager** | Backend route handlers, business logic controllers, server-side input validation, security/access-control middleware, database persistence operations, and technical deliverables review. |
| **Mherly Simbulan** | **Lead Frontend Developer**<br>**Assistant Secretary** | EJS view templates, responsive Tailwind CSS layouts, interactive forms, client-side scripts, dark/light theme support, and project documentation/requirements recording. |

### GitHub Collaboration & Development Workflow

In accordance with the PTAppDev Midterm Project guidelines, our team followed a disciplined GitHub workflow:
- **Feature Branching:** Development was conducted on dedicated feature branches (e.g., `feature/match-engine`, `feature/HANAP-AI-Assistant`, `feature/custody-handover`, `feature/auth-mfa`, `feature/exhaustive-qa-and-headless-ui-audit`) rather than committing directly to `main`.
- **Pull Requests & Peer Code Reviews:** Major features were submitted via Pull Requests using `.github/pull_request_template.md` and reviewed by teammates for functionality, validation, security, and code clarity prior to merging.
- **Conventional Commits:** Commit history adheres to Conventional Commit prefixes (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- **Issue & Project Board Tracking:** Tasks were organized using GitHub Issues (`.github/ISSUE_TEMPLATE/task_issue.md`) and tracked across our GitHub Project Board (`BACKLOG` $\rightarrow$ `TODO` $\rightarrow$ `IN PROGRESS` $\rightarrow$ `REVIEW` $\rightarrow$ `DONE`).

---

## 3. Assigned System

| Metadata Field | Specification |
| :--- | :--- |
| **Assigned Campus System** | **Campus Lost and Found & Item Tracking System (Round 1)** |
| **System Title** | **Project HANAP** (*Holistic Asset Notification & Access Portal*) |
| **Course** | Platform Technologies & Web Application Development (`PTAppDev`) |
| **Target Institution** | Camarines Sur Polytechnic Colleges (CSPC) &bull; College of Computer Studies |
| **Academic Year** | A.Y. 2026–2027 (Midterm Project – Round 1) |
| **System Requirements Spec** | See [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) for full SRS, Stakeholders, FRs, NFRs, and Use Cases |

### System Requirements & Use Cases Summary

The full System Requirements Specification is maintained in [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md). Below is an executive summary:

- **Stakeholders:** CSPC Student Body, Campus Security & Public Safety Office, Office of Student Affairs (OSA), University Library & Laboratory Custodians, and MIS/IT Infrastructure Team.
- **Core Functional Requirements (`FR-01` – `FR-10`):** Institutional & guest registration, session-based login/logout with Email MFA, self-service password reset with one-time verification codes, strict Role-Based Access Control (`requireAuth`, `requireNonAdminAuth`, `requireAdmin`), server-side form validation, lost/found report creation with photo uploads, physical custody intake logging, Campus Match Engine claim verification, direct claim withdrawal, multi-filter catalog search, and normalized MySQL/PostgreSQL persistence.
- **Core Non-Functional Requirements (`NFR-01` – `NFR-05`):** `bcrypt` password hashing (10 salt rounds), `.env` secret isolation, low-latency parameterized queries, ACID transactional durability across restarts, persistent session storage in `user_sessions`, and mobile-first responsive UI.

---

## 4. Features

### 1. Smart Campus Match Engine & Verification Stepper
- **Algorithmic Confidence Scoring:** Evaluates claimant ownership proofs against secret challenge answers using Unicode NFKC normalization, token-based Jaccard overlap, and space-optimized Levenshtein edit distance (`services/answerMatch.js`).
- **Dynamic Radial SVG Progression Gauge:** Displays real-time match confidence ($0\%$ to $100\%$) on the item detail page via `POST /items/:id/match-preview`, advancing claimants through a visual two-step verification workflow.
- **Anti-Fraud Security Constraints:** Requires claimants to meet or exceed an **$80\%$ minimum threshold** before filing claims on private-challenge items, preventing guessing and social engineering.
- **Private Answer Protection:** Private verification challenge answers are masked by default on report edit forms with toggleable visibility to prevent shoulder-surfing.

### 2. Dual Handover Architecture: P2P Chat vs. Security Custody
- **Direct P2P Chat Thread:** Enables secure communication between finders and claimants with real-time status management (`pending`, `approved`, `escalated`, `returned`, `rejected`).
- **In-Chat Contact Masking:** Automatically redacts raw phone numbers (`09**-***-**09`) to protect student privacy until mutual identity is verified.
- **One-Click Security Escalation:** Allows any party to escalate disputes or high-value items directly to the Campus Security Office for arbitration.
- **Physical Custody Intake & Handover Terminal:** Equips security personnel with dedicated terminals (`/admin/handover` and `/admin/items/:id/accept-custody`) to log physical item receipt (`custody_received_at`, `custody_received_by`), verify student IDs, and sign off on physical release ledgers.
- **Claims Hub with Direct Withdrawal:** Users can inspect all claims they have filed or received, with direct one-click withdrawal for pending claims.

### 3. Institutional Identity & Account Security
- **Domain-Enforced RBAC:** Restricts institutional registration to verified `@my.cspc.edu.ph` (students) and `@cspc.edu.ph` (faculty and staff) domains, with dedicated Guest and Parent routing.
- **Parent/Guardian Student Linkage:** Allows external parents and guardians to link accounts to verified student profiles subject to student approval in Account Settings (`guardian_student_links`).
- **Email Multi-Factor Authentication (MFA):** Supports single-use, 6-digit TOTP verification codes (10-minute expiry, 5-attempt lockout, 60-second cooldown) with in-card verification stepper, live countdown timer, and cancel/reset navigation.
- **Self-Service Password Recovery:** 4-step recovery workflow (`/forgot-password`) supporting request, resend, code verification, and secure password reset.
- **Unified Profile Management:** Both standard users and administrators can view and update their personal details (full name and contact phone number) in Account Settings.

### 4. 60-Day Lifecycle Automation & Administrative Governance
- **Automated Stale Item Archiving:** Daily background scheduler (`services/lifecycle.js`) flags and transitions unclaimed active items older than 60 days into the administrative disposition queue.
- **Batch Disposition Approval:** Administrative batch approval (`POST /admin/reports/batch-approve`) and single-report disposition actions with audit tracking.
- **Interactive Analytics Dashboard:** Real-time metrics comparing P2P resolution efficiency vs. centralized office turn-ins, category breakdown distributions, and average turnaround times.
- **Multi-Photo Upload & Cloud Base64 Storage:** Supports up to 6 item report images per post with MIME-type validation, disk caching, and serverless database-backed Base64 fallback.
- **Data Export:** Instant CSV ledger downloads of campus reports (`/admin/reports/export-csv`) and security audit logs (`/admin/audit-logs/export`).

### 5. Embedded HANAP AI Assistant
- **Contextual Support Widget:** Floating AI assistant launcher (`views/partials/assistantWidget.ejs`) available to authenticated users across the portal.
- **Google Gemini Integration:** Powered by `@google/genai` (`gemini-3.6-flash`) with strict system instructions (`services/geminiAssistant.js`), rate limiting, and privacy guardrails that prevent disclosure of private database records.
- **Built-in HANAP Help Fallback:** If Gemini is unconfigured, unreachable, times out, or returns an error, the same HANAP AI responds with a rule-based help guide for common questions about accounts, reports, claims, messages, settings, and Security Desk procedures.

### 6. UI/UX Design System
- **Aurora Glass Aesthetics:** Built with Tailwind CSS, backdrop blurs, frosted glass panels, and smooth micro-interactions.
- **Daylight & Night Mode Themes:** Complete theme toggle between **Light Horizon** and **Serene Horizon Night Mode**, synchronized across navigation docks, settings radio controls, and persistent `localStorage`.
- **Adaptive Floating Dock Navigation:** Responsive capsule dock with dynamic active states, unread notification counter badges, and responsive navigation drawers for mobile and tablet screens.

### System Architecture & Lifecycle Workflow

#### Item Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Active: Report Filed (Lost / Found)
    Active --> UnderReview: Claim Filed with Proof
    UnderReview --> Active: Claim Rejected / Withdrawn
    UnderReview --> Claimed: Verification Approved (P2P / Security Handover)
    UnderReview --> Escalated: Disputed / Escalated to Security
    Escalated --> Claimed: Security Officer Confirms Custody Release
    Escalated --> Active: Security Officer Rejects Dispute
    Claimed --> Returned: Physical Handover Confirmed & Closed
    Active --> Archived: 60 Days Inactive / Stale Lifecycle Job
    Archived --> [*]: Administrative Disposition Approved
    Returned --> [*]: Case Permanently Resolved
```

#### End-to-End User Verification Workflow

```mermaid
flowchart TD
    A["Student Discovers Lost Belonging"] --> B["Submit Found Report on /items/new"]
    B --> C["Optional: Set Secret Challenge & Answer"]
    C --> D["Report Appears in Campus Catalog"]
    E["Owner Browses /catalog or Search Feed"] --> F["Open Item Detail (/items/:id)"]
    F --> G["Campus Match Engine: Enter Ownership Proof"]
    G --> H{"Match Score >= 80%?"}
    H -- "No (< 80%)" --> I["Guidance Banner & Refinement Prompt"]
    I --> G
    H -- "Yes (>= 80%)" --> J["Step 2: Submit Claim"]
    J --> K["Open Direct Claim Chat (/claims/:id)"]
    K --> L["Finder Reviews Statement & Chat Coordinates"]
    L --> M{"Resolution Path"}
    M -- "Safe Peer Handover" --> N["Finder Clicks 'Mark Returned'"]
    M -- "Security Arbitration" --> O["Click 'Escalate to Security'"]
    M -- "Invalid Claim" --> P["Click 'Reject Claim'"]
    O --> Q["Security Custody Terminal (/admin/handover)"]
    Q --> R["Officer Verifies ID & Confirms Release"]
    N --> S["Case Closed: Item Marked Returned"]
    R --> S
```

---

## 5. Technologies

| Layer | Component | Specification / Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | `>= 18.0.0` (LTS v20 / v24 tested) | Asynchronous JavaScript server runtime environment |
| **Web Framework** | Express.js | `^5.3.0` | MVC routing, middleware pipeline, and HTTP request handlers |
| **View Engine** | EJS | `^7.0.2` | Server-rendered templates with defensive fallback guards |
| **Database** | MySQL / PostgreSQL | `MySQL 8.0+` / `PostgreSQL 15+` | Dual-database architecture: Local MySQL or Cloud Supabase |
| **Database Drivers** | `mysql2` & `pg` | `mysql2 ^3.24.6` / `pg ^8.23.1` | Unified connection pooling with prepared parameterized queries |
| **Session Persistence** | `express-session` + Custom Store | `session ^1.19.0` | Database-backed sessions stored in `user_sessions` |
| **Authentication** | `bcrypt` | `bcrypt ^6.0.0` | Salted password hashing (10 salt rounds) & secure credentials |
| **Security Suite** | `helmet` & CSRF | `helmet ^8.3.0` | HTTP security headers, CSP, and cryptographic CSRF verification |
| **AI SDK** | `@google/genai` | `^2.31.0` | Official Google GenAI SDK powering the HANAP AI Assistant (`gemini-3.6-flash`) |
| **File Uploads** | `multer` + Base64 Fallback | `multer ^2.5.0` | Disk storage with serverless Base64 database persistence |
| **Mailing / MFA** | `nodemailer` | `^10.2.1` | SMTP email transport with local development console fallback |
| **Styling & Icons** | Tailwind CSS & Lucide Icons | Plus Jakarta Sans, Lucide Bundle | Glassmorphic design tokens, vector icons, and dark/light modes |
| **Automated Testing** | Custom QA Test Suite | Node.js Test Harness | 4 comprehensive test suites (61 test cases, 100% passing) |

---

## 6. Installation

### Prerequisites
- **Node.js:** Version `18.x`, `20.x`, or `24.x` LTS ([Download Node.js](https://nodejs.org/))
- **Database Engine:**
  - **Local Development:** MySQL Version `8.0+` (via XAMPP, MySQL Workbench, Laragon, or native service)
  - **Cloud Production:** Supabase Managed PostgreSQL project
- **Git:** Version `2.x+` ([Download Git](https://git-scm.com/))

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/veirubyte/projecthanap_ptappdev.git
   cd projecthanap_ptappdev
   ```

2. Install the required Node.js package dependencies:
   ```bash
   npm install
   ```

---

## 7. Configuration

Create your local `.env` configuration file by copying `.env.example`:

```powershell
# Windows (PowerShell):
Copy-Item .env.example .env
```
```bash
# macOS / Linux / Git Bash:
cp .env.example .env
```

### Local MySQL Configuration (`.env`)
```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=project_hanap
SESSION_SECRET=replace_with_a_strong_session_secret_key
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.6-flash
NODE_ENV=development
```

### Cloud Supabase PostgreSQL Configuration (`.env`)
```env
PORT=3000
DATABASE_URL=postgresql://postgres.[REF]:[PASS]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
DB_SSL=true
SESSION_SECRET=replace_with_a_strong_session_secret_key
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
NODE_ENV=production
```

---

## 8. Database Setup

### Option A: Local MySQL Setup
1. Start your **MySQL** service (e.g., click **Start** next to MySQL in XAMPP).
2. Import `project_hanap (4).sql` using phpMyAdmin or the MySQL CLI:
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS project_hanap CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   mysql -u root -p project_hanap < "project_hanap (4).sql"
   ```

### Option B: Cloud Supabase PostgreSQL Setup
1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard) &rarr; **SQL Editor**.
2. Open [`supabase_schema.sql`](supabase_schema.sql), copy its contents, and click **Run**.
3. Retrieve your Transaction Pooler URI from **Project Settings** &rarr; **Database** and set `DATABASE_URL` in `.env`.

---

## 9. How to Run

- **Development Mode (with auto-reload via Nodemon):**
  ```bash
  npm run dev
  ```

- **Standard / Production Start:**
  ```bash
  npm start
  ```

- **Run Automated QA & Integration Tests:**
  ```bash
  npm test
  ```

Once the server starts, open your browser to: **`http://localhost:3000`**

---

## 10. Automated Testing & QA Verification

Project HANAP incorporates a comprehensive 4-phase automated testing pipeline that executes via:
```bash
npm test
```

```mermaid
flowchart LR
    A["UI & Action Test (test_ui_and_actions.js)"] --> B["All Views Compiler (test_all_views.js)"]
    B --> C["MFA Stepper Suite (test_mfa_flow.js)"]
    C --> D["Live E2E Regression (e2e_live_audit.js)"]
    D --> E["100% Certified (61/61 PASS)"]
```

### Test Suite Components

1. **UI Actions & Headless Feature Test (`tests/test_ui_and_actions.js`):**
   - Verifies Admin settings includes Personal Details and omits Danger Zone.
   - Verifies Student settings includes Personal Details and Danger Zone.
   - Verifies Pending claims in the claims hub render a direct "Withdraw" form.
   - Verifies Report editing masks private verification answers and displays custody badges.
   - **Status: 3/3 PASS**

2. **Template View Compiler Test (`tests/test_all_views.js`):**
   - Compiles and renders all 20 EJS templates across Student, Administrator, and Guest execution contexts.
   - Prevents `ReferenceError` crashes when optional view locals are missing or renamed.
   - **Status: 20/20 PASS**

3. **2-Factor Authentication Integration Suite (`tests/test_mfa_flow.js`):**
   - End-to-end verification of the initial login 2FA input area, in-card stepper, attempt countdown, resend countdown, and cancel/reset stepper navigation.
   - **Status: 7/7 PASS**

4. **Live Production E2E Regression Suite (`tests/e2e_live_audit.js`):**
   - 31-step automated live regression test executed against the production deployment (`https://projecthanap-campus-system.vercel.app`) and Supabase PostgreSQL.
   - Exercises student and guest registration, session persistence in `user_sessions`, password reset, item reporting, search filters, dual-party chat, claim moderation, custody handover, CSV exports, settings updates, and data clean-up.
   - **Status: 31/31 PASS (100%)**

---

## 11. Cloud Deployment (Vercel & Supabase)

Project HANAP is architected for zero-downtime serverless deployment:
- **Web Application Host:** [Vercel](https://vercel.com/) (Serverless Express 5 runtime via `api/index.js` and `vercel.json`)
- **Database Host:** [Supabase](https://supabase.com/) (Managed PostgreSQL with connection pooling on Port 6543)
- **Session Persistence:** Persistent Express sessions stored in Supabase `public.user_sessions` table
- **Image Persistence:** Dynamic Base64 fallback in `app.js` serving images stored in `item_report_images.file_data`

### Production Environment Variables on Vercel
| Variable Name | Value / Description |
| :--- | :--- |
| `DATABASE_URL` | Supabase Transaction Pooler URI (`postgresql://postgres.[REF]:[PASS]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`) |
| `SESSION_SECRET` | 32+ character random string for signing session cookies |
| `DB_SSL` | `true` |
| `NODE_ENV` | `production` |
| `GEMINI_API_KEY` | Google Gemini API Key |
| `GEMINI_MODEL` | `gemini-3.6-flash` |

---

## 12. User Accounts

The seed database (`project_hanap (4).sql` and `supabase_schema.sql`) includes pre-configured user accounts for testing:

| Role | Full Name | Email Address | Password | Login Tab | Scope & Testing Capabilities |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Administrator** (`admin`) | Admin User | `admin@cspc.edu.ph` | `password123` | Institution | Full access to `/admin/dashboard`, Custody Handover (`/admin/handover`), 60-Day Archive (`/admin/reports`), User Management (`/admin/users`), Analytics, and Audit Logs. |
| **Staff / Faculty** (`staff`) | Maria Santos | `maria@my.cspc.edu.ph` | `password123` | Institution | Reporter of Lost Item #2 and active claimant on Item #1. |
| **Student / Institutional** | Juan Dela Cruz | `juan@my.cspc.edu.ph` | `password123` | Institution | Finder/Reporter of Found Item #1 (`challenge answer: College of Computer Studies`) and Item #4. |
| **Student** (`student`) | Marta | `marta@my.cspc.edu.ph` | `password123` | Institution | Student account (`ID: 2410979`) with photo report and active claim testing capability. |
| **Parent / Guest** (`guest`) | Parent Guest | `parent@gmail.com` | `password123` | Guest / Parent | External guest portal access, parent-to-student guardian linkage requests, and Security Desk claim routing. |

---

## 13. Project Structure

```ascii
projectHanap/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── task_issue.md              # Standardized GitHub Issue task template
│   └── pull_request_template.md       # Standardized Pull Request review checklist
├── api/
│   └── index.js                       # Vercel serverless function entrypoint
├── config/
│   ├── db.js                          # Unified MySQL / Supabase PostgreSQL connection pool
│   ├── roles.js                       # Institutional role constants, domain & password validators
│   ├── security.js                    # Rate limiters, CSRF token injector & protection middleware
│   └── sessionStore.js                # Database-backed session store for persistent Express sessions
├── controllers/
│   ├── assistantController.js         # HANAP AI Assistant chat validation & error handling
│   ├── authController.js              # Login, registration, password reset, MFA & session management
│   ├── homeController.js              # Public landing portal controller
│   └── itemController.js              # Catalog, reporting, match engine, claims, chat, settings & admin
├── docs/
│   └── REQUIREMENTS.md                # System Requirements Specification (Users, FRs, NFRs, Use Cases)
├── middleware/
│   ├── auth.js                        # Role gatekeepers (requireAuth, requireAdmin, requireNonAdminAuth)
│   ├── reportUpload.js                # Multer diskStorage configuration & multipart pre-CSRF parser
│   ├── security.js                    # Security middleware exports
│   └── viewLocals.js                  # Injects user session, admin flags & notification counts into EJS
├── migrations/
│   └── add_custody_receipt_columns.sql # Incremental migration for custody receipt tracking columns
├── models/
│   ├── auditLogModel.js               # Admin security audit trail queries
│   ├── claimModel.js                  # P2P claims, messages, handover queues & analytics metrics
│   ├── connectionModel.js             # Database connection pool transaction helper
│   ├── guardianLinkModel.js           # Parent/Guardian student linkage queries
│   ├── itemReportModel.js             # Item CRUD, catalog search/filtering, stats & 60-day disposition
│   ├── mfaModel.js                    # TOTP verification codes, attempt counters & expiry queries
│   └── userModel.js                   # User authentication, role lookups, quota & profile queries
├── public/
│   ├── css/
│   │   ├── assistant.css              # Styling for floating HANAP AI Assistant widget
│   │   └── style.css                  # Custom utility styles, glassmorphism & dark mode tokens
│   ├── js/
│   │   ├── assistant.js               # Client-side logic for HANAP AI Assistant conversation state
│   │   ├── lucide.min.js              # Self-hosted Lucide icons bundle (zero CSP restrictions)
│   │   └── main.js                    # Client-side helpers, timeAgo formatters & flash dismissers
│   └── uploads/                       # Multer item image upload destination directory
├── routes/
│   ├── assistantRoutes.js             # AI assistant endpoint (POST /api/assistant/chat)
│   ├── authRoutes.js                  # Authentication endpoints (/login, /register, /logout, /forgot-password)
│   ├── homeRoutes.js                  # Public root routing (/)
│   └── itemRoutes.js                  # Catalog, reports, claims, chat, settings & admin routes
├── services/
│   ├── answerMatch.js                 # Campus Match Engine string normalization & confidence scoring
│   ├── email.js                       # Nodemailer SMTP transporter with dev console fallback
│   ├── geminiAssistant.js             # Google GenAI SDK wrapper for HANAP AI Assistant
│   ├── hanapFallback.js               # Rule-based help responses when Gemini is unavailable
│   ├── lifecycle.js                   # 60-day automated stale report background archiver
│   └── mfa.js                         # 6-digit TOTP code generation & bcrypt hash verification
├── tests/
│   ├── e2e_live_audit.js              # 31-step comprehensive live cloud integration regression suite
│   ├── test_all_views.js              # Defensive view compiler verifying all 20 EJS templates
│   ├── test_mfa_flow.js               # 7-step Two-Factor Authentication lifecycle test suite
│   └── test_ui_and_actions.js         # UI and headless actions verification test suite
├── views/
│   ├── pages/
│   │   ├── 403.ejs                    # Access denied (403), Not Found (404) & server error display
│   │   ├── adminAnalytics.ejs         # P2P vs. Centralized Handover statistical performance metrics
│   │   ├── adminAuditLogs.ejs         # Chronological administrative security audit log
│   │   ├── adminDashboard.ejs         # Administrator central hub, custody intake & turnover overview
│   │   ├── adminReports.ejs           # 60-day disposition queue, report matrix & CSV export
│   │   ├── adminUsers.ejs             # User directory, role switcher & quota reset terminal
│   │   ├── chat.ejs                   # Peer claim coordination chat with phone number masking
│   │   ├── claims.ejs                 # Claims hub with direct withdrawal capability
│   │   ├── custodyHandover.ejs        # Security Desk physical property release terminal
│   │   ├── dashboard.ejs              # Student/Staff personal dashboard & catalog browser
│   │   ├── editReport.ejs             # Report edit form with masked secret answer & custody badge
│   │   ├── forgotPassword.ejs         # 4-step self-service password recovery flow
│   │   ├── guestClaim.ejs             # Security Desk routing guidance for parents and guests
│   │   ├── landing.ejs                # Public homepage & portal gateway
│   │   ├── login.ejs                  # Dual-tab login with in-card 2FA stepper & initial 2FA input
│   │   ├── myReports.ejs              # User's submitted reports management matrix
│   │   ├── postDetail.ejs             # Item showcase, Campus Match Engine & verification stepper
│   │   ├── register.ejs               # Dual-tab registration with live password strength meter
│   │   ├── reportItem.ejs             # Multi-step item submission form with photo uploads
│   │   ├── settings.ejs               # Account settings studio (Profile, Security, MFA, Guardian Links)
│   │   └── partials/                  # Forwarding partials for template lookup compatibility
│   └── partials/
│       ├── assistantWidget.ejs        # Floating HANAP AI Assistant UI partial
│       ├── navbar.ejs                 # Floating glass capsule navigation dock & mobile drawer
│       └── themeSetup.ejs             # Early dark-mode initialization script
├── .env.example                       # Environment variable configuration template (safe for Git)
├── .gitignore                         # Excludes node_modules, .env, and local artifacts
├── app.js                             # Core Express entrypoint, security pipeline & lifecycle scheduler
├── LICENSE                            # MIT License
├── package.json                       # Project metadata, dependencies, and NPM test scripts
├── project_hanap (4).sql              # Complete MySQL schema and seed dataset
├── supabase_schema.sql                # Complete PostgreSQL schema for Supabase deployment
├── vercel.json                        # Vercel serverless deployment routing & static headers config
└── README.md                          # Project documentation
```

### Comprehensive Route Directory

#### 1. Public, Authentication & Password Recovery (`routes/homeRoutes.js`, `routes/authRoutes.js`)
| Method | Route | Controller Handler | Access Scope | Description |
| :---: | :--- | :--- | :---: | :--- |
| `GET` | `/` | `homeController.showLandingPage` | Public | Public landing homepage with feature spotlights and CTA |
| `GET` | `/login` | `authController.showLogin` | Public | Dual-tab sign-in page (Institutional vs. Guest) with MFA prompt |
| `POST` | `/login` | `authController.login` | Public (Rate-Limited) | Authenticates credentials, enforces role checks, issues MFA or session |
| `GET` | `/register` | `authController.showRegistration` | Public | Registration page with live password complexity meter |
| `POST` | `/register` | `authController.register` | Public (Rate-Limited) | Validates domain rules (`@my.cspc.edu.ph` / `@cspc.edu.ph`) & creates user |
| `GET` | `/logout` | `authController.logout` | Authenticated | Destroys active session, clears cookie, and redirects to `/login` |
| `GET` | `/forgot-password` | `authController.showForgotPassword` | Public | Self-service password recovery wizard |
| `POST` | `/forgot-password/request` | `authController.requestPasswordReset` | Public (Rate-Limited) | Sends a 6-digit password reset verification code via email |
| `POST` | `/forgot-password/resend` | `authController.resendPasswordResetCode` | Public (Rate-Limited) | Resends a password reset verification code with cooldown |
| `POST` | `/forgot-password/verify` | `authController.verifyPasswordResetCode` | Public (Rate-Limited) | Verifies the 6-digit password recovery code |
| `POST` | `/forgot-password/reset` | `authController.completePasswordReset` | Public (Rate-Limited) | Completes password reset with new password confirmation |

#### 2. Catalog, Item Reporting & Match Engine (`routes/itemRoutes.js`)
| Method | Route | Controller Handler | Access Scope | Description |
| :---: | :--- | :--- | :---: | :--- |
| `GET` | `/catalog` | `itemController.showDashboard` | Public | Searchable campus catalog with keyword, type, category & date filters |
| `GET` | `/dashboard` | `itemController.showDashboard` | Non-Admin | User dashboard with personal stats, active trackers, and catalog feed |
| `GET` | `/items/new` | `itemController.showNewReportForm` | Non-Admin | Multi-step form to report a lost or found item |
| `POST` | `/items/report` | `itemController.createItemReport` | Non-Admin | Validates input, processes Multer photo uploads, and saves report |
| `GET` | `/items/:id` | `itemController.showItemDetails` | Public | Item detail view with Campus Match Engine & radial verification stepper |
| `POST` | `/items/:id/match-preview` | `itemController.previewOwnershipMatch` | Non-Admin | Live AJAX endpoint returning real-time confidence score ($0\text{–}100\%$) |
| `POST` | `/items/:id/claim` | `itemController.createClaim` | Non-Admin | Enforces $\ge 80\%$ match threshold and creates ownership claim |
| `GET` | `/claims/guest-claim` | `itemController.showGuestClaimGuide` | Public | Security Desk claim protocol guide for parents and visitors |

#### 3. Claims Coordination, P2P Chat & My Reports (`routes/itemRoutes.js`)
| Method | Route | Controller Handler | Access Scope | Description |
| :---: | :--- | :--- | :---: | :--- |
| `GET` | `/claims` | `itemController.listClaims` | Non-Admin | Claims hub displaying submitted and received ownership claims with withdraw action |
| `GET` | `/claims/:id` | `itemController.showClaimChat` | Participant / Admin | P2P claim chat thread with automated phone number masking |
| `POST` | `/claims/:id/messages` | `itemController.sendClaimMessage` | Participant / Admin | Posts a message inside the claim coordination thread |
| `POST` | `/claims/:id/status` | `itemController.updateClaimStatus` | Participant / Admin | Transitions claim (`approved`, `rejected`, `escalated`, `returned`) |
| `POST` | `/claims/:id/cancel` | `itemController.cancelClaim` | Non-Admin | Withdraws a pending ownership claim from post detail or claims hub |
| `GET` | `/my-reports` | `itemController.listMyReports` | Non-Admin | Personal report management dashboard |
| `GET` | `/items/:id/edit` | `itemController.showEditItemForm` | Owner / Admin | Displays edit form with masked secret answer and custody badge |
| `POST` | `/items/:id/edit` | `itemController.updateItemReport` | Owner / Admin | Validates and updates report fields, photos, and challenge |
| `POST` | `/items/:id/status` | `itemController.updateItemStatus` | Owner / Admin | Updates report status (`active`, `claimed`, `returned`, `archived`) |
| `POST` | `/items/:id/delete` | `itemController.deleteItemReport` | Owner / Admin | Permanently deletes an item report |

#### 4. Account Settings & AI Assistant (`routes/itemRoutes.js`, `routes/assistantRoutes.js`)
| Method | Route | Controller Handler | Access Scope | Description |
| :---: | :--- | :--- | :---: | :--- |
| `GET` | `/settings` | `itemController.showSettings` | Authenticated | Account settings studio (Profile, Security, MFA, Guardian Links) |
| `POST` | `/settings/profile` | `itemController.updateProfile` | Authenticated | Updates user display name and contact phone number (Students & Admins) |
| `POST` | `/settings/security` | `itemController.updateSecurity` | Authenticated | Changes password after verifying current password & complexity |
| `POST` | `/settings/mfa/enable` | `itemController.enableMfa` | Authenticated | Enables Email MFA after password re-authentication |
| `POST` | `/settings/mfa/disable` | `itemController.disableMfa` | Authenticated | Disables Email MFA after password re-authentication |
| `POST` | `/settings/notifications` | `itemController.updateNotificationSettings`| Authenticated | Updates user notification preferences |
| `POST` | `/settings/guardian-links` | `itemController.createGuardianLink` | Parent / Guest | Requests parent/guardian linkage to a student account |
| `POST` | `/settings/guardian-links/:id/:decision` | `itemController.decideGuardianLink` | Student | Approves or rejects a pending parent/guardian link request |
| `POST` | `/settings/delete-account` | `itemController.deleteAccount` | Non-Admin | Permanently deletes user account and personal configurations |
| `POST` | `/api/assistant/chat` | `assistantController.chat` | Authenticated | Queries Google Gemini with local rule-based fallback guide |

#### 5. Administrative Platform Governance (`routes/itemRoutes.js`)
| Method | Route | Controller Handler | Access Scope | Description |
| :---: | :--- | :--- | :---: | :--- |
| `GET` | `/admin` | Inline Redirect | Administrator | Cleanly redirects `/admin` to `/admin/dashboard` |
| `GET` | `/admin/dashboard` | `itemController.showAdminDashboard` | Administrator | Central admin command center, pending custody intake & metrics |
| `POST` | `/admin/items/:id/accept-custody` | `itemController.acceptItemCustody` | Administrator | Records official physical receipt of a Security Desk item |
| `GET` | `/admin/handover` | `itemController.listHandoverClaims` | Administrator | Physical Custody Handover queue for Campus Security |
| `GET` | `/admin/handover/:claimId` | `itemController.showHandoverClaim` | Administrator | Single claim physical handover verification terminal |
| `POST` | `/admin/handover/:claimId/confirm`| `itemController.confirmHandover` | Administrator | Confirms physical property release and marks item returned |
| `POST` | `/admin/handover/:claimId/reject` | `itemController.rejectHandover` | Administrator | Rejects handover release and logs audit entry |
| `GET` | `/admin/users` | `itemController.listAdminUsers` | Administrator | User directory with search, role management & quota controls |
| `POST` | `/admin/users/add` | `itemController.createAdminUser` | Administrator | Creates a new institutional user account |
| `POST` | `/admin/users/:id/role` | `itemController.updateUserRole` | Administrator | Updates a user's system role and logs to `audit_logs` |
| `POST` | `/admin/users/:id/quota-reset` | `itemController.resetUserQuota` | Administrator | Resets a user's active report quota |
| `GET` | `/admin/reports` | `itemController.listAdminReports` | Administrator | All reports registry, 60-day disposition queue & CSV export |
| `GET` | `/admin/reports/export-csv` | `itemController.exportReportsCsv` | Administrator | Exports all campus item reports as a formatted CSV ledger |
| `POST` | `/admin/reports/:id/archive-approve`| `itemController.approveReportArchive` | Administrator | Approves single overdue report for archive disposition |
| `POST` | `/admin/reports/batch-approve` | `itemController.batchApproveReportArchive` | Administrator | Batch-approves all eligible 60-day stale reports |
| `GET` | `/admin/analytics` | `itemController.showAdminAnalytics` | Administrator | Statistical dashboard comparing P2P vs. Security Desk handovers |
| `GET` | `/admin/audit-logs` | `itemController.listAuditLogs` | Administrator | Immutable chronological security audit log viewer |
| `GET` | `/admin/audit-logs/export` | `itemController.exportAuditLogsCsv` | Administrator | Exports administrative security audit logs as a CSV file |
| `POST` | `/admin/items/log` | `itemController.createAdminItemReport`| Administrator | Directly logs an office turn-in item report at security desk |
| `GET` | `/admin/test-403` | `itemController.showForbiddenPage` | Administrator | Diagnostic route to preview the 403 Forbidden security screen |

---

## 14. Known Limitations

1. **Sliding-Window Rate Limiter State:** The in-memory sliding-window rate limiter (`config/security.js`) resets counters when the Node process restarts. Active user sessions, however, are persistent across restarts in production through the database-backed session store (`public.user_sessions`).
2. **HTTP Request/Response Chat Refresh:** The peer-to-peer claim chat (`views/pages/chat.ejs`) operates over standard HTTP form submissions. Users refresh or post new messages to see updates rather than using persistent WebSockets (`Socket.IO`).
3. **Local Filesystem vs. Serverless Image Persistence:** On local instances, images reside on disk under `public/uploads/`. In cloud serverless environments (Vercel), images are seamlessly persisted into `item_report_images.file_data` (Base64) and dynamically served via `/uploads/:filename`, eliminating ephemeral storage data loss.
4. **In-Process Lifecycle Scheduler:** The 60-day stale item archiver (`services/lifecycle.js`) executes on a 24-hour interval timer within the active server process rather than an external OS cron job.
5. **AI Assistant Privacy Sandboxing & Connectivity:** To protect student privacy, the HANAP AI Assistant does not query private database tables and cannot inspect user claim details or secret challenge answers. If Gemini is unreachable or unconfigured, the built-in rule-based guide answers navigation and protocol questions locally.
6. **External SMTP Dependency for Live Emails:** Real delivery of 6-digit MFA codes and password recovery codes requires configured SMTP credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`); in local development, OTP codes log directly to the console.

---

## 15. AI Assistance Disclosure

In compliance with Section 17 and Section 20 of the **PTAppDev Midterm Project (Campus System – Round 1)** guidelines, the team discloses the following uses of Artificial Intelligence tools:

1. **Development-Time AI Assistance:**
   - **Tools Used:** Google Gemini, ChatGPT, and GitHub Copilot.
   - **Scope of Use:** AI tools were utilized during development to assist with UI/UX Tailwind CSS styling refinements, boilerplate scaffolding, debugging asynchronous database queries, refining string-similarity logic in the Campus Match Engine (`services/answerMatch.js`), structuring automated test suites, and maintaining technical documentation (`README.md` and `docs/REQUIREMENTS.md`).
   - **Team Accountability & Verification:** All AI-assisted code snippets, database queries, and templates were thoroughly reviewed, modified, integrated, and verified by the development team. Every member understands and can defend the system architecture, routing, database schema, validation rules, and business logic.

2. **Runtime Embedded AI Feature:**
   - Project HANAP integrates the official `@google/genai` SDK (`services/geminiAssistant.js`, `controllers/assistantController.js`) to power the in-app **HANAP AI Assistant** widget (`gemini-3.6-flash`), which answers user questions on how to navigate and use the lost-and-found portal.

---

## 16. License

This project is licensed under the terms of the **MIT License**. For complete terms, permissions, and conditions, refer to the [LICENSE](LICENSE) file located in the root repository directory.
