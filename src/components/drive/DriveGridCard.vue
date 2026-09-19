<template>
	<article 
        class="grid-card" :class="{selected: selected}" >

        <AppButton 
            class="card__select" 
            :class="{selected: selected}" 
            :accent="selected" 
            :icon="selected ? 'check' : null"
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
			<figcaption :title="filename">
				<span class="card__name">{{ filename }}</span>
				<ShareMark :kind="shared"/>
			</figcaption>
		</figure>

	</article>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppIcon = require("../AppIcon.vue");
const ShareMark = require("./ShareMark.vue");
const i18n = require("../../i18n/index.js");
const fileIcon = require("../../mixins/fileicon/index.js");

module.exports = {
    components: {
        AppButton,
	    AppIcon,
	    ShareMark,
    },
    mixins: [i18n, fileIcon],
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
        'selected',
        'shared'
	],
	computed:{
		cardIcon(){
			return this.fileIcon(this.type);
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
/* A contact sheet: the whole folder on one screen. Flat tiles on hairline
   borders, the preview in its own band and the name in a strip under it,
   rather than a caption floated over the picture. */
.grid-card {
	position: relative;
	display: flex;
	flex-direction: column;
	background-color: var(--bg);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-control);
	cursor: pointer;
	overflow: hidden;
}

.grid-card:hover {
	background-color: var(--bg-2);
	border-color: var(--pg-border-strong);
}

.grid-card.selected {
	background-color: var(--pg-tint-ok);
	border-color: var(--green-500);
}

.grid-card figure {
	display: flex;
	flex-direction: column;
	flex: 1 1 auto;
	min-width: 0;
	margin: 0;
}

.grid-card .cover,
.grid-card .card__icon {
	display: block;
	width: 100%;
	height: 136px;
	flex: none;
	background-color: var(--pg-surface-2);
}

.grid-card .cover {
	object-fit: cover;
	object-position: center center;
}

.grid-card .card__icon {
	padding: 40px 0;
	color: var(--pg-muted);
}

.grid-card figcaption {
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	height: 40px;
	padding: 0 34px 0 10px;
	font-size: 13px;
	font-weight: var(--regular);
	color: var(--color);
}

/* the name takes the squeeze, so the mark beside it is never the part that is cut */
.grid-card .card__name {
	min-width: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* both controls appear for the tile under the pointer, as they always have */
.grid-card .card__select {
	position: absolute;
	top: 8px;
	left: 8px;
	z-index: 10;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	padding: 0;
	opacity: 0;
	color: var(--pg-muted);
	background-color: var(--bg);
	border: 1px solid var(--pg-muted);
}

.grid-card:hover .card__select,
.grid-card .card__select.selected {
	opacity: 1;
}

/* the selection bar's select-all circle is the same control, and wears this too */
.card__select.app-button.accent,
.card__select.app-button.accent:focus {
	border-color: var(--green-500);
}

.grid-card .card__select svg {
	width: 16px;
	height: 16px;
}

.grid-card .card__menu {
	position: absolute;
	right: 4px;
	bottom: 4px;
	z-index: 5;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	padding: 0;
	opacity: 0;
	color: var(--pg-muted);
	border-radius: var(--radius-control);
	background-color: transparent;
}

.grid-card .card__menu svg {
	width: 18px;
	height: 18px;
}

.grid-card:hover .card__menu,
.grid-card:focus-within .card__menu {
	opacity: 1;
}

@media (max-width: 1024px) {
	.grid-card .cover,
	.grid-card .card__icon {
		height: 104px;
	}

	.grid-card .card__icon {
		padding: 26px 0;
	}

	/* no hover on a touch screen, so both controls stay put */
	.grid-card .card__select,
	.grid-card .card__menu {
		opacity: 1;
	}

	/* the circle keeps its size and the target around it reaches a thumb */
	.grid-card .card__select:after {
		content: "";
		position: absolute;
		top: -9px;
		right: -9px;
		bottom: -9px;
		left: -9px;
	}

	.grid-card .card__menu {
		width: 44px;
		height: 44px;
	}

	.grid-card figcaption {
		height: 44px;
		padding-right: 44px;
	}
}
</style>
