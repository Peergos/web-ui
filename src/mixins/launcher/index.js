module.exports = {
    methods: {
        loadLauncherShortcutsFile: function(launcherApp) {
            let that = this;
            let filePath = peergos.client.PathUtils.directoryToPath(['shortcuts.json']);
            return launcherApp.readInternal(filePath).thenApply(data => {
                return JSON.parse(new TextDecoder().decode(data));
            }).exceptionally(function(throwable) {//File not found
                that.showSpinner = false;
                if (throwable.detailMessage.startsWith("File not found")) {
                    let props = new Object();
                    props.shortcuts = [];
                    return props;
                } else {
                    that.showMessage(true, "Unable to load shortcuts");
                }
            });
        },
        updateLauncherShortcutsFile: function(launcherApp, json) {
            let filePath = peergos.client.PathUtils.directoryToPath(['shortcuts.json']);
            let encoder = new TextEncoder();
            let uint8Array = encoder.encode(JSON.stringify(json));
            let bytes = convertToByteArray(uint8Array);
            return launcherApp.writeInternal(filePath, bytes);
        },
	}
}
