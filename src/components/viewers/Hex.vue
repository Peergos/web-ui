<template>
<transition name="modal">
<div class="pg-viewer__mask" @click="close">
    <section class="pg-viewer hex-viewer" role="dialog" aria-modal="true" :aria-label="file == null ? 'Hex view' : file.getFileProperties().name + ', hex view'" @click.stop>
        <header class="pg-viewer__bar">
            <span class="pg-viewer__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h1v6M14 9h1v6"/></svg>
            </span>
            <div class="pg-viewer__heading pg-viewer__heading--inline">
                <h2 v-if="file != null" class="pg-viewer__title">{{ file.getFileProperties().name }}</h2>
                <span class="pg-viewer__tag">Hex view</span>
            </div>
            <button v-if="file != null" type="button" class="pg-btn" aria-label="Download" @click="downloadCurrentFile()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
                <span class="pg-viewer__label">Download</span>
            </button>
            <span v-if="file != null" class="pg-viewer__divider" aria-hidden="true"></span>
            <DialogClose @close="close"/>
        </header>
        <div class="pg-viewer__body hex-viewer__body">
        <Spinner v-if="showSpinner"></Spinner>
        <div class="pg-center" style="height:75%;max-width:100%;font-family: monospace;">
            <table>
                <tr v-for="line in lines">
                    <td style="color:#990012">
                        {{line.start}}:
                    </td>
                    <td style="padding-left:10px">
                        <span v-for="(n, i) in 4">{{line.hex[i] != null ? line.hex[i] : ""}}</span>
                    </td>
                    <td style="padding-left:10px">
                        <span v-for="(n, i) in 4">{{line.hex[i+4] != null ? line.hex[i+4] : ""}}</span>
                    </td>
                    <td style="padding-left:10px">
                        <span v-for="(n, i) in 4">{{line.hex[i+8] != null ? line.hex[i+8] : ""}}</span>
                    </td>
                    <td style="padding-left:10px">
                        <span v-for="(n, i) in 4">{{line.hex[i+12] != null ? line.hex[i+12] : ""}}</span>
                    </td>
                    <td style="padding-left:25px">
                        <span v-for="(n, i) in 16">{{line.ascii[i] != null ? line.ascii[i] : ""}}</span>
                    </td>
                <tr/>
            </table>
        </div>
        </div>
    </section>
