<template>
	<header class="app-header">
		<div class="primary">
			<slot name="primary"></slot>
		</div>
		<UserSettings />
	</header>
</template>

<script>
const UserSettings = require("./UserSettings.vue");

module.exports = {
	components: {
		UserSettings
	}
}
</script>

<style>
.app-header {
	display: flex;
	justify-content: flex-start;
	align-items: center;
}


.app-header .primary{
	padding: 4px 32px;
	color: var(--color-2);
}


@media screen and (max-width: 1024px) {
	.app-header {
		flex-wrap: wrap;
		flex-direction: row;
	}
	.app-header > * {
		width:100%;
		min-height: 64px;
		padding: 0 16px;
	}

	/* the view's name reads the same here as on a desktop: at the head of the bar with
	   the account at the other end, rather than leaving a phone to guess where it is */
	.app-header .primary{
		display: flex;
		align-items: center;
		order: 1;
		width: auto;
		flex: 1 1 auto;
		min-width: 0;
		padding: 0 16px;
	}

	/* a name longer than the bar is cut rather than pushing the account off it */
	.app-header .primary h1{
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.app-header .user-settings{
		order: 3;
		flex: 0 0 auto;
		width: auto;
		justify-content: flex-end;
		margin-right: 0;
	}

}
</style>
