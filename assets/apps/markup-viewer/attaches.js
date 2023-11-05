/**
 * Skipped minification because the original files appears to be already minified.
 * Original file: /npm/@editorjs/attaches@1.3.0/dist/bundle.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
!function(e, t) {
    "object" == typeof exports && "object" == typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : "object" == typeof exports ? exports.AttachesTool = t() : e.AttachesTool = t()
}(window, (function() {
    return function(e) {
        var t = {};
        function n(r) {
            if (t[r])
                return t[r].exports;
            var o = t[r] = {
                i: r,
                l: !1,
                exports: {}
            };
            return e[r].call(o.exports, o, o.exports, n),
            o.l = !0,
            o.exports
        }
        return n.m = e,
        n.c = t,
        n.d = function(e, t, r) {
            n.o(e, t) || Object.defineProperty(e, t, {
                enumerable: !0,
                get: r
            })
        }
        ,
        n.r = function(e) {
            "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
                value: "Module"
            }),
            Object.defineProperty(e, "__esModule", {
                value: !0
            })
        }
        ,
        n.t = function(e, t) {
            if (1 & t && (e = n(e)),
            8 & t)
                return e;
            if (4 & t && "object" == typeof e && e && e.__esModule)
                return e;
            var r = Object.create(null);
            if (n.r(r),
            Object.defineProperty(r, "default", {
                enumerable: !0,
                value: e
            }),
            2 & t && "string" != typeof e)
                for (var o in e)
                    n.d(r, o, function(t) {
                        return e[t]
                    }
                    .bind(null, o));
            return r
        }
        ,
        n.n = function(e) {
            var t = e && e.__esModule ? function() {
                return e.default
            }
            : function() {
                return e
            }
            ;
            return n.d(t, "a", t),
            t
        }
        ,
        n.o = function(e, t) {
            return Object.prototype.hasOwnProperty.call(e, t)
        }
        ,
        n.p = "/",
        n(n.s = 6)
    }([function(e, t, n) {
        window,
        e.exports = function(e) {
            var t = {};
            function n(r) {
                if (t[r])
                    return t[r].exports;
                var o = t[r] = {
                    i: r,
                    l: !1,
                    exports: {}
                };
                return e[r].call(o.exports, o, o.exports, n),
                o.l = !0,
                o.exports
            }
            return n.m = e,
            n.c = t,
            n.d = function(e, t, r) {
                n.o(e, t) || Object.defineProperty(e, t, {
                    enumerable: !0,
                    get: r
                })
            }
            ,
            n.r = function(e) {
                "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
                    value: "Module"
                }),
                Object.defineProperty(e, "__esModule", {
                    value: !0
                })
            }
            ,
            n.t = function(e, t) {
                if (1 & t && (e = n(e)),
                8 & t)
                    return e;
                if (4 & t && "object" == typeof e && e && e.__esModule)
                    return e;
                var r = Object.create(null);
                if (n.r(r),
                Object.defineProperty(r, "default", {
                    enumerable: !0,
                    value: e
                }),
                2 & t && "string" != typeof e)
                    for (var o in e)
                        n.d(r, o, function(t) {
                            return e[t]
                        }
                        .bind(null, o));
                return r
            }
            ,
            n.n = function(e) {
                var t = e && e.__esModule ? function() {
                    return e.default
                }
                : function() {
                    return e
                }
                ;
                return n.d(t, "a", t),
                t
            }
            ,
            n.o = function(e, t) {
                return Object.prototype.hasOwnProperty.call(e, t)
            }
            ,
            n.p = "",
            n(n.s = 3)
        }([function(e, t) {
            var n;
            n = function() {
                return this
            }();
            try {
                n = n || new Function("return this")()
            } catch (e) {
                "object" == typeof window && (n = window)
            }
            e.exports = n
        }
        , function(e, t, n) {
            "use strict";
            (function(e) {
                var r = n(2)
                  , o = setTimeout;
                function i() {}
                function a(e) {
                    if (!(this instanceof a))
                        throw new TypeError("Promises must be constructed via new");
                    if ("function" != typeof e)
                        throw new TypeError("not a function");
                    this._state = 0,
                    this._handled = !1,
                    this._value = void 0,
                    this._deferreds = [],
                    d(e, this)
                }
                function s(e, t) {
                    for (; 3 === e._state; )
                        e = e._value;
                    0 !== e._state ? (e._handled = !0,
                    a._immediateFn((function() {
                        var n = 1 === e._state ? t.onFulfilled : t.onRejected;
                        if (null !== n) {
                            var r;
                            try {
                                r = n(e._value)
                            } catch (e) {
                                return void l(t.promise, e)
                            }
                            c(t.promise, r)
                        } else
                            (1 === e._state ? c : l)(t.promise, e._value)
                    }
                    ))) : e._deferreds.push(t)
                }
                function c(e, t) {
                    try {
                        if (t === e)
                            throw new TypeError("A promise cannot be resolved with itself.");
                        if (t && ("object" == typeof t || "function" == typeof t)) {
                            var n = t.then;
                            if (t instanceof a)
                                return e._state = 3,
                                e._value = t,
                                void u(e);
                            if ("function" == typeof n)
                                return void d((r = n,
                                o = t,
                                function() {
                                    r.apply(o, arguments)
                                }
                                ), e)
                        }
                        e._state = 1,
                        e._value = t,
                        u(e)
                    } catch (t) {
                        l(e, t)
                    }
                    var r, o
                }
                function l(e, t) {
                    e._state = 2,
                    e._value = t,
                    u(e)
                }
                function u(e) {
                    2 === e._state && 0 === e._deferreds.length && a._immediateFn((function() {
                        e._handled || a._unhandledRejectionFn(e._value)
                    }
                    ));
                    for (var t = 0, n = e._deferreds.length; t < n; t++)
                        s(e, e._deferreds[t]);
                    e._deferreds = null
                }
                function f(e, t, n) {
                    this.onFulfilled = "function" == typeof e ? e : null,
                    this.onRejected = "function" == typeof t ? t : null,
                    this.promise = n
                }
                function d(e, t) {
                    var n = !1;
                    try {
                        e((function(e) {
                            n || (n = !0,
                            c(t, e))
                        }
                        ), (function(e) {
                            n || (n = !0,
                            l(t, e))
                        }
                        ))
                    } catch (e) {
                        if (n)
                            return;
                        n = !0,
                        l(t, e)
                    }
                }
                a.prototype.catch = function(e) {
                    return this.then(null, e)
                }
                ,
                a.prototype.then = function(e, t) {
                    var n = new this.constructor(i);
                    return s(this, new f(e,t,n)),
                    n
                }
                ,
                a.prototype.finally = r.a,
                a.all = function(e) {
                    return new a((function(t, n) {
                        if (!e || void 0 === e.length)
                            throw new TypeError("Promise.all accepts an array");
                        var r = Array.prototype.slice.call(e);
                        if (0 === r.length)
                            return t([]);
                        var o = r.length;
                        function i(e, a) {
                            try {
                                if (a && ("object" == typeof a || "function" == typeof a)) {
                                    var s = a.then;
                                    if ("function" == typeof s)
                                        return void s.call(a, (function(t) {
                                            i(e, t)
                                        }
                                        ), n)
                                }
                                r[e] = a,
                                0 == --o && t(r)
                            } catch (e) {
                                n(e)
                            }
                        }
                        for (var a = 0; a < r.length; a++)
                            i(a, r[a])
                    }
                    ))
                }
                ,
                a.resolve = function(e) {
                    return e && "object" == typeof e && e.constructor === a ? e : new a((function(t) {
                        t(e)
                    }
                    ))
                }
                ,
                a.reject = function(e) {
                    return new a((function(t, n) {
                        n(e)
                    }
                    ))
                }
                ,
                a.race = function(e) {
                    return new a((function(t, n) {
                        for (var r = 0, o = e.length; r < o; r++)
                            e[r].then(t, n)
                    }
                    ))
                }
                ,
                a._immediateFn = "function" == typeof e && function(t) {
                    e(t)
                }
                || function(e) {
                    o(e, 0)
                }
                ,
                a._unhandledRejectionFn = function(e) {
                    "undefined" != typeof console && console && console.warn("Possible Unhandled Promise Rejection:", e)
                }
                ,
                t.a = a
            }
            ).call(this, n(5).setImmediate)
        }
        , function(e, t, n) {
            "use strict";
            t.a = function(e) {
                var t = this.constructor;
                return this.then((function(n) {
                    return t.resolve(e()).then((function() {
                        return n
                    }
                    ))
                }
                ), (function(n) {
                    return t.resolve(e()).then((function() {
                        return t.reject(n)
                    }
                    ))
                }
                ))
            }
        }
        , function(e, t, n) {
            "use strict";
            function r(e) {
                return (r = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
                    return typeof e
                }
                : function(e) {
                    return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e
                }
                )(e)
            }
            n(4);
            var o, i, a, s, c, l, u, f = n(8), d = (i = function(e) {
                return new Promise((function(t, n) {
                    e = s(e),
                    (e = c(e)).beforeSend && e.beforeSend();
                    var r = window.XMLHttpRequest ? new window.XMLHttpRequest : new window.ActiveXObject("Microsoft.XMLHTTP");
                    r.open(e.method, e.url),
                    r.setRequestHeader("X-Requested-With", "XMLHttpRequest"),
                    Object.keys(e.headers).forEach((function(t) {
                        var n = e.headers[t];
                        r.setRequestHeader(t, n)
                    }
                    ));
                    var o = e.ratio;
                    r.upload.addEventListener("progress", (function(t) {
                        var n = Math.round(t.loaded / t.total * 100)
                          , r = Math.ceil(n * o / 100);
                        e.progress(Math.min(r, 100))
                    }
                    ), !1),
                    r.addEventListener("progress", (function(t) {
                        var n = Math.round(t.loaded / t.total * 100)
                          , r = Math.ceil(n * (100 - o) / 100) + o;
                        e.progress(Math.min(r, 100))
                    }
                    ), !1),
                    r.onreadystatechange = function() {
                        if (4 === r.readyState) {
                            var e = r.response;
                            try {
                                e = JSON.parse(e)
                            } catch (e) {}
                            var o = f.parseHeaders(r.getAllResponseHeaders())
                              , i = {
                                body: e,
                                code: r.status,
                                headers: o
                            };
                            u(r.status) ? t(i) : n(i)
                        }
                    }
                    ,
                    r.send(e.data)
                }
                ))
            }
            ,
            a = function(e) {
                return e.method = "POST",
                i(e)
            }
            ,
            s = function() {
                var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                if (e.url && "string" != typeof e.url)
                    throw new Error("Url must be a string");
                if (e.url = e.url || "",
                e.method && "string" != typeof e.method)
                    throw new Error("`method` must be a string or null");
                if (e.method = e.method ? e.method.toUpperCase() : "GET",
                e.headers && "object" !== r(e.headers))
                    throw new Error("`headers` must be an object or null");
                if (e.headers = e.headers || {},
                e.type && ("string" != typeof e.type || !Object.values(o).includes(e.type)))
                    throw new Error("`type` must be taken from module's «contentType» library");
                if (e.progress && "function" != typeof e.progress)
                    throw new Error("`progress` must be a function or null");
                if (e.progress = e.progress || function(e) {}
                ,
                e.beforeSend = e.beforeSend || function(e) {}
                ,
                e.ratio && "number" != typeof e.ratio)
                    throw new Error("`ratio` must be a number");
                if (e.ratio < 0 || e.ratio > 100)
                    throw new Error("`ratio` must be in a 0-100 interval");
                if (e.ratio = e.ratio || 90,
                e.accept && "string" != typeof e.accept)
                    throw new Error("`accept` must be a string with a list of allowed mime-types");
                if (e.accept = e.accept || "*/*",
                e.multiple && "boolean" != typeof e.multiple)
                    throw new Error("`multiple` must be a true or false");
                if (e.multiple = e.multiple || !1,
                e.fieldName && "string" != typeof e.fieldName)
                    throw new Error("`fieldName` must be a string");
                return e.fieldName = e.fieldName || "files",
                e
            }
            ,
            c = function(e) {
                switch (e.method) {
                case "GET":
                    var t = l(e.data, o.URLENCODED);
                    delete e.data,
                    e.url = /\?/.test(e.url) ? e.url + "&" + t : e.url + "?" + t;
                    break;
                case "POST":
                case "PUT":
                case "DELETE":
                case "UPDATE":
                    var n = function() {
                        return (arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}).type || o.JSON
                    }(e);
                    (f.isFormData(e.data) || f.isFormElement(e.data)) && (n = o.FORM),
                    e.data = l(e.data, n),
                    n !== d.contentType.FORM && (e.headers["content-type"] = n)
                }
                return e
            }
            ,
            l = function() {
                var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                switch (arguments.length > 1 ? arguments[1] : void 0) {
                case o.URLENCODED:
                    return f.urlEncode(e);
                case o.JSON:
                    return f.jsonEncode(e);
                case o.FORM:
                    return f.formEncode(e);
                default:
                    return e
                }
            }
            ,
            u = function(e) {
                return e >= 200 && e < 300
            }
            ,
            {
                contentType: o = {
                    URLENCODED: "application/x-www-form-urlencoded; charset=utf-8",
                    FORM: "multipart/form-data",
                    JSON: "application/json; charset=utf-8"
                },
                request: i,
                get: function(e) {
                    return e.method = "GET",
                    i(e)
                },
                post: a,
                transport: function(e) {
                    return e = s(e),
                    f.selectFiles(e).then((function(t) {
                        for (var n = new FormData, r = 0; r < t.length; r++)
                            n.append(e.fieldName, t[r], t[r].name);
                        f.isObject(e.data) && Object.keys(e.data).forEach((function(t) {
                            var r = e.data[t];
                            n.append(t, r)
                        }
                        ));
                        var o = e.beforeSend;
                        return e.beforeSend = function() {
                            return o(t)
                        }
                        ,
                        e.data = n,
                        a(e)
                    }
                    ))
                },
                selectFiles: function(e) {
                    return delete (e = s(e)).beforeSend,
                    f.selectFiles(e)
                }
            });
            e.exports = d
        }
        , function(e, t, n) {
            "use strict";
            n.r(t);
            var r = n(1);
            window.Promise = window.Promise || r.a
        }
        , function(e, t, n) {
            (function(e) {
                var r = void 0 !== e && e || "undefined" != typeof self && self || window
                  , o = Function.prototype.apply;
                function i(e, t) {
                    this._id = e,
                    this._clearFn = t
                }
                t.setTimeout = function() {
                    return new i(o.call(setTimeout, r, arguments),clearTimeout)
                }
                ,
                t.setInterval = function() {
                    return new i(o.call(setInterval, r, arguments),clearInterval)
                }
                ,
                t.clearTimeout = t.clearInterval = function(e) {
                    e && e.close()
                }
                ,
                i.prototype.unref = i.prototype.ref = function() {}
                ,
                i.prototype.close = function() {
                    this._clearFn.call(r, this._id)
                }
                ,
                t.enroll = function(e, t) {
                    clearTimeout(e._idleTimeoutId),
                    e._idleTimeout = t
                }
                ,
                t.unenroll = function(e) {
                    clearTimeout(e._idleTimeoutId),
                    e._idleTimeout = -1
                }
                ,
                t._unrefActive = t.active = function(e) {
                    clearTimeout(e._idleTimeoutId);
                    var t = e._idleTimeout;
                    t >= 0 && (e._idleTimeoutId = setTimeout((function() {
                        e._onTimeout && e._onTimeout()
                    }
                    ), t))
                }
                ,
                n(6),
                t.setImmediate = "undefined" != typeof self && self.setImmediate || void 0 !== e && e.setImmediate || this && this.setImmediate,
                t.clearImmediate = "undefined" != typeof self && self.clearImmediate || void 0 !== e && e.clearImmediate || this && this.clearImmediate
            }
            ).call(this, n(0))
        }
        , function(e, t, n) {
            (function(e, t) {
                !function(e, n) {
                    "use strict";
                    if (!e.setImmediate) {
                        var r, o, i, a, s, c = 1, l = {}, u = !1, f = e.document, d = Object.getPrototypeOf && Object.getPrototypeOf(e);
                        d = d && d.setTimeout ? d : e,
                        "[object process]" === {}.toString.call(e.process) ? r = function(e) {
                            t.nextTick((function() {
                                h(e)
                            }
                            ))
                        }
                        : function() {
                            if (e.postMessage && !e.importScripts) {
                                var t = !0
                                  , n = e.onmessage;
                                return e.onmessage = function() {
                                    t = !1
                                }
                                ,
                                e.postMessage("", "*"),
                                e.onmessage = n,
                                t
                            }
                        }() ? (a = "setImmediate$" + Math.random() + "$",
                        s = function(t) {
                            t.source === e && "string" == typeof t.data && 0 === t.data.indexOf(a) && h(+t.data.slice(a.length))
                        }
                        ,
                        e.addEventListener ? e.addEventListener("message", s, !1) : e.attachEvent("onmessage", s),
                        r = function(t) {
                            e.postMessage(a + t, "*")
                        }
                        ) : e.MessageChannel ? ((i = new MessageChannel).port1.onmessage = function(e) {
                            h(e.data)
                        }
                        ,
                        r = function(e) {
                            i.port2.postMessage(e)
                        }
                        ) : f && "onreadystatechange"in f.createElement("script") ? (o = f.documentElement,
                        r = function(e) {
                            var t = f.createElement("script");
                            t.onreadystatechange = function() {
                                h(e),
                                t.onreadystatechange = null,
                                o.removeChild(t),
                                t = null
                            }
                            ,
                            o.appendChild(t)
                        }
                        ) : r = function(e) {
                            setTimeout(h, 0, e)
                        }
                        ,
                        d.setImmediate = function(e) {
                            "function" != typeof e && (e = new Function("" + e));
                            for (var t = new Array(arguments.length - 1), n = 0; n < t.length; n++)
                                t[n] = arguments[n + 1];
                            var o = {
                                callback: e,
                                args: t
                            };
                            return l[c] = o,
                            r(c),
                            c++
                        }
                        ,
                        d.clearImmediate = p
                    }
                    function p(e) {
                        delete l[e]
                    }
                    function h(e) {
                        if (u)
                            setTimeout(h, 0, e);
                        else {
                            var t = l[e];
                            if (t) {
                                u = !0;
                                try {
                                    !function(e) {
                                        var t = e.callback
                                          , n = e.args;
                                        switch (n.length) {
                                        case 0:
                                            t();
                                            break;
                                        case 1:
                                            t(n[0]);
                                            break;
                                        case 2:
                                            t(n[0], n[1]);
                                            break;
                                        case 3:
                                            t(n[0], n[1], n[2]);
                                            break;
                                        default:
                                            t.apply(void 0, n)
                                        }
                                    }(t)
                                } finally {
                                    p(e),
                                    u = !1
                                }
                            }
                        }
                    }
                }("undefined" == typeof self ? void 0 === e ? this : e : self)
            }
            ).call(this, n(0), n(7))
        }
        , function(e, t) {
            var n, r, o = e.exports = {};
            function i() {
                throw new Error("setTimeout has not been defined")
            }
            function a() {
                throw new Error("clearTimeout has not been defined")
            }
            function s(e) {
                if (n === setTimeout)
                    return setTimeout(e, 0);
                if ((n === i || !n) && setTimeout)
                    return n = setTimeout,
                    setTimeout(e, 0);
                try {
                    return n(e, 0)
                } catch (t) {
                    try {
                        return n.call(null, e, 0)
                    } catch (t) {
                        return n.call(this, e, 0)
                    }
                }
            }
            !function() {
                try {
                    n = "function" == typeof setTimeout ? setTimeout : i
                } catch (e) {
                    n = i
                }
                try {
                    r = "function" == typeof clearTimeout ? clearTimeout : a
                } catch (e) {
                    r = a
                }
            }();
            var c, l = [], u = !1, f = -1;
            function d() {
                u && c && (u = !1,
                c.length ? l = c.concat(l) : f = -1,
                l.length && p())
            }
            function p() {
                if (!u) {
                    var e = s(d);
                    u = !0;
                    for (var t = l.length; t; ) {
                        for (c = l,
                        l = []; ++f < t; )
                            c && c[f].run();
                        f = -1,
                        t = l.length
                    }
                    c = null,
                    u = !1,
                    function(e) {
                        if (r === clearTimeout)
                            return clearTimeout(e);
                        if ((r === a || !r) && clearTimeout)
                            return r = clearTimeout,
                            clearTimeout(e);
                        try {
                            r(e)
                        } catch (t) {
                            try {
                                return r.call(null, e)
                            } catch (t) {
                                return r.call(this, e)
                            }
                        }
                    }(e)
                }
            }
            function h(e, t) {
                this.fun = e,
                this.array = t
            }
            function m() {}
            o.nextTick = function(e) {
                var t = new Array(arguments.length - 1);
                if (arguments.length > 1)
                    for (var n = 1; n < arguments.length; n++)
                        t[n - 1] = arguments[n];
                l.push(new h(e,t)),
                1 !== l.length || u || s(p)
            }
            ,
            h.prototype.run = function() {
                this.fun.apply(null, this.array)
            }
            ,
            o.title = "browser",
            o.browser = !0,
            o.env = {},
            o.argv = [],
            o.version = "",
            o.versions = {},
            o.on = m,
            o.addListener = m,
            o.once = m,
            o.off = m,
            o.removeListener = m,
            o.removeAllListeners = m,
            o.emit = m,
            o.prependListener = m,
            o.prependOnceListener = m,
            o.listeners = function(e) {
                return []
            }
            ,
            o.binding = function(e) {
                throw new Error("process.binding is not supported")
            }
            ,
            o.cwd = function() {
                return "/"
            }
            ,
            o.chdir = function(e) {
                throw new Error("process.chdir is not supported")
            }
            ,
            o.umask = function() {
                return 0
            }
        }
        , function(e, t, n) {
            function r(e, t) {
                for (var n = 0; n < t.length; n++) {
                    var r = t[n];
                    r.enumerable = r.enumerable || !1,
                    r.configurable = !0,
                    "value"in r && (r.writable = !0),
                    Object.defineProperty(e, r.key, r)
                }
            }
            var o = n(9);
            e.exports = function() {
                function e() {
                    !function(e, t) {
                        if (!(e instanceof t))
                            throw new TypeError("Cannot call a class as a function")
                    }(this, e)
                }
                var t, n;
                return t = e,
                (n = [{
                    key: "urlEncode",
                    value: function(e) {
                        return o(e)
                    }
                }, {
                    key: "jsonEncode",
                    value: function(e) {
                        return JSON.stringify(e)
                    }
                }, {
                    key: "formEncode",
                    value: function(e) {
                        if (this.isFormData(e))
                            return e;
                        if (this.isFormElement(e))
                            return new FormData(e);
                        if (this.isObject(e)) {
                            var t = new FormData;
                            return Object.keys(e).forEach((function(n) {
                                var r = e[n];
                                t.append(n, r)
                            }
                            )),
                            t
                        }
                        throw new Error("`data` must be an instance of Object, FormData or <FORM> HTMLElement")
                    }
                }, {
                    key: "isObject",
                    value: function(e) {
                        return "[object Object]" === Object.prototype.toString.call(e)
                    }
                }, {
                    key: "isFormData",
                    value: function(e) {
                        return e instanceof FormData
                    }
                }, {
                    key: "isFormElement",
                    value: function(e) {
                        return e instanceof HTMLFormElement
                    }
                }, {
                    key: "selectFiles",
                    value: function() {
                        var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
                        return new Promise((function(resolve, err) {
                        	/*
                            var r = document.createElement("INPUT");
                            r.type = "file",
                            e.multiple && r.setAttribute("multiple", "multiple"),
                            e.accept && r.setAttribute("accept", e.accept),
                            r.style.display = "none",
                            document.body.appendChild(r),
                            r.addEventListener("change", (function(e) {
                                var n = e.target.files;
                                t(n),
                                document.body.removeChild(r)
                            }
                            ), !1),
                            r.click()
                            */
                            let extension = ""; // "html"
							fetch('/peergos-api/v0/file-picker/?currentFolder=true&extension=' + extension, { method: 'GET' }).then(function(response) {
      							if (response.status === 200) {
									response.arrayBuffer().then(function(buffer) {
										let text = new TextDecoder().decode(buffer);
										let files = JSON.parse(text);
										let file = files[0];
										let slashIndex = file.lastIndexOf('/');										
										let filename = slashIndex <= 0 ? file : file.substring(slashIndex +1);
										let dotIndex = file.lastIndexOf('.');										
										let extension = dotIndex <= 0 ? '' : file.substring(dotIndex +1);
										console.log('selected file:' + file);
										let n = {
											url: file,
            								size: 0,
            								title: filename,
            								extension: extension
										}
										resolve([n]);
    								});
      							} else {
		            				err('error:' + response.status);
      							}
							});
                        }
                        ))
                    }
                }, {
                    key: "parseHeaders",
                    value: function(e) {
                        var t = e.trim().split(/[\r\n]+/)
                          , n = {};
                        return t.forEach((function(e) {
                            var t = e.split(": ")
                              , r = t.shift()
                              , o = t.join(": ");
                            r && (n[r] = o)
                        }
                        )),
                        n
                    }
                }]) && r(t, n),
                e
            }()
        }
        , function(e, t) {
            var n = function(e) {
                return encodeURIComponent(e).replace(/[!'()*]/g, escape).replace(/%20/g, "+")
            }
              , r = function(e, t, o, i) {
                return t = t || null,
                o = o || "&",
                i = i || null,
                e ? function(e) {
                    for (var t = new Array, n = 0; n < e.length; n++)
                        e[n] && t.push(e[n]);
                    return t
                }(Object.keys(e).map((function(a) {
                    var s, c, l = a;
                    if (i && (l = i + "[" + l + "]"),
                    "object" == typeof e[a] && null !== e[a])
                        s = r(e[a], null, o, l);
                    else {
                        t && (c = l,
                        l = !isNaN(parseFloat(c)) && isFinite(c) ? t + Number(l) : l);
                        var u = e[a];
                        u = (u = 0 === (u = !1 === (u = !0 === u ? "1" : u) ? "0" : u) ? "0" : u) || "",
                        s = n(l) + "=" + n(u)
                    }
                    return s
                }
                ))).join(o).replace(/[!'()*]/g, "") : ""
            };
            e.exports = r
        }
        ])
    }
    , function(e, t, n) {
        var r = n(2);
        "string" == typeof r && (r = [[e.i, r, ""]]);
        var o = {
            hmr: !0,
            transform: void 0,
            insertInto: void 0
        };
        n(4)(r, o);
        r.locals && (e.exports = r.locals)
    }
    , function(e, t, n) {
        (e.exports = n(3)(!1)).push([e.i, ".cdx-attaches {\n  --color-line: #EFF0F1;\n  --color-bg: #fff;\n  --color-bg-secondary: #F8F8F8;\n  --color-bg-secondary--hover: #f2f2f2;\n  --color-text-secondary: #707684;\n}\n\n  .cdx-attaches--with-file {\n    display: flex;\n    align-items: center;\n    padding: 10px 12px;\n    border: 1px solid var(--color-line);\n    border-radius: 7px;\n    background: var(--color-bg);\n  }\n\n  .cdx-attaches--with-file .cdx-attaches__file-info {\n      display: grid;\n      grid-gap: 4px;\n      max-width: calc(100% - 80px);\n      margin: auto 0;\n      flex-grow: 2;\n    }\n\n  .cdx-attaches--with-file .cdx-attaches__download-button {\n      display: flex;\n      align-items: center;\n      background: var(--color-bg-secondary);\n      padding: 6px;\n      border-radius: 6px;\n      margin: auto 0 auto auto;\n    }\n\n  .cdx-attaches--with-file .cdx-attaches__download-button:hover {\n        background: var(--color-bg-secondary--hover);\n      }\n\n  .cdx-attaches--with-file .cdx-attaches__download-button svg {\n        width: 20px;\n        height: 20px;\n        fill: none;\n      }\n\n  .cdx-attaches--with-file .cdx-attaches__file-icon {\n      position: relative;\n    }\n\n  .cdx-attaches--with-file .cdx-attaches__file-icon-background {\n        background-color: #333;\n\n        width: 27px;\n        height: 30px;\n        margin-right: 12px;\n        border-radius: 8px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n      }\n\n  @supports(-webkit-mask-box-image: url('')){\n\n  .cdx-attaches--with-file .cdx-attaches__file-icon-background {\n          border-radius: 0;\n          -webkit-mask-box-image: url(\"data:image/svg+xml,%3Csvg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10.3872C0 1.83334 1.83334 0 10.3872 0H13.6128C22.1667 0 24 1.83334 24 10.3872V13.6128C24 22.1667 22.1667 24 13.6128 24H10.3872C1.83334 24 0 22.1667 0 13.6128V10.3872Z' fill='black'/%3E%3C/svg%3E%0A\") 48% 41% 37.9% 53.3%\n      };\n        }\n\n  .cdx-attaches--with-file .cdx-attaches__file-icon-label {\n        position: absolute;\n        left: 3px;\n        top: 11px;\n        background: inherit;\n        text-transform: uppercase;\n        line-height: 1em;\n        color: #fff;\n        padding: 1px 2px;\n        border-radius: 3px;\n        font-size: 10px;\n        font-weight: bold;\n        /* box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.22); */\n        font-family: ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace;\n        letter-spacing: 0.02em;\n      }\n\n  .cdx-attaches--with-file .cdx-attaches__file-icon svg {\n        width: 20px;\n        height: 20px;\n      }\n\n  .cdx-attaches--with-file .cdx-attaches__file-icon path {\n        stroke: #fff;\n      }\n\n  .cdx-attaches--with-file .cdx-attaches__size {\n      color: var(--color-text-secondary);\n      font-size: 12px;\n      line-height: 1em;\n    }\n\n  .cdx-attaches--with-file .cdx-attaches__size::after {\n        content: attr(data-size);\n        margin-left: 0.2em;\n      }\n\n  .cdx-attaches--with-file .cdx-attaches__title {\n      white-space: nowrap;\n      text-overflow: ellipsis;\n      overflow: hidden;\n      outline: none;\n      max-width: 90%;\n      font-size: 14px;\n      font-weight: 500;\n      line-height: 1em;\n    }\n\n  .cdx-attaches--with-file .cdx-attaches__title:empty::before {\n      content: attr(data-placeholder);\n      color: #7b7e89;\n    }\n\n  .cdx-attaches--loading .cdx-attaches__title,\n    .cdx-attaches--loading .cdx-attaches__file-icon,\n    .cdx-attaches--loading .cdx-attaches__size,\n    .cdx-attaches--loading .cdx-attaches__download-button,\n    .cdx-attaches--loading .cdx-attaches__button {\n      opacity: 0;\n      font-size: 0;\n    }\n\n  .cdx-attaches__button {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    color: #000;\n    border-radius: 7px;\n    font-weight: 500;\n  }\n\n  .cdx-attaches__button svg {\n      margin-top: 0;\n    }\n", ""])
    }
    , function(e, t) {
        e.exports = function(e) {
            var t = [];
            return t.toString = function() {
                return this.map((function(t) {
                    var n = function(e, t) {
                        var n = e[1] || ""
                          , r = e[3];
                        if (!r)
                            return n;
                        if (t && "function" == typeof btoa) {
                            var o = (a = r,
                            "/*# sourceMappingURL=data:application/json;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(a)))) + " */")
                              , i = r.sources.map((function(e) {
                                return "/*# sourceURL=" + r.sourceRoot + e + " */"
                            }
                            ));
                            return [n].concat(i).concat([o]).join("\n")
                        }
                        var a;
                        return [n].join("\n")
                    }(t, e);
                    return t[2] ? "@media " + t[2] + "{" + n + "}" : n
                }
                )).join("")
            }
            ,
            t.i = function(e, n) {
                "string" == typeof e && (e = [[null, e, ""]]);
                for (var r = {}, o = 0; o < this.length; o++) {
                    var i = this[o][0];
                    "number" == typeof i && (r[i] = !0)
                }
                for (o = 0; o < e.length; o++) {
                    var a = e[o];
                    "number" == typeof a[0] && r[a[0]] || (n && !a[2] ? a[2] = n : n && (a[2] = "(" + a[2] + ") and (" + n + ")"),
                    t.push(a))
                }
            }
            ,
            t
        }
    }
    , function(e, t, n) {
        var r, o, i = {}, a = (r = function() {
            return window && document && document.all && !window.atob
        }
        ,
        function() {
            return void 0 === o && (o = r.apply(this, arguments)),
            o
        }
        ), s = function(e) {
            return document.querySelector(e)
        }, c = function(e) {
            var t = {};
            return function(e) {
                if ("function" == typeof e)
                    return e();
                if (void 0 === t[e]) {
                    var n = s.call(this, e);
                    if (window.HTMLIFrameElement && n instanceof window.HTMLIFrameElement)
                        try {
                            n = n.contentDocument.head
                        } catch (e) {
                            n = null
                        }
                    t[e] = n
                }
                return t[e]
            }
        }(), l = null, u = 0, f = [], d = n(5);
        function p(e, t) {
            for (var n = 0; n < e.length; n++) {
                var r = e[n]
                  , o = i[r.id];
                if (o) {
                    o.refs++;
                    for (var a = 0; a < o.parts.length; a++)
                        o.parts[a](r.parts[a]);
                    for (; a < r.parts.length; a++)
                        o.parts.push(b(r.parts[a], t))
                } else {
                    var s = [];
                    for (a = 0; a < r.parts.length; a++)
                        s.push(b(r.parts[a], t));
                    i[r.id] = {
                        id: r.id,
                        refs: 1,
                        parts: s
                    }
                }
            }
        }
        function h(e, t) {
            for (var n = [], r = {}, o = 0; o < e.length; o++) {
                var i = e[o]
                  , a = t.base ? i[0] + t.base : i[0]
                  , s = {
                    css: i[1],
                    media: i[2],
                    sourceMap: i[3]
                };
                r[a] ? r[a].parts.push(s) : n.push(r[a] = {
                    id: a,
                    parts: [s]
                })
            }
            return n
        }
        function m(e, t) {
            var n = c(e.insertInto);
            if (!n)
                throw new Error("Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid.");
            var r = f[f.length - 1];
            if ("top" === e.insertAt)
                r ? r.nextSibling ? n.insertBefore(t, r.nextSibling) : n.appendChild(t) : n.insertBefore(t, n.firstChild),
                f.push(t);
            else if ("bottom" === e.insertAt)
                n.appendChild(t);
            else {
                if ("object" != typeof e.insertAt || !e.insertAt.before)
                    throw new Error("[Style Loader]\n\n Invalid value for parameter 'insertAt' ('options.insertAt') found.\n Must be 'top', 'bottom', or Object.\n (https://github.com/webpack-contrib/style-loader#insertat)\n");
                var o = c(e.insertInto + " " + e.insertAt.before);
                n.insertBefore(t, o)
            }
        }
        function v(e) {
            if (null === e.parentNode)
                return !1;
            e.parentNode.removeChild(e);
            var t = f.indexOf(e);
            t >= 0 && f.splice(t, 1)
        }
        function y(e) {
            var t = document.createElement("style");
            return void 0 === e.attrs.type && (e.attrs.type = "text/css"),
            g(t, e.attrs),
            m(e, t),
            t
        }
        function g(e, t) {
            Object.keys(t).forEach((function(n) {
                e.setAttribute(n, t[n])
            }
            ))
        }
        function b(e, t) {
            var n, r, o, i;
            if (t.transform && e.css) {
                if (!(i = t.transform(e.css)))
                    return function() {}
                    ;
                e.css = i
            }
            if (t.singleton) {
                var a = u++;
                n = l || (l = y(t)),
                r = _.bind(null, n, a, !1),
                o = _.bind(null, n, a, !0)
            } else
                e.sourceMap && "function" == typeof URL && "function" == typeof URL.createObjectURL && "function" == typeof URL.revokeObjectURL && "function" == typeof Blob && "function" == typeof btoa ? (n = function(e) {
                    var t = document.createElement("link");
                    return void 0 === e.attrs.type && (e.attrs.type = "text/css"),
                    e.attrs.rel = "stylesheet",
                    g(t, e.attrs),
                    m(e, t),
                    t
                }(t),
                r = E.bind(null, n, t),
                o = function() {
                    v(n),
                    n.href && URL.revokeObjectURL(n.href)
                }
                ) : (n = y(t),
                r = S.bind(null, n),
                o = function() {
                    v(n)
                }
                );
            return r(e),
            function(t) {
                if (t) {
                    if (t.css === e.css && t.media === e.media && t.sourceMap === e.sourceMap)
                        return;
                    r(e = t)
                } else
                    o()
            }
        }
        e.exports = function(e, t) {
            if ("undefined" != typeof DEBUG && DEBUG && "object" != typeof document)
                throw new Error("The style-loader cannot be used in a non-browser environment");
            (t = t || {}).attrs = "object" == typeof t.attrs ? t.attrs : {},
            t.singleton || "boolean" == typeof t.singleton || (t.singleton = a()),
            t.insertInto || (t.insertInto = "head"),
            t.insertAt || (t.insertAt = "bottom");
            var n = h(e, t);
            return p(n, t),
            function(e) {
                for (var r = [], o = 0; o < n.length; o++) {
                    var a = n[o];
                    (s = i[a.id]).refs--,
                    r.push(s)
                }
                e && p(h(e, t), t);
                for (o = 0; o < r.length; o++) {
                    var s;
                    if (0 === (s = r[o]).refs) {
                        for (var c = 0; c < s.parts.length; c++)
                            s.parts[c]();
                        delete i[s.id]
                    }
                }
            }
        }
        ;
        var w, x = (w = [],
        function(e, t) {
            return w[e] = t,
            w.filter(Boolean).join("\n")
        }
        );
        function _(e, t, n, r) {
            var o = n ? "" : r.css;
            if (e.styleSheet)
                e.styleSheet.cssText = x(t, o);
            else {
                var i = document.createTextNode(o)
                  , a = e.childNodes;
                a[t] && e.removeChild(a[t]),
                a.length ? e.insertBefore(i, a[t]) : e.appendChild(i)
            }
        }
        function S(e, t) {
            var n = t.css
              , r = t.media;
            if (r && e.setAttribute("media", r),
            e.styleSheet)
                e.styleSheet.cssText = n;
            else {
                for (; e.firstChild; )
                    e.removeChild(e.firstChild);
                e.appendChild(document.createTextNode(n))
            }
        }
        function E(e, t, n) {
            var r = n.css
              , o = n.sourceMap
              , i = void 0 === t.convertToAbsoluteUrls && o;
            (t.convertToAbsoluteUrls || i) && (r = d(r)),
            o && (r += "\n/*# sourceMappingURL=data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(o)))) + " */");
            var a = new Blob([r],{
                type: "text/css"
            })
              , s = e.href;
            e.href = URL.createObjectURL(a),
            s && URL.revokeObjectURL(s)
        }
    }
    , function(e, t) {
        e.exports = function(e) {
            var t = "undefined" != typeof window && window.location;
            if (!t)
                throw new Error("fixUrls requires window.location");
            if (!e || "string" != typeof e)
                return e;
            var n = t.protocol + "//" + t.host
              , r = n + t.pathname.replace(/\/[^\/]*$/, "/");
            return e.replace(/url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi, (function(e, t) {
                var o, i = t.trim().replace(/^"(.*)"$/, (function(e, t) {
                    return t
                }
                )).replace(/^'(.*)'$/, (function(e, t) {
                    return t
                }
                ));
                return /^(#|data:|http:\/\/|https:\/\/|file:\/\/\/|\s*$)/i.test(i) ? e : (o = 0 === i.indexOf("//") ? i : 0 === i.indexOf("/") ? n + i : r + i.replace(/^\.\//, ""),
                "url(" + JSON.stringify(o) + ")")
            }
            ))
        }
    }
    , function(e, t, n) {
        "use strict";
        n.r(t),
        n.d(t, "default", (function() {
            return p
        }
        ));
        n(1);
        var r = n(0)
          , o = n.n(r);
        function i(e, t) {
            for (var n = 0; n < t.length; n++) {
                var r = t[n];
                r.enumerable = r.enumerable || !1,
                r.configurable = !0,
                "value"in r && (r.writable = !0),
                Object.defineProperty(e, r.key, r)
            }
        }
        var a = function() {
            function e(t) {
                var n = t.config
                  , r = t.onUpload
                  , o = t.onError;
                !function(e, t) {
                    if (!(e instanceof t))
                        throw new TypeError("Cannot call a class as a function")
                }(this, e),
                this.config = n,
                this.onUpload = r,
                this.onError = o
            }
            var t, n, r;
            return t = e,
            (n = [{
                key: "uploadSelectedFile",
                value: function(e) {
                    var t = this
                      , n = e.onPreview;
                    (this.config.uploader && "function" == typeof this.config.uploader.uploadByFile ? o.a.selectFiles({
                        accept: this.config.types
                    }).then((function(e) {
                        n();
                        var r, o = t.config.uploader.uploadByFile(e[0]);
                        return (r = o) && "function" == typeof r.then || console.warn("Custom uploader method uploadByFile should return a Promise"),
                        o
                    }
                    )) : o.a.transport({
                        url: this.config.endpoint,
                        accept: this.config.types,
                        beforeSend: function() {
                            return n()
                        },
                        fieldName: this.config.field,
                        headers: this.config.additionalRequestHeaders || {}
                    }).then((function(e) {
                        return e.body
                    }
                    ))).then((function(e) {
                        t.onUpload(e)
                    }
                    )).catch((function(e) {
                        var n = e.body
                          , r = n && n.message ? n.message : t.config.errorMessage;
                        t.onError(r)
                    }
                    ))
                }
            }]) && i(t.prototype, n),
            r && i(t, r),
            e
        }();
        function s(e) {
            return function(e) {
                if (Array.isArray(e))
                    return c(e)
            }(e) || function(e) {
                if ("undefined" != typeof Symbol && null != e[Symbol.iterator] || null != e["@@iterator"])
                    return Array.from(e)
            }(e) || function(e, t) {
                if (!e)
                    return;
                if ("string" == typeof e)
                    return c(e, t);
                var n = Object.prototype.toString.call(e).slice(8, -1);
                "Object" === n && e.constructor && (n = e.constructor.name);
                if ("Map" === n || "Set" === n)
                    return Array.from(e);
                if ("Arguments" === n || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))
                    return c(e, t)
            }(e) || function() {
                throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")
            }()
        }
        function c(e, t) {
            (null == t || t > e.length) && (t = e.length);
            for (var n = 0, r = new Array(t); n < t; n++)
                r[n] = e[n];
            return r
        }
        function l(e) {
            var t, n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : null, r = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {}, o = document.createElement(e);
            Array.isArray(n) ? (t = o.classList).add.apply(t, s(n)) : n && o.classList.add(n);
            for (var i in r)
                o[i] = r[i];
            return o
        }
        function u(e) {
            return 0 === Object.keys(e).length
        }
        const f = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.3236 8.43554L9.49533 12.1908C9.13119 12.5505 8.93118 13.043 8.9393 13.5598C8.94741 14.0767 9.163 14.5757 9.53862 14.947C9.91424 15.3182 10.4191 15.5314 10.9422 15.5397C11.4653 15.5479 11.9637 15.3504 12.3279 14.9908L16.1562 11.2355C16.8845 10.5161 17.2845 9.53123 17.2682 8.4975C17.252 7.46376 16.8208 6.46583 16.0696 5.72324C15.3184 4.98066 14.3086 4.55425 13.2624 4.53782C12.2162 4.52138 11.2193 4.91627 10.4911 5.63562L6.66277 9.39093C5.57035 10.4699 4.97032 11.9473 4.99467 13.4979C5.01903 15.0485 5.66578 16.5454 6.79264 17.6592C7.9195 18.7731 9.43417 19.4127 11.0034 19.4374C12.5727 19.462 14.068 18.8697 15.1604 17.7907L18.9887 14.0354"/></svg>';
        function d(e, t) {
            for (var n = 0; n < t.length; n++) {
                var r = t[n];
                r.enumerable = r.enumerable || !1,
                r.configurable = !0,
                "value"in r && (r.writable = !0),
                Object.defineProperty(e, r.key, r)
            }
        }
        var p = function() {
            function e(t) {
                var n = this
                  , r = t.data
                  , o = t.config
                  , i = t.api
                  , s = t.readOnly;
                !function(e, t) {
                    if (!(e instanceof t))
                        throw new TypeError("Cannot call a class as a function")
                }(this, e),
                this.api = i,
                this.readOnly = s,
                this.nodes = {
                    wrapper: null,
                    button: null,
                    title: null
                },
                this._data = {
                    file: {},
                    title: ""
                },
                this.config = {
                    endpoint: o.endpoint || "",
                    field: o.field || "file",
                    types: o.types || "*",
                    buttonText: o.buttonText || "Select file to upload",
                    errorMessage: o.errorMessage || "File upload failed",
                    uploader: o.uploader || void 0,
                    additionalRequestHeaders: o.additionalRequestHeaders || {}
                },
                void 0 === r || u(r) || (this.data = r),
                this.uploader = new a({
                    config: this.config,
                    onUpload: function(e) {
                        return n.onUpload(e)
                    },
                    onError: function(e) {
                        return n.uploadingFailed(e)
                    }
                }),
                this.enableFileUpload = this.enableFileUpload.bind(this)
            }
            var t, n, r;
            return t = e,
            r = [{
                key: "toolbox",
                get: function() {
                    return {
                        icon: f,
                        title: "Attachment"
                    }
                }
            }, {
                key: "isReadOnlySupported",
                get: function() {
                    return !0
                }
            }],
            (n = [{
                key: "CSS",
                get: function() {
                    return {
                        baseClass: this.api.styles.block,
                        apiButton: this.api.styles.button,
                        loader: this.api.styles.loader,
                        wrapper: "cdx-attaches",
                        wrapperWithFile: "cdx-attaches--with-file",
                        wrapperLoading: "cdx-attaches--loading",
                        button: "cdx-attaches__button",
                        title: "cdx-attaches__title",
                        size: "cdx-attaches__size",
                        downloadButton: "cdx-attaches__download-button",
                        fileInfo: "cdx-attaches__file-info",
                        fileIcon: "cdx-attaches__file-icon",
                        fileIconBackground: "cdx-attaches__file-icon-background",
                        fileIconLabel: "cdx-attaches__file-icon-label"
                    }
                }
            }, {
                key: "EXTENSIONS",
                get: function() {
                    return {
                        doc: "#1483E9",
                        docx: "#1483E9",
                        odt: "#1483E9",
                        pdf: "#DB2F2F",
                        rtf: "#744FDC",
                        tex: "#5a5a5b",
                        txt: "#5a5a5b",
                        pptx: "#E35200",
                        ppt: "#E35200",
                        mp3: "#eab456",
                        mp4: "#f676a6",
                        xls: "#11AE3D",
                        html: "#2988f0",
                        htm: "#2988f0",
                        png: "#AA2284",
                        jpg: "#D13359",
                        jpeg: "#D13359",
                        gif: "#f6af76",
                        zip: "#4f566f",
                        rar: "#4f566f",
                        exe: "#e26f6f",
                        svg: "#bf5252",
                        key: "#00B2FF",
                        sketch: "#FFC700",
                        ai: "#FB601D",
                        psd: "#388ae5",
                        dmg: "#e26f6f",
                        json: "#2988f0",
                        csv: "#11AE3D"
                    }
                }
            }, {
                key: "validate",
                value: function(e) {
                    return !u(e.file)
                }
            }, {
                key: "save",
                value: function(e) {
                    if (this.pluginHasData()) {
                        var t = e.querySelector(".".concat(this.CSS.title));
                        t && Object.assign(this.data, {
                            title: t.innerHTML
                        })
                    }
                    return this.data
                }
            }, {
                key: "render",
                value: function() {
                    var e = l("div", this.CSS.baseClass);
                    return this.nodes.wrapper = l("div", this.CSS.wrapper),
                    this.pluginHasData() ? this.showFileData() : this.prepareUploadButton(),
                    e.appendChild(this.nodes.wrapper),
                    e
                }
            }, {
                key: "prepareUploadButton",
                value: function() {
                    this.nodes.button = l("div", [this.CSS.apiButton, this.CSS.button]),
                    this.nodes.button.innerHTML = "".concat(f, " ").concat(this.config.buttonText),
                    this.readOnly || this.nodes.button.addEventListener("click", this.enableFileUpload),
                    this.nodes.wrapper.appendChild(this.nodes.button)
                }
            }, {
                key: "appendCallback",
                value: function() {
                    this.nodes.button.click()
                }
            }, {
                key: "pluginHasData",
                value: function() {
                    return "" !== this.data.title || Object.values(this.data.file).some((function(e) {
                        return void 0 !== e
                    }
                    ))
                }
            }, {
                key: "enableFileUpload",
                value: function() {
                    var e = this;
                    this.uploader.uploadSelectedFile({
                        onPreview: function() {
                            e.nodes.wrapper.classList.add(e.CSS.wrapperLoading, e.CSS.loader)
                        }
                    })
                }
            }, {
                key: "onUpload",
                value: function(e) {
                    var t, n, r, o = e;
                    try {
                        o.success && void 0 !== o.file && !u(o.file) ? (this.data = {
                            file: o.file,
                            title: o.file.title || ""
                        },
                        this.nodes.button.remove(),
                        this.showFileData(),
                        t = this.nodes.title,
                        n = document.createRange(),
                        r = window.getSelection(),
                        n.selectNodeContents(t),
                        n.collapse(!1),
                        r.removeAllRanges(),
                        r.addRange(n),
                        this.removeLoader()) : this.uploadingFailed(this.config.errorMessage)
                    } catch (e) {
                        console.error("Attaches tool error:", e),
                        this.uploadingFailed(this.config.errorMessage)
                    }
                    this.api.blocks.getBlockByIndex(this.api.blocks.getCurrentBlockIndex()).dispatchChange()
                }
            }, {
                key: "appendFileIcon",
                value: function(e) {
                    var t, n = e.extension || (void 0 === (t = e.name) ? "" : t.split(".").pop()), r = this.EXTENSIONS[n], o = l("div", this.CSS.fileIcon), i = l("div", this.CSS.fileIconBackground);
                    if (r && (i.style.backgroundColor = r),
                    o.appendChild(i),
                    n) {
                        var a = n;
                        n.length > 4 && (a = n.substring(0, 4) + "…");
                        var s = l("div", this.CSS.fileIconLabel, {
                            textContent: a,
                            title: n
                        });
                        r && (s.style.backgroundColor = r),
                        o.appendChild(s)
                    } else
                        i.innerHTML = f;
                    this.nodes.wrapper.appendChild(o)
                }
            }, {
                key: "removeLoader",
                value: function() {
                    var e = this;
                    setTimeout((function() {
                        return e.nodes.wrapper.classList.remove(e.CSS.wrapperLoading, e.CSS.loader)
                    }
                    ), 500)
                }
            }, {
                key: "showFileData",
                value: function() {
                    this.nodes.wrapper.classList.add(this.CSS.wrapperWithFile);
                    var e = this.data
                      , t = e.file
                      , n = e.title;
                    this.appendFileIcon(t);
                    var r = l("div", this.CSS.fileInfo);
                    if (this.nodes.title = l("div", this.CSS.title, {
                        contentEditable: !1 === this.readOnly
                    }),
                    this.nodes.title.dataset.placeholder = this.api.i18n.t("File title"),
                    this.nodes.title.textContent = n || "",
                    r.appendChild(this.nodes.title),
                    t.size) {
                        var o, i, a = l("div", this.CSS.size);
                        Math.log10(+t.size) >= 6 ? (o = "MiB",
                        i = t.size / Math.pow(2, 20)) : (o = "KiB",
                        i = t.size / Math.pow(2, 10)),
                        a.textContent = i.toFixed(1),
                        a.setAttribute("data-size", o)//,
                        //r.appendChild(a)
                    }
                    if (this.nodes.wrapper.appendChild(r),
                    void 0 !== t.url) {
                        var s = l("a", this.CSS.downloadButton, {
                            innerHTML: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M7 10L11.8586 14.8586C11.9367 14.9367 12.0633 14.9367 12.1414 14.8586L17 10"/></svg>',
                            href: t.url,
                            target: "_blank",
                            rel: "nofollow noindex noreferrer"
                        });
                    	if(this.readOnly) {
                        	this.nodes.wrapper.appendChild(s)
                        }
                    }
                }
            }, {
                key: "uploadingFailed",
                value: function(e) {
                    this.api.notifier.show({
                        message: e,
                        style: "error"
                    }),
                    this.removeLoader()
                }
            }, {
                key: "data",
                get: function() {
                    return this._data
                },
                set: function(e) {
                    var t = e.file
                      , n = e.title;
                    this._data = {
                        file: t,
                        title: n
                    }
                }
            }]) && d(t.prototype, n),
            r && d(t, r),
            e
        }()
    }
    ]).default
}
));