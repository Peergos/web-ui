<template>
	<figure class="grid-card drop">
		<AppIcon class="card__icon" icon="upload--72" />
		<figcaption>Drop files here</figcaption>
	</figure>
</template>

<script>

module.exports = {
	props: {

	},


};
</script>

<style>
.grid-card.drop {
	position: relative;
	width: 100%;
	cursor:default;
	background-color: transparent;
	border: 2px dashed var(--border-color);
}
.grid-card.drop:before {
 	content: "";
	position: relative;
    padding-top: 75%;
}

@media screen and (max-width:1024px) {
	.grid-card.drop{
		 grid-column: 1/-1;
	}
}

</style>