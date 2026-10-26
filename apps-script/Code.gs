/**
 * Abita · Finanzas — backend del dashboard.
 * Va pegado en Extensiones > Apps Script del Google Sheet "Abita · Finanzas (base de datos)".
 * Lee y escribe las pestañas del Sheet; el Sheet es la única base de datos.
 */

var TABLES = {
  ingresos:     { sheet: 'Ingresos',     cols: ['Fecha', 'Cliente', 'Tipo', 'Monto', 'Notas'], readCols: 10, dateCols: [0], numCols: [3] },
  gastos:       { sheet: 'Gastos',       cols: ['Fecha', 'Concepto', 'Categoría', 'Monto', 'Notas'], dateCols: [0], numCols: [3] },
  gastosFijos:  { sheet: 'Gastos fijos', cols: ['Concepto', 'Categoría', 'Monto mensual', 'Activo', 'Desde', 'Hasta', 'Notas'], dateCols: [4, 5], numCols: [2] },
  clientes:     { sheet: 'Clientes',     cols: ['Cliente', 'Plan', 'Fecha inicio', 'Estado', 'Vendido por', 'Rol del vendedor', 'Mensualidad', 'Notas'], dateCols: [2], numCols: [6] },
  cuenta:       { sheet: 'Cuenta',       cols: ['Fecha', 'Cuenta', 'Saldo', 'Notas'], dateCols: [0], numCols: [2] },
  distribucion: { sheet: 'Distribucion', cols: ['Fecha', 'Mes', 'Destino', 'Monto', 'Notas'], dateCols: [0, 1], numCols: [3] }
};

/**
 * La app web corre como el dueño y acepta visitas anónimas: es la API de la PWA (GitHub Pages).
 * IMPORTANTE: doGet nunca debe devolver HtmlService. Una página HtmlService servida acá dejaría
 * llamar getData/saveRow por google.script.run sin login. Todo acceso pasa por doPost + sesión.
 */
var PWA_URL = 'https://gabrielfunes99.github.io/abita-finanzas/';
function doGet() {
  return ContentService.createTextOutput('Abita · Finanzas: esta URL es la API. Abrí la app en ' + PWA_URL);
}

/**
 * API de la PWA. Body (text/plain para evitar preflight CORS): { fn, args, token }.
 * Responde { ok: true, data } o { ok: false, error, auth }.
 * Login: login(email) abre una sesión si el correo está en emails_permitidos.
 */
var API_ = { getData: getData, saveRow: saveRow, deleteRow: deleteRow, saveConfig: saveConfig };
var SESSION_DAYS = 90;
function doPost(e) {
  var body;
  try {
    var req = JSON.parse(e.postData.contents), args = req.args || [];
    if (req.fn === 'login') body = JSON.stringify({ ok: true, data: login_(args[0]) });
    else if (req.fn === 'logout') { endSession_(req.token); body = '{"ok":true,"data":null}'; }
    else {
      checkSession_(req.token);
      var fn = API_[req.fn];
      if (!fn) throw new Error('Función desconocida: ' + req.fn);
      body = '{"ok":true,"data":' + fn.apply(null, args) + '}';
    }
  } catch (err) {
    body = JSON.stringify({ ok: false, error: String(err && err.message || err), auth: !!(err && err.auth) });
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function authError_(msg) { var e = new Error(msg); e.auth = true; return e; }
function hash_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)).replace(/=+$/, ''); }
function normEmail_(s) { return String(s || '').trim().toLowerCase(); }

/** Correos con acceso: fila "emails_permitidos" de la pestaña Config, separados por coma. */
function allowedEmails_() {
  var cfg = ss_().getSheetByName('Config'), n = cfg.getLastRow();
  var rows = n >= 2 ? cfg.getRange(2, 1, n - 1, 2).getValues() : [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'emails_permitidos') return String(rows[i][1]).toLowerCase().split(/[\s,;]+/).filter(String);
  }
  return [];
}

/** Abre una sesión de SESSION_DAYS días si el correo está permitido. */
function login_(email) {
  email = normEmail_(email);
  if (allowedEmails_().indexOf(email) < 0) throw new Error('Este correo no tiene acceso');
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var exp = Date.now() + SESSION_DAYS * 864e5, props = PropertiesService.getScriptProperties();
  var all = props.getProperties(), now = Date.now();
  Object.keys(all).forEach(function (k) {  // limpia sesiones vencidas
    if (k.indexOf('ses_') === 0) { try { if (JSON.parse(all[k]).exp < now) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); } }
  });
  props.setProperty('ses_' + hash_(token), JSON.stringify({ email: email, exp: exp }));
  return { token: token, email: email, exp: exp };
}

