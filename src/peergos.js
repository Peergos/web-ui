var App = require('./components/App.vue');

var store = require('./store/index.js');
const ProgressBar = require('./components/drive/ProgressBar.vue');
const toasts = require('./components/toast/index.js');

const ToastOptions = {
	hideProgressBar: true,
	maxToasts: 3,
	showCloseButtonOnHover: true,
	position: 'bottom-right',
	filterBeforeCreate: toast => {
		if (toast.content != null && toast.content.component === ProgressBar) {
			toast.closeOnClick = false;
			toast.showCloseButtonOnHover = false;
			toast.toastClassName = 'progress-toast';
		}
		return toast;
	}
};

// Vue wraps reactive state in proxies; a proxied Java object breaks Java's == and has every
// field read tracked. __v_skip on java.lang.Object's prototype (the one with GWT's typeMarker)
// keeps them raw, as markRaw would.
function markJavaObjectsRaw() {
    let p = Object.getPrototypeOf(java.util.Optional.empty());
    while (p != null && ! Object.prototype.hasOwnProperty.call(p, "typeMarker"))
        p = Object.getPrototypeOf(p);
    if (p != null)
        Object.defineProperty(p, "__v_skip", {value: true});
}

// Initializing Vue after GWT has finished
setTimeout(function() {
    markJavaObjectsRaw();
    const app = Vue.createApp(App);
    app.directive('focus', {
        mounted: el => el.focus()
    });
    app.use(store);
    app.use(toasts, ToastOptions);
    app.mount('#app');
}, 500);

console.log("█╗█╗█╗█╗   ██████╗ ███████╗███████╗██████╗  ██████╗  ██████╗ ███████╗   █╗█╗█╗█╗\n" +
            " █████╔╝   ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝ ██╔═══██╗██╔════╝    █████╔╝\n" +
            " ██ ██║    ██████╔╝█████╗  █████╗  ██████╔╝██║  ███╗██║   ██║███████╗    ██ ██║\n" +
            " █████║    ██╔═══╝ ██╔══╝  ██╔══╝  ██╔══██╗██║   ██║██║   ██║╚════██║    █████║\n" +
            "███████╗   ██║     ███████╗███████╗██║  ██║╚██████╔╝╚██████╔╝███████║   ███████╗\n" +
            "╚══════╝   ╚═╝     ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝   ╚══════╝");
