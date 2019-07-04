module.exports = {
    template: require('progressbar.html'),
    data: function() {
        return {
        }
    },
    props: ['title', 'done', 'max'],
    created: function() {
    },
    methods: {
        closeMessage: function() {
            this.$emit("hide-progress");
        }
    }
}
