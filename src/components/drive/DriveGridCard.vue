<template>
	<article class="grid-card">
		<AppButton
			class="card__menu"
			icon="dot-menu"
			aria-label="menu"
			@click.stop.native="showMenu($event)"
		/>

		<figure>
			<img
				class="cover"
				v-if="src"
				:src="src"
				:alt="alt"
			/>
			<AppIcon v-else class="card__icon" :icon="cardIcon" />
			<figcaption> {{ filename }}</figcaption>
		</figure>

	</article>
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
		type: {
			type: String,
			default: "",
		},
	},
	computed:{
		cardIcon(){
			if (this.type == 'text')
				return 'file-text';
			if (this.type == 'dir')
				return 'files';
		}
	},
	methods:{
		showMenu(e){
			// const Rect = e.currentTarget.getBoundingClientRect();
			// this.$store.commit('SET_DRIVE_MENU_POSITION', { x: Rect.left, y: Rect.top })
			this.$store.commit('SET_DRIVE_MENU_TARGET', e.currentTarget)
			this.$emit('openMenu')
		}
	}

};
</script>

<style>
.grid-card {
	position: relative;
	padding-bottom: 75%;
	/* min-height: 220px; */
	background-color: var(--bg-2);
	cursor: pointer;
}

.grid-card figure{
	position: absolute;
	top: 0;
	left: 0;
	right:0;
	bottom:0;

	display: flex;
	align-items: center;
	justify-content: center;

	overflow: hidden;
	border-radius: 6px;
}

.grid-card .cover {

	width:100%;
	height:100%;
	object-fit: cover; /* or contain */
	object-position: center center;
	transform: scale(1);
	transition: transform 0.2s;
}


.grid-card .card__icon {
	color: var(--color-2);
	transform: scale(1);
	transition: transform 0.2s;
}

.grid-card figcaption {
	position: absolute;
	bottom: 8px;
	left: 0;

	margin: 0 8px;
	padding: 2px 6px;
	border-radius: 4px;

	font-size: var(--text-small);
	font-weight: var(--regular);
	color: var(--color);
	background-color: var(--bg);
}

.grid-card .card__menu{
	position: absolute;
	top:8px;
	right:8px;
	z-index: 5;
	opacity:0;
	background-color: var(--bg-50);
}
.grid-card:hover .card__menu {
	opacity:1;
}
.grid-card:hover .cover {
	transform: scale(1.05);
}
.grid-card:focus{
	/* background-color: red; */
}
</style>