#!/usr/bin/env python3
"""Snapshot the GitHub contribution calendar into assets/data/contributions.json.

    python3 tools/fetch-contributions.py                 # mariobgsp, last 12 months
    python3 tools/fetch-contributions.py --user someone
    python3 tools/fetch-contributions.py --check         # is the snapshot fresh?

The snapshot is committed so the home page can draw its own graph without a
third-party image and without a runtime call: assets/contrib.js renders it, then
refreshes it live when the visitor's browser can reach the same source. Re-run
this after a long gap; the page keeps working either way.

The file is written with a temp file plus os.replace, so a failed fetch never
leaves a truncated snapshot behind.
"""
import argparse
import datetime as dt
import json
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "data" / "contributions.json"
API = "https://github-contributions-api.jogruber.de/v4/{user}?y=last"
USER_AGENT = "mariobgsp.github.io contribution snapshot"


def fetch(user):
    url = API.format(user=user)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def snapshot(payload, user):
    days = payload.get("contributions")
    if not isinstance(days, list) or not days:
        raise ValueError("payload has no contributions list")
    rows = []
    for day in days:
        date = day.get("date")
        count = day.get("count")
        level = day.get("level")
        if not isinstance(date, str) or not isinstance(count, int) or not isinstance(level, int):
            raise ValueError(f"unexpected day entry: {day!r}")
        rows.append([date, count, max(0, min(4, level))])
    rows.sort(key=lambda r: r[0])
    total = payload.get("total") or {}
    return {
        "user": user,
        "source": API.format(user=user),
        "updated": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "fields": ["date", "count", "level"],
        "total": {"lastYear": total.get("lastYear", sum(r[1] for r in rows))},
        "range": {"from": rows[0][0], "to": rows[-1][0]},
        "days": rows,
    }


def days_since(stamp):
    when = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    return (dt.datetime.now(dt.timezone.utc) - when).days


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--user", default="mariobgsp")
    parser.add_argument("--out", type=pathlib.Path, default=OUT)
    parser.add_argument("--check", action="store_true", help="report the age of the snapshot and exit")
    args = parser.parse_args(argv)

    if args.check:
        try:
            current = json.loads(args.out.read_text(encoding="utf-8"))
        except (OSError, ValueError) as err:
            print(f"NO SNAPSHOT at {args.out.relative_to(ROOT)}: {err}")
            return 1
        age = days_since(current["updated"])
        print(f"{args.out.relative_to(ROOT)}: {current['total']['lastYear']} contributions, "
              f"{len(current['days'])} days, updated {current['updated']} ({age} days ago)")
        return 0 if age < 30 else 1

    try:
        payload = fetch(args.user)
        data = snapshot(payload, args.user)
    except (urllib.error.URLError, ValueError, json.JSONDecodeError, TimeoutError) as err:
        print(f"CANNOT FETCH contributions for {args.user}: {err}")
        print("the committed snapshot is untouched")
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.out.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, separators=(",", ":"), sort_keys=False) + "\n", encoding="utf-8")
    tmp.replace(args.out)
    print(f"wrote {args.out.relative_to(ROOT)}: {len(data['days'])} days, "
          f"{data['total']['lastYear']} contributions, {data['range']['from']} to {data['range']['to']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
