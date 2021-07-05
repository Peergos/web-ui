<template>
	<AppModal>
		<template #header><h3>Request space</h3></template>
		<template #body><p>
				Lorem ipsum dolor sit amet consectetur adipisicing elit.
				Adipisci odio ea consequuntur nulla sit? Omnis itaque unde optio
				similique corrupti, vitae facere doloremque repellendus
				mollitia? Itaque voluptas voluptatibus atque cumque?
		</p>
		<p>
				Lorem ipsum dolor sit amet consectetur adipisicing elit.
				Adipisci odio ea consequuntur nulla sit? Omnis itaque unde optio
				similique corrupti, vitae facere doloremque repellendus
				mollitia? Itaque voluptas voluptatibus atque cumque?
		</p></template>
		<template #footer><AppButton @click="requestStorage()">Send request</AppButton></template>
	</AppModal>
</template>

<script>

module.exports = {
	name: "ModalSpace",
	methods: {
		requestStorage() {
			console.log('requestStorage')
			// if (!this.validateSpace()) return;
			// const that = this;
			// this.context
			// 	.requestSpace(this.getRequestedBytes())
			// 	.thenApply((x) => that.close());
		},
	},
};
</script>