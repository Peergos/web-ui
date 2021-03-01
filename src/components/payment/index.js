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
    props: ['context', 'quota', 'quotaBytes', 'usage', 'paymentProperties', 'updateQuota'],
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

        isPro: function() {
            return this.quotaBytes/(1024*1024) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() > 0;
        },

        cancelPro: function() {
            this.requestStorage(0);
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
