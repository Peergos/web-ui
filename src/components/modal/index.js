module.exports = {
    template: require('modal.html'),
    props: ['show', 'title', 'links'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        },
        copyUrlToClipboard: function (clickEvent) {
            var text = clickEvent.toElement.previousElementSibling.value.toString();
            navigator.clipboard.writeText(text).then(function() {}, function() {
              console.error("Unable to write to clipboard.");
            });
        }
    }
}
