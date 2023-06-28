
import { createApp } from 'vue'
import App from './components/App.vue'
// // import Vuex from "vuex"
import Vue from 'vue'

Vue.directive('focus', {
  inserted: function (el) {
    // Focus the element
    el.focus()
  }
})

Vue.config.productionTip = false;

// Vue.use(Vuex);
import store from './store'
import Vue3Toastify from 'vue3-toastify';
import { toast } from 'vue3-toastify';

// Initializing Vue after GWT has finished
setTimeout(function() {
    // createApp(App).provide('store', store).mount('#app');
    createApp(App)
        .use(store)
        .use(Vue3Toastify, {
            autoClose: 3000,
            limit: 3,
            position: toast.POSITION.BOTTOM_RIGHT,
            hideProgressBar: true,
        }).mount('#app');
console.log("█╗█╗█╗█╗   ██████╗ ███████╗███████╗██████╗  ██████╗  ██████╗ ███████╗   █╗█╗█╗█╗\n" +
            " █████╔╝   ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝ ██╔═══██╗██╔════╝    █████╔╝\n" +
            " ██ ██║    ██████╔╝█████╗  █████╗  ██████╔╝██║  ███╗██║   ██║███████╗    ██ ██║\n" +
            " █████║    ██╔═══╝ ██╔══╝  ██╔══╝  ██╔══██╗██║   ██║██║   ██║╚════██║    █████║\n" +
            "███████╗   ██║     ███████╗███████╗██║  ██║╚██████╔╝╚██████╔╝███████║   ███████╗\n" +
            "╚══════╝   ╚═╝     ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝   ╚══════╝");    
}, 500);

