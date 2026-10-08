<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="name" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title">{{ name }}</h3>
            <DialogClose @close="close"/>
        </header>
        <div class="pg-dialog__body">
            <dl class="pg-facts">
                <div class="pg-facts__item">
                    <dt>Size</dt>
                    <dd>{{ size }}</dd>
                </div>
                <div class="pg-facts__item" v-if="mimeType">
                    <dt>MIME type</dt>
                    <dd>{{ mimeType }}</dd>
                </div>
                <div class="pg-facts__item">
                    <dt>Type</dt>
                    <dd>{{ type }}</dd>
                </div>
                <div class="pg-facts__item">
                    <dt>Created</dt>
                    <dd>{{ created }}</dd>
                </div>
                <div class="pg-facts__item">
                    <dt>Modified</dt>
                    <dd>{{ modified }}</dd>
                </div>
            </dl>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const DialogClose = require("./dialog/DialogClose.vue");
const helpers = require("../mixins/storage/index.js");

module.exports = {
    components: {
        DialogClose,
    },
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

