<template>
	<div class="form-autocomplete">
		<div v-if="!isMultiple">
			<input id="input-tokenfield"
				class="autocomplete pg-input"
				v-if="!value"
				v-model="textSearch"
				type="text"
				:placeholder="placeholder"
				@focus="showOptions"
				@blur="hideOptions"
				@keyup.esc="hideOptions"
			/>
			<div class="items-selected">
				<div class="item-selected" v-if="value">
					<slot name="selected" :item="value">{{ value }}</slot>
					<AppButton icon="close" @click.native="clearItem" />
				</div>
			</div>
			<ul class="options pg-menu" v-show="isOpen">
				<li v-for="item in filteredOptions" @mousedown.prevent @click="selectItem(item)">
					<slot :item="item">{{ item }}</slot>
				</li>
				<li v-if="filteredOptions.length === 0" class="options__empty">{{ translate("SOCIAL.NOTFOUND") }}</li>
			</ul>
		</div>
		<div v-else>
			<input id="input-tokenfield"
				class="autocomplete pg-input"
				v-model="textSearch"
				type="text"
				:placeholder="placeholder"
				@focus="showOptions"
				@blur="hideOptions"
				@keyup.esc="hideOptions"
			/>
			<div class="items-selected">
				<div class="item-selected" v-for="(v, k) in value">
					<slot name="selected" :item="v">{{ v }}</slot>
					<!-- <button @click="removeItem(k)">remove</button> -->
					<AppButton icon="close" @click.native="removeItem(k)" />
				</div>
			</div>
			<ul class="options pg-menu" v-show="isOpen">
				<li
					v-for="item in filteredOptions"
					:class="{ disabled: inSelectedItems(item) }"
					@mousedown.prevent
					@click="addItem(item)"
				>
					<slot :item="item">{{ item }}</slot>
				</li>
				<li v-if="filteredOptions.length === 0" class="options__empty">{{ translate("SOCIAL.NOTFOUND") }}</li>
			</ul>
		</div>
	</div>
</template>

<script>
const AppButton = require("../AppButton.vue");
const i18n = require("../../i18n/index.js");
module.exports = {
	components: {
	    AppButton,
	},
	mixins: [i18n],
	props: {
		isMultiple: {
			type: Boolean,
			default: false,
		},
		placeholder: {
			type: String,
			default: "",
		},
		maxitems: {
			type: Number,
			default: 5,
		},
		minchars: {
			type: Number,
			default: 1,
		},
		options: {
			type: Array,
			default() {
				return [];
			},
		},
		value: {
			type: [Object, Array],
			// default() {
			// 	return {
			// 		uid: undefined,
			// 		title: undefined,
			// 	};
			// },
		},
	},
	data() {
		return {
			textSearch: "",
			isShow: false,
		};
	},
	computed: {
	    filteredOptions() {
                if (! this.doSearch)
                    return [];
                let search = this.textSearch.toLowerCase();
                let filter = (val) => {
                    let lower = val.toLowerCase();
                    for (var i=0; i < search.length; i++){
                        if (! val.includes(search.charAt(i)))
                            return false;
                    }
                    return true;
                };
		let filtered = this.options.filter(filter);
                let sorted = filtered.sort((a, b) => this.levenshtein(a, search) - this.levenshtein(b, search));
                return sorted.slice(0, Math.min(sorted.length, this.maxitems));
	    },
	    selectedItems() {
		if (this.isMultiple) {
		    return this.value.map((v) => v);
		}
		return [];
	    },
            doSearch() {
                return this.textSearch.length >= this.minchars;
            },
            /* open only with the caret in the field and something typed to match: on focus
               alone an empty field opened a list whose only row said nothing was found */
            isOpen() {
                return this.isShow && this.doSearch;
            }
	},
	methods: {
		inSelectedItems(uid) {
			return this.selectedItems.includes(uid);
		},
		showOptions() {
			this.isShow = true;
		},
		hideOptions() {
			this.isShow = false;
		},
		selectItem(item) {
			this.textSearch = "";
			this.isShow = false;
			// this.$emit('update:item', item);
			this.$emit("input", item);
			this.$emit("onSelectItem", item);
		},
		clearItem() {
			this.textSearch = "";
			// this.$emit('update:item', {
			//   id: undefined,
			//   title: undefined,
			// });
			this.$emit("input", {
				// id: undefined,
				// title: undefined,
			});
			this.$emit("onClearItem");
		},
		addItem(item) {
			if (!this.inSelectedItems(item)) {
				this.textSearch = "";
				this.isShow = false;
				const items = JSON.parse(JSON.stringify(this.value));
				items.push(item);
				// this.$emit('update:item', items);
				this.$emit("input", items);
				this.$emit("onAddItem", items);
			}
		},
		removeItem(index) {
			this.textSearch = "";
			const items = JSON.parse(JSON.stringify(this.value));
			items.splice(index, 1);
			// this.$emit('update:item', items);
			this.$emit("input", items);
			this.$emit("onRemoveItem", items);
		},
            levenshtein: function(a, b) {
                var d = [];                
                var n = a.length;
                var m = b.length;
                
                if (n == 0) return m;
                if (m == 0) return n;
                
                for (var i = n; i >= 0; i--) d[i] = [];                
                for (var i = n; i >= 0; i--) d[i][0] = i;
                for (var j = m; j >= 0; j--) d[0][j] = j;
                
                for (var i = 1; i <= n; i++) {
                    var a_i = a.charAt(i - 1);
                    
                    for (var j = 1; j <= m; j++) {
                        // check the jagged ld total so far
                        if (i == j && d[i][j] > 4) return n;
                        
                        var b_j = b.charAt(j - 1);
                        var cost = (a_i == b_j) ? 0 : 1;
                        
                        // get minimum
                        var mi = d[i - 1][j] + 1;
                        var x = d[i][j - 1] + 1;
                        var y = d[i - 1][j - 1] + cost;
                        
                        if (x < mi) mi = x;
                        if (y < mi) mi = y;
                        
                        d[i][j] = mi;
                        
                        //Damerau transposition
                        if (i > 1 && j > 1 && a_i == b.charAt(j - 2) && a.charAt(i - 2) == b_j) {
                            d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
                        }
                    }
                }
                
                return d[n][m];
            }
	},
};
</script>

<style>
.form-autocomplete {
	position: relative;
	margin-bottom: var(--app-margin);
}


/* the results hang under the field on .pg-menu, the surface every other list opens on:
   in flow they were a row of bordered boxes that pushed the form down */
.form-autocomplete .options {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	z-index: 40;
	width: 100%;
	margin: 0;
	padding: 6px;
	list-style: none;
}

.form-autocomplete .options > li.options__empty {
	color: var(--pg-muted);
	cursor: default;
}

.form-autocomplete .options > li.options__empty:hover {
	background-color: transparent;
}

.form-autocomplete .options > li.disabled,
.form-autocomplete .options > li.disabled:hover {
	display: none;
}

.form-autocomplete .items-selected {
	margin-top: 0px;
}
.form-autocomplete .item-selected {
	border-radius: 4px;
	display: inline-block;
	padding: 5px;
	background: var(--bg-2);
	color:var(--color);
	margin: 0 5px 10px 0;
}
</style>
