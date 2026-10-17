#!/usr/bin/env python3
"""Render the five published articles from the `articles` repository as pages on
this site, plus /articles/ (hub) and the compact index on the home page.

    python3 tools/build-articles.py              # write every generated file
    python3 tools/build-articles.py --check      # report drift, write nothing
    python3 tools/build-articles.py --src PATH   # another checkout of the repo

The source defaults to ../articles (sibling checkout), or $ARTICLES_SRC. Only
Python's standard library is used: the Markdown renderer below covers exactly
the constructs the articles use (headings, paragraphs, lists, tables, fenced
code, blockquotes, images, inline emphasis and raw <details> blocks).

Every string on the generated pages comes from the Markdown itself. The only
hand-written region is the home page index between ARTICLE_BEGIN and ARTICLE_END.
"""

import html
import json
import os
import pathlib
import re
import shutil
import sys
from datetime import date

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_SRC = ROOT.parent / "articles"
INDEX = ROOT / "index.html"
OUT = ROOT / "articles"
IMG_DST = ROOT / "assets" / "articles"
UP = "../"          # /articles/index.html
DEEP = "../../"     # /articles/<slug>/index.html

SITE = "https://mariobgsp.github.io"
ARTICLE_REPO = "https://github.com/mariobgsp/articles"
REPO_URL = "https://github.com/mariobgsp/{}"
WORDS_PER_MINUTE = 200

# Reading order on the site (the repository README keeps its own order).
SLUGS = ["routre", "durable-agents", "trading-suite", "payment-system", "the-gateway"]

ARTICLE_BEGIN = "<!-- article:begin -->"
ARTICLE_END = "<!-- article:end -->"


def e(value):
    return html.escape(str(value), quote=True)


# ------------------------------------------------------------------ markdown

FENCE = re.compile(r"^\s*```\s*([a-zA-Z0-9+-]*)\s*$")
HEADING = re.compile(r"^(#{1,4})\s+(.*)$")
LIST_ITEM = re.compile(r"^(\s*)([-*]|\d+\.)\s+(.*)$")
TABLE_ROW = re.compile(r"^\s*\|")


def split_row(line):
    """Split a table row on pipes that are not inside inline code."""
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    cells, cur, code = [], "", False
    for ch in line:
        if ch == "`":
            code = not code
        if ch == "|" and not code:
            cells.append(cur.strip())
            cur = ""
        else:
            cur += ch
    cells.append(cur.strip())
    return cells


def slugify(text):
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text).lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text).strip("-")
    return text or "section"


