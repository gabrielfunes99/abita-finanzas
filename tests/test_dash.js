const fs = require('fs');
// Prueba local del dashboard (npm i puppeteer chart.js@4.4.1 && node tests/test_dash.js) con un Sheet simulado (misma lógica que las fórmulas del Sheet real)
const puppeteer = require('puppeteer');
const path = require('path');
const OUT = path.join(__dirname, 'out') + '/'; fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync(path.join(__dirname, '../src/ui.html'), 'utf8');
const chartJs = fs.readFileSync(require.resolve('chart.js/dist/chart.umd.js'), 'utf8');

const mock = `
window.DB = {
  config: {precio_lite:35,precio_starter:50,precio_growth:80,instalacion_lite:100,instalacion_starter:125,instalacion_growth:150,
    pct_instalacion_vendedor:0.6,pct_override_instalacion:0.05,pct_override_mensual:0.05,meses_override:12,
    reparto_reinversion:0.4,reparto_reserva:0.2,reparto_gabriel:0.2,reparto_daniel:0.2,meta_tramo1_clientes:20,meta_tramo1_pct:0.04,meta_tramo2_clientes:50,meta_tramo2_pct:0.1,socio_comercial_nombre:'Andrea'},
  ingresos:[
    ['2026-08-03','Melto','Mensualidad',50,''],['2026-09-03','Melto','Mensualidad',50,''],['2026-10-03','Melto','Mensualidad',50,''],
    ['2026-09-10','Clínica Sonrisa','Instalación',150,''],['2026-09-10','Clínica Sonrisa','Mensualidad',80,''],['2026-10-10','Clínica Sonrisa','Mensualidad',80,''],
    ['2026-10-06','Roofball SV','Instalación',125,''],['2026-10-06','Roofball SV','Mensualidad',50,'']],
  gastos:[['2026-09-15','Créditos Claude API','Créditos de IA',20,''],['2026-10-12','Créditos Claude API','Créditos de IA',35,''],['2026-10-02','Dominio abitaai.com','Software',12,'']],
  gastosFijos:[['Base de datos','Infraestructura',25,'Sí','2026-08-01','',''],['Servidor','Infraestructura',7,'Sí','2026-08-01','','']],
  clientes:[['Melto','Starter','2026-08-03','Activo','Gabriel','Fundador',50,''],['Clínica Sonrisa','Growth','2026-09-10','Activo','Carlos','Vendedor',80,''],['Roofball SV','Starter','2026-10-06','Prueba','Andrea','Socio comercial',50,'']],
  cuenta:[['2026-10-01','Banco Agrícola',310,''],['2026-10-14','Banco Agrícola',455.5,'']],
  distribucion:[]
};
const COLS={ingresos:['Fecha','Cliente','Tipo','Monto','Notas'],gastos:['Fecha','Concepto','Categoría','Monto','Notas'],gastosFijos:['Concepto','Categoría','Monto mensual','Activo','Desde','Hasta','Notas'],clientes:['Cliente','Plan','Fecha inicio','Estado','Vendido por','Rol del vendedor','Mensualidad','Notas'],cuenta:['Fecha','Cuenta','Saldo','Notas'],distribucion:['Fecha','Mes','Destino','Monto','Notas']};
function compute(){ const c=DB.config; return DB.ingresos.map(r=>{
  const cl=DB.clientes.find(x=>x[0]===r[1]); const vend=cl?cl[4]:'', rol=cl?cl[5]:'';
  const mes = r[2]==='Mensualidad' ? DB.ingresos.filter(x=>x[1]===r[1]&&x[2]==='Mensualidad'&&x[0]<=r[0]).length : '';
  let com=0, ov=0;
  if(rol && rol!=='Fundador'){ if(r[2]==='Instalación') com=r[3]*(c.pct_instalacion_vendedor-(rol==='Vendedor'?c.pct_override_instalacion:0)); else if(r[2]==='Mensualidad') com=(mes===2)?r[3]:0; }
  if(rol==='Vendedor'){ if(r[2]==='Instalación') ov=r[3]*c.pct_override_instalacion; else if(r[2]==='Mensualidad') ov=(mes<=c.meses_override)?r[3]*c.pct_override_mensual:0; }
  return r.concat([mes,vend,rol,com,ov]); }); }
window.MOCK = {
  getData(){ const t={}; Object.keys(COLS).forEach(k=>{ const src=k==='ingresos'?compute():DB[k]; t[k]={cols:COLS[k],rows:src.map((v,i)=>({row:i+2,v:v.slice()}))}; });
    const cr=Object.keys(DB.config).map((k,i)=>({row:i+2,key:k,value:DB.config[k],desc:''}));
    return JSON.stringify({tables:t,config:DB.config,configRows:cr}); },
  saveRow(k,row,vals){ vals=vals.map(v=>(v!==''&&!isNaN(Number(v))&&typeof v==='string'&&/^-?\\d+(\\.\\d+)?$/.test(v))?Number(v):v); if(row) DB[k][row-2]=vals; else DB[k].push(vals); return MOCK.getData(); },
  deleteRow(k,row){ DB[k].splice(row-2,1); return MOCK.getData(); },
  saveConfig(ch){ Object.assign(DB.config,ch); return MOCK.getData(); }
};`;

