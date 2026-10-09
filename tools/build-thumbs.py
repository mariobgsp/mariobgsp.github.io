#!/usr/bin/env python3
"""Render assets/thumbs/thumb-<slug>.png for every project in tools/projects.json.

One 1200x630 card per project: the same content the hand-made thumbnails carried
(eyebrow, project name, strapline, stack chips), restyled with assets/theme.css so
the thumbnails can never drift from the site identity.

    python3 tools/build-thumbs.py [slug ...]
"""
import html
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
THUMBS = ROOT / "assets" / "thumbs"
THEME = ROOT / "assets" / "theme.css"
W, H = 1200, 630
EYEBROW = "Portfolio / Backend + API"
# One accent per slot in projects.json order: violet, emerald, blue.
ACCENTS = ("--violet", "--emerald", "--blue")

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&family=Geist+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="{theme}">
<style>
  html, body {{ height: 100%; }}
  body {{ margin: 0; overflow: hidden; background: var(--bg); }}
  .card {{
    position: relative; width: {w}px; height: {h}px; overflow: hidden;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 60px 68px;
    background:
      radial-gradient(760px 520px at 88% -10%, color-mix(in srgb, var(--accent) 34%, transparent), transparent 70%),
      radial-gradient(620px 460px at -6% 108%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 72%),
      var(--bg);
  }}
  .grid {{
    position: absolute; inset: 0; pointer-events: none;
    background-image: linear-gradient(var(--line-soft) 1px, transparent 1px),
      linear-gradient(90deg, var(--line-soft) 1px, transparent 1px);
    background-size: 84px 84px;
    -webkit-mask-image: radial-gradient(120% 110% at 78% 8%, #000 10%, transparent 78%);
  }}
  .bezel {{
    position: absolute; inset: 18px; border-radius: var(--r-xl);
    box-shadow: inset 0 0 0 1px var(--line-soft);
    background: linear-gradient(180deg, var(--glass), transparent 46%);
  }}
  .row {{ position: relative; display: flex; align-items: baseline; justify-content: space-between; }}
  .eyebrow, .index, .stack-label {{
    font-family: var(--mono); font-size: 14px; letter-spacing: .2em;
    text-transform: uppercase; color: var(--ink-3);
  }}
  .index {{ color: color-mix(in srgb, var(--accent) 72%, var(--ink-2)); }}
  .name {{
    font-family: var(--sans); font-weight: 400; font-size: 78px; line-height: 1.02;
    letter-spacing: -.03em; color: var(--ink); margin: 0 0 20px;
  }}
  .strap {{
    font-family: var(--sans); font-weight: 300; font-size: 23px; line-height: 1.5;
    color: var(--ink-2); margin: 0; max-width: 760px;
  }}
  .chips {{ position: relative; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }}
  .chips span {{
    font-family: var(--mono); font-size: 15px; color: var(--ink-2);
    padding: 8px 16px; border-radius: var(--r-pill);
    background: var(--glass); box-shadow: inset 0 0 0 1px var(--line-soft);
  }}
</style></head>
<body><div class="card" style="--accent: var({accent})">
  <div class="grid"></div><div class="bezel"></div>
  <div class="row"><span class="eyebrow">{eyebrow}</span><span class="index">{index} / {total}</span></div>
  <div>
    <h1 class="name">{name}</h1>
    <p class="strap">{strapline}</p>
  </div>
  <div class="chips"><span class="stack-label">Stack</span>{chips}</div>
</div></body></html>
"""


def card(project, index, total):
    chips = "".join(f"<span>{html.escape(t)}</span>" for t in project["tags"][:4])
    return PAGE.format(
        theme=THEME.as_uri(),
        w=W,
        h=H,
        accent=ACCENTS[index % len(ACCENTS)],
        eyebrow=EYEBROW,
        index=f"{index + 1:02d}",
        total=f"{total:02d}",
        name=html.escape(project["name"]),
        strapline=html.escape(project["strapline"]),
        chips=chips,
    )


def render(project, index, total):
    with tempfile.TemporaryDirectory(prefix="thumb-") as tmp:
        src = pathlib.Path(tmp) / "card.html"
        src.write_text(card(project, index, total), encoding="utf-8")
        out = THUMBS / f"thumb-{project['slug']}.png"
        out.unlink(missing_ok=True)
        subprocess.run(
            [
                "chromium",
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--hide-scrollbars",
                "--force-color-profile=srgb",
                "--virtual-time-budget=8000",
                f"--window-size={W},{H}",
                f"--screenshot={out}",
                src.as_uri(),
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
    return out


def main(argv):
    try:
        projects = json.loads((ROOT / "tools" / "projects.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        print(f"cannot read tools/projects.json: {err}", file=sys.stderr)
        return 1
    wanted = set(argv)
    THUMBS.mkdir(parents=True, exist_ok=True)
    problems = []
    for i, p in enumerate(projects):
        if wanted and p["slug"] not in wanted:
            continue
        out = render(p, i, len(projects))
        if not out.exists() or out.stat().st_size < 4096:
            problems.append(f"{p['slug']}: render produced no image")
            print(f"FAIL {out.name}", file=sys.stderr)
        else:
            print(f"ok   {out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
