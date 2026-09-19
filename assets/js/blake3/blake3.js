// BLAKE3 in pure JavaScript, with subtree entry points.
//
// The use case is hashing a file in 4 MiB chunks, in parallel, where each chunk's
// *chaining value* is needed rather than a finished hash, so that merging them yields the
// real BLAKE3 hash of the whole file. That is what subtreeCV/mergeNonRoot/mergeRoot are
// for; hash() is the ordinary one-shot API, kept for the official test vectors.
//
// Speed notes (the V8 techniques from https://parsa.wtf/blake3/):
//  - the 16 state words live in local variables, never an array, through all 7 rounds
//  - the rounds and the message permutation are written out straight-line, no loops
//  - no allocation per block or per call: the caller's buffer is read through one
//    reusable DataView, and scratch state is module-level
// Correctness first: every deviation from the obvious form is because it measured faster.

const OUT_LEN = 32;
const BLOCK_LEN = 64;
export const CHUNK_LEN = 1024;

const CHUNK_START = 1 << 0;
const CHUNK_END = 1 << 1;
const PARENT = 1 << 2;
const ROOT = 1 << 3;

const IV = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

// The compression output: 16 words. Module level so compress() allocates nothing.
const state = new Uint32Array(16);
// One block of message words, filled from the caller's bytes.
const m = new Uint32Array(16);

