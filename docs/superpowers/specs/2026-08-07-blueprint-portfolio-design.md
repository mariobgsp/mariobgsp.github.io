# Blueprint Portfolio Redesign — Design Doc

**Date:** 2026-08-07
**Project:** mariobgsp.github.io (single-file HTML portfolio)
**Status:** Approved by user

## 1. Overview

Redesign the existing single-file `index.html` portfolio into a "true blueprint" aesthetic — deep blueprint-navy paper with white/cyan linework, coordinate grid, mono callouts, safety-orange revision ink. Content is rewritten from the user's resume (`/home/mariobgsp/Project/brain/resume/Master_Resume.html`), LinkedIn profile, and GitHub API data. Stays a single self-contained HTML file with inline CSS/JS (GitHub Pages host).

**Design read:** backend-engineer portfolio for recruiters/hiring managers, engineering-document language, blueprint aesthetic.
**Dials:** DESIGN_VARIANCE 7 (asymmetric callouts, offset stamps, varied section layouts) / MOTION_INTENSITY 3 (restrained, reduced-motion respected) / VISUAL_DENSITY 4.

## 2. Aesthetic system

### Palette (true blueprint)
- Paper: `#0a1c3c` (blueprint navy), slightly lighter panels `#0e2347`
- Coordinate grid: fine major/minor lines at ~4% white opacity, full-page background
- Linework/primary type: `#dfe9ff` (blueprint print tint)
- Secondary type: `#7e9cc9` (steel blue)
- Tertiary / hairlines: `#2a4a7f` borders
- **Accent (only one):** safety orange `#ff7a3d` — revision ink. Used ONLY for stamps, revision marks, small highlights. No gradient text, no glow, no purple.

### Typography
- Display/headings: `Space Grotesk` (400/500/700)
- Mono (annotations, labels, dates, stats, nav accents): `IBM Plex Mono` (400/500/600)
- Google Fonts link with `display=swap` (single-file constraint; preconnect included)

### Signature details
- **Hero:** animated SVG "line draw" on the name (stroke-dashoffset animation, once on load, disabled under `prefers-reduced-motion`), corner tick marks, `FIG. 01 — PROFILE` mono annotation, tilted `REV 2026` stamp in orange, status line (`STATUS: ACTIVE`) as a small stamp.
- **Section headers:** numbered drawing-sheet style — `FIG. 02 — EXPERIENCE`, hairline rule, corner crosshairs. Max 1 eyebrow-style label per section; numbering serves as the "eyebrow" so section headers stay restrained.
- **Experience:** vertical revision-mark rail on the left, dates as mono callouts, role + company, location as italic annotation, bullets with small square "datum marks" instead of dashes/arrows.
- **Projects:** drawing-callout style — leader-line elbow from note box to project title, mono project index (`PRJ-01`), language + tag badges as blueprint labels. 2-col asymmetric grid (not identical cards).
- **Stats (about):** styled as a spec-sheet data block with hairline dividers, mono numbers, no card boxes.
- **Skills:** grouped spec clusters with mono group titles and orange check marks. No pill tags.
- **Footer:** engineering **title block** (bottom-right style): title, rev, date, sheet number, contact links.

### Shape system
- Corners: sharp (radius 0) everywhere except tiny 2px on small interactive elements — blueprint is square. One scale, consistent.

## 3. Structure & content

Sections (same as current page, rewritten content):

