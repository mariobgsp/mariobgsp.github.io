/* ==========================================================================
   mariobgsp.dev - shared behaviour for every page
   Navigation, scroll progress, reveal-on-scroll, magnetic hover.
   Root index.html loads this first and then adds its own clock / terminal /
   GitHub feed on top; the generated pages stop here.
   ========================================================================== */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(pointer: fine)");
  var nav = document.querySelector(".topnav");
  var toggle = document.querySelector(".nav-hamburger");
  var links = document.querySelector(".nav-links");
  var bar = document.getElementById("progressBar");

  /* ------------------------------------------------------- preferences ---
     The MediaQueryList objects above always hold the current state; the
     listeners below let work that is already running - the field loop, a
     timeline, the pointer surfaces - react to an OS toggle live, with no
     reload and no stale state. */

  var motionListeners = [];

  function motionReduced() { return reduced.matches; }

  function onMotionChange(fn) { motionListeners.push(fn); }

  function bindPreference(mq, fn) {
    var handler = function () { fn(mq.matches); };
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  /* -------------------------------------------------------- dev harness ---
     ?t=<seconds>    freeze time-driven motion (field, timelines) there;
                     "end" lands the settled state
     ?scroll=<px|id> scroll to a position, for use in a real browser
     ?focus=<px|id>  shift the page instead of scrolling it, so a headless
                     capture of a below-the-fold section is not blank
     ?at=<id>        force the "you are here" state to a section without
                     scrolling, so the rail can be captured in any state
     ?hover=<sel>    pin one surface in its hovered state (pointer light,
                     tilt, lift) so it can be captured deterministically
     ?freeze=1       settle entrances and pause CSS animations
     All of them are inert when absent. */

  var HARNESS = { t: null, scroll: null, focus: null, at: null, hover: null, freeze: false };

  if (window.URLSearchParams) {
    try {
      var query = new URLSearchParams(window.location.search);
      var tParam = query.get("t");
      HARNESS.t = tParam === "end" ? Infinity : tParam === null ? null : parseFloat(tParam);
      HARNESS.scroll = query.get("scroll");
      HARNESS.focus = query.get("focus");
      HARNESS.at = query.get("at");
      HARNESS.hover = query.get("hover");
      HARNESS.freeze = query.get("freeze") === "1";
    } catch (err) { /* malformed query string: run without the harness */ }
  }

  /* Resolves <px|id> to an absolute document offset. */
  function harnessOffset(value) {
    if (!value) return null;
    if (/^\d+$/.test(value)) return Number(value);
    var el = document.getElementById(value.replace(/^#/, ""));
    if (!el) return null;
    return el.getBoundingClientRect().top + window.pageYOffset - 80;
  }

  /* --------------------------------------------------------- navigation --- */

  function closeMenu() {
    document.body.classList.remove("lock");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("lock");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  if (links) {
    links.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
  }

  document.addEventListener("click", function (event) {
    var menuLink = event.target.closest(".nav-menu a");
    if (menuLink) closeMenu();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 860) closeMenu();
  });

  var sections = [].slice.call(document.querySelectorAll("main section[id]"));

  /* One pass decides the active nav link, the channel rail, the nav indicator
     and the handoff between sections. `flow` is assigned further down, hence
     the guard: the first onScroll() call runs before it exists. */
  function markActive() {
    var probe = window.scrollY + 140;
    var i;

    if (links && sections.length) {
      var current = sections[0].id;
      for (i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= probe) current = sections[i].id;
      }

      var active = links.querySelector('a[href="#' + current + '"]');
      if (active) {
        [].slice.call(links.querySelectorAll("a")).forEach(function (link) {
          link.classList.toggle("active", link === active);
        });
        if (flow) flow.place(active);
      }
    }

    if (flow) flow.update(window.scrollY);
  }

  /* ------------------------------------------- scroll: progress + nav state --- */

  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var top = window.scrollY;
      if (bar) {
        var height = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = "scaleX(" + (height > 0 ? Math.min(top / height, 1) : 0) + ")";
      }
      if (nav) nav.classList.toggle("scrolled", top > 24);
      markActive();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* -------------------------------------------------------------- reveals --- */

  var revealables = document.querySelectorAll(".reveal, .stagger");

  function showAll() {
    [].slice.call(revealables).forEach(function (el) { el.classList.add("visible"); });
    [].slice.call(document.querySelectorAll("main section[id], footer[id]")).forEach(function (el) {
      el.classList.add("is-seen");
    });
  }

  if (reduced.matches || !("IntersectionObserver" in window)) {
    showAll();
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    [].slice.call(revealables).forEach(function (el) { observer.observe(el); });
  }

  bindPreference(reduced, function (isReduced) {
    /* A live switch to "reduce" must never leave content parked behind an
       entrance that will now never run. */
    if (isReduced) showAll();
    motionListeners.forEach(function (fn) { fn(isReduced); });
  });

  /* ---------------------------------------------------- pointer surfaces ---
     One rAF pass drives everything the pointer does to a surface:
       --mx/--my    magnetic offset (px)
       --spot-x/y   pointer light position (px, element-local)
       --spot-o     pointer light opacity
       --rx/--ry    tilt (deg, clamped by --tilt-max)
     The rect is cached on enter and refreshed on resize/scroll, so the move
     handler itself never reads layout. Disabled entirely for coarse pointers
     and for reduced motion. */

  (function surfaces() {
    var MAGNET = ".btn, .card, .project-card, .gh-panel, .plate, .spec-cluster, .exp-item";
    var TILT = ".card, .project-card, .spec-cluster";
    var held = null;
    var box = null;
    var point = { x: 0, y: 0 };
    var frame = 0;
    var tiltMax = 3.2;

    if (window.getComputedStyle) {
      var raw = getComputedStyle(document.documentElement).getPropertyValue("--tilt-max");
      var parsed = parseFloat(raw);
      if (!isNaN(parsed)) tiltMax = parsed;
    }

    function enabled() { return !reduced.matches && fine.matches; }

    function clear(el) {
      if (!el) return;
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
      el.style.removeProperty("--spot-x");
      el.style.removeProperty("--spot-y");
      el.style.removeProperty("--spot-o");
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    }

    function flush() {
      frame = 0;
      if (!held || !box || !box.width || !box.height) return;

      var x = point.x - box.left;
      var y = point.y - box.top;
      var dx = (x - box.width / 2) / (box.width / 2);
      var dy = (y - box.height / 2) / (box.height / 2);

      held.style.setProperty("--mx", (dx * 6).toFixed(2) + "px");
      held.style.setProperty("--my", (dy * 5).toFixed(2) + "px");
      held.style.setProperty("--spot-x", x.toFixed(1) + "px");
      held.style.setProperty("--spot-y", y.toFixed(1) + "px");
      held.style.setProperty("--spot-o", "1");

      if (held.matches(TILT)) {
        held.style.setProperty("--rx", (-dy * tiltMax).toFixed(3) + "deg");
        held.style.setProperty("--ry", (dx * tiltMax).toFixed(3) + "deg");
      }
    }

    function hold(el) {
      if (el === held) return;
      clear(held);
      held = el;
      box = el ? el.getBoundingClientRect() : null;
    }

    function refresh() {
      if (held) box = held.getBoundingClientRect();
    }

    document.addEventListener("pointermove", function (event) {
      if (!enabled()) { hold(null); return; }
      var el = event.target.closest ? event.target.closest(MAGNET) : null;
      if (el !== held) hold(el);
      if (!held) return;
      point.x = event.clientX;
      point.y = event.clientY;
      if (!frame) frame = requestAnimationFrame(flush);
    }, { passive: true });

    document.addEventListener("pointerout", function (event) {
      if (!held) return;
      var to = event.relatedTarget;
      /* moving between children of the same surface is not a leave */
      if (to && to.closest && to.closest(MAGNET) === held) return;
      if (event.target.closest && event.target.closest(MAGNET) === held) hold(null);
    }, { passive: true });

    window.addEventListener("resize", refresh, { passive: true });
    window.addEventListener("scroll", refresh, { passive: true });

    onMotionChange(function () { if (!enabled()) hold(null); });
  })();

  /* ------------------------------------------------------------ hero intro ---
     Powers the bench on. Delays are written once as --d in document order and
     the timeline itself lives in theme.css, so the harness can freeze any
     instant of it. The hidden state is armed synchronously (before first
     paint, no flash), then released once the web font has settled - never
     later than 350ms, so the hero can never sit blank. Nothing is split in
     the DOM and nothing needs undoing: without JS the hero is already final. */

  (function initHeroIntro() {
    var hero = document.querySelector(".hero");
    if (!hero) return;

    var root = document.documentElement;
    var SEQ = ".crumb, .kicker, .hero-name, .hero-title, .hero-sub, .hero-method, " +
              ".cmd-wrap, .stat-row, .actions, .tags, .hero-side, .hc-rows li, " +
              ".hc-status, .scroll-cue";
    var STEP = 55;
    var CAP = 500;

    var items = [].slice.call(hero.querySelectorAll(SEQ));
    items.forEach(function (el, i) {
      el.style.setProperty("--d", Math.min(i * STEP, CAP) + "ms");
    });

    if (HARNESS.t !== null) {
      var frozen = isFinite(HARNESS.t) ? Math.max(0, HARNESS.t) * 1000 : 99000;
      root.style.setProperty("--t0", frozen + "ms");
      root.setAttribute("data-freeze", "1");
    }

    if (motionReduced()) return;

    root.classList.add("hero-intro");

    var started = false;

    function start() {
      if (started) return;
      started = true;
      root.classList.add("hero-ready");
    }

    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { requestAnimationFrame(start); });
    }

    setTimeout(start, 350);

    onMotionChange(function (isReduced) {
      if (!isReduced) return;
      /* Land the sequence instead of leaving the hero parked mid-flight. */
      root.classList.remove("hero-intro");
      root.classList.add("hero-ready");
    });
  })();

  /* --------------------------------------------------------------- field ---
     The measured field: a curl-noise flow raster with linked neighbours and
     one slow raster sweep, drawn on a canvas between .bg-mesh and .bg-grid.

     It reads the same tokens as the rest of the sheet, so the false colour
     ramp cannot drift from the identity: cold indigo -> violet -> magenta ->
     amber. A particle's position on the ramp is its own speed, so the warm
     end means "moving fast" rather than "decorated warm".

     Cost controls: devicePixelRatio capped at 2, dt clamped, neighbour links
     found through a uniform grid (O(n), not O(n^2)), no canvas shadows, loops
     paused when the tab is hidden, and a single static frame - never a loop -
     when the reader asks for reduced motion. */

  (function field() {
    var canvas = document.createElement("canvas");
    canvas.className = "bg-field";
    canvas.setAttribute("aria-hidden", "true");

    var ctx = canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) return null;

    var mesh = document.querySelector(".bg-mesh");
    if (mesh && mesh.parentNode) mesh.parentNode.insertBefore(canvas, mesh.nextSibling);
    else document.body.insertBefore(canvas, document.body.firstChild);

    var scrim = document.createElement("div");
    scrim.className = "bg-scrim";
    scrim.setAttribute("aria-hidden", "true");
    canvas.parentNode.insertBefore(scrim, canvas.nextSibling);

    var LINK = 132;        // px, neighbour link distance
    var PERIOD = 18;       // s, the driving field breathes and returns
    var SWEEP = 12;        // s, raster sweep period
    var SCALE = 0.0017;    // noise scale, px -> field units
    var MAX_POINTS = 120;
    var FALLBACK = [[59, 77, 143], [167, 139, 250], [244, 114, 182], [245, 165, 36]];

    var stops = FALLBACK;
    var pts = [];
    var W = 0;
    var H = 0;
    var dpr = 1;
    var time = 0;
    var raf = 0;
    var running = false;
    var last = 0;
    var pointer = { x: -1e4, y: -1e4, active: false };

    /* ------------------------------------------------------------ colour --- */

    function parseColor(value) {
      var hex = String(value || "").trim().replace("#", "");
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      if (hex.length !== 6) return null;
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }

    if (window.getComputedStyle) {
      var cs = getComputedStyle(document.documentElement);
      var read = ["--t-cold", "--t-mid", "--t-warm", "--t-hot"].map(function (name) {
        return parseColor(cs.getPropertyValue(name));
      });
      if (read.every(function (c) { return c; })) stops = read;
    }

    function ramp(t) {
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var span = stops.length - 1;
      var scaled = t * span;
      var i = Math.min(span - 1, Math.floor(scaled));
      var f = scaled - i;
      var a = stops[i];
      var b = stops[i + 1];
      return [
        Math.round(a[0] + (b[0] - a[0]) * f),
        Math.round(a[1] + (b[1] - a[1]) * f),
        Math.round(a[2] + (b[2] - a[2]) * f)
      ];
    }

    function rgba(c, alpha) {
      return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + alpha.toFixed(3) + ")";
    }

    /* ------------------------------------------------------------- noise --- */

    function hash2(x, y) {
      var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    }

    function noise2(x, y) {
      var xi = Math.floor(x);
      var yi = Math.floor(y);
      var xf = x - xi;
      var yf = y - yi;
      var u = xf * xf * (3 - 2 * xf);
      var v = yf * yf * (3 - 2 * yf);
      var a = hash2(xi, yi);
      var b = hash2(xi + 1, yi);
      var c = hash2(xi, yi + 1);
      var d = hash2(xi + 1, yi + 1);
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }

    /* Divergence-free curl of a noise potential: no sources or sinks, so the
       particles flow instead of piling up. */
    function curl(x, y) {
      var e = 0.0015;
      var n1 = noise2(x, y + e);
      var n2 = noise2(x, y - e);
      var n3 = noise2(x + e, y);
      var n4 = noise2(x - e, y);
      return [(n1 - n2) / (2 * e), -(n3 - n4) / (2 * e)];
    }

    /* -------------------------------------------------------------- setup --- */

    function mulberry32(a) {
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function seed() {
      var target = Math.round(W * H / 11000);
      target = Math.max(32, Math.min(MAX_POINTS, target));
      if (H > W * 1.4) target = Math.min(target, 48);
      var rnd = mulberry32(20260409);
      pts = [];
      for (var i = 0; i < target; i++) {
        pts.push({
          id: i,
          x: rnd() * W,
          y: rnd() * H,
          vx: 0,
          vy: 0,
          speed: 0.35 + rnd() * 0.8,
          size: 1 + rnd() * 1.4,
          heat: rnd() * 0.5
        });
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      last = 0;
      seed();
      draw(time);
    }

    /* ---------------------------------------------------------------- sim --- */

    function step(dt, t) {
      var breath = Math.cos((t % PERIOD) / PERIOD * Math.PI * 2) * 0.7;
      var k = Math.min(1, dt * 2.2);

      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var c = curl(p.x * SCALE + breath, p.y * SCALE - breath);
        var mag = Math.sqrt(c[0] * c[0] + c[1] * c[1]) || 1;
        var speed = 9 + p.speed * 15;

        p.vx += ((c[0] / mag) * speed - p.vx) * k;
        p.vy += ((c[1] / mag) * speed - p.vy) * k;

        if (pointer.active) {
          var dx = p.x - pointer.x;
          var dy = p.y - pointer.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < 26000 && d2 > 1) {
            var f = (1 - d2 / 26000) * 900 * dt;
            var d = Math.sqrt(d2);
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -60) p.x = W + 60;
        else if (p.x > W + 60) p.x = -60;
        if (p.y < -60) p.y = H + 60;
        else if (p.y > H + 60) p.y = -60;

        /* heat is kinetic: the ramp reads the motion, not a decoration */
        var v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        p.heat += (Math.min(1, v / 26) - p.heat) * Math.min(1, dt * 1.6);
      }
    }

    /* -------------------------------------------------------------- paint --- */

    function draw(t) {
      ctx.clearRect(0, 0, W, H);

      /* the raster sweep sits under the particles */
      var sx = ((t % SWEEP) / SWEEP) * (W + 260) - 130;
      var band = ctx.createLinearGradient(sx - 110, 0, sx + 110, 0);
      band.addColorStop(0, "rgba(167, 139, 250, 0)");
      band.addColorStop(0.6, "rgba(167, 139, 250, 0.065)");
      band.addColorStop(1, "rgba(167, 139, 250, 0)");
      ctx.fillStyle = band;
      ctx.fillRect(sx - 110, 0, 220, H);
      ctx.fillStyle = "rgba(167, 139, 250, 0.09)";
      ctx.fillRect(sx + 21, 0, 1, H);

      var grid = {};
      var i;
      var j;
      var p;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        var key = ((p.x / LINK) | 0) + "_" + ((p.y / LINK) | 0);
        if (grid[key]) grid[key].push(p);
        else grid[key] = [p];
      }

      ctx.lineWidth = 1;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        var cx = (p.x / LINK) | 0;
        var cy = (p.y / LINK) | 0;
        for (var oy = -1; oy <= 1; oy++) {
          for (var ox = -1; ox <= 1; ox++) {
            var bucket = grid[cx + ox + "_" + (cy + oy)];
            if (!bucket) continue;
            for (j = 0; j < bucket.length; j++) {
              var q = bucket[j];
              if (q.id <= p.id) continue;          /* each pair once */
              var dx = p.x - q.x;
              var dy = p.y - q.y;
              var d = Math.sqrt(dx * dx + dy * dy);
              if (d >= LINK) continue;
              ctx.strokeStyle = rgba(ramp((p.heat + q.heat) / 2), (1 - d / LINK) * 0.22);
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          }
        }
      }

      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        ctx.fillStyle = rgba(ramp(p.heat), 0.34 + p.heat * 0.36);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (dt <= 0) return;
      time += dt;
      step(dt, time);
      draw(time);
    }

    function start() {
      if (running || motionReduced() || !pts.length) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    /* One deterministic frame: fixed 60Hz stepping, then a single draw. */
    function still(t) {
      var dt = 1 / 60;
      for (var s = 0; s < t; s += dt) step(dt, s);
      time = t;
      draw(t);
    }

    /* ---------------------------------------------------------- lifecycle --- */

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeTimer = 0;
        resize();
        if (!running) draw(time);
      }, 150);
    }, { passive: true });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });

    document.addEventListener("pointermove", function (event) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    }, { passive: true });

    document.addEventListener("pointerleave", function () { pointer.active = false; }, { passive: true });

    onMotionChange(function () {
      if (motionReduced()) {
        stop();
        still(7);
      } else {
        start();
      }
    });

    resize();

    if (HARNESS.t !== null) {
      stop();
      still(isFinite(HARNESS.t) ? Math.max(0, HARNESS.t) : 12);
    } else if (motionReduced()) {
      still(7);
    } else {
      start();
    }
  })();

  /* ---------------------------------------------------------- section flow ---
     Everything that tracks where the reader is: the channel rail, the sliding
     nav indicator, the axis draw, the settling of measured values and the
     scan sweep on an anchor jump. All of it is driven by the scroll pass that
     already existed (onScroll -> markActive); no second scroll listener. */

  var flow = (function () {
    var railSections = [].slice.call(
      document.querySelectorAll("main section[id], footer[id]")
    );
    if (!railSections.length) return null;

    var rail = null;
    var fill = null;
    var pill = null;
    var ticks = [];

    function labelFor(section, index) {
      if (section.id === "top") return "Top";

      var node = section.querySelector(".fig-label") || section.querySelector(".kicker");
      var text = node ? node.textContent : "";
      text = String(text).replace(/[[\]]/g, " ").replace(/\s+/g, " ").trim();
      text = text.replace(/^\d{1,2}\s+/, "");

      if (!text) {
        var heading = section.querySelector(".section-title, h2");
        text = heading ? heading.textContent.trim() : section.id;
        text = text.charAt(0).toUpperCase() + text.slice(1);
      }
      if (!text) text = "Channel " + (index + 1);

      return text.length > 32 ? text.slice(0, 31) + "\u2026" : text;
    }

    /* The rail uses the sheet's own figure number ("01 About", "[ 05 ] NUMBERS")
       so a tick and the label printed above the section can never disagree. The
       cover has no figure number, so it reads as a dash. */
    function numberFor(section, index) {
      if (section.id === "top") return "\u2014";

      var node = section.querySelector(".fig-label") || section.querySelector(".kicker");
      var match = /^\[?\s*(\d{1,2})\s*\]?(?!\d)/.exec(node ? node.textContent.trim() : "");
      if (match) return match[1].length === 1 ? "0" + match[1] : match[1];

      return String(index + 1).padStart(2, "0");
    }

    function buildRail() {
      rail = document.createElement("nav");
      rail.className = "sec-rail";
      rail.setAttribute("aria-label", "Sections");

      fill = document.createElement("span");
      fill.className = "sec-rail__fill";
      fill.setAttribute("aria-hidden", "true");
      rail.appendChild(fill);

      ticks = railSections.map(function (section, index) {
        var tick = document.createElement("a");
        tick.className = "sec-rail__tick";
        tick.href = "#" + section.id;
        tick.setAttribute("data-target", section.id);

        var idx = document.createElement("span");
        idx.className = "sec-rail__idx";
        idx.textContent = numberFor(section, index);

        var label = document.createElement("span");
        label.className = "sec-rail__label";
        label.textContent = labelFor(section, index);

        tick.appendChild(idx);
        tick.appendChild(label);
        rail.appendChild(tick);
        return tick;
      });

      document.body.appendChild(rail);
    }

    function buildPill() {
      if (!links) return;
      var active = links.querySelector("a.active") || links.querySelector("a");
      if (!active) return;

      pill = document.createElement("span");
      pill.className = "nav-pill";
      pill.setAttribute("aria-hidden", "true");
      links.insertBefore(pill, links.firstChild);
      place(active);
    }

    function place(link) {
      if (!pill || !link) return;
      pill.style.setProperty("--pill-x", link.offsetLeft + "px");
      pill.style.setProperty("--pill-w", link.offsetWidth + "px");
      pill.style.setProperty("--pill-o", "1");
    }

    function update(top) {
      var probe = top + 150;
      var index = 0;
      var i;

      for (i = 0; i < railSections.length; i++) {
        if (railSections[i].offsetTop <= probe) index = i;
      }

      for (i = 0; i < ticks.length; i++) {
        ticks[i].classList.toggle("is-active", i === index);
      }

      if (fill) {
        var first = railSections[0].offsetTop;
        var last = railSections[railSections.length - 1].offsetTop;
        var span = Math.max(1, last - first);
        var progress = Math.max(0, Math.min(1, (probe - first) / span));
        fill.style.setProperty("--rail-p", progress.toFixed(3));
      }

      for (i = 0; i < railSections.length; i++) {
        var state = i === index ? "is-current" : i < index ? "is-past" : "is-next";
        if (railSections[i].getAttribute("data-flow") !== state) {
          railSections[i].setAttribute("data-flow", state);
        }
      }
    }

    /* The axis draws and the measured values settle when a section first
       comes into view - not when it becomes "current", so a rule is never
       missing above a title that is already on screen. */
    function watch() {
      if (!("IntersectionObserver" in window) || motionReduced()) {
        railSections.forEach(function (section) { section.classList.add("is-seen"); });
        return;
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-seen");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.04, rootMargin: "0px 0px -6% 0px" });

      railSections.forEach(function (section) { observer.observe(section); });
    }

    /* The scan sweep echoes the field's raster: a hairline crosses the target
       section once, then removes itself. */
    function sweep(id) {
      if (motionReduced()) return;
      var target = document.getElementById(id);
      if (!target || target.tagName === "MAIN") return;

      var line = document.createElement("span");
      line.className = "scan-line";
      line.setAttribute("aria-hidden", "true");
      line.style.setProperty("--scan-h", Math.round(target.offsetHeight) + "px");
      target.appendChild(line);

      window.setTimeout(function () {
        if (line.parentNode) line.parentNode.removeChild(line);
      }, 1500);
    }

    document.addEventListener("click", function (event) {
      var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
      if (!link) return;
      var id = (link.getAttribute("href") || "").slice(1);
      if (id) sweep(id);
    });

    buildRail();
    buildPill();
    watch();

    return { update: update, place: place, sweep: sweep };
  })();

  if (flow) onScroll();

  /* -------------------------------------------------------- harness scroll ---
     Land on a section before capture: ?scroll=<px|id>. "instant" rather than
     "auto", because auto defers to the CSS scroll-behavior - which is smooth
     here - and a screenshot would catch the scroll mid-flight. Adding
     ?freeze=1 also settles every entrance, so the capture does not depend on
     observer timing. */

  if (HARNESS.scroll) {
    var jumpTo = harnessOffset(HARNESS.scroll);

    /* Applied after load and one frame: jumping before the first paint leaves
       a headless capture blank, and this is also the honest moment to land. */
    var jump = function () {
      if (jumpTo !== null) window.scrollTo({ top: jumpTo, left: 0, behavior: "instant" });

      if (HARNESS.freeze) {
        document.documentElement.setAttribute("data-freeze", "1");
        showAll();
      }

      /* Leaves a breadcrumb for --dump-dom so a capture can be traced. */
      document.documentElement.setAttribute(
        "data-harness",
        HARNESS.scroll + "@" + Math.round(window.pageYOffset) +
        "/" + Math.round(document.documentElement.scrollHeight)
      );
    };

    if (document.readyState === "complete") requestAnimationFrame(jump);
    else window.addEventListener("load", function () { requestAnimationFrame(jump); });
  }

  /* --------------------------------------------------------- harness focus ---
     Verification path: instead of scrolling (which headless captures render
     blank), shift <main> up so the target section sits in the painting
     viewport while the fixed chrome keeps its real position. */

  if (HARNESS.focus) {
    var focusY = harnessOffset(HARNESS.focus);
    var mainEl = document.querySelector("main");

    if (focusY !== null && mainEl) {
      mainEl.style.transform = "translate3d(0," + (-focusY) + "px,0)";
      if (HARNESS.freeze) {
        document.documentElement.setAttribute("data-freeze", "1");
        showAll();
      }
      document.documentElement.setAttribute("data-harness", "focus:" + HARNESS.focus + "@" + focusY);
    }
  }

  /* ---------------------------------------------------------- harness at ---
     Forces the "you are here" state to a section without scrolling - last,
     and after load, because shifting <main> changes the document height and
     the resulting scroll event would otherwise reset the state to the top. */

  if (HARNESS.at) {
    var forceAt = function () {
      var el = document.getElementById(HARNESS.at.replace(/^#/, ""));
      if (el && flow) flow.update(el.offsetTop - 150);
    };

    if (document.readyState === "complete") requestAnimationFrame(forceAt);
    else window.addEventListener("load", function () { requestAnimationFrame(forceAt); });
  }

  /* ------------------------------------------------------- harness hover ---
     Pins the pointer state on one surface: the light, the tilt and the lift
     the pointer loop would have written, so the effect can be captured. */

  if (HARNESS.hover) {
    var hoverEl = null;
    try { hoverEl = document.querySelector(HARNESS.hover); } catch (err) { hoverEl = null; }

    if (hoverEl) {
      var box = hoverEl.getBoundingClientRect();
      hoverEl.style.setProperty("--spot-x", Math.round(box.width * 0.34) + "px");
      hoverEl.style.setProperty("--spot-y", Math.round(box.height * 0.3) + "px");
      hoverEl.style.setProperty("--spot-o", "1");
      hoverEl.style.setProperty("--rx", "2.4deg");
      hoverEl.style.setProperty("--ry", "-2.6deg");
      hoverEl.style.setProperty("--lift", "-6px");
    }
  }
})();
