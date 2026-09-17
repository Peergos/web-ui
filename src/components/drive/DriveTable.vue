<template>
	<table class="drive-table pg-table">
		<thead>
			<tr>
                <th class="select"></th>
                                <th class="glyph"></th>
				<th v-for="col in columns" :key="col.key" :class="[col.cls, {sorted: sortBy == col.key}]"
					:aria-sort="ariaSortOf(sortBy, col.key, normalSortOrder)" @click="$emit('sortBy', col.key)">{{ translate(col.label) }}<AppIcon
					v-if="sortBy == col.key" class="sort-caret" :class="{'sort-caret--asc': normalSortOrder}" icon="chevron-down"/></th>
				<th class="menu"/>
            </tr>
		</thead>
		<tbody role="presentation">
			<tr v-for="file in files" tabindex="1" role="row" class="table__item" :class="{ 'is-selected': selectedSet.has(file) }">
                <td class="select">
                    <label class="checkbox__group">
                        <input
                        type="checkbox"
                        :name="file.getFileProperties().name"
                        v-model="selected"
                        :value="file"
                        tabindex="0"
                        @click.shift="clickShiftHandler"
                        />
                        <span class="checkmark"></span>
                    </label>
                </td>
                <td class="glyph">
                    <img
				class="tablethumb"
				v-if="getThumbnailURL(file)"
				:src="getThumbnailURL(file)"
		    />
                    <AppIcon v-else class="card__icon" :icon="cardIcon(file)" />
                </td>
				<td class="file"
					:id="file.getFileProperties().name"
					@click="$emit('navigateDrive', file)"
				>
					<span class="table__name" :title="file.getFileProperties().name">{{ file.getFileProperties().name }}</span>
					<ShareMark class="table__shared" :kind="shareKinds[file.getFileProperties().name]"/>
				</td>
				<td class="size" v-if="!file.isWrapper && !file.isDirectory()">{{ convertBytesToHumanReadable(getFileSize(file.getFileProperties())) }}</td>
				<td class="size" v-if="!file.isWrapper && file.isDirectory()">{{ file.directChildrenCount }} items</td>
				<td class="size" v-if="file.isWrapper">Loading...</td>
				<td class="type">{{ file.getFileProperties().getType() }}</td>
				<td class="date modified">{{ formatDateTime(file.getFileProperties().modified) }}</td>
				<td class="date created">{{ formatDateTime(file.getFileProperties().created) }}</td>
				<td class="menu">
					<AppButton
						class="table__menu"
						icon="dot-menu"
						aria-label="menu"
						@click.stop.native="showMenu($event, file)"
					/>
				</td>
			</tr>
		</tbody>
	</table>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppIcon = require("../AppIcon.vue");
const ShareMark = require("./ShareMark.vue");
const mixins = require("../../mixins/downloader/index.js");
const i18n = require("../../i18n/index.js");
const fileIcon = require("../../mixins/fileicon/index.js");
const sortColumn = require("../../mixins/sortcolumn/index.js");

