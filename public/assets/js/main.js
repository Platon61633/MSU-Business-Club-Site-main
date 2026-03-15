(function () {
  "use strict";

  const CONFIG = {
    teamMarqueeSpeedPxPerSec: 28, // скорость автопрокрутки карточек команды (px/sec)
    teamMarqueePauseOnHover: true,
    hideGoogleTranslateBanner: true
  };

  const body = document.body;
  const isHomePage = (function detectHome() {
    const path = window.location.pathname || "";
    return path.endsWith("/") || path.endsWith("/index.html") || path.endsWith("index.html");
  })();

  const yearNode = document.getElementById("current-year");
  if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
  }

  function setActiveLinkByPath() {
    const currentFile = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

    const allNavLinks = document.querySelectorAll(".desktop-nav a, .mobile-nav a");
    allNavLinks.forEach(function (link) {
      const href = (link.getAttribute("href") || "").trim();
      if (!href || href.startsWith("#")) return;
      if (/^https?:\/\//i.test(href)) return;

      const normalized = href.split("#")[0].toLowerCase();
      link.classList.toggle("is-active", normalized === currentFile);
    });
  }

  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileNav = document.getElementById("mobile-nav");
  const mobileNavLinks = mobileNav ? mobileNav.querySelectorAll("a") : [];

  function toggleMobileMenu(forceState) {
    if (!mobileMenuBtn || !mobileNav) return;
    const shouldOpen =
      typeof forceState === "boolean"
        ? forceState
        : !mobileNav.classList.contains("is-open");
    mobileNav.classList.toggle("is-open", shouldOpen);
    mobileMenuBtn.setAttribute("aria-expanded", String(shouldOpen));
    body.classList.toggle("menu-open", shouldOpen);
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", function () {
      toggleMobileMenu();
    });
  }

  mobileNavLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      toggleMobileMenu(false);
    });
  });


  setActiveLinkByPath();

  const eventsTrack = document.getElementById("events-track");
  const eventsPrev = document.getElementById("events-prev");
  const eventsNext = document.getElementById("events-next");

  function scrollEvents(direction) {
    if (!eventsTrack) return;
    const firstCard = eventsTrack.querySelector(".event-card");
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 280;
    const gap = 14;
    eventsTrack.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: "smooth"
    });
  }

  if (eventsPrev) {
    eventsPrev.addEventListener("click", function () {
      scrollEvents(-1);
    });
  }

  if (eventsNext) {
    eventsNext.addEventListener("click", function () {
      scrollEvents(1);
    });
  }

  (function initTeamMarquee() {
    const marquee = document.getElementById("team-marquee");
    if (!marquee) return;

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // уберёте false, если понадобится фича с отключенным движением
    if (prefersReducedMotion && false) return;

    let isPaused = false;
    let rafId = 0;
    let lastTs = 0;

    const speed = Math.max(0, Number(CONFIG.teamMarqueeSpeedPxPerSec) || 0);
    const pxPerMs = speed / 1000;

    function step(ts) {
      if (!lastTs) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;

      if (!isPaused && pxPerMs > 0) {
        marquee.scrollLeft += dt * pxPerMs;

        const maxScroll = marquee.scrollWidth - marquee.clientWidth - 1;
        if (maxScroll > 0 && marquee.scrollLeft >= maxScroll) {
          marquee.scrollLeft = 0;
        }
      }

      rafId = window.requestAnimationFrame(step);
    }

    function pause() {
      isPaused = true;
    }
    function resume() {
      isPaused = false;
    }

    if (CONFIG.teamMarqueePauseOnHover) {
      marquee.addEventListener("mouseenter", pause);
      marquee.addEventListener("mouseleave", resume);
    }

    marquee.addEventListener("focusin", pause);
    marquee.addEventListener("focusout", resume);

    marquee.addEventListener(
      "pointerdown",
      function () {
        pause();
        window.setTimeout(resume, 1200);
      },
      { passive: true }
    );

    rafId = window.requestAnimationFrame(step);

    // если страница уходит в background, экономим ресурсы
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        window.cancelAnimationFrame(rafId);
      } else {
        lastTs = 0;
        rafId = window.requestAnimationFrame(step);
      }
    });
  })();

  const sheet = document.getElementById("application-sheet");
  const sheetOverlay = document.getElementById("sheet-overlay");
  const sheetClose = document.getElementById("sheet-close");
  const openSheetButtons = document.querySelectorAll("[data-open-application]");

  const feedbackModal = document.getElementById("feedback-modal");
  const feedbackOverlay = document.getElementById("feedback-overlay");
  const feedbackClose = document.getElementById("feedback-close");
  const openFeedbackButtons = document.querySelectorAll("[data-open-feedback]");

  function syncModalLock() {
    const appOpen = sheet && sheet.classList.contains("is-open");
    const feedbackOpen = feedbackModal && feedbackModal.classList.contains("is-open");
    body.classList.toggle("modal-open", Boolean(appOpen || feedbackOpen));
  }

  function openApplicationSheet() {
    if (!sheet || !sheetOverlay) return;
    closeFeedbackModal();
    sheet.classList.add("is-open");
    sheetOverlay.hidden = false;
    requestAnimationFrame(function () {
      sheetOverlay.classList.add("is-visible");
    });
    sheet.setAttribute("aria-hidden", "false");
    syncModalLock();
  }

  function closeApplicationSheet() {
    if (!sheet || !sheetOverlay) return;
    sheet.classList.remove("is-open");
    sheetOverlay.classList.remove("is-visible");
    sheet.setAttribute("aria-hidden", "true");
    window.setTimeout(function () {
      if (!sheetOverlay.classList.contains("is-visible")) {
        sheetOverlay.hidden = true;
      }
    }, 240);
    syncModalLock();
  }

  function openFeedbackModal() {
    if (!feedbackModal || !feedbackOverlay) return;
    closeApplicationSheet();
    feedbackModal.classList.add("is-open");
    feedbackOverlay.hidden = false;
    requestAnimationFrame(function () {
      feedbackOverlay.classList.add("is-visible");
    });
    feedbackModal.setAttribute("aria-hidden", "false");
    syncModalLock();
  }

  function closeFeedbackModal() {
    if (!feedbackModal || !feedbackOverlay) return;
    feedbackModal.classList.remove("is-open");
    feedbackOverlay.classList.remove("is-visible");
    feedbackModal.setAttribute("aria-hidden", "true");
    window.setTimeout(function () {
      if (!feedbackOverlay.classList.contains("is-visible")) {
        feedbackOverlay.hidden = true;
      }
    }, 240);
    syncModalLock();
  }

  openSheetButtons.forEach(function (button) {
    button.addEventListener("click", openApplicationSheet);
  });

  if (sheetClose) {
    sheetClose.addEventListener("click", closeApplicationSheet);
  }

  if (sheetOverlay) {
    sheetOverlay.addEventListener("click", closeApplicationSheet);
  }

  openFeedbackButtons.forEach(function (button) {
    button.addEventListener("click", openFeedbackModal);
  });

  if (feedbackClose) {
    feedbackClose.addEventListener("click", closeFeedbackModal);
  }

  if (feedbackOverlay) {
    feedbackOverlay.addEventListener("click", closeFeedbackModal);
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      toggleMobileMenu(false);
      closeApplicationSheet();
      closeFeedbackModal();
    }
  });

  const feedbackForm = document.getElementById("feedback-form");
  const feedbackStatus = document.getElementById("feedback-status");
  const applicationForm = document.getElementById("application-form");
  const applicationStatus = document.getElementById("application-status");

  if (feedbackForm) {
    feedbackForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      form.reset();
      if (feedbackStatus) {
        feedbackStatus.textContent =
          "Сообщение принято. Осталось подключить форму к CRM или почте, чтобы отправка стала боевой.";
      }
      window.setTimeout(closeFeedbackModal, 950);
    });
  }

  if (applicationForm) {
    applicationForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      form.reset();
      if (applicationStatus) {
        applicationStatus.textContent =
          "Заявка принята. Осталось подключить CRM или обработчик формы, чтобы отправка стала реальной.";
      }
      window.setTimeout(closeApplicationSheet, 1100);
    });
  }

   // Google Translate: переключение языков
   // + фикс верхней панели
  const languageButtons = document.querySelectorAll(".lang-btn");

  function detectCurrentLanguage() {
    const match = document.cookie.match(/googtrans=\/ru\/([^;]+)/);
    return match && match[1] ? decodeURIComponent(match[1]) : "ru";
  }

  function setActiveLanguageButton(lang) {
    languageButtons.forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.lang === lang);
    });
  }

  function applyTranslateByCombo(lang) {
    const combo = document.querySelector(".goog-te-combo");
    if (!combo) return false;
    combo.value = lang;
    combo.dispatchEvent(new Event("change"));
    return true;
  }

  function resetToRussian() {
    document.cookie =
      "googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.reload();
  }

  function switchLanguage(lang) {
    if (lang === "ru") {
      resetToRussian();
      return;
    }

    const switched = applyTranslateByCombo(lang);
    if (!switched) {
      document.cookie = "googtrans=/ru/" + lang + "; path=/";
      window.location.reload();
    }
  }

  setActiveLanguageButton(detectCurrentLanguage());

  languageButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const lang = button.dataset.lang || "ru";
      setActiveLanguageButton(lang);
      switchLanguage(lang);
    });
  });

  function installGoogleTranslateBannerFix() {
    if (!CONFIG.hideGoogleTranslateBanner) return;

    function applyFix() {
      // Google иногда добавляет отступ сверху через inline-style
      document.documentElement.style.top = "0px";
      document.documentElement.style.position = "static";
      document.documentElement.style.marginTop = "0px";

      if (document.body) {
        document.body.style.top = "0px";
        document.body.style.position = "static";
        document.body.style.marginTop = "0px";
      }

      const iframe = document.querySelector("iframe.goog-te-banner-frame");
      if (iframe) {
        iframe.style.display = "none";
        iframe.style.visibility = "hidden";
        iframe.style.height = "0";
      }

      const tt = document.getElementById("goog-gt-tt");
      if (tt) {
        tt.style.display = "none";
      }
    }

    let scheduled = false;
    function scheduleFix() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        applyFix();
      });
    }

    applyFix();
    window.setTimeout(applyFix, 700);

    try {
      const obs = new MutationObserver(scheduleFix);
      obs.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true
      });
    } catch (e) {
      // ...когда-нибудь я сделаю логи
    }
  }


  // ===== Scroll animations (reversible) =====
  // Use: add data-animate="fade-up|fade-down|fade-left|fade-right|scale-in|blur-in"
  // Optional: set data-stagger="90" on a container to stagger child [data-animate].

  (function initScrollAnimations() {
    // CSS is scoped to html.sa-ready so we don't break the no-JS fallback.
    document.documentElement.classList.add("sa-ready");

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const DEFAULT_DELAY_STEP = 90;

    let observer = null;

    function ensureObserver() {
      if (observer || prefersReducedMotion) return;

      try {
        observer = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              const el = entry.target;
              if (entry.isIntersecting) {
                el.classList.add("is-inview");
              } else {
                el.classList.remove("is-inview");
              }
            });
          },
          { threshold: 0.14, rootMargin: "0px 0px -10% 0px" }
        );
      } catch (e) {
        observer = null;
      }
    }

    function applyStagger(root) {
      if (!root) return;

      const staggerContainers = root.querySelectorAll
        ? root.querySelectorAll("[data-stagger]")
        : [];

      staggerContainers.forEach(function (container) {
        const step = Number(container.dataset.stagger) || DEFAULT_DELAY_STEP;
        const animated = container.querySelectorAll("[data-animate]");
        let i = 0;
        animated.forEach(function (el) {
          // allow overriding per element
          if (!el.style.getPropertyValue("--sa-delay")) {
            el.style.setProperty("--sa-delay", String(i * step) + "ms");
          }
          i += 1;
        });
      });
    }

    function bind(root) {
      const scope = root && root.querySelectorAll ? root : document;

      // once
      applyStagger(scope);

      const animatedEls = scope.querySelectorAll
        ? scope.querySelectorAll("[data-animate]")
        : [];

      if (prefersReducedMotion) {
        animatedEls.forEach(function (el) {
          el.classList.add("is-inview");
        });
        return;
      }

      ensureObserver();

      if (!observer) {
        animatedEls.forEach(function (el) {
          el.classList.add("is-inview");
        });
        return;
      }

      animatedEls.forEach(function (el) {
        if (el.dataset.saBound === "1") return;
        el.dataset.saBound = "1";
        observer.observe(el);
      });
    }

    // expose for blocks that render DOM later (например: Q&A)
    window.BCScrollAnimations = {
      refresh: function (root) {
        bind(root || document);
      }
    };

    // init
    bind(document);
  })();

  // ===== Hero background fade on scroll (home only) =====
  (function initHeroBgFade() {
    if (!isHomePage) return;

    const hero = document.getElementById("hero");
    if (!hero) return;

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) return;

    function clamp(n, a, b) {
      return Math.max(a, Math.min(b, n));
    }

    let scheduled = false;

    function update() {
      scheduled = false;

      const rect = hero.getBoundingClientRect();
      const heroH = Math.max(1, rect.height || 1);

      // how much hero is scrolled past the top
      const scrolled = clamp(-rect.top, 0, heroH);
      const t = scrolled / heroH;

      // Fade image from 1.0 -> 0.28 as you scroll through the hero
      const opacity = 1 - t * 0.72;
      hero.style.setProperty("--hero-media-opacity", opacity.toFixed(3));
    }

    function onScroll() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  })();

  
  // ===== Magnetic hover (premium micro-interaction) =====
  // Add data-magnet to any element. Works only on hover devices and when reduce-motion is off.
  (function initMagneticHover() {
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const canHover =
      window.matchMedia && window.matchMedia("(hover:hover)").matches;

    if (prefersReducedMotion || !canHover) return;

    const nodes = Array.from(document.querySelectorAll("[data-magnet]"));
    if (!nodes.length) return;

    const MAX = 7; // px

    nodes.forEach(function (el) {
      let rect = null;

      function onEnter() {
        rect = el.getBoundingClientRect();
        el.classList.add("is-magnet-on");
      }

      function onMove(e) {
        if (!rect) rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
        const y = (e.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
        el.style.setProperty("--mag-x", (x * MAX).toFixed(2) + "px");
        el.style.setProperty("--mag-y", (y * MAX).toFixed(2) + "px");
      }

      function onLeave() {
        rect = null;
        el.style.setProperty("--mag-x", "0px");
        el.style.setProperty("--mag-y", "0px");
        el.classList.remove("is-magnet-on");
      }

      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", onLeave);
    });
  })();

  // ===== Subpage sticky side navigation (scrollspy) =====
  (function initSubpageSideNav() {
    const sidenav = document.querySelector(".subpage-sidenav");
    if (!sidenav) return;

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const links = Array.from(sidenav.querySelectorAll('a[href^="#"]'));
    if (!links.length) return;

    const sections = links
      .map(function (a) {
        const href = a.getAttribute("href");
        try {
          return href ? document.querySelector(href) : null;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean);

    if (!sections.length) return;

    function setActive(id) {
      links.forEach(function (a) {
        const href = a.getAttribute("href") || "";
        const isActive = href === "#" + id;
        a.classList.toggle("is-active", isActive);
        if (isActive) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }

    function refresh() {
      const triggerY = window.scrollY + window.innerHeight * 0.32;
      let activeId = sections[0].id;

      sections.forEach(function (sec) {
        if (sec.offsetTop <= triggerY) activeId = sec.id;
      });

      setActive(activeId);
    }

    // Initial state + scroll handler (simple & stable)
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    refresh();

    // Improve perceived response on click
    links.forEach(function (a) {
      a.addEventListener("click", function () {
        const href = a.getAttribute("href") || "";
        if (href.startsWith("#")) {
          const id = href.slice(1);
          window.setTimeout(function () {
            setActive(id);
          }, prefersReducedMotion ? 0 : 90);
        }
      });
    });
  })();

  // ===== Subpage hero parallax (micro depth) =====
  (function initSubpageHeroParallax() {
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) return;

    const imgs = Array.from(document.querySelectorAll("[data-parallax-img]"));
    if (!imgs.length) return;

    function clamp(n, a, b) {
      return Math.max(a, Math.min(b, n));
    }

    let scheduled = false;

    function update() {
      scheduled = false;

      imgs.forEach(function (img) {
        const sec = img.closest("section") || img.parentElement;
        if (!sec) return;

        const rect = sec.getBoundingClientRect();
        const vh = Math.max(1, window.innerHeight || 1);

        // t: -1..1 around center
        const center = rect.top + rect.height * 0.5;
        const t = clamp((center - vh * 0.5) / vh, -1, 1);

        const y = t * -10; // px
        img.style.transform = "translate3d(0," + y.toFixed(2) + "px,0) scale(1.03)";
      });
    }

    function onScroll() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  })();

  // ===== Home: contacts typewriter =====
  (function initContactsTypewriter() {
    if (!isHomePage) return;

    const node = document.getElementById("contacts-typewriter");
    if (!node) return;

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const phrases = String(node.dataset.phrases || "")
      .split("|")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);

    if (!phrases.length) return;

    if (prefersReducedMotion) {
      node.textContent = phrases[0];
      return;
    }

    const TYPE_MS = 30;   // typing speed
    const ERASE_MS = 32;  // erase speed (per char, smoother)
    const HOLD_MS = 1650; // hold at full text
    const GAP_MS = 280;   // pause between erase and next type

    let phraseIndex = 0;
    let charIndex = 0;
    let mode = "type"; // type | hold | erase
    let timer = 0;

    function tick() {
      const phrase = phrases[phraseIndex] || phrases[0];

      if (mode === "type") {
        charIndex += 1;
        node.textContent = phrase.slice(0, charIndex);

        if (charIndex >= phrase.length) {
          mode = "hold";
          timer = window.setTimeout(tick, HOLD_MS);
          return;
        }

        timer = window.setTimeout(tick, TYPE_MS);
        return;
      }

      if (mode === "hold") {
        mode = "erase";
        timer = window.setTimeout(tick, ERASE_MS);
        return;
      }

      // erase
      charIndex -= 1; // erase one char at a time for smoothness
      if (charIndex <= 0) {
        node.textContent = "";
        charIndex = 0;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        mode = "type";
        timer = window.setTimeout(tick, GAP_MS);
        return;
      }

      node.textContent = phrase.slice(0, charIndex);
      timer = window.setTimeout(tick, ERASE_MS);
    }

    // start after a short delay (so it feels intentional)
    window.setTimeout(tick, 520);

    // cleanup in background tabs
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        window.clearTimeout(timer);
      } else {
        window.clearTimeout(timer);
        mode = "type";
        charIndex = 0;
        node.textContent = "";
        window.setTimeout(tick, 320);
      }
    });
  })();


  installGoogleTranslateBannerFix();
})();