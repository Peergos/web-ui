<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask" @click="close()">
			<div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" aria-label="Add new Security Key" @click.stop>
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">Add new Security Key</h3>
					<DialogClose @close="close()"/>
				</header>
				<Spinner v-if="showSpinner"></Spinner>
				<div class="pg-dialog__body">
					<label class="webauth__field">
						<span>Name:</span>
						<input ref="name" class="pg-input" type="text" name="webAuthName" v-model="webAuthName"
							v-on:keyup.enter="confirm">
					</label>
				</div>
				<footer class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn" @click="close()">Cancel</button>
						<button type="button" id='prompt-button-id' class="pg-btn pg-btn--primary" @click="confirm()">Confirm</button>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>
<script>
const DialogClose = require("../dialog/DialogClose.vue");
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
    components: {
        DialogClose,
        Spinner,
    },
    data: function() {
        return {
            webAuthName: '',
            credentialId: '',
            showSpinner: false,
        }
    },
    props: ['consumer_func'],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
    },
    mounted: function() {
        this.$refs.name.focus();
    },
    methods: {
        close: function(success) {
            this.$emit("hide-webauth");
            this.consumer_func(this.credentialId, this.webAuthName, success === true);
        },
        confirm: function() {
            let name = this.webAuthName.trim();
            if (name.length == 0) {
                this.$toast.error('Please enter a name', {timeout:false});
            }else if (name.length > 20) {
                this.$toast.error('Name max-length is 20 characters', {timeout:false});
            } else {
                this.register();
            }
        },
        register: function() {
            let that = this;
            this.showSpinner = true;
            that.context.network.account.registerSecurityKeyStart(that.context.username, that.context.signer).thenApply(challenge => {
                let enc = new TextEncoder();
                let userId = new Uint8Array(that.context.username.length);
                enc.encodeInto(that.context.username, userId);
                let chall = new Uint8Array(32);
                for (var i=0; i < 32; i++)
                   chall[i] = challenge[i];
                let data = {
                    publicKey: {
                        challenge: chall,
                        rp: { name: "Peergos" },
                        user: {
                            id: userId,
                            name: that.context.username,
                            displayName: that.context.username,
                        },
                        timeout: 60000,
                        pubKeyCredParams: [
                            {type: "public-key", alg: -8},
                            {type: "public-key", alg: -7},
                            {type: "public-key", alg: -257}
                        ]
                    }
                };
                navigator.credentials.create(data).then(credential => {
                    that.credentialId =  credential.rawId;
                    let rawAttestation = convertToByteArray(new Int8Array(credential.response.attestationObject));
                    let clientDataJson = convertToByteArray(new Int8Array(credential.response.clientDataJSON));
                    let signature = convertToByteArray(new Int8Array(0));
                    let rawId = convertToByteArray(new Int8Array(credential.rawId));
                    let resp = peergos.client.JsUtil.generateWebAuthnResponse(rawId, rawAttestation, clientDataJson, signature);
                    that.context.network.account.registerSecurityKeyComplete(that.context.username, that.webAuthName, resp, that.context.signer).thenApply(done => {
                        clearRootKeyCacheFully(() => {});
                        that.$toast('Security Key has been enabled');
                        that.showSpinner = false;
                        that.close(true);
                    }).exceptionally(function (completeThrowable) {
                        that.$toast.error('Unable to complete registration of security key', {timeout:false});
                        console.log('Unable to complete registration of security key: ' + completeThrowable);
                        that.showSpinner = false;
                    });
                }).catch(createException => {
                    that.$toast.error('Unable to create registration of security key', {timeout:false});
                    console.log('Unable to create registration of security key: ' + createException);
                    that.showSpinner = false;
                });
            }).exceptionally(function (throwable) {
                that.$toast.error('Unable to register security key', {timeout:false});
                console.log('Unable to register security key: ' + throwable);
                that.showSpinner = false;
            });
        }
    }
}
</script>
<style>
.webauth__field {
	display: flex;
	flex-direction: column;
	gap: 6px;
	margin: 0;
	font-size: var(--text-small);
	font-weight: var(--regular);
}
</style>