module.exports = {
	components: {
	    AppButton,
	    AppIcon,
	    ShareMark
	},
	props: {
		files: {
			type: Array,
			default: ()=>[]
		},
        selectedFiles: {
            type: Array,
            default: ()=>[]
        },
        // the view owns the sort and knows what is shared; the table only shows it
        sortBy: {
            type: String,
            default: null
        },
        normalSortOrder: {
            type: Boolean,
            default: true
        },
        // name -> "" | "people" | "link" | "people link"
        shareKinds: {
            type: Object,
            default: ()=>({})
        },
	},
    mixins:[mixins, i18n, fileIcon, sortColumn],
    data: function () {
        return {
            selected: this.selectedFiles,
            isShiftModifierOn: false,
            columns: [
                {key: "name", cls: "file", label: "DRIVE.NAME"},
                {key: "size", cls: "size", label: "DRIVE.SIZE"},
                {key: "type", cls: "type", label: "DRIVE.TYPE"},
                {key: "modified", cls: "date", label: "DRIVE.MODIFIED"},
                {key: "created", cls: "date", label: "DRIVE.CREATED"},
            ],
        }
    },
    computed: {
        // a set, not indexOf per row: a folder with thousands of files would
        // otherwise scan the selection once for every row it draws
        selectedSet() {
            return new Set(this.selected);
        }
    },
    watch: {
        selected(newSelected, oldSelected) {
              if (this.isShiftModifierOn && newSelected.length == oldSelected.length +1) {
                  if(newSelected != this.selectedFiles){
                      let difference = newSelected.filter(x => !oldSelected.includes(x))[0];
                      let newIndex = this.files.indexOf(difference);
                      var largestIndex = -1;
                      for(var i=0; i < newSelected.length; i++) {
                          let index = this.files.indexOf(newSelected[i]);
                          if (index < newIndex && index > largestIndex) {
                              largestIndex = index;
                          }
                      }
                      let selectedWithShift = newSelected.concat(this.files.slice(largestIndex +1, newIndex));
                      this.$emit('update:selectedFiles', selectedWithShift);
                  }
              } else {
                  if(newSelected != this.selectedFiles){
                      this.$emit('update:selectedFiles', newSelected)
                  }
              }
        },
        selectedFiles(newSelected, oldSelected){
            this.selected = newSelected;
            this.isShiftModifierOn = false;
        }
    },
    methods: {

        clickShiftHandler() {
            this.isShiftModifierOn = true;
        },

		getThumbnailURL(file) {
			// cache thumbnail to avoid recalculating it
			if (file.thumbnail != null)
				return file.thumbnail;
			var thumb = file.getBase64Thumbnail();
			file.thumbnail = thumb;
			return thumb;
		},

                cardIcon(file){
                        return this.fileIcon(file.getFileProperties().getType());
		},

		showMenu(e, file){
			// https://stackoverflow.com/questions/53738919/emit-event-with-parameters-in-vue/53739018
			this.$store.commit('SET_DRIVE_MENU_TARGET', e.currentTarget)
			this.$emit('openMenu', file)
		},

		formatDateTime(dateTime) {
			let date = new Date(dateTime.toString() + "+00:00"); //adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
			let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
				+ ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
				+ ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
				+ ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
			return formatted;
		},
        convertBytesToHumanReadable:function(bytes) {
            if (bytes < 1000)
                return bytes + " Bytes";
            if (bytes < 1000 * 1000)
                return this.roundToDisplay(bytes / 1000) + " KB";
            if (bytes < 1000 * 1000 * 1000)
                return this.roundToDisplay(bytes / 1000 / 1000) + " MB";
            return this.roundToDisplay(bytes / 1000 / 1000 / 1000) + " GB";
        },
        roundToDisplay:function(x) {
                return Math.round(x * 100) / 100;
        },
	},

}
</script>

<style>
/* The list keeps its shape and takes the flat side of the status cards. The
   shared parts - header strip, labels, hairlines, caret - are .pg-table; here are
   this table's own columns, row height and cells, with the thumbnail the drive
   has always shown. */
.drive-table {
	min-width: 1024px;
}

.drive-table thead tr {
	/* under the header, which pins at the top of the view */
	top: 56px;
}

/* with a selection there are two bars above it, not one */
.drive-view--selecting .drive-table thead tr {
	top: 112px;
}

.drive-table tbody tr {
	height: 48px;
	line-height: normal;
	transition: background-color 0.15s ease;
}

.drive-table tbody tr:focus {
	background-color: var(--bg-2);
}

/* the tick says which rows are in the selection; the tint says how many at a
   glance, which is what the count at the top is for */
.drive-table tbody tr.is-selected,
.drive-table tbody tr.is-selected:hover {
	background-color: var(--pg-tint-ok);
}

.drive-table tbody tr:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: -2px;
}

.drive-table th.select,
.drive-table td.select {
	width: 62px;
	padding: 0 10px 0 32px;
}

/* the app's checkbox keeps its face; the label around it stops being a 32px
   indent with a bottom margin inside a 48px row */
.drive-table .checkbox__group {
	display: block;
	width: 20px;
	height: 20px;
	padding: 0;
	margin: 0;
}

.drive-table th.glyph,
.drive-table td.glyph {
	width: 52px;
	padding: 0 8px 0 0;
}

.drive-table td.glyph .card__icon {
	display: block;
	width: 26px;
	height: 26px;
	margin: 0 auto;
	color: var(--pg-muted);
}

