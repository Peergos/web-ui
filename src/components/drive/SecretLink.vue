<template>
    <transition name="modal">
        <div class="modal-mask" @click="$emit('hide-modal')">
            <div style="height:30%"></div>
            <div class="modal-container" @click.stop>
                
                <div class="modal-header">
                    <h3 id="modal-header-id">{{ title }}</h3>
                </div>
                
                <div class="modal-body">
                    <div class="container"><p style="word-wrap;break-all;">
                            <div v-for="link in urlLinks" style="font-size: 1.2em;">
                                <div v-if="link.isFile">
                                    <input type="checkbox" @change="onAutoOpen(link.id)" v-model="link.autoOpen">
                                    <label style="font-weight: normal;">Auto Open</label>
                                </div>
                                <strong><a v-bind:href="link.href">{{ link.name }}</a></strong>
                                <input v-bind:id="link.id" type="text" v-bind:value="link.href" style="display: none">
                                <button class="fa fa-clipboard" style="padding: 6px 12px; background-color:var(--bg);" @click="copyUrlToClipboard($event)">&nbsp;Copy to clipboard</button>
                                <button class="fa fa-envelope" style="padding: 6px 12px; background-color:var(--bg);" @click="email($event)">&nbsp;Share via email</button>
                        </p>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <slot name="footer">
                        <button
                            id='modal-button-id'
                            class="btn btn-success"
                            @click="$emit('hide-modal')">
                            OK
                        </button>
                    </slot>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
    module.exports = {
	data() {
	    return {
                urlLinks:[],
            };
	},
	props: [
	    "title",
	    "links",
            "username",
        ],
        created: function() {
            let that = this;
            this.links.forEach(link => {
                let href = that.buildHref(link, true);
                that.urlLinks.push({id: link.id, fileLink: link.fileLink, href : href, name: link.name
                                    , isFile: link.isFile, autoOpen: true});
            });
        },
        methods: {
            buildHref: function (link, autoOpenOverride) {
                let json = {secretLink:true,link:link.fileLink};
                if (autoOpenOverride || link.autoOpen) {
                    json.open = true;
                    if (link.isFile)
                        json.filename = link.filename;
                    else
                        json.path = link.path;
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
            },
            email: function() {
                var that = this;
                var body = "";
                var type;
                this.links.forEach(link => {
                    let href = that.buildHref(link, true);
                    body += "<a href='"+href+"'>" + link.name + "</a><br/>"
                    if (link.isFile)
                        type = "file";
                    else
                        type = "folder";
                });
                var subject = this.username + " shared a "+type+" with you!";
                var link = document.getElementById('downloadAnchor')
                link.href = "mailto:?body="+encodeURIComponent(body)+"&subject="+encodeURIComponent(subject);
                link.click()
            },
        }
    }
</script>
