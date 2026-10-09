<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" aria-label="Identity Link" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title">Identity Link</h3>
            <DialogClose @close="close"/>
        </header>
        <Spinner v-if="showSpinner"></Spinner>
        <div v-if="proof != null" class="pg-dialog__body identity-proof">
            <p>User <i>{{ proof.claim.usernameA }}</i> on {{ proof.claim.serviceA.name() }} is also <i>{{ proof.claim.usernameB }}</i> on {{ proof.claim.serviceB.name() }}.</p>
            <dl class="pg-facts">
                <div class="pg-facts__item">
                    <dt>Signature</dt>
                    <dd><code>{{ proof.encodedSignature() }}</code></dd>
                </div>
                <div class="pg-facts__item" v-if="proof.hasUrl()">
                    <dt>Proof</dt>
                    <dd><a v-bind:href="proof.postUrl.get()" target="_blank" rel="noopener noreferrer">{{ proof.postUrl.get() }}</a></dd>
                </div>
            </dl>
        </div>
    </div>
</div>
</transition>
</template>
<script>
const DialogClose = require("./dialog/DialogClose.vue");
const Spinner = require("./spinner/Spinner.vue");

module.exports = {
	components: {
	    DialogClose,
	    Spinner
	},
    data: function() {
        return {
            proof: null,
            showSpinner: false
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
<style>
.identity-proof {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.identity-proof code {
	font-size: var(--text-small);
	word-break: break-all;
}
</style>
