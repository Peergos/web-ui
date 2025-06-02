<template>
	<article 
        class="grid-card" >

        <AppButton 
            class="card__select" 
            :class="{selected: selected}" 
            :accent="selected" 
            round 
            outline 
            @click.stop.native="toggleSelection($event)"
        />
        <AppButton
			class="card__menu"
			icon="dot-menu"
			aria-label="menu"
			@click.stop.native="showMenu($event)"
		/>

		<figure :id="itemIndex" 
            draggable="true" @dragover.prevent @dragstart="dragstartFunc($event, file)" @drop="dropFunc($event, file)">
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
const AppButton = require("../AppButton.vue");
const AppIcon = require("../AppIcon.vue");

module.exports = {
    components: {
        AppButton,
	    AppIcon,
    },
	props: [
		'filename',
		'src',
		'alt',
		'srcset',
		'type',
		'dragstartFunc',
		'dropFunc',
		'file',
		'itemIndex',
        'selected'
	],
	computed:{
		cardIcon(){
			if (this.type == 'dir') 	return 'folder--72';
			if (this.type == 'image') 	return 'file-image--72';
			if (this.type == 'text') 	return 'file-text--72';
			if (this.type == 'audio') 	return 'file-audio--72';
			if (this.type == 'video') 	return 'file-video--72';
			if (this.type == 'pdf') 	return 'file-pdf--72';
			if (this.type == 'zip') 	return 'file-zip--72';
			if (this.type == 'calendar') 	return 'calendar--72';
			if (this.type == 'contact file') 	return 'file-card--72';
			if (this.type == 'powerpoint presentation' || this.type == 'presentation') 	return 'file-powerpoint--72';
			if (this.type == 'word document' || this.type == 'text document') 	return 'file-word--72';
		        if (this.type == 'excel spreadsheet' || this.type == 'spreadsheet') 	return 'file-excel--72';
                        return 'file-generic--72';
		}
	},
	methods:{
		showMenu(e){
			this.$store.commit('SET_DRIVE_MENU_TARGET', e.currentTarget)
			this.$emit('openMenu')
		},
        toggleSelection(event){
            let shift = event.shiftKey;
            this.$emit('toggleSelection', shift);
        }
	},
    directives: {
        // https://blog.logrocket.com/building-a-long-press-directive-in-vue-3408d60fb511/
        // this directive could eventually be registered as global! 
        longpress: {
            bind: function (el, binding, vNode) {
                // Make sure expression provided is a function
                if (typeof binding.value !== 'function') {
                    // Fetch name of component
                    const compName = vNode.context.name
                    // pass warning to console
                    let warn = `[longpress:] provided expression '${binding.expression}' is not a function, but has to be`
                    if (compName) {warn += `Found in component '${compName}'`}
                    console.warn(warn)
                }

                let pressTimer = null

                // Define function handlers
                // Create timeout (run function after 1s)
                let start = (e) => {
                    if (e.type === 'click' && e.button !== 0) {
                        return
                    }

                    if (pressTimer === null) {
                        pressTimer = setTimeout(()=>{
                        handler()
                        }, 1000)
                    }
                }

                // Cancel timeout
                let cancel = (e) => {
                    // Check if timer has value or not
                    if (pressTimer !== null) {
                        clearTimeout(pressTimer)
                        pressTimer = null
                    }
                }

                // Run function
                const handler = (e) => {
                    binding.value(e)
                }

                el.addEventListener("mousedown", start);
                el.addEventListener("touchstart", start);
                // Cancel timeouts if this events happen
                el.addEventListener("click", cancel);
                el.addEventListener("mouseout", cancel);
                el.addEventListener("touchend", cancel);
                el.addEventListener("touchcancel", cancel);                
            } 
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

.grid-card .card__select {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 10;
    opacity: 0;
    width: 24px;
    height: 24px;
    padding: 0;
    background-color: var(--bg-50);
    color: var(--color);
}

.card__select.app-button.accent:focus{
	background-color: var(--green-500);
}

.grid-card:hover .card__select,
.grid-card .card__select.selected {
    opacity: 1;
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
