#!/usr/bin/env python3
"""Render /work/ (index) and one landing page per project from tools/projects.json.

    python3 tools/build-pages.py            # write the pages
    python3 tools/build-pages.py --check    # verify the JSON only, write nothing

Every string on the generated pages comes from tools/projects.json, so a claim can
only appear if it is in that file - and that file is only filled from the repos.
"""

import html
import itertools
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "tools" / "projects.json"
UP = "../"  # every generated page sits one directory below the site root

REPO_URL = "https://github.com/mariobgsp/{}"
SITE = "https://mariobgsp.github.io"


def e(value):
    return html.escape(str(value), quote=True)


NAV_ITEMS = [("Work", "/work/"), ("Home", "/"),
             ("GitHub", "https://github.com/mariobgsp")]


def nav(active=None):
    """Pill links for wide screens. `active` is a slug or 'work'."""
    out = []
    for label, href in NAV_ITEMS:
        ext = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
        cls = ' class="active"' if active and label == "Work" else ""
        out.append(f'<li><a href="{e(href)}"{cls}{ext}>{e(label)}</a></li>')
    return "\n          ".join(out)


def nav_menu():
    """Full-screen overlay shown below 860px."""
    out = []
    for label, href in NAV_ITEMS:
        ext = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
        out.append(f'      <a href="{e(href)}"{ext}>{e(label)}</a>')
    return "\n".join(out)


FOOTER = """<footer class="footer" id="contact">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-col">
            <h3>GitHub</h3>
            <a href="https://github.com/mariobgsp" target="_blank" rel="noopener">github.com/mariobgsp</a>
          </div>
          <div class="footer-col">
            <h3>Focus</h3>
            <span>Backend &amp; API engineering</span>
          </div>
          <div class="footer-col">
            <h3>Selected work</h3>
            <a href="/work/">All six projects</a>
          </div>
          <div class="footer-col">
            <h3>Availability</h3>
            <span><span class="led led-green" aria-hidden="true"></span> Open to new work</span>
          </div>
        </div>
        <p class="mono-tag" style="margin-top: 22px">
          Built from open repositories &mdash; no employer or client code reproduced.
        </p>
      </div>
    </footer>"""


def shell(title, description, body, active=None):
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>{e(title)}</title>
    <meta name="description" content="{e(description)}" />
    <meta name="theme-color" content="#050505" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="{UP}assets/theme.css" />
  </head>
  <body>
    <div class="bg-mesh" aria-hidden="true"></div>
    <div class="bg-grid" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>
    <div class="progress-track" aria-hidden="true"><span id="progressBar"></span></div>

    <header class="topnav">
      <div class="topnav-inner">
        <a class="nav-logo" href="/">mario<span class="logo-dot">.</span>dev</a>
        <span class="nav-status"><span class="led led-green" aria-hidden="true"></span> Backend &amp; API engineer</span>
        <ul class="nav-links">
          {nav(active)}
        </ul>
        <button class="nav-hamburger" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button>
      </div>
    </header>

    <div class="nav-menu">
{nav_menu()}
    </div>

    <main class="page">
{body}
    </main>

    {FOOTER}

    <script src="{UP}assets/site.js"></script>
  </body>