let page2 = html.replace('<!--CHARTJS-->', () => '<script>' + chartJs + '</script><script>' + mock + '</script>').replace('/*ADAPTER*/', () => 'function call(fn){var args=[].slice.call(arguments,1);return new Promise(function(res){setTimeout(function(){res(JSON.parse(MOCK[fn].apply(null,args)))},30)})}')
                .replace(/<link[^>]+fonts[^>]+>/g, '');
const TMP = OUT + 'test_dash.html'; fs.writeFileSync(TMP, page2);

(async () => {
  const b = await puppeteer.launch({ headless: true });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) });
  await p.setViewport({ width: 1366, height: 1500 });
  await p.evaluateOnNewDocument(() => { const D = Date; window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super('2026-10-14T12:00:00'); } }; });
  await p.goto('file://' + TMP); await new Promise(r => setTimeout(r, 1200));
  await p.screenshot({ path: OUT + 't_resumen.png', fullPage: true });
  const kp = await p.$$eval('.gcard', els => els.map(e => e.innerText.replace(/\n/g, ' | ')));
  console.log(JSON.stringify(kp, null, 1));
  console.log(await p.$eval('h1', e => e.innerText));
  // comisiones
  await p.click('#tabs button[data-v=comisiones]'); await new Promise(r => setTimeout(r, 400));
  console.log((await p.$eval('#view', e => e.innerText)).slice(0, 1500));
  await p.screenshot({ path: OUT + 't_comisiones.png', fullPage: true });
  // tabla ingresos + agregar
  await p.click('#tabs button[data-v=ingresos]'); await new Promise(r => setTimeout(r, 300));
  await p.click('#addBtn'); await new Promise(r => setTimeout(r, 200));
  await p.type('input[name=f1]', 'Clínica Sonrisa'); await new Promise(r => setTimeout(r, 200));
  console.log('auto monto:', await p.$eval('input[name=f3]', e => e.value), await p.$eval('#hint', e => e.innerText));
  await p.screenshot({ path: OUT + 't_form.png' });
  await p.click('button[type=submit]'); await new Promise(r => setTimeout(r, 500));
  await p.screenshot({ path: OUT + 't_ingresos.png', fullPage: true });
  console.log('rows ingresos mes:', await p.$$eval('tr[data-row]', e => e.length));
  // distribución
  await p.click('#tabs button[data-v=resumen]'); await new Promise(r => setTimeout(r, 500));
  p.on('dialog', d => d.accept());
  await p.click('#regDist'); await new Promise(r => setTimeout(r, 800));
  await p.click('#tabs button[data-v=distribucion]'); await new Promise(r => setTimeout(r, 300));
  console.log((await p.$eval('#view', e => e.innerText)).slice(0, 600));
  // config
  await p.click('#tabs button[data-v=config]'); await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path: OUT + 't_config.png' });
  // mobile
  await p.setViewport({ width: 390, height: 1400 }); await p.click('#tabs button[data-v=resumen]'); await new Promise(r => setTimeout(r, 600));
  await p.screenshot({ path: OUT + 't_mobile.png', fullPage: false });
  console.log('ERRORS:', errs);
  await b.close();
})().catch(e => { console.log('FAIL', e); process.exit(1); });
