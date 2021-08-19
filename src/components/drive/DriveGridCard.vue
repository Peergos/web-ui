<template>
	<figure class="grid-card">
		<img
			v-if="src"
			:src="src"
			:alt="alt"
			class="background"
		/>
		<AppIcon v-else :icon="extension" />
		<figcaption> {{ filename }}</figcaption>
	</figure>
</template>

<script>
module.exports = {
	props: {
		filename: {
			type: String,
			default: "",
			required:true
		},
		src: {
			type: String,
			default: "",
			required:true
		},
		alt: {
			type: String,
			default: "",
		},
		srcset: {
			type: String,
			default: "",
		},
		extension: {
			type: String,
			default: "",
		},
	},
};
</script>

<style>
.grid-card {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;

	height: 220px;
	border-radius: 6px;
	overflow: hidden;
	background-color: var(--bg-2);



	cursor: pointer;
}

.grid-card svg {
	color: var(--color-2);
	transform: scale(1);
	transition: transform 0.3s;
}

.grid-card .background {
	position: absolute;
	top: 0;
	left: 0;
	right:0;
	bottom:0;
	width:100%;
	object-fit: contain;
	transform: scale(1);
	transition: transform 0.3s;
}

.grid-card figcaption {
	margin: 0;
	padding: 2px 6px;
	border-radius: 4px;
	position: absolute;
	bottom: 8px;
	left: 8px;
	font-size: var(--text-small);
	font-weight: var(--bold);
	color: var(--color);
	background-color: var(--bg);
}

.grid-card:hover .background,
.grid-card:hover svg {
	transform: scale(1.05);
}
</style>