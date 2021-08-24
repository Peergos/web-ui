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
	padding: 0 36px;

	margin-top: 24px;

}

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