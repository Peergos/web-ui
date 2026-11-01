<template>
	<AppModal :title="translate('FRIENDLINK.TITLE')">
		<template #body>
			<p>{{ translate("FRIENDLINK.BLURB") }}</p>
			<div v-if="shownText != null" class="friend-link__shown">
				<!-- a code on a white ground whatever the theme: a camera reads dark on light -->
				<div class="qrcode-container">
					<img :src="shownQr" class="qrcode" :alt="translate('FRIENDLINK.QR')"/>
				</div>
				<div class="friend-link__text">{{ shownText }}</div>
				<button type="button" class="pg-btn" @click="copy(shownText)">{{ translate("FRIENDLINK.COPY") }}</button>
			</div>
			<div class="friend-link__create">
				<label class="app-modal__field">{{ translate("FRIENDLINK.LABEL") }}
					<input type="text" class="pg-input friend-link__label" v-model="label" maxlength="64"
						:placeholder="translate('FRIENDLINK.LABEL.PLACEHOLDER')"/>
				</label>
				<label class="app-modal__field">{{ translate("FRIENDLINK.EXPIRY") }}
					<select class="pg-input" v-model="expiryDays">
						<option :value="0">{{ translate("FRIENDLINK.EXPIRY.NEVER") }}</option>
						<option :value="1">{{ translate("FRIENDLINK.EXPIRY.DAY") }}</option>
						<option :value="7">{{ translate("FRIENDLINK.EXPIRY.WEEK") }}</option>
						<option :value="30">{{ translate("FRIENDLINK.EXPIRY.MONTH") }}</option>
					</select>
				</label>
				<label class="pg-switch">
					<input type="checkbox" v-model="singleUse" autocomplete="off">
					<span class="pg-switch__track"></span>
					{{ translate("FRIENDLINK.SINGLE") }}
				</label>
				<button type="button" class="pg-btn pg-btn--primary" :disabled="busy" @click="create()">{{ translate("FRIENDLINK.CREATE") }}</button>
			</div>
			<Spinner v-if="links == null"></Spinner>
			<template v-else-if="links.length > 0">
				<h4>{{ translate("FRIENDLINK.YOURS") }}</h4>
				<ul class="friend-link__list">
					<li v-for="link in links" :key="link.id()" class="friend-link__item">
						<span class="friend-link__name">{{ link.label.length > 0 ? link.label : translate("FRIENDLINK.UNNAMED") }}</span>
						<span class="friend-link__meta">{{ describe(link) }}</span>
						<span class="friend-link__actions">
							<button type="button" class="pg-btn" :disabled="link.isUsedUp()" @click="show(link)">{{ translate("FRIENDLINK.SHOW") }}</button>
							<button type="button" class="pg-btn pg-btn--danger" :disabled="busy" @click="revoke(link)">{{ translate("FRIENDLINK.REVOKE") }}</button>
						</span>
					</li>
				</ul>
			</template>
		</template>
		<template #footer>
			<button type="button" class="pg-btn pg-btn--primary" @click="close()">{{ translate("VERSION.CLOSE") }}</button>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const Spinner = require("../spinner/Spinner.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        AppModal,
        Spinner,
    },
    mixins: [i18n],
    data() {
        return {
            links: null,
            label: "",
            expiryDays: 0,
            singleUse: false,
            busy: false,
            shownText: null,
            shownQr: null,
        };
    },
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
    },
    mounted() {
        this.refresh();
    },
    methods: {
        refresh() {
            let that = this;
            this.context.getFriendLinks().thenApply(list => {
                that.links = list.toArray([]).reverse();
            }).exceptionally(t => {
                console.log(t);
                that.links = [];
            });
        },
        create() {
            let that = this;
            this.busy = true;
            let expiry = this.expiryDays == 0 ?
                java.util.Optional.empty() :
                java.util.Optional.of(peergos.client.JsUtil.fromUtcMillis(Date.now() + this.expiryDays * 24 * 3600 * 1000));
            this.context.createFriendLink(this.label.trim(), expiry, this.singleUse ? 1 : 0).thenApply(link => {
                that.busy = false;
                that.label = "";
                that.display(link.toLink());
                that.refresh();
            }).exceptionally(t => {
                console.log(t);
                that.busy = false;
                that.$toast.error(that.translate("FRIENDLINK.ERROR.CREATE"), {timeout: false});
            });
        },
        show(link) {
            let that = this;
            this.context.getFriendLinkString(link).thenApply(text => that.display(text));
        },
        display(text) {
            this.shownText = text;
            this.shownQr = peergos.shared.SecretLinkQRCode.generate(text).getBase64Thumbnail();
        },
        revoke(link) {
            let that = this;
            this.busy = true;
            this.context.revokeFriendLink(link).thenApply(x => {
                that.busy = false;
                that.shownText = null;
                that.shownQr = null;
                that.refresh();
            }).exceptionally(t => {
                console.log(t);
                that.busy = false;
                that.$toast.error(that.translate("FRIENDLINK.ERROR.REVOKE"), {timeout: false});
            });
        },
        describe(link) {
            let parts = [new Date(link.getCreatedMillis()).toLocaleDateString()];
            if (link.isUsedUp())
                parts.push(this.translate("FRIENDLINK.USED"));
            else if (link.uses == 0)
                parts.push(this.translate("FRIENDLINK.UNUSED"));
            else
                parts.push(link.uses == 1 ? this.translate("FRIENDLINK.USED.ONCE") :
                    this.translate("FRIENDLINK.USES").replace("$USES", "" + link.uses));
            if (link.getMaxUses() == 1 && ! link.isUsedUp())
                parts.push(this.translate("FRIENDLINK.SINGLE"));
            let expiry = link.getExpiryMillis();
            if (expiry > 0)
                parts.push(this.translate("FRIENDLINK.EXPIRES").replace("$DATE", new Date(expiry).toLocaleDateString()));
            return parts.join(" · ");
        },
        copy(text) {
            let that = this;
            navigator.clipboard.writeText(text).then(function() {
                that.$toast(that.translate("FRIENDLINK.COPIED"));
            }, function() {
                console.error("Unable to write to clipboard.");
            });
        },
        close() {
            this.$store.commit("SET_MODAL", false);
        }
    },
};
</script>

<style>
.friend-link__shown {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;
}

.friend-link__shown .qrcode-container {
	width: 100%;
	max-width: 240px;
	padding: 12px;
	background-color: #ffffff;
	border-radius: var(--radius-control);
}

.friend-link__shown .qrcode {
	display: block;
	width: 100%;
	height: auto;
}

.friend-link__text {
	width: 100%;
	font-family: monospace;
	font-size: var(--text-small);
	word-break: break-all;
}

/* the fields take the width, the switch and the action keep their own */
.friend-link__create {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 10px;
}

.friend-link__create .app-modal__field {
	align-self: stretch;
}

.friend-link__list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.friend-link__item {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 4px 12px;
}

.friend-link__name {
	font-weight: var(--bold);
}

.friend-link__meta {
	flex: 1 1 auto;
	color: var(--text-color);
	font-size: var(--text-small);
}

.friend-link__actions {
	display: flex;
	gap: 6px;
}
</style>
