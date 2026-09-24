<template>
	<article 
        class="grid-card" :class="{selected: selected, 'menu-target': menuOpen}"
        v-longpress="onLongPress" >

        <AppButton 
            v-if="! isTouchLayout || selected || selecting"
            class="card__select" 
            :class="{selected: selected}" 
            :accent="selected" 
            :icon="selected ? 'check' : null"
            round 
            outline 
            @click.stop.native="toggleSelection($event)"
        />
        <AppButton
			v-if="! menuStandsDown(file)"
			class="card__menu"
			icon="dot-menu"
			aria-label="menu"
			@click.stop.native="showMenu($event)"
		/>

		<figure :id="itemIndex" 
            :draggable="! isTouchLayout" @dragover.prevent @dragstart="dragstartFunc($event, file)" @drop="dropFunc($event, file)">
			<img
				class="cover"
				v-if="src"
				:src="src"
				:alt="alt"
			/>
			<AppIcon v-else class="card__icon" :icon="cardIcon" />
			<figcaption :class="{ 'name-open': nameOpen }">
				<span class="card__name" :title="filename"
					@click="toggleName">{{ filename }}</span>
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
        'shared',
        // whether the user is picking files, which changes what a tap on the tile means
        'selecting',
        // asked, per file, whether this tile's menu should stand down
        'menuStandsDown',
        // this tile's menu is open: marked as the hover is, without the tick of a pick
        'menuOpen'
	],
	data() {
		return {
			// touch layouts only - see toggleName
			nameOpen: false,
		};
	},

	computed:{
		cardIcon(){
			return this.fileIcon(this.type);
		},
		// the stylesheet's touch rules ask the same question, and these answers must agree
		isTouchLayout(){
			return this.$store.getters.isTouchLayout;
		}
	},
	methods:{
		// A long name is read from the title tooltip, which a touch screen never shows, so
		// there the name opens in place instead. On a desktop the click is left alone and
		// opens the file, as any other part of the tile does. While files are being picked the
		// whole tile picks, the name included, so this stands aside.
		toggleName(event) {
			if (! this.isTouchLayout || this.selecting)
				return;
			event.stopPropagation();
			this.nameOpen = ! this.nameOpen;
		},

		// A phone has no room for a permanent circle on every tile, so a selection starts the
		// way it does in a gallery: press and hold. The drive then has one file picked and puts
		// up its selection bar, and a tap on any other tile adds to it.
		onLongPress() {
			if (! this.isTouchLayout)
				return;
			this.$emit('toggleSelection', false);
		},

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
        /* Press and hold, which is how a selection starts on a phone.
         *
         * Touch only: a slow click is not a gesture, and the desktop has its own control for
         * this. A finger that travels is a scroll rather than a press, so it cancels - without
         * that, resting a thumb on a tile while the grid moves would select it.
         */
        longpress: {
            bind: function (el, binding) {
                let timer = null;
                let held = false;
                let startX = 0;
                let startY = 0;

                const cancel = () => {
                    if (timer !== null) {
                        clearTimeout(timer);
                        timer = null;
                    }
                };
                // a tile can be torn down mid-press, by a listing that refreshes under the
                // finger, and the timer would otherwise still fire into the gone component
                el.__cancelLongPress = cancel;

                el.addEventListener("touchstart", e => {
                    cancel();
                    held = false;
                    if (e.touches.length !== 1)
                        return;
                    startX = e.touches[0].clientX;
                    startY = e.touches[0].clientY;
                    timer = setTimeout(() => {
                        timer = null;
                        held = true;
                        binding.value(e);
                    }, 500);
                }, {passive: true});

                el.addEventListener("touchmove", e => {
                    const touch = e.touches[0];
                    if (touch == null
                            || Math.abs(touch.clientX - startX) > 10
                            || Math.abs(touch.clientY - startY) > 10)
                        cancel();
                }, {passive: true});

                el.addEventListener("touchend", cancel);
                el.addEventListener("touchcancel", cancel);

                // The tap that ends the hold would otherwise open the file we just selected.
                // Caught on the way down, before anything inside the tile sees it.
                el.addEventListener("click", e => {
                    if (held) {
                        held = false;
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }, true);

                // and the browser would raise its own callout over the selection
                el.addEventListener("contextmenu", e => {
                    if (timer !== null || held)
                        e.preventDefault();
                });
            },

            unbind: function (el) {
                if (el.__cancelLongPress != null) {
                    el.__cancelLongPress();
                    delete el.__cancelLongPress;
                }
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
	/* Named so the touch rules below can be derived from them rather than repeating a
	   pixel figure per width: the picture's shape, and the height of the row under it. */
	--tile-ratio: 4 / 3;
	--row-height: 36px;

	position: relative;
	display: flex;
	flex-direction: column;
	background-color: var(--bg);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-control);
	cursor: pointer;
	overflow: hidden;
}

.grid-card:hover,
.grid-card.menu-target {
	background-color: var(--bg-2);
	border-color: var(--pg-border-strong);
}

/* Picked: the outline goes round the whole tile, but the colour stays on the picture,
   which is the part that was picked. The row below keeps the tile's own background. */
.grid-card.selected {
	border-color: var(--green-500);
}

.grid-card.selected figure:before {
	content: "";
	position: absolute;
	top: 0;
	right: 0;
	left: 0;
	z-index: 1;
	aspect-ratio: var(--tile-ratio);
	background-color: var(--pg-tint-ok);
	opacity: 0.55;
	/* the picture underneath is what a press and a tap are aimed at */
	pointer-events: none;
}

.grid-card figure {
	position: relative;
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
	/* Sized from the column rather than pinned to a pixel height, so the picture is as big as
	   the tile allows at every width. A fixed height letterboxes it on a wide card and crops
	   it on a narrow one, and left the phone no way to show more of a thumbnail at all. */
	aspect-ratio: var(--tile-ratio);
	height: auto;
	flex: none;
	background-color: var(--pg-surface-2);
}

.grid-card .cover {
	object-fit: cover;
	object-position: center center;
}

/* The picture leans in under the pointer, as it did before the rebuild.
   Only where something can actually hover: on a touch screen :hover sticks after a tap, so
   an unguarded rule leaves a thumbnail zoomed until something else is tapped. */
@media (hover: hover) {
	.grid-card .cover {
		transform: scale(1);
		transition: transform 0.2s;
	}

	.grid-card:hover .cover {
		transform: scale(1.05);
	}

	@media (prefers-reduced-motion: reduce) {
		.grid-card .cover,
		.grid-card:hover .cover {
			transition: none;
			transform: none;
		}
	}
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
	height: var(--row-height);
	padding: 0 34px 0 10px;
	font-size: 13px;
	font-weight: var(--regular);
	color: var(--color);
}

/* the name takes the squeeze, so the mark beside it is never the part that is cut */
.grid-card .card__name {
	flex: 1 1 auto;
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
	bottom: 2px;
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

/* Narrower tiles, so a taller row and a little more room around what sits in it. This is
   about width, and a wide tablet is right to keep the desktop's sizing. */
@media (max-width: 1024px) {
	.grid-card {
		--row-height: 40px;
	}
}

/* Touch, which is a different question from width: a tablet is wider than the breakpoint and
   still has no pointer to reveal anything. Everything here answers "can this device hover",
   and is sized from --row-height so it holds at either of them. */
@media (max-width: 1024px), (hover: none) {
	/* A phone has no circle standing by on every tile - the press and hold below is how a
	   selection starts there. Once one is running every tile carries one, empty or ticked, so
	   the mode and its targets are visible without a pointer to reveal them; the markup leaves
	   it out the rest of the time. Tapping one drops that tile again. */
	.grid-card .card__select {
		opacity: 1;
	}

	/* and the target around it reaches a thumb */
	.grid-card .card__select:after {
		content: "";
		position: absolute;
		top: -9px;
		right: -9px;
		bottom: -9px;
		left: -9px;
	}

	/* Press and hold selects, so the browser must not take the gesture for itself - no text
	   selection under the finger, no callout over the picture, and no drag. Dragging is a
	   pointer affordance: a touch cannot finish one, and the attempt is what a press and hold
	   looks like to the browser, so the two fight over the same gesture. The picture carries
	   its own drag behaviour whatever the figure around it says, so it is named too. */
	.grid-card {
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
	}

	.grid-card figure,
	.grid-card .cover {
		-webkit-user-drag: none;
	}

	/* The button stays a 44px thumb target although the row under it is shorter, so it reaches
	   up over the picture. Its glyph is dropped to the bottom rather than centred in the
	   button, which puts the dots back on the filename's line: the glyph's middle ends up
	   11px above the button's edge - 2px of transparent border and half of an 18px icon - so
	   the padding that puts it on the row's centre line is half the row less that. */
	.grid-card .card__menu {
		/* nothing reveals itself on a touch screen, so the menu stays put */
		opacity: 1;
		width: 44px;
		height: 44px;
		bottom: 0;
		align-items: flex-end;
		padding: 0 0 calc(var(--row-height) / 2 - 11px);
	}

	/* and the name gives the wider button its room */
	.grid-card figcaption {
		padding-right: 48px;
	}

	/* Opened, the name wraps and the row grows under it. Only this tile grows: the grid lets
	   every tile keep its own height, so the ones beside it stay as they were. The padding is
	   half of what is left of the row once a line of text has taken its 18px, so the opened
	   name starts on the line the closed one sat on. */
	.grid-card figcaption.name-open {
		height: auto;
		min-height: var(--row-height);
		padding-top: calc((var(--row-height) - 18px) / 2);
		padding-bottom: calc((var(--row-height) - 18px) / 2);
	}

	/* The menu is pinned to the bottom of the tile, so when an opened name pushes the row
	   taller the mark drops with it rather than floating up beside the first line. Closed, the
	   row centres both and this does not apply. */
	.grid-card figcaption.name-open .share-mark {
		align-self: flex-end;
	}

	.grid-card figcaption.name-open .card__name {
		white-space: normal;
		overflow: visible;
		text-overflow: clip;
		overflow-wrap: anywhere;
	}

	.grid-card .card__name {
		cursor: pointer;
	}
}
</style>
