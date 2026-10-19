// Utilidades compartidas entre portada, ranking y perfil de jugador.
// Cuando el circuito se conecte a CourtBit, el historial de cada jugador sale de
// GET /api/players/{uid}/competitions y los partidos de GET /api/brackets/{categoryId}.
(function () {
  "use strict";
  var R = window.OMA_RANKING, F = window.OMA_FOTOS || { jugadores: {} };
  function slug(n) {
    return n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  var porSlug = {};
  R.v.forEach(function (r) { r.id = slug(r.nombre); r.rama = "Varonil"; porSlug[r.id] = r; });
  window.OMA_JUG = {
    slug: slug,
    // Enlaces viejos: el perfil de Mati antes usaba su nombre completo del APPM.
    buscar: function (id) { return porSlug[{ "oscar-matias-almada": "matias-almada" }[id] || id] || null; },
    foto: function (r) { return (r && F.jugadores[r.nombre]) || null; },
    silueta: "assets/img/silueta.webp",
    perfilUrl: function (r) { return "jugador.html?id=" + encodeURIComponent(r.id); },
    // Historial real por jugador (id -> { historial: [], partidos: [] }). Vacío hasta conectar resultados.
    get historial() { return window.OMA_HISTORIAL || {}; }
  };
})();
