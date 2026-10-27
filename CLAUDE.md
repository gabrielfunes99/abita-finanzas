# Abita · Finanzas

App de finanzas internas de Abita.ai (SaaS de WhatsApp + IA, El Salvador). La usan los fundadores, Gabriel y Daniel, para llevar ingresos, gastos fijos y variables, comisiones, saldo bancario y el reparto de la utilidad.

**La base de datos es un Google Sheet.** No hay otro backend.

- Sheet: `Abita · Finanzas (base de datos)`
- ID: `1ASqsCrFTzyE49MrugAbWKQgEcgF2MsMQ3u7yj0nFC70`
- URL: https://docs.google.com/spreadsheets/d/1ASqsCrFTzyE49MrugAbWKQgEcgF2MsMQ3u7yj0nFC70/edit
- Locale en_US (las fórmulas usan coma), zona horaria America/El_Salvador, moneda USD.

## Estructura del repo

```
src/ui.html                 Fuente única de la interfaz (HTML + CSS + JS, sin framework)
src/adapters/pwa.js         call() vía fetch a la API de Apps Script + login de Google con Firebase Auth -> PWA
src/adapters/gas.js         call() vía google.script.run  -> diálogo dentro del Sheet
src/adapters/cowork.js      call() vía window.cowork.callMcpTool (conector Google Sheets) -> artifact de Claude Cowork
src/pwa/                    head.html (metas, manifest, Firebase SDK, estilos del login), config.js, manifest, sw.js, icons/
wrangler.jsonc              Cloudflare: sirve docs/ como archivos estáticos
tools/icons.py              Regenera src/pwa/icons/ desde la "A" del logo (Pillow)
build.py                    Inyecta adaptador + head en ui.html y genera las tres salidas
apps-script/Code.gs         Backend Apps Script: doGet, doPost (API), getData, saveRow, deleteRow, saveConfig
apps-script/Index.html      GENERADO por build.py (no editar a mano)
apps-script/appsscript.json Manifest (web app: ejecutar como yo, acceso anónimo; la API valida el token)
docs/                       GENERADO por build.py: la PWA que publica Cloudflare
dist/cowork-dashboard.html  GENERADO por build.py (artifact "abita-finanzas" en Cowork)
tests/test_dash.js          Prueba con Puppeteer y un Sheet simulado que replica las fórmulas
```

**Regla:** los cambios de UI se hacen en `src/ui.html`, después se corre `python build.py`. No edites los HTML generados ni `docs/`.

`ui.html` tiene dos marcadores que reemplaza build.py: `<!--CHARTJS-->` en el `<head>` y `/*ADAPTER*/` al inicio del `<script>`. El adaptador solo define `call(fn, ...args)`, que devuelve una Promise con el JSON de `getData()`. Las funciones disponibles son `getData`, `saveRow(key,row,values)`, `deleteRow(key,row)` y `saveConfig(changes)`.

## Pestañas del Sheet

| Pestaña (sheetId) | Columnas | Notas |
| --- | --- | --- |
| Resumen (0) | Mes, Ingresos, Comisiones, Gastos fijos, Gastos variables, Gastos totales, Utilidad, Margen, Reinversión, Reserva, Gabriel, Daniel | Fórmulas SUMIFS por mes, filas oct 2026 a sep 2027 |
| Ingresos (1) | A Fecha, B Cliente, C Tipo (Mensualidad / Instalación / Otro), D Monto, E Notas | F:J son ARRAYFORMULA en la fila 1: F Mes #, G Vendido por, H Rol, I Comisión vendedor, J Override socio. La app solo escribe A:E |
| Gastos fijos (2) | Concepto, Categoría, Monto mensual, Activo (Sí/No), Desde, Hasta, Notas | Cuenta en cada mes con Activo=Sí, Desde ≤ fin de mes y Hasta vacío o ≥ inicio de mes |
| Gastos (3) | Fecha, Concepto, Categoría, Monto, Notas | Gastos variables y extras (créditos de IA, etc.) |
| Clientes (4) | Cliente, Plan (Lite / Starter / Growth / Por mensaje / Personalizado), Fecha inicio, Estado (Prueba / Activo / Pausado / Cancelado), Vendido por, Rol del vendedor (Fundador / Socio comercial / Vendedor), Mensualidad, Notas | |
| Cuenta (5) | Fecha, Cuenta, Saldo, Notas | El saldo actual es el último registro de cada cuenta |
| Distribucion (6) | Fecha, Mes, Destino (Reinversión / Reserva / Gabriel / Daniel / Comisiones), Monto, Notas | Lo que efectivamente se repartió |
| Config (7) | Clave, Valor, Descripción | Ver abajo |

