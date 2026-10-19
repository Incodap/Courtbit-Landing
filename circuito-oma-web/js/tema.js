// Tema claro/oscuro y menú móvil, compartidos por todas las páginas.
(function () {
  "use strict";
  var KEY = "oma-tema", root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function guardado() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function aplica(t) {
    root.setAttribute("data-theme", t);
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = "#101B30";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      var oscuro = t === "dark";
      b.setAttribute("aria-label", oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
      b.setAttribute("aria-pressed", String(oscuro));
      b.querySelector("i").className = "ph " + (oscuro ? "ph-sun" : "ph-moon");
    });
  }
  aplica(root.getAttribute("data-theme") || guardado() || (media.matches ? "dark" : "light"));
  media.addEventListener("change", function (e) { if (!guardado()) aplica(e.matches ? "dark" : "light"); });
  document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
    b.addEventListener("click", function () {
      var t = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try { localStorage.setItem(KEY, t); } catch (e) {}
      aplica(t);
    });
  });

  // Menú móvil
  var toggle = document.querySelector("[data-menu-toggle]"), sheet = document.querySelector("[data-menu]");
  if (toggle && sheet) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      sheet.hidden = !open;
      toggle.querySelector("i").className = "ph " + (open ? "ph-x" : "ph-list");
    });
    sheet.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { if (!sheet.hidden) toggle.click(); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) { toggle.click(); toggle.focus(); } });
  }
})();
