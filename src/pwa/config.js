/* Configuración de la PWA. No es secreta: el acceso lo controla Apps Script (fila emails_permitidos de Config). */
window.ABITA_CONFIG = {
  // Apps Script > Implementar > URL de la app web (termina en /exec)
  apiUrl: 'https://script.google.com/macros/s/AKfycbxpy3oCw4E7ywTREmXt8gPhm3QWuoos1pCBzMZ_qjSy2NO2q581mFP1YXzBdxQwm5I0Qg/exec',
  // Firebase > Configuración del proyecto > General > Tus apps > App web > firebaseConfig
  firebase: {
    apiKey: 'AIzaSyDBX3pmei9qQkt-BdBNnRvrMe_QWhL9zqs',
    authDomain: 'abita-finanzas.firebaseapp.com',
    projectId: 'abita-finanzas',
    appId: '1:692658813592:web:7e6e52bb70c03c46ea2eed'
  }
};
