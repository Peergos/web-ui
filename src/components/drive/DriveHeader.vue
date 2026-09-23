<template>
	<header class="drive-header">

			<nav class="drive-breadcrumb">
				<AppButton v-if="!(path.length >2 && path[1] == '.apps')" class="breadcrumb__root" aria-label="global files" @click.native="$emit('goBackToLevel', 0 )">
					<AppIcon icon="globe--24"/>
					<span v-if="!path.length">global</span>
				</AppButton>

				<template v-if="!(path.length >2 && path[1] == '.apps')" v-for="(dir, index) in path">
					<AppIcon v-if="index!==0" icon="chevron--24" class="breadcrumb__separator" aria-hidden="true"/>
					<AppButton :key="index" class="breadcrumb__item" :aria-label="dir" :title="dir" tabindex="-1" @click.native="$emit('goBackToLevel', index + 1 )">{{ dir }}</AppButton>
				</template>
                <template v-if="path.length >2 && path[1] == '.apps'" v-for="(dir, index) in path">
                    <AppIcon v-if="index>2" icon="chevron--24" class="breadcrumb__separator" aria-hidden="true"/>
                    <AppButton v-if="index>2" :key="index" class="breadcrumb__item" :aria-label="dir" :title="dir" tabindex="-1" @click.native="$emit('goBackToLevel', index + 1 )">{{ dir }}</AppButton>
                    <AppButton v-if="index==2" :key="index" class="breadcrumb__item" :aria-label="dir" :title="dir" tabindex="-1">{{ dir }}</AppButton>
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
        };
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
        ...Vuex.mapState([
            "sandboxedApps"
        ]),
	},
	methods: {
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

.drive-breadcrumb .app-button:hover {
	color: var(--color) !important;
	background-color: var(--bg-2);
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

.drive-breadcrumb .breadcrumb__root span {
	padding-left: 16px;
	font-weight: var(--regular);
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

.drive-breadcrumb .breadcrumb__item:last-child {
	color: var(--color);
	font-weight: var(--bold);
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
