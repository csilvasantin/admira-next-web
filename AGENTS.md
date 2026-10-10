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