/** Valida la sesión y que el correo siga en emails_permitidos (sacarlo de Config corta el acceso). */
function checkSession_(token) {
  if (!token) throw authError_('Iniciá sesión para continuar');
  var props = PropertiesService.getScriptProperties(), key = 'ses_' + hash_(token), raw = props.getProperty(key);
  var s = raw ? JSON.parse(raw) : null;
  if (!s || s.exp < Date.now()) { if (raw) props.deleteProperty(key); throw authError_('La sesión venció. Entrá de nuevo.'); }
  if (allowedEmails_().indexOf(s.email) < 0) { props.deleteProperty(key); throw authError_(s.email + ' ya no tiene acceso'); }
  return s.email;
}
function endSession_(token) { if (token) PropertiesService.getScriptProperties().deleteProperty('ses_' + hash_(token)); }

/** Lock del Sheet si el script está dentro del Sheet; si no, lock del script. */
function lock_() { return LockService.getDocumentLock() || LockService.getScriptLock(); }

/** Menú dentro del Sheet: Abita > Abrir dashboard. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Abita').addItem('Abrir dashboard', 'openDashboard').addToUi();
}
function openDashboard() {
  var html = HtmlService.createHtmlOutputFromFile('Index').setWidth(1400).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'Abita · Finanzas');
}

var SHEET_ID = '1ASqsCrFTzyE49MrugAbWKQgEcgF2MsMQ3u7yj0nFC70';
function ss_() {
  // Funciona tanto si el script está dentro del Sheet como si se creó aparte en script.google.com
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);
}
function tz_() { return ss_().getSpreadsheetTimeZone(); }

function fmtCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  return v;
}

/** Devuelve todo lo que necesita el dashboard, como JSON. */
function getData() {
  SpreadsheetApp.flush();
  var out = { tables: {}, config: {}, configRows: [], generatedAt: new Date().toISOString() };
  Object.keys(TABLES).forEach(function (key) {
    var def = TABLES[key];
    var sh = ss_().getSheetByName(def.sheet);
    var width = def.readCols || def.cols.length;
    var last = sh.getLastRow();
    var rows = [];
    if (last >= 2) {
      var values = sh.getRange(2, 1, last - 1, width).getValues();
      values.forEach(function (r, i) {
        if (r[0] === '' || r[0] === null) return;          // fila vacía
        rows.push({ row: i + 2, v: r.map(fmtCell_) });
      });
    }
    out.tables[key] = { cols: def.cols, rows: rows };
  });
  var cfg = ss_().getSheetByName('Config');
  var cl = cfg.getLastRow();
  if (cl >= 2) {
    cfg.getRange(2, 1, cl - 1, 3).getValues().forEach(function (r, i) {
      if (!r[0]) return;
      out.config[r[0]] = r[1];
      out.configRows.push({ row: i + 2, key: r[0], value: r[1], desc: r[2] });
    });
  }
  return JSON.stringify(out);
}

function toDate_(s) {
  if (!s) return '';
  var p = String(s).split('-');
  if (p.length < 3) return s;
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

/** Crea (row vacío) o actualiza una fila. values = arreglo en el orden de cols. */
function saveRow(key, row, values) {
  var def = TABLES[key];
  if (!def) throw new Error('Tabla desconocida: ' + key);
  var lock = lock_();
  lock.waitLock(20000);
  try {
    var sh = ss_().getSheetByName(def.sheet);
    var vals = def.cols.map(function (c, i) {
      var v = values[i];
      if (v === undefined || v === null) v = '';
      if (def.dateCols.indexOf(i) >= 0) return toDate_(v);
      if (def.numCols.indexOf(i) >= 0) return v === '' ? '' : Number(v);
      return v;
    });
    var target = row;
    if (!target) {
      var colA = sh.getRange(1, 1, Math.max(sh.getMaxRows(), 2), 1).getValues();
      target = colA.length + 1;
      for (var i = 1; i < colA.length; i++) { if (colA[i][0] === '' || colA[i][0] === null) { target = i + 1; break; } }
      if (target > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
    }
    sh.getRange(target, 1, 1, vals.length).setValues([vals]);
  } finally {
    lock.releaseLock();
  }
  return getData();
}

function deleteRow(key, row) {
  var def = TABLES[key];
  if (!def || !row || row < 2) throw new Error('Fila inválida');
  var lock = lock_();
  lock.waitLock(20000);
  try {
    ss_().getSheetByName(def.sheet).deleteRow(row);
  } finally {
    lock.releaseLock();
  }
  return getData();
}

/** Guarda valores de Config. changes = { clave: valor, ... } */
function saveConfig(changes) {
  var lock = lock_();
  lock.waitLock(20000);
  try {
    var cfg = ss_().getSheetByName('Config');
    var keys = cfg.getRange(2, 1, Math.max(cfg.getLastRow() - 1, 1), 1).getValues();
    Object.keys(changes).forEach(function (k) {
      var found = false;
      for (var i = 0; i < keys.length; i++) {
        if (keys[i][0] === k) { cfg.getRange(i + 2, 2).setValue(changes[k]); found = true; break; }
      }
      if (!found) cfg.appendRow([k, changes[k], '']);
    });
  } finally {
    lock.releaseLock();
  }
  return getData();
}
