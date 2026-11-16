// Sets light/dark before the page paints, to avoid a flash. An external file so the Content-Security-Policy needs no inline scripts.
try { var t = JSON.parse((localStorage.getItem('buxa.theme')||localStorage.getItem('tessera.theme'))||'"system"');
  var d = t==='dark' || (t==='system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = d ? 'dark' : 'light'; } catch(e){}
