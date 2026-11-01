# Project HANAP - Design System & Theme Reference Specification

> **AI Reference Manual & UI Architecture Standard**  
> *Holistic Asset Notification & Access Portal (Project HANAP)*  
> *Camarines Sur Polytechnic Colleges (CSPC)*

---

## 1. Design Philosophy & Campus Aesthetic

Project HANAP's interface is engineered around **Institutional Glassmorphism** blended with **Material Design 3 (M3) Elevation Tokens**. It is specifically designed to balance collegiate authority, student-friendly accessibility, and enterprise-grade auditability.

### Core Principles
1. **Institutional Trust & Clarity:** Academic workflows (item tracking, ownership claims, security custody ledgers) demand high legibility, clean visual hierarchy, and unambiguous status indicators.
2. **Ambient Living Mesh:** Rather than flat or sterile corporate canvases, public and authenticated dashboards feature subtle, floating glassmorphic aurora gradients that create optical depth without distracting from data.
3. **Dual-Mode Parity (Zero-Regression Dark Mode):** Every view, card, modal, badge, and form control operates with equal visual polish in both light and night mode, preserving WCAG 2.1 AA contrast standards.
4. **Vector Iconography Standard:** Local offline Lucide vector icons (`lucide.min.js`) ensure zero Content Security Policy (CSP) external blocking, crisp rendering on high-DPI displays, and instantaneous load times.

---

## 2. Typography System

The typography system relies on **Plus Jakarta Sans** as the primary font family for all headers, interactive elements, and tabular data, backed by a resilient system UI fallback stack.

```css
--font-family-base: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Font Weights & Roles

| Weight | Numeric | Tailwind Class | Recommended Usage |
| :--- | :---: | :--- | :--- |
| **Regular** | `400` | `font-normal` | Long-form descriptions, audit log notes, terms, legal disclaimers. |
| **Medium** | `500` | `font-medium` | Form labels, navigation links, secondary metadata, table cell values. |
| **SemiBold** | `600` | `font-semibold` | Subheadings, button text, badge pills, active tabs, list item titles. |
| **Bold** | `700` | `font-bold` | Page titles, statistics numbers, card headers, modal titles. |
| **ExtraBold** | `800` | `font-extrabold` | Brand hero headings, high-impact metrics, landing page value propositions. |

### Monospace / Numerical Stack
For 6-digit MFA codes, tracking numbers, and audit hashes:
```css
font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

---

## 3. Color Palette & Semantic Tokens

### 3.1 Brand Identity & Core Palette

| Token Name | Hex Code | Tailwind Equivalent | CSS Variable / Utility | Purpose |
| :--- | :---: | :--- | :--- | :--- |
| **Primary Navy** | `#09436B` | `bg-primary`, `text-primary` | `--primary-color: #09436b` | Main brand identity, primary CTA buttons, active tab indicators, key badges |
| **Primary Hover** | `#1E40AF` | `hover:bg-blue-800` | `--primary-hover: #1e40af` | Hover state for primary buttons and interactive accents |
| **Primary Container** | `#2B5B84` | `bg-primary-container` | `bg-[#2B5B84]` | Deep header backgrounds, elevated panels, card accent strips |
| **Secondary Cobalt** | `#0058BE` | `bg-secondary` | `bg-[#0058BE]` | Secondary interactive elements, links, focus borders |
| **Inverse Primary** | `#9ECBFA` | `text-sky-300` | `text-[#9ECBFA]` | High-contrast links and badges on dark surfaces |
| **Secondary Fixed** | `#D8E2FF` | `bg-blue-100` | `bg-[#D8E2FF]` | Soft pill backgrounds, secondary tags in light mode |
| **Secondary Fixed Dim** | `#ADC6FF` | `bg-blue-200` | `bg-[#ADC6FF]` | Hover states on secondary tags and pills |

---

### 3.2 Canvas & Surface Tokens

