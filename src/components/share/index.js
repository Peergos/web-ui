module.exports = {
    template: require('share.html'),
    data: function() {
        return {
	    targetUsername: ""
	}
    },
    props: ['show', 'files', 'context', 'usernames'],
    created: function() {
	this.setTypeAhead();
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

	    this.context.shareWith(this.files[0], targetUsername)
		.thenApply(b => console.log("shared " + this.files[0].getName() + " with " + targetUsername));
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
    }
}
