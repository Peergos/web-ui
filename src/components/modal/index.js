module.exports = {
    template: require('modal.html'),
    data: function() {
        return {
            urlLinks:[]
        }
    },
    props: ['title', 'links'],
    created: function() {
        let that = this;
        this.links.forEach(link => {
            let href = that.buildHref(link);
            that.urlLinks.push({id: link.id, fileLink: link.fileLink, href : href, name: link.name
            , isFile: link.isFile, autoOpen: false});
        });
    },
    methods: {
        buildHref: function (link) {
            let json = {secretLink:true,link:link.fileLink};
            if (link.autoOpen) {
                json.open = true;
            }
            return window.location.origin + window.location.pathname + "#" + propsToFragment(json);
        },
        onAutoOpen: function (id) {
            let index = this.urlLinks.findIndex(v => v.id === id);
            let link = this.urlLinks[index];
            link.href = this.buildHref(link);
        },
        copyUrlToClipboard: function (clickEvent) {
            var text = clickEvent.srcElement.previousElementSibling.value.toString();
            navigator.clipboard.writeText(text).then(function() {}, function() {
              console.error("Unable to write to clipboard.");
            });
        }
    }
}
