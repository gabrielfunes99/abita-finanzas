/* Conexión vía API de Apps Script (doPost) con login de Google por Firebase Auth (PWA) */
var CONF=window.ABITA_CONFIG||{},AUTH=null,USER=null,waiting=[],authReady;
function api(fn,args,token){
  if(!CONF.apiUrl)return Promise.reject(new Error('Falta configurar apiUrl en config.js'));
  return fetch(CONF.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({fn:fn,args:args||[],token:token})})
    .then(function(r){if(!r.ok)throw new Error('La API respondió '+r.status);return r.json()})}
function login(msg){return new Promise(function(res){waiting.push(res);document.getElementById('login').classList.add('on');
  document.getElementById('loginMsg').textContent=msg||'Entrá con tu cuenta de Google.'})}
(function(){var top=document.querySelector('.top'),b=document.createElement('button');b.className='btn glass sm ib';b.id='logout';b.title='Cerrar sesión';b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/></svg><span class="lbl">Salir</span>';
  b.onclick=function(){(AUTH?AUTH.signOut():Promise.resolve()).then(function(){location.reload()})};top.appendChild(b);
  var L=document.createElement('div');L.className='login';L.id='login';
  L.innerHTML='<div class="login-card"><svg class="logo" viewBox="0 0 722.1 121.6" aria-label="Abita AI"><use href="#abita-logo"/></svg><h1>Finanzas<span class="dot">.</span></h1><p id="loginMsg"></p>'+
    '<button class="btn" type="button" id="lgGoogle">Entrar con Google</button></div>';
  document.body.appendChild(L);
  if(!window.firebase||!CONF.firebase||!CONF.firebase.apiKey){authReady=Promise.resolve();return}
  firebase.initializeApp(CONF.firebase);AUTH=firebase.auth();
  authReady=new Promise(function(res){var first=true;AUTH.onAuthStateChanged(function(u){USER=u;if(first){first=false;res()}
    if(u){L.classList.remove('on');waiting.splice(0).forEach(function(f){f()})}})});
  var G=document.getElementById('lgGoogle');
  G.onclick=function(){G.disabled=true;var p=new firebase.auth.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});
    AUTH.signInWithPopup(p).catch(function(err){if(err&&err.code!=='auth/popup-closed-by-user'&&err.code!=='auth/cancelled-popup-request')
      document.getElementById('loginMsg').textContent='No se pudo entrar: '+(err.message||err.code)}).finally(function(){G.disabled=false})}})();
function call(fn){var args=[].slice.call(arguments,1);
  if(!AUTH)return Promise.reject(new Error('Falta configurar Firebase en config.js'));
  return authReady.then(function(){if(USER)return;busy(false);return login().then(function(){busy(true)})})
  .then(function(){return USER.getIdToken()}).then(function(t){return api(fn,args,t)})
  .then(function(r){if(r.ok)return r.data;
    if(r.auth){busy(false);return AUTH.signOut().then(function(){return login(r.error)}).then(function(){busy(true);return call.apply(null,[fn].concat(args))})}
    throw new Error(r.error)})}
