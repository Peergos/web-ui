<template>
<div>
    <div class="app-grid-flex-container">
        <transition name="app-grid-context-menu">
            <ul id="appMenu" v-if="showAppMenu" class="pg-menu" tabindex="0" @mouseleave="menuLeave($event)"
                @focusout="menuLeave($event)" @keydown.esc="menuLeave($event)" v-bind:style="{top:menutop, left:menuleft}" style="display:block;min-width:100px;">
                <li @keyup.enter="showDetails($event)" @click="showDetails($event)">Details</li>
                <li v-if="selectedApp.template.length > 0" @keyup.enter="updateAccessToApp($event)" @click="updateAccessToApp($event)">Share</li>
                <li v-if="selectedApp.updateAvailable" @keyup.enter="updateApp($event)" @click="updateApp($event)">Update</li>
                <li @keyup.enter="removeApp($event)" @click="removeApp($event)">Remove</li>
            </ul>
        </transition>
        <div v-for="app in apps" class="app-tile" :class="{'app-tile--inert': !app.launchable}">
            <a @click="launch(app)" class="app-grid-item" tabindex="0" role="button" :aria-label="app.gridDisplayName"
               v-on:keyup.enter="launch(app)" @contextmenu="showMenu($event, app)">
                <span class="app-icon">
                    <img v-if="app.thumbnail != null" v-bind:src="app.thumbnail" alt=""/>
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                </span>
                <!-- a long name is cut to two lines; a tap on it shows the rest, as in the other
                     views, since a title tooltip never shows on a touch screen -->
                <label class="app-icon-title pg-clamp" :class="{'pg-clamp--open': expanded[app.name]}" :title="app.gridDisplayName"
                       @click="toggleName($event, app)">{{app.gridDisplayName}}<span v-if="app.updateAvailable" id="pendingSpan" class="pending-badge" >{{0}}</span></label>
            </a>
            <!-- the menu a right-click opens, for a touch screen or a keyboard, which have none -->
            <button type="button" class="app-tile__menu" aria-label="menu" @click="showMenu($event, app)">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
            </button>
        </div>
    </div>
</div>
</template>
<script>

module.exports = {
    components: {
    },
    data: function() {
        return {
            selectedApp: null,
            showAppMenu: false,
            menutop:"",
            menuleft:"",
            expanded: {},
        };
    },
    props: ["apps", "launchAppFunc", "appDetailsFunc", "removeAppFunc", "updateAppFunc", "updateAccessToTemplateApp"],
    created: function() {
    },
    methods: {
        /** Shows the whole of a name that was cut short, or cuts it again. A name that fits
         *  is left to the tile, and a tap on it launches the app as before. */
        toggleName: function(event, app) {
            let label = event.currentTarget;
            if (! this.expanded[app.name] && label.scrollHeight <= label.clientHeight + 1)
                return;
            event.stopPropagation();
            event.preventDefault();
            Vue.set(this.expanded, app.name, ! this.expanded[app.name]);
        },
      	menuLeave: function(event) {
            this.showAppMenu = false;
      	},
        /** Opens the app's menu where it was asked for: at the pointer for a right-click or a
         *  tap, under the button for a key press, which has no pointer. Kept inside the grid, so
         *  on a phone it cannot run off the side of the screen. */
        showMenu(event, app) {
            event.preventDefault();
            this.selectedApp = app;
            let grid = this.$el.querySelector('.app-grid-flex-container').getBoundingClientRect();
            let x = event.clientX, y = event.clientY;
            if (! x && ! y && event.currentTarget) {
                let from = event.currentTarget.getBoundingClientRect();
                x = from.left;
                y = from.bottom;
            }
            const menuWidth = 180;
            this.menuleft = Math.max(0, Math.min(x - grid.left, grid.width - menuWidth)) + 'px';
            this.menutop = (y - grid.top) + 'px';
            this.showAppMenu = true;
            // closed as the drive's menu is: once focus goes elsewhere, which is what a tap
            // anywhere else does on a touch screen that has no mouse to leave it with
            this.$nextTick(() => {
                let menu = this.$el.querySelector('#appMenu');
                if (menu)
                    menu.focus();
            });
        },
        closeMenu(event) {
            this.showAppMenu = false;
            if (event) {
                event.stopPropagation();
            }
        },
        iconCount: function() {
            return this.apps.length;
        },
        showDetails: function(e) {
            this.appDetailsFunc(this.selectedApp);
            this.closeMenu(e);
        },
        launch: function(app) {
            this.closeMenu();
            if (!app.launchable) {
                return;
            }
            this.launchAppFunc(app);
        },
        removeApp: function(e) {
            this.removeAppFunc(this.selectedApp);
            this.closeMenu(e);
        },
        updateAccessToApp: function(e) {
            if (!(this.selectedApp.template.length > 0)) {
                this.$toast("Not a template App: " + this.selectedApp.displayName);
            } else {
                this.updateAccessToTemplateApp(this.selectedApp);
            }
            this.closeMenu(e);
        },
        updateApp: function(e) {
            if (!this.selectedApp.updateAvailable) {
                this.$toast("No update for App: " + this.selectedApp.displayName);
            } else {
                this.updateAppFunc(this.selectedApp);
            }
            this.closeMenu(e);
        }
    },
};
</script>
<style>
/* the apps share the width they are given, as the drive's cards do: fixed cells packed
   from the left left a ragged gap down the right of every screen wider than their sum */