class Renderer:
    def __init__(self, images, src_images):
        self.images = images          # destination image names, filled in place
        self.src_images = src_images  # checkout's images/ directory
        self.ids = {}

    # -- links and images ------------------------------------------------
    def image_src(self, path):
        name = path.split("/")[-1]
        stem = name[:-4] if name.lower().endswith(".png") else name
        dark = f"{stem}-dark.png"
        if (self.src_images / dark).exists():
            name = dark
        self.images.add(name)
        return f"/assets/articles/{name}"

    def link_href(self, url):
        if url.startswith(("http://", "https://", "mailto:", "#")):
            return url
        if url.startswith("images/"):
            return self.image_src(url)
        if url.startswith(("diagrams/", "tools/")):
            return f"{ARTICLE_REPO}/blob/main/{url}"
        return url

    # -- inline ----------------------------------------------------------
    def inline(self, text):
        codes = []

        def stash(m):
            codes.append(f"<code>{e(m.group(1))}</code>")
            return f"\x00{len(codes) - 1}\x00"

        text = re.sub(r"`([^`]+)`", stash, text)
        text = html.escape(text, quote=False)

        def img(m):
            alt, src = m.group(1), m.group(2)
            return (f'<img src="{e(self.image_src(src))}" '
                    f'alt="{e(alt)}" loading="lazy" decoding="async" />')

        def link(m):
            label, href = m.group(1), m.group(2)
            return f'<a href="{e(self.link_href(href))}">{label}</a>'

        text = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", img, text)
        text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, text)
        text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
        text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
        for i, code in enumerate(codes):
            text = text.replace(f"\x00{i}\x00", code)
        return text

    # -- blocks ----------------------------------------------------------
    def heading(self, level, text):
        ident = slugify(text)
        if ident in self.ids:
            self.ids[ident] += 1
            ident = f"{ident}-{self.ids[ident]}"
        else:
            self.ids[ident] = 0
        tag = f"h{level}"
        return f'<{tag} id="{ident}">{self.inline(text)}</{tag}>'

    def table(self, lines):
        head = split_row(lines[0])
        body = [split_row(x) for x in lines[2:]]
        align = []
        for cell in split_row(lines[1]):
            cell = cell.strip()
            if cell.startswith(":") and cell.endswith(":"):
                align.append("center")
            elif cell.endswith(":"):
                align.append("right")
            elif cell.startswith(":"):
                align.append("left")
            else:
                align.append("")

        def row(cells, tag):
            out = []
            for i, cell in enumerate(cells):
                style = f' style="text-align: {align[i]}"' if i < len(align) and align[i] else ""
                out.append(f"<{tag}{style}>{self.inline(cell)}</{tag}>")
            return "<tr>" + "".join(out) + "</tr>"

        parts = ['<div class="table-wrap"><table>']
        if any(cell.strip() for cell in head):
            parts.append("<thead>" + row(head, "th") + "</thead>")
        parts.append("<tbody>" + "".join(row(cells, "td") for cells in body) + "</tbody>")
        parts.append("</table></div>")
        return "\n".join(parts)

    def list_block(self, lines):
        ordered = bool(re.match(r"^\s*\d+\.", lines[0]))
        items = []
        for raw in lines:
            m = LIST_ITEM.match(raw)
            if m:
                items.append(m.group(3).strip())
            elif items:
                items[-1] += " " + raw.strip()
        tag = "ol" if ordered else "ul"
        body = "\n".join(f"  <li>{self.inline(x)}</li>" for x in items)
        return f"<{tag}>\n{body}\n</{tag}>"

    def blocks(self, md):
        lines = md.splitlines()
        out = []
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            if not stripped:
                i += 1
                continue

            m = FENCE.match(line)
            if m:
                lang = m.group(1)
                i += 1
                code = []
                while i < len(lines) and not FENCE.match(lines[i]):
                    code.append(lines[i])
                    i += 1
                i += 1
                attr = f' data-lang="{e(lang)}"' if lang else ""
                out.append(f"<pre class=\"code-block\"{attr}><code>"
                           f"{e(chr(10).join(code))}</code></pre>")
                continue

            if stripped.startswith("<"):
                out.append(line)
                i += 1
                continue

            if stripped == "---":
                out.append("<hr />")
                i += 1
                continue

            m = HEADING.match(stripped)
            if m:
                out.append(self.heading(len(m.group(1)), m.group(2).strip()))
                i += 1
                continue

            if TABLE_ROW.match(line):
                rows = []
                while i < len(lines) and TABLE_ROW.match(lines[i]):
                    rows.append(lines[i])
                    i += 1
                out.append(self.table(rows))
                continue

            if stripped.startswith(">"):
                quote = []
                while i < len(lines) and lines[i].strip().startswith(">"):
                    quote.append(re.sub(r"^\s*>\s?", "", lines[i]))
                    i += 1
                out.append(f"<blockquote><p>{self.inline(' '.join(quote).strip())}</p></blockquote>")
                continue

            if LIST_ITEM.match(line):
                items = []
                while i < len(lines):
                    if LIST_ITEM.match(lines[i]) or (lines[i].strip() and lines[i].startswith(("  ", "\t"))):
                        items.append(lines[i])
                        i += 1
                    else:
                        break
                out.append(self.list_block(items))
                continue

            para = []
            while i < len(lines):
                nxt = lines[i]
                if not nxt.strip():
                    break
                if FENCE.match(nxt) or HEADING.match(nxt.strip()) or TABLE_ROW.match(nxt) \
                        or nxt.strip().startswith((">", "<")) or nxt.strip() == "---" \
                        or LIST_ITEM.match(nxt):
                    break
                para.append(nxt.strip())
                i += 1
            text = " ".join(para).strip()
            if text:
                if re.fullmatch(r"!\[[^\]]*\]\([^)]+\)", text):
                    out.append(self.inline(text))
                elif re.fullmatch(r"\*[^*].*\*", text):
                    out.append(f'<p class="fig-caption">{self.inline(text[1:-1])}</p>')
                else:
                    out.append(f"<p>{self.inline(text)}</p>")

        return "\n\n".join(out)


# --------------------------------------------------------------- page shell