| Mode | Token Role | Hex Code | Tailwind Utility | Visual Description |
| :--- | :--- | :---: | :--- | :--- |
| **Light** | Background Canvas | `#F4F7FB` | `bg-[#F4F7FB]` | Ultra-soft, anti-glare grayish blue foundation |
| **Light** | Card Surface (Lowest) | `#FFFFFF` | `bg-white` | Crisp elevated cards, dialogs, inputs, panels |
| **Light** | Surface Container Low | `#F2F3FF` | `bg-[#F2F3FF]` | Subtle tinted containers, search bars, table headers |
| **Light** | Border Subtle | `#E2E8F0` | `border-slate-200` | Clean, low-contrast component dividers |
| **Light** | Text Primary | `#0F172A` | `text-slate-900` | Maximum contrast body and header text |
| **Light** | Text Muted | `#64748B` | `text-slate-500` | Subtitles, timestamps, placeholder text |
| **Dark** | Night Canvas | `#0B1120` | `dark:bg-[#0B1120]` | Deep midnight slate canvas base |
| **Dark** | Primary Card Surface | `#111C2E` | `dark:bg-[#111C2E]` | Deep oceanic card surface with high opacity |
| **Dark** | Elevated Sub-Surface | `#172438` | `dark:bg-[#172438]` | Elevated inner boxes, challenge containers, list cards |
| **Dark** | Input & Recessed Surface| `#0B1628` | `dark:bg-[#0B1628]` | Dark input boxes, chat message field backgrounds |
| **Dark** | Border Subtle | `#2C3B50` | `dark:border-[#2C3B50]` | Night mode card boundaries and dividers |
| **Dark** | Border Hover | `#34465D` | `dark:border-[#34465D]` | Interactive hover state for dark cards and inputs |
| **Dark** | Text Primary | `#F8FAFC` | `dark:text-slate-50` | Bright, legible heading and primary text |
| **Dark** | Text Muted | `#94A3B8` | `dark:text-slate-400` | Subdued secondary text and meta information |

---

### 3.3 Semantic Status & Workflow Accents

| Status State | Light Mode Theme | Dark Mode Theme | Used In |
| :--- | :--- | :--- | :--- |
| **Success / Approved / Returned** | BG: `#ECFDF5`<br>Border: `#A7F3D0`<br>Text: `#065F46`<br>Dot/Icon: `#10B981` | BG: `#123B36`<br>Border: `#23675C`<br>Text: `#99F6E4`<br>Dot/Icon: `#2DD4BF` | Approved claims, returned items, verified badges, successful handovers. |
| **Warning / Pending / Challenge** | BG: `#FFFBEB`<br>Border: `#FDE68A`<br>Text: `#92400E`<br>Dot/Icon: `#F59E0B` | BG: `#44351A`<br>Border: `#80612A`<br>Text: `#FDE68A`<br>Dot/Icon: `#FBBF24` | Pending claims, unverified reports, secret challenges, countdown timers. |
| **Danger / Rejected / Overdue** | BG: `#FEF2F2`<br>Border: `#FECACA`<br>Text: `#991B1B`<br>Dot/Icon: `#EF4444` | BG: `#48232C`<br>Border: `#873E4A`<br>Text: `#FECDD3`<br>Dot/Icon: `#F87171` | Rejected claims, 60-day disposition alerts, delete dialogs, auth errors. |
| **Escalated / Security Arbitration** | BG: `#EEF2FF`<br>Border: `#C7D2FE`<br>Text: `#3730A3`<br>Dot/Icon: `#4F46E5` | BG: `#252E53`<br>Border: `#47569A`<br>Text: `#C7D2FE`<br>Dot/Icon: `#818CF8` | Disputed ownership claims, Security Desk arbitration escalations. |
| **Smart Match Engine Affinity** | Gradient: `from-teal-50 to-cyan-50`<br>Border: `#2DD4BF`<br>Text: `#0F766E` | Gradient: `from-[#10272B] to-[#14343A]`<br>Border: `#34766E`<br>Text: `#99F6E4` | Campus Match Engine high-confidence item affinity cards ($\ge 80\%$). |

---

## 4. Dark Mode Architecture

Project HANAP uses a robust **class-based Dark Theme** (`html.dark`) managed by `views/partials/themeSetup.ejs` and backed by comprehensive CSS rules in `public/css/style.css`.

