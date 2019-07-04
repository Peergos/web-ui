module.exports = {
    template: require('modal.html'),
    props: ['title', 'links'],
    created: function() {
    },
    methods: {
        copyUrlToClipboard: function (clickEvent) {
            var text = clickEvent.srcElement.previousElementSibling.value.toString();
            navigator.clipboard.writeText(text).then(function() {}, function() {
              console.error("Unable to write to clipboard.");
            });
        }
    }
}
