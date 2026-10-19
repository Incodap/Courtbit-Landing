(function () {
  "use strict";
  var D = window.OMA;
  var doc = document.documentElement;
  doc.classList.add("js");
  if (!D.DEMO) doc.classList.add("no-demo");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var peso = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  var miles = new Intl.NumberFormat("es-MX");

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function fecha(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function rango(e, largo) {
    var a = fecha(e.inicio), b = fecha(e.fin);
    var mes = largo ? MESES[b.getMonth()] : MES3[b.getMonth()];
    if (a.getMonth() !== b.getMonth()) return a.getDate() + " " + MES3[a.getMonth()] + " - " + b.getDate() + " " + mes;
    return a.getDate() + "-" + b.getDate() + " " + mes + (largo ? " " + b.getFullYear() : "");
  }

  // Momento de la etapa: antes, durante o después. ?momento= lo fuerza para revisar cada vista.
  var hoy = new Date();
  var forzado = new URLSearchParams(location.search).get("momento");
  var etapa = D.etapas.find(function (e) { return !e.master && fecha(e.fin) >= hoy; }) || D.etapas[0];
  var momento = forzado || (hoy < fecha(etapa.inicio) ? "antes" : hoy <= fecha(etapa.fin) ? "durante" : "despues");

  // Portada
  function hero() {
    $("[data-stage-kicker]").textContent = "Etapa " + etapa.n;
    $("[data-stage-city]").textContent = etapa.corto || etapa.ciudad;
    $("[data-stage-dates]").textContent = rango(etapa, true);
    $("[data-stage-venue]").textContent = etapa.ciudad + ", " + etapa.estado;
    var cta = $("[data-stage-cta]");
    if (momento === "durante") { cta.textContent = "Ver partidos"; cta.href = "#resultados"; }
    else if (momento === "despues") { cta.textContent = "Ver campeones"; cta.href = "#categorias"; }
    else cta.href = "inscripcion.html?etapa=" + etapa.id;
    board("v1");
    fitCity();
  }

  var R = window.OMA_RANKING;
  function lista(rama) { return rama === "f1" ? R.f : R.v; }
  // Nombre corto para el tablero: nombre de pila y primer apellido.
  function corto(n) { var p = n.split(" "); return p.length >= 4 ? p[0] + " " + p[p.length - 2] : p.length === 3 ? p[0] + " " + p[2] : n; }
  function board(rama) {
    var rows = lista(rama).slice(0, 5);
    $("[data-board-title]").textContent = R.fuente + " · Varonil";
    $("[data-board-rows]").innerHTML = rows.map(function (r) {
      return '<li class="board__row' + (r.pos === 1 ? " board__row--lead" : "") + '">' +
        '<span class="board__pos">' + r.pos + "</span>" +
        '<span class="board__names">' + esc(corto(r.nombre)) + "</span>" +
        '<span class="board__pts" data-count="' + r.pts + '">' + miles.format(r.pts) + "</span></li>";
    }).join("");
  }

  // Ajusta el nombre de la sede al ancho reservado sin importar su longitud.
  function fitCity() {
    var el = $("[data-fit]"); if (!el) return;
    var box = el.parentElement;
    el.style.fontSize = "";
    if (window.innerWidth <= 860) {
      var w = box.clientWidth;
      el.style.fontSize = "";
      var natural = el.scrollWidth;
      if (natural > w) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * w / natural) + "px";
      return;
    }
    var target = box.clientWidth, cur = parseFloat(getComputedStyle(el).fontSize);
    var ratio = target / el.scrollWidth;
    el.style.fontSize = Math.min(cur * ratio, window.innerHeight * 0.36) + "px";
  }

  // Bloque de momento
  function moment() {
    var title = $("[data-moment-title]"), sub = $("[data-moment-sub]"), body = $("[data-moment-body]");
    if (momento === "durante") {
      title.textContent = "Etapa en juego";
      sub.textContent = "Consulta horarios, canchas y resultados de " + etapa.ciudad + ".";
      body.innerHTML = '<a class="btn btn--lime" href="#resultados">Ver orden de juego</a>';
      return;
    }
    if (momento === "despues") {
      title.textContent = "Campeones en " + etapa.ciudad;
      sub.textContent = "Así cambió el ranking. La siguiente etapa abre inscripciones pronto.";
      body.innerHTML = '<div class="cats">' + D.campeones.map(function (x) {
        return '<div class="cats__col"><h3>' + x.cat + '</h3><div class="cat"><span class="cat__name">' + esc(x.pareja) + '<span class="cat__lvl">+1,000 puntos</span></span></div></div>';
      }).join("") + '</div><div class="moment__foot"><span class="demo-tag" data-demo>Campeones de ejemplo</span></div>';
      return;
    }
    title.textContent = "Inscripciones abiertas";
    sub.textContent = etapa.ciudad + ", " + rango(etapa, true) + ". Precio por pareja.";
    var ramas = ["Varonil", "Femenil"];
    body.innerHTML = '<div class="cats">' + ramas.map(function (rama) {
      var cats = D.categorias.filter(function (c) { return c.rama === rama; });
      return '<div class="cats__col"><h3>' + rama + "<span>" + cats.length + " categorías</span></h3>" + cats.map(function (c) {
        return '<div class="cat"><span class="cat__name">' + c.nombre + '<span class="cat__lvl">' + c.nivel + "</span></span>" +
          '<span class="cat__price">' + peso.format(D.precioPareja) + "</span>" +
          '<a class="btn btn--ghost cat__go" href="inscripcion.html?etapa=' + etapa.id + "&cat=" + c.id + '" aria-label="Inscribirme en ' + rama + " " + c.nombre + '">Inscribirme</a></div>';
      }).join("") + "</div>";
    }).join("") + "</div>" +
      '<div class="moment__foot"><span>Cierre de inscripciones: <span class="countdown" data-countdown></span></span><span class="demo-tag" data-demo>Precio de ejemplo</span></div>';
    countdown();
  }

  function countdown() {
    var el = $("[data-countdown]"); if (!el || !etapa.cierre) return;
    var end = fecha(etapa.cierre); end.setHours(23, 59, 59);
    function tick() {
      var ms = end - new Date();
      if (ms <= 0) { el.textContent = "cerradas"; return; }
      var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
      el.textContent = d + " d " + String(h).padStart(2, "0") + " h " + String(m).padStart(2, "0") + " min";
    }
    tick(); setInterval(tick, 30000);
  }

  // Calendario: riel de etapas como flyers
  var MES_LARGO = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  function stages() {
    var track = $("[data-stages]");
    track.innerHTML = D.etapas.map(function (e) {
      var open = e.estatus === "abiertas";
      var cls = open ? " stage--open" : e.master ? " stage--master" : "";
      var a = fecha(e.inicio), b = fecha(e.fin);
      var dias = a.getMonth() === b.getMonth() ? a.getDate() + "-" + b.getDate() : a.getDate() + " " + MES3[a.getMonth()] + "-" + b.getDate();
      var estado = open ? '<i class="ph-bold ph-check" aria-hidden="true"></i>Inscripciones abiertas' : e.master ? '<i class="ph-bold ph-trophy" aria-hidden="true"></i>Por clasificación' : '<i class="ph-bold ph-clock" aria-hidden="true"></i>Próximamente';
      return '<li class="stage' + cls + '">' +
        '<img class="stage__img" src="assets/img/etapas/' + e.id + '.jpg" alt="" loading="lazy" width="720" height="1008">' +
        '<div class="stage__top"><span class="stage__n">' + (e.master ? "Final" : "Etapa") + '</span><span class="stage__big" aria-hidden="true">' + (e.master ? "M" : (e.n < 10 ? "0" + e.n : e.n)) + "</span></div>" +
        '<div class="stage__mid"><h3 class="stage__city">' + esc(e.corto || e.ciudad) + '</h3><span class="stage__state-name">' + esc(e.estado) + "</span></div>" +
        '<div class="stage__foot"><div class="stage__when"><span class="stage__days">' + dias + '</span><span class="stage__month">' + MES_LARGO[b.getMonth()] + " " + b.getFullYear() + "</span></div>" +
        '<span class="stage__state">' + estado + "</span>" +
        (open ? '<a class="btn btn--night stage__cta" href="inscripcion.html?etapa=' + e.id + '">Inscribirme</a>' : "") + "</div></li>";
    }).join("");
    var prev = $('[data-rail="-1"]'), next = $('[data-rail="1"]');
    function edges() {
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
    }
    $$("[data-rail]").forEach(function (b) {
      b.addEventListener("click", function () {
        var card = track.querySelector(".stage");
        track.scrollBy({ left: (+b.dataset.rail) * (card.offsetWidth + 14) * 2, behavior: reduce ? "auto" : "smooth" });
      });
    });
    track.addEventListener("scroll", function () { requestAnimationFrame(edges); }, { passive: true });
    edges();
  }

  // Ranking: líder y top 10, el resto en ranking.html
  function ranking() {
    var J = window.OMA_JUG, all = R.v, top = all.slice(0, 10), lider = all[0];
    if (!lider) return;
    $("[data-spot]").href = J.perfilUrl(lider);
    $("[data-spot-num]").textContent = "01";
    $("[data-spot-of]").textContent = "de " + all.length + " jugadores";
    $("[data-spot-name]").textContent = lider.nombre;
    $("[data-spot-pts]").textContent = miles.format(lider.pts);
    $("[data-spot-t]").textContent = lider.torneos;
    var foto = J.foto(lider);
    $("[data-spot-img]").src = foto || J.silueta;
    $("[data-spot]").classList.toggle("has-photo", !!foto);
    $("[data-rk-rows]").innerHTML = top.map(function (r) {
      var f = J.foto(r);
      return '<li><a class="rkrow" href="' + J.perfilUrl(r) + '">' +
        '<span class="rkrow__pos">' + r.pos + "</span>" +
        '<span class="rkrow__who"><img class="rkrow__av' + (f ? " is-photo" : "") + '" src="' + (f || J.silueta) + '" alt="" loading="lazy" width="36" height="36"><span class="rkrow__name">' + esc(r.nombre) + "</span></span>" +
        '<span class="rkrow__pts"><span class="sr">Puntos: </span>' + miles.format(r.pts) + "</span></a></li>";
    }).join("");
    $("[data-rk-src]").textContent = R.fuente + " · Varonil individual";
  }
  function countUp(els) {
    els.forEach(function (el) {
      var to = +el.dataset.count, t0 = null, dur = 700;
      function step(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = miles.format(Math.round(to * e));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  // Resultados
  function matches() {
    if (!D.partidos.length) {
      $("[data-matches]").innerHTML = '<div class="empty"><strong>Aún no hay partidos</strong><p>El orden de juego de ' + etapa.ciudad + ' se publica el miércoles anterior a la etapa. Te avisamos por WhatsApp cuando salga.</p></div>';
      $("[data-results-updated]").textContent = "";
      return;
    }
    $("[data-matches]").innerHTML = D.partidos.map(function (m) {
      var estado = m.estado === "en-juego" ? '<span class="match__state match__state--live">En juego</span>' :
        m.estado === "final" ? '<span class="match__state"><i class="ph-bold ph-flag-checkered" aria-hidden="true"></i>Final</span>' :
        '<span class="match__time">' + m.hora + "</span>";
      function row(n) {
        var pair = n === 1 ? m.p1 : m.p2;
        var won = m.ganador === n;
        var cls = m.ganador ? (won ? " match__row--win" : " match__row--lose") : "";
        var sets = [0, 1, 2].map(function (k) {
          var s = m.sets[k];
          if (!s) return '<span class="match__set is-empty">' + (m.sets.length ? "" : "-") + "</span>";
          var mine = s[n - 1], theirs = s[2 - n];
          return '<span class="match__set' + (mine > theirs && (k < m.sets.length - 1 || m.estado === "final") ? " is-won" : "") + '">' + mine + "</span>";
        }).join("");
        return '<div class="match__row' + cls + '"><span class="match__pair">' + esc(pair) + (won ? '<i class="ph-bold ph-check" aria-hidden="true"></i><span class="sr">Ganador</span>' : "") + "</span>" + sets + "</div>";
      }
      return '<article class="match" aria-label="' + esc(m.cat + ", " + m.ronda + ": " + m.p1 + " contra " + m.p2) + '">' +
        '<div class="match__top"><span><strong>' + esc(m.cancha) + "</strong> · " + esc(m.cat) + " · " + esc(m.ronda) + "</span>" +
        (m.cambio ? '<span class="match__changed is-flash">Horario actualizado</span>' : estado) + "</div>" +
        '<div class="match__rows">' + row(1) + row(2) + "</div></article>";
    }).join("");
    var u = new Date(D.actualizado);
    $("[data-results-updated]").textContent = "Actualizado " + u.getDate() + " " + MES3[u.getMonth()] + " a las " + String(u.getHours()).padStart(2, "0") + ":" + String(u.getMinutes()).padStart(2, "0") + ". Solo los partidos marcados En juego se actualizan durante el partido.";
  }

  function points() {
    $("[data-points]").innerHTML = D.puntos.map(function (p) {
      return '<li><span class="points__round">' + p.ronda + '</span><span class="points__pts">' + miles.format(p.pts) + "</span></li>";
    }).join("");
  }

  function news() {
    $("[data-news]").innerHTML = D.noticias.map(function (n) {
      var f = fecha(n.fecha);
      return '<article class="post"><div class="post__img"><img src="' + n.foto + '" alt="" loading="lazy" width="1024" height="768"></div><div class="post__body"><time class="post__date" datetime="' + n.fecha + '">' + f.getDate() + " " + MES3[f.getMonth()] + " " + f.getFullYear() + '</time><h3 class="post__title"><a href="' + n.url + '">' + esc(n.titulo) + '</a></h3><p class="post__text">' + esc(n.resumen) + "</p></div></article>";
    }).join("");
  }

  // Navegación
  function nav() {
    var navEl = $("[data-nav]"), heroEl = $("[data-hero]");
    new IntersectionObserver(function (es) {
      navEl.classList.toggle("is-fixed", !es[0].isIntersecting);
    }, { rootMargin: "-80px 0px 0px 0px" }).observe(heroEl);
    // El menú móvil vive en js/tema.js, compartido con las demás páginas.
  }

  function reveals() {
    // El ranking entra con las barras de puntos creciendo y la cifra del protagonista contando.
    var rk = $(".rk");
    new IntersectionObserver(function (es, ob) {
      if (!es[0].isIntersecting) return;
      rk.classList.add("is-seen"); ob.disconnect();
      var el = $("[data-spot-pts]");
      el.dataset.count = el.textContent.replace(/\D/g, "");
      if (!reduce) countUp([el]);
    }, { threshold: 0.3 }).observe(rk);
  }

  hero(); moment(); stages(); ranking(); matches(); points(); news(); nav(); reveals();

  var started = false;
  var start = function () {
    if (started) return; started = true;
    fitCity();
    var h = $("[data-hero]");
    void h.offsetWidth; // fija el estado inicial para que la transición corra
    h.classList.add("is-in");
    if (!reduce) countUp($$("[data-board-rows] [data-count]"));
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
  setTimeout(start, 1200); // por si la fuente tarda: la portada nunca se queda oculta
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(fitCity, 120); });
})();
