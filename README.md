# Project Description

**Project HANAP** (*Holistic Asset Notification & Access Portal*) is a centralized, web-based Campus Lost and Found, Asset Tracking, and Item Recovery System built for collegiate environments. Across university campuses, hundreds of personal and academic belongings—such as student identification cards, laptops, scientific calculators, laboratory coats, and keys—are misplaced every academic term. Currently, campus lost-and-found management relies heavily on disconnected physical notebooks, unmonitored drop-off desks, and informal, chaotic social media posts. This lack of centralized tracking causes low item recovery rates, security vulnerabilities, fraudulent claims, and wasted administrative hours.

Project HANAP addresses these challenges by delivering an auditable, role-restricted, and accessible web portal. The system empowers students and faculty to rapidly report lost items and search recovered property catalogs, while providing campus security officers, custodial personnel, and student affairs administrators with structured custody workflows, verification checks, status tracking, and claim validation logs.

---

## Team Members

| Member Identifier | Full Name / GitHub Handle | Core Technical Responsibilities | Primary Feature Branch |
| :--- | :--- | :--- | :--- |
| **Member 1** | Backend & Routing Architect (`Team Member 1`) | Server configuration, Express routing, controller business logic, server-side validation middleware, and API responses. | `feature/backend-routes` |
| **Member 2** | Frontend & UI/UX Specialist (`Team Member 2`) | EJS view templates, partials (`header`, `footer`), responsive Bootstrap 5 styling, forms, client feedback, and UX accessibility. | `feature/frontend-pages` |
| **Member 3** | Database, Auth & Security (`Team Member 3`) | MySQL schema design, connection pooling (`mysql2/promise`), `bcrypt` password hashing, `express-session` RBAC, and test suites. | `feature/database-auth` |

---

## Assigned System

- **Course:** PTAppDev (Platform Technologies & Web Application Development)
- **Academic Term / Year:** Midterm Project Evaluation (2026)
- **Team / Pair Identifier:** Team Project HANAP &bull; Group 1
- **Assigned System Domain:** Campus Lost and Found & Property Recovery Management System (Round 1 Baseline Specification)
- **Repository Remote:** `https://github.com/veirubyte/projecthanap_ptappdev.git`

---

## Features

- **Multi-Page Semantic Navigation:** Clean, modern layout rendered with server-side EJS templates, dynamic active link states, and responsive navigation across mobile and desktop viewports.
- **Form Processing with Strict Server-Side Validation:** Reusable validation middleware validating required inputs, institutional email patterns, string boundary limits, numeric parameters, and database duplicate checks prior to storage.
- **Persistent Relational Database CRUD:** Asynchronous MySQL operations powered by `mysql2/promise` with connection pooling, transactional integrity, and parameterized queries preventing SQL injection.
- **Session-Based Authentication:** Stateful user session management using `express-session`, secure HTTP-only cookies, and encrypted passwords salted and hashed with `bcrypt`.
- **Role-Based Access Control (RBAC):** Middleware protecting private routes (`isAuthenticated`) and restricting administrative endpoints (`authorizeRole('Admin', 'Staff')`), effectively preventing unauthorized users from bypassing restrictions via direct URL address bar tampering.
- **Item Lifecycle Status Tracking:** Formal transitions tracking items from `Lost` / `Turned In` to `Verification Pending`, `Claim Approved`, and `Reunited`.

---

## Technologies

