# Blueprint Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the single-file portfolio `index.html` into a "true blueprint" aesthetic with rewritten content from the resume, LinkedIn, and GitHub, shipping as one self-contained HTML file.

**Architecture:** One `index.html` with inline `<style>` and inline `<script>`. Design tokens are CSS custom properties in `:root`. Sections are added top-down (nav → hero → about → experience → projects → skills → footer) with each task appending its own CSS rules and HTML, then JS behaviors in the final build tasks. No build step, no dependencies, no test runner — verification is manual browser checks per task (this is a static GitHub Pages site).

**Tech Stack:** Vanilla HTML5 + CSS3 + ES6 JS. Google Fonts: Space Grotesk (display) + IBM Plex Mono (mono). SVG for hero line-draw. IntersectionObserver for scroll reveals.

## Global Constraints

- Single file: `index.html` — all CSS and JS inline; no external files besides the two Google Fonts stylesheets.
- Palette (locked, from spec): paper `#0a1c3c`, panel `#0e2347`, primary text `#dfe9ff`, secondary `#7e9cc9`, hairline `#2a4a7f`, accent (only one) `#ff7a3d`. Grid lines: rgba(223,233,255,0.05) major / 0.025 minor.
- Typefaces: Space Grotesk for headings/display, IBM Plex Mono for labels/dates/stats/numbers.
- Corners: sharp (radius 0) everywhere; max 2px radius on tiny interactive elements only.
- No Inter, no JetBrains Mono, no gradient text, no glow, no purple, no emoji icons, no orbs, no parallax, no marquees, no em-dash bullets, no pill-shaped tags.
- One accent color across the whole page: `#ff7a3d`.
- All stats come from real data: 4+ yrs, 6h→20min, 4 markets (ID/SG/MY/CHN), 1M+ records.
- `prefers-reduced-motion: reduce` disables all animations (line-draw, reveals) and shows final state immediately.
- Hero uses `min-height: 100dvh` (never `h-screen`).
- Responsive: all multi-column grids collapse to single column below 768px; hamburger nav below 768px; nav links single line on desktop.
- WCAG AA: primary text `#dfe9ff` on `#0a1c3c` (contrast ~14:1); orange `#ff7a3d` only on large text, stamps, or with `#0a1c3c` text on orange (contrast ~5:1).

---

### Task 1: File skeleton, design tokens, fonts, blueprint grid background

**Files:**
- Create: `index.html` (complete replacement — this task's content is the entire file minus later sections; later tasks insert before the `<!-- FOOTER -->` and `</body>` anchors listed here)

**Interfaces:**
- Produces: CSS custom properties `--paper`, `--paper-2`, `--ink`, `--steel`, `--hairline`, `--accent`, `--grid-major`, `--grid-minor`, `--mono`, `--sans`. Body-level blueprint grid via `body::before`. Utility classes `.container`, `.sheet`, `.fig-label`, `.sheet-title`, `.sheet-rule`. JS hook `data-reveal` attributes on elements to reveal on scroll (added in Task 9).

- [ ] **Step 1: Write the full skeleton file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Muhammad Ario Bagus Prakusa — Software Engineer, Backend &amp; Microservices</title>
    <meta name="description" content="Software Engineer with 4+ years designing and scaling Java/Spring and Go microservices for banking and telecommunications across ID, SG, MY, and CHN markets.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        /* ===== TOKENS ===== */
        :root {
            --paper: #0a1c3c;
            --paper-2: #0e2347;
            --ink: #dfe9ff;
            --steel: #7e9cc9;
            --hairline: #2a4a7f;
            --accent: #ff7a3d;
            --grid-major: rgba(223, 233, 255, 0.05);
            --grid-minor: rgba(223, 233, 255, 0.025);
            --mono: 'IBM Plex Mono', ui-monospace, monospace;
            --sans: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
            --ease: 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }

        /* ===== RESET & BASE ===== */
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        html { scroll-behavior: smooth; }

        body {
            font-family: var(--sans);
            background-color: var(--paper);
            color: var(--ink);
            line-height: 1.65;
            overflow-x: hidden;
            -webkit-font-smoothing: antialiased;
        }

        /* Blueprint coordinate grid — fixed, non-interactive */
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 0;
            background-image:
                linear-gradient(var(--grid-major) 1px, transparent 1px),
                linear-gradient(90deg, var(--grid-major) 1px, transparent 1px),
                linear-gradient(var(--grid-minor) 1px, transparent 1px),
                linear-gradient(90deg, var(--grid-minor) 1px, transparent 1px);
            background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px;
        }

        a { color: inherit; }

        /* ===== LAYOUT ===== */
        .container {
            position: relative;
            z-index: 1;
            max-width: 1120px;
            margin: 0 auto;
            padding: 0 28px;
        }

        section { padding: 96px 0; }

        .sheet { border-top: 1px solid var(--hairline); }

        /* Drawing-sheet section headers */
        .fig-label {
            font-family: var(--mono);
            font-size: 0.7rem;
            font-weight: 600;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: var(--steel);
            margin-bottom: 14px;
        }

        .fig-label .fig-num { color: var(--accent); }

        .sheet-title {
            font-family: var(--sans);
            font-size: clamp(1.9rem, 3.4vw, 2.6rem);
            font-weight: 700;
            letter-spacing: -0.02em;
            line-height: 1.08;
            margin-bottom: 18px;
        }

        .sheet-rule {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 48px;
        }

        .sheet-rule::before {
            content: '';
            flex: 1;
            height: 1px;
            background: var(--hairline);
        }

        .sheet-rule::after {
            content: '';
            width: 9px;
            height: 9px;
            border: 1px solid var(--hairline);
            transform: rotate(45deg);
        }

        /* ===== RESPONSIVE BASE ===== */
        @media (max-width: 768px) {
            section { padding: 72px 0; }
            .container { padding: 0 20px; }
        }
    </style>
</head>
<body>

    <!-- NAV (Task 2) -->

    <!-- HERO (Task 3) -->

    <!-- ABOUT (Task 4) -->

    <!-- EXPERIENCE (Task 5) -->

    <!-- PROJECTS (Task 6) -->

    <!-- SKILLS + EDUCATION + CERTS (Task 7) -->

    <!-- FOOTER (Task 8) -->

    <script>
        /* JS (Task 9) */
    </script>