### Config (claves)

`precio_lite` 35, `precio_starter` 50, `precio_growth` 80, `instalacion_lite` 100, `instalacion_starter` 125, `instalacion_growth` 150, `pct_instalacion_vendedor` 0.6, `pct_override_instalacion` 0.05, `pct_override_mensual` 0.05, `meses_override` 12, `reparto_reinversion` 0.4, `reparto_reserva` 0.2, `reparto_gabriel` 0.2, `reparto_daniel` 0.2, `meta_tramo1_clientes` 20, `meta_tramo1_pct` 0.04, `meta_tramo2_clientes` 50, `meta_tramo2_pct` 0.10, `socio_comercial_nombre` (vacío), `precio_por_mensaje` 0.15.

Las fórmulas de Ingresos referencian `Config!B8` a `B11` por posición. **No reordenes las filas de Config.**

## Reglas de negocio (plan comercial acordado)

- **Instalación:** quien vende se lleva 60%, Abita 40%. Si vende un "Vendedor" (del equipo del socio comercial), el vendedor recibe 55% y el socio comercial 5% (override).
- **Bono de cierre:** quien vende recibe la mensualidad completa del mes 2 del cliente. No hay comisión recurrente. El bono no se devuelve si el cliente cancela después.
- **Override mensual:** el socio comercial recibe 5% de cada mensualidad de los clientes de su equipo durante 12 meses.
- **Fundadores (Gabriel, Daniel):** no generan comisiones.
- **Participación del socio comercial:** 4% al llegar a 20 clientes activos y 10% a los 50 (tope), con cliff de 12 meses. Cliente activo = Estado Activo, vendido por el equipo comercial y con 3 o más mensualidades pagadas.
- **Utilidad** = ingresos − comisiones − gastos fijos − gastos variables. Se reparte 40% reinversión, 20% reserva, 20% Gabriel y 20% Daniel, editable en Config.
- **Plan "Por mensaje"** (ej. Hera): paga a fin de mes los mensajes enviados × `precio_por_mensaje`. Se registra como Tipo "Mensualidad". La app muestra un campo "Mensajes enviados" que calcula el monto y anota "N mensajes × $0.15" en Notas. En el ingreso recurrente cuenta con su último pago.
- **Mes #:** cuenta las mensualidades de ese cliente hasta esa fecha, inclusive.

## Diseño

Sigue el estilo del landing abitaai.com:

- Hero negro con radial naranja y la "A" del logo de fondo al 7%.
- Tarjetas de vidrio: `rgba(255,255,255,.06)`, `blur(24px) saturate(1.9)`, radio 22.
- Secciones crema `#EBE4D6` con tarjetas blancas.
- Kicker en mayúsculas `#B33500`.
- Botón primario con gradiente `#FF6220 → #FF4D00 → #F04400` y glow naranja.
- Pestañas tipo píldora.
- Tipografía Plus Jakarta Sans (titulares en 800 con tracking negativo y punto naranja final).
- Colores de marca: `#FF4D00`, `#000`, `#6F6F6F`, `#EBE4D6`, `#FFF`.

