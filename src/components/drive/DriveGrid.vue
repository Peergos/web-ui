<template>
	<div class="drive-grid">
		<slot/>
	</div>
</template>

<script>
module.exports = {

}
</script>

<style>
.drive-grid {
	display: grid;
	grid-gap: 32px;
	grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));

	width: 100%;
	padding: 0 var(--app-margin);

	margin-top: 24px;

	transition: all 0.4s ease;
}
/*
.drive-grid.with-sidebar-margin {
	margin-left: 256px;
	width: calc(100% - 240px);
} */

@media (max-width: 1024px) {
	.drive-grid{
		margin-left: 0;
		width: 100%;
	}

	.drive-grid  {
		width: 100%;
		grid-template-columns: 1fr 1fr;
		grid-gap: 16px;
	}
}
</style>