/** The full 16 word compression function output, left in `state`. */
function compress(cv0, cv1, cv2, cv3, cv4, cv5, cv6, cv7,
                  m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15,
                  counterLow, counterHigh, blockLen, flags) {
    let v0 = cv0, v1 = cv1, v2 = cv2, v3 = cv3, v4 = cv4, v5 = cv5, v6 = cv6, v7 = cv7;
    let v8 = IV[0], v9 = IV[1], v10 = IV[2], v11 = IV[3];
    let v12 = counterLow, v13 = counterHigh, v14 = blockLen, v15 = flags;

    // g(a,b,c,d,x,y) written out. Rotations are (16,12,8,7) as in the spec.
    // round 1: message words in order, then the permutation is applied to the
    // *names* below rather than moving any data.
    for (let round = 0; round < 7; round++) {
        // column step
        v0 = (v0 + v4 + m0) | 0;
        v12 ^= v0; v12 = (v12 >>> 16) | (v12 << 16);
        v8 = (v8 + v12) | 0;
        v4 ^= v8; v4 = (v4 >>> 12) | (v4 << 20);
        v0 = (v0 + v4 + m1) | 0;
        v12 ^= v0; v12 = (v12 >>> 8) | (v12 << 24);
        v8 = (v8 + v12) | 0;
        v4 ^= v8; v4 = (v4 >>> 7) | (v4 << 25);

        v1 = (v1 + v5 + m2) | 0;
        v13 ^= v1; v13 = (v13 >>> 16) | (v13 << 16);
        v9 = (v9 + v13) | 0;
        v5 ^= v9; v5 = (v5 >>> 12) | (v5 << 20);
        v1 = (v1 + v5 + m3) | 0;
        v13 ^= v1; v13 = (v13 >>> 8) | (v13 << 24);
        v9 = (v9 + v13) | 0;
        v5 ^= v9; v5 = (v5 >>> 7) | (v5 << 25);

        v2 = (v2 + v6 + m4) | 0;
        v14 ^= v2; v14 = (v14 >>> 16) | (v14 << 16);
        v10 = (v10 + v14) | 0;
        v6 ^= v10; v6 = (v6 >>> 12) | (v6 << 20);
        v2 = (v2 + v6 + m5) | 0;
        v14 ^= v2; v14 = (v14 >>> 8) | (v14 << 24);
        v10 = (v10 + v14) | 0;
        v6 ^= v10; v6 = (v6 >>> 7) | (v6 << 25);

        v3 = (v3 + v7 + m6) | 0;
        v15 ^= v3; v15 = (v15 >>> 16) | (v15 << 16);
        v11 = (v11 + v15) | 0;
        v7 ^= v11; v7 = (v7 >>> 12) | (v7 << 20);
        v3 = (v3 + v7 + m7) | 0;
        v15 ^= v3; v15 = (v15 >>> 8) | (v15 << 24);
        v11 = (v11 + v15) | 0;
        v7 ^= v11; v7 = (v7 >>> 7) | (v7 << 25);

        // diagonal step
        v0 = (v0 + v5 + m8) | 0;
        v15 ^= v0; v15 = (v15 >>> 16) | (v15 << 16);
        v10 = (v10 + v15) | 0;
        v5 ^= v10; v5 = (v5 >>> 12) | (v5 << 20);
        v0 = (v0 + v5 + m9) | 0;
        v15 ^= v0; v15 = (v15 >>> 8) | (v15 << 24);
        v10 = (v10 + v15) | 0;
        v5 ^= v10; v5 = (v5 >>> 7) | (v5 << 25);

        v1 = (v1 + v6 + m10) | 0;
        v12 ^= v1; v12 = (v12 >>> 16) | (v12 << 16);
        v11 = (v11 + v12) | 0;
        v6 ^= v11; v6 = (v6 >>> 12) | (v6 << 20);
        v1 = (v1 + v6 + m11) | 0;
        v12 ^= v1; v12 = (v12 >>> 8) | (v12 << 24);
        v11 = (v11 + v12) | 0;
        v6 ^= v11; v6 = (v6 >>> 7) | (v6 << 25);

        v2 = (v2 + v7 + m12) | 0;
        v13 ^= v2; v13 = (v13 >>> 16) | (v13 << 16);
        v8 = (v8 + v13) | 0;
        v7 ^= v8; v7 = (v7 >>> 12) | (v7 << 20);
        v2 = (v2 + v7 + m13) | 0;
        v13 ^= v2; v13 = (v13 >>> 8) | (v13 << 24);
        v8 = (v8 + v13) | 0;
        v7 ^= v8; v7 = (v7 >>> 7) | (v7 << 25);

        v3 = (v3 + v4 + m14) | 0;
        v14 ^= v3; v14 = (v14 >>> 16) | (v14 << 16);
        v9 = (v9 + v14) | 0;
        v4 ^= v9; v4 = (v4 >>> 12) | (v4 << 20);
        v3 = (v3 + v4 + m15) | 0;
        v14 ^= v3; v14 = (v14 >>> 8) | (v14 << 24);
        v9 = (v9 + v14) | 0;
        v4 ^= v9; v4 = (v4 >>> 7) | (v4 << 25);

        if (round === 6)
            break;
        // MSG_PERMUTATION = [2,6,3,10,7,0,4,13,1,11,12,5,9,14,15,8], applied by
        // renaming rather than copying through an array.
        const n0 = m2, n1 = m6, n2 = m3, n3 = m10, n4 = m7, n5 = m0, n6 = m4, n7 = m13,
            n8 = m1, n9 = m11, n10 = m12, n11 = m5, n12 = m9, n13 = m14, n14 = m15, n15 = m8;
        m0 = n0; m1 = n1; m2 = n2; m3 = n3; m4 = n4; m5 = n5; m6 = n6; m7 = n7;
        m8 = n8; m9 = n9; m10 = n10; m11 = n11; m12 = n12; m13 = n13; m14 = n14; m15 = n15;
    }

    state[0] = v0 ^ v8;   state[1] = v1 ^ v9;   state[2] = v2 ^ v10;  state[3] = v3 ^ v11;
    state[4] = v4 ^ v12;  state[5] = v5 ^ v13;  state[6] = v6 ^ v14;  state[7] = v7 ^ v15;
    state[8] = v8 ^ cv0;  state[9] = v9 ^ cv1;  state[10] = v10 ^ cv2; state[11] = v11 ^ cv3;
    state[12] = v12 ^ cv4; state[13] = v13 ^ cv5; state[14] = v14 ^ cv6; state[15] = v15 ^ cv7;
}

