/**
 * Townloc public CMS applicator (optional client assist).
 * Header/footer/menus are applied by the Worker (auto layout) — not here.
 * This file only handles branding + legacy [data-cms] page fields if present.
 * Master package does not require editing this for nav/menus.
 */
(function () {
  function setText(el, value) {
    if (!el || value == null || String(value).trim() === "") return;
    el.textContent = String(value);
  }

  function setHtml(el, value) {
    if (!el || value == null || String(value).trim() === "") return;
    el.textContent = String(value);
  }

  function setSrc(el, value) {
    if (!el || value == null || String(value).trim() === "") return;
    el.setAttribute("src", String(value));
  }

  function applyFavicon(url) {
    if (!url || !String(url).trim()) return;
    var links = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    if (!links.length) {
      var link = document.createElement("link");
      link.rel = "icon";
      link.href = url;
      document.head.appendChild(link);
      return;
    }
    links.forEach(function (link) {
      link.href = url;
    });
  }

  function applyBranding(branding) {
    if (!branding) return;
    applyFavicon(branding.faviconUrl);

    document.querySelectorAll("[data-cms='brand.name']").forEach(function (el) {
      setText(el, branding.name);
    });
    document.querySelectorAll("[data-cms='brand.mark']").forEach(function (el) {
      if (branding.logoUrl && String(branding.logoUrl).trim()) {
        el.textContent = "";
        el.style.backgroundImage =
          'url("' +
          String(branding.logoUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
          '")';
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
      } else {
        setText(el, branding.mark);
        el.style.backgroundImage = "";
      }
    });

    if (branding.name) {
      document.querySelectorAll("#site-header nav > a > span:last-child").forEach(function (el) {
        if (!el.hasAttribute("data-cms")) setText(el, branding.name);
      });
    }
    if (branding.mark && !(branding.logoUrl && String(branding.logoUrl).trim())) {
      document.querySelectorAll("#site-header .header-mark").forEach(function (el) {
        if (!el.hasAttribute("data-cms")) setText(el, branding.mark);
      });
    }
    if (branding.logoUrl && String(branding.logoUrl).trim()) {
      document.querySelectorAll("#site-header .header-mark").forEach(function (el) {
        if (el.hasAttribute("data-cms")) return;
        el.textContent = "";
        el.style.backgroundImage =
          'url("' + String(branding.logoUrl).replace(/"/g, "%22") + '")';
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
      });
    }
  }

  function detectPageKey() {
    var forced = document.documentElement.getAttribute("data-cms-page");
    if (forced) return forced;
    var path = location.pathname || "/";
    if (
      path === "/" ||
      (/\/index\.html$/i.test(path) &&
        path.replace(/\/index\.html$/i, "").replace(/\/$/, "") === "")
    ) {
      return "home";
    }
    if (/\/services\/?$/i.test(path) || /\/services\/index\.html$/i.test(path)) return "services";
    if (/\/industries\//i.test(path)) return "industries";
    var m = path.match(/\/services\/([^/]+?)(?:\.html)?\/?$/i);
    if (m && m[1] && m[1].toLowerCase() !== "index") {
      return "services/" + m[1].replace(/\.html$/i, "");
    }
    return "home";
  }

  function applyPage(pages, key) {
    if (!pages || !pages[key]) return;
    var data = pages[key];
    Object.keys(data).forEach(function (field) {
      var val = data[field];
      if (val == null || String(val).trim() === "") return;
      document.querySelectorAll("[data-cms='page." + field + "']").forEach(function (el) {
        if (el.tagName === "IMG" || el.hasAttribute("data-cms-src")) setSrc(el, val);
        else setHtml(el, val);
      });
      document.querySelectorAll("[data-cms-src='page." + field + "']").forEach(function (el) {
        setSrc(el, val);
      });
    });
  }

  function applyCms(cms) {
    if (!cms) return;
    applyBranding(cms.branding);
    // Menus/header/footer: Worker applyAllLayout — do not hardcode site menus here
    applyPage(cms.pages, detectPageKey());
  }

  function boot() {
    fetch("/api/cms", { credentials: "same-origin", cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("cms " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.success && data.cms) applyCms(data.cms);
      })
      .catch(function () {
        /* keep static HTML defaults */
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
