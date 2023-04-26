var Account         = require('./components/account');
var Admin           = require('./components/admin');
var Choice         = require('./components/choice');
var CodeEditor      = require('./components/code-editor');
var Downloader      = require('./components/downloader');
var Error           = require('./components/error');
var Fingerprint     = require('./components/fingerprint');
var FolderPicker         = require('./components/picker/FolderPicker.vue');
var Hex             = require('./components/viewers/hex.vue');
var Identity        = require('./components/identity-proof-viewer.vue');
var Message         = require('./components/message');
var Password        = require('./components/password');
var PasswordUtil    = require('./components/passwordutil');
var Pdf             = require('./components/pdf');
var Prompt          = require('./components/prompt');
var Replace         = require('./components/replace');
var SelectCreate    = require('./components/select-create');
var Spinner         = require('./components/spinner');
var Text            = require('./components/viewers/text-viewer');
var Confirm         = require('./components/confirm');
var Warning         = require('./components/warning.vue');

var AppButton 		= require('./components/AppButton.vue');
var AppIcon 		= require('./components/AppIcon.vue');
var AppModal 		= require('./components/modal/AppModal.vue');
var App  			= require('./components/App.vue');

// Loading components
Vue.component('account', Vue.extend(Account));
Vue.component('admin', Vue.extend(Admin));
Vue.component('choice', Vue.extend(Choice));
Vue.component('code-editor', Vue.extend(Downloader).extend(CodeEditor));
Vue.component('error', Vue.extend(Error));
Vue.component('fingerprint', Vue.extend(Fingerprint));
Vue.component('hex', Vue.extend(Downloader).extend(Hex));
Vue.component('identity', Vue.extend(Downloader).extend(Identity));
Vue.component('message', Vue.extend(Message));
Vue.component('password', Vue.extend(PasswordUtil).extend(Password));
Vue.component('pdf', Vue.extend(Downloader).extend(Pdf));
Vue.component('prompt', Vue.extend(Prompt));
Vue.component('replace', Vue.extend(Replace));
Vue.component('select-create', Vue.extend(SelectCreate));
Vue.component('spinner', Vue.extend(Spinner));
Vue.component('text-viewer', Vue.extend(Downloader).extend(Text));
Vue.component('confirm', Vue.extend(Confirm));
Vue.component('warning', Vue.extend(Warning));

Vue.component('App', Vue.extend(App));
Vue.component('AppButton', Vue.extend(AppButton));
Vue.component('AppIcon', Vue.extend(AppIcon));
Vue.component('AppModal', Vue.extend(AppModal));
Vue.component('FolderPicker', Vue.extend(FolderPicker));

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
