/**
 * ============================================================================
 * main.js - Portfolio site behaviours
 * ----------------------------------------------------------------------------
 * Structure, top to bottom:
 *
 *   CONFIG     frozen behavioural constants
 *   Utils      shared helpers, including the DOM-readiness guard
 *   Modules    one IIFE per feature (Navigation, ScrollEffects, Skills,
 *              ContactForm, RevealAnimations, ExternalLinks, Copyright)
 *   BOOTSTRAP  waits for the DOM, then initialises every module in one place
 *
 * Every module resolves its own DOM dependencies and bails out silently when
 * the markup is absent, so a section can be dropped without breaking the rest.
 *
 * @module main
 * @author Abdelrahman
 * ============================================================================
 */

/* ============================================================================
 * CONFIGURATION
 * ----------------------------------------------------------------------------
 * Tunable constants, grouped so behavioural magic numbers never leak into
 * the logic below.
 * ========================================================================== */

const CONFIG = Object.freeze({
  /** Scroll distance (px) after which the header gains its blur + shadow. */
  HEADER_ELEVATE_OFFSET: 80,

  /** Scroll distance (px) after which the "scroll to top" button appears. */
  SCROLL_UP_OFFSET: 400,

  /** Drawer breakpoint (px). Matches the CSS `max-width: 767px` media query. */
  MOBILE_BREAKPOINT: 768,

  /** Destination number for the WhatsApp hand-off (international, no `+`). */
  WHATSAPP_NUMBER: "201068480441",

  /** Delay (ms) before opening WhatsApp, so the loading state is perceivable. */
  REDIRECT_DELAY: 1200,

  /** Duration (ms) of the animated counter used for the skill percentages. */
  COUNTER_DURATION: 900,

  /** Stagger (ms) between consecutive siblings in a revealed grid. */
  REVEAL_STAGGER: 90,
});

/* ============================================================================
 * UTILITIES
 * ========================================================================== */

const Utils = (() => {
  /**
   * Checks whether the visitor has asked for reduced motion.
   * @returns {boolean} True when animations should be suppressed.
   */
  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * Binds a scroll handler that runs at most once per animation frame,
   * preventing layout thrashing during fast scrolling.
   *
   * @param {EventListener} handler Callback receiving the scroll event.
   * @returns {void}
   */
  function onScrollFrame(handler) {
    let ticking = false;

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          handler();
          ticking = false;
        });
      },
      { passive: true },
    );
  }

  /**
   * Reads the current height of the fixed header as a pixel number.
   * Used to offset scroll-spy calculations by the header's own height.
   * @returns {number} Header height in pixels.
   */
  function headerOffset() {
    const header = document.querySelector(".header");
    return header ? header.offsetHeight : 0;
  }

  /**
   * Runs `callback` once the DOM is parsed.
   *
   * The script tag sits at the end of `<body>`, so the DOM is normally ready
   * already. This guard keeps every module correct if the tag is ever moved
   * into `<head>` or the file is deferred, without needing to change the
   * modules themselves.
   *
   * @param {() => void} callback Function to run when the DOM is available.
   * @returns {void}
   */
  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  return { prefersReducedMotion, onScrollFrame, headerOffset, onReady };
})();

/* ============================================================================
 * NAVIGATION - mobile drawer
 * ========================================================================== */