1. **Nav** — fixed top, hairline underline, mono logo `mario.dev`, links: About / Experience / Projects / Skills / Contact. Single line desktop, hamburger mobile.
2. **Hero** — name + line-draw, title `Software Engineer — Backend & Microservices`, enhanced summary sentence, CTAs: `Get in Touch` (primary, orange-bordered blueprint style) + GitHub + LinkedIn (secondary). No availability pulse dot (AI tell) — replaced by `REV 2026` stamp.
3. **About** — enhanced summary text (merges resume summary + LinkedIn about; 3 short paragraphs), spec-sheet stats: 4+ yrs, 94%/6h→20min optimization, 4 markets (ID/SG/MY/CHN), 1M+ records.
4. **Experience** — 4 roles from resume with full bullets:
   - OCBC (Oct 2024–Present): regional markets, AI-Augmented Dev (Windsurf, MCP), workflow optimization, API & system design, SOA migration & Innovation Team, full-cycle delivery, cross-border Scrum.
   - CIMB Niaga (Jan–Oct 2024): CCPL Octo Smart team, Java 17/Spring/MySQL, 6h→20min optimization.
   - XL Axiata (Nov 2021–Dec 2023): E-Payment & Oracle Exit teams, API Gateway publishing, pending-payment microservice.
   - Xsis Academy (Oct–Nov 2021): Java/Docker/RabbitMQ bootcamp.
5. **Projects** — top 4 repos (user-selected):
   - `netto-spendo` (TypeScript) — expense tracking, income/expense, net balance, dark-themed UI.
   - `physics-phenomena` (TypeScript) — PhysicsLab, 37 interactive physics simulations.
   - `local-postman` (JavaScript) — local Postman-like HTTP client, no cloud, JSON-file storage, `pm.*` scripting API, Express + vanilla JS.
   - `thermal-face-recognition` (Jupyter Notebook) — Thermal Emotion Recognition via CNN, final-year thesis project.
   - Cards link to GitHub; include language dot, blueprint tag labels.
6. **Skills** — 5 spec clusters from resume:
   - Languages & Frameworks: Java, Spring, Go, Echo, Jakarta Persistence, React.js
   - Data & Infrastructure: MySQL, PostgreSQL, Oracle, Elasticsearch, Kubernetes, Docker, RabbitMQ, Solace, GCP
   - APIs & Architecture: REST, Microservices, SOA, API Gateway, OOP, Clean Code, SOLID
   - Practices & Tools: AI-Augmented Dev (Windsurf, MCP), Agile/Scrum, Jira, Git, Full-Cycle Delivery, Project Management
   - Languages: Bahasa Indonesia (native), English (professional)
7. **Education** — UGM, B.Eng Engineering Physics 2017–2021, thesis title.
8. **Certifications** — 10 from resume with issuer + year.
9. **Footer** — title block with © 2026, email/GitHub/LinkedIn.

## 4. Motion (restrained)

- Hero SVG line-draw on load (once, `prefers-reduced-motion` → static).
- Scroll reveals via IntersectionObserver (opacity + 12px rise, staggered lightly) — existing pattern kept quiet.
- Hover: hairlines brighten, stamps tilt ~1.5deg, buttons invert. No orbs, no parallax, no glow, no marquees, no gradient text.
- Navbar scroll state (hairline border on scroll) kept.

## 5. Technical constraints

- Single `index.html`, inline CSS + JS, no build step, no dependencies.
- Google Fonts (Space Grotesk + IBM Plex Mono) via `<link>` — acceptable given single-file constraint.
- Responsive: collapse all grids to single column < 768px; hamburger nav.
- WCAG AA contrast: primary `#dfe9ff` on `#0a1c3c` (high contrast); orange accent used only at large sizes or with sufficient contrast.
- `min-height: 100dvh` on hero; no `h-screen`.

## 6. Anti-slop checklist

- [ ] No Inter, no JetBrains Mono as body font (replaced by Space Grotesk + IBM Plex Mono)
- [ ] No gradient text, no glow, no purple, no floating orbs
- [ ] No 3-equal-cards rows; asymmetric project grid with callout style
- [ ] No emoji project icons (replaced by mono index labels `PRJ-01` etc.)
- [ ] Max 1 eyebrow-style label per 3 sections (numbering as labels instead)
- [ ] No em-dash bullet markers (datum squares instead)
- [ ] No fake-precise numbers; all stats from resume (4+, 94%, 6h→20min, 1M+)
- [ ] One accent color locked across page
- [ ] Sharp corner system consistent
