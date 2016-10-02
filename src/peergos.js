var Filesystem  = require('./components/filesystem');
var Login       = require('./components/login');
var Signup      = require('./components/signup');

var VueAsyncComputed = require('./plugins/vue-async-computed');
Vue.use(VueAsyncComputed);

// Loading components
Vue.component('filesystem', Vue.extend(Filesystem));
Vue.component('login', Vue.extend(Login));
Vue.component('signup', Vue.extend(Signup));

// Initializing Vue after GWT has finished
// TODO figure out a way to ensure GWT has loaded
setTimeout(function() {
    var vueRoot = new Vue({
	el: 'body',
	data: {
            currentView: 'login',
            serverPort: 8000
	},
	events: {
	    'child-msg': function (msg) {
		// `this` in event callbacks are automatically bound
		// to the instance that registered it
		this.currentView = msg.view;
		
		// this sends the received props to the new child component
		this.$nextTick(function() {
		    this.$broadcast('parent-msg', msg.props);
		});
	    }
	}
    });
}, 500);
