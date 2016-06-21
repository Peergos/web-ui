var Vue         = require('vue').use(require('vue-resource')),
    Filesystem  = require('./components/filesystem'),
    Login       = require('./components/login');

// Loading components
Vue.component('filesystem', Vue.extend(Filesystem));
Vue.component('login', Vue.extend(Login));

// Initializing Vue
var peergos = new Vue({
    el: 'body',
    data: {
        currentView: 'login',
        serverPort: 8000
    }
});