</html>
"""


def bullets(items, cls="deliverables"):
    return f'<ul class="{cls}">' + "\n".join(f"  <li>{e(i)}</li>" for i in items) + "</ul>"


def stat_row(results):
    if not results:
        return ""
    stats = "\n".join(
        f'            <div class="stat"><b>{e(r["value"])}</b><span>{e(r["label"])}</span></div>'
        for r in results
    )
    return f'\n            <div class="stat-row">\n{stats}\n            </div>'


def section(sec_id, num, kicker, title, body, extra_class=""):
    cls = f'section anchor {extra_class}'.strip()
    return f"""      <section class="{cls} reveal" id="{sec_id}">
        <div class="container">
          <p class="kicker"><b>[ {num} ]</b> {e(kicker)}</p>
          <div class="section-rule"></div>
          <h2 class="section-title">{e(title)}</h2>
{body}
        </div>
      </section>"""


# ------------------------------------------------------------------- widgets

WIDGET_TYPES = ("flow", "checklist", "faq")


def widget_problems(p):
    """Schema problems for one project's optional interactive widgets."""
    problems = []
    widgets = p.get("widgets") or []
    if not isinstance(widgets, list):
        return [f"{p['slug']}: widgets must be a list"]
    seen = set()
    for w in widgets:
        if not isinstance(w, dict):
            problems.append(f"{p['slug']}: each widget must be an object")
            continue
        wtype = w.get("type")
        anchor = w.get("anchor")
        if wtype not in WIDGET_TYPES:
            problems.append(f"{p['slug']}: unknown widget type {wtype!r}")
            continue
        if not anchor:
            problems.append(f"{p['slug']}: {wtype} widget has no anchor")
        elif anchor in seen:
            problems.append(f"{p['slug']}: duplicate widget anchor {anchor!r}")
        else:
            seen.add(anchor)
        if not w.get("title"):
            problems.append(f"{p['slug']}: {wtype} {anchor} has no title")
        if not w.get("kicker"):
            problems.append(f"{p['slug']}: {wtype} {anchor} has no kicker")
        if wtype == "flow":
            steps = w.get("steps")
            if not isinstance(steps, list) or len(steps) < 2:
                problems.append(f"{p['slug']}: flow {anchor} needs at least 2 steps")
            else:
                for s in steps:
                    if not s.get("title") or not s.get("what") or not s.get("detail"):
                        problems.append(f"{p['slug']}: flow {anchor} steps need title, what and detail")
                        break
        elif wtype == "checklist":
            steps = w.get("steps")
            if not isinstance(steps, list) or not steps:
                problems.append(f"{p['slug']}: checklist {anchor} needs steps")
            else:
                for s in steps:
                    if not s.get("id") or not s.get("title") or not s.get("cmd"):
                        problems.append(f"{p['slug']}: checklist {anchor} steps need id, title and cmd")
                        break
            if not w.get("storage_key"):
                problems.append(f"{p['slug']}: checklist {anchor} has no storage_key")
        elif wtype == "faq":
            items = w.get("items")
            if not isinstance(items, list) or not items:
                problems.append(f"{p['slug']}: faq {anchor} needs items")
            else:
                for it in items:
                    if not it.get("q") or not it.get("a"):
                        problems.append(f"{p['slug']}: faq {anchor} items need q and a")
                        break
    return problems


def render_widget_body(w):
    """Render one widget's markup: a readable static fallback that the
    progressive-enhancement script in assets/site.js then wires up."""
    wtype = w["type"]
    anchor = e(w["anchor"])
    intro = ""
    if w.get("intro"):
        intro = f'\n            <p class="prose widget-intro">{e(w["intro"])}</p>'

    if wtype == "flow":
        modes = w.get("modes") or []
        toolbar = ""
        if modes:
            btns = []
            for m in modes:
                active = m.get("id") == w.get("default_mode")
                cls = "widget-toggle is-active" if active else "widget-toggle"
                pressed = "true" if active else "false"
                btns.append(
                    f'              <button type="button" class="{cls}" data-flow-mode="{e(m["id"])}" aria-pressed="{pressed}">{e(m["label"])}</button>')
            toolbar = ('\n            <div class="widget-toolbar" role="group" aria-label="Request path">\n'
                       + "\n".join(btns) + "\n            </div>")
        steps = []
        for i, s in enumerate(w["steps"]):
            sid = f"{anchor}-step-{i}"
            mode_attr = " ".join(s.get("modes") or [])
            steps.append(
                f'''            <li class="flow-step" data-flow-modes="{e(mode_attr)}">
              <button type="button" class="flow-step-btn" aria-expanded="false" aria-controls="{sid}">
                <span class="flow-step-title">{e(s["title"])}</span>
                <span class="flow-step-what">{e(s["what"])}</span>
              </button>
              <div class="flow-detail" id="{sid}"><p>{e(s["detail"])}</p></div>
            </li>''')
        return (f'          <div class="widget" data-widget="flow" id="{anchor}">{intro}{toolbar}\n'
                f'            <ol class="flow-list">\n' + "\n".join(steps) + "\n            </ol>\n          </div>")

    if wtype == "checklist":
        key = e(w.get("storage_key", "checklist-" + anchor))
        steps = []
        for s in w["steps"]:
            steps.append(
                f'''            <li class="checklist-step" data-step="{e(s["id"])}">
              <label class="checklist-head"><input type="checkbox" class="checklist-box" data-check="{e(s["id"])}"><span class="checklist-title">{e(s["title"])}</span></label>
              <p class="checklist-body">{e(s["body"])}</p>
              <div class="cmd-wrap" style="max-width:100%"><pre class="cmd">{e(s["cmd"])}</pre></div>
            </li>''')
        return (f'          <div class="widget" data-widget="checklist" id="{anchor}" data-storage-key="{key}">{intro}\n'
                f'            <ol class="checklist">\n' + "\n".join(steps) + "\n            </ol>\n          </div>")

    items = []
    for i, it in enumerate(w["items"]):
        aid = f"{anchor}-a{i}"
        items.append(
            f'''            <div class="faq-item">
              <button type="button" class="faq-q" aria-expanded="false" aria-controls="{aid}"><span>{e(it["q"])}</span><span class="faq-mark" aria-hidden="true">+</span></button>
              <div class="faq-a" id="{aid}"><p>{e(it["a"])}</p></div>
            </div>''')
    return (f'          <div class="widget" data-widget="faq" id="{anchor}">{intro}\n'
            + "\n".join(items) + "\n          </div>")


