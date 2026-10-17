/* Buildbench: directory search/filter + newsletter (frontend only). No dependencies. */
(function () {
  "use strict";

  var state = { tools: [], categories: [], query: "", category: "", pricing: "" };
  var $ = function (id) { return document.getElementById(id); };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Load tools.json over HTTP; fall back to the generated inline copy
  // (assets/tools-fallback.js) when opened via file:// or if fetch fails.
  function loadTools() {
    return fetch("data/tools.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () {
        if (window.TOOLS_FALLBACK) return window.TOOLS_FALLBACK;
        throw new Error("Could not load data/tools.json");
      });
  }

  function renderChips() {
    var wrap = $("category-chips");
    var cats = [""].concat(state.categories);
    wrap.innerHTML = cats.map(function (c) {
      return '<button type="button" class="chip" data-cat="' + escapeHtml(c) + '" aria-pressed="' +
        (state.category === c) + '">' + escapeHtml(c || "All") + "</button>";
    }).join("");
  }

  function matches(t) {
    if (state.category && t.category !== state.category) return false;
    if (state.pricing && t.pricing !== state.pricing) return false;
    if (!state.query) return true;
    var hay = (t.name + " " + t.description + " " + t.category + " " + (t.tags || []).join(" ")).toLowerCase();
    return state.query.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function renderGrid() {
    var list = state.tools.filter(matches);
    $("tool-grid").innerHTML = list.map(function (t) {
      return '<li class="card">' +
        '<h3><a href="' + escapeHtml(t.url) + '" target="_blank" rel="noopener">' + escapeHtml(t.name) + "</a></h3>" +
        "<p>" + escapeHtml(t.description) + "</p>" +
        '<div class="meta"><span class="pill">' + escapeHtml(t.category) + "</span>" +
        '<span class="pill ' + escapeHtml(t.pricing) + '">' + escapeHtml(t.pricing) + "</span></div></li>";
    }).join("");
    $("empty").hidden = list.length > 0;
    $("result-count").textContent = list.length + " of " + state.tools.length + " tools";
  }

  function initDirectory() {
    loadTools().then(function (data) {
      state.tools = (data.tools || []).slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
      state.categories = data.categories && data.categories.length ? data.categories
        : Array.from(new Set(state.tools.map(function (t) { return t.category; })));
      $("tool-count").textContent = state.tools.length;
      renderChips();
      renderGrid();
    }).catch(function (err) {
      $("result-count").textContent = "Couldn't load the directory. Serve the site over HTTP (see README).";
      console.error(err);
    });

    $("search").addEventListener("input", function (e) { state.query = e.target.value.trim().toLowerCase(); renderGrid(); });
    $("pricing").addEventListener("change", function (e) { state.pricing = e.target.value; renderGrid(); });
    $("category-chips").addEventListener("click", function (e) {
      var btn = e.target.closest(".chip"); if (!btn) return;
      state.category = btn.getAttribute("data-cat"); renderChips(); renderGrid();
    });
  }

  function initNewsletter() {
    var form = $("newsletter-form"), input = $("nl-email"), msg = $("nl-msg");
    var KEY = "buildbench_newsletter_email";
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function success(email) {
      form.classList.add("done");
      msg.classList.remove("error");
      msg.textContent = "You're in! Watch " + email + " for the first issue.";
    }

    try { var saved = localStorage.getItem(KEY); if (saved) success(saved); } catch (e) {}

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = input.value.trim();
      if (!EMAIL_RE.test(email)) {
        msg.classList.add("error");
        msg.textContent = "Please enter a valid email address.";
        input.focus();
        return;
      }
      // TODO: Resend gets wired in later. Replace this localStorage stub with a POST to a
      // serverless endpoint (e.g. /api/subscribe) that adds the contact to a Resend audience.
      // Nothing is sent anywhere yet; the email only stays in this browser.
      try { localStorage.setItem(KEY, email); } catch (err) {}
      success(email);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("year").textContent = new Date().getFullYear();
    initDirectory();
    initNewsletter();
  });
})();
