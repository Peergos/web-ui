<template>
	<header class="app-header">
		<div class="primary">
			<slot class="" name="primary"></slot>
		</div>
		<div class="tools">
			<slot name="tools"></slot>
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

.app-header .tools{
	flex:1 0 auto;
	display: flex;
	justify-content: flex-end;
	align-items: center;
	padding: 0 32px;

}

.app-header .tools > *{
	margin-right: 16px;
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

	.app-header .primary{
		display:none;
		/* order: 3;
		flex:1 0 100%;
		padding: 8px 16px;
		border-top: 1px solid var(--border-color); */
	}

	.app-header .tools{
		flex:0 1 50%;
		order: 1;
		margin-left: 0;
		padding: 0 16px;
		justify-content: flex-start;

	}

	.app-header .user-settings{
		order: 2;
		flex: 0 1 50%;
		justify-content: flex-end;
		margin-right: 0;
	}

}
</style>
