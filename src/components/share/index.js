module.exports = {
    template: require('share.html'),
    data: function() {
        return {
	    showSpinner: false,
            targetUsername: "",
            sharedWithAccess: "Read",
	    errorTitle:'',
            errorBody:'',
            showError:false
        }
    },
    props: ['show', 'followernames', 'files', 'parent', 'context', 'messages', 'shared', 'forceshared'],
    created: function() {
        Vue.nextTick(this.setTypeAhead);
    },
    methods: {
        close: function () {
            this.show = false;
            this.showSpinner = false;
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
	
	shareWith: function(targetUsername, sharedWithAccess) {
            if (this.files.length == 0)
		return this.close();
            if (this.files.length != 1)
		throw "Unimplemented multiple file share call";
	    
	    if (! this.allowedToShare(this.files[0]))
		return;
	    
            var that = this;
            this.showSpinner = true;
            this.context.getSocialState().thenApply(function(social){
		var followers = social.followerRoots.keySet().toArray([]);
		if(followers.indexOf(targetUsername) == -1) {
                    that.showSpinner = false;
                    that.messages.push({
			title: "Sharing not possible!",
			body: "Please add as a friend first",
			show: true
                    });
                    that.close();
		} else {
                    that.context.sharedWith(that.files[0]).thenApply(function(allSharedWithUsernames){
			var read_usernames = allSharedWithUsernames.left.toArray([]);
			var edit_usernames = allSharedWithUsernames.right.toArray([]);
			if(read_usernames.indexOf(targetUsername) > -1 || edit_usernames.indexOf(targetUsername) > -1) {
                            that.showSpinner = false;
                            that.messages.push({
				title: "Already shared!",
				body: "",
				show: true
                            });
			} else {
                            var filename = that.files[0].getFileProperties().name;
                            if(sharedWithAccess == "Read") {
				that.context.shareReadAccessWith(that.files[0], targetUsername)
                                    .thenApply(function(b) {
					that.showSpinner = false;
					that.messages.push({
                                            title: "Success!",
                                            body: "Sharing complete",
                                            show: true
					});
					that.close();
					console.log("shared read access to " + filename + " with " + targetUsername);
					that.forceshared++;
                                    }).exceptionally(function(throwable) {
					that.showSpinner = false;
					that.errorTitle = 'Error sharing file: ' + filename;
					that.errorBody = throwable.getMessage();
					that.showError = true;
                                    });
                            } else {
				that.context.shareWriteAccessWith(that.files[0], that.parent, targetUsername)
                                    .thenApply(function(b) {
					that.showSpinner = false;
					that.messages.push({
                                            title: "Success!",
                                            body: "Sharing complete",
                                            show: true
					});
					that.close();
					console.log("shared write access to " + filename + " with " + targetUsername);
					that.forceshared++;
                                    }).exceptionally(function(throwable) {
					that.showSpinner = false;
					that.errorTitle = 'Error sharing file: ' + filename;
					that.errorBody = throwable.getMessage();
					that.showError = true;
                                    });
                            }
			}
                    });
		}
            });
	},
	
	setTypeAhead: function() {
            var substringMatcher = function(strs) {
		return function findMatches(q, cb) {
                    var matches, substringRegex;
		    
                    //an array that will be populated with substring matches
                    matches = [];
		    
                    // regex used to determine if a string contains the substring `q`
                    substrRegex = new RegExp(q, 'i');
		    
                    // iterate through the pool of strings and for any string that
                    // contains the substring `q`, add it to the `matches` array
                    $.each(strs, function(i, str) {
			if (substrRegex.test(str)) {
                            matches.push(str);
			}
                    });
		    
                    cb(matches);
		};
            };

	    console.log("Share TYPEAHEAD:");
	    console.log(this.followernames);
	    $('#friend-name-input')
		.typeahead(
		    {
                        hint: true,
                        highlight: true,
                        minLength: 1
		    },
		    {
                        name: 'usernames',
                        source: substringMatcher(this.followernames)
		    });
	}
    }
}
