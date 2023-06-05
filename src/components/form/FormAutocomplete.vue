<template>
	<div class="form-autocomplete">
		<div v-if="!isMultiple">
			<input id="input-tokenfield"
				class="autocomplete"
				v-if="!value"
				v-model="textSearch"
				type="text"
				:placeholder="placeholder"
				@focus="showOptions"
			/>
			<div class="items-selected">
				<div class="item-selected" v-if="value">
					<slot name="selected" :item="value">{{ value }}</slot>
					<AppButton icon="close" @click.native="clearItem" />
				</div>
			</div>
			<ul class="options" v-show="isShow">
				<li v-for="item in filteredOptions" @click="selectItem(item)">
					<slot :item="item">{{ item }}</slot>
				</li>
				<li v-if="filteredOptions.length === 0">Item not found</li>
			</ul>
		</div>
		<div v-else>
			<input id="input-tokenfield"
				class="autocomplete"
				v-model="textSearch"
				type="text"
				:placeholder="placeholder"
				@focus="showOptions"
			/>
			<div class="items-selected">
				<div class="item-selected" v-for="(v, k) in value">
					<slot name="selected" :item="v">{{ v }}</slot>
					<!-- <button @click="removeItem(k)">remove</button> -->
					<AppButton icon="close" @click.native="removeItem(k)" />
				</div>
			</div>
			<ul class="options" v-show="isShow">
				<li
					v-for="item in filteredOptions"
					:class="{ disabled: inSelectedItems(item) }"
					@click="addItem(item)"
				>
					<slot :item="item">{{ item }}</slot>
				</li>
				<li v-if="filteredOptions.length === 0 && this.doSearch">User not found</li>
			</ul>
		</div>
	</div>
</template>

<script>
const AppButton = require("../AppButton.vue");
module.exports = {
	components: {
	    AppButton,
	},
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
            }
	},
	methods: {
		inSelectedItems(uid) {
			return this.selectedItems.includes(uid);
		},
		showOptions() {
			this.isShow = true;
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
	margin-bottom: var(--app-margin);
}


.form-autocomplete ul {
	/* width: 200px; */
	padding-left: 0;
	display: flex;


}
.form-autocomplete ul > li {
	cursor: pointer;
	list-style: none;
	padding: 5px;
	color:var(--color);
	line-height: 36px;
	border: 2px solid var(--bg-2);
	border-radius: 4px;
	margin: 0 5px 10px 0;
}
.form-autocomplete ul > li:hover {
	background: var(--bg-2);
	color:var(--color);
}
.form-autocomplete ul > li.disabled,
.form-autocomplete ul > li.disabled:hover {
	display:none;
}
.form-autocomplete ul > li.disabled {
	opacity: 0.5;
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
