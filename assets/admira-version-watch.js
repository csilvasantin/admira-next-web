/* admira-version-watch.js — contexto de release y aviso de versión nueva.
 *
 * Cada fuente se compara CONSIGO MISMA durante la vida de la pestaña. Nunca se
 * enfrenta el meta del HTML con /version.json: se conservan así las garantías
 * del aviso original, sin falsos positivos cuando dos vías de publicación no
 * avanzan a la vez.
 *
 * /version.json es la fuente canónica de producto. El meta de la página sólo se
 * usa como contexto local si el manifiesto no está disponible; no se inventan
 * releases ni se usa ese fallback para decidir si hay una actualización.
 */
(function () {
  "use strict";

  // UNA sola instancia por pestaña, pase lo que pase.
  //
  // `panel` es una variable de closure: si el script se evalúa dos veces -dos
  // <script> con distinto ?build=, una reinyección, una pestaña abierta desde
  // antes del último cachebuster- se montan DOS paneles que no se conocen. El
  // 8-ago-2026 Carlos vio justo eso: uno tomó su referencia con la r6 y decía
  // "versión nueva", el otro la tomó ya con la r7 y decía "versión vigente".
  // Dos avisos contradictorios a la vez, y ningún botón podía resolver al otro
  // porque cada instancia sólo conoce el suyo. Por eso "Comprobar" parecía no
  // hacer nada: funcionaba, pero sobre el panel equivocado.
  if (window.AdmiraVersionWatch) return;

  var SRC = (document.currentScript && document.currentScript.src) || "";
  var referencia = null, referenciaTomada = false;
  var huellaRef = null, panel = null, accion = null, comprobando = false, confirmando = false;

  function texto(valor) {
    return valor === undefined || valor === null ? "" : String(valor).trim();
  }

  function versionMeta() {
    var meta = document.querySelector('meta[name="admiranext-version"]');
    var contenido = meta && texto(meta.getAttribute("content"));
    var encontrada = contenido && contenido.match(/v\.\d{2}\.\d{2}\.\d{4}\.r\d+\.\d{2}:\d{2}/);
    return encontrada ? encontrada[0] : null;
  }

  function datosManifest(d) {
    var v = texto(d && (d.version || d.sello));
    return {
      version: v || null,
      deployedAt: texto(d && d.deployedAt) || null,
      git: texto(d && (d.gitShort || d.git || d.gitFull)) || null,
      firma: firmaDe(d),
      declared: Boolean(v)
    };
  }

  // Una versión sin responsable visible es una versión descontrolada: dice QUÉ
  // corre pero no QUIÉN lo puso ahí, que es lo primero que hace falta saber
  // cuando algo sale mal. El dato ya viajaba en version.json desde el 3-ago
  // -deployer + machine, y signature ya compuesta-; sólo faltaba pintarlo.
  // Los sellos antiguos no lo traen, así que se dice y no se inventa.
  function firmaDe(d) {
    if (!d) return null;
    var s = texto(d.signature);
    if (s) return s;
    var quien = texto(d.deployer), donde = texto(d.machine);
    if (quien && donde) return quien + " · " + donde;
    return quien || donde || null;
  }

  function fechaHumana(valor) {
    if (!valor) return "fecha de publicación no declarada";
    var fecha = new Date(valor);
    if (isNaN(fecha.getTime())) return "fecha de publicación no válida";
    return "publicada " + new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid"
    }).format(fecha);
  }

  function nodo(tag, clase, contenido) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (contenido !== undefined) n.textContent = contenido;
    return n;
  }

  function aseguraPanel() {
    if (panel) return;
    // La guardia global no basta contra una instancia ANTIGUA: la versión previa
    // del verificador no la lleva, así que si se carga después seguiría creando
    // su panel. Se adopta el que ya exista en el DOM en vez de apilar otro: dos
    // tarjetas contradictorias es peor que una tarjeta de una versión vieja.
    var previo = document.querySelector(".admira-version");
    if (previo) {
      panel = previo;
      accion = previo.querySelector(".admira-version__action");
      if (accion && !accion.avBound) {
        accion.avBound = true;
        accion.addEventListener("click", function () {
          if (panel.getAttribute("data-state") === "stale") location.reload();
          else ronda(true);
        });
      }
      return;
    }
    var css = document.createElement("style");
    css.textContent =
      ".admira-version{--av-accent:#74e6d0;position:fixed;right:14px;bottom:14px;z-index:2147483000;" +
      "width:min(360px,calc(100vw - 28px));box-sizing:border-box;padding:12px;border:1px solid rgba(116,230,208,.32);" +
      "border-radius:12px;background:rgba(8,17,27,.96);color:#eef7f5;box-shadow:0 12px 34px rgba(0,0,0,.42);" +
      "font:500 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;backdrop-filter:blur(14px)}" +
      ".admira-version[data-state=stale]{--av-accent:#ffb454;border-color:rgba(255,180,84,.52)}" +
      ".admira-version[data-state=undeclared]{--av-accent:#d7b7ff;border-color:rgba(215,183,255,.42)}" +
      ".admira-version[data-state=unavailable]{--av-accent:#aab5c1;border-color:rgba(170,181,193,.34)}" +
      ".admira-version__top{display:flex;align-items:center;justify-content:space-between;gap:12px}" +
      ".admira-version__eyebrow{color:var(--av-accent);font:750 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;" +
      "letter-spacing:.09em;text-transform:uppercase}" +
      ".admira-version__action{flex:none;border:1px solid color-mix(in srgb,var(--av-accent) 58%,transparent);border-radius:7px;" +
      "padding:6px 8px;background:color-mix(in srgb,var(--av-accent) 12%,transparent);color:var(--av-accent);cursor:pointer;" +
      "font:750 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;text-transform:uppercase}" +
      ".admira-version__action:hover{filter:brightness(1.16)}.admira-version__action:focus-visible{outline:2px solid var(--av-accent);outline-offset:2px}" +
      ".admira-version__action:disabled{cursor:wait;opacity:.65}" +
      ".admira-version__grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}" +
      ".admira-version[data-state=stale] .admira-version__grid{grid-template-columns:1fr 1fr}" +
      ".admira-version__release{min-width:0;padding:9px;border-radius:8px;background:rgba(255,255,255,.055)}" +
      ".admira-version__label{display:block;margin-bottom:3px;color:#93a5b5;font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;" +
      "letter-spacing:.08em;text-transform:uppercase}" +
      ".admira-version__number{display:block;overflow-wrap:anywhere;color:#fff;font:760 13px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace}" +
      ".admira-version__date{display:block;margin-top:4px;color:#b6c2ca;font-size:10px}" +
      ".admira-version__by{display:block;margin-top:3px;overflow-wrap:anywhere;color:var(--av-accent);" +
      "font:700 10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace}" +
      ".admira-version__guidance{margin:9px 2px 0;color:#c9d3d9;font-size:11px}" +
      ".admira-version__tech{margin-top:8px;color:#8fa0ac;font:500 10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}" +
      ".admira-version__tech summary{cursor:pointer;color:#9eacb6}.admira-version__tech p{margin:5px 0 0;overflow-wrap:anywhere}" +
      "@media(max-width:430px){.admira-version[data-state=stale] .admira-version__grid{grid-template-columns:1fr}}" +
      "@media(prefers-reduced-motion:reduce){.admira-version *{scroll-behavior:auto!important}}";
    document.head.appendChild(css);

    panel = nodo("section", "admira-version");
    panel.setAttribute("aria-live", "polite");
    panel.setAttribute("aria-label", "Estado de versión de AdmiraNeXT");
    var top = nodo("div", "admira-version__top");
    top.appendChild(nodo("span", "admira-version__eyebrow"));
    accion = nodo("button", "admira-version__action", "Comprobar");
    accion.type = "button";
    accion.avBound = true;
    accion.addEventListener("click", function () {
      if (panel.getAttribute("data-state") === "stale") location.reload();
      else ronda(true);
    });
    top.appendChild(accion);
    panel.appendChild(top);
    panel.appendChild(nodo("div", "admira-version__grid"));
    panel.appendChild(nodo("p", "admira-version__guidance"));
    var details = nodo("details", "admira-version__tech");
    details.appendChild(nodo("summary", "", "Trazabilidad técnica"));
    details.appendChild(nodo("p"));
    panel.appendChild(details);
    document.body.appendChild(panel);
  }

  function bloque(etiqueta, datos) {
    var b = nodo("div", "admira-version__release");
    b.appendChild(nodo("span", "admira-version__label", etiqueta));
    b.appendChild(nodo("strong", "admira-version__number", datos.version || "versión no declarada"));
    b.appendChild(nodo("span", "admira-version__date", fechaHumana(datos.deployedAt)));
    b.appendChild(nodo("span", "admira-version__by",
      datos.firma ? "por " + datos.firma : "responsable no declarado"));
    return b;
  }

  function pinta(estado, actual, disponible, nota) {
    aseguraPanel();
    panel.setAttribute("data-state", estado);
    var titulos = {
      current: "Versión vigente",
      stale: "⟳ Versión nueva · recargar",
      undeclared: "Versión no declarada",
      unavailable: "Verificación no disponible"
    };
    panel.children[0].children[0].textContent = titulos[estado];
    accion.textContent = estado === "stale" ? "Recargar" : "Comprobar";
    var grid = panel.children[1];
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    grid.appendChild(bloque(estado === "stale" ? "En esta pestaña" : "Producto / release", actual));
    if (estado === "stale") grid.appendChild(bloque("Disponible", disponible));
    var orientacion = panel.children[2];
    orientacion.textContent = nota || "";
    orientacion.hidden = !nota;
    var hashes = [];
    hashes.push("esta pestaña: " + (actual.git || "trazabilidad técnica no declarada") +
      " · firma: " + (actual.firma || "sin firmar"));
    if (estado === "stale") hashes.push("disponible: " + (disponible.git || "trazabilidad técnica no declarada") +
      " · firma: " + (disponible.firma || "sin firmar"));
    panel.children[3].children[1].textContent = hashes.join(" · ");
  }

  function consultaManifest() {
    return fetch("/version.json?vw=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (r.status === 404) return { kind: "undeclared", data: datosManifest(null) };
        if (!r.ok) return { kind: "unavailable" };
        return r.json().then(function (d) {
          var data = datosManifest(d);
          return { kind: data.declared ? "ok" : "undeclared", data: data };
        });
      })
      .catch(function () { return { kind: "unavailable" }; });
  }

  function consultaHuella() {
    if (!SRC) return Promise.resolve(null);
    return fetch(SRC, { method: "HEAD", cache: "no-store" })
      .then(function (r) {
        return r.ok ? (r.headers.get("etag") || r.headers.get("last-modified") || null) : null;
      })
      .catch(function () { return null; });
  }

  function contextoLocal() {
    return { version: versionMeta(), deployedAt: null, git: null };
  }

  function procesa(manifest, huella) {
    var cambioHuella = huellaRef !== null && huella && huella !== huellaRef;
    if (huellaRef === null && huella) huellaRef = huella;

    if (!referenciaTomada && manifest.kind !== "unavailable") {
      referencia = manifest.data;
      referenciaTomada = true;
    }

    if (!referenciaTomada) {
      pinta("unavailable", contextoLocal(), null,
        "No se pudo consultar el manifiesto de publicación. Reintenta antes de tomar una decisión de versión.");
      return;
    }

    var cambioVersion = manifest.kind === "ok" && referencia.version && manifest.data.version !== referencia.version;
    if (cambioVersion || cambioHuella) {
      var nueva = manifest.kind === "ok" ? manifest.data : datosManifest(null);
      if (cambioHuella && !cambioVersion && nueva.version === referencia.version) nueva.version = null;
      var mensaje = nueva.version
        ? "Hay código más reciente disponible; recarga cuando hayas guardado el trabajo en curso."
        : "Se detectó una publicación sin una nueva versión declarada. Registra la próxima publicación antes de atribuirle un release.";
      pinta("stale", referencia, nueva, mensaje);
      return;
    }

    if (manifest.kind === "undeclared") {
      pinta("undeclared", referencia, null,
        "Registra una versión de producto en el manifiesto de la próxima publicación para que el cambio sea identificable.");
      return;
    }

    pinta("current", referencia, null, "La pestaña ejecuta la release vigente según el manifiesto de publicación.");
  }

  function ronda(manual) {
    if (comprobando) return;
    comprobando = true;
    if (accion) { accion.disabled = true; accion.textContent = "Comprobando…"; }
    return Promise.all([consultaManifest(), consultaHuella()])
      .then(function (resultados) { procesa(resultados[0], resultados[1]); })
      .finally(function () {
        comprobando = false;
        if (!accion) return;
        accion.disabled = false;
        var estado = panel.getAttribute("data-state");
        if (estado === "stale") { accion.textContent = "Recargar"; return; }
        // Un botón que se pulsa y deja todo igual parece averiado, aunque haya
        // hecho su trabajo: la respuesta correcta a "¿estoy al día?" suele ser
        // "sí", y eso también hay que DECIRLO. Sólo en la pulsación manual —el
        // sondeo automático cada 2 min no debe parpadear solo.
        // El sondeo automático corre cada 2 min y al volver a la pestaña: sin
        // esta marca borraba el "Al día ✓" a los pocos milisegundos de pulsar, y
        // el botón volvía a parecer mudo justo en el caso que se quería arreglar.
        if (manual) {
          confirmando = true;
          accion.textContent = "Al día ✓";
          setTimeout(function () {
            confirmando = false;
            if (!comprobando && panel.getAttribute("data-state") !== "stale") accion.textContent = "Comprobar";
          }, 1800);
        } else if (!confirmando) {
          accion.textContent = "Comprobar";
        }
      });
  }

  var primeraComprobacion = ronda();
  setInterval(ronda, 120000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) ronda(); });
  window.AdmiraVersionWatch = { check: ronda, ready: primeraComprobacion };
})();
