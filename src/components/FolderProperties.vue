<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <div @click.stop class="folder-properties-container">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <center><h2>Folder: {{folderName}}</h2></center>
        </div>
        <div class="modal-body">
            <div class="folder-properties-view">
                <p>
                    <span class="folder-properties-span">File(s):</span><span>{{fileCount}}</span>
                </p>
                <p>
                    <span class="folder-properties-span">Folder(s):</span><span>{{folderCount}}</span>
                </p>
                <p>
                    <span class="folder-properties-span">Total Size:</span><span>{{actualSize}}</span>
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

<style>
.folder-properties-container {
    width: 40%;
    position: fixed;
    left: 50%;
    transform: translate(-50%, 0);
    padding: 20px 20px;
    background-color: var(--bg);
}

.folder-properties-span {
    font-weight: bold;
    padding-right: 10px;
}

.folder-properties-view {
}

</style>
