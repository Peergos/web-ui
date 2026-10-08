<template>
    <div ref="root" class="feed-tile" :style="failed ? null : {height: height + 'px'}">
        <div v-if="!ready" class="feed-tile__placeholder">
            <slot></slot>
        </div>
        <iframe v-if="live && builtin" ref="frame" :src="frameSrc" v-show="ready"
            class="feed-tile__frame" :title="entry.fullName"
            sandbox="allow-scripts allow-same-origin" allow="" frameBorder="0" scrolling="no"></iframe>
        <AppTile v-if="live && !builtin" v-show="ready" :entry="entry" :appName="tileApp.name"
            @resize="resize" @ready="onReady" @open="onOpen" @failed="fail"></AppTile>
    </div>
</template>

<script>
const AppTile = require("AppTile.vue");

const TILE_MIN = 64;
const TILE_MAX = 480;
const MAX_TILE_FILE_BYTES = 256 * 1024;
const READY_TIMEOUT_MS = 15000;
const DEFAULT_APP_TILE_HEIGHT = 160;

// The page each built-in app draws its tiles with, on that app's own origin.
const BUILTIN_TILES = {
    calendar: {subdomain: 'calendar', page: '/apps/calendar/tile.html', height: 96},
};

module.exports = {
    components: {
        AppTile,
    },
    props: {
        entry: {type: Object, required: true},
        tileApp: {type: Object, required: true},
        budget: {type: Object, required: true},
    },
    emits: ['open'],
    data: function() {
        let builtin = this.tileApp.kind == 'builtin';
        let app = builtin ? BUILTIN_TILES[this.tileApp.name] : null;
        return {
            builtin: builtin,
            app: app,
            live: false,
            ready: false,
            failed: false,
            height: builtin ? app.height : (this.tileApp.height || DEFAULT_APP_TILE_HEIGHT),
            contents: null,
        };
    },
    computed: {
        ...Vuex.mapState([
            'context',
            'isDark',
        ]),
        ...Vuex.mapGetters([
            'currentTheme',
        ]),
        frameOrigin: function() {
            if (! this.builtin) return null;
            return window.location.protocol + "//" + this.app.subdomain + "." + window.location.host;
        },
        frameSrc: function() {
            if (! this.builtin) return null;
            let theme = this.currentTheme;
            return this.frameOrigin + this.app.page + (theme ? "?theme=" + encodeURIComponent(theme) : "");
        },
    },
    watch: {
        isDark() {
            this.post({type: 'setTheme', currentTheme: this.currentTheme});
        }
    },
    created: function() {
        let that = this;
        // What the budget sees: the component itself carries reactive state the
        // budget has no business touching.
        this.handle = {
            key: this.builtin ? null : 'app:' + this.tileApp.name,
            distance: () => that.distance(),
            grant: () => that.mount(),
            evict: () => that.unmount(),
        };
        this.messageListener = function(e) {
            let frame = that.$refs.frame;
            if (frame == null || e.source !== frame.contentWindow) return;
            if (e.origin !== that.frameOrigin) return;
            if (e.data == null || typeof e.data !== 'object') return;
            let handler = that.handlers[e.data.type];
            if (handler != null) handler.call(that, e.data);
        };
        this.handlers = Object.assign(Object.create(null), {
            hello: function() { this.sendFile(); },
            pong: function() {},
            resize: function(data) { this.resize(data.height); },
            ready: function() { this.onReady(); },
            open: function() { this.onOpen(); },
        });
    },
    mounted: function() {
        window.addEventListener('message', this.messageListener);
        // Mounted about a screen ahead, unmounted only once well past, so a
        // small scroll back and forth does not reload the frame.
        this.nearObserver = new IntersectionObserver(entries => {
            if (entries[entries.length - 1].isIntersecting)
                this.requestSlot();
        }, {rootMargin: '100% 0px'});
        this.farObserver = new IntersectionObserver(entries => {
            if (! entries[entries.length - 1].isIntersecting) {
                this.budget.withdraw(this.handle);
                this.unmount();
            }
        }, {rootMargin: '300% 0px'});
        this.nearObserver.observe(this.$refs.root);
        this.farObserver.observe(this.$refs.root);
    },
    beforeUnmount: function() {
        this.nearObserver.disconnect();
        this.farObserver.disconnect();
        window.removeEventListener('message', this.messageListener);
        clearTimeout(this.readyTimer);
        this.budget.withdraw(this.handle);
        this.unmount();
    },
    methods: {
        resize: function(height) {
            let h = Number(height);
            if (! isFinite(h)) return;
            this.height = Math.max(TILE_MIN, Math.min(TILE_MAX, Math.round(h)));
        },
        onReady: function() {
            clearTimeout(this.readyTimer);
            this.ready = true;
        },
        onOpen: function() {
            this.$emit('open', this.entry);
        },
        distance: function() {
            let root = this.$refs.root;
            if (root == null) return Infinity;
            let rect = root.getBoundingClientRect();
            return Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);
        },
        requestSlot: function() {
            if (this.failed || this.live) return;
            if (this.budget.request(this.handle))
                this.mount();
        },
        mount: function() {
            if (this.failed || this.live) return;
            this.live = true;
            this.ready = false;
            let that = this;
            clearTimeout(this.readyTimer);
            this.readyTimer = setTimeout(() => that.fail(), READY_TIMEOUT_MS);
        },
        unmount: function() {
            clearTimeout(this.readyTimer);
            let wasLive = this.live;
            this.live = false;
            this.ready = false;
            if (wasLive)
                this.budget.release(this.handle);
        },
        // The placeholder is what stays: a tile that cannot draw is no worse
        // than the feed was before tiles.
        fail: function() {
            this.failed = true;
            this.unmount();
        },
        post: function(obj) {
            let frame = this.$refs.frame;
            if (frame == null || frame.contentWindow == null) return;
            frame.contentWindow.postMessage(obj, this.frameOrigin);
        },
        sendFile: function() {
            let that = this;
            this.post({type: 'ping', currentTheme: this.currentTheme});
            this.readContents().thenApply(function(text) {
                if (text == null) {
                    that.fail();
                    return null;
                }
                that.post({type: 'show', contents: text, name: that.entry.fullName,
                    owner: that.entry.owner, sharer: that.entry.sharer,
                    modified: String(that.entry.file.getFileProperties().modified)});
                return null;
            });
        },
        readContents: function() {
            if (this.contents != null)
                return peergos.shared.util.Futures.of(this.contents);
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let file = this.entry.file;
            let props = file.getFileProperties();
            let size = props.sizeLow() < 0 ? props.sizeLow() + Math.pow(2, 32) : props.sizeLow();
            if (props.sizeHigh() != 0 || size > MAX_TILE_FILE_BYTES) {
                future.complete(null);
                return future;
            }
            file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read) {})
                .thenCompose(function(reader) {
                    let data = convertToByteArray(new Int8Array(size));
                    return reader.readIntoArray(data, 0, data.length).thenApply(function(read) {
                        that.contents = new TextDecoder().decode(data);
                        future.complete(that.contents);
                        return null;
                    });
                }).exceptionally(function(throwable) {
                    future.complete(null);
                    return null;
                });
            return future;
        },
    },
};
</script>

<style>
.feed-tile {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    max-width: 480px;
    transition: height .15s ease;
}

.feed-tile__placeholder {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 100%;
}

.feed-tile__frame {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    /* Matches the tile's own corners: a frame whose colour scheme differs from the
       page's is painted on an opaque backdrop, which would show past them. */
    border-radius: 10px;
    background: transparent;
}
</style>
