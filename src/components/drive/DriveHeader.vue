<template>
	<header class="drive-header" :class="{'drive-header--path-open': pathExpanded}">

			<nav ref="breadcrumb" class="drive-breadcrumb" :class="{'drive-breadcrumb--expanded': pathExpanded, 'drive-breadcrumb--tight': pathTight}">
				<AppButton v-if="!(path.length >2 && path[1] == '.apps')" class="breadcrumb__root" :class="{'breadcrumb__root--current': !path.length}" aria-label="global files" @click.native="$emit('goBackToLevel', 0 )">
					<AppIcon icon="globe--24"/>
				</AppButton>
				<AppIcon v-if="path.length && !(path.length >2 && path[1] == '.apps')" icon="chevron--24" class="breadcrumb__separator" aria-hidden="true"/>

				<!-- a trail too long to fit keeps the folder and its parent, and folds the rest in here -->
				<span v-if="firstShown > pathStart" key="more" class="breadcrumb__crumb breadcrumb__crumb--more">
					<button type="button" class="breadcrumb__more" :aria-label="translate('DRIVE.PATH.EXPAND')"
							:title="translate('DRIVE.PATH.EXPAND')" @click="pathExpanded = true">&#x22EF;</button>
					<AppIcon icon="chevron--24" class="breadcrumb__separator" aria-hidden="true"/>
				</span>
				<!-- each name carries the separator after it, so an expanded trail that wraps ends a
				     line on a separator and starts the next on a name -->
				<template v-if="!(path.length >2 && path[1] == '.apps')" v-for="(dir, index) in path">
					<span v-if="index >= firstShown" :key="index" class="breadcrumb__crumb" :class="{'breadcrumb__crumb--current': index == path.length - 1}">
						<AppButton class="breadcrumb__item" :class="{'breadcrumb__item--current': index == path.length - 1}" :aria-label="dir" :title="dir" tabindex="-1" @click.native="openLevel(index)">{{ dir }}</AppButton>
						<AppIcon v-if="index < path.length - 1" icon="chevron--24" class="breadcrumb__separator" aria-hidden="true"/>
					</span>
				</template>
                <template v-if="path.length >2 && path[1] == '.apps'" v-for="(dir, index) in path">
                    <span v-if="index >= firstShown" :key="index" class="breadcrumb__crumb" :class="{'breadcrumb__crumb--current': index == path.length - 1}">
                        <AppButton v-if="index>2" class="breadcrumb__item" :class="{'breadcrumb__item--current': index == path.length - 1}" :aria-label="dir" :title="dir" tabindex="-1" @click.native="openLevel(index)">{{ dir }}</AppButton>
                        <AppButton v-if="index==2" class="breadcrumb__item" :class="{'breadcrumb__item--current': index == path.length - 1}" :aria-label="dir" :title="dir" tabindex="-1" @click.native="index == path.length - 1 && togglePath()">{{ dir }}</AppButton>
                        <AppIcon v-if="index < path.length - 1" icon="chevron--24" class="breadcrumb__separator" aria-hidden="true"/>
                    </span>
                </template>
			</nav>

			<div class="drive-tools">
				<AppButton
					class="change-view"
					:icon="gridView ? 'list' : 'grid'"
					:aria-label="gridView ? 'list view' : 'grid view'"
					@keyup.enter="$emit('switchView')"
					@click.native="$emit('switchView')"
				/>

				<AppDropdown
					class="sort"
					:aria-label="translate('DRIVE.SORT')"
				>
					<template #trigger>
						<AppIcon icon="select"/>
					</template>
					<ul>
						<li v-for="col in columns" :key="col.key"
							:class="{sorted: sortBy == col.key}"
							@click="$emit('sortBy', col.key)"
						>{{ translate(col.label) }}<AppIcon
							v-if="sortBy == col.key" class="sort-tick" icon="check"/></li>
						<li class="divider" aria-hidden="true"></li>
						<li class="sort__order" @click="$emit('toggleSortOrder')"
						>{{ translate(normalSortOrder ? 'DRIVE.SORT.ASC' : 'DRIVE.SORT.DESC') }}<AppIcon
							class="sort-caret" :class="{'sort-caret--asc': normalSortOrder}"
							icon="chevron-down"/></li>
					</ul>
				</AppDropdown>

				<AppButton
					class="search"
					icon="search"
					aria-label="search"
					@keyup.enter="$emit('search')"
					@click.native="$emit('search')"
				/>

				<AppDropdown
					v-if="isWritable"
					class="upload"
					icon="chevron-down"
					accent
					aria-label="Upload"
				>
					<template #trigger>
						<AppIcon class="upload__plus" icon="plus"/>
					</template>
					<ul>
						<li @click="askForFiles()">{{ translate("DRIVE.UPLOAD.FILES") }}</li>
						<li @click="askForDirectories()">{{ translate("DRIVE.UPLOAD.FOLDER") }}</li>
						<li v-if="!isArchive" @click="$emit('createFile')">{{ translate("DRIVE.NEW.FILE") }}</li>
						<li v-if="!isArchive" @click="$emit('askMkdir')">{{ translate("DRIVE.NEW.FOLDER") }}</li>
						<li v-if="!isArchive" @click="$emit('newApp')">{{ translate("DRIVE.NEW.APP") }}</li>
                        <li v-if="canPaste" @click="$emit('paste')">{{ translate("DRIVE.PASTE") }}</li>
					</ul>
				</AppDropdown>
			</div>

            <AppSandbox
                v-if="showAppSandbox"
                v-on:hide-app-sandbox="closeAppSandbox"
                :sandboxAppName="sandboxAppName"
                :currentFile=null>
            </AppSandbox>
	</header>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppDropdown = require("../AppDropdown.vue");
