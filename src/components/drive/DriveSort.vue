<template>
	<div class="drive-sort">
		<button v-for="col in columns" :key="col.key"
			class="drive-sort__chip" :class="{sorted: sortBy == col.key}"
			:aria-pressed="sortBy == col.key ? 'true' : 'false'"
			@click="$emit('sortBy', col.key)"
		>{{ translate(col.label) }}<AppIcon
			v-if="sortBy == col.key" class="sort-caret"
			:class="{'sort-caret--asc': normalSortOrder}" icon="chevron-down"/></button>
	</div>
</template>

<script>
const AppIcon = require("../AppIcon.vue");
const i18n = require("../../i18n/index.js");
const columns = require("./columns.js");

module.exports = {
	components: {
		AppIcon
	},
	mixins: [i18n],
	data() {
		return {
			columns,
		};
	},
	props: {
		// the property the listing is ordered by, and whether that order is ascending: the
		// same state the table's headings show and set, not a second copy of it
		sortBy: {
			type: String,
			default: "name"
		},
		normalSortOrder: {
			type: Boolean,
			default: true
		}
	}
}
</script>

<style>
/* The grid has no headings to sort by, so it wears the strip of chips the list already
   turns its own headings into on a phone - see .pg-table thead at 1024px in the shared
   stylesheet. The look is stated again here rather than shared with that rule, which
   three other tables depend on and which only exists inside that width. */
.drive-sort {
	display: flex;
	align-items: center;
	/* the drive lays its content out as a column and the listing under this takes what is
	   left; without this the strip is what gives way when the window is short */
	flex: none;
	gap: 6px;
	padding: 8px 32px;
	overflow-x: auto;
	/* a chip strip scrolls without a bar of its own */
	scrollbar-width: none;
	border-bottom: 1px solid var(--border-color);
}

.drive-sort::-webkit-scrollbar {
	height: 0;
}

.drive-sort__chip {
	display: flex;
	align-items: center;
	flex: none;
	min-height: 44px;
	padding: 0 12px;
	font: inherit;
	font-size: var(--text-small);
	color: var(--pg-muted);
	background-color: var(--bg);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-pill);
	cursor: pointer;
}

.drive-sort__chip.sorted {
	color: var(--color);
	background-color: var(--bg-2);
	border-color: var(--pg-border-strong);
}

.drive-sort .sort-caret {
	width: 12px;
	height: 12px;
	margin-left: 4px;
}

.drive-sort .sort-caret--asc {
	transform: rotate(180deg);
}

/* the grid's own gutter is narrower on a phone, and the strip keeps to it */
@media (max-width: 1024px) {
	.drive-sort {
		padding: 8px 12px;
	}
}

/* Over the list, only where its headings are hidden. A table wide enough to show them
   sorts from them, and a strip saying the same thing above would be a second control for
   one state - the headings even carry the same caret. The grid has no headings at any
   width, so this never touches it. */
@media (min-width: 1025px) {
	.drive-sort--list {
		display: none;
	}
}
</style>
