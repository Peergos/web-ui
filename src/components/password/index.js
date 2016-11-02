module.exports = {
    template: require('password.html'),
    data: function() {
	return {
	    existing: "",
	    pw1: "",
	    pw2: ""
	};
    },
    props: ['show', 'changepassword'],
    created: function() {
    },
    methods: {
	close: function () {
	    this.show = false;
	    if (this.pw1 == this.pw2)
		this.changepassword(this.existing, this.pw1);
	}
    }
}