</body>
</html>
```

- [ ] **Step 2: Verify skeleton renders**

Run: `python3 -m http.server 8000` from the repo root, open `http://localhost:8000`.
Expected: deep navy page with a faint blueprint grid; `Space Grotesk` + `IBM Plex Mono` loaded (check DevTools → Network → fonts.googleapis.com); empty body except comments.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: blueprint skeleton with tokens, fonts, and grid background"
```

---

### Task 2: Navigation

**Files:**
- Modify: `index.html` — replace `<!-- NAV (Task 2) -->` with nav markup; append nav CSS inside `<style>` before the `/* ===== RESPONSIVE BASE ===== */` block.

**Interfaces:**
- Produces: `#navbar` (fixed, gets `.scrolled` class on scroll), `.nav-inner`, `.nav-logo`, `.nav-links` (`#navLinks`), `.nav-hamburger` (`#navToggle`), anchors `#about`, `#experience`, `#projects`, `#skills`, `#contact`. JS for scroll/hamburger in Task 9.

- [ ] **Step 1: Add nav CSS**

```css
        /* ===== NAVIGATION ===== */
        nav {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 100;
            border-bottom: 1px solid transparent;
            transition: border-color var(--ease), background-color var(--ease);
        }

        nav.scrolled {
            background: rgba(10, 28, 60, 0.9);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom-color: var(--hairline);
        }

        .nav-inner {
            max-width: 1120px;
            margin: 0 auto;
            padding: 0 28px;
            height: 64px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .nav-logo {
            font-family: var(--mono);
            font-size: 1rem;
            font-weight: 600;
            color: var(--ink);
            text-decoration: none;
            letter-spacing: -0.02em;
        }

        .nav-logo::before {
            content: '// ';
            color: var(--accent);
        }

        .nav-links {
            display: flex;
            gap: 34px;
            list-style: none;
        }

        .nav-links a {
            font-family: var(--mono);
            font-size: 0.78rem;
            font-weight: 500;
            color: var(--steel);
            text-decoration: none;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            position: relative;
            padding-bottom: 3px;
            transition: color var(--ease);
        }

        .nav-links a::after {
            content: '';
            position: absolute;
            left: 0; bottom: 0;
            width: 0; height: 1px;
            background: var(--accent);
            transition: width var(--ease);
        }

        .nav-links a:hover, .nav-links a.active { color: var(--ink); }
        .nav-links a:hover::after { width: 100%; }

        .nav-hamburger {
            display: none;
            flex-direction: column;
            gap: 5px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
        }

        .nav-hamburger span {
            width: 22px;
            height: 2px;
            background: var(--ink);
            transition: transform var(--ease), opacity var(--ease);
        }
```

- [ ] **Step 2: Add nav markup (replace `<!-- NAV (Task 2) -->`)**

```html
    <nav id="navbar">
        <div class="nav-inner">
            <a href="#hero" class="nav-logo">mario.dev</a>
            <ul class="nav-links" id="navLinks">
                <li><a href="#about">About</a></li>
                <li><a href="#experience">Experience</a></li>
                <li><a href="#projects">Projects</a></li>
                <li><a href="#skills">Skills</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
            <button class="nav-hamburger" id="navToggle" aria-label="Toggle navigation menu" aria-expanded="false">
                <span></span>
                <span></span>
                <span></span>
            </button>
        </div>
    </nav>
```

- [ ] **Step 3: Add responsive nav rules** (append to the existing `@media (max-width: 768px)` block)

```css
            nav { height: 56px; }
            .nav-inner { height: 56px; padding: 0 20px; }
            .nav-links {
                display: none;
                position: fixed;
                top: 56px; left: 0; right: 0;
                flex-direction: column;
                gap: 20px;
                padding: 28px 20px;
                background: rgba(10, 28, 60, 0.97);
                border-bottom: 1px solid var(--hairline);
            }
            .nav-links.open { display: flex; }
            .nav-hamburger { display: flex; }
```

- [ ] **Step 4: Verify nav renders and is styled**

Reload `http://localhost:8000`. Expected: fixed top bar, `// mario.dev` logo, mono uppercase links in steel blue, no border until scroll. Shrink viewport < 768px: links hidden, hamburger visible.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: blueprint navigation"
```

---

### Task 3: Hero with line-draw frame, stamps, and CTAs

**Files:**
- Modify: `index.html` — replace `<!-- HERO (Task 3) -->`; append hero CSS before the `/* ===== RESPONSIVE BASE ===== */` block.

**Interfaces:**
- Produces: `#hero` (min-height 100dvh), `#heroFrame` (SVG, id used by Task 9 line-draw), `.stamp`, `.btn .btn-primary .btn-secondary`, section anchor `#hero`. Hero copy finalized here (enhanced summary sentence below title).

- [ ] **Step 1: Add hero CSS**

```css
        /* ===== HERO ===== */
        #hero {
            min-height: 100dvh;
            display: flex;
            align-items: center;
            position: relative;
            padding: 96px 0 72px;
        }

        .hero-frame {
            position: relative;
            border: 1px solid var(--hairline);
            padding: clamp(40px, 7vw, 88px) clamp(28px, 6vw, 72px);
            background: rgba(14, 35, 71, 0.35);
        }

        /* corner tick marks */
        .hero-frame .tick {
            position: absolute;
            width: 14px; height: 14px;
            border-color: var(--accent);
            opacity: 0.85;
        }
        .tick-tl { top: -1px; left: -1px; border-top: 2px solid; border-left: 2px solid; }
        .tick-tr { top: -1px; right: -1px; border-top: 2px solid; border-right: 2px solid; }
        .tick-bl { bottom: -1px; left: -1px; border-bottom: 2px solid; border-left: 2px solid; }
        .tick-br { bottom: -1px; right: -1px; border-bottom: 2px solid; border-right: 2px solid; }

        .hero-frame svg {
            position: absolute;
            inset: -1px;
            width: calc(100% + 2px);
            height: calc(100% + 2px);
            pointer-events: none;
        }

        .hero-frame svg path {
            fill: none;
            stroke: var(--ink);
            stroke-width: 1;
            stroke-dasharray: var(--dash, 2400);
            stroke-dashoffset: var(--dash, 2400);
        }

        .hero-frame.draw svg path {
            animation: line-draw 1.6s var(--ease) forwards;
        }

        @keyframes line-draw { to { stroke-dashoffset: 0; } }

        .fig-tag {
            position: absolute;
            top: -11px; right: 28px;
            font-family: var(--mono);
            font-size: 0.68rem;
            font-weight: 500;
            letter-spacing: 0.18em;
            color: var(--steel);
            background: var(--paper);
            padding: 0 8px;
            text-transform: uppercase;
        }

        .stamp {
            position: absolute;
            top: -22px; left: 28px;
            font-family: var(--mono);
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.22em;
            text-transform: uppercase;
            color: var(--accent);
            border: 2px solid var(--accent);
            padding: 5px 10px;
            transform: rotate(-3deg);
            background: var(--paper);
        }

        .hero-name {
            font-family: var(--sans);
            font-size: clamp(2.4rem, 6vw, 4.4rem);
            font-weight: 700;
            letter-spacing: -0.03em;
            line-height: 1.02;
            margin-bottom: 22px;
        }

        .hero-title {
            font-family: var(--mono);
            font-size: 0.95rem;
            font-weight: 500;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 26px;
        }

        .hero-sub {
            color: var(--steel);
            font-size: 1.02rem;
            max-width: 620px;
            margin-bottom: 40px;
        }

        .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            padding: 13px 26px;
            font-family: var(--mono);
            font-size: 0.8rem;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            text-decoration: none;
            border: 1px solid var(--hairline);
            background: transparent;
            color: var(--ink);
            cursor: pointer;
            transition: border-color var(--ease), background-color var(--ease), color var(--ease), transform var(--ease);
        }

        .btn:hover { border-color: var(--ink); transform: translateY(-1px); }

        .btn:active { transform: translateY(0) scale(0.98); }

        .btn-primary {
            background: var(--accent);
            border-color: var(--accent);
            color: #0a1c3c;
        }

        .btn-primary:hover { background: transparent; color: var(--accent); }

        .btn svg { width: 16px; height: 16px; flex-shrink: 0; }
```

