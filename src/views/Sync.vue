<template>
	<article class="app-view sync-view">
		<AppHeader>
			<template #primary>
				<h1>{{ translate("SYNC.TITLE") }}</h1>
			</template>
		</AppHeader>
		<main>

			<section v-if="! enabled" class="sync-unavailable">
				<h2>{{ translate("SYNC.DISABLED.TITLE") }}</h2>
				<p>{{ translate("SYNC.DISABLED") }}</p>
				<p><a href="https://peergos.org/download" target="_blank" rel="noopener">https://peergos.org/download</a></p>
				<p>{{ translate("SYNC.DISABLED2") }}</p>
			</section>

			<template v-else>

				<!-- Aggregate state: the single thing you came to find out -->
				<section class="sync-summary" :class="'sync-tone--' + tone">
					<span class="sync-summary__icon" aria-hidden="true">
						<svg v-if="tone === 'ok'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
						<svg v-else-if="tone === 'busy'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
						<svg v-else-if="tone === 'paused'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>
						<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/></svg>
					</span>
					<div class="sync-summary__text">
						<h2>{{ summaryHeadline }}</h2>
						<p>{{ summaryDetail }}</p>
					</div>
					<div class="sync-summary__actions">
						<button v-if="paused" type="button" class="sync-btn sync-btn--resume" @click="syncNow()">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>
							{{ translate("SYNC.RESUME") }}
						</button>
						<template v-else-if="syncPairs.length > 0">
							<button type="button" class="sync-btn sync-btn--onTone" :disabled="syncBusy"
									:title="syncBusy ? translate('SYNC.NOW.BUSY') : ''" @click="syncNow()">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>
								{{ translate("SYNC.NOW") }}
							</button>
							<button type="button" class="sync-btn sync-btn--pause" @click="pauseSync()">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>
								{{ translate("SYNC.PAUSE") }}
							</button>
						</template>
						<button type="button" class="sync-btn sync-btn--primary" @click="addSyncPair()">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
							{{ translate("SYNC.ADDPAIR") }}
						</button>
					</div>
				</section>

				<!-- First run -->
				<section v-if="syncPairs.length === 0" class="sync-empty">
					<span class="sync-empty__mark" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8"/></svg>
					</span>
					<h2>{{ translate("SYNC.EMPTY.TITLE") }}</h2>
					<p>{{ translate("SYNC.EMPTY.BODY") }}</p>
					<button type="button" class="sync-btn sync-btn--primary" @click="addSyncPair()">
						{{ translate("SYNC.ADDPAIR") }}
					</button>
				</section>

				<template v-else>
					<div class="sync-sectionhead">
						<h2>{{ translate("SYNC.FOLDERS") }}</h2>
						<span>{{ syncPairs.length }}</span>
					</div>

					<ul class="sync-cards">
						<li v-for="pair in syncPairs" :key="pair.label"
							class="sync-card" :class="{ 'sync-card--error': stateOf(pair) === 'ERROR' }">

							<div class="sync-card__head">
								<div class="sync-route">
									<div class="sync-endpoint">
										<span class="sync-endpoint__icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
										</span>
										<span class="sync-endpoint__text">
											<span class="sync-endpoint__label">{{ translate("SYNC.THISDEVICE") }}</span>
											<span class="sync-endpoint__value" :class="{ 'sync-endpoint__value--open': expanded[pair.label + ':local'] }"
												:title="prettifyHostFolder(pair.localpath)" @click="toggleExpand(pair.label + ':local')">
												<span class="sync-path__head">{{ pathHead(prettifyHostFolder(pair.localpath)) }}</span
												><span class="sync-path__tail">{{ pathTail(prettifyHostFolder(pair.localpath)) }}</span>
											</span>
										</span>
									</div>
									<span class="sync-route__arrow" aria-hidden="true">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8"/></svg>
									</span>
									<div class="sync-endpoint">
										<span class="sync-endpoint__icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.1 11.1 3.5 3.5 0 0 0 6.5 19Z"/></svg>
										</span>
										<span class="sync-endpoint__text">
											<span class="sync-endpoint__label">{{ translate("SYNC.DRIVE") }}</span>
											<a class="sync-endpoint__value sync-endpoint__value--link" :title="pair.remotepath"
												href="#" @click.prevent="navigateTo(pair.remotepath)"
												><span class="sync-path__head">{{ pathHead(pair.remotepath) }}</span
												><span class="sync-path__tail">{{ pathTail(pair.remotepath) }}</span></a>
										</span>
									</div>
								</div>

								<span class="sync-pill" :class="'sync-tone--' + toneOf(pair)">
									<span class="sync-pill__dot" aria-hidden="true"></span>{{ stateLabel(stateOf(pair)) }}
								</span>
							</div>

							<p v-if="pair.error && ! wasStopped(pair.error)" class="sync-errorbox">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/></svg>
								<span class="sync-clamp" :class="{ 'sync-clamp--open': expanded[pair.label + ':err'] }"
									@click="toggleExpand(pair.label + ':err')">{{ cleanError(pair.error) }}</span>
							</p>
							<div v-else-if="activityOf(pair)" class="sync-activityrow">
								<p class="sync-activity sync-clamp" :class="{ 'sync-clamp--open': expanded[pair.label + ':act'] }"
									:title="activityOf(pair, true)" @click="toggleExpand(pair.label + ':act')">{{ activityOf(pair, expanded[pair.label + ':act']) }}</p>
								<span v-if="progressOf(pair)" class="sync-pct">{{ progressOf(pair).pct }}%</span>
							</div>

							<template v-if="stateOf(pair) === 'SYNCING'">
								<!-- determinate only when the status message reports totals -->
								<div v-if="progressOf(pair)" class="sync-bar sync-bar--determinate" role="progressbar"
									:aria-valuenow="progressOf(pair).pct" aria-valuemin="0" aria-valuemax="100"
									:aria-label="translate('SYNC.STATE.SYNCING')">
									<span :style="{ width: progressOf(pair).pct + '%' }"></span>
								</div>
								<div v-else class="sync-bar" role="progressbar" :aria-label="translate('SYNC.STATE.SYNCING')"><span></span></div>
							</template>

							<div class="sync-card__foot">
								<div class="sync-chips">
									<span class="sync-chip" :class="{ 'sync-chip--on': pair.syncLocalDeletes }">
										<svg v-if="pair.syncLocalDeletes" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
										<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
										{{ pair.syncLocalDeletes ? translate("SYNC.DELETES.LOCAL.ON") : translate("SYNC.DELETES.LOCAL.OFF") }}
									</span>
									<span class="sync-chip" :class="{ 'sync-chip--on': pair.syncRemoteDeletes }">
										<svg v-if="pair.syncRemoteDeletes" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
										<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
										{{ pair.syncRemoteDeletes ? translate("SYNC.DELETES.REMOTE.ON") : translate("SYNC.DELETES.REMOTE.OFF") }}
									</span>
									<label v-if="isAndroid" class="sync-switch">
										<input type="checkbox" :checked="pair.allowOnMobile"
											@change="setAllowOnMobile(pair, $event.target.checked)" />
										<span class="sync-switch__track" aria-hidden="true"></span>
										<span>{{ translate("SYNC.MOBILEDATA") }}</span>
									</label>
								</div>

								<div class="sync-card__actions">
									<button type="button" class="sync-btn sync-btn--quiet" @click="downloadLog(pair.label)">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m8 11 4 4 4-4"/><path d="M4 19h16"/></svg>
										{{ translate("SYNC.LOG") }}
									</button>
									<button type="button" class="sync-btn sync-btn--danger" @click="confirmRemove(pair)">
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
const FolderPicker = require('../components/picker/FolderPicker.vue');
const Select = require('../components/choice/Select.vue');
const Confirm = require('../components/confirm/Confirm.vue');

