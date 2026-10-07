// Replaces vue-toastification, keeping its $toast API and DOM classes so callers and CSS are unchanged.
// It renders through <Toaster/> in App.vue.

const POSITIONS = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

const defaults = {
    type: "default",
    position: "top-right",
    timeout: 5000,
    icon: true,
    closeButton: "button",
    closeOnClick: true,
    showCloseButtonOnHover: false,
    pauseOnHover: true,
    pauseOnFocusLoss: true,
    draggable: true,
    toastClassName: [],
    maxToasts: 20,
    newestOnTop: true,
    filterBeforeCreate: toast => toast,
};

const state = Vue.reactive({
    toasts: [],
    options: Object.assign({}, defaults),
});

let nextId = 0;

function raw(content) {
    if (content != null && typeof content === "object" && content.component != null)
        Vue.markRaw(content.component);
    return content;
}

function indexOf(id) {
    return state.toasts.findIndex(t => t.id === id);
}

function setToast(toast) {
    let i = indexOf(toast.id);
    if (i >= 0)
        state.toasts.splice(i, 1, toast);
    else
        state.toasts.push(toast);
}

function addToast(params) {
    let toast = Object.assign({}, state.options, params);
    delete toast.maxToasts;
    delete toast.newestOnTop;
    delete toast.filterBeforeCreate;
    toast = state.options.filterBeforeCreate(toast, state.toasts.slice());
    if (toast)
        setToast(toast);
}

function toast(content, options) {
    let props = Object.assign({id: nextId++, type: defaults.type}, options, {content: raw(content)});
    addToast(props);
    return props.id;
}

function dismiss(id) {
    let i = indexOf(id);
    if (i < 0)
        return;
    let removed = state.toasts.splice(i, 1)[0];
    if (removed.onClose != null)
        removed.onClose();
}

toast.dismiss = dismiss;

toast.clear = function() {
    state.toasts.slice().forEach(t => dismiss(t.id));
};

toast.update = function(id, update, create) {
    let options = Object.assign({}, update.options);
    if (update.content !== undefined)
        options.content = raw(update.content);
    let i = indexOf(id);
    if (i >= 0) {
        // a fresh object, so the toast's timer restarts on an update that sets a timeout
        let next = Object.assign({}, state.toasts[i], options);
        next.updated = (state.toasts[i].updated || 0) + 1;
        setToast(next);
    } else if (create) {
        addToast(Object.assign({id: id}, options));
    }
};

toast.updateDefaults = function(update) {
    Object.assign(state.options, update);
};

["success", "info", "error", "warning"].forEach(type => {
    toast[type] = (content, options) => toast(content, Object.assign({}, options, {type: type}));
});

function visible(position) {
    let shown = state.toasts.filter(t => t.position === position).slice(0, state.options.maxToasts);
    return state.options.newestOnTop ? shown.reverse() : shown;
}

module.exports = {
    POSITIONS: POSITIONS,
    state: state,
    toast: toast,
    visible: visible,
    install: function(app, options) {
        Object.assign(state.options, options);
        app.config.globalProperties.$toast = toast;
    },
};
