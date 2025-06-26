// This file was built using JPack from https://github.com/dajiaji/crystals-kyber-js

// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

(function outer (modules, cache, entry) {
    // Save the require from previous bundle to this closure if any
    var previousRequire = typeof require == "function" && require;

    function newRequire(name, jumped){
        if(!cache[name]) {
            if(!modules[name]) {
                // if we cannot find the the module within our internal map or
                // cache jump to the current global require ie. the last bundle
                // that was added to the page.
                var currentRequire = typeof require == "function" && require;
                if (!jumped && currentRequire) return currentRequire(name, true);

                // If there are other bundles on this page the require from the
                // previous one is saved to 'previousRequire'. Repeat this as
                // many times as there are bundles until the module is found or
                // we exhaust the require chain.
                if (previousRequire) return previousRequire(name, true);
                var err = new Error('Cannot find module \'' + name + '\'');
                err.code = 'MODULE_NOT_FOUND';
                throw err;
            }
            var m = cache[name] = {exports:{}};
            modules[name][0].call(m.exports, function(x){
                var id = modules[name][1][x];
                return newRequire(id ? id : x);
            },m,m.exports,outer,modules,cache,entry);
        }
        return cache[name].exports;
    }
    for(var i=0;i<entry.length;i++) newRequire(entry[i]);

    // Override the current require with this new one
    return newRequire;
})({ 7:[function(require,module,exports){(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dntGlobalThis = void 0;
    const dntGlobals = {};
    exports.dntGlobalThis = createMergeProxy(globalThis, dntGlobals);
    function createMergeProxy(baseObj, extObj) {
        return new Proxy(baseObj, {
            get(_target, prop, _receiver) {
                if (prop in extObj) {
                    return extObj[prop];
                }
                else {
                    return baseObj[prop];
                }
            },
            set(_target, prop, value) {
                if (prop in extObj) {
                    delete extObj[prop];
                }
                baseObj[prop] = value;
                return true;
            },
            deleteProperty(_target, prop) {
                let success = false;
                if (prop in extObj) {
                    delete extObj[prop];
                    success = true;
                }
                if (prop in baseObj) {
                    delete baseObj[prop];
                    success = true;
                }
                return success;
            },
            ownKeys(_target) {
                const baseKeys = Reflect.ownKeys(baseObj);
                const extKeys = Reflect.ownKeys(extObj);
                const extKeysSet = new Set(extKeys);
                return [...baseKeys.filter((k) => !extKeysSet.has(k)), ...extKeys];
            },
            defineProperty(_target, prop, desc) {
                if (prop in extObj) {
                    delete extObj[prop];
                }
                Reflect.defineProperty(baseObj, prop, desc);
                return true;
            },
            getOwnPropertyDescriptor(_target, prop) {
                if (prop in extObj) {
                    return Reflect.getOwnPropertyDescriptor(extObj, prop);
                }
                else {
                    return Reflect.getOwnPropertyDescriptor(baseObj, prop);
                }
            },
            has(_target, prop) {
                return prop in extObj || prop in baseObj;
            },
        });
    }
});
},{}], 2:[function(require,module,exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBig = exports.shrSL = exports.shrSH = exports.rotrSL = exports.rotrSH = exports.rotrBL = exports.rotrBH = exports.rotr32L = exports.rotr32H = exports.rotlSL = exports.rotlSH = exports.rotlBL = exports.rotlBH = exports.add5L = exports.add5H = exports.add4L = exports.add4H = exports.add3L = exports.add3H = void 0;
exports.add = add;
exports.fromBig = fromBig;
exports.split = split;
/**
 * Internal helpers for u64. BigUint64Array is too slow as per 2025, so we implement it using Uint32Array.
 * @todo re-check https://issues.chromium.org/issues/42212588
 * @module
 */
const U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
const _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
    if (le)
        return { h: Number(n & U32_MASK64), l: Number((n >> _32n) & U32_MASK64) };
    return { h: Number((n >> _32n) & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i = 0; i < len; i++) {
        const { h, l } = fromBig(lst[i], le);
        [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
}
const toBig = (h, l) => (BigInt(h >>> 0) << _32n) | BigInt(l >>> 0);
exports.toBig = toBig;
// for Shift in [0, 32)
const shrSH = (h, _l, s) => h >>> s;
exports.shrSH = shrSH;
const shrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
exports.shrSL = shrSL;
// Right rotate for Shift in [1, 32)
const rotrSH = (h, l, s) => (h >>> s) | (l << (32 - s));
exports.rotrSH = rotrSH;
const rotrSL = (h, l, s) => (h << (32 - s)) | (l >>> s);
exports.rotrSL = rotrSL;
// Right rotate for Shift in (32, 64), NOTE: 32 is special case.
const rotrBH = (h, l, s) => (h << (64 - s)) | (l >>> (s - 32));
exports.rotrBH = rotrBH;
const rotrBL = (h, l, s) => (h >>> (s - 32)) | (l << (64 - s));
exports.rotrBL = rotrBL;
// Right rotate for shift===32 (just swaps l&h)
const rotr32H = (_h, l) => l;
exports.rotr32H = rotr32H;
const rotr32L = (h, _l) => h;
exports.rotr32L = rotr32L;
// Left rotate for Shift in [1, 32)
const rotlSH = (h, l, s) => (h << s) | (l >>> (32 - s));
exports.rotlSH = rotlSH;
const rotlSL = (h, l, s) => (l << s) | (h >>> (32 - s));
exports.rotlSL = rotlSL;
// Left rotate for Shift in (32, 64), NOTE: 32 is special case.
const rotlBH = (h, l, s) => (l << (s - 32)) | (h >>> (64 - s));
exports.rotlBH = rotlBH;
const rotlBL = (h, l, s) => (h << (s - 32)) | (l >>> (64 - s));
exports.rotlBL = rotlBL;
// JS uses 32-bit signed integers for bitwise operations which means we cannot
// simple take carry out of low bit sum by shift, we need to use division.
function add(Ah, Al, Bh, Bl) {
    const l = (Al >>> 0) + (Bl >>> 0);
    return { h: (Ah + Bh + ((l / 2 ** 32) | 0)) | 0, l: l | 0 };
}
// Addition with more than 2 elements
const add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
exports.add3L = add3L;
const add3H = (low, Ah, Bh, Ch) => (Ah + Bh + Ch + ((low / 2 ** 32) | 0)) | 0;
exports.add3H = add3H;
const add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
exports.add4L = add4L;
const add4H = (low, Ah, Bh, Ch, Dh) => (Ah + Bh + Ch + Dh + ((low / 2 ** 32) | 0)) | 0;
exports.add4H = add4H;
const add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
exports.add5L = add5L;
const add5H = (low, Ah, Bh, Ch, Dh, Eh) => (Ah + Bh + Ch + Dh + Eh + ((low / 2 ** 32) | 0)) | 0;
exports.add5H = add5H;
// prettier-ignore
const u64 = {
    fromBig, split, toBig,
    shrSH, shrSL,
    rotrSH, rotrSL, rotrBH, rotrBL,
    rotr32H, rotr32L,
    rotlSH, rotlSL, rotlBH, rotlBL,
    add, add3L, add3H, add4L, add4H, add5H, add5L,
};
exports.default = u64;
//# sourceMappingURL=_u64.js.map
},{}], 1:[function(require,module,exports){/**
 * This implementation is based on https://github.com/antontutoveanu/crystals-kyber-javascript,
 * which was deveploped under the MIT licence below:
 * https://github.com/antontutoveanu/crystals-kyber-javascript/blob/main/LICENSE
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NTT_ZETAS_INV = exports.NTT_ZETAS = exports.Q_INV = exports.Q = exports.N = void 0;
    exports.N = 256;
    exports.Q = 3329;
    exports.Q_INV = 62209;
    // deno-fmt-ignore
    exports.NTT_ZETAS = [
        2285, 2571, 2970, 1812, 1493, 1422, 287, 202, 3158, 622, 1577, 182, 962,
        2127, 1855, 1468, 573, 2004, 264, 383, 2500, 1458, 1727, 3199, 2648, 1017,
        732, 608, 1787, 411, 3124, 1758, 1223, 652, 2777, 1015, 2036, 1491, 3047,
        1785, 516, 3321, 3009, 2663, 1711, 2167, 126, 1469, 2476, 3239, 3058, 830,
        107, 1908, 3082, 2378, 2931, 961, 1821, 2604, 448, 2264, 677, 2054, 2226,
        430, 555, 843, 2078, 871, 1550, 105, 422, 587, 177, 3094, 3038, 2869, 1574,
        1653, 3083, 778, 1159, 3182, 2552, 1483, 2727, 1119, 1739, 644, 2457, 349,
        418, 329, 3173, 3254, 817, 1097, 603, 610, 1322, 2044, 1864, 384, 2114, 3193,
        1218, 1994, 2455, 220, 2142, 1670, 2144, 1799, 2051, 794, 1819, 2475, 2459,
        478, 3221, 3021, 996, 991, 958, 1869, 1522, 1628,
    ];
    // deno-fmt-ignore
    exports.NTT_ZETAS_INV = [
        1701, 1807, 1460, 2371, 2338, 2333, 308, 108, 2851, 870, 854, 1510, 2535,
        1278, 1530, 1185, 1659, 1187, 3109, 874, 1335, 2111, 136, 1215, 2945, 1465,
        1285, 2007, 2719, 2726, 2232, 2512, 75, 156, 3000, 2911, 2980, 872, 2685,
        1590, 2210, 602, 1846, 777, 147, 2170, 2551, 246, 1676, 1755, 460, 291, 235,
        3152, 2742, 2907, 3224, 1779, 2458, 1251, 2486, 2774, 2899, 1103, 1275, 2652,
        1065, 2881, 725, 1508, 2368, 398, 951, 247, 1421, 3222, 2499, 271, 90, 853,
        1860, 3203, 1162, 1618, 666, 320, 8, 2813, 1544, 282, 1838, 1293, 2314, 552,
        2677, 2106, 1571, 205, 2918, 1542, 2721, 2597, 2312, 681, 130, 1602, 1871,
        829, 2946, 3065, 1325, 2756, 1861, 1474, 1202, 2367, 3147, 1752, 2707, 171,
        3127, 3042, 1907, 1836, 1517, 359, 758, 1441,
    ];
});
},{}], 5:[function(require,module,exports){(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./sha3.js"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shake256 = exports.shake128 = exports.sha3_512 = exports.sha3_256 = void 0;
    var sha3_1 = require("./sha3.js");
    Object.defineProperty(exports, "sha3_256", { enumerable: true, get: function () { return sha3_1.sha3_256; } });
    Object.defineProperty(exports, "sha3_512", { enumerable: true, get: function () { return sha3_1.sha3_512; } });
    Object.defineProperty(exports, "shake128", { enumerable: true, get: function () { return sha3_1.shake128; } });
    Object.defineProperty(exports, "shake256", { enumerable: true, get: function () { return sha3_1.shake256; } });
});
},{ "./sha3.js": 4}], 6:[function(require,module,exports){(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MlKemError = void 0;
    /**
     * The base error class of kyber-ts.
     */
    class MlKemError extends Error {
        constructor(e) {
            let message;
            if (e instanceof Error) {
                message = e.message;
            }
            else if (typeof e === "string") {
                message = e;
            }
            else {
                message = "";
            }
            super(message);
            this.name = this.constructor.name;
        }
    }
    exports.MlKemError = MlKemError;
});
},{}], 10:[function(require,module,exports){(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./consts.js", "./mlKemBase.js", "./utils.js"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MlKem1024 = void 0;
    /**
     * This implementation is based on https://github.com/antontutoveanu/crystals-kyber-javascript,
     * which was deveploped under the MIT licence below:
     * https://github.com/antontutoveanu/crystals-kyber-javascript/blob/main/LICENSE
     */
    const consts_js_1 = require("./consts.js");
    const mlKemBase_js_1 = require("./mlKemBase.js");
    const utils_js_1 = require("./utils.js");
    /**
     * Represents the MlKem1024 class, which extends the MlKemBase class.
     *
     * This class extends the MlKemBase class and provides specific implementation for MlKem1024.
     *
     * @remarks
     *
     * MlKem1024 is a specific implementation of the ML-KEM key encapsulation mechanism.
     *
     * @example
     *
     * ```ts
     * // Using jsr:
     * import { MlKem1024 } from "@dajiaji/mlkem";
     * // Using npm:
     * // import { MlKem1024 } from "mlkem"; // or "crystals-kyber-js"
     *
     * const recipient = new MlKem1024();
     * const [pkR, skR] = await recipient.generateKeyPair();
     *
     * const sender = new MlKem1024();
     * const [ct, ssS] = await sender.encap(pkR);
     *
     * const ssR = await recipient.decap(ct, skR);
     * // ssS === ssR
     * ```
     */
    class MlKem1024 extends mlKemBase_js_1.MlKemBase {
        /**
         * Constructs a new instance of the MlKem1024 class.
         */
        constructor() {
            super();
            Object.defineProperty(this, "_k", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 4
            });
            Object.defineProperty(this, "_du", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 11
            });
            Object.defineProperty(this, "_dv", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 5
            });
            Object.defineProperty(this, "_eta1", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 2
            });
            Object.defineProperty(this, "_eta2", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 2
            });
            this._skSize = 12 * this._k * consts_js_1.N / 8;
            this._pkSize = this._skSize + 32;
            this._compressedUSize = this._k * this._du * consts_js_1.N / 8;
            this._compressedVSize = this._dv * consts_js_1.N / 8;
        }
        // compressU lossily compresses and serializes a vector of polynomials.
        /**
         * Lossily compresses and serializes a vector of polynomials.
         *
         * @param u - The vector of polynomials to compress.
         * @returns The compressed and serialized data as a Uint8Array.
         */
        _compressU(r, u) {
            const t = new Array(8);
            for (let rr = 0, i = 0; i < this._k; i++) {
                for (let j = 0; j < consts_js_1.N / 8; j++) {
                    for (let k = 0; k < 8; k++) {
                        t[k] = (0, utils_js_1.uint16)(((((0, utils_js_1.uint32)(u[i][8 * j + k]) << 11) + (0, utils_js_1.uint32)(consts_js_1.Q / 2)) /
                            (0, utils_js_1.uint32)(consts_js_1.Q)) & 0x7ff);
                    }
                    r[rr++] = (0, utils_js_1.byte)(t[0] >> 0);
                    r[rr++] = (0, utils_js_1.byte)((t[0] >> 8) | (t[1] << 3));
                    r[rr++] = (0, utils_js_1.byte)((t[1] >> 5) | (t[2] << 6));
                    r[rr++] = (0, utils_js_1.byte)(t[2] >> 2);
                    r[rr++] = (0, utils_js_1.byte)((t[2] >> 10) | (t[3] << 1));
                    r[rr++] = (0, utils_js_1.byte)((t[3] >> 7) | (t[4] << 4));
                    r[rr++] = (0, utils_js_1.byte)((t[4] >> 4) | (t[5] << 7));
                    r[rr++] = (0, utils_js_1.byte)(t[5] >> 1);
                    r[rr++] = (0, utils_js_1.byte)((t[5] >> 9) | (t[6] << 2));
                    r[rr++] = (0, utils_js_1.byte)((t[6] >> 6) | (t[7] << 5));
                    r[rr++] = (0, utils_js_1.byte)(t[7] >> 3);
                }
            }
            return r;
        }
        // compressV lossily compresses and subsequently serializes a polynomial.
        /**
         * Lossily compresses and serializes a polynomial.
         *
         * @param r - The output buffer to store the compressed data.
         * @param v - The polynomial to compress.
         * @returns The compressed and serialized data as a Uint8Array.
         */
        _compressV(r, v) {
            const t = new Uint8Array(8);
            for (let rr = 0, i = 0; i < consts_js_1.N / 8; i++) {
                for (let j = 0; j < 8; j++) {
                    t[j] = (0, utils_js_1.byte)((((0, utils_js_1.uint32)(v[8 * i + j]) << 5) + (0, utils_js_1.uint32)(consts_js_1.Q / 2)) / (0, utils_js_1.uint32)(consts_js_1.Q)) & 31;
                }
                r[rr++] = (0, utils_js_1.byte)((t[0] >> 0) | (t[1] << 5));
                r[rr++] = (0, utils_js_1.byte)((t[1] >> 3) | (t[2] << 2) | (t[3] << 7));
                r[rr++] = (0, utils_js_1.byte)((t[3] >> 1) | (t[4] << 4));
                r[rr++] = (0, utils_js_1.byte)((t[4] >> 4) | (t[5] << 1) | (t[6] << 6));
                r[rr++] = (0, utils_js_1.byte)((t[6] >> 2) | (t[7] << 3));
            }
            return r;
        }
        // decompressU de-serializes and decompresses a vector of polynomials and
        // represents the approximate inverse of compress1. Since compression is lossy,
        // the results of decompression will may not match the original vector of polynomials.
        /**
         * Deserializes and decompresses a vector of polynomials.
         * This is the approximate inverse of the `_compressU` method.
         * Since compression is lossy, the decompressed data may not match the original vector of polynomials.
         *
         * @param a - The compressed and serialized data as a Uint8Array.
         * @returns The decompressed vector of polynomials.
         */
        _decompressU(a) {
            const r = new Array(this._k);
            for (let i = 0; i < this._k; i++) {
                r[i] = new Array(384);
            }
            const t = new Array(8);
            for (let aa = 0, i = 0; i < this._k; i++) {
                for (let j = 0; j < consts_js_1.N / 8; j++) {
                    t[0] = ((0, utils_js_1.uint16)(a[aa + 0]) >> 0) | ((0, utils_js_1.uint16)(a[aa + 1]) << 8);
                    t[1] = ((0, utils_js_1.uint16)(a[aa + 1]) >> 3) | ((0, utils_js_1.uint16)(a[aa + 2]) << 5);
                    t[2] = ((0, utils_js_1.uint16)(a[aa + 2]) >> 6) | ((0, utils_js_1.uint16)(a[aa + 3]) << 2) |
                        ((0, utils_js_1.uint16)(a[aa + 4]) << 10);
                    t[3] = ((0, utils_js_1.uint16)(a[aa + 4]) >> 1) | ((0, utils_js_1.uint16)(a[aa + 5]) << 7);
                    t[4] = ((0, utils_js_1.uint16)(a[aa + 5]) >> 4) | ((0, utils_js_1.uint16)(a[aa + 6]) << 4);
                    t[5] = ((0, utils_js_1.uint16)(a[aa + 6]) >> 7) | ((0, utils_js_1.uint16)(a[aa + 7]) << 1) |
                        ((0, utils_js_1.uint16)(a[aa + 8]) << 9);
                    t[6] = ((0, utils_js_1.uint16)(a[aa + 8]) >> 2) | ((0, utils_js_1.uint16)(a[aa + 9]) << 6);
                    t[7] = ((0, utils_js_1.uint16)(a[aa + 9]) >> 5) | ((0, utils_js_1.uint16)(a[aa + 10]) << 3);
                    aa = aa + 11;
                    for (let k = 0; k < 8; k++) {
                        r[i][8 * j + k] = ((0, utils_js_1.uint32)(t[k] & 0x7FF) * consts_js_1.Q + 1024) >> 11;
                    }
                }
            }
            return r;
        }
        // decompressV de-serializes and subsequently decompresses a polynomial,
        // representing the approximate inverse of compress2.
        // Note that compression is lossy, and thus decompression will not match the
        // original input.
        /**
         * Decompresses a given polynomial, representing the approximate inverse of
         * compress2, in Uint8Array into an array of numbers.
         *
         * Note that compression is lossy, and thus decompression will not match the
         * original input.
         *
         * @param a - The Uint8Array to decompress.
         * @returns An array of numbers obtained from the decompression process.
         */
        _decompressV(a) {
            const r = new Array(384);
            const t = new Array(8);
            for (let aa = 0, i = 0; i < consts_js_1.N / 8; i++) {
                t[0] = a[aa + 0] >> 0;
                t[1] = (a[aa + 0] >> 5) | (a[aa + 1] << 3);
                t[2] = a[aa + 1] >> 2;
                t[3] = (a[aa + 1] >> 7) | (a[aa + 2] << 1);
                t[4] = (a[aa + 2] >> 4) | (a[aa + 3] << 4);
                t[5] = a[aa + 3] >> 1;
                t[6] = (a[aa + 3] >> 6) | (a[aa + 4] << 2);
                t[7] = a[aa + 4] >> 3;
                aa = aa + 5;
                for (let j = 0; j < 8; j++) {
                    r[8 * i + j] = (0, utils_js_1.int16)((((0, utils_js_1.uint32)(t[j] & 31) * (0, utils_js_1.uint32)(consts_js_1.Q)) + 16) >> 5);
                }
            }
            return r;
        }
    }
    exports.MlKem1024 = MlKem1024;
    window.MlKem1024 = exports.MlKem1024;
});
},{ "./consts.js": 1, "./mlKemBase.js": 9, "./utils.js": 8}], 9:[function(require,module,exports){(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./deps.js", "./consts.js", "./errors.js", "./utils.js"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MlKemBase = void 0;
    /**
     * This implementation is based on https://github.com/antontutoveanu/crystals-kyber-javascript,
     * which was deveploped under the MIT licence below:
     * https://github.com/antontutoveanu/crystals-kyber-javascript/blob/main/LICENSE
     */
    const deps_js_1 = require("./deps.js");
    const consts_js_1 = require("./consts.js");
    const errors_js_1 = require("./errors.js");
    const utils_js_1 = require("./utils.js");
    /**
     * Represents the base class for the ML-KEM key encapsulation mechanism.
     *
     * This class provides the base implementation for the ML-KEM key encapsulation mechanism.
     *
     * @remarks
     *
     * This class is not intended to be used directly. Instead, use one of the subclasses:
     *
     * @example
     *
     * ```ts
     * // Using jsr:
     * import { MlKemBase } from "@dajiaji/mlkem";
     * // Using npm:
     * // import { MlKemBase } from "mlkem"; // or "crystals-kyber-js"
     *
     * class MlKem768 extends MlKemBase {
     *   protected _k = 3;
     *   protected _du = 10;
     *   protected _dv = 4;
     *   protected _eta1 = 2;
     *   protected _eta2 = 2;
     *
     *   constructor() {
     *     super();
     *     this._skSize = 12 * this._k * N / 8;
     *     this._pkSize = this._skSize + 32;
     *     this._compressedUSize = this._k * this._du * N / 8;
     *     this._compressedVSize = this._dv * N / 8;
     *   }
     * }
     *
     * const kyber = new MlKem768();
     * ```
     */
    class MlKemBase {
        /**
         * Creates a new instance of the MlKemBase class.
         */
        constructor() {
            Object.defineProperty(this, "_api", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: undefined
            });
            Object.defineProperty(this, "_k", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "_du", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "_dv", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "_eta1", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "_eta2", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "_skSize", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "_pkSize", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "_compressedUSize", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
            Object.defineProperty(this, "_compressedVSize", {
                enumerable: true,
                configurable: true,
                writable: true,
                value: 0
            });
        }
        /**
         * Generates a keypair [publicKey, privateKey].
         *
         * If an error occurred, throws {@link MlKemError}.
         *
         * @returns A kaypair [publicKey, privateKey].
         * @throws {@link MlKemError}
         *
         * @example Generates a {@link MlKem768} keypair.
         *
         * ```ts
         * // Using jsr:
         * import { MlKem768 } from "@dajiaji/mlkem";
         * // Using npm:
         * // import { MlKem768 } from "mlkem"; // or "crystals-kyber-js"
         *
         * const kyber = new MlKem768();
         * const [pk, sk] = await kyber.generateKeyPair();
         * ```
         */
        async generateKeyPair() {
            await this._setup();
            try {
                const rnd = new Uint8Array(64);
                this._api.getRandomValues(rnd);
                return this._deriveKeyPair(rnd);
            }
            catch (e) {
                throw new errors_js_1.MlKemError(e);
            }
        }
        /**
         * Derives a keypair [publicKey, privateKey] deterministically from a 64-octet seed.
         *
         * If an error occurred, throws {@link MlKemError}.
         *
         * @param seed A 64-octet seed for the deterministic key generation.
         * @returns A kaypair [publicKey, privateKey].
         * @throws {@link MlKemError}
         *
         * @example Derives a {@link MlKem768} keypair deterministically.
         *
         * ```ts
         * // Using jsr:
         * import { MlKem768 } from "@dajiaji/mlkem";
         * // Using npm:
         * // import { MlKem768 } from "mlkem"; // or "crystals-kyber-js"
         *
         * const kyber = new MlKem768();
         * const seed = new Uint8Array(64);
         * globalThis.crypto.getRandomValues(seed);
         * const [pk, sk] = await kyber.deriveKeyPair(seed);
         * ```
         */
        async deriveKeyPair(seed) {
            await this._setup();
            try {
                if (seed.byteLength !== 64) {
                    throw new Error("seed must be 64 bytes in length");
                }
                return this._deriveKeyPair(seed);
            }
            catch (e) {
                throw new errors_js_1.MlKemError(e);
            }
        }
        /**
         * Generates a shared secret from the encapsulated ciphertext and the private key.
         *
         * If an error occurred, throws {@link MlKemError}.
         *
         * @param pk A public key.
         * @param seed An optional 32-octet seed for the deterministic shared secret generation.
         * @returns A ciphertext (encapsulated public key) and a shared secret.
         * @throws {@link MlKemError}
         *
         * @example The {@link MlKem768} encapsulation.
         *
         * ```ts
         * // Using jsr:
         * import { MlKem768 } from "@dajiaji/mlkem";
         * // Using npm:
         * // import { MlKem768 } from "mlkem"; // or "crystals-kyber-js"
         *
         * const kyber = new MlKem768();
         * const [pk, sk] = await kyber.generateKeyPair();
         * const [ct, ss] = await kyber.encap(pk);
         * ```
         */
        async encap(pk, seed) {
            await this._setup();
            try {
                // validate key type; the modulo is checked in `_encap`.
                if (pk.length !== 384 * this._k + 32) {
                    throw new Error("invalid encapsulation key");
                }
                const m = this._getSeed(seed);
                const [k, r] = g(m, h(pk));
                const ct = this._encap(pk, m, r);
                return [ct, k];
            }
            catch (e) {
                throw new errors_js_1.MlKemError(e);
            }
        }
        /**
         * Generates a ciphertext for the public key and a shared secret.
         *
         * If an error occurred, throws {@link MlKemError}.
         *
         * @param ct A ciphertext generated by {@link encap}.
         * @param sk A private key.
         * @returns A shared secret.
         * @throws {@link MlKemError}
         *
         * @example The {@link MlKem768} decapsulation.
         *
         * ```ts
         * // Using jsr:
         * import { MlKem768 } from "@dajiaji/mlkem";
         * // Using npm:
         * // import { MlKem768 } from "mlkem"; // or "crystals-kyber-js"
         *
         * const kyber = new MlKem768();
         * const [pk, sk] = await kyber.generateKeyPair();
         * const [ct, ssS] = await kyber.encap(pk);
         * const ssR = await kyber.decap(ct, sk);
         * // ssS === ssR
         * ```
         */
        async decap(ct, sk) {
            await this._setup();
            try {
                // ciphertext type check
                if (ct.byteLength !== this._compressedUSize + this._compressedVSize) {
                    throw new Error("Invalid ct size");
                }
                // decapsulation key type check
                if (sk.length !== 768 * this._k + 96) {
                    throw new Error("Invalid decapsulation key");
                }
                const sk2 = sk.subarray(0, this._skSize);
                const pk = sk.subarray(this._skSize, this._skSize + this._pkSize);
                const hpk = sk.subarray(this._skSize + this._pkSize, this._skSize + this._pkSize + 32);
                const z = sk.subarray(this._skSize + this._pkSize + 32, this._skSize + this._pkSize + 64);
                const m2 = this._decap(ct, sk2);
                const [k2, r2] = g(m2, hpk);
                const kBar = kdf(z, ct);
                const ct2 = this._encap(pk, m2, r2);
                return (0, utils_js_1.constantTimeCompare)(ct, ct2) === 1 ? k2 : kBar;
            }
            catch (e) {
                throw new errors_js_1.MlKemError(e);
            }
        }
        /**
         * Sets up the MlKemBase instance by loading the necessary crypto library.
         * If the crypto library is already loaded, this method does nothing.
         * @returns {Promise<void>} A promise that resolves when the setup is complete.
         */
        async _setup() {
            if (this._api !== undefined) {
                return;
            }
            this._api = await (0, utils_js_1.loadCrypto)();
        }
        /**
         * Returns a Uint8Array seed for cryptographic operations.
         * If no seed is provided, a random seed of length 32 bytes is generated.
         * If a seed is provided, it must be exactly 32 bytes in length.
         *
         * @param seed - Optional seed for cryptographic operations.
         * @returns A Uint8Array seed.
         * @throws Error if the provided seed is not 32 bytes in length.
         */
        _getSeed(seed) {
            if (seed == undefined) {
                const s = new Uint8Array(32);
                this._api.getRandomValues(s);
                return s;
            }
            if (seed.byteLength !== 32) {
                throw new Error("seed must be 32 bytes in length");
            }
            return seed;
        }
        /**
         * Derives a key pair from a given seed.
         *
         * @param seed - The seed used for key derivation.
         * @returns An array containing the public key and secret key.
         */
        _deriveKeyPair(seed) {
            const cpaSeed = seed.subarray(0, 32);
            const z = seed.subarray(32, 64);
            const [pk, skBody] = this._deriveCpaKeyPair(cpaSeed);
            const pkh = h(pk);
            const sk = new Uint8Array(this._skSize + this._pkSize + 64);
            sk.set(skBody, 0);
            sk.set(pk, this._skSize);
            sk.set(pkh, this._skSize + this._pkSize);
            sk.set(z, this._skSize + this._pkSize + 32);
            return [pk, sk];
        }
        // indcpaKeyGen generates public and private keys for the CPA-secure
        // public-key encryption scheme underlying ML-KEM.
        /**
         * Derives a CPA key pair using the provided CPA seed.
         *
         * @param cpaSeed - The CPA seed used for key derivation.
         * @returns An array containing the public key and private key.
         */
        _deriveCpaKeyPair(cpaSeed) {
            const [publicSeed, noiseSeed] = g(cpaSeed, new Uint8Array([this._k]));
            const a = this._sampleMatrix(publicSeed, false);
            const s = this._sampleNoise1(noiseSeed, 0, this._k);
            const e = this._sampleNoise1(noiseSeed, this._k, this._k);
            // perform number theoretic transform on secret s
            for (let i = 0; i < this._k; i++) {
                s[i] = ntt(s[i]);
                s[i] = reduce(s[i]);
                e[i] = ntt(e[i]);
            }
            // KEY COMPUTATION
            // pk = A*s + e
            const pk = new Array(this._k);
            for (let i = 0; i < this._k; i++) {
                pk[i] = polyToMont(multiply(a[i], s));
                pk[i] = add(pk[i], e[i]);
                pk[i] = reduce(pk[i]);
            }
            // PUBLIC KEY
            // turn polynomials into byte arrays
            const pubKey = new Uint8Array(this._pkSize);
            for (let i = 0; i < this._k; i++) {
                pubKey.set(polyToBytes(pk[i]), i * 384);
            }
            // append public seed
            pubKey.set(publicSeed, this._skSize);
            // PRIVATE KEY
            // turn polynomials into byte arrays
            const privKey = new Uint8Array(this._skSize);
            for (let i = 0; i < this._k; i++) {
                privKey.set(polyToBytes(s[i]), i * 384);
            }
            return [pubKey, privKey];
        }
        // _encap is the encapsulation function of the CPA-secure
        // public-key encryption scheme underlying ML-KEM.
        /**
         * Encapsulates a message using the ML-KEM encryption scheme.
         *
         * @param pk - The public key.
         * @param msg - The message to be encapsulated.
         * @param seed - The seed used for generating random values.
         * @returns The encapsulated message as a Uint8Array.
         */
        _encap(pk, msg, seed) {
            const tHat = new Array(this._k);
            const pkCheck = new Uint8Array(384 * this._k); // to validate the pk modulo (see input validation at NIST draft 6.2)
            for (let i = 0; i < this._k; i++) {
                tHat[i] = polyFromBytes(pk.subarray(i * 384, (i + 1) * 384));
                pkCheck.set(polyToBytes(tHat[i]), i * 384);
            }
            if (!(0, utils_js_1.equalUint8Array)(pk.subarray(0, pkCheck.length), pkCheck)) {
                throw new Error("invalid encapsulation key");
            }
            const rho = pk.subarray(this._skSize);
            const a = this._sampleMatrix(rho, true);
            const r = this._sampleNoise1(seed, 0, this._k);
            const e1 = this._sampleNoise2(seed, this._k, this._k);
            const e2 = this._sampleNoise2(seed, this._k * 2, 1)[0];
            // perform number theoretic transform on random vector r
            for (let i = 0; i < this._k; i++) {
                r[i] = ntt(r[i]);
                r[i] = reduce(r[i]);
            }
            // u = A*r + e1
            const u = new Array(this._k);
            for (let i = 0; i < this._k; i++) {
                u[i] = multiply(a[i], r);
                u[i] = nttInverse(u[i]);
                u[i] = add(u[i], e1[i]);
                u[i] = reduce(u[i]);
            }
            // v = tHat*r + e2 + m
            const m = polyFromMsg(msg);
            let v = multiply(tHat, r);
            v = nttInverse(v);
            v = add(v, e2);
            v = add(v, m);
            v = reduce(v);
            // compress
            const ret = new Uint8Array(this._compressedUSize + this._compressedVSize);
            this._compressU(ret.subarray(0, this._compressedUSize), u);
            this._compressV(ret.subarray(this._compressedUSize), v);
            return ret;
        }
        // indcpaDecrypt is the decryption function of the CPA-secure
        // public-key encryption scheme underlying ML-KEM.
        /**
         * Decapsulates the ciphertext using the provided secret key.
         *
         * @param ct - The ciphertext to be decapsulated.
         * @param sk - The secret key used for decapsulation.
         * @returns The decapsulated message as a Uint8Array.
         */
        _decap(ct, sk) {
            // extract ciphertext
            const u = this._decompressU(ct.subarray(0, this._compressedUSize));
            const v = this._decompressV(ct.subarray(this._compressedUSize));
            const privateKeyPolyvec = this._polyvecFromBytes(sk);
            for (let i = 0; i < this._k; i++) {
                u[i] = ntt(u[i]);
            }
            let mp = multiply(privateKeyPolyvec, u);
            mp = nttInverse(mp);
            mp = subtract(v, mp);
            mp = reduce(mp);
            return polyToMsg(mp);
        }
        // generateMatrixA deterministically generates a matrix `A` (or the transpose of `A`)
        // from a seed. Entries of the matrix are polynomials that look uniformly random.
        // Performs rejection sampling on the output of an extendable-output function (XOF).
        /**
         * Generates a sample matrix based on the provided seed and transposition flag.
         *
         * @param seed - The seed used for generating the matrix.
         * @param transposed - A flag indicating whether the matrix should be transposed or not.
         * @returns The generated sample matrix.
         */
        _sampleMatrix(seed, transposed) {
            const a = new Array(this._k);
            const transpose = new Uint8Array(2);
            for (let ctr = 0, i = 0; i < this._k; i++) {
                a[i] = new Array(this._k);
                for (let j = 0; j < this._k; j++) {
                    // set if transposed matrix or not
                    if (transposed) {
                        transpose[0] = i;
                        transpose[1] = j;
                    }
                    else {
                        transpose[0] = j;
                        transpose[1] = i;
                    }
                    const output = xof(seed, transpose);
                    // run rejection sampling on the output from above
                    const result = indcpaRejUniform(output.subarray(0, 504), 504, consts_js_1.N);
                    a[i][j] = result[0]; // the result here is an NTT-representation
                    ctr = result[1]; // keeps track of index of output array from sampling function
                    while (ctr < consts_js_1.N) { // if the polynomial hasnt been filled yet with mod q entries
                        const outputn = output.subarray(504, 672); // take last 168 bytes of byte array from xof
                        const result1 = indcpaRejUniform(outputn, 168, consts_js_1.N - ctr); // run sampling function again
                        const missing = result1[0]; // here is additional mod q polynomial coefficients
                        const ctrn = result1[1]; // how many coefficients were accepted and are in the output
                        // starting at last position of output array from first sampling function until 256 is reached
                        for (let k = ctr; k < consts_js_1.N; k++) {
                            a[i][j][k] = missing[k - ctr]; // fill rest of array with the additional coefficients until full
                        }
                        ctr = ctr + ctrn; // update index
                    }
                }
            }
            return a;
        }
        /**
         * Generates a 2D array of noise samples.
         *
         * @param sigma - The noise parameter.
         * @param offset - The offset value.
         * @param size - The size of the array.
         * @returns The generated 2D array of noise samples.
         */
        _sampleNoise1(sigma, offset, size) {
            const r = new Array(size);
            for (let i = 0; i < size; i++) {
                r[i] = byteopsCbd((0, utils_js_1.prf)(this._eta1 * consts_js_1.N / 4, sigma, offset), this._eta1);
                offset++;
            }
            return r;
        }
        /**
         * Generates a 2-dimensional array of noise samples.
         *
         * @param sigma - The noise parameter.
         * @param offset - The offset value.
         * @param size - The size of the array.
         * @returns The generated 2-dimensional array of noise samples.
         */
        _sampleNoise2(sigma, offset, size) {
            const r = new Array(size);
            for (let i = 0; i < size; i++) {
                r[i] = byteopsCbd((0, utils_js_1.prf)(this._eta2 * consts_js_1.N / 4, sigma, offset), this._eta2);
                offset++;
            }
            return r;
        }
        // polyvecFromBytes deserializes a vector of polynomials.
        /**
         * Converts a Uint8Array to a 2D array of numbers representing a polynomial vector.
         * Each element in the resulting array represents a polynomial.
         * @param a The Uint8Array to convert.
         * @returns The 2D array of numbers representing the polynomial vector.
         */
        _polyvecFromBytes(a) {
            const r = new Array(this._k);
            for (let i = 0; i < this._k; i++) {
                r[i] = polyFromBytes(a.subarray(i * 384, (i + 1) * 384));
            }
            return r;
        }
        // compressU lossily compresses and serializes a vector of polynomials.
        /**
         * Compresses the given array of coefficients into a Uint8Array.
         *
         * @param r - The output Uint8Array.
         * @param u - The array of coefficients.
         * @returns The compressed Uint8Array.
         */
        _compressU(r, u) {
            const t = new Array(4);
            for (let rr = 0, i = 0; i < this._k; i++) {
                for (let j = 0; j < consts_js_1.N / 4; j++) {
                    for (let k = 0; k < 4; k++) {
                        // parse {0,...,3328} to {0,...,1023}
                        t[k] = (((u[i][4 * j + k] << 10) + consts_js_1.Q / 2) / consts_js_1.Q) &
                            0b1111111111;
                    }
                    // converts 4 12-bit coefficients {0,...,3328} to 5 8-bit bytes {0,...,255}
                    // 48 bits down to 40 bits per block
                    r[rr++] = (0, utils_js_1.byte)(t[0] >> 0);
                    r[rr++] = (0, utils_js_1.byte)((t[0] >> 8) | (t[1] << 2));
                    r[rr++] = (0, utils_js_1.byte)((t[1] >> 6) | (t[2] << 4));
                    r[rr++] = (0, utils_js_1.byte)((t[2] >> 4) | (t[3] << 6));
                    r[rr++] = (0, utils_js_1.byte)(t[3] >> 2);
                }
            }
            return r;
        }
        // compressV lossily compresses and subsequently serializes a polynomial.
        /**
         * Compresses the given array of numbers into a Uint8Array.
         *
         * @param r - The Uint8Array to store the compressed values.
         * @param v - The array of numbers to compress.
         * @returns The compressed Uint8Array.
         */
        _compressV(r, v) {
            // const r = new Uint8Array(128);
            const t = new Uint8Array(8);
            for (let rr = 0, i = 0; i < consts_js_1.N / 8; i++) {
                for (let j = 0; j < 8; j++) {
                    t[j] = (0, utils_js_1.byte)(((v[8 * i + j] << 4) + consts_js_1.Q / 2) / consts_js_1.Q) & 0b1111;
                }
                r[rr++] = t[0] | (t[1] << 4);
                r[rr++] = t[2] | (t[3] << 4);
                r[rr++] = t[4] | (t[5] << 4);
                r[rr++] = t[6] | (t[7] << 4);
            }
            return r;
        }
        // decompressU de-serializes and decompresses a vector of polynomials and
        // represents the approximate inverse of compress1. Since compression is lossy,
        // the results of decompression will may not match the original vector of polynomials.
        /**
         * Decompresses a Uint8Array into a two-dimensional array of numbers.
         *
         * @param a The Uint8Array to decompress.
         * @returns The decompressed two-dimensional array.
         */
        _decompressU(a) {
            const r = new Array(this._k);
            for (let i = 0; i < this._k; i++) {
                r[i] = new Array(384);
            }
            const t = new Array(4);
            for (let aa = 0, i = 0; i < this._k; i++) {
                for (let j = 0; j < consts_js_1.N / 4; j++) {
                    t[0] = ((0, utils_js_1.uint16)(a[aa + 0]) >> 0) | ((0, utils_js_1.uint16)(a[aa + 1]) << 8);
                    t[1] = ((0, utils_js_1.uint16)(a[aa + 1]) >> 2) | ((0, utils_js_1.uint16)(a[aa + 2]) << 6);
                    t[2] = ((0, utils_js_1.uint16)(a[aa + 2]) >> 4) | ((0, utils_js_1.uint16)(a[aa + 3]) << 4);
                    t[3] = ((0, utils_js_1.uint16)(a[aa + 3]) >> 6) | ((0, utils_js_1.uint16)(a[aa + 4]) << 2);
                    aa = aa + 5;
                    for (let k = 0; k < 4; k++) {
                        r[i][4 * j + k] = (0, utils_js_1.int16)(((((0, utils_js_1.uint32)(t[k] & 0x3FF)) * ((0, utils_js_1.uint32)(consts_js_1.Q))) + 512) >> 10);
                    }
                }
            }
            return r;
        }
        // decompressV de-serializes and subsequently decompresses a polynomial,
        // representing the approximate inverse of compress2.
        // Note that compression is lossy, and thus decompression will not match the
        // original input.
        /**
         * Decompresses a Uint8Array into an array of numbers.
         *
         * @param a - The Uint8Array to decompress.
         * @returns An array of numbers.
         */
        _decompressV(a) {
            const r = new Array(384);
            for (let aa = 0, i = 0; i < consts_js_1.N / 2; i++, aa++) {
                r[2 * i + 0] = (0, utils_js_1.int16)((((0, utils_js_1.uint16)(a[aa] & 15) * (0, utils_js_1.uint16)(consts_js_1.Q)) + 8) >> 4);
                r[2 * i + 1] = (0, utils_js_1.int16)((((0, utils_js_1.uint16)(a[aa] >> 4) * (0, utils_js_1.uint16)(consts_js_1.Q)) + 8) >> 4);
            }
            return r;
        }
    }
    exports.MlKemBase = MlKemBase;
    /**
     * Computes the hash of the input array `a` and an optional input array `b`.
     * Returns an array containing two Uint8Arrays, representing the first 32 bytes and the next 32 bytes of the hash digest.
     * @param a - The input array to be hashed.
     * @param b - An optional input array to be hashed along with `a`.
     * @returns An array containing two Uint8Arrays representing the hash digest.
     */
    function g(a, b) {
        const hash = deps_js_1.sha3_512.create().update(a);
        if (b !== undefined) {
            hash.update(b);
        }
        const res = hash.digest();
        return [res.subarray(0, 32), res.subarray(32, 64)];
    }
    /**
     * Computes the SHA3-256 hash of the given message.
     *
     * @param msg - The input message as a Uint8Array.
     * @returns The computed hash as a Uint8Array.
     */
    function h(msg) {
        return deps_js_1.sha3_256.create().update(msg).digest();
    }
    /**
     * Key Derivation Function (KDF) that takes an input array `a` and an optional input array `b`.
     * It uses the SHAKE256 hash function to derive a 32-byte output.
     *
     * @param a - The input array.
     * @param b - The optional input array.
     * @returns The derived key as a Uint8Array.
     */
    function kdf(a, b) {
        const hash = deps_js_1.shake256.create({ dkLen: 32 }).update(a);
        if (b !== undefined) {
            hash.update(b);
        }
        return hash.digest();
    }
    /**
     * Computes the extendable-output function (XOF) using the SHAKE128 algorithm.
     *
     * @param seed - The seed value for the XOF.
     * @param transpose - The transpose value for the XOF.
     * @returns The computed XOF value as a Uint8Array.
     */
    function xof(seed, transpose) {
        return deps_js_1.shake128.create({ dkLen: 672 }).update(seed).update(transpose)
            .digest();
    }
    // polyToBytes serializes a polynomial into an array of bytes.
    /**
     * Converts a polynomial represented by an array of numbers to a Uint8Array.
     * Each coefficient of the polynomial is reduced modulo q.
     *
     * @param a - The array representing the polynomial.
     * @returns The Uint8Array representation of the polynomial.
     */
    function polyToBytes(a) {
        let t0 = 0;
        let t1 = 0;
        const r = new Uint8Array(384);
        const a2 = subtractQ(a); // Returns: a - q if a >= q, else a (each coefficient of the polynomial)
        // for 0-127
        for (let i = 0; i < consts_js_1.N / 2; i++) {
            // get two coefficient entries in the polynomial
            t0 = (0, utils_js_1.uint16)(a2[2 * i]);
            t1 = (0, utils_js_1.uint16)(a2[2 * i + 1]);
            // convert the 2 coefficient into 3 bytes
            r[3 * i + 0] = (0, utils_js_1.byte)(t0 >> 0); // byte() does mod 256 of the input (output value 0-255)
            r[3 * i + 1] = (0, utils_js_1.byte)(t0 >> 8) | (0, utils_js_1.byte)(t1 << 4);
            r[3 * i + 2] = (0, utils_js_1.byte)(t1 >> 4);
        }
        return r;
    }
    // polyFromBytes de-serialises an array of bytes into a polynomial,
    // and represents the inverse of polyToBytes.
    /**
     * Converts a Uint8Array to an array of numbers representing a polynomial.
     * Each element in the array represents a coefficient of the polynomial.
     * The input array `a` should have a length of 384.
     * The function performs bitwise operations to extract the coefficients from the input array.
     * @param a The Uint8Array to convert to a polynomial.
     * @returns An array of numbers representing the polynomial.
     */
    function polyFromBytes(a) {
        const r = new Array(384).fill(0);
        for (let i = 0; i < consts_js_1.N / 2; i++) {
            r[2 * i] = (0, utils_js_1.int16)((((0, utils_js_1.uint16)(a[3 * i + 0]) >> 0) | ((0, utils_js_1.uint16)(a[3 * i + 1]) << 8)) & 0xFFF);
            r[2 * i + 1] = (0, utils_js_1.int16)((((0, utils_js_1.uint16)(a[3 * i + 1]) >> 4) | ((0, utils_js_1.uint16)(a[3 * i + 2]) << 4)) & 0xFFF);
        }
        return r;
    }
    // polyToMsg converts a polynomial to a 32-byte message
    // and represents the inverse of polyFromMsg.
    /**
     * Converts a polynomial to a message represented as a Uint8Array.
     * @param a - The polynomial to convert.
     * @returns The message as a Uint8Array.
     */
    function polyToMsg(a) {
        const msg = new Uint8Array(32);
        let t;
        const a2 = subtractQ(a);
        for (let i = 0; i < consts_js_1.N / 8; i++) {
            msg[i] = 0;
            for (let j = 0; j < 8; j++) {
                t = ((((0, utils_js_1.uint16)(a2[8 * i + j]) << 1) + (0, utils_js_1.uint16)(consts_js_1.Q / 2)) /
                    (0, utils_js_1.uint16)(consts_js_1.Q)) & 1;
                msg[i] |= (0, utils_js_1.byte)(t << j);
            }
        }
        return msg;
    }
    // polyFromMsg converts a 32-byte message to a polynomial.
    /**
     * Converts a Uint8Array message to an array of numbers representing a polynomial.
     * Each element in the array is an int16 (0-65535).
     *
     * @param msg - The Uint8Array message to convert.
     * @returns An array of numbers representing the polynomial.
     */
    function polyFromMsg(msg) {
        const r = new Array(384).fill(0); // each element is int16 (0-65535)
        let mask; // int16
        for (let i = 0; i < consts_js_1.N / 8; i++) {
            for (let j = 0; j < 8; j++) {
                mask = -1 * (0, utils_js_1.int16)((msg[i] >> j) & 1);
                r[8 * i + j] = mask & (0, utils_js_1.int16)((consts_js_1.Q + 1) / 2);
            }
        }
        return r;
    }
    // indcpaRejUniform runs rejection sampling on uniform random bytes
    // to generate uniform random integers modulo `Q`.
    /**
     * Generates an array of random numbers from a given buffer, rejecting values greater than a specified threshold.
     *
     * @param buf - The input buffer containing random bytes.
     * @param bufl - The length of the input buffer.
     * @param len - The desired length of the output array.
     * @returns An array of random numbers and the actual length of the output array.
     */
    function indcpaRejUniform(buf, bufl, len) {
        const r = new Array(384).fill(0);
        let ctr = 0;
        let val0, val1; // d1, d2 in kyber documentation
        for (let pos = 0; ctr < len && pos + 3 <= bufl;) {
            // compute d1 and d2
            val0 = ((0, utils_js_1.uint16)((buf[pos]) >> 0) | ((0, utils_js_1.uint16)(buf[pos + 1]) << 8)) & 0xFFF;
            val1 = ((0, utils_js_1.uint16)((buf[pos + 1]) >> 4) | ((0, utils_js_1.uint16)(buf[pos + 2]) << 4)) & 0xFFF;
            // increment input buffer index by 3
            pos = pos + 3;
            // if d1 is less than 3329
            if (val0 < consts_js_1.Q) {
                // assign to d1
                r[ctr] = val0;
                // increment position of output array
                ctr = ctr + 1;
            }
            if (ctr < len && val1 < consts_js_1.Q) {
                r[ctr] = val1;
                ctr = ctr + 1;
            }
        }
        return [r, ctr];
    }
    // byteopsCbd computes a polynomial with coefficients distributed
    // according to a centered binomial distribution with parameter PARAMS_ETA,
    // given an array of uniformly random bytes.
    /**
     * Converts a Uint8Array buffer to an array of numbers using the CBD operation.
     * @param buf - The input Uint8Array buffer.
     * @param eta - The value used in the CBD operation.
     * @returns An array of numbers obtained from the CBD operation.
     */
    function byteopsCbd(buf, eta) {
        let t, d;
        let a, b;
        const r = new Array(384).fill(0);
        for (let i = 0; i < consts_js_1.N / 8; i++) {
            t = (0, utils_js_1.byteopsLoad32)(buf.subarray(4 * i, buf.length));
            d = t & 0x55555555;
            d = d + ((t >> 1) & 0x55555555);
            for (let j = 0; j < 8; j++) {
                a = (0, utils_js_1.int16)((d >> (4 * j + 0)) & 0x3);
                b = (0, utils_js_1.int16)((d >> (4 * j + eta)) & 0x3);
                r[8 * i + j] = a - b;
            }
        }
        return r;
    }
    // ntt performs an inplace number-theoretic transform (NTT) in `Rq`.
    // The input is in standard order, the output is in bit-reversed order.
    /**
     * Performs the Number Theoretic Transform (NTT) on an array of numbers.
     *
     * @param r - The input array of numbers.
     * @returns The transformed array of numbers.
     */
    function ntt(r) {
        // 128, 64, 32, 16, 8, 4, 2
        for (let j = 0, k = 1, l = 128; l >= 2; l >>= 1) {
            // 0,
            for (let start = 0; start < 256; start = j + l) {
                const zeta = consts_js_1.NTT_ZETAS[k];
                k = k + 1;
                // for each element in the subsections (128, 64, 32, 16, 8, 4, 2) starting at an offset
                for (j = start; j < start + l; j++) {
                    // compute the modular multiplication of the zeta and each element in the subsection
                    const t = nttFqMul(zeta, r[j + l]); // t is mod q
                    // overwrite each element in the subsection as the opposite subsection element minus t
                    r[j + l] = r[j] - t;
                    // add t back again to the opposite subsection
                    r[j] = r[j] + t;
                }
            }
        }
        return r;
    }
    // nttFqMul performs multiplication followed by Montgomery reduction
    // and returns a 16-bit integer congruent to `a*b*R^{-1} mod Q`.
    /**
     * Performs an NTT (Number Theoretic Transform) multiplication on two numbers in Fq.
     * @param a The first number.
     * @param b The second number.
     * @returns The result of the NTT multiplication.
     */
    function nttFqMul(a, b) {
        return byteopsMontgomeryReduce(a * b);
    }
    // reduce applies Barrett reduction to all coefficients of a polynomial.
    /**
     * Reduces each element in the given array using the barrett function.
     *
     * @param r - The array to be reduced.
     * @returns The reduced array.
     */
    function reduce(r) {
        for (let i = 0; i < consts_js_1.N; i++) {
            r[i] = barrett(r[i]);
        }
        return r;
    }
    // barrett computes a Barrett reduction; given
    // a integer `a`, returns a integer congruent to
    // `a mod Q` in {0,...,Q}.
    /**
     * Performs the Barrett reduction algorithm on the given number.
     *
     * @param a - The number to be reduced.
     * @returns The result of the reduction.
     */
    function barrett(a) {
        const v = ((1 << 24) + consts_js_1.Q / 2) / consts_js_1.Q;
        let t = v * a >> 24;
        t = t * consts_js_1.Q;
        return a - t;
    }
    // byteopsMontgomeryReduce computes a Montgomery reduction; given
    // a 32-bit integer `a`, returns `a * R^-1 mod Q` where `R=2^16`.
    /**
     * Performs Montgomery reduction on a given number.
     * @param a - The number to be reduced.
     * @returns The reduced number.
     */
    function byteopsMontgomeryReduce(a) {
        const u = (0, utils_js_1.int16)((0, utils_js_1.int32)(a) * consts_js_1.Q_INV);
        let t = u * consts_js_1.Q;
        t = a - t;
        t >>= 16;
        return (0, utils_js_1.int16)(t);
    }
    // polyToMont performs the in-place conversion of all coefficients
    // of a polynomial from the normal domain to the Montgomery domain.
    /**
     * Converts a polynomial to the Montgomery domain.
     *
     * @param r - The polynomial to be converted.
     * @returns The polynomial in the Montgomery domain.
     */
    function polyToMont(r) {
        // let f = int16(((uint64(1) << 32)) % uint64(Q));
        const f = 1353; // if Q changes then this needs to be updated
        for (let i = 0; i < consts_js_1.N; i++) {
            r[i] = byteopsMontgomeryReduce((0, utils_js_1.int32)(r[i]) * (0, utils_js_1.int32)(f));
        }
        return r;
    }
    // pointwise-multiplies elements of polynomial-vectors
    // `a` and `b`, accumulates the results into `r`, and then multiplies by `2^-16`.
    /**
     * Multiplies two matrices element-wise and returns the result.
     * @param a - The first matrix.
     * @param b - The second matrix.
     * @returns The resulting matrix after element-wise multiplication.
     */
    function multiply(a, b) {
        let r = polyBaseMulMontgomery(a[0], b[0]);
        let t;
        for (let i = 1; i < a.length; i++) {
            t = polyBaseMulMontgomery(a[i], b[i]);
            r = add(r, t);
        }
        return reduce(r);
    }
    // polyBaseMulMontgomery performs the multiplication of two polynomials
    // in the number-theoretic transform (NTT) domain.
    /**
     * Performs polynomial base multiplication in Montgomery domain.
     * @param a - The first polynomial array.
     * @param b - The second polynomial array.
     * @returns The result of the polynomial base multiplication.
     */
    function polyBaseMulMontgomery(a, b) {
        let rx, ry;
        for (let i = 0; i < consts_js_1.N / 4; i++) {
            rx = nttBaseMul(a[4 * i + 0], a[4 * i + 1], b[4 * i + 0], b[4 * i + 1], consts_js_1.NTT_ZETAS[64 + i]);
            ry = nttBaseMul(a[4 * i + 2], a[4 * i + 3], b[4 * i + 2], b[4 * i + 3], -consts_js_1.NTT_ZETAS[64 + i]);
            a[4 * i + 0] = rx[0];
            a[4 * i + 1] = rx[1];
            a[4 * i + 2] = ry[0];
            a[4 * i + 3] = ry[1];
        }
        return a;
    }
    // nttBaseMul performs the multiplication of polynomials
    // in `Zq[X]/(X^2-zeta)`. Used for multiplication of elements
    // in `Rq` in the number-theoretic transformation domain.
    /**
     * Performs NTT base multiplication.
     *
     * @param a0 - The first coefficient of the first polynomial.
     * @param a1 - The second coefficient of the first polynomial.
     * @param b0 - The first coefficient of the second polynomial.
     * @param b1 - The second coefficient of the second polynomial.
     * @param zeta - The zeta value used in the multiplication.
     * @returns An array containing the result of the multiplication.
     */
    function nttBaseMul(a0, a1, b0, b1, zeta) {
        const r = new Array(2);
        r[0] = nttFqMul(a1, b1);
        r[0] = nttFqMul(r[0], zeta);
        r[0] += nttFqMul(a0, b0);
        r[1] = nttFqMul(a0, b1);
        r[1] += nttFqMul(a1, b0);
        return r;
    }
    // adds two polynomials.
    /**
     * Adds two arrays element-wise.
     * @param a - The first array.
     * @param b - The second array.
     * @returns The resulting array after element-wise addition.
     */
    function add(a, b) {
        const c = new Array(384);
        for (let i = 0; i < consts_js_1.N; i++) {
            c[i] = a[i] + b[i];
        }
        return c;
    }
    // subtracts two polynomials.
    /**
     * Subtracts the elements of array b from array a.
     *
     * @param a - The array from which to subtract.
     * @param b - The array to subtract.
     * @returns The resulting array after subtraction.
     */
    function subtract(a, b) {
        for (let i = 0; i < consts_js_1.N; i++) {
            a[i] -= b[i];
        }
        return a;
    }
    // nttInverse performs an inplace inverse number-theoretic transform (NTT)
    // in `Rq` and multiplication by Montgomery factor 2^16.
    // The input is in bit-reversed order, the output is in standard order.
    /**
     * Performs the inverse Number Theoretic Transform (NTT) on the given array.
     *
     * @param r - The input array to perform the inverse NTT on.
     * @returns The array after performing the inverse NTT.
     */
    function nttInverse(r) {
        let j = 0;
        for (let k = 0, l = 2; l <= 128; l <<= 1) {
            for (let start = 0; start < 256; start = j + l) {
                const zeta = consts_js_1.NTT_ZETAS_INV[k];
                k = k + 1;
                for (j = start; j < start + l; j++) {
                    const t = r[j];
                    r[j] = barrett(t + r[j + l]);
                    r[j + l] = t - r[j + l];
                    r[j + l] = nttFqMul(zeta, r[j + l]);
                }
            }
        }
        for (j = 0; j < 256; j++) {
            r[j] = nttFqMul(r[j], consts_js_1.NTT_ZETAS_INV[127]);
        }
        return r;
    }
    // subtractQ applies the conditional subtraction of q to each coefficient of a polynomial.
    // if a is 3329 then convert to 0
    // Returns:     a - q if a >= q, else a
    /**
     * Subtracts the value of Q from each element in the given array.
     * The result should be a negative integer for each element.
     * If the leftmost bit is 0 (positive number), the value of Q is added back.
     *
     * @param r - The array to subtract Q from.
     * @returns The resulting array after the subtraction.
     */
    function subtractQ(r) {
        for (let i = 0; i < consts_js_1.N; i++) {
            r[i] -= consts_js_1.Q; // should result in a negative integer
            // push left most signed bit to right most position
            // javascript does bitwise operations in signed 32 bit
            // add q back again if left most bit was 0 (positive number)
            r[i] += (r[i] >> 31) & consts_js_1.Q;
        }
        return r;
    }
});
},{ "./consts.js": 1, "./deps.js": 5, "./errors.js": 6, "./utils.js": 8}], 11:[function(require,module,exports){const mlKemModule = require('./mlKem1024.js');
window.MlKem1024 = mlKemModule.MlKem1024;      
},{ "./mlKem1024.js": 10}], 4:[function(require,module,exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shake256 = exports.shake128 = exports.keccak_512 = exports.keccak_384 = exports.keccak_256 = exports.keccak_224 = exports.sha3_512 = exports.sha3_384 = exports.sha3_256 = exports.sha3_224 = exports.Keccak = void 0;
exports.keccakP = keccakP;
/**
 * SHA3 (keccak) hash function, based on a new "Sponge function" design.
 * Different from older hashes, the internal state is bigger than output size.
 *
 * Check out [FIPS-202](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf),
 * [Website](https://keccak.team/keccak.html),
 * [the differences between SHA-3 and Keccak](https://crypto.stackexchange.com/questions/15727/what-are-the-key-differences-between-the-draft-sha-3-standard-and-the-keccak-sub).
 *
 * Check out `sha3-addons` module for cSHAKE, k12, and others.
 * @module
 */
const _u64_ts_1 = require("./_u64.js");
// prettier-ignore
const utils_ts_1 = require("./sha3utils.js");
// No __PURE__ annotations in sha3 header:
// EVERYTHING is in fact used on every export.
// Various per round constants calculations
const _0n = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
const _7n = BigInt(7);
const _256n = BigInt(256);
const _0x71n = BigInt(0x71);
const SHA3_PI = [];
const SHA3_ROTL = [];
const _SHA3_IOTA = [];
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
    // Pi
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    // Rotational
    SHA3_ROTL.push((((round + 1) * (round + 2)) / 2) % 64);
    // Iota
    let t = _0n;
    for (let j = 0; j < 7; j++) {
        R = ((R << _1n) ^ ((R >> _7n) * _0x71n)) % _256n;
        if (R & _2n)
            t ^= _1n << ((_1n << /* @__PURE__ */ BigInt(j)) - _1n);
    }
    _SHA3_IOTA.push(t);
}
const IOTAS = (0, _u64_ts_1.split)(_SHA3_IOTA, true);
const SHA3_IOTA_H = IOTAS[0];
const SHA3_IOTA_L = IOTAS[1];
// Left rotation (without 0, 32, 64)
const rotlH = (h, l, s) => (s > 32 ? (0, _u64_ts_1.rotlBH)(h, l, s) : (0, _u64_ts_1.rotlSH)(h, l, s));
const rotlL = (h, l, s) => (s > 32 ? (0, _u64_ts_1.rotlBL)(h, l, s) : (0, _u64_ts_1.rotlSL)(h, l, s));
/** `keccakf1600` internal function, additionally allows to adjust round count. */
function keccakP(s, rounds = 24) {
    const B = new Uint32Array(5 * 2);
    // NOTE: all indices are x2 since we store state as u32 instead of u64 (bigints to slow in js)
    for (let round = 24 - rounds; round < 24; round++) {
        // Theta θ
        for (let x = 0; x < 10; x++)
            B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
        for (let x = 0; x < 10; x += 2) {
            const idx1 = (x + 8) % 10;
            const idx0 = (x + 2) % 10;
            const B0 = B[idx0];
            const B1 = B[idx0 + 1];
            const Th = rotlH(B0, B1, 1) ^ B[idx1];
            const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
            for (let y = 0; y < 50; y += 10) {
                s[x + y] ^= Th;
                s[x + y + 1] ^= Tl;
            }
        }
        // Rho (ρ) and Pi (π)
        let curH = s[2];
        let curL = s[3];
        for (let t = 0; t < 24; t++) {
            const shift = SHA3_ROTL[t];
            const Th = rotlH(curH, curL, shift);
            const Tl = rotlL(curH, curL, shift);
            const PI = SHA3_PI[t];
            curH = s[PI];
            curL = s[PI + 1];
            s[PI] = Th;
            s[PI + 1] = Tl;
        }
        // Chi (χ)
        for (let y = 0; y < 50; y += 10) {
            for (let x = 0; x < 10; x++)
                B[x] = s[y + x];
            for (let x = 0; x < 10; x++)
                s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
        }
        // Iota (ι)
        s[0] ^= SHA3_IOTA_H[round];
        s[1] ^= SHA3_IOTA_L[round];
    }
    (0, utils_ts_1.clean)(B);
}
/** Keccak sponge function. */
class Keccak extends utils_ts_1.Hash {
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        super();
        this.pos = 0;
        this.posOut = 0;
        this.finished = false;
        this.destroyed = false;
        this.enableXOF = false;
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        // Can be passed from user as dkLen
        (0, utils_ts_1.anumber)(outputLen);
        // 1600 = 5x5 matrix of 64bit.  1600 bits === 200 bytes
        // 0 < blockLen < 200
        if (!(0 < blockLen && blockLen < 200))
            throw new Error('only keccak-f1600 function is supported');
        this.state = new Uint8Array(200);
        this.state32 = (0, utils_ts_1.u32)(this.state);
    }
    clone() {
        return this._cloneInto();
    }
    keccak() {
        (0, utils_ts_1.swap32IfBE)(this.state32);
        keccakP(this.state32, this.rounds);
        (0, utils_ts_1.swap32IfBE)(this.state32);
        this.posOut = 0;
        this.pos = 0;
    }
    update(data) {
        (0, utils_ts_1.aexists)(this);
        data = (0, utils_ts_1.toBytes)(data);
        (0, utils_ts_1.abytes)(data);
        const { blockLen, state } = this;
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            for (let i = 0; i < take; i++)
                state[this.pos++] ^= data[pos++];
            if (this.pos === blockLen)
                this.keccak();
        }
        return this;
    }
    finish() {
        if (this.finished)
            return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        // Do the padding
        state[pos] ^= suffix;
        if ((suffix & 0x80) !== 0 && pos === blockLen - 1)
            this.keccak();
        state[blockLen - 1] ^= 0x80;
        this.keccak();
    }
    writeInto(out) {
        (0, utils_ts_1.aexists)(this, false);
        (0, utils_ts_1.abytes)(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len;) {
            if (this.posOut >= blockLen)
                this.keccak();
            const take = Math.min(blockLen - this.posOut, len - pos);
            out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
            this.posOut += take;
            pos += take;
        }
        return out;
    }
    xofInto(out) {
        // Sha3/Keccak usage with XOF is probably mistake, only SHAKE instances can do XOF
        if (!this.enableXOF)
            throw new Error('XOF is not possible for this instance');
        return this.writeInto(out);
    }
    xof(bytes) {
        (0, utils_ts_1.anumber)(bytes);
        return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
        (0, utils_ts_1.aoutput)(out, this);
        if (this.finished)
            throw new Error('digest() was already called');
        this.writeInto(out);
        this.destroy();
        return out;
    }
    digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
    }
    destroy() {
        this.destroyed = true;
        (0, utils_ts_1.clean)(this.state);
    }
    _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to || (to = new Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        // Suffix can change in cSHAKE
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
    }
}
exports.Keccak = Keccak;
const gen = (suffix, blockLen, outputLen) => (0, utils_ts_1.createHasher)(() => new Keccak(blockLen, suffix, outputLen));
/** SHA3-224 hash function. */
exports.sha3_224 = (() => gen(0x06, 144, 224 / 8))();
/** SHA3-256 hash function. Different from keccak-256. */
exports.sha3_256 = (() => gen(0x06, 136, 256 / 8))();
/** SHA3-384 hash function. */
exports.sha3_384 = (() => gen(0x06, 104, 384 / 8))();
/** SHA3-512 hash function. */
exports.sha3_512 = (() => gen(0x06, 72, 512 / 8))();
/** keccak-224 hash function. */
exports.keccak_224 = (() => gen(0x01, 144, 224 / 8))();
/** keccak-256 hash function. Different from SHA3-256. */
exports.keccak_256 = (() => gen(0x01, 136, 256 / 8))();
/** keccak-384 hash function. */
exports.keccak_384 = (() => gen(0x01, 104, 384 / 8))();
/** keccak-512 hash function. */
exports.keccak_512 = (() => gen(0x01, 72, 512 / 8))();
const genShake = (suffix, blockLen, outputLen) => (0, utils_ts_1.createXOFer)((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === undefined ? outputLen : opts.dkLen, true));
/** SHAKE128 XOF with 128-bit security. */
exports.shake128 = (() => genShake(0x1f, 168, 128 / 8))();
/** SHAKE256 XOF with 256-bit security. */
exports.shake256 = (() => genShake(0x1f, 136, 256 / 8))();
//# sourceMappingURL=sha3.js.map
},{ "./_u64.js": 2, "./sha3utils.js": 3}], 3:[function(require,module,exports){"use strict";
/**
 * Utilities for hex, bytes, CSPRNG.
 * @module
 */
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapXOFConstructorWithOpts = exports.wrapConstructorWithOpts = exports.wrapConstructor = exports.Hash = exports.nextTick = exports.swap32IfBE = exports.byteSwapIfBE = exports.swap8IfBE = exports.isLE = void 0;
exports.isBytes = isBytes;
exports.anumber = anumber;
exports.abytes = abytes;
exports.ahash = ahash;
exports.aexists = aexists;
exports.aoutput = aoutput;
exports.u8 = u8;
exports.u32 = u32;
exports.clean = clean;
exports.createView = createView;
exports.rotr = rotr;
exports.rotl = rotl;
exports.byteSwap = byteSwap;
exports.byteSwap32 = byteSwap32;
exports.bytesToHex = bytesToHex;
exports.hexToBytes = hexToBytes;
exports.asyncLoop = asyncLoop;
exports.utf8ToBytes = utf8ToBytes;
exports.bytesToUtf8 = bytesToUtf8;
exports.toBytes = toBytes;
exports.kdfInputToBytes = kdfInputToBytes;
exports.concatBytes = concatBytes;
exports.checkOpts = checkOpts;
exports.createHasher = createHasher;
exports.createOptHasher = createOptHasher;
exports.createXOFer = createXOFer;
exports.randomBytes = randomBytes;
// We use WebCrypto aka globalThis.crypto, which exists in browsers and node.js 16+.
// node.js versions earlier than v19 don't declare it in global scope.
// For node.js, package.json#exports field mapping rewrites import
// from `crypto` to `cryptoNode`, which imports native module.
// Makes the utils un-importable in browsers without a bundler.
// Once node.js 18 is deprecated (2025-04-30), we can just drop the import.

/** Checks if something is Uint8Array. Be careful: nodejs Buffer will return true. */
function isBytes(a) {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}
/** Asserts something is positive integer. */
function anumber(n) {
    if (!Number.isSafeInteger(n) || n < 0)
        throw new Error('positive integer expected, got ' + n);
}
/** Asserts something is Uint8Array. */
function abytes(b, ...lengths) {
    if (!isBytes(b))
        throw new Error('Uint8Array expected');
    if (lengths.length > 0 && !lengths.includes(b.length))
        throw new Error('Uint8Array expected of length ' + lengths + ', got length=' + b.length);
}
/** Asserts something is hash */
function ahash(h) {
    if (typeof h !== 'function' || typeof h.create !== 'function')
        throw new Error('Hash should be wrapped by utils.createHasher');
    anumber(h.outputLen);
    anumber(h.blockLen);
}
/** Asserts a hash instance has not been destroyed / finished */
function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
        throw new Error('Hash instance has been destroyed');
    if (checkFinished && instance.finished)
        throw new Error('Hash#digest() has already been called');
}
/** Asserts output is properly-sized byte array */
function aoutput(out, instance) {
    abytes(out);
    const min = instance.outputLen;
    if (out.length < min) {
        throw new Error('digestInto() expects output buffer of length at least ' + min);
    }
}
/** Cast u8 / u16 / u32 to u8. */
function u8(arr) {
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
/** Cast u8 / u16 / u32 to u32. */
function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
/** Zeroize a byte array. Warning: JS provides no guarantees. */
function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
        arrays[i].fill(0);
    }
}
/** Create DataView of an array for easy byte-level manipulation. */
function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
/** The rotate right (circular right shift) operation for uint32 */
function rotr(word, shift) {
    return (word << (32 - shift)) | (word >>> shift);
}
/** The rotate left (circular left shift) operation for uint32 */
function rotl(word, shift) {
    return (word << shift) | ((word >>> (32 - shift)) >>> 0);
}
/** Is current platform little-endian? Most are. Big-Endian platform: IBM */
exports.isLE = (() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
/** The byte swap operation for uint32 */
function byteSwap(word) {
    return (((word << 24) & 0xff000000) |
        ((word << 8) & 0xff0000) |
        ((word >>> 8) & 0xff00) |
        ((word >>> 24) & 0xff));
}
/** Conditionally byte swap if on a big-endian platform */
exports.swap8IfBE = exports.isLE
    ? (n) => n
    : (n) => byteSwap(n);
/** @deprecated */
exports.byteSwapIfBE = exports.swap8IfBE;
/** In place byte swap for Uint32Array */
function byteSwap32(arr) {
    for (let i = 0; i < arr.length; i++) {
        arr[i] = byteSwap(arr[i]);
    }
    return arr;
}
exports.swap32IfBE = exports.isLE
    ? (u) => u
    : byteSwap32;
// Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
const hasHexBuiltin = /* @__PURE__ */ (() => 
// @ts-ignore
typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();
// Array where index 0xf0 (240) is mapped to string 'f0'
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
/**
 * Convert byte array to hex string. Uses built-in function, when available.
 * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
 */
function bytesToHex(bytes) {
    abytes(bytes);
    // @ts-ignore
    if (hasHexBuiltin)
        return bytes.toHex();
    // pre-caching improves the speed 6x
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
    }
    return hex;
}
// We use optimized technique to convert hex string to byte array
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
function asciiToBase16(ch) {
    if (ch >= asciis._0 && ch <= asciis._9)
        return ch - asciis._0; // '2' => 50-48
    if (ch >= asciis.A && ch <= asciis.F)
        return ch - (asciis.A - 10); // 'B' => 66-(65-10)
    if (ch >= asciis.a && ch <= asciis.f)
        return ch - (asciis.a - 10); // 'b' => 98-(97-10)
    return;
}
/**
 * Convert hex string to byte array. Uses built-in function, when available.
 * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 */
function hexToBytes(hex) {
    if (typeof hex !== 'string')
        throw new Error('hex string expected, got ' + typeof hex);
    // @ts-ignore
    if (hasHexBuiltin)
        return Uint8Array.fromHex(hex);
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
        throw new Error('hex string expected, got unpadded hex of length ' + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
        const n1 = asciiToBase16(hex.charCodeAt(hi));
        const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
        if (n1 === undefined || n2 === undefined) {
            const char = hex[hi] + hex[hi + 1];
            throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
        }
        array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
    }
    return array;
}
/**
 * There is no setImmediate in browser and setTimeout is slow.
 * Call of async fn will return Promise, which will be fullfiled only on
 * next scheduler queue processing step and this is exactly what we need.
 */
const nextTick = async () => { };
exports.nextTick = nextTick;
/** Returns control to thread each 'tick' ms to avoid blocking. */
async function asyncLoop(iters, tick, cb) {
    let ts = Date.now();
    for (let i = 0; i < iters; i++) {
        cb(i);
        // Date.now() is not monotonic, so in case if clock goes backwards we return return control too
        const diff = Date.now() - ts;
        if (diff >= 0 && diff < tick)
            continue;
        await (0, exports.nextTick)();
        ts += diff;
    }
}
/**
 * Converts string to bytes using UTF8 encoding.
 * @example utf8ToBytes('abc') // Uint8Array.from([97, 98, 99])
 */
function utf8ToBytes(str) {
    if (typeof str !== 'string')
        throw new Error('string expected');
    return new Uint8Array(new TextEncoder().encode(str)); // https://bugzil.la/1681809
}
/**
 * Converts bytes to string using UTF8 encoding.
 * @example bytesToUtf8(Uint8Array.from([97, 98, 99])) // 'abc'
 */
function bytesToUtf8(bytes) {
    return new TextDecoder().decode(bytes);
}
/**
 * Normalizes (non-hex) string or Uint8Array to Uint8Array.
 * Warning: when Uint8Array is passed, it would NOT get copied.
 * Keep in mind for future mutable operations.
 */
function toBytes(data) {
    if (typeof data === 'string')
        data = utf8ToBytes(data);
    abytes(data);
    return data;
}
/**
 * Helper for KDFs: consumes uint8array or string.
 * When string is passed, does utf8 decoding, using TextDecoder.
 */
function kdfInputToBytes(data) {
    if (typeof data === 'string')
        data = utf8ToBytes(data);
    abytes(data);
    return data;
}
/** Copies several Uint8Arrays into one. */
function concatBytes(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        abytes(a);
        sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
    }
    return res;
}
function checkOpts(defaults, opts) {
    if (opts !== undefined && {}.toString.call(opts) !== '[object Object]')
        throw new Error('options should be object or undefined');
    const merged = Object.assign(defaults, opts);
    return merged;
}
/** For runtime check if class implements interface */
class Hash {
}
exports.Hash = Hash;
/** Wraps hash function, creating an interface on top of it */
function createHasher(hashCons) {
    const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
    const tmp = hashCons();
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = () => hashCons();
    return hashC;
}
function createOptHasher(hashCons) {
    const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
    const tmp = hashCons({});
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = (opts) => hashCons(opts);
    return hashC;
}
function createXOFer(hashCons) {
    const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
    const tmp = hashCons({});
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = (opts) => hashCons(opts);
    return hashC;
}
exports.wrapConstructor = createHasher;
exports.wrapConstructorWithOpts = createOptHasher;
exports.wrapXOFConstructorWithOpts = createXOFer;
/** Cryptographically secure PRNG. Uses internal OS-level `crypto.getRandomValues`. */
function randomBytes(bytesLength = 32) {
    return new Uint8Array(nacl.randomBytes(bytesLength));
}
//# sourceMappingURL=utils.js.map
},{}], 8:[function(require,module,exports){var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./_dnt.shims.js", "./deps.js"], factory);
    }
})(function (require, exports) {
    "use strict";
    var __syncRequire = typeof module === "object" && typeof module.exports === "object";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.byte = byte;
    exports.int16 = int16;
    exports.uint16 = uint16;
    exports.int32 = int32;
    exports.uint32 = uint32;
    exports.constantTimeCompare = constantTimeCompare;
    exports.equalUint8Array = equalUint8Array;
    exports.loadCrypto = loadCrypto;
    exports.prf = prf;
    exports.byteopsLoad24 = byteopsLoad24;
    exports.byteopsLoad32 = byteopsLoad32;
    const dntShim = __importStar(require("./_dnt.shims.js"));
    const deps_js_1 = require("./deps.js");
    function byte(n) {
        return n % 256;
    }
    function int16(n) {
        const end = -32768;
        const start = 32767;
        if (n >= end && n <= start) {
            return n;
        }
        if (n < end) {
            n = n + 32769;
            n = n % 65536;
            return start + n;
        }
        // if (n > start) {
        n = n - 32768;
        n = n % 65536;
        return end + n;
    }
    function uint16(n) {
        return n % 65536;
    }
    function int32(n) {
        const end = -2147483648;
        const start = 2147483647;
        if (n >= end && n <= start) {
            return n;
        }
        if (n < end) {
            n = n + 2147483649;
            n = n % 4294967296;
            return start + n;
        }
        // if (n > start) {
        n = n - 2147483648;
        n = n % 4294967296;
        return end + n;
    }
    // any bit operations to be done in uint32 must have >>> 0
    // javascript calculates bitwise in SIGNED 32 bit so you need to convert
    function uint32(n) {
        return n % 4294967296;
    }
    /**
     * compares two arrays
     * @returns 1 if they are the same or 0 if not
     */
    function constantTimeCompare(x, y) {
        // check array lengths
        if (x.length != y.length) {
            return 0;
        }
        const v = new Uint8Array([0]);
        for (let i = 0; i < x.length; i++) {
            v[0] |= x[i] ^ y[i];
        }
        // constantTimeByteEq
        const z = new Uint8Array([0]);
        z[0] = ~(v[0] ^ z[0]);
        z[0] &= z[0] >> 4;
        z[0] &= z[0] >> 2;
        z[0] &= z[0] >> 1;
        return z[0];
    }
    function equalUint8Array(x, y) {
        if (x.length != y.length) {
            return false;
        }
        for (let i = 0; i < x.length; i++) {
            if (x[i] !== y[i]) {
                return false;
            }
        }
        return true;
    }
    async function loadCrypto() {
        if (typeof dntShim.dntGlobalThis !== "undefined" && globalThis.crypto !== undefined) {
            // Browsers, Node.js >= v19, Cloudflare Workers, Bun, etc.
            return globalThis.crypto;
        }
        throw new Error("failed to load Crypto");
    }
    // prf provides a pseudo-random function (PRF) which returns
    // a byte array of length `l`, using the provided key and nonce
    // to instantiate the PRF's underlying hash function.
    function prf(len, seed, nonce) {
        return deps_js_1.shake256.create({ dkLen: len }).update(seed).update(new Uint8Array([nonce])).digest();
    }
    // byteopsLoad24 returns a 32-bit unsigned integer loaded from byte x.
    function byteopsLoad24(x) {
        let r = uint32(x[0]);
        r |= uint32(x[1]) << 8;
        r |= uint32(x[2]) << 16;
        return r;
    }
    // byteopsLoad32 returns a 32-bit unsigned integer loaded from byte x.
    function byteopsLoad32(x) {
        let r = uint32(x[0]);
        r |= uint32(x[1]) << 8;
        r |= uint32(x[2]) << 16;
        r |= uint32(x[3]) << 24;
        return uint32(r);
    }
});
},{ "./_dnt.shims.js": 7, "./deps.js": 5}]},{},[11]);
