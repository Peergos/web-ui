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
	grid-gap: 12px;
	grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));

	width: 100%;
	flex: 1 1 auto;
	min-height: 0;
	padding: 16px 32px 24px;
	margin-top: 0;
	align-content: start;
	/* each tile keeps its own height, so one with an opened name grows alone rather than
	   stretching everything beside it */
	align-items: start;
}

/* when the drop target stands in for the folder's contents there is no grid to draw */
.drive-grid--empty {
	display: none;
}

@media (max-width: 1024px) {
	.drive-grid {
		width: 100%;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		grid-gap: 10px;
		padding: 10px 16px 16px;
	}
}
</style>