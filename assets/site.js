/* ==========================================================================
   mariobgsp.dev - shared behaviour for every page
   Navigation, scroll progress, reveal-on-scroll, magnetic hover, the
   ordered-dither pixel field and the animated cursor.
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
     ?hover=<sel>    pin one surface in its hovered state (ring, lift) and
                      park the cursor on it, so it can be captured
     ?cursor=<x>,<y> park the cursor at viewport coordinates, transitions off
     ?cursorstate=hover|down
                      force one cursor state without a real pointer
     ?click=1        draw one click ripple, frozen mid-animation
     ?fps=1          after 120 frames publish the field frame rate as
                      data-field-fps on <html>, for a headless --dump-dom
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
     One rAF pass drives the only thing the pointer does to a surface:
       --mx/--my    magnetic offset (px)
     The rect is cached on enter and refreshed on resize/scroll, so the move
     handler itself never reads layout. Disabled entirely for coarse pointers
     and for reduced motion. */

  (function surfaces() {
    var MAGNET = ".btn, .card, .project-card, .gh-panel, .plate, .spec-cluster, .exp-item";
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
                ".project-card, .plate, .exp-item, .spec-cluster, .gh-panel, .tag, " +
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

  /* ---------------------------------------------------------- pixel field ---
     The ambient layer: an animated ordered-dither field. One canvas pixel is
     one on-screen cell, and CSS scales the backing store up with
     image-rendering: pixelated, so the cells stay hard-edged at any size.
     Each frame writes one preallocated ImageData - no per-cell fillRect, no
     allocation, no sin() and no noise in the loop.

     The cell value cross-fades between two static noise layers, so the dither
     boils between organic shapes instead of sliding as a stripe. A cell lights
     when its value crosses its Bayer 8x8 threshold. Lit cells are two flat
     white tiers; cells within --pixel-accent-r of the pointer take the violet
     accent and a swell, which is the only pointer influence on the sheet.

     Cost controls: fixed cell count from --pixel-pitch, typed arrays, a 512
     entry sine LUT, one putImageData per frame, no canvas shadows, no
     gradients, loop paused while the tab is hidden, and a single static frame
     - never a loop - when the reader asks for reduced motion. */

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

    var W = 0, H = 0, CW = 0, CH = 0;
    var img = null;
    var base = null;    /* static value-noise per cell, layer A */
    var base2 = null;   /* static value-noise per cell, layer B (morph target) */
    var phase = null;   /* wave phase offset per cell */
    var thr = null;     /* Bayer threshold per cell */
    var swell = null;   /* pointer swell per cell, 0..0.28 */
    var pitch = 8;
    var accentR = 176;
    var time = 0;
    var raf = 0;
    var running = false;
    var last = 0;
    var frames = 0;
    var fpsStart = 0;
    var pointer = { x: -1e4, y: -1e4, active: false };

    if (window.getComputedStyle) {
      var cs = getComputedStyle(document.documentElement);
      var parsedPitch = parseFloat(cs.getPropertyValue("--pixel-pitch"));
      if (parsedPitch > 1) pitch = parsedPitch;
      var parsedR = parseFloat(cs.getPropertyValue("--pixel-accent-r"));
      if (parsedR > 8) accentR = parsedR;
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

    /* Everything time-invariant is computed once per resize, never per frame. */
    function build() {
      CW = Math.max(2, Math.ceil(W / pitch));
      CH = Math.max(2, Math.ceil(H / pitch));
      canvas.width = CW;
      canvas.height = CH;

      img = ctx.createImageData(CW, CH);
      var n = CW * CH;
      base = new Float32Array(n);
      base2 = new Float32Array(n);
      phase = new Int32Array(n);
      thr = new Float32Array(n);
      swell = new Float32Array(n);

      for (var y = 0; y < CH; y++) {
        for (var x = 0; x < CW; x++) {
          var i = y * CW + x;
          base[i] = noise2(x * 0.085, y * 0.085);
          base2[i] = noise2(x * 0.13 + 40, y * 0.13 - 25);
          phase[i] = (x * 37 + y * 61) & 511;
          thr[i] = BAYER[(y & 7) * 8 + (x & 7)] / 64;
        }
      }

      last = 0;
      if (pointer.active) swellAt(pointer.x, pointer.y);
    }

    function resize() {
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      build();
      draw(time);
    }

    /* Recomputed on pointermove, not per frame, and only over the cells the
       accent radius can reach. */
    function swellAt(px, py) {
      if (!swell) return;
      swell.fill(0);
      if (!pointer.active) return;

      var r = accentR / pitch;
      var cx = px / pitch;
      var cy = py / pitch;
      var x0 = Math.max(0, Math.floor(cx - r));
      var x1 = Math.min(CW - 1, Math.ceil(cx + r));
      var y0 = Math.max(0, Math.floor(cy - r));
      var y1 = Math.min(CH - 1, Math.ceil(cy + r));
      var r2 = r * r;

      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          var dx = x - cx;
          var dy = y - cy;
          var d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          swell[y * CW + x] = (1 - Math.sqrt(d2) / r) * 0.28;
        }
      }
    }

    function draw(t) {
      if (!img) return;

      var data = img.data;
      var tIdx = Math.round(t * 34);
      var morph = 0.5 + 0.5 * SIN[Math.round(t * 22) & 511];
      var n = CW * CH;
      var k = 0;

      for (var i = 0; i < n; i++) {
        var v = base[i] + (base2[i] - base[i]) * morph +
                SIN[(phase[i] + tIdx) & 511] * 0.07 + swell[i];
        var edge = thr[i];

        if (v <= edge) {
          data[k + 3] = 0;                    /* unlit: transparent, solid --bg shows */
          k += 4;
          continue;
        }

        var d = v - edge;
        if (swell[i] > 0.01) {
          data[k] = 167;
          data[k + 1] = 139;
          data[k + 2] = 250;
          data[k + 3] = Math.round(Math.min(0.46, 0.10 + d * 0.42) * 255);
        } else {
          data[k] = 245;
          data[k + 1] = 245;
          data[k + 2] = 247;
          data[k + 3] = Math.round((d > 0.34 ? 0.10 : 0.055) * 255);
        }
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

    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeTimer = 0;
        resize();
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
      swellAt(pointer.x, pointer.y);
    }, { passive: true });

    document.addEventListener("pointerleave", function () {
      pointer.active = false;
      if (swell) swell.fill(0);
    }, { passive: true });

    onMotionChange(function () {
      if (motionReduced()) {
        stop();
        pointer.active = false;
        if (swell) swell.fill(0);
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

