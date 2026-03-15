(function () {
  "use strict";

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function initHomeAnnouncements() {
    const shell = document.getElementById("home-announcements-shell");
    const list = document.getElementById("home-announcements-list");
    if (!shell || !list) return;

    const meta = document.getElementById("home-announcements-meta");
    const DATA_URL = "assets/data/home-announcements.json";
    const ruDateTime = new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit"
    });
    const ruDate = new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long"
    });

    function safeText(value) {
      return String(value || "").trim();
    }

    function parseIso(value) {
      if (!value) return null;
      const parsed = new Date(value);
      return Number.isFinite(parsed.getTime()) ? parsed : null;
    }

    function formatStart(value) {
      const date = parseIso(value);
      if (!date) return "Дата уточняется";

      const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
      return hasTime ? ruDateTime.format(date) : ruDate.format(date);
    }

    function renderCard(item, index) {
      const card = document.createElement("article");
      card.className = "event-card event-card--live neon-panel lift-on-hover";
      card.setAttribute("data-animate", index % 2 === 0 ? "fade-up" : "scale-in");

      const media = document.createElement("img");
      media.className = "event-card-live-media";
      media.loading = "lazy";
      media.src = safeText(item.cover_image) || "assets/img/events.jpg";
      media.alt = safeText(item.title) || "Анонс мероприятия";

      const body = document.createElement("div");
      body.className = "event-card-live-body";

      const topline = document.createElement("div");
      topline.className = "event-card-live-topline";

      const tag = document.createElement("span");
      tag.className = "event-card-live-tag";
      tag.textContent = "Telegram";

      const date = document.createElement("span");
      date.className = "event-card-live-date";
      date.textContent = formatStart(item.start_at);

      topline.appendChild(tag);
      topline.appendChild(date);

      const title = document.createElement("h3");
      title.className = "event-card-live-title";
      title.textContent = safeText(item.title) || "Анонс";

      const metaLine = document.createElement("p");
      metaLine.className = "event-card-live-meta-line";
      metaLine.textContent = safeText(item.location) || "Место уточняется";

      const actions = document.createElement("div");
      actions.className = "event-card-live-actions";

      if (item.registration_url) {
        const reg = document.createElement("a");
        reg.className = "event-card-live-link";
        reg.href = item.registration_url;
        reg.target = "_blank";
        reg.rel = "noopener noreferrer";
        reg.textContent = "Регистрация";
        actions.appendChild(reg);
      }

      if (item.source_post_url) {
        const post = document.createElement("a");
        post.className = "event-card-live-link";
        post.href = item.source_post_url;
        post.target = "_blank";
        post.rel = "noopener noreferrer";
        post.textContent = "Пост в Telegram";
        actions.appendChild(post);
      }

      body.appendChild(topline);
      body.appendChild(title);
      body.appendChild(metaLine);
      body.appendChild(actions);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    async function loadAnnouncements() {
      try {
        const response = await fetch(DATA_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);

        const payload = await response.json();
        const items = Array.isArray(payload.items) ? payload.items : [];

        if (!items.length) {
          shell.hidden = true;
          return;
        }

        list.innerHTML = "";
        items.forEach(function (item, index) {
          list.appendChild(renderCard(item, index));
        });

        if (meta) {
          meta.textContent = "Свежие анонсы из Telegram: " + items.length + " шт.";
        }

        shell.hidden = false;

        if (window.BCScrollAnimations && typeof window.BCScrollAnimations.refresh === "function") {
          window.BCScrollAnimations.refresh(shell);
        }
      } catch (_error) {
        shell.hidden = true;
      }
    }

    loadAnnouncements();
  }

  /* ==========================
     Q&A (tabs + accordion)
     ========================== */

  function initFaq() {
    const faqList = document.getElementById("faq-list");
    if (!faqList) return;

    const tabButtons = Array.from(document.querySelectorAll(".faq-tab[data-faq-tab]"));
    if (!tabButtons.length) return;

    // Контент — заглушки. Замените текст на реальный.
    // Структура: { q: string, aHtml?: string, bullets?: string[] }
    const FAQ = {
      open: [
        {
          q: "Где проходят открытые мероприятия клуба?",
          aHtml:
            "Большинство мероприятий проходит в Москве. Точная площадка всегда указана в анонсе.<br><br><strong>Чаще всего:</strong>" +
            "<ul><li>аудитории/залы университета</li><li>партнёрские площадки</li><li>коворкинги</li></ul>"
        },
        {
          q: "Как попасть на открытые мероприятия клуба?",
          bullets: [
            "Откройте анонс мероприятия в соцсетях/на сайте.",
            "Перейдите по ссылке на регистрацию.",
            "Дождитесь подтверждения (если предусмотрено) и приходите вовремя."
          ]
        },
        {
          q: "Можно ли прийти, если я не студент МГУ?",
          bullets: [
            "Да — на многие открытые мероприятия можно попасть всем желающим (если это указано в анонсе).",
            "Для некоторых форматов действует приоритет по спискам (например, студенты/выпускники).",
            "Правила входа всегда прописаны в регистрации и посте-анонсе."
          ]
        },
        {
          q: "Можно ли передать билет/регистрацию другу?",
          bullets: [
            "Зависит от формата и площадки: иногда именные списки обязательны.",
            "Если есть возможность передачи — это будет указано в регистрации.",
            "Если сомневаетесь — напишите организаторам в Telegram."
          ]
        }
      ],
      team: [
        {
          q: "Как попасть в команду организаторов?",
          bullets: [
            "Откройте страницу команды и выберите направление, которое вам ближе.",
            "Нажмите «Подать заявку» и заполните форму.",
            "Мы свяжемся и предложим короткий созвон/задачу на вход."
          ]
        },
        {
          q: "Нужно ли иметь опыт организации мероприятий?",
          bullets: [
            "Не обязательно — мы даём вводную и поддержку.",
            "Важно желание делать результат и ответственность за свой кусок.",
            "Опыт — это плюс, но не барьер."
          ]
        }
      ],
      closed: [
        {
          q: "Что такое закрытый клуб и кому он подходит?",
          bullets: [
            "Это среда для тех, кто уже делает проект/бизнес и хочет ускорить рост.",
            "Подходит предпринимателям, продуктовым людям и лидерам команд.",
            "Фокус — качество окружения и практические разборы."
          ]
        },
        {
          q: "Сколько стоит участие?",
          aHtml:
            "Стоимость зависит от формата и сезона. Актуальные условия — в анонсах и у команды клуба. <br><br>Напишите нам — подскажем подходящий вариант."
        }
      ]
    };

    function safeText(text) {
      return String(text || "").trim();
    }

    function closeItem(item) {
      item.classList.remove("is-open");
      item.setAttribute("aria-expanded", "false");
      const a = item.querySelector(".faq-a");
      if (a) a.style.maxHeight = "0px";
    }

    function openItem(item) {
      item.classList.add("is-open");
      item.setAttribute("aria-expanded", "true");
      const a = item.querySelector(".faq-a");
      const inner = item.querySelector(".faq-a-inner");
      if (!a || !inner) return;

      if (prefersReducedMotion) {
        a.style.maxHeight = "none";
        return;
      }

      a.style.maxHeight = inner.scrollHeight + "px";
    }

    function createFaqItem(it, idx, tabKey) {
      const wrapper = document.createElement("div");
      wrapper.className = "faq-item lift-on-hover";
      wrapper.setAttribute("data-animate", idx % 3 === 0 ? "fade-up" : idx % 3 === 1 ? "scale-in" : "blur-in");
      wrapper.setAttribute("role", "button");
      wrapper.setAttribute("tabindex", "0");
      wrapper.setAttribute("aria-expanded", "false");

      const q = document.createElement("div");
      q.className = "faq-q";

      const title = document.createElement("h3");
      title.textContent = safeText(it.q) || "Вопрос";

      const icon = document.createElement("div");
      icon.className = "faq-icon";
      icon.setAttribute("aria-hidden", "true");

      q.appendChild(title);
      q.appendChild(icon);

      const a = document.createElement("div");
      a.className = "faq-a";

      const inner = document.createElement("div");
      inner.className = "faq-a-inner";

      if (it.aHtml) {
        inner.innerHTML = String(it.aHtml);
      } else if (Array.isArray(it.bullets)) {
        const ul = document.createElement("ul");
        it.bullets.forEach(function (b) {
          const li = document.createElement("li");
          li.textContent = safeText(b);
          ul.appendChild(li);
        });
        inner.appendChild(ul);
      } else {
        inner.textContent = "—";
      }

      a.appendChild(inner);

      function toggle() {
        const isOpen = wrapper.classList.contains("is-open");
        // close others in same tab
        faqList.querySelectorAll(".faq-item.is-open").forEach(function (node) {
          if (node !== wrapper) closeItem(node);
        });
        if (isOpen) closeItem(wrapper);
        else openItem(wrapper);
      }

      wrapper.addEventListener("click", toggle);
      wrapper.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });

      wrapper.appendChild(q);
      wrapper.appendChild(a);

      return wrapper;
    }

    function setTabsActive(key) {
      tabButtons.forEach(function (b) {
        const active = b.dataset.faqTab === key;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
    }

    function renderFaq(key) {
      const items = Array.isArray(FAQ[key]) ? FAQ[key] : [];
      faqList.innerHTML = "";

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "faq-item";
        empty.setAttribute("data-animate", "fade-up");
        empty.style.paddingBottom = "16px";
        empty.textContent = "Пока нет вопросов в этом разделе.";
        faqList.appendChild(empty);
        return;
      }

      items.forEach(function (it, idx) {
        faqList.appendChild(createFaqItem(it, idx, key));
      });

      // Hook into global scroll animations (defined in main.js).
      if (window.BCScrollAnimations && typeof window.BCScrollAnimations.refresh === "function") {
        window.BCScrollAnimations.refresh(faqList);
      }
    }

    function switchTab(key) {
      const normalized = key in FAQ ? key : "open";
      setTabsActive(normalized);

      // Small visual reset for accordion heights.
      faqList.querySelectorAll(".faq-item.is-open").forEach(closeItem);

      renderFaq(normalized);
    }

    // Tabs events
    tabButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchTab(btn.dataset.faqTab || "open");
      });

      // Keyboard: allow arrow navigation between tabs.
      btn.addEventListener("keydown", function (e) {
        const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
        if (!keys.includes(e.key)) return;
        e.preventDefault();

        const currentIndex = tabButtons.indexOf(btn);
        let nextIndex = currentIndex;

        if (e.key === "ArrowLeft") nextIndex = Math.max(0, currentIndex - 1);
        if (e.key === "ArrowRight") nextIndex = Math.min(tabButtons.length - 1, currentIndex + 1);
        if (e.key === "Home") nextIndex = 0;
        if (e.key === "End") nextIndex = tabButtons.length - 1;

        const next = tabButtons[nextIndex];
        if (next) next.focus();
      });
    });

    // Keep open item height correct after layout changes.
    window.addEventListener(
      "resize",
      function () {
        const open = faqList.querySelector(".faq-item.is-open");
        if (!open) return;
        const ans = open.querySelector(".faq-a");
        const inner = open.querySelector(".faq-a-inner");
        if (!ans || !inner) return;
        if (!prefersReducedMotion) ans.style.maxHeight = inner.scrollHeight + "px";
      },
      { passive: true }
    );

    // Init
    const initialKey =
      (tabButtons.find(function (b) {
        return b.classList.contains("is-active");
      }) || tabButtons[0]).dataset.faqTab || "open";

    switchTab(initialKey);
  }

  /* ==========================
     About: photo exposure cycling
     ========================== */

  function initAboutMediaCycle() {
    const wraps = Array.from(document.querySelectorAll(".media-cycle[data-cycle-sources]"));
    if (!wraps.length) return;
    if (prefersReducedMotion) return;

    const INTERVAL_MS = 5000;
    const ROW_DELAY_MS = 300;

    function parseSources(node) {
      return String(node.dataset.cycleSources || "")
        .split("|")
        .map(function (s) {
          return String(s || "").trim();
        })
        .filter(Boolean);
    }

    function getDir(node) {
      const d = String(node.dataset.cycleDir || "left").toLowerCase();
      return d === "right" ? "right" : "left";
    }

    function ensureImgs(node, sources) {
      let imgs = Array.from(node.querySelectorAll("img.media-cycle-img"));

      if (imgs.length >= 2) return imgs.slice(0, 2);

      node.innerHTML = "";
      const img1 = document.createElement("img");
      img1.className = "media-cycle-img is-active";
      img1.alt = "";
      img1.loading = "lazy";
      img1.src = sources[0] || "";

      const img2 = document.createElement("img");
      img2.className = "media-cycle-img";
      img2.alt = "";
      img2.loading = "lazy";
      img2.src = sources[1] || sources[0] || "";

      node.appendChild(img1);
      node.appendChild(img2);

      imgs = [img1, img2];
      return imgs;
    }

    function swapOne(node) {
      const state = node.__cycleState;
      if (!state || state.busy) return;

      const sources = state.sources;
      if (sources.length < 2) return;

      const imgs = state.imgs;
      const dir = state.dir;

      const active = imgs.find(function (i) {
        return i.classList.contains("is-active");
      }) || imgs[0];

      const other = active === imgs[0] ? imgs[1] : imgs[0];

      state.busy = true;

      // next src
      state.index = (state.index + 1) % sources.length;
      other.src = sources[state.index];

      const inStart = dir === "left" ? "translate3d(100%,0,0)" : "translate3d(-100%,0,0)";
      const outEnd = dir === "left" ? "translate3d(-100%,0,0)" : "translate3d(100%,0,0)";

      // prepare
      other.classList.add("is-active");
      other.style.transition = "none";
      active.style.transition = "none";

      other.style.transform = inStart;
      other.style.opacity = "0.78";
      active.style.transform = "translate3d(0,0,0)";
      active.style.opacity = "1";

      // force layout
      other.getBoundingClientRect();

      // animate
      other.style.transition = "";
      active.style.transition = "";

      requestAnimationFrame(function () {
        active.style.transform = outEnd;
        active.style.opacity = "0";
        other.style.transform = "translate3d(0,0,0)";
        other.style.opacity = "1";
      });

      window.setTimeout(function () {
        active.classList.remove("is-active");
        active.style.transition = "none";
        active.style.transform = "translate3d(0,0,0)";
        active.style.opacity = "";

        other.style.transition = "none";
        other.style.transform = "translate3d(0,0,0)";
        other.style.opacity = "";

        // force layout, then restore transitions
        active.getBoundingClientRect();
        active.style.transition = "";
        other.style.transition = "";

        state.busy = false;
      }, 500);
    }

    // init states
    wraps.forEach(function (node) {
      const sources = parseSources(node);
      if (sources.length < 2) return;

      const imgs = ensureImgs(node, sources);
      imgs[0].src = sources[0];
      imgs[0].classList.add("is-active");
      imgs[1].classList.remove("is-active");
      imgs[1].src = sources[1] || sources[0];

      node.__cycleState = {
        sources: sources,
        imgs: imgs,
        dir: getDir(node),
        index: 0,
        busy: false
      };
    });

    // timers
    let timer = 0;

    function tick() {
      wraps.forEach(function (node, idx) {
        window.setTimeout(function () {
          swapOne(node);
        }, idx * ROW_DELAY_MS);
      });
    }

    function start() {
      if (timer) return;
      timer = window.setInterval(tick, INTERVAL_MS);
    }

    function stop() {
      if (!timer) return;
      window.clearInterval(timer);
      timer = 0;
    }

    // Start with delay so first exposure isn't immediate.
    window.setTimeout(function () {
      if (!document.hidden) tick();
      start();
    }, INTERVAL_MS);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });
  }

  initHomeAnnouncements();
  initFaq();
  initAboutMediaCycle();
})();
