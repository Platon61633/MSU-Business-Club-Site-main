(function () {
  "use strict";

  const DATA_URL = "assets/data/forum-stats.json";

  const root = document.getElementById("forum-page");
  if (!root) return;

  const loadingNode = document.getElementById("forum-loading");
  const errorNode = document.getElementById("forum-error");
  const metaNode = document.getElementById("forum-meta");

  const statParticipants = document.getElementById("stat-participants");
  const statApplications = document.getElementById("stat-applications");
  const statSpeakers = document.getElementById("stat-speakers");
  const statPartners = document.getElementById("stat-partners");

  const metricButtons = Array.from(document.querySelectorAll("[data-metric]"));

  const svg = document.getElementById("forum-chart-svg");
  const captionNode = document.getElementById("forum-chart-caption");

  const yearTabs = document.getElementById("year-tabs");
  const yearDetail = document.getElementById("year-detail");

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const nf = new Intl.NumberFormat("ru-RU");

  const METRICS = {
    participants: {
      label: "Участники",
      caption: "Количество участников форума по годам.",
      format: function (v) {
        return nf.format(v);
      }
    },
    applications: {
      label: "Заявки",
      caption: "Количество заявок на участие по годам.",
      format: function (v) {
        return nf.format(v);
      }
    },
    speakers: {
      label: "Спикеры",
      caption: "Количество спикеров по годам.",
      format: function (v) {
        return nf.format(v);
      }
    },
    speaker_capital_bln_rub: {
      label: "Капитал спикеров",
      caption: "Суммарный капитал спикеров (условно) по годам.",
      format: function (v) {
        return nf.format(v) + " млрд ₽";
      }
    }
  };

  function safeText(s) {
    return String(s || "").trim();
  }

  function setLoading(isLoading) {
    if (loadingNode) loadingNode.hidden = !isLoading;
  }

  function setError(msg) {
    if (!errorNode) return;
    errorNode.hidden = !msg;
    errorNode.textContent = msg || "";
  }

  function pickLatestYear(rows) {
    return rows.reduce(function (acc, cur) {
      if (!acc) return cur;
      return cur.year > acc.year ? cur : acc;
    }, null);
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function animateCounter(node, toValue) {
    if (!node) return;

    const to = Number(toValue) || 0;
    if (prefersReducedMotion) {
      node.textContent = nf.format(to);
      return;
    }

    const duration = 950;
    const start = performance.now();
    const from = 0;

    function step(ts) {
      const t = clamp((ts - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (to - from) * eased);
      node.textContent = nf.format(value);
      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  function renderStats(latest) {
    if (!latest) return;

    animateCounter(statParticipants, latest.participants);
    animateCounter(statApplications, latest.applications);
    animateCounter(statSpeakers, latest.speakers);
    animateCounter(statPartners, latest.partners);
  }

  function buildYearTabs(rows) {
    if (!yearTabs) return;

    yearTabs.innerHTML = "";

    rows
      .slice()
      .sort(function (a, b) {
        return b.year - a.year;
      })
      .forEach(function (row, idx) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "year-tab";
        btn.textContent = String(row.year);
        btn.dataset.year = String(row.year);
        btn.setAttribute("aria-pressed", "false");

        btn.addEventListener("click", function () {
          selectYear(rows, row.year);
        });

        yearTabs.appendChild(btn);

        // по умолчанию — последний год (самый большой)
        if (idx === 0) {
          selectYear(rows, row.year);
        }
      });
  }

  function selectYear(rows, year) {
    const y = Number(year);
    const row = rows.find(function (r) {
      return r.year === y;
    });
    if (!row) return;

    const buttons = yearTabs ? yearTabs.querySelectorAll(".year-tab") : [];
    buttons.forEach(function (b) {
      const active = Number(b.dataset.year) === y;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });

    renderYearDetail(row);
  }

  function renderYearDetail(row) {
    if (!yearDetail) return;

    yearDetail.innerHTML = "";

    const head = document.createElement("div");
    head.style.display = "grid";
    head.style.gap = "6px";

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Форум " + row.year;

    const title = document.createElement("h2");
    title.textContent = "Итоги в цифрах";

    const note = document.createElement("p");
    note.className = "section-lead";
    note.textContent =
      "Блок сделан так, чтобы можно было просто обновлять данные в JSON без переписывания верстки.";

    head.appendChild(eyebrow);
    head.appendChild(title);
    head.appendChild(note);

    const grid = document.createElement("div");
    grid.className = "year-detail-grid";

    function kpi(value, label) {
      const card = document.createElement("div");
      card.className = "year-kpi mini-panel";
      const strong = document.createElement("strong");
      strong.textContent = value;
      const span = document.createElement("span");
      span.textContent = label;
      card.appendChild(strong);
      card.appendChild(span);
      return card;
    }

    grid.appendChild(kpi(nf.format(row.participants), "участников"));
    grid.appendChild(kpi(nf.format(row.applications), "заявок"));
    grid.appendChild(kpi(nf.format(row.speakers), "спикеров"));
    grid.appendChild(kpi(nf.format(row.partners), "партнёров"));
    grid.appendChild(
      kpi(nf.format(row.speaker_capital_bln_rub) + " млрд ₽", "суммарный капитал спикеров (условно)")
    );

    if (row.notes) {
      const extra = document.createElement("div");
      extra.className = "mini-panel";
      extra.style.padding = "14px";
      extra.style.gridColumn = "1 / -1";
      extra.textContent = safeText(row.notes);
      grid.appendChild(extra);
    }

    yearDetail.appendChild(head);
    yearDetail.appendChild(grid);
  }

  function renderChart(rows, metricKey) {
    if (!svg) return;

    const metric = METRICS[metricKey] || METRICS.participants;

    const width = 1000;
    const height = 300;
    const padX = 56;
    const padY = 34;

    // clean
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    svg.setAttribute("viewBox", "0 0 " + width + " " + height);

    const years = rows.map(function (r) {
      return r.year;
    });
    const values = rows.map(function (r) {
      const v = Number(r[metricKey]) || 0;
      return v;
    });

    const maxV = Math.max.apply(null, values.concat([1]));
    const minV = 0;

    function xAt(i) {
      if (values.length === 1) return padX;
      return padX + (i * (width - padX * 2)) / (values.length - 1);
    }

    function yAt(v) {
      const t = (v - minV) / (maxV - minV);
      return height - padY - t * (height - padY * 2);
    }

    // axis
    const axisX = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axisX.setAttribute("x1", String(padX));
    axisX.setAttribute("x2", String(width - padX));
    axisX.setAttribute("y1", String(height - padY));
    axisX.setAttribute("y2", String(height - padY));
    axisX.setAttribute("class", "chart-axis");
    svg.appendChild(axisX);

    const axisY = document.createElementNS("http://www.w3.org/2000/svg", "line");
    axisY.setAttribute("x1", String(padX));
    axisY.setAttribute("x2", String(padX));
    axisY.setAttribute("y1", String(padY));
    axisY.setAttribute("y2", String(height - padY));
    axisY.setAttribute("class", "chart-axis");
    svg.appendChild(axisY);

    // path
    const d = values
      .map(function (v, i) {
        const x = xAt(i);
        const y = yAt(v);
        return (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1);
      })
      .join(" ");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "chart-line");
    svg.appendChild(path);

    // dots + year labels
    values.forEach(function (v, i) {
      const cx = xAt(i);
      const cy = yAt(v);

      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", cx.toFixed(1));
      dot.setAttribute("cy", cy.toFixed(1));
      dot.setAttribute("r", "5");
      dot.setAttribute("class", "chart-dots");
      svg.appendChild(dot);

      const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
      lbl.setAttribute("x", cx.toFixed(1));
      lbl.setAttribute("y", String(height - 10));
      lbl.setAttribute("text-anchor", "middle");
      lbl.setAttribute("class", "chart-label");
      lbl.textContent = String(years[i]);
      svg.appendChild(lbl);
    });

    // animation
    if (!prefersReducedMotion) {
      try {
        const len = path.getTotalLength();
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(len);
        path.getBoundingClientRect(); // force layout
        path.style.transition = "stroke-dashoffset 1.05s ease";
        path.style.strokeDashoffset = "0";
      } catch (e) {
        // ignore
      }
    }

    if (captionNode) {
      captionNode.textContent = metric.caption;
    }
  }

  function setActiveMetric(metricKey, rows) {
    metricButtons.forEach(function (btn) {
      const isActive = btn.dataset.metric === metricKey;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    renderChart(rows, metricKey);
  }

  function initMetricButtons(rows) {
    if (!metricButtons.length) return;

    metricButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const key = btn.dataset.metric || "participants";
        setActiveMetric(key, rows);
      });
    });
  }

  function updateMeta(payload, latest) {
    if (!metaNode) return;
    const isDemo = payload && payload.is_demo;
    const year = latest ? latest.year : "";
    metaNode.textContent =
      (isDemo ? "⚠️ Данные демонстрационные. " : "") +
      (year ? "Текущий акцент: " + year + " год. " : "") +
      "Источник данных: assets/data/forum-stats.json";
  }

  async function load() {
    setError("");
    setLoading(true);

    try {
      const resp = await fetch(DATA_URL, { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);

      const payload = await resp.json();
      const rows = Array.isArray(payload.years) ? payload.years : [];

      const normalized = rows
        .map(function (r) {
          return {
            year: Number(r.year),
            participants: Number(r.participants) || 0,
            applications: Number(r.applications) || 0,
            speakers: Number(r.speakers) || 0,
            speaker_capital_bln_rub: Number(r.speaker_capital_bln_rub) || 0,
            partners: Number(r.partners) || 0,
            notes: safeText(r.notes)
          };
        })
        .filter(function (r) {
          return Number.isFinite(r.year) && r.year > 0;
        })
        .sort(function (a, b) {
          return a.year - b.year;
        });

      if (!normalized.length) throw new Error("empty dataset");

      const latest = pickLatestYear(normalized);

      // stats
      renderStats(latest);

      // tabs
      buildYearTabs(normalized);

      // chart
      initMetricButtons(normalized);
      setActiveMetric("participants", normalized);

      updateMeta(payload, latest);
    } catch (e) {
      setError(
        "Не удалось загрузить данные форума. " +
          "Откройте сайт через локальный сервер и проверьте файл " +
          DATA_URL +
          "."
      );
    } finally {
      setLoading(false);
    }
  }

  // Анимация чисел — только когда блок реально виден
  (function deferStatsAnimation() {
    const statsGrid = document.querySelector(".stats-grid");
    if (!statsGrid || prefersReducedMotion) {
      load();
      return;
    }

    let started = false;

    try {
      const io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (!started && e.isIntersecting) {
              started = true;
              io.disconnect();
              load();
            }
          });
        },
        { threshold: 0.2 }
      );
      io.observe(statsGrid);
    } catch (e) {
      load();
    }
  })();
})();