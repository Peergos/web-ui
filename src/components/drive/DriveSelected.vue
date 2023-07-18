<template>

    <div class="drive-selected" v-show="selectedFiles.length">
        <span class="count">with {{selectedFiles.length}} selected:</span>
        <AppButton aria-label="copy" @click.native="$emit('copy')">Copy</AppButton>
        <AppButton aria-label="cut" @click.native="$emit('cut')">Cut</AppButton>
        <AppButton aria-label="delete"  @click.native="$emit('deleteFiles')">Delete</AppButton>
        <AppButton aria-label="zip" @click.native="$emit('zip')">Zip</AppButton>
        <AppButton aria-label="download"  @click.native="$emit('download')">Download</AppButton>
    </div>

</template>
<script>


const AppButton = require("../AppButton.vue");

module.exports = {
	components: {
	    AppButton,
	},
    props: {
        selectedFiles: {
            type: Array,
            default: ()=>[]
        },
    },
}

</script>
<style>

.drive-selected {
    margin: 0 32px;
    padding: 0 16px;
}

.drive-selected .count {
    margin-right: 32px;
}

</style>
