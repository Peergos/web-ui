var Vue         = require('vue').use(require('vue-resource')),
    Filesystem  = require('./components/filesystem'),
    Login       = require('./components/login');
    Signup      = require('./components/signup');
var VueFocus = require('vue-focus');

// Loading components
Vue.component('filesystem', Vue.extend(Filesystem));
Vue.component('login', Vue.extend(Login));
Vue.component('signup', Vue.extend(Signup));

// Initializing Vue
var peergos = new Vue({
    el: 'body',
    mixins: [ VueFocus.mixin ],
    data: {
        currentView: 'login',
        serverPort: 8000
    }
});
