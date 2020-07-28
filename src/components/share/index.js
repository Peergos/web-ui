module.exports = {
    template: require('share.html'),
    data: function() {
        return {
            showSpinner: false,
            targetUsername: "",
            targetUsernames: [],
            sharedWithAccess: "Read",
            errorTitle:'',
            errorBody:'',
            showError:false,
            unsharedReadAccessNames: [],
            unsharedEditAccessNames: []
        }
    },
    props: ['data', 'followernames', 'files', 'parent', 'path', 'context', 'messages'],
    created: function() {
        Vue.nextTick(this.setTypeAhead);
    },
    methods: {
        close: function () {
            this.showSpinner = false;
            this.$emit("hide-share-with");
        },

        unshare : function (sharedWithAccess) {
            if (this.files.length == 0)
                return this.close();
            if (this.files.length != 1)
                throw "Unimplemented multiple file share call";

            var that = this;
            this.showSpinner = true;
            var filename = that.files[0].getFileProperties().name;
            if(sharedWithAccess == "Read") {

                this.context.unShareReadAccess(this.files[0], this.unsharedReadAccessNames)
                    .thenApply(function(b) {
                        that.showSpinner = false;
                        that.messages.push({
                            title: "Success!",
                            body: "Read access revoked",
                            show: true
                        });
                        that.close();
                        console.log("unshared read access to " + that.files[0].getFileProperties().name + " with " + that.unsharedReadAccessNames);
                        that.$emit("update-shared-refresh");
                    }).exceptionally(function(throwable) {
                        that.showSpinner = false;
                        that.errorTitle = 'Error unsharing file: ' + filename;
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                    });

            } else {
                this.context.unShareWriteAccess(this.files[0], this.unsharedEditAccessNames)
                    .thenApply(function(b) {
                        that.showSpinner = false;
                        that.messages.push({
                            title: "Success!",
                            body: "Read & Write access revoked",
                            show: true
                        });
                        that.close();
                        console.log("unshared write access to " + that.files[0].getFileProperties().name + " with " + that.unsharedEditAccessNames);
                        that.$emit("update-shared-refresh");
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
	shareWith: function(sharedWithAccess) {
            if (this.files.length == 0)
		return this.close();
            if (this.files.length != 1)
		throw "Unimplemented multiple file share call";
	    
            if (! this.allowedToShare(this.files[0]))
		return;
        if (this.targetUsernames.slice() == 0) {
            return;
        }
        var that = this;
        this.showSpinner = true;
        let filePath = peergos.shared.user.UserContext.toPath(this.path, this.files[0].getFileProperties().name);
		this.context.sharedWith(filePath).thenApply(function(fileSharedWithState) {
            let read_usernames = fileSharedWithState.readAccess.toArray([]);
            let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
	        that.shareFileWith(sharedWithAccess, read_usernames, edit_usernames);
        }).exceptionally(function(throwable) {
            that.resetTypeahead();
            that.showSpinner = false;
            that.errorTitle = 'Error sharing file: ' + that.files[0].getFileProperties().name;
            that.errorBody = throwable.getMessage();
            that.showError = true;
        });
    },
    shareFileWith: function(sharedWithAccess, read_usernames, edit_usernames) {
        var that = this;
        var usersToShareWith = this.targetUsernames.slice();
        if (usersToShareWith.length == 0) {
            return;
        }
        for (var i = usersToShareWith.length - 1; i >= 0; i--) {
            let targetUsername = usersToShareWith[i];
            if(read_usernames.indexOf(targetUsername) > -1 || edit_usernames.indexOf(targetUsername) > -1) {
                usersToShareWith.splice(i, 1);
            }
        }
        if (usersToShareWith.length == 0) {
            that.messages.push({
                title: "Already shared!",
                body: "",
                show: true
            });
            return;
        }
        var filename = that.files[0].getFileProperties().name;
        var filepath = "/" + that.path.join('/') + "/" + filename;
        if (sharedWithAccess == "Read") {
            that.context.shareReadAccessWith(that.files[0], filepath, usersToShareWith)
            .thenApply(function(b) {
            that.showSpinner = false;
            that.messages.push({
                title: "Success!",
                body: "Secure sharing complete",
                show: true
            });
            that.close();
            that.resetTypeahead();
            console.log("shared read access to " + filename);
            that.$emit("update-shared-refresh");
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
                    that.messages.push({
                    title: "Success!",
                    body: "Secure sharing complete",
                    show: true
                    });
                    that.resetTypeahead();
                    that.close();
                    console.log("shared write access to " + filename);
                    that.$emit("update-shared-refresh");
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
            let followernames = this.followernames;
            var engine = new Bloodhound({
              datumTokenizer: Bloodhound.tokenizers.whitespace,
              queryTokenizer: Bloodhound.tokenizers.whitespace,
              local: followernames
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
                $.each(followernames, function(i, str) {
                    if (substrRegex.test(str)) {
                        matches.push(str);
                    }
                });
                sync(matches);
            }
            let that = this;
            $('#friend-name-input').on('tokenfield:createtoken', function (event) {
                //only select from available items
            	var available_tokens = that.followernames;
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
