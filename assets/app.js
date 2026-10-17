/* Nellyon AI Stack: directory search/filter + newsletter signup (POST /api/subscribe). No dependencies. */
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
    var button = form.querySelector('button[type="submit"]');
    var honeypot = form.querySelector('input[name="company"]');
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function show(text, isError) {
      msg.classList.toggle("error", !!isError);
      msg.textContent = text;
    }
    function done(text) { form.classList.add("done"); show(text, false); }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = input.value.trim();
      if (!EMAIL_RE.test(email)) {
        show("Please enter a valid email address.", true);
        input.focus();
        return;
      }
      button.disabled = true;
      show("Subscribing...", false);

      // Adds the email to the Resend "Buildbench Newsletter" segment via api/subscribe.js.
      fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, company: honeypot ? honeypot.value : "" })
      })
        .then(function (r) {
          return r.json().catch(function () { return { ok: false, error: "server_error" }; });
        })
        .then(function (data) {
          if (data && data.ok) return done("You're in! Watch " + email + " for the first issue.");
          if (data && data.error === "already_subscribed") return done("You're already on the list. See you in your inbox.");
          if (data && data.error === "invalid_email") { show("Please enter a valid email address.", true); input.focus(); return; }
          show("Something went wrong on our end. Please try again in a minute.", true);
        })
        .catch(function () {
          show("Couldn't reach the server. Check your connection and try again.", true);
        })
        .then(function () { button.disabled = false; });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("year").textContent = new Date().getFullYear();
    initDirectory();
    initNewsletter();
  });
})();
