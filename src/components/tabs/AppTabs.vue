<template>
	<div class="app-tabs">
		<ul class="tabs__header" role="tablist" @keydown="moveFocus">
			<li
				v-for="(tab, index) in tabs"
				:key="tab.title"
				role="presentation"
				:class="{ active: index == selectedIndex }"
			>
				<button type="button" role="tab" :aria-selected="index == selectedIndex ? 'true' : 'false'"
				        :tabindex="index == selectedIndex ? 0 : -1" @click="selectTab(index)">
					{{ tab.title }}
				</button>
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
		// as tabs are expected to: the arrows, Home and End move between them, and only the
		// chosen one is in the tab order, so Tab goes on to its form. Moving doesn't open a tab
		// (Enter or Space does): an opened form takes the focus for its first field, which
		// would leave the next arrow press in that field.
		moveFocus(e) {
			let buttons = [...this.$el.querySelectorAll('.tabs__header button')];
			let at = buttons.indexOf(document.activeElement);
			let last = buttons.length - 1;
			let next = {ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: last}[e.key];
			if (at < 0 || next == null)
				return;
			e.preventDefault();
			buttons[next < 0 ? last : next > last ? 0 : next].focus();
		},
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
/* The way in: one card holding sign in, mirror and sign up, chosen with tabs across its top.
   The chosen tab is the card's own colour and runs into it. */
.app-tabs {
	max-width: 440px;
	margin: 0 auto;
	box-sizing: border-box;
	color: var(--color);
	background-color: var(--bg);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-container);
	box-shadow: var(--pg-shadow);
}

/* the card's corner less its border, so the strip and the tabs fill the corner exactly */
.app-tabs .tabs__header {
	display: flex;
	margin: 0;
	padding: 0;
	list-style: none;
	background-color: var(--pg-surface-2);
	border-radius: calc(var(--radius-container) - 1px) calc(var(--radius-container) - 1px) 0 0;
}

/* each as wide as its label needs, and no narrower: a longer word in one language (the
   Greek for Mirror) takes room from the shorter two instead of running out of its own */
.app-tabs .tabs__header > li {
	flex: 1 1 auto;
	min-width: 0;
}

.app-tabs .tabs__header button {
	width: 100%;
	min-height: 52px;
	padding: 0 16px;
	border: 0;
	border-radius: calc(var(--radius-container) - 1px) calc(var(--radius-container) - 1px) 0 0;
	background-color: transparent;
	color: var(--color);
	font-family: inherit;
	font-size: var(--text);
	font-weight: var(--bold);
	white-space: nowrap;
	cursor: pointer;
}

.app-tabs .tabs__header > li.active button {
	background-color: var(--bg);
}

.app-tabs .tabs__header button:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: -4px;
}

.app-tabs .tab {
	padding: 0 24px 24px;
}

@media (max-width: 480px) {
	.app-tabs .tabs__header button {
		min-height: 48px;
		padding: 0 10px;
	}

	.app-tabs .tab {
		padding: 0 16px 16px;
	}
}

@media (max-width: 360px) {
	.app-tabs .tabs__header button {
		padding: 0 6px;
		font-size: var(--text-small);
	}
}
</style>
