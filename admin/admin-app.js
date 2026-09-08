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
    "site-cms": "Pages",
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
    dirty: false,
    pageSeo: { title: "", description: "", ogImage: "" },
    view: "list",
    pageFilter: "all",
    builder: false,
    builderSections: [],
    sectionTypes: [],
    builderPage: null,
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
        okLabel === "Publish" || okLabel === "Enable"
          ? "btn btn-primary"
          : okLabel === "Discard"
            ? "btn btn-secondary"
            : "btn btn-danger";
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
    var current = document.querySelector(".panel.active");
    var leavingCms =
      current &&
      current.id === "panel-site-cms" &&
      name !== "site-cms" &&
      cmsState.dirty;
    var go = function () {
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
        cmsState.view = "list";
        loadCms().catch(function (ex) {
          toast(ex.message || "Unable to load Site CMS.", false);
        });
      }
      if (name === "menus") {
        loadMenusPanel().catch(function (ex) {
          toast(ex.message || "Unable to load Menus.", false);
        });
      }
    };
    if (leavingCms) {
      confirmDialog(
        "You have unsaved Site CMS changes. Leave and discard them?",
        "Discard"
      ).then(function (ok) {
        if (!ok) return;
        cmsState.dirty = false;
        go();
      });
      return;
    }
    go();
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
        (lead.email
          ? '<a href="mailto:' +
            Admin.esc(lead.email) +
            '">' +
            Admin.esc(lead.email) +
            "</a>"
          : "") +
        "</td><td>" +
        Admin.esc(lead.phone || "") +
        "</td><td>" +
        Admin.esc(lead.business || "") +
        "</td><td>" +
        Admin.esc(lead.service) +
        "</td><td>" +
        '<select class="cms-select cms-select-sm" data-lead-status="' +
        lead.id +
        '" aria-label="Lead status">' +
        ["new", "contacted", "closed"]
          .map(function (s) {
            return (
              '<option value="' +
              s +
              '"' +
              (lead.status === s ? " selected" : "") +
              ">" +
              s +
              "</option>"
            );
          })
          .join("") +
        "</select>" +
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
    tbody.querySelectorAll("[data-lead-status]").forEach(function (sel) {
      sel.addEventListener("change", async function () {
        var id = Number(sel.getAttribute("data-lead-status"));
        try {
          await Admin.api("PATCH", "/api/admin/leads/" + id, {
            status: sel.value,
          });
          var lead = state.leads.find(function (l) {
            return l.id === id;
          });
          if (lead) lead.status = sel.value;
          toast("Lead status updated.", true);
        } catch (ex) {
          toast(ex.message || "Unable to update lead.", false);
          renderLeads();
        }
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
    updateViewPostLiveLink();
  }

  function updateViewPostLiveLink() {
    var link = $("view-post-live");
    if (!link) return;
    var status = ($("post-status") && $("post-status").value) || "";
    var slug = ($("post-slug") && $("post-slug").value || "").trim();
    if (status === "published" && slug) {
      link.href = "https://townloc.com/blog/post.html?slug=" + encodeURIComponent(slug);
      link.hidden = false;
    } else {
      link.hidden = true;
      link.removeAttribute("href");
    }
  }

  function insertHtmlSnippet(tag) {
    var ta = $("post-body");
    if (!ta) return;
    var start = ta.selectionStart || 0;
    var end = ta.selectionEnd || 0;
    var selected = ta.value.slice(start, end) || "text";
    var snippet = "";
    if (tag === "h2") snippet = "<h2>" + selected + "</h2>\n";
    else if (tag === "p") snippet = "<p>" + selected + "</p>\n";
    else if (tag === "strong") snippet = "<strong>" + selected + "</strong>";
    else if (tag === "a") snippet = '<a href="https://">' + selected + "</a>";
    else if (tag === "ul")
      snippet = "<ul>\n  <li>" + selected + "</li>\n</ul>\n";
    else return;
    ta.value = ta.value.slice(0, start) + snippet + ta.value.slice(end);
    ta.focus();
  }

  function mountPostUploadHosts() {
    var featuredHost = $("post-featured-upload");
    var featuredInput = $("post-featured");
    if (featuredHost && featuredInput && !featuredHost.dataset.ready) {
      featuredHost.dataset.ready = "1";
      attachImageUploadUi(featuredHost, featuredInput);
      featuredInput.addEventListener("input", updateFeaturedPreview);
    }
    var ogHost = $("post-og-upload");
    var ogInput = $("post-og");
    if (ogHost && ogInput && !ogHost.dataset.ready) {
      ogHost.dataset.ready = "1";
      attachImageUploadUi(ogHost, ogInput);
      ogInput.addEventListener("input", updateOgPreview);
    }
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
      updateViewPostLiveLink();
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
    cmsState.dirty = false;
    fillCmsPageOptions();
    if (cmsState.view === "edit" && getCmsSectionKey()) {
      showCmsEditChrome();
      await renderCmsFields();
      updateCmsStatusHint();
    } else {
      showCmsList();
    }
  }

  function cmsSectionTitle(section) {
    if (!section) return "Edit";
    if (section === "branding") return "Branding";
    if (section === "layout:header") return "Header text labels";
    if (section === "layout:footer") return "Footer text labels";
    if (section.indexOf("auto:") === 0) {
      return cmsPageNiceName(section.slice(5));
    }
    return section;
  }

  function cmsPageNiceName(path) {
    var titleByPath = {};
    (cmsState.customPages || []).forEach(function (p) {
      if (p && p.path) titleByPath[p.path] = p.title || p.path;
    });
    if (path === "index.html") return "Home";
    if (path === "privacy.html") return "Privacy";
    if (path === "terms.html") return "Terms";
    if (path === "industries/index.html") return "Industries";
    if (path === "blog/index.html") return "Blog";
    if (path === "services/index.html") return "Services overview";
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
    return path
      .replace(/\.html$/i, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function showCmsListChrome() {
    cmsState.view = "list";
    var list = $("cms-list-view");
    var edit = $("cms-edit-view");
    if (list) list.hidden = false;
    if (edit) edit.hidden = true;
    if ($("cms-save")) $("cms-save").hidden = true;
    if ($("cms-back")) $("cms-back").hidden = true;
    if ($("cms-add-page-btn")) $("cms-add-page-btn").hidden = false;
    if ($("cms-panel-heading")) $("cms-panel-heading").textContent = "Pages";
    if ($("cms-lead")) {
      $("cms-lead").textContent =
        "Edit a page, or click Add Page. Nest under a parent in Menus to show it in the navbar/footer.";
    }
  }

  function showCmsEditChrome() {
    cmsState.view = "edit";
    var list = $("cms-list-view");
    var edit = $("cms-edit-view");
    if (list) list.hidden = true;
    if (edit) edit.hidden = false;
    if ($("cms-save")) $("cms-save").hidden = false;
    if ($("cms-back")) $("cms-back").hidden = false;
    if ($("cms-add-page-btn")) $("cms-add-page-btn").hidden = true;
    var section = getCmsSectionKey();
    if ($("cms-panel-heading")) {
      $("cms-panel-heading").textContent = "Edit page";
    }
    if ($("cms-edit-title")) {
      $("cms-edit-title").textContent = cmsSectionTitle(section);
    }
    if ($("cms-lead")) {
      $("cms-lead").textContent =
        "Change only what you need, then Save to site.";
    }
    var filterWrap = $("cms-field-filter-wrap");
    if (filterWrap) filterWrap.hidden = !!cmsState.builder;
  }

  function showCmsList() {
    showCmsListChrome();
    renderCmsPageList();
    var st = $("cms-status");
    if (st) st.textContent = "";
  }

  function isSiteBuiltInPage(path) {
    return !isDeletableCustomPage(path);
  }

  function openCmsAddPageForm() {
    var modal = $("add-page-modal");
    if (!modal) return;
    var st = $("cms-create-status");
    if (st) st.textContent = "";
    modal.hidden = false;
    modal.classList.add("show");
    var title = $("cms-new-title");
    if (title) {
      title.value = "";
      title.focus();
    }
    var desc = $("cms-new-desc");
    if (desc) desc.value = "";
  }

  function closeCmsAddPageForm() {
    var modal = $("add-page-modal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.hidden = true;
  }

  function renderCmsPageList() {
    var wrap = $("cms-page-list");
    if (!wrap) return;
    wrap.innerHTML = "";

    var pages = cmsState.pages || [];
    var customCount = 0;
    var siteCount = 0;
    pages.forEach(function (path) {
      if (isDeletableCustomPage(path)) customCount += 1;
      else siteCount += 1;
    });
    // Branding counts as a site item in filters
    siteCount += 1;
    var allCount = siteCount + customCount;

    var countAll = $("cms-filter-count-all");
    var countSite = $("cms-filter-count-site");
    var countCustom = $("cms-filter-count-custom");
    if (countAll) countAll.textContent = "(" + allCount + ")";
    if (countSite) countSite.textContent = "(" + siteCount + ")";
    if (countCustom) countCustom.textContent = "(" + customCount + ")";

    document.querySelectorAll("[data-page-filter]").forEach(function (btn) {
      btn.classList.toggle(
        "is-active",
        btn.getAttribute("data-page-filter") === (cmsState.pageFilter || "all")
      );
    });

    function addRow(opts) {
      var row = document.createElement("div");
      row.className = "wp-pages-row";

      var titleWrap = document.createElement("div");
      titleWrap.className = "wp-pages-title-wrap";

      var titleLine = document.createElement("div");
      titleLine.className = "wp-pages-title-line";

      var titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "wp-pages-title";
      titleBtn.textContent = opts.title;
      titleBtn.addEventListener("click", function () {
        openCmsEditor(opts.section);
      });
      titleLine.appendChild(titleBtn);

      if (opts.badge) {
        var badge = document.createElement("span");
        badge.className = "wp-pages-badge";
        badge.textContent = opts.badge;
        titleLine.appendChild(badge);
      }
      titleWrap.appendChild(titleLine);

      var actions = document.createElement("div");
      actions.className = "wp-pages-row-actions";

      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "wp-pages-action";
      edit.textContent = "Edit";
      edit.addEventListener("click", function () {
        openCmsEditor(opts.section);
      });
      actions.appendChild(edit);

      if (opts.href) {
        var sep1 = document.createElement("span");
        sep1.className = "wp-pages-sep";
        sep1.setAttribute("aria-hidden", "true");
        sep1.textContent = "|";
        actions.appendChild(sep1);

        var view = document.createElement("a");
        view.className = "wp-pages-action";
        view.textContent = "View";
        bindLiveViewLink(view, opts.path);
        actions.appendChild(view);
      }

      if (opts.deletable && opts.path) {
        var sep2 = document.createElement("span");
        sep2.className = "wp-pages-sep";
        sep2.setAttribute("aria-hidden", "true");
        sep2.textContent = "|";
        actions.appendChild(sep2);

        var del = document.createElement("button");
        del.type = "button";
        del.className = "wp-pages-action wp-pages-action-danger";
        del.textContent = "Trash";
        del.addEventListener("click", function () {
          deleteCustomServicePage(opts.path);
        });
        actions.appendChild(del);
      }

      titleWrap.appendChild(actions);
      row.appendChild(titleWrap);
      wrap.appendChild(row);
    }

    var filter = cmsState.pageFilter || "all";
    var shown = 0;

    if (filter === "all" || filter === "site") {
      addRow({
        title: "Branding",
        badge: "Sitewide",
        section: "branding",
      });
      shown += 1;
    }

    pages.forEach(function (path) {
      var custom = isDeletableCustomPage(path);
      if (filter === "site" && custom) return;
      if (filter === "custom" && !custom) return;
      addRow({
        title: cmsPageNiceName(path),
        badge: custom ? "Custom" : null,
        section: "auto:" + path,
        path: path,
        href: liveUrlForPath(path),
        deletable: custom,
      });
      shown += 1;
    });

    if (!shown) {
      var empty = document.createElement("p");
      empty.className = "cms-empty";
      empty.textContent =
        filter === "custom"
          ? "No custom service pages yet. Click Add Page."
          : "No pages found. Click Refresh.";
      wrap.appendChild(empty);
    }
  }

  async function openCmsEditor(section) {
    if (!section) return;
    var ok = await confirmDiscardCmsIfDirty(
      "You have unsaved Site CMS changes. Discard them and open this item?"
    );
    if (!ok) return;
    var sel = $("cms-section");
    if (sel) {
      // Ensure option exists for auto pages
      if (section.indexOf("auto:") === 0) {
        fillCmsPageOptions();
      }
      sel.value = section;
      sel.setAttribute("data-prev", section);
    }
    showCmsEditChrome();
    await renderCmsFields();
    updateCmsStatusHint();
  }

  async function backToCmsList() {
    var ok = await confirmDiscardCmsIfDirty(
      "You have unsaved Site CMS changes. Go back and discard them?"
    );
    if (!ok) return;
    showCmsList();
  }

  function updateCmsStatusHint() {
    var st = $("cms-status");
    if (!st) return;
    if (cmsState.builder) {
      st.textContent = cmsState.dirty
        ? "Unsaved changes — edit sections, then Save to site."
        : "Add, reorder, or edit sections, then Save to site.";
      return;
    }
    var section = getCmsSectionKey();
    var base =
      section.indexOf("auto:") === 0
        ? "Edit the fields below, then click Save to site."
        : section.indexOf("layout:") === 0
          ? "Edit existing header/footer text below. To add/remove/reorder links, use Menus."
          : "Edit the fields below, then click Save to site.";
    st.textContent = cmsState.dirty ? "Unsaved changes — " + base : base;
  }

  function markCmsDirty() {
    if (cmsState.dirty) return;
    cmsState.dirty = true;
    updateCmsStatusHint();
  }

  function isDeletableCustomPage(path) {
    if (!path || !/\.html$/i.test(path)) return false;
    return (cmsState.customPages || []).some(function (p) {
      return p && p.path === path;
    });
  }

  function liveUrlForPath(path) {
    if (!path) return "https://townloc.com/";
    if (path === "index.html") return "https://townloc.com/";
    var p = String(path).replace(/^\/+/, "");
    if (/\/index\.html$/i.test(p)) {
      p = p.replace(/\/index\.html$/i, "/");
    } else if (/\.html$/i.test(p)) {
      p = p.replace(/\.html$/i, "");
    }
    return "https://townloc.com/" + p;
  }

  /** Always open the clean public URL (never *.html) so the address bar never flashes. */
  function bindLiveViewLink(anchor, path) {
    if (!anchor) return;
    var url = liveUrlForPath(path);
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      window.open(liveUrlForPath(path), "_blank", "noopener,noreferrer");
    });
  }

  function fileToOptimizedBase64(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//i.test(file.type)) {
        reject(new Error("Choose an image file."));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var maxEdge = 2400;
        var scale = 1;
        if (Math.max(w, h) > maxEdge) scale = maxEdge / Math.max(w, h);
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, cw, ch);

        function pack(mime, quality) {
          var dataUrl = canvas.toDataURL(mime, quality);
          var parts = dataUrl.split(",");
          return {
            contentType: mime,
            dataBase64: parts[1] || "",
            previewUrl: dataUrl,
          };
        }

        // Skip crush for already-small images that fit
        if (file.size < 400 * 1024 && scale === 1 && /webp|jpeg|jpg/i.test(file.type)) {
          var reader = new FileReader();
          reader.onload = function () {
            var raw = String(reader.result || "");
            resolve({
              contentType: file.type,
              dataBase64: raw.split(",")[1] || "",
              previewUrl: raw,
              filename: file.name,
            });
          };
          reader.onerror = function () {
            reject(new Error("Could not read file."));
          };
          reader.readAsDataURL(file);
          return;
        }

        var webp = pack("image/webp", 0.92);
        if (webp.dataBase64 && webp.dataBase64.length > 64) {
          resolve({
            contentType: "image/webp",
            dataBase64: webp.dataBase64,
            previewUrl: webp.previewUrl,
            filename: (file.name || "image").replace(/\.[^.]+$/, "") + ".webp",
          });
          return;
        }
        var jpg = pack("image/jpeg", 0.9);
        resolve({
          contentType: "image/jpeg",
          dataBase64: jpg.dataBase64,
          previewUrl: jpg.previewUrl,
          filename: (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg",
        });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load image."));
      };
      img.src = url;
    });
  }

  async function uploadOptimizedImage(file) {
    var packed = await fileToOptimizedBase64(file);
    var res = await Admin.api("POST", "/api/admin/media/upload", {
      filename: packed.filename,
      contentType: packed.contentType,
      dataBase64: packed.dataBase64,
    });
    return res;
  }

  function attachImageUploadUi(box, input) {
    var zone = document.createElement("div");
    zone.className = "cms-dropzone";
    zone.innerHTML =
      "<strong>Drag & drop image</strong> or click to upload" +
      '<span class="hint">High quality WebP/JPEG · max 2400px</span>';
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp,image/*";
    fileInput.hidden = true;
    zone.appendChild(fileInput);

    function handleFile(file) {
      if (!file) return;
      zone.classList.add("is-busy");
      zone.querySelector("strong").textContent = "Uploading…";
      uploadOptimizedImage(file)
        .then(function (res) {
          if (res && res.url) {
            input.value = res.url;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            toast(res.message || "Image uploaded.", true);
          } else {
            toast("Upload failed.", false);
          }
        })
        .catch(function (ex) {
          toast(ex.message || "Upload failed.", false);
        })
        .finally(function () {
          zone.classList.remove("is-busy");
          zone.querySelector("strong").textContent = "Drag & drop image";
        });
    }

    zone.addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function () {
      handleFile(fileInput.files && fileInput.files[0]);
      fileInput.value = "";
    });
    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      zone.classList.add("is-drag");
    });
    zone.addEventListener("dragleave", function () {
      zone.classList.remove("is-drag");
    });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("is-drag");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(f);
    });
    box.appendChild(zone);
  }

  async function confirmDiscardCmsIfDirty(message) {
    if (!cmsState.dirty) return true;
    var ok = await confirmDialog(
      message || "You have unsaved Site CMS changes. Discard them?",
      "Discard"
    );
    if (ok) cmsState.dirty = false;
    return ok;
  }

  function fillCmsPageOptions() {
    var group = $("cms-auto-pages");
    if (!group) return;
    var prev = getCmsSectionKey();
    group.innerHTML = "";
    (cmsState.pages || []).forEach(function (path) {
      var opt = document.createElement("option");
      opt.value = "auto:" + path;
      opt.textContent = cmsPageNiceName(path);
      group.appendChild(opt);
    });
    if (prev && $("cms-section")) {
      $("cms-section").value = prev;
      $("cms-section").setAttribute("data-prev", prev);
    } else if ($("cms-section")) {
      $("cms-section").setAttribute("data-prev", $("cms-section").value);
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
      if (st) st.textContent = "Enter a page name first.";
      toast("Enter a page name first.", false);
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
      renderCmsPageList();
      if (titleEl) titleEl.value = "";
      if (descEl) descEl.value = "";
      if (imgEl) imgEl.value = "";
      closeCmsAddPageForm();
      toast("Page created. Nest it under a menu parent in Menus if you want a dropdown.", true);
      if (res.page && res.page.path) {
        await openCmsEditor("auto:" + res.page.path);
      }
    } catch (ex) {
      if (st) st.textContent = ex.message || "Could not create page.";
      toast(ex.message || "Could not create page.", false);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Create page";
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

  function collectBuilderSectionsFromDom() {
    var list = $("cms-section-list");
    if (!list || !cmsState.builder) return;
    var next = [];
    list.querySelectorAll(".cms-section-card").forEach(function (card) {
      var id = card.dataset.sectionId;
      var type = card.dataset.sectionType;
      var prev = (cmsState.builderSections || []).find(function (s) {
        return s.id === id;
      }) || { id: id, type: type };
      var sec = { id: id, type: type };
      card.querySelectorAll("[data-builder-key]").forEach(function (input) {
        var key = input.dataset.builderKey;
        var val = input.value;
        if (key === "itemsText") {
          sec.items = String(val || "")
            .split("\n")
            .map(function (l) {
              return l.trim();
            })
            .filter(Boolean);
          return;
        }
        if (key.indexOf("items.") === 0) {
          var parts = key.split(".");
          var idx = Number(parts[1]);
          var field = parts[2];
          if (!sec.items) sec.items = Array.isArray(prev.items) ? prev.items.map(function (x) { return Object.assign({}, x); }) : [];
          if (!sec.items[idx]) sec.items[idx] = {};
          if (type === "checklist") {
            /* handled via itemsText */
          } else {
            sec.items[idx][field] = val;
          }
          return;
        }
        sec[key] = val;
      });
      if (type === "cards" || type === "faq") {
        if (!sec.items) sec.items = prev.items || [];
      }
      if (type === "checklist" && !sec.items) {
        sec.items = prev.items || [];
      }
      next.push(sec);
    });
    cmsState.builderSections = next;
  }

  async function enableSectionBuilder(path) {
    var ok = await confirmDialog(
      "Switch this page to the section builder? You can add image/text blocks and reorder them. The old field list for this page will be replaced on save.",
      "Enable"
    );
    if (!ok) return;
    try {
      var page =
        (cmsState.customPages || []).find(function (p) {
          return p && p.path === path;
        }) || {};
      var res = await Admin.api("PUT", "/api/admin/pages/sections", {
        path: path,
        init: true,
        title: page.title || cmsPageNiceName(path),
        description: page.description || "",
        imageUrl: page.imageUrl || "",
      });
      cmsState.builder = true;
      cmsState.builderSections = res.sections || [];
      cmsState.sectionTypes = res.sectionTypes || cmsState.sectionTypes;
      cmsState.builderPage = res.page || page;
      cmsState.dirty = false;
      if (page.path) {
        cmsState.customPages = (cmsState.customPages || []).map(function (p) {
          return p && p.path === path ? Object.assign({}, p, { builder: true }) : p;
        });
      }
      toast("Section builder enabled.", true);
      await renderCmsFields();
    } catch (ex) {
      toast(ex.message || "Could not enable builder.", false);
    }
  }

  function collectCmsFieldsIntoState() {
    var section = getCmsSectionKey();
    var wrap = $("cms-fields");
    if (!wrap) return;
    if (section.indexOf("auto:") === 0) {
      wrap.querySelectorAll("[data-cms-key]").forEach(function (input) {
        var key = input.dataset.cmsKey;
        if (String(key).indexOf("seo:") === 0) {
          if (!cmsState.pageSeo) {
            cmsState.pageSeo = { title: "", description: "", ogImage: "" };
          }
          cmsState.pageSeo[key.slice(4)] = input.value;
          return;
        }
        cmsState.autoValues[key] = input.value;
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

  async function deleteCustomServicePage(path) {
    var ok = await confirmDialog(
      "Delete " +
        path +
        "? This removes the page from the CMS and database. Built-in service pages cannot be deleted.",
      "Delete page"
    );
    if (!ok) return;
    try {
      var res = await Admin.api("POST", "/api/admin/pages/delete", { path: path });
      cmsState.pages = res.pages || cmsState.pages;
      cmsState.customPages = (cmsState.customPages || []).filter(function (p) {
        return p && p.path !== path;
      });
      cmsState.dirty = false;
      fillCmsPageOptions();
      showCmsList();
      toast("Page deleted: " + path, true);
    } catch (ex) {
      toast(ex.message || "Unable to delete page.", false);
    }
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
    var locs = (menuUi.doc && menuUi.doc.locations) || {};
    return !!(menuUi.activeMenuId && locs.primary === menuUi.activeMenuId);
  }

  function menuIsFooterAssigned() {
    var locs = (menuUi.doc && menuUi.doc.locations) || {};
    return !!(menuUi.activeMenuId && locs.footer === menuUi.activeMenuId);
  }

  function syncLocationHint() {
    var hint = $("menus-location-hint");
    if (!hint) return;
    var primary =
      ($("menus-loc-primary") && $("menus-loc-primary").checked) ||
      menuIsPrimaryAssigned();
    var footer =
      ($("menus-loc-footer") && $("menus-loc-footer").checked) ||
      menuIsFooterAssigned();
    var where = [];
    if (primary) where.push("Primary (Navbar)");
    if (footer) where.push("Footer");
    var locLine = where.length
      ? "This menu shows in " + where.join(" and ") + "."
      : "Not assigned yet — tick Primary and/or Footer under Display location.";
    hint.textContent =
      locLine +
      " Drag to reorder. Drop indented under a top item, or use Add sub-item, to make a dropdown.";
  }

  function syncLocationCheckboxes() {
    var locs = (menuUi.doc && menuUi.doc.locations) || {};
    var primary = $("menus-loc-primary");
    var footer = $("menus-loc-footer");
    if (primary) {
      primary.checked = !!(
        menuUi.activeMenuId && locs.primary === menuUi.activeMenuId
      );
    }
    if (footer) {
      footer.checked = !!(
        menuUi.activeMenuId && locs.footer === menuUi.activeMenuId
      );
    }
  }

  function syncLocTabs() {
    syncLocationCheckboxes();
    var sel = $("menus-select");
    if (sel && menuUi.activeMenuId) sel.value = menuUi.activeMenuId;
  }

  function fillMenusSelect() {
    var sel = $("menus-select");
    if (!sel) return;
    var prev = menuUi.activeMenuId || sel.value;
    sel.innerHTML = "";
    var menus = (menuUi.doc && menuUi.doc.menus) || [];
    if (!menus.length) {
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "No menus yet — create one";
      sel.appendChild(empty);
      syncLocationCheckboxes();
      return;
    }
    var locs = (menuUi.doc && menuUi.doc.locations) || {};
    menus.forEach(function (m) {
      if (!m || !m.id) return;
      var opt = document.createElement("option");
      opt.value = m.id;
      var tags = [];
      if (locs.primary === m.id) tags.push("Primary");
      if (locs.footer === m.id) tags.push("Footer");
      opt.textContent =
        (m.name || "Menu") + (tags.length ? " (" + tags.join(", ") + ")" : "");
      sel.appendChild(opt);
    });
    if (
      prev &&
      menus.some(function (m) {
        return m && m.id === prev;
      })
    ) {
      sel.value = prev;
      menuUi.activeMenuId = prev;
    } else {
      menuUi.activeMenuId = sel.value || (menus[0] && menus[0].id) || null;
      if (menuUi.activeMenuId) sel.value = menuUi.activeMenuId;
    }
    syncLocationCheckboxes();
  }

  function fillLocationSelects() {
    syncLocationCheckboxes();
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
      var kids = menuChildren(top.id);
      rows.push({ item: top, depth: 0, childCount: kids.length });
      kids.forEach(function (child) {
        rows.push({ item: child, depth: 1, parentLabel: top.label });
      });
    });
    // Legacy: items nested under built-in Services (still show as sub items)
    menuChildren("__services__").forEach(function (child) {
      rows.push({
        item: child,
        depth: 1,
        underServices: true,
        parentLabel: "Services",
      });
    });
    return rows;
  }

  function markMenusDirty() {
    menuUi.dirty = true;
    var st = $("menus-save-status");
    if (st) st.textContent = "Unsaved changes";
  }

  function setMenusView() {
    /* no-op */
  }

  function loadActiveMenuDraft() {
    var menu = (menuUi.doc.menus || []).find(function (m) {
      return m && m.id === menuUi.activeMenuId;
    });
    if (!menu) {
      menu = resolveMenuForLocation(menuUi.editLocation || "primary");
      menuUi.activeMenuId = menu ? menu.id : null;
    }
    menuUi.draftName = menu ? menu.name : "";
    menuUi.draft = normalizeMenuDraft(menu ? menu.items : []);
    var locs = (menuUi.doc && menuUi.doc.locations) || {};
    if (locs.footer === menuUi.activeMenuId && locs.primary !== menuUi.activeMenuId) {
      menuUi.editLocation = "footer";
      menuUi.draft.forEach(function (item) {
        if (item.parentId === "__services__") item.parentId = null;
      });
    } else {
      menuUi.editLocation = "primary";
    }
    menuUi.dirty = false;
    var nameEl = $("menus-name");
    if (nameEl) nameEl.value = menuUi.draftName || "Menu";
    var st = $("menus-save-status");
    if (st) st.textContent = "";
    syncLocationHint();
    fillMenusSelect();
    renderMenusStructure();
  }

  async function selectMenuById(menuId, force) {
    var next = String(menuId || "");
    if (!next) return;
    if (next === menuUi.activeMenuId && !force) {
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
    menuUi.activeMenuId = next;
    loadActiveMenuDraft();
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
      var href = liveUrlForPath(path).replace(/^https:\/\/townloc\.com/i, "") || "/";
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
    if (row.depth) return "Dropdown item";
    if (row.childCount) return "Has dropdown";
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
        (row.childCount ? " has-children" : "") +
        (row.underServices ? " is-services" : "");
      bar.setAttribute("data-menu-id", item.id);
      bar.setAttribute("draggable", "true");
      var tLabel = typeLabelFor(item, row);
      var subHint = row.depth
        ? '<span class="wp-structure-subtag">under ' +
          Admin.esc(row.parentLabel || "parent") +
          "</span>"
        : row.childCount
          ? '<span class="wp-structure-subtag">' +
            row.childCount +
            " sub item" +
            (row.childCount === 1 ? "" : "s") +
            "</span>"
          : "";
      var addSubBtn = !row.depth
        ? '<button type="button" class="btn btn-secondary btn-sm wp-add-sub" data-menu-add-sub="' +
          Admin.esc(item.id) +
          '" title="Add a dropdown link under this item">Add sub-item</button>'
        : "";
      bar.innerHTML =
        '<div class="wp-structure-bar">' +
        '<div class="wp-structure-left">' +
        '<span class="wp-structure-handle" title="Drag">⋮⋮</span>' +
        (row.depth
          ? '<span class="wp-structure-nest" aria-hidden="true">↳</span>'
          : "") +
        '<span class="wp-structure-label">' +
        Admin.esc(item.label) +
        "</span>" +
        subHint +
        "</div>" +
        '<div class="wp-structure-right">' +
        addSubBtn +
        '<span class="wp-structure-type">' +
        Admin.esc(tLabel) +
        ' <span class="wp-structure-caret">▾</span></span>' +
        "</div>" +
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
        '<button type="button" class="btn btn-secondary btn-sm" data-menu-indent="in" title="Make sub item of previous">→</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-menu-remove="' +
        Admin.esc(item.id) +
        '">Remove</button>' +
        "</div></div>";
      wrap.appendChild(bar);

      var barHead = bar.querySelector(".wp-structure-bar");
      if (barHead) {
        barHead.addEventListener("click", function (e) {
          if (e.target && e.target.closest && e.target.closest("[data-menu-add-sub]")) {
            return;
          }
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
    wrap.querySelectorAll("[data-menu-add-sub]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        menusAddSubItem(btn.getAttribute("data-menu-add-sub"));
      });
    });
    bindMenuStructureDrag(wrap);
  }

  function bindMenuStructureDrag(wrap) {
    var dragId = null;
    wrap.querySelectorAll(".wp-structure-item").forEach(function (bar) {
      bar.addEventListener("dragstart", function (e) {
        if (e.target && e.target.closest && e.target.closest("input,button,a,textarea,select")) {
          e.preventDefault();
          return;
        }
        dragId = bar.getAttribute("data-menu-id");
        bar.classList.add("is-dragging");
        try {
          e.dataTransfer.setData("text/plain", dragId);
          e.dataTransfer.effectAllowed = "move";
        } catch (_) {}
      });
      bar.addEventListener("dragend", function () {
        bar.classList.remove("is-dragging");
        wrap.querySelectorAll(".is-drop-target,.is-drop-nest").forEach(function (el) {
          el.classList.remove("is-drop-target", "is-drop-nest");
        });
        dragId = null;
      });
      bar.addEventListener("dragover", function (e) {
        e.preventDefault();
        var nest = e.offsetX > 48;
        bar.classList.add("is-drop-target");
        bar.classList.toggle("is-drop-nest", nest);
      });
      bar.addEventListener("dragleave", function () {
        bar.classList.remove("is-drop-target", "is-drop-nest");
      });
      bar.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var targetId = bar.getAttribute("data-menu-id");
        var sourceId = dragId;
        try {
          sourceId = e.dataTransfer.getData("text/plain") || dragId;
        } catch (_) {}
        var nest = e.offsetX > 48;
        bar.classList.remove("is-drop-target", "is-drop-nest");
        menusDragDropItem(sourceId, targetId, nest);
      });
    });
  }

  function menusDragDropItem(sourceId, targetId, nestUnder) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    collectStructureEdits();
    var source = menuUi.draft.find(function (m) {
      return m.id === sourceId;
    });
    var target = menuUi.draft.find(function (m) {
      return m.id === targetId;
    });
    if (!source || !target) return;

    // Prevent nesting under a sub-item more than one level
    var targetIsTop =
      target.parentId == null || target.parentId === "" || target.parentId === "__services__";

    if (nestUnder && targetIsTop && target.parentId !== "__services__") {
      // Don't nest under self's descendant
      if (source.id === target.id) return;
      source.parentId = target.id;
    } else {
      source.parentId =
        target.parentId == null || target.parentId === ""
          ? null
          : target.parentId;
    }

    // Reorder: place source after target among siblings
    var siblings = menuUi.draft
      .filter(function (m) {
        return (
          (m.parentId == null ? null : String(m.parentId)) ===
          (source.parentId == null ? null : String(source.parentId))
        );
      })
      .sort(function (a, b) {
        return a.order - b.order;
      });
    var without = siblings.filter(function (m) {
      return m.id !== source.id;
    });
    var tIdx = without.findIndex(function (m) {
      return m.id === target.id;
    });
    if (tIdx < 0) without.push(source);
    else without.splice(tIdx + (nestUnder && targetIsTop ? 0 : 1), 0, source);
    without.forEach(function (m, i) {
      m.order = i;
    });

    markMenusDirty();
    renderMenusStructure();
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

  function menusAddDraftItem(label, href, type, parentId) {
    if (!Array.isArray(menuUi.draft)) menuUi.draft = [];
    collectStructureEdits();
    var pid =
      parentId == null || parentId === "" ? null : String(parentId);
    if (pid) {
      var parent = menuUi.draft.find(function (m) {
        return m.id === pid;
      });
      if (!parent || parent.parentId) {
        toast("Pick a top-level menu item as the parent.", false);
        return;
      }
    }
    var siblings = menuChildren(pid);
    menuUi.draft.push({
      id: newMenuLocalId(),
      label: String(label || "Link").trim() || "Link",
      href: String(href || "#").trim() || "#",
      parentId: pid,
      order: siblings.length,
      type: type || "custom",
    });
    if (!menuUi.activeMenuId) {
      var menu = resolveMenuForLocation(menuUi.editLocation);
      menuUi.activeMenuId = menu ? menu.id : null;
    }
    markMenusDirty();
    renderMenusStructure();
    var wrap = $("menus-structure");
    if (wrap) {
      var added = menuUi.draft[menuUi.draft.length - 1];
      var focusId = added ? added.id : null;
      var focusEl =
        (focusId &&
          wrap.querySelector('[data-menu-id="' + focusId + '"]')) ||
        wrap.lastElementChild;
      if (focusEl) {
        focusEl.classList.add("open");
        focusEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }

  function menusAddSubItem(parentId) {
    if (!parentId) return;
    var added = 0;
    ["menus-pages-list", "menus-posts-list"].forEach(function (listId) {
      var list = $(listId);
      if (!list) return;
      list.querySelectorAll("input[type=checkbox]:checked").forEach(function (cb) {
        menusAddDraftItem(
          cb.getAttribute("data-menu-page-label") || "Link",
          cb.getAttribute("data-menu-page-href") || "/",
          cb.getAttribute("data-menu-item-type") || "page",
          parentId
        );
        cb.checked = false;
        added += 1;
      });
    });
    if (added) {
      toast(
        "Added " +
          added +
          " sub item" +
          (added === 1 ? "" : "s") +
          ". Click Save Menu when ready.",
        true
      );
      return;
    }
    menusAddDraftItem("New link", "#", "custom", parentId);
    toast("Sub-item added — set the label and URL, then Save Menu.", true);
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
    var prompted = window.prompt("Menu name", "Main Menu");
    if (prompted == null) return;
    var name = String(prompted).trim() || "Main Menu";
    try {
      var res = await Admin.api("POST", "/api/admin/cms/menus", {
        createMenu: true,
        name: name,
      });
      menuUi.doc = res.menus || menuUi.doc;
      if (res.menu && res.menu.id) {
        menuUi.activeMenuId = res.menu.id;
        if (!menuUi.doc.locations) menuUi.doc.locations = {};
        if (!menuUi.doc.locations.primary) {
          menuUi.doc.locations.primary = res.menu.id;
          await Admin.api("PUT", "/api/admin/cms/menus", {
            locations: menuUi.doc.locations,
          });
        }
      }
      fillMenusSelect();
      loadActiveMenuDraft();
      toast("Menu created. Assign a display location, then Save Menu.", true);
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
      menuUi.activeMenuId = null;
      fillMenusSelect();
      if (menuUi.activeMenuId) loadActiveMenuDraft();
      else {
        menuUi.draft = [];
        renderMenusStructure();
        syncLocationCheckboxes();
      }
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
    menuChildren("__services__").forEach(function (c) {
      ordered.push(c);
    });
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

      var loc = {
        primary: (menuUi.doc.locations && menuUi.doc.locations.primary) || null,
        footer: (menuUi.doc.locations && menuUi.doc.locations.footer) || null,
      };
      var wantPrimary = $("menus-loc-primary") && $("menus-loc-primary").checked;
      var wantFooter = $("menus-loc-footer") && $("menus-loc-footer").checked;
      if (wantPrimary) loc.primary = menuUi.activeMenuId;
      else if (loc.primary === menuUi.activeMenuId) loc.primary = null;
      if (wantFooter) loc.footer = menuUi.activeMenuId;
      else if (loc.footer === menuUi.activeMenuId) loc.footer = null;
      if (loc.primary && loc.footer && loc.primary === loc.footer) {
        // Allowed in WP to use same menu in two places — keep both
      }

      await Admin.api("PUT", "/api/admin/cms/menus", { locations: loc });
      var locRes = await Admin.api("GET", "/api/admin/cms/menus");
      menuUi.doc = locRes.menus || menuUi.doc;

      var menu = (menuUi.doc.menus || []).find(function (m) {
        return m && m.id === menuUi.activeMenuId;
      });
      menuUi.draftName = menu ? menu.name : name;
      menuUi.draft = normalizeMenuDraft(menu ? menu.items : items);
      menuUi.dirty = false;
      fillMenusSelect();
      syncLocationHint();
      if (st) st.textContent = "Saved. Refresh the website to see changes.";
      toast("Menu saved.", true);
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
    var locs0 = menuUi.doc.locations || {};
    menuUi.activeMenuId =
      locs0.primary ||
      locs0.footer ||
      ((menuUi.doc.menus || [])[0] && (menuUi.doc.menus || [])[0].id) ||
      null;
    fillMenusSelect();
    loadActiveMenuDraft();
    renderMenusPagesList();
    renderMenusPostsList();
    if (data.seeded) {
      toast(
        data.message ||
          "Loaded your site header and footer into Primary and Footer menus.",
        true
      );
    }
  }

  function appendMenuManager(wrap) {
    var note = document.createElement("div");
    note.className = "cms-group";
    note.innerHTML =
      '<h4 class="cms-group-heading">Menu structure lives in Menus</h4>' +
      '<p class="cms-block-hint" style="margin:0">This screen only edits <strong>existing header/footer text labels</strong>. To add, remove, nest, or reorder links, open the sidebar <strong>Menus</strong> panel.</p>' +
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

  async function renderCmsFields() {
    var wrap = $("cms-fields");
    if (!wrap) return;
    var section = getCmsSectionKey();
    var filter = ($("cms-field-filter") && $("cms-field-filter").value) || "all";
    wrap.innerHTML = "";
    cmsState.builder = false;

    function appendField(def, value, parent) {
      var host = parent || wrap;
      var isImage =
        def.type === "url" ||
        def.kind === "img" ||
        /image|logo|favicon|og_|_image|photo|src/i.test(
          String(def.key || def.id || def.label || "")
        );
      var box = document.createElement("div");
      box.className =
        "cms-field " + (isImage ? "cms-field--image" : "cms-field--text");
      var id = "cms-field-" + String(def.key || def.id).replace(/[^a-z0-9]+/gi, "-");

      var head = document.createElement("div");
      head.className = "cms-field-head";
      var label = document.createElement("label");
      label.className = "field-label";
      label.setAttribute("for", id);
      label.textContent = def.label || def.key;
      var badge = document.createElement("span");
      badge.className =
        "cms-field-badge " +
        (isImage ? "cms-field-badge--image" : "cms-field-badge--text");
      badge.textContent = isImage ? "Image" : "Text";
      head.appendChild(label);
      head.appendChild(badge);
      box.appendChild(head);

      if (def.hint) {
        var hint = document.createElement("p");
        hint.className = "hint";
        hint.textContent = def.hint;
        box.appendChild(hint);
      } else if (isImage) {
        var hintUrl = document.createElement("p");
        hintUrl.className = "hint";
        hintUrl.textContent = "Paste a full image URL or /assets/images/… path";
        box.appendChild(hintUrl);
      }

      var input;
      if (!isImage && def.type === "textarea") {
        input = document.createElement("textarea");
        input.rows = 3;
      } else {
        input = document.createElement("input");
        input.type = "text";
      }
      input.id = id;
      input.dataset.cmsKey = def.key || def.id;
      input.value = value != null ? value : "";
      input.placeholder = isImage
        ? "https://… or /assets/images/…"
        : "Edit text…";
      input.addEventListener("input", markCmsDirty);
      input.addEventListener("change", markCmsDirty);
      box.appendChild(input);

      if (isImage) {
        var preview = document.createElement("div");
        preview.className = "cms-field-preview";
        var previewImg = document.createElement("img");
        previewImg.alt = "";
        previewImg.loading = "lazy";
        var previewMeta = document.createElement("p");
        previewMeta.className = "cms-field-preview-meta";
        function syncPreview() {
          var url = (input.value || "").trim();
          if (!url) {
            preview.classList.remove("is-on");
            previewImg.removeAttribute("src");
            previewMeta.textContent = "No image URL yet";
            return;
          }
          previewImg.src = url;
          previewMeta.textContent = url.length > 64 ? url.slice(0, 64) + "…" : url;
          preview.classList.add("is-on");
        }
        previewImg.addEventListener("error", function () {
          preview.classList.remove("is-on");
          previewMeta.textContent = "Preview unavailable — check the URL";
        });
        input.addEventListener("input", syncPreview);
        input.addEventListener("change", syncPreview);
        preview.appendChild(previewImg);
        preview.appendChild(previewMeta);
        box.appendChild(preview);
        syncPreview();
        attachImageUploadUi(box, input);
      }

      host.appendChild(box);
    }

    function appendSeoGroup(seo) {
      var group = document.createElement("div");
      group.className = "cms-group";
      var heading = document.createElement("h4");
      heading.className = "cms-group-heading";
      heading.textContent = "Page SEO";
      group.appendChild(heading);
      var hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent =
        "Optional. Overrides title, meta description, and social image for this page.";
      group.appendChild(hint);

      [
        {
          key: "title",
          label: "Meta title",
          type: "text",
          value: (seo && seo.title) || "",
        },
        {
          key: "description",
          label: "Meta description",
          type: "textarea",
          value: (seo && seo.description) || "",
        },
        {
          key: "ogImage",
          label: "OG image",
          type: "url",
          value: (seo && seo.ogImage) || "",
        },
      ].forEach(function (def) {
        var isImg = def.type === "url";
        if (filter === "images" && !isImg) return;
        if (filter === "text" && isImg) return;
        appendField(
          {
            key: "seo:" + def.key,
            label: def.label,
            type: def.type,
            kind: isImg ? "img" : "text",
          },
          def.value,
          group
        );
      });
      if (group.querySelectorAll("[data-cms-key]").length) {
        wrap.appendChild(group);
      }
    }

    function appendPageToolbar(path) {
      var bar = document.createElement("div");
      bar.className = "cms-page-toolbar form-actions";
      var view = document.createElement("a");
      view.className = "btn btn-secondary btn-sm";
      view.textContent = "View on site";
      bindLiveViewLink(view, path);
      bar.appendChild(view);

      if (isDeletableCustomPage(path)) {
        var del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-danger btn-sm";
        del.textContent = "Delete this page";
        del.addEventListener("click", function () {
          deleteCustomServicePage(path);
        });
        bar.appendChild(del);
      }
      wrap.appendChild(bar);
    }

    function sectionTypeLabel(type) {
      var found = (cmsState.sectionTypes || []).find(function (t) {
        return t.type === type;
      });
      return (found && found.label) || type;
    }

    function addBuilderField(box, label, key, value, multiline) {
      var lab = document.createElement("label");
      lab.className = "field-label";
      lab.textContent = label;
      box.appendChild(lab);
      var input = multiline
        ? document.createElement("textarea")
        : document.createElement("input");
      if (!multiline) input.type = "text";
      else input.rows = 3;
      input.dataset.builderKey = key;
      input.value = value != null ? value : "";
      input.addEventListener("input", markCmsDirty);
      box.appendChild(input);
      if (/image|Image|Url|url/.test(key) && !multiline) {
        attachImageUploadUi(box, input);
      }
      return input;
    }

    function renderOneSectionCard(sec, index, pagePath) {
      var card = document.createElement("div");
      card.className = "cms-section-card";
      card.dataset.sectionId = sec.id;
      card.dataset.sectionType = sec.type;

      var head = document.createElement("div");
      head.className = "cms-section-card-head";
      head.innerHTML =
        "<strong>" +
        Admin.esc(sectionTypeLabel(sec.type)) +
        '</strong><span class="hint">#' +
        (index + 1) +
        "</span>";
      var actions = document.createElement("div");
      actions.className = "cms-section-card-actions";
      function moveBtn(label, delta) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-secondary btn-sm";
        b.textContent = label;
        b.addEventListener("click", function () {
          collectBuilderSectionsFromDom();
          var list = cmsState.builderSections || [];
          var i = list.findIndex(function (s) {
            return s.id === sec.id;
          });
          var j = i + delta;
          if (i < 0 || j < 0 || j >= list.length) return;
          var tmp = list[i];
          list[i] = list[j];
          list[j] = tmp;
          markCmsDirty();
          wrap.innerHTML = "";
          appendPageToolbar(pagePath);
          renderSectionBuilder(wrap, pagePath);
        });
        return b;
      }
      actions.appendChild(moveBtn("↑", -1));
      actions.appendChild(moveBtn("↓", 1));
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn-danger btn-sm";
      remove.textContent = "Remove";
      remove.addEventListener("click", function () {
        collectBuilderSectionsFromDom();
        cmsState.builderSections = (cmsState.builderSections || []).filter(
          function (s) {
            return s.id !== sec.id;
          }
        );
        markCmsDirty();
        wrap.innerHTML = "";
        appendPageToolbar(pagePath);
        renderSectionBuilder(wrap, pagePath);
      });
      actions.appendChild(remove);
      head.appendChild(actions);
      card.appendChild(head);

      if (sec.type === "hero") {
        addBuilderField(card, "Eyebrow", "eyebrow", sec.eyebrow);
        addBuilderField(card, "Title", "title", sec.title);
        addBuilderField(card, "Lead text", "lead", sec.lead, true);
        addBuilderField(card, "Image URL", "imageUrl", sec.imageUrl);
        addBuilderField(card, "Primary button label", "primaryLabel", sec.primaryLabel);
        addBuilderField(card, "Primary button link", "primaryHref", sec.primaryHref);
        addBuilderField(card, "Secondary button label", "secondaryLabel", sec.secondaryLabel);
        addBuilderField(card, "Secondary button link", "secondaryHref", sec.secondaryHref);
      } else if (sec.type === "textImage") {
        addBuilderField(card, "Heading", "title", sec.title);
        addBuilderField(card, "Body", "body", sec.body, true);
        addBuilderField(card, "Image URL", "imageUrl", sec.imageUrl);
        var sideLab = document.createElement("label");
        sideLab.className = "field-label";
        sideLab.textContent = "Image side";
        card.appendChild(sideLab);
        var side = document.createElement("select");
        side.dataset.builderKey = "imageSide";
        side.innerHTML =
          '<option value="right">Text left · Image right</option>' +
          '<option value="left">Image left · Text right</option>';
        side.value = sec.imageSide === "left" ? "left" : "right";
        side.addEventListener("change", markCmsDirty);
        card.appendChild(side);
      } else if (sec.type === "cards") {
        addBuilderField(card, "Section title", "title", sec.title);
        (sec.items || []).forEach(function (it, ii) {
          addBuilderField(card, "Card " + (ii + 1) + " title", "items." + ii + ".title", it.title);
          addBuilderField(card, "Card " + (ii + 1) + " text", "items." + ii + ".text", it.text, true);
        });
      } else if (sec.type === "checklist") {
        addBuilderField(card, "Section title", "title", sec.title);
        addBuilderField(
          card,
          "Items (one per line)",
          "itemsText",
          (sec.items || []).join("\n"),
          true
        );
      } else if (sec.type === "faq") {
        addBuilderField(card, "Section title", "title", sec.title);
        (sec.items || []).forEach(function (it, ii) {
          addBuilderField(card, "Q" + (ii + 1), "items." + ii + ".q", it.q);
          addBuilderField(card, "A" + (ii + 1), "items." + ii + ".a", it.a, true);
        });
      } else if (sec.type === "cta") {
        addBuilderField(card, "Heading", "title", sec.title);
        addBuilderField(card, "Text", "text", sec.text, true);
        addBuilderField(card, "Button label", "buttonLabel", sec.buttonLabel);
        addBuilderField(card, "Button link", "buttonHref", sec.buttonHref);
      } else if (sec.type === "contact") {
        addBuilderField(card, "Eyebrow", "eyebrow", sec.eyebrow);
        addBuilderField(card, "Heading", "title", sec.title);
        addBuilderField(card, "Lead text", "text", sec.text, true);
      }

      return card;
    }

    function renderSectionBuilder(host, pagePath) {
      var intro = document.createElement("p");
      intro.className = "cms-meta";
      intro.textContent =
        "Add sections in any order (image + text, cards, FAQ…). Save to publish to the live page.";
      host.appendChild(intro);

      var addBar = document.createElement("div");
      addBar.className = "cms-section-add form-actions";
      (cmsState.sectionTypes || []).forEach(function (t) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-secondary btn-sm";
        btn.textContent = "+ " + t.label;
        btn.title = t.hint || "";
        btn.addEventListener("click", function () {
          collectBuilderSectionsFromDom();
          var blank = {
            id:
              "s_" +
              Date.now().toString(36) +
              "_" +
              Math.random().toString(36).slice(2, 6),
            type: t.type,
          };
          if (t.type === "hero") {
            Object.assign(blank, {
              eyebrow: "Service",
              title: "New headline.",
              lead: "Supporting text.",
              imageUrl: "/assets/images/services/local-seo/hero.jpg",
              primaryLabel: "Get Started",
              primaryHref: "/#contact",
              secondaryLabel: "",
              secondaryHref: "#",
            });
          } else if (t.type === "textImage") {
            Object.assign(blank, {
              title: "Section heading",
              body: "Write your copy here.",
              imageUrl: "/assets/images/services/local-seo/hero.jpg",
              imageSide: "right",
            });
          } else if (t.type === "cards") {
            Object.assign(blank, {
              title: "What you get",
              items: [
                { title: "Card one", text: "Short text." },
                { title: "Card two", text: "Short text." },
                { title: "Card three", text: "Short text." },
              ],
            });
          } else if (t.type === "checklist") {
            Object.assign(blank, {
              title: "What’s included",
              items: ["Item one", "Item two", "Item three"],
            });
          } else if (t.type === "faq") {
            Object.assign(blank, {
              title: "Questions",
              items: [
                { q: "Question?", a: "Answer." },
                { q: "Another question?", a: "Answer." },
              ],
            });
          } else if (t.type === "cta") {
            Object.assign(blank, {
              title: "Ready to start?",
              text: "Short call to action.",
              buttonLabel: "Get Started",
              buttonHref: "/#contact",
            });
          } else if (t.type === "contact") {
            Object.assign(blank, {
              eyebrow: "Free Assessment",
              title: "Tell us about your local presence.",
              text: "We'll review what you share and explain what you need — clearly, without pressure.",
            });
          }
          cmsState.builderSections.push(blank);
          markCmsDirty();
          host.innerHTML = "";
          appendPageToolbar(pagePath);
          renderSectionBuilder(host, pagePath);
        });
        addBar.appendChild(btn);
      });
      host.appendChild(addBar);

      var list = document.createElement("div");
      list.className = "cms-section-list";
      list.id = "cms-section-list";
      (cmsState.builderSections || []).forEach(function (sec, i) {
        list.appendChild(renderOneSectionCard(sec, i, pagePath));
      });
      host.appendChild(list);
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
                kind: f.kind,
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
          stL.textContent = cmsState.dirty
            ? "Unsaved changes — Add new links in Menus, or edit existing labels below — then Save."
            : "Add / remove / reorder links in Menus. Here you only edit existing header/footer text — then Save.";
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
      if (st) st.textContent = "Loading " + cmsPageNiceName(path) + "…";
      try {
        var secRes = await Admin.api(
          "GET",
          "/api/admin/pages/sections?path=" + encodeURIComponent(path)
        );
        cmsState.sectionTypes = secRes.sectionTypes || [];
        cmsState.builderPage = secRes.page || null;

        if (secRes.builder && Array.isArray(secRes.sections)) {
          cmsState.builder = true;
          cmsState.builderSections = secRes.sections.slice();
          if ($("cms-field-filter-wrap")) $("cms-field-filter-wrap").hidden = true;
          appendPageToolbar(path);
          renderSectionBuilder(wrap, path);
          updateCmsStatusHint();
          return;
        }

        if (isDeletableCustomPage(path) && !secRes.sections) {
          appendPageToolbar(path);
          var enable = document.createElement("div");
          enable.className = "cms-group";
          enable.innerHTML =
            '<h4 class="cms-group-heading">Section builder</h4>' +
            '<p class="hint">This page still uses the old field scan. Switch to section builder to add image/text blocks yourself.</p>';
          var enableBtn = document.createElement("button");
          enableBtn.type = "button";
          enableBtn.className = "btn btn-primary btn-sm";
          enableBtn.textContent = "Enable section builder";
          enableBtn.addEventListener("click", function () {
            enableSectionBuilder(path);
          });
          enable.appendChild(enableBtn);
          wrap.appendChild(enable);
        }

        var scanned = await Admin.api(
          "GET",
          "/api/admin/cms/scan?path=" + encodeURIComponent(path)
        );
        cmsState.autoFields = scanned.fields || [];
        cmsState.autoValues = {};
        cmsState.autoFields.forEach(function (f) {
          cmsState.autoValues[f.id] = f.value;
        });
        cmsState.pageSeo = scanned.seo || {
          title: "",
          description: "",
          ogImage: "",
        };
        if (!(secRes.builder && Array.isArray(secRes.sections))) {
          if (!wrap.querySelector(".cms-page-toolbar")) appendPageToolbar(path);
        }
        appendSeoGroup(cmsState.pageSeo);
        var showText = filter === "all" || filter === "text";
        var showImages = filter === "all" || filter === "images";
        var visible = cmsState.autoFields.filter(function (f) {
          if (f.kind === "text") return showText;
          if (f.kind === "img") return showImages;
          return false;
        });

        if (!visible.length) {
          var emptyAuto = document.createElement("p");
          emptyAuto.className = "cms-empty";
          emptyAuto.textContent =
            "No content fields match this filter on this page.";
          wrap.appendChild(emptyAuto);
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
                kind: f.kind,
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
        updateCmsStatusHint();
        if ($("cms-field-filter-wrap")) $("cms-field-filter-wrap").hidden = false;
      } catch (ex) {
        wrap.innerHTML =
          '<p class="cms-empty">Load failed: ' +
          Admin.esc(ex.message || "error") +
          "</p>";
        if (st) st.textContent = ex.message || "Load failed";
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
    if (cmsState.builder) collectBuilderSectionsFromDom();
    else collectCmsFieldsIntoState();
    var btn = $("cms-save");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      var section = getCmsSectionKey();
      if (cmsState.builder && section.indexOf("auto:") === 0) {
        var bpath = section.slice(5);
        var page = cmsState.builderPage || {};
        await Admin.api("PUT", "/api/admin/pages/sections", {
          path: bpath,
          sections: cmsState.builderSections || [],
          title: page.title || cmsPageNiceName(bpath),
          description: page.description || "",
          imageUrl: page.imageUrl || "",
        });
        toast(
          "Sections saved. Open View on site (hard refresh) to check.",
          true
        );
      } else if (section.indexOf("auto:") === 0) {
        var path = section.slice(5);
        await Admin.api("PUT", "/api/admin/cms", {
          autoPage: true,
          path: path,
          values: cmsState.autoValues,
          seo: cmsState.pageSeo || {},
        });
        toast(
          "Page CMS saved for " +
            path +
            ". Open “View on site” (hard refresh) to check.",
          true
        );
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
      cmsState.dirty = false;
      updateCmsStatusHint();
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
    });
  });

  if ($("cms-back")) {
    $("cms-back").addEventListener("click", function () {
      backToCmsList();
    });
  }
  if ($("cms-add-page-btn")) {
    $("cms-add-page-btn").addEventListener("click", function () {
      if (cmsState.view !== "list") {
        backToCmsList().then(function () {
          openCmsAddPageForm();
        });
        return;
      }
      openCmsAddPageForm();
    });
  }
  document.querySelectorAll("[data-page-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = btn.getAttribute("data-page-filter") || "all";
      if (next === cmsState.pageFilter) return;
      cmsState.pageFilter = next;
      renderCmsPageList();
    });
  });
  document.querySelectorAll("[data-cms-open]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openCmsEditor(btn.getAttribute("data-cms-open"));
    });
  });
  if ($("cms-field-filter")) {
    $("cms-field-filter").addEventListener("change", function () {
      if (cmsState.view !== "edit") return;
      var filterEl = $("cms-field-filter");
      var next = filterEl.value;
      var prev = filterEl.getAttribute("data-prev") || next;
      confirmDiscardCmsIfDirty(
        "You have unsaved Site CMS changes. Change filter and discard them?"
      ).then(function (ok) {
        if (!ok) {
          filterEl.value = prev;
          return;
        }
        filterEl.setAttribute("data-prev", next);
        renderCmsFields().then(function () {
          updateCmsStatusHint();
        });
      });
    });
  }
  if ($("cms-reload")) {
    $("cms-reload").addEventListener("click", function () {
      confirmDiscardCmsIfDirty(
        "You have unsaved Site CMS changes. Refresh and discard them?"
      ).then(function (ok) {
        if (!ok) return;
        cmsState.view = "list";
        loadCms().catch(function (ex) {
          toast(ex.message || "Unable to reload CMS.", false);
        });
      });
    });
  }
  if ($("cms-create-page")) {
    $("cms-create-page").addEventListener("click", function () {
      createServicePage();
    });
  }
  if ($("cms-add-page-cancel")) {
    $("cms-add-page-cancel").addEventListener("click", closeCmsAddPageForm);
  }
  if ($("add-page-modal")) {
    $("add-page-modal").addEventListener("click", function (e) {
      if (e.target === $("add-page-modal")) closeCmsAddPageForm();
    });
  }
  if ($("cms-new-title")) {
    $("cms-new-title").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        createServicePage();
      }
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
  if ($("menus-select")) {
    $("menus-select").addEventListener("change", function () {
      selectMenuById($("menus-select").value);
    });
  }
  if ($("menus-create")) {
    $("menus-create").addEventListener("click", function () {
      menusCreateMenu();
    });
  }
  if ($("menus-delete")) {
    $("menus-delete").addEventListener("click", function () {
      menusDeleteMenu();
    });
  }
  ["menus-loc-primary", "menus-loc-footer"].forEach(function (id) {
    if ($(id)) {
      $(id).addEventListener("change", function () {
        markMenusDirty();
        syncLocationHint();
        var st = $("menus-save-status");
        if (st) st.textContent = "Location changed — click Save Menu";
      });
    }
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
  $("post-slug").addEventListener("input", updateViewPostLiveLink);
  $("post-status").addEventListener("change", updateViewPostLiveLink);

  document.querySelectorAll("[data-html-insert]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      insertHtmlSnippet(btn.getAttribute("data-html-insert"));
    });
  });
  mountPostUploadHosts();

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
      updateViewPostLiveLink();
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
