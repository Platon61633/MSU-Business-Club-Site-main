(function () {
  "use strict";

  const root = document.getElementById("closed-club-page");
  if (!root) return;

  const tabs = Array.from(document.querySelectorAll(".format-tab[data-format]"));
  const stage = document.getElementById("format-stage");
  const title = document.getElementById("format-title");
  const text = document.getElementById("format-text");
  const tags = document.getElementById("format-tags");

  if (!tabs.length || !stage || !title || !text || !tags) return;

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const DATA = {
    mastermind: {
      title: "Мастермайнд",
      text:
        "6–10 резидентов, модератор и 2–3 запроса на встречу. Разбираем ситуацию, предлагаем гипотезы и фиксируем конкретные действия до следующей встречи.",
      tags: ["Разбор", "Гипотезы", "Action plan"]
    },
    fireside: {
      title: "Fireside chat",
      text:
        "Закрытая беседа с предпринимателем без публичности и лишнего шума. Формат — вопросы по делу, честные детали и «как было на самом деле».",
      tags: ["Опыт", "Вопросы", "Без записи"]
    },
    workshop: {
      title: "Work session",
      text:
        "Практическая сессия: рынок, продажи, стратегия, позиционирование. Уходим не с идеями, а с конкретным набором решений и задач.",
      tags: ["Практика", "Метрики", "Фреймворки"]
    },
    one2one: {
      title: "1:1",
      text:
        "Точечные интро и консультации: когда нужен один сильный контакт, один совет или один быстрый созвон, чтобы сдвинуться с места.",
      tags: ["Интро", "Консультации", "Скорость"]
    }
  };

  function clampIndex(n) {
    if (n < 0) return 0;
    if (n >= tabs.length) return tabs.length - 1;
    return n;
  }

  function getKeyByIndex(idx) {
    const tab = tabs[idx];
    return (tab && tab.dataset.format) || "mastermind";
  }

  function render(key) {
    const row = DATA[key] || DATA.mastermind;

    title.textContent = row.title;
    text.textContent = row.text;

    tags.innerHTML = "";
    row.tags.forEach((t) => {
      const span = document.createElement("span");
      span.className = "tag-pill";
      span.textContent = t;
      tags.appendChild(span);
    });
  }

  const initialIndex = tabs.findIndex((t) => t.classList.contains("is-active"));
  let currentIdx = initialIndex >= 0 ? initialIndex : 0;

  function setActiveByIndex(nextIdx, shouldFocus) {
    const idx = clampIndex(nextIdx);
    if (idx === currentIdx) return;

    currentIdx = idx;
    const key = getKeyByIndex(currentIdx);

    tabs.forEach((btn, i) => {
      const isActive = i === currentIdx;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    if (shouldFocus && tabs[currentIdx]) {
      tabs[currentIdx].focus({ preventScroll: true });
      tabs[currentIdx].scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest"
      });
    }

    if (prefersReducedMotion) {
      render(key);
      return;
    }

    stage.classList.add("is-swapping");
    window.setTimeout(function () {
      render(key);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          stage.classList.remove("is-swapping");
        });
      });
    }, 170);
  }

  function init() {
    const initialKey = getKeyByIndex(currentIdx);
    tabs.forEach((btn, i) => {
      const isActive = i === currentIdx;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
    render(initialKey);
  }

  tabs.forEach((btn, idx) => {
    btn.addEventListener("click", function () {
      setActiveByIndex(idx, true);
    });

    btn.addEventListener("keydown", function (e) {
      const key = e.key;
      if (key === "ArrowDown" || key === "ArrowRight") {
        e.preventDefault();
        setActiveByIndex(currentIdx + 1, true);
      }
      if (key === "ArrowUp" || key === "ArrowLeft") {
        e.preventDefault();
        setActiveByIndex(currentIdx - 1, true);
      }
      if (key === "Home") {
        e.preventDefault();
        setActiveByIndex(0, true);
      }
      if (key === "End") {
        e.preventDefault();
        setActiveByIndex(tabs.length - 1, true);
      }
    });
  });

  init();
})();
