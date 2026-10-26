/* ============ Conexión directa al Google Sheet (Cowork) ============ */
var T='mcp__ff731b88-1c57-48a2-b529-a9ee6329de18__', SID='1ASqsCrFTzyE49MrugAbWKQgEcgF2MsMQ3u7yj0nFC70';
var SH={ingresos:{name:'Ingresos',id:1,width:10,write:5,num:[3,5,8,9],rows:1000},gastos:{name:'Gastos',id:3,width:5,num:[3],rows:1000},
  gastosFijos:{name:'Gastos fijos',id:2,width:7,num:[2],rows:200},clientes:{name:'Clientes',id:4,width:8,num:[6],rows:500},
  cuenta:{name:'Cuenta',id:5,width:4,num:[2],rows:500},distribucion:{name:'Distribucion',id:6,width:5,num:[3],rows:500}};
var COLS={ingresos:['Fecha','Cliente','Tipo','Monto','Notas'],gastos:['Fecha','Concepto','Categoría','Monto','Notas'],gastosFijos:['Concepto','Categoría','Monto mensual','Activo','Desde','Hasta','Notas'],clientes:['Cliente','Plan','Fecha inicio','Estado','Vendido por','Rol del vendedor','Mensualidad','Notas'],cuenta:['Fecha','Cuenta','Saldo','Notas'],distribucion:['Fecha','Mes','Destino','Monto','Notas']};
var LET='ABCDEFGHIJ', RAW={}, BUST=0, CFGROWS={};
async function mcp(tool,args){var r=await window.cowork.callMcpTool(T+tool,args);if(r.isError)throw new Error((r.content&&r.content[0]&&r.content[0].text)||'Error del conector');return r.structuredContent!=null?r.structuredContent:JSON.parse(r.content[0].text)}
function qn(n){return "'"+n+"'"}
function pnum(x){if(x===''||x==null)return '';var t=String(x),n=Number(t.replace(/[$,%\s]/g,''));if(isNaN(n))return x;return t.indexOf('%')>=0?n/100:n}
async function A_getData(){
  BUST++;var out={tables:{},config:{},configRows:[]},keys=Object.keys(SH);
  var res=await Promise.all(keys.map(function(k){var d=SH[k];return mcp('get_values',{spreadsheetId:SID,range:qn(d.name)+'!A2:'+LET[d.width-1]+(d.rows-(BUST%40))})}));
  keys.forEach(function(k,j){var d=SH[k],vals=res[j].values||[];RAW[k]=vals;var rows=[];
    vals.forEach(function(r,i){if(!r[0])return;var v=[];for(var c=0;c<d.width;c++){var x=r[c]==null?'':r[c];if(d.num.indexOf(c)>=0)x=pnum(x);v.push(x)}rows.push({row:i+2,v:v})});
    out.tables[k]={cols:COLS[k],rows:rows}});
  var cfg=await mcp('get_values',{spreadsheetId:SID,range:'Config!A2:C'+(50-(BUST%40))});
  (cfg.values||[]).forEach(function(r,i){if(!r[0])return;var val=pnum(r[1]);out.config[r[0]]=val;CFGROWS[r[0]]=i+2;out.configRows.push({row:i+2,key:r[0],value:val,desc:r[2]||''})});
  return out;
}
async function A_saveRow(key,row,vals){
  var d=SH[key],w=d.write||d.width;
  if(!row){var raw=RAW[key]||[],i=-1;for(var j=0;j<raw.length;j++){if(!raw[j]||!raw[j][0]){i=j;break}}row=i>=0?i+2:raw.length+2}
  var v=vals.slice(0,w).map(function(x,c){if(d.num.indexOf(c)>=0&&x!==''&&x!=null&&!isNaN(Number(x)))return Number(x);return x==null?'':x});
  await mcp('update_values',{spreadsheetId:SID,range:qn(d.name)+'!A'+row+':'+LET[w-1]+row,values:[v]});
  return A_getData();
}
async function A_deleteRow(key,row){
  await mcp('update_spreadsheet',{spreadsheetId:SID,requests:[{deleteDimension:{range:{sheetId:SH[key].id,dimension:'ROWS',startIndex:row-1,endIndex:row}}}]});
  return A_getData();
}
async function A_saveConfig(ch){
  for(var k in ch){if(CFGROWS[k])await mcp('update_values',{spreadsheetId:SID,range:'Config!B'+CFGROWS[k],values:[[ch[k]]]})}
  return A_getData();
}
var ADAPTER={getData:A_getData,saveRow:A_saveRow,deleteRow:A_deleteRow,saveConfig:A_saveConfig};
function call(fn){var args=[].slice.call(arguments,1);return ADAPTER[fn].apply(null,args)}