const AppIcon = require("../AppIcon.vue");
const AppSandbox = require("../sandbox/AppSandbox.vue");
const i18n = require("../../i18n/index.js");
const columns = require("./columns.js");

module.exports = {
	components: {
	    AppButton,
		AppDropdown,
		AppIcon,
        AppSandbox
	},
    mixins:[i18n],
    data() {
        return {
            showAppSandbox: false,
            sandboxAppName: '',
            columns,
            pathExpanded: false,
            // the middle of the trail folded into the ellipsis, because the whole of it did not fit
            pathCollapsed: false,
            // some name in the trail is cut short
            pathTight: false,
        };
    },
    watch: {
        // every folder opens with its trail folded, or the grid stays pushed down for no reason
        path() {
            this.pathExpanded = false;
            this.pathCollapsed = false;
            this.pathTight = false;
            this.$nextTick(this.measurePath);
        },
    },
    mounted() {
        this.$nextTick(this.measurePath);
        if (typeof ResizeObserver === "function") {
            this.pathObserver = new ResizeObserver(() => this.measurePath());
            this.pathObserver.observe(this.$refs.breadcrumb);
        } else {
            window.addEventListener("resize", this.measurePath);
        }
    },
    beforeDestroy() {
        if (this.pathObserver)
            this.pathObserver.disconnect();
        else
            window.removeEventListener("resize", this.measurePath);
    },
	props: {
		// the property the listing is ordered by, and whether that order runs ascending: the
		// same state the table's headings show and set, not a second copy of it
		sortBy: {
			type: String,
			default: "name"
		},
		normalSortOrder: {
			type: Boolean,
			default: true
		},
		gridView: {
			type: Boolean,
			default: true
		},
		isArchive: {
			type: Boolean,
			default: false
		},
		isWritable: {
			type: Boolean,
			default: true
		},
		canPaste: {
			type: Boolean,
			default: false
		},
		path:{
			type: Array,
			default: ()=>[]
		}
	},
	computed: {
        // an app's own folder shows from its name on, not from the .apps above it
        pathStart() {
            return this.path.length > 2 && this.path[1] == '.apps' ? 2 : 0;
        },
        firstShown() {
            if (! this.pathCollapsed || this.pathExpanded)
                return this.pathStart;
            return Math.max(this.pathStart, this.path.length - 2);
        },
        ...Vuex.mapState([
            "sandboxedApps"
        ]),
	},
	methods: {
        // the folder you are in has nowhere to go, so on a trail too long to show whole it opens
        // and folds the trail instead
        openLevel(index) {
            if (index == this.path.length - 1 && this.togglePath())
                return;
            this.$emit('goBackToLevel', index + 1);
        },
        togglePath() {
            if (! this.pathExpanded && ! this.pathCollapsed && ! this.pathTight)
                return false;
            this.pathExpanded = ! this.pathExpanded;
            return true;
        },
        /**
         * Whether the whole trail fits, measured with all of it shown: a folded trail cannot say
         * whether a wider window now has room. Unfolding and folding again both land before the
         * next paint, so the check does not show.
         */
        measurePath() {
            let nav = this.$refs.breadcrumb;
            if (nav == null || this.pathExpanded)
                return;
            if (this.pathCollapsed || this.pathTight) {
                this.pathCollapsed = false;
                this.pathTight = false;
                this.$nextTick(this.measurePath);
                return;
            }
            let truncated = Array.prototype.some.call(nav.querySelectorAll(".breadcrumb__item"),
                b => b.scrollWidth > b.clientWidth + 1);
            this.pathTight = truncated;
            if (truncated && this.path.length - this.pathStart > 2)
                this.pathCollapsed = true;
        },
	    appCreateNewInstance(appName) {
            this.showAppSandbox = true;
            this.sandboxAppName = appName;
        },
        closeAppSandbox() {
            this.showAppSandbox = false;
        },
		askForFiles() {
                        if (document.activeElement) document.activeElement.blur();
			document.getElementById('uploadFileInput').click();
		},

		askForDirectories() {
                        if (document.activeElement) document.activeElement.blur();
                        if (typeof Android !== 'undefined') {
                            Android.notifyDirectoryRequest();
                            document.getElementById('uploadFileInput').click();
                        } else {
                            document.getElementById('uploadDirectoriesInput').click();
                        }
		},
	},
}
</script>

