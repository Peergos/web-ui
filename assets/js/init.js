function initStart() {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'js/peergos.js';
    document.body.appendChild(script);
}

var initJS = {
    NativeInit: function() {
        this.init = initStart;
    }
};	

window.onload = () => {
  'use strict';

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
             .register('./sw.js');
  }
}