const Navigation = (() => {
  const menu = document.getElementById("nav-menu");
  const toggle = document.getElementById("nav-toggle");
  const closeBtn = document.getElementById("nav-close");

  if (!menu || !toggle) return;

  /**
   * Opens or closes the drawer and keeps `aria-expanded` in sync.
   * @param {boolean} isOpen Desired drawer state.
   * @returns {void}
   */
  function setMenuState(isOpen) {
    menu.classList.toggle("nav__menu--open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute(
      "aria-label",
      isOpen ? "Close navigation menu" : "Open navigation menu",
    );
  }

  /** @returns {boolean} True while the drawer is open. */
  const isOpen = () => menu.classList.contains("nav__menu--open");

  toggle.addEventListener("click", () => setMenuState(!isOpen()));
  closeBtn?.addEventListener("click", () => setMenuState(false));

  // Any in-page navigation should dismiss the drawer.
  menu.querySelectorAll(".nav__link").forEach((link) => {
    link.addEventListener("click", () => setMenuState(false));
  });

  // Escape closes the drawer; Tab is trapped inside it while open so focus
  // cannot wander into the inert page behind the overlay.
  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;

    if (event.key === "Escape") {
      setMenuState(false);
      toggle.focus();
      return;
    }

    if (event.key !== "Tab") return;

    const focusables = menu.querySelectorAll(
      'a[href], button:not([disabled])',
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // A pointer press on the page background dismisses the drawer.
  document.addEventListener("click", (event) => {
    if (isOpen() && !menu.contains(event.target) && !toggle.contains(event.target)) setMenuState(false);
  });

  // Reset state when the layout grows past the mobile breakpoint, otherwise
  // the drawer would remain stuck off-canvas but focused.
  window.matchMedia(`(min-width: ${CONFIG.MOBILE_BREAKPOINT}px)`).addEventListener(
    "change",
    (event) => {
      if (event.matches) setMenuState(false);
    },
  );
})();

/* ============================================================================
 * SCROLL - header elevation, active link, scroll-to-top
 * ----------------------------------------------------------------------------
 * All three effects share one rAF-throttled listener and a single cached
 * lookup per element, instead of the previous three listeners that each
 * re-queried the DOM on every scroll event.
 * ========================================================================== */

const ScrollEffects = (() => {
  const header = document.querySelector(".header");
  const scrollUpBtn = document.getElementById("scroll-up");

  /** @type {Array<{el: Element, link: Element|null, top: number, bottom: number}>} */
  let trackedSections = [];
  let offset = 0;

  /**
   * Pre-computes each section's scroll bounds once, avoiding per-event
   * `offsetTop` reads which force layout recalculation.
   * @returns {void}
   */
  function measureSections() {
    offset = Utils.headerOffset();

    trackedSections = Array.from(document.querySelectorAll("main section[id]"))
      .map((section) => ({
        el: section,
        link: document.querySelector(`.nav__link[href="#${section.id}"]`),
        top: section.offsetTop,
        bottom: section.offsetTop + section.offsetHeight,
      }))
      .filter((entry) => entry.link !== null);
  }

  /** Highlights the nav link matching the section nearest the header. */
  function updateActiveLink() {
    const position = window.scrollY + offset + 8;
    let activeId = null;

    for (const entry of trackedSections) {
      if (position >= entry.top && position < entry.bottom) {
        activeId = entry.el.id;
      }
    }

    for (const entry of trackedSections) {
      entry.link.classList.toggle("nav__link--active", entry.el.id === activeId);
    }
  }

  /** @param {number} y Current vertical scroll offset. @returns {void} */
  function handleScroll() {
    const y = window.scrollY;

    header?.classList.toggle(
      "header--scrolled",
      y >= CONFIG.HEADER_ELEVATE_OFFSET,
    );

    scrollUpBtn?.classList.toggle("scrollup--visible", y >= CONFIG.SCROLL_UP_OFFSET);

    updateActiveLink();
  }

  /** @returns {void} */
  function init() {
    measureSections();
    updateActiveLink();
    Utils.onScrollFrame(handleScroll);

    // Section offsets shift when fonts or images settle, and on resize.
    window.addEventListener("resize", () => {
      measureSections();
      updateActiveLink();
    });

    window.addEventListener("load", () => {
      measureSections();
      updateActiveLink();
    });

    scrollUpBtn?.addEventListener("click", (event) => {
      // The anchor is a progressive-enhancement fallback; suppress its
      // default jump so the smooth scroll is the only thing that happens.
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  init();
})();

/* ============================================================================
 * SKILLS - progress bars and percentage counters
 * ========================================================================== */

const Skills = (() => {
  const panel = document.querySelector(".skills__panel");
  if (!panel) return;

  /** @type {Array<{bar: HTMLElement, value: HTMLElement, target: number}>} */
  let entries = [];

  /**
   * Caches each bar and its label once, so replaying the animation does not
   * re-query the DOM.
   * @returns {void}
   */
  function collect() {
    entries = Array.from(
      panel.querySelectorAll(".skills__item"),
    ).flatMap((item) => {
      const bar = item.querySelector(".skills__progress");
      const value = item.querySelector(".skills__value");
      if (!bar || !value) return [];

      const target = Number.parseInt(bar.dataset.target, 10);
      return Number.isNaN(target) ? [] : [{ bar, value, target }];
    });
  }

  /** @returns {void} */
  function reset() {
    entries.forEach(({ bar, value }) => {
      bar.style.width = "0%";
      value.textContent = "0%";
    });
  }

  /**
   * Fills every bar to its target width while counting the label up to the
   * matching percentage.
   * @returns {void}
   */
  function animate() {
    if (Utils.prefersReducedMotion()) {
      entries.forEach(({ bar, value, target }) => {
        bar.style.width = `${target}%`;
        value.textContent = `${target}%`;
      });
      return;
    }

    const start = performance.now();

    entries.forEach(({ bar, value, target }) => {
      /** Animates a single counter/width pair.
       * @param {number} now High-resolution timestamp from rAF.
       * @returns {void}
       */
      const tick = (now) => {
        const progress = Math.min((now - start) / CONFIG.COUNTER_DURATION, 1);
        // easeOutCubic keeps the count fast at first, then settles.
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = eased * target;

        bar.style.width = `${current}%`;
        value.textContent = `${Math.round(current)}%`;

        if (progress < 1) window.requestAnimationFrame(tick);
        else value.textContent = `${target}%`;
      };

      window.requestAnimationFrame(tick);
    });
  }

  /** @type {IntersectionObserver|null} */
  let observer = null;

  /**
   * Runs `animate` the first time the panel scrolls into view, then stops.
   * @param {IntersectionObserverEntry[]} entries Observed entries.
   * @returns {void}
   */
  function onIntersect(entries) {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;

      collect();
      reset();
      window.setTimeout(animate, 160);
      observer?.unobserve(entry.target);
    }
  }

  /** @returns {void} */
  function init() {
    collect();

    // No IO support, or motion is unwanted: render the finished state at once.
    if (!("IntersectionObserver" in window) || Utils.prefersReducedMotion()) {
      animate();
      return;
    }

    observer = new IntersectionObserver(onIntersect, { threshold: 0.25 });
    observer.observe(panel);
  }

  init();
})();

/* ============================================================================
 * CONTACT FORM - hands the enquiry off to WhatsApp
 * ========================================================================== */

const ContactForm = (() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const submitBtn = document.getElementById("send-btn");

  /** @type {{name: HTMLInputElement, phone: HTMLInputElement, message: HTMLTextAreaElement}} */
  const fields = {
    name: form.elements.fullName,
    phone: form.elements.phone,
    message: form.elements.message,
  };

  /**
   * Builds the WhatsApp deep link carrying the visitor's enquiry.
   * @returns {string} An encoded `wa.me` URL.
   */
  function buildWhatsAppUrl() {
    const body = [
      "New portfolio enquiry",
      "",
      `Name: ${fields.name.value.trim()}`,
      `Phone: ${fields.phone.value.trim()}`,
      `Date: ${new Date().toLocaleString()}`,
      "",
      "Message:",
      fields.message.value.trim(),
    ].join("\n");

    return `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`;
  }

  /** @returns {void} */
  function setLoading(isLoading) {
    submitBtn.classList.toggle("button--loading", isLoading);
    submitBtn.setAttribute("aria-busy", String(isLoading));
  }

  /**
   * Handles submission. The browser's own constraint validation runs first
   * (the inputs are `required`), so `checkValidity()` is only a safeguard.
   * @param {SubmitEvent} event Submission event.
   * @returns {void}
   */
  function handleSubmit(event) {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const url = buildWhatsAppUrl();
    setLoading(true);

    window.setTimeout(() => {
      window.open(url, "_blank", "noopener,noreferrer");

      form.reset();
      setLoading(false);
      fields.name.focus();
    }, CONFIG.REDIRECT_DELAY);
  }

  form.addEventListener("submit", handleSubmit);
})();

/* ============================================================================
 * SCROLL REVEAL - re-triggerable entrance animations
 * ----------------------------------------------------------------------------
 * A native IntersectionObserver adds and removes `.is-active` on `[data-reveal]`
 * elements, so scrolling back up replays the animation without a reload.
 *
 * The `has-reveal` class is only added once the observer is ready, which
 * keeps the hidden start state in CSS inert if anything above throws. There is
 * no external library, so the page cannot be left invisible by a blocked CDN.
 * ========================================================================== */

const RevealAnimations = (() => {
  /**
   * Selectors are grouped by the delay each group should receive. Using
   * `data-reveal` in the markup keeps the wiring declarative and means a new
   * section only needs the attribute, not a JavaScript edit.
   * @type {Array<{selector: string, delay: number}>}
   */
  const GROUPS = [
    { selector: ".home__data", delay: 0 },
    { selector: ".home__img", delay: 120 },
    { selector: ".home__social", delay: 200 },
    { selector: ".skills__panel", delay: 0 },
    { selector: ".about__img", delay: 0 },
    { selector: ".about__data", delay: 120 },
    { selector: ".project-card", delay: 0, stagger: true },
    { selector: ".contact__box", delay: 0 },
    { selector: ".contact__form", delay: 120 },
    { selector: ".footer__content", delay: 0, stagger: true },
  ];

  const ACTIVE_CLASS = "is-active";

  /**
   * Applies a delay to every element in a group, optionally staggering
   * siblings so a grid cascades instead of appearing all at once.
   *
   * @param {Element[]} nodes Elements in the group.
   * @param {number} delay Delay in milliseconds applied to the first node.
   * @param {boolean} stagger Whether to increment the delay per sibling.
   * @returns {void}
   */
  function applyDelays(nodes, delay, stagger) {
    nodes.forEach((node, index) => {
      node.style.transitionDelay = stagger
        ? `${delay + index * CONFIG.REVEAL_STAGGER}ms`
        : `${delay}ms`;
    });
  }

  /**
   * Collects every `[data-reveal]` element and records its intended delay.
   *
   * @returns {Element[]} All reveal targets found in the document.
   */
  function collectTargets() {
    /** @type {Map<Element, number>} */
    const targets = new Map();

    GROUPS.forEach(({ selector, delay, stagger = false }) => {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length === 0) return;

      nodes.forEach((node, index) => {
        // An element matched by two groups keeps the smaller delay.
        const value = delay + (stagger ? index * CONFIG.REVEAL_STAGGER : 0);
        targets.set(node, Math.min(targets.get(node) ?? Infinity, value));
      });

      applyDelays(nodes, delay, stagger);
    });

    return Array.from(targets.keys());
  }

  /**
   * Toggles the active class as targets enter and leave the viewport.
   *
   * Removing the class on exit is what makes the animation re-triggerable:
   * scrolling back up and returning replays it with no page reload. A
   * negative bottom rootMargin delays the hide slightly so a target is not
   * cleared by a one-pixel graze while scrolling.
   *
   * @param {Element[]} targets Elements to observe.
   * @returns {void}
   */
  function observe(targets) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle(ACTIVE_CLASS, entry.isIntersecting);
        }
      },
      {
        // Fire once the element is meaningfully on screen.
        threshold: 0.12,
        // Keep it active until it has scrolled slightly past the bottom, and
        // start it a little late so it appears just before entering view.
        rootMargin: "0px 0px -8% 0px",
      },
    );

    targets.forEach((target) => observer.observe(target));
  }

  /** @returns {void} */
  function init() {
    // No observer support, or motion is unwanted: leave everything visible.
    if (!("IntersectionObserver" in window)) return;
    if (Utils.prefersReducedMotion()) return;

    const targets = collectTargets();
    if (targets.length === 0) return;

    // Added last, and only once targets exist. Until this class lands the
    // hidden start state does not apply, so a failure above leaves the page
    // fully visible rather than blank.
    document.documentElement.classList.add("has-reveal");
    observe(targets);

    // Anything already inside the viewport on first paint (the hero, above
    // the fold) must not wait for a scroll event to appear.
    window.requestAnimationFrame(() => {
      targets.forEach((target) => {
        if (target.getBoundingClientRect().top < window.innerHeight) {
          target.classList.add(ACTIVE_CLASS);
        }
      });
    });
  }

  init();
})();

