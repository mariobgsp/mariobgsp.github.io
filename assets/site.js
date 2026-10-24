/* ==========================================================================
   mariobgsp.dev - shared behaviour for every page
   Navigation, scroll progress, reveal-on-scroll, the section rail, honest
   count-up and the small project widgets. The ambient wash is CSS-only:
   there is no canvas, no pointer trail and no custom cursor.
   Root index.html loads this first and then adds its own GitHub feed.
   ========================================================================== */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var printMedia = window.matchMedia("print");
  var nav = document.querySelector(".topnav");
  var toggle = document.querySelector(".nav-hamburger");
  var links = document.querySelector(".nav-links");
  var bar = document.getElementById("progressBar");

  /* -------------------------------------------------------- dev harness ---
     ?scroll=<px|id>  scroll to a position, for a real browser
     ?focus=<px|id>   shift the page instead of scrolling it, so a headless
                      capture of a below-the-fold section is not blank
     ?at=<id>         force the "you are here" state without scrolling
     ?hover=<sel>     pin one surface in its hovered state
     ?freeze=1        settle every entrance, pause CSS animation and reveal all
     All of them are inert when absent. */

  var HARNESS = { scroll: null, focus: null, at: null, hover: null, freeze: false };

  if (window.URLSearchParams) {
    try {
      var query = new URLSearchParams(window.location.search);
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

  function bindPreference(mq, fn) {
    var handler = function () { fn(mq.matches); };
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  function motionReduced() { return reduced.matches; }

  /* --------------------------------------------------------- navigation --- */

  function closeMenu() {
    document.body.classList.remove("lock");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    }
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("lock");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
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

  var sections = [].slice.call(document.querySelectorAll("main section[id], footer[id]"));
  var sectionLinks = links ? [].slice.call(links.querySelectorAll('a[href^="#"]')) : [];
  var flow = null;

  /* One pass decides the active nav link, the channel rail and the nav
     indicator. `flow` is assigned further down, hence the guard. */
  function markActive() {
    var probe = window.scrollY + 140;
    var i;

    if (sectionLinks.length && sections.length) {
      var current = sections[0].id;
      for (i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= probe) current = sections[i].id;
      }

      /* At the very bottom the footer starts below the 140px probe; without
         this the last visible section would own the nav forever. */
      if (document.documentElement.scrollHeight > window.innerHeight + 2 &&
          window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 2) {
        current = sections[sections.length - 1].id;
      }

      var active = links.querySelector('a[href="#' + current + '"]');
      [].slice.call(links.querySelectorAll("a")).forEach(function (link) {
        link.classList.toggle("active", link === active);
      });
      if (flow) {
        if (active) flow.place(active);
        else flow.hide();
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
     Two small helpers every page shares, all additive markup-wise:
     indexStaggers writes --i on every .stagger child for the capped delay;
     countUp runs a figure from 0 to its own honest value, never past it. */

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
    var dur = 700;
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
    if (reduced.matches || printMedia.matches || HARNESS.freeze) return;
    if (scope.matches && scope.matches(FIGURES)) countUp(scope);
    [].slice.call(scope.querySelectorAll(FIGURES)).forEach(countUp);
  }

  /* Article pages wire their reading column at runtime, so the generated
     markup never carries a behaviour class: each section joins the reveal set,
     its headings join too, and the reading column becomes a stagger list. */
  (function wireArticle() {
    if (!document.body.classList.contains("art-page")) return;

    [].slice.call(document.querySelectorAll(".art-block")).forEach(function (block) {
      block.classList.add("reveal");
      [].slice.call(block.querySelectorAll(".art-content > h2")).forEach(function (h2) {
        h2.classList.add("reveal");
      });
      var content = block.querySelector(".art-content");
      if (content) content.classList.add("stagger");
    });
  })();

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
  });

  /* ---------------------------------------------------------- section flow ---
     Everything that tracks where the reader is: the channel rail, the sliding
     nav indicator, the axis draw and the settling of measured values. All of
     it is driven by the scroll pass above; there is no second listener. */
  (function sectionFlow() {
    var railSections = [].slice.call(
      document.querySelectorAll("main section[id], footer[id]")
    );
    if (!railSections.length) return;

    var rail = null;
    var pill = null;
    var ticks = [];

    function labelFor(section, index) {
      if (section.id === "top") return "Top";

      var node = section.querySelector(".kicker");
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

    function buildRail() {
      rail = document.createElement("nav");
      rail.className = "sec-rail";
      rail.setAttribute("aria-label", "Sections");

      ticks = railSections.map(function (section, index) {
        var tick = document.createElement("a");
        tick.className = "sec-rail__tick";
        tick.href = "#" + section.id;
        tick.setAttribute("data-target", section.id);
        tick.setAttribute("aria-label", labelFor(section, index));

        rail.appendChild(tick);
        return tick;
      });

      document.body.appendChild(rail);
    }

    function buildPill() {
      if (!links) return;
      var active = links.querySelector("a.active");
      if (!active && !sectionLinks.length) return;

      pill = document.createElement("span");
      pill.className = "nav-pill";
      pill.setAttribute("aria-hidden", "true");
      links.insertBefore(pill, links.firstChild);
      if (active) place(active);
      else hide();
    }

    function place(link) {
      if (!pill || !link) return;
      pill.style.setProperty("--pill-x", link.offsetLeft + "px");
      pill.style.setProperty("--pill-w", link.offsetWidth + "px");
      pill.style.setProperty("--pill-o", "1");
    }

    function hide() {
      if (pill) pill.style.setProperty("--pill-o", "0");
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

    }

    /* A section being seen owns two events: the axis draw (is-seen) and the
       honest count-up of its figures, never a scroll-time redraw. */
    function seen(section) {
      section.classList.add("is-seen");
      countFigures(section);
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

    buildRail();
    buildPill();
    watch();

    flow = { update: update, place: place, hide: hide };
  })();

  if (flow) onScroll();

  /* -------------------------------------------------------- harness scroll ---
     Land on a section before capture: ?scroll=<px|id>. "instant" rather than
     "auto", because auto defers to the CSS scroll-behavior - which is smooth
     here - and a screenshot would catch the scroll mid-flight. */

  if (HARNESS.freeze) {
    document.documentElement.setAttribute("data-freeze", "1");
    showAll();
  }

  if (HARNESS.scroll) {
    var jumpTo = harnessOffset(HARNESS.scroll);

    var jump = function () {
      if (jumpTo !== null) window.scrollTo({ top: jumpTo, left: 0, behavior: "instant" });

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
     Pins the hovered state on one surface: the ring and the lift, so the effect
     can be captured. */

  if (HARNESS.hover) {
    var pinHover = function () {
      var hoverEl = null;
      try { hoverEl = document.querySelector(HARNESS.hover); } catch (err) { hoverEl = null; }
      if (!hoverEl) return;

      hoverEl.classList.add("is-hover");
      hoverEl.style.setProperty("--lift", "-1px");

      var hoverBox = hoverEl.getBoundingClientRect();
      var hoverX = Math.round(hoverBox.left + hoverBox.width * 0.34);
      var hoverY = Math.round(hoverBox.top + hoverBox.height * 0.3);

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
