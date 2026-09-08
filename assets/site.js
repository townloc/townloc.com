(function () {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  document.documentElement.classList.add("js");
  document.documentElement.classList.add("is-ready");

  /* Smooth hero media: fade image only after it's decoded (no design/content change). */
  (function readyHeroBanner() {
    var banner = document.querySelector(".hero-banner");
    var img = banner && banner.querySelector(".hero-banner-img");
    if (!banner || !img) return;
    var done = false;
    function mark() {
      if (done) return;
      done = true;
      banner.classList.add("is-media-ready");
    }
    if (img.complete && img.naturalWidth > 0) {
      mark();
      return;
    }
    img.addEventListener("load", mark, { once: true });
    img.addEventListener("error", mark, { once: true });
    // Fallback if load event was missed
    window.setTimeout(mark, 2500);
  })();

  var siteHeader = document.getElementById("site-header");
  if (siteHeader) {
    var onScroll = function () {
      siteHeader.classList.toggle("is-stuck", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var sections = ["work", "trust", "faq", "contact"];
  var navLinks = document.querySelectorAll("[data-nav]");
  function markNav() {
    var current = "";
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.getBoundingClientRect().top < 120) current = id;
    });
    navLinks.forEach(function (link) {
      link.classList.toggle("is-active", link.getAttribute("data-nav") === current);
    });
  }
  window.addEventListener("scroll", markNav, { passive: true });
  markNav();

  /* Same-page / clean cross-page section links — no # or .html in the address bar */
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  function prettyPath(pathname) {
    var p = String(pathname || "/");
    if (/^\/index\.html$/i.test(p)) return "/";
    if (/\/index\.html$/i.test(p)) {
      var dir = p.replace(/\/index\.html$/i, "/");
      return dir || "/";
    }
    if (/\.html$/i.test(p)) return p.replace(/\.html$/i, "");
    return p;
  }

  function prettyHref(url) {
    return prettyPath(url.pathname) + (url.search || "");
  }

  function toPrettyHrefString(href, anchor) {
    if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) return null;
    try {
      if (href.charAt(0) === "#") {
        var onlyId = decodeURIComponent(href.slice(1));
        if (!onlyId) return null;
        if (anchor) anchor.setAttribute("data-townloc-section", onlyId);
        return currentPrettyUrl();
      }
      var url = new URL(href, location.href);
      if (url.origin !== location.origin) return null;
      if (
        /\.(css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|pdf|xml|txt|json|mp4|webm)$/i.test(
          url.pathname
        )
      ) {
        return null;
      }
      if (url.hash && url.hash.length > 1) {
        var sid = decodeURIComponent(url.hash.slice(1));
        if (sid && anchor) anchor.setAttribute("data-townloc-section", sid);
      }
      var next = prettyPath(url.pathname) + (url.search || "");
      return next === href ? null : next;
    } catch (err) {
      return null;
    }
  }

  function currentPrettyUrl() {
    return prettyPath(location.pathname) + location.search;
  }

  /** So browser status-bar hover never shows index.html / *.html / #section */
  function rewriteAllAnchorHrefs() {
    document.querySelectorAll("a[href]").forEach(function (a) {
      var href = a.getAttribute("href");
      var next = toPrettyHrefString(href, a);
      if (next != null) a.setAttribute("href", next);
    });
  }
  rewriteAllAnchorHrefs();

  function stripUglyFromAddressBar() {
    var pretty = currentPrettyUrl();
    var now = location.pathname + location.search + location.hash;
    if (now !== pretty) {
      history.replaceState(null, "", pretty);
    }
  }

  function isHomePath(pathname) {
    var p = String(pathname || "/").replace(/\/+$/, "") || "/";
    return p === "/" || /(^|\/)index\.html$/i.test(p);
  }

  function pathsMatch(a, b) {
    var pa = prettyPath(a).replace(/\/+$/, "") || "/";
    var pb = prettyPath(b).replace(/\/+$/, "") || "/";
    return pa === pb;
  }

  var SCROLL_KEY = "townloc_scroll_to";

  function sectionIdFromLink(link, href) {
    if (link) {
      var data = link.getAttribute("data-townloc-section");
      if (data) return data;
      var nav = link.getAttribute("data-nav");
      if (nav) return nav;
    }
    if (!href) return null;
    if (href.charAt(0) === "#") return decodeURIComponent(href.slice(1)) || null;
    try {
      var url = new URL(href, location.href);
      if (url.hash && url.hash.length > 1) {
        return decodeURIComponent(url.hash.slice(1)) || null;
      }
    } catch (err) {}
    return null;
  }

  /** Local section on this page. */
  function samePageSectionId(link, href) {
    var id = sectionIdFromLink(link, href);
    if (!id || !document.getElementById(id)) return null;
    // Prefer staying on this page whenever the section exists here
    // (Contact on service pages; Work/Trust/FAQ on home).
    if (href && href.charAt(0) !== "#") {
      try {
        var url = new URL(href, location.href);
        if (url.search && isHomePath(url.pathname) && !isHomePath(location.pathname)) {
          return null; // ?service=… must go home
        }
      } catch (err) {}
    }
    return id;
  }

  /** Section not on this page → go clean URL + scroll after load. */
  function crossPageSectionNav(link, href) {
    var id = sectionIdFromLink(link, href);
    if (!id || document.getElementById(id)) return null;
    try {
      var url =
        href && href.charAt(0) !== "#"
          ? new URL(href, location.href)
          : new URL("/", location.href);
      if (url.origin !== location.origin) return null;
      return { id: id, cleanUrl: prettyHref(url) || "/" };
    } catch (err) {
      return null;
    }
  }

  function shouldRewriteInternalNav(link, href) {
    if (!link || !href) return null;
    if (link.classList.contains("legal-link")) return null;
    if (link.hasAttribute("download")) return null;
    if (link.target && link.target !== "" && link.target !== "_self") return null;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return null;
    try {
      var url = new URL(href, location.href);
      if (url.origin !== location.origin) return null;
      if (
        /\.(css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|pdf|xml|txt|json|mp4|webm)$/i.test(
          url.pathname
        )
      ) {
        return null;
      }
      var pretty = prettyHref(url);
      var rawPathSearch = url.pathname + url.search;
      if (pretty === rawPathSearch && !url.hash) return null;
      return { url: url, pretty: pretty };
    } catch (err) {
      return null;
    }
  }

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href") || "";

    var localId = samePageSectionId(link, href);
    if (localId) {
      event.preventDefault();
      scrollToId(localId);
      stripUglyFromAddressBar();
      if (typeof setMobileOpen === "function") setMobileOpen(false);
      return;
    }

    var remote = crossPageSectionNav(link, href);
    if (remote) {
      event.preventDefault();
      try {
        sessionStorage.setItem(SCROLL_KEY, remote.id);
      } catch (err) {}
      if (typeof leavePageNow === "function") leavePageNow();
      location.assign(remote.cleanUrl);
      return;
    }

    var rewrite = shouldRewriteInternalNav(link, href);
    if (!rewrite) return;
    event.preventDefault();
    if (typeof leavePageNow === "function") leavePageNow();
    if (pathsMatch(rewrite.url.pathname, location.pathname) && rewrite.url.search === location.search) {
      stripUglyFromAddressBar();
      var sectionStay = sectionIdFromLink(link, href);
      if (sectionStay && document.getElementById(sectionStay)) {
        scrollToId(sectionStay);
        if (typeof setMobileOpen === "function") setMobileOpen(false);
        return;
      }
      // Already on this page (e.g. home logo) — scroll to top instead of a dead click.
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      if (typeof setMobileOpen === "function") setMobileOpen(false);
      return;
    }
    location.assign(rewrite.pretty);
  });

  try {
    var pendingScroll = sessionStorage.getItem(SCROLL_KEY);
    if (pendingScroll) {
      sessionStorage.removeItem(SCROLL_KEY);
      if (document.getElementById(pendingScroll)) {
        window.setTimeout(function () {
          scrollToId(pendingScroll);
        }, 0);
      }
    }
  } catch (err) {}

  // Capture bookmarked #section, then drop .html / # from the address bar.
  var bootHashId =
    location.hash.length > 1
      ? decodeURIComponent(location.hash.slice(1))
      : "";
  stripUglyFromAddressBar();
  if (bootHashId && document.getElementById(bootHashId)) {
    window.setTimeout(function () {
      scrollToId(bootHashId);
    }, 0);
  }

  var menuBtn = document.getElementById("menu-btn");
  var mobileMenu = document.getElementById("mobile-menu");
  var iconOpen = document.getElementById("icon-open");
  var iconClose = document.getElementById("icon-close");
  var mobileServicesBtn =
    document.getElementById("mobile-services-btn") ||
    document.querySelector(".mobile-services-btn");
  var mobileServices =
    document.getElementById("mobile-services") ||
    (mobileServicesBtn &&
      mobileServicesBtn.closest(".mobile-menu-item") &&
      mobileServicesBtn.closest(".mobile-menu-item").querySelector(".mobile-services"));

  function setServicesOpen(open) {
    document.querySelectorAll(".mobile-services").forEach(function (panel) {
      panel.classList.toggle("is-open", open && panel === mobileServices);
    });
    document.querySelectorAll(".mobile-services-btn").forEach(function (btn) {
      var item = btn.closest(".mobile-menu-item");
      var panel = item && item.querySelector(".mobile-services");
      var isTarget = panel && panel === mobileServices;
      btn.setAttribute("aria-expanded", String(Boolean(open && isTarget)));
    });
  }

  function setMobileOpen(open) {
    if (!mobileMenu || !menuBtn) return;
    mobileMenu.classList.remove("hidden");
    mobileMenu.classList.toggle("is-open", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (iconOpen) iconOpen.classList.toggle("hidden", open);
    if (iconClose) iconClose.classList.toggle("hidden", !open);
    if (siteHeader) siteHeader.classList.toggle("is-menu-open", open);
    document.documentElement.classList.toggle("nav-locked", open);
    if (!open) setServicesOpen(false);
  }

  function leavePageNow() {
    document.documentElement.classList.add("is-navigating");
    document.documentElement.classList.remove("nav-locked");
    if (siteHeader) siteHeader.classList.remove("is-menu-open");
    if (mobileMenu) {
      mobileMenu.classList.remove("is-open");
      mobileMenu.setAttribute("aria-hidden", "true");
    }
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Open menu");
    }
    if (iconOpen) iconOpen.classList.remove("hidden");
    if (iconClose) iconClose.classList.add("hidden");
    setServicesOpen(false);
  }

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", function () {
      setMobileOpen(!mobileMenu.classList.contains("is-open"));
    });
  }

  document.querySelectorAll(".nav-drop-btn").forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      var drop = btn.closest(".nav-drop");
      var open = !drop.classList.contains("is-open");
      document.querySelectorAll(".nav-drop.is-open").forEach(function (other) {
        other.classList.remove("is-open");
        var otherBtn = other.querySelector(".nav-drop-btn");
        if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
      });
      drop.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  document.querySelectorAll(".nav-drop-menu").forEach(function (menu) {
    menu.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  });

  document.addEventListener("click", function () {
    document.querySelectorAll(".nav-drop.is-open").forEach(function (drop) {
      drop.classList.remove("is-open");
      var btn = drop.querySelector(".nav-drop-btn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".nav-drop.is-open").forEach(function (drop) {
      drop.classList.remove("is-open");
      var btn = drop.querySelector(".nav-drop-btn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
    setMobileOpen(false);
  });

  if (mobileServicesBtn && mobileServices) {
    mobileServicesBtn.addEventListener("click", function () {
      setServicesOpen(!mobileServices.classList.contains("is-open"));
    });
  }
  // Extra CMS dropdowns (non-Services): toggle their own panel
  document.querySelectorAll(".mobile-services-btn").forEach(function (btn) {
    if (btn === mobileServicesBtn) return;
    btn.addEventListener("click", function () {
      var item = btn.closest(".mobile-menu-item");
      var panel = item && item.querySelector(".mobile-services");
      if (!panel) return;
      var open = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  document.querySelectorAll(".mobile-link, .nav-drop-item").forEach(function (link) {
    link.addEventListener("click", function () {
      var href = link.getAttribute("href") || "";
      if (href.charAt(0) === "#" || samePageSectionId(link, href) || link.getAttribute("data-townloc-section")) {
        setMobileOpen(false);
        return;
      }
      /* Skip menu-close animation so category navigation does not feel stuck */
      leavePageNow();
    });
  });

  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 768px)").matches) setMobileOpen(false);
  });

  document.querySelectorAll(".legal-link").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      var href = link.getAttribute("href") || "";
      if (href.charAt(0) !== "#") return;
      var dialog = document.getElementById(href.slice(1));
      if (dialog) dialog.showModal();
    });
  });

  var faqItems = document.querySelectorAll("#faq details");
  function closeFaq(item) {
    var panel = item.querySelector(".faq-panel");
    item.classList.remove("is-open");
    var done = false;
    var finish = function (event) {
      if (done) return;
      if (event && event.target && event.target !== panel) return;
      if (event && event.propertyName && event.propertyName !== "grid-template-rows") return;
      done = true;
      item.removeAttribute("open");
      panel.removeEventListener("transitionend", finish);
    };
    panel.addEventListener("transitionend", finish);
    setTimeout(finish, 420);
  }
  function openFaq(item) {
    item.setAttribute("open", "");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        item.classList.add("is-open");
      });
    });
  }
  faqItems.forEach(function (item) {
    var summary = item.querySelector("summary");
    if (!summary) return;
    summary.addEventListener("click", function (event) {
      event.preventDefault();
      if (item.classList.contains("is-open")) {
        closeFaq(item);
        return;
      }
      faqItems.forEach(function (other) {
        if (other !== item && other.classList.contains("is-open")) closeFaq(other);
      });
      openFaq(item);
    });
  });

  if ("IntersectionObserver" in window) {
    var reveals = document.querySelectorAll(".reveal");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var delay = Math.min(i * 70, 280);
        window.setTimeout(function () {
          entry.target.classList.add("in");
        }, delay);
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    var vh = window.innerHeight || document.documentElement.clientHeight;
    reveals.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      // Already on-screen: show immediately (no pending hide → no refresh blink)
      if (rect.top < vh * 0.92 && rect.bottom > 0) {
        el.classList.add("in");
        return;
      }
      // Below fold: hide then animate in on scroll (matches site.css .reveal-pending)
      el.classList.add("reveal-pending");
      io.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("in");
    });
  }

  var backToTop = document.createElement("button");
  backToTop.type = "button";
  backToTop.className = "back-to-top";
  backToTop.setAttribute("aria-label", "Back to top");
  backToTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(backToTop);

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  backToTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  function toggleBackToTop() {
    backToTop.classList.toggle("is-visible", window.scrollY > 320);
  }

  toggleBackToTop();
  window.addEventListener("scroll", toggleBackToTop, { passive: true });

  var form = document.getElementById("contract-form");
  if (!form) return;

  var params = new URLSearchParams(window.location.search);
  var preset = params.get("service");

  if (preset === "GMB" || preset === "Google My Business" || preset === "Local SEO") preset = "Google Business Profile";
  if (preset === "Google Maps Review Management" || preset === "Google Business Reviews" || preset === "Reviews" || preset === "Reputation Management") preset = "Google Reviews & Reputation Management";
  if (preset === "Google Ads Campaigns" || preset === "Paid Advertising") preset = "Google Ads";
  if (preset === "Web Development" || preset === "Websites" || preset === "Website Building" || preset === "Web Design & Development") preset = "Website Design & Development";
  if (preset === "Not sure yet") preset = "Not sure";

  if (preset && form.service) form.service.value = preset;

  var errorEl = document.getElementById("form-error");
  var successEl = document.getElementById("form-success");
  var successCopy = document.getElementById("success-copy");

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function clearInvalid() {
    form.querySelectorAll(".field-input").forEach(function (el) {
      el.classList.remove("is-invalid");
    });
  }

  function markInvalid(name) {
    var el = form.elements[name];
    if (el) el.classList.add("is-invalid");
  }

  form.querySelectorAll(".field-input").forEach(function (el) {
    el.addEventListener("input", function () {
      el.classList.remove("is-invalid");
    });
  });

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isValidPhone(value) {
    return value.replace(/\D/g, "").length >= 10;
  }

  function contactApiUrl() {
    return "/api/contact";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (errorEl) errorEl.classList.add("hidden");
    clearInvalid();

    var data = {
      clientName: form.clientName.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      businessName: form.businessName.value.trim(),
      mapsLink: form.mapsLink.value.trim(),
      service: form.service.value,
      message: form.message.value.trim(),
      submittedAt: new Date().toISOString(),
    };

    if (!data.clientName || !data.email || !data.phone || !data.businessName || !data.service) {
      ["clientName", "email", "phone", "businessName", "service"].forEach(function (key) {
        if (!data[key]) markInvalid(key);
      });
      showError("Please complete every required field before sending.");
      return;
    }
    if (!isValidEmail(data.email)) {
      markInvalid("email");
      showError("That email does not look usable. Check the spelling and try again.");
      return;
    }
    if (!isValidPhone(data.phone)) {
      markInvalid("phone");
      showError("Enter a phone number with at least 10 digits so we can actually reach you.");
      return;
    }
    if (data.mapsLink) {
      try {
        var parsed = new URL(data.mapsLink);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("bad protocol");
      } catch (err) {
        markInvalid("mapsLink");
        showError("The Google Maps link needs to be a full URL, starting with https://");
        return;
      }
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    var hpField = form.elements["website2"];
    var payload = {
      clientName: data.clientName,
      email: data.email,
      phone: data.phone,
      businessName: data.businessName,
      mapsLink: data.mapsLink,
      service: data.service,
      message: data.message,
      website2: hpField ? hpField.value : "",
    };

    fetch(contactApiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        }).catch(function () {
          return {
            ok: false,
            status: res.status,
            body: { success: false, message: "Unexpected response from the server." },
          };
        });
      })
      .then(function (result) {
        if (!result.body || result.body.success !== true) {
          showError(
            (result.body && result.body.message) ||
              "Something went wrong. Please try again later."
          );
          return;
        }

        try {
          var existing = JSON.parse(localStorage.getItem("townloc-contracts") || "[]");
          if (!Array.isArray(existing)) existing = [];
          existing.push(data);
          localStorage.setItem("townloc-contracts", JSON.stringify(existing));
        } catch (err) {
          /* Ignore storage failures; the request already reached the API. */
        }

        form.classList.add("hidden");
        if (successEl) {
          successEl.classList.remove("hidden");
          successEl.classList.add("success-pop");
        }
        if (successCopy) {
          successCopy.innerHTML =
            "Thanks, <span class=\"text-ink\">" +
            escapeHtml(data.clientName) +
            "</span>. Your request for <span class=\"text-ink\">" +
            escapeHtml(data.service) +
            "</span> has been received. We’ll be in touch shortly.";
        }
      })
      .catch(function () {
        showError("Could not reach the server. Check your connection and try again.");
      })
      .finally(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });

  var sendAnother = document.getElementById("send-another");
  if (sendAnother) {
    sendAnother.addEventListener("click", function () {
      form.reset();
      clearInvalid();
      if (preset && form.service) form.service.value = preset;
      if (successEl) {
        successEl.classList.add("hidden");
        successEl.classList.remove("success-pop");
      }
      form.classList.remove("hidden");
    });
  }

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