- [ ] **Step 2: Add hero markup (replace `<!-- HERO (Task 3) -->`)**

```html
    <section id="hero">
        <div class="container">
            <div class="hero-frame" id="heroFrame">
                <svg viewBox="0 0 1000 440" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M 0 0 H 1000 V 440 H 0 Z"/>
                </svg>
                <span class="tick tick-tl"></span>
                <span class="tick tick-tr"></span>
                <span class="tick tick-bl"></span>
                <span class="tick tick-br"></span>
                <span class="stamp">Rev 2026 · Active</span>
                <span class="fig-tag">FIG. 01 — Profile</span>
                <h1 class="hero-name">Muhammad Ario<br>Bagus Prakusa</h1>
                <p class="hero-title">Software Engineer — Backend &amp; Microservices</p>
                <p class="hero-sub">
                    Designing and scaling Java/Spring and Go microservices for banking and
                    telecommunications across ID, SG, MY, and CHN markets — cutting batch
                    processing for 1M records from ~6 hours to ~20 minutes.
                </p>
                <div class="hero-actions">
                    <a href="mailto:mariobgsp@gmail.com" class="btn btn-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                        Get in Touch
                    </a>
                    <a href="https://github.com/mariobgsp" target="_blank" rel="noopener" class="btn">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                        GitHub
                    </a>
                    <a href="https://www.linkedin.com/in/mariobgsp/" target="_blank" rel="noopener" class="btn">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        LinkedIn
                    </a>
                </div>
            </div>
        </div>
    </section>
```

- [ ] **Step 3: Verify hero**

Reload. Expected: framed hero box with orange corner ticks, tilted `REV 2026 · ACTIVE` stamp, `FIG. 01 — PROFILE` tag, name in Space Grotesk, orange mono title line. On load (Task 9 later) the frame border will animate; for now it may sit invisible — that's expected until Task 9. If the border is invisible now, that's correct behavior pending Task 9; do NOT change the CSS.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: blueprint hero with frame, stamps, and CTAs"
```

---

### Task 4: About + spec-sheet stats

**Files:**
- Modify: `index.html` — replace `<!-- ABOUT (Task 4) -->`; append about CSS before the `/* ===== RESPONSIVE BASE ===== */` block.

**Interfaces:**
- Produces: `#about` section, `.about-grid`, `.about-text`, `.spec-stats` (4 rows), `.spec-row`, `.spec-value`, `.spec-label`, `.spec-note`. All stats from resume data.

- [ ] **Step 1: Add about CSS**

```css
        /* ===== ABOUT ===== */
        .about-grid {
            display: grid;
            grid-template-columns: 1.25fr 1fr;
            gap: 64px;
            align-items: start;
        }

        .about-text p {
            color: var(--steel);
            font-size: 1.02rem;
            margin-bottom: 18px;
            max-width: 62ch;
        }

        .about-text p strong { color: var(--ink); font-weight: 500; }

        .spec-stats { border-top: 1px solid var(--hairline); }

        .spec-row {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: baseline;
            gap: 18px;
            padding: 18px 0;
            border-bottom: 1px solid var(--hairline);
        }

        .spec-value {
            font-family: var(--mono);
            font-size: 1.7rem;
            font-weight: 600;
            color: var(--ink);
            letter-spacing: -0.02em;
            min-width: 110px;
        }

        .spec-value .orange { color: var(--accent); }

        .spec-label {
            font-family: var(--mono);
            font-size: 0.78rem;
            font-weight: 500;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--steel);
        }

        .spec-note {
            font-family: var(--mono);
            font-size: 0.7rem;
            color: var(--steel);
            text-align: right;
            opacity: 0.75;
        }
```

- [ ] **Step 2: Add about markup (replace `<!-- ABOUT (Task 4) -->`)**

```html
    <section id="about" class="sheet">
        <div class="container">
            <div class="fig-label"><span class="fig-num">FIG. 02</span> — Background</div>
            <h2 class="sheet-title">About</h2>
            <div class="sheet-rule"></div>
            <div class="about-grid">
                <div class="about-text">
                    <p>
                        Software Engineer with <strong>4+ years</strong> designing, building, and scaling
                        <strong>Java/Spring and Go microservices</strong> for banking and telecommunications
                        across regional ID, SG, MY, and CHN markets. Currently at <strong>OCBC</strong>;
                        previously CIMB Niaga (CCPL Octo Smart team) and XL Axiata (E-Payment).
                    </p>
                    <p>
                        Strong background in <strong>AI-augmented development</strong> (Windsurf, MCP),
                        SOA migration, API design, and cross-border Scrum delivery. Proven performance work —
                        cut batch processing for <strong>1M records from ~6 hours to ~20 minutes</strong>.
                    </p>
                    <p>
                        Bachelor of Engineering in <strong>Engineering Physics</strong>, Universitas Gadjah Mada —
                        thesis on emotion identification via thermal camera using CNNs.
                    </p>
                </div>
                <div class="spec-stats">
                    <div class="spec-row">
                        <span class="spec-value">4+</span>
                        <span class="spec-label">Years of Experience</span>
                        <span class="spec-note">2021—</span>
                    </div>
                    <div class="spec-row">
                        <span class="spec-value"><span class="orange">6h→20m</span></span>
                        <span class="spec-label">Batch Processing, 1M Records</span>
                        <span class="spec-note">94% faster</span>
                    </div>
                    <div class="spec-row">
                        <span class="spec-value">4</span>
                        <span class="spec-label">Regional Markets</span>
                        <span class="spec-note">ID · SG · MY · CHN</span>
                    </div>
                    <div class="spec-row">
                        <span class="spec-value">1M+</span>
                        <span class="spec-label">Records Optimized</span>
                        <span class="spec-note">financial data</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
```

