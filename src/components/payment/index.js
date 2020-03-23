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
        },

        updateCard: function() {
            this.paymentUrl = this.paymentProperties.getUrl() + "/addcard.html?username=" + this.context.username + "&client_secret=" + this.paymentProperties.getClientSecret();
	    this.showCard = true;
        },

        close: function() {
            this.$emit("hide-payment");
        }
    }
}
