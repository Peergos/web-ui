module.exports = {
    template: require('shared-with-modal.html'),
    data: function() {
        return {
            showSpinner: false,
            errorTitle:'',
            errorBody:'',
            showError:false
        }
    },
    props: ['show', 'data', 'files', 'context', 'forceshared'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
            this.showSpinner = false;
        } ,
        unshare : function (targetUsername, sharedWithAccess) {
            if (this.files.length == 0)
                return this.close();
            if (this.files.length != 1)
                throw "Unimplemented multiple file share call";

            var that = this;
            this.showSpinner = true;
            var filename = that.files[0].getFileProperties().name;
            if(sharedWithAccess == "Read") {
                this.context.unShareReadAccess(this.files[0], targetUsername)
                    .thenApply(function(b) {
                        that.showSpinner = false;
                        console.log("unshared read access to " + that.files[0].getFileProperties().name + " with " + targetUsername);
                        that.forceshared++;
                    }).exceptionally(function(throwable) {
                        that.showSpinner = false;
                        that.errorTitle = 'Error unsharing file: ' + filename;
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                    });

            } else {
                this.context.unShareWriteAccess(this.files[0], targetUsername)
                    .thenApply(function(b) {
                        that.showSpinner = false;
                        console.log("unshared write access to " + that.files[0].getFileProperties().name + " with " + targetUsername);
                        that.forceshared++;
                    }).exceptionally(function(throwable) {
                        that.showSpinner = false;
                        that.errorTitle = 'Error unsharing file: ' + filename;
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                    });
            }
        }
    }
}
