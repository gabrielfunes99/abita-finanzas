/* Configuración de la PWA. No es secreta: el acceso lo controla Apps Script (fila emails_permitidos de Config). */
window.ABITA_CONFIG = {
  // Apps Script > Implementar > URL de la app web (termina en /exec)
  apiUrl: 'https://script.google.com/macros/s/PEGAR_AQUI/exec',
  // Firebase > Configuración del proyecto > General > Tus apps > App web > firebaseConfig
  firebase: {
    apiKey: 'PEGAR_AQUI',
    authDomain: 'PEGAR_AQUI.firebaseapp.com',
    projectId: 'PEGAR_AQUI',
    appId: 'PEGAR_AQUI'
  }
};
