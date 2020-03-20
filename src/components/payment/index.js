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
    props: ['context', 'quota', 'usage', 'paymentProperties'],
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
            this.context.requestSpace(bytes).thenApply(x => that.close())
        },

        updateCard: function() {
            this.paymentUrl = this.paymentProperties.getUrl() + "/addcard.html?username=" + this.context.username;
	    this.showCard = true;
        },

        close: function() {
            this.$emit("hide-payment");
        }
    }
}
