(function () {
  "use strict";
  var D = window.OMA;
  if (!D.DEMO) document.documentElement.classList.add("no-demo");
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var peso = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  var q = new URLSearchParams(location.search);
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function fecha(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function rango(e) { var a = fecha(e.inicio), b = fecha(e.fin); return a.getDate() + "-" + b.getDate() + " " + MESES[b.getMonth()] + " " + b.getFullYear(); }

  var abiertas = D.etapas.filter(function (e) { return e.estatus === "abiertas"; });
  var estado = { etapa: abiertas.find(function (e) { return e.id === q.get("etapa"); }) || abiertas[0], cat: null, p1: "", p2: "" };
  var preCat = D.categorias.find(function (c) { return c.id === q.get("cat"); });
  if (preCat) { estado.cat = preCat; $$("input[name=rama]").forEach(function (r) { r.checked = r.value === preCat.rama; }); }

  // Resumen lateral
  function resumen() {
    var e = estado.etapa;
    $("[data-sum-kicker]").textContent = "Etapa " + e.n;
    $("[data-sum-city]").textContent = e.corto || e.ciudad;
    $("[data-sum-dates]").textContent = rango(e);
    $("[data-sum-cat]").textContent = estado.cat ? estado.cat.rama + " " + estado.cat.nombre : "Por elegir";
    $("[data-sum-pair]").textContent = estado.p1 && estado.p2 ? estado.p1 + " / " + estado.p2 : "Por registrar";
    var total = D.precioPareja + D.comisionPago;
    $("[data-sum-total]").textContent = peso.format(total);
    $("[data-pay-amount]").textContent = peso.format(total);
    var c = fecha(e.cierre);
    $("[data-sum-close]").textContent = "Inscripciones abiertas hasta el " + c.getDate() + " de " + MESES[c.getMonth()] + ". Precio por pareja.";
  }

  $("[data-etapas]").innerHTML = abiertas.map(function (e) {
    return '<option value="' + e.id + '"' + (e === estado.etapa ? " selected" : "") + ">Etapa " + e.n + " · " + e.ciudad + " · " + rango(e) + "</option>";
  }).join("") + D.etapas.filter(function (e) { return e.estatus !== "abiertas"; }).map(function (e) {
    return '<option disabled>' + (e.master ? "Master Final" : "Etapa " + e.n + " · " + e.ciudad) + " · Próximamente</option>";
  }).join("");
  $("[data-etapas]").addEventListener("change", function (ev) {
    estado.etapa = abiertas.find(function (e) { return e.id === ev.target.value; }); resumen();
  });

  function cats() {
    var rama = $("input[name=rama]:checked").value;
    if (estado.cat && estado.cat.rama !== rama) estado.cat = null;
    $("[data-cats]").innerHTML = D.categorias.filter(function (c) { return c.rama === rama; }).map(function (c) {
      return '<label class="opt"><input type="radio" name="cat" value="' + c.id + '"' + (estado.cat === c ? " checked" : "") + '><span class="opt__body"><strong>' + c.nombre + "</strong><small>" + c.nivel + "</small></span></label>";
    }).join("");
    resumen();
  }
  $$("input[name=rama]").forEach(function (r) { r.addEventListener("change", cats); });
  $("[data-cats]").addEventListener("change", function (ev) {
    estado.cat = D.categorias.find(function (c) { return c.id === ev.target.value; });
    $("#err-cat").hidden = true; resumen();
  });

  // Pasos
  var actual = 1;
  function ir(n) {
    actual = n;
    $$("[data-step]").forEach(function (s) { s.hidden = +s.dataset.step !== n; });
    $$("[data-step-dot]").forEach(function (li) {
      var k = +li.dataset.stepDot;
      li.classList.toggle("is-done", k < n);
      if (k === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    var step = $('[data-step="' + n + '"]');
    var focusable = n === 4 ? step : step.querySelector(".step__title");
    if (focusable) { focusable.setAttribute("tabindex", "-1"); focusable.focus({ preventScroll: true }); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$("[data-back]").forEach(function (b) { b.addEventListener("click", function () { ir(actual - 1); }); });

  function marca(input, ok) {
    var err = input.parentElement.querySelector(".field__error");
    input.setAttribute("aria-invalid", ok ? "false" : "true");
    if (err) { err.hidden = ok; if (!ok) { if (!err.id) err.id = input.id + "-err"; input.setAttribute("aria-describedby", err.id); } else input.removeAttribute("aria-describedby"); }
    return ok;
  }
  var reglas = {
    nombre: function (v) { return v.trim().split(/\s+/).length >= 2; },
    correo: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    tel: function (v) { return v.replace(/\D/g, "").length === 10; }
  };
  function tipo(id) { return id.split("-")[1]; }

  $('[data-step="1"]').addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!estado.cat) { $("#err-cat").hidden = false; $("[data-cats] input").focus(); return; }
    ir(2);
  });

  var form2 = $('[data-step="2"]');
  $$("input", form2).forEach(function (i) {
    if (!i.id) return;
    i.addEventListener("blur", function () { if (i.value) marca(i, reglas[tipo(i.id)](i.value)); });
  });
  form2.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var primero = null;
    $$("input[id]", form2).forEach(function (i) {
      var ok = marca(i, reglas[tipo(i.id)](i.value));
      if (!ok && !primero) primero = i;
    });
    var reg = form2.querySelector("[name=reglamento]");
    $("#err-reg").hidden = reg.checked;
    if (!reg.checked && !primero) primero = reg;
    if (primero) { primero.focus(); return; }
    estado.p1 = apellido($("#p1-nombre").value); estado.p2 = apellido($("#p2-nombre").value);
    resumen(); ir(3);
  });
  // Primer apellido: en "Rodrigo Treviño Salazar" es Treviño.
  function apellido(n) { var p = n.trim().split(/\s+/); return p.length > 1 ? p[1] : p[0]; }

  var form3 = $('[data-step="3"]');
  $$("input[name=metodo]").forEach(function (r) {
    r.addEventListener("change", function () { $("[data-card]").hidden = r.value !== "tarjeta" || !r.checked; });
  });
  $("#c-num").addEventListener("input", function (ev) {
    var d = ev.target.value.replace(/\D/g, "").slice(0, 16);
    ev.target.value = d.replace(/(.{4})/g, "$1 ").trim();
  });
  $("#c-exp").addEventListener("input", function (ev) {
    var d = ev.target.value.replace(/\D/g, "").slice(0, 4);
    ev.target.value = d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
  });
  form3.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var metodo = $("input[name=metodo]:checked").value;
    if (metodo === "tarjeta") {
      var a = marca($("#c-num"), $("#c-num").value.replace(/\D/g, "").length === 16);
      var m = /^(0[1-9]|1[0-2])\/\d\d$/.test($("#c-exp").value);
      var b = marca($("#c-exp"), m);
      var c = marca($("#c-cvv"), /^\d{3,4}$/.test($("#c-cvv").value));
      if (!a) return $("#c-num").focus(); if (!b) return $("#c-exp").focus(); if (!c) return $("#c-cvv").focus();
    }
    var btn = $("[data-pay]");
    btn.classList.add("is-busy"); btn.setAttribute("aria-disabled", "true");
    btn.firstChild.textContent = "Procesando… ";
    // Aquí va la llamada al cobro de CourtBit. En modo de prueba solo se simula.
    setTimeout(function () { exito(metodo); }, 1100);
  });

  function exito(metodo) {
    var folio = "OMA-" + estado.etapa.id.toUpperCase() + "-" + String(Math.floor(1000 + Math.random() * 9000));
    var textos = {
      tarjeta: "Tu pago quedó registrado. Enviamos la confirmación a los dos correos y te avisaremos por WhatsApp cuando salga el orden de juego.",
      oxxo: "Te enviamos la referencia de pago por correo. Tu lugar queda confirmado en cuanto pagues en tienda.",
      spei: "Te enviamos la CLABE por correo. Tu lugar queda confirmado en cuanto recibamos la transferencia."
    };
    $("[data-done-text]").textContent = textos[metodo];
    var e = estado.etapa;
    $("[data-ticket]").innerHTML = [
      ["Folio", folio, "ticket__folio"], ["Etapa", "Etapa " + e.n + " · " + e.ciudad], ["Categoría", estado.cat.rama + " " + estado.cat.nombre],
      ["Pareja", estado.p1 + " / " + estado.p2], ["Fechas", rango(e)], ["Pago", metodo === "tarjeta" ? peso.format(D.precioPareja) + " pagado" : "Pendiente de pago"]
    ].map(function (x) { return '<div class="' + (x[2] || "") + '"><dt>' + x[0] + "</dt><dd>" + x[1] + "</dd></div>"; }).join("");
    $("[data-step-dot='3']").classList.add("is-done");
    ir(4);
  }

  // Aviso al salir con datos capturados y sin confirmar.
  window.addEventListener("beforeunload", function (ev) { if (actual > 1 && actual < 4) { ev.preventDefault(); ev.returnValue = ""; } });

  cats(); resumen();
  if (preCat) $('[name=cat][value="' + preCat.id + '"]') && ($('[name=cat][value="' + preCat.id + '"]').checked = true);
})();