### Initialization & Persistence
```javascript
(function() {
  const savedTheme = localStorage.getItem('hanap_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', savedTheme === 'dark' || (!savedTheme && prefersDark));
})();
```

### Key Night Mode Design Rules for AI
1. **Never use translucent light overlays on dark canvas:** Dark surfaces in claims and settings require opaque, layered navy backgrounds (`#111C2E`, `#172438`) to prevent text wash-out.
2. **Page Specific Exclusions:** `.landing-page`, `.login-page`, and `.register-page` feature their own dedicated deep aurora dark themes; do not let generic dashboard overrides interfere with auth canvas gradients.
3. **Always pair Tailwind classes with `dark:` variants:**
   ```html
   <div class="bg-white dark:bg-[#111C2E] border border-slate-200 dark:border-[#2C3B50] text-slate-900 dark:text-slate-100">
   ```

---

## 5. Iconography Architecture (Lucide Icons Vector System)

The system standardizes on **Lucide Icons** bundled locally at `/js/lucide.min.js`.

### Material Symbols Translation Bridge
To support legacy templates and rapid development, `views/partials/themeSetup.ejs` automatically translates Google Material Symbols markup into Lucide SVG vectors at runtime:

```html
<!-- Legacy input syntax -->
<span class="material-symbols-outlined">shield_check</span>

<!-- Automatically converted to -->
<i data-lucide="shield-check" class="lucide-icon inline-block align-middle"></i>
```

### Essential Icon Dictionary for New Features

| Feature Area | Lucide Icon Name | Visual Representation |
| :--- | :--- | :--- |
| **Campus Catalog** | `package`, `search`, `filter`, `tag`, `clock` | Item cards, category chips, search filters |
| **Ownership Verification** | `shield-check`, `badge-check`, `sparkles`, `help-circle`, `key-round` | Match engine radial, secret challenges, custody seals |
| **Physical Handover** | `handshake`, `building-2`, `clipboard-check`, `file-text` | Security desk custody queue, intake receipts, turn-in logs |
| **Navigation & System** | `layout-dashboard`, `user`, `settings`, `log-out`, `bell`, `sun`, `moon` | Top navigation bar, account profile studio, theme toggle |
| **Security & Admin** | `shield-alert`, `users`, `archive`, `activity`, `download`, `trash-2` | Admin command center, audit logs, 60-day disposition queue |

---

## 6. Living Aurora Mesh Canvas Specification

All major dashboards feature non-intrusive ambient glassmorphic splashes that provide atmosphere without hindering content readability:

```html
<!-- Ambient Mesh Gradient Underlays -->
<div class="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
  <div class="absolute -top-[25%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-tr from-sky-200/50 via-blue-100/40 to-teal-100/45 rounded-full blur-3xl opacity-80 dark:opacity-20"></div>
  <div class="absolute top-[35%] -right-[15%] w-[650px] h-[500px] bg-gradient-to-br from-indigo-100/45 via-teal-100/40 to-slate-200/45 rounded-full blur-3xl opacity-70 dark:opacity-15"></div>
  <div class="absolute -bottom-[20%] -left-[10%] w-[700px] h-[500px] bg-gradient-to-tr from-cyan-100/40 via-slate-100/60 to-blue-200/40 rounded-full blur-3xl opacity-80 dark:opacity-20"></div>
</div>
```

---

## 7. Reusable Component Patterns & Code Snippets

### 7.1 Standard Institutional Card
```html
<div class="bg-white/90 dark:bg-[#111C2E]/90 backdrop-blur-md border border-slate-200/80 dark:border-[#2C3B50] rounded-2xl p-6 shadow-sm hover:shadow-md transition duration-200">
  <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#2C3B50]">
    <h3 class="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
      <i data-lucide="package" class="w-4 h-4 text-[#09436B] dark:text-sky-400"></i>
      Card Title
    </h3>
    <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#09436B] dark:text-sky-300 border border-blue-200/60 dark:border-blue-800">
      Active
    </span>
  </div>
  <div class="mt-4 text-sm text-slate-600 dark:text-slate-300">
    Card content goes here.
  </div>
</div>
```

