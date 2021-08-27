var Account         = require('./components/account');
var Admin           = require('./components/admin');
var AppGrid         = require('./components/appgrid');
var Calendar        = require('./components/calendar');
var Chat            = require('./components/chat');
var Choice         = require('./components/choice');
var CodeEditor      = require('./components/code-editor');
var Downloader      = require('./components/downloader');
var Error           = require('./components/error');
var Feedback        = require('./components/feedback');
var Filesystem      = require('./components/filesystem');
var Fingerprint     = require('./components/fingerprint');
var Gallery         = require('./components/gallery');
var Group           = require('./components/group');
var Hex             = require('./components/viewers/hex');
var Message         = require('./components/message');
var Modal           = require('./components/modal');
var Password        = require('./components/password');
var ProfileEdit     = require('./components/profile/edit-profile');
var ProfileView     = require('./components/profile/view-profile');
var PasswordUtil    = require('./components/passwordutil');
var Payments        = require('./components/payment');
var Pdf             = require('./components/pdf');
var MessageBar     = require('./components/messagebar');
var Prompt          = require('./components/prompt');
var Replace         = require('./components/replace');
var Search          = require('./components/search');
var SelectCreate    = require('./components/select-create');
var Share           = require('./components/share');
var Social          = require('./components/social');
var SocialPost      = require('./components/social-post');
var Space           = require('./components/space');
var Spinner         = require('./components/spinner');
var Text            = require('./components/viewers/text-viewer');
var Timeline        = require('./components/timeline');
var Todo            = require('./components/todo');
var Tour            = require('./components/tour');
var Confirm         = require('./components/confirm');
var Warning         = require('./components/warning.vue');

var AppButton 		= require('./components/AppButton.vue');
var AppIcon 		= require('./components/AppIcon.vue');
var AppModal 		= require('./components/modal/AppModal.vue');
var App  			= require('./components/App.vue');
var Filesystem 		= require('./components/Filesystem.vue');

// var ModalSpace 		= require('./components/modal/ModalSpace.vue');


// Loading components
Vue.component('account', Vue.extend(Account));
Vue.component('admin', Vue.extend(Admin));
Vue.component('appgrid', Vue.extend(AppGrid));
Vue.component('calendar', Vue.extend(Calendar));
Vue.component('chat', Vue.extend(Downloader).extend(Chat));
Vue.component('choice', Vue.extend(Choice));
Vue.component('code-editor', Vue.extend(Downloader).extend(CodeEditor));
Vue.component('error', Vue.extend(Error));
Vue.component('feedback', Vue.extend(Feedback));
Vue.component('filesystem', Vue.extend(Downloader).extend(Filesystem));
Vue.component('fingerprint', Vue.extend(Fingerprint));
Vue.component('gallery', Vue.extend(Downloader).extend(Gallery));
Vue.component('group', Vue.extend(Group));
Vue.component('hex', Vue.extend(Downloader).extend(Hex));
Vue.component('message', Vue.extend(Message));
Vue.component('modal', Vue.extend(Modal));
Vue.component('password', Vue.extend(PasswordUtil).extend(Password));
Vue.component('profile-edit', Vue.extend(ProfileEdit));
Vue.component('profile-view', Vue.extend(ProfileView));
Vue.component('payment', Vue.extend(Payments));
Vue.component('pdf', Vue.extend(Downloader).extend(Pdf));
Vue.component('messagebar', Vue.extend(MessageBar));
Vue.component('prompt', Vue.extend(Prompt));
Vue.component('replace', Vue.extend(Replace));
Vue.component('search', Vue.extend(Search));
Vue.component('select-create', Vue.extend(SelectCreate));
Vue.component('share', Vue.extend(Share));
Vue.component('social', Vue.extend(Social));
Vue.component('social-post', Vue.extend(SocialPost));
Vue.component('spinner', Vue.extend(Spinner));
Vue.component('space', Vue.extend(Space));
Vue.component('text-viewer', Vue.extend(Downloader).extend(Text));
Vue.component('timeline', Vue.extend(Timeline));
Vue.component('todo-board', Vue.extend(Downloader).extend(Todo));
Vue.component('tour', Vue.extend(Tour));
Vue.component('confirm', Vue.extend(Confirm));
Vue.component('warning', Vue.extend(Warning));

Vue.component('App', Vue.extend(App));
Vue.component('AppButton', Vue.extend(AppButton));
Vue.component('AppIcon', Vue.extend(AppIcon));
Vue.component('AppModal', Vue.extend(AppModal));
Vue.component('Filesystem', Vue.extend(Downloader).extend(Filesystem));

// Vue.component('ModalSpace', Vue.extend(ModalSpace));



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