## Desarrollo

```bash
npm install            # puppeteer, chart.js, clasp
python build.py        # genera apps-script/Index.html y dist/cowork-dashboard.html
npm test               # prueba con Sheet simulado; capturas en tests/out/
```

## PWA (Cloudflare + Firebase Auth + API de Apps Script)

La app que usan Gabriel y Daniel es la PWA en `docs/`. Cloudflare la despliega solo con cada push a `main` del repo `gabrielfunes99/abita-finanzas` (`wrangler.jsonc` apunta a `docs/`). GitHub Pages también la sirve en https://gabrielfunes99.github.io/abita-finanzas/. Se instala desde el navegador ("Agregar a pantalla de inicio" en iPhone, "Instalar app" en Android/Chrome).

- **Login:** Firebase Auth con Google (`signInWithPopup`). Firebase guarda la sesión en el teléfono y renueva el token solo.
- La PWA hace `POST` (Content-Type `text/plain`, para evitar el preflight CORS) a la URL `/exec` de Apps Script con `{ fn, args, token }`, donde `token` es el ID token de Firebase.
- `verifyUser_` en Code.gs revisa que el token sea del proyecto (`aud` = `FIREBASE_PROJECT_ID`), lo valida con `identitytoolkit.googleapis.com/v1/accounts:lookup` y cachea el correo mientras el token es válido.
- **Quién entra:** fila `emails_permitidos` de la pestaña Config (correos separados por coma). Está en el Sheet y no en el código porque el repo es público. Sacar un correo de ahí corta su acceso en la siguiente llamada.
- La app web corre **como el dueño con acceso anónimo**. Por eso `doGet` devuelve solo texto (ContentService): **nunca debe devolver HtmlService**, porque una página así expone `google.script.run` sin login.
- `src/pwa/config.js` lleva `apiUrl` y el `firebaseConfig`; Code.gs lleva `FIREBASE_API_KEY` y `FIREBASE_PROJECT_ID`. Ninguno es secreto.
- El service worker (`sw.js`) guarda la interfaz para que abra sin red; los datos siempre se piden en vivo. `build.py` le pone un hash de versión en cada build.

### Puesta en marcha (una sola vez)

1. Firebase → Authentication → Settings → Dominios autorizados: agregar el dominio de Cloudflare (y `gabrielfunes99.github.io` si se usa).
2. Pegar el `firebaseConfig` en `src/pwa/config.js` y `FIREBASE_API_KEY` / `FIREBASE_PROJECT_ID` / `PWA_URL` en Code.gs.
3. Agregar al final de Config la fila `emails_permitidos` con los correos.
4. Apps Script: `npm run push`, luego Implementar → Gestionar implementaciones → editar → Nueva versión. Al autorizar pide "conectarse a un servicio externo" (UrlFetchApp).
5. Pegar la URL `/exec` en `src/pwa/config.js`, correr `python build.py`, commit y push.

### Publicar en Apps Script con clasp

1. `npx clasp login`
2. Copiá `apps-script/.clasp.json.example` a `apps-script/.clasp.json` y poné el scriptId. El proyecto se crea desde el Sheet: Extensiones → Apps Script → Configuración del proyecto → ID.
3. `npm run push` (build + clasp push).
4. En el editor de Apps Script: Implementar → Gestionar implementaciones → editar → Nueva versión. La URL de la app se mantiene.

Para dar acceso a alguien: agregar su correo (de Google) a `emails_permitidos` en Config y mandarle la URL de la app. No hace falta compartirle el Sheet.

## Pendientes / ideas

- Vista de solo lectura sin conexión (guardar el último getData en el dispositivo).
- Proyección de flujo de caja y meta de punto de equilibrio.
- Importar automáticamente los mensajes del mes de clientes "Por mensaje" desde el Dashboard de Abita.
- Exportar el estado de resultados mensual a PDF.
