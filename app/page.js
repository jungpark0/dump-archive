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
    const popupZoomBtn = document.getElementById("popup-zoom");
    const popupMetaEl = document.getElementById("popup-meta");
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
    // No sort to begin with: the lists run in the order the photos were added.
    let sortField = null;
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

    // Not every photo has something behind it. An empty note slot reads as a
    // field nobody filled in, so the popup says it in the notes' own voice
    // instead — the same line every time, because a rule reads as a decision and
    // a variation reads as filler. The note itself stays empty in the CMS.
    const NO_NOTE = "Just the photo.";

    function openPopup(index) {
      const isNavigating = popupOverlay.classList.contains("is-active");
      currentIndex = index;
      const item = items[index];

      // A missing date or place is genuine missing data, and the log list
      // already prints those as "-". The popup says the same instead of
      // leaving a blank cell.
      const values = {
        num: item.id,
        title: item.title,
        where: item.where || "-",
        when: item.when || "-",
        note: item.note || NO_NOTE,
      };
      popupMetaFields.forEach((field) => {
        document.getElementById(`popup-meta-${field}`).textContent = values[field];
      });

      // Nothing to zoom into when the photo already fits at its own size.
      popupZoomBtn.style.display = canZoom(item) ? "" : "none";

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
      setZoom(false);
      popupOverlay.classList.remove("is-active");
    }

    // Zoom takes the photo as large as the window allows and loads it at full
    // resolution, so detail — a receipt, a sign — becomes readable. It never
    // runs past the edges: the whole photo has to stay in view.
    let isZoomed = false;

    // Cleared under the meta row rather than centred between two equal gutters,
    // which would waste as much height at the bottom as the meta needs on top.
    function zoomGutter() {
      return Math.max(30, popupMetaEl.getBoundingClientRect().height);
    }

    function computeZoomedSize(naturalW, naturalH) {
      const maxH = window.innerHeight - zoomGutter() - 30;
      const scale = Math.min(window.innerWidth / naturalW, maxH / naturalH, 1);
      return { width: naturalW * scale, height: naturalH * scale };
    }

    // Offered only when it buys at least a tenth more size. On a short window
    // the meta row eats the difference and the press would do nothing visible.
    function canZoom(item) {
      if (!item.width || !item.height) return false;
      const fitted = computeContainedSize(item.width, item.height);
      return computeZoomedSize(item.width, item.height).width > fitted.width * 1.1;
    }

    function setZoom(on) {
      if (on === isZoomed) return;
      const item = items[currentIndex];
      if (on && !(item && canZoom(item))) return;

      isZoomed = on;
      popupOverlay.classList.toggle("is-zoomed", on);
      popupZoomBtn.textContent = on ? "ZOOM [-]" : "ZOOM [+]";

      if (!on) {
        popupOverlay.style.paddingTop = "";
        setStackSize(item, true);
        return;
      }

      // Push the centring box below the meta row instead of shrinking the photo
      // to clear it on both sides.
      popupOverlay.style.paddingTop = `${zoomGutter()}px`;

      const { width, height } = computeZoomedSize(item.width, item.height);
      popupImageStack.style.width = `${width}px`;
      popupImageStack.style.height = `${height}px`;
      // The prev/next handler writes cursor inline, which would outrank the
      // zoom-out cursor the stylesheet sets while zoomed.
      popupImageStack.style.cursor = "";

      // The layer on screen is the back one only while a crossfade still runs.
      const layer = layerSwapTimeout ? backLayer : frontLayer;
      const index = currentIndex;
      const zoomImg = new Image();
      zoomImg.src = item.zoomSrc;
      if (zoomImg.complete) {
        layer.src = item.zoomSrc;
        return;
      }
      zoomImg.onload = () => {
        if (!isZoomed || currentIndex !== index) return;
        layer.src = item.zoomSrc;
      };
    }

    function onZoomClick() {
      setZoom(!isZoomed);
    }
    popupZoomBtn.addEventListener("click", onZoomClick);

    function showPrev() {
      setZoom(false);
      if (currentIndex > 0) openPopup(currentIndex - 1);
    }

    function showNext() {
      setZoom(false);
      if (currentIndex < items.length - 1) openPopup(currentIndex + 1);
    }

    function onStackMouseMove(e) {
      if (isZoomed) return;
      const rect = popupImageStack.getBoundingClientRect();
      const isLeftHalf = e.clientX - rect.left < rect.width / 2;
      popupImageStack.style.cursor = isLeftHalf ? "w-resize" : "e-resize";
    }

    function onStackClick(e) {
      if (isZoomed) {
        setZoom(false);
        return;
      }
      const rect = popupImageStack.getBoundingClientRect();
      const isLeftHalf = e.clientX - rect.left < rect.width / 2;
      if (isLeftHalf) {
        showPrev();
      } else {
        showNext();
      }
    }

    // On a phone there is no cursor to show that the halves turn the page, so a
    // sideways swipe does it too. While zoomed in, a drag belongs to the zoom.
    let touchStartX = 0;
    let touchStartY = 0;

    function onStackTouchStart(e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }

    function onStackTouchEnd(e) {
      if (isZoomed) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) {
        showNext();
      } else {
        showPrev();
      }
    }

    popupImageStack.addEventListener("mousemove", onStackMouseMove);
    popupImageStack.addEventListener("click", onStackClick);
    popupImageStack.addEventListener("touchstart", onStackTouchStart, { passive: true });
    popupImageStack.addEventListener("touchend", onStackTouchEnd);

    // A phone fakes a hover on every tap and only ends it at the next tap somewhere
    // else, so the list would stay dimmed after the popup closes. Row hovers are for
    // a real pointer only, the same test globals.css uses for the peek.
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    // Opening the popup ends the row hover it was clicked from. The list eases
    // back to black under the overlay's fade instead of snapping.
    let unhoverTimer = null;

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
        if (isZoomed) {
          setZoom(false);
        } else {
          closePopup();
        }
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

      function easeOutHover(id) {
        document.body.classList.add("is-unhovering");
        setHoverLinked(id, false);
        clearTimeout(unhoverTimer);
        unhoverTimer = setTimeout(() => document.body.classList.remove("is-unhovering"), IMAGE_TRANSITION_MS);
      }

      indexLinkById.forEach((link, id) => {
        link.addEventListener("mouseenter", () => {
          if (!finePointer.matches) return;
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
          easeOutHover(id);
          openPopup(indexById.get(id));
        });
      });

      [...titleItemById, ...logItemById].forEach(([id, li]) => {
        li.addEventListener("mouseenter", () => {
          if (!finePointer.matches) return;
          showPeek(id);
          setHoverLinked(id, true);
        });
        li.addEventListener("mouseleave", () => {
          hidePeek();
          setHoverLinked(id, false);
        });
        li.addEventListener("click", () => {
          hidePeek();
          easeOutHover(id);
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
      items = sortField ? [...originalItems].sort(compareItems) : [...originalItems];
      indexById = new Map(items.map((it, i) => [it.id, i]));
      refresh();
      updateSortButtonsUI();
    }

    // Each button walks ↑, then ↓, then off again, back to the unsorted list.
    function setSort(field) {
      if (sortField !== field) {
        sortField = field;
        sortDir = "asc";
      } else if (sortDir === "asc") {
        sortDir = "desc";
      } else {
        sortField = null;
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
          zoomSrc: dimsMatch ? `${r.url}?w=${dimsMatch[1]}&${IMG_PARAMS}` : `${r.url}?${IMG_PARAMS}`,
          thumbSrc: `${r.url}?w=500&${IMG_PARAMS}`,
          // For the dumped pile, where a photo is drawn about 50px wide.
          dumpSrc: `${r.url}?w=96&auto=format&q=50`,
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
    const OPEN_CLASSES = ["is-intro-open", "is-index-open", "is-titles-open", "is-log-open"];
    const headerEl = document.getElementById("header");
    let dumpState = null;

    function collectWords(el) {
      const words = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        // A word carries its row's colour into the fall, and the row's photo with it.
        const id = node.parentElement.closest("[data-id]")?.dataset.id;
        const color = getComputedStyle(node.parentElement).color;
        for (const m of node.textContent.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const rect = range.getBoundingClientRect();
          if (rect.width && rect.height) words.push({ text: m[0], rect, color, id });
        }
      }
      return words;
    }

    const PIECE = { restitution: 0.1, friction: 0.6, frictionAir: 0.01 };
    const SWAP_LABEL = { words: "(Photos too.)", photos: "(Words again.)" };
    // A photo pops out of its row's words, and the words back out of the photo:
    // each starts as a speck, is flicked upward and swells to full size, one row
    // after another over POP_SPREAD_MS.
    const POP_MS = 280;
    const POP_SPREAD_MS = 500;
    const POP_FROM = 0.1;

    function wordEl({ text, rect }) {
      const el = document.createElement("span");
      el.className = "dump-word";
      el.textContent = text;
      el.style.width = `${rect.width}px`;
      el.style.height = `${rect.height}px`;
      el.style.lineHeight = `${rect.height}px`;
      return el;
    }

    // One falling span per word. They start where they stood in the list, or,
    // given `from`, pop out of that point the way a photo does.
    function spawnWords(state, indexes, from) {
      const { Bodies, Body, Composite } = state.Matter;
      const made = indexes.map((wi) => {
        const { rect, color, id } = state.words[wi];
        const el = wordEl(state.words[wi]);

        let body;
        let pop;
        if (from) {
          body = Bodies.rectangle(from.x, from.y, rect.width, rect.height, PIECE);
          pop = launch(state, body, from.angle);
          // Drawn by the next frame; until then it would sit at the layer's corner.
          el.style.transform = "scale(0)";
        } else {
          // Rows scrolled below the fold rain in from above instead of spawning under the floor.
          const y = rect.bottom > state.floorY
            ? -rect.height - Math.random() * state.floorY
            : rect.top + rect.height / 2;
          body = Bodies.rectangle(rect.left + rect.width / 2, y, rect.width, rect.height, PIECE);
          Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.02);
          el.style.color = color;
        }
        state.layer.appendChild(el);
        return { body, el, w: rect.width, h: rect.height, id, wi, pop };
      });
      Composite.add(state.engine.world, made.map((piece) => piece.body));
      state.pieces.push(...made);
      return made;
    }

    // Start a piece as a speck and flick it upward. The body grows with what is
    // drawn, so it shoulders its neighbours aside instead of landing on them at
    // full size.
    function launch(state, body, angle) {
      const { Body } = state.Matter;
      Body.scale(body, POP_FROM, POP_FROM);
      Body.setAngle(body, angle);
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 4, y: -(7 + Math.random() * 4) });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);
      return { start: performance.now(), size: POP_FROM };
    }

    // Their bodies go at once, so what comes down next has a clear floor; the
    // elements stay where they lay for the moment it takes them to fade.
    function clearPieces(state, test) {
      state.pieces.filter(test).forEach(({ body, el }) => {
        state.Matter.Composite.remove(state.engine.world, body);
        el.classList.add("is-leaving");
        setTimeout(() => el.remove(), 200);
      });
      state.pieces = state.pieces.filter((piece) => !test(piece));
    }

    // The words of one row give way to that row's photo, which appears where one
    // of them was lying.
    function popPhoto(state, item) {
      const { Bodies, Composite } = state.Matter;
      const own = state.pieces.filter((piece) => piece.id === item.id && !piece.photo);
      if (!own.length) return;
      const from = own[Math.floor(Math.random() * own.length)].body;
      clearPieces(state, (piece) => own.includes(piece));

      const w = window.innerWidth < 768 ? 32 : 48;
      const h = Math.round(w * (item.width && item.height ? item.height / item.width : 4 / 3));
      const body = Bodies.rectangle(from.position.x, Math.min(from.position.y, state.floorY - 4), w, h, PIECE);
      const pop = launch(state, body, from.angle);

      const el = document.createElement("img");
      el.className = "dump-word dump-photo";
      el.src = item.dumpSrc;
      el.alt = "";
      el.draggable = false;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      // Drawn by the next frame; until then it would sit at the layer's corner.
      el.style.transform = "scale(0)";
      state.layer.appendChild(el);
      Composite.add(state.engine.world, body);
      state.pieces.push({ body, el, w, h, id: item.id, photo: true, pop });
    }

    // The other way round: a photo gives way to the words of its row, which burst
    // out of the spot where it lay.
    function popWords(state, photo) {
      const { position, angle } = photo.body;
      clearPieces(state, (piece) => piece === photo);
      spawnWords(state, state.words.flatMap((word, wi) => (word.id === photo.id ? [wi] : [])), {
        x: position.x,
        y: position.y,
        angle,
      });
    }

    // One frame of a pop. The body swells steadily; what is drawn overshoots and
    // settles, which is what makes it read as a pop.
    function growPiece(state, piece, now) {
      const t = Math.min((now - piece.pop.start) / POP_MS, 1);
      const size = POP_FROM + (1 - POP_FROM) * t;
      state.Matter.Body.scale(piece.body, size / piece.pop.size, size / piece.pop.size);
      piece.pop.size = size;
      const back = 1 + 3.6 * (t - 1) ** 3 + 2.6 * (t - 1) ** 2;
      if (t === 1) piece.pop = null;
      return ` scale(${POP_FROM + (1 - POP_FROM) * back})`;
    }

    // Swap what is lying on the floor: the words of every row for that row's
    // photo, or back. The trigger's own words belong to no photo and stay put.
    function swapPile(state) {
      // Popcorn rather than one bang: every row goes off at its own moment.
      const each = (list, pop) => list.map((entry) => setTimeout(() => {
        if (dumpState === state && !state.returning) pop(entry);
      }, Math.random() * POP_SPREAD_MS));
      if (state.mode === "photos") {
        state.timers = each(state.pieces.filter((piece) => piece.photo), (photo) => popWords(state, photo));
        state.mode = "words";
      } else {
        const ids = new Set(state.pieces.map((piece) => piece.id));
        state.timers = each(items.filter((item) => ids.has(item.id)), (item) => popPhoto(state, item));
        state.mode = "photos";
      }
      state.busyUntil = performance.now() + POP_SPREAD_MS + POP_MS;
      state.swap.textContent = SWAP_LABEL[state.mode];
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
      const triggerRect = dumpTrigger.getBoundingClientRect();

      // The lists have just been tipped onto the floor, so nothing is open any
      // more: close them all so the navs read [+] again instead of [-]. What was
      // open is remembered here and put back when the page is restored.
      state.openClasses = OPEN_CLASSES.filter((c) => document.body.classList.contains(c));
      document.body.classList.remove(...state.openClasses);
      updateContentMinHeight();

      const { Engine, Bodies, Composite, Mouse, MouseConstraint } = Matter;
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
      Object.assign(state, { Matter, engine, layer, sources, words, floorY, pieces: [], mode: "words" });
      const fallen = spawnWords(state, words.map((_, wi) => wi));

      // Stands where the trigger stood, now that the trigger is on the floor.
      // It sits outside the layer: Matter cancels touches there, and with them
      // the click a phone would send.
      const swap = document.createElement("button");
      swap.type = "button";
      swap.className = "dump-swap";
      swap.textContent = SWAP_LABEL.words;
      swap.style.left = `${triggerRect.left}px`;
      swap.style.top = `${triggerRect.top}px`;
      swap.addEventListener("click", () => {
        // Not while the photos are still going off.
        if (performance.now() < (state.busyUntil || 0)) return;
        swapPile(state);
      });
      state.swap = swap;

      document.body.append(layer, swap);
      document.body.classList.add("is-dumped");
      hidePeek();

      // Dropping the inline colour lets the dimmed words ease back to black on
      // the way down rather than snapping the moment they appear. The reflow is
      // what makes it a transition: without it the starting colour is never
      // computed and the change lands in one frame.
      void layer.offsetWidth;
      fallen.forEach(({ el }) => {
        el.style.color = "";
      });
      swap.classList.add("is-on");

      // Fetched now, while the words are still falling, so the photos are
      // already there if they are asked for.
      items.forEach((item) => {
        new Image().src = item.dumpSrc;
      });

      const mouse = Mouse.create(layer);
      // Matter grabs wheel events by default, which would block page scrolling.
      mouse.element.removeEventListener("wheel", mouse.mousewheel);
      Composite.add(engine.world, MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2 } }));

      let last = performance.now();
      const step = (now) => {
        Engine.update(engine, Math.min(now - last, 32));
        last = now;
        state.pieces.forEach((piece) => {
          const { body, el, w, h } = piece;
          const scale = piece.pop ? growPiece(state, piece, now) : "";
          el.style.transform = `translate(${body.position.x - w / 2}px, ${body.position.y - h / 2}px) rotate(${body.angle}rad)${scale}`;
        });
        state.raf = requestAnimationFrame(step);
      };
      state.raf = requestAnimationFrame(step);
    }

    const RETURN_MS = 1000;
    const RETURN_STAGGER_MS = 200;
    // Photos make a shorter flight, set off one after another down the list, so
    // the rows fill in from the top at an even pace instead of all at the end.
    // Together these stop just short of the full return, leaving the last row
    // time to fade in.
    const PHOTO_RETURN_MS = 600;
    const PHOTO_STAGGER_MS = 480;
    const ROW_FADE_MS = 120;

    // Leaving the dump: nothing just vanishes. Words fly back to the spot in the
    // list they fell from, and the real page is swapped in underneath. A photo
    // flies to its row and shrinks to the height of a line, and the row's text
    // shows the moment the photo arrives — top row first, each lit by its own photo.
    // `animate: false` is for when those spots are about to move (a resize).
    function endDump({ animate = true } = {}) {
      if (!dumpState) return;
      const state = dumpState;
      // A second request while the pile is in flight lands it at once.
      if (state.returning) {
        finishDump(state);
        return;
      }
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = null;

      // Put the page back the way it was before everything fell. It stays
      // hidden under is-dumped, but it has its layout again, so it can be measured.
      if (state.openClasses) {
        document.body.classList.add(...state.openClasses);
        updateContentMinHeight();
      }

      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Measured now rather than remembered from the fall: closing the lists may
      // have changed the scroll position since.
      const homes = state.pieces && !still && animate ? state.sources.flatMap(collectWords) : [];
      if (!homes.length || homes.length !== state.words.length) {
        finishDump(state);
        return;
      }

      state.returning = true;
      // Nothing can be grabbed mid-flight, and the pile can't be swapped.
      state.layer.style.pointerEvents = "none";
      state.swap.remove();
      // With photos on the floor the list has to be seen arriving, so it is
      // shown early with every row blanked; a row comes back when its photo lands.
      // The trigger's words are still flying as words, so its own text waits.
      const rows = new Map();
      if (state.pieces.some((piece) => piece.photo)) {
        [indexListEl, titleListEl, logListEl].forEach((listEl) => {
          listEl.querySelectorAll("li").forEach((li) => {
            li.style.opacity = 0;
            if (!rows.has(li.dataset.id)) rows.set(li.dataset.id, []);
            rows.get(li.dataset.id).push(li);
          });
        });
        dumpTrigger.style.visibility = "hidden";
        contentEl.style.visibility = "visible";
        state.blanked = [...rows.values()].flat();
      }

      // Where each photo's row sits in the list as it is sorted now, 0 at the
      // top and 1 at the bottom.
      const rowTops = [...new Set(homes.filter((home) => home.id).map((home) => home.rect.top))].sort((a, b) => a - b);
      const flights = state.pieces.map(({ body, el, w, h, id, wi, photo }) => {
        // A photo heads for the first word of its row, the number.
        const { rect } = photo ? homes.find((home) => home.id === id) : homes[wi];
        return {
          el,
          lights: photo && rows.get(id),
          x0: body.position.x - w / 2,
          y0: body.position.y - h / 2,
          // Unwind the short way round, however many times the piece tumbled.
          a0: Math.atan2(Math.sin(body.angle), Math.cos(body.angle)),
          x1: photo ? rect.left + rect.width / 2 - w / 2 : rect.left,
          y1: photo ? rect.top + rect.height / 2 - h / 2 : rect.top,
          // A photo ends up as tall as the line it lands on.
          scale: photo ? rect.height / h : 1,
          duration: photo ? PHOTO_RETURN_MS : RETURN_MS,
          delay: photo
            ? (rowTops.indexOf(rect.top) / Math.max(rowTops.length - 1, 1)) * PHOTO_STAGGER_MS
            : Math.random() * RETURN_STAGGER_MS,
        };
      });

      const start = performance.now();
      const fly = (now) => {
        const elapsed = now - start;
        flights.forEach((flight) => {
          const { el, lights, x0, y0, a0, x1, y1, scale, duration, delay } = flight;
          const t = Math.min(Math.max((elapsed - delay) / duration, 0), 1);
          // ease-in: a slow lift off the pile that keeps gathering speed, so the
          // piece snaps onto its line instead of drifting in
          const k = t * t * t;
          const shrink = lights ? ` scale(${1 - (1 - scale) * k})` : "";
          el.style.transform = `translate(${x0 + (x1 - x0) * k}px, ${y0 + (y1 - y0) * k}px) rotate(${a0 * (1 - k)}rad)${shrink}`;
          if (lights && t === 1 && !flight.landed) {
            // The photo gives way to its row in one short cross-fade.
            flight.landed = true;
            [el, ...lights].forEach((node) => {
              node.style.transition = `opacity ${ROW_FADE_MS}ms ease`;
            });
            el.style.opacity = 0;
            lights.forEach((li) => {
              li.style.opacity = "";
            });
          }
        });
        if (elapsed < RETURN_MS + RETURN_STAGGER_MS) {
          state.raf = requestAnimationFrame(fly);
        } else {
          finishDump(state);
        }
      };
      state.raf = requestAnimationFrame(fly);
    }

    function finishDump(state) {
      if (dumpState !== state) return;
      dumpState = null;
      if (state.raf) cancelAnimationFrame(state.raf);
      if (state.timers) state.timers.forEach(clearTimeout);
      if (state.layer) state.layer.remove();
      if (state.swap) state.swap.remove();
      if (state.engine) state.Matter.Engine.clear(state.engine);
      document.body.classList.remove("is-dumped");
      if (state.blanked) {
        state.blanked.forEach((li) => {
          li.style.opacity = "";
          li.style.transition = "";
        });
        dumpTrigger.style.visibility = "";
        contentEl.style.visibility = "";
      }
    }

    function onDumpResize() {
      endDump({ animate: false });
    }

    function onDumpKeyDown(e) {
      if (e.key === "Escape") endDump();
    }

    dumpTrigger.addEventListener("click", startDump);
    // Any header click puts the page back together, and does only that —
    // letting the nav's own toggle run as well would collapse what the restore
    // just reopened.
    function onHeaderClickWhileDumped(e) {
      if (!dumpState) return;
      e.stopPropagation();
      e.preventDefault();
      endDump();
    }
    headerEl.addEventListener("click", onHeaderClickWhileDumped, true);
    window.addEventListener("resize", onDumpResize);
    document.addEventListener("keydown", onDumpKeyDown);

    return () => {
      cancelled = true;
      if (layerSwapTimeout) clearTimeout(layerSwapTimeout);
      if (rollTimeout) clearTimeout(rollTimeout);
      clearTimeout(warmTimer);
      clearTimeout(unhoverTimer);
      endDump({ animate: false });
      dumpTrigger.removeEventListener("click", startDump);
      headerEl.removeEventListener("click", onHeaderClickWhileDumped, true);
      window.removeEventListener("resize", onDumpResize);
      document.removeEventListener("keydown", onDumpKeyDown);
      navIndex.removeEventListener("click", onNavIndexClick);
      navTitles.removeEventListener("click", onNavTitlesClick);
      navTitle.removeEventListener("click", onNavTitleClick);
      navLog.removeEventListener("click", onNavLogClick);
      popupZoomBtn.removeEventListener("click", onZoomClick);
      popupImageStack.removeEventListener("mousemove", onStackMouseMove);
      popupImageStack.removeEventListener("click", onStackClick);
      popupImageStack.removeEventListener("touchstart", onStackTouchStart);
      popupImageStack.removeEventListener("touchend", onStackTouchEnd);
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
          <p>This archive is where all kinds of images just get dumped in. (Literally a dump.)<br />Some of them I have something to say about, and some of them I just liked the look of.</p>
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
            <button type="button" className="popup-zoom" id="popup-zoom">
              ZOOM [+]
            </button>
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
        <div className="footer">
          <span>© 2026 JUNGPARK. ALL RIGHTS RESERVED</span>
        </div>
        <div className="last-dump" id="last-dump"></div>
      </footer>
    </>
  );
}
