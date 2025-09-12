<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="close()">
			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="close()"/>
					<h3>Add new Security Key</h3>
				</header>
                <Spinner v-if="showSpinner"></Spinner>
                <div class="prompt__body">
                    <center>
                        Name:&nbsp;<input
                            type="text"
                            autofocus
                            name="webAuthName"
                            v-model="webAuthName"
                            placeholder=""
                            v-on:keyup.enter="confirm"
                            style="width:200px"
                        />
                    </center>
                </div>
				<footer class="prompt__footer">
					<AppButton outline @click.native="close()">
						Cancel
					</AppButton>

					<AppButton
						id='prompt-button-id'
						type="primary"
						accent
						@click.native="confirm()"
					>
					Confirm
					</AppButton>
				</footer>
			</div>
		</div>
	</transition>
</template>
<script>
const AppButton = require("../AppButton.vue");
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
    components: {
        AppButton,
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
    created: function() {
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
</style>