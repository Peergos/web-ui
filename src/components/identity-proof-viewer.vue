<template>
    <div class="modal-mask" @click="close">
        <div class="modal-container" @click.stop style="height:95%;width:95%;overflow-y:auto;max-width:800px;">
            <Spinner v-if="showSpinner"></Spinner>
<div>
    <h2>Identity Link</h2>
    <div v-if="proof != null">
        User <i>{{ proof.claim.usernameA }}</i> on {{ proof.claim.serviceA.name() }} is also <i>{{ proof.claim.usernameB }}</i> on {{ proof.claim.serviceB.name() }}.
        <br/>
        Signature: {{ proof.encodedSignature() }}
        <br/>
        <label>Proof: </label>
        <br/>
        <a v-if="proof.hasUrl()" v-bind:href="proof.postUrl.get()" target="_blank">{{ proof.postUrl.get() }}</a>
    </div>
</div>
</div>
</div>
</template>
<script>
const Spinner = require("./spinner/Spinner.vue");

module.exports = {
	components: {
	    Spinner
	},
    data: function() {
        return {
            proof: null
        };
    },
    props: ["file", "context"],
    created: function() {
        this.updateCurrentFileData();
    },
    methods: {
        close: function() {
            this.$emit("hide-identity-proof");
        },

        updateCurrentFileData: function() {
            if (this.file == null)
                return;
            if (this.file.isDirectory())
                return;
            var props = this.file.getFileProperties();
            var that = this;
            this.showSpinner = true;
            this.file.getInputStream(this.context.network, this.context.crypto, 
                props.sizeHigh(), props.sizeLow(), 
                function(read) {})
                .thenCompose(function(reader) {
                    var sizeToRead = Math.min(5*1024*1024, props.sizeLow());
                    var data = convertToByteArray(new Int8Array(sizeToRead));
                    data.length = sizeToRead;
                    return reader.readIntoArray(data, 0, data.length)
                        .thenApply(function(read){
                            that.proof = peergos.shared.util.Serialize.parse(data, c => peergos.shared.user.IdentityLinkProof.fromCbor(c));
                            that.showSpinner = false;
                        });
                });
        },
    }
};
</script>
