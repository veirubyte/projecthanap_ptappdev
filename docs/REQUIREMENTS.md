# System Requirements Specification (SRS)
## Project HANAP &bull; Campus Lost and Found System (Round 1)

**Course:** PTAppDev (Platform Technologies & Web Application Development)  
**Document Version:** 1.0.0 (Midterm Baseline)  
**Status:** Approved Starter Specification  

---

## 1. System Users & Permissions

Project HANAP serves three distinct user classes within the collegiate campus environment:

| User Class | Description | System Permissions & Access Scope |
| :--- | :--- | :--- |
| **Student** | Enrolled undergraduate and graduate students holding active institutional credentials. | - Browse and filter public catalog of turned-in items.<br>- Submit new reports for personal misplaced items.<br>- Submit verified claim requests for items matching personal property.<br>- View real-time status updates on personal reports and submitted claims. |
| **Faculty & Staff** | Academic professors, laboratory custodians, library aides, and security personnel. | - All Student privileges.<br>- Register found items surrendered by students or discovered in campus facilities.<br>- Inspect surrendered item custody status.<br>- Review, verify, and approve/reject claimant proof of ownership.<br>- Generate custody intake numbers and hand-over slips. |
| **System Administrator** | Management Information Systems (MIS) and Office of Student Affairs (OSA) administrators. | - Full read/write/update/delete privileges across all entities.<br>- Manage user accounts, role escalations, and account suspensions.<br>- Configure system parameters, categories, and campus building depots.<br>- Review system audit logs and override disputed claims. |

---

## 2. System Stakeholders

The following campus departments, offices, and entities are directly impacted by the deployment of Project HANAP:

1. **Student Body:** Students who experience loss of critical items (e.g., student IDs, ATM cards, scientific calculators, laptops, prescription glasses) and require a dependable, transparent recovery portal.
2. **Campus Security & Public Safety Department:** Frontline officers responsible for physical lost-and-found custody, secure item storage, and verifying ownership before releasing items.
3. **Office of Student Affairs (OSA):** Administrative body overseeing campus welfare, student conduct, and disputes concerning missing property.
4. **University Library & Laboratory Custodians:** Frequent intake depots where study materials, thumb drives, books, and calculators are regularly left behind.
5. **IT & MIS Infrastructure Team:** System custodians responsible for server uptime, database backups, data security, and directory synchronization.

---

## 3. Functional Requirements

| Requirement ID | Requirement Name | Description & Acceptance Criteria |
| :--- | :--- | :--- |
| **FR-01** | User Account Registration | The system shall allow users to register an account by providing full name, institutional email address, department, password, and role selection with confirmation. |
| **FR-02** | User Authentication & Session Creation | The system shall authenticate credentials against hashed passwords stored in MySQL and establish a secure, stateful server session upon valid login. |
| **FR-03** | Secure User Logout | The system shall terminate active sessions upon logout, invalidate the session cookie (`connect.sid`), and redirect the user safely to the public landing page. |
| **FR-04** | Role-Based Access Control (RBAC) | The system shall restrict route endpoints based on role (`Admin`, `Staff`, `Student`) and immediately block unauthorized users from bypassing restrictions via direct URL entry. |
| **FR-05** | Server-Side Form Validation | The system shall validate all form inputs on the server (checking non-empty required fields, email syntax, string bounds, and duplicate entries) before executing database transactions. |
| **FR-06** | Lost Item Record Creation | The system shall allow authenticated users to submit a lost item report specifying title, category, description, last seen location, and estimated loss date. |
| **FR-07** | Found Property Custody Intake | The system shall allow staff to log turned-in items, assign unique item tracking codes (e.g. `HNP-2026-XXX`), and record the physical depot holding the item. |
| **FR-08** | Item Status Modification | The system shall allow authorized staff and admins to update item lifecycles (`Lost` &rarr; `Turned In` &rarr; `Verification Pending` &rarr; `Claim Approved` &rarr; `Reunited`). |
| **FR-09** | Catalog Search & Multi-Filter | The system shall provide an intuitive catalog allowing users to perform keyword search queries and filter by item status, category, and campus building location. |
| **FR-10** | Persistent Relational Storage | The system shall store all user profiles, item logs, categories, and claim records in a normalized MySQL database adhering to foreign key referential integrity. |

---

## 4. Non-Functional Requirements

| Requirement ID | Requirement Name | Metric & Technical Implementation Standard |
| :--- | :--- | :--- |
| **NFR-01** | Cryptographic Password Hashing | All user passwords must be hashed before storage using `bcrypt` with a minimum work factor of 10 salt rounds. Plaintext passwords must never be stored, logged, or transmitted. |
| **NFR-02** | Environment Variable Isolation | All sensitive credentials (database host, database user, passwords, session secret keys) must reside strictly in `.env` and be managed through `dotenv`. Secrets must never be committed to Git. |
| **NFR-03** | Validation & Response Latency | Server-side validation and database transactions must execute within 200ms under standard local load, presenting clear, user-friendly error banners upon submission errors. |
| **NFR-04** | Data Persistence & Durability | All system state changes must be immediately committed to MySQL, persisting safely across server restarts, browser refreshes, and client crashes without data corruption. |
| **NFR-05** | Usability & Responsive UI | The web interface must be built using Bootstrap 5 semantic HTML/CSS, maintaining complete visual fidelity and functional responsiveness across mobile (375px), tablet, and desktop viewports. |

