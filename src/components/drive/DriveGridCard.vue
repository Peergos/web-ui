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
				v-if="type == 'image'"
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
			if (this.type == 'dir') 	return 'files';
			if (this.type == 'image') 	return 'image-file';
			if (this.type == 'text') 	return 'text-file';
			if (this.type == 'audio') 	return 'audio-file';
			if (this.type == 'video') 	return 'video-file';
			if (this.type == 'pdf') 	return 'file-pdf';
			if (this.type == 'zip') 	return 'zip-file';
			if (this.type == 'todo') 	return 'tasks';
			if (this.type == 'file') 	return 'add-document';
			if (this.type == 'calendar') 	return 'calendar';
			if (this.type == 'contact file') 	return 'address-card';
			if (this.type == 'powerpoint presentation' || this.type == 'presentation') 	return 'powerpoint-file';
			if (this.type == 'word document' || this.type == 'text document') 	return 'word-file';
			if (this.type == 'excel spreadsheet' || this.type == 'spreadsheet') 	return 'excel-file';
		}
	},
	methods:{
		showMenu(e){
			this.$store.commit('SET_DRIVE_MENU_TARGET', e.currentTarget)
			this.$emit('openMenu')
		}
	}

};
</script>

<style>
.grid-card {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;

	/* padding-bottom: 75%; */
	background-color: var(--bg-2);
	cursor: pointer;
	border-radius: 4px;
	overflow:hidden;
}
.grid-card:before {
 	content: "";
	position: relative;
    padding-top: 75%;
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

	cursor: default;
}

.grid-card .cover {

	width:100%;
	height:100%;
	object-fit: cover;
	object-position: center center;
	transform: scale(1);
	transition: transform 0.2s;
}


.grid-card .card__icon {
	width:72px;
	height: 72px;
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


	font-size: var(--text-small);
	font-weight: var(--regular);
	color: var(--color);


}
.grid-card .cover ~ figcaption{
	border-radius: 2px;
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
}
</style>