/* GglMap Admin app — dashboard UI logic */
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
    pages: "Pages",
    settings: "Settings",
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
    a.download = "gglmap-leads-" + day + ".csv";
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
