module.exports = {
    template: require('error.html'),
    props: ['show', 'title', 'body'],
    created: function() {
    },
    methods: {
        decodeError: function(errorBody) {
            let str = decodeURIComponent(errorBody);
            let token = 'java.lang.JsException: ';
            return str.startsWith(token) ? str.substring(token.length) : str;
        },
        close: function () {
            this.show = false;
        }
    }
}