<style>
/* Opened from the right edge of its own button, like the upload menu beside it: these sit
   at the end of the toolbar, and a menu that opens rightwards from here runs off the window. */
.drive-header .sort .dropdown__content {
	right: 0;
	left: auto;
}

/* The menu says both halves of the order outright: a tick against the property in force,
   and a last entry that names the direction and is the only thing that turns it around.
   Both are pushed to the far edge - a menu row is wider than its label, so a mark 4px after
   the text would sit ragged down the list.

   18px, not the 12px a caret takes in a table heading: these glyphs are stroked 2 units wide
   in a 32 unit box, so 12px draws them 0.75px thick - under one pixel, which is what makes a
   small mark look faint rather than small. 18px puts the stroke back over a pixel. */
.drive-header .sort .pg-menu .sort-tick,
.drive-header .sort .pg-menu .sort-caret {
	color: var(--pg-on-ok);
	width: 18px;
	height: 18px;
	margin-left: auto;
	padding-left: 12px;
	box-sizing: content-box;
}

/* and the row says it too, so the mark is not the only thing carrying it */
.drive-header .sort .pg-menu li.sorted {
	color: var(--pg-on-ok);
}

.drive-header .sort .pg-menu .sort-caret--asc {
	transform: rotate(180deg);
}

/* The drive header on the surfaces the sync and mount pages use: one bordered
   bar that stays at the top of the view, with its controls on .pg-btn's 40px
   floor and a rule between them and the account. */
.drive-header {
	position: sticky;
	top: 0;
	z-index: 30;
	display: flex;
	align-items: center;
	gap: 16px;
	height: 56px;
	flex: none;
	padding: 0 32px;
	background-color: var(--bg);
	/* transparent until the view is under it: a page too short to scroll has no timeline,
	   and a colour here would show on those pages and nowhere else */
	border-bottom: 1px solid transparent;
}

/* the trigger sits at the right end of its bar at every width, so its menu hangs from
   that edge: left aligned it opened past the window */
.drive-header .upload .dropdown__content {
	right: 0;
	left: auto;
}

/* the rule marks the moment the view passes under the bar, not the bar itself. Only where
   it pins: on a phone it wraps and scrolls away, and there the plain rule separates it */
@media (min-width: 1025px) {
	@supports (animation-timeline: scroll()) {
		.drive-header {
			animation: drive-header-stuck linear both;
			animation-timeline: scroll(nearest block);
			animation-range: 0 2px;
		}

		@keyframes drive-header-stuck {
			to {
				border-bottom-color: var(--border-color);
			}
		}
	}
}

.drive-header .drive-tools {
	display: flex;
	align-items: center;
	gap: 10px;
	flex: none;
	margin-left: auto;
	padding: 0;
}