- [ ] **Step 3: Add mobile rule** (append to `@media (max-width: 768px)` block)

```css
            .about-grid { grid-template-columns: 1fr; gap: 44px; }
            .spec-row { grid-template-columns: 1fr; gap: 6px; }
            .spec-note { text-align: left; }
```

- [ ] **Step 4: Verify**

Reload. Expected: `FIG. 02 — BACKGROUND` label with orange number, hairline rule with diamond end, two-column layout (text left, spec-stats right with mono values and orange `6h→20m`).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: about section with spec-sheet stats"
```

---

### Task 5: Experience timeline with revision rail

**Files:**
- Modify: `index.html` — replace `<!-- EXPERIENCE (Task 5) -->`; append experience CSS.

**Interfaces:**
- Produces: `#experience` section, `.exp-item`, `.rev-rail`, `.exp-head`, `.exp-role`, `.exp-company`, `.exp-meta`, `.exp-loc`, `.exp-list`, `.datum` markers. Content: 4 roles verbatim from the spec.

- [ ] **Step 1: Add experience CSS**

```css
        /* ===== EXPERIENCE ===== */
        .exp-item {
            display: grid;
            grid-template-columns: 148px 1fr;
            gap: 40px;
            padding: 34px 0 34px 0;
            border-top: 1px solid var(--hairline);
            position: relative;
        }

        .exp-item:first-of-type { border-top: 1px solid var(--hairline); }

        .rev-rail {
            position: absolute;
            left: -28px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: var(--hairline);
        }

        .rev-rail::before {
            content: 'REV';
            position: absolute;
            top: 34px;
            left: 7px;
            font-family: var(--mono);
            font-size: 0.62rem;
            letter-spacing: 0.2em;
            color: var(--accent);
            writing-mode: vertical-rl;
        }

        .exp-date {
            font-family: var(--mono);
            font-size: 0.75rem;
            font-weight: 500;
            color: var(--steel);
            padding-top: 4px;
        }

        .exp-role {
            font-family: var(--sans);
            font-size: 1.22rem;
            font-weight: 700;
            letter-spacing: -0.01em;
            margin-bottom: 3px;
        }

        .exp-company {
            font-family: var(--mono);
            font-size: 0.82rem;
            font-weight: 600;
            color: var(--accent);
            margin-bottom: 3px;
        }

        .exp-loc {
            font-family: var(--mono);
            font-size: 0.72rem;
            color: var(--steel);
            font-style: italic;
            margin-bottom: 16px;
        }

        .exp-list { list-style: none; }

        .exp-list li {
            position: relative;
            padding-left: 18px;
            color: var(--steel);
            font-size: 0.94rem;
            margin-bottom: 9px;
            max-width: 64ch;
        }

        .exp-list li::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0.5em;
            width: 7px;
            height: 7px;
            background: var(--hairline);
        }

        .exp-list li strong { color: var(--ink); font-weight: 600; }
```

- [ ] **Step 2: Add experience markup (replace `<!-- EXPERIENCE (Task 5) -->`)**

```html
    <section id="experience" class="sheet">
        <div class="container">
            <div class="fig-label"><span class="fig-num">FIG. 03</span> — Career Log</div>
            <h2 class="sheet-title">Experience</h2>
            <div class="sheet-rule"></div>
            <div class="exp-item">
                <span class="rev-rail"></span>
                <div class="exp-date">Oct 2024 — Present</div>
                <div>
                    <h3 class="exp-role">Software Engineer</h3>
                    <div class="exp-company">OCBC Indonesia</div>
                    <div class="exp-loc">BSD City, Greater Jakarta · On-site</div>
                    <ul class="exp-list">
                        <li>Collaborate across ID, SG, MY, and CHN markets to develop and scale regional business processes.</li>
                        <li><strong>AI-Augmented Development:</strong> use Windsurf and MCP (Model Context Protocol) to accelerate coding, debugging, and system exploration.</li>
                        <li><strong>Workflow Optimization:</strong> AI-driven workflows automate repetitive tasks, keeping code clean and architecture consistent.</li>
                        <li><strong>API &amp; System Design:</strong> work with Technical Architects and Business Owners to design scalable APIs with rapid prototyping.</li>
                        <li><strong>SOA Migration &amp; Innovation:</strong> Innovation Team building internal tools to speed up SOA migration and decouple legacy dependencies.</li>
                        <li><strong>Full-Cycle Delivery:</strong> end-to-end lifecycle from coding and deployment to testing support for a multi-country user base.</li>
                        <li><strong>Cross-Border Scrum:</strong> daily coordination with distributed teams across Southeast Asia and China.</li>
                    </ul>
                </div>
            </div>
            <div class="exp-item">
                <span class="rev-rail"></span>
                <div class="exp-date">Jan 2024 — Oct 2024</div>
                <div>
                    <h3 class="exp-role">Software Engineer</h3>
                    <div class="exp-company">PT. Bank CIMB Niaga</div>
                    <div class="exp-loc">Tangerang Selatan · Hybrid</div>
                    <ul class="exp-list">
                        <li>Developed and improved microservices with clean-code practices using Java 17, Spring, MySQL, and Git.</li>
                        <li>Backend Engineer on the <strong>CCPL Octo Smart</strong> team; collaborated with Frontend Engineers and QA testers across the full SDLC.</li>
                        <li>Cut processing time for <strong>1 million records from ~6 hours to ~20 minutes</strong>.</li>
                    </ul>
                </div>
            </div>
            <div class="exp-item">
                <span class="rev-rail"></span>
                <div class="exp-date">Nov 2021 — Dec 2023</div>
                <div>
                    <h3 class="exp-role">Software Engineer</h3>
                    <div class="exp-company">PT. XL Axiata Tbk.</div>
                    <div class="exp-loc">Yogyakarta · Remote</div>
                    <ul class="exp-list">
                        <li>Built and improved microservices with Java 17, Spring, Go, Echo, Solace, Oracle, PostgreSQL, Elasticsearch, Kubernetes, and GCP.</li>
                        <li>Backend Developer on the <strong>E-Payment and Oracle Exit</strong> teams; Jira-based Agile with Product Owners, Scrum Masters, and Tech Leads.</li>
                        <li>Published APIs to the <strong>API Gateway</strong> for internal and external users and supported system integrations.</li>
                        <li>Developed a microservice that <strong>reduced pending-payment issues</strong> caused by delayed messages from publishers.</li>
                    </ul>
                </div>
            </div>
            <div class="exp-item">
                <span class="rev-rail"></span>
                <div class="exp-date">Oct 2021 — Nov 2021</div>
                <div>
                    <h3 class="exp-role">Java Programmer Trainee</h3>
                    <div class="exp-company">Xsis Academy</div>
                    <div class="exp-loc">Yogyakarta · On-site</div>
                    <ul class="exp-list">
                        <li>Intensive Java backend training covering Java, Docker, and RabbitMQ-based development.</li>
                    </ul>
                </div>
            </div>
        </div>
    </section>
```

