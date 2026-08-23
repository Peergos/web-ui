<template>
	<article class="app-view pg-view">
		<AppHeader>
			<template #primary>
				<h1>{{ translate("SYNC.TITLE") }}</h1>
			</template>
		</AppHeader>
		<main>

			<section v-if="! enabled" class="pg-unavailable">
				<h2>{{ translate("SYNC.DISABLED.TITLE") }}</h2>
				<p>{{ translate("SYNC.DISABLED") }}</p>
				<p><a href="https://peergos.org/download" target="_blank" rel="noopener">https://peergos.org/download</a></p>
				<p>{{ translate("SYNC.DISABLED2") }}</p>
			</section>

			<template v-else>

				<!-- Aggregate state: the single thing you came to find out -->

		<section class="pg-summary" :class="'pg-tone--' + tone">
					<span class="pg-summary__icon" aria-hidden="true">
						<svg v-if="tone === 'ok'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
						<svg v-else-if="tone === 'busy'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
						<svg v-else-if="tone === 'paused'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>
						<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/></svg>
					</span>
					<div class="pg-summary__text">
						<h2>{{ summaryHeadline }}</h2>
					</div>
					<div class="pg-summary__actions">
						<button v-if="paused" type="button" class="pg-btn pg-btn--resume" @click="syncNow()">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>
							{{ translate("SYNC.RESUME") }}
						</button>
						<template v-else-if="syncPairs.length > 0">
							<button type="button" class="pg-btn pg-btn--onTone" :disabled="syncBusy"
									:title="syncBusy ? translate('SYNC.NOW.BUSY') : ''" @click="syncNow()">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
								{{ translate("SYNC.NOW") }}
							</button>
							<button type="button" class="pg-btn pg-btn--pause" @click="pauseSync()">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>
								{{ translate("SYNC.PAUSE") }}
							</button>
						</template>
						<button type="button" class="pg-btn pg-btn--primary" @click="addSyncPair()">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
							{{ translate("SYNC.ADDPAIR") }}
						</button>
					</div>
				</section>

				<!-- the banner turns red on a problem no folder owns, so say what it was -->
				<p v-if="globalError" class="pg-errorbox">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>
					<span>{{ globalError }}</span>
				</p>

				<!-- First run -->
				<section v-if="syncPairs.length === 0" class="pg-empty">
					<span class="pg-empty__mark" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8"/></svg>
					</span>
					<h2>{{ translate("SYNC.EMPTY.TITLE") }}</h2>
					<p>{{ translate("SYNC.EMPTY.BODY") }}</p>
					<button type="button" class="pg-btn pg-btn--primary" @click="addSyncPair()">
						{{ translate("SYNC.ADDPAIR") }}
					</button>
				</section>

				<template v-else>
					<div class="pg-sectionhead">
						<h2>{{ translate("SYNC.FOLDERS") }}</h2>
						<span>{{ syncPairs.length }}</span>
					</div>

					<ul class="pg-cards">
						<li v-for="pair in syncPairs" :key="pair.label"
							class="pg-card" :class="{ 'pg-card--error': stateOf(pair) === 'ERROR' }">

							<div class="pg-card__head">
								<div class="pg-route">
									<div class="pg-endpoint">
										<span class="pg-endpoint__icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
										</span>
										<span class="pg-endpoint__text">
											<span class="pg-endpoint__label">{{ translate("SYNC.THISDEVICE") }}</span>
											<span class="pg-endpoint__value" :class="{ 'pg-endpoint__value--open': expanded[pair.label + ':local'] }"
												:title="prettifyHostFolder(pair.localpath)" @click="toggleExpand(pair.label + ':local')">
												<span class="pg-path__head">{{ pathHead(prettifyHostFolder(pair.localpath)) }}</span
												><span class="pg-path__tail">{{ pathTail(prettifyHostFolder(pair.localpath)) }}</span>
											</span>
										</span>
									</div>
									<span class="pg-route__arrow" aria-hidden="true">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8"/></svg>
									</span>
									<div class="pg-endpoint">
										<span class="pg-endpoint__icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.1 11.1 3.5 3.5 0 0 0 6.5 19Z"/></svg>
										</span>
										<span class="pg-endpoint__text">
											<span class="pg-endpoint__label">{{ translate("SYNC.DRIVE") }}</span>
											<a class="pg-endpoint__value pg-endpoint__value--link" :title="pair.remotepath"
												href="#" @click.prevent="navigateTo(pair.remotepath)"
												><span class="pg-path__head">{{ pathHead(pair.remotepath) }}</span
												><span class="pg-path__tail">{{ pathTail(pair.remotepath) }}</span></a>
										</span>
									</div>
								</div>

								<span class="pg-pill" :class="'pg-tone--' + toneOf(pair)">
									<span class="pg-pill__dot" aria-hidden="true"></span>{{ stateLabel(stateOf(pair)) }}
								</span>
							</div>

							<p v-if="pair.error && ! wasStopped(pair.error)" class="pg-errorbox">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/></svg>
								<span class="pg-clamp" :class="{ 'pg-clamp--open': expanded[pair.label + ':err'] }"
									@click="toggleExpand(pair.label + ':err')">{{ cleanError(pair.error) }}</span>
							</p>
							<div v-else-if="activityOf(pair)" class="pg-activityrow">
								<p class="pg-activity pg-clamp" :class="{ 'pg-clamp--open': expanded[pair.label + ':act'] }"
									:title="activityOf(pair, true)" @click="toggleExpand(pair.label + ':act')">{{ activityOf(pair, expanded[pair.label + ':act']) }}</p>
								<span v-if="progressOf(pair)" class="pg-pct">{{ progressOf(pair).pct }}%</span>
							</div>

							<template v-if="stateOf(pair) === 'SYNCING'">
								<!-- determinate only when the status message reports totals -->
								<div v-if="progressOf(pair)" class="pg-bar pg-bar--determinate" role="progressbar"
									:aria-valuenow="progressOf(pair).pct" aria-valuemin="0" aria-valuemax="100"
									:aria-label="translate('SYNC.STATE.SYNCING')">
									<span :style="{ width: progressOf(pair).pct + '%' }"></span>
								</div>
								<div v-else class="pg-bar" role="progressbar" :aria-label="translate('SYNC.STATE.SYNCING')"><span></span></div>
							</template>

							<div class="pg-card__foot">
								<div class="pg-chips">
									<span class="pg-chip" :class="{ 'pg-chip--on': pair.syncLocalDeletes }">
										<svg v-if="pair.syncLocalDeletes" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
										<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
										{{ pair.syncLocalDeletes ? translate("SYNC.DELETES.LOCAL.ON") : translate("SYNC.DELETES.LOCAL.OFF") }}
									</span>
									<span class="pg-chip" :class="{ 'pg-chip--on': pair.syncRemoteDeletes }">
										<svg v-if="pair.syncRemoteDeletes" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
										<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
										{{ pair.syncRemoteDeletes ? translate("SYNC.DELETES.REMOTE.ON") : translate("SYNC.DELETES.REMOTE.OFF") }}
									</span>
									<label v-if="isAndroid" class="pg-switch">
										<input type="checkbox" :checked="pair.allowOnMobile"
											@change="setAllowOnMobile(pair, $event.target.checked)" />
										<span class="pg-switch__track" aria-hidden="true"></span>
										<span>{{ translate("SYNC.MOBILEDATA") }}</span>
									</label>
								</div>

								<div class="pg-card__actions">
									<button type="button" class="pg-btn pg-btn--quiet" @click="downloadLog(pair.label)">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M4 19h16"/></svg>
										{{ translate("SYNC.LOG") }}
									</button>
									<button type="button" class="pg-btn pg-btn--danger" @click="confirmRemove(pair)">
										{{ translate("SYNC.STOPPAIR") }}
									</button>
								</div>
							</div>
						</li>
					</ul>
				</template>
			</template>

			<FolderPicker
				v-if="showFolderPicker"
				:baseFolder="folderPickerBaseFolder" :selectedFolder_func="selectedFoldersFromPicker"
				:multipleFolderSelection="multipleFolderSelection"
				:initiallySelectedPaths="initiallySelectedPaths"
				:noDriveSelection="true"
				:pickerTitle="pickerTitle">
			</FolderPicker>

			<SimpleFolderPicker
				v-if="showSimpleFolderPicker"
				:drives="drivesSimplePicker"
				:selectedFolder_func="selectedFoldersFromSimplePicker"
				:preloadFolders_func="preloadHostFolders"
				:multipleFolderSelection="multipleFolderSelectionSimplePicker"
				:pickerTitle="simplePickerTitle">
			</SimpleFolderPicker>

			<Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>

			<Select
				v-if="showSelect"
				v-on:hide-select="showSelect = false"
				:select_message="select_message"
				:select_body="select_body"
				:select_consumer_func="select_consumer_func"
				:select_options="select_options">
			</Select>

			<Confirm
				v-if="showConfirm"
				v-on:hide-confirm="showConfirm = false"
				:confirm_message="confirm_message"
				:confirm_body="confirm_body"
				:consumer_func="confirm_func"
				:consumer_cancel_func="confirm_cancel_func">
			</Confirm>
		</main>
	</article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const paths = require("../mixins/paths/index.js");
