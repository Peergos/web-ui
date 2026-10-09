<template>
    <iframe v-if="subdomain != null" ref="frame" :src="frameDomain + '/sandbox.html'"
        class="feed-tile__frame" :title="entry.fullName"
        allow="cross-origin-isolated" frameBorder="0" scrolling="no"></iframe>
</template>

<script>
const sandboxMixin = require("../../mixins/sandbox/index.js");
const sandboxResponses = require("../../mixins/sandbox/responses.js");

// Where a tile reads the one file it shows. Fixed, so the tile never names a path.
const TILE_FILE_PATH = "/peergos-api/v0/tile/file";
const MAX_TILE_FILE_BYTES = 16 * 1024 * 1024;
const PING_ATTEMPTS = 300;

// Types that become a document of their own if loaded directly: served as text
// instead, so a shared file can never be a page on the app's origin.
const DOCUMENT_TYPES = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml)/i;

// A custom app's tile: the app's own sandbox page on the app's own origin, with
// a host that answers far less than AppSandbox does. See tileRequestKind.
module.exports = {
    mixins: [sandboxMixin, sandboxResponses],
    props: {
        entry: {type: Object, required: true},
        appName: {type: String, required: true},
    },
    emits: ['resize', 'ready', 'open', 'failed'],
    data: function() {
        return {
            subdomain: null,
            appProps: null,
            initialised: false,
        };
    },
    computed: {
        ...Vuex.mapState([
            'isDark',
        ]),
        ...Vuex.mapGetters([
            'currentTheme',
        ]),
        frameDomain: function() {
            return window.location.protocol + "//" + this.subdomain + "." + window.location.host;
        },
        workspace: function() {
            return this.context.username + "/.apps/" + this.appName;
        },
    },
    watch: {
        isDark() {
            this.post({type: 'setTheme', theme: this.currentTheme});
        }
    },
    created: function() {
        let that = this;
        if (typeof Android === 'undefined' && ! window.crossOriginIsolated) {
            this.$emit('failed');
            return;
        }
        this.messageListener = e => that.onMessage(e);
        window.addEventListener('message', this.messageListener);
        this.readAppProperties(this.appName).thenApply(props => {
            if (props == null || props.tile == null) {
                that.$emit('failed');
                return null;
            }
            that.appProps = props;
            peergos.shared.user.App.getAppSubdomain(that.workspace, that.context.crypto.hasher).thenApply(subdomain => {
                that.subdomain = subdomain;
                Vue.nextTick(() => that.ping(PING_ATTEMPTS));
            });
            return null;
        });
    },
    beforeUnmount: function() {
        window.removeEventListener('message', this.messageListener);
        clearTimeout(this.pingTimer);
    },
    methods: {
        post: function(obj) {
            let frame = this.$refs.frame;
            if (frame == null || frame.contentWindow == null) return;
            frame.contentWindow.postMessage(obj, this.frameDomain);
        },
        postData: function(bytes) {
            this.post({type: 'respondToLoadedChunk', bytes: bytes});
        },
        ping: function(attempts) {
            if (this.initialised) {
                this.init();
                return;
            }
            if (attempts == 0) {
                this.$emit('failed');
                return;
            }
            this.post({type: 'ping'});
            this.pingTimer = setTimeout(() => this.ping(attempts - 1), 30);
        },
        init: function() {
            let allowUnsafeEvalInCSP = this.appProps.permissions.includes('CSP_UNSAFE_EVAL');
            this.post({type: 'init', appName: this.appName, appPath: '', allowBrowsing: false,
                theme: this.currentTheme, chatId: '', username: this.context.username,
                props: {appDevMode: false, allowUnsafeEvalInCSP: allowUnsafeEvalInCSP, isPathWritable: false,
                    htmlAnchor: '', tile: true, tilePage: this.appProps.tile.page, tileName: this.entry.fullName},
                lang: this.languageCode()});
        },
        onMessage: function(e) {
            let frame = this.$refs.frame;
            if (frame == null || e.source !== frame.contentWindow) return;
            if (e.origin !== this.frameDomain) return;
            let data = e.data;
            if (data == null || typeof data !== 'object') return;
            if (data.action == 'pong') {
                this.initialised = true;
            } else if (data.action == 'failedInit') {
                this.$emit('failed');
            } else if (data.action == 'actionRequest') {
                this.answer(String(data.filePath), String(data.requestId), String(data.api), String(data.apiMethod));
            } else if (data.action == 'tileResize') {
                this.$emit('resize', data.height);
            } else if (data.action == 'tileReady') {
                this.$emit('ready');
            } else if (data.action == 'tileOpen') {
                this.$emit('open');
            }
        },
        // The whole of what a tile may ask for, and so the security boundary: GETs
        // of the app's own files, and of the one file it shows. Everything else -
        // data, chat, mailbox, contacts, pickers, save, print, profile, grants,
        // install - is refused, as is any write.
        tileRequestKind: function(path, requestId, api, apiMethod) {
            if (api !== '' || apiMethod !== 'GET')
                return null;
            if (! (requestId.startsWith('GET-') || requestId.startsWith('HEAD-')))
                return null;
            if (path === TILE_FILE_PATH)
                return 'file';
            if (! path.startsWith('/') || path.startsWith('/peergos-api/') || path.startsWith('/peergos/'))
                return null;
            if (path.includes('/.') || path.includes('//') || path.includes('\\'))
                return null;
            return 'static';
        },
        answer: function(path, requestId, api, apiMethod) {
            let that = this;
            let headerFunc = (mimeType, streamingInfo, etag = null) => that.buildHeader(path, mimeType, requestId, streamingInfo, etag);
            headerFunc.isHead = requestId.startsWith('HEAD-');
            let refuse = () => that.buildResponse(headerFunc(), null, that.FORBIDDEN);
            try {
                let kind = this.tileRequestKind(path, requestId, api, apiMethod);
                if (kind == 'file')
                    this.serveTileFile(path, requestId, refuse);
                else if (kind == 'static')
                    this.serveAppFile(headerFunc, path, refuse);
                else
                    refuse();
            } catch (ex) {
                console.log('Tile request failed: ' + ex);
                refuse();
            }
        },
        serveTileFile: function(path, requestId, refuse) {
            let file = this.entry.file;
            let props = file.getFileProperties();
            if (props.isDirectory || props.sizeHigh() != 0 || props.sizeLow() > MAX_TILE_FILE_BYTES || props.sizeLow() < 0) {
                refuse();
                return;
            }
            let mimeType = DOCUMENT_TYPES.test(props.mimeType) ? 'text/plain' : props.mimeType;
            let headerFunc = (ignored, streamingInfo, etag = null) =>
                this.buildHeaderWithMime(path, mimeType, requestId, streamingInfo, etag);
            headerFunc.isHead = requestId.startsWith('HEAD-');
            this.readInFile(headerFunc, file);
        },
        serveAppFile: function(headerFunc, path, refuse) {
            let that = this;
            this.context.getByPath(this.workspace + "/assets" + path).thenApply(fileOpt => {
                if (fileOpt.ref == null) {
                    that.buildResponse(headerFunc(), null, that.FILE_NOT_FOUND);
                    return null;
                }
                let file = fileOpt.get();
                let props = file.getFileProperties();
                if (props.isDirectory || props.isHidden)
                    refuse();
                else
                    that.readInFile(headerFunc, file);
                return null;
            }).exceptionally(t => {
                refuse();
                return null;
            });
        },
    },
};
</script>
