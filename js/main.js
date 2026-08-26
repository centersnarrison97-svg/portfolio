/* Progressive enhancement only — the site is fully usable without this file.
   1. Scrollspy: highlights the active section in the side nav and mobile tabs.
   2. Copy-email button and per-card copy-link buttons (revealed only when the
      Clipboard API is available).
   3. Local "like" hearts (stored in this browser only, never sent anywhere).
   4. Rail search: live-filters the timeline cards, announcing results. */

(function () {
  "use strict";

  /* ---------- shared live-region announcer ---------- */

  var copyStatus = document.getElementById("copy-status");
  var announceTimer = null;

  // One timer owns the region: a fresh message always cancels the pending
  // clear, so rapid actions can't blank each other's announcements.
  function announce(message) {
    if (!copyStatus) return;
    if (announceTimer) { clearTimeout(announceTimer); announceTimer = null; }
    copyStatus.textContent = message;
    if (message) {
      announceTimer = setTimeout(function () {
        copyStatus.textContent = "";
        announceTimer = null;
      }, 2000);
    }
  }

  /* ---------- scrollspy ---------- */

  var sections = Array.prototype.slice.call(
    document.querySelectorAll("main section[id]")
  );
  var links = Array.prototype.slice.call(
    document.querySelectorAll("[data-section]")
  );

  function setActive(id) {
    links.forEach(function (link) {
      if (link.getAttribute("data-section") === id) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  // True only when the page scrolls AND we're at its end — a page shortened
  // by search filtering (no scrollbar at all) must not count as "bottom".
  function atBottom() {
    var doc = document.documentElement;
    return (
      doc.scrollHeight > window.innerHeight + 2 &&
      window.innerHeight + window.scrollY >= doc.scrollHeight - 2
    );
  }

  if ("IntersectionObserver" in window && sections.length) {
    var lastId = sections[sections.length - 1].id;
    var current = sections[0].id;

    // Landing on a #fragment scrolls before this script runs — sync up front.
    // Fragments may target a card; attribute them to the enclosing section.
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      var enclosing = target && target.closest("main section[id]");
      if (enclosing) current = enclosing.id;
    }
    if (atBottom()) current = lastId;
    setActive(current);

    // A narrow horizontal band near the top of the viewport decides which
    // section is "current" — stable while scrolling in either direction.
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            current = entry.target.id;
          }
        });
        // The last section may never reach the band; page bottom wins.
        if (atBottom()) current = lastId;
        setActive(current);
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 }
    );
    sections.forEach(function (s) { observer.observe(s); });

    window.addEventListener("scroll", function () {
      if (atBottom() && current !== lastId) {
        current = lastId;
        setActive(current);
      }
    }, { passive: true });
  }

  /* ---------- clipboard: copy email + per-card copy link ---------- */

  if (navigator.clipboard) {
    var copyBtn = document.querySelector(".btn-copy");
    if (copyBtn) {
      copyBtn.hidden = false;
      var labelTimer = null;
      copyBtn.addEventListener("click", function () {
        navigator.clipboard.writeText(copyBtn.getAttribute("data-copy")).then(
          function () {
            var label = copyBtn.querySelector(".btn-copy-label");
            if (labelTimer) clearTimeout(labelTimer);
            copyBtn.classList.add("copied");
            label.textContent = "Copied";
            announce("Email address copied");
            labelTimer = setTimeout(function () {
              copyBtn.classList.remove("copied");
              label.textContent = "Copy";
              labelTimer = null;
            }, 1800);
          },
          function () {
            /* Clipboard refused — the address is selectable text anyway. */
          }
        );
      });
    }

    Array.prototype.forEach.call(
      document.querySelectorAll(".action-share"),
      function (btn) {
        btn.hidden = false;
        var doneTimer = null;
        btn.addEventListener("click", function () {
          var url =
            location.origin + location.pathname +
            "#" + btn.getAttribute("data-share");
          navigator.clipboard.writeText(url).then(
            function () {
              var card = btn.closest(".card");
              var org = card && card.querySelector(".card-org");
              var name = org ? org.textContent : "the pinned card";
              if (doneTimer) clearTimeout(doneTimer);
              btn.classList.add("done");
              announce("Link to " + name + " copied");
              doneTimer = setTimeout(function () {
                btn.classList.remove("done");
                doneTimer = null;
              }, 1500);
            },
            function () {}
          );
        });
      }
    );
  }

  /* ---------- likes (localStorage, this browser only) ---------- */

  var LIKE_KEY = "hr-likes";

  function readLikes() {
    try {
      var v = JSON.parse(localStorage.getItem(LIKE_KEY));
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  var likeBtns = document.querySelectorAll(".action-like");
  if (likeBtns.length) {
    var storageOk = false;
    try {
      localStorage.setItem("__hr_t", "1");
      localStorage.removeItem("__hr_t");
      storageOk = true;
    } catch (e) { /* storage blocked — hearts stay hidden */ }

    if (storageOk) {
      // In-memory list is the source of truth; storage is best-effort, so a
      // mid-session quota failure can't make the toggle direction lie.
      var liked = readLikes();
      Array.prototype.forEach.call(likeBtns, function (btn) {
        btn.hidden = false;
        var id = btn.getAttribute("data-like");
        if (liked.indexOf(id) > -1) btn.setAttribute("aria-pressed", "true");
        btn.addEventListener("click", function () {
          var i = liked.indexOf(id);
          var on = i === -1;
          if (on) liked.push(id); else liked.splice(i, 1);
          try {
            localStorage.setItem(LIKE_KEY, JSON.stringify(liked));
          } catch (e) { /* write lost, but the visible state stays truthful */ }
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
      });
    }
  }

  /* ---------- rail search ---------- */

  var searchInput = document.getElementById("site-search");
  if (searchInput) {
    var cards = Array.prototype.slice.call(
      document.querySelectorAll("main .card")
    );
    var emptyNote = document.getElementById("search-empty");
    var searchStatus = document.getElementById("search-status");
    var statusTimer = null;

    searchInput.addEventListener("input", function () {
      var q = searchInput.value.trim().toLowerCase();
      var hits = 0;
      cards.forEach(function (card) {
        var show = !q || card.textContent.toLowerCase().indexOf(q) > -1;
        card.classList.toggle("search-hide", !show);
        if (show) hits++;
      });

      // Collapse sections whose every card is filtered out (the profile
      // section stays — its header and bio aren't cards).
      sections.forEach(function (sec) {
        if (sec.id === "home") return;
        var secCards = sec.querySelectorAll(".card");
        if (!secCards.length) return;
        var any = false;
        Array.prototype.forEach.call(secCards, function (c) {
          if (!c.classList.contains("search-hide")) any = true;
        });
        sec.classList.toggle("search-hide", !!q && !any);
      });

      if (emptyNote) {
        emptyNote.hidden = !q || hits > 0;
        var qSpan = emptyNote.querySelector("span");
        if (qSpan) qSpan.textContent = searchInput.value.trim();
      }

      // Debounced screen-reader summary in a permanently-rendered region.
      if (searchStatus) {
        if (statusTimer) clearTimeout(statusTimer);
        statusTimer = setTimeout(function () {
          searchStatus.textContent = !q ? "" : (
            hits > 0
              ? hits + " of " + cards.length + " cards match “" + q + "”"
              : "No matches for “" + q + "”. Clear the search to see everything."
          );
          statusTimer = null;
        }, 300);
      }
    });
  }
})();
