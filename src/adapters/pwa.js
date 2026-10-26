/* Conexión vía API de Apps Script (doPost) con login por correo permitido (PWA) */
var CONF=window.ABITA_CONFIG||{},SES=null,SK='abita_session',waiting=[];
try{SES=JSON.parse(localStorage.getItem(SK))}catch(e){}
function sesOk(){return !!(SES&&SES.token&&SES.exp>Date.now())}
function setSes(s){SES=s;try{s?localStorage.setItem(SK,JSON.stringify(s)):localStorage.removeItem(SK)}catch(e){}}
function api(fn,args){
  if(!CONF.apiUrl)return Promise.reject(new Error('Falta configurar apiUrl en config.js'));
  return fetch(CONF.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({fn:fn,args:args||[],token:SES&&SES.token})})
    .then(function(r){if(!r.ok)throw new Error('La API respondió '+r.status);return r.json()})}
function login(msg){return new Promise(function(res){waiting.push(res);document.getElementById('login').classList.add('on');
  document.getElementById('loginMsg').textContent=msg||'Escribí tu correo para entrar.';var f=document.getElementById('lgE');setTimeout(function(){f.focus()},50)})}
function lgBusy(form,on){form.querySelector('button[type=submit]').disabled=on}
(function(){var top=document.querySelector('.top'),b=document.createElement('button');b.className='btn glass sm';b.id='logout';b.textContent='Salir';b.title='Cerrar sesión';
  b.onclick=function(){var done=function(){setSes(null);location.reload()};api('logout').then(done,done)};top.appendChild(b);
  var L=document.createElement('div');L.className='login';L.id='login';
  L.innerHTML='<div class="login-card"><svg class="logo" viewBox="0 0 722.1 121.6" aria-label="Abita AI"><use href="#abita-logo"/></svg><h1>Finanzas<span class="dot">.</span></h1><p id="loginMsg"></p>'+
    '<form id="lgEmail"><input id="lgE" type="email" autocomplete="email" inputmode="email" placeholder="tu@correo.com" required><button class="btn" type="submit">Entrar</button></form></div>';
  document.body.appendChild(L);
  var FE=document.getElementById('lgEmail');
  try{document.getElementById('lgE').value=localStorage.getItem('abita_email')||''}catch(e){}
  FE.onsubmit=function(e){e.preventDefault();var em=document.getElementById('lgE').value.trim().toLowerCase();lgBusy(FE,true);
    api('login',[em]).then(function(r){if(!r.ok)throw new Error(r.error);try{localStorage.setItem('abita_email',em)}catch(e){}
      setSes(r.data);L.classList.remove('on');busy(true);waiting.splice(0).forEach(function(f){f()})})
      .catch(function(err){document.getElementById('loginMsg').textContent=err.message}).finally(function(){lgBusy(FE,false)})}})();
function call(fn){var args=[].slice.call(arguments,1);
  return (sesOk()?Promise.resolve():(busy(false),login())).then(function(){return api(fn,args)})
  .then(function(r){if(r.ok)return r.data;
    if(r.auth){setSes(null);busy(false);return login(r.error).then(function(){return call.apply(null,[fn].concat(args))})}
    throw new Error(r.error)})}
