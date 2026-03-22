(function () {
  "use strict";

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function initHomeAnnouncementsLegacy() {
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
            "<ul><li>аудитории и залы университета</li><li>партнёрские площадки</li><li>коворкинги</li></ul>"
        },
        {
          q: "Как попасть на открытые мероприятия клуба?",
          bullets: [
            "Откройте анонс мероприятия в соцсетях или на сайте.",
            "Перейдите по ссылке на регистрацию.",
            "Дождитесь подтверждения, если оно предусмотрено, и приходите вовремя."
          ]
        },
        {
          q: "Можно ли прийти, если я не студент МГУ?",
          bullets: [
            "Да — на многие открытые мероприятия можно попасть всем желающим, если это указано в анонсе.",
            "Для некоторых форматов действует приоритет по спискам, например для студентов или выпускников.",
            "Правила входа всегда прописаны в регистрации и посте-анонсе."
          ]
        },
        {
          q: "Можно ли передать билет или регистрацию другу?",
          bullets: [
            "Зависит от формата и площадки: иногда именные списки обязательны.",
            "Если есть возможность передачи, это будет указано в регистрации.",
            "Если сомневаетесь — напишите организаторам в Telegram."
          ]
        },
        {
          q: "Как узнать расписание и анонсы открытых встреч?",
          aHtml: "Всё самое актуальное — в нашем <a href=\"https://t.me/bcmsu\" target=\"_blank\" rel=\"noopener noreferrer\">Telegram-канале</a>. Там выходят анонсы, посты с итогами прошедших мероприятий и объявления."
        },
        {
          q: "Будут ли записи трансляций для тех, кто не попал?",
          aHtml: "Трансляции и записи мы не делаем, но после мероприятий публикуем посты, чтобы вы были в курсе прошедшего, даже если не смогли прийти."
        },
        {
          q: "Участие бесплатное или нужен взнос?",
          aHtml: "Все открытые мероприятия клуба бесплатные."
        }
      ],
      team: [
        {
          q: "Как попасть в команду организаторов?",
          bullets: [
            "Периодически мы открываем набор новых организаторов.",
            "Следите за анонсами в Telegram-канале — там появляются условия вступления и контакты для связи.",
            "Откликайтесь на набор и будьте готовы коротко рассказать о себе и о том, чем хотите заниматься."
          ]
        },
        {
          q: "Нужно ли иметь опыт организации мероприятий?",
          bullets: [
            "Не обязательно — мы даём вводную и поддержку.",
            "Важно желание делать результат и ответственность за свой участок работы.",
            "Опыт — это плюс, но не барьер."
          ]
        },
        {
          q: "Кто входит в команду клуба и как с вами связаться?",
          aHtml: "Команда — это студенты МГУ, которые развивают Бизнес-клуб. Связаться с нами можно через <a href=\"https://t.me/bcmsu\" target=\"_blank\" rel=\"noopener noreferrer\">Telegram</a> или форму обратной связи на сайте."
        },
        {
          q: "Какие задачи обычно берут на себя организаторы?",
          bullets: [
            "SMM и написание постов.",
            "Ивент-менеджмент и помощь спикерам.",
            "Фандрайзинг и работа с партнёрами.",
            "Фото, видео, дизайн, PR и техническая поддержка."
          ]
        },
        {
          q: "Дают ли сертификаты или рекомендации после работы в команде?",
          aHtml: "Да, активные участники команды могут получить письмо-рекомендацию или сертификат об организаторском опыте — это обсуждается индивидуально."
        }
      ],
      closed: [
        {
          q: "Что такое закрытый клуб и чем он отличается от открытых мероприятий?",
          bullets: [
            "Закрытый клуб — это сообщество резидентов, которые работают над своими проектами системно.",
            "Здесь больше экспертизы, доступа к менторам и инвесторам.",
            "Встречи проходят в узком кругу и предполагают более глубокую вовлечённость."
          ]
        },
        {
          q: "Кто может стать резидентом? Есть ли отбор?",
          bullets: [
            "Да, отбор есть.",
            "Мы смотрим на мотивацию, наличие проекта или идеи и готовность участвовать в жизни клуба.",
            "Подойдём, если вы уже что-то делаете или чётко понимаете, что хотите запускать."
          ]
        },
        {
          q: "Какие привилегии получают резиденты?",
          bullets: [
            "Закрытые встречи с основателями крупных компаний и предпринимателями.",
            "Мастермайнды и разборы бизнес-кейсов участников.",
            "Инвестиционные сессии и обсуждение проектов.",
            "Бизнес-миссии и специальные форматы, доступные только резидентам."
          ]
        },
        {
          q: "Какие требования для вступления?",
          aHtml:
            "<strong>Предпринимательский трек:</strong> выручка от 10 млн ₽ в год, или чистая прибыль от 1 млн ₽, или привлечённые инвестиции от 5 млн ₽.<br><br>" +
            "<strong>Карьерный трек:</strong> позиции уровня C-suite или руководители направлений с опытом от 2 лет в консалтинге топ-уровня либо компаниях-лидерах рынка.<br><br>" +
            "<strong>Инвестиционный трек:</strong> бизнес-ангелы, партнёры фондов, руководители family offices с подтверждённым опытом инвестиций.<br><br>" +
            "<strong>Rising Stars:</strong> студенты или молодые выпускники МГУ до 27 лет с сильной предпринимательской динамикой и рекомендацией от действующих резидентов."
        },
        {
          q: "Сколько стоит участие?",
          aHtml: "Стоимость зависит от формата и сезона. Актуальные условия — в анонсах и у команды клуба. Напишите нам, и мы подскажем подходящий вариант."
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

  async function initAboutMediaCycle() {
    const wraps = Array.from(document.querySelectorAll(".media-cycle[data-cycle-folder]"));
    if (!wraps.length) return;

    const INTERVAL_MS = 5000;
    const ROW_DELAY_MS = 300;
    const MANIFEST_URL = "/api/about-media-manifest";
    const FALLBACK_IMAGE = "assets/img/card-placeholder.svg";
    let manifestGroups = {};

    try {
      const response = await fetch(MANIFEST_URL, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (payload && typeof payload.groups === "object" && payload.groups) {
          manifestGroups = payload.groups;
        }
      }
    } catch (_error) {
      manifestGroups = {};
    }

    function getDir(node) {
      const d = String(node.dataset.cycleDir || "left").toLowerCase();
      return d === "right" ? "right" : "left";
    }

    function getAlt(node) {
      return String(node.dataset.cycleAlt || "").trim();
    }

    function getSources(node) {
      const folder = String(node.dataset.cycleFolder || "").trim();
      const sources = Array.isArray(manifestGroups[folder]) ? manifestGroups[folder] : [];
      return sources
        .map(function (src) {
          return String(src || "").trim();
        })
        .filter(Boolean);
    }

    function ensureImgs(node, sources, altText) {
      let imgs = Array.from(node.querySelectorAll("img.media-cycle-img"));

      if (imgs.length < 2) {
        node.innerHTML = "";
        const img1 = document.createElement("img");
        img1.className = "media-cycle-img is-active";
        img1.loading = "lazy";

        const img2 = document.createElement("img");
        img2.className = "media-cycle-img";
        img2.loading = "lazy";
        img2.alt = "";
        img2.setAttribute("aria-hidden", "true");

        node.appendChild(img1);
        node.appendChild(img2);
        imgs = [img1, img2];
      }

      const primarySrc = sources[0] || FALLBACK_IMAGE;
      const secondarySrc = sources[1] || primarySrc;

      imgs[0].src = primarySrc;
      imgs[0].alt = altText;
      imgs[0].classList.add("is-active");
      imgs[0].removeAttribute("aria-hidden");

      imgs[1].src = secondarySrc;
      imgs[1].alt = "";
      imgs[1].classList.remove("is-active");
      imgs[1].setAttribute("aria-hidden", "true");

      return imgs.slice(0, 2);
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

    const activeWraps = [];

    wraps.forEach(function (node) {
      const sources = getSources(node);
      const imgs = ensureImgs(node, sources, getAlt(node));

      node.__cycleState = {
        sources: sources,
        imgs: imgs,
        dir: getDir(node),
        index: 0,
        busy: false
      };

      node.classList.add("media-cycle-ready");

      if (!prefersReducedMotion && sources.length > 1) {
        activeWraps.push(node);
      }
    });

    if (!activeWraps.length) return;

    let timer = 0;

    function tick() {
      activeWraps.forEach(function (node, idx) {
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

    window.setTimeout(function () {
      if (!document.hidden) tick();
      start();
    }, INTERVAL_MS);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });
  }

  function initHomeAnnouncements() {
    const section = document.getElementById("events");
    if (!section) return;

    const marqueeTrack = section.querySelector(".events-marquee-track");
    const list = section.querySelector(".events-grid:not(.events-grid--live)");
    if (!marqueeTrack || !list) return;

    const shell = document.getElementById("home-announcements-shell");
    const DATA_URL = "assets/data/events.json";
    const HOME_LIMIT = 4;
    const PAST_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;
    const MAX_HOME_DELTA_MS = 120 * 24 * 60 * 60 * 1000;
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

    function canonicalUrl(value) {
      const raw = safeText(value);
      if (!raw) return "";

      try {
        const parsed = new URL(raw, window.location.href);
        const path = parsed.pathname.replace(/\/+$/, "") || "/";
        return (parsed.protocol + "//" + parsed.host.toLowerCase() + path + parsed.search).toLowerCase();
      } catch (_error) {
        return raw.toLowerCase();
      }
    }

    function isTelegramInternalUrl(value) {
      const raw = safeText(value).toLowerCase();
      if (!raw) return true;
      if (raw.startsWith("tg://") || raw.startsWith("?q=")) return true;

      try {
        const parsed = new URL(raw, window.location.href);
        return parsed.hostname.endsWith("t.me") || parsed.hostname.endsWith("telegram.me");
      } catch (_error) {
        return true;
      }
    }

    function isNonRegistrationUrl(value) {
      const raw = safeText(value).toLowerCase();
      if (!raw) return true;
      if (isTelegramInternalUrl(raw)) return true;

      return [
        "vk.com/album",
        "vk.ru/album",
        "instagram.com/p/",
        "instagram.com/reel/",
        "youtube.com/watch",
        "youtu.be/"
      ].some(function (pattern) {
        return raw.includes(pattern);
      });
    }

    function formatStart(value) {
      const date = parseIso(value);
      if (!date) return "Дата уточняется";

      const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
      return hasTime ? ruDateTime.format(date) : ruDate.format(date);
    }

    function renderMarquee(items) {
      const titles = items
        .map(function (item) {
          return safeText(item.title);
        })
        .filter(Boolean);

      if (!titles.length) return;

      const cycles = Math.max(2, Math.ceil(10 / titles.length));
      const fragment = document.createDocumentFragment();
      marqueeTrack.innerHTML = "";

      for (let round = 0; round < cycles; round += 1) {
        titles.forEach(function (title) {
          const item = document.createElement("span");
          item.className = "marquee-item";
          item.textContent = title;
          fragment.appendChild(item);

          const separator = document.createElement("span");
          separator.className = "marquee-separator";
          separator.setAttribute("aria-hidden", "true");
          separator.textContent = "♦";
          fragment.appendChild(separator);
        });
      }

      marqueeTrack.appendChild(fragment);
    }

    function buildCardHref(item) {
      return safeText(item.registration_url) || safeText(item.source_post_url) || "events.html";
    }

    function renderCard(item, index) {
      const card = document.createElement("article");
      card.className = "event-card event-card--home-auto neon-panel lift-on-hover";
      card.setAttribute("data-animate", index % 2 === 0 ? "fade-up" : "scale-in");

      const link = document.createElement("a");
      link.className = "event-card-home-link";
      link.href = buildCardHref(item);
      if (/^https?:\/\//i.test(link.href)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }

      const media = document.createElement("img");
      media.className = "event-card-home-media";
      media.loading = "lazy";
      media.src = safeText(item.cover_image) || "assets/img/events.jpg";
      media.alt = safeText(item.title) || "Анонс мероприятия";

      const body = document.createElement("div");
      body.className = "event-card-home-body";

      const date = document.createElement("p");
      date.className = "event-card-home-date";
      date.textContent = formatStart(item.start_at);

      const title = document.createElement("h3");
      title.className = "event-card-home-title";
      title.textContent = safeText(item.title) || "РђРЅРѕРЅСЃ";

      const meta = document.createElement("p");
      meta.className = "event-card-home-meta";
      meta.textContent = safeText(item.location) || "РњРµСЃС‚Рѕ СѓС‚РѕС‡РЅСЏРµС‚СЃСЏ";

      body.appendChild(date);
      body.appendChild(title);
      body.appendChild(meta);
      link.appendChild(media);
      link.appendChild(body);
      card.appendChild(link);
      return card;
    }

    function isHomeCandidate(item, now) {
      if (safeText(item.content_kind) !== "announcement") return false;

      const start = parseIso(item.start_at);
      if (!start || start.getTime() < now.getTime() - PAST_WINDOW_MS) return false;

      const registrationUrl = safeText(item.registration_url);
      if (!registrationUrl || isNonRegistrationUrl(registrationUrl)) return false;

      const published = parseIso(item.published_at);
      if (published) {
        const delta = start.getTime() - published.getTime();
        if (delta < -2 * 24 * 60 * 60 * 1000) return false;
        if (delta > MAX_HOME_DELTA_MS) return false;
      }

      return true;
    }

    function homeSignature(item) {
      return [
        safeText(item.title).toLowerCase(),
        safeText(item.start_at),
        canonicalUrl(item.registration_url)
      ].join("|");
    }

    function compareHomeItems(a, b, now) {
      const aStart = parseIso(a.start_at);
      const bStart = parseIso(b.start_at);
      const aPublished = parseIso(a.published_at);
      const bPublished = parseIso(b.published_at);

      function rank(start, published) {
        if (!start) return [2, Number.POSITIVE_INFINITY, 0];
        if (start.getTime() >= now.getTime()) {
          return [0, start.getTime(), -1 * (published ? published.getTime() : 0)];
        }
        return [1, -1 * start.getTime(), -1 * (published ? published.getTime() : 0)];
      }

      const aRank = rank(aStart, aPublished);
      const bRank = rank(bStart, bPublished);

      for (let index = 0; index < aRank.length; index += 1) {
        if (aRank[index] !== bRank[index]) return aRank[index] - bRank[index];
      }
      return 0;
    }

    function pickHomeItems(events) {
      const now = new Date();
      const candidates = Array.isArray(events)
        ? events.filter(function (item) {
            return isHomeCandidate(item, now);
          })
        : [];
      const unique = [];
      const seen = new Set();

      candidates.forEach(function (item) {
        const signature = homeSignature(item);
        if (seen.has(signature)) return;
        seen.add(signature);
        unique.push(item);
      });

      unique.sort(function (a, b) {
        return compareHomeItems(a, b, now);
      });

      return unique.slice(0, HOME_LIMIT);
    }

    async function loadAnnouncements() {
      try {
        const response = await fetch(DATA_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);

        const payload = await response.json();
        const items = pickHomeItems(payload.events);

        if (!items.length) {
          if (shell) shell.hidden = true;
          return;
        }

        list.innerHTML = "";
        items.forEach(function (item, index) {
          list.appendChild(renderCard(item, index));
        });
        renderMarquee(items);

        if (shell) shell.hidden = true;

        if (window.BCScrollAnimations && typeof window.BCScrollAnimations.refresh === "function") {
          window.BCScrollAnimations.refresh(section);
        }
      } catch (_error) {
        if (shell) shell.hidden = true;
      }
    }

    loadAnnouncements();
  }

  initHomeAnnouncements();
  initFaq();
  initAboutMediaCycle();
})();
