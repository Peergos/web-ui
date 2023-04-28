<template>
<div>
    <div class="app-grid-flex-container">
        <transition name="app-grid-context-menu">
            <ul id="appMenu" v-if="showAppMenu" class="dropdown-menu" @mouseleave="menuLeave($event)" v-bind:style="{top:menutop, left:menuleft}" style="cursor:pointer;display:block;min-width:100px;padding: 10px;">
                <li style="padding-bottom: 5px;" @mouseover="contextMenuHoverOver($event)" @mouseout="contextMenuHoverOut($event)" @keyup.enter="showDetails($event)" @click="showDetails($event)">Details</li>
                <li v-if="selectedApp.updateAvailable" style="padding-bottom: 5px;" @mouseover="contextMenuHoverOver($event)" @mouseout="contextMenuHoverOut($event)" @keyup.enter="updateApp($event)" @click="updateApp($event)">Update</li>
                <li style="padding-bottom: 5px;" @mouseover="contextMenuHoverOver($event)" @mouseout="contextMenuHoverOut($event)" @keyup.enter="removeApp($event)" @click="removeApp($event)">Remove</li>
            </ul>
        </transition>
        <div v-for="app in apps">
            <a @click="launch(app)" class="app-grid-item" v-on:keyup.enter="launch(app)" @contextmenu="showMenu($event, app)">
                <span class="app-icon">
                    <div v-if="app.thumbnail == null" >
                        <i data-placement="bottom" class="fa fa-cog" style="cursor: pointer;"></i>
                    </div>
                    <div v-if="app.thumbnail != null" >
                        <img v-bind:src="app.thumbnail" style="width:50px;height:50px;cursor: pointer;"/>
                    </div>
                    <label class="app-icon-title">{{app.displayName}}<span v-if="app.updateAvailable" id="pendingSpan" class="pending-badge" >{{0}}</span></label>
                </span>
            </a>
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
        };
    },
    props: ["apps", "launchAppFunc", "appDetailsFunc", "removeAppFunc", "updateAppFunc"],
    created: function() {
    },
    methods: {
      	menuLeave: function(event) {
            this.showAppMenu = false;
      	},
      	contextMenuHoverOver: function(event) {
        	event.currentTarget.style.backgroundColor = "lightgrey";
        },
        contextMenuHoverOut: function(event) {
            event.currentTarget.style.backgroundColor = "";
        },
        getPosition: function(e) {
            var posx = 0;
            var posy = 0;

            if (!e) var e = window.event;
            if (e.clientX || e.clientY) {
                posx = e.clientX - 60;
                posy = e.clientY - 100;
            }
            return {
                x: posx,
                y: posy
            }
        },
        showMenu(event, app) {
            event.preventDefault();
            this.selectedApp = app;
            var pos = this.getPosition(event);
            Vue.nextTick(function() {
                var top = pos.y;
                var left = pos.x;
                this.menutop = top + 'px';
                this.menuleft = left + 'px';
            }.bind(this));
            this.showAppMenu = true;
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
            console.log('showDetails app:' + this.selectedApp.displayName);
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
.app-grid-flex-container {
  display: flex;
  flex-wrap: wrap;
}

.app-grid-flex-container > div {
    width: 130px;
    margin: 10px;
    text-align: center;
}
</style>