---

## 5. Use Cases

### Use Case 1: Student Reports a Lost Item
| Field | Specification |
| :--- | :--- |
| **Use Case Name** | Report Missing Campus Property |
| **Actor** | Student |
| **Precondition** | User is logged into an active student account with verified institutional email. |
| **Step-by-Step Flow** | 1. Student navigates to the "Report Item" link on the navigation bar.<br>2. System displays the missing item intake form with fields for item title, category, description, date last seen, and location.<br>3. Student enters item details (e.g. "TI-84 Plus CE Calculator, Navy Blue") and clicks "Submit Report".<br>4. Server-side validation middleware verifies that all required fields are populated and lengths conform to bounds.<br>5. Controller inserts record into the MySQL database with status set to `Lost`.<br>6. System assigns unique tracking code and redirects student to their active reports dashboard with a success banner. |
| **Expected Result** | Lost item record is successfully stored in MySQL and immediately visible in the student's dashboard and public registry. |

---

### Use Case 2: Staff Logs a Turned-In Item
| Field | Specification |
| :--- | :--- |
| **Use Case Name** | Intake & Register Surrendered Found Property |
| **Actor** | Campus Security Officer / Custodial Staff |
| **Precondition** | User is authenticated with `Staff` or `Admin` role privileges. |
| **Step-by-Step Flow** | 1. Staff accesses the Staff Intake Portal at `/items/intake`.<br>2. Staff fills in the intake form: item name, category, location found (e.g. "Main Library 2nd Floor"), intake depot, and physical condition.<br>3. Staff submits the form.<br>4. Controller invokes server-side validator; upon validation success, an `INSERT` query generates a new item entity marked as `Turned In`.<br>5. System generates an official custody tracking ID (e.g. `#HNP-2026-009`).<br>6. System displays the printable custody receipt and logs the transaction. |
| **Expected Result** | Found item is committed to the database, placed in physical depot custody, and indexed in the searchable catalog. |

---

### Use Case 3: Public Catalog Search & Dynamic Filtering
| Field | Specification |
| :--- | :--- |
| **Use Case Name** | Search and Filter Found Property Catalog |
| **Actor** | Any Campus User (Guest, Student, Staff, Admin) |
| **Precondition** | Web application is online and accessible. |
| **Step-by-Step Flow** | 1. User navigates to the public catalog page (`/` or `/items`).<br>2. User enters search keywords (e.g. "HydroFlask") into the search bar or selects a category (e.g. "Personal Accessories").<br>3. Client initiates request or filters client-side table dynamically.<br>4. Controller executes parameterized SQL `SELECT` with `LIKE` and category filter conditions.<br>5. View dynamically renders matched items matching the criteria along with their status badge and date logged. |
| **Expected Result** | Only items matching the search query and active filter criteria are rendered in the catalog table. |

---

### Use Case 4: Student Submits Item Ownership Claim
| Field | Specification |
| :--- | :--- |
| **Use Case Name** | File Proof-of-Ownership Claim |
| **Actor** | Student |
| **Precondition** | Student is authenticated and has located their missing item in the `Turned In` catalog. |
| **Step-by-Step Flow** | 1. Student clicks "Claim Item" on a specific turned-in item record.<br>2. System displays the claim submission modal/page requiring proof of ownership details (e.g., serial number, distinctive stickers, exact wallpaper on lock screen).<br>3. Student enters proof details and submits.<br>4. Server validation checks input length and confirms the item is still eligible for claiming.<br>5. System inserts claim record into `claims` table and transitions item status to `Verification Pending`.<br>6. System displays a claim tracking confirmation number to the student. |
| **Expected Result** | Claim is registered, item status is locked to prevent duplicate claims, and security staff is notified to review proof. |

---

### Use Case 5: Direct URL Role Authorization Verification (Security Check)
| Field | Specification |
| :--- | :--- |
| **Use Case Name** | Block Unauthorized Direct URL Access to Admin Console |
| **Actor** | Regular Student (Unauthorized Actor) |
| **Precondition** | User is logged in with `Student` role (or is an unauthenticated guest). |
| **Step-by-Step Flow** | 1. Student manually types an administrative URL (e.g. `http://localhost:3000/admin/users` or `/admin/settings`) directly into the browser address bar.<br>2. Request hits the Express routing engine and enters `authorizeRole('Admin')` middleware.<br>3. Middleware checks `req.session.user.role`.<br>4. Middleware identifies role as `'Student'`, which is not in the allowed list `['Admin']`.<br>5. Middleware immediately blocks access, logs the unauthorized attempt, and halts the route handler.<br>6. System returns an HTTP 403 Forbidden status code and renders the custom 403 Error view with an explanatory access denied message. |
| **Expected Result** | Student is completely blocked from viewing or executing administrative operations via direct URL entry. |
