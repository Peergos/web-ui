module.exports = {
    template: require('messagebar.html'),
    data: function() {
        return {
        }
    },
    props: ['context', 'id', 'date', 'title'],
    created: function() {
    },
    methods: {
        closeMessage: function() {
            console.log("acknowledge message id: " + this.id);

            this.$emit("hide-message");
        }
    }
}
