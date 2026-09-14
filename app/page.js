"use client";

import { useEffect } from "react";

const SANITY_PROJECT_ID = "eg4pfiee";
const SANITY_DATASET = "production";

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
    const indexListEl = document.getElementById("index-list");
    const titleListEl = document.getElementById("title-list");
    const sortDateBtn = document.getElementById("sort-date");
    const sortAlphaBtn = document.getElementById("sort-alpha");

    let originalItems = [];
    let items = [];
    let indexById = new Map();
    let currentIndex = -1;
    let sortField = "date";
    let sortDir = "asc";

    function onNavIndexClick(e) {
      e.preventDefault();
      document.body.classList.toggle("is-index-open");
      if (!document.body.classList.contains("is-index-open")) {
        document.body.classList.remove("is-titles-open");
      }
    }

    function onNavTitlesClick(e) {
      e.preventDefault();
      document.body.classList.toggle("is-titles-open");
    }

    navIndex.addEventListener("click", onNavIndexClick);
    navTitles.addEventListener("click", onNavTitlesClick);

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
        loadingLayer.classList.add("is-loading");
        loadingLayer.style.opacity = "1";
        loadingLayer.src = item.blurSrc;
        backLayer.style.opacity = "0";
        backLayer.src = "";

        const fullImg = new Image();
        fullImg.onload = () => {
          if (currentIndex !== index) return;
          loadingLayer.src = item.fullSrc;
          loadingLayer.classList.remove("is-loading");
        };
        fullImg.src = item.fullSrc;

        popupOverlay.classList.add("is-active");
        return;
      }

      if (layerSwapTimeout) clearTimeout(layerSwapTimeout);

      // Same capture-the-element trick as above: backLayer becomes
      // frontLayer once the timeout below fires, so the onload has to keep
      // a fixed reference to the element it's actually loading into.
      const loadingLayer = backLayer;
      loadingLayer.alt = item.title;
      loadingLayer.classList.add("is-loading");
      loadingLayer.src = item.blurSrc;

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

      const fullImg = new Image();
      fullImg.onload = () => {
        if (currentIndex !== index) return;
        loadingLayer.src = item.fullSrc;
        loadingLayer.classList.remove("is-loading");
      };
      fullImg.src = item.fullSrc;

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
    }

    function hidePeek() {
      peek.classList.remove("is-on");
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

      flipRender(indexListEl, indexHtml);
      flipRender(titleListEl, titleHtml);
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

      function setHoverLinked(id, on) {
        const link = indexLinkById.get(id);
        const titleItem = titleItemById.get(id);
        if (link) link.classList.toggle("is-hover-linked", on);
        if (titleItem) titleItem.classList.toggle("is-hover-linked", on);
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

      titleItemById.forEach((li, id) => {
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
      const indexItems = Array.from(indexListEl.children);
      const titleItems = Array.from(titleListEl.children);
      indexItems.forEach((el) => {
        el.style.minHeight = "";
      });
      titleItems.forEach((el) => {
        el.style.minHeight = "";
      });
      indexItems.forEach((el, i) => {
        const titleEl = titleItems[i];
        if (!titleEl) return;
        const h = Math.max(el.getBoundingClientRect().height, titleEl.getBoundingClientRect().height);
        el.style.minHeight = `${h}px`;
        titleEl.style.minHeight = `${h}px`;
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

    function prefetchThumbs() {
      items.forEach((it) => {
        const img = new Image();
        img.src = it.thumbSrc;
      });
    }

    let cancelled = false;

    async function loadPhotos() {
      const groq = '*[_type=="photo"]{num,title,where,when,note,"url":image.asset->url}|order(num asc)';
      const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/${SANITY_DATASET}?query=${encodeURIComponent(groq)}`;

      const res = await fetch(url);
      const { result } = await res.json();
      if (cancelled) return;

      originalItems = result.map((r) => {
        const dimsMatch = r.url.match(/-(\d+)x(\d+)\.\w+$/);
        return {
          id: r.num,
          title: r.title,
          where: r.where || "",
          when: r.when || "",
          note: r.note || "",
          fullSrc: `${r.url}?w=1800`,
          thumbSrc: `${r.url}?w=700`,
          blurSrc: `${r.url}?w=40`,
          width: dimsMatch ? Number(dimsMatch[1]) : null,
          height: dimsMatch ? Number(dimsMatch[2]) : null,
        };
      });
      items = [...originalItems];
      indexById = new Map(items.map((it, i) => [it.id, i]));

      refresh();
      updateSortButtonsUI();
      prefetchThumbs();
    }

    loadPhotos();

    return () => {
      cancelled = true;
      if (layerSwapTimeout) clearTimeout(layerSwapTimeout);
      navIndex.removeEventListener("click", onNavIndexClick);
      navTitles.removeEventListener("click", onNavTitlesClick);
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
        <nav>
          <a href="/">DUMP-ARCHIVE</a>
        </nav>
        <nav id="nav-index">INDEX</nav>
        <nav id="nav-titles" className="nav-titles">TITLE</nav>

        <div className="sort-controls" id="sort-controls">
          <button type="button" className="sort-btn" id="sort-date">DATE</button>
          <button type="button" className="sort-btn" id="sort-alpha">A&ndash;Z</button>
        </div>
      </header>

      <div className="content" id="content">
        <div className="text">
          <p></p>
        </div>

        <ul className="index-list" id="index-list"></ul>

        <ul className="title-list" id="title-list"></ul>
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
            <img className="popup-image-layer" id="popup-image-a" alt="" />
            <img className="popup-image-layer" id="popup-image-b" alt="" />
          </div>
        </div>
      </div>
    </>
  );
}