- [ ] **Step 3: Add mobile rule**

```css
            .exp-item { grid-template-columns: 1fr; gap: 8px; }
            .rev-rail { left: -20px; }
```

- [ ] **Step 4: Verify**

Reload. Expected: 4 rows separated by hairlines, each with a vertical rail labeled `REV` (rotated orange), mono dates, orange company names, square datum bullets.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: experience section with revision rails"
```

---

### Task 6: Projects with drawing callouts

**Files:**
- Modify: `index.html` — replace `<!-- PROJECTS (Task 6) -->`; append projects CSS.

**Interfaces:**
- Produces: `#projects` section, `.projects-grid` (asymmetric 2-col), `.project-card`, `.prj-index`, `.prj-name`, `.prj-desc`, `.prj-meta`, `.prj-lang`, `.lang-dot`, `.prj-tag`. The four featured repos (user-selected): netto-spendo, physics-phenomena, local-postman, thermal-face-recognition.

- [ ] **Step 1: Add projects CSS**

```css
        /* ===== PROJECTS ===== */
        .projects-grid {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 2px;
            background: var(--hairline);
            border: 1px solid var(--hairline);
        }

        .project-card {
            background: var(--paper);
            padding: 34px 30px;
            text-decoration: none;
            color: inherit;
            display: flex;
            flex-direction: column;
            position: relative;
            transition: background-color var(--ease);
        }

        .project-card:hover { background: var(--paper-2); }

        .prj-index {
            font-family: var(--mono);
            font-size: 0.7rem;
            font-weight: 600;
            letter-spacing: 0.18em;
            color: var(--accent);
            margin-bottom: 14px;
        }

        .prj-name {
            font-family: var(--sans);
            font-size: 1.28rem;
            font-weight: 700;
            letter-spacing: -0.01em;
            margin-bottom: 6px;
            display: flex;
            align-items: baseline;
            gap: 10px;
        }

        .prj-name::after {
            content: '↗';
            font-family: var(--mono);
            font-size: 0.85rem;
            color: var(--steel);
            transition: color var(--ease), transform var(--ease);
        }

        .project-card:hover .prj-name::after {
            color: var(--accent);
            transform: translate(2px, -2px);
        }

        .prj-desc {
            color: var(--steel);
            font-size: 0.92rem;
            line-height: 1.6;
            flex: 1;
            margin-bottom: 20px;
            max-width: 46ch;
        }

        .prj-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .prj-lang {
            display: flex;
            align-items: center;
            gap: 7px;
            font-family: var(--mono);
            font-size: 0.74rem;
            font-weight: 500;
            color: var(--steel);
        }

        .lang-dot { width: 9px; height: 9px; border-radius: 2px; }
        .lang-ts { background: #3178c6; }
        .lang-js { background: #f0db4f; }
        .lang-py { background: #3572A5; }

        .prj-tag {
            font-family: var(--mono);
            font-size: 0.68rem;
            font-weight: 500;
            letter-spacing: 0.06em;
            color: var(--steel);
            border: 1px solid var(--hairline);
            padding: 3px 8px;
            text-transform: uppercase;
        }

        .prj-flag {
            position: absolute;
            top: 30px; right: 26px;
            font-family: var(--mono);
            font-size: 0.62rem;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--steel);
            border: 1px solid var(--hairline);
            padding: 3px 7px;
        }
```

- [ ] **Step 2: Add projects markup (replace `<!-- PROJECTS (Task 6) -->`)**

```html
    <section id="projects" class="sheet">
        <div class="container">
            <div class="fig-label"><span class="fig-num">FIG. 04</span> — Selected Work</div>
            <h2 class="sheet-title">Projects</h2>
            <div class="sheet-rule"></div>
            <div class="projects-grid">
                <a href="https://github.com/mariobgsp/netto-spendo" target="_blank" rel="noopener" class="project-card">
                    <span class="prj-index">PRJ-01</span>
                    <h3 class="prj-name">Netto Spendo</h3>
                    <p class="prj-desc">Minimalist expense tracking built for performance and UX — income/expense tracking, net balance, and financial health visualization in a dark interface.</p>
                    <div class="prj-meta">
                        <span class="prj-lang"><span class="lang-dot lang-ts"></span>TypeScript</span>
                        <span class="prj-tag">Finance</span>
                        <span class="prj-tag">UX</span>
                    </div>
                </a>
                <a href="https://github.com/mariobgsp/physics-phenomena" target="_blank" rel="noopener" class="project-card">
                    <span class="prj-index">PRJ-02</span>
                    <h3 class="prj-name">PhysicsLab</h3>
                    <p class="prj-desc">High-fidelity interactive suite of 37 physics simulations visualizing fundamental phenomena with premium aesthetics and pedagogical clarity.</p>
                    <div class="prj-meta">
                        <span class="prj-lang"><span class="lang-dot lang-ts"></span>TypeScript</span>
                        <span class="prj-tag">Simulation</span>
                        <span class="prj-tag">37 Labs</span>
                    </div>
                </a>
                <a href="https://github.com/mariobgsp/local-postman" target="_blank" rel="noopener" class="project-card">
                    <span class="prj-index">PRJ-03</span>
                    <h3 class="prj-name">Local Postman</h3>
                    <p class="prj-desc">Postman-like HTTP client that runs entirely on your machine — no account, no cloud, no telemetry. JSON-file storage, pre-request scripts, pm.test assertions, atomic persistence, full node:test suite. MIT licensed.</p>
                    <div class="prj-meta">
                        <span class="prj-lang"><span class="lang-dot lang-js"></span>JavaScript</span>
                        <span class="prj-tag">Dev Tool</span>
                        <span class="prj-tag">Local-First</span>
                    </div>
                </a>
                <a href="https://github.com/mariobgsp/thermal-face-recognition" target="_blank" rel="noopener" class="project-card">
                    <span class="prj-index">PRJ-04</span>
                    <h3 class="prj-name">Thermal Face Recognition</h3>
                    <p class="prj-desc">Thermal emotion recognition using CNNs — final-year thesis system for psychotherapy measurement instrumentation.</p>
                    <div class="prj-meta">
                        <span class="prj-lang"><span class="lang-dot lang-py"></span>Jupyter</span>
                        <span class="prj-tag">AI / CNN</span>
                        <span class="prj-tag">Thesis</span>
                    </div>
                </a>
            </div>
        </div>
    </section>
```

