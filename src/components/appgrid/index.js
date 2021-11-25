module.exports = {
    template: require('appgrid.html'),
    data: function() {
        return {
            chatIsAvailable: true,
            numberOfDefaultApps: 11,
            installedApps: []
        };
    },
    props: ["context", "social", "canUpgrade", "executeApp", "registerApps"],
    created: function() {
        const href = window.location.href;
        if (href.includes("?chat=true"))
            this.chatIsAvailable = true;
        let that = this;
        this.context.getByPath(this.context.username + "/.apps").thenApply(appsDirOpt => {
            if (appsDirOpt.ref != null) {
                appsDirOpt.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(children => {
                    var appDirectories = children.toArray().filter(n => n.getName() != "calendar");
                    that.readAppProperties(appDirectories).thenApply(appPropsList => {
                        that.installedApps = appPropsList;
                        that.registerApps(appPropsList);
                    });
                });
            }
        });
    },
    methods: {
        launchApp: function(index) {
            this.executeApp(this.installedApps[index].app.details.name, '');
        },
        iconCount: function() {
            var appCount = this.numberOfDefaultApps;
            if (this.chatIsAvailable) {
                appCount++;
            }
            return appCount + this.installedApps.length + (this.canUpgrade ? 1 : 0);
        },
        showChat: function() {
            this.$emit("chat");
        },
        showTour: function() {
            this.$emit("tour");
        },
        showOurFiles: function() {
            this.$emit("files", {path:[this.context.username]});
	    },
        showFriendsFiles: function() {
            this.$emit("files", {path:[]});
        },
        showFeed: function() {
            this.$emit("news-feed");
        },
        showCalendar: function() {
            this.$emit("calendar");
        },
        showTodoBoard: function() {
            this.$emit("todo");
        },
        showTextEditor: function() {
            this.$emit("editor");
        },
        showSearch: function() {
            this.$emit("search");
        },
        showSocial: function() {
            this.$emit("social");
        },
        showProfile: function() {
            this.$emit("profile");
        },
        showUpgrade: function() {
            this.$emit("upgrade");
        },
        showAppManagement: function() {
            this.$emit("app-management");
        }
    },
};
