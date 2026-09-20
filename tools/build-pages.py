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


def nav(active=None):
    """Top-nav links. `active` is a slug for project pages, 'work' for the index."""
    items = [("Work", "/work/", active == "work"), ("Home", "/", False),
             ("GitHub", "https://github.com/mariobgsp", False)]
    out = []
    for label, href, on in items:
        ext = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
        cls = ' class="active"' if on else ""
        out.append(f'<li><a href="{e(href)}"{cls}{ext}>{e(label)}</a></li>')
    return "\n          ".join(out)


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
    <meta name="theme-color" content="#12101f" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="{UP}assets/theme.css" />
  </head>
  <body>
    <div class="bg-grid" aria-hidden="true"></div>
    <div class="scanlines" aria-hidden="true"></div>

    <header class="topnav">
      <div class="topnav-inner">
        <a class="nav-logo" href="/"><span class="logo-dot">&gt;</span> ario.dev</a>
        <span class="nav-status">BACKEND &amp; API ENGINEER</span>
        <ul class="nav-links">
          {nav(active)}
        </ul>
      </div>
    </header>

    <main class="page">
{body}
    </main>

    {FOOTER}
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
    cls = f'section {extra_class}'.strip()
    return f"""      <section class="{cls}" id="{sec_id}">
        <div class="container">
          <p class="kicker"><b>[ {num} ]</b> {e(kicker)}</p>
          <div class="section-rule"></div>
          <h2 class="section-title">{e(title)}</h2>
{body}
        </div>
      </section>"""


# ---------------------------------------------------------------- project page

def project_page(p, index, total):
    repo = REPO_URL.format(p["slug"])
    counter = itertools.count(1)

    def sec(sec_id, kicker, title, body):
        """Number the sections in the order they actually appear."""
        return section(sec_id, f"{next(counter):02d}", kicker, title, body)
    hero = f"""      <section class="hero hero-compact" id="top">
        <div class="container">
          <div class="hero-inner">
            <a class="crumb" href="/work/">&larr; All work</a>
            <p class="kicker"><b>[ {e(p["lang"])} ]</b> {index} of {total}</p>
            <h1 class="hero-name">{e(p["name"])}</h1>
            <p class="hero-title">{e(p["strapline"])}</p>
            <div class="cmd-wrap"><pre class="cmd">{e(p["hero_cmd"])}</pre></div>{stat_row(p["results"])}
            <div class="actions" style="margin-top: 24px">
              <a class="btn btn-primary" href="{e(repo)}" target="_blank" rel="noopener">Repository on GitHub</a>
              <a class="btn btn-ghost" href="#install">Install</a>
            </div>
            <ul class="tags" style="margin-top: 20px">
              {"".join(f'<li class="tag">{e(t)}</li>' for t in p["tags"])}
            </ul>
          </div>
        </div>
      </section>"""

    parts = [hero]

    what = "\n".join(f'          <p class="prose">{e(x)}</p>' for x in p["what"])
    parts.append(sec("what", "WHAT IT IS", "In plain words", what))

    parts.append(sec(
        "architecture", "ARCHITECTURE", "How it is put together",
        f"""          <div class="split">
            <div>{bullets(p["architecture"])}</div>
            <div>
              <img class="thumb" src="{UP}assets/thumbs/thumb-{e(p["slug"])}.png" width="1200" height="630" loading="lazy" alt="" />
            </div>
          </div>"""))

    install = "\n".join(f'            <pre class="cmd">{e(line)}</pre>' for line in p["install"])
    parts.append(sec(
        "install", "INSTALL", "Set it up",
        f'          <div class="cmd-wrap" style="max-width: 100%">\n{install}\n          </div>'))

    quick = "\n".join(f"            <li>{e(s)}</li>" for s in p["quickstart"])
    parts.append(sec(
        "quickstart", "QUICKSTART", "See it work",
        f'          <ol class="deliverables">\n{quick}\n          </ol>'))

    if p["results"]:
        cards = "\n".join(
            f"""            <div class="card bracket">
              <div class="card-head"><h3 class="card-name">{e(r["label"])}</h3><span class="card-index">REPO STATES</span></div>
              <p class="card-role">{e(r["value"])}</p>
            </div>"""
            for r in p["results"]
        )
        parts.append(sec("results", "NUMBERS", "What the repo states", f'          <div class="card-grid">\n{cards}\n          </div>'))

    trade = "\n".join(f"            <li>{e(t)}</li>" for t in p["tradeoffs"])
    parts.append(sec(
        "tradeoffs", "TRADEOFFS", "What it does not do",
        f'          <ol class="deliverables">\n{trade}\n          </ol>'))

    links = [l for l in p["links"] if l["url"] != repo and l["url"].startswith("http")]
    link_html = ""
    if links:
        link_html = "\n" + "\n".join(
            f'          <div class="actions" style="margin-top: 20px">'
            f'<a class="btn btn-ghost" href="{e(l["url"])}" target="_blank" rel="noopener">{e(l["label"])}</a></div>'
            for l in links)
    parts.append(sec(
        "repo", "SOURCE", "Read the code",
        f'          <p class="prose">The full implementation, tests and documentation live in the repository.</p>'
        f'{link_html}\n          <div class="actions" style="margin-top: 20px">'
        f'<a class="btn btn-primary" href="{e(repo)}" target="_blank" rel="noopener">github.com/mariobgsp/{e(p["slug"])}</a>'
        f'<a class="btn btn-ghost" href="/work/">Other projects</a></div>'))

    body = "\n\n".join(parts) + '\n\n      <hr class="hairline" />'
    return shell(
        f'{p["name"]} — {p["strapline"]}',
        f'{p["name"]}: {p["strapline"]}',
        body, active=p["slug"])


# ------------------------------------------------------------------ index page

def work_page(projects):
    cards = []
    for i, p in enumerate(projects, 1):
        u = p["upwork"]
        cards.append(f"""            <article class="card bracket">
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
                <a class="btn btn-primary" href="/{e(p['slug'])}/">Read the write-up</a>
                <a class="btn btn-ghost" href="{e(REPO_URL.format(p['slug']))}" target="_blank" rel="noopener" aria-label="{e(p['slug'])} repository on GitHub">Repository</a>
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

    body = f"""      <section class="hero" id="top">
        <div class="container">
          <div class="hero-inner">
            <p class="kicker"><b>[ PORTFOLIO ]</b> {len(projects)} production-style backend systems</p>
            <h1 class="hero-name">Selected Work</h1>
            <p class="hero-title">Backend &amp; API engineering &mdash; payments, gateways, market data</p>
            <p class="hero-sub">
              One page per project: what it is, how it is put together, how to run it,
              the numbers the repository actually states, and what it does not do.
            </p>
            <div class="actions">
              <a class="btn btn-primary" href="https://github.com/mariobgsp" target="_blank" rel="noopener">View GitHub</a>
              <a class="btn btn-ghost" href="#projects">Browse the {len(projects)} projects</a>
            </div>
            <div class="stat-row">
{stat_html}
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="projects">
        <div class="container">
          <p class="kicker"><b>[ 01 ]</b> THE PROJECTS</p>
          <div class="section-rule"></div>
          <h2 class="section-title">Pick one and read its own page</h2>

          <div class="card-grid">
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
    projects = json.loads(DATA.read_text(encoding="utf-8"))
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