/* The two glyph buttons hold their ink inside their own padding; the filled one's box is
   its ink. Without this the eye reads a wider gap between the two glyphs than between the
   last glyph and the box, though the boxes are evenly spaced. The margin is that padding. */
.drive-header .drive-tools .upload {
	margin-left: 10px;
}

/* The sort control is a dropdown, so its button sits a level deeper than the toggle and the
   search beside it. Named here as well, or it keeps the header's own colour and size and
   stands out white against two muted neighbours. */
.drive-header .drive-tools > .app-button,
.drive-header .drive-tools > .sort > .app-button {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	padding: 0;
	color: var(--pg-muted);
	border: 0;
	border-radius: var(--radius-control);
}

.drive-header .drive-tools > .app-button:hover,
.drive-header .drive-tools > .sort > .app-button:hover {
	color: var(--color) !important;
	background-color: var(--bg-2);
}

.drive-header .drive-tools > .app-button:focus-visible,
.drive-header .drive-tools > .sort > .app-button:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}

.drive-header .drive-tools > .app-button svg,
.drive-header .drive-tools > .sort > .app-button svg {
	width: 20px;
	height: 20px;
}

/* breadcrumb: the trail was --color-2, which is 1.92:1 on the page */
.drive-breadcrumb {
	display: flex;
	align-items: center;
	gap: 2px;
	min-width: 0;
	padding: 0;
	color: var(--pg-muted);
	overflow: hidden;
}

.drive-breadcrumb .app-button {
	padding: 7px 10px;
	font-size: 15px;
	font-weight: var(--regular);
	color: var(--pg-muted);
	border-radius: var(--radius-control);
	white-space: nowrap;
}

/* a touch screen keeps :hover on whatever was tapped last, which left a name lit up */
@media (hover: hover) {
	.drive-breadcrumb .app-button:hover {
		color: var(--color) !important;
		background-color: var(--bg-2);
	}
}

/* and the button's own hover brightens the text, so a touch screen keeps each name its colour */
@media (hover: none) {
	.drive-breadcrumb .app-button:hover {
		color: var(--pg-muted) !important;
	}

	.drive-breadcrumb .breadcrumb__item--current:hover {
		color: var(--color) !important;
	}
}

.drive-breadcrumb .breadcrumb__root {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	flex: none;
	padding: 0;
}

.drive-breadcrumb .breadcrumb__root svg {
	width: 22px;
	height: 22px;
}

/* at the top, the globe is where you are, so it takes the current folder's solid colour */
.drive-breadcrumb .breadcrumb__root--current,
.drive-breadcrumb .breadcrumb__root--current:hover {
	color: var(--color) !important;
}

/* A name squeezed below its padding drew over the next one, so each keeps to its own box */
.drive-breadcrumb .breadcrumb__crumb {
	display: flex;
	align-items: center;
	gap: 2px;
	min-width: 0;
	flex-shrink: 10;
	overflow: hidden;
}

/* short of room, a name other than the current folder keeps enough to show a letter and its
   separator; a trail with room needs no floor, which would pad out a one letter name */
.drive-breadcrumb--tight .breadcrumb__crumb {
	min-width: 56px;
}

/* When the trail is short of room, the folder you are in is the last to give way. The others
   take ten times the share rather than it taking a tenth: once they are down to nothing, a
   shrink factor under one only ever gives up that fraction of the overflow, and a long name ran
   off the screen uncut. The ellipsis does not give way at all, or there is nothing to tap. */
.drive-breadcrumb .breadcrumb__crumb--current,
.drive-breadcrumb--tight .breadcrumb__crumb--current {
	min-width: 0;
	flex-shrink: 1;
}

.drive-breadcrumb .breadcrumb__crumb--more {
	flex: none;
}

.drive-breadcrumb .breadcrumb__more {
	flex: none;
	padding: 7px 10px;
	border: 0;
	border-radius: var(--radius-control);
	background-color: transparent;
	color: var(--pg-muted);
	font-family: inherit;
	font-size: 15px;
	line-height: 1;
	cursor: pointer;
}

.drive-breadcrumb .breadcrumb__more:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}

@media (hover: hover) {
	.drive-breadcrumb .breadcrumb__more:hover {
		color: var(--color);
		background-color: var(--bg-2);
	}
}

