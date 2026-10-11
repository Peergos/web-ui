<template>
	<article class="app-view address-book-view">
		<AppHeader>
			<template #primary>
				<h1>{{ translate("APPNAV.ADDRESSBOOK") }}</h1>
			</template>
		</AppHeader>
		<main>
			<p v-if="frameFailed" class="pg-note address-book-view__failed">{{ translate("ADDRESSBOOK.UNAVAILABLE") }}</p>
			<iframe id="address-book-iframe" :src="frameSrc" :title="translate('APPNAV.ADDRESSBOOK')"
				@load="ping()" frameBorder="0"></iframe>
			<AppPrompt
				v-if="showPrompt"
				v-on:hide-prompt="showPrompt = false"
				:message="prompt_message"
				:placeholder="prompt_placeholder"
				:value="prompt_value"
				:max_input_size="100"
				:consumer_func="prompt_consumer_func"/>
			<Confirm
				v-if="showConfirm"
				v-on:hide-confirm="confirmClosed()"
				:confirm_message="confirm_message"
				:confirm_body="confirm_body"
				:consumer_cancel_func="confirm_cancel_func"
				:consumer_func="confirm_consumer_func">
			</Confirm>
		</main>
	</article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const AppPrompt = require("../components/prompt/AppPrompt.vue");
const Confirm = require("../components/confirm/Confirm.vue");
const i18n = require("../i18n/index.js");
const contactsMixin = require("../mixins/contacts/index.js");

