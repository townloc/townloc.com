/**
 * Townloc public CMS applicator (optional client assist).
 * Header/footer/menus/page copy are applied by the Worker — not here.
 * This file only applies branding (name, mark, logo, favicon).
 */
(function () {
  function setText(el, value) {
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

    var logo = branding.logoUrl && String(branding.logoUrl).trim();
    if (logo) {
      document.querySelectorAll("img.site-logo").forEach(function (el) {
        setSrc(el, logo);
      });
    }

    document.querySelectorAll("[data-cms='brand.name']").forEach(function (el) {
      setText(el, branding.name);
    });
    document.querySelectorAll("[data-cms='brand.mark']").forEach(function (el) {
      if (logo) {
        el.textContent = "";
        el.style.backgroundImage =
          'url("' +
          String(logo).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
          '")';
        el.style.backgroundSize = "contain";
        el.style.backgroundRepeat = "no-repeat";
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
    if (branding.mark && !logo) {
      document.querySelectorAll("#site-header .header-mark").forEach(function (el) {
        if (!el.hasAttribute("data-cms")) setText(el, branding.mark);
      });
    }
  }

  function applyCms(cms) {
    if (!cms) return;
    applyBranding(cms.branding);
    // Page text/images: Worker serveAssetWithCms + autoPages only (no client overwrite)
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
