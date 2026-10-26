/* Conexión vía google.script.run (Apps Script) */
function call(fn){var args=[].slice.call(arguments,1);return new Promise(function(res,rej){google.script.run.withSuccessHandler(function(r){res(JSON.parse(r))}).withFailureHandler(rej)[fn].apply(null,args)})}