- [ ] **Step 3: Add mobile rule**

```css
            .projects-grid { grid-template-columns: 1fr; }
```

- [ ] **Step 4: Verify**

Reload. Expected: 2×2 grid with hairline dividers (grid-gap trick renders the hairline), mono orange `PRJ-0X` indices, arrow glyph on hover turns orange, squared language dots, boxed tag labels. No cards, no radius, no shadow.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: projects grid with drawing callouts"
```

---

### Task 7: Skills spec clusters + education + certifications

**Files:**
- Modify: `index.html` — replace `<!-- SKILLS + EDUCATION + CERTS (Task 7) -->`; append CSS.

**Interfaces:**
- Produces: `#skills` section (also hosts education + certifications), `.spec-cluster`, `.cluster-title`, `.cluster-list`, `.cluster-item`, `.check` markers, `.edu-block`, `.cert-list`, `.cert-item`, `.cert-year`, `.cert-name`. Content verbatim from resume.

- [ ] **Step 1: Add skills CSS**

```css
        /* ===== SKILLS ===== */
        .skills-layout {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 56px;
            align-items: start;
        }

        .spec-cluster { margin-bottom: 40px; }

        .cluster-title {
            font-family: var(--mono);
            font-size: 0.74rem;
            font-weight: 600;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--accent);
            margin-bottom: 14px;
        }

        .cluster-list { list-style: none; }

        .cluster-item {
            display: grid;
            grid-template-columns: 16px 1fr;
            gap: 10px;
            padding: 9px 0;
            border-bottom: 1px solid var(--hairline);
            color: var(--ink);
            font-size: 0.95rem;
        }

        .cluster-item .check {
            font-family: var(--mono);
            color: var(--accent);
            font-size: 0.82rem;
            line-height: 1.5;
        }

        .cluster-item span:last-child { color: var(--steel); }
        .cluster-item b { color: var(--ink); font-weight: 600; }

        /* ===== EDUCATION ===== */
        .edu-block {
            border: 1px solid var(--hairline);
            padding: 28px;
            background: rgba(14, 35, 71, 0.35);
        }

        .edu-block .edu-degree {
            font-family: var(--sans);
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .edu-block .edu-school {
            font-family: var(--mono);
            font-size: 0.82rem;
            font-weight: 600;
            color: var(--accent);
            margin-bottom: 4px;
        }

        .edu-block .edu-date {
            font-family: var(--mono);
            font-size: 0.72rem;
            color: var(--steel);
            margin-bottom: 12px;
        }

        .edu-block .edu-thesis {
            color: var(--steel);
            font-size: 0.9rem;
            max-width: 56ch;
        }

        /* ===== CERTIFICATIONS ===== */
        .cert-list { list-style: none; }

        .cert-item {
            display: grid;
            grid-template-columns: 64px 1fr;
            gap: 16px;
            padding: 13px 0;
            border-bottom: 1px solid var(--hairline);
        }

        .cert-year {
            font-family: var(--mono);
            font-size: 0.74rem;
            font-weight: 500;
            color: var(--steel);
            padding-top: 2px;
        }

        .cert-name { color: var(--ink); font-size: 0.94rem; }
        .cert-name .cert-issuer { color: var(--steel); }
```

- [ ] **Step 2: Add skills + education + certifications markup (replace `<!-- SKILLS + EDUCATION + CERTS (Task 7) -->`)**