/* ============================================================================
 * EXTERNAL LINKS - open safely in a new tab
 * ----------------------------------------------------------------------------
 * `target="_blank"` without `rel="noopener"` hands the new document a live
 * `window.opener` reference. The HTML already declares `rel`; this is a
 * belt-and-braces pass for any link added later without it.
 * ========================================================================== */

const ExternalLinks = (() => {
  /**
   * Applies `rel="noopener noreferrer"` to every new-tab link.
   * @returns {void}
   */
  function init() {
    document.querySelectorAll('a[target="_blank"]').forEach((link) => {
      link.rel = "noopener noreferrer";
    });
  }

  return { init };
})();

/* ============================================================================
 * YEAR STAMP - keeps the footer copyright current without manual edits.
 * ========================================================================== */

const Copyright = (() => {
  /**
   * Writes the current year into the footer's `[data-current-year]` slot.
   * @returns {void}
   */
  function init() {
    const node = document.querySelector("[data-current-year]");
    if (node) node.textContent = String(new Date().getFullYear());
  }

  return { init };
})();

/* ============================================================================
 * BOOTSTRAP
 * ----------------------------------------------------------------------------
 * Single entry point. Modules that self-initialise (Navigation,
 * ScrollEffects, Skills, RevealAnimations) have already run by this point;
 * the ones exposed as `{ init }` are started here so the whole file has a
 * single, readable ordering.
 * ========================================================================== */

Utils.onReady(() => {
  ExternalLinks.init();
  Copyright.init();
});