- **Runtime Environment:** [Node.js](https://nodejs.org/) (v18.x - v24.x LTS recommended)
- **Web Framework:** [Express.js](https://expressjs.com/) (v5.x modular MVC architecture)
- **Templating Engine:** [EJS](https://ejs.co/) (Embedded JavaScript Templates)
- **Database Engine:** [MySQL](https://www.mysql.com/) (Relational database management)
- **Database Driver:** [mysql2](https://github.com/sidorares/node-mysql2) (Promise-based asynchronous client)
- **Authentication & Security:** [express-session](https://github.com/expressjs/session) & [bcrypt](https://github.com/kelektiv/node.bcrypt.js)
- **Configuration Management:** [dotenv](https://github.com/motdotla/dotenv)
- **Frontend Framework:** [Bootstrap 5.3.3](https://getbootstrap.com/) & [Bootstrap Icons](https://icons.getbootstrap.com/)
- **Typography:** [Google Fonts (Inter)](https://fonts.google.com/specimen/Inter)
- **Development Tooling:** [Nodemon](https://nodemon.io/) (Live file reloading)

---

## Installation

Ensure [Node.js](https://nodejs.org/) (v18+) and [Git](https://git-scm.com/) are installed on your machine.

1. Clone the repository from GitHub:
   ```bash
   git clone https://github.com/veirubyte/projecthanap_ptappdev.git
   cd projecthanap_ptappdev
   ```

2. Install all required production and development dependencies:
   ```bash
   npm install
   ```

---

## Configuration

1. Create a local environment file by duplicating the provided template:
   ```bash
   # On Windows (PowerShell):
   Copy-Item .env.example .env

   # On macOS/Linux:
   cp .env.example .env
   ```

2. Open `.env` in your code editor and verify your local MySQL configuration:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASS=your_local_mysql_password
   DB_NAME=projecthanap_db
   SESSION_SECRET=projecthanap_ultra_secure_session_secret_key_2026
   NODE_ENV=development
   ```

> [!IMPORTANT]
> The `.env` file contains sensitive local credentials and is strictly excluded from version control via `.gitignore`. Never commit `.env` to Git.

---

## Database Setup

1. Launch your MySQL service (via XAMPP, MySQL Workbench, Docker, or native CLI):
   ```bash
   mysql -u root -p
   ```

2. Create the database and execute the initial schema:
   ```sql
   CREATE DATABASE IF NOT EXISTS projecthanap_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   USE projecthanap_db;

   -- 1. Users Table
   CREATE TABLE IF NOT EXISTS users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     full_name VARCHAR(120) NOT NULL,
     email VARCHAR(150) NOT NULL UNIQUE,
     password_hash VARCHAR(255) NOT NULL,
     role ENUM('Admin', 'Staff', 'Student') NOT NULL DEFAULT 'Student',
     department VARCHAR(100) NOT NULL DEFAULT 'General',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   ) ENGINE=InnoDB;

   -- 2. Item Categories Table
   CREATE TABLE IF NOT EXISTS categories (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(80) NOT NULL UNIQUE,
     description VARCHAR(255)
   ) ENGINE=InnoDB;

   -- 3. Items Registry Table
   CREATE TABLE IF NOT EXISTS items (
     id INT AUTO_INCREMENT PRIMARY KEY,
     item_code VARCHAR(30) NOT NULL UNIQUE,
     title VARCHAR(150) NOT NULL,
     description TEXT NOT NULL,
     category_id INT,
     location_found VARCHAR(150) NOT NULL,
     item_status ENUM('Lost', 'Turned In', 'Claimed', 'Archived') DEFAULT 'Turned In',
     reported_by INT NOT NULL,
     date_logged DATE NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
     FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE CASCADE
   ) ENGINE=InnoDB;

   -- 4. Seed Categories
   INSERT IGNORE INTO categories (id, name, description) VALUES
   (1, 'Electronics', 'Laptops, phones, chargers, storage devices, and calculators'),
   (2, 'Personal Accessories', 'Bottles, umbrellas, eyeglasses, and jewelry'),
   (3, 'Documents & Identification', 'Campus IDs, driver licenses, ATM cards, and notebooks'),
   (4, 'Apparel & Bags', 'Jackets, backpacks, lab coats, and uniforms');

   -- 5. Seed Test Users (Password: AdminPass123!, StaffPass123!, StudentPass123!)
   INSERT IGNORE INTO users (id, full_name, email, password_hash, role, department) VALUES
   (1, 'System Administrator', 'admin@hanap.campus.edu', '$2b$10$wTf7m339gP6aHjB7E20Wbe94WcIuT4f84R71rGz39uW10Vp6XbCke', 'Admin', 'Management Information Systems'),
   (2, 'Campus Security Officer', 'staff@hanap.campus.edu', '$2b$10$yF1aX392pQ4bWzV8D31Vee02VbHtS3e73Q60qFy28tV09Uo5WaBjd', 'Staff', 'Campus Security & Custody Office'),
   (3, 'Maria Santos', 'student@hanap.campus.edu', '$2b$10$zE2bY403qR5cXxW9E42Wff13WcIuT4f84R71rGz39uW10Vp6XbCke', 'Student', 'College of Computer Studies');
   ```

---

## How to Run

- **Development Mode (with auto-reloading):**
  ```bash
  npm run dev
  ```

- **Production Mode:**
  ```bash
  npm start
  ```

Once initiated, open your web browser and visit:
`http://localhost:3000`

---

## User Accounts

The system includes pre-configured test user accounts representing each role level for instructor grading and peer review verification:

| Role Level | Full Name | Email Address | Plaintext Password | Permitted Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin** | System Administrator | `admin@hanap.campus.edu` | `AdminPass123!` | Full system privileges, user role management, system settings, audit logs, and catalog administration. |
| **Staff / Faculty** | Campus Security Officer | `staff@hanap.campus.edu` | `StaffPass123!` | Custody management, turn-in receipt generation, claim verification, status updates, and reporting. |
| **Student** | Maria Santos | `student@hanap.campus.edu` | `StudentPass123!` | Public catalog browsing, reporting missing items, filing item claim requests, and tracking own submissions. |

---

## Project Structure

```ascii
campus-system/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── task_issue.md          # Structured template for team member task tracking
│   └── pull_request_template.md   # Standardized PR checklist and peer code review guide
├── config/
│   ├── .gitkeep
│   └── db.js                      # MySQL2 connection pool & async connectivity testing
├── controllers/
│   ├── .gitkeep
│   └── indexController.js         # Starter index/home controller
├── docs/
│   ├── .gitkeep
│   └── REQUIREMENTS.md            # Complete 5-section project system requirements specification
├── middleware/
│   ├── .gitkeep
│   ├── authMiddleware.js          # Session gatekeeper (isAuthenticated) & RBAC (authorizeRole)
│   └── validationMiddleware.js    # Reusable server-side input, length, email, and duplicate validation
├── models/
│   └── .gitkeep                   # Data models and database query abstractions
├── public/
│   ├── css/
│   │   ├── .gitkeep
│   │   └── style.css              # Starter stylesheet to be customized by Member 2 (Frontend)
│   ├── images/
│   │   └── .gitkeep               # Static graphical assets, campus logos, and placeholders
│   └── js/
│       ├── .gitkeep
│       └── main.js                # Starter frontend script to be customized by Member 2 (Frontend)
├── routes/
│   ├── .gitkeep
│   ├── authRoutes.js              # Starter auth route scaffolding (/auth/login, /auth/logout)
│   └── indexRoutes.js             # Core navigation starter endpoint (/)
├── views/
│   ├── pages/
│   │   ├── .gitkeep
│   │   ├── error.ejs              # Generic error display template
│   │   └── index.ejs              # Starter home layout template
│   └── partials/
│       ├── .gitkeep
│       ├── footer.ejs             # Starter footer layout with Bootstrap 5 bundle
│       └── header.ejs             # Starter header layout with Bootstrap 5 and navigation
├── .env.example                   # Safe configuration template containing placeholder variables
├── .gitignore                     # Git exclusion rules blocking node_modules and secrets
├── LICENSE                        # MIT License legal terms
├── package.json                   # Project metadata, dependencies, and NPM execution scripts
└── README.md                      # Mandatory 14-section project documentation and guide
```

---

## Known Limitations

- **Round 1 Scope Boundary:** File attachment uploads (e.g. uploading high-resolution JPEG photos of lost/found items) are currently mocked with category badge placeholders; multipart file handling via `multer` is planned for Round 2.
- **Email Notifications:** Automatic campus email dispatch upon claim status changes is currently simulated through system status logs rather than a live SMTP transport.
- **SMS / Push Alerts:** Immediate SMS alerts for verified ID matches are planned for post-midterm integration with third-party telecom gateways.

---

## AI Assistance Disclosure

In compliance with academic integrity guidelines, the team explicitly discloses that AI tools, including **Google Antigravity** and **Gemini**, were utilized during the development of this starter repository for:
- Repository directory scaffolding and `.gitkeep` structural integrity,
- Boilerplate architecture design across modular MVC folders,
- Comprehensive markdown formatting for system requirements, PR templates, and issue templates, and
- Syntactical verification of Express middleware and async connection handlers.

**Team Confirmation & Defense Statement:**  
All three team members have comprehensively reviewed, edited, tested, and understood every file, route, configuration setting, and middleware layer included in this repository. All members are fully prepared and equipped to individually defend the entire architectural codebase during oral evaluation and technical code review examinations.

---

## License

This project is licensed under the terms of the **MIT License**. For complete license terms and permissions, please refer to the [LICENSE](LICENSE) file located in the root directory.
