(function () {
  "use strict";
  var R = window.OMA_RANKING, J = window.OMA_JUG;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var miles = new Intl.NumberFormat("es-MX");
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sinAcentos(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
  function dos(n) { return n < 10 ? "0" + n : String(n); }

  var q = new URLSearchParams(location.search);
  var rama = q.get("rama") === "femenil" ? "f" : "v";
  var PAGINA = 50, visibles = PAGINA, filtro = q.get("q") || "";
  $("[data-search]").value = filtro;
  $("[data-src]").textContent = R.fuente + " · Individual";

  function lista() { return rama === "f" ? R.f : R.v; }

  function podium(all) {
    var el = $("[data-podium]");
    if (!all.length) { el.innerHTML = ""; return; }
    // Orden visual 2 · 1 · 3, como en un podio.
    var orden = [all[1], all[0], all[2]].filter(Boolean);
    el.innerHTML = orden.map(function (r) {
      var foto = J.foto(r);
      return '<a class="pod pod--' + r.pos + (foto ? " has-photo" : "") + '" href="' + J.perfilUrl(r) + '">' +
        '<span class="pod__num" aria-hidden="true">' + dos(r.pos) + "</span>" +
        '<img class="pod__img" src="' + (foto || J.silueta) + '" alt="" loading="lazy">' +
        '<span class="pod__body"><span class="pod__pos">' + r.pos + '<span class="sr"> lugar</span></span>' +
        '<span class="pod__name">' + esc(r.nombre) + "</span>" +
        '<span class="pod__pts"><strong>' + miles.format(r.pts) + "</strong> puntos · " + r.torneos + " torneos</span></span></a>";
    }).join("");
  }

  function filas() {
    var all = lista();
    var rows = filtro ? all.filter(function (r) { return sinAcentos(r.nombre).indexOf(sinAcentos(filtro)) !== -1; }) : all;
    var shown = filtro ? rows : rows.slice(0, visibles);
    var lider = all[0] ? all[0].pts : 1;
    $("[data-rows]").innerHTML = shown.map(function (r) {
      var foto = J.foto(r);
      return '<a class="rkp-row" role="row" href="' + J.perfilUrl(r) + '">' +
        '<span class="rkp-pos" role="cell">' + r.pos + "</span>" +
        '<span class="rkp-who" role="cell"><img class="rkp-av' + (foto ? " is-photo" : "") + '" src="' + (foto || J.silueta) + '" alt="" loading="lazy" width="44" height="44">' +
        '<span class="rkp-name-wrap"><span class="rkp-name">' + esc(r.nombre) + '</span><span class="rkrow__bar" style="transform:scaleX(' + (r.pts / lider).toFixed(3) + ')" aria-hidden="true"></span></span></span>' +
        '<span class="num rkp-dim" role="cell">' + r.torneos + "</span>" +
        '<span class="num rkp-dim" role="cell">' + miles.format(Math.round(r.pts / r.torneos)) + "</span>" +
        '<span class="num rkp-pts" role="cell">' + miles.format(r.pts) + "</span>" +
        '<i class="ph-bold ph-caret-right rkp-go" aria-hidden="true"></i></a>';
    }).join("");
    var empty = $("[data-empty]");
    empty.hidden = !!rows.length;
    empty.innerHTML = !all.length ? "<strong>Ranking femenil en camino</strong><p>Se publica con los resultados de la primera etapa del circuito.</p>" : "<strong>Sin resultados</strong><p>No hay jugadores que coincidan con “" + esc(filtro) + "”. Revisa la ortografía o busca por apellido.</p>";
    $(".rkp-table").hidden = !rows.length;
    var more = $("[data-more]");
    more.hidden = !!filtro || rows.length <= visibles;
    more.textContent = "Ver " + Math.min(PAGINA, rows.length - visibles) + " más de " + rows.length;
  }

  function pinta() { podium(lista()); filas(); }

  $("[data-more]").addEventListener("click", function () { visibles += PAGINA; filas(); });
  var t; $("[data-search]").addEventListener("input", function (ev) {
    clearTimeout(t);
    t = setTimeout(function () {
      filtro = ev.target.value.trim(); visibles = PAGINA; filas();
      var u = new URL(location.href); if (filtro) u.searchParams.set("q", filtro); else u.searchParams.delete("q"); history.replaceState(null, "", u);
    }, 140);
  });
  $$("[data-rama]").forEach(function (b) {
    b.setAttribute("aria-selected", String(b.dataset.rama === rama));
    b.addEventListener("click", function () {
      if (b.dataset.rama === rama) return;
      rama = b.dataset.rama; visibles = PAGINA;
      $$("[data-rama]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      var u = new URL(location.href); u.searchParams.set("rama", rama === "f" ? "femenil" : "varonil"); history.replaceState(null, "", u);
      pinta();
    });
  });

  pinta();
  if (!reduce) requestAnimationFrame(function () { document.body.classList.add("is-ready"); });
  else document.body.classList.add("is-ready");
})();
