# AGENTS.md — normas para agentes en admira-next-web

## Toda novedad va primero a /pruebas (Carlos, 10-10-2026)

- Toda funcionalidad, página o rediseño nuevo de admiranext.com se publica
  **primero bajo `/pruebas/`** (por ejemplo `/pruebas/<nombre>/`), nunca
  directamente en la parte pública, y **nunca en la portada pública**
  (`index.html`, `assets/app.js`, `assets/app.css`), **salvo que Carlos diga
  otra cosa** de forma expresa y para ese cambio.
- `/pruebas` es zona con sesión: la protege `functions/pruebas/_middleware.js`
  con el mismo login del directorio de AdmiraNeXT que `/flota`, `/roadmap` o
  `/neo58` (`functions/_webmaster-gate.js`). Sin sesión responde 401 con el
  login interno; tampoco salen sus assets.
- Dentro de `/pruebas/` usa rutas absolutas (`/assets/...` para lo compartido,
  `/pruebas/...` para lo propio de la prueba) y no toques los ficheros públicos
  para que la prueba funcione.
- Pasar algo de `/pruebas` a la parte pública es un cambio aparte, que solo se
  hace cuando Carlos lo pide.

Origen: el 10-10-2026 la portada Bits and Atoms (encargo #5547, PR #148) salió
directamente a la portada pública; se revirtió y se movió a `/pruebas/`.
La norma está también en https://www.admiranext.com/normativa (norma 31).

## Sin modo Experto en los presites (Carlos, 10-10-2026 14:02)

- Los **presites** son todo lo que ve un visitante **antes de identificarse**:
  la portada y su terminal de entrada, las pantallas de login y las páginas
  públicas. En ellos **no aparece nunca el modo Experto** (ni el botón ⌘, ni
  su raíl/barra, ni la consola de la piel `suite/experto.js`).
- En el hueco de ⌘ va el **selector de idioma ES · EN** (`#ykLangPre`, del
  mismo tamaño que ⌘) para que la cabecera no se descoloque al entrar. Guarda
  el idioma en `admiranext_expert_lang` / `admiranext_lang` y avisa con
  `admira:languagechange`: tras el login sigue el mismo idioma.
- El modo Experto queda **solo para sesiones identificadas** (intranet y
  `/pruebas`). Lo aplican `assets/admira-frame.css` (esconde ⌘ y su raíl sin
  `html.admira-con-sesion`), `assets/admira-frame.js` (no abre el raíl ⌘ sin
  sesión) y `assets/experto-admiranext.js` (solo carga la piel con sesión,
  según `/api/sello`).
- El terminal de la entrada puede seguir aceptando saltos escritos (p. ej.
  `/frontier` → `/pruebas/frontier/`, que sin sesión enseña el login): eso no
  es el modo Experto. No añadas ninguna interfaz Experto antes del login.

La norma está también en https://www.admiranext.com/normativa (norma 32).

## Un único manejador de comandos de la suite (Carlos, 12-10-2026)

- Studio, Store, TV, App y Biz comparten un único motor de comandos: `suite/experto.js`, API `AdmiraExperto.exec`.
- Los comandos comunes, sus alias, ayuda, validación y errores se implementan una sola vez. No copiar parsers ni añadir interceptores por dominio para solucionar un comando compartido.
- Las funciones específicas de una aplicación se exponen como acciones registradas en el motor común; la consola y el avatar delegan en la misma entrada. MCP documenta/utiliza ese contrato, sin inventar otra gramática.
- Un único despacho debe ejecutar cada entrada una sola vez. No lanzar el comando desde un listener y volver a intentarlo en otro.
- Las rutas locales antiguas requieren migración explícita y pruebas de sus funciones antes de retirarlas. No afirmar que toda la suite está unificada por haber compartido su apariencia o un único comando.

## Generador de presentaciones desde agentes (sin sesión humana)

Usa `python3 tools/presentations-mcp.py list_presentations --out /ruta/privada/catalogo.json`.
El cliente resuelve la credencial existente de la bóveda en cada llamada, usa el MCP oficial y guarda respuestas con permisos 0600. No imprime tokens ni contraseñas de sala. `ADMIRA_PRESENTATIONS_SECRET` permite elegir la credencial autorizada de un agente; `ADMIRA_VAULT_GETTER` permite indicar su getter local. Nunca copies credenciales al repositorio, a una URL ni a informes.

Consultar el catálogo antes de crear o mejorar: un cliente = un destino existente. La presentación Alsea usa `alsea-starbucks`; no crear otro slug por ensayo o reunión. El brief y el guion comercial son privados: guardar en el generador, nunca en este repositorio público. El lanzador `/demo alsea` abre la sala; los agentes también pueden consultar y actualizar el contenido por MCP sin pedir que una persona se identifique en un navegador.

Para navegar la UI: `/presentaciones/auth/agent` canjea el MISMO token MCP de la bóveda por una sesión de una hora. No crea credenciales permanentes. POST admite Bearer (JSON) o el formulario del mismo origen (redirige a Alsea). Las cookies HttpOnly/Secure están limitadas a `/presentaciones` y `/pruebas/alsea`; no abren el resto de `/pruebas` ni `/presentaciones/control`. Cada petición vuelve a comprobar token no revocado y permiso actual de editor/owner. No copies el token a una URL, al código, a capturas ni a informes. Antes de lanzar desde otra plataforma, autenticar una vez esa entrada en el mismo navegador; el salto conserva esta sesión.