const SimpleFolderPicker = require('../components/picker/SimpleFolderPicker.vue');
const Spinner = require("../components/spinner/Spinner.vue");

const i18n = require("../i18n/index.js");
const loopback = require("../mixins/loopback/index.js");
const routerMixins = require("../mixins/router/index.js");

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
			fastPollIntervalID: null,
			fastPollTimeoutID: null,
			updateStatusIntervalID: "",
			error: null,
			now: Date.now(),
		}
	},
	props: [],
	mixins: [routerMixins, i18n],

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
		tone() {
			if (this.paused)
				return "paused";
			// a folder yet to be reached is work outstanding, so the banner stays
			// busy rather than claiming everything is settled
			if (this.counts.ERROR === 0 && (this.syncPending || this.counts.PENDING > 0))
				return "busy";
			if (this.error && this.wasStopped(this.error) && this.counts.ERROR === 0)
				return this.counts.SYNCING > 0 ? "busy" : "ok";
			let state = this.globalState;
			if (state == null || state === "NONE")
				state = this.counts.ERROR > 0 ? "ERROR" : (this.counts.SYNCING > 0 ? "SYNCING" : "SYNCED");
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
			if (this.tone === 'busy')
				return this.syncPairs.length === 1 ?
					this.translate("SYNC.SUMMARY.SYNCING.ONE") :
					// which folder the pass is on, so the count climbs rather than counts down
					this.fmt2("SYNC.SUMMARY.SYNCING", Math.max(this.syncingIndex + 1, 1), this.syncPairs.length);
			return this.translate("SYNC.SUMMARY.OK");
		},
		summaryDetail() {
			let when = this.lastChecked;
			return when ? this.fmt("SYNC.SUMMARY.CHECKED", when) : '';
		},
		lastChecked() {
			return this.staleTime(this.splitStatus(this.status).time);
		},
		// disabled from the click until the run we asked for has finished
		syncing() {
			return this.globalState === "SYNCING" || this.counts.SYNCING > 0;
		},
		syncBusy() {
			return this.syncPending || this.syncing;
		},
	},
	created() {
		this.getSyncState();
		this.getWhichChooser();
		this.updateStatus();
		let that = this;
		this.updateStatusIntervalID = setInterval(() => {
			that.now = Date.now();
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
		cleanError(msg) {
			if (msg == null)
				return '';
			let out = ("" + msg).trim();
			let previous = null;
			while (out !== previous) {
				previous = out;
				out = out.replace(/^(?:[\w$]+\.)+[\w$]*(?:Exception|Error|Throwable):\s*/, '');
			}
			return out;
		},

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

		errText(e) {
			if (e == null)
				return "Unknown error";
			// transpiled java throwables carry their text on detailMessage
			if (e.detailMessage != null && e.detailMessage.length > 0)
				return e.detailMessage;
			if (e.message != null && e.message.length > 0)
				return e.message;
			return "" + e;
		},
		fmt(key, n) {
			return this.translate(key).replace("{n}", n);
		},
		fmt2(key, n, m) {
			return this.translate(key).replace("{n}", n).replace("{m}", m);
		},
		// the leaf identifies the folder, so keep it and let the parents truncate
		pathHead(path) {
			let p = ("" + path).replace(/\/+$/, '');
			let cut = p.lastIndexOf('/');
			return cut <= 0 ? p : p.substring(0, cut);
		},
		pathTail(path) {
			let p = ("" + path).replace(/\/+$/, '');
			let cut = p.lastIndexOf('/');
			return cut <= 0 ? '' : p.substring(cut);
		},
		// title tooltips never fire on touch, so the full value needs a tap as well
		toggleExpand(key) {
			Vue.set(this.expanded, key, ! this.expanded[key]);
		},
		stateOf(pair) {
			if (pair.error && ! this.wasStopped(pair.error))
				return "ERROR";
			if (this.paused)
				return "PAUSED";
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
		splitStatus(msg) {
			if (msg == null || msg.length === 0)
				return { text: '', time: null };
			// the server appends " at <date> <time>"; LocalTime.toString() drops ":ss"
			// when seconds are zero, hence the optional group
			let m = /^([\s\S]*) at (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/.exec(msg);
			if (m == null)
				return { text: msg, time: null };
			let parsed = new Date(m[2] + "T" + m[3]);
			return { text: m[1], time: isNaN(parsed.getTime()) ? null : parsed };
		},
		// the server names the transferred file by its path within the synced folder.
		// The line shows the leaf; absolute gives the whole local path, for the title
		// and for the opened form.
		activityOf(pair, absolute) {
			let split = this.splitStatus(pair.msg);
			let text = split.text.replace(/( MiB of )(.+)$/, (all, prefix, path) => prefix +
				(absolute ? this.prettifyHostFolder(pair.localpath) + "/" + path
					: path.substring(path.lastIndexOf('/') + 1)));
			let when = this.staleTime(split.time);
			return text && when ? text + " · " + when : (text || when || '');
		},
		// blank while the cycle is healthy; a value means checks have stalled
		staleTime(date) {
			if (date == null)
				return '';
			if (this.now - date.getTime() < 60000)
				return '';
			return this.relativeTime(date);
		},

		relativeTime(date) {
			if (date == null)
				return '';
			// only ever reached through staleTime, which stays blank for the first minute
			let secs = Math.round((this.now - date.getTime()) / 1000);
			if (secs < 0) secs = 0;
			let mins = Math.max(Math.round(secs / 60), 1);
			if (mins < 60)
				return this.fmt("SYNC.TIME.MINS", mins);
			let hours = Math.round(mins / 60);
			if (hours < 24)
				return this.fmt("SYNC.TIME.HOURS", hours);
			return this.fmt("SYNC.TIME.DAYS", Math.round(hours / 24));
		},

		/* ---------- server calls ---------- */

		localPost(url, body, responseType) {
			return new Promise(function(resolve, reject) {
				var req = new XMLHttpRequest();
				req.open('POST', url);
				req.responseType = responseType != null ? responseType : 'json';

				req.onload = function() {
					// This is called even on 404 etc so check the status
					if (req.status == 200) {
						resolve(req.response);
					} else {
						try {
							let trailer = req.getResponseHeader("Trailer");
							if (trailer == null) {
								reject('Unexpected error from server');
							} else {
								// the server form encodes the message, so spaces arrive as +
								reject(decodeURIComponent(trailer.replace(/\+/g, ' ')));
							}
						} catch (e) {
							reject(e);
						}
					}
				};

				req.onerror = function(e) {
					reject(Error("Unable to connect"));
				};

				req.ontimeout = function() {
					reject(Error("Network timeout"));
				};

				req.send(body != null ? body : new Int8Array(0));
			})
		},

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
				that.status = result.msg;
				that.error = result.error;
				that.globalState = result.state != null ? result.state : "NONE";
				let wasPaused = that.paused;
				that.paused = result.paused === true;
				// a resume from anywhere - this tab, another client, the phone - leaves the
				// pair reporting its pre pause state until the pass starts a moment later
				if (wasPaused && ! that.paused)
					that.syncPending = true;
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
			this.syncPending = true;
			// backstop only: the poll clears this once the server reports the pass. Kept
			// short because syncBusy gates the button, so a long window swallows clicks.
			clearTimeout(this.syncPendingTimeoutID);
			this.syncPendingTimeoutID = setTimeout(() => { that.syncPending = false; }, 3000);
			this.pollFaster(6000);
			this.localPost("/peergos/v0/sync/sync-now").then(function(result, err) {
				that.$toast(that.translate("SYNC.STARTED"));
			}).catch(function(err) {
				that.syncPending = false;
				that.$toast.error(that.errText(err), {});
			})
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
				that.now = Date.now();
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

<style>
/* ------------------------------------------------------------------
   Sync — Option A: status cards
   Only CSS features already used elsewhere in this codebase.
   No color-mix(), no :has(), no container queries.
   ------------------------------------------------------------------ */

.sync-view {
	display: flex;
	flex-direction: column;
	min-height: 100vh;

	--sync-muted: #566571;
	--sync-on-ok: #146b57;
	--sync-on-busy: #1c5f9e;
	--sync-on-error: #b3261e;
	--sync-link: #3b73ab;
	/* amber, distinct from the red used for removing a pair: pausing is reversible */
	--sync-pause: #b45309;
	--sync-pause-hover: #92400e;
	--sync-on-pause: #ffffff;
	--sync-tint-pause: #fdf1e0;
	--sync-on-pause-tint: #92400e;
	--sync-surface-2: #f1f4f7;
	--sync-tint-ok: #e8f8f3;
	--sync-tint-busy: #eaf3fd;
	--sync-tint-error: #fdecec;
	--sync-border-error: #f0b4b4;
	--sync-track: #e6ebef;
	--sync-shadow: 0 1px 2px rgba(44, 62, 80, .07);
	--sync-gap: 16px;
}

[data-theme="dark-mode"] .sync-view {
	--sync-muted: #a7b6c2;
	--sync-on-ok: #63e3bd;
	--sync-on-busy: #8fd2e8;
	--sync-on-error: #ffa1a1;
	--sync-link: #7fbcf7;
	--sync-pause: #fbbf24;
	--sync-pause-hover: #f59e0b;
	--sync-on-pause: #1f1300;
	--sync-tint-pause: #4a3a1d;
	--sync-on-pause-tint: #fbbf24;
	--sync-surface-2: #22303c;
	--sync-tint-ok: #1d4a41;
	--sync-tint-busy: #22405c;
	--sync-tint-error: #4d2b2e;
	--sync-border-error: #7c4348;
	--sync-track: #1f2c37;
	--sync-shadow: 0 1px 2px rgba(0, 0, 0, .25);
}

.sync-view main {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	flex: 1 1 auto;
	width: 100%;
	max-width: 1040px;
	padding: var(--app-margin);
	margin: 0 auto;
	gap: var(--sync-gap);
}

.sync-view h2 {
	font-size: 18px;
	margin: 0;
}

/* ---------- buttons ---------- */

.sync-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	min-height: 40px;
	padding: 9px 16px;

	font-family: inherit;
	font-size: var(--text-small);
	font-weight: var(--bold);
	line-height: 1.2;

	color: var(--color);
	background-color: transparent;
	border: 1px solid var(--border-color);
	border-radius: 8px;
	cursor: pointer;
}

.sync-btn svg {
	width: 16px;
	height: 16px;
	flex: none;
}

.sync-btn:not(:disabled):hover {
	background-color: var(--bg-2);
}

.sync-btn:disabled {
	opacity: .55;
	cursor: default;
}

.sync-btn:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}

.sync-btn--primary {
	color: #ffffff;
	background-color: var(--green-500);
	border-color: var(--green-500);
}

.sync-btn--primary:not(:disabled):hover {
	background-color: var(--green-200);
	border-color: var(--green-200);
}

.sync-btn--quiet {
	border-color: transparent;
	color: var(--sync-muted);
}

.sync-btn--danger {
	color: var(--alert);
	border-color: transparent;
}

.sync-btn--danger:not(:disabled):hover {
	background-color: var(--sync-tint-error);
}

.sync-btn--onTone {
	border-color: currentColor;
	background-color: transparent;
}

/* Amber rather than the alert colour: removing a pair is permanent, pausing is
   undone by the same control. Pause is outlined so it stays below the primary
   action, and so both themes read the same - a solid fill has to invert to a
   bright yellow in dark mode, which then outshouts everything else. */
.sync-btn--pause {
	color: var(--sync-on-pause-tint);
	background-color: transparent;
	border-color: var(--sync-on-pause-tint);
}

.sync-btn--pause:not(:disabled):hover {
	color: var(--sync-on-pause);
	background-color: var(--sync-pause);
	border-color: var(--sync-pause);
}

/* while paused, resuming is the primary action, so it takes the solid fill */
.sync-btn--resume {
	color: var(--sync-on-pause);
	background-color: var(--sync-pause);
	border-color: var(--sync-pause);
}

.sync-btn--resume:not(:disabled):hover {
	background-color: var(--sync-pause-hover);
	border-color: var(--sync-pause-hover);
}

/* ---------- unavailable / empty ---------- */

.sync-unavailable,
.sync-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	max-width: 560px;
	margin: 32px auto;
	padding: 32px 24px;
	text-align: center;
}

.sync-empty {
	border: 1px dashed var(--border-color);
	border-radius: 14px;
}

.sync-unavailable p,
.sync-empty p {
	margin: 0;
	color: var(--sync-muted);
	font-size: var(--text-small);
	line-height: 1.55;
	overflow-wrap: anywhere;
}

.sync-unavailable a {
	color: var(--blue-accent);
	text-decoration: underline;
}

.sync-empty__mark {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 52px;
	height: 52px;
	border-radius: 50%;
	color: var(--green-500);
	background-color: var(--sync-tint-ok);
}

.sync-empty__mark svg {
	width: 24px;
	height: 24px;
}

/* ---------- summary ---------- */

.sync-summary {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 18px 20px;
	border-radius: 14px;
}

.sync-summary__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 42px;
	height: 42px;
	flex: none;
	border-radius: 50%;
	color: #ffffff;
}

.sync-summary__icon svg {
	width: 22px;
	height: 22px;
}

.sync-summary__text {
	min-width: 0;
}

.sync-summary__text p {
	margin: 4px 0 0;
	font-size: var(--text-small);
	opacity: .78;
	overflow-wrap: anywhere;
}

.sync-summary__actions {
	display: flex;
	gap: 10px;
	margin-left: auto;
	flex: none;
}

.sync-tone--ok.sync-summary { background-color: var(--sync-tint-ok); }
.sync-tone--ok .sync-summary__icon,
.sync-tone--ok.sync-summary .sync-summary__icon { background-color: var(--green-500); }

.sync-tone--busy.sync-summary { background-color: var(--sync-tint-busy); }
.sync-tone--busy.sync-summary .sync-summary__icon { background-color: var(--blue-accent); }

.sync-tone--paused.sync-summary { background-color: var(--sync-tint-pause); }
.sync-tone--paused.sync-summary .sync-summary__icon { background-color: var(--sync-pause); color: var(--sync-on-pause); }

.sync-tone--error.sync-summary { background-color: var(--sync-tint-error); }
.sync-tone--error.sync-summary .sync-summary__icon { background-color: var(--alert); }

/* ---------- section head ---------- */

.sync-sectionhead {
	display: flex;
	align-items: baseline;
	gap: 10px;
	margin-top: 8px;
}

.sync-sectionhead h2 {
	font-size: 15px;
}

.sync-sectionhead span {
	font-size: var(--text-small);
	color: var(--sync-muted);
}

/* ---------- cards ---------- */

.sync-cards {
	display: flex;
	flex-direction: column;
	gap: 14px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.sync-card {
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding: 18px 20px;
	background-color: var(--bg);
	border: 1px solid var(--border-color);
	border-radius: 14px;
	box-shadow: var(--sync-shadow);
}

.sync-card--error {
	border-color: var(--sync-border-error);
}

/* a fixed column for the status keeps the remote paths aligned down the list:
   otherwise a wide pill on one card shifts that card's arrow and remote path */
.sync-card__head {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 150px;
	align-items: center;
	gap: 16px;
}

.sync-card__head .sync-pill {
	justify-self: end;
}

.sync-route {
	display: flex;
	align-items: center;
	gap: 12px;
	min-width: 0;
	flex: 1 1 320px;
}

.sync-endpoint {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
	/* basis from content, so a long path takes the room a short one on the other
	   side of the arrow doesn't need, instead of both being locked to half a row */
	flex: 1 1 auto;
}

.sync-endpoint__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 34px;
	height: 34px;
	flex: none;
	border-radius: 9px;
	color: var(--sync-muted);
	background-color: var(--sync-surface-2);
}

.sync-endpoint__icon svg {
	width: 18px;
	height: 18px;
}

.sync-endpoint__text {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.sync-endpoint__label {
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: .07em;
	color: var(--sync-muted);
}

.sync-endpoint__value {
	display: flex;
	margin-top: 2px;
	min-width: 0;
	font-size: 15px;
	font-weight: var(--bold);
	white-space: nowrap;
	cursor: pointer;
}

.sync-path__head {
	flex: 0 999 auto;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}

.sync-path__tail {
	/* never shrinks; the cap only bites if the leaf alone is longer than the row */
	flex: 0 0 auto;
	max-width: 65%;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* tapped open: the whole path wraps, since a tooltip is desktop only */
.sync-endpoint__value--open {
	white-space: normal;
	overflow-wrap: anywhere;
}

.sync-endpoint__value--open .sync-path__head,
.sync-endpoint__value--open .sync-path__tail {
	overflow: visible;
	text-overflow: clip;
	white-space: normal;
}



.sync-endpoint__value--link {
	color: var(--sync-link);
	text-decoration: none;
}

.sync-endpoint__value--link:hover {
	text-decoration: underline;
}

.sync-route__arrow {
	/* flex, not inline: an inline svg sits on the text baseline, which leaves
	   descender space below it and lifts the glyph off the icons' centre line */
	display: flex;
	align-items: center;
	flex: none;
	color: var(--color-2);
}

.sync-route__arrow svg {
	width: 20px;
	height: 20px;
}

/* ---------- state pill ---------- */

.sync-pill {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	flex: none;
	padding: 6px 12px;
	font-size: var(--text-small);
	font-weight: var(--bold);
	border-radius: 999px;
}

.sync-pill__dot {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background-color: currentColor;
}

@keyframes sync-pulse {
	0%, 100% { transform: scale(1); opacity: 1; }
	50% { transform: scale(1.7); opacity: .4; }
}

/* only while syncing: a still dot for the settled states keeps the motion meaningful */
.sync-tone--busy .sync-pill__dot {
	animation: sync-pulse 1.4s ease-in-out infinite;
}

.sync-tone--ok.sync-pill { color: var(--sync-on-ok); background-color: var(--sync-tint-ok); }
.sync-tone--busy.sync-pill { color: var(--sync-on-busy); background-color: var(--sync-tint-busy); }
.sync-tone--error.sync-pill { color: var(--sync-on-error); background-color: var(--sync-tint-error); }
.sync-tone--paused.sync-pill { color: var(--sync-on-pause-tint); background-color: var(--sync-tint-pause); }
.sync-tone--pending.sync-pill { color: var(--sync-muted); background-color: var(--sync-surface-2); }

/* ---------- activity ---------- */

.sync-activity {
	margin: 0;
	font-size: var(--text-small);
	line-height: 1.4;
	color: var(--sync-muted);
	overflow-wrap: anywhere;
}

/* clamped rather than scrolled: the ellipsis is the only visible cue text was cut */
.sync-clamp {
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 3;
	overflow: hidden;
	cursor: pointer;
}

.sync-clamp--open {
	-webkit-line-clamp: unset;
	overflow: visible;
}

.sync-endpoint__value::-webkit-scrollbar,
.sync-activity::-webkit-scrollbar {
	width: 5px;
	height: 5px;
}

.sync-endpoint__value::-webkit-scrollbar-thumb,
.sync-activity::-webkit-scrollbar-thumb {
	border-radius: 999px;
	background-color: var(--sync-track);
}

.sync-errorbox {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	margin: 0;
	padding: 10px 12px;
	font-size: var(--text-small);
	color: var(--sync-on-error);
	background-color: var(--sync-tint-error);
	border-radius: 9px;
	overflow-wrap: anywhere;
}

.sync-errorbox svg {
	width: 16px;
	height: 16px;
	flex: none;
	margin-top: 2px;
}

/* Indeterminate: the API reports no total, so never fake a percentage */
.sync-bar {
	position: relative;
	height: 4px;
	border-radius: 999px;
	background-color: var(--sync-track);
	overflow: hidden;
}

.sync-bar > span {
	position: absolute;
	top: 0;
	left: 0;
	width: 34%;
	height: 100%;
	border-radius: 999px;
	background-color: var(--blue-accent);
	animation: sync-slide 1.6s ease-in-out infinite;
}

.sync-bar--determinate > span {
	animation: none;
	transition: width .3s ease;
}

/* the percentage sits beside the activity text, which names what is progressing.
   min-width:0 lets a long path shrink rather than push the number off a phone screen */
.sync-activityrow {
	display: flex;
	align-items: flex-start;
	gap: 10px;
}

.sync-activityrow .sync-activity {
	flex: 1;
	min-width: 0;
}

.sync-pct {
	flex: none;
	font-size: 13px;
	line-height: 1.4;
	color: var(--sync-muted);
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

@keyframes sync-slide {
	0% { left: -34%; }
	100% { left: 100%; }
}

@media (prefers-reduced-motion: reduce) {
	.sync-tone--busy .sync-pill__dot {
		animation: none;
	}

	.sync-bar > span {
		animation: none;
		left: 0;
		width: 100%;
		opacity: .45;
	}
}

/* ---------- card footer ---------- */

.sync-card__foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 14px;
	flex-wrap: wrap;
	padding-top: 14px;
	border-top: 1px solid var(--border-color);
}

.sync-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	min-width: 0;
}

.sync-chip {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	padding: 5px 11px;
	font-size: 13px;
	color: var(--sync-muted);
	background-color: var(--sync-surface-2);
	border-radius: 999px;
}

.sync-chip svg {
	width: 13px;
	height: 13px;
	flex: none;
}

.sync-chip--on {
	color: var(--sync-on-ok);
}

.sync-card__actions {
	display: flex;
	gap: 8px;
	margin-left: auto;
	flex: none;
}

/* ---------- switch ---------- */

.sync-switch {
	position: relative;
	display: inline-flex;
	align-items: center;
	gap: 9px;
	padding: 4px 11px 4px 8px;
	font-size: 13px;
	border: 1px solid var(--border-color);
	border-radius: 999px;
	cursor: pointer;
	margin: 0;
	font-weight: var(--regular);
}

.sync-switch input {
	position: absolute;
	opacity: 0;
	width: 0;
	height: 0;
}

/* extends the tap target to ~44px without growing the visible control */
.sync-switch:after {
	content: "";
	position: absolute;
	top: -8px;
	right: -8px;
	bottom: -8px;
	left: -8px;
}

.sync-switch__track {
	position: relative;
	width: 30px;
	height: 18px;
	flex: none;
	border-radius: 999px;
	background-color: var(--gray-3);
	transition: background-color .2s;
}

.sync-switch__track:after {
	content: "";
	position: absolute;
	top: 3px;
	left: 3px;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background-color: #ffffff;
	transition: left .2s;
}

.sync-switch input:checked + .sync-switch__track {
	background-color: var(--green-500);
}

.sync-switch input:checked + .sync-switch__track:after {
	left: 15px;
}

.sync-switch input:focus-visible + .sync-switch__track {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}

/* ---------- narrow screens (Android webview, small windows) ---------- */

@media (max-width: 700px) {
	.sync-view main {
		gap: 14px;
	}



	.sync-summary {
		flex-wrap: wrap;
		gap: 12px;
	}

	.sync-summary__text {
		flex: 1 1 200px;
	}

	.sync-summary__actions {
		margin-left: 0;
		width: 100%;
		flex: 1 1 100%;
	}

	.sync-summary__actions .sync-btn {
		flex: 1 1 0;
	}

	.sync-card__head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
	}

	/* stack the two endpoints and turn the arrow upright. The route shrinks rather
	   than claiming the full row, so the status stays top right beside it */
	.sync-route {
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
		/* basis 0, not auto: the head wraps, and wrapping is decided on the hypothetical
		   size, so a long nowrap path would push the status onto its own line first */
		flex: 1 1 0;
		min-width: 0;
	}

	.sync-endpoint {
		flex: 0 0 auto;
		min-width: 0;
	}

	/* Material's minimum touch target; 40px is comfortable with a mouse, not a thumb */
	.sync-btn {
		min-height: 48px;
	}

	/* the arrow links the two endpoint icons, so it lines up with them rather than
	   with the card. Matching the icon width centres it without a magic offset. */
	.sync-route__arrow {
		width: 34px;
		justify-content: center;
		transform: rotate(90deg);
	}

	.sync-card__foot {
		align-items: stretch;
		flex-direction: column;
	}

	.sync-card__actions {
		margin-left: 0;
		width: 100%;
	}

	.sync-card__actions .sync-btn {
		flex: 1 1 0;
		border-color: var(--border-color);
	}
}

@media (max-width: 380px) {
	.sync-summary__actions {
		flex-direction: column;
	}

	.sync-card__actions {
		flex-direction: column;
	}
}
</style>
