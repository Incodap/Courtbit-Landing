// Datos del circuito. Mientras DEMO sea true, el sitio marca ranking, resultados y precios
// como datos de ejemplo. Cuando el circuito esté dado de alta en CourtBit, estos datos
// se reemplazan por llamadas a la API (ver README).
window.OMA = {
  DEMO: true,
  temporada: 2027,
  actualizado: "2027-02-14T21:40:00-06:00",

  etapas: [
    { id: "mty", n: 1, ciudad: "Monterrey", estado: "Nuevo León", inicio: "2027-02-12", fin: "2027-02-15", cierre: "2027-02-05", estatus: "abiertas", foto: "assets/img/sede.jpg" },
    { id: "hmo", n: 2, ciudad: "Hermosillo", estado: "Sonora", inicio: "2027-03-19", fin: "2027-03-22", cierre: "2027-03-12", estatus: "proximamente" },
    { id: "gdl", n: 3, ciudad: "Guadalajara", estado: "Jalisco", inicio: "2027-04-23", fin: "2027-04-26", cierre: "2027-04-16", estatus: "proximamente" },
    { id: "cdmx", n: 4, ciudad: "Ciudad de México", corto: "CDMX", estado: "Ciudad de México", inicio: "2027-05-28", fin: "2027-05-31", cierre: "2027-05-21", estatus: "proximamente" },
    { id: "mid", n: 5, ciudad: "Mérida", estado: "Yucatán", inicio: "2027-06-25", fin: "2027-06-28", cierre: "2027-06-18", estatus: "proximamente" },
    { id: "qro", n: 6, ciudad: "Querétaro", estado: "Querétaro", inicio: "2027-09-17", fin: "2027-09-20", cierre: "2027-09-10", estatus: "proximamente" },
    { id: "master", n: 7, ciudad: "Master Final", estado: "Sede por anunciar", inicio: "2027-11-19", fin: "2027-11-22", cierre: null, estatus: "clasificacion", master: true }
  ],

  categorias: [
    { id: "v1", rama: "Varonil", nombre: "Primera", nivel: "Avanzado competitivo" },
    { id: "v2", rama: "Varonil", nombre: "Segunda", nivel: "Avanzado" },
    { id: "v3", rama: "Varonil", nombre: "Tercera", nivel: "Intermedio" },
    { id: "v4", rama: "Varonil", nombre: "Cuarta", nivel: "Inicial competitivo" },
    { id: "f1", rama: "Femenil", nombre: "Primera", nivel: "Avanzado competitivo" },
    { id: "f2", rama: "Femenil", nombre: "Segunda", nivel: "Avanzado" },
    { id: "f3", rama: "Femenil", nombre: "Tercera", nivel: "Intermedio" },
    { id: "f4", rama: "Femenil", nombre: "Cuarta", nivel: "Inicial competitivo" }
  ],

  // Precio por pareja, en pesos. Pendiente de confirmar con la organización.
  precioPareja: 1900,
  comisionPago: 0,

  // Puntos por ronda alcanzada en una etapa regular. La Master Final da el doble.
  puntos: [
    { ronda: "Campeón", pts: 1000 },
    { ronda: "Finalista", pts: 600 },
    { ronda: "Semifinal", pts: 360 },
    { ronda: "Cuartos de final", pts: 180 },
    { ronda: "Octavos de final", pts: 90 },
    { ronda: "Fase de grupos", pts: 45 }
  ],

  // Vista "después": campeones de ejemplo hasta tener resultados reales.
  campeones: [
    { cat: "Varonil Primera", pareja: "Treviño / Salazar" },
    { cat: "Femenil Primera", pareja: "Sandoval / Robles" }
  ],

  // Orden de juego de la etapa en curso (vista "durante").
  partidos: [
    { hora: "17:00", cancha: "Central", cat: "Varonil Primera", ronda: "Semifinal", p1: "Treviño / Salazar", p2: "Villarreal / Cantú", sets: [[6, 4], [3, 6], [5, 3]], estado: "en-juego" },
    { hora: "17:00", cancha: "Cancha 2", cat: "Femenil Primera", ronda: "Semifinal", p1: "Sandoval / Robles", p2: "Castañeda / Urías", sets: [[6, 2], [6, 3]], estado: "final", ganador: 1 },
    { hora: "18:30", cancha: "Central", cat: "Femenil Primera", ronda: "Semifinal", p1: "Lozano / Fierro", p2: "Cárdenas / Leyva", sets: [], estado: "programado" },
    { hora: "18:30", cancha: "Cancha 2", cat: "Varonil Segunda", ronda: "Final", p1: "Navarrete / Solís", p2: "Aguirre / Beltrán", sets: [], estado: "programado", cambio: "Antes 18:00" },
    { hora: "20:00", cancha: "Central", cat: "Varonil Primera", ronda: "Semifinal", p1: "Garza / Quintero", p2: "Montaño / Arreola", sets: [], estado: "programado" }
  ],

  noticias: [
    { fecha: "2027-01-20", titulo: "Monterrey abre la temporada 2027", resumen: "Ocho categorías, cuatro días de competencia y los primeros puntos del ranking nacional.", url: "#categorias", foto: "assets/img/sede.jpg" },
    { fecha: "2027-01-12", titulo: "Así se reparten los puntos del circuito", resumen: "Cada ronda suma. La tabla completa y cómo cuenta la Master Final.", url: "#circuito", foto: "assets/img/accion-varonil.jpg" },
    { fecha: "2027-01-05", titulo: "Inscripción por pareja, pago en línea", resumen: "Registra a tu pareja, elige categoría y recibe tu confirmación al momento.", url: "inscripcion.html", foto: "assets/img/accion-femenil.jpg" }
  ]
};
