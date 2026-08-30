<template>
    <span class="fp-selection__value pg-endpoint__value" :class="{ 'pg-endpoint__value--open': expanded }"
        :title="path" @click="expanded = ! expanded"
        ><span class="pg-path__head">{{ pathHead(path) }}</span
        ><span class="pg-path__tail">{{ pathTail(path) }}</span></span>
</template>

<script>
const paths = require("../../mixins/paths/index.js");
module.exports = {
    props: ['path'],
    mixins: [paths],
    data: function() {
        return {
            expanded: false
        }
    }
}
</script>

<style>
/* the same head and tail split the sync view uses, where it stacks under its label
   rather than sitting beside one */
.fp-selection__value {
    margin-top: 0;
}
</style>
