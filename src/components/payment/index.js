module.exports = {
    template: require('payment.html'),
    data: function() {
        return {
            unit:"GiB",
            space:"",
	    paymentUrl:null,
	    showCard:false,
            error: "",
            isError:false,
            errorClass: ""
        };
    },
    props: ['context', 'quota', 'usage', 'paymentProperties', 'updateQuota'],
    created: function() {
	this.updateError();
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

        requestStorage: function(bytes) {
	    var that = this;
            this.context.requestSpace(bytes).thenApply(x => that.updateQuota())
		.thenApply(x => that.updateError());
        },

	updateError: function() {
	    if (this.paymentProperties.hasError()) {
		this.isError = true;
		this.error = this.paymentProperties.getError();
	    } else
		this.isError = false;
	},

        updateCard: function() {
	    var that = this;
	    this.context.getPaymentProperties(true).thenApply(function(props) {
		that.paymentUrl = props.getUrl() + "&username=" + that.context.username + "&client_secret=" + props.getClientSecret();
		that.showCard = true;
	    });
        },

        close: function() {
            this.$emit("hide-payment");
        }
    }
}
