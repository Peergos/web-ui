<template>
	<div class="app-tabs">
		<ul class="tabs__header">
			<li
				v-for="(tab, index) in tabs"
				:key="tab.title"
				@click="selectTab(index)"
				:class="{ active: index == selectedIndex }"
			>
				{{ tab.title }}
			</li>
		</ul>

		<slot></slot>
	</div>
</template>

<script>
module.exports = {
	data() {
		return {
			selectedIndex: 0,
			tabs: [],
		};
	},
	created() {
		this.tabs = this.$children;
	},
	mounted() {
		this.selectTab(0);
	},
	methods: {
		selectTab(i) {
			this.selectedIndex = i;

			this.tabs.forEach((tab, index) => {
				tab.isActive = index === i;
			});
		},
	},
};
</script>

<style>

.app-tabs{
	max-width:500px;
	margin: 0 auto;
	color: var(--color);
	background-color: var(--bg);
}



.app-tabs .tabs__header {
	display: flex;
	list-style: none;
	margin: 0;
	padding: 0;
}

.app-tabs .tabs__header > li {
	padding: 15px 30px;
	cursor: pointer;
	flex-grow: 1;
	font-weight: var(--bold);
	font-size: var(--text);
	text-align: center;
	background-color: var(--bg-2);
}

.app-tabs .tabs__header > li.active {
	border-radius: 4px 4px 0 0;
	background-color: var(--bg);
}

</style>