.tablethumb {
	display: block;
	width: 36px;
	height: 36px;
	margin: 0 auto;
	object-fit: cover;
	object-position: center center;
	border-radius: var(--radius-control);
}

.drive-table td.file {
	display: flex;
	align-items: center;
	height: 48px;
	min-width: 0;
	cursor: pointer;
}

.table__name {
	min-width: 0;
	font-size: 15px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.table__shared {
	margin-left: 10px;
}

.drive-table .size,
.drive-table .type,
.drive-table .date {
	font-size: 13px;
	color: var(--pg-muted);
	white-space: nowrap;
}

.drive-table th.size,
.drive-table td.size {
	width: 110px;
	text-align: right;
	font-variant-numeric: tabular-nums;
}

.drive-table th.type,
.drive-table td.type {
	width: 160px;
}

.drive-table th.date,
.drive-table td.date {
	width: 170px;
	font-variant-numeric: tabular-nums;
}

.drive-table th.menu,
.drive-table td.menu {
	width: 64px;
	padding: 0 32px 0 0;
	text-align: right;
}

.drive-table .table__menu {
	width: 32px;
	height: 32px;
	padding: 0;
	color: var(--pg-muted);
	border-radius: var(--radius-control);
	transition: opacity 0.15s ease;
	opacity: 0;
}

.drive-table .table__menu svg {
	width: 20px;
	height: 20px;
}

.drive-table tbody tr:hover .table__menu,
.drive-table tbody tr:focus .table__menu,
.drive-table tbody tr:focus-within .table__menu {
	opacity: 1;
}

/* A phone is narrower than any five columns: the row keeps its cells and lays
   them out in two lines instead of scrolling sideways at 1024px. */
@media (max-width: 1024px) {
	/* .pg-table lays the table out in blocks here and turns the head into the strip of
	   chips that is the only way left to sort; what follows is this list's own part of
	   that: the width it may take, which chips it keeps, and how a row lays out */
	.drive-table {
		width: 100%;
		min-width: 0;
	}

	.drive-table thead th {
		flex: none;
		height: auto;
		min-height: 44px;
		padding: 0 12px;
		display: flex;
		align-items: center;
		color: var(--pg-muted);
		background-color: var(--bg);
		border: 1px solid var(--border-color);
		border-radius: var(--radius-pill);
	}

	/* a chip is as wide as its label. The column widths above are the list's, and a
	   chip is not a column - they are named here because .drive-table th.size and
	   its neighbours outrank a plainer selector */
	.drive-table thead th.file,
	.drive-table thead th.size,
	.drive-table thead th.type,
	.drive-table thead th.date {
		width: auto;
	}

	.drive-table thead th.select,
	.drive-table thead th.glyph,
	.drive-table thead th.menu {
		display: none;
	}

	.drive-table tbody tr {
		display: grid;
		grid-template-columns: 40px 44px auto minmax(0, 1fr) 48px;
		grid-template-areas:
			"sel glyph name name menu"
			"sel glyph size mod  menu";
		align-items: center;
		column-gap: 8px;
		height: auto;
		min-height: 64px;
		padding: 8px 12px;
	}

	.drive-table td {
		padding: 0;
	}

	.drive-table td.select {
		grid-area: sel;
		width: auto;
		padding: 0;
	}

	.drive-table td.glyph {
		grid-area: glyph;
		width: auto;
	}

	.drive-table td.file {
		grid-area: name;
		height: auto;
	}

	.drive-table td.size {
		grid-area: size;
		width: auto;
		text-align: left;
	}

	/* modified keeps its place beside the size; type and created are the two a
	   phone has no room for */
	.drive-table td.modified {
		grid-area: mod;
		width: auto;
	}

	.drive-table td.type,
	.drive-table td.created {
		display: none;
	}

	.drive-table td.menu {
		grid-area: menu;
		width: auto;
		padding: 0;
	}

	.drive-table .table__menu {
		width: 48px;
		height: 48px;
		opacity: 1;
	}

	/* the tick keeps its 20px face inside a target a thumb can hit, the way
	   .pg-switch reaches 44px without growing */
	.drive-table .checkbox__group {
		position: relative;
	}

	.drive-table .checkbox__group:after {
		content: "";
		position: absolute;
		top: -12px;
		right: -12px;
		bottom: -12px;
		left: -12px;
	}
}
</style>
