/* ==========================================================================
   mariobgsp.dev - shared behaviour for every page
   Navigation, scroll progress, reveal-on-scroll, magnetic hover, two ambient
   canvases - the pointer-blind ordered-dither field and the pointer trail -
   and the animated cursor.
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
     ?t=<seconds>    freeze time-driven motion (field, trail, timelines)
                     there; "end" lands the settled state
     ?scroll=<px|id> scroll to a position, for use in a real browser
     ?focus=<px|id>  shift the page instead of scrolling it, so a headless
                     capture of a below-the-fold section is not blank
     ?at=<id>        force the "you are here" state to a section without
                     scrolling, so the rail can be captured in any state
     ?hover=<sel>    pin one surface in its hovered state (ring, lift) and
                      park the cursor on it, so it can be captured
     ?cursor=<x>,<y> park the cursor at viewport coordinates, transitions off
     ?cursorstate=hover|down
                      force one cursor state without a real pointer
     ?click=1        draw one click ripple, frozen mid-animation
     ?fps=1          after 120 frames publish the field and trail frame
                      rates as data-field-fps / data-trail-fps on <html>, and
                      the live trail particle count as data-trail-count on
                      every frame, for a headless --dump-dom
     ?freeze=1       settle entrances and pause CSS animations
     All of them are inert when absent. */

  var HARNESS = { t: null, scroll: null, focus: null, at: null, hover: null, freeze: false,
                  cursor: null, cursorState: null, click: false, fps: false };

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

      var cParam = query.get("cursor");
      if (cParam) {
        var cParts = cParam.split(",");
        var cX = parseFloat(cParts[0]);
        var cY = parseFloat(cParts[1]);
        if (isFinite(cX) && isFinite(cY)) HARNESS.cursor = { x: cX, y: cY };
      }
      HARNESS.cursorState = query.get("cursorstate");
      HARNESS.click = query.get("click") === "1";
      HARNESS.fps = query.get("fps") === "1";
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

  /* --------------------------------------------------------- point motion ---
     Three small helpers every page shares, all of them additive markup-wise:
     splitWords      wraps a heading words in mask spans for the word rise
     indexStaggers   writes --i on every .stagger child, for the capped delay
     countUp         runs a figure from 0 to its own honest value, never past it */

  function splitWords(el) {
    if (!el || el.getAttribute("data-words") !== null) return;
    if (el.children.length) return;
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;

    var frag = document.createDocumentFragment();
    text.split(" ").forEach(function (word, i) {
      if (i) frag.appendChild(document.createTextNode(" "));
      var w = document.createElement("span");
      w.className = "w";
      w.style.setProperty("--wi", String(i));
      var inner = document.createElement("span");
      inner.className = "w-in";
      inner.textContent = word;
      w.appendChild(inner);
      frag.appendChild(w);
    });

    el.textContent = "";
    el.appendChild(frag);
    el.setAttribute("data-words", "1");
  }

  function indexStaggers() {
    [].slice.call(document.querySelectorAll(".stagger")).forEach(function (list) {
      [].slice.call(list.children).forEach(function (child, i) {
        child.style.setProperty("--i", String(i));
      });
    });
  }

  var FIGURES = ".spec-value, .runs-fig, .stat b";

  function countUp(el) {
    var raw = (el.textContent || "").trim();
    if (!/^\d+(?:[.,]\d+)?\s*[%+]?$/.test(raw)) return;

    var suffix = raw.replace(/^[\d.,\s]+/, "");
    var numText = raw.replace(/[%+\s]+$/, "");
    var num = parseFloat(numText.replace(/,/g, ""));
    if (!isFinite(num) || num === 0) return;

    var decimals = numText.indexOf(".") > -1 ? numText.length - numText.indexOf(".") - 1 : 0;
    var dur = 900;
    var start = null;

    el.classList.add("counting");
    requestAnimationFrame(function step(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (num * eased).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.classList.remove("counting");
    });
  }

  function countFigures(scope) {
    if (reduced.matches || HARNESS.freeze || HARNESS.t !== null) return;
    if (scope.matches && scope.matches(FIGURES)) countUp(scope);
    [].slice.call(scope.querySelectorAll(FIGURES)).forEach(countUp);
  }

  /* Article pages wire their reading column at runtime, so the generated
     markup never carries a behaviour class: each section and its heading join
     the reveal set, the column becomes a stagger list, and every plain h2
     joins the word rise - a heading with inline code or emphasis keeps its
     markup unmasked. */

  (function wireArticle() {
    if (!document.body.classList.contains("art-page")) return;

    [].slice.call(document.querySelectorAll(".art-block")).forEach(function (block) {
      block.classList.add("reveal");
      [].slice.call(block.querySelectorAll(".art-content > h2")).forEach(function (h2) {
        splitWords(h2);
        h2.classList.add("reveal");
      });
      var content = block.querySelector(".art-content");
      if (content) content.classList.add("stagger");
    });
  })();

  /* Section titles split into words on every page: the spans carry the
     word-rise mask, and a no-JS reader keeps the plain text. */
  [].slice.call(document.querySelectorAll(".section-title")).forEach(splitWords);

  /* -------------------------------------------------------------- reveals --- */

  indexStaggers();
  var revealables = document.querySelectorAll(".reveal, .stagger");

  function showAll() {
    indexStaggers();
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
     One rAF pass drives the only thing the pointer does to a surface:
       --mx/--my    magnetic offset (px)
     The rect is cached on enter and refreshed on resize/scroll, so the move
     handler itself never reads layout. Disabled entirely for coarse pointers
     and for reduced motion. */

  (function surfaces() {
    var MAGNET = ".btn, .card, .gh-panel, .plate, .spec-cluster, .exp-item";
    var held = null;
    var box = null;
    var point = { x: 0, y: 0 };
    var frame = 0;

    function enabled() { return !reduced.matches && fine.matches; }

    function clear(el) {
      if (!el) return;
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
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

  /* ----------------------------------------------------------- the cursor ---
     A trailing ring and a dot. The follow loop writes translate on the two
     wrappers only; scale and colour live in CSS, so the state animation and
     the follow can never fight over the same transform. Fine pointers only,
     and never under reduced motion - the native cursor stays in charge there
     and is restored if the reader flips the preference mid-session. */

  var cursor = (function () {
    var HOVER = "a, button, [role='button'], summary, input, textarea, .btn, .card, " +
                ".plate, .exp-item, .spec-cluster, .gh-panel, .tag, " +
                ".faq-q, .widget-toggle, .flow-step-btn, .copy-cmd, .checklist-head, " +
                ".sec-rail__tick";

    var root = null;
    var ring = null;
    var dot = null;
    var target = { x: -100, y: -100 };
    var pos = { x: -100, y: -100 };
    var raf = 0;
    var running = false;
    var frameQueued = false;

    function frame() {
      raf = requestAnimationFrame(frame);
      pos.x += (target.x - pos.x) * 0.18;
      pos.y += (target.y - pos.y) * 0.18;
      ring.style.transform = "translate3d(" + pos.x.toFixed(2) + "px," + pos.y.toFixed(2) + "px,0)";
      dot.style.transform = "translate3d(" + target.x.toFixed(2) + "px," + target.y.toFixed(2) + "px,0)";
    }

    function start() {
      if (running || !root) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function place(x, y) {
      target.x = pos.x = x;
      target.y = pos.y = y;
      if (!root) return;
      var at = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0)";
      ring.style.transform = at;
      dot.style.transform = at;
    }

    function pulse(x, y, still) {
      var p = document.createElement("span");
      p.className = "cursor__pulse" + (still ? " is-still" : "");
      p.setAttribute("aria-hidden", "true");
      p.style.transform = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0)";
      document.body.appendChild(p);
      if (still) return;

      var gone = false;
      function remove() {
        if (gone) return;
        gone = true;
        if (p.parentNode) p.parentNode.removeChild(p);
      }
      p.addEventListener("animationend", remove);
      window.setTimeout(remove, 700);
    }

    function onMove(event) {
      target.x = event.clientX;
      target.y = event.clientY;
      if (frameQueued) return;
      frameQueued = true;
      requestAnimationFrame(function () {
        frameQueued = false;
        if (root) root.classList.remove("is-hidden");
      });
    }

    function onOver(event) {
      if (!root || !event.target.closest) return;
      if (event.target.closest(HOVER)) root.classList.add("is-hover");
    }

    function onOut(event) {
      if (!root || !event.target.closest) return;
      var to = event.relatedTarget;
      if (to && to.closest && to.closest(HOVER)) return;
      if (event.target.closest(HOVER)) root.classList.remove("is-hover");
    }

    function onDown(event) {
      if (!root) return;
      root.classList.add("is-down");
      target.x = event.clientX;
      target.y = event.clientY;
    }

    function onUp(event) {
      if (!root) return;
      root.classList.remove("is-down");
      pulse(event.clientX, event.clientY, false);
    }

    function onHide() { if (root) root.classList.add("is-hidden"); }
    function onShow() { if (root) root.classList.remove("is-hidden"); }

    function destroy() {
      stop();
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onHide);
      document.removeEventListener("pointerenter", onShow);
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = ring = dot = null;
      document.documentElement.classList.remove("has-cursor");
    }

    /* A fine pointer is the real gate; the harness may force the cursor on so a
       headless capture (which reports no fine pointer) can still show it. */
    function wanted() {
      return fine.matches || HARNESS.cursor !== null || HARNESS.cursorState !== null ||
             HARNESS.click || HARNESS.hover !== null;
    }

    function init() {
      if (root || !wanted() || reduced.matches) return;

      root = document.createElement("div");
      root.className = "cursor";
      root.setAttribute("aria-hidden", "true");
      ring = document.createElement("span");
      ring.className = "cursor__ring";
      dot = document.createElement("span");
      dot.className = "cursor__dot";
      root.appendChild(ring);
      root.appendChild(dot);
      document.body.appendChild(root);
      document.documentElement.classList.add("has-cursor");

      document.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerover", onOver, { passive: true });
      document.addEventListener("pointerout", onOut, { passive: true });
      document.addEventListener("pointerdown", onDown, { passive: true });
      document.addEventListener("pointerup", onUp, { passive: true });
      document.addEventListener("pointerleave", onHide, { passive: true });
      document.addEventListener("pointerenter", onShow, { passive: true });

      place(target.x, target.y);
      start();
    }

    /* Harness: park the pointer state so a capture is a state, not a moment. */
    function park() {
      if (!root) return;
      if (HARNESS.cursor || HARNESS.cursorState || HARNESS.click) {
        root.classList.add("is-static");
        stop();
      }
      if (HARNESS.cursorState === "hover") root.classList.add("is-hover");
      if (HARNESS.cursorState === "down") root.classList.add("is-down");

      if (HARNESS.cursor || HARNESS.click) {
        var x = HARNESS.cursor ? HARNESS.cursor.x : Math.round(window.innerWidth * 0.5);
        var y = HARNESS.cursor ? HARNESS.cursor.y : Math.round(window.innerHeight * 0.5);
        place(x, y);
        if (HARNESS.click) pulse(x, y, true);
      }
    }

    init();
    park();

    bindPreference(fine, function () { destroy(); init(); park(); });
    onMotionChange(function () { destroy(); init(); park(); });

    return {
      place: place,
      pulse: pulse,
      state: function (name) { if (root) root.classList.add(name); }
    };
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
    var SEQ = ".crumb, .kicker, .hero-name, .hero-title, .hero-sub, " +
              ".cmd-wrap, .stat-row, .actions, .tags, .scroll-cue";
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

  /* ---------------------------------------------------------- pixel field ---
     The ambient layer: an animated ordered-dither field. One canvas pixel is
     one on-screen cell, and CSS scales the backing store up with
     image-rendering: pixelated, so the cells stay hard-edged at any size.
     Each frame writes one preallocated ImageData - no per-cell fillRect, no
     allocation, no sin() and no noise in the loop.

     The field is deliberately pointer-blind: nothing the reader does with the
     pointer reaches it, so it is a texture and never a control. It breathes on
     its own instead - three static noise layers are sampled with a slowly
     moving offset and cross-faded, so cells boil between organic shapes
     without the dither sliding as a stripe. A cell lights when its value
     crosses its Bayer 8x8 threshold, and lit cells are two flat white tiers.

     Cost controls: fixed cell count from --pixel-pitch, typed arrays, flat
     per-cell sampling arrays built once per resize, a 512 entry sine LUT, one
     putImageData per frame, no canvas shadows, no gradients, loop paused while
     the tab is hidden, and a single static frame - never a loop - when the
     reader asks for reduced motion. */

  (function pixelField() {
    var canvas = document.createElement("canvas");
    canvas.className = "bg-pixels";
    canvas.setAttribute("aria-hidden", "true");

    var ctx = canvas.getContext ? canvas.getContext("2d") : null;
    if (!ctx) return;

    document.body.insertBefore(canvas, document.body.firstChild);

    /* Bayer 8x8, the classic ordered-dither matrix. */
    var BAYER = [
      0, 32, 8, 40, 2, 34, 10, 42,
      48, 16, 56, 24, 50, 18, 58, 26,
      12, 44, 4, 36, 14, 46, 6, 38,
      60, 28, 52, 20, 62, 30, 54, 22,
      3, 35, 11, 43, 1, 33, 9, 41,
      51, 19, 59, 27, 49, 17, 57, 25,
      15, 47, 7, 39, 13, 45, 5, 37,
      63, 31, 55, 23, 61, 29, 53, 21
    ];

    var SIN = new Float32Array(512);
    for (var s = 0; s < 512; s++) SIN[s] = Math.sin(s / 512 * Math.PI * 2);

    /* Degree-512 index for a period in seconds; the LUT holds one full turn so
       a period shorter than 1/512s would alias, which these never do. */
    function turn(seconds) { return 512 / Math.max(0.05, seconds); }

    var W = 0, H = 0, CW = 0, CH = 0;
    var img = null;
    var baseA = null;   /* static value-noise per cell, fine grain */
    var baseB = null;   /* static value-noise per cell, coarse grain */
    var baseC = null;   /* static value-noise per cell, broad veil */
    var thr = null;     /* Bayer threshold per cell */
    var diag = null;    /* x + y per cell, for the wavefront band */
    var dotMask = null; /* 1 on the sparse lattice points */
    var dotPhase = null;/* deterministic phase per lattice point */
    var pitch = 8;
    var driftA = 16;    /* layer periods in seconds, from --pixel-drift* */
    var driftB = 6;
    var WAVE_PERIOD = 9;  /* seconds between wavefront sweeps */
    var WAVE_BAND = 22;   /* half-width of the band, in cells */
    var DOT_GAP = 13;     /* lattice spacing, in cells (odd, avoids moiré) */
    var DOT_PERIOD = 7;   /* seconds per lattice pulse */
    var time = 0;
    var raf = 0;
    var running = false;
    var last = 0;
    var frames = 0;
    var fpsStart = 0;

    if (window.getComputedStyle) {
      var cs = getComputedStyle(document.documentElement);
      var parsedPitch = parseFloat(cs.getPropertyValue("--pixel-pitch"));
      if (parsedPitch > 1) pitch = parsedPitch;
      var parsedA = parseFloat(cs.getPropertyValue("--pixel-drift"));
      if (parsedA > 0.5) driftA = parsedA;
      var parsedB = parseFloat(cs.getPropertyValue("--pixel-drift-b"));
      if (parsedB > 0.5) driftB = parsedB;
    }

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

    /* The noise itself never changes, only where it is sampled. Each layer is
       a deterministic tile, so a resize rebuilds nothing and a pan costs a
       float add per cell. 512 cells square covers every viewport this sheet is
       meant for, at any pitch. */
    var GRID = 512;
    var GRID_MASK = GRID - 1;
    var layers = {};

    function noiseGrid(scale, ox, oy) {
      var key = scale + "|" + ox + "|" + oy;
      if (layers[key]) return layers[key];
      var g = new Float32Array(GRID * GRID);
      for (var y = 0; y < GRID; y++) {
        var row = y * GRID;
        for (var x = 0; x < GRID; x++) {
          g[row + x] = noise2((x + ox) * scale, (y + oy) * scale);
        }
      }
      layers[key] = g;
      return g;
    }

    var gridA = null, gridB = null, gridC = null;

    /* Everything time-invariant is computed once per resize, never per frame:
       the per-cell sample arrays are plain offsets into the tiles, so even a
       re-pitch or a resize only updates the Bayer threshold and the mapping. */
    function build() {
      CW = Math.max(2, Math.ceil(W / pitch));
      CH = Math.max(2, Math.ceil(H / pitch));
      canvas.width = CW;
      canvas.height = CH;

      if (!gridA) {
        gridA = noiseGrid(0.085, 0, 0);
        gridB = noiseGrid(0.13, 40, -25);
        gridC = noiseGrid(0.031, -17, 9);
      }

      img = ctx.createImageData(CW, CH);
      var n = CW * CH;
      baseA = new Float32Array(n);
      baseB = new Float32Array(n);
      baseC = new Float32Array(n);
      thr = new Float32Array(n);
      diag = new Float32Array(n);
      dotMask = new Uint8Array(n);
      dotPhase = new Float32Array(n);

      for (var y = 0; y < CH; y++) {
        for (var x = 0; x < CW; x++) {
          var i = y * CW + x;
          baseA[i] = gridA[((y & GRID_MASK) << 9) | (x & GRID_MASK)];
          baseB[i] = gridB[((y & GRID_MASK) << 9) | (x & GRID_MASK)];
          baseC[i] = gridC[((y & GRID_MASK) << 9) | (x & GRID_MASK)];
          thr[i] = BAYER[(y & 7) * 8 + (x & 7)] / 64;
          diag[i] = x + y;

          /* The dot lattice: every DOT_GAP cells in both axes, phased by a
             hash so neighbouring points never pulse in step. */
          if (x % DOT_GAP === 0 && y % DOT_GAP === 0) {
            dotMask[i] = 1;
            dotPhase[i] = Math.floor(hash2(x, y) * 512);
          }
        }
      }

      last = 0;
    }

    function resize() {
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      build();
      draw(time);
    }

    function draw(t) {
      if (!img) return;

      var data = img.data;
      var n = CW * CH;
      var k = 0;

      /* One weight and one veil for the whole sheet, two LUT reads: everything
         that used to be per-cell trig is now per-frame. */
      var morph = 0.5 + 0.5 * SIN[Math.round(t * turn(driftA)) & 511];
      var veil = SIN[Math.round(t * turn(driftB)) & 511] * 0.19 + 0.19;

      /* The livelier layers, both flat per-cell fills: a wavefront band that
         crosses the sheet on a diagonal every WAVE_PERIOD seconds, and the
         lattice points pulsing on their own phases. Both skip entirely when
         the reader asked for reduced motion, and both freeze honestly under
         the ?t= harness because they read the same t as the dither. */
      var live = !motionReduced();
      var wavePos = -WAVE_BAND - 1;
      var dotTurn = 0;
      if (live) {
        var travel = CW + CH + WAVE_BAND * 2;
        wavePos = ((t / WAVE_PERIOD) % 1) * travel - WAVE_BAND;
        dotTurn = t * turn(DOT_PERIOD);
      }

      for (var i = 0; i < n; i++) {
        /* Lattice points paint over the dither: they are the field's own
           instruments, so they never hide under its noise. */
        if (live && dotMask[i]) {
          var pulse = 0.5 + 0.5 * SIN[(Math.round(dotPhase[i] + dotTurn)) & 511];
          data[k] = 167;
          data[k + 1] = 139;
          data[k + 2] = 250;
          data[k + 3] = Math.round((0.07 + 0.13 * pulse) * 255);
          k += 4;
          continue;
        }

        var v = baseA[i] + (baseB[i] - baseA[i]) * morph + baseC[i] * veil;
        var edge = thr[i];

        if (v <= edge) {
          data[k + 3] = 0;                    /* unlit: transparent, solid --bg shows */
          k += 4;
          continue;
        }

        var d = v - edge;
        var a = d > 0.34 ? 0.10 : 0.055;
        var r = 245, g = 245, bch = 247;

        /* The band lifts lit cells it crosses toward the violet accent, with
           a linear falloff, and lights cells just under their threshold so
           the front edge of the sweep reads as a moving line. */
        if (live) {
          var dist = diag[i] - wavePos;
          if (dist < 0) dist = -dist;
          if (dist < WAVE_BAND) {
            var boost = 1 - dist / WAVE_BAND;
            a += (0.20 - a) * boost;
            r += (167 - r) * boost;
            g += (139 - g) * boost;
            bch += (250 - bch) * boost;
          }
        }

        data[k] = Math.round(r);
        data[k + 1] = Math.round(g);
        data[k + 2] = Math.round(bch);
        data[k + 3] = Math.round(a * 255);
        k += 4;
      }

      ctx.putImageData(img, 0, 0);
    }

    function still(t) { time = t; draw(t); }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (dt <= 0) return;
      time += dt;

      if (HARNESS.fps && frames < 121) {
        if (frames === 0) fpsStart = now;
        frames++;
        if (frames === 120) {
          document.documentElement.setAttribute(
            "data-field-fps",
            (119000 / Math.max(1, now - fpsStart)).toFixed(1)
          );
        }
      }

      draw(time);
    }

    function start() {
      if (running || motionReduced() || !img) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    var resizeTimer = 0;
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeTimer = 0;
        resize();
      }, 150);
    }

    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    onMotionChange(function () {
      if (motionReduced()) {
        stop();
        still(0);
      } else {
        start();
      }
    });

    resize();

    if (HARNESS.t !== null) {
      stop();
      still(isFinite(HARNESS.t) ? Math.max(0, HARNESS.t) : 12);
    } else if (motionReduced()) {
      still(0);
    } else {
      start();
    }
  })();

  /* ---------------------------------------------------------- pixel trail ---
     The pointer's own layer, and the only thing on the sheet the pointer
     drives. It is deliberately not the field: the field is ambient texture,
     this is the event - particles seeded along the path the pointer travels,
     so the pointer draws a comet instead of lighting up a grid.

     One more canvas, stacked after the field, inert to the pointer, bounded
     everywhere. A fixed pool of particles lives in typed arrays; a sprite
     atlas is baked once at startup (3 colour families x 3 age buckets), so a
     frame is one drawImage per particle and never an allocation. Spawning is
     distance-driven rather than time-driven, so the line is the same length
     for the same gesture at any refresh rate, and a flick emits a stretched
     streak instead of a row of dots.

     Cost controls: fixed pool from --trail-max, baked sprites, one rAF, no
     shadow or gradient work per particle, device pixel ratio capped at 2, the
     loop starts on the first move and stops by itself once the pool is empty,
     and it is never created at all for a coarse pointer or reduced motion. */

  (function pixelTrail() {
    var root = document.createElement("canvas");
    root.className = "bg-trail";
    root.setAttribute("aria-hidden", "true");

    var ctx = root.getContext ? root.getContext("2d") : null;
    if (!ctx) return;

    var field = document.querySelector(".bg-pixels");
    document.body.insertBefore(root, field ? field.nextSibling : document.body.firstChild);

    /* Fixed tar pit: a click burst and 200 moves in the same second must not be
       able to allocate anything, so every particle is a slot and the oldest is
       simply overwritten. */
    var MAX = 240;
    var CELL = 8;
    var lifetime = 0.9;
    var density = 1;
    var alphaCap = 0.9;
    var FAMILY = [[167, 139, 250], [110, 231, 183], [245, 245, 247]];

    var px = new Float32Array(MAX);
    var py = new Float32Array(MAX);
    var vx = new Float32Array(MAX);
    var vy = new Float32Array(MAX);
    var age = new Float32Array(MAX);
    var life = new Float32Array(MAX);
    var size = new Float32Array(MAX);
    var fam = new Uint8Array(MAX);
    var live = 0;                        /* slots in use, oldest first */
    var emitAcc = 0;
    var glowAt = 0;
    var lastX = null;
    var lastY = null;
    var lastT = 0;
    var pointerIn = false;
    var hovering = false;
    var seeded = false;                  /* harness warm-up owns the RNG */
    var frozen = false;
    var rngState = 0x9e3779b9;

    var W = 0, H = 0, raf = 0, running = false, frames = 0, fpsStart = 0, lastFrame = 0;
    var painted = false;                 /* is there anything on the trail canvas? */

    if (window.getComputedStyle) {
      var cs = getComputedStyle(document.documentElement);
      var parsedCell = parseFloat(cs.getPropertyValue("--trail-cell"));
      if (parsedCell > 1) CELL = parsedCell;
      var parsedMax = parseFloat(cs.getPropertyValue("--trail-max"));
      if (parsedMax >= 8) MAX = Math.min(600, Math.round(parsedMax));
      var parsedLife = parseFloat(cs.getPropertyValue("--trail-life"));
      if (parsedLife > 50) lifetime = parsedLife / 1000;
      var parsedDensity = parseFloat(cs.getPropertyValue("--trail-density"));
      if (parsedDensity > 0.05) density = parsedDensity;
      var parsedAlpha = parseFloat(cs.getPropertyValue("--trail-alpha"));
      if (parsedAlpha > 0.05) alphaCap = Math.min(1, parsedAlpha);
      FAMILY = readFamilies(cs);
    }

    function readFamilies(cs) {
      var out = [];
      for (var i = 0; i < 3; i++) {
        var name = i === 0 ? "--trail-violet" : i === 1 ? "--trail-emerald" : "--trail-white";
        var raw = (cs.getPropertyValue(name) || "").trim().split(/\s+/);
        var r = parseInt(raw[0], 10);
        var g = parseInt(raw[1], 10);
        var b = parseInt(raw[2], 10);
        out.push(isFinite(r) && isFinite(g) && isFinite(b) ? [r, g, b] : [255, 255, 255]);
      }
      return out;
    }

    /* Harness warm-up needs to be reproducible frame to frame, so the seeded
       path is the only user of this generator; live motion keeps Math.random
       jitter so the trail never looks rehearsed. */
    function rand() {
      if (!seeded) return Math.random();
      rngState = (rngState + 0x6d2b79f5) | 0;
      var t = rngState;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    var atlas = null;
    var AT = 64;
    var ATLAS_ROW = 3;

    /* Baked once: three colour families, each in three age buckets, so draw
       time is a plain blit. Buckets are soft, mid and tight core - the whole
       reason the trail reads as a spark and not as a blurred dot. */
    function bake() {
      atlas = document.createElement("canvas");
      atlas.width = AT * ATLAS_ROW;
      atlas.height = AT * ATLAS_ROW;
      var c = atlas.getContext("2d");
      if (!c) return;

      /* Gradient coordinates are absolute to the canvas, not to the fill, so
         each cell is painted in its own translated frame. Getting this wrong
         silently leaves eight of the nine cells empty - and the one cell the
         trail happens to sample first hides it. */
      for (var f = 0; f < 3; f++) {
        var rgb = FAMILY[f];
        for (var col = 0; col < 3; col++) {
          var inner = col === 0 ? 0.30 : col === 1 ? 0.52 : 0.74;
          var mid = inner + 0.22;

          c.save();
          c.translate(col * AT, f * AT);
          var g = c.createRadialGradient(AT / 2, AT / 2, AT * 0.04, AT / 2, AT / 2, AT / 2);
          g.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.95)");
          g.addColorStop(inner, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.75)");
          g.addColorStop(mid, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.22)");
          g.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0)");
          c.fillStyle = g;
          c.beginPath();
          c.arc(AT / 2, AT / 2, AT / 2, 0, Math.PI * 2);
          c.fill();
          c.restore();
        }
      }
    }

    function spawn(x, y, dvx, dvy, speed, energy) {
      var i = live % MAX;                 /* overwrite the oldest ring slot */
      if (live < MAX) live++;

      var jitter = 0.45 + rand();
      px[i] = x;
      py[i] = y;
      vx[i] = dvx * 0.30 + (rand() - 0.5) * 26 * jitter;
      vy[i] = dvy * 0.30 + (rand() - 0.5) * 26 * jitter - (6 + rand() * 16);
      age[i] = 0;
      life[i] = lifetime * (0.7 + rand() * 0.6);
      size[i] = CELL * (0.85 + Math.min(1.35, speed / 1400)) * (0.7 + rand() * 0.6) * energy;
      fam[i] = rand() < 0.08 ? 2 : rand() < 0.16 ? 1 : 0;
    }

    function burst(x, y) {
      var count = 16;
      for (var i = 0; i < count; i++) {
        var ang = (i / count) * Math.PI * 2 + rand() * 0.4;
        var spd = 90 + rand() * 200;
        spawn(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd, 0, 1.5);
      }
    }

    /* Called from the pointer path only. d is the distance the pointer moved
       since the last seed, so the emitter is a function of the gesture and not
       of the frame rate. */
    function emit(x, y, d, dx, dy, speed) {
      emitAcc += d;
      var lineScale = clamp(1.25 - speed / 2400, 0.35, 1.25);
      var step = Math.max(2.5, 6 / Math.max(0.05, density) * lineScale);
      var budget = 0;

      while (emitAcc >= step && budget < 12) {
        emitAcc -= step;
        var t = rand();                   /* rand() is Math.random unless the harness seeded it */
        spawn(x + dx * (t - 1) * 0.5, y + dy * (t - 1) * 0.5, dx, dy, speed, 1);
        budget++;
      }
      if (emitAcc > step * 12) emitAcc = 0;
    }

    function resize() {
      W = root.clientWidth || window.innerWidth;
      H = root.clientHeight || window.innerHeight;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      root.width = Math.max(1, Math.round(W * dpr));
      root.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* Re-sizing a canvas resets its bitmap, so a frozen trail has to be
         painted back or a late resize would erase the captured state. */
      if (frozen && live) draw();
    }

    function clear() {
      live = 0;
      emitAcc = 0;
      painted = false;
      ctx.clearRect(0, 0, W, H);
    }

    function draw() {
      if (HARNESS.fps) document.documentElement.setAttribute("data-trail-count", String(live));
      /* The sheet is only cleared once there is nothing left to erase: while it
         is idle the layer costs one attribute write per frame and no paint. */
      if (!live) {
        if (painted) { ctx.clearRect(0, 0, W, H); painted = false; }
        return;
      }
      ctx.clearRect(0, 0, W, H);
      painted = true;

      var i;
      for (i = live - 1; i >= 0; i--) {
        age[i] += dtLast;
        if (age[i] >= life[i]) {
          var top = --live;
          if (i !== top) {                /* swap-remove; order is not read */
            px[i] = px[top]; py[i] = py[top];
            vx[i] = vx[top]; vy[i] = vy[top];
            age[i] = age[top]; life[i] = life[top];
            size[i] = size[top]; fam[i] = fam[top];
          }
        }
      }

      for (i = 0; i < live; i++) {
        var a = 1 - age[i] / life[i];
        var fade = a * a;
        var speed = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
        var stretch = 1 + Math.min(2.4, speed / 220);
        var angle = Math.atan2(vy[i], vx[i]);
        var bucket = a > 0.66 ? 2 : a > 0.33 ? 1 : 0;
        var sx = bucket * AT;
        var sy = fam[i] * AT;
        var alphaIv = clamp(fade * 1.15, 0, 1) * alphaCap * 0.34;

        ctx.save();
        ctx.translate(px[i], py[i]);
        ctx.rotate(angle);
        ctx.scale(stretch, 1 / Math.sqrt(stretch));
        ctx.globalAlpha = alphaIv;
        ctx.drawImage(atlas, sx, sy, AT, AT, -size[i], -size[i], size[i] * 2, size[i] * 2);
        ctx.restore();
      }
    }

    /* One integration step, shared by the loop and the harness warm-up, so a
       warmed frame and a live frame are the same simulation. */
    var dtLast = 1 / 60;

    function step(dt, x, y, isHovering) {
      if (live) {
        var drag = Math.pow(0.88, dt * 60);   /* one pow per frame, not per particle */
        for (var i = 0; i < live; i++) {
          vx[i] *= drag;
          vy[i] = vy[i] * drag + 42 * dt;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
        }
      }

      if (x === null || y === null) return;
      if (lastX !== null) {
        var dx = x - lastX;
        var dy = y - lastY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var speed = dist / Math.max(dt, 1 / 240);
        if (dist > 0.6) emit(x, y, dist, dx, dy, speed);
      }
      lastX = x;
      lastY = y;
      lastT += dt;

      /* Without a gesture the pointer still has a presence: a soft glow emits
         one wisp every ~600ms while it is inside the window. */
      if (pointerIn && lastT >= glowAt + 0.6) {
        glowAt += 0.6;
        spawn(x + (rand() - 0.5) * 10, y + (rand() - 0.5) * 10, 0, -10, 0, 0.55);
      }

      if (isHovering) {
        var head = live - 1;
        if (head >= 0 && fam[head] === 0 && rand() < 0.3) fam[head] = 1;
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 1 / 30) : 1 / 60;
      lastFrame = now;
      dtLast = dt;

      if (frames < 121 && HARNESS.fps) {
        if (frames === 0) fpsStart = now;
        frames++;
        if (frames === 120) {
          document.documentElement.setAttribute(
            "data-trail-fps",
            (119000 / Math.max(1, now - fpsStart)).toFixed(1)
          );
        }
      }

      step(dt, pointer.x, pointer.y, hovering);
      draw();

      if (!live && !pointerIn) stop();
    }

    function start() {
      if (running || frozen || !atlas || motionReduced()) return;
      running = true;
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function onMove(event) {
      if (frozen || !enabled()) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (lastX === null) { lastX = pointer.x; lastY = pointer.y; }
      pointerIn = true;
      start();
    }

    function onOut(event) {
      var to = event.relatedTarget;
      hovering = !!(to && to.closest && to.closest(HOVER));
    }

    function onOver(event) {
      hovering = !!(event.target.closest && event.target.closest(HOVER));
    }

    function onDown(event) {
      engaged = true;
      downX = event.clientX;
      downY = event.clientY;
    }

    /* A press is a tap only if it stays put: dragging the sheet must not fire a
       burst at the release point. */
    function onUp(event) {
      var tap = engaged &&
                Math.abs(event.clientX - downX) < 12 &&
                Math.abs(event.clientY - downY) < 12;
      if (tap && !frozen && enabled()) burst(event.clientX, event.clientY);
      engaged = false;
      start();
    }

    function onLeave() {
      pointerIn = false;
      lastX = null;
      lastY = null;
    }

    function onEnter() { pointerIn = true; }

    function enabled() { return fine.matches && !motionReduced(); }

    function bind() {
      document.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerover", onOver, { passive: true });
      document.addEventListener("pointerout", onOut, { passive: true });
      document.addEventListener("pointerdown", onDown, { passive: true });
      document.addEventListener("pointerup", onUp, { passive: true });
      document.addEventListener("pointerleave", onLeave, { passive: true });
      document.addEventListener("pointerenter", onEnter, { passive: true });
    }

    function unbind() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
    }

    function onVisibility() {
      if (document.hidden) stop();
      else if (pointerIn) start();
    }

    var resizeTimer = 0;
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeTimer = 0;
        /* A settled page still fires one debounced resize right after load; it
           may not repaint the sheet, but it must not erase the harness's
           frozen frame either - the warmed trail is a state, not a moment. */
        if (frozen) resize();
        else clear();
      }, 150);
    }

    /* Harness only: replay a gesture with a fixed step so a parked cursor
       captures a formed trail - and the same trail every time - instead of the
       empty canvas a cursor with no history would otherwise leave behind. */
    function warm() {
      seeded = true;
      rngState = 0x9e3779b9;
      frozen = true;
      stop();
      clear();

      var toX = pointer.x;
      var toY = pointer.y;
      var fromX = toX - 190;
      var fromY = toY + 90;
      var steps = 46;
      var i;

      for (i = 0; i <= steps; i++) {
        var t = i / steps;
        var ease = t * t * (3 - 2 * t);
        pointerIn = true;
        hovering = HARNESS.cursorState === "hover" || HARNESS.hover !== null;
        step(1 / 60, fromX + (toX - fromX) * ease, fromY + (toY - fromY) * ease, hovering);
      }

      if (HARNESS.click) burst(toX, toY);
      draw();
      document.documentElement.setAttribute("data-trail-count", String(live));
    }

    var pointer = { x: -1e4, y: -1e4 };
    var engaged = false;
    var downX = 0;
    var downY = 0;
    var HOVER = "a, button, [role='button'], summary, input, textarea, .btn, .card, " +
                ".project-item, .plate, .exp-item, .spec-cluster, .gh-panel, .tag, " +
                ".faq-q, .widget-toggle, .flow-step-btn, .copy-cmd, .checklist-head";

    bake();
    resize();
    if (enabled()) bind();
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    onMotionChange(function (isReduced) {
      if (isReduced) {
        stop();
        unbind();
        clear();
      } else if (enabled()) {
        bind();
        start();
      }
    });

    /* Order matters: the canvas has to be sized before the warm-up runs, and a
       frozen trail must never be re-emitted by a later real pointer move. */
    if (HARNESS.cursor) {
      pointer.x = HARNESS.cursor.x;
      pointer.y = HARNESS.cursor.y;
      warm();
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
    /* A section being seen now owns three events, not one: the axis draw
       (is-seen), the honest count-up of its figures, and one scan sweep -
       the same line an anchor jump already fires. */
    function seen(section) {
      section.classList.add("is-seen");
      countFigures(section);
      sweep(section.id);
    }

    function watch() {
      if (!("IntersectionObserver" in window) || motionReduced()) {
        railSections.forEach(function (section) { section.classList.add("is-seen"); });
        return;
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          seen(entry.target);
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
     Pins the hovered state on one surface: the ring, the lift and the cursor,
     so the effect can be captured. The field reads the same point through a
     synthetic pointermove, so the violet accent is in the capture too. */

  if (HARNESS.hover) {
    var pinHover = function () {
      var hoverEl = null;
      try { hoverEl = document.querySelector(HARNESS.hover); } catch (err) { hoverEl = null; }
      if (!hoverEl) return;

      /* A class rather than a real :hover, so the ring can be captured. */
      hoverEl.classList.add("is-hover");
      hoverEl.style.setProperty("--lift", "-2px");

      var hoverBox = hoverEl.getBoundingClientRect();
      var hoverX = Math.round(hoverBox.left + hoverBox.width * 0.34);
      var hoverY = Math.round(hoverBox.top + hoverBox.height * 0.3);

      cursor.place(hoverX, hoverY);
      cursor.state("is-hover");

      if (window.PointerEvent) {
        document.dispatchEvent(new PointerEvent("pointermove", {
          clientX: hoverX, clientY: hoverY, bubbles: true
        }));
      }

      document.documentElement.setAttribute(
        "data-harness",
        "hover:" + HARNESS.hover + "@" + hoverX + "," + hoverY
      );
    };

    if (document.readyState === "complete") requestAnimationFrame(pinHover);
    else window.addEventListener("load", function () { requestAnimationFrame(pinHover); });
  }
})();

/* ================================================================= widgets ===
   Interactive project-page widgets + copy buttons. Progressive enhancement
   only: every widget renders a readable static fallback in the HTML, and this
   script collapses, toggles and remembers. No libraries, no requests. */
(function () {
  "use strict";

  function copyText(text, btn) {
    function done() {
      btn.textContent = "Copied";
      btn.classList.add("copied");
      window.setTimeout(function () {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 1600);
    }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) { /* noop */ }
      document.body.removeChild(ta);
      done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function each(list, fn) { Array.prototype.slice.call(list).forEach(fn); }

  /* copy button after every command block, on every page */
  each(document.querySelectorAll("pre.cmd"), function (pre) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-cmd";
    btn.textContent = "Copy";
    btn.setAttribute("aria-label", "Copy command to clipboard");
    btn.addEventListener("click", function () {
      copyText(pre.textContent.replace(/^\$\s/, ""), btn);
    });
    pre.insertAdjacentElement("afterend", btn);
  });

  /* flow: expandable steps + cache hit/miss path */
  each(document.querySelectorAll('[data-widget="flow"]'), function (widget) {
    var steps = Array.prototype.slice.call(widget.querySelectorAll(".flow-step"));
    function setMode(mode) {
      steps.forEach(function (step) {
        var modes = (step.getAttribute("data-flow-modes") || "").split(/\s+/);
        step.classList.toggle("is-off-path", modes.indexOf(mode) === -1);
      });
      each(widget.querySelectorAll("[data-flow-mode]"), function (btn) {
        var active = btn.getAttribute("data-flow-mode") === mode;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    steps.forEach(function (step) {
      var btn = step.querySelector(".flow-step-btn");
      var detail = step.querySelector(".flow-detail");
      if (!btn || !detail) return;
      detail.hidden = true;
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        detail.hidden = open;
      });
    });
    each(widget.querySelectorAll("[data-flow-mode]"), function (btn) {
      btn.addEventListener("click", function () { setMode(btn.getAttribute("data-flow-mode")); });
    });
    var initial = widget.querySelector("[data-flow-mode][aria-pressed='true']");
    if (initial) setMode(initial.getAttribute("data-flow-mode"));
  });

  /* checklist: remember ticks in localStorage (browser-only) */
  each(document.querySelectorAll('[data-widget="checklist"]'), function (widget) {
    var key = widget.getAttribute("data-storage-key") || "routre-checklist";
    var saved = {};
    try { saved = JSON.parse(window.localStorage.getItem(key) || "{}") || {}; } catch (err) { saved = {}; }
    each(widget.querySelectorAll(".checklist-box"), function (box) {
      var id = box.getAttribute("data-check");
      var li = box.closest ? box.closest(".checklist-step") : null;
      if (saved[id]) {
        box.checked = true;
        if (li) li.classList.add("is-done");
      }
      box.addEventListener("change", function () {
        saved[id] = box.checked;
        if (li) li.classList.toggle("is-done", box.checked);
        try { window.localStorage.setItem(key, JSON.stringify(saved)); } catch (err) { /* noop */ }
      });
    });
  });

  /* faq: accordion; every answer is visible without JavaScript */
  each(document.querySelectorAll('[data-widget="faq"]'), function (widget) {
    each(widget.querySelectorAll(".faq-item"), function (item) {
      var btn = item.querySelector(".faq-q");
      var answer = item.querySelector(".faq-a");
      if (!btn || !answer) return;
      answer.hidden = true;
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        answer.hidden = open;
        item.classList.toggle("is-open", !open);
      });
    });
  });
})();

