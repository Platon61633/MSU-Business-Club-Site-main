(function () {
  "use strict";

  const root = document.getElementById("accelerator-page");
  if (!root) return;

  const steps = Array.from(document.querySelectorAll(".timeline-step"));
  const detail = document.getElementById("timeline-detail");
  if (!steps.length || !detail) return;

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const DATA = [
    {
      eyebrow: "Неделя 1",
      title: "Диагностика и фокус",
      bullets: [
        "фиксируем текущую стадию и цель на 8 недель",
        "формируем список гипотез и план проверок",
        "выбираем метрики, по которым считаем прогресс"
      ]
    },
    {
      eyebrow: "Неделя 2",
      title: "Проблема, сегменты и ICP",
      bullets: [
        "интервью и сбор инсайтов (JTBD)",
        "описание целевого сегмента и болей",
        "формулируем чёткое ценностное предложение"
      ]
    },
    {
      eyebrow: "Неделя 3",
      title: "Решение и прототип",
      bullets: [
        "проверяем основные сценарии и UX",
        "собираем быстрый прототип/лендинг",
        "получаем первые сигналы спроса"
      ]
    },
    {
      eyebrow: "Неделя 4",
      title: "MVP и первые пользователи",
      bullets: [
        "собираем минимально рабочий продукт",
        "выходим к ранним пользователям",
        "фиксируем обратную связь и итерации"
      ]
    },
    {
      eyebrow: "Неделя 5",
      title: "Продажи и тест канала",
      bullets: [
        "выбираем 1–2 канала привлечения",
        "делаем первые продажи/предзаказы",
        "докручиваем оффер и коммуникацию"
      ]
    },
    {
      eyebrow: "Неделя 6",
      title: "Метрики и юнит-экономика",
      bullets: [
        "считаем LTV/CAC и конверсии",
        "строим простую воронку и когорты",
        "определяем, что масштабировать дальше"
      ]
    },
    {
      eyebrow: "Неделя 7",
      title: "Питч и сторителлинг",
      bullets: [
        "делаем структуру питча и deck",
        "упаковываем позиционирование",
        "репетируем Q&A и возражения"
      ]
    },
    {
      eyebrow: "Неделя 8",
      title: "Demo Day и next steps",
      bullets: [
        "финальный питч и фидбек",
        "интро и дальнейшие треки",
        "план на 30/60/90 дней"
      ]
    }
  ];

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getActiveIndex() {
    const idx = steps.findIndex((b) => b.classList.contains("is-active"));
    return idx >= 0 ? idx : 0;
  }

  function ensureDetailSkeleton() {
    let eyebrow = detail.querySelector(".eyebrow");
    if (!eyebrow) {
      eyebrow = document.createElement("p");
      eyebrow.className = "eyebrow";
      detail.prepend(eyebrow);
    }

    let title = detail.querySelector("h3");
    if (!title) {
      title = document.createElement("h3");
      detail.appendChild(title);
    }

    let list = detail.querySelector("ul");
    if (!list) {
      list = document.createElement("ul");
      detail.appendChild(list);
    }

    return { eyebrow, title, list };
  }

  function renderDetail(i) {
    const { eyebrow, title, list } = ensureDetailSkeleton();
    const row = DATA[i] || DATA[0];

    eyebrow.textContent = row.eyebrow;
    title.textContent = row.title;

    list.innerHTML = "";
    row.bullets.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
  }

  let current = clamp(getActiveIndex(), 0, DATA.length - 1);

  function setActive(i, shouldFocus) {
    const next = clamp(i, 0, DATA.length - 1);
    if (next === current) return;

    current = next;

    steps.forEach((btn, idx) => {
      const isActive = idx === current;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    if (shouldFocus && steps[current]) {
      steps[current].focus({ preventScroll: true });
      steps[current].scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        inline: "center",
        block: "nearest"
      });
    }

    if (prefersReducedMotion) {
      renderDetail(current);
      return;
    }

    detail.classList.add("is-swapping");
    window.setTimeout(function () {
      renderDetail(current);
      // double rAF to make sure transition triggers
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          detail.classList.remove("is-swapping");
        });
      });
    }, 170);
  }

  function setActiveInitial() {
    steps.forEach((btn, idx) => {
      const isActive = idx === current;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
    renderDetail(current);
  }

  steps.forEach((btn, idx) => {
    btn.addEventListener("click", function () {
      setActive(idx, true);
    });

    btn.addEventListener("keydown", function (e) {
      const key = e.key;
      if (key === "ArrowRight" || key === "ArrowDown") {
        e.preventDefault();
        setActive(current + 1, true);
      }
      if (key === "ArrowLeft" || key === "ArrowUp") {
        e.preventDefault();
        setActive(current - 1, true);
      }
      if (key === "Home") {
        e.preventDefault();
        setActive(0, true);
      }
      if (key === "End") {
        e.preventDefault();
        setActive(DATA.length - 1, true);
      }
    });
  });

  // init
  setActiveInitial();
})();
