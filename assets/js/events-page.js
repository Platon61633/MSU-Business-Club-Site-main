(function () {
  "use strict";

  const DATA_URL = "assets/data/events.json";

  const listNode = document.getElementById("events-archive-list");
  if (!listNode) return;

  const metaNode = document.getElementById("events-archive-meta");
  const loadingNode = document.getElementById("events-loading");
  const errorNode = document.getElementById("events-error");

  const searchInput = document.getElementById("events-search");
  const yearSelect = document.getElementById("events-year");
  const statusSelect = document.getElementById("events-status");
  const resetBtn = document.getElementById("events-reset");

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ruDate = new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "long",
    day: "2-digit"
  });
  const ruDateTime = new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  function safeText(text) {
    return String(text || "").trim();
  }

  function normalizeText(text) {
    return safeText(text).toLowerCase();
  }

  function parseIso(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  function getPrimaryDate(ev) {
    return parseIso(ev.start_at) || parseIso(ev.published_at);
  }

  function getYear(ev) {
    const d = getPrimaryDate(ev);
    return d ? d.getFullYear() : null;
  }

  function classifyStatus(ev, now) {
    const start = parseIso(ev.start_at);
    if (!start) return "nodate";
    return start.getTime() >= now.getTime() ? "upcoming" : "past";
  }

  function formatWhen(ev) {
    const start = parseIso(ev.start_at);
    const published = parseIso(ev.published_at);

    if (start) {
      return {
        label: "Когда",
        value: ruDateTime.format(start)
      };
    }

    if (published) {
      return {
        label: "Опубликовано",
        value: ruDate.format(published)
      };
    }

    return {
      label: "Дата",
      value: "не указана"
    };
  }

  function createBadge(text, extraClass) {
    const span = document.createElement("span");
    span.className = "badge" + (extraClass ? " " + extraClass : "");
    span.textContent = text;
    return span;
  }

  function render(events) {
    listNode.innerHTML = "";

    if (!events.length) {
      const empty = document.createElement("div");
      empty.className = "neon-panel";
      empty.style.padding = "16px";
      empty.textContent = "Ничего не найдено по выбранным фильтрам.";
      listNode.appendChild(empty);
      return;
    }

    // группировка по годам (по убыванию)
    const byYear = new Map();
    events.forEach(function (ev) {
      const y = getYear(ev) || "Без даты";
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y).push(ev);
    });

    const yearsSorted = Array.from(byYear.keys()).sort(function (a, b) {
      if (a === "Без даты") return 1;
      if (b === "Без даты") return -1;
      return Number(b) - Number(a);
    });

    yearsSorted.forEach(function (year) {
      const h = document.createElement("h2");
      h.className = "year-divider";
      h.textContent = String(year);
      listNode.appendChild(h);

      const group = byYear.get(year) || [];
      group.forEach(function (ev) {
        const card = document.createElement("article");
        card.className = "event-archive-card neon-panel";

        const head = document.createElement("div");
        head.className = "event-archive-head";

        const titleWrap = document.createElement("div");
        titleWrap.style.minWidth = "0";

        const title = document.createElement("h3");
        title.className = "event-archive-title";
        title.textContent = safeText(ev.title) || "Событие";

        const when = formatWhen(ev);
        const body = document.createElement("p");
        body.className = "event-archive-body";
        const loc = safeText(ev.location);

        body.textContent =
          (when.label + ": " + when.value) + (loc ? " • Место: " + loc : "");

        titleWrap.appendChild(title);
        titleWrap.appendChild(body);

        const badges = document.createElement("div");
        badges.className = "event-badges";

        const now = new Date();
        const status = classifyStatus(ev, now);
        if (status === "upcoming") badges.appendChild(createBadge("Будущее", "badge--ok"));
        if (status === "past") badges.appendChild(createBadge("Прошедшее", "badge--muted"));
        if (status === "nodate") badges.appendChild(createBadge("Без даты", "badge--muted"));

        if (ev.registration_url) badges.appendChild(createBadge("Регистрация"));

        head.appendChild(titleWrap);
        head.appendChild(badges);

        const links = document.createElement("div");
        links.className = "event-links";

        if (ev.registration_url) {
          const a = document.createElement("a");
          a.href = ev.registration_url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = "Ссылка / регистрация";
          links.appendChild(a);
        }

        if (ev.source_post_url) {
          const a2 = document.createElement("a");
          a2.href = ev.source_post_url;
          a2.target = "_blank";
          a2.rel = "noopener noreferrer";
          a2.textContent = "Пост в Telegram";
          links.appendChild(a2);
        }

        // Детали (сырой текст) — удобно для админов
        const details = document.createElement("details");
        details.className = "event-details";

        const summary = document.createElement("summary");
        summary.textContent = "Текст анонса";
        details.appendChild(summary);

        const pre = document.createElement("pre");
        pre.textContent = safeText(ev.raw_text) || "—";
        details.appendChild(pre);

        if (prefersReducedMotion) {
          details.open = false;
        }

        card.appendChild(head);
        card.appendChild(links);
        card.appendChild(details);

        listNode.appendChild(card);
      });
    });
  }

  function buildYearOptions(events) {
    if (!yearSelect) return;
    const years = new Set();
    events.forEach(function (ev) {
      const y = getYear(ev);
      if (y) years.add(y);
    });

    const sorted = Array.from(years).sort(function (a, b) {
      return b - a;
    });

    // очистить, но оставить "Все годы"
    const keepFirst = yearSelect.querySelector("option[value='']");
    yearSelect.innerHTML = "";
    if (keepFirst) yearSelect.appendChild(keepFirst);

    sorted.forEach(function (y) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    });
  }

  function applyFilters(allEvents) {
    const q = normalizeText(searchInput ? searchInput.value : "");
    const year = yearSelect ? String(yearSelect.value || "") : "";
    const status = statusSelect ? String(statusSelect.value || "") : "";

    const now = new Date();

    const filtered = allEvents.filter(function (ev) {
      if (year) {
        const y = getYear(ev);
        if (!y || String(y) !== year) return false;
      }

      if (status) {
        const st = classifyStatus(ev, now);
        if (st !== status) return false;
      }

      if (q) {
        const hay =
          normalizeText(ev.title) +
          " " +
          normalizeText(ev.location) +
          " " +
          normalizeText(ev.raw_text);
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    // сортировка: сначала upcoming (по возрастанию), потом остальное (по убыванию)
    const upcoming = [];
    const rest = [];

    filtered.forEach(function (ev) {
      const st = classifyStatus(ev, now);
      if (st === "upcoming") upcoming.push(ev);
      else rest.push(ev);
    });

    upcoming.sort(function (a, b) {
      return (parseIso(a.start_at).getTime() || 0) - (parseIso(b.start_at).getTime() || 0);
    });

    rest.sort(function (a, b) {
      const da = getPrimaryDate(a);
      const db = getPrimaryDate(b);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });

    return upcoming.concat(rest);
  }

  function updateMeta(allCount, shownCount, generatedAt) {
    if (!metaNode) return;
    const ga = generatedAt ? parseIso(generatedAt) : null;
    const genText = ga ? (" • обновлено: " + ruDateTime.format(ga)) : "";
    metaNode.textContent =
      "Событий в базе: " + allCount + " • показано: " + shownCount + genText;
  }

  function setLoading(isLoading) {
    if (!loadingNode) return;
    loadingNode.hidden = !isLoading;
  }

  function setError(message) {
    if (!errorNode) return;
    errorNode.hidden = !message;
    errorNode.textContent = message || "";
  }

  let ALL_EVENTS = [];
  let GENERATED_AT = null;
  let debounceTimer = 0;

  function rerender() {
    const filtered = applyFilters(ALL_EVENTS);
    render(filtered);
    updateMeta(ALL_EVENTS.length, filtered.length, GENERATED_AT);
  }

  function debounceRerender() {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(rerender, 160);
  }

  async function load() {
    setError("");
    setLoading(true);

    try {
      const resp = await fetch(DATA_URL, { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);

      const payload = await resp.json();
      const events = Array.isArray(payload.events) ? payload.events : [];
      ALL_EVENTS = events;
      GENERATED_AT = payload.generated_at || null;

      buildYearOptions(ALL_EVENTS);
      rerender();
    } catch (e) {
      setError(
        "Не удалось загрузить базу мероприятий. " +
          "Проверьте, что сайт открыт через локальный сервер (а не file://), " +
          "и что файл " +
          DATA_URL +
          " доступен."
      );
    } finally {
      setLoading(false);
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", debounceRerender);
  }
  if (yearSelect) {
    yearSelect.addEventListener("change", rerender);
  }
  if (statusSelect) {
    statusSelect.addEventListener("change", rerender);
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      if (yearSelect) yearSelect.value = "";
      if (statusSelect) statusSelect.value = "";
      rerender();
    });
  }

  load();
})();