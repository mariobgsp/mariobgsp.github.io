# Working rules for this repo

## Branches

- Work on **`develop`**. It is the integration branch and every change lands there first.
- **Do not create feature branches.** No `feat/*`, `fix/*`, worktrees or topic branches — commit straight to `develop`.
- **`main` is the published branch** (GitHub Pages serves from it). Touch it only when the
  owner asks to sync: `git switch main && git merge --ff-only develop && git push origin main`.
- **Sync `develop` and `main` only when asked.** Until then `main` may sit behind `develop`;
  do not "helpfully" fast-forward it after every commit.
- Delete any branch that is neither `main` nor `develop`, local and remote, when you find one.

## Commits

- Conventional commits, imperative subject, lowercase after the type:
  `feat(home): …`, `fix(cert): …`, `content: …`, `chore(repo): …`, `docs: …`.
- One concern per commit. Say what changed and why in the body when the "why" is not obvious.

## Generated files

- `articles/*/index.html` and the `<!-- article:start -->` region of `index.html` are produced by
  `tools/build-articles.py`. Edit the generator or the article sources, never the output; run
  `python3 tools/build-articles.py` (source: sibling `../articles`, or `--src`) and check with
  `--check`. Its image cleanup keeps `assets/articles/og-*.png` on purpose.
