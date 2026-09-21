"use client";

import { useEffect } from "react";

const SANITY_PROJECT_ID = "eg4pfiee";
const SANITY_DATASET = "production";

// Sanity re-encodes on the fly: auto=format hands back WebP/AVIF wherever the
// browser takes it, which is roughly half the bytes of the original JPEG.
const IMG_PARAMS = "auto=format&q=75";

export default function Home() {
  useEffect(() => {
    const popupOverlay = document.getElementById("popup-overlay");
    const popupImageStack = document.getElementById("popup-image-stack");
    const popupImageA = document.getElementById("popup-image-a");
    const popupImageB = document.getElementById("popup-image-b");
    const IMAGE_TRANSITION_MS = 300;
    let frontLayer = popupImageA;
    let backLayer = popupImageB;
    let layerSwapTimeout = null;

    const popupMetaFields = ["num", "title", "where", "when", "note"];
    const peek = document.getElementById("peek");
    const peekImg = document.getElementById("peekImg");
    const navIndex = document.getElementById("nav-index");
    const navTitles = document.getElementById("nav-titles");
    const navTitle = document.getElementById("nav-title");
    const navLog = document.getElementById("nav-log");
    const indexListEl = document.getElementById("index-list");
    const titleListEl = document.getElementById("title-list");
    const logListEl = document.getElementById("log-list");
    const sortDateBtn = document.getElementById("sort-date");
    const sortAlphaBtn = document.getElementById("sort-alpha");
    const contentEl = document.getElementById("content");
    const textEl = document.getElementById("intro-text");

    let originalItems = [];
    let items = [];
    let indexById = new Map();
    let currentIndex = -1;
    let sortField = "date";
    let sortDir = "asc";

    function updateContentMinHeight() {
      let needed = 0;
      if (document.body.classList.contains("is-index-open")) {
        needed = Math.max(needed, indexListEl.scrollHeight);
      }
      if (document.body.classList.contains("is-titles-open")) {
        needed = Math.max(needed, titleListEl.scrollHeight);
      }
      if (document.body.classList.contains("is-intro-open")) {
        needed = Math.max(needed, textEl.scrollHeight);
      }
      if (document.body.classList.contains("is-log-open")) {
        needed = Math.max(needed, logListEl.scrollHeight);
      }
      contentEl.style.minHeight = needed ? `${needed}px` : "";
    }

    // The intro text and the INDEX group share the same area, so only one can be open at a time.
    function closeIndex() {
      document.body.classList.remove("is-index-open", "is-titles-open", "is-log-open");
    }

    function onNavIndexClick(e) {
      e.preventDefault();
      if (document.body.classList.contains("is-index-open")) {
        closeIndex();
      } else {
        document.body.classList.add("is-index-open", "has-opened-index");
        document.body.classList.remove("is-intro-open");
      }
      updateContentMinHeight();
    }

    function onNavTitlesClick(e) {
      e.preventDefault();
      document.body.classList.toggle("is-titles-open");
      updateContentMinHeight();
    }

    function onNavTitleClick(e) {
      e.preventDefault();
      document.body.classList.toggle("is-intro-open");
      if (document.body.classList.contains("is-intro-open")) {
        closeIndex();
      }
      updateContentMinHeight();
    }

    function onNavLogClick(e) {
      e.preventDefault();
      document.body.classList.toggle("is-log-open");
      updateContentMinHeight();
    }

    navIndex.addEventListener("click", onNavIndexClick);
    navTitles.addEventListener("click", onNavTitlesClick);
    navTitle.addEventListener("click", onNavTitleClick);
    navLog.addEventListener("click", onNavLogClick);

    function computeContainedSize(naturalW, naturalH) {
      const maxW = window.innerWidth * 0.75;
      const maxH = window.innerHeight * 0.7;
      const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
      return { width: naturalW * scale, height: naturalH * scale };
    }

    function setStackSize(item, animate) {
      if (!item.width || !item.height) return;
      const { width, height } = computeContainedSize(item.width, item.height);
      if (!animate) popupImageStack.style.transition = "none";
      popupImageStack.style.width = `${width}px`;
      popupImageStack.style.height = `${height}px`;
      if (!animate) {
        void popupImageStack.offsetWidth;
        popupImageStack.style.transition = "";
      }
    }

    // Put the full-size photo on a layer. If it is already cached the layer gets
    // it outright; otherwise the thumbnail stands in — already downloaded, so it
    // shows up at once — and the full file replaces it the moment it lands.
    function showFullWhenReady(layer, item, index) {
      const fullImg = new Image();
      fullImg.src = item.fullSrc;

      if (fullImg.complete) {
        layer.src = item.fullSrc;
        return;
      }

      layer.src = item.thumbSrc;
      fullImg.onload = () => {
        if (currentIndex !== index) return;
        layer.src = item.fullSrc;
      };
    }

    // Paging through the popup shouldn't wait on the network, so fetch the
    // photos on either side as soon as one is open.
    function warmNeighbours(index) {
      [index - 1, index + 1].forEach((i) => {
        const item = items[i];
        if (item) new Image().src = item.fullSrc;
      });
    }

    function openPopup(index) {
      const isNavigating = popupOverlay.classList.contains("is-active");
      currentIndex = index;
      const item = items[index];

      const values = { num: item.id, title: item.title, where: item.where, when: item.when, note: item.note };
      popupMetaFields.forEach((field) => {
        document.getElementById(`popup-meta-${field}`).textContent = values[field];
      });

      if (!isNavigating) {
        if (layerSwapTimeout) {
          clearTimeout(layerSwapTimeout);
          layerSwapTimeout = null;
        }
        popupImageStack.classList.remove("is-transitioning");
        setStackSize(item, false);
        // Capture the element itself (not the frontLayer/backLayer variable)
        // so this onload still targets the right DOM node even if a later
        // navigation swaps what frontLayer/backLayer point to before this
        // (slower) full-res load finishes.
        const loadingLayer = frontLayer;
        loadingLayer.alt = item.title;
        loadingLayer.style.opacity = "1";
        backLayer.style.opacity = "0";
        backLayer.src = "";
        showFullWhenReady(loadingLayer, item, index);

        popupOverlay.classList.add("is-active");
        warmNeighbours(index);
        return;
      }

      if (layerSwapTimeout) clearTimeout(layerSwapTimeout);

      // Same capture-the-element trick as above: backLayer becomes
      // frontLayer once the timeout below fires, so the onload has to keep
      // a fixed reference to the element it's actually loading into.
      const loadingLayer = backLayer;
      loadingLayer.alt = item.title;
      showFullWhenReady(loadingLayer, item, index);

      // Start heading the box toward the new photo's shape right away (in
      // parallel with the fade, not gated behind it) so a fast run of clicks
      // keeps retargeting a single ongoing resize instead of freezing the box
      // at whatever shape it had before the run started. Both layers fill the
      // box edge-to-edge (object-fit: cover) the whole time a resize is in
      // flight, so nothing ever looks letterboxed mid-transition; only once
      // things settle does it switch back to an uncropped contain-fit.
      popupImageStack.classList.add("is-transitioning");
      setStackSize(item, true);
      requestAnimationFrame(() => {
        backLayer.style.opacity = "1";
        frontLayer.style.opacity = "0";
      });

      warmNeighbours(index);

      layerSwapTimeout = setTimeout(() => {
        layerSwapTimeout = null;
        if (currentIndex !== index) return;
        frontLayer.style.opacity = "0";
        [frontLayer, backLayer] = [backLayer, frontLayer];
        popupImageStack.classList.remove("is-transitioning");
      }, IMAGE_TRANSITION_MS);
    }

    function closePopup() {
      popupOverlay.classList.remove("is-active");
    }

    function showPrev() {
      if (currentIndex > 0) openPopup(currentIndex - 1);
    }

    function showNext() {
      if (currentIndex < items.length - 1) openPopup(currentIndex + 1);
    }

    function onStackMouseMove(e) {
      const rect = popupImageStack.getBoundingClientRect();
      const isLeftHalf = e.clientX - rect.left < rect.width / 2;
      popupImageStack.style.cursor = isLeftHalf ? "w-resize" : "e-resize";
    }

    function onStackClick(e) {
      const rect = popupImageStack.getBoundingClientRect();
      const isLeftHalf = e.clientX - rect.left < rect.width / 2;
      if (isLeftHalf) {
        showPrev();
      } else {
        showNext();
      }
    }

    popupImageStack.addEventListener("mousemove", onStackMouseMove);
    popupImageStack.addEventListener("click", onStackClick);

    let mx = 0;
    let my = 0;

    function placePeek() {
      const w = 230;
      const h = peekImg.naturalHeight ? (w * peekImg.naturalHeight) / peekImg.naturalWidth : 280;
      const x = Math.min(mx + 20, window.innerWidth - w - 12);
      const y = Math.min(my + 16, window.innerHeight - h - 12);
      peek.style.transform = `translate(${Math.max(12, x)}px, ${Math.max(12, y)}px)`;
    }

    function showPeek(id) {
      const item = items[indexById.get(id)];
      peekImg.src = item.thumbSrc;
      placePeek();
      peek.classList.add("is-on");

      clearTimeout(warmTimer);
      warmTimer = setTimeout(() => warmFull(id), 200);
    }

    function hidePeek() {
      clearTimeout(warmTimer);
      peek.classList.remove("is-on");
    }

    // A hover that lasts a moment is usually a click, so start the full-size
    // download during it. The delay keeps a mouse sweeping down the list from
    // pulling every photo at once.
    const warmed = new Set();
    let warmTimer = null;

    function warmFull(id) {
      if (warmed.has(id)) return;
      warmed.add(id);
      new Image().src = items[indexById.get(id)].fullSrc;
    }

    function onDocMouseMove(e) {
      mx = e.clientX;
      my = e.clientY;
      if (peek.classList.contains("is-on")) placePeek();
    }

    document.addEventListener("mousemove", onDocMouseMove);
    peekImg.addEventListener("load", placePeek);

    function onOverlayClick(e) {
      if (e.target === popupOverlay) {
        closePopup();
      }
    }
    popupOverlay.addEventListener("click", onOverlayClick);

    function onKeyDown(e) {
      if (!popupOverlay.classList.contains("is-active")) return;

      if (e.key === "Escape") {
        closePopup();
      } else if (e.key === "ArrowLeft") {
        showPrev();
      } else if (e.key === "ArrowRight") {
        showNext();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    function escapeHtml(s) {
      return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    }

    function flipRender(listEl, html) {
      const oldRects = new Map();
      Array.from(listEl.children).forEach((el) => {
        oldRects.set(el.dataset.id, el.getBoundingClientRect());
      });

      listEl.innerHTML = html;

      Array.from(listEl.children).forEach((el) => {
        const oldRect = oldRects.get(el.dataset.id);
        if (!oldRect) return;
        const newRect = el.getBoundingClientRect();
        const deltaY = oldRect.top - newRect.top;
        if (deltaY) {
          el.style.transition = "none";
          el.style.transform = `translateY(${deltaY}px)`;
          requestAnimationFrame(() => {
            el.style.transition = "transform 0.3s ease";
            el.style.transform = "";
          });
        }
      });
    }

    function renderLists() {
      const indexHtml = items
        .map((it) => `<li data-id="${it.id}"><a href="${it.fullSrc}"><span class="num">${it.id}</span></a></li>`)
        .join("");
      const titleHtml = items.map((it) => `<li data-id="${it.id}">${escapeHtml(it.title)}</li>`).join("");
      const logHtml = items
        .map(
          (it) =>
            `<li data-id="${it.id}"><span class="log-date">${it.when || "-"}</span> | ${escapeHtml(it.where) || "-"}</li>`
        )
        .join("");

      flipRender(indexListEl, indexHtml);
      flipRender(titleListEl, titleHtml);
      flipRender(logListEl, logHtml);
    }

    function wireInteractions() {
      const indexLinkById = new Map();
      Array.from(indexListEl.querySelectorAll("a")).forEach((link, i) => {
        indexLinkById.set(items[i].id, link);
      });

      const titleItemById = new Map();
      titleListEl.querySelectorAll("li").forEach((li) => {
        titleItemById.set(li.dataset.id, li);
      });

      const logItemById = new Map();
      logListEl.querySelectorAll("li").forEach((li) => {
        logItemById.set(li.dataset.id, li);
      });

      function setHoverLinked(id, on) {
        const link = indexLinkById.get(id);
        const titleItem = titleItemById.get(id);
        const logItem = logItemById.get(id);
        if (link) link.classList.toggle("is-hover-linked", on);
        if (titleItem) titleItem.classList.toggle("is-hover-linked", on);
        if (logItem) logItem.classList.toggle("is-hover-linked", on);
        document.body.classList.toggle("is-hovering", on);
      }

      indexLinkById.forEach((link, id) => {
        link.addEventListener("mouseenter", () => {
          showPeek(id);
          setHoverLinked(id, true);
        });
        link.addEventListener("mouseleave", () => {
          hidePeek();
          setHoverLinked(id, false);
        });
        link.addEventListener("click", (e) => {
          e.preventDefault();
          hidePeek();
          openPopup(indexById.get(id));
        });
      });

      [...titleItemById, ...logItemById].forEach(([id, li]) => {
        li.addEventListener("mouseenter", () => {
          showPeek(id);
          setHoverLinked(id, true);
        });
        li.addEventListener("mouseleave", () => {
          hidePeek();
          setHoverLinked(id, false);
        });
        li.addEventListener("click", () => {
          hidePeek();
          openPopup(indexById.get(id));
        });
      });
    }

    function syncRowHeights() {
      const columns = [indexListEl, titleListEl, logListEl].map((listEl) => Array.from(listEl.children));
      columns.flat().forEach((el) => {
        el.style.minHeight = "";
      });
      columns[0].forEach((_, i) => {
        const row = columns.map((col) => col[i]).filter(Boolean);
        const h = Math.max(...row.map((el) => el.getBoundingClientRect().height));
        row.forEach((el) => {
          el.style.minHeight = `${h}px`;
        });
      });
    }

    let resizeRaf = null;
    function onResize() {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(syncRowHeights);
    }
    window.addEventListener("resize", onResize);

    function refresh() {
      renderLists();
      wireInteractions();
      syncRowHeights();
    }

    function compareItems(a, b) {
      let cmp;
      if (sortField === "date") {
        const aEmpty = !a.when;
        const bEmpty = !b.when;
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        cmp = a.when < b.when ? -1 : a.when > b.when ? 1 : 0;
      } else {
        cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    }

    function updateSortButtonsUI() {
      const arrow = sortDir === "asc" ? " ↑" : " ↓";
      sortDateBtn.textContent = "DATE" + (sortField === "date" ? arrow : "");
      sortAlphaBtn.textContent = "A–Z" + (sortField === "alpha" ? arrow : "");
      sortDateBtn.classList.toggle("is-active", sortField === "date");
      sortAlphaBtn.classList.toggle("is-active", sortField === "alpha");
    }

    function applySort() {
      items = [...originalItems].sort(compareItems);
      indexById = new Map(items.map((it, i) => [it.id, i]));
      refresh();
      updateSortButtonsUI();
    }

    function setSort(field) {
      if (sortField === field) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortField = field;
        sortDir = "desc";
      }
      applySort();
    }

    function onSortDateClick(e) {
      e.preventDefault();
      setSort("date");
    }
    function onSortAlphaClick(e) {
      e.preventDefault();
      setSort("alpha");
    }
    sortDateBtn.addEventListener("click", onSortDateClick);
    sortAlphaBtn.addEventListener("click", onSortAlphaClick);

    // Every thumbnail, so a hover never waits — but at low priority and only
    // once the browser is idle, so it doesn't compete with the first paint.
    function prefetchThumbs() {
      const queue = [...items];
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));

      (function next() {
        if (cancelled) return;
        const item = queue.shift();
        if (!item) return;
        const img = new Image();
        img.fetchPriority = "low";
        img.src = item.thumbSrc;
        idle(next);
      })();
    }

    let cancelled = false;

    async function loadPhotos() {
      const groq = '*[_type=="photo"]{num,title,where,when,note,_createdAt,"url":image.asset->url}|order(num asc)';
      const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${SANITY_DATASET}?query=${encodeURIComponent(groq)}`;

      const res = await fetch(url);
      const { result } = await res.json();
      if (cancelled) return;

      // The popup never fills more than 75% of the window, so a flat 1800px is
      // wasted on most screens. Rounding up to a step keeps everyone sharing a
      // handful of sizes on the CDN instead of minting a new one per width.
      const fullWidth = Math.min(
        1800,
        Math.ceil((window.innerWidth * 0.75 * (window.devicePixelRatio || 1)) / 300) * 300
      );

      originalItems = result.map((r) => {
        const dimsMatch = r.url.match(/-(\d+)x(\d+)\.\w+$/);
        return {
          id: r.num,
          title: r.title,
          where: r.where || "",
          when: r.when || "",
          note: r.note || "",
          fullSrc: `${r.url}?w=${fullWidth}&${IMG_PARAMS}`,
          thumbSrc: `${r.url}?w=500&${IMG_PARAMS}`,
          width: dimsMatch ? Number(dimsMatch[1]) : null,
          height: dimsMatch ? Number(dimsMatch[2]) : null,
        };
      });
      items = [...originalItems];
      indexById = new Map(items.map((it, i) => [it.id, i]));

      refresh();
      rollItemCount(originalItems.length);
      showLastDump(result);
      updateSortButtonsUI();
      prefetchThumbs();
    }

    // Odometer-style roll: each digit spins through a stacked 0-9 strip (more
    // spins the further right it is) and lands on its target, staggered left to right.
    let rollTimeout = null;
    function rollItemCount(total) {
      const LABEL = " ITEMS, UNSORTED";
      const DURATION_MS = 1200;
      const STAGGER_MS = 120;
      const target = String(total).padStart(3, "0");
      const finalText = target + LABEL;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        navLog.textContent = finalText;
        return;
      }

      navLog.textContent = "";
      const strips = [...target].map((digit, i) => {
        const cell = document.createElement("span");
        cell.className = "odometer-digit";
        const strip = document.createElement("span");
        strip.className = "odometer-strip";
        strip.innerHTML = Array.from({ length: 30 }, (_, k) => `<span>${k % 10}</span>`).join("");
        strip.style.transitionDelay = `${i * STAGGER_MS}ms`;
        cell.appendChild(strip);
        navLog.appendChild(cell);
        return { strip, stop: i * 10 + Number(digit) };
      });
      navLog.appendChild(document.createTextNode(LABEL));

      void navLog.offsetWidth;
      strips.forEach(({ strip, stop }) => {
        strip.style.transform = `translateY(${-stop * 15}px)`;
      });

      // Swap back to plain text so the nav's hover underline covers the digits again.
      rollTimeout = setTimeout(() => {
        navLog.textContent = finalText;
      }, DURATION_MS + (target.length - 1) * STAGGER_MS);
    }

    // Date the most recent photo was added to Sanity, in the visitor's local time.
    function showLastDump(docs) {
      const latest = docs.reduce((max, d) => (d._createdAt > max ? d._createdAt : max), "");
      if (!latest) return;
      document.getElementById("last-dump").textContent = `LAST DUMP ${new Date(latest).toLocaleDateString("sv-SE")}`;
    }

    loadPhotos();

    // ---------- gravity drop: "(Literally a dump.)" ----------

    const dumpTrigger = document.getElementById("dump-trigger");
    const headerEl = document.getElementById("header");
    let dumpState = null;

    function collectWords(el) {
      const words = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        for (const m of node.textContent.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const rect = range.getBoundingClientRect();
          if (rect.width && rect.height) words.push({ text: m[0], rect });
        }
      }
      return words;
    }

    async function startDump() {
      if (dumpState) return;
      const state = {};
      dumpState = state;
      // Clear the guard if the library fails to load, so the trigger isn't dead for good.
      let Matter;
      try {
        Matter = (await import("matter-js")).default;
      } catch {
        if (dumpState === state) dumpState = null;
        return;
      }
      if (dumpState !== state) return;

      const sources = [dumpTrigger, indexListEl];
      if (document.body.classList.contains("is-titles-open")) sources.push(titleListEl);
      if (document.body.classList.contains("is-log-open")) sources.push(logListEl);
      const words = sources.flatMap(collectWords);

      const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint } = Matter;
      const engine = Engine.create();
      const width = window.innerWidth;
      const floorY = window.innerHeight - document.querySelector("footer").offsetHeight;
      const WALL = 200;
      Composite.add(engine.world, [
        Bodies.rectangle(width / 2, floorY + WALL / 2, width * 2, WALL, { isStatic: true }),
        Bodies.rectangle(-WALL / 2, 0, WALL, floorY * 6, { isStatic: true }),
        Bodies.rectangle(width + WALL / 2, 0, WALL, floorY * 6, { isStatic: true }),
      ]);

      const layer = document.createElement("div");
      layer.className = "dump-layer";
      const bodies = words.map(({ text, rect }) => {
        // Rows scrolled below the fold rain in from above instead of spawning under the floor.
        const y = rect.bottom > floorY ? -rect.height - Math.random() * floorY : rect.top + rect.height / 2;
        const body = Bodies.rectangle(rect.left + rect.width / 2, y, rect.width, rect.height, {
          restitution: 0.1,
          friction: 0.6,
          frictionAir: 0.01,
        });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.02);

        const el = document.createElement("span");
        el.className = "dump-word";
        el.textContent = text;
        el.style.width = `${rect.width}px`;
        el.style.height = `${rect.height}px`;
        el.style.lineHeight = `${rect.height}px`;
        layer.appendChild(el);
        return { body, el, w: rect.width, h: rect.height };
      });
      Composite.add(
        engine.world,
        bodies.map((b) => b.body)
      );

      document.body.appendChild(layer);
      document.body.classList.add("is-dumped");
      hidePeek();

      const mouse = Mouse.create(layer);
      // Matter grabs wheel events by default, which would block page scrolling.
      mouse.element.removeEventListener("wheel", mouse.mousewheel);
      Composite.add(engine.world, MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2 } }));

      let last = performance.now();
      const step = (now) => {
        Engine.update(engine, Math.min(now - last, 32));
        last = now;
        bodies.forEach(({ body, el, w, h }) => {
          el.style.transform = `translate(${body.position.x - w / 2}px, ${body.position.y - h / 2}px) rotate(${body.angle}rad)`;
        });
        state.raf = requestAnimationFrame(step);
      };
      Object.assign(state, { engine, layer, Matter });
      state.raf = requestAnimationFrame(step);
    }

    function endDump() {
      if (!dumpState) return;
      const { raf, layer, engine, Matter } = dumpState;
      dumpState = null;
      if (raf) cancelAnimationFrame(raf);
      if (layer) layer.remove();
      if (engine) Matter.Engine.clear(engine);
      document.body.classList.remove("is-dumped");
    }

    function onDumpKeyDown(e) {
      if (e.key === "Escape") endDump();
    }

    dumpTrigger.addEventListener("click", startDump);
    // Any header click (nav toggles, sort) puts the page back together first.
    headerEl.addEventListener("click", endDump, true);
    window.addEventListener("resize", endDump);
    document.addEventListener("keydown", onDumpKeyDown);

    return () => {
      cancelled = true;
      if (layerSwapTimeout) clearTimeout(layerSwapTimeout);
      if (rollTimeout) clearTimeout(rollTimeout);
      clearTimeout(warmTimer);
      endDump();
      dumpTrigger.removeEventListener("click", startDump);
      headerEl.removeEventListener("click", endDump, true);
      window.removeEventListener("resize", endDump);
      document.removeEventListener("keydown", onDumpKeyDown);
      navIndex.removeEventListener("click", onNavIndexClick);
      navTitles.removeEventListener("click", onNavTitlesClick);
      navTitle.removeEventListener("click", onNavTitleClick);
      navLog.removeEventListener("click", onNavLogClick);
      popupImageStack.removeEventListener("mousemove", onStackMouseMove);
      popupImageStack.removeEventListener("click", onStackClick);
      document.removeEventListener("mousemove", onDocMouseMove);
      peekImg.removeEventListener("load", placePeek);
      popupOverlay.removeEventListener("click", onOverlayClick);
      document.removeEventListener("keydown", onKeyDown);
      sortDateBtn.removeEventListener("click", onSortDateClick);
      sortAlphaBtn.removeEventListener("click", onSortAlphaClick);
      window.removeEventListener("resize", onResize);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
    };
  }, []);

  return (
    <>
      <header id="header">
        <nav id="nav-title">DUMP-ARCHIVE</nav>
        <nav id="nav-index">INDEX</nav>
        <nav id="nav-titles" className="nav-titles">TITLE</nav>
        <nav id="nav-log" className="nav-log">000 ITEMS, UNSORTED</nav>

        <div className="sort-controls" id="sort-controls">
          <button type="button" className="sort-btn" id="sort-date">DATE</button>
          <button type="button" className="sort-btn" id="sort-alpha">A&ndash;Z</button>
        </div>
      </header>

      <div className="content" id="content">
        <div className="text" id="intro-text">
          <p>This archive is where all kinds of images just get dumped in, no sorting, no filtering. (Literally a dump.)</p>
          <p className="colophon">Built with NEXT.JS · Content ON SANITY</p>
        </div>

        <p className="dump-trigger" id="dump-trigger">(Literally a dump.)</p>

        <ul className="index-list" id="index-list"></ul>

        <ul className="title-list" id="title-list"></ul>

        <ul className="log-list" id="log-list"></ul>
      </div>

      <figure className="peek" id="peek" aria-hidden="true">
        <img id="peekImg" alt="" />
      </figure>

      <div className="popup-overlay" id="popup-overlay">
        <div className="popup-meta" id="popup-meta">
          <div className="popup-meta-blank"></div>
          <div className="popup-meta-numtitle">
            <div className="popup-meta-num" id="popup-meta-num"></div>
            <div className="popup-meta-title" id="popup-meta-title"></div>
          </div>
          <div className="popup-meta-wherewhen">
            <div className="popup-meta-where" id="popup-meta-where"></div>
            <div className="popup-meta-when" id="popup-meta-when"></div>
          </div>
          <div className="popup-meta-note" id="popup-meta-note"></div>
        </div>
        <div className="popup-content">
          <div className="popup-image-stack" id="popup-image-stack">
            <img className="popup-image-layer" id="popup-image-a" alt="" decoding="async" fetchPriority="high" />
            <img className="popup-image-layer" id="popup-image-b" alt="" decoding="async" fetchPriority="high" />
          </div>
        </div>
      </div>

      <footer>
        <div></div>
        <div className="footer">
          <span>© 2026 JUNGPARK. ALL RIGHTS RESERVED</span>
        </div>
        <div className="last-dump" id="last-dump"></div>
      </footer>
    </>
  );
}
