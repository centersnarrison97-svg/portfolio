/* Progressive enhancement only — the site is fully usable without this file.
   1. Scrollspy: highlights the active section in the side nav and mobile tabs.
   2. Copy-email button and per-card copy-link buttons (revealed only when the
      Clipboard API is available).
   3. Local "like" hearts (stored in this browser only, never sent anywhere).
   4. Rail search: live-filters the timeline cards, announcing results. */

(function () {
  "use strict";

  var reduceMotion = !!(
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

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

  var lastActiveId = null;

  function setActive(id) {
    if (id === lastActiveId) return;
    lastActiveId = id;
    links.forEach(function (link) {
      if (link.getAttribute("data-section") === id) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
    if (document.documentElement.classList.contains("anim")) {
      var icon = document.querySelector("#" + id + " .section-header-icon");
      if (icon) {
        icon.classList.remove("tick");
        void icon.offsetWidth; /* restart the animation */
        icon.classList.add("tick");
      }
    }
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
          if (on && !reduceMotion) {
            btn.classList.add("pop");
            setTimeout(function () { btn.classList.remove("pop"); }, 500);
          }
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

  /* ---------- entrance + diagram-draw animations ----------
     Gated so nothing is ever hidden unless BOTH IntersectionObserver exists
     and the user has no reduced-motion preference. */

  if (!reduceMotion && "IntersectionObserver" in window) {
    document.documentElement.classList.add("anim");

    var animTargets = [];
    Array.prototype.forEach.call(
      document.querySelectorAll("main .card"),
      function (card) {
        if (card.getBoundingClientRect().top > window.innerHeight) {
          card.classList.add("will-anim");
          animTargets.push(card);
        }
      }
    );
    Array.prototype.forEach.call(
      document.querySelectorAll(".card-media"),
      function (fig) { animTargets.push(fig); }
    );

    var animIO = new IntersectionObserver(function (entries) {
      var batch = 0;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          // Cards arriving in the same scroll burst cascade slightly.
          if (entry.target.classList.contains("will-anim")) {
            entry.target.style.transitionDelay = (batch * 80) + "ms";
            batch++;
          }
          entry.target.classList.add("in");
          animIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    animTargets.forEach(function (t) { animIO.observe(t); });
  }

  /* ---------- banner: terminal typing, cursor glow, click surge ----------
     Without JS or with reduced motion, the banner shows the full terminal
     text and its static art; everything here only enhances. */

  var bnSvg = document.getElementById("banner-svg");
  if (bnSvg && !reduceMotion) {

    /* terminal typing loop */
    var term = document.getElementById("bn-term");
    var tcur = document.getElementById("bn-tcur");
    if (term && tcur) {
      var termLines = Array.prototype.slice.call(term.querySelectorAll("text.bn-t"));
      var seq = [];
      termLines.forEach(function (line) {
        Array.prototype.forEach.call(line.querySelectorAll(".bn-cmd"), function (ts) {
          seq.push({ line: line, ts: ts, full: ts.textContent });
        });
      });
      // The for loop rotates each typing cycle: [header line, body line].
      var LOOP_VARIANTS = [
        ["for field in (law, software):", "    ship(field)"],
        ["for clause in agreement:", "    redline(clause)"],
        ["for reg in (gdpr, eu_ai_act):", "    comply(reg)"],
        ["for claim in patent.claims:", "    draft(claim)"],
        ["for bug in code:", "    fix(bug)"]
      ];
      var loopSegs = seq.filter(function (s) {
        return s.line === termLines[termLines.length - 2] ||
               s.line === termLines[termLines.length - 1];
      });
      var vi = Math.floor(Math.random() * LOOP_VARIANTS.length);
      var applyVariant = function () {
        var v = LOOP_VARIANTS[vi % LOOP_VARIANTS.length];
        vi++;
        if (loopSegs[0]) loopSegs[0].full = v[0];
        if (loopSegs[1]) loopSegs[1].full = v[1];
      };
      applyVariant();
      var curTo = function (line) {
        tcur.setAttribute("x", 500 + line.getComputedTextLength() + 4);
        tcur.setAttribute("y", parseFloat(line.getAttribute("y")) - 22);
      };
      var si = 0, ci = 0;
      var typeStep = function () {
        if (si >= seq.length) {
          setTimeout(function () {
            seq.forEach(function (s) { s.ts.textContent = ""; });
            applyVariant();
            si = 0; ci = 0;
            curTo(seq[0].line);
            setTimeout(typeStep, 700);
          }, 3800);
          return;
        }
        var s = seq[si];
        ci++;
        s.ts.textContent = s.full.slice(0, ci);
        curTo(s.line);
        if (ci >= s.full.length) {
          var startedNewLine = si + 1 < seq.length && seq[si + 1].line !== s.line;
          si++; ci = 0;
          setTimeout(typeStep, startedNewLine ? 500 : 60);
        } else {
          setTimeout(typeStep, 70 + Math.random() * 60);
        }
      };
      seq.forEach(function (s) { s.ts.textContent = ""; });
      curTo(seq[0].line);
      setTimeout(typeStep, 900);
    }

    /* cursor-follow glow + node proximity */
    var cgEl = document.getElementById("bn-cg");
    var bnNodes = Array.prototype.slice.call(
      document.querySelectorAll("#bn-nodes circle")
    );
    var bmx = 750, bmy = 250, btx = 750, bty = 250, bAct = false, bRaf = false;
    function bnLoop() {
      bmx += (btx - bmx) * 0.12;
      bmy += (bty - bmy) * 0.12;
      cgEl.setAttribute("cx", bmx);
      cgEl.setAttribute("cy", bmy);
      bnNodes.forEach(function (n) {
        var d = Math.hypot(n.cx.baseVal.value - bmx, n.cy.baseVal.value - bmy);
        n.setAttribute("r", bAct && d < 180 ? 4 + (1 - d / 180) * 3.5 : 4);
      });
      if (bAct || Math.abs(btx - bmx) > 1) {
        requestAnimationFrame(bnLoop);
      } else {
        bRaf = false;
      }
    }
    bnSvg.addEventListener("mousemove", function (e) {
      var r = bnSvg.getBoundingClientRect();
      btx = (e.clientX - r.left) / r.width * 1500;
      bty = (e.clientY - r.top) / r.height * 500;
      bAct = true;
      cgEl.setAttribute("opacity", "1");
      if (!bRaf) { bRaf = true; requestAnimationFrame(bnLoop); }
    });
    bnSvg.addEventListener("mouseleave", function () {
      bAct = false;
      cgEl.setAttribute("opacity", "0");
    });

    /* click: ripple at the point, bright surge through the circuit,
       brackets flash in typed sequence when the surge arrives */
    var bnKeys = document.getElementById("bn-keys");
    var surge1 = document.getElementById("bn-sm1");
    var surge2 = document.getElementById("bn-sm2");
    bnSvg.addEventListener("click", function (e) {
      var r = bnSvg.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width * 1500;
      var y = (e.clientY - r.top) / r.height * 500;
      var c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", 0);
      c.setAttribute("fill", "none");
      c.setAttribute("stroke", "#1d9bf0");
      c.setAttribute("stroke-width", 2.5);
      bnSvg.appendChild(c);
      if (c.animate) {
        c.animate(
          [{ r: "0px", opacity: 0.7 }, { r: "150px", opacity: 0 }],
          { duration: 700, easing: "ease-out" }
        ).onfinish = function () { c.remove(); };
      } else {
        c.remove();
      }
      if (surge1 && surge1.beginElement) {
        try { surge1.beginElement(); surge2.beginElement(); } catch (err) {}
      }
      if (bnKeys) {
        setTimeout(function () {
          bnKeys.classList.remove("typed");
          void bnKeys.getBoundingClientRect(); /* restart the animation */
          bnKeys.classList.add("typed");
        }, 1000);
      }
    });
  }
})();