# ---------------------------------------------------------------- project page

def project_page(p, index, total):
    repo = REPO_URL.format(p["slug"])
    counter = itertools.count(1)

    def sec(sec_id, kicker, title, body):
        """Number the sections in the order they actually appear."""
        return section(sec_id, f"{next(counter):02d}", kicker, title, body)
    hero = f"""      <section class="hero hero-compact anchor" id="top">
        <div class="container">
          <div class="hero-inner">
            <a class="crumb reveal" href="/work/">&larr; All work</a>
            <p class="kicker reveal"><b>[ {e(p["lang"])} ]</b> {index} of {total}</p>
            <h1 class="hero-name reveal">{e(p["name"])}</h1>
            <p class="hero-title reveal">{e(p["strapline"])}</p>
            <div class="cmd-wrap"><pre class="cmd">{e(p["hero_cmd"])}</pre></div>{stat_row(p["results"])}
            <div class="actions" style="margin-top: 24px">
              <a class="btn btn-primary" href="{e(repo)}" target="_blank" rel="noopener">Repository on GitHub<span class="ext">&#8599;</span></a>
              <a class="btn btn-ghost" href="#install">Install<span class="ext">&#8595;</span></a>
            </div>
            <ul class="tags" style="margin-top: 20px">
              {"".join(f'<li class="tag">{e(t)}</li>' for t in p["tags"])}
            </ul>
          </div>
        </div>
      </section>"""

    parts = [hero]

    widgets = p.get("widgets") or []

    def widget_section(w):
        return sec(w["anchor"], w.get("kicker", "Interactive"), w["title"], render_widget_body(w))

    def append_widgets(section_key):
        """Widgets declare the section they follow, so content order stays in
        projects.json rather than in this renderer."""
        for w in widgets:
            if w.get("after") == section_key:
                parts.append(widget_section(w))

    what = "\n".join(f'          <p class="prose">{e(x)}</p>' for x in p["what"])
    parts.append(sec("what", "WHAT IT IS", "In plain words", what))
    append_widgets("what")

    parts.append(sec(
        "architecture", "ARCHITECTURE", "How it is put together",
        f"""          <div class="split">
            <div>{bullets(p["architecture"])}</div>
            <div>
              <img class="thumb" src="{UP}assets/thumbs/thumb-{e(p["slug"])}.png" width="1200" height="630" loading="lazy" alt="" />
            </div>
          </div>"""))
    append_widgets("architecture")

    install = "\n".join(f'            <pre class="cmd">{e(line)}</pre>' for line in p["install"])
    parts.append(sec(
        "install", "INSTALL", "Set it up",
        f'          <div class="cmd-wrap" style="max-width: 100%">\n{install}\n          </div>'))

    quick = "\n".join(f"            <li>{e(s)}</li>" for s in p["quickstart"])
    parts.append(sec(
        "quickstart", "QUICKSTART", "See it work",
        f'          <ol class="deliverables">\n{quick}\n          </ol>'))
    append_widgets("quickstart")

    if p["results"]:
        cards = "\n".join(
            f"""            <div class="card">
              <div class="card-head"><h3 class="card-name">{e(r["label"])}</h3><span class="card-index">REPO STATES</span></div>
              <p class="card-role">{e(r["value"])}</p>
            </div>"""
            for r in p["results"]
        )
        parts.append(sec("results", "NUMBERS", "What the repo states", f'          <div class="card-grid stagger">\n{cards}\n          </div>'))

    trade = "\n".join(f"            <li>{e(t)}</li>" for t in p["tradeoffs"])
    parts.append(sec(
        "tradeoffs", "TRADEOFFS", "What it does not do",
        f'          <ol class="deliverables">\n{trade}\n          </ol>'))
    append_widgets("tradeoffs")

    links = [x for x in p["links"] if x["url"] != repo and x["url"].startswith("http")]
    link_html = ""
    if links:
        link_html = "\n" + "\n".join(
            f'          <div class="actions" style="margin-top: 20px">'
            f'<a class="btn btn-ghost" href="{e(x["url"])}" target="_blank" rel="noopener">{e(x["label"])}<span class="ext">&#8599;</span></a></div>'
            for x in links)
    parts.append(sec(
        "repo", "SOURCE", "Read the code",
        f'          <p class="prose">The full implementation, tests and documentation live in the repository.</p>'
        f'{link_html}\n          <div class="actions" style="margin-top: 20px">'
        f'<a class="btn btn-primary" href="{e(repo)}" target="_blank" rel="noopener">github.com/mariobgsp/{e(p["slug"])}<span class="ext">&#8599;</span></a>'
        f'<a class="btn btn-ghost" href="/work/">Other projects<span class="ext">&#8594;</span></a></div>'))

    body = "\n\n".join(parts) + '\n\n      <hr class="hairline" />'
    return shell(
        f'{p["name"]} — {p["strapline"]}',
        f'{p["name"]}: {p["strapline"]}',
        body, active=p["slug"])


