<template>
	<transition name="fade">
		<div v-if="showModal" class="app-modal app-modal__overlay" @click="closeModal($event)">
			 <div class="app-modal__container">
				<header><slot name="header"></slot></header>
				<section><slot name="body"></slot></section>
				<footer><slot name="footer"></slot></footer>
			 </div>
		</div>
	</transition>
</template>

<script>
module.exports = {
	name: 'AppModal',
	computed: {
		showModal() {
            return this.$store.state.showModal;
        }
	},
	methods: {
		closeModal(e) {
			if(e.target.classList.contains('app-modal')){
				this.$store.commit("SET_MODAL", false);
			}
		}
	},
}
</script>

<style>
.app-modal__overlay{
	position: fixed;
	/* TODO: fix global z-index strategy */
 	z-index: 100;
  	top: 0;
  	left: 0;
  	width: 100%;
  	height: 100%;
  	background-color: rgba(0, 0, 0, .2);
}

.app-modal__container{
	position: absolute;
	right:0;
	width:50%;
	min-height:100vh;

	display:flex;
	flex-direction: column;

	padding: var(--app-margin);
	color: var(--color);
	background-color: var(--bg);
	transition: background-color 0.3s;
}

.app-modal__container header{
	min-height: 100px;
}

.app-modal__container section{
	flex: 1 0 auto;
}

.app-modal__container footer{
	min-height: 100px;
}

</style>