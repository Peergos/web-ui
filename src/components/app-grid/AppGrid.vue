<template>
<div class="fillspace">
    <div class="appgrid">
        <transition name="app-grid-context-menu">
            <AppGridMenu
                ref="appGridMenu"
                v-if="viewMenu"
                @closeMenu="closeMenu()"
            >
                <li @keyup.enter="openApp()" @click="openApp()">Open</li>
                <li @keyup.enter="showDetails()" @click="showDetails()">Details</li>
                <li @keyup.enter="updateApp()" @click="updateApp()">Update</li>
                <li @keyup.enter="removeApp()" @click="removeApp()">Remove</li>
            </AppGridMenu>
        </transition>
        <div v-for="app in apps">
            <a @click="launch(app)" class="app-grid-item" v-on:keyup.enter="launch(app)" @contextmenu="showMenu($event, app)">
                <span class="app-icon">
                    <div v-if="app.thumbnail == null" >
                        <span v-if="app.updateAvailable" class="fa fa-stack fa-2x">
                            <i class="fa fa-circle" style="font-size: .3em; color:Tomato"></i>
                            <i data-placement="bottom" class="fa fa-cog fa-stack-1x" style="cursor: pointer;"></i>
                        </span>
                        <span v-if="!app.updateAvailable" data-placement="bottom" class="fa fa-cog" style="cursor: pointer;"/>
                    </div>
                    <div v-if="app.thumbnail != null" >
                        <i v-if="app.updateAvailable" class="fa fa-circle" style="font-size: .3em; color:Tomato"></i>
                        <img v-bind:src="app.thumbnail" style="width:50px;height:50px;cursor: pointer;"/>
                    </div>
                    <label class="app-icon-title">{{app.displayName}}</label>
                </span>
            </a>
        </div>
        <div v-if="this.iconCount() % 2 == 1" class="app-grid-item app-grid-filler-2"></div>
        <div v-if="this.iconCount() % 3 == 1" class="app-grid-item app-grid-filler-3"></div>
        <div v-if="this.iconCount() % 3 == 2 || this.iconCount() % 3 == 1" class="app-grid-item app-grid-filler-3"></div>
        <div v-if="this.iconCount() % 4 == 1" class="app-grid-item app-grid-filler-4"></div>
        <div v-if="this.iconCount() % 4 == 2 || this.iconCount() % 4 == 1" class="app-grid-item app-grid-filler-4"></div>
        <div v-if="this.iconCount() % 4 == 3 || this.iconCount() % 4 == 2 || this.iconCount() % 4 == 1" class="app-grid-item app-grid-filler-4"></div>
    </div>
</div>
</template>
<script>
const AppGridMenu = require("AppGridMenu.vue");

module.exports = {
    components: {
        AppGridMenu
    },
    data: function() {
        return {
            selectedApp: null,
            viewMenu: false,
        };
    },
    props: ["apps", "launchAppFunc", "appDetailsFunc", "removeAppFunc", "updateAppFunc"],
    created: function() {
    },
    methods: {
        showMenu(e, app){
            e.preventDefault();
            this.$store.commit('SET_LAUNCHER_MENU_TARGET', e.currentTarget)
            this.selectedApp = app;
            this.viewMenu = true
            //Vue.nextTick(() => {
            //    this.$refs.appGridMenu.$el.focus()
            //});
        },
        closeMenu() {
            this.viewMenu = false
        },
        iconCount: function() {
            return this.apps.length;
        },
        showDetails: function() {
            console.log('showDetails app:' + this.selectedApp.displayName);
            this.appDetailsFunc(this.selectedApp);
            this.closeMenu();
        },
        openApp: function() {
            this.launch(this.selectedApp);
            this.closeMenu();
        },
        launch: function(app) {
            if (!app.launchable) {
                return;
            }
            console.log('launching app:' + app.displayName);
            this.launchAppFunc(app);
        },
        removeApp: function() {
            this.removeAppFunc(this.selectedApp);
            this.closeMenu();
        },
        updateApp: function() {
            if (!app.updateAvailable) {
                this.$toast("No update for App: " + this.selectedApp.displayName);
            } else {
                this.updateAppFunc(this.selectedApp);
            }
            this.closeMenu();
        }
    },
};
</script>
<style>

</style>