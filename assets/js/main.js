/* ---------- SECTION: CONFIGURATION ---------- */

const CONFIG = Object.freeze({
  HEADER_ELEVATE_OFFSET: 80,
  SCROLL_UP_OFFSET: 400,
  MOBILE_BREAKPOINT: 768,
  WHATSAPP_NUMBER: "201068480441",
  REDIRECT_DELAY: 1200,
  COUNTER_DURATION: 900,
  REVEAL_STAGGER: 90,
});

/* ---------- SECTION: UTILITIES ---------- */

const Utils = (() => {
  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

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

  function headerOffset() {
    const header = document.querySelector(".header");
    return header ? header.offsetHeight : 0;
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  return { prefersReducedMotion, onScrollFrame, headerOffset, onReady };
})();

/* ---------- SECTION: NAVIGATION ---------- */

const Navigation = (() => {
  let menu;
  let toggle;
  let closeBtn;

  function init() {
    menu = document.getElementById("nav-menu");
    toggle = document.getElementById("nav-toggle");
    closeBtn = document.getElementById("nav-close");
    if (!menu || !toggle) return;

    function setMenuState(isOpen) {
      menu.classList.toggle("nav__menu--open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation menu" : "Open navigation menu",
      );
    }

    const isOpen = () => menu.classList.contains("nav__menu--open");

    toggle.addEventListener("click", () => setMenuState(!isOpen()));
    closeBtn?.addEventListener("click", () => setMenuState(false));

    menu.querySelectorAll(".nav__link").forEach((link) => {
      link.addEventListener("click", () => setMenuState(false));
    });

    document.addEventListener("keydown", (event) => {
      if (!isOpen()) return;

      if (event.key === "Escape") {
        setMenuState(false);
        toggle.focus();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = menu.querySelectorAll(
        "a[href], button:not([disabled])",
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

    document.addEventListener("click", (event) => {
      if (
        isOpen() &&
        !menu.contains(event.target) &&
        !toggle.contains(event.target)
      )
        setMenuState(false);
    });

    window
      .matchMedia(`(min-width: ${CONFIG.MOBILE_BREAKPOINT}px)`)
      .addEventListener("change", (event) => {
        if (event.matches) setMenuState(false);
      });
  }

  return { init };
})();

/* ---------- SECTION: SCROLL ---------- */

const ScrollEffects = (() => {
  const header = document.querySelector(".header");
  const scrollUpBtn = document.getElementById("scroll-up");

  let trackedSections = [];
  let offset = 0;

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

  function updateActiveLink() {
    const position = window.scrollY + offset + 8;
    let activeId = null;

    for (const entry of trackedSections) {
      if (position >= entry.top && position < entry.bottom) {
        activeId = entry.el.id;
      }
    }

    for (const entry of trackedSections) {
      entry.link.classList.toggle(
        "nav__link--active",
        entry.el.id === activeId,
      );
    }
  }

  function handleScroll() {
    const y = window.scrollY;

    header?.classList.toggle(
      "header--scrolled",
      y >= CONFIG.HEADER_ELEVATE_OFFSET,
    );

    scrollUpBtn?.classList.toggle(
      "scrollup--visible",
      y >= CONFIG.SCROLL_UP_OFFSET,
    );

    updateActiveLink();
  }

  function init() {
    measureSections();
    updateActiveLink();
    Utils.onScrollFrame(handleScroll);

    window.addEventListener("resize", () => {
      measureSections();
      updateActiveLink();
    });

    window.addEventListener("load", () => {
      measureSections();
      updateActiveLink();
    });

    scrollUpBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ✅ FIX: The return was incomplete, so the function returned undefined
  // Consequently, Skills and RevealAnimations did not work at all
  return { init };
})();

/* ---------- SECTION: SKILLS ---------- */

const Skills = (() => {
  const panel = document.querySelector(".skills__panel");

  /** @type {Array<{bar: HTMLElement, value: HTMLElement, target: number}>} */
  let entries = [];
  let observer = null;

  function collect() {
    if (!panel) return;
    entries = Array.from(panel.querySelectorAll(".skills__item")).flatMap(
      (item) => {
        const bar = item.querySelector(".skills__progress");
        const value = item.querySelector(".skills__value");
        if (!bar || !value) return [];

        const targetStr = bar.dataset.target ?? bar.dataset.progress;
        const target = Number.parseInt(targetStr, 10);
        return Number.isNaN(target) ? [] : [{ bar, value, target }];
      },
    );
  }

  function reset() {
    entries.forEach(({ bar, value }) => {
      bar.style.width = "0%";
      value.textContent = "0%";
    });
  }

  /**
   * ✅ FIX: One rAF for all elements instead of each element running rAF on its own
   * And we ensure the final values are exactly equal to target.
   */
  function animate() {
    if (entries.length === 0) return;

    if (Utils.prefersReducedMotion()) {
      entries.forEach(({ bar, value, target }) => {
        bar.style.width = `${target}%`;
        value.textContent = `${target}%`;
      });
      return;
    }

    const duration = CONFIG.COUNTER_DURATION;
    const start = performance.now();

    function step(now) {
      const elapsed = Math.min(now - start, duration);
      const progress = elapsed / duration;
      const eased = 1 - Math.pow(1 - progress, 3);

      entries.forEach(({ bar, value, target }) => {
        const current = eased * target;
        bar.style.width = `${current}%`;
        value.textContent = `${Math.round(current)}%`;
      });

      if (elapsed < duration) {
        window.requestAnimationFrame(step);
      } else {
        entries.forEach(({ bar, value, target }) => {
          bar.style.width = `${target}%`;
          value.textContent = `${target}%`;
        });
      }
    }

    window.requestAnimationFrame(step);
  }

  function onIntersect(observed) {
    for (const entry of observed) {
      if (entry.isIntersecting) {
        collect();
        reset();
        window.requestAnimationFrame(() => animate());
      } else {
        reset();
      }
    }
  }

  function init() {
    if (!panel) return;
    collect();

    if (!("IntersectionObserver" in window) || Utils.prefersReducedMotion()) {
      animate();
      return;
    }

    observer = new IntersectionObserver(onIntersect, {
      threshold: 0.2,
      rootMargin: "0px 0px -10% 0px",
    });
    observer.observe(panel);
  }

  return { init };
})();

/* ---------- SECTION: CONTACT FORM ---------- */

const ContactForm = (() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const submitBtn = document.getElementById("send-btn");

  const fields = {
    name: form.elements.fullName,
    phone: form.elements.phone,
    message: form.elements.message,
  };

  function buildWhatsAppUrl() {
    const body = [
      "New portfolio enquiry",
      "",
      `Name: ${fields.name.value.trim()}`,
      `Phone: ${fields.phone.value.trim()}`,
      `Date: ${new Date().toLocaleString()}`,
      "Message:",
      fields.message.value.trim(),
    ].join("\n");

    return `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`;
  }

  function setLoading(isLoading) {
    submitBtn.classList.toggle("button--loading", isLoading);
    submitBtn.setAttribute("aria-busy", String(isLoading));
  }

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

const RevealAnimations = (() => {
  const ACTIVE_CLASS = "active";

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

  function applyDelays(nodes, delay, stagger) {
    nodes.forEach((node, index) => {
      node.style.transitionDelay = stagger
        ? `${delay + index * CONFIG.REVEAL_STAGGER}ms`
        : `${delay}ms`;
    });
  }

  function collectTargets() {
    const targets = new Map();

    GROUPS.forEach(({ selector, delay, stagger = false }) => {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length === 0) return;

      nodes.forEach((node, index) => {
        const value = delay + (stagger ? index * CONFIG.REVEAL_STAGGER : 0);
        targets.set(node, Math.min(targets.get(node) ?? Infinity, value));
      });

      applyDelays(nodes, delay, stagger);
    });

    return Array.from(targets.keys());
  }

  function observe(targets) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle(ACTIVE_CLASS, entry.isIntersecting);
        }
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    targets.forEach((target) => observer.observe(target));
  }

  function initSectionReveal() {
    const sections = Array.from(document.querySelectorAll(".section"));
    if (sections.length === 0) return;

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle(ACTIVE_CLASS, entry.isIntersecting);
        }
      },
      {
        threshold: 0.15,
        rootMargin: "-12% 0px -12% 0px",
      },
    );

    sections.forEach((section) => sectionObserver.observe(section));
  }

  function init() {
    if (!("IntersectionObserver" in window)) return;
    if (Utils.prefersReducedMotion()) return;

    const targets = collectTargets();
    const sections = document.querySelectorAll(".section");

    if (targets.length === 0 && sections.length === 0) return;

    // ✅ We add has-reveal at the end in case anything above fails
    // The page remains visible (not hidden).
    document.documentElement.classList.add("has-reveal");

    if (targets.length > 0) observe(targets);
    if (sections.length > 0) initSectionReveal();
  }

  return { init };
})();

/* ---------- SECTION: REVEAL ANIMATIONS ---------- */
const ExternalLinks = (() => {
  function init() {
    document.querySelectorAll('a[target="_blank"]').forEach((link) => {
      link.rel = "noopener noreferrer";
    });
  }
  return { init };
})();

/* ---------- SECTION: YEAR STAMP ---------- */

const Copyright = (() => {
  function init() {
    const node = document.querySelector("[data-current-year]");
    if (node) node.textContent = String(new Date().getFullYear());
  }
  return { init };
})();

/* ---------- SECTION: BOOTSTRAP ---------- */

Utils.onReady(() => {
  Navigation.init();
  ScrollEffects.init();
  Skills.init();
  RevealAnimations.init();
  ExternalLinks.init();
  Copyright.init();
});
