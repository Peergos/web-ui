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
	provide() {
		return {
			registerTab: tab => this.tabs.push(tab),
			unregisterTab: tab => {
				let i = this.tabs.indexOf(tab);
				if (i >= 0)
					this.tabs.splice(i, 1);
			},
		};
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

/* on a phone three labels in a longer language (Greek, German) outgrow 30px a side, and the
   last tab ran off the screen */
@media (max-width: 480px) {
	.app-tabs .tabs__header > li {
		padding: 15px 10px;
	}
}

@media (max-width: 360px) {
	.app-tabs .tabs__header > li {
		padding: 15px 6px;
		font-size: var(--text-small);
	}
}

.app-tabs .tabs__header > li.active {
	border-radius: 4px 4px 0 0;
	background-color: var(--bg);
}

</style>
