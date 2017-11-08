module.exports = {
    template: require('shared-with-modal.html'),
    props: ['show', 'data', 'files', 'context', 'forceshared'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        } ,
        unshare : function (targetUsername) {
            if (this.files.length == 0)
                return this.close();
            if (this.files.length != 1)
                throw "Unimplemented multiple file share call";

            var that = this;
            this.context.unShare(this.files[0], targetUsername)
            .thenApply(function(b) {
                console.log("unshared " + that.files[0].getFileProperties().name + " with " + targetUsername);
                that.forceshared++;
            });

        }
    }
}
