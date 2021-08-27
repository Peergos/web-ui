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
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));

	width: 100%;
	height: 100%;
	padding: 0 32px;
	margin-top: 32px;
}

@media (max-width: 1024px) {
	.drive-grid  {
		width: 100%;
		grid-template-columns: 1fr 1fr;
		grid-gap: 16px;
		padding: 0 16px;
	}
}
</style>