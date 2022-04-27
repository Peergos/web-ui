module.exports = {
    methods: {
        loadBookmarksFile: function(launcherApp) {
            return this.loadJsonMapFile(launcherApp, 'bookmarks.json');
        },
        updateBookmarksFile: function(launcherApp, shortcutsMap) {
            return this.updateJsonMapFile(launcherApp, 'bookmarks.json', shortcutsMap);
        },
        loadShortcutsFile: function(launcherApp) {
            return this.loadJsonMapFile(launcherApp, 'shortcuts.json');
        },
        updateShortcutsFile: function(launcherApp, shortcutsMap) {
            return this.updateJsonMapFile(launcherApp, 'shortcuts.json', shortcutsMap);
        },
        loadJsonMapFile: function(launcherApp, filenaname) {
            let that = this;
            let filePath = peergos.client.PathUtils.directoryToPath([filenaname]);
            return launcherApp.readInternal(filePath).thenApply(data => {
                let obj = JSON.parse(new TextDecoder().decode(data));
                let map = new Map(Object.entries(obj));
                return map;
            }).exceptionally(function(throwable) {//File not found
                that.showSpinner = false;
                if (throwable.detailMessage.startsWith("File not found")) {
                    return new Map();
                } else {
                    console.log('Unable to load file: ' + filenaname);
                    return new Map();
                }
            });
        },
        updateJsonMapFile: function(launcherApp, filename, map) {
            let obj = Object.fromEntries(map);
            let filePath = peergos.client.PathUtils.directoryToPath([filename]);
            let encoder = new TextEncoder();
            let uint8Array = encoder.encode(JSON.stringify(obj));
            let bytes = convertToByteArray(uint8Array);
            return launcherApp.writeInternal(filePath, bytes);
        },
	}
}
