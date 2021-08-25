<template>
	<transition name="modal" appear>
		<div v-if="showModal" class="app-modal app-modal__overlay" @click="closeModal()">

			<transition name="modal-content" appear>
				<div v-if="showModal" class="app-modal__container" @click.stop>
					<AppButton class="close" icon="close" @click.native="closeModal()"/>
					<header><slot name="header"></slot></header>
					<section><slot name="body"></slot></section>
					<footer><slot name="footer"></slot></footer>
				</div>
			</transition>

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
		closeModal() {
			this.$store.commit("SET_MODAL", false);
		}
	},
}
</script>

<style>
.app-modal__overlay{
	position: fixed;
	/* TODO: fix global z-index strategy */
 	z-index: 200;
  	top: 0;
  	left: 0;
  	width: 100%;
  	height: 100%;
  	background-color: rgba(0, 0, 0, .4);
	overflow-y: auto;
	overflow-x: hidden;

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
}

.app-modal__container .close{
	position:absolute;
	right:var(--app-margin);
	top:var(--app-margin);
}

.app-modal__container header{
	padding-right: 50px;
}

.app-modal__container header > *{
	margin-top: 0;
}

.app-modal__container section{
	flex: 1 0 auto;
}

.app-modal__container footer{
	min-height: auto;
}

/* modal overlay transition */
.modal-enter-active{
  transition: opacity 0.5s ease-out;
}
.modal-leave-active{
	transition: opacity 0.2s ease-in;
}
.modal-enter,
.modal-leave-to {
  opacity: 0;
}

/* modal-content transtion */
.modal-content-enter-active{
	transition: transform 0.5s ease-out,
				opacity 0.2s ease-out;
	transform: translateX(0);
}
.modal-content-enter,
.modal-content-leave-to {
	opacity: 0;
	transform: translateX(100px);
}

@media (max-width: 1024px) {
	.app-modal__container{
		width: 100%;
	}
}

</style>