/** Read 64 bytes at `off` into the message words, zero padding a short final block. */
function loadBlock(bytes, off, len) {
    if (len === BLOCK_LEN) {
        // the common path: 64 bytes present
        for (let i = 0; i < 16; i++) {
            const o = off + i * 4;
            m[i] = bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24);
        }
        return;
    }
    m.fill(0);
    for (let i = 0; i < len; i++)
        m[i >>> 2] |= bytes[off + i] << ((i & 3) << 3);
}

const cv = new Uint32Array(8);

/** Compress one chunk (up to 1024 bytes) into `cv`, as chunk number `counter`. */
function chunkCV(bytes, off, len, counter, extraFlags) {
    cv.set(IV);
    const counterLow = counter >>> 0;
    const counterHigh = Math.floor(counter / 4294967296) >>> 0;
    let blocks = Math.ceil(len / BLOCK_LEN);
    if (blocks === 0)
        blocks = 1; // the empty input is one empty block
    for (let b = 0; b < blocks; b++) {
        const blockOff = off + b * BLOCK_LEN;
        const blockLen = Math.min(BLOCK_LEN, len - b * BLOCK_LEN);
        let flags = 0;
        if (b === 0)
            flags |= CHUNK_START;
        if (b === blocks - 1)
            flags |= CHUNK_END | extraFlags; // ROOT belongs to the final block only
        loadBlock(bytes, blockOff, blockLen < 0 ? 0 : blockLen);
        compress(cv[0], cv[1], cv[2], cv[3], cv[4], cv[5], cv[6], cv[7],
            m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7],
            m[8], m[9], m[10], m[11], m[12], m[13], m[14], m[15],
            counterLow, counterHigh, blockLen < 0 ? 0 : blockLen, flags);
        cv[0] = state[0]; cv[1] = state[1]; cv[2] = state[2]; cv[3] = state[3];
        cv[4] = state[4]; cv[5] = state[5]; cv[6] = state[6]; cv[7] = state[7];
    }
}

function wordsToBytes(words, count) {
    const out = new Uint8Array(count * 4);
    for (let i = 0; i < count; i++) {
        const w = words[i];
        out[i * 4] = w & 0xff;
        out[i * 4 + 1] = (w >>> 8) & 0xff;
        out[i * 4 + 2] = (w >>> 16) & 0xff;
        out[i * 4 + 3] = (w >>> 24) & 0xff;
    }
    return out;
}

function bytesToWords(bytes, into, at) {
    for (let i = 0; i < 8; i++) {
        const o = i * 4;
        into[at + i] = bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24);
    }
}

const parentBlock = new Uint32Array(16);

function parent(leftCV, rightCV, flags) {
    bytesToWords(leftCV, parentBlock, 0);
    bytesToWords(rightCV, parentBlock, 8);
    compress(IV[0], IV[1], IV[2], IV[3], IV[4], IV[5], IV[6], IV[7],
        parentBlock[0], parentBlock[1], parentBlock[2], parentBlock[3],
        parentBlock[4], parentBlock[5], parentBlock[6], parentBlock[7],
        parentBlock[8], parentBlock[9], parentBlock[10], parentBlock[11],
        parentBlock[12], parentBlock[13], parentBlock[14], parentBlock[15],
        0, 0, BLOCK_LEN, PARENT | flags);
    return wordsToBytes(state, 8);
}

/** The chaining value of a subtree, for merging with its sibling. */
export function mergeNonRoot(leftCV, rightCV) {
    return parent(leftCV, rightCV, 0);
}

/** The root hash of the whole input, from the two halves of the top of the tree. */
export function mergeRoot(leftCV, rightCV) {
    return parent(leftCV, rightCV, ROOT);
}

