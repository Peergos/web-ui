module.exports = {
        template: require('modal.html'),
        props: ['show', 'title', 'shared_with_users'],
        created: function() {
        },
        methods: {
                close: function () {
                        this.show = false;
                }
        }
}
