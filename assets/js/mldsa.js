// This file was built using JPack from @noble/post-quantum 0.4.1 (ML-DSA-44 only) and @noble/hashes 1.8.0, both MIT.
// Requires of @noble/hashes/* were rewritten to relative paths. Entry: window.ml_dsa44 = require("./ml-dsa.js").ml_dsa44

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
})({ 8:[function(require,module,exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XOF256 = exports.XOF128 = exports.genCrystals = void 0;
/**
 * Internal methods for lattice-based ML-KEM and ML-DSA.
 * @module
 */
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
const sha3_1 = require("./hashes/sha3.js");
const utils_ts_1 = require("./utils.js");
// TODO: benchmark
function bitReversal(n, bits = 8) {
    const padded = n.toString(2).padStart(8, '0');
    const sliced = padded.slice(-bits).padStart(7, '0');
    const revrsd = sliced.split('').reverse().join('');
    return Number.parseInt(revrsd, 2);
}
const genCrystals = (opts) => {
    // isKyber: true means Kyber, false means Dilithium
    const { newPoly, N, Q, F, ROOT_OF_UNITY, brvBits, isKyber } = opts;
    const mod = (a, modulo = Q) => {
        const result = a % modulo | 0;
        return (result >= 0 ? result | 0 : (modulo + result) | 0) | 0;
    };
    // -(Q-1)/2 < a <= (Q-1)/2
    const smod = (a, modulo = Q) => {
        const r = mod(a, modulo) | 0;
        return (r > modulo >> 1 ? (r - modulo) | 0 : r) | 0;
    };
    // Generate zettas
    function getZettas() {
        const out = newPoly(N);
        for (let i = 0; i < N; i++) {
            const b = bitReversal(i, brvBits);
            const p = BigInt(ROOT_OF_UNITY) ** BigInt(b) % BigInt(Q);
            out[i] = Number(p) | 0;
        }
        return out;
    }
    const nttZetas = getZettas();
    // Number-Theoretic Transform
    // Explained: https://electricdusk.com/ntt.html
    // Kyber has slightly different params, since there is no 512th primitive root of unity mod q,
    // only 256th primitive root of unity mod. Which also complicates MultiplyNTT.
    // TODO: there should be less ugly way to define this.
    const LEN1 = isKyber ? 128 : N;
    const LEN2 = isKyber ? 1 : 0;
    const NTT = {
        encode: (r) => {
            for (let k = 1, len = 128; len > LEN2; len >>= 1) {
                for (let start = 0; start < N; start += 2 * len) {
                    const zeta = nttZetas[k++];
                    for (let j = start; j < start + len; j++) {
                        const t = mod(zeta * r[j + len]);
                        r[j + len] = mod(r[j] - t) | 0;
                        r[j] = mod(r[j] + t) | 0;
                    }
                }
            }
            return r;
        },
        decode: (r) => {
            for (let k = LEN1 - 1, len = 1 + LEN2; len < LEN1 + LEN2; len <<= 1) {
                for (let start = 0; start < N; start += 2 * len) {
                    const zeta = nttZetas[k--];
                    for (let j = start; j < start + len; j++) {
                        const t = r[j];
                        r[j] = mod(t + r[j + len]);
                        r[j + len] = mod(zeta * (r[j + len] - t));
                    }
                }
            }
            for (let i = 0; i < r.length; i++)
                r[i] = mod(F * r[i]);
            return r;
        },
    };
    // Encode polynominal as bits
    const bitsCoder = (d, c) => {
        const mask = (0, utils_ts_1.getMask)(d);
        const bytesLen = d * (N / 8);
        return {
            bytesLen,
            encode: (poly) => {
                const r = new Uint8Array(bytesLen);
                for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < poly.length; i++) {
                    buf |= (c.encode(poly[i]) & mask) << bufLen;
                    bufLen += d;
                    for (; bufLen >= 8; bufLen -= 8, buf >>= 8)
                        r[pos++] = buf & (0, utils_ts_1.getMask)(bufLen);
                }
                return r;
            },
            decode: (bytes) => {
                const r = newPoly(N);
                for (let i = 0, buf = 0, bufLen = 0, pos = 0; i < bytes.length; i++) {
                    buf |= bytes[i] << bufLen;
                    bufLen += 8;
                    for (; bufLen >= d; bufLen -= d, buf >>= d)
                        r[pos++] = c.decode(buf & mask);
                }
                return r;
            },
        };
    };
    return { mod, smod, nttZetas, NTT, bitsCoder };
};
exports.genCrystals = genCrystals;
const createXofShake = (shake) => (seed, blockLen) => {
    if (!blockLen)
        blockLen = shake.blockLen;
    // Optimizations that won't mater:
    // - cached seed update (two .update(), on start and on the end)
    // - another cache which cloned into working copy
    // Faster than multiple updates, since seed less than blockLen
    const _seed = new Uint8Array(seed.length + 2);
    _seed.set(seed);
    const seedLen = seed.length;
    const buf = new Uint8Array(blockLen); // == shake128.blockLen
    let h = shake.create({});
    let calls = 0;
    let xofs = 0;
    return {
        stats: () => ({ calls, xofs }),
        get: (x, y) => {
            _seed[seedLen + 0] = x;
            _seed[seedLen + 1] = y;
            h.destroy();
            h = shake.create({}).update(_seed);
            calls++;
            return () => {
                xofs++;
                return h.xofInto(buf);
            };
        },
        clean: () => {
            h.destroy();
            buf.fill(0);
            _seed.fill(0);
        },
    };
};
exports.XOF128 = createXofShake(sha3_1.shake128);
exports.XOF256 = createXofShake(sha3_1.shake256);
//# sourceMappingURL=_crystals.js.map
},{ "./hashes/sha3.js": 4, "./utils.js": 7}], 5:[function(require,module,exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHA512_IV = exports.SHA384_IV = exports.SHA224_IV = exports.SHA256_IV = exports.HashMD = void 0;
exports.setBigUint64 = setBigUint64;
exports.Chi = Chi;
exports.Maj = Maj;
/**
 * Internal Merkle-Damgard hash utils.
 * @module
 */
const utils_ts_1 = require("./utils.js");
/** Polyfill for Safari 14. https://caniuse.com/mdn-javascript_builtins_dataview_setbiguint64 */
function setBigUint64(view, byteOffset, value, isLE) {
    if (typeof view.setBigUint64 === 'function')
        return view.setBigUint64(byteOffset, value, isLE);
    const _32n = BigInt(32);
    const _u32_max = BigInt(0xffffffff);
    const wh = Number((value >> _32n) & _u32_max);
    const wl = Number(value & _u32_max);
    const h = isLE ? 4 : 0;
    const l = isLE ? 0 : 4;
    view.setUint32(byteOffset + h, wh, isLE);
    view.setUint32(byteOffset + l, wl, isLE);
}
/** Choice: a ? b : c */
function Chi(a, b, c) {
    return (a & b) ^ (~a & c);
}
/** Majority function, true if any two inputs is true. */
function Maj(a, b, c) {
    return (a & b) ^ (a & c) ^ (b & c);
}
/**
 * Merkle-Damgard hash construction base class.
 * Could be used to create MD5, RIPEMD, SHA1, SHA2.
 */
class HashMD extends utils_ts_1.Hash {
    constructor(blockLen, outputLen, padOffset, isLE) {
        super();
        this.finished = false;
        this.length = 0;
        this.pos = 0;
        this.destroyed = false;
        this.blockLen = blockLen;
        this.outputLen = outputLen;
        this.padOffset = padOffset;
        this.isLE = isLE;
        this.buffer = new Uint8Array(blockLen);
        this.view = (0, utils_ts_1.createView)(this.buffer);
    }
    update(data) {
        (0, utils_ts_1.aexists)(this);
        data = (0, utils_ts_1.toBytes)(data);
        (0, utils_ts_1.abytes)(data);
        const { view, buffer, blockLen } = this;
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            // Fast path: we have at least one block in input, cast it to view and process
            if (take === blockLen) {
                const dataView = (0, utils_ts_1.createView)(data);
                for (; blockLen <= len - pos; pos += blockLen)
                    this.process(dataView, pos);
                continue;
            }
            buffer.set(data.subarray(pos, pos + take), this.pos);
            this.pos += take;
            pos += take;
            if (this.pos === blockLen) {
                this.process(view, 0);
                this.pos = 0;
            }
        }
        this.length += data.length;
        this.roundClean();
        return this;
    }
    digestInto(out) {
        (0, utils_ts_1.aexists)(this);
        (0, utils_ts_1.aoutput)(out, this);
        this.finished = true;
        // Padding
        // We can avoid allocation of buffer for padding completely if it
        // was previously not allocated here. But it won't change performance.
        const { buffer, view, blockLen, isLE } = this;
        let { pos } = this;
        // append the bit '1' to the message
        buffer[pos++] = 0b10000000;
        (0, utils_ts_1.clean)(this.buffer.subarray(pos));
        // we have less than padOffset left in buffer, so we cannot put length in
        // current block, need process it and pad again
        if (this.padOffset > blockLen - pos) {
            this.process(view, 0);
            pos = 0;
        }
        // Pad until full block byte with zeros
        for (let i = pos; i < blockLen; i++)
            buffer[i] = 0;
        // Note: sha512 requires length to be 128bit integer, but length in JS will overflow before that
        // You need to write around 2 exabytes (u64_max / 8 / (1024**6)) for this to happen.
        // So we just write lowest 64 bits of that value.
        setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
        this.process(view, 0);
        const oview = (0, utils_ts_1.createView)(out);
        const len = this.outputLen;
        // NOTE: we do division by 4 later, which should be fused in single op with modulo by JIT
        if (len % 4)
            throw new Error('_sha2: outputLen should be aligned to 32bit');
        const outLen = len / 4;
        const state = this.get();
        if (outLen > state.length)
            throw new Error('_sha2: outputLen bigger than state');
        for (let i = 0; i < outLen; i++)
            oview.setUint32(4 * i, state[i], isLE);
    }
    digest() {
        const { buffer, outputLen } = this;
        this.digestInto(buffer);
        const res = buffer.slice(0, outputLen);
        this.destroy();
        return res;
    }
    _cloneInto(to) {
        to || (to = new this.constructor());
        to.set(...this.get());
        const { blockLen, buffer, length, finished, destroyed, pos } = this;
        to.destroyed = destroyed;
        to.finished = finished;
        to.length = length;
        to.pos = pos;
        if (length % blockLen)
            to.buffer.set(buffer);
        return to;
    }
    clone() {
        return this._cloneInto();
    }
}
exports.HashMD = HashMD;
/**
 * Initial SHA-2 state: fractional parts of square roots of first 16 primes 2..53.
 * Check out `test/misc/sha2-gen-iv.js` for recomputation guide.
 */
/** Initial SHA256 state. Bits 0..32 of frac part of sqrt of primes 2..19 */
exports.SHA256_IV = Uint32Array.from([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);
/** Initial SHA224 state. Bits 32..64 of frac part of sqrt of primes 23..53 */
exports.SHA224_IV = Uint32Array.from([
    0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4,
]);
/** Initial SHA384 state. Bits 0..64 of frac part of sqrt of primes 23..53 */
exports.SHA384_IV = Uint32Array.from([
    0xcbbb9d5d, 0xc1059ed8, 0x629a292a, 0x367cd507, 0x9159015a, 0x3070dd17, 0x152fecd8, 0xf70e5939,
    0x67332667, 0xffc00b31, 0x8eb44a87, 0x68581511, 0xdb0c2e0d, 0x64f98fa7, 0x47b5481d, 0xbefa4fa4,
]);
/** Initial SHA512 state. Bits 0..64 of frac part of sqrt of primes 2..19 */
exports.SHA512_IV = Uint32Array.from([
    0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1,
    0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179,
]);
//# sourceMappingURL=_md.js.map
},{ "./utils.js": 3}], 1:[function(require,module,exports){"use strict";
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
},{}], 2:[function(require,module,exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crypto = void 0;
exports.crypto = typeof globalThis === 'object' && 'crypto' in globalThis ? globalThis.crypto : undefined;
//# sourceMappingURL=crypto.js.map
},{}], 6:[function(require,module,exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha512_224 = exports.sha512_256 = exports.sha384 = exports.sha512 = exports.sha224 = exports.sha256 = exports.SHA512_256 = exports.SHA512_224 = exports.SHA384 = exports.SHA512 = exports.SHA224 = exports.SHA256 = void 0;
/**
 * SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
 * SHA256 is the fastest hash implementable in JS, even faster than Blake3.
 * Check out [RFC 4634](https://datatracker.ietf.org/doc/html/rfc4634) and
 * [FIPS 180-4](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf).
 * @module
 */
const _md_ts_1 = require("./_md.js");
const u64 = require("./_u64.js");
const utils_ts_1 = require("./utils.js");
/**
 * Round constants:
 * First 32 bits of fractional parts of the cube roots of the first 64 primes 2..311)
 */
// prettier-ignore
const SHA256_K = /* @__PURE__ */ Uint32Array.from([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);
/** Reusable temporary buffer. "W" comes straight from spec. */
const SHA256_W = /* @__PURE__ */ new Uint32Array(64);
class SHA256 extends _md_ts_1.HashMD {
    constructor(outputLen = 32) {
        super(64, outputLen, 8, false);
        // We cannot use array here since array allows indexing by variable
        // which means optimizer/compiler cannot use registers.
        this.A = _md_ts_1.SHA256_IV[0] | 0;
        this.B = _md_ts_1.SHA256_IV[1] | 0;
        this.C = _md_ts_1.SHA256_IV[2] | 0;
        this.D = _md_ts_1.SHA256_IV[3] | 0;
        this.E = _md_ts_1.SHA256_IV[4] | 0;
        this.F = _md_ts_1.SHA256_IV[5] | 0;
        this.G = _md_ts_1.SHA256_IV[6] | 0;
        this.H = _md_ts_1.SHA256_IV[7] | 0;
    }
    get() {
        const { A, B, C, D, E, F, G, H } = this;
        return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
        this.A = A | 0;
        this.B = B | 0;
        this.C = C | 0;
        this.D = D | 0;
        this.E = E | 0;
        this.F = F | 0;
        this.G = G | 0;
        this.H = H | 0;
    }
    process(view, offset) {
        // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
        for (let i = 0; i < 16; i++, offset += 4)
            SHA256_W[i] = view.getUint32(offset, false);
        for (let i = 16; i < 64; i++) {
            const W15 = SHA256_W[i - 15];
            const W2 = SHA256_W[i - 2];
            const s0 = (0, utils_ts_1.rotr)(W15, 7) ^ (0, utils_ts_1.rotr)(W15, 18) ^ (W15 >>> 3);
            const s1 = (0, utils_ts_1.rotr)(W2, 17) ^ (0, utils_ts_1.rotr)(W2, 19) ^ (W2 >>> 10);
            SHA256_W[i] = (s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16]) | 0;
        }
        // Compression function main loop, 64 rounds
        let { A, B, C, D, E, F, G, H } = this;
        for (let i = 0; i < 64; i++) {
            const sigma1 = (0, utils_ts_1.rotr)(E, 6) ^ (0, utils_ts_1.rotr)(E, 11) ^ (0, utils_ts_1.rotr)(E, 25);
            const T1 = (H + sigma1 + (0, _md_ts_1.Chi)(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
            const sigma0 = (0, utils_ts_1.rotr)(A, 2) ^ (0, utils_ts_1.rotr)(A, 13) ^ (0, utils_ts_1.rotr)(A, 22);
            const T2 = (sigma0 + (0, _md_ts_1.Maj)(A, B, C)) | 0;
            H = G;
            G = F;
            F = E;
            E = (D + T1) | 0;
            D = C;
            C = B;
            B = A;
            A = (T1 + T2) | 0;
        }
        // Add the compressed chunk to the current hash value
        A = (A + this.A) | 0;
        B = (B + this.B) | 0;
        C = (C + this.C) | 0;
        D = (D + this.D) | 0;
        E = (E + this.E) | 0;
        F = (F + this.F) | 0;
        G = (G + this.G) | 0;
        H = (H + this.H) | 0;
        this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
        (0, utils_ts_1.clean)(SHA256_W);
    }
    destroy() {
        this.set(0, 0, 0, 0, 0, 0, 0, 0);
        (0, utils_ts_1.clean)(this.buffer);
    }
}
exports.SHA256 = SHA256;
class SHA224 extends SHA256 {
    constructor() {
        super(28);
        this.A = _md_ts_1.SHA224_IV[0] | 0;
        this.B = _md_ts_1.SHA224_IV[1] | 0;
        this.C = _md_ts_1.SHA224_IV[2] | 0;
        this.D = _md_ts_1.SHA224_IV[3] | 0;
        this.E = _md_ts_1.SHA224_IV[4] | 0;
        this.F = _md_ts_1.SHA224_IV[5] | 0;
        this.G = _md_ts_1.SHA224_IV[6] | 0;
        this.H = _md_ts_1.SHA224_IV[7] | 0;
    }
}
exports.SHA224 = SHA224;
// SHA2-512 is slower than sha256 in js because u64 operations are slow.
// Round contants
// First 32 bits of the fractional parts of the cube roots of the first 80 primes 2..409
// prettier-ignore
const K512 = /* @__PURE__ */ (() => u64.split([
    '0x428a2f98d728ae22', '0x7137449123ef65cd', '0xb5c0fbcfec4d3b2f', '0xe9b5dba58189dbbc',
    '0x3956c25bf348b538', '0x59f111f1b605d019', '0x923f82a4af194f9b', '0xab1c5ed5da6d8118',
    '0xd807aa98a3030242', '0x12835b0145706fbe', '0x243185be4ee4b28c', '0x550c7dc3d5ffb4e2',
    '0x72be5d74f27b896f', '0x80deb1fe3b1696b1', '0x9bdc06a725c71235', '0xc19bf174cf692694',
    '0xe49b69c19ef14ad2', '0xefbe4786384f25e3', '0x0fc19dc68b8cd5b5', '0x240ca1cc77ac9c65',
    '0x2de92c6f592b0275', '0x4a7484aa6ea6e483', '0x5cb0a9dcbd41fbd4', '0x76f988da831153b5',
    '0x983e5152ee66dfab', '0xa831c66d2db43210', '0xb00327c898fb213f', '0xbf597fc7beef0ee4',
    '0xc6e00bf33da88fc2', '0xd5a79147930aa725', '0x06ca6351e003826f', '0x142929670a0e6e70',
    '0x27b70a8546d22ffc', '0x2e1b21385c26c926', '0x4d2c6dfc5ac42aed', '0x53380d139d95b3df',
    '0x650a73548baf63de', '0x766a0abb3c77b2a8', '0x81c2c92e47edaee6', '0x92722c851482353b',
    '0xa2bfe8a14cf10364', '0xa81a664bbc423001', '0xc24b8b70d0f89791', '0xc76c51a30654be30',
    '0xd192e819d6ef5218', '0xd69906245565a910', '0xf40e35855771202a', '0x106aa07032bbd1b8',
    '0x19a4c116b8d2d0c8', '0x1e376c085141ab53', '0x2748774cdf8eeb99', '0x34b0bcb5e19b48a8',
    '0x391c0cb3c5c95a63', '0x4ed8aa4ae3418acb', '0x5b9cca4f7763e373', '0x682e6ff3d6b2b8a3',
    '0x748f82ee5defb2fc', '0x78a5636f43172f60', '0x84c87814a1f0ab72', '0x8cc702081a6439ec',
    '0x90befffa23631e28', '0xa4506cebde82bde9', '0xbef9a3f7b2c67915', '0xc67178f2e372532b',
    '0xca273eceea26619c', '0xd186b8c721c0c207', '0xeada7dd6cde0eb1e', '0xf57d4f7fee6ed178',
    '0x06f067aa72176fba', '0x0a637dc5a2c898a6', '0x113f9804bef90dae', '0x1b710b35131c471b',
    '0x28db77f523047d84', '0x32caab7b40c72493', '0x3c9ebe0a15c9bebc', '0x431d67c49c100d4c',
    '0x4cc5d4becb3e42b6', '0x597f299cfc657e2a', '0x5fcb6fab3ad6faec', '0x6c44198c4a475817'
].map(n => BigInt(n))))();
const SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
const SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
// Reusable temporary buffers
const SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
const SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
class SHA512 extends _md_ts_1.HashMD {
    constructor(outputLen = 64) {
        super(128, outputLen, 16, false);
        // We cannot use array here since array allows indexing by variable
        // which means optimizer/compiler cannot use registers.
        // h -- high 32 bits, l -- low 32 bits
        this.Ah = _md_ts_1.SHA512_IV[0] | 0;
        this.Al = _md_ts_1.SHA512_IV[1] | 0;
        this.Bh = _md_ts_1.SHA512_IV[2] | 0;
        this.Bl = _md_ts_1.SHA512_IV[3] | 0;
        this.Ch = _md_ts_1.SHA512_IV[4] | 0;
        this.Cl = _md_ts_1.SHA512_IV[5] | 0;
        this.Dh = _md_ts_1.SHA512_IV[6] | 0;
        this.Dl = _md_ts_1.SHA512_IV[7] | 0;
        this.Eh = _md_ts_1.SHA512_IV[8] | 0;
        this.El = _md_ts_1.SHA512_IV[9] | 0;
        this.Fh = _md_ts_1.SHA512_IV[10] | 0;
        this.Fl = _md_ts_1.SHA512_IV[11] | 0;
        this.Gh = _md_ts_1.SHA512_IV[12] | 0;
        this.Gl = _md_ts_1.SHA512_IV[13] | 0;
        this.Hh = _md_ts_1.SHA512_IV[14] | 0;
        this.Hl = _md_ts_1.SHA512_IV[15] | 0;
    }
    // prettier-ignore
    get() {
        const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
        return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
    }
    // prettier-ignore
    set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
        this.Ah = Ah | 0;
        this.Al = Al | 0;
        this.Bh = Bh | 0;
        this.Bl = Bl | 0;
        this.Ch = Ch | 0;
        this.Cl = Cl | 0;
        this.Dh = Dh | 0;
        this.Dl = Dl | 0;
        this.Eh = Eh | 0;
        this.El = El | 0;
        this.Fh = Fh | 0;
        this.Fl = Fl | 0;
        this.Gh = Gh | 0;
        this.Gl = Gl | 0;
        this.Hh = Hh | 0;
        this.Hl = Hl | 0;
    }
    process(view, offset) {
        // Extend the first 16 words into the remaining 64 words w[16..79] of the message schedule array
        for (let i = 0; i < 16; i++, offset += 4) {
            SHA512_W_H[i] = view.getUint32(offset);
            SHA512_W_L[i] = view.getUint32((offset += 4));
        }
        for (let i = 16; i < 80; i++) {
            // s0 := (w[i-15] rightrotate 1) xor (w[i-15] rightrotate 8) xor (w[i-15] rightshift 7)
            const W15h = SHA512_W_H[i - 15] | 0;
            const W15l = SHA512_W_L[i - 15] | 0;
            const s0h = u64.rotrSH(W15h, W15l, 1) ^ u64.rotrSH(W15h, W15l, 8) ^ u64.shrSH(W15h, W15l, 7);
            const s0l = u64.rotrSL(W15h, W15l, 1) ^ u64.rotrSL(W15h, W15l, 8) ^ u64.shrSL(W15h, W15l, 7);
            // s1 := (w[i-2] rightrotate 19) xor (w[i-2] rightrotate 61) xor (w[i-2] rightshift 6)
            const W2h = SHA512_W_H[i - 2] | 0;
            const W2l = SHA512_W_L[i - 2] | 0;
            const s1h = u64.rotrSH(W2h, W2l, 19) ^ u64.rotrBH(W2h, W2l, 61) ^ u64.shrSH(W2h, W2l, 6);
            const s1l = u64.rotrSL(W2h, W2l, 19) ^ u64.rotrBL(W2h, W2l, 61) ^ u64.shrSL(W2h, W2l, 6);
            // SHA256_W[i] = s0 + s1 + SHA256_W[i - 7] + SHA256_W[i - 16];
            const SUMl = u64.add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
            const SUMh = u64.add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
            SHA512_W_H[i] = SUMh | 0;
            SHA512_W_L[i] = SUMl | 0;
        }
        let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
        // Compression function main loop, 80 rounds
        for (let i = 0; i < 80; i++) {
            // S1 := (e rightrotate 14) xor (e rightrotate 18) xor (e rightrotate 41)
            const sigma1h = u64.rotrSH(Eh, El, 14) ^ u64.rotrSH(Eh, El, 18) ^ u64.rotrBH(Eh, El, 41);
            const sigma1l = u64.rotrSL(Eh, El, 14) ^ u64.rotrSL(Eh, El, 18) ^ u64.rotrBL(Eh, El, 41);
            //const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
            const CHIh = (Eh & Fh) ^ (~Eh & Gh);
            const CHIl = (El & Fl) ^ (~El & Gl);
            // T1 = H + sigma1 + Chi(E, F, G) + SHA512_K[i] + SHA512_W[i]
            // prettier-ignore
            const T1ll = u64.add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
            const T1h = u64.add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
            const T1l = T1ll | 0;
            // S0 := (a rightrotate 28) xor (a rightrotate 34) xor (a rightrotate 39)
            const sigma0h = u64.rotrSH(Ah, Al, 28) ^ u64.rotrBH(Ah, Al, 34) ^ u64.rotrBH(Ah, Al, 39);
            const sigma0l = u64.rotrSL(Ah, Al, 28) ^ u64.rotrBL(Ah, Al, 34) ^ u64.rotrBL(Ah, Al, 39);
            const MAJh = (Ah & Bh) ^ (Ah & Ch) ^ (Bh & Ch);
            const MAJl = (Al & Bl) ^ (Al & Cl) ^ (Bl & Cl);
            Hh = Gh | 0;
            Hl = Gl | 0;
            Gh = Fh | 0;
            Gl = Fl | 0;
            Fh = Eh | 0;
            Fl = El | 0;
            ({ h: Eh, l: El } = u64.add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
            Dh = Ch | 0;
            Dl = Cl | 0;
            Ch = Bh | 0;
            Cl = Bl | 0;
            Bh = Ah | 0;
            Bl = Al | 0;
            const All = u64.add3L(T1l, sigma0l, MAJl);
            Ah = u64.add3H(All, T1h, sigma0h, MAJh);
            Al = All | 0;
        }
        // Add the compressed chunk to the current hash value
        ({ h: Ah, l: Al } = u64.add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
        ({ h: Bh, l: Bl } = u64.add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
        ({ h: Ch, l: Cl } = u64.add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
        ({ h: Dh, l: Dl } = u64.add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
        ({ h: Eh, l: El } = u64.add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
        ({ h: Fh, l: Fl } = u64.add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
        ({ h: Gh, l: Gl } = u64.add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
        ({ h: Hh, l: Hl } = u64.add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
        this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
    }
    roundClean() {
        (0, utils_ts_1.clean)(SHA512_W_H, SHA512_W_L);
    }
    destroy() {
        (0, utils_ts_1.clean)(this.buffer);
        this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
}
exports.SHA512 = SHA512;
class SHA384 extends SHA512 {
    constructor() {
        super(48);
        this.Ah = _md_ts_1.SHA384_IV[0] | 0;
        this.Al = _md_ts_1.SHA384_IV[1] | 0;
        this.Bh = _md_ts_1.SHA384_IV[2] | 0;
        this.Bl = _md_ts_1.SHA384_IV[3] | 0;
        this.Ch = _md_ts_1.SHA384_IV[4] | 0;
        this.Cl = _md_ts_1.SHA384_IV[5] | 0;
        this.Dh = _md_ts_1.SHA384_IV[6] | 0;
        this.Dl = _md_ts_1.SHA384_IV[7] | 0;
        this.Eh = _md_ts_1.SHA384_IV[8] | 0;
        this.El = _md_ts_1.SHA384_IV[9] | 0;
        this.Fh = _md_ts_1.SHA384_IV[10] | 0;
        this.Fl = _md_ts_1.SHA384_IV[11] | 0;
        this.Gh = _md_ts_1.SHA384_IV[12] | 0;
        this.Gl = _md_ts_1.SHA384_IV[13] | 0;
        this.Hh = _md_ts_1.SHA384_IV[14] | 0;
        this.Hl = _md_ts_1.SHA384_IV[15] | 0;
    }
}
exports.SHA384 = SHA384;
/**
 * Truncated SHA512/256 and SHA512/224.
 * SHA512_IV is XORed with 0xa5a5a5a5a5a5a5a5, then used as "intermediary" IV of SHA512/t.
 * Then t hashes string to produce result IV.
 * See `test/misc/sha2-gen-iv.js`.
 */
/** SHA512/224 IV */
const T224_IV = /* @__PURE__ */ Uint32Array.from([
    0x8c3d37c8, 0x19544da2, 0x73e19966, 0x89dcd4d6, 0x1dfab7ae, 0x32ff9c82, 0x679dd514, 0x582f9fcf,
    0x0f6d2b69, 0x7bd44da8, 0x77e36f73, 0x04c48942, 0x3f9d85a8, 0x6a1d36c8, 0x1112e6ad, 0x91d692a1,
]);
/** SHA512/256 IV */
const T256_IV = /* @__PURE__ */ Uint32Array.from([
    0x22312194, 0xfc2bf72c, 0x9f555fa3, 0xc84c64c2, 0x2393b86b, 0x6f53b151, 0x96387719, 0x5940eabd,
    0x96283ee2, 0xa88effe3, 0xbe5e1e25, 0x53863992, 0x2b0199fc, 0x2c85b8aa, 0x0eb72ddc, 0x81c52ca2,
]);
class SHA512_224 extends SHA512 {
    constructor() {
        super(28);
        this.Ah = T224_IV[0] | 0;
        this.Al = T224_IV[1] | 0;
        this.Bh = T224_IV[2] | 0;
        this.Bl = T224_IV[3] | 0;
        this.Ch = T224_IV[4] | 0;
        this.Cl = T224_IV[5] | 0;
        this.Dh = T224_IV[6] | 0;
        this.Dl = T224_IV[7] | 0;
        this.Eh = T224_IV[8] | 0;
        this.El = T224_IV[9] | 0;
        this.Fh = T224_IV[10] | 0;
        this.Fl = T224_IV[11] | 0;
        this.Gh = T224_IV[12] | 0;
        this.Gl = T224_IV[13] | 0;
        this.Hh = T224_IV[14] | 0;
        this.Hl = T224_IV[15] | 0;
    }
}
exports.SHA512_224 = SHA512_224;
class SHA512_256 extends SHA512 {
    constructor() {
        super(32);
        this.Ah = T256_IV[0] | 0;
        this.Al = T256_IV[1] | 0;
        this.Bh = T256_IV[2] | 0;
        this.Bl = T256_IV[3] | 0;
        this.Ch = T256_IV[4] | 0;
        this.Cl = T256_IV[5] | 0;
        this.Dh = T256_IV[6] | 0;
        this.Dl = T256_IV[7] | 0;
        this.Eh = T256_IV[8] | 0;
        this.El = T256_IV[9] | 0;
        this.Fh = T256_IV[10] | 0;
        this.Fl = T256_IV[11] | 0;
        this.Gh = T256_IV[12] | 0;
        this.Gl = T256_IV[13] | 0;
        this.Hh = T256_IV[14] | 0;
        this.Hl = T256_IV[15] | 0;
    }
}
exports.SHA512_256 = SHA512_256;
/**
 * SHA2-256 hash function from RFC 4634.
 *
 * It is the fastest JS hash, even faster than Blake3.
 * To break sha256 using birthday attack, attackers need to try 2^128 hashes.
 * BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
 */
exports.sha256 = (0, utils_ts_1.createHasher)(() => new SHA256());
/** SHA2-224 hash function from RFC 4634 */
exports.sha224 = (0, utils_ts_1.createHasher)(() => new SHA224());
/** SHA2-512 hash function from RFC 4634. */
exports.sha512 = (0, utils_ts_1.createHasher)(() => new SHA512());
/** SHA2-384 hash function from RFC 4634. */
exports.sha384 = (0, utils_ts_1.createHasher)(() => new SHA384());
/**
 * SHA2-512/256 "truncated" hash function, with improved resistance to length extension attacks.
 * See the paper on [truncated SHA512](https://eprint.iacr.org/2010/548.pdf).
 */
exports.sha512_256 = (0, utils_ts_1.createHasher)(() => new SHA512_256());
/**
 * SHA2-512/224 "truncated" hash function, with improved resistance to length extension attacks.
 * See the paper on [truncated SHA512](https://eprint.iacr.org/2010/548.pdf).
 */
exports.sha512_224 = (0, utils_ts_1.createHasher)(() => new SHA512_224());
//# sourceMappingURL=sha2.js.map
},{ "./_md.js": 5, "./_u64.js": 1, "./utils.js": 3}], 4:[function(require,module,exports){"use strict";
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
const utils_ts_1 = require("./utils.js");
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
},{ "./_u64.js": 1, "./utils.js": 3}], 3:[function(require,module,exports){"use strict";
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
const crypto_1 = require("./crypto.js");
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
    if (crypto_1.crypto && typeof crypto_1.crypto.getRandomValues === 'function') {
        return crypto_1.crypto.getRandomValues(new Uint8Array(bytesLength));
    }
    // Legacy Node.js compatibility
    if (crypto_1.crypto && typeof crypto_1.crypto.randomBytes === 'function') {
        return Uint8Array.from(crypto_1.crypto.randomBytes(bytesLength));
    }
    throw new Error('crypto.getRandomValues must be defined');
}
//# sourceMappingURL=utils.js.map
},{ "./crypto.js": 2}], 10:[function(require,module,exports){// ML-DSA-44 from @noble/post-quantum 0.4.1 (with @noble/hashes 1.8.0), bundled with JPack
var mlDsa = require('./ml-dsa.js');
window.ml_dsa44 = mlDsa.ml_dsa44;
},{ "./ml-dsa.js": 9}], 9:[function(require,module,exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ml_dsa87 = exports.ml_dsa65 = exports.ml_dsa44 = exports.PARAMS = void 0;
/**
 * ML-DSA: Module Lattice-based Digital Signature Algorithm from
 * [FIPS-204](https://csrc.nist.gov/pubs/fips/204/ipd). A.k.a. CRYSTALS-Dilithium.
 *
 * Has similar internals to ML-KEM, but their keys and params are different.
 * Check out [official site](https://www.pq-crystals.org/dilithium/index.shtml),
 * [repo](https://github.com/pq-crystals/dilithium).
 * @module
 */
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
const sha3_1 = require("./hashes/sha3.js");
const _crystals_ts_1 = require("./_crystals.js");
const utils_ts_1 = require("./utils.js");
// Constants
const N = 256;
// 2**23 − 2**13 + 1, 23 bits: multiply will be 46. We have enough precision in JS to avoid bigints
const Q = 8380417;
const ROOT_OF_UNITY = 1753;
// f = 256**−1 mod q, pow(256, -1, q) = 8347681 (python3)
const F = 8347681;
const D = 13;
// Dilithium is kinda parametrized over GAMMA2, but everything will break with any other value.
const GAMMA2_1 = Math.floor((Q - 1) / 88) | 0;
const GAMMA2_2 = Math.floor((Q - 1) / 32) | 0;
/** Internal params for different versions of ML-DSA  */
// prettier-ignore
exports.PARAMS = {
    2: { K: 4, L: 4, D, GAMMA1: 2 ** 17, GAMMA2: GAMMA2_1, TAU: 39, ETA: 2, OMEGA: 80 },
    3: { K: 6, L: 5, D, GAMMA1: 2 ** 19, GAMMA2: GAMMA2_2, TAU: 49, ETA: 4, OMEGA: 55 },
    5: { K: 8, L: 7, D, GAMMA1: 2 ** 19, GAMMA2: GAMMA2_2, TAU: 60, ETA: 2, OMEGA: 75 },
};
const newPoly = (n) => new Int32Array(n);
const { mod, smod, NTT, bitsCoder } = (0, _crystals_ts_1.genCrystals)({
    N,
    Q,
    F,
    ROOT_OF_UNITY,
    newPoly,
    isKyber: false,
    brvBits: 8,
});
const id = (n) => n;
const polyCoder = (d, compress = id, verify = id) => bitsCoder(d, {
    encode: (i) => compress(verify(i)),
    decode: (i) => verify(compress(i)),
});
const polyAdd = (a, b) => {
    for (let i = 0; i < a.length; i++)
        a[i] = mod(a[i] + b[i]);
    return a;
};
const polySub = (a, b) => {
    for (let i = 0; i < a.length; i++)
        a[i] = mod(a[i] - b[i]);
    return a;
};
const polyShiftl = (p) => {
    for (let i = 0; i < N; i++)
        p[i] <<= D;
    return p;
};
const polyChknorm = (p, B) => {
    // Not very sure about this, but FIPS204 doesn't provide any function for that :(
    for (let i = 0; i < N; i++)
        if (Math.abs(smod(p[i])) >= B)
            return true;
    return false;
};
const MultiplyNTTs = (a, b) => {
    // NOTE: we don't use montgomery reduction in code, since it requires 64 bit ints,
    // which is not available in JS. mod(a[i] * b[i]) is ok, since Q is 23 bit,
    // which means a[i] * b[i] is 46 bit, which is safe to use in JS. (number is 53 bits).
    // Barrett reduction is slower than mod :(
    const c = newPoly(N);
    for (let i = 0; i < a.length; i++)
        c[i] = mod(a[i] * b[i]);
    return c;
};
// Return poly in NTT representation
function RejNTTPoly(xof) {
    // Samples a polynomial ∈ Tq.
    const r = newPoly(N);
    // NOTE: we can represent 3xu24 as 4xu32, but it doesn't improve perf :(
    for (let j = 0; j < N;) {
        const b = xof();
        if (b.length % 3)
            throw new Error('RejNTTPoly: unaligned block');
        for (let i = 0; j < N && i <= b.length - 3; i += 3) {
            const t = (b[i + 0] | (b[i + 1] << 8) | (b[i + 2] << 16)) & 0x7fffff; // 3 bytes
            if (t < Q)
                r[j++] = t;
        }
    }
    return r;
}
function getDilithium(opts) {
    const { K, L, GAMMA1, GAMMA2, TAU, ETA, OMEGA } = opts;
    const { CRH_BYTES, TR_BYTES, C_TILDE_BYTES, XOF128, XOF256 } = opts;
    if (![2, 4].includes(ETA))
        throw new Error('Wrong ETA');
    if (![1 << 17, 1 << 19].includes(GAMMA1))
        throw new Error('Wrong GAMMA1');
    if (![GAMMA2_1, GAMMA2_2].includes(GAMMA2))
        throw new Error('Wrong GAMMA2');
    const BETA = TAU * ETA;
    const decompose = (r) => {
        // Decomposes r into (r1, r0) such that r ≡ r1(2γ2) + r0 mod q.
        const rPlus = mod(r);
        const r0 = smod(rPlus, 2 * GAMMA2) | 0;
        if (rPlus - r0 === Q - 1)
            return { r1: 0 | 0, r0: (r0 - 1) | 0 };
        const r1 = Math.floor((rPlus - r0) / (2 * GAMMA2)) | 0;
        return { r1, r0 }; // r1 = HighBits, r0 = LowBits
    };
    const HighBits = (r) => decompose(r).r1;
    const LowBits = (r) => decompose(r).r0;
    const MakeHint = (z, r) => {
        // Compute hint bit indicating whether adding z to r alters the high bits of r.
        // From dilithium code
        const res0 = z <= GAMMA2 || z > Q - GAMMA2 || (z === Q - GAMMA2 && r === 0) ? 0 : 1;
        // from FIPS204:
        // // const r1 = HighBits(r);
        // // const v1 = HighBits(r + z);
        // // const res1 = +(r1 !== v1);
        // But they return different results! However, decompose is same.
        // So, either there is a bug in Dilithium ref implementation or in FIPS204.
        // For now, lets use dilithium one, so test vectors can be passed.
        // See
        // https://github.com/GiacomoPope/dilithium-py?tab=readme-ov-file#optimising-decomposition-and-making-hints
        return res0;
    };
    const UseHint = (h, r) => {
        // Returns the high bits of r adjusted according to hint h
        const m = Math.floor((Q - 1) / (2 * GAMMA2));
        const { r1, r0 } = decompose(r);
        // 3: if h = 1 and r0 > 0 return (r1 + 1) mod m
        // 4: if h = 1 and r0 ≤ 0 return (r1 − 1) mod m
        if (h === 1)
            return r0 > 0 ? mod(r1 + 1, m) | 0 : mod(r1 - 1, m) | 0;
        return r1 | 0;
    };
    const Power2Round = (r) => {
        // Decomposes r into (r1, r0) such that r ≡ r1*(2**d) + r0 mod q.
        const rPlus = mod(r);
        const r0 = smod(rPlus, 2 ** D) | 0;
        return { r1: Math.floor((rPlus - r0) / 2 ** D) | 0, r0 };
    };
    const hintCoder = {
        bytesLen: OMEGA + K,
        encode: (h) => {
            if (h === false)
                throw new Error('hint.encode: hint is false'); // should never happen
            const res = new Uint8Array(OMEGA + K);
            for (let i = 0, k = 0; i < K; i++) {
                for (let j = 0; j < N; j++)
                    if (h[i][j] !== 0)
                        res[k++] = j;
                res[OMEGA + i] = k;
            }
            return res;
        },
        decode: (buf) => {
            const h = [];
            let k = 0;
            for (let i = 0; i < K; i++) {
                const hi = newPoly(N);
                if (buf[OMEGA + i] < k || buf[OMEGA + i] > OMEGA)
                    return false;
                for (let j = k; j < buf[OMEGA + i]; j++) {
                    if (j > k && buf[j] <= buf[j - 1])
                        return false;
                    hi[buf[j]] = 1;
                }
                k = buf[OMEGA + i];
                h.push(hi);
            }
            for (let j = k; j < OMEGA; j++)
                if (buf[j] !== 0)
                    return false;
            return h;
        },
    };
    const ETACoder = polyCoder(ETA === 2 ? 3 : 4, (i) => ETA - i, (i) => {
        if (!(-ETA <= i && i <= ETA))
            throw new Error(`malformed key s1/s3 ${i} outside of ETA range [${-ETA}, ${ETA}]`);
        return i;
    });
    const T0Coder = polyCoder(13, (i) => (1 << (D - 1)) - i);
    const T1Coder = polyCoder(10);
    // Requires smod. Need to fix!
    const ZCoder = polyCoder(GAMMA1 === 1 << 17 ? 18 : 20, (i) => smod(GAMMA1 - i));
    const W1Coder = polyCoder(GAMMA2 === GAMMA2_1 ? 6 : 4);
    const W1Vec = (0, utils_ts_1.vecCoder)(W1Coder, K);
    // Main structures
    const publicCoder = (0, utils_ts_1.splitCoder)(32, (0, utils_ts_1.vecCoder)(T1Coder, K));
    const secretCoder = (0, utils_ts_1.splitCoder)(32, 32, TR_BYTES, (0, utils_ts_1.vecCoder)(ETACoder, L), (0, utils_ts_1.vecCoder)(ETACoder, K), (0, utils_ts_1.vecCoder)(T0Coder, K));
    const sigCoder = (0, utils_ts_1.splitCoder)(C_TILDE_BYTES, (0, utils_ts_1.vecCoder)(ZCoder, L), hintCoder);
    const CoefFromHalfByte = ETA === 2
        ? (n) => (n < 15 ? 2 - (n % 5) : false)
        : (n) => (n < 9 ? 4 - n : false);
    // Return poly in NTT representation
    function RejBoundedPoly(xof) {
        // Samples an element a ∈ Rq with coeffcients in [−η, η] computed via rejection sampling from ρ.
        const r = newPoly(N);
        for (let j = 0; j < N;) {
            const b = xof();
            for (let i = 0; j < N && i < b.length; i += 1) {
                // half byte. Should be superfast with vector instructions. But very slow with js :(
                const d1 = CoefFromHalfByte(b[i] & 0x0f);
                const d2 = CoefFromHalfByte((b[i] >> 4) & 0x0f);
                if (d1 !== false)
                    r[j++] = d1;
                if (j < N && d2 !== false)
                    r[j++] = d2;
            }
        }
        return r;
    }
    const SampleInBall = (seed) => {
        // Samples a polynomial c ∈ Rq with coeffcients from {−1, 0, 1} and Hamming weight τ
        const pre = newPoly(N);
        const s = sha3_1.shake256.create({}).update(seed);
        const buf = new Uint8Array(sha3_1.shake256.blockLen);
        s.xofInto(buf);
        const masks = buf.slice(0, 8);
        for (let i = N - TAU, pos = 8, maskPos = 0, maskBit = 0; i < N; i++) {
            let b = i + 1;
            for (; b > i;) {
                b = buf[pos++];
                if (pos < sha3_1.shake256.blockLen)
                    continue;
                s.xofInto(buf);
                pos = 0;
            }
            pre[i] = pre[b];
            pre[b] = 1 - (((masks[maskPos] >> maskBit++) & 1) << 1);
            if (maskBit >= 8) {
                maskPos++;
                maskBit = 0;
            }
        }
        return pre;
    };
    const polyPowerRound = (p) => {
        const res0 = newPoly(N);
        const res1 = newPoly(N);
        for (let i = 0; i < p.length; i++) {
            const { r0, r1 } = Power2Round(p[i]);
            res0[i] = r0;
            res1[i] = r1;
        }
        return { r0: res0, r1: res1 };
    };
    const polyUseHint = (u, h) => {
        for (let i = 0; i < N; i++)
            u[i] = UseHint(h[i], u[i]);
        return u;
    };
    const polyMakeHint = (a, b) => {
        const v = newPoly(N);
        let cnt = 0;
        for (let i = 0; i < N; i++) {
            const h = MakeHint(a[i], b[i]);
            v[i] = h;
            cnt += h;
        }
        return { v, cnt };
    };
    const signRandBytes = 32;
    const seedCoder = (0, utils_ts_1.splitCoder)(32, 64, 32);
    // API & argument positions are exactly as in FIPS204.
    const internal = {
        signRandBytes,
        keygen: (seed) => {
            // H(𝜉||IntegerToBytes(𝑘, 1)||IntegerToBytes(ℓ, 1), 128) 2: ▷ expand seed
            const seedDst = new Uint8Array(32 + 2);
            const randSeed = seed === undefined;
            if (randSeed)
                seed = (0, utils_ts_1.randomBytes)(32);
            (0, utils_ts_1.ensureBytes)(seed, 32);
            seedDst.set(seed);
            if (randSeed)
                seed.fill(0);
            seedDst[32] = K;
            seedDst[33] = L;
            const [rho, rhoPrime, K_] = seedCoder.decode((0, sha3_1.shake256)(seedDst, { dkLen: seedCoder.bytesLen }));
            const xofPrime = XOF256(rhoPrime);
            const s1 = [];
            for (let i = 0; i < L; i++)
                s1.push(RejBoundedPoly(xofPrime.get(i & 0xff, (i >> 8) & 0xff)));
            const s2 = [];
            for (let i = L; i < L + K; i++)
                s2.push(RejBoundedPoly(xofPrime.get(i & 0xff, (i >> 8) & 0xff)));
            const s1Hat = s1.map((i) => NTT.encode(i.slice()));
            const t0 = [];
            const t1 = [];
            const xof = XOF128(rho);
            const t = newPoly(N);
            for (let i = 0; i < K; i++) {
                // t ← NTT−1(A*NTT(s1)) + s2
                t.fill(0); // don't-reallocate
                for (let j = 0; j < L; j++) {
                    const aij = RejNTTPoly(xof.get(j, i)); // super slow!
                    polyAdd(t, MultiplyNTTs(aij, s1Hat[j]));
                }
                NTT.decode(t);
                const { r0, r1 } = polyPowerRound(polyAdd(t, s2[i])); // (t1, t0) ← Power2Round(t, d)
                t0.push(r0);
                t1.push(r1);
            }
            const publicKey = publicCoder.encode([rho, t1]); // pk ← pkEncode(ρ, t1)
            const tr = (0, sha3_1.shake256)(publicKey, { dkLen: TR_BYTES }); // tr ← H(BytesToBits(pk), 512)
            const secretKey = secretCoder.encode([rho, K_, tr, s1, s2, t0]); // sk ← skEncode(ρ, K,tr, s1, s2, t0)
            xof.clean();
            xofPrime.clean();
            // STATS
            // Kyber512:  { calls: 4, xofs: 12 }, Kyber768: { calls: 9, xofs: 27 }, Kyber1024: { calls: 16, xofs: 48 }
            // DSA44:    { calls: 24, xofs: 24 }, DSA65:    { calls: 41, xofs: 41 }, DSA87:    { calls: 71, xofs: 71 }
            (0, utils_ts_1.cleanBytes)(rho, rhoPrime, K_, s1, s2, s1Hat, t, t0, t1, tr, seedDst);
            return { publicKey, secretKey };
        },
        // NOTE: random is optional.
        sign: (secretKey, msg, random, externalMu = false) => {
            // This part can be pre-cached per secretKey, but there is only minor performance improvement,
            // since we re-use a lot of variables to computation.
            const [rho, _K, tr, s1, s2, t0] = secretCoder.decode(secretKey); // (ρ, K,tr, s1, s2, t0) ← skDecode(sk)
            // Cache matrix to avoid re-compute later
            const A = []; // A ← ExpandA(ρ)
            const xof = XOF128(rho);
            for (let i = 0; i < K; i++) {
                const pv = [];
                for (let j = 0; j < L; j++)
                    pv.push(RejNTTPoly(xof.get(j, i)));
                A.push(pv);
            }
            xof.clean();
            for (let i = 0; i < L; i++)
                NTT.encode(s1[i]); // sˆ1 ← NTT(s1)
            for (let i = 0; i < K; i++) {
                NTT.encode(s2[i]); // sˆ2 ← NTT(s2)
                NTT.encode(t0[i]); // tˆ0 ← NTT(t0)
            }
            // This part is per msg
            const mu = externalMu
                ? msg
                : sha3_1.shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest(); // 6: µ ← H(tr||M, 512) ▷ Compute message representative µ
            // Compute private random seed
            const rnd = random ? random : new Uint8Array(32);
            (0, utils_ts_1.ensureBytes)(rnd);
            const rhoprime = sha3_1.shake256
                .create({ dkLen: CRH_BYTES })
                .update(_K)
                .update(rnd)
                .update(mu)
                .digest(); // ρ′← H(K||rnd||µ, 512)
            (0, utils_ts_1.ensureBytes)(rhoprime, CRH_BYTES);
            const x256 = XOF256(rhoprime, ZCoder.bytesLen);
            //  Rejection sampling loop
            main_loop: for (let kappa = 0;;) {
                const y = [];
                // y ← ExpandMask(ρ , κ)
                for (let i = 0; i < L; i++, kappa++)
                    y.push(ZCoder.decode(x256.get(kappa & 0xff, kappa >> 8)()));
                const z = y.map((i) => NTT.encode(i.slice()));
                const w = [];
                for (let i = 0; i < K; i++) {
                    // w ← NTT−1(A ◦ NTT(y))
                    const wi = newPoly(N);
                    for (let j = 0; j < L; j++)
                        polyAdd(wi, MultiplyNTTs(A[i][j], z[j]));
                    NTT.decode(wi);
                    w.push(wi);
                }
                const w1 = w.map((j) => j.map(HighBits)); // w1 ← HighBits(w)
                // Commitment hash: c˜ ∈{0, 1 2λ } ← H(µ||w1Encode(w1), 2λ)
                const cTilde = sha3_1.shake256
                    .create({ dkLen: C_TILDE_BYTES })
                    .update(mu)
                    .update(W1Vec.encode(w1))
                    .digest();
                // Verifer’s challenge
                const cHat = NTT.encode(SampleInBall(cTilde)); // c ← SampleInBall(c˜1); cˆ ← NTT(c)
                // ⟨⟨cs1⟩⟩ ← NTT−1(cˆ◦ sˆ1)
                const cs1 = s1.map((i) => MultiplyNTTs(i, cHat));
                for (let i = 0; i < L; i++) {
                    polyAdd(NTT.decode(cs1[i]), y[i]); // z ← y + ⟨⟨cs1⟩⟩
                    if (polyChknorm(cs1[i], GAMMA1 - BETA))
                        continue main_loop; // ||z||∞ ≥ γ1 − β
                }
                // cs1 is now z (▷ Signer’s response)
                let cnt = 0;
                const h = [];
                for (let i = 0; i < K; i++) {
                    const cs2 = NTT.decode(MultiplyNTTs(s2[i], cHat)); // ⟨⟨cs2⟩⟩ ← NTT−1(cˆ◦ sˆ2)
                    const r0 = polySub(w[i], cs2).map(LowBits); // r0 ← LowBits(w − ⟨⟨cs2⟩⟩)
                    if (polyChknorm(r0, GAMMA2 - BETA))
                        continue main_loop; // ||r0||∞ ≥ γ2 − β
                    const ct0 = NTT.decode(MultiplyNTTs(t0[i], cHat)); // ⟨⟨ct0⟩⟩ ← NTT−1(cˆ◦ tˆ0)
                    if (polyChknorm(ct0, GAMMA2))
                        continue main_loop;
                    polyAdd(r0, ct0);
                    // ▷ Signer’s hint
                    const hint = polyMakeHint(r0, w1[i]); // h ← MakeHint(−⟨⟨ct0⟩⟩, w− ⟨⟨cs2⟩⟩ + ⟨⟨ct0⟩⟩)
                    h.push(hint.v);
                    cnt += hint.cnt;
                }
                if (cnt > OMEGA)
                    continue; // the number of 1’s in h is greater than ω
                x256.clean();
                const res = sigCoder.encode([cTilde, cs1, h]); // σ ← sigEncode(c˜, z mod±q, h)
                // rho, _K, tr is subarray of secretKey, cannot clean.
                (0, utils_ts_1.cleanBytes)(cTilde, cs1, h, cHat, w1, w, z, y, rhoprime, mu, s1, s2, t0, ...A);
                return res;
            }
            // @ts-ignore
            throw new Error('Unreachable code path reached, report this error');
        },
        verify: (publicKey, msg, sig, externalMu = false) => {
            // ML-DSA.Verify(pk, M, σ): Verifes a signature σ for a message M.
            const [rho, t1] = publicCoder.decode(publicKey); // (ρ, t1) ← pkDecode(pk)
            const tr = (0, sha3_1.shake256)(publicKey, { dkLen: TR_BYTES }); // 6: tr ← H(BytesToBits(pk), 512)
            if (sig.length !== sigCoder.bytesLen)
                return false; // return false instead of exception
            const [cTilde, z, h] = sigCoder.decode(sig); // (c˜, z, h) ← sigDecode(σ), ▷ Signer’s commitment hash c ˜, response z and hint
            if (h === false)
                return false; // if h = ⊥ then return false
            for (let i = 0; i < L; i++)
                if (polyChknorm(z[i], GAMMA1 - BETA))
                    return false;
            const mu = externalMu
                ? msg
                : sha3_1.shake256.create({ dkLen: CRH_BYTES }).update(tr).update(msg).digest(); // 7: µ ← H(tr||M, 512)
            // Compute verifer’s challenge from c˜
            const c = NTT.encode(SampleInBall(cTilde)); // c ← SampleInBall(c˜1)
            const zNtt = z.map((i) => i.slice()); // zNtt = NTT(z)
            for (let i = 0; i < L; i++)
                NTT.encode(zNtt[i]);
            const wTick1 = [];
            const xof = XOF128(rho);
            for (let i = 0; i < K; i++) {
                const ct12d = MultiplyNTTs(NTT.encode(polyShiftl(t1[i])), c); //c * t1 * (2**d)
                const Az = newPoly(N); // // A * z
                for (let j = 0; j < L; j++) {
                    const aij = RejNTTPoly(xof.get(j, i)); // A[i][j] inplace
                    polyAdd(Az, MultiplyNTTs(aij, zNtt[j]));
                }
                // wApprox = A*z - c*t1 * (2**d)
                const wApprox = NTT.decode(polySub(Az, ct12d));
                // Reconstruction of signer’s commitment
                wTick1.push(polyUseHint(wApprox, h[i])); // w ′ ← UseHint(h, w'approx )
            }
            xof.clean();
            // c˜′← H (µ||w1Encode(w′1), 2λ),  Hash it; this should match c˜
            const c2 = sha3_1.shake256
                .create({ dkLen: C_TILDE_BYTES })
                .update(mu)
                .update(W1Vec.encode(wTick1))
                .digest();
            // Additional checks in FIPS-204:
            // [[ ||z||∞ < γ1 − β ]] and [[c ˜ = c˜′]] and [[number of 1’s in h is ≤ ω]]
            for (const t of h) {
                const sum = t.reduce((acc, i) => acc + i, 0);
                if (!(sum <= OMEGA))
                    return false;
            }
            for (const t of z)
                if (polyChknorm(t, GAMMA1 - BETA))
                    return false;
            return (0, utils_ts_1.equalBytes)(cTilde, c2);
        },
    };
    return {
        internal,
        keygen: internal.keygen,
        signRandBytes: internal.signRandBytes,
        sign: (secretKey, msg, ctx = utils_ts_1.EMPTY, random) => {
            const M = (0, utils_ts_1.getMessage)(msg, ctx);
            const res = internal.sign(secretKey, M, random);
            M.fill(0);
            return res;
        },
        verify: (publicKey, msg, sig, ctx = utils_ts_1.EMPTY) => {
            return internal.verify(publicKey, (0, utils_ts_1.getMessage)(msg, ctx), sig);
        },
        prehash: (hashName) => ({
            sign: (secretKey, msg, ctx = utils_ts_1.EMPTY, random) => {
                const M = (0, utils_ts_1.getMessagePrehash)(hashName, msg, ctx);
                const res = internal.sign(secretKey, M, random);
                M.fill(0);
                return res;
            },
            verify: (publicKey, msg, sig, ctx = utils_ts_1.EMPTY) => {
                return internal.verify(publicKey, (0, utils_ts_1.getMessagePrehash)(hashName, msg, ctx), sig);
            },
        }),
    };
}
/** ML-DSA-44 for 128-bit security level. Not recommended after 2030, as per ASD. */
exports.ml_dsa44 = getDilithium({
    ...exports.PARAMS[2],
    CRH_BYTES: 64,
    TR_BYTES: 64,
    C_TILDE_BYTES: 32,
    XOF128: _crystals_ts_1.XOF128,
    XOF256: _crystals_ts_1.XOF256,
});
/** ML-DSA-65 for 192-bit security level. Not recommended after 2030, as per ASD. */
exports.ml_dsa65 = getDilithium({
    ...exports.PARAMS[3],
    CRH_BYTES: 64,
    TR_BYTES: 64,
    C_TILDE_BYTES: 48,
    XOF128: _crystals_ts_1.XOF128,
    XOF256: _crystals_ts_1.XOF256,
});
/** ML-DSA-87 for 256-bit security level. OK after 2030, as per ASD. */
exports.ml_dsa87 = getDilithium({
    ...exports.PARAMS[5],
    CRH_BYTES: 64,
    TR_BYTES: 64,
    C_TILDE_BYTES: 64,
    XOF128: _crystals_ts_1.XOF128,
    XOF256: _crystals_ts_1.XOF256,
});
//# sourceMappingURL=ml-dsa.js.map
},{ "./_crystals.js": 8, "./hashes/sha3.js": 4, "./utils.js": 7}], 7:[function(require,module,exports){"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY = exports.utf8ToBytes = exports.concatBytes = exports.randomBytes = exports.ensureBytes = void 0;
exports.equalBytes = equalBytes;
exports.splitCoder = splitCoder;
exports.vecCoder = vecCoder;
exports.cleanBytes = cleanBytes;
exports.getMask = getMask;
exports.getMessage = getMessage;
exports.getMessagePrehash = getMessagePrehash;
/**
 * Utilities for hex, bytearray and number handling.
 * @module
 */
/*! noble-post-quantum - MIT License (c) 2024 Paul Miller (paulmillr.com) */
const sha2_1 = require("./hashes/sha2.js");
const sha3_1 = require("./hashes/sha3.js");
const utils_1 = require("./hashes/utils.js");
Object.defineProperty(exports, "concatBytes", { enumerable: true, get: function () { return utils_1.concatBytes; } });
Object.defineProperty(exports, "utf8ToBytes", { enumerable: true, get: function () { return utils_1.utf8ToBytes; } });
exports.ensureBytes = utils_1.abytes;
exports.randomBytes = utils_1.randomBytes;
// Compares 2 u8a-s in kinda constant time
function equalBytes(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a[i] ^ b[i];
    return diff === 0;
}
function splitCoder(...lengths) {
    const getLength = (c) => (typeof c === 'number' ? c : c.bytesLen);
    const bytesLen = lengths.reduce((sum, a) => sum + getLength(a), 0);
    return {
        bytesLen,
        encode: (bufs) => {
            const res = new Uint8Array(bytesLen);
            for (let i = 0, pos = 0; i < lengths.length; i++) {
                const c = lengths[i];
                const l = getLength(c);
                const b = typeof c === 'number' ? bufs[i] : c.encode(bufs[i]);
                (0, exports.ensureBytes)(b, l);
                res.set(b, pos);
                if (typeof c !== 'number')
                    b.fill(0); // clean
                pos += l;
            }
            return res;
        },
        decode: (buf) => {
            (0, exports.ensureBytes)(buf, bytesLen);
            const res = [];
            for (const c of lengths) {
                const l = getLength(c);
                const b = buf.subarray(0, l);
                res.push(typeof c === 'number' ? b : c.decode(b));
                buf = buf.subarray(l);
            }
            return res;
        },
    };
}
// nano-packed.array (fixed size)
function vecCoder(c, vecLen) {
    const bytesLen = vecLen * c.bytesLen;
    return {
        bytesLen,
        encode: (u) => {
            if (u.length !== vecLen)
                throw new Error(`vecCoder.encode: wrong length=${u.length}. Expected: ${vecLen}`);
            const res = new Uint8Array(bytesLen);
            for (let i = 0, pos = 0; i < u.length; i++) {
                const b = c.encode(u[i]);
                res.set(b, pos);
                b.fill(0); // clean
                pos += b.length;
            }
            return res;
        },
        decode: (a) => {
            (0, exports.ensureBytes)(a, bytesLen);
            const r = [];
            for (let i = 0; i < a.length; i += c.bytesLen)
                r.push(c.decode(a.subarray(i, i + c.bytesLen)));
            return r;
        },
    };
}
// cleanBytes(new Uint8Array(), [new Uint16Array(), new Uint32Array()])
function cleanBytes(...list) {
    for (const t of list) {
        if (Array.isArray(t))
            for (const b of t)
                b.fill(0);
        else
            t.fill(0);
    }
}
function getMask(bits) {
    return (1 << bits) - 1; // 4 -> 0b1111
}
exports.EMPTY = new Uint8Array(0);
function getMessage(msg, ctx = exports.EMPTY) {
    (0, exports.ensureBytes)(msg);
    (0, exports.ensureBytes)(ctx);
    if (ctx.length > 255)
        throw new Error('context should be less than 255 bytes');
    return (0, utils_1.concatBytes)(new Uint8Array([0, ctx.length]), ctx, msg);
}
// OIDS from https://csrc.nist.gov/projects/computer-security-objects-register/algorithm-registration
// TODO: maybe add 'OID' property to hashes themselves to improve tree-shaking?
const HASHES = {
    'SHA2-256': { oid: (0, utils_1.hexToBytes)('0609608648016503040201'), hash: sha2_1.sha256 },
    'SHA2-384': { oid: (0, utils_1.hexToBytes)('0609608648016503040202'), hash: sha2_1.sha384 },
    'SHA2-512': { oid: (0, utils_1.hexToBytes)('0609608648016503040203'), hash: sha2_1.sha512 },
    'SHA2-224': { oid: (0, utils_1.hexToBytes)('0609608648016503040204'), hash: sha2_1.sha224 },
    'SHA2-512/224': { oid: (0, utils_1.hexToBytes)('0609608648016503040205'), hash: sha2_1.sha512_224 },
    'SHA2-512/256': { oid: (0, utils_1.hexToBytes)('0609608648016503040206'), hash: sha2_1.sha512_256 },
    'SHA3-224': { oid: (0, utils_1.hexToBytes)('0609608648016503040207'), hash: sha3_1.sha3_224 },
    'SHA3-256': { oid: (0, utils_1.hexToBytes)('0609608648016503040208'), hash: sha3_1.sha3_256 },
    'SHA3-384': { oid: (0, utils_1.hexToBytes)('0609608648016503040209'), hash: sha3_1.sha3_384 },
    'SHA3-512': { oid: (0, utils_1.hexToBytes)('060960864801650304020A'), hash: sha3_1.sha3_512 },
    'SHAKE-128': {
        oid: (0, utils_1.hexToBytes)('060960864801650304020B'),
        hash: (msg) => (0, sha3_1.shake128)(msg, { dkLen: 32 }),
    },
    'SHAKE-256': {
        oid: (0, utils_1.hexToBytes)('060960864801650304020C'),
        hash: (msg) => (0, sha3_1.shake256)(msg, { dkLen: 64 }),
    },
};
function getMessagePrehash(hashName, msg, ctx = exports.EMPTY) {
    (0, exports.ensureBytes)(msg);
    (0, exports.ensureBytes)(ctx);
    if (ctx.length > 255)
        throw new Error('context should be less than 255 bytes');
    if (!HASHES[hashName])
        throw new Error('unknown hash: ' + hashName);
    const { oid, hash } = HASHES[hashName];
    const hashed = hash(msg);
    return (0, utils_1.concatBytes)(new Uint8Array([1, ctx.length]), ctx, oid, hashed);
}
//# sourceMappingURL=utils.js.map
},{ "./hashes/sha2.js": 6, "./hashes/sha3.js": 4, "./hashes/utils.js": 3}]},{},[10]);