// Address Book runs on a subdomain of its own, as Calendar does, so the vCards it shows - which
// come from phones, CardDAV clients and imported files - never run in Peergos' own origin. The
// frame asks for everything it needs over postMessage: this view reads and writes the address
// books, and asks the questions (names, confirmations) in Peergos' own dialogs.
module.exports = {
	components: {
		AppHeader,
		AppPrompt,
		Confirm,
	},
	mixins: [i18n, contactsMixin],
	data: function() {
		return {
			// read once: rebinding it on a theme change would reload the app and lose whatever is
			// open in it, and the ping carries later changes
			frameSrc: null,
			// undone in beforeUnmount: the window outlives this view
			messageListener: null,
			// A server that doesn't serve the app's subdomain answers its page with a 404, which
			// would leave an empty frame and nothing to say why. The page says hello as it starts,
			// so a frame that hasn't by then is said to have failed - until it does.
			frameReady: false,
			frameFailed: false,
			readyTimer: null,
			showPrompt: false,
			prompt_message: '',
			prompt_placeholder: null,
			prompt_value: '',
			prompt_consumer_func: () => {},
			showConfirm: false,
			confirm_message: '',
			confirm_body: '',
			confirm_consumer_func: () => {},
			confirm_cancel_func: () => {},
		};
	},
	computed: {
		...Vuex.mapState([
			'context',
			'isDark',
		]),
		...Vuex.mapGetters([
			'currentTheme',
		]),
	},
	watch: {
		isDark() {
			this.post({type: 'setTheme', currentTheme: this.currentTheme});
		}
	},
	created() {
		this.frameSrc = this.frameUrl();
	},
	mounted() {
		document.body.style.overflow = 'hidden';
		this.startListener();
		this.readyTimer = setTimeout(() => {
			if (! this.frameReady)
				this.frameFailed = true;
		}, 20000);
	},
	beforeUnmount() {
		document.body.style.overflow = '';
		clearTimeout(this.readyTimer);
		if (this.messageListener != null) {
			window.removeEventListener('message', this.messageListener);
			this.messageListener = null;
		}
	},
	methods: {
		frameDomain() {
			return window.location.protocol + "//address-book." + window.location.host;
		},
		// the theme Peergos is in, so the first paint matches it whatever the device's own is
		frameUrl() {
			return this.frameDomain() + "/apps/address-book/index.html?theme=" + encodeURIComponent(this.currentTheme || "light");
		},
		frame() {
			return document.getElementById("address-book-iframe");
		},
		// Targeted at the frame's own origin: these messages carry the user's contacts.
		post(obj) {
			let frame = this.frame();
			if (frame != null && frame.contentWindow != null)
				frame.contentWindow.postMessage(obj, this.frameDomain());
		},
		ping() {
			this.post({type: 'ping', currentTheme: this.currentTheme});
		},
		startListener() {
			let that = this;
			// one handler per request; built without a prototype, so a message naming
			// "constructor" finds nothing to call
			let handlers = Object.assign(Object.create(null), {
				hello: () => {
					that.frameReady = true;
					that.frameFailed = false;
					that.ping();
				},
				listBooks: data => that.answer(data, async () => ({books: await that.listAddressBooks()})),
				loadBook: data => that.answer(data, () => that.loadBook(data)),
				saveCard: data => that.answer(data, () => that.saveCard(data)),
				deleteCard: data => that.answer(data, () => that.deleteCard(data)),
				newBook: data => that.answer(data, () => that.newBook()),
				renameBook: data => that.answer(data, () => that.renameBook(data)),
				deleteBook: data => that.answer(data, () => that.deleteBook(data)),
			});
			// Only the frame's own window, from its own origin, is listened to. Everything past
			// here is untrusted input and is checked before it reaches a path.
			this.messageListener = function(e) {
				let frame = that.frame();
				if (frame == null || e.source !== frame.contentWindow || e.origin !== that.frameDomain())
					return;
				let handler = e.data == null || typeof e.data !== 'object' ? null : handlers[e.data.type];
				if (handler != null)
					handler(e.data);
			};
			window.addEventListener('message', this.messageListener);
		},
		// Runs a request and posts its answer under the request's id; a failure answers too, so
		// the frame never waits on a request that went wrong.
		answer(data, work) {
			let that = this;
			let requestId = data.requestId;
			Promise.resolve().then(work).then(result => {
				that.post(Object.assign({type: 'answer', requestId: requestId}, result || {}));
			}).catch(e => {
				console.log(e && e.getMessage ? e.getMessage() : e);
				that.post({type: 'answer', requestId: requestId, error: true});
			});
		},
		checkBook(book) {
			if (typeof book != 'string' || ! this.isValidContactsSegment(book))
				throw new Error("Invalid address book");
		},
		checkCard(book, file) {
			this.checkBook(book);
			if (typeof file != 'string' || ! this.isValidContactsSegment(file) || ! file.endsWith('.vcf'))
				throw new Error("Invalid contact file");
		},
		async loadBook(data) {
			this.checkBook(data.book);
			let exists = await this.addressBookExists(data.book);
			return {cards: exists ? await this.listContactCards(data.book) : []};
		},
		async saveCard(data) {
			this.checkCard(data.book, data.file);
			if (typeof data.vcard != 'string' || ! /^BEGIN:VCARD/i.test(data.vcard.trim()))
				throw new Error("Not a vCard");
			await this.writeContactCard(data.book, data.file, data.vcard);
			return {saved: true};
		},
		// a delete the user asked for is confirmed first; one that is the second half of a move
		// is not
		async deleteCard(data) {
			this.checkCard(data.book, data.file);
			if (data.name != null && ! await this.confirm(this.named("ADDRESSBOOK.DELETE.CONTACT", data.name), ''))
				return {cancelled: true};
			if (await this.readContactCard(data.book, data.file) != null)
				await this.deleteContactCard(data.book, data.file);
			return {deleted: true};
		},
		async newBook() {
			let name = await this.prompt(this.translate("ADDRESSBOOK.NEW.BOOK"), this.translate("ADDRESSBOOK.BOOK.NAME"), '');
			if (name == null)
				return {cancelled: true};
			let book = this.newAddressBookId();
			await this.writeAddressBookName(book, name);
			return {book: book};
		},
		async renameBook(data) {
			this.checkBook(data.book);
			let name = await this.prompt(this.translate("ADDRESSBOOK.RENAME.BOOK"), this.translate("ADDRESSBOOK.BOOK.NAME"),
				typeof data.name == 'string' ? data.name : '');
			if (name == null)
				return {cancelled: true};
			await this.writeAddressBookName(data.book, name);
			return {name: name};
		},
		async deleteBook(data) {
			this.checkBook(data.book);
			// the bridge would only recreate it empty
			if (data.book == this.DEFAULT_ADDRESS_BOOK)
				throw new Error("The default address book can't be deleted");
			if (! await this.confirm(this.named("ADDRESSBOOK.DELETE.BOOK", data.name != null ? data.name : data.book), this.translate("ADDRESSBOOK.DELETE.BOOK.BODY")))
				return {cancelled: true};
			if (await this.addressBookExists(data.book))
				await this.deleteAddressBook(data.book);
			return {deleted: true};
		},
		// A message with a name in it. The name is the user's, and could hold a $& that replace
		// would otherwise read as a pattern.
		named(key, name) {
			return this.translate(key).replace("$NAME", () => String(name));
		},
		// A name, trimmed, or null if the prompt was dismissed or left empty.
		prompt(message, placeholder, value) {
			let that = this;
			// one at a time: a prompt still open is answered as dismissed
			this.prompt_consumer_func(null);
			return new Promise(resolve => {
				let settled = false;
				that.prompt_message = message;
				that.prompt_placeholder = placeholder;
				that.prompt_value = value;
				that.prompt_consumer_func = answer => {
					if (settled)
						return;
					settled = true;
					let name = answer == null ? '' : answer.trim();
					resolve(name.length > 0 ? name : null);
				};
				that.showPrompt = true;
			});
		},
		// Yes or no, answered once.
		confirm(message, body) {
			let that = this;
			this.confirm_cancel_func();
			return new Promise(resolve => {
				let settled = false;
				let settle = answer => {
					if (! settled) {
						settled = true;
						resolve(answer);
					}
				};
				that.confirm_message = message;
				that.confirm_body = body;
				that.confirm_consumer_func = () => settle(true);
				that.confirm_cancel_func = () => settle(false);
				that.showConfirm = true;
			});
		},
		// Closing the dialog by its close button or a click beside it answers no, as Confirm
		// calls neither of its functions then. Its own Yes and No close it first and only then
		// call theirs, so the no waits until they have had their turn.
		confirmClosed() {
			this.showConfirm = false;
			setTimeout(this.confirm_cancel_func);
		},
	},
};
</script>

<style>
.address-book-view {
	display: grid;
	grid-template-rows: auto 1fr;
	height: 100vh;
	overflow: hidden;
}
.address-book-view main {
	overflow: hidden;
	min-height: 0;
	display: flex;
	flex-direction: column;
}
.address-book-view__failed {
	margin: 16px var(--app-margin);
}
.address-book-view iframe {
	width: 100%;
	flex: 1;
	min-height: 0;
}
</style>
