module.exports = {
    template: require('admin.html'),
    data: function() {
        return {
            showSpinner: false 
        }
    },
    props: ['show', 'data', 'context'],
    created: function() {
    },
    methods: {
        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },

        approve: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.approveSpaceRequest(req)
                .thenApply(function(success) {
		    that.showSpinner = false;
                    that.showMessage("Space request approved!", "");
                    that.externalchange++;
                });
        },

        reject: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.rejectSpaceRequest(req)
                .thenApply(function(success) {
                    that.showMessage("Space request rejected!", "");
                    that.showSpinner = false;
                    that.externalchange++;
                });
        },

        close: function () {
            this.show = false;
        }
    }
}
