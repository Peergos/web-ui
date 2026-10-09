<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="'Folder: ' + folderName" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title">{{ 'Folder: ' + folderName }}</h3>
            <DialogClose @close="close"/>
        </header>
        <div class="pg-dialog__body">
            <dl class="pg-facts">
                <div class="pg-facts__item">
                    <dt>File(s)</dt>
                    <dd>{{fileCount}}</dd>
                </div>
                <div class="pg-facts__item">
                    <dt>Folder(s)</dt>
                    <dd>{{folderCount}}</dd>
                </div>
                <div class="pg-facts__item">
                    <dt>Total Size</dt>
                    <dd>{{actualSize}}</dd>
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
    data: function() {
        return {
            fileCount: 0,
            actualSize: 0,
            apparentSize: 0,
            folderCount: 0,
            folderName: ''
        }
    },
    props: ['folder_properties'],
    created: function() {
        this.folderName = this.folder_properties.folderName;
        this.fileCount = this.folder_properties.fileCount;
        this.folderCount = this.folder_properties.folderCount;
        this.apparentSize = helpers.convertBytesToHumanReadable(this.folder_properties.apparentSize);
        this.actualSize = helpers.convertBytesToHumanReadable(this.folder_properties.actualSize);
    },
    methods: {
        close: function () {
            this.$emit("hide-folder-properties-view");
        }
    }
}
</script>