NAV_ITEMS = [("Articles", "/articles/"), ("Home", "/"),
             ("GitHub", "https://github.com/mariobgsp")]


def nav(active="articles"):
    out = []
    for label, href in NAV_ITEMS:
        ext = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
        cls = ' class="active"' if href == "/articles/" and active else ""
        out.append(f'<li><a href="{e(href)}"{cls}{ext}>{e(label)}</a></li>')
    return "\n          ".join(out)


def nav_menu():
    out = []
    for label, href in NAV_ITEMS:
        ext = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
        out.append(f'      <a href="{e(href)}"{ext}>{e(label)}</a>')
    return "\n".join(out)


def footer():
    return """<footer class="footer" id="contact">
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
            <h3>Articles</h3>
            <a href="/articles/">Every project, written up</a>
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


def shell(title, description, body, up=UP, article_css=False, canonical=None,
          og_type="article", body_class="", og_image="assets/og.png"):
    extra = f'\n    <link rel="stylesheet" href="{up}assets/article.css" />' if article_css else ""
    canonical_tag = f'\n    <link rel="canonical" href="{e(canonical)}" />' if canonical else ""
    og_url = f'\n    <meta property="og:url" content="{e(canonical)}" />' if canonical else ""
    image_url = f"{SITE}/{og_image.lstrip('/')}"
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>{e(title)}</title>
    <meta name="description" content="{e(description)}" />
    <meta name="author" content="Muhammad Ario Bagus Prakusa" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#0a0a0b" />{canonical_tag}
    <meta property="og:type" content="{e(og_type)}" />
    <meta property="og:site_name" content="mario.dev" />
    <meta property="og:locale" content="en" />{og_url}
    <meta property="og:title" content="{e(title)}" />
    <meta property="og:description" content="{e(description)}" />
    <meta property="og:image" content="{e(image_url)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="{e(title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="{e(title)}" />
    <meta name="twitter:description" content="{e(description)}" />
    <meta name="twitter:image" content="{e(image_url)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="{up}assets/theme.css" />{extra}
  </head>
  <body class="{e(body_class)}">
    <div class="progress-track" aria-hidden="true"><span id="progressBar"></span></div>

    <header class="topnav">
      <div class="topnav-inner">
        <a class="nav-logo" href="/">mario<span class="logo-dot">.</span>dev</a>
        <span class="nav-status"><span class="led led-green" aria-hidden="true"></span> Backend &amp; API engineer</span>
        <ul class="nav-links">
          {nav()}
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

    {footer()}

    <script src="{up}assets/site.js"></script>
  </body>
</html>
"""


# --------------------------------------------------------------- articles

def plain(text):
    """Markdown inline -> readable text, for cards and meta tags."""
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = text.replace("**", "").replace("*", "")
    return re.sub(r"\s+", " ", text).strip()


def find_facts(lines):
    """The metadata table that follows the standfirst."""
    start = None
    for i, line in enumerate(lines):
        if line.strip().startswith("|"):
            start = i
            break
    if start is None:
        return [], start
    rows = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        rows.append(lines[i])
        i += 1
    if len(rows) < 2:
        return [], i
    body = [split_row(r) for r in rows[2:]]
    facts = [(cells[0], cells[1] if len(cells) > 1 else "") for cells in body if cells and cells[0]]
    return facts, i