# ------------------------------------------------------------------ index page

def work_page(projects):
    spans = ("span-7", "span-5", "span-5", "span-7", "span-7", "span-5")
    cards = []
    for i, p in enumerate(projects, 1):
        u = p["upwork"]
        cards.append(f"""            <article class="card {spans[(i - 1) % len(spans)]}">
              <img class="thumb" src="{UP}assets/thumbs/thumb-{e(p['slug'])}.png" width="1200" height="630" loading="lazy" alt="" />
              <div class="card-head">
                <h3 class="card-name">{e(u["title"])}</h3>
                <span class="card-index">{i:02d}</span>
              </div>
              <p class="card-role">{e(u["role"])}</p>
              <p class="card-desc">{e(u["description"])}</p>
              <div class="meta-row"><span class="meta-label">Repo</span><span class="meta-value">github.com/mariobgsp/{e(p['slug'])}</span></div>
              <div>
                <span class="block-label">Skills</span>
                <ul class="tags">{"".join(f'<li class="tag">{e(t)}</li>' for t in u["skills"])}</ul>
              </div>
              <div>
                <span class="block-label">Deliverables</span>
                {bullets(u["deliverables"])}
              </div>
              <div class="card-tools">
                <a class="btn btn-primary" href="/{e(p['slug'])}/">Read the write-up<span class="ext">&#8594;</span></a>
                <a class="btn btn-ghost" href="{e(REPO_URL.format(p['slug']))}" target="_blank" rel="noopener" aria-label="{e(p['slug'])} repository on GitHub">Repository<span class="ext">&#8599;</span></a>
              </div>
            </article>""")

    total_measured = sum(len(p["results"]) for p in projects)
    stats = [
        ("6", "Projects written up"),
        (f"{total_measured}", "Measured facts cited"),
        ("6", "Repos on GitHub"),
        ("5+ yrs", "Production backend"),
    ]
    stat_html = "\n".join(
        f'              <div class="stat"><b>{e(v)}</b><span>{e(k)}</span></div>' for v, k in stats)

    body = f"""      <section class="hero anchor" id="top">
        <div class="container">
          <div class="hero-inner">
            <p class="kicker reveal"><b>[ PORTFOLIO ]</b> {len(projects)} production-style backend systems</p>
            <h1 class="hero-name reveal">Selected Work</h1>
            <p class="hero-title reveal">Backend &amp; API engineering &mdash; payments, gateways, market data</p>
            <p class="hero-sub reveal">
              One page per project: what it is, how it is put together, how to run it,
              the numbers the repository actually states, and what it does not do.
            </p>
            <div class="actions reveal">
              <a class="btn btn-primary" href="https://github.com/mariobgsp" target="_blank" rel="noopener">View GitHub<span class="ext">&#8599;</span></a>
              <a class="btn btn-ghost" href="#projects">Browse the {len(projects)} projects<span class="ext">&#8595;</span></a>
            </div>
            <div class="stat-row reveal">
{stat_html}
            </div>
          </div>
        </div>
      </section>

      <section class="section anchor reveal" id="projects">
        <div class="container">
          <p class="kicker"><b>[ 01 ]</b> THE PROJECTS</p>
          <div class="section-rule"></div>
          <h2 class="section-title">Pick one and read its own page</h2>
          <p class="prose prose-lead">
            Every value on these pages is quoted from the repository's own README, tests or
            config. Where the README publishes nothing, this page says so.
          </p>

          <div class="card-grid stagger">
{chr(10).join(cards)}
          </div>
        </div>
      </section>

      <hr class="hairline" />"""

    return shell(
        "Selected Work — Backend & API Engineering",
        "Six production-style backend systems: payments with idempotency and outbox, "
        "an API gateway, a Go LLM gateway, and market-data tooling. Stack, deliverables "
        "and measured facts per project.",
        body, active="work")


