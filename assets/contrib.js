/* The home page's GitHub contribution panel.
 *
 * assets/data/contributions.json is a committed snapshot, so the graph draws on
 * the first paint, works offline and needs no third-party image. When that
 * snapshot is older than a week the panel asks the same source for a fresh copy
 * once per session and re-renders only if the answer arrives; a failure leaves
 * the snapshot exactly where it is. Nothing here is required for the page to
 * read, and the article above it never depends on this file. */
(function () {
  "use strict";

  var USER = "mariobgsp";
  var SNAPSHOT = "assets/data/contributions.json";
  var LIVE = "https://github-contributions-api.jogruber.de/v4/" + USER + "?y=last";
  var REFRESH_AFTER_DAYS = 7;
  var SESSION_KEY = "gh-contrib-refresh";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var grid = document.getElementById("ghGrid");
  if (!grid) return;

  var months = document.getElementById("ghMonths");
  var scroll = document.getElementById("ghScroll");
  var legend = document.getElementById("ghLegend");
  var totalEl = document.getElementById("ghTotal");
  var noteEl = document.getElementById("ghNote");
  var streakEl = document.getElementById("ghStreak");
  var longestEl = document.getElementById("ghLongest");
  var bestEl = document.getElementById("ghBest");

  function day(value) {
    return new Date(value + "T00:00:00Z");
  }

  function label(iso) {
    var d = day(iso);
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  function plural(count) {
    return count === 1 ? " day" : " days";
  }

  /* Both the committed snapshot and the live answer describe the same thing in
     different shapes; normalise returns the same object for either. */
  function normalise(payload) {
    var rows = payload && payload.contributions ? payload.contributions : payload && payload.days;
    if (!rows || !rows.length) return null;
    var days = rows.map(function (row) {
      if (row && typeof row === "object" && row.date) {
        return { date: row.date, count: row.count, level: row.level };
      }
      return { date: row[0], count: row[1], level: row[2] };
    });
    var sum = 0;
    for (var i = 0; i < days.length; i++) sum += days[i].count;
    return {
      updated: payload.updated || null,
      total: payload.total && typeof payload.total.lastYear === "number" ? payload.total.lastYear : sum,
      days: days
    };
  }

  function measure(days) {
    var total = 0, longest = 0, run = 0, best = days[0], i, d;
    for (i = 0; i < days.length; i++) {
      d = days[i];
      total += d.count;
      run = d.count > 0 ? run + 1 : 0;
      if (run > longest) longest = run;
      if (d.count > best.count) best = d;
    }
    var end = days.length - 1;
    if (days[end].count === 0) end -= 1; /* today may simply not have landed yet */
    var current = 0;
    for (i = end; i >= 0 && days[i].count > 0; i--) current += 1;
    return { total: total, longest: longest, current: current, best: best };
  }

  function cell(entry) {
    var span = document.createElement("span");
    span.className = "gh-cell lvl-" + Math.max(0, Math.min(4, entry.level || 0));
    span.title = entry.count + (entry.count === 1 ? " contribution on " : " contributions on ") + label(entry.date);
    return span;
  }

  function render(data, live) {
    var days = data.days;
    var seen = measure(days);
    var pad = day(days[0].date).getUTCDay(); /* the grid's seven rows are Sun..Sat */
    var weeks = Math.ceil((pad + days.length) / 7);
    var i, w, blank, node;

    grid.replaceChildren();
    months.replaceChildren();

    for (i = 0; i < pad; i++) {
      blank = document.createElement("span");
      blank.className = "gh-cell is-empty";
      grid.appendChild(blank);
    }
    for (i = 0; i < days.length; i++) grid.appendChild(cell(days[i]));

    var lastMonth = -1;
    for (w = 0; w < weeks; w++) {
      node = document.createElement("span");
      var index = Math.max(0, w * 7 - pad);
      var columnDate = day(days[index].date);
      if (columnDate.getUTCMonth() !== lastMonth) {
        node.textContent = MONTHS[columnDate.getUTCMonth()];
        lastMonth = columnDate.getUTCMonth();
      }
      months.appendChild(node);
    }

    totalEl.textContent = seen.total.toLocaleString("en-US") + " contributions in the last year";
    streakEl.textContent = seen.current + plural(seen.current);
    longestEl.textContent = seen.longest + plural(seen.longest);
    bestEl.textContent = seen.best.count ? seen.best.count + " on " + label(seen.best.date) : "\u2014";
    noteEl.textContent = live ? "Refreshed live" : data.updated ? "Snapshot " + label(data.updated.slice(0, 10)) : "Last 12 months";
    scroll.hidden = false;
    legend.hidden = false;
  }

  function unavailable() {
    var link = document.createElement("a");
    link.href = "https://github.com/" + USER;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Contribution graph on GitHub";
    totalEl.replaceChildren(link);
    [streakEl, longestEl, bestEl].forEach(function (el) {
      el.parentElement.hidden = true;
    });
    noteEl.textContent = "Graph unavailable";
  }

  function get(url) {
    return fetch(url, { headers: { Accept: "application/json" } }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }

  function refreshIfStale(data) {
    if (!data.updated) return;
    var age = (Date.now() - new Date(data.updated).getTime()) / 86400000;
    if (age < REFRESH_AFTER_DAYS) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (err) {
      /* storage blocked: one refresh attempt per page load is still fine */
    }
    get(LIVE).then(function (payload) {
      var fresh = normalise(payload);
      if (fresh) render(fresh, true);
    }).catch(function () {
      /* unreachable or rate-limited: the snapshot stays on screen */
    });
  }

  get(SNAPSHOT).then(function (payload) {
    var data = normalise(payload);
    if (!data) throw new Error("snapshot has no days");
    render(data, false);
    refreshIfStale(data);
  }).catch(unavailable);
})();