/**
 * The chaining value of one subtree of a larger input.
 *
 * `bytes` must be a whole number of 1 KiB chunks, a power of two of them, and
 * `chunkIndex` must be a multiple of that count - otherwise it is not a subtree of
 * anything and the result is meaningless. A 4 MiB chunk at file offset
 * `i * 4 MiB` is subtreeCV(chunk, i * 4096).
 */
export function subtreeCV(bytes, chunkIndex) {
    const chunks = bytes.length / CHUNK_LEN;
    if (! Number.isInteger(chunks) || chunks < 1)
        throw new Error("a subtree is a whole number of 1KiB chunks, got " + bytes.length + " bytes");
    if ((chunks & (chunks - 1)) !== 0)
        throw new Error("a subtree covers a power of two chunks, got " + chunks);
    if (chunkIndex % chunks !== 0)
        throw new Error("a subtree of " + chunks + " chunks starts at a multiple of " + chunks
            + ", got chunk " + chunkIndex);
    return subtree(bytes, 0, bytes.length, chunkIndex);
}

/** CV of the aligned power-of-two subtree at [off, off+len). */
function subtree(bytes, off, len, chunkIndex) {
    if (len <= CHUNK_LEN) {
        chunkCV(bytes, off, len, chunkIndex, 0);
        return wordsToBytes(cv, 8);
    }
    const half = len / 2;
    const left = subtree(bytes, off, half, chunkIndex);
    const right = subtree(bytes, off + half, half, chunkIndex + half / CHUNK_LEN);
    return mergeNonRoot(left, right);
}

/**
 * The BLAKE3 hash of a complete input of any length: what b3sum prints.
 *
 * Kept simple rather than fast - it exists for the test vectors, and to check that the
 * subtree path agrees with it. Uploads go through subtreeCV and the merges.
 */
export function hash(bytes) {
    if (bytes.length <= CHUNK_LEN) {
        chunkCV(bytes, 0, bytes.length, 0, ROOT);
        return wordsToBytes(cv, 8);
    }
    // Split off the largest aligned power-of-two subtree, hash the remainder the same
    // way, and merge. The final merge is the root one, which is why this is written as a
    // split rather than as a stack: a stack merges the top pair before we know it is the
    // root, and the root flag cannot be applied afterwards.
    const leftLen = leftSubtreeLen(bytes.length);
    const left = subtree(bytes, 0, leftLen, 0);
    const right = nonRootCV(bytes, leftLen, bytes.length - leftLen, leftLen / CHUNK_LEN);
    return mergeRoot(left, right);
}

/** The largest power-of-two number of chunks that is strictly less than `len` bytes. */
function leftSubtreeLen(len) {
    let chunks = 1;
    while (chunks * 2 * CHUNK_LEN < len)
        chunks *= 2;
    return chunks * CHUNK_LEN;
}

/**
 * CV of a trailing piece of a file, whose length need not be a power of two number of whole
 * chunks - what the last chunk of a file needs, since `subtreeCV` rejects it.
 */
export function tailCV(bytes, chunkIndex) {
    return nonRootCV(bytes, 0, bytes.length, chunkIndex);
}

/** CV of any input, aligned at `chunkIndex`, whose length need not be a power of two. */
function nonRootCV(bytes, off, len, chunkIndex) {
    if (len <= CHUNK_LEN) {
        chunkCV(bytes, off, len, chunkIndex, 0);
        return wordsToBytes(cv, 8);
    }
    const leftLen = leftSubtreeLen(len);
    const left = subtree(bytes, off, leftLen, chunkIndex);
    const right = nonRootCV(bytes, off + leftLen, len - leftLen, chunkIndex + leftLen / CHUNK_LEN);
    return mergeNonRoot(left, right);
}

export function toHex(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++)
        s += bytes[i].toString(16).padStart(2, "0");
    return s;
}
