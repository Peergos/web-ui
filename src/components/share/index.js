module.exports = {
    template: require('share.html'),
    data: function() {
        return {
            targetUsername: "",
	    errorTitle:'',
            errorBody:'',
            showError:false
        }
    },
    props: ['show', 'files', 'context', 'messages', 'shared'],
    created: function() {
        Vue.nextTick(this.setTypeAhead);
    },
    methods: {
        close: function () {
            this.show = false;
        },

        shareWith: function(targetUsername) {
            if (this.files.length == 0)
                return this.close();
            if (this.files.length != 1)
                throw "Unimplemented multiple file share call";

            var that = this;
            this.context.getSocialState().thenApply(function(social){
                var followers = social.followerRoots.keySet().toArray([]);
                if(followers.indexOf(targetUsername) == -1) {
                    that.messages.push({
                        title: "Sharing not possible!",
                        body: "Please add as a friend first",
                        show: true
                    });
                    that.close();
                } else {
                    that.context.sharedWith(that.files[0]).thenApply(function(usernames){
                        var unames = usernames.toArray([]);
                        if(unames.indexOf(targetUsername) > -1) {
                            that.messages.push({
                                title: "Already shared!",
                                body: "",
                                show: true
                            });
                        } else {
			    var filename = that.files[0].getFileProperties().name;
                            that.context.shareWith(that.files[0], targetUsername)
                                .thenApply(function(b) {
                                    that.messages.push({
                                    title: "Success!",
                                    body: "Sharing complete",
                                    show: true
                                    });
                                    that.close();
                                    console.log("shared " + filename + " with " + targetUsername);
                                }).exceptionally(function(throwable) {
				    that.errorTitle = 'Error sharing file: ' + filename;
				    that.errorBody = throwable.getMessage();
				    that.showError = true;
				});;
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
            var usernames = this.usernames;
            // remove our username
            usernames.splice(usernames.indexOf(this.context.username), 1);
            console.log("TYPEAHEAD:");
            console.log(usernames);
            $('#friend-name-input')
                .typeahead(
                        {
                            hint: true,
                            highlight: true,
                            minLength: 1
                        },
                        {
                            name: 'usernames',
                            source: substringMatcher(usernames)
                        });
        },
    },
    computed: {
        usernames: function() {
            return this.context.network.usernames.toArray([]);
        }
    }
}