const errors = require("../mixins/errors/index.js");
const localServer = require("../mixins/localserver/index.js");
const FolderPicker = require('../components/picker/FolderPicker.vue');
const Select = require('../components/choice/Select.vue');
const Confirm = require('../components/confirm/Confirm.vue');

const SimpleFolderPicker = require('../components/picker/SimpleFolderPicker.vue');
const Spinner = require("../components/spinner/Spinner.vue");

const i18n = require("../i18n/index.js");
const loopback = require("../mixins/loopback/index.js");
const routerMixins = require("../mixins/router/index.js");
const network = require("../mixins/network/index.js");

// Every line the server logs about a file is "<action> <path>[ <trailer>]", and the
// action also says which side the path is on.
const SYNC_ACTIONS = [
	"Sync Local: Copying changes to ",
	"Sync Local: Copying ",
	"Sync Local: Moving ",
	"Sync Local: Set mod time ",
	"Sync Local: deleted, copying changed remote ",
	"Sync Local: delete ",
	"Sync local: delete dir ",
	"Sync Local: mkdir ",
	"Sync Remote: Concurrent change: ",
	"Sync Remote: Concurrent file addition: ",
	"Sync Remote: Copying changes to ",
	"Sync Remote: Copying ",
	"Sync Remote: Moving ",
	"Sync Remote: Set mod time ",
	"Sync Remote: deleted, copying changed local ",
	"Sync Remote: delete dir ",
	"Sync Remote: delete ",
	"Sync Remote: mkdir ",
	"Sync Concurrent delete on ",
	"Sync ignore local delete ",
	"Sync ignore remote delete ",
	"Skipping identical remote file in initial sync: ",
	"REMOTE: Uploading ",
	"REMOTE: Updating ",
	"REMOTE: deleted ",
	"Remote: Set mod time ",
	" MiB of ",
];
// longest action first, so "Copying changes to" is not read as "Copying" plus a path;
// the trailer is progress, a second path, or the reason for a rename
const ACTION_PATH = new RegExp("^([\\s\\S]*?(?:"
	+ SYNC_ACTIONS.slice()
		.sort((a, b) => b.length - a.length)
		.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join("|")
	+ "))([\\s\\S]+?)"
	+ "((?: renaming[\\s\\S]*)?(?:, Synced:[\\s\\S]*)?(?: \\(\\d+/\\d+\\) files synced)?)$");