```html
    <section id="skills" class="sheet">
        <div class="container">
            <div class="fig-label"><span class="fig-num">FIG. 05</span> — Spec Sheet</div>
            <h2 class="sheet-title">Skills &amp; Credentials</h2>
            <div class="sheet-rule"></div>
            <div class="skills-layout">
                <div>
                    <div class="spec-cluster">
                        <h3 class="cluster-title">Languages &amp; Frameworks</h3>
                        <ul class="cluster-list">
                            <li class="cluster-item"><span class="check">▣</span><span><b>Java, Spring Framework</b> — primary stack</span></li>
                            <li class="cluster-item"><span class="check">▣</span><span><b>Go, Echo</b> — microservices</span></li>
                            <li class="cluster-item"><span class="check">▣</span><span>Jakarta Persistence, React.js</span></li>
                        </ul>
                    </div>
                    <div class="spec-cluster">
                        <h3 class="cluster-title">Data &amp; Infrastructure</h3>
                        <ul class="cluster-list">
                            <li class="cluster-item"><span class="check">▣</span><span>MySQL · PostgreSQL · Oracle · Elasticsearch</span></li>
                            <li class="cluster-item"><span class="check">▣</span><span>Kubernetes · Docker · RabbitMQ · Solace</span></li>
                            <li class="cluster-item"><span class="check">▣</span><span>Google Cloud Platform (GCP)</span></li>
                        </ul>
                    </div>
                    <div class="spec-cluster">
                        <h3 class="cluster-title">APIs &amp; Architecture</h3>
                        <ul class="cluster-list">
                            <li class="cluster-item"><span class="check">▣</span><span>REST APIs · Microservices · SOA · API Gateway</span></li>
                            <li class="cluster-item"><span class="check">▣</span><span>OOP · Clean Code · SOLID Principles</span></li>
                        </ul>
                    </div>
                    <div class="spec-cluster">
                        <h3 class="cluster-title">Practices &amp; Tools</h3>
                        <ul class="cluster-list">
                            <li class="cluster-item"><span class="check">▣</span><span><b>AI-Augmented Dev</b> — Windsurf, MCP</span></li>
                            <li class="cluster-item"><span class="check">▣</span><span>Agile/Scrum · Jira · Git · Full-Cycle Delivery</span></li>
                            <li class="cluster-item"><span class="check">▣</span><span>Languages: <b>Bahasa Indonesia</b> (native) · <b>English</b> (professional)</span></li>
                        </ul>
                    </div>
                    <div class="edu-block">
                        <div class="edu-degree">B.Eng, Engineering Physics</div>
                        <div class="edu-school">Universitas Gadjah Mada</div>
                        <div class="edu-date">Aug 2017 — Jul 2021</div>
                        <p class="edu-thesis">Thesis: Design of Emotion Identification System based on Thermal Camera Image with CNN Classification for Psychotherapy Measurement Instrumentation.</p>
                    </div>
                </div>
                <div>
                    <div class="spec-cluster">
                        <h3 class="cluster-title">Certifications</h3>
                        <ul class="cert-list">
                            <li class="cert-item"><span class="cert-year">2026</span><span class="cert-name">Software Architecture &amp; Technology of Large-Scale Systems <span class="cert-issuer">— Udemy</span></span></li>
                            <li class="cert-item"><span class="cert-year">2025</span><span class="cert-name">React: Creating and Hosting a Full-Stack Site <span class="cert-issuer">— LinkedIn</span></span></li>
                            <li class="cert-item"><span class="cert-year">2025</span><span class="cert-name">Learning Full-Stack JavaScript Development: MongoDB, Node, and React <span class="cert-issuer">— LinkedIn</span></span></li>
                            <li class="cert-item"><span class="cert-year">2025</span><span class="cert-name">Project Management Foundations <span class="cert-issuer">— LinkedIn</span></span></li>
                            <li class="cert-item"><span class="cert-year">2025</span><span class="cert-name">SOLID Principles: Introducing Software Architecture &amp; Design <span class="cert-issuer">— Udemy</span></span></li>
                            <li class="cert-item"><span class="cert-year">2025</span><span class="cert-name">React Essential Training <span class="cert-issuer">— LinkedIn</span></span></li>
                            <li class="cert-item"><span class="cert-year">2023</span><span class="cert-name">Working with Microservices in Go (Golang) <span class="cert-issuer">— Udemy</span></span></li>
                            <li class="cert-item"><span class="cert-year">2023</span><span class="cert-name">Go: The Complete Developer's Guide <span class="cert-issuer">— Udemy</span></span></li>
                            <li class="cert-item"><span class="cert-year">2021</span><span class="cert-name">PHP &amp; MySQL — Certification Course for Beginners <span class="cert-issuer">— Udemy</span></span></li>
                            <li class="cert-item"><span class="cert-year">2020</span><span class="cert-name">HTML, JavaScript, &amp; Bootstrap — Certification Course <span class="cert-issuer">— Udemy</span></span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>
```

- [ ] **Step 3: Add mobile rule**

```css
            .skills-layout { grid-template-columns: 1fr; gap: 48px; }
```

- [ ] **Step 4: Verify**

Reload. Expected: two columns — left: four spec clusters with orange titles and `▣` check marks, education block with border and orange school line; right: certification list with year column and hairline separators.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: skills spec clusters, education, and certifications"
```

---

### Task 8: Footer title block

**Files:**
- Modify: `index.html` — replace `<!-- FOOTER (Task 8) -->`; append footer CSS. `#contact` anchor lives here (scroll target for the Contact nav link).

**Interfaces:**
- Produces: `<footer id="contact">`, `.title-block`, `.tb-grid`, `.tb-label`, `.tb-value`, `.tb-links`.

- [ ] **Step 1: Add footer CSS**

```css
        /* ===== FOOTER TITLE BLOCK ===== */
        footer { padding: 0 0 56px; }

        .title-block {
            border: 1px solid var(--hairline);
            background: rgba(14, 35, 71, 0.35);
        }

        .title-block .tb-title {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 16px;
            padding: 26px 28px;
            border-bottom: 1px solid var(--hairline);
        }

        .tb-name {
            font-family: var(--sans);
            font-size: 1.05rem;
            font-weight: 700;
        }

        .tb-rev {
            font-family: var(--mono);
            font-size: 0.68rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--accent);
        }

        .tb-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            border-bottom: 1px solid var(--hairline);
        }

        .tb-cell {
            padding: 18px 28px;
            border-right: 1px solid var(--hairline);
        }

        .tb-cell:last-child { border-right: none; }

        .tb-label {
            font-family: var(--mono);
            font-size: 0.62rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--steel);
            margin-bottom: 6px;
        }

        .tb-value {
            font-family: var(--mono);
            font-size: 0.8rem;
            color: var(--ink);
            word-break: break-word;
        }

        .tb-value a { text-decoration: none; transition: color var(--ease); }
        .tb-value a:hover { color: var(--accent); }

        .tb-foot {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
            padding: 18px 28px;
            font-family: var(--mono);
            font-size: 0.7rem;
            color: var(--steel);
        }

        .tb-foot .tb-sheet-num { color: var(--accent); }
```

- [ ] **Step 2: Add footer markup (replace `<!-- FOOTER (Task 8) -->`)**

```html
    <footer id="contact">
        <div class="container">
            <div class="title-block">
                <div class="tb-title">
                    <span class="tb-name">Muhammad Ario Bagus Prakusa</span>
                    <span class="tb-rev">REV 2026 — Sheet 1 of 1</span>
                </div>
                <div class="tb-grid">
                    <div class="tb-cell">
                        <div class="tb-label">Email</div>
                        <div class="tb-value"><a href="mailto:mariobgsp@gmail.com">mariobgsp@gmail.com</a></div>
                    </div>
                    <div class="tb-cell">
                        <div class="tb-label">GitHub</div>
                        <div class="tb-value"><a href="https://github.com/mariobgsp" target="_blank" rel="noopener">@mariobgsp</a></div>
                    </div>
                    <div class="tb-cell">
                        <div class="tb-label">LinkedIn</div>
                        <div class="tb-value"><a href="https://www.linkedin.com/in/mariobgsp/" target="_blank" rel="noopener">in/mariobgsp</a></div>
                    </div>
                    <div class="tb-cell">
                        <div class="tb-label">Location</div>
                        <div class="tb-value">Tangerang Selatan, Indonesia</div>
                    </div>
                </div>
                <div class="tb-foot">
                    <span>&copy; 2026 Muhammad Ario Bagus Prakusa</span>
                    <span class="tb-sheet-num">SCALE 1:1 — ALL RIGHTS RESERVED</span>
                </div>
            </div>
        </div>
    </footer>
```

- [ ] **Step 3: Add mobile rule**