.app-grid-flex-container {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

/* the menu floats over the tiles where it was opened, rather than taking a cell of the grid */
.app-grid-flex-container > #appMenu {
  position: absolute;
  z-index: 20;
  min-width: 160px;
}

/* it takes focus to know when to close, and rings for a keyboard only, as the drive's does */
.app-grid-flex-container > #appMenu:focus {
  outline: none;
}

.app-grid-flex-container > #appMenu:focus-visible {
  outline: 2px solid var(--green-500);
  outline-offset: 2px;
}

/* each app a card, as the drive's items are */
.app-tile {
  position: relative;
  background-color: var(--bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-container);
  box-shadow: var(--pg-shadow);
}

/* only where there is a pointer to hover with: a tap leaves a phone's hover behind */
@media (hover: hover) {
  .app-tile:hover {
    background-color: var(--pg-surface-2);
  }
}

.app-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 12px 16px;
  color: var(--color);
  text-decoration: none;
  cursor: pointer;
}

.app-tile--inert .app-grid-item {
  cursor: default;
}

/* the page-wide link rules underline a link and ring it once it has been hovered or tapped;
   a tile is not a link in a sentence, so it keeps its look, and a keyboard still gets the
   ring below */
.app-grid-item:hover,
.app-grid-item:focus {
  color: var(--color);
  text-decoration: none;
  outline: none;
}

.app-grid-item:focus-visible {
  outline: 2px solid var(--green-500);
  outline-offset: 2px;
  border-radius: var(--radius-container);
}

.app-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  color: var(--pg-on-ok);
  background-color: var(--pg-tint-ok);
}

.app-icon img {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  object-fit: cover;
}

.app-icon svg {
  width: 26px;
  height: 26px;
}

.app-icon-title {
  margin: 0;
  font-size: var(--text-small);
  font-weight: 500;
  text-align: center;
  overflow-wrap: anywhere;
  cursor: inherit;
}

/* two lines keep a long name from stretching every tile in its row */
.app-icon-title.pg-clamp:not(.pg-clamp--open) {
  -webkit-line-clamp: 2;
}

/* an update waiting: the dot the status cards use for a state */
.pending-badge {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-left: 6px;
  vertical-align: middle;
  font-size: 0;
  border-radius: 50%;
  background-color: var(--green-500);
}

.app-tile__menu {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background-color: transparent;
  color: var(--pg-muted);
  cursor: pointer;
}

@media (hover: hover) {
  .app-tile__menu:hover {
    background-color: var(--border-color);
    color: var(--color);
  }
}

.app-tile__menu:focus-visible {
  outline: 2px solid var(--green-500);
  outline-offset: 2px;
}

.app-tile__menu svg {
  width: 18px;
  height: 18px;
}

@media (pointer: coarse) {
  .app-tile__menu {
    width: 44px;
    height: 44px;
    top: 0;
    right: 0;
  }
}
</style>