### 7.2 Primary & Ghost Buttons
```html
<!-- Primary Brand Button -->
<button class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#09436B] to-[#0058BE] hover:from-[#083a5c] hover:to-[#004ba3] shadow-sm hover:shadow active:scale-[0.98] transition duration-150 focus:outline-none focus:ring-2 focus:ring-sky-500/40">
  <i data-lucide="plus-circle" class="w-4 h-4"></i>
  <span>Report New Item</span>
</button>

<!-- Secondary Ghost Button -->
<button class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#172438] hover:bg-slate-200 dark:hover:bg-[#20314a] border border-slate-200 dark:border-[#2C3B50] active:scale-[0.98] transition duration-150">
  <i data-lucide="arrow-left" class="w-4 h-4"></i>
  <span>Back</span>
</button>
```

### 7.3 Status Pill Badges
```html
<!-- Approved / Returned (Success) -->
<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-[#123B36] text-emerald-700 dark:text-teal-200 border border-emerald-200 dark:border-[#23675C]">
  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
  Approved
</span>

<!-- Pending (Warning) -->
<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-[#44351A] text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-[#80612A]">
  <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
  Pending Review
</span>

<!-- Rejected (Danger) -->
<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-[#48232C] text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-[#873E4A]">
  <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
  Rejected
</span>
```

### 7.4 Form Input with Integrated Leading Icon
```html
<div class="space-y-1.5">
  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
    Item Category
  </label>
  <div class="relative">
    <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
      <i data-lucide="tag" class="w-4 h-4"></i>
    </span>
    <input 
      type="text" 
      class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2C3B50] bg-white dark:bg-[#0B1628] text-slate-900 dark:text-white placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 text-sm transition"
      placeholder="e.g., Electronics, Identification, Books"
    />
  </div>
</div>
```

---

## 8. Embedded HANAP AI Assistant Widget Specification

The Virtual AI Assistant widget (`views/partials/assistantWidget.ejs`, `public/css/assistant.css`) adheres to a specialized dark floating palette:

```css
.hanap-assistant {
  --assistant-ink: #f8fafc;
  --assistant-muted: #a9bbd2;
  --assistant-panel: #0d1729;
  --assistant-surface: #15243a;
  --assistant-border: #263c59;
  --assistant-blue: #147ed0;
}
```

- **Launcher Button:** 48px circular launcher fixed at `bottom: 24px; right: 24px; z-index: 100`, styled with `linear-gradient(145deg, #2357c8, #087ec4)` and a soft ambient drop-shadow (`box-shadow: 0 10px 30px rgba(8, 126, 196, 0.4)`).
- **Assistant Panel:** Fixed width `min(370px, calc(100vw - 32px))`, `border-radius: 22px`, styled with `#2E5C91` border and `#0D1729` background.
- **Message Bubbles:**
  - AI Assistant: `#15243A` background with `#263C59` border.
  - User Queries: `linear-gradient(135deg, #173d71, #14568b)` with `#2864A2` border.
  - Quick Suggestion Pills: `#15243A` with `#263C59` border, hover `#23344D`.

---

## 9. AI Development Checklist & Best Practices

When generating new views or modifying existing templates, AI agents MUST follow these rules:

- [ ] **Include Theme Setup:** Always include `<%- include('partials/themeSetup') %>` or `<%- include('../partials/themeSetup') %>` in `<head>`.
- [ ] **Dual-Mode Text Contrast:** Never style text with pure dark colors (e.g. `text-slate-900`) without providing its dark mode counterpart (`dark:text-slate-100` or `dark:text-white`).
- [ ] **Vector Lucide Icons:** Render icons via `<i data-lucide="..." class="w-5 h-5"></i>` or `<span class="material-symbols-outlined">...</span>` ensuring `renderLucide()` runs post-DOM load.
- [ ] **Data Masking Standard:** Obscure private fields (phone numbers, challenge answers) using `••••••••` or privacy pill components to preserve student security.
- [ ] **Responsive Padding:** Use responsive spacing (`px-4 sm:px-6 lg:px-8`) and ensure all interactive touch targets measure at least $44 \times 44\text{px}$.
- [ ] **Accessibility Outlines:** Never remove focus outlines without replacing them with `focus:ring-2 focus:ring-sky-500/40`.

