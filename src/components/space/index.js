module.exports = {
    template: require('space.html'),
    data: function() {
        return {
	    unit:"GiB",
	    space:"",
            error: "",
            isError:false,
            errorClass: ""
        };
    },
    props: ['show', 'context', 'quota', 'usage'],
    created: function() {
    },
    methods: {
	getQuota: function() {
	    return this.quota;
	},

	getRequestedBytes: function() {
	    if (this.unit == "GiB")
		return this.space*1024*1024*1024;
	    return this.space*1024*1024;
	},
	
        validateSpace: function() {
	    var bytes = parseInt(this.getRequestedBytes())
	    if (bytes != this.getRequestedBytes()) {
		this.isError = true;
		this.error = "Space must be a positive integer!";
		this.errorClass = "has-error has-feedback alert alert-danger";
		return false;
	    }
	    if (bytes < this.usage) {
		this.isError = true;
		this.error = "You can't request space smaller than your current usage, please delete some files and try again.";
		this.errorClass = "has-error has-feedback alert alert-danger";
		return false;
	    }
	    this.isError = false;
	    this.errorClass = "";
	    return true;
        },

	requestStorage: function () {
	    if (! this.validateSpace())
		return;
            this.context.requestSpace(this.getRequestedBytes()).thenApply(x => close())
        },
        close: function () {
            this.show = false;
        }
    }
}