class Article:
    def __init__(self, src, slug, renderer_cls):
        self.slug = slug
        text = (src / f"{slug}.md").read_text(encoding="utf-8")
        lines = text.splitlines()

        title_at = next(i for i, line in enumerate(lines) if line.startswith("# "))
        self.title = lines[title_at][2:].strip()

        quote = []
        i = title_at + 1
        while i < len(lines) and not lines[i].strip().startswith(">"):
            i += 1
        while i < len(lines) and lines[i].strip().startswith(">"):
            quote.append(re.sub(r"^\s*>\s?", "", lines[i]))
            i += 1
        self.standfirst_md = " ".join(quote).strip()

        self.facts, after = find_facts(lines)

        self.images = set()
        renderer = renderer_cls(self.images, src / "images")
        self.renderer = renderer
        self.standfirst = renderer.inline(self.standfirst_md)
        self.body_md = "\n".join(lines[after:]).strip("\n")
        self.body = renderer.blocks(self.body_md)

        self.words = len([w for w in plain(re.sub(r"```.*?```", " ", self.body_md, flags=re.S)).split()
                          if any(c.isalnum() for c in w)])
        self.minutes = max(1, round(self.words / WORDS_PER_MINUTE))

        self.repo = next((href for label, value in self.facts
                          for href in [self._href(value)] if label == "Repository" and href), None)
        if not self.repo:
            self.repo = REPO_URL.format(slug)
        self.stack = next((value for label, value in self.facts if "Stack" in label), "")
        verified = next((value for label, value in self.facts if "Verified" in label), "")
        m = re.search(r"(\d{4})-(\d{2})-(\d{2})", verified)
        self.date_label = ""
        if m:
            try:
                published = date(*map(int, m.groups()))
                self.date_label = f"{published.day} {published.strftime('%B %Y')}"
            except ValueError:
                self.date_label = ""

    def _href(self, value):
        m = re.search(r'href="([^"]+)"', self.renderer.inline(value))
        return m.group(1) if m else None

    def fact_html(self, value):
        return self.renderer.inline(value)

    def first_image(self):
        for name in sorted(self.images):
            if "architecture" in name:
                return name
        return sorted(self.images)[0] if self.images else None


def article_page(article, index, total, all_articles):
    prev = all_articles[index - 2] if index > 1 else None
    nxt = all_articles[index] if index < total else None

    sections = []
    current = []
    current_id = None
    for block in article.body.split("\n\n"):
        m = re.match(r'<h2 id="([^"]+)">', block)
        if m:
            if current:
                sections.append((current_id, "\n\n".join(current)))
            current, current_id = [block], m.group(1)
        else:
            current.append(block)
    if current:
        sections.append((current_id, "\n\n".join(current)))

    body_sections = "\n".join(
        f'''      <section class="art-block" id="{e(ident or f"part-{i + 1}")}">
        <div class="container">
          <article class="art-content">
{re.sub(r'<h2 id="[^"]+">', '<h2>', text, count=1) if ident else text}
          </article>
        </div>
      </section>''' for i, (ident, text) in enumerate(sections))

    facts = "\n".join(
        f'''            <div class="art-fact">
              <dt>{e(plain(label))}</dt>
              <dd>{article.fact_html(value)}</dd>
            </div>''' for label, value in article.facts)

    prev_html = (f'<a class="art-next-link" href="/articles/{e(prev.slug)}/">'
                 f'<span>Previous</span><b>{e(prev.slug)}</b></a>' if prev else '<span></span>')
    next_html = (f'<a class="art-next-link art-next-link--right" href="/articles/{e(nxt.slug)}/">'
                 f'<span>Next</span><b>{e(nxt.slug)}</b></a>' if nxt else '<span></span>')

    stack_plain = plain(article.stack)
    image = article.first_image()
    og_image = f"{SITE}/assets/articles/{image}" if image else None

    ld = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": article.title,
        "description": plain(article.standfirst_md),
        "url": f"{SITE}/articles/{article.slug}/",
        "mainEntityOfPage": f"{SITE}/articles/{article.slug}/",
        "author": {"@type": "Person", "name": "Muhammad Ario Bagus Prakusa",
                   "url": f"{SITE}/"},
        "keywords": stack_plain,
    }
    if og_image:
        ld["image"] = og_image

    body = f"""      <section class="art-hero anchor" id="top">
        <div class="container">
          <a class="crumb reveal" href="/articles/">&larr; All articles</a>
          <p class="kicker reveal"><b>[ {index:02d} / {total:02d} ]</b> {e(article.slug)}</p>
          <h1 class="art-title reveal">{e(article.title)}</h1>
          <p class="art-standfirst reveal">{article.standfirst}</p>
          <p class="art-byline reveal">
            <span>Muhammad Ario Bagus Prakusa</span>
            {f'<span>{e(article.date_label)}</span>' if article.date_label else ''}
            <span>~{article.minutes} min read</span>
          </p>
          <dl class="art-facts reveal">
{facts}
          </dl>
        </div>
      </section>

{body_sections}

      <nav class="art-next container" aria-label="More articles">
{prev_html}
        <a class="art-next-all" href="/articles/">All articles</a>
{next_html}
      </nav>

      <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}</script>"""

    return shell(article.title, plain(article.standfirst_md), body, up=DEEP,
                 article_css=True, canonical=f"{SITE}/articles/{article.slug}/",
                 body_class="art-page",
                 og_image=f"assets/articles/og-{article.slug}.png")


