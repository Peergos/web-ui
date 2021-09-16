<template>
	<div class="form-autocomplete">
		<div v-if="!isMultiple">
			<input
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
			<input
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
				<li v-if="filteredOptions.length === 0">User not found</li>
			</ul>
		</div>
	</div>
</template>

<script>
module.exports = {
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
		let filtered = this.options.filter((val) =>
				                   // val.title.toLowerCase().includes(this.textSearch.toLowerCase())
				                   val.toLowerCase().includes(this.textSearch.toLowerCase())                                                 
			                          );
                return filtered.slice(0, Math.min(filtered.length, this.maxitems));
                    
	    },
	    selectedItems() {
		if (this.isMultiple) {
		    return this.value.map((v) => v);
		}
		return [];
	    },
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
