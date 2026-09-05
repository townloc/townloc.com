/* GglMap Admin API client */
(function (global) {
  var API_BASE = "https://gglmap.catiq.workers.dev";
  var TOKEN_KEY = "gglmap_admin_token";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token || "");
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function api(method, path, body) {
    var headers = { Accept: "application/json" };
    var token = getToken();
    if (token) headers.Authorization = "Bearer " + token;
    var opts = { method: method, headers: headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(API_BASE + path, opts);
    var data = {};
    try {
      data = await res.json();
    } catch (_) {
      /* ignore */
    }
    if (res.status === 401) {
      logout();
      if (!/index\.html$/i.test(location.pathname)) {
        location.href = "index.html";
      }
    }
    if (!res.ok || data.success === false) {
      throw new Error((data && data.message) || "Request failed (" + res.status + ")");
    }
    return data;
  }

  async function login(password) {
    var data = await api("POST", "/api/admin/login", { password: password });
    if (!data.token) throw new Error("No token returned");
    setToken(data.token);
    return data;
  }

  global.Admin = {
    API_BASE: API_BASE,
    getToken: getToken,
    setToken: setToken,
    logout: logout,
    login: login,
    api: api,
    esc: esc,
  };
})(window);