def card_spans(count):
    spans = ["span-7" if i % 2 == 0 else "span-5" for i in range(count)]
    if count % 2:
        spans[-1] = "span-12"
    return spans


def hub_page(articles):
    spans = card_spans(len(articles))
    cards = []
    for i, a in enumerate(articles, 1):
        image = a.first_image()
        thumb = (f'<img class="thumb" src="/assets/articles/{e(image)}" width="1200" '
                 f'height="630" loading="lazy" alt="" />') if image else ""
        cards.append(f"""            <article class="card {spans[i - 1]}">
              {thumb}
              <div class="card-head">
                <h3 class="card-name">{e(a.slug)}</h3>
                <span class="card-index">{i:02d}</span>
              </div>
              <p class="card-role">{e(a.title)}</p>
              <p class="card-desc">{e(plain(a.standfirst_md))}</p>
              <div class="meta-row"><span class="meta-label">Stack</span><span class="meta-value">{e(plain(a.stack))}</span></div>
              <div class="meta-row"><span class="meta-label">Read</span><span class="meta-value">~{a.minutes} min &middot; {len(a.images)} images</span></div>
              <div class="card-tools">
                <a class="btn btn-primary" href="/articles/{e(a.slug)}/">Read the article<span class="ext">&#8594;</span></a>
                <a class="btn btn-ghost" href="{e(a.repo)}" target="_blank" rel="noopener" aria-label="{e(a.slug)} repository on GitHub">Repository<span class="ext">&#8599;</span></a>
              </div>
            </article>""")

    ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Project articles",
        "itemListElement": [
            {"@type": "ListItem", "position": i,
             "item": {"@type": "TechArticle", "name": a.title,
                      "url": f"{SITE}/articles/{a.slug}/",
                      "description": plain(a.standfirst_md)}}
            for i, a in enumerate(articles, 1)
        ],
    }

    body = f"""      <section class="hero anchor" id="top">
        <div class="container">
          <div class="hero-inner">
            <p class="kicker reveal"><b>[ ARTICLES ]</b> {len(articles)} written from the running systems</p>
            <h1 class="hero-name reveal">Articles</h1>
            <p class="hero-title reveal">Backend &amp; API engineering &mdash; payments, gateways, market data</p>
            <p class="hero-sub reveal">
              Each project got one article: what it is, the problem it prevents, why the stack
              is what it is, how a request moves through it, what I measured, the defects I
              found by running it, and what I would fix next.
            </p>
            <div class="actions reveal">
              <a class="btn btn-primary" href="{ARTICLE_REPO}" target="_blank" rel="noopener">Articles on GitHub<span class="ext">&#8599;</span></a>
              <a class="btn btn-ghost" href="#articles">Browse the {len(articles)} articles<span class="ext">&#8595;</span></a>
            </div>
            <div class="stat-row reveal">
              <div class="stat"><b>{len(articles)}</b><span>Articles</span></div>
              <div class="stat"><b>{sum(len(a.images) for a in articles)}</b><span>Captured images</span></div>
              <div class="stat"><b>{sum(a.minutes for a in articles)} min</b><span>Total reading time</span></div>
              <div class="stat"><b>5+ yrs</b><span>Production backend</span></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section anchor reveal" id="articles">
        <div class="container">
          <p class="kicker"><b>[ 01 ]</b> THE ARTICLES</p>
          <div class="section-rule"></div>
          <h2 class="section-title">Pick one and read it end to end</h2>
          <p class="prose prose-lead">
            Every number is quoted from the repository or from a run I did myself. Where a
            repository publishes nothing, the article says that too.
          </p>

          <div class="card-grid stagger">
{chr(10).join(cards)}
          </div>
        </div>
      </section>

      <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}</script>

      <hr class="hairline" />"""

    return shell("Articles — Backend & API Engineering",
                 f"{len(articles)} backend engineering articles, each written from the "
                 "running system: architecture, measured facts and the defects found.",
                 body, up=UP, canonical=f"{SITE}/articles/",
                 og_image="assets/articles/og-index.png")


