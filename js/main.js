/* Progressive enhancement only — the site is fully usable without this file.
   1. Scrollspy: highlights the active section in the side nav and mobile tabs.
   2. Copy-email button (revealed only when the Clipboard API is available). */

(function () {
  "use strict";

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

  function atBottom() {
    return (
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 2
    );
  }

  if ("IntersectionObserver" in window && sections.length) {
    var lastId = sections[sections.length - 1].id;
    var current = sections[0].id;

    // Landing on a #fragment scrolls before this script runs — sync up front.
    if (location.hash) {
      var target = location.hash.slice(1);
      if (sections.some(function (s) { return s.id === target; })) {
        current = target;
      }
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

  /* ---------- copy email ---------- */

  var copyBtn = document.querySelector(".btn-copy");
  var copyStatus = document.getElementById("copy-status");

  if (copyBtn && navigator.clipboard) {
    copyBtn.hidden = false;
    var resetTimer = null;
    copyBtn.addEventListener("click", function () {
      navigator.clipboard.writeText(copyBtn.getAttribute("data-copy")).then(
        function () {
          var label = copyBtn.querySelector(".btn-copy-label");
          if (resetTimer) clearTimeout(resetTimer);
          copyBtn.classList.add("copied");
          label.textContent = "Copied";
          if (copyStatus) copyStatus.textContent = "Email address copied";
          resetTimer = setTimeout(function () {
            copyBtn.classList.remove("copied");
            label.textContent = "Copy";
            if (copyStatus) copyStatus.textContent = "";
            resetTimer = null;
          }, 1800);
        },
        function () {
          /* Clipboard refused — the address is selectable text anyway. */
        }
      );
    });
  }
})();