module.exports = {
	components: {
		AppHeader,
		FolderPicker,
		Select,
		Confirm,
		SimpleFolderPicker,
		Spinner,
	},
	data() {
		return {
			syncPairs: [],
			showSimpleFolderPicker: false,
			drivesSimplePicker: [],
			multipleFolderSelectionSimplePicker: false,
			showFolderPicker: false,
			folderPickerBaseFolder: "",
			multipleFolderSelection: false,
			initiallySelectedPaths: [],
			hostFolderTree: {},
			useHostDirChooser: false,
			pickerTitle: "Remote Folder (create in Drive first)",
			simplePickerTitle: "Local Folder",
			showSpinner: false,
			spinnerMessage: '',
			showSelect: false,
			select_message: '',
			select_body: '',
			select_consumer_func: () => {},
			select_options: [],
			showConfirm: false,
			confirm_message: '',
			confirm_body: '',
			confirm_func: () => {},
			confirm_cancel_func: () => {},
			status: "",
			globalState: "NONE",
			paused: false,
			expanded: {},
			syncPending: false,
			syncPendingTimeoutID: null,
			// when a poll last succeeded, to tell a resume this view watched happen
			// from one it only learned about afterwards
			lastStatusAt: 0,
			// after a reconnection, until a pass reports something new: the last result was
			// reached from cache while offline, so it cannot be shown as up to date
			awaitingPass: false,
			statusAtReconnect: null,
			fastPollIntervalID: null,
			fastPollTimeoutID: null,
			updateStatusIntervalID: "",
			error: null,
		}
	},
	props: [],
	mixins: [routerMixins, i18n, localServer, paths, errors, network],

	computed: {
		...Vuex.mapState([
			'context',
		]),
		...Vuex.mapGetters([
			'getPath'
		]),
		enabled() {
			return loopback.isLoopbackHost(window.location.hostname);
		},
		isAndroid() {
			return navigator.userAgent.toLowerCase().indexOf("android") > -1;
		},
		// which folder the pass is working on
		syncingIndex() {
			for (let i = 0; i < this.syncPairs.length; i++) {
				if (this.syncPairs[i].state === "SYNCING")
					return i;
			}
			return -1;
		},
		counts() {
			let res = { SYNCED: 0, SYNCING: 0, ERROR: 0, PENDING: 0 };
			for (let i = 0; i < this.syncPairs.length; i++) {
				let s = this.stateOf(this.syncPairs[i]);
				if (res[s] != null)
					res[s]++;
			}
			return res;
		},
		// the server aggregates, but fall back to pair states if it is silent
		/** The failure no folder owns. Hidden as soon as any folder is reporting one of its
		 *  own, so the cause is always stated somewhere, and never twice. */
		globalError() {
			// offline, a failure is the missing connection restated in java's words
			if (this.offline || ! this.error || this.wasStopped(this.error))
				return null;
			// a folder reporting a failure of its own says it on its own card, so the
			// banner stays out of the way rather than repeating it
			for (let pair of this.syncPairs) {
				if (pair.error && ! this.wasStopped(pair.error))
					return null;
			}
			return this.cleanError(this.error);
		},
		tone() {
			// an error outlives a pause, as SyncStatus.aggregate decides on the server: it is
			// something the user has to act on, and the pause is already shown by the button.
			// It outranks the queued states below whether or not a folder owns it.
			if (this.counts.ERROR > 0 || this.globalError != null)
				return "error";
			if (this.paused)
				return "paused";
			// nothing was checked against the server, so this is not a settled state
			if (this.offline || this.awaitingPass)
				return "pending";
			// a folder yet to be reached is work outstanding, so the banner stays
			// busy rather than claiming everything is settled
			if (this.syncPending || this.counts.PENDING > 0)
				return "busy";
			if (this.error && this.wasStopped(this.error))
				return this.counts.SYNCING > 0 ? "busy" : "ok";
			let state = this.globalState;
			if (state == null || state === "NONE")
				state = this.counts.SYNCING > 0 ? "SYNCING" : "SYNCED";
			return this.toneOfState(state);
		},
		summaryHeadline() {
			if (this.tone === 'paused')
				return this.translate("SYNC.SUMMARY.PAUSED.TITLE");
			if (this.syncPairs.length === 0)
				return this.translate("SYNC.SUMMARY.NONE");
			if (this.tone === 'error') {
				if (this.counts.ERROR === 0)
					return this.translate("SYNC.SUMMARY.ERROR.GLOBAL");
				return this.counts.ERROR === 1 ? this.translate("SYNC.SUMMARY.ERROR.ONE")
					: this.fmt("SYNC.SUMMARY.ERROR.MANY", this.counts.ERROR);
			}
			if (this.offline)
				return this.translate("SYNC.SUMMARY.OFFLINE");
			if (this.awaitingPass)
				return this.translate("SYNC.STATE.PENDING");
			if (this.tone === 'busy')
				return this.syncPairs.length === 1 ?
					this.translate("SYNC.SUMMARY.SYNCING.ONE") :
					// which folder the pass is on, so the count climbs rather than counts down
					this.fmt2("SYNC.SUMMARY.SYNCING", Math.max(this.syncingIndex + 1, 1), this.syncPairs.length);
			return this.translate("SYNC.SUMMARY.OK");
		},
		// disabled from the click until the run we asked for has finished
		syncing() {
			return this.globalState === "SYNCING" || this.counts.SYNCING > 0;
		},
		syncBusy() {
			return this.syncPending || this.syncing;
		},
	},
	watch: {
		// the scheduler owns when a pass runs; this only holds the display back until
		// one has reported since the connection returned
		offline(now, before) {
			if (before && ! now && this.syncPairs.length > 0) {
				this.awaitingPass = true;
				this.statusAtReconnect = this.status;
			}
		},
	},
	created() {
		this.getSyncState();
		this.getWhichChooser();
		this.updateStatus();
		let that = this;
		this.updateStatusIntervalID = setInterval(() => {
			that.updateStatus();
		}, 1000);
	},
	destroyed() {
		clearInterval(this.updateStatusIntervalID);
		clearTimeout(this.syncPendingTimeoutID);
		this.stopFastPoll();
	},
	methods: {
		...Vuex.mapActions([
			'updateSocial'
		]),

		/* ---------- small helpers ---------- */

		completed(value) {
			let future = peergos.shared.util.Futures.incomplete();
			future.complete(value);
			return future;
		},
		// server errors arrive as raw java throwable strings; show the message only
		// a run the user stopped is not a failure, so it is not shown as an error
		wasStopped(msg) {
			if (msg == null)
				return false;
			return /cancelled|canceled|InterruptedException/i.test("" + msg);
		},

		// the message carries totals for long operations, so show real progress
		progressOf(pair) {
			let msg = pair.msg;
			if (msg == null)
				return null;
			// whole pass: the server reports this for multi file work
			let files = /\((\d+)\s*\/\s*(\d+)\)\s*files synced/.exec(msg);
			if (files != null && Number(files[2]) > 0)
				return { pct: Math.min(100, Math.round(Number(files[1]) * 100 / Number(files[2]))) };
			// single file: the only figure available while one large file transfers
			let bytes = /([\d.]+)\s*\/\s*([\d.]+)\s*(KiB|MiB|GiB)/.exec(msg);
			if (bytes != null && Number(bytes[2]) > 0)
				return { pct: Math.min(100, Math.round(Number(bytes[1]) * 100 / Number(bytes[2]))) };
			return null;
		},

		fmt(key, n) {
			return this.translate(key).replace("{n}", n);
		},
		fmt2(key, n, m) {
			return this.translate(key).replace("{n}", n).replace("{m}", m);
		},
		// the leaf identifies the folder, so keep it and let the parents truncate
		/** windows paths arrive with backslashes, so the leaf is after whichever comes last */
		// title tooltips never fire on touch, so the full value needs a tap as well
		toggleExpand(key) {
			Vue.set(this.expanded, key, ! this.expanded[key]);
		},
		stateOf(pair) {
			if (pair.error && ! this.wasStopped(pair.error))
				return "ERROR";
			if (this.paused)
				return "PAUSED";
			// offline: this folder was not checked against the Drive, so it is queued,
			// not settled. The cause is the device, so the banner names it once
			if (this.offline || this.awaitingPass)
				return "PENDING";
			if (this.syncPending)
				return "PENDING";
			if (pair.state === "SYNCING")
				return "SYNCING";
			// queued, so it cannot claim to be up to date: either no pass has ever
			// reached it, or this one takes the folders in order and has not got here
			// yet, leaving a result from the previous pass on show
			if (! pair.msg || (this.syncingIndex >= 0 && this.syncPairs.indexOf(pair) > this.syncingIndex))
				return "PENDING";
			return pair.state != null ? pair.state : "SYNCED";
		},
		toneOfState(state) {
			if (state === "ERROR") return "error";
			if (state === "SYNCING") return "busy";
			if (state === "PAUSED") return "paused";
			if (state === "PENDING") return "pending";
			return "ok";
		},
		toneOf(pair) {
			return this.toneOfState(this.stateOf(pair));
		},
		stateLabel(state) {
			if (state === "ERROR") return this.translate("SYNC.STATE.ERROR");
			if (state === "SYNCING") return this.translate("SYNC.STATE.SYNCING");
			if (state === "PAUSED") return this.translate("SYNC.STATE.PAUSED");
			if (state === "PENDING") return this.translate("SYNC.STATE.PENDING");
			return this.translate("SYNC.STATE.SYNCED");
		},
		/** The server appends " at <date> <time>", which the folder line does not show.
		 *  LocalTime.toString() drops ":ss" when seconds are zero, hence the optional group. */
		withoutTime(msg) {
			if (msg == null || msg.length === 0)
				return '';
			let m = /^([\s\S]*) at \d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.exec(msg);
			return m == null ? msg : m[1];
		},
		// the server names files by their path within the synced folder, which is the same
		// on both sides. The line shows the leaf; absolute gives the whole path, on the side
		// the action names, for the title and the opened form.
		/** The server canonicalises relative paths to "/" even on windows, but the local root
		 *  keeps the platform's own separator, so joining the two blindly mixes them. */

		activityOf(pair, absolute) {
			return this.withoutTime(pair.msg).replace(ACTION_PATH, (all, action, path, trailer) => {
				// the first side word names where the path is: "Sync Local: deleted,
				// copying changed remote x" writes x on this device
				let side = /local|remote/i.exec(action);
				let root = side != null && side[0].toLowerCase() === "remote" ?
					pair.remotepath :
					this.prettifyHostFolder(pair.localpath);
				return action + path.split(" ==> ")
					.map(p => absolute ? this.joinPath(root, p) : p.substring(p.lastIndexOf('/') + 1))
					.join(" ==> ") + trailer;
			});
		},

		/* ---------- server calls ---------- */


		getWhichChooser() {
			let that = this;
			this.localPost("/peergos/v0/sync/use-host-dir-chooser").then(function(result, err) {
				that.useHostDirChooser = result;
			})
		},

		getSyncState() {
			let that = this;
			this.localPost("/peergos/v0/sync/get-pairs").then(function(result, err) {
				if (result == null || result.pairs == null)
					return;
				// keep the live status already merged onto the previous objects
				let previous = {};
				for (let i = 0; i < that.syncPairs.length; i++)
					previous[that.syncPairs[i].label] = that.syncPairs[i];
				let merged = [];
				for (let i = 0; i < result.pairs.length; i++) {
					let p = result.pairs[i];
					let old = previous[p.label];
					if (old != null) {
						p.msg = old.msg;
						p.state = old.state;
						p.error = old.error;
					}
					merged.push(p);
				}
				that.syncPairs = merged;
			})
		},

		updateStatus() {
			let that = this;
			if (! loopback.isLoopbackHost(window.location.hostname))
				return;
			// no point polling a backgrounded webview
			if (typeof document !== 'undefined' && document.hidden)
				return;
			this.localPost("/peergos/v0/sync/status").then(function(result, err) {
				if (result == null)
					return;
				// any new report means a pass has run; one that started just before the
				// reconnection clears it a pass early, which is a second either way
				if (that.awaitingPass && result.msg !== that.statusAtReconnect) {
					that.awaitingPass = false;
					that.statusAtReconnect = null;
				}
				that.status = result.msg;
				// a pass that could not run reports itself through the state and the message,
				// with no error of its own: on android that is a pass held back on mobile data.
				// The trailing timestamp belongs to a status line rather than to a failure.
				that.error = result.error != null ? result.error
					: (result.state === "ERROR"
						? String(result.msg || "").replace(/ at \d{4}-\d\d-\d\d \d\d:\d\d(:\d\d)?$/, "")
						: null);
				that.globalState = result.state != null ? result.state : "NONE";
				let wasPaused = that.paused;
				// polling stops while the window is hidden, so a stale reading means the resume
				// happened out of sight and the pass it starts has already run: standing in for
				// it would sit on "waiting" until the next pass, half a minute away
				let watched = Date.now() - that.lastStatusAt < 3000;
				that.paused = result.paused === true;
				// a resume from anywhere - this tab, another client, the phone - leaves the
				// pair reporting its pre pause state until the pass starts a moment later
				if (wasPaused && ! that.paused && watched)
					that.standInForPass();
				// stand in until the server itself reports the pass. Must read the reply,
				// not this.syncing: syncPending makes stateOf report SYNCING, so it would
				// clear itself on the first poll.
				if (that.syncPending && (result.state === "SYNCING"
						|| (result.pairs || []).some(p => p.state === "SYNCING"))) {
					clearTimeout(that.syncPendingTimeoutID);
					that.syncPending = false;
				}
				let perPair = {};
				if (result.pairs) {
					for (let p of result.pairs)
						perPair[p.label] = p;
				}
				for (let i = 0; i < that.syncPairs.length; i++) {
					let p = that.syncPairs[i];
					let s = perPair[p.label];
					// a pair being removed loses its status: leave the card reporting what
					// it last did rather than flicking to "waiting" on its way out
					if (s == null || (! s.msg && p.msg))
						continue;
					Vue.set(p, 'msg', s.msg);
					Vue.set(p, 'state', s.state ? s.state : 'SYNCED');
					Vue.set(p, 'error', s.error);
				}
				that.lastStatusAt = Date.now();
			}).catch(function(e) {
				// the local server going away is expected on shutdown; don't spam toasts
			})
		},

		prettifyHostFolder(uri) {
			if (! uri.startsWith("content://") && ! uri.startsWith("//"))
				return uri;
			// e.g. content://com.android.externalstorage.documents/tree/primary%3ADocuments
			// e.g. //com.android.externalstorage.documents/tree/primary%3ADocuments
			// or an sdcard e,g /tree/3DE6-6834%3Atestdir
			var res = new URL(uri);
			var path = res.pathname;
			path = path.replaceAll("%2F", "/").replaceAll("%3A", ":")
			const prefix = "/tree/primary:"
			if (path.startsWith(prefix))
				return path.substring(prefix.length);
			if (new RegExp("/tree/[A-Z0-9]{4}-[A-Z0-9]{4}:.*").test(path))
				return "/sdcard/" + path.substring(16);
			return path;
		},

		getHostDirTree(prefix) {
			let future = peergos.shared.util.Futures.incomplete();
			prefix = prefix != null ? encodeURIComponent(prefix) : "%2F";
			this.localPost("/peergos/v0/sync/get-host-paths?prefix=" + prefix).then(function(result, err) {
				future.complete(result);
			});
			return future;
		},

		openNativeHostDirChooser() {
			let future = peergos.shared.util.Futures.incomplete();
			let that = this;
			this.localPost("/peergos/v0/sync/get-host-dir").then(function(result) {
				// an empty root means the picker was closed without choosing a folder
				future.complete(result.root == null || result.root.length == 0 ? null : result.root);
			}).catch(function(err) {
				that.$toast.error(that.errText(err), {});
				future.complete(null);
			})
			return future;
		},

		getHostDir() {
			let isAndroid = navigator.userAgent.indexOf("android") > -1;
			if (isAndroid || this.useHostDirChooser)
				return this.openNativeHostDirChooser();
			return this.openHostFolderPicker();
		},

		getPeergosDir() {
			return this.openPeergosFolderPicker();
		},

		getDeleteBehaviour() {
			let future = peergos.shared.util.Futures.incomplete();
			let that = this;
			this.select_message = this.translate("SYNC.SELECT.DELETION.BEHAVIOUR");
			this.select_body = '';
			let syncLocalDeletesLabel = this.translate("SYNC.SELECT.DELETION.LOCAL");
			let syncRemoteDeletesLabel = this.translate("SYNC.SELECT.DELETION.REMOTE");
			this.select_consumer_func = (picked) => {
				let syncLocalDeletes = picked.indexOf(syncLocalDeletesLabel) > -1;
				let syncRemoteDeletes = picked.indexOf(syncRemoteDeletesLabel) > -1;
				future.complete({ syncLocalDeletes: syncLocalDeletes, syncRemoteDeletes: syncRemoteDeletes });
			};
			this.select_options = [syncLocalDeletesLabel, syncRemoteDeletesLabel];
			this.showSelect = true;
			return future;
		},

		addSyncPair() {
			const that = this;
			this.getHostDir().thenCompose(hostDir => {
				if (hostDir == null)
					return that.completed(null);
				return that.getPeergosDir().thenCompose(peergosDir => {
					if (peergosDir == null)
						return that.completed(null);
					if (peergosDir.substring(1).split("/").length < 2) {
						// reporting beats throwing across the java boundary
						that.$toast.error(that.translate("SYNC.ERROR.HOMEDIR"), {});
						return that.completed(null);
					}
					return that.getDeleteBehaviour().thenCompose(deleteSelection => {
						const syncLocalDeletes = deleteSelection.syncLocalDeletes;
						const syncRemoteDeletes = deleteSelection.syncRemoteDeletes;
						that.$toast(that.translate("SYNC.ADDING"), { id: "syncadd" });
						const peergosPath = peergos.client.PathUtils.directoryToPath(peergosDir.substring(1).split("/"));
						return that.context.shareWriteAccessWith(peergosPath, peergos.client.JsUtil.asSet([])).thenCompose(done => {
							return that.context.createSecretLink(peergosDir, true, java.util.Optional.empty(), "", "", false);
						}).thenCompose(link => {
							const cap = link.toLinkString(that.context.signer.publicKeyHash)
							const label = cap.substring(cap.lastIndexOf("/", cap.indexOf("#")) + 1, cap.indexOf("#"))
							// localPost returns a native Promise; thenCompose requires the java
							// future type, so bridge rather than returning the Promise
							let added = peergos.shared.util.Futures.incomplete();
							that.localPost("/peergos/v0/sync/add-pair?label=" + label,
								JSON.stringify({ link: cap, dir: hostDir, syncLocalDeletes: syncLocalDeletes, syncRemoteDeletes: syncRemoteDeletes }))
								.then(function(result) {
									that.syncPairs.push({
										localpath: hostDir, remotepath: peergosDir.toString(), label: label,
										syncLocalDeletes: syncLocalDeletes, syncRemoteDeletes: syncRemoteDeletes,
										allowOnMobile: false, state: 'SYNCING', msg: '', error: null
									});
									// pick up the authoritative remote path the server resolved
									that.getSyncState();
									added.complete(true);
								})
								.catch(function(err) {
									that.$toast.error(that.errText(err), {});
									added.complete(false);
								});
							return added;
						});
					});
				});
			}).exceptionally(t => {
				that.$toast.error(that.errText(t), {});
				return null;
			});
		},

		setAllowOnMobile(pair, allow) {
			const previous = pair.allowOnMobile;
			// optimistic; reverted on failure so the control tracks server state
			Vue.set(pair, 'allowOnMobile', allow);
			this.localPost("/peergos/v0/sync/set-allow-mobile?label=" + pair.label + "&allow=" + allow)
				.then(() => {
					// the worker reads this flag when a pass starts, so a change made
					// during one applies to the next
					this.$toast(this.translate(allow ? "SYNC.MOBILEDATA.ON" : "SYNC.MOBILEDATA.OFF"));
				})
				.catch((err) => {
					Vue.set(pair, 'allowOnMobile', previous);
					this.$toast.error(this.translate("SYNC.ERROR.SETTING") + " " + this.errText(err), {});
				});
		},

		// sync-now applies to every pair, not one
		syncNow() {
			// guards a double click only. While paused the click is a deliberate resume,
			// and the aborting pass can still report SYNCING, which would swallow it.
			if (this.syncBusy && ! this.paused)
				return;
			let that = this;
			this.standInForPass();
			this.pollFaster(6000);
			this.localPost("/peergos/v0/sync/sync-now").then(function(result, err) {
				that.$toast(that.translate("SYNC.STARTED"));
			}).catch(function(err) {
				that.syncPending = false;
				that.$toast.error(that.errText(err), {});
			})
		},

		/** Reports the pass we asked for until the server does, then gives up: a pass can
		 *  finish inside the gap between two polls, so seeing it reported is not something
		 *  the view can wait on. Kept short because syncBusy gates the button. */
		standInForPass() {
			let that = this;
			this.syncPending = true;
			clearTimeout(this.syncPendingTimeoutID);
			this.syncPendingTimeoutID = setTimeout(() => { that.syncPending = false; }, 3000);
		},

		pauseSync() {
			let that = this;
			this.syncPending = false;
			clearTimeout(this.syncPendingTimeoutID);
			this.localPost("/peergos/v0/sync/pause").then(function(result, err) {
				that.paused = true;
				that.$toast(that.translate("SYNC.PAUSED"));
				that.pollFaster(4000);
			}).catch(function(err) {
				that.$toast.error(that.errText(err), {});
			})
		},

		// poll faster briefly so a short SYNCING window is actually observed
		pollFaster(durationMs) {
			let that = this;
			this.stopFastPoll();
			this.fastPollIntervalID = setInterval(() => {
				that.updateStatus();
			}, 250);
			this.fastPollTimeoutID = setTimeout(() => { that.stopFastPoll(); }, durationMs);
		},

		stopFastPoll() {
			clearInterval(this.fastPollIntervalID);
			clearTimeout(this.fastPollTimeoutID);
			this.fastPollIntervalID = null;
			this.fastPollTimeoutID = null;
		},

		downloadLog(label) {
			if (typeof Android !== 'undefined' && Android && typeof Android.downloadSyncLog === 'function') {
				Android.downloadSyncLog(label);
				return;
			}
			let that = this;
			// the sync api is POST only, so fetch the log and save the response: navigating
			// to it is a GET, which the server refuses
			this.localPost("/peergos/v0/sync/get-log?label=" + encodeURIComponent(label), null, 'blob')
				.then(function(blob) {
					let url = window.URL.createObjectURL(blob);
					let a = document.createElement('a');
					a.href = url;
					a.download = "sync-" + label + ".log";
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					setTimeout(() => window.URL.revokeObjectURL(url), 0);
				}).catch(function(err) {
					that.$toast.error(that.errText(err), {});
				});
		},

		confirmRemove(pair) {
			let that = this;
			this.confirm_message = this.translate("SYNC.STOPPAIR.CONFIRM");
			this.confirm_body = this.fmt("SYNC.STOPPAIR.BODY", this.prettifyHostFolder(pair.localpath));
			this.confirm_func = () => { that.removeSyncPair(pair.label); };
			this.confirm_cancel_func = () => {};
			this.showConfirm = true;
		},

		removeSyncPair(label) {
			let that = this;
			// a removal that already happened answers with an error, so reload from the
			// server either way rather than report a failure for a pair that has gone
			this.localPost("/peergos/v0/sync/remove-pair?label=" + label)
				.catch(() => {})
				.then(() => that.getSyncState());
		},

		openPeergosFolderPicker() {
			let future = peergos.shared.util.Futures.incomplete();
			let that = this;
			this.folderPickerBaseFolder = "/" + this.context.username;
			this.selectedFoldersFromPicker = function (chosenFolders) {
				if (chosenFolders.length == 0) {
					future.complete(null);
				} else {
					let selectedFolder = chosenFolders[0];
					future.complete(selectedFolder);
				}
				that.showFolderPicker = false;
			};
			this.showFolderPicker = true;
			return future;
		},

		setInitialState(state) {
			state.initiallyOpen = state.children.length == 1;
			if (state.initiallyOpen) {
				this.setInitialState(state.children[0]);
			} else {
				state.initiallyOpen = true;
			}
		},

		openHostFolderPicker() {
			let future = peergos.shared.util.Futures.incomplete();
			let that = this;
			this.showSpinner = true;
			this.getHostDirTree().thenApply(hostFolders => {
				let sortedHostFolders = hostFolders.sort((a, b) => a.localeCompare(b, 'en', { 'sensitivity': 'base' }));
				let final = { result: [] };
				for (const path of sortedHostFolders) {
					let context = final;
					let sep = path.indexOf("/") >= 0 ? '/' : '\\';
					let names = path.split(sep).filter(n => n.length > 0);
					for (var i = 0; i < names.length; i++) {
						let fullPath = "";
						for (var j = 0; j <= i && j < names.length; j++) {
							fullPath = fullPath + (fullPath == "" && sep == '\\' ? "" : sep) + names[j];
						}
						let name = names[i];
						if (!context[name]) {
							context[name] = { result: [] };
							context.result.push({ path: fullPath, children: context[name].result });
						}
						context = context[name];
					}
				}
				that.hostFolderTree = {};
				that.drivesSimplePicker = [];
				final.result.forEach(result => {
					that.setInitialState(result);
					let rootPath = result.path;
					that.hostFolderTree[rootPath] = { "path": rootPath, "initiallyOpen": result.children.length == 1, "children": result.children };
					that.drivesSimplePicker.push(result.path);
				});
				that.showSpinner = false;
				that.selectedFoldersFromSimplePicker = function (chosenFolders) {
					if (chosenFolders.length == 0) {
						future.complete(null);
					} else {
						let selectedFolder = chosenFolders[0];
						if (that.drivesSimplePicker.filter(i => i == selectedFolder).length == 1) {
							future.complete(null);
						} else {
							future.complete(selectedFolder);
						}
					}
					that.showSimpleFolderPicker = false;
				};
				that.showSimpleFolderPicker = true;
			});
			return future;
		},

		mergeTree(existing, updated) {
			if (existing.children.length == 0) {
				for (var i = 0; i < updated.children.length; i++) {
					existing.children.push(updated.children[i]);
				}
			}
			if (updated.loadChildren)
				existing.loadChildren = true;

			for (var i = 0; i < updated.children.length; i++) {
				var updatedChild = updated.children[i];
				for (var j = 0; j < existing.children.length; j++) {
					var existingChild = existing.children[j];
					if (existingChild.path == updatedChild.path)
						this.mergeTree(existingChild, updatedChild);
				}
			}
		},

		preloadHostFolders: function(path, callback) {
			let that = this;
			this.getHostDirTree(path).thenApply(hostFolders => {
				let sortedHostFolders = hostFolders.sort((a, b) => a.localeCompare(b, 'en', { 'sensitivity': 'base' }));
				let final = { result: [] };
				let byPath = {};
				for (const path of sortedHostFolders) {
					let context = final;
					let sep = path.indexOf("/") >= 0 ? '/' : '\\';
					let names = path.split(sep).filter(n => n.length > 0);
					for (var i = 0; i < names.length; i++) {
						let fullPath = "";
						for (var j = 0; j <= i && j < names.length; j++) {
							fullPath = fullPath + (fullPath == "" && sep == '\\' ? "" : sep) + names[j];
						}
						let name = names[i];
						if (!context[name]) {
							context[name] = { result: [] };
							let dir = { path: fullPath, children: context[name].result, loadChildren: i == names.length - 1 };
							byPath[fullPath] = dir;
							context.result.push(dir);
						}
						if (i < names.length - 1)
							byPath[fullPath].loadChildren = false;
						context = context[name];
					}
				}
				final.result.forEach(result => {
					that.setInitialState(result);
					let rootPath = result.path;
					let dir = { "path": rootPath, "initiallyOpen": result.children.length == 1, "children": result.children, loadChildren: result.loadChildren };
					if (that.hostFolderTree[rootPath] == null)
						that.hostFolderTree[rootPath] = dir;
					else {
						that.mergeTree(that.hostFolderTree[rootPath], dir);
					}
				});
				callback(that.hostFolderTree[path]);
			});
		},

		navigateTo: function (path) {
			this.openFileOrDir("Drive", path, { filename: "" });
		},
	},
}
</script>