</div>
</transition>
</template>
<script>
    const DialogClose = require("../dialog/DialogClose.vue");
    const Spinner = require("../spinner/Spinner.vue");
    const downloaderMixins = require("../../mixins/downloader/index.js");

    module.exports = {
    	components: {
    	    DialogClose,
    	    Spinner
    	},
    data: function() {
        return {
	    lookup: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'],
            showSpinner: false,
            size: 0, // of the whole file: exact as a number, unlike its two 32 bit halves
            // Only one piece of the file is held, however big the file is: the chunk Peergos
            // stored the page in, at the file's own chunk size, plus a page past its end so a
            // page starting near the end of a chunk still fits. Moving outside it reads the
            // piece around the new page in its place.
            chunkSize: 0,
            offset: 0, // the first byte asked for, a multiple of 16
            shown: 0, // the first byte on screen, which is offset once its bytes are held
            held: {start: 0, data: null},
            reading: 0, // the latest read: one that lands after another was asked for is dropped
            bytesPerPage: 16 * 32,
        };
    },
    props: ['file', 'context'],
    mixins:[downloaderMixins],
    created: function() {
        window.addEventListener('keyup', this.keyup);
        if (this.file == null || this.file.isDirectory())
            return;
        var props = this.file.getFileProperties();
        this.size = props.sizeHigh() * 4294967296 + (props.sizeLow() >>> 0);
        this.chunkSize = props.chunkSize;
        this.read(0);
    },
    beforeUnmount: function() {
        // else the closed viewer, and the piece it holds, stay alive answering the keys
        window.removeEventListener('keyup', this.keyup);
        this.reading++;
    },

    methods: {
        getContext: function() {
            return this.context;
        },
        downloadCurrentFile: function() {
            this.downloadFile(this.file);
        },
        close: function() {
            this.$emit("hide-hex-viewer");
        },

        keyup: function(e) {
            if (e.keyCode == 38) // up arrow
                this.moveTo(this.offset - 16);
            else if (e.keyCode == 40)  // down arrow
                this.moveTo(this.offset + 16);
	    else if (e.keyCode == 33)  // page-up
                this.moveTo(this.offset - this.bytesPerPage);
	    else if (e.keyCode == 34) // page-down
                this.moveTo(this.offset + this.bytesPerPage);
	    else if (e.keyCode == 36) // home
                this.moveTo(0);
	    else if (e.keyCode == 35) // end
                this.moveTo(this.lastPage());
        },

        // the start of the last page with any bytes on it: a file whose size is a whole number
        // of pages ends a page before its size, not at it
        lastPage: function() {
            if (this.size == 0)
                return 0;
            return Math.floor((this.size - 1) / this.bytesPerPage) * this.bytesPerPage;
        },

        moveTo: function(target) {
            target = Math.max(0, Math.min(target, this.lastPage()));
            this.offset = target;
            var held = this.held;
            var pageEnd = Math.min(target + this.bytesPerPage, this.size);
            if (held.data != null && target >= held.start && pageEnd <= held.start + held.data.length) {
                // a read still on its way is for somewhere else now
                this.reading++;
                this.showSpinner = false;
                this.shown = target;
            } else {
                this.read(target);
            }
        },

        read: function(target) {
            var that = this;
            var start = target - (target % this.chunkSize);
            var length = Math.min(this.chunkSize + this.bytesPerPage, this.size - start);
            var token = ++this.reading;
            if (length <= 0) {
                this.held = {start: 0, data: []};
                this.shown = 0;
                return;
            }
            var props = this.file.getFileProperties();
            this.showSpinner = true;
            this.file.getInputStream(this.context.network, this.context.crypto,
                props.sizeHigh(), props.sizeLow(),
                function(read) {})
                .thenCompose(function(reader) {
                    return reader.seekJS(Math.floor(start / 4294967296), (start % 4294967296) | 0);
                }).thenCompose(function(reader) {
                    var data = convertToByteArray(new Int8Array(length));
                    data.length = length;
                    return reader.readIntoArray(data, 0, length).thenApply(function(read) {
                        return data;
                    });
                }).thenApply(function(data) {
                    if (token != that.reading)
                        return;
                    that.held = {start: start, data: data};
                    that.shown = target;
                    that.showSpinner = false;
                }).exceptionally(function(throwable) {
                    if (token != that.reading)
                        return;
                    // the keys move on from the page still on screen
                    that.offset = that.shown;
                    that.showSpinner = false;
                    that.$toast.error("Unable to read " + props.name + ": " + (throwable.detailMessage || throwable));
                });
        },

        byteToHex: function(b) {
            return this.lookup[(b >> 4) & 0xf] + this.lookup[b & 0xf];
        },

        // as many digits as the file's last offset needs, and never fewer than eight
        offsetToHex: function(offset) {
            var digits = Math.max(8, Math.max(0, this.size - 1).toString(16).length);
            return offset.toString(16).toUpperCase().padStart(digits, '0');
        }
    },
    computed: {
        lines: function() {
            var held = this.held;
            if (held.data == null)
                return [];
            var at = this.shown - held.start;
            var end = Math.min(at + this.bytesPerPage, held.data.length);
            var res = [];
            for (var row = at; row < end; row += 16) {
                var hex = [];
                var ascii = [];
                for (var x = 0; x < 16 && row + x < end; x++) {
                    hex[x] = this.byteToHex(held.data[row + x]);
                    ascii[x] = String.fromCharCode(held.data[row + x]);
                }
                res.push({hex: hex, ascii: ascii, start: this.offsetToHex(held.start + row)});
            }
            return res;
        }
    }
};
</script>

<style>
.hex-viewer {
    color: var(--color);
    background-color: var(--bg);
}
.hex-viewer__body {
    flex-direction: column;
    overflow: auto;
    padding: 16px;
}
/* a row on one line: on a phone the table scrolls sideways rather than each row wrapping
   into a column of fragments */
.hex-viewer__body table {
    white-space: nowrap;
}
</style>
