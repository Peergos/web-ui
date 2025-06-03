<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div class="modal-container hex-viewer" @click.stop style="width:95%;overflow-y:auto">
        <Spinner v-if="showSpinner"></Spinner>
        <div class="modal-header" style="padding:0">
            <center>
                <h2 v-if="file != null">
                    <p>{{ file.getFileProperties().name }} (hex view)&nbsp;
                        <button class="btn btn-large btn-primary" @click="downloadCurrentFile()">Download File</button>
                    </p>
                </h2>
            </center>
            <span style="position:absolute;top:0;right:4.25em;">
                <span @click="close" tabindex="0" v-on:keyup.enter="close" style="color:black;font-size:3em;font-weight:bold;cursor:pointer;font-family:'Cambria Math'">&times;</span>
            </span>
        </div>
        <center style="height:75%;max-width:100%;font-family: monospace;">
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
        </center>
    </div>
</div>
</transition>
</template>
<script>
    const Spinner = require("../spinner/Spinner.vue");
    const downloaderMixins = require("../../mixins/downloader/index.js");

    module.exports = {
    	components: {
    	    Spinner
    	},
    data: function() {
        return {
	    lookup: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'],
            showSpinner: false,
            fileData: { // immutable
                data: null, // a 5 MiB chunk or less
                offsetHigh: 0,
                offsetLow: 0 // must be multiple of 16
            },
            offsetLow: 0, // must be multiple of 16
            offsetHigh:0,
            maxOffsetLow: 0,
            bytesPerPage: 16 * 32,
        };
    },
    props: ['file', 'context'],
    mixins:[downloaderMixins],
    created: function() {
        console.debug('Hex viewer created!');
        window.addEventListener('keyup', this.keyup);
        this.updateCurrentFileData();
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
                this.addToOffset(-16);
            else if (e.keyCode == 40)  // down arrow
                this.addToOffset(16);
	    else if (e.keyCode == 33)  // page-up
                this.addToOffset(-16 * 32);
	    else if (e.keyCode == 34) // page-down
                this.addToOffset(16 * 32);
	    else if (e.keyCode == 36) // home
                this.addToOffset(-this.offsetLow);
	    else if (e.keyCode == 35) // end
                this.addToOffset(this.maxOffsetLow-this.offsetLow);
        },

        updateCurrentFileData: function() {
            if (this.file == null)
                return;
            if (this.file.isDirectory())
                return;
            var props = this.file.getFileProperties();
            var that = this;
            this.showSpinner = true;
            var section = this.fileData;
            var seekOffset = this.offsetLow - (this.offsetLow % (5*1024*1024));
            var requestedOffset = this.offsetLow;
            this.maxOffsetLow = props.sizeLow() - (props.sizeLow() % this.bytesPerPage);
            this.file.getInputStream(this.context.network, this.context.crypto, 
                props.sizeHigh(), props.sizeLow(), 
                function(read) {})
                .thenCompose(function(startReader) {
                    return startReader
                        .seekJS(section.offsetHigh, seekOffset).thenCompose(function(reader) {

                            var sizeToRead = Math.min(5*1024*1024, props.sizeLow() - seekOffset);
                            var data = convertToByteArray(new Int8Array(sizeToRead));
                            data.length = sizeToRead;
                            return reader.readIntoArray(data, 0, data.length)
                                .thenApply(function(read){
                                    that.fileData = {data:data, offsetHigh: section.offsetHigh, offsetLow: requestedOffset};
                                    that.showSpinner = false;
                                    console.log("Finished retrieving file section of size " + data.length + " from offset " + requestedOffset);
                                });
                        });
                });
        },

        addToOffset: function(diff) {
            if (this.offsetLow + diff < 0) {
                this.offSetLow = 0;
                return;
            }
            var CHUNK = 5*1024*1024;
            var oldLow = this.offsetLow;
            var newLow = this.offsetLow + diff;
            var oldChunk = (oldLow / CHUNK)|0;
            var newChunk = (newLow / CHUNK)|0;
            if (oldChunk != newChunk) {
                // need to retrieve the next chunk
                this.offsetLow = newLow;
                this.updateCurrentFileData();
            } else {
                // can just update pointer
                var existing = this.fileData;
                this.fileData = {data: existing.data, offsetLow: newLow, offsetHigh: existing.offsetHigh};
                this.offsetLow = newLow;
            }
        },

        byteToHex: function(b) {
            return this.lookup[(b >> 4) & 0xf] + this.lookup[b & 0xf];
        },

        intToHex: function(i) {
            return this.byteToHex(i >> 24) + this.byteToHex(i >> 16) + this.byteToHex(i >> 8) + this.byteToHex(i);
        }
    },
    computed: {
        lines: function() {
            var section = this.fileData;
            var data = section.data;
            if (data == null)
                return [];

            var res = [];
            var size = data.length;
            var dataOffset = section.offsetLow % (5 * 1024 * 1024);
            var maxlines = ((size - dataOffset + 15)/16)|0;
            var nlines = Math.min(maxlines, this.bytesPerPage / 16);

            for (var i=0; i < nlines; i++) {
                var hex = [];
                var ascii = [];
                for (var x = 0; x < 16 && dataOffset + 16*i + x < size; x++) {
                    hex[x] = this.byteToHex(data[dataOffset + 16*i + x]);
                    ascii[x] = String.fromCharCode(data[dataOffset + 16*i + x]);
                }
                res[i] = {hex:hex, ascii:ascii, start:this.intToHex(i*16 + section.offsetLow)};
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
</style>
