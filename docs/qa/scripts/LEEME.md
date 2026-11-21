# Scripts de la sesión de pruebas (21-11-2026)

Solo para repetir lo que cuenta `docs/qa/informe-2026-11-21.md`; no forman parte de la app ni de `npm test`.

- Requisitos: `npm ci` hecho y un Chromium de Playwright (por defecto `/opt/pw-browsers/chromium-1243/...`; cámbialo con `PW_CHROMIUM=/ruta`).
- Servidor local desde la raíz del repo: `python3 -m http.server 8795`. Cada script se lanza con `node docs/qa/scripts/<script>.mjs [móvil]` (`m360`, `m390`, `m412`).
- Las capturas van a `docs/qa/capturas/` (se sobrescriben).
- `99-verificacion.mjs` repite, de forma independiente, cada error del informe e imprime `REPRODUCIDO` o `NO`.
- `11-sin-red-y-version.mjs` necesita una copia de la app servida en el puerto 8796: `BASE=http://127.0.0.1:8796/ COPIA=/ruta/de/la/copia node ...` (cambia un CSS de esa copia y recalcula su versión; no toca el repo).
- `20-vista-previa.mjs` abre la vista previa de Vercel a través del proxy del entorno: `BASE=<url de la vista previa> ENLACE=<enlace para compartir> node ... carga|codigo|plan|sesion`. Los pasos `plan` y `sesion` hacen **una llamada real a la IA cada uno** (gasto).