```css
            .tb-grid { grid-template-columns: 1fr 1fr; }
            .tb-cell:nth-child(2) { border-right: none; }
            .tb-cell:nth-child(n+3) { border-top: 1px solid var(--hairline); }
```

- [ ] **Step 4: Verify**

Reload and scroll to bottom. Expected: bordered title block with name + `REV 2026 — SHEET 1 OF 1`, 4 cells (Email/GitHub/LinkedIn/Location) with mono labels and values, bottom rule with copyright and `SCALE 1:1`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: footer title block"
```

---

### Task 9: JavaScript behaviors — line-draw, nav, reveals

**Files:**
- Modify: `index.html` — replace `/* JS (Task 9) */` inside the existing `<script>` block.

**Interfaces:**
- Consumes: `#navbar`, `#navToggle`, `#navLinks`, `#heroFrame` (its `<svg><path>`), all `.reveal` targets, all `a[href^="#"]` links.
- Produces: nav `.scrolled` + `.active` link states, hamburger toggle + `aria-expanded`, hero line-draw animation (once), scroll reveals via IntersectionObserver, smooth scrolling, `prefers-reduced-motion` handling.

- [ ] **Step 1: Replace the script**

```html
    <script>
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        /* ===== Navbar scroll state + active link ===== */
        const navbar = document.getElementById('navbar');
        const sections = ['about', 'experience', 'projects', 'skills', 'contact'];
        const linkEls = {};
        document.querySelectorAll('.nav-links a').forEach(a => {
            linkEls[a.getAttribute('href').slice(1)] = a;
        });

        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                navbar.classList.toggle('scrolled', window.scrollY > 40);
                const y = window.scrollY + 120;
                let current = 'about';
                for (const id of sections) {
                    const el = document.getElementById(id);
                    if (el && el.offsetTop <= y) current = id;
                }
                document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
                if (linkEls[current]) linkEls[current].classList.add('active');
                ticking = false;
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        /* ===== Mobile menu ===== */
        const navToggle = document.getElementById('navToggle');
        const navLinks = document.getElementById('navLinks');
        navToggle.addEventListener('click', () => {
            const open = navLinks.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', String(open));
        });
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });

        /* ===== Hero line-draw ===== */
        const frame = document.getElementById('heroFrame');
        if (frame && !reduceMotion) {
            const path = frame.querySelector('svg path');
            const len = Math.ceil(path.getTotalLength());
            frame.style.setProperty('--dash', len);
            path.setAttribute('stroke-dasharray', len);
            path.setAttribute('stroke-dashoffset', len);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                frame.classList.add('draw');
            }));
        } else if (frame) {
            frame.querySelector('svg path').style.display = 'none';
        }

        /* ===== Scroll reveals ===== */
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    </script>
```

- [ ] **Step 2: Add reveal CSS** (append before the `/* ===== RESPONSIVE BASE ===== */` block)

```css
        /* ===== SCROLL REVEAL ===== */
        .reveal {
            opacity: 0;
            transform: translateY(12px);
            transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
        }

        .reveal.visible { opacity: 1; transform: translateY(0); }

        @media (prefers-reduced-motion: reduce) {
            .reveal { opacity: 1; transform: none; transition: none; }
        }
```

- [ ] **Step 3: Attach `.reveal` classes to major blocks**

Add `class="reveal"` to the wrapping div of each section's header and grid container: the `<div class="about-grid reveal">` etc. Simplest consistent choice: add `reveal` to the header block (`<div class="fig-label reveal">` is NOT allowed — the label must stay visible). Instead add `reveal` to: `.about-grid`, the experience container `<div>` (wrap the four `.exp-item` blocks in `<div class="reveal">`), `.projects-grid`, `.skills-layout`, `.title-block`. Do this with 5 edits, one per section.

- [ ] **Step 4: Verify**

Reload. Expected: frame border draws itself once on load (1.6s); nav gets hairline border after 40px scroll; active link highlights in the section you're viewing; `.reveal` blocks fade up 12px as they enter viewport; hamburger toggles mobile menu; `aria-expanded` flips. Enable DevTools → Rendering → "Emulate prefers-reduced-motion: reduce": line-draw skipped (frame visible immediately), reveals appear without transition.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: hero line-draw, nav states, scroll reveals"
```

---

### Task 10: Final QA pass — anti-slop audit and responsive check

**Files:**
- Modify: `index.html` (only if the audit below finds violations)

- [ ] **Step 1: Run the anti-slop audit on the final file**

Run: `grep -n -E "Inter|JetBrains|gradient|#a78bfa|box-shadow|border-radius|emoji|📊|🤖|💰|⚛️" index.html`
Expected: no matches except `border-radius: 2px` (if present). Any match = violation → fix in Step 2.

- [ ] **Step 2: Fix any violations**

If the grep finds matches, remove/replace them per the spec (no gradient text, no glow, no purple, no emoji, no shadows, no pill radii).

- [ ] **Step 3: Verify contrast + responsive**

- Check primary text `#dfe9ff` on `#0a1c3c` (AA pass, ~14:1) and orange `#ff7a3d` text on `#0a1c3c` (AA pass for large/label text) — eyeball in DevTools.
- Test at 1280, 768, 480, 360px widths. Expected: nav single line ≥768px; hamburger + stacked sections <768px; footer cells 2-up <768px; no horizontal scroll (`overflow-x: hidden` on body is the guard).
- Test tab navigation: all links reachable, focus visible (browser default outline acceptable).

- [ ] **Step 4: Run Lighthouse**

Run: Chrome DevTools → Lighthouse → Mobile, or `npx lighthouse http://localhost:8000 --quiet --chrome-flags="--headless" --only-categories=performance,accessibility,seo`.
Expected: Performance ≥ 90, Accessibility ≥ 90, SEO ≥ 95. If below, fix the flagged issue and re-run.

- [ ] **Step 5: Final commit**

```bash
git add index.html
git commit -m "chore: final QA pass on blueprint portfolio"
```

---

## Self-Review Notes

- Spec coverage: every spec section maps to a task — palette/tokens (T1), nav (T2), hero+stamps+CTAs (T3), about+stats (T4), experience (T5), projects (T6), skills+edu+certs (T7), footer title block (T8), motion/reveals/reduced-motion (T9), anti-slop audit (T10).
- Placeholders: none — every step contains full code or exact commands.
- Type consistency: `--paper`, `--hairline`, `--steel`, `--accent`, `--ink`, `--mono`, `--sans` used identically across all tasks; element IDs (`navbar`, `navToggle`, `navLinks`, `heroFrame`) match between markup and JS; `.reveal`/`.visible` consistent.
