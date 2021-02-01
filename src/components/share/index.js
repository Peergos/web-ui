module.exports = {
    template: require('share.html'),
    data: function() {
        return {
            showSpinner: false,
            targetUsername: "",
            targetUsernames: [],
            sharedWithAccess: "Read",
            shareWithFriendsGroup: false,
            shareWithFollowersGroup: false,
            errorTitle:'',
            errorBody:'',
            showError:false,
            unsharedReadAccessNames: [],
            unsharedEditAccessNames: [],
            showModal:false,
            modalTitle:"",
            modalLinks:[]
        }
    },
    props: ['data', 'friendnames', 'followernames', 'groups', 'files', 'parent', 'path', 'context', 'messages', 'fromApp', 'displayName', 'allowReadWriteSharing', 'allowCreateSecretLink'],
    created: function() {
        Vue.nextTick(this.setTypeAhead);
    },
    methods: {
        close: function () {
            this.showSpinner = false;
            this.$emit("hide-share-with");
        },
        refresh : function () {
            if (! this.fromApp) {
                this.$emit("update-shared-refresh");
            }
        },
        showMessage : function (title, body) {
            if (! this.fromApp) {
                this.messages.push({
                    title: title,
                    body: body,
                    show: true
                });
            }
        },
        createSecretLink : function () {
            if (this.files.length == 0)
                return this.close();
            if (this.files.length != 1)
                throw "Unimplemented multiple file share call";

            let file = this.files[0];
            var links = [];
            let props = file.getFileProperties();
            var name = this.displayName;
            links.push({href:window.location.origin + window.location.pathname +
            "#" + propsToFragment({secretLink:true,link:file.toLink()}),
                name:name,
                id:'secret_link_'+name});
            var title = links.length > 1 ? "Secret links to files: " : "Secret link to file: ";
            this.showLinkModal(title, links);
        },

        showLinkModal: function(title, links) {
            this.showModal = true;
            this.modalTitle = title;
            this.modalLinks = links;
        },
        gatherAllUsersToUnshare: function(currentSharedWithUsernames, usernamesToUnshare) {
            let friendGroupUid = this.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME);
            let includesFriends = usernamesToUnshare.indexOf(friendGroupUid) > -1;
            let followersGroupUid = this.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME);
            let includesFollowers = usernamesToUnshare.indexOf(followersGroupUid) > -1;
            let allUsers = usernamesToUnshare.concat([]);
            if (includesFriends) {
                for(var i = 0; i < currentSharedWithUsernames.length; i++) {
                    let name = currentSharedWithUsernames[i];
                    if (allUsers.indexOf(name) == -1 && this.isFriend(name)) {
                        allUsers.push(name);
                    }
                }
            }
            if (includesFollowers) {
                for(var i = 0; i < currentSharedWithUsernames.length; i++) {
                    let name = currentSharedWithUsernames[i];
                    if (allUsers.indexOf(name) == -1 && this.isFollower(name)) {
                        allUsers.push(name);
                    }
                }
            }
            return allUsers;
        },
        unshare : function (sharedWithAccess) {
            if (this.files.length == 0)
                return this.close();
            if (this.files.length != 1)
                throw "Unimplemented multiple file share call";

            var that = this;
            this.showSpinner = true;
            let filePath = peergos.client.PathUtils.toPath(this.path, this.files[0].getFileProperties().name);
            this.context.sharedWith(filePath).thenApply(function(fileSharedWithState) {
                let read_usernames = fileSharedWithState.readAccess.toArray([]);
                let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
                that.unshareFileWith(read_usernames, edit_usernames, sharedWithAccess);
            }).exceptionally(function(throwable) {
                that.resetTypeahead();
                that.showSpinner = false;
                that.errorTitle = 'Error sharing file: ' + that.files[0].getFileProperties().name;
                that.errorBody = throwable.getMessage();
                that.showError = true;
            });
        },
        unshareFileWith : function (read_usernames, edit_usernames, sharedWithAccess) {
            var that = this;
            var filename = that.files[0].getFileProperties().name;
            if(sharedWithAccess == "Read") {
                let allUnsharedReadAccessNames = this.gatherAllUsersToUnshare(read_usernames, this.unsharedReadAccessNames);
                this.context.unShareReadAccess(this.files[0], allUnsharedReadAccessNames)
                    .thenApply(function(b) {
                        that.showSpinner = false;
                        that.showMessage("Success!", "Read access revoked");
                        that.close();
                        console.log("unshared read access to " + that.files[0].getFileProperties().name + " with " + that.unsharedReadAccessNames);
                        that.refresh();
                    }).exceptionally(function(throwable) {
                        that.showSpinner = false;
                        that.errorTitle = 'Error unsharing file: ' + filename;
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                    });

            } else {
                let allUnsharedEditAccessNames = this.gatherAllUsersToUnshare(edit_usernames, this.unsharedEditAccessNames);
                this.context.unShareWriteAccess(this.files[0], allUnsharedEditAccessNames)
                    .thenApply(function(b) {
                        that.showSpinner = false;
                        that.showMessage("Success!", "Read & Write access revoked");
                        that.close();
                        console.log("unshared write access to " + that.files[0].getFileProperties().name + " with " + that.unsharedEditAccessNames);
                        that.refresh();
                    }).exceptionally(function(throwable) {
                        that.showSpinner = false;
                        that.errorTitle = 'Error unsharing file: ' + filename;
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                    });
            }
        },
	allowedToShare: function(file) {
        if (file.isUserRoot()) {
            this.errorTitle = 'You cannot share your home directory!';
            this.errorBody = "";
            this.showError = true;
            return false;
        }
        if (this.sharedWithAccess == "Edit" && file.getOwnerName() != this.context.username) {
            this.errorTitle = 'Only the owner of a file can grant write access!';
            this.errorBody = "";
            this.showError = true;
            return false;
        }
        return true;
    },
    resetTypeahead: function() {
        this.targetUsernames = [];
        this.targetUsername = "";
        $('#friend-name-input').tokenfield('setTokens', []);
    },
	shareWith: function() {
            if (this.files.length == 0)
		return this.close();
            if (this.files.length != 1)
		throw "Unimplemented multiple file share call";
	    
            if (! this.allowedToShare(this.files[0]))
		return;
		if (!this.shareWithFriendsGroup && !this.shareWithFollowersGroup) {
            if (this.targetUsernames.slice() == 0) {
                return;
            }
        }
        var that = this;
        this.showSpinner = true;
        let filePath = peergos.client.PathUtils.toPath(this.path, this.files[0].getFileProperties().name);
		this.context.sharedWith(filePath).thenApply(function(fileSharedWithState) {
            that.showSpinner = false;
            let read_usernames = fileSharedWithState.readAccess.toArray([]);
            let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
	        that.shareFileWith(read_usernames, edit_usernames);
        }).exceptionally(function(throwable) {
            that.resetTypeahead();
            that.showSpinner = false;
            that.errorTitle = 'Error sharing file: ' + that.files[0].getFileProperties().name;
            that.errorBody = throwable.getMessage();
            that.showError = true;
        });
    },
    isFriend: function(name) {
        return this.friendnames.indexOf(name) > -1;
    },
    isFollower: function(name) {
        return this.followernames.indexOf(name) > -1 || this.isFriend(name);
    },
    filterNamesFromGroups: function(includesFriends, includesFollowers, name) {
        if (includesFriends && this.isFriend(name)) {
            return false;
        }
        if (includesFollowers && this.isFollower(name)) {
            return false;
        }
        return true;
    },
    filterSharedWithUsers: function(usernames) {
        let includesFriends = usernames.indexOf(this.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME)) > -1;
        let includesFollowers = usernames.indexOf(this.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME)) > -1;
        let result = usernames.filter(name => this.filterNamesFromGroups(includesFriends, includesFollowers, name));
        return result;
    },
    filterEditSharedWithUsers: function() {
        return this.filterSharedWithUsers(this.data.edit_shared_with_users);
    },
    filterReadSharedWithUsers: function() {
        return this.filterSharedWithUsers(this.data.read_shared_with_users);
    },
    getUserOrGroupName: function(username) {
        let groupName =  this.groups.groupsUidToName[username];
        return groupName != null ? groupName : username;
    },
    getGroupUid: function(groupName) {
        return this.groups.groupsNameToUid[groupName];
    },
    rationaliseUsersToShareWith: function(incFriendsGroup, incFollowersGroup, existingSharedUsers, usersToShareWith) {
        let friendGroupUid = this.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME);
        let followersGroupUid = this.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME);

        let includesFriends = incFriendsGroup || this.isAlreadySharedWithUser(friendGroupUid, existingSharedUsers);
        let includesFollowers = incFollowersGroup || this.isAlreadySharedWithUser(followersGroupUid, existingSharedUsers);
        if (includesFriends || includesFollowers) {
            for (var i = usersToShareWith.length - 1; i >= 0; i--) {
                let targetUsername = usersToShareWith[i];
                let removed = false;
                if (includesFriends && this.isFriend(targetUsername)) {
                    usersToShareWith.splice(i, 1);
                    removed = true;
                }
                if (!removed && includesFollowers && this.isFollower(targetUsername)) {
                    usersToShareWith.splice(i, 1);
                }
            }
        }
        return usersToShareWith;
    },
    isAlreadySharedWithUser: function(username, existingSharedUsers) {
        return existingSharedUsers.indexOf(username) > -1;
    },
    shareFileWith: function(read_usernames, edit_usernames) {
        var that = this;
        var usersToShareWith = this.targetUsernames.slice();

        let existingSharedUsers = this.sharedWithAccess == "Read" ? read_usernames : edit_usernames;
        for (var i = usersToShareWith.length - 1; i >= 0; i--) {
            let targetUsername = usersToShareWith[i];
            if(this.isAlreadySharedWithUser(targetUsername, existingSharedUsers)) {
                usersToShareWith.splice(i, 1);
            }
        }
        usersToShareWith = this.rationaliseUsersToShareWith(this.shareWithFriendsGroup, this.shareWithFollowersGroup,
            existingSharedUsers, usersToShareWith);

        let friendGroupUid = this.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME);
        let followersGroupUid = this.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME);
        if (this.shareWithFriendsGroup) {
            if (this.isAlreadySharedWithUser(friendGroupUid, existingSharedUsers)) {
                incFriendsGroup = false;
            } else {
                usersToShareWith.push(friendGroupUid);
            }
        }
        if (this.shareWithFollowersGroup) {
            if (this.isAlreadySharedWithUser(followersGroupUid, existingSharedUsers)) {
                incFriendsGroup = false;
            } else {
                usersToShareWith.push(followersGroupUid);
            }
        }
        if (!this.shareWithFriendsGroup && !this.shareWithFollowersGroup) {
            if (usersToShareWith.length == 0) {
                that.errorTitle = "Already shared!";
                that.errorBody = "";
                that.showError = true;
                return;
            }
        }

        var filename = that.files[0].getFileProperties().name;
        var filepath = "/" + that.path.join('/') + "/" + filename;
        this.showSpinner = true;
        if (this.sharedWithAccess == "Read") {
            that.context.shareReadAccessWith(that.files[0], filepath, usersToShareWith)
            .thenApply(function(b) {
            that.showSpinner = false;
            that.showMessage("Success!", "Secure sharing complete");
            that.close();
            that.resetTypeahead();
            console.log("shared read access to " + filename);
            that.refresh();
            }).exceptionally(function(throwable) {
            that.resetTypeahead();
            that.showSpinner = false;
            that.errorTitle = 'Error sharing file: ' + filename;
            that.errorBody = throwable.getMessage();
            that.showError = true;
            });
        } else {
            var doShare = function(theParent) {
                that.context.shareWriteAccessWith(that.files[0], filepath, theParent, usersToShareWith)
                .thenApply(function(b) {
                    that.showSpinner = false;
                    that.showMessage("Success!", "Secure sharing complete");
                    that.resetTypeahead();
                    that.close();
                    console.log("shared write access to " + filename);
                    that.refresh();
                }).exceptionally(function(throwable) {
                    that.resetTypeahead();
                    that.showSpinner = false;
                    that.errorTitle = 'Error sharing file: ' + filename;
                    that.errorBody = throwable.getMessage();
                    that.showError = true;
                });
            };
            if (that.parent == null) {
                var path = '/' + that.path.slice(0, that.path.length-1).join('/');
                console.log("retrieving parent " + path);
                that.context.getByPath(path)
                .thenCompose(function(p){
                    console.log(p)
                    doShare(p.get());
                });
            } else
                doShare(that.parent);
        }
	},
	    setTypeAhead: function() {
            let allNames = this.followernames.slice();
            for(var i = 0; i < this.friendnames.length;i ++) {
                let friend = this.friendnames[i];
                if (allNames.indexOf(friend) == -1) {
                    allNames.push(friend);
                }
            }
            var engine = new Bloodhound({
              datumTokenizer: Bloodhound.tokenizers.whitespace,
              queryTokenizer: Bloodhound.tokenizers.whitespace,
              local: allNames
            });

            engine.initialize();

            $('#friend-name-input').tokenfield({
                minLength: 1,
                minWidth: 1,
                typeahead: [{hint: true, highlight: true, minLength: 1}, { source: suggestions }]
            });

            function suggestions(q, sync, async) {
                var matches, substringRegex;
                matches = [];
                substrRegex = new RegExp(q, 'i');
                $.each(allNames, function(i, str) {
                    if (substrRegex.test(str)) {
                        matches.push(str);
                    }
                });
                sync(matches);
            }
            let that = this;
            $('#friend-name-input').on('tokenfield:createtoken', function (event) {
                //only select from available items
            	var available_tokens = allNames;
            	var exists = true;
            	$.each(available_tokens, function(index, token) {
            		if (token === event.attrs.value)
            			exists = false;
            	});
            	if(exists === true) {
            		event.preventDefault();
                } else {
                    //do not allow duplicates in selection
                    var existingTokens = $(this).tokenfield('getTokens');
                    $.each(existingTokens, function(index, token) {
                        if (token.value === event.attrs.value)
                            event.preventDefault();
                    });
                }
            });
            $('#friend-name-input').on('tokenfield:createdtoken', function (event) {
        	    that.targetUsernames.push(event.attrs.value);
            });

            $('#friend-name-input').on('tokenfield:removedtoken', function (event) {
        	    that.targetUsernames.pop(event.attrs.value);
            });
        }
    }
}