def home_index(articles):
    rows = "\n".join(
        f'''              <li>
                <a class="art-index-row" href="/articles/{e(a.slug)}/">
                  <span class="art-index-no">{i:02d}</span>
                  <span class="art-index-name">{e(a.slug)}</span>
                  <span class="art-index-lang">~{a.minutes} min</span>
                  <span class="art-index-go" aria-hidden="true">&#8594;</span>
                  <span class="art-index-strap">{e(a.title)}</span>
                </a>
              </li>''' for i, a in enumerate(articles, 1))
    return f"""        <ol class="art-index reveal">
{rows}
              <li class="art-index-more">
                <a class="art-index-all" href="/articles/">
                  <span>All {len(articles)} articles, page by page</span>
                  <span aria-hidden="true">&#8594;</span>
                </a>
              </li>
        </ol>"""


def splice_article(index_text, region):
    if index_text.count(ARTICLE_BEGIN) != 1 or index_text.count(ARTICLE_END) != 1:
        raise ValueError("index.html needs exactly one article:begin and one article:end marker")
    start = index_text.index(ARTICLE_BEGIN)
    end = index_text.index(ARTICLE_END, start) + len(ARTICLE_END)
    return index_text[:start] + region + index_text[end:], index_text[start:end]


# --------------------------------------------------------------------- main

def main():
    check = "--check" in sys.argv
    src = pathlib.Path(os.environ.get("ARTICLES_SRC", DEFAULT_SRC))
    if "--src" in sys.argv:
        src = pathlib.Path(sys.argv[sys.argv.index("--src") + 1])
    if not (src / "images").is_dir():
        print(f"CANNOT READ articles at {src} (run from the site repo, or pass --src)")
        return 1

    missing = [s for s in SLUGS if not (src / f"{s}.md").exists()]
    if missing:
        print("MISSING ARTICLE SOURCE:", ", ".join(missing))
        return 1

    articles = [Article(src, slug, Renderer) for slug in SLUGS]

    pages = {OUT / a.slug / "index.html": article_page(a, i, len(articles), articles)
             for i, a in enumerate(articles, 1)}
    pages[OUT / "index.html"] = hub_page(articles)

    region = f"{ARTICLE_BEGIN}\n{home_index(articles)}\n{ARTICLE_END}"
    try:
        index_text = INDEX.read_text(encoding="utf-8")
        new_index, current = splice_article(index_text, region)
    except (OSError, ValueError) as err:
        print(f"CANNOT PATCH {INDEX.name}: {err}")
        return 1

    needed = sorted({name for a in articles for name in a.images})
    missing_images = [n for n in needed if not (src / "images" / n).exists()]
    if missing_images:
        print("MISSING IMAGES:", ", ".join(missing_images))
        return 1

    stale_pages = [p for p, text in pages.items()
                   if not p.exists() or p.read_text(encoding="utf-8") != text]
    stale_images = [n for n in needed
                    if not (IMG_DST / n).exists()
                    or (IMG_DST / n).read_bytes() != (src / "images" / n).read_bytes()]

    if check:
        if not stale_pages and not stale_images and current == region:
            print(f"OK: {len(articles)} articles, {len(pages)} pages, "
                  f"{len(needed)} images match the sources")
            return 0
        for p in stale_pages:
            print(f"OUT OF DATE: {p.relative_to(ROOT)}")
        for n in stale_images:
            print(f"OUT OF DATE: assets/articles/{n}")
        if current != region:
            print("OUT OF DATE: index.html (article index region)")
        return 1

    written = []
    IMG_DST.mkdir(parents=True, exist_ok=True)
    for n in stale_images:
        shutil.copyfile(src / "images" / n, IMG_DST / n)
        written.append(f"assets/articles/{n}")
    try:
        existing = sorted(p.name for p in IMG_DST.iterdir())
    except OSError as err:
        print(f"CANNOT LIST {IMG_DST}: {err}")
        return 1
    for name in existing:
        if name not in needed and not name.startswith("og-"):
            (IMG_DST / name).unlink(missing_ok=True)
            written.append(f"removed assets/articles/{name}")
    for p in stale_pages:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(pages[p], encoding="utf-8")
        written.append(str(p.relative_to(ROOT)))
    if current != region:
        INDEX.write_text(new_index, encoding="utf-8")
        written.append("index.html")

    if not written:
        print("every generated file is already up to date")
        return 0
    print(f"wrote {len(written)} files:")
    for w in written:
        print("  ", w)
    return 0


if __name__ == "__main__":
    sys.exit(main())
