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
            that.urlLinks.push({id: link.id, origHref: link.href, href: link.href, name: link.name
            , isFile: link.isFile, autoOpen: false});
        });
    },
    methods: {
        onAutoOpen: function (id) {
            let index = this.urlLinks.findIndex(v => v.id === id);
            let link = this.urlLinks[index];
            link.href = link.autoOpen ? link.origHref.slice(0, link.origHref.length -3)
                    + '%2c%22open%22:true' + link.origHref.slice(link.origHref.length -3)
                    : link.origHref;
        },
        copyUrlToClipboard: function (clickEvent) {
            var text = clickEvent.srcElement.previousElementSibling.value.toString();
            navigator.clipboard.writeText(text).then(function() {}, function() {
              console.error("Unable to write to clipboard.");
            });
        }
    }
}
