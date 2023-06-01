var CodeEditor      = require('./components/code-editor');
var Password        = require('./components/password');
var PasswordUtil    = require('./components/passwordutil');
var SelectCreate    = require('./components/select-create');
var Spinner         = require('./components/spinner');
var Text            = require('./components/viewers/text-viewer');
var Warning         = require('./components/warning.vue');

var AppButton 		= require('./components/AppButton.vue');
var AppIcon 		= require('./components/AppIcon.vue');
var AppModal 		= require('./components/modal/AppModal.vue');
var App  			= require('./components/App.vue');

// Loading components
Vue.component('code-editor', Vue.extend(CodeEditor));
Vue.component('password', Vue.extend(PasswordUtil).extend(Password));
Vue.component('select-create', Vue.extend(SelectCreate));
Vue.component('spinner', Vue.extend(Spinner));
Vue.component('text-viewer', Vue.extend(Text));
Vue.component('warning', Vue.extend(Warning));

Vue.component('App', Vue.extend(App));
Vue.component('AppButton', Vue.extend(AppButton));
Vue.component('AppIcon', Vue.extend(AppIcon));
Vue.component('AppModal', Vue.extend(AppModal));

Vue.directive('focus', {
  inserted: function (el) {
    // Focus the element
    el.focus()
  }
})

Vue.config.productionTip = false;

Vue.use(Vuex);
var store = require('./store/index.js');

const ToastOptions = {
	hideProgressBar: true,
	maxToasts: 3,
	showCloseButtonOnHover: true,
	position: 'bottom-right'
};

Vue.use( VueToastification.default, ToastOptions);

// Initializing Vue after GWT has finished
setTimeout(function() {
    var vueRoot = new Vue({
		el: '#app',
		store,
        data: {
            currentView: 'App',
        },
        render: function() {
            with(this){return _c('div',{staticClass:"fillspace",attrs:{"id":"app"}},[_c(currentView,{tag:"component"})],1)}
        }
    });
}, 500);

console.log("█╗█╗█╗█╗   ██████╗ ███████╗███████╗██████╗  ██████╗  ██████╗ ███████╗   █╗█╗█╗█╗\n" +
            " █████╔╝   ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝ ██╔═══██╗██╔════╝    █████╔╝\n" +
            " ██ ██║    ██████╔╝█████╗  █████╗  ██████╔╝██║  ███╗██║   ██║███████╗    ██ ██║\n" +
            " █████║    ██╔═══╝ ██╔══╝  ██╔══╝  ██╔══██╗██║   ██║██║   ██║╚════██║    █████║\n" +
            "███████╗   ██║     ███████╗███████╗██║  ██║╚██████╔╝╚██████╔╝███████║   ███████╗\n" +
            "╚══════╝   ╚═╝     ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝   ╚══════╝");
