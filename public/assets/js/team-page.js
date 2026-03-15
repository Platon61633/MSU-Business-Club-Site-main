(function () {
  "use strict";

  const process = document.querySelector(".process");
  if (!process) return;

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const panels = Array.from(process.querySelectorAll(".process-panel"));
  if (!panels.length) return;

  const tabsHost = process.querySelector("#process-mobile-tabs");
  const stage = process.querySelector("#process-mobile-stage");

  function safeText(node) {
    return String((node && node.textContent) || "").trim();
  }

  function getPanelData(panel, fallbackIndex) {
    const step = String(panel.dataset.step || "").trim() || String(fallbackIndex + 1).padStart(2, "0");
    const title = safeText(panel.querySelector(".process-panel-full h3")) || "Этап";
    const copy = safeText(panel.querySelector(".process-panel-full p")) || "";
    const img = String(panel.dataset.img || "").trim();

    return { step: step, title: title, copy: copy, img: img };
  }

  function renderStage(data) {
    if (!stage) return;

    stage.innerHTML = "";

    const media = document.createElement("div");
    media.className = "process-stage-media";

    if (data.img) {
      const img = document.createElement("img");
      img.src = data.img;
      img.alt = "";
      img.loading = "lazy";
      media.appendChild(img);
    }

    const copy = document.createElement("div");
    copy.className = "process-stage-copy";

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Этап " + data.step;

    const h3 = document.createElement("h3");
    h3.textContent = data.title;

    const p = document.createElement("p");
    p.textContent = data.copy;

    copy.appendChild(eyebrow);
    copy.appendChild(h3);
    if (data.copy) copy.appendChild(p);

    stage.appendChild(media);
    stage.appendChild(copy);

    if (window.BCScrollAnimations && typeof window.BCScrollAnimations.refresh === "function") {
      window.BCScrollAnimations.refresh(stage);
    }
  }

  function setActive(nextIndex, focus) {
    const idx = Math.max(0, Math.min(panels.length - 1, Number(nextIndex) || 0));

    panels.forEach(function (p, i) {
      const isActive = i === idx;
      p.classList.toggle("is-active", isActive);
      p.setAttribute("aria-pressed", String(isActive));
      p.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    if (tabsHost) {
      const tabs = Array.from(tabsHost.querySelectorAll(".process-mtab"));
      tabs.forEach(function (t, i) {
        const isActive = i === idx;
        t.classList.toggle("is-active", isActive);
        t.setAttribute("aria-pressed", String(isActive));
      });
    }

    renderStage(getPanelData(panels[idx], idx));

    if (focus) {
      try {
        panels[idx].focus({ preventScroll: true });
      } catch (e) {
        // ignore
      }
    }
  }

  function buildMobileTabs() {
    if (!tabsHost) return;

    tabsHost.innerHTML = "";

    panels.forEach(function (panel, idx) {
      const data = getPanelData(panel, idx);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "process-mtab";
      btn.textContent = data.step;
      btn.setAttribute("aria-pressed", "false");

      btn.addEventListener("click", function () {
        setActive(idx, false);
      });

      tabsHost.appendChild(btn);
    });
  }

  // Click / keyboard on panels
  panels.forEach(function (panel, idx) {
    panel.addEventListener("click", function () {
      setActive(idx, false);
    });

    panel.addEventListener("keydown", function (e) {
      const key = e.key;
      if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") return;

      e.preventDefault();

      const current = panels.findIndex(function (p) {
        return p.classList.contains("is-active");
      });

      let next = current >= 0 ? current : 0;
      if (key === "ArrowLeft") next = Math.max(0, next - 1);
      if (key === "ArrowRight") next = Math.min(panels.length - 1, next + 1);
      if (key === "Home") next = 0;
      if (key === "End") next = panels.length - 1;

      setActive(next, true);
    });
  });

  // Init
  const initial =
    panels.findIndex(function (p) {
      return p.classList.contains("is-active");
    }) || 0;

  buildMobileTabs();
  setActive(initial, false);

  if (prefersReducedMotion) {
    process.classList.add("is-reduced-motion");
  }
})();