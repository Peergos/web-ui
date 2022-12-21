module.exports = {
    methods: {
        loadShortcutsFile: function(launcherApp) {
            return this.loadJsonMapFile(launcherApp, 'shortcuts.json');
        },
        updateShortcutsFile: function(launcherApp, shortcutsMap) {
            return this.updateJsonMapFile(launcherApp, 'shortcuts.json', shortcutsMap);
        },
        loadJsonMapFile: function(launcherApp, filename) {
            let that = this;
            let filePath = peergos.client.PathUtils.directoryToPath([filename]);
            let future = peergos.shared.util.Futures.incomplete();

            launcherApp.existsInternal(filePath).thenApply(status => {
                if (status.value_0 != 0) {
                    future.complete(new Map());
                } else {
                    launcherApp.readInternal(filePath).thenApply(data => {
                        let obj = JSON.parse(new TextDecoder().decode(data));
                        let map = new Map(Object.entries(obj));
                        future.complete(map);
                    }).exceptionally(function(throwable) {//File not found
                        that.showSpinner = false;
                        if (throwable.detailMessage.startsWith("File not found")) {
                            future.complete(new Map());
                        } else {
                            console.log('Unable to load file: ' + filename);
                            future.complete(new Map());
                        }
                    });
                }
            });
            return future;
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
