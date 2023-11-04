<template>
	<transition name="modal" appear>
		<div class="app-modal app-modal__overlay" @click="closeModal()">
			<transition :name="`modal-content--${position}`" appear>
				<div
					ref="modalContainer"
					tabindex="0"
					class="app-modal__container"
					:class="`modal--${position}`"
					@click.stop
				>
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
const AppButton = require("../AppButton.vue");

module.exports = {
	components: {
	    AppButton,
	},
	name: 'AppModal',
	props: {
		position:{
			type: String,
			default: 'right',
			validator: function (value) {
				return ['right', 'center'].indexOf(value) !== -1
			}
		},
	},
	methods: {
		closeModal() {
			this.$store.commit("SET_MODAL", false);
		}
	},

	mounted(){
		this.$refs.modalContainer.focus();
	}
}
</script>

<style>
.app-modal__overlay{
	position: fixed;
	/* TODO: fix global z-index strategy */
 	z-index: 400;
  	top: 0;
  	left: 0;
  	width: 100%;
  	height: 100%;
  	background-color: rgba(0, 0, 0, .4);
	overflow-y: auto;
	overflow-x: hidden;

	display: flex;
	align-items: center;
	justify-content: center;
}

.app-modal__container{

	display:flex;
	flex-direction: column;

	padding: var(--app-margin);
	color: var(--color);
	background-color: var(--bg);
}
.app-modal__container:focus{
	outline: none;
}

.app-modal__container.modal--right{
	position: absolute;
	top:0;
	right:0;
	width:50%;
	min-height:100vh;
}

.app-modal__container.modal--center{
	position: relative;
	/* width:50%; */
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

/* overlay transition */
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

/* RIGHT content transtion */
.modal-content--right-enter-active{
	transition: transform 0.5s ease-out,
				opacity 0.2s ease-out;
	transform: translateX(0);
}
.modal-content--right-enter,
.modal-content--right-leave-to {
	opacity: 0;
	transform: translateX(100px);
}

/* CENTER content transtion */
.modal-content--center-enter-active{
	transition: opacity 0.2s ease-out;
}
.modal-content--center-enter,
.modal-content--center-leave-to {
	opacity: 0;
}

@media (max-width: 1024px) {
	.app-modal__container.modal--right{
		width: 100%
	}
}

</style>
