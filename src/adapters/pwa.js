/* Conexión vía API de Apps Script (doPost) con "Iniciar sesión con Google" (PWA) */
var CONF=window.ABITA_CONFIG||{},TOK=null,TK='abita_token',waiting=[],gsiP=null;
try{TOK=JSON.parse(localStorage.getItem(TK))}catch(e){}
function tokOk(){return !!(TOK&&TOK.t&&TOK.exp*1000>Date.now()+60000)}
function setTok(t){TOK=t;try{t?localStorage.setItem(TK,JSON.stringify(t)):localStorage.removeItem(TK)}catch(e){}}
function jwt(t){var p=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(escape(atob(p))))}
function gsi(){return gsiP=gsiP||new Promise(function(res){(function w(){if(window.google&&google.accounts&&google.accounts.id)res();else setTimeout(w,60)})()}).then(function(){
  google.accounts.id.initialize({client_id:CONF.clientId,callback:onCred,auto_select:true,use_fedcm_for_prompt:true,cancel_on_tap_outside:false})})}
function onCred(r){var c=jwt(r.credential);setTok({t:r.credential,exp:c.exp,email:c.email});document.getElementById('login').classList.remove('on');waiting.splice(0).forEach(function(f){f()})}
function login(msg){return new Promise(function(res){waiting.push(res);var L=document.getElementById('login');
  document.getElementById('loginMsg').textContent=msg||'Iniciá sesión con tu cuenta de Google.';L.classList.add('on');
  if(!CONF.clientId||!CONF.apiUrl){document.getElementById('loginMsg').textContent='Falta configurar clientId y apiUrl en config.js.';return}
  gsi().then(function(){var b=document.getElementById('gbtn');b.innerHTML='';
    google.accounts.id.renderButton(b,{theme:'filled_black',size:'large',shape:'pill',text:'signin_with',locale:'es'});if(!msg)google.accounts.id.prompt()})})}
function call(fn){var args=[].slice.call(arguments,1);
  return (tokOk()?Promise.resolve():login()).then(function(){
    return fetch(CONF.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({fn:fn,args:args,idToken:TOK.t})})})
  .then(function(r){if(!r.ok)throw new Error('La API respondió '+r.status);return r.json()})
  .then(function(r){if(r.ok)return r.data;
    if(r.auth){setTok(null);if(window.google&&google.accounts)google.accounts.id.disableAutoSelect();busy(false);
      return login(r.error).then(function(){busy(true);return call.apply(null,[fn].concat(args))})}
    throw new Error(r.error)})}
(function(){var top=document.querySelector('.top'),b=document.createElement('button');b.className='btn glass sm';b.id='logout';b.textContent='Salir';b.title='Cerrar sesión';
  b.onclick=function(){setTok(null);if(window.google&&google.accounts)google.accounts.id.disableAutoSelect();location.reload()};top.appendChild(b);
  var L=document.createElement('div');L.className='login';L.id='login';
  L.innerHTML='<div class="login-card"><svg class="logo" viewBox="0 0 722.1 121.6" aria-label="Abita AI"><use href="#abita-logo"/></svg><h1>Finanzas<span class="dot">.</span></h1><p id="loginMsg"></p><div id="gbtn"></div></div>';
  document.body.appendChild(L)})();
