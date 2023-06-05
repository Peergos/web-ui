
var App  			= require('./components/App.vue');
Vue.component('App', Vue.extend(App));

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
