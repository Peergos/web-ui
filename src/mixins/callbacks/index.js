// Callbacks handed to peergos's Java. Supplier and BiConsumer are @JsFunction from peergos e56073364, so they
// take plain functions; before that GWT called them by its compiled method names (get_0, accept_2, ...), which
// change from build to build. These work with either, until the submodule is past that commit.
module.exports = {
    supplier(fn) {
        fn.get_0 = fn;
        return fn;
    },
    biConsumer(fn) {
        return new Proxy(fn, {get: (target, key) => typeof key === 'string' && key.startsWith('accept') ? fn : Reflect.get(target, key)});
    },
};