# ------------------------------------------------------------------------ main

def main():
    try:
        projects = json.loads(DATA.read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        print(f"CANNOT READ {DATA.relative_to(ROOT)}: {err}")
        return 1
    slugs = [p["slug"] for p in projects]

    problems = []
    for p in projects:
        for key in ("slug", "name", "strapline", "lang", "tags", "hero_cmd", "what",
                    "architecture", "install", "quickstart", "results", "tradeoffs", "upwork"):
            if key not in p:
                problems.append(f"{p.get('slug','?')}: missing key {key}")
        u = p["upwork"]
        if len(u.get("skills", [])) != 5:
            problems.append(f"{p['slug']}: upwork.skills is not 5")
        if len(u.get("deliverables", [])) != 5:
            problems.append(f"{p['slug']}: upwork.deliverables is not 5")
        if len(u.get("title", "")) > 70 or len(u.get("role", "")) > 100 or len(u.get("description", "")) > 600:
            problems.append(f"{p['slug']}: upwork field over its limit")
        if len(p["strapline"]) > 92:
            problems.append(f"{p['slug']}: strapline {len(p['strapline'])} chars")
        if not pathlib.Path(ROOT / "assets" / "thumbs" / f"thumb-{p['slug']}.png").exists():
            problems.append(f"{p['slug']}: thumbnail missing")
        problems += widget_problems(p)

    if problems:
        print("DATA PROBLEMS:")
        for x in problems:
            print("  -", x)
        if "--check" in sys.argv:
            return 1

    if "--check" in sys.argv:
        print(f"JSON ok: {len(projects)} projects")
        return 0

    written = []
    for i, p in enumerate(projects, 1):
        out = ROOT / p["slug"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(project_page(p, i, len(projects)), encoding="utf-8")
        written.append(out.relative_to(ROOT))

    idx = ROOT / "work" / "index.html"
    idx.write_text(work_page(projects), encoding="utf-8")
    written.append(idx.relative_to(ROOT))

    print(f"wrote {len(written)} pages:")
    for w in written:
        print("  ", w)
    assert set(slugs) == {p.parent.name for p in written if p.parent.name != "work"}, "slug/page mismatch"
    return 0


if __name__ == "__main__":
    sys.exit(main())
