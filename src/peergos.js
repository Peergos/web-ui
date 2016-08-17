var Vue         = require('vue'),
    Filesystem  = require('./components/filesystem'),
    Login       = require('./components/login');
    Signup      = require('./components/signup');

// Loading components
Vue.component('filesystem', Vue.extend(Filesystem));
Vue.component('login', Vue.extend(Login));
Vue.component('signup', Vue.extend(Signup));

// Initializing Vue
var peergos = new Vue({
    el: 'body',
    data: {
        currentView: 'login',
        serverPort: 8000
    }
});