.drive-breadcrumb .breadcrumb__separator {
	width: 16px;
	flex: none;
	color: var(--color-2);
}

.drive-breadcrumb .breadcrumb__item {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}

.drive-breadcrumb .breadcrumb__item--current {
	color: var(--color);
	font-weight: var(--bold);
}

/* expanded, every name is shown whole and the trail wraps onto as many lines as it needs,
   the way a tile's name opens when tapped */
.drive-breadcrumb--expanded {
	flex-wrap: wrap;
	overflow: visible;
}

.drive-breadcrumb--expanded .breadcrumb__item {
	overflow: visible;
	white-space: normal;
	overflow-wrap: anywhere;
	text-align: left;
}

/* The bar is one 56px row with everything centred in it, so a trail that wraps grew out of it
   both ways and its first line rose. Opened, the bar grows with the trail instead, everything
   held at the top where the centred row had it: (56 - 40) / 2. */
@media (min-width: 1025px) {
	.drive-header.drive-header--path-open {
		height: auto;
		min-height: 56px;
		align-items: flex-start;
		padding-top: 8px;
		padding-bottom: 8px;
	}
}

@media screen and (max-width: 1024px) {
	/* wrapped lines read as one trail when they sit close; the phone's full height tap target
	   spaced them 49px apart. Doubled class to outrank that rule, the more specific otherwise. */
	.drive-breadcrumb.drive-breadcrumb--expanded .breadcrumb__item {
		padding-top: 5px;
		padding-bottom: 5px;
	}

	/* the first line then sits where the centred single line did: half the 6px taken off each
	   name, plus the half pixel the row's centring had */
	.drive-header .drive-breadcrumb.drive-breadcrumb--expanded {
		padding-top: 3.5px;
		padding-bottom: 3.5px;
	}
}

/* .app-button carries a 2px transparent border, which leaves the fill 4px shorter
   than the outlined controls beside it even though both boxes are 40px. Colouring
   the border with the fill is what .pg-btn--primary does. */
.drive-header .upload .app-button {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	width: auto;
	height: 40px;
	padding: 0 8px 0 10px;
	line-height: 1;
	border: 1px solid var(--pg-primary);
	border-radius: var(--radius-control);
}

.drive-header .upload .app-button:hover {
	border-color: var(--pg-primary-hover);
}

.drive-header .upload svg {
	width: 20px;
	height: 20px;
}

/* the caret is the smaller of the two: the plus is the action, the caret only
   says there is a menu behind it */
.drive-header .upload .app-button > svg:last-child {
	width: 14px;
	height: 14px;
}

@media screen and (max-width: 1024px) {
	.drive-header {
		position: static;
		flex-wrap: wrap;
		flex-direction: row;
		height: auto;
		gap: 0;
		padding: 0;
	}

	/* no blanket width here: it becomes the flex basis and wraps the account onto
	   its own row. The breadcrumb asks for the full row itself. */
	.drive-header > * {
		min-height: 56px;
		padding: 0 16px;
	}

	/* at the end of their row, where the desktop keeps them and where a thumb reaches:
	   the account sits on the bar above, so this row is the tools' own */
	.drive-header .drive-tools {
		flex: 1 1 auto;
		order: 1;
		margin-left: auto;
		/* the same 16px the account keeps above it, so the two bars end on one line */
		padding: 0 16px;
		justify-content: flex-end;
	}

	.drive-header .drive-breadcrumb {
		order: 3;
		flex: 1 0 100%;
		min-height: 52px;
		/* its buttons carry 10px of their own, which lands the trail's first word on the
		   16px the title above it starts from */
		padding: 0 6px;
		border-top: 1px solid var(--border-color);
	}

	/* a finger needs more than a mouse, as .pg-btn already allows for */
	.drive-header .drive-tools > .app-button,
	.drive-header .drive-tools > .sort > .app-button {
		width: 48px;
		height: 48px;
	}

	/* the same allowance, against the larger padding a 48px target gives its glyph */
	.drive-header .drive-tools .upload {
		margin-left: 14px;
	}

	.drive-header .upload .app-button {
		height: 48px;
	}

	.drive-breadcrumb .app-button {
		padding: 11px 10px;
	}

	.drive-breadcrumb .breadcrumb__root {
		width: 44px;
		height: 44px;
	}
}
</style>
