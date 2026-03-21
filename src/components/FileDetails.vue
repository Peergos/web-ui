<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <div @click.stop class="file-details-container">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <h2>{{ name }}</h2>
        </div>
        <div class="modal-body">
            <div class="file-details-view">
                <p>
                    <span class="file-details-label">Size:</span><span>{{ size }}</span>
                </p>
                <p v-if="mimeType">
                    <span class="file-details-label">MIME type:</span><span>{{ mimeType }}</span>
                </p>
                <p>
                    <span class="file-details-label">Type:</span><span>{{ type }}</span>
                </p>
                <p>
                    <span class="file-details-label">Created:</span><span>{{ created }}</span>
                </p>
                <p>
                    <span class="file-details-label">Modified:</span><span>{{ modified }}</span>
                </p>
            </div>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const helpers = require("../mixins/storage/index.js");

module.exports = {
    props: ['file'],
    computed: {
        name() {
            return this.file.getFileProperties().name;
        },
        size() {
            let props = this.file.getFileProperties();
            let low = props.sizeLow();
            if (low < 0) low = low + Math.pow(2, 32);
            let bytes = low + props.sizeHigh() * Math.pow(2, 32);
            return helpers.convertBytesToHumanReadable(bytes);
        },
        mimeType() {
            return this.file.getFileProperties().mimeType;
        },
        type() {
            return this.file.getFileProperties().getType();
        },
        created() {
            return this.formatDateTime(this.file.getFileProperties().created);
        },
        modified() {
            return this.formatDateTime(this.file.getFileProperties().modified);
        },
    },
    methods: {
        close() {
            this.$emit('hide-file-details');
        },
        formatDateTime(dateTime) {
            let date = new Date(dateTime.toString() + "+00:00");
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        },
    }
}
</script>

<style>
.file-details-container {
    width: 40%;
    position: fixed;
    left: 50%;
    transform: translate(-50%, 0);
    padding: 20px 20px;
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0,0,0,.33);
}

@media (max-width: 600px) {
    .file-details-container {
        width: 100%;
        left: 0;
        transform: none;
    }
}

.file-details-label {
    font-weight: bold;
    padding-right: 10px;
    display: inline-block;
    min-width: 90px;
}

.file-details-view p {
    margin: 6px 0;
    word-break: break-all;
}
</style>
