module.exports = {
    methods: {
        loadLauncherShortcutsFile: function(launcherApp) {
            let that = this;
            let filePath = peergos.client.PathUtils.directoryToPath(['shortcuts.json']);
            return launcherApp.readInternal(filePath).thenApply(data => {
                let obj = JSON.parse(new TextDecoder().decode(data));
                let map = new Map(Object.entries(obj));
                return map;
            }).exceptionally(function(throwable) {//File not found
                that.showSpinner = false;
                if (throwable.detailMessage.startsWith("File not found")) {
                    return new Map();
                } else {
                    that.showMessage(true, "Unable to load shortcuts");
                }
            });
        },
        updateLauncherShortcutsFile: function(launcherApp, shortcutsMap) {
            let obj = Object.fromEntries(shortcutsMap);
            let filePath = peergos.client.PathUtils.directoryToPath(['shortcuts.json']);
            let encoder = new TextEncoder();
            let uint8Array = encoder.encode(JSON.stringify(obj));
            let bytes = convertToByteArray(uint8Array);
            return launcherApp.writeInternal(filePath, bytes);
        },
	}
}
