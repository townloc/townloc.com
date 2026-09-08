/* Townloc Admin app — dashboard UI logic */
(function () {
  if (!Admin.getToken()) {
    location.href = "index.html";
    return;
  }

  var state = {
    leads: [],
    posts: [],
    pages: [],
    activeLeadId: null,
    confirmResolve: null,
  };

  var titles = {
    dashboard: "Dashboard",
    leads: "Leads",
    posts: "Posts",
    "post-editor": "Post editor",
    pages: "Advanced",
    "site-cms": "Site CMS",
    menus: "Menus",
    settings: "Settings",
  };

  var menuUi = {
    view: "edit",
    editLocation: "primary",
    doc: { menus: [], locations: { primary: null, footer: null } },
    activeMenuId: null,
    draftName: "",
    draft: [],
    pages: [],
    customPages: [],
    posts: [],
    dirty: false,
  };

  var cmsState = {
    cms: null,
    fields: null,
    pages: [],
    customPages: [],
    autoPath: null,
    autoFields: [],
    autoValues: {},
    layoutRegion: null,
    layoutFields: [],
    layoutValues: {},
    layoutMenus: [],
  };

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg, ok) {
    var el = $("toast");
    el.textContent = msg;
    el.className = "toast show " + (ok ? "ok" : "err");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.className = "toast";
    }, 3200);
  }

  function confirmDialog(message, okLabel) {
    return new Promise(function (resolve) {
      state.confirmResolve = resolve;
      $("confirm-message").textContent = message;
      $("confirm-ok").textContent = okLabel || "Delete";
      $("confirm-ok").className =
        okLabel === "Publish" ? "btn btn-primary" : "btn btn-danger";
      $("confirm-modal").hidden = false;
      $("confirm-modal").classList.add("show");
    });
  }

  function closeConfirm(result) {
    $("confirm-modal").classList.remove("show");
    $("confirm-modal").hidden = true;
    var r = state.confirmResolve;
    state.confirmResolve = null;
    if (r) r(!!result);
  }

  function badge(status, kind) {
    var cls = "badge ";
    if (kind === "lead") {
      cls +=
        status === "new"
          ? "badge-new"
          : status === "contacted"
            ? "badge-contacted"
            : "badge-closed";
    } else {
      cls += status === "published" ? "badge-published" : "badge-draft";
    }
    return '<span class="' + cls + '">' + Admin.esc(status) + "</span>";
  }

  function showPanel(name) {
    document.querySelectorAll(".panel").forEach(function (p) {
      p.classList.remove("active");
    });
    document.querySelectorAll(".nav-item").forEach(function (n) {
      n.classList.toggle(
        "active",
        n.getAttribute("data-nav") === name ||
        (name === "post-editor" && n.getAttribute("data-nav") === "posts")
      );
    });
    var panel = $("panel-" + name);
    if (panel) panel.classList.add("active");
    $("page-title").textContent = titles[name] || "Admin";
    closeSidebar();
    if (name === "site-cms") {
      loadCms().catch(function (ex) {
        toast(ex.message || "Unable to load Site CMS.", false);
      });
    }
    if (name === "menus") {
      loadMenusPanel().catch(function (ex) {
        toast(ex.message || "Unable to load Menus.", false);
      });
    }
  }

  function openSidebar() {
    $("sidebar").classList.add("open");
    $("sidebar-overlay").hidden = false;
    $("sidebar-overlay").classList.add("show");
  }
  function closeSidebar() {
    $("sidebar").classList.remove("open");
    $("sidebar-overlay").classList.remove("show");
    $("sidebar-overlay").hidden = true;
  }

  function csvEscape(value) {
    var s = value == null ? "" : String(value);
    if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadFilteredCsv() {
    var rows = filteredLeads();
    var header = [
      "ID",
      "Name",
      "Email",
      "Phone",
      "Business",
      "Service",
      "Message",
      "Website URL",
      "Status",
      "Created At",
    ];
    var lines = [header.map(csvEscape).join(",")];
    rows.forEach(function (row) {
      lines.push(
        [
          row.id,
          row.name,
          row.email,
          row.phone,
          row.business,
          row.service,
          row.message,
          row.website_url,
          row.status,
          row.created_at,
        ]
          .map(csvEscape)
          .join(",")
      );
    });
    var csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    var day = new Date().toISOString().slice(0, 10);
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "townloc-leads-" + day + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderDash() {
    var leads = state.leads || [];
    var posts = state.posts || [];
    $("stat-leads-total").textContent = String(leads.length);
    $("stat-leads-new").textContent = String(
      leads.filter(function (l) {
        return l.status === "new";
      }).length
    );
    $("stat-posts-pub").textContent = String(
      posts.filter(function (p) {
        return p.status === "published";
      }).length
    );
    $("stat-posts-draft").textContent = String(
      posts.filter(function (p) {
        return p.status === "draft";
      }).length
    );

    var dl = $("dash-leads");
    if (!leads.length) {
      dl.innerHTML =
        '<div class="empty"><strong>No leads yet.</strong>Waiting for form submissions.</div>';
    } else {
      dl.innerHTML =
        '<div class="table-wrap"><table class="data"><thead><tr><th>Name</th><th>Business</th><th>Service</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>' +
        leads
          .slice(0, 5)
          .map(function (l) {
            return (
              "<tr><td>" +
              Admin.esc(l.name) +
              "</td><td>" +
              Admin.esc(l.business || "") +
              "</td><td>" +
              Admin.esc(l.service) +
              "</td><td>" +
              badge(l.status, "lead") +
              "</td><td>" +
              Admin.esc(l.created_at || "") +
              '</td><td><button type="button" class="btn btn-secondary btn-sm" data-dash-lead="' +
              l.id +
              '">View</button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table></div>";
      dl.querySelectorAll("[data-dash-lead]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          showPanel("leads");
          openLeadModal(Number(btn.getAttribute("data-dash-lead")));
        });
      });
    }

    var dp = $("dash-posts");
    if (!posts.length) {
      dp.innerHTML =
        '<div class="empty"><strong>No posts yet.</strong><button type="button" class="btn btn-primary btn-sm" id="dash-new-post" style="margin-top:0.75rem">New Post</button></div>';
      var np = $("dash-new-post");
      if (np)
        np.addEventListener("click", function () {
          clearPostForm();
          showPanel("post-editor");
        });
    } else {
      dp.innerHTML =
        '<div class="table-wrap"><table class="data"><thead><tr><th>Title</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>' +
        posts
          .slice(0, 5)
          .map(function (p) {
            return (
              "<tr><td>" +
              Admin.esc(p.title) +
              "</td><td>" +
              badge(p.status, "post") +
              "</td><td>" +
              Admin.esc(p.updated_at) +
              '</td><td><button type="button" class="btn btn-secondary btn-sm" data-dash-post="' +
              p.id +
              '">Edit</button></td></tr>'
            );
          })
          .join("") +
        "</tbody></table></div>";
      dp.querySelectorAll("[data-dash-post]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          editPost(Number(btn.getAttribute("data-dash-post")));
        });
      });
    }
  }

  function filteredLeads() {
    var q = ($("leads-search").value || "").toLowerCase().trim();
    var st = $("leads-filter").value;
    return (state.leads || []).filter(function (l) {
      if (st && l.status !== st) return false;
      if (!q) return true;
      var hay = [l.name, l.email, l.business, l.service, l.phone]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function renderLeads() {
    var rows = filteredLeads();
    var tbody = $("leads-body");
    var empty = $("leads-empty");
    tbody.innerHTML = "";
    if (!rows.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    rows.forEach(function (lead) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        Admin.esc(lead.name) +
        "</td><td>" +
        Admin.esc(lead.email) +
        "</td><td>" +
        Admin.esc(lead.phone || "") +
        "</td><td>" +
        Admin.esc(lead.business || "") +
        "</td><td>" +
        Admin.esc(lead.service) +
        "</td><td>" +
        badge(lead.status, "lead") +
        "</td><td>" +
        Admin.esc(lead.created_at) +
        '</td><td style="white-space:nowrap">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-view-lead="' +
        lead.id +
        '">View</button> ' +
        '<button type="button" class="btn btn-danger btn-sm" data-delete-lead="' +
        lead.id +
        '">Delete</button></td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("[data-view-lead]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openLeadModal(Number(btn.getAttribute("data-view-lead")));
      });
    });
    tbody.querySelectorAll("[data-delete-lead]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        deleteLead(Number(btn.getAttribute("data-delete-lead")));
      });
    });
  }

  function openLeadModal(id) {
    var lead = state.leads.find(function (l) {
      return l.id === id;
    });
    if (!lead) return;
    state.activeLeadId = id;
    $("lead-modal-body").innerHTML =
      "<dt>Name</dt><dd>" +
      Admin.esc(lead.name) +
      "</dd><dt>Email</dt><dd>" +
      Admin.esc(lead.email) +
      "</dd><dt>Phone</dt><dd>" +
      Admin.esc(lead.phone || "—") +
      "</dd><dt>Business</dt><dd>" +
      Admin.esc(lead.business || "—") +
      "</dd><dt>Service</dt><dd>" +
      Admin.esc(lead.service) +
      "</dd><dt>Message</dt><dd>" +
      Admin.esc(lead.message || "—") +
      "</dd><dt>Website / GBP</dt><dd>" +
      Admin.esc(lead.website_url || "—") +
      "</dd><dt>Created</dt><dd>" +
      Admin.esc(lead.created_at) +
      "</dd>";
    $("lead-modal-status").value = lead.status || "new";
    $("lead-modal").hidden = false;
    $("lead-modal").classList.add("show");
  }

  function closeLeadModal() {
    $("lead-modal").classList.remove("show");
    $("lead-modal").hidden = true;
    state.activeLeadId = null;
  }

  async function deleteLead(id) {
    if (!Number.isInteger(id) || id < 1) return toast("Invalid lead ID", false);
    var ok = await confirmDialog(
      "Are you sure you want to permanently delete this lead?"
    );
    if (!ok) return;
    try {
      await Admin.api("DELETE", "/api/admin/leads/" + id);
      toast("Lead deleted successfully.", true);
      closeLeadModal();
      await loadLeads();
    } catch (ex) {
      toast(ex.message || "Unable to delete lead.", false);
    }
  }

  function renderPosts() {
    var posts = state.posts || [];
    var tbody = $("posts-body");
    var empty = $("posts-empty");
    tbody.innerHTML = "";
    if (!posts.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    posts.forEach(function (post) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        Admin.esc(post.title) +
        "</td><td>" +
        Admin.esc(post.slug) +
        "</td><td>" +
        badge(post.status, "post") +
        "</td><td>" +
        Admin.esc(post.updated_at) +
        '</td><td style="white-space:nowrap">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-edit-post="' +
        post.id +
        '">Edit</button> ' +
        '<button type="button" class="btn btn-danger btn-sm" data-delete-post-row="' +
        post.id +
        '">Delete</button></td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("[data-edit-post]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        editPost(Number(btn.getAttribute("data-edit-post")));
      });
    });
    tbody.querySelectorAll("[data-delete-post-row]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        deletePostById(Number(btn.getAttribute("data-delete-post-row")));
      });
    });
  }

  function clearPostForm() {
    $("post-id").value = "";
    $("post-title").value = "";
    $("post-slug").value = "";
    $("post-status").value = "draft";
    $("post-featured").value = "";
    $("post-excerpt").value = "";
    $("post-body").value = "";
    $("post-meta-title").value = "";
    $("post-meta-desc").value = "";
    $("post-og").value = "";
    $("post-editor-heading").textContent = "New Post";
    updateFeaturedPreview();
    updateOgPreview();
  }

  function updateFeaturedPreview() {
    var url = ($("post-featured").value || "").trim();
    var box = $("featured-preview");
    var img = $("featured-preview-img");
    if (!url) {
      box.classList.remove("show");
      img.removeAttribute("src");
      return;
    }
    img.src = url;
    box.classList.add("show");
  }

  function updateOgPreview() {
    var url = ($("post-og").value || "").trim();
    var box = $("og-preview");
    var img = $("og-preview-img");
    if (!box || !img) return;
    if (!url) {
      box.classList.remove("show");
      img.removeAttribute("src");
      return;
    }
    img.src = url;
    box.classList.add("show");
  }

  function postPayload() {
    return {
      title: $("post-title").value,
      slug: $("post-slug").value,
      status: $("post-status").value,
      featured_image: $("post-featured").value,
      excerpt: $("post-excerpt").value,
      body: $("post-body").value,
      meta_title: $("post-meta-title").value,
      meta_description: $("post-meta-desc").value,
      og_image: $("post-og").value,
    };
  }

  async function editPost(id) {
    try {
      var res = await Admin.api("GET", "/api/admin/posts/" + id);
      var p = res.post;
      $("post-id").value = p.id;
      $("post-title").value = p.title || "";
      $("post-slug").value = p.slug || "";
      $("post-status").value = p.status || "draft";
      $("post-featured").value = p.featured_image || "";
      $("post-excerpt").value = p.excerpt || "";
      $("post-body").value = p.body || "";
      $("post-meta-title").value = p.meta_title || "";
      $("post-meta-desc").value = p.meta_description || "";
      $("post-og").value = p.og_image || "";
      $("post-editor-heading").textContent = "Edit post #" + p.id;
      updateFeaturedPreview();
      updateOgPreview();
      showPanel("post-editor");
    } catch (ex) {
      toast(ex.message || "Unable to load post.", false);
    }
  }

  async function deletePostById(id) {
    var ok = await confirmDialog(
      "Are you sure you want to permanently delete this post?"
    );
    if (!ok) return;
    try {
      await Admin.api("DELETE", "/api/admin/posts/" + id);
      toast("Post deleted successfully.", true);
      if (String($("post-id").value) === String(id)) clearPostForm();
      await loadPosts();
      showPanel("posts");
    } catch (ex) {
      toast(ex.message || "Unable to delete post.", false);
    }
  }

  function renderPages() {
    var tbody = $("pages-body");
    tbody.innerHTML = "";
    (state.pages || []).forEach(function (page) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        Admin.esc(page.path) +
        "</td><td>" +
        (page.saved ? "Yes" : "No") +
        "</td><td>" +
        Admin.esc(page.updated_at || "—") +
        '</td><td><button type="button" class="btn btn-secondary btn-sm" data-edit-page="' +
        Admin.esc(page.path) +
        '">Edit</button></td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("[data-edit-page]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var path = btn.getAttribute("data-edit-page");
        try {
          var res = await Admin.api(
            "GET",
            "/api/admin/pages/" + encodeURIComponent(path)
          );
          $("page-path").value = path;
          $("page-path-label").textContent = path;
          $("page-html").value = (res.page && res.page.html) || "";
        } catch (ex) {
          toast(ex.message || "Unable to load page.", false);
        }
      });
    });
  }

  async function loadCms() {
    var data = await Admin.api("GET", "/api/admin/cms");
    cmsState.cms = data.cms || {};
    cmsState.fields = data.fields || {};
    cmsState.pages = data.pages || [];
    cmsState.customPages = data.customPages || [];
    fillCmsPageOptions();
    await renderCmsFields();
    var st = $("cms-status");
    if (st) {
      st.textContent = "Select content above to load editable fields.";
    }
  }

  function fillCmsPageOptions() {
    var group = $("cms-auto-pages");
    if (!group) return;
    var prev = getCmsSectionKey();
    group.innerHTML = "";
    var titleByPath = {};
    (cmsState.customPages || []).forEach(function (p) {
      if (p && p.path) titleByPath[p.path] = p.title || p.path;
    });
    (cmsState.pages || []).forEach(function (path) {
      var opt = document.createElement("option");
      opt.value = "auto:" + path;
      var nice;
      if (path === "index.html") nice = "Home";
      else if (path === "privacy.html") nice = "Privacy";
      else if (path === "terms.html") nice = "Terms";
      else if (path === "industries/index.html") nice = "Industries";
      else if (path === "services/index.html") nice = "Services overview";
      else if (path.indexOf("services/") === 0) {
        nice =
          "Service — " +
          (titleByPath[path] ||
            path
              .replace(/^services\//, "")
              .replace(/\.html$/i, "")
              .replace(/-/g, " ")
              .replace(/\b\w/g, function (c) {
                return c.toUpperCase();
              }));
      } else {
        nice = path
          .replace(/\.html$/i, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, function (c) {
            return c.toUpperCase();
          });
      }
      opt.textContent = nice;
      group.appendChild(opt);
    });
    if (prev && $("cms-section")) {
      $("cms-section").value = prev;
    }
  }

  async function createServicePage() {
    var titleEl = $("cms-new-title");
    var descEl = $("cms-new-desc");
    var imgEl = $("cms-new-image");
    var st = $("cms-create-status");
    var btn = $("cms-create-page");
    var title = titleEl ? titleEl.value.trim() : "";
    if (!title) {
      if (st) st.textContent = "Enter a service name first.";
      toast("Enter a service name first.", false);
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Creating…";
    }
    if (st) st.textContent = "Creating page…";
    try {
      var res = await Admin.api("POST", "/api/admin/pages/create", {
        title: title,
        description: descEl ? descEl.value.trim() : "",
        imageUrl: imgEl ? imgEl.value.trim() : "",
      });
      cmsState.pages = res.pages || cmsState.pages;
      if (res.page) {
        cmsState.customPages = (cmsState.customPages || []).concat([res.page]);
      }
      fillCmsPageOptions();
      if ($("cms-section") && res.page && res.page.path) {
        $("cms-section").value = "auto:" + res.page.path;
      }
      if (titleEl) titleEl.value = "";
      if (descEl) descEl.value = "";
      if (imgEl) imgEl.value = "";
      await renderCmsFields();
      var url = res.url || (res.page && "/" + res.page.path) || "";
      if (st) {
        st.textContent =
          "Created. Live at " + url + " — edit the fields below, then Save.";
      }
      toast("Service page created.", true);
    } catch (ex) {
      if (st) st.textContent = ex.message || "Could not create page.";
      toast(ex.message || "Could not create page.", false);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Create service page";
      }
    }
  }

  function getCmsSectionKey() {
    return ($("cms-section") && $("cms-section").value) || "branding";
  }

  function getCmsBucket(section) {
    if (!cmsState.cms) return {};
    if (!cmsState.cms[section]) cmsState.cms[section] = {};
    return cmsState.cms[section];
  }

  function getCmsFieldDefs(section) {
    if (!cmsState.fields) return [];
    return cmsState.fields[section] || [];
  }

  function collectCmsFieldsIntoState() {
    var section = getCmsSectionKey();
    var wrap = $("cms-fields");
    if (!wrap) return;
    if (section.indexOf("auto:") === 0) {
      wrap.querySelectorAll("[data-cms-key]").forEach(function (input) {
        cmsState.autoValues[input.dataset.cmsKey] = input.value;
      });
      return;
    }
    if (section.indexOf("layout:") === 0) {
      wrap.querySelectorAll("[data-cms-key]").forEach(function (input) {
        cmsState.layoutValues[input.dataset.cmsKey] = input.value;
      });
      return;
    }
    var bucket = getCmsBucket(section);
    wrap.querySelectorAll("[data-cms-key]").forEach(function (input) {
      bucket[input.dataset.cmsKey] = input.value;
    });
  }

  function newMenuLocalId() {
    return (
      "m_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function activeMenu() {
    var id = menuUi.activeMenuId;
    return (menuUi.doc.menus || []).find(function (m) {
      return m.id === id;
    });
  }

  function menuPageTitle(path) {
    var titleByPath = {};
    (menuUi.customPages || []).forEach(function (p) {
      if (p && p.path) titleByPath[p.path] = p.title || p.path;
    });
    if (path === "index.html") return "Home";
    if (path === "privacy.html") return "Privacy";
    if (path === "terms.html") return "Terms";
    if (path === "industries/index.html") return "Industries";
    if (path === "services/index.html") return "Services overview";
    if (path === "blog/index.html") return "Blog";
    if (path.indexOf("services/") === 0) {
      return (
        titleByPath[path] ||
        path
          .replace(/^services\//, "")
          .replace(/\.html$/i, "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, function (c) {
            return c.toUpperCase();
          })
      );
    }
    return (
      titleByPath[path] ||
      path
        .replace(/\.html$/i, "")
        .replace(/\//g, " / ")
        .replace(/-/g, " ")
        .replace(/\b\w/g, function (c) {
          return c.toUpperCase();
        })
    );
  }

  function normalizeMenuDraft(items) {
    return (Array.isArray(items) ? items : [])
      .map(function (item, index) {
        if (!item) return null;
        var parentId =
          item.parentId == null || item.parentId === ""
            ? null
            : String(item.parentId);
        if (!parentId && item.placement === "services") parentId = "__services__";
        return {
          id: String(item.id || newMenuLocalId()),
          label: String(item.label || "Link").trim() || "Link",
          href: String(item.href || "#").trim() || "#",
          parentId: parentId,
          order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
          type: item.type || "custom",
        };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return a.order - b.order;
      });
  }

  function menuChildren(parentId) {
    var pid = parentId == null ? null : String(parentId);
    return menuUi.draft.filter(function (i) {
      return (i.parentId == null ? null : String(i.parentId)) === pid;
    });
  }

  function menuIsPrimaryAssigned() {
    return menuUi.editLocation === "primary";
  }

  function syncLocationHint() {
    var hint = $("menus-location-hint");
    if (!hint) return;
    hint.textContent =
      menuUi.editLocation === "footer"
        ? "Editing Footer menu — these links appear in the site footer."
        : "Editing Primary (Navbar) menu — these links appear in the header.";
  }

  function syncLocTabs() {
    document.querySelectorAll("[data-edit-loc]").forEach(function (btn) {
      btn.classList.toggle(
        "active",
        btn.getAttribute("data-edit-loc") === menuUi.editLocation
      );
    });
    var sel = $("menus-select");
    if (sel) sel.value = menuUi.editLocation;
  }

  function resolveMenuForLocation(loc) {
    var key = loc === "footer" ? "footer" : "primary";
    if (!menuUi.doc.locations) {
      menuUi.doc.locations = { primary: null, footer: null };
    }
    if (!Array.isArray(menuUi.doc.menus)) menuUi.doc.menus = [];

    var locs = menuUi.doc.locations;
    var menus = menuUi.doc.menus;
    var fallbackId = key === "footer" ? "menu_footer" : "menu_primary";
    var defaultName = key === "footer" ? "Footer Menu" : "Primary Menu";

    // Never let primary + footer share one menu object
    if (locs.primary && locs.footer && locs.primary === locs.footer) {
      if (key === "footer") locs.footer = null;
      else locs.primary = null;
    }

    var id = locs[key];
    var menu = menus.find(function (m) {
      return m && m.id === id;
    });
    if (menu) return menu;

    menu = menus.find(function (m) {
      return m && m.id === fallbackId;
    });
    if (menu) {
      var otherKey = key === "footer" ? "primary" : "footer";
      if (locs[otherKey] === menu.id) {
        // fallback already used by other location — make a dedicated copy shell
        menu = {
          id: fallbackId + "_loc",
          name: defaultName,
          items: [],
        };
        menus.push(menu);
      }
      locs[key] = menu.id;
      return menu;
    }

    var otherKey2 = key === "footer" ? "primary" : "footer";
    var otherId = locs[otherKey2];
    menu = menus.find(function (m) {
      return m && m.id !== otherId;
    });
    if (menu && menu.id !== otherId) {
      locs[key] = menu.id;
      return menu;
    }

    var created = {
      id: fallbackId,
      name: defaultName,
      items: [],
    };
    menus.push(created);
    locs[key] = created.id;
    return created;
  }

  function menuFlatTree() {
    var rows = [];
    menuChildren(null).forEach(function (top) {
      rows.push({ item: top, depth: 0 });
      menuChildren(top.id).forEach(function (child) {
        rows.push({ item: child, depth: 1 });
      });
    });
    if (menuIsPrimaryAssigned()) {
      menuChildren("__services__").forEach(function (child) {
        rows.push({ item: child, depth: 1, underServices: true });
      });
    }
    return rows;
  }

  function markMenusDirty() {
    menuUi.dirty = true;
    var st = $("menus-save-status");
    if (st) st.textContent = "Unsaved changes";
  }

  function setMenusView() {
    /* locations tab removed — kept as no-op for safety */
  }

  function fillMenusSelect() {
    syncLocTabs();
  }

  function fillLocationSelects() {
    /* Manage Locations UI removed */
  }

  function loadActiveMenuDraft() {
    var menu = resolveMenuForLocation(menuUi.editLocation);
    menuUi.activeMenuId = menu ? menu.id : null;
    menuUi.draftName = menu ? menu.name : "";
    menuUi.draft = normalizeMenuDraft(menu ? menu.items : []);
    if (menuUi.editLocation === "footer") {
      menuUi.draft.forEach(function (item) {
        if (item.parentId === "__services__") item.parentId = null;
      });
    }
    menuUi.dirty = false;
    var nameEl = $("menus-name");
    if (nameEl) nameEl.value = menuUi.draftName || (menuUi.editLocation === "footer" ? "Footer Menu" : "Primary Menu");
    var st = $("menus-save-status");
    if (st) st.textContent = "";
    syncLocationHint();
    syncLocTabs();
    renderMenusStructure();
  }

  function collectStructureEdits() {
    var wrap = $("menus-structure");
    if (!wrap) return;
    var nameEl = $("menus-name");
    if (nameEl) menuUi.draftName = nameEl.value.trim() || menuUi.draftName;
    wrap.querySelectorAll("[data-menu-id]").forEach(function (row) {
      var id = row.getAttribute("data-menu-id");
      var item = menuUi.draft.find(function (m) {
        return m.id === id;
      });
      if (!item) return;
      var labelEl = row.querySelector('[data-menu-field="label"]');
      var hrefEl = row.querySelector('[data-menu-field="href"]');
      if (labelEl) item.label = labelEl.value.trim() || item.label;
      if (hrefEl) item.href = hrefEl.value.trim() || item.href;
    });
  }

  function renderMenusPagesList() {
    var list = $("menus-pages-list");
    if (!list) return;
    list.innerHTML = "";
    (menuUi.pages || []).forEach(function (path) {
      var href = "/" + String(path).replace(/^\/+/, "");
      var title = menuPageTitle(path);
      var row = document.createElement("div");
      row.className = "wp-check wp-check-row";
      row.innerHTML =
        '<label class="wp-check-label">' +
        '<input type="checkbox" data-menu-page-href="' +
        Admin.esc(href) +
        '" data-menu-page-label="' +
        Admin.esc(title) +
        '" />' +
        "<span>" +
        Admin.esc(title) +
        "</span></label>" +
        '<button type="button" class="btn btn-secondary btn-sm wp-add-one" data-menu-page-href="' +
        Admin.esc(href) +
        '" data-menu-page-label="' +
        Admin.esc(title) +
        '" data-menu-item-type="page">Add</button>';
      list.appendChild(row);
    });
    if (!(menuUi.pages || []).length) {
      list.innerHTML = '<p class="hint" style="margin:0">No pages found.</p>';
    }
  }

  function renderMenusPostsList() {
    var list = $("menus-posts-list");
    if (!list) return;
    list.innerHTML = "";
    var posts = (menuUi.posts || []).filter(function (p) {
      return p && (p.status === "published" || !p.status);
    });
    posts.forEach(function (post) {
      var slug = post.slug || post.id;
      var href = "/blog/post.html?slug=" + encodeURIComponent(String(slug));
      if (post.url) href = post.url;
      var title = post.title || slug || "Post";
      var row = document.createElement("div");
      row.className = "wp-check wp-check-row";
      row.innerHTML =
        '<label class="wp-check-label">' +
        '<input type="checkbox" data-menu-page-href="' +
        Admin.esc(href) +
        '" data-menu-page-label="' +
        Admin.esc(title) +
        '" data-menu-item-type="post" />' +
        "<span>" +
        Admin.esc(title) +
        "</span></label>" +
        '<button type="button" class="btn btn-secondary btn-sm wp-add-one" data-menu-page-href="' +
        Admin.esc(href) +
        '" data-menu-page-label="' +
        Admin.esc(title) +
        '" data-menu-item-type="post">Add</button>';
      list.appendChild(row);
    });
    if (!posts.length) {
      list.innerHTML = '<p class="hint" style="margin:0">No published posts yet.</p>';
    }
  }

  function typeLabelFor(item, row) {
    if (row.underServices) return "Services sub item";
    if (row.depth) return "sub item";
    if (item.type === "page") return "Page";
    if (item.type === "post") return "Post";
    return "Custom Link";
  }

  function previousTopLevel(item) {
    var tops = menuChildren(null);
    var idx = tops.findIndex(function (t) {
      return t.id === item.id;
    });
    if (idx > 0) return tops[idx - 1];
    // if item is already a child, previous top is its current parent (for outdent sibling logic)
    if (item.parentId && item.parentId !== "__services__") {
      return menuUi.draft.find(function (m) {
        return m.id === item.parentId;
      });
    }
    return null;
  }

  function renderMenusStructure() {
    var wrap = $("menus-structure");
    var empty = $("menus-structure-empty");
    if (!wrap) return;
    wrap.innerHTML = "";
    var rows = menuFlatTree();
    if (empty) {
      if (rows.length) empty.setAttribute("hidden", "");
      else empty.removeAttribute("hidden");
    }
    if (!rows.length) return;

    rows.forEach(function (row) {
      var item = row.item;
      var bar = document.createElement("div");
      bar.className =
        "wp-structure-item" +
        (row.depth ? " is-sub" : "") +
        (row.underServices ? " is-services" : "");
      bar.setAttribute("data-menu-id", item.id);
      var tLabel = typeLabelFor(item, row);
      bar.innerHTML =
        '<div class="wp-structure-bar">' +
        '<div class="wp-structure-left">' +
        '<span class="wp-structure-label">' +
        Admin.esc(item.label) +
        "</span>" +
        (row.depth
          ? '<span class="wp-structure-subtag">sub item</span>'
          : "") +
        "</div>" +
        '<span class="wp-structure-type">' +
        Admin.esc(tLabel) +
        ' <span class="wp-structure-caret">▾</span></span>' +
        "</div>" +
        '<div class="wp-structure-edit">' +
        '<label class="field-label">Navigation Label</label>' +
        '<input type="text" data-menu-field="label" maxlength="80" value="' +
        Admin.esc(item.label) +
        '" />' +
        '<label class="field-label">URL</label>' +
        '<input type="text" data-menu-field="href" maxlength="500" value="' +
        Admin.esc(item.href) +
        '" />' +
        '<div class="wp-structure-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-menu-move="up" title="Move up">↑</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-menu-move="down" title="Move down">↓</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-menu-indent="out" title="Outdent">←</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-menu-indent="in" title="Make sub item">→</button>' +
        (menuIsPrimaryAssigned()
          ? '<button type="button" class="btn btn-secondary btn-sm" data-menu-services="' +
            Admin.esc(item.id) +
            '">Under Services</button>'
          : "") +
        '<button type="button" class="btn btn-danger btn-sm" data-menu-remove="' +
        Admin.esc(item.id) +
        '">Remove</button>' +
        "</div></div>";
      wrap.appendChild(bar);

      var barHead = bar.querySelector(".wp-structure-bar");
      if (barHead) {
        barHead.addEventListener("click", function () {
          bar.classList.toggle("open");
        });
      }
      var edit = bar.querySelector(".wp-structure-edit");
      if (edit) {
        edit.addEventListener("click", function (e) {
          e.stopPropagation();
        });
      }
    });

    wrap.querySelectorAll("[data-menu-field]").forEach(function (el) {
      el.addEventListener("change", function () {
        collectStructureEdits();
        markMenusDirty();
        if (el.getAttribute("data-menu-field") === "label") {
          var rowEl = el.closest("[data-menu-id]");
          var lab = rowEl && rowEl.querySelector(".wp-structure-label");
          if (lab) lab.textContent = el.value.trim() || "Link";
        }
      });
      el.addEventListener("input", markMenusDirty);
    });
    wrap.querySelectorAll("[data-menu-remove]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        menusRemoveDraftItem(btn.getAttribute("data-menu-remove"));
      });
    });
    wrap.querySelectorAll("[data-menu-move]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var row = btn.closest("[data-menu-id]");
        menusMoveDraftItem(
          row && row.getAttribute("data-menu-id"),
          btn.getAttribute("data-menu-move")
        );
      });
    });
    wrap.querySelectorAll("[data-menu-indent]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var row = btn.closest("[data-menu-id]");
        menusIndentItem(
          row && row.getAttribute("data-menu-id"),
          btn.getAttribute("data-menu-indent")
        );
      });
    });
    wrap.querySelectorAll("[data-menu-services]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        menusPutUnderServices(btn.getAttribute("data-menu-services"));
      });
    });
  }

  function menusRemoveDraftItem(id) {
    collectStructureEdits();
    menuUi.draft = menuUi.draft.filter(function (m) {
      return m.id !== id;
    });
    menuUi.draft.forEach(function (m) {
      if (m.parentId === id) m.parentId = null;
    });
    markMenusDirty();
    renderMenusStructure();
  }

  function menusMoveDraftItem(id, dir) {
    collectStructureEdits();
    var item = menuUi.draft.find(function (m) {
      return m.id === id;
    });
    if (!item) return;
    var siblings = menuUi.draft.filter(function (m) {
      return (m.parentId || null) === (item.parentId || null);
    });
    var idx = siblings.findIndex(function (m) {
      return m.id === id;
    });
    var swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= siblings.length) return;
    var a = siblings[idx];
    var b = siblings[swapWith];
    var orderA = a.order;
    a.order = b.order;
    b.order = orderA;
    menuUi.draft.sort(function (x, y) {
      return x.order - y.order;
    });
    markMenusDirty();
    renderMenusStructure();
  }

  function menusIndentItem(id, dir) {
    collectStructureEdits();
    var item = menuUi.draft.find(function (m) {
      return m.id === id;
    });
    if (!item) return;
    if (dir === "in") {
      // Make sub item of previous top-level sibling (WordPress indent)
      if (item.parentId) return;
      var tops = menuChildren(null);
      var idx = tops.findIndex(function (t) {
        return t.id === id;
      });
      if (idx <= 0) {
        toast("Move under another top-level item first (need a previous item).", false);
        return;
      }
      // Don't allow indent if this item has children
      if (menuChildren(item.id).length) {
        toast("Outdent children first — only one nesting level.", false);
        return;
      }
      item.parentId = tops[idx - 1].id;
    } else {
      item.parentId = null;
    }
    markMenusDirty();
    renderMenusStructure();
  }

  function menusPutUnderServices(id) {
    collectStructureEdits();
    var item = menuUi.draft.find(function (m) {
      return m.id === id;
    });
    if (!item) return;
    if (menuChildren(item.id).length) {
      toast("Remove sub items first.", false);
      return;
    }
    item.parentId = "__services__";
    markMenusDirty();
    renderMenusStructure();
  }

  function menusAddDraftItem(label, href, type) {
    if (!Array.isArray(menuUi.draft)) menuUi.draft = [];
    collectStructureEdits();
    menuUi.draft.push({
      id: newMenuLocalId(),
      label: String(label || "Link").trim() || "Link",
      href: String(href || "#").trim() || "#",
      parentId: null,
      order: menuUi.draft.length,
      type: type || "custom",
    });
    if (!menuUi.activeMenuId) {
      var menu = resolveMenuForLocation(menuUi.editLocation);
      menuUi.activeMenuId = menu ? menu.id : null;
    }
    markMenusDirty();
    renderMenusStructure();
    var wrap = $("menus-structure");
    if (wrap && wrap.lastElementChild) {
      wrap.lastElementChild.classList.add("open");
      wrap.lastElementChild.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function menusAddFromChecklist(listId) {
    var list = $(listId);
    if (!list) return;
    var checked = list.querySelectorAll("input[type=checkbox]:checked");
    if (!checked.length) {
      toast("Tick one or more pages, or click Add beside a page.", false);
      return;
    }
    checked.forEach(function (cb) {
      menusAddDraftItem(
        cb.getAttribute("data-menu-page-label") || "Link",
        cb.getAttribute("data-menu-page-href") || "/",
        cb.getAttribute("data-menu-item-type") || "page"
      );
      cb.checked = false;
    });
    toast("Added to menu. Click Save Menu when ready.", true);
  }

  function menusAddOneFromButton(btn) {
    if (!btn) return;
    menusAddDraftItem(
      btn.getAttribute("data-menu-page-label") || "Link",
      btn.getAttribute("data-menu-page-href") || "/",
      btn.getAttribute("data-menu-item-type") || "page"
    );
    toast("Added to menu. Click Save Menu when ready.", true);
  }

  function menusAddCustomLink() {
    var hrefEl = $("menus-custom-href");
    var labelEl = $("menus-custom-label");
    var href = hrefEl ? hrefEl.value.trim() : "";
    var label = labelEl ? labelEl.value.trim() : "";
    if (!href || !label) {
      toast("Enter URL and link text.", false);
      return;
    }
    menusAddDraftItem(label, href, "custom");
    if (hrefEl) hrefEl.value = "";
    if (labelEl) labelEl.value = "";
    toast("Added to menu. Click Save Menu when ready.", true);
  }

  async function selectMenuByLocation(loc, force) {
    var next = loc === "footer" ? "footer" : "primary";
    if (next === menuUi.editLocation && !force && menuUi.activeMenuId) {
      fillMenusSelect();
      return;
    }
    if (menuUi.dirty && !force) {
      var ok = await confirmDialog(
        "You have unsaved menu changes. Switch and discard them?",
        "Discard"
      );
      if (!ok) {
        fillMenusSelect();
        return;
      }
    }
    menuUi.editLocation = next;
    var menu = resolveMenuForLocation(next);
    menuUi.activeMenuId = menu ? menu.id : null;
    fillMenusSelect();
    loadActiveMenuDraft();
  }

  async function menusCreateMenu() {
    var name =
      menuUi.editLocation === "footer" ? "Footer Menu" : "Primary Menu";
    var prompted = window.prompt("Menu name", name);
    if (prompted == null) return;
    name = String(prompted).trim() || name;
    try {
      var res = await Admin.api("POST", "/api/admin/cms/menus", {
        createMenu: true,
        name: name,
      });
      menuUi.doc = res.menus || menuUi.doc;
      if (res.menu && res.menu.id) {
        if (!menuUi.doc.locations) menuUi.doc.locations = {};
        menuUi.doc.locations[menuUi.editLocation] = res.menu.id;
        await Admin.api("PUT", "/api/admin/cms/menus", {
          locations: menuUi.doc.locations,
        });
        menuUi.activeMenuId = res.menu.id;
      }
      fillLocationSelects();
      loadActiveMenuDraft();
      toast("Menu created for this location.", true);
    } catch (ex) {
      toast(ex.message || "Could not create menu.", false);
    }
  }

  async function menusDeleteMenu() {
    if (!menuUi.activeMenuId) return;
    var ok = await confirmDialog(
      "Delete this entire menu? This cannot be undone.",
      "Delete Menu"
    );
    if (!ok) return;
    try {
      var res = await Admin.api("DELETE", "/api/admin/cms/menus", {
        menuId: menuUi.activeMenuId,
      });
      menuUi.doc = res.menus || menuUi.doc;
      var menu = resolveMenuForLocation(menuUi.editLocation);
      menuUi.activeMenuId = menu ? menu.id : null;
      fillMenusSelect();
      fillLocationSelects();
      loadActiveMenuDraft();
      toast("Menu deleted.", true);
    } catch (ex) {
      toast(ex.message || "Could not delete menu.", false);
    }
  }

  function orderedDraftItems() {
    collectStructureEdits();
    var ordered = [];
    menuChildren(null).forEach(function (top) {
      ordered.push(top);
      menuChildren(top.id).forEach(function (c) {
        ordered.push(c);
      });
    });
    if (menuIsPrimaryAssigned()) {
      menuChildren("__services__").forEach(function (c) {
        ordered.push(c);
      });
    }
    menuUi.draft.forEach(function (m) {
      if (
        !ordered.some(function (x) {
          return x.id === m.id;
        })
      ) {
        ordered.push(m);
      }
    });
    return ordered.map(function (m, index) {
      return {
        id: m.id,
        label: m.label,
        href: m.href,
        parentId: m.parentId,
        order: index,
        type: m.type,
      };
    });
  }

  async function menusSaveMenu() {
    if (!menuUi.activeMenuId) {
      // Auto-create a menu for this location if missing
      try {
        var created = await Admin.api("POST", "/api/admin/cms/menus", {
          createMenu: true,
          name:
            menuUi.editLocation === "footer" ? "Footer Menu" : "Primary Menu",
        });
        menuUi.doc = created.menus || menuUi.doc;
        if (created.menu && created.menu.id) {
          menuUi.activeMenuId = created.menu.id;
        }
      } catch (ex) {
        toast(ex.message || "Select a menu first.", false);
        return;
      }
    }
    var st = $("menus-save-status");
    if (st) st.textContent = "Saving…";
    try {
      var nameEl = $("menus-name");
      var name = nameEl ? nameEl.value.trim() : menuUi.draftName;
      if (!name) {
        name =
          menuUi.editLocation === "footer" ? "Footer Menu" : "Primary Menu";
      }
      var items = orderedDraftItems();

      var res = await Admin.api("PUT", "/api/admin/cms/menus", {
        menuId: menuUi.activeMenuId,
        name: name,
        items: items,
      });
      menuUi.doc = res.menus || menuUi.doc;

      // Always lock saved menu to the active location tab
      var loc = {
        primary: (menuUi.doc.locations && menuUi.doc.locations.primary) || null,
        footer: (menuUi.doc.locations && menuUi.doc.locations.footer) || null,
      };
      loc[menuUi.editLocation] = menuUi.activeMenuId;
      if (loc.primary === loc.footer) {
        var other = menuUi.editLocation === "footer" ? "primary" : "footer";
        var otherMenu = (menuUi.doc.menus || []).find(function (m) {
          return m && m.id !== menuUi.activeMenuId;
        });
        loc[other] = otherMenu ? otherMenu.id : null;
      }

      await Admin.api("PUT", "/api/admin/cms/menus", { locations: loc });
      var locRes = await Admin.api("GET", "/api/admin/cms/menus");
      menuUi.doc = locRes.menus || menuUi.doc;

      var menu = resolveMenuForLocation(menuUi.editLocation);
      menuUi.activeMenuId = menu ? menu.id : menuUi.activeMenuId;
      menuUi.draftName = menu ? menu.name : name;
      menuUi.draft = normalizeMenuDraft(menu ? menu.items : items);
      menuUi.dirty = false;
      fillMenusSelect();
      syncLocationHint();
      if (st) st.textContent = "Saved. Refresh the website to see changes.";
      toast(
        menuUi.editLocation === "footer"
          ? "Footer menu saved."
          : "Primary (navbar) menu saved.",
        true
      );
      renderMenusStructure();
    } catch (ex) {
      if (st) st.textContent = ex.message || "Could not save.";
      toast(ex.message || "Could not save menu.", false);
    }
  }

  async function menusSaveLocations() {
    /* removed */
  }

  async function loadMenusPanel() {
    var data = await Admin.api("GET", "/api/admin/cms/menus");
    menuUi.doc = data.menus || {
      menus: [],
      locations: { primary: null, footer: null },
    };
    // Guarantee separate primary + footer menus exist in memory
    resolveMenuForLocation("primary");
    resolveMenuForLocation("footer");
    try {
      var cms = await Admin.api("GET", "/api/admin/cms");
      menuUi.pages = cms.pages || [];
      menuUi.customPages = cms.customPages || [];
    } catch (ex) {
      menuUi.pages = menuUi.pages || [];
    }
    try {
      var postsData = await Admin.api("GET", "/api/admin/posts");
      menuUi.posts = postsData.posts || postsData.items || [];
    } catch (ex) {
      menuUi.posts = [];
    }

    if (menuUi.editLocation !== "footer") menuUi.editLocation = "primary";
    menuUi.dirty = false;
    loadActiveMenuDraft();
    renderMenusPagesList();
    renderMenusPostsList();
  }

  function appendMenuManager(wrap) {
    var note = document.createElement("div");
    note.className = "cms-group";
    note.innerHTML =
      '<h4 class="cms-group-heading">Add / remove menu links</h4>' +
      '<p class="cms-block-hint" style="margin:0">Use the sidebar <strong>Menus</strong> page (WordPress-style: named menus + locations).</p>' +
      '<div class="form-actions" style="margin-top:0.75rem">' +
      '<button type="button" class="btn btn-secondary btn-sm" id="cms-goto-menus">Open Menus</button></div>';
    wrap.appendChild(note);
    var btn = note.querySelector("#cms-goto-menus");
    if (btn) {
      btn.addEventListener("click", function () {
        showPanel("menus");
      });
    }
  }

  async function addCustomMenu() {}
  async function deleteCustomMenu() {}
  async function updateCustomMenu() {}


  async function renderCmsFields() {
    var wrap = $("cms-fields");
    if (!wrap) return;
    var section = getCmsSectionKey();
    var filter = ($("cms-field-filter") && $("cms-field-filter").value) || "all";
    wrap.innerHTML = "";

    function appendField(def, value, parent) {
      var host = parent || wrap;
      var box = document.createElement("div");
      box.className = "cms-field";
      var id = "cms-field-" + String(def.key || def.id).replace(/[^a-z0-9]+/gi, "-");
      var label = document.createElement("label");
      label.className = "field-label";
      label.setAttribute("for", id);
      label.textContent = def.label || def.key;
      box.appendChild(label);
      if (def.hint) {
        var hint = document.createElement("p");
        hint.className = "hint";
        hint.textContent = def.hint;
        box.appendChild(hint);
      } else if (def.type === "url") {
        var hintUrl = document.createElement("p");
        hintUrl.className = "hint";
        hintUrl.textContent = "Paste a full image link";
        box.appendChild(hintUrl);
      }
      var input;
      if (def.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = 3;
      } else {
        input = document.createElement("input");
        input.type = "text";
      }
      input.id = id;
      input.dataset.cmsKey = def.key || def.id;
      input.value = value != null ? value : "";
      input.placeholder =
        def.type === "url"
          ? "https://… or /assets/images/…"
          : "Edit text…";
      box.appendChild(input);
      host.appendChild(box);
    }

    function ensureGroup(title, lastRef) {
      if (title === lastRef.name) return lastRef.el;
      var group = document.createElement("div");
      group.className = "cms-group";
      var heading = document.createElement("h4");
      heading.className = "cms-group-heading";
      heading.textContent = title;
      group.appendChild(heading);
      wrap.appendChild(group);
      lastRef.name = title;
      lastRef.el = group;
      return group;
    }

    if (section.indexOf("layout:") === 0) {
      var region = section.slice(7);
      cmsState.layoutRegion = region;
      var stL = $("cms-status");
      if (stL) stL.textContent = "Scanning " + region + " menus…";
      try {
        var layoutScan = await Admin.api(
          "GET",
          "/api/admin/cms/layout-scan?region=" + encodeURIComponent(region)
        );
        cmsState.layoutFields = layoutScan.fields || [];
        cmsState.layoutMenus = layoutScan.menus || [];
        cmsState.layoutValues = {};
        cmsState.layoutFields.forEach(function (f) {
          cmsState.layoutValues[f.id] = f.value;
        });
        var showTextL = filter === "all" || filter === "text";
        var showImagesL = filter === "all" || filter === "images";
        var visibleL = cmsState.layoutFields.filter(function (f) {
          if (f.kind === "text") return showTextL;
          if (f.kind === "img") return showImagesL;
          return false;
        });
        if (!visibleL.length && !(cmsState.layoutMenus && cmsState.layoutMenus.length)) {
          /* keep empty — menu manager still shows above */
        }

        // Add/remove custom menus first so it's easy to find
        appendMenuManager(wrap, region);

        if (visibleL.length) {
          var metaL = document.createElement("p");
          metaL.className = "cms-meta";
          metaL.textContent = visibleL.length + " existing items · edit labels below";
          wrap.appendChild(metaL);
          var lastRefL = { name: null, el: null };
          visibleL.forEach(function (f) {
            var groupEl = ensureGroup(f.group || region, lastRefL);
            appendField(
              {
                key: f.id,
                label: f.label,
                type: f.type || (f.kind === "img" ? "url" : "text"),
                hint: f.hint || "",
              },
              cmsState.layoutValues[f.id],
              groupEl
            );
          });
        } else if (!(cmsState.layoutMenus && cmsState.layoutMenus.length)) {
          var emptyL = document.createElement("p");
          emptyL.className = "cms-empty";
          emptyL.textContent =
            "No existing menu labels found to edit. You can still add a new link above.";
          wrap.appendChild(emptyL);
        }
        if (stL) {
          stL.textContent =
            "Add new links at the top, or edit existing labels below — then Save.";
        }
      } catch (ex) {
        wrap.innerHTML = "";
        appendMenuManager(wrap, region);
        var err = document.createElement("p");
        err.className = "cms-empty";
        err.textContent =
          "Could not load existing menus: " + (ex.message || "error");
        wrap.appendChild(err);
        if (stL) stL.textContent = ex.message || "Scan failed";
      }
      return;
    }

    if (section.indexOf("auto:") === 0) {
      var path = section.slice(5);
      cmsState.autoPath = path;
      var st = $("cms-status");
      if (st) st.textContent = "Scanning " + path + "…";
      try {
        var scanned = await Admin.api(
          "GET",
          "/api/admin/cms/scan?path=" + encodeURIComponent(path)
        );
        cmsState.autoFields = scanned.fields || [];
        cmsState.autoValues = {};
        cmsState.autoFields.forEach(function (f) {
          cmsState.autoValues[f.id] = f.value;
        });
        var showText = filter === "all" || filter === "text";
        var showImages = filter === "all" || filter === "images";
        var visible = cmsState.autoFields.filter(function (f) {
          if (f.kind === "text") return showText;
          if (f.kind === "img") return showImages;
          return false;
        });

        if (!visible.length) {
          wrap.innerHTML =
            '<p class="cms-empty">No fields found for this filter on this page.</p>';
        } else {
          var textCount = cmsState.autoFields.filter(function (f) {
            return f.kind === "text";
          }).length;
          var imageCount = cmsState.autoFields.filter(function (f) {
            return f.kind === "img";
          }).length;
          var meta = document.createElement("p");
          meta.className = "cms-meta";
          meta.textContent =
            textCount + " text · " + imageCount + " images · grouped by section";
          wrap.appendChild(meta);

          var lastRef = { name: null, el: null };
          visible.forEach(function (f) {
            var groupEl = ensureGroup(f.group || "Page content", lastRef);
            appendField(
              {
                key: f.id,
                label: f.label,
                type: f.type || (f.kind === "img" ? "url" : "text"),
                hint:
                  f.kind === "img"
                    ? "Current: " +
                      String(f.defaultValue || f.value || "").slice(0, 72)
                    : f.hint,
              },
              cmsState.autoValues[f.id],
              groupEl
            );
          });
        }
        if (st) {
          st.textContent = "Edit the fields below, then click Save to site.";
        }
      } catch (ex) {
        wrap.innerHTML =
          '<p class="cms-empty">Scan failed: ' +
          Admin.esc(ex.message || "error") +
          "</p>";
        if (st) st.textContent = ex.message || "Scan failed";
      }
      return;
    }

    var defs = getCmsFieldDefs(section);
    var bucket = getCmsBucket(section);
    if (!defs.length) {
      wrap.innerHTML = '<p class="cms-empty">No fields for this section.</p>';
      return;
    }
    var shown = 0;
    var brandGroup = document.createElement("div");
    brandGroup.className = "cms-group";
    var brandHead = document.createElement("h4");
    brandHead.className = "cms-group-heading";
    brandHead.textContent =
      section === "branding" ? "Branding" : section.charAt(0).toUpperCase() + section.slice(1);
    brandGroup.appendChild(brandHead);
    defs.forEach(function (def) {
      if (filter === "images" && def.type !== "url") return;
      if (filter === "text" && def.type === "url") return;
      shown++;
      appendField(def, bucket[def.key], brandGroup);
    });
    if (!shown) {
      wrap.innerHTML = '<p class="cms-empty">Nothing matches this filter.</p>';
    } else {
      wrap.appendChild(brandGroup);
    }
    var stB = $("cms-status");
    if (stB) stB.textContent = "Edit the fields below, then click Save to site.";
  }

  async function saveCms() {
    collectCmsFieldsIntoState();
    var btn = $("cms-save");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      var section = getCmsSectionKey();
      if (section.indexOf("auto:") === 0) {
        var path = section.slice(5);
        await Admin.api("PUT", "/api/admin/cms", {
          autoPage: true,
          path: path,
          values: cmsState.autoValues,
        });
        toast("Page CMS saved for " + path + ". Refresh the website.", true);
      } else if (section.indexOf("layout:") === 0) {
        var region = section.slice(7);
        var layoutRes = await Admin.api("PUT", "/api/admin/cms", {
          layoutRegion: true,
          region: region,
          values: cmsState.layoutValues,
        });
        cmsState.cms = layoutRes.cms || cmsState.cms;
        toast(
          (region === "footer" ? "Footer" : "Header") +
            " menus saved. Refresh the website.",
          true
        );
      } else {
        var res = await Admin.api("PUT", "/api/admin/cms", { cms: cmsState.cms });
        cmsState.cms = res.cms || cmsState.cms;
        toast("Sitewide CMS saved.", true);
      }
      var st = $("cms-status");
      if (st) st.textContent = "Saved. Refresh the website to see changes.";
    } catch (ex) {
      toast(ex.message || "Unable to save CMS.", false);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save to site";
    }
  }

  async function loadLeads() {
    var data = await Admin.api("GET", "/api/admin/leads");
    state.leads = data.leads || [];
    renderLeads();
    renderDash();
  }

  async function loadPosts() {
    var data = await Admin.api("GET", "/api/admin/posts");
    state.posts = data.posts || [];
    renderPosts();
    renderDash();
  }

  async function loadPages() {
    var data = await Admin.api("GET", "/api/admin/pages");
    state.pages = data.pages || [];
    renderPages();
  }

  async function loadSettingsStatus() {
    $("settings-api").textContent = Admin.API_BASE;
    var apiStatus = $("settings-api-status");
    var box = $("github-status-box");
    if (!box) return;
    try {
      var data = await Admin.api("GET", "/api/admin/settings");
      if (apiStatus) {
        apiStatus.innerHTML =
          '<span class="badge badge-published">Connected</span> Admin API responded successfully.';
      }
      var gh = data.github_publishing || {};
      if (gh.status === "connected") {
        box.innerHTML =
          '<p style="margin:0"><span class="badge badge-published">Connected</span></p>' +
          '<p class="hint" style="margin:0.5rem 0 0">GitHub publishing is configured' +
          (gh.repository
            ? " for <code>" + Admin.esc(gh.repository) + "</code>."
            : ".") +
          "</p>";
      } else {
        box.innerHTML =
          '<p style="margin:0"><span class="badge badge-draft">Not configured</span></p>' +
          '<p class="hint" style="margin:0.5rem 0 0">GitHub publishing is not configured.</p>';
      }
    } catch (ex) {
      if (apiStatus) {
        apiStatus.innerHTML =
          '<span class="badge badge-closed">Unavailable</span> ' +
          Admin.esc(ex.message || "Could not reach API");
      }
      box.innerHTML =
        '<p style="margin:0"><span class="badge badge-closed">Unavailable</span></p>' +
        '<p class="hint" style="margin:0.5rem 0 0">' +
        Admin.esc(ex.message || "Could not load status") +
        "</p>";
    }
  }

  async function boot() {
    try {
      await Promise.all([
        loadLeads(),
        loadPosts(),
        loadPages(),
        loadSettingsStatus(),
      ]);
    } catch (ex) {
      toast(ex.message || "Unable to load admin data.", false);
    }
  }

  /* events */
  document.querySelectorAll("[data-nav]").forEach(function (el) {
    el.addEventListener("click", function () {
      var name = el.getAttribute("data-nav");
      if (name === "posts") showPanel("posts");
      else showPanel(name);
      if (name === "settings") loadSettingsStatus();
      if (name === "site-cms") {
        loadCms().catch(function (ex) {
          toast(ex.message || "Unable to load Site CMS.", false);
        });
      }
    });
  });

  if ($("cms-section")) {
    $("cms-section").addEventListener("change", function () {
      collectCmsFieldsIntoState();
      renderCmsFields();
    });
  }
  if ($("cms-field-filter")) {
    $("cms-field-filter").addEventListener("change", function () {
      collectCmsFieldsIntoState();
      renderCmsFields();
    });
  }
  if ($("cms-reload")) {
    $("cms-reload").addEventListener("click", function () {
      loadCms().catch(function (ex) {
        toast(ex.message || "Unable to reload CMS.", false);
      });
    });
  }
  if ($("cms-create-page")) {
    $("cms-create-page").addEventListener("click", function () {
      createServicePage();
    });
  }
  if ($("menus-reload")) {
    $("menus-reload").addEventListener("click", function () {
      loadMenusPanel().catch(function (ex) {
        toast(ex.message || "Unable to reload menus.", false);
      });
    });
  }
  if ($("menus-save-btn")) {
    $("menus-save-btn").addEventListener("click", function () {
      menusSaveMenu();
    });
  }
  if ($("menus-save-btn-2")) {
    $("menus-save-btn-2").addEventListener("click", function () {
      menusSaveMenu();
    });
  }
  if ($("menus-add-pages")) {
    $("menus-add-pages").addEventListener("click", function () {
      menusAddFromChecklist("menus-pages-list");
    });
  }
  if ($("menus-add-posts")) {
    $("menus-add-posts").addEventListener("click", function () {
      menusAddFromChecklist("menus-posts-list");
    });
  }
  if ($("menus-add-custom")) {
    $("menus-add-custom").addEventListener("click", function () {
      menusAddCustomLink();
    });
  }
  ["menus-pages-list", "menus-posts-list"].forEach(function (id) {
    var list = $(id);
    if (!list) return;
    list.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest(".wp-add-one") : null;
      if (!btn || !list.contains(btn)) return;
      e.preventDefault();
      menusAddOneFromButton(btn);
    });
  });
  if ($("menus-custom-href") && $("menus-custom-label")) {
    ["menus-custom-href", "menus-custom-label"].forEach(function (id) {
      $(id).addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          menusAddCustomLink();
        }
      });
    });
  }
  if ($("menus-name")) {
    $("menus-name").addEventListener("input", markMenusDirty);
  }
  document.querySelectorAll("[data-edit-loc]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectMenuByLocation(btn.getAttribute("data-edit-loc"));
    });
  });
  if ($("cms-save")) {
    $("cms-save").addEventListener("click", function () {
      saveCms();
    });
  }

  $("menu-btn").addEventListener("click", openSidebar);
  $("sidebar-overlay").addEventListener("click", closeSidebar);
  $("btn-logout").addEventListener("click", function () {
    Admin.logout();
    location.href = "index.html";
  });
  $("settings-logout").addEventListener("click", function () {
    Admin.logout();
    location.href = "index.html";
  });

  $("confirm-cancel").addEventListener("click", function () {
    closeConfirm(false);
  });
  $("confirm-ok").addEventListener("click", function () {
    closeConfirm(true);
  });
  $("confirm-modal").addEventListener("click", function (e) {
    if (e.target === $("confirm-modal")) closeConfirm(false);
  });

  $("refresh-leads").addEventListener("click", function () {
    loadLeads()
      .then(function () {
        toast("Leads refreshed.", true);
      })
      .catch(function (e) {
        toast(e.message || "Unable to load leads.", false);
      });
  });

  $("export-leads").addEventListener("click", function () {
    var btn = $("export-leads");
    btn.disabled = true;
    btn.textContent = "Exporting…";
    try {
      downloadFilteredCsv();
      toast("CSV downloaded.", true);
    } catch (ex) {
      toast(ex.message || "Export failed.", false);
    } finally {
      btn.disabled = false;
      btn.textContent = "Export CSV";
    }
  });

  $("leads-search").addEventListener("input", renderLeads);
  $("leads-filter").addEventListener("change", renderLeads);
  $("lead-modal-close").addEventListener("click", closeLeadModal);
  $("lead-modal").addEventListener("click", function (e) {
    if (e.target === $("lead-modal")) closeLeadModal();
  });
  $("lead-modal-save").addEventListener("click", async function () {
    if (!state.activeLeadId) return;
    try {
      await Admin.api("PATCH", "/api/admin/leads/" + state.activeLeadId, {
        status: $("lead-modal-status").value,
      });
      toast("Lead updated successfully.", true);
      closeLeadModal();
      await loadLeads();
    } catch (ex) {
      toast(ex.message || "Unable to update lead.", false);
    }
  });

  $("refresh-posts").addEventListener("click", function () {
    loadPosts()
      .then(function () {
        toast("Posts refreshed.", true);
      })
      .catch(function (e) {
        toast(e.message, false);
      });
  });
  $("new-post").addEventListener("click", function () {
    clearPostForm();
    showPanel("post-editor");
  });
  $("new-post-empty").addEventListener("click", function () {
    clearPostForm();
    showPanel("post-editor");
  });

  $("update-featured-preview").addEventListener("click", updateFeaturedPreview);
  $("remove-featured").addEventListener("click", function () {
    $("post-featured").value = "";
    updateFeaturedPreview();
  });
  $("post-featured").addEventListener("change", updateFeaturedPreview);

  $("update-og-preview").addEventListener("click", updateOgPreview);
  $("og-remove").addEventListener("click", function () {
    $("post-og").value = "";
    updateOgPreview();
  });
  $("post-og").addEventListener("change", updateOgPreview);

  $("save-post").addEventListener("click", async function () {
    var btn = $("save-post");
    var id = $("post-id").value;
    var payload = postPayload();
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      if (id) {
        await Admin.api("PATCH", "/api/admin/posts/" + id, payload);
        toast("Post saved successfully.", true);
      } else {
        var created = await Admin.api("POST", "/api/admin/posts", payload);
        $("post-id").value = created.id;
        $("post-slug").value = created.slug;
        $("post-editor-heading").textContent = "Edit post #" + created.id;
        toast("Post created successfully.", true);
      }
      await loadPosts();
    } catch (ex) {
      toast(ex.message || "Unable to save post.", false);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save post";
    }
  });

  $("delete-post").addEventListener("click", async function () {
    var id = $("post-id").value;
    if (!id) return toast("No post selected.", false);
    await deletePostById(Number(id));
  });

  $("refresh-pages").addEventListener("click", function () {
    loadPages()
      .then(function () {
        toast("Pages refreshed.", true);
      })
      .catch(function (e) {
        toast(e.message, false);
      });
  });
  $("load-from-site").addEventListener("click", async function () {
    var path = $("page-path").value;
    if (!path) return toast("Select a page first.", false);
    try {
      var res = await fetch("../" + path, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load ../" + path);
      $("page-html").value = await res.text();
      toast("Loaded from site file.", true);
    } catch (ex) {
      toast(ex.message, false);
    }
  });
  $("save-page").addEventListener("click", async function () {
    var path = $("page-path").value;
    if (!path) return toast("Select a page first.", false);
    var btn = $("save-page");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await Admin.api("PUT", "/api/admin/pages", {
        path: path,
        html: $("page-html").value,
      });
      toast("Page saved to D1.", true);
      await loadPages();
    } catch (ex) {
      toast(ex.message || "Unable to save page.", false);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save to D1";
    }
  });
  $("publish-page").addEventListener("click", async function () {
    var path = $("page-path").value;
    if (!path) return toast("Select a page first.", false);
    var ok = await confirmDialog(
      "Publishing overwrites " + path + " in your GitHub repository. Continue?",
      "Publish"
    );
    if (!ok) return;
    var btn = $("publish-page");
    btn.disabled = true;
    btn.textContent = "Publishing…";
    try {
      var res = await Admin.api("POST", "/api/admin/pages/publish", {
        path: path,
        html: $("page-html").value,
      });
      toast(res.message || "Publish finished.", true);
      await loadPages();
    } catch (ex) {
      toast(ex.message || "Publish failed.", false);
    } finally {
      btn.disabled = false;
      btn.textContent = "Publish to GitHub";
    }
  });

  boot();
})();
