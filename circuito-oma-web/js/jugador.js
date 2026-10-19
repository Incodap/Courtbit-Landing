(function () {
  "use strict";
  var R = window.OMA_RANKING, J = window.OMA_JUG, EX = window.OMA_EJEMPLO;
  var miles = new Intl.NumberFormat("es-MX");
  var pct = new Intl.NumberFormat("es-MX", { style: "percent", maximumFractionDigits: 0 });
  var MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var RONDAS = ["Grupos", "Octavos", "Cuartos", "Semifinal", "Final"];
  var ORDEN_RES = { "Campeón": 7, "Final": 6, "Semifinal": 5, "Cuartos": 4, "Octavos": 3, "16avos": 2, "Grupos": 1, "Sin registro": 0 };
  var NOMBRE_RES = { "Campeón": "Campeón", "Final": "Finalista", "Semifinal": "Semifinal", "Cuartos": "Cuartos", "Octavos": "Octavos", "16avos": "16avos", "Grupos": "Fase de grupos", "Sin registro": "Sin ronda registrada" };
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fecha(s) { var p = s.split("-"); return p[2].replace(/^0/, "") + " " + MES3[+p[1] - 1] + " " + p[0]; }
  function dos(n) { return n < 10 ? "0" + n : String(n); }

  // Jugador: real (del ranking) o el perfil de ejemplo.
  var id = new URLSearchParams(location.search).get("id") || "";
  var esEjemplo = id === "ejemplo";
  var r = esEjemplo ? null : J.buscar(id);
  if (!esEjemplo && !r) { location.replace("ranking.html"); return; }
  var nombre = esEjemplo ? EX.nombre : r.nombre;
  var datos = esEjemplo ? EX : J.historial[id] || null;
  document.title = nombre + " · Circuito OMA Pádel";

  // Encabezado
  var foto = esEjemplo ? null : J.foto(r);
  $("[data-num]").textContent = esEjemplo ? "EJ" : dos(r.pos);
  $("[data-img]").src = foto || J.silueta;
  $("[data-img]").classList.toggle("is-photo", !!foto);
  $("[data-img]").alt = foto ? nombre : "";
  $("[data-name]").textContent = nombre;
  $("[data-ex]").hidden = !esEjemplo;
  $("[data-meta]").textContent = esEjemplo ? [EX.rama, EX.ciudad, EX.mano, "Juega de " + EX.lado.toLowerCase()].join(" · ") : r.rama + " · " + R.fuente;

  var stats;
  if (esEjemplo) {
    var ptsEx = EX.historial.reduce(function (s, h) { return s + h.puntos; }, 0);
    stats = [["Puntos", miles.format(ptsEx)], ["Torneos", EX.historial.length], ["Por torneo", miles.format(Math.round(ptsEx / EX.historial.length))], ["Mejor resultado", mejor(EX.historial)]];
  } else {
    var i = R.v.indexOf(r);
    var gap = i === 0 ? (R.v[1] ? "+" + miles.format(r.pts - R.v[1].pts) : "-") : miles.format(R.v[i - 1].pts - r.pts + 1);
    stats = [["Posición", r.pos + " de " + R.v.length], ["Puntos", miles.format(r.pts)], ["Torneos", r.torneos], ["Por torneo", miles.format(Math.round(r.pts / r.torneos))], [i === 0 ? "Ventaja sobre el 2" : "Para subir al " + R.v[i - 1].pos, gap]];
  }
  $("[data-stats]").innerHTML = stats.map(function (s) { return "<div><dt>" + s[0] + "</dt><dd>" + s[1] + "</dd></div>"; }).join("");

  function mejor(h) {
    var b = h.slice().sort(function (a, c) { return ORDEN_RES[c.resultado] - ORDEN_RES[a.resultado]; })[0];
    return b ? NOMBRE_RES[b.resultado] : "-";
  }

  var cuerpo = $("[data-cuerpo]");
  if (!datos) {
    cuerpo.innerHTML = '<section class="pf-sec wrap"><div class="empty empty--night pf-wait"><strong>Historial en camino</strong>' +
      "<p>Cuando conectemos los resultados del circuito vas a ver aquí cada torneo de " + esc(nombre.split(" ")[0]) + ": en qué ronda quedó, con quién jugó, sus rivales más frecuentes, a quién le gana y contra quién cae.</p>" +
      '<a class="btn btn--lime" href="jugador.html?id=ejemplo">Ver un perfil de ejemplo</a></div></section>';
    return;
  }

  if (!datos.partidos || !datos.partidos.length) { soloHistorial(datos); return; }

  // Cálculos a partir de los partidos (el mismo código servirá con los datos reales).
  var P = datos.partidos.map(function (p, k) { p._k = k; return p; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a._k - b._k; });
  var H = datos.historial.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  var G = P.filter(function (p) { return p.gano; }).length, N = P.length;
  var setsG = 0, setsP = 0, gamesG = 0, gamesP = 0, tresSets = 0, tresSetsG = 0;
  P.forEach(function (p) {
    p.sets.forEach(function (s) { if (s[0] > s[1]) setsG++; else setsP++; gamesG += s[0]; gamesP += s[1]; });
    if (p.sets.length === 3) { tresSets++; if (p.gano) tresSetsG++; }
  });
  var racha = 0, rachaTipo = P.length ? P[P.length - 1].gano : null;
  for (var x = P.length - 1; x >= 0 && P[x].gano === rachaTipo; x--) racha++;
  var titulos = H.filter(function (h) { return h.resultado === "Campeón"; }).length;
  var finales = H.filter(function (h) { return h.resultado === "Campeón" || h.resultado === "Final"; }).length;

  // Rivales individuales
  var riv = {};
  P.forEach(function (p) {
    p.rivales.forEach(function (n) {
      var o = riv[n] || (riv[n] = { n: n, g: 0, p: 0 });
      if (p.gano) o.g++; else o.p++;
    });
  });
  var rivs = Object.keys(riv).map(function (k) { return riv[k]; });
  var frecuentes = rivs.slice().sort(function (a, b) { return (b.g + b.p) - (a.g + a.p) || b.g - a.g; }).slice(0, 6);
  var dominados = rivs.filter(function (o) { return o.p === 0 && o.g >= 2; }).sort(function (a, b) { return b.g - a.g; }).slice(0, 4);
  var bestias = rivs.filter(function (o) { return o.p >= 2 && o.p >= o.g; }).sort(function (a, b) { return b.p - a.p || a.g - b.g; }).slice(0, 4);
  var eliminaciones = P.filter(function (p) { return !p.gano && p.ronda !== "Grupos"; }).reverse();
  var verdugos = {};
  eliminaciones.forEach(function (p) { var k = p.rivales.join(" / "); (verdugos[k] = verdugos[k] || []).push(p); });
  var verdugosL = Object.keys(verdugos).map(function (k) { return { pareja: k, veces: verdugos[k] }; }).sort(function (a, b) { return b.veces.length - a.veces.length; }).slice(0, 4);

  // Parejas
  var par = {};
  H.forEach(function (h) { var o = par[h.pareja] || (par[h.pareja] = { n: h.pareja, t: 0, g: 0, p: 0, pts: 0, mejor: "Grupos" }); o.t++; o.pts += h.puntos; if (ORDEN_RES[h.resultado] > ORDEN_RES[o.mejor]) o.mejor = h.resultado; });
  P.forEach(function (p) { var o = par[p.pareja]; if (o) { if (p.gano) o.g++; else o.p++; } });
  var parejas = Object.keys(par).map(function (k) { return par[k]; }).sort(function (a, b) { return b.t - a.t; });

  // Por ronda
  var porRonda = RONDAS.map(function (rd) {
    var m = P.filter(function (p) { return p.ronda === rd; });
    return { r: rd, g: m.filter(function (p) { return p.gano; }).length, p: m.filter(function (p) { return !p.gano; }).length };
  }).filter(function (o) { return o.g + o.p; });

  function recPill(o) { return '<span class="rec"><span class="rec__g">' + o.g + ' G</span><span class="rec__p">' + o.p + " P</span></span>"; }
  function split(g, p) {
    var t = g + p || 1;
    return '<span class="split" aria-hidden="true"><span class="split__g" style="flex:' + g / t + '"></span><span class="split__p" style="flex:' + p / t + '"></span></span>';
  }
  function rivalList(arr, vacio) {
    if (!arr.length) return '<p class="pf-none">' + vacio + "</p>";
    return '<ol class="riv">' + arr.map(function (o) {
      return '<li><span class="riv__n">' + esc(o.n) + "</span>" + split(o.g, o.p) + recPill(o) + "</li>";
    }).join("") + "</ol>";
  }

  var tiles = [
    ["Partidos", N, G + " ganados · " + (N - G) + " perdidos"],
    ["Efectividad", pct.format(G / N), "de partidos ganados"],
    ["Sets ganados", pct.format(setsG / (setsG + setsP)), setsG + " de " + (setsG + setsP)],
    ["Games ganados", pct.format(gamesG / (gamesG + gamesP)), miles.format(gamesG) + " de " + miles.format(gamesG + gamesP)],
    ["En tercer set", tresSets ? pct.format(tresSetsG / tresSets) : "-", tresSetsG + " de " + tresSets + " ganados"],
    ["Títulos", titulos, finales + (finales === 1 ? " final jugada" : " finales jugadas")],
    ["Racha actual", racha, racha ? (rachaTipo ? "victorias seguidas" : "derrotas seguidas") : "sin partidos"]
  ];

  cuerpo.innerHTML =
    '<section class="pf-sec wrap" aria-labelledby="t-rend"><h2 class="pf-h" id="t-rend">Rendimiento</h2>' +
      '<dl class="tiles">' + tiles.map(function (t) { return "<div><dt>" + t[0] + "</dt><dd>" + t[1] + "</dd><span>" + t[2] + "</span></div>"; }).join("") + "</dl></section>" +

    '<section class="pf-sec wrap pf-grid" aria-labelledby="t-pts">' +
      '<div class="pf-card pf-card--wide"><h2 class="pf-h" id="t-pts">Puntos por torneo</h2><div class="chart" data-chart></div><p class="pf-note">Toca o pasa el cursor sobre una barra para ver el torneo. La tabla de historial abajo tiene los mismos datos.</p></div>' +
      '<div class="pf-card"><h2 class="pf-h">Por ronda</h2><ol class="riv riv--rondas">' + porRonda.map(function (o) {
        return '<li><span class="riv__n">' + (o.r === "Grupos" ? "Fase de grupos" : o.r) + "</span>" + split(o.g, o.p) + recPill(o) + "</li>";
      }).join("") + "</ol></div>" +
    "</section>" +

    '<section class="pf-sec wrap" aria-labelledby="t-riv"><h2 class="pf-h" id="t-riv">Rivales</h2><div class="pf-grid pf-grid--3">' +
      '<div class="pf-card"><h3 class="pf-h3">Más frecuentes</h3>' + rivalList(frecuentes, "Aún sin rivales repetidos.") + "</div>" +
      '<div class="pf-card"><h3 class="pf-h3">Siempre les gana</h3>' + rivalList(dominados, "Todavía no hay un rival al que le haya ganado siempre en dos partidos o más.") + "</div>" +
      '<div class="pf-card"><h3 class="pf-h3">Le cuestan más</h3>' + rivalList(bestias, "Ningún rival le ha ganado dos veces o más.") + "</div>" +
    "</div>" +
    '<div class="pf-card pf-elim"><h3 class="pf-h3">Quién lo ha eliminado</h3>' + (verdugosL.length ? '<ol class="elim">' + verdugosL.map(function (v) {
      return '<li><span class="elim__pair">' + esc(v.pareja) + '</span><span class="elim__n">' + v.veces.length + (v.veces.length === 1 ? " vez" : " veces") + '</span><span class="elim__where">' + v.veces.map(function (p) { return esc(p.torneo) + " (" + p.ronda.toLowerCase() + ")"; }).join(", ") + "</span></li>";
    }).join("") + "</ol>" : '<p class="pf-none">Nunca lo han eliminado en cuadro final.</p>') + "</div></section>" +

    '<section class="pf-sec wrap" aria-labelledby="t-par"><h2 class="pf-h" id="t-par">Parejas</h2><div class="pf-grid pf-grid--3">' + parejas.map(function (o) {
      return '<div class="pf-card mate"><span class="mate__n">' + esc(o.n) + '</span><span class="mate__meta">' + o.t + (o.t === 1 ? " torneo" : " torneos") + " · " + miles.format(o.pts) + " puntos · mejor: " + NOMBRE_RES[o.mejor].toLowerCase() + "</span>" + split(o.g, o.p) + recPill(o) + "</div>";
    }).join("") + "</div></section>" +

    '<section class="pf-sec wrap" aria-labelledby="t-his"><h2 class="pf-h" id="t-his">Historial de torneos</h2><div class="hist" role="table" aria-label="Historial de torneos">' +
      '<div class="hist__row hist__row--head" role="row"><span role="columnheader">Fecha</span><span role="columnheader">Torneo</span><span role="columnheader">Pareja</span><span role="columnheader">Resultado</span><span role="columnheader" class="num">Puntos</span></div>' +
      H.slice().reverse().map(function (h) {
        var cls = h.resultado === "Campeón" ? " res--win" : h.resultado === "Final" ? " res--final" : "";
        return '<div class="hist__row" role="row"><span role="cell" class="hist__date">' + fecha(h.fecha) + '</span><span role="cell" class="hist__t">' + esc(h.torneo) + '<small>' + h.tipo + " · " + h.categoria + '</small></span><span role="cell">' + esc(h.pareja) + '</span><span role="cell"><span class="res' + cls + '">' + (h.resultado === "Campeón" ? '<i class="ph-bold ph-trophy" aria-hidden="true"></i>' : "") + NOMBRE_RES[h.resultado] + '</span></span><span role="cell" class="num hist__pts">' + miles.format(h.puntos) + "</span></div>";
      }).join("") + "</div></section>" +

    '<section class="pf-sec wrap" aria-labelledby="t-mat"><h2 class="pf-h" id="t-mat">Últimos partidos</h2><ol class="mlist">' +
      P.slice(-10).reverse().map(function (p) {
        return '<li class="mlist__i"><span class="wl ' + (p.gano ? "wl--g" : "wl--p") + '">' + (p.gano ? "G" : "P") + '<span class="sr">' + (p.gano ? " ganado" : " perdido") + "</span></span>" +
          '<span class="mlist__who"><span class="mlist__vs">con ' + esc(p.pareja) + " vs " + esc(p.rivales.join(" / ")) + '</span><small>' + esc(p.torneo) + " · " + p.ronda + " · " + fecha(p.fecha) + "</small></span>" +
          '<span class="mlist__sets">' + p.sets.map(function (s) { return '<span class="' + (s[0] > s[1] ? "is-won" : "") + '">' + s[0] + "-" + s[1] + "</span>"; }).join("") + "</span></li>";
      }).join("") + "</ol></section>";

  chart(H);


  // Jugadores reales: historial por torneo (sin parejas ni partidos en la fuente).
  function soloHistorial(d) {
    var H = d.historial.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    var hoy = new Date().toISOString().slice(0, 10);
    var en60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
    var cuenta = function (rs) { return H.filter(function (h) { return rs.indexOf(h.resultado) !== -1; }).length; };
    var conRonda = H.filter(function (h) { return h.resultado !== "Sin registro"; });
    var vencen = H.filter(function (h) { return h.vence >= hoy && h.vence <= en60; });
    var ptsVencen = vencen.reduce(function (s, h) { return s + h.puntos; }, 0);
    var top = H.slice().sort(function (a, b) { return b.puntos - a.puntos; })[0];
    var tiles = [
      ["Torneos", H.length, "en la temporada"],
      ["Títulos", cuenta(["Campeón"]), "campeón del torneo"],
      ["Finales", cuenta(["Campeón", "Final"]), "jugadas"],
      ["Semifinales o más", cuenta(["Campeón", "Final", "Semifinal"]), "de " + conRonda.length + " con ronda registrada"],
      ["Mejor torneo", top ? miles.format(top.puntos) : "-", top ? top.torneo : ""],
      ["Puntos por vencer", miles.format(ptsVencen), vencen.length ? "en los próximos 60 días" : "ninguno en 60 días"]
    ];
    var rondas = ["Campeón", "Final", "Semifinal", "Cuartos", "Octavos", "16avos", "Grupos"].map(function (rd) { return { r: rd, n: cuenta([rd]) }; }).filter(function (o) { return o.n; });
    var maxR = Math.max.apply(null, rondas.map(function (o) { return o.n; }).concat([1]));
    cuerpo.innerHTML =
      '<section class="pf-sec wrap" aria-labelledby="t-rend"><h2 class="pf-h" id="t-rend">Temporada</h2>' +
        '<dl class="tiles tiles--6">' + tiles.map(function (t) { return "<div><dt>" + t[0] + "</dt><dd>" + t[1] + "</dd><span>" + esc(t[2]) + "</span></div>"; }).join("") + "</dl>" +
        '<p class="pf-note">' + esc(d.fuente) + ". La fuente no publica parejas ni partidos.</p></section>" +
      '<section class="pf-sec wrap pf-grid" aria-labelledby="t-pts">' +
        '<div class="pf-card pf-card--wide"><h2 class="pf-h" id="t-pts">Puntos por torneo</h2><div class="chart" data-chart></div><p class="pf-note">Toca o pasa el cursor sobre una barra para ver el torneo. En lima, los títulos.</p></div>' +
        '<div class="pf-card"><h2 class="pf-h">Hasta dónde llegó</h2>' + (rondas.length ? '<ol class="riv riv--rondas">' + rondas.map(function (o) {
          return '<li><span class="riv__n">' + NOMBRE_RES[o.r] + '</span><span class="split" aria-hidden="true"><span class="split__g" style="flex:' + (o.n / maxR).toFixed(3) + ';border-radius:4px"></span><span style="flex:' + (1 - o.n / maxR).toFixed(3) + '"></span></span><span class="rec"><span class="rec__g">' + o.n + (o.n === 1 ? " torneo" : " torneos") + "</span></span></li>";
        }).join("") + "</ol>" : '<p class="pf-none">Sus torneos no tienen ronda registrada en la fuente.</p>') + (H.length - conRonda.length ? '<p class="pf-note">' + (H.length - conRonda.length) + " de " + H.length + " torneos sin ronda registrada.</p>" : "") + "</div>" +
      "</section>" +
      '<section class="pf-sec wrap" aria-labelledby="t-his"><h2 class="pf-h" id="t-his">Historial de torneos</h2><div class="hist hist--nopair" role="table" aria-label="Historial de torneos">' +
        '<div class="hist__row hist__row--head" role="row"><span role="columnheader">Fecha</span><span role="columnheader">Torneo</span><span role="columnheader">Puntos vencen</span><span role="columnheader">Resultado</span><span role="columnheader" class="num">Puntos</span></div>' +
        H.slice().reverse().map(function (h) {
          var cls = h.resultado === "Campeón" ? " res--win" : h.resultado === "Final" ? " res--final" : h.resultado === "Sin registro" ? " res--na" : "";
          return '<div class="hist__row" role="row"><span role="cell" class="hist__date">' + fecha(h.fecha) + '</span><span role="cell" class="hist__t">' + esc(h.torneo) + "<small>" + h.tipo + '</small></span><span role="cell" class="hist__date">' + (h.vence ? fecha(h.vence) : "-") + '</span><span role="cell"><span class="res' + cls + '">' + (h.resultado === "Campeón" ? '<i class="ph-bold ph-trophy" aria-hidden="true"></i>' : "") + NOMBRE_RES[h.resultado] + '</span></span><span role="cell" class="num hist__pts">' + miles.format(h.puntos) + "</span></div>";
        }).join("") + "</div></section>" +
      '<section class="pf-sec wrap"><div class="pf-card pf-soon"><h2 class="pf-h3">Rivales, parejas y efectividad</h2><p>Se activan cuando el circuito registre sus partidos en CourtBit: con quién jugó cada torneo, contra quién se enfrenta más, a quién le gana y quién lo elimina.</p><a class="ex-link" href="jugador.html?id=ejemplo"><i class="ph-bold ph-user-focus" aria-hidden="true"></i>Ver cómo se ve un perfil completo</a></div></section>';
    chart(H);
  }

  // Gráfica de barras: una serie (puntos por torneo), barras con extremo redondeado y tooltip.
  function chart(h) {
    var box = $("[data-chart]"), tip = $("[data-tip]");
    var W = 720, Hh = 260, padL = 40, padB = 28, padT = 16;
    var max = Math.max.apply(null, h.map(function (x) { return x.puntos; }));
    var top = Math.ceil(max / 500) * 500;
    var bw = (W - padL - 8) / h.length, gap = Math.max(4, bw * 0.28);
    var y = function (v) { return padT + (Hh - padT - padB) * (1 - v / top); };
    var grid = [0, top / 2, top].map(function (v) {
      return '<line x1="' + padL + '" x2="' + W + '" y1="' + y(v) + '" y2="' + y(v) + '" class="ch-grid"/><text x="' + (padL - 8) + '" y="' + (y(v) + 4) + '" class="ch-ax" text-anchor="end">' + miles.format(v) + "</text>";
    }).join("");
    var bars = h.map(function (x, k) {
      var x0 = padL + k * bw + gap / 2, w = bw - gap, yy = y(x.puntos), hh = Hh - padB - yy;
      var rr = Math.min(4, w / 2, hh);
      var d = "M" + x0 + "," + (Hh - padB) + "V" + (yy + rr) + "Q" + x0 + "," + yy + " " + (x0 + rr) + "," + yy + "H" + (x0 + w - rr) + "Q" + (x0 + w) + "," + yy + " " + (x0 + w) + "," + (yy + rr) + "V" + (Hh - padB) + "Z";
      var label = x.resultado === "Campeón" ? '<text x="' + (x0 + w / 2) + '" y="' + (yy - 6) + '" class="ch-val" text-anchor="middle">' + miles.format(x.puntos) + "</text>" : "";
      var mes = x.fecha.split("-"), etq = (+mes[2]) + " " + MES3[+mes[1] - 1];
      return '<g class="ch-bar' + (x.resultado === "Campeón" ? " is-top" : "") + '" data-k="' + k + '" tabindex="0" role="img" aria-label="' + esc(x.torneo) + ": " + miles.format(x.puntos) + " puntos, " + NOMBRE_RES[x.resultado] + '">' +
        '<rect x="' + (padL + k * bw) + '" y="' + padT + '" width="' + bw + '" height="' + (Hh - padT - padB) + '" class="ch-hit"/>' +
        '<path d="' + d + '"/>' + label +
        '<text x="' + (x0 + w / 2) + '" y="' + (Hh - 8) + '" class="ch-ax" text-anchor="middle">' + etq + "</text></g>";
    }).join("");
    box.innerHTML = '<svg viewBox="0 0 ' + W + " " + Hh + '" class="ch" aria-label="Puntos por torneo en la temporada">' + grid + '<line x1="' + padL + '" x2="' + W + '" y1="' + (Hh - padB) + '" y2="' + (Hh - padB) + '" class="ch-base"/>' + bars + "</svg>";
    function show(g) {
      var x = h[+g.dataset.k], rc = g.querySelector("path").getBoundingClientRect();
      tip.innerHTML = "<strong>" + esc(x.torneo) + "</strong><span>" + fecha(x.fecha) + " · " + x.tipo + "</span><span>" + NOMBRE_RES[x.resultado] + (x.pareja ? " con " + esc(x.pareja) : "") + "</span><b>" + miles.format(x.puntos) + " puntos</b>";
      tip.hidden = false;
      var tw = tip.offsetWidth, left = Math.min(Math.max(8, rc.left + rc.width / 2 - tw / 2), window.innerWidth - tw - 8);
      tip.style.left = left + "px"; tip.style.top = (rc.top + window.scrollY - tip.offsetHeight - 10) + "px";
      box.querySelectorAll(".ch-bar").forEach(function (b) { b.classList.toggle("is-dim", b !== g); });
    }
    function hide() { tip.hidden = true; box.querySelectorAll(".ch-bar").forEach(function (b) { b.classList.remove("is-dim"); }); }
    box.querySelectorAll(".ch-bar").forEach(function (g) {
      g.addEventListener("mouseenter", function () { show(g); });
      g.addEventListener("focus", function () { show(g); });
      g.addEventListener("click", function () { show(g); });
      g.addEventListener("mouseleave", hide);
      g.addEventListener("blur", hide);
    });
  }
})();
