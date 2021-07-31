<template>
	<main class="app-temp">
		<h1>Calendar view</h1>
	</main>
</template>

<script>

module.exports = {
	props: ["initContext", "initPath", "openFile", "initiateDownload"],
}
</script>

<style>
.app-temp{
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
}
.app-temp h1{
	text-align: center;
}
</style>