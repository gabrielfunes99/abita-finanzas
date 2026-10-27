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
 * La app web corre como el dueño y acepta visitas anónimas: es la API de la PWA (Cloudflare).
 * IMPORTANTE: doGet nunca debe devolver HtmlService. Una página HtmlService servida acá dejaría
 * llamar getData/saveRow por google.script.run sin login. Todo acceso pasa por doPost + token.
 */
var PWA_URL = 'https://abita-finanzas.gabrielfunes99.workers.dev/';
// Firebase (Configuración del proyecto > General > Tus apps). No son secretos.
var FIREBASE_API_KEY = 'PEGAR_AQUI';
var FIREBASE_PROJECT_ID = 'PEGAR_AQUI';

function doGet() {
  return ContentService.createTextOutput('Abita · Finanzas: esta URL es la API. Abrí la app en ' + PWA_URL);
}

/**
 * API de la PWA. Body (text/plain para evitar preflight CORS): { fn, args, token }.
 * token = ID token de Firebase Auth (login con Google). Responde { ok: true, data } o { ok: false, error, auth }.
 */
var API_ = { getData: getData, saveRow: saveRow, deleteRow: deleteRow, saveConfig: saveConfig };
function doPost(e) {
  var body;
  try {
    var req = JSON.parse(e.postData.contents);
    verifyUser_(req.token);
    var fn = API_[req.fn];
    if (!fn) throw new Error('Función desconocida: ' + req.fn);
    body = '{"ok":true,"data":' + fn.apply(null, req.args || []) + '}';
  } catch (err) {
    body = JSON.stringify({ ok: false, error: String(err && err.message || err), auth: !!(err && err.auth) });
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function authError_(msg) { var e = new Error(msg); e.auth = true; return e; }
function hash_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)).replace(/=+$/, ''); }

/** Correos con acceso: fila "emails_permitidos" de la pestaña Config, separados por coma. */
function allowedEmails_() {
  var cfg = ss_().getSheetByName('Config'), n = cfg.getLastRow();
  var rows = n >= 2 ? cfg.getRange(2, 1, n - 1, 2).getValues() : [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'emails_permitidos') return String(rows[i][1]).toLowerCase().split(/[\s,;]+/).filter(String);
  }
  return [];
}

/**
 * Verifica el ID token con Firebase (accounts:lookup rechaza tokens vencidos o falsos)
 * y que el correo esté en emails_permitidos. El resultado se cachea mientras el token es válido.
 */
function verifyUser_(token) {
  if (!token) throw authError_('Iniciá sesión para continuar');
  var cache = CacheService.getScriptCache(), key = 'fb_' + hash_(token), email = cache.get(key);
  if (!email) {
    var claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token.split('.')[1] + '==='.slice((token.split('.')[1].length + 3) % 4))).getDataAsString());
    if (claims.aud !== FIREBASE_PROJECT_ID) throw authError_('Sesión de otro proyecto');
    var res = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY, {
      method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw authError_('La sesión venció. Entrá de nuevo.');
    var u = (JSON.parse(res.getContentText()).users || [])[0];
    if (!u || !u.email || !u.emailVerified) throw authError_('No se pudo verificar el correo');
    email = String(u.email).toLowerCase();
    var ttl = Math.min(21600, Number(claims.exp) - Math.floor(Date.now() / 1000));
    if (ttl > 0) cache.put(key, email, ttl);
  }
  if (allowedEmails_().indexOf(email) < 0) throw authError_(email + ' no tiene acceso a Abita · Finanzas');
  return email;
}

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
