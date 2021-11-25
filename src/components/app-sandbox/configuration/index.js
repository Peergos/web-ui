module.exports = {
    data() {
	    return {
	        currentAppSchema: "1"
	    }
    },
    methods: {
        verifyJSONFile: function(file, appNames) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.readJSONFile(file).thenApply(res => {
                if (res == null) {
                    future.complete({props: null, errors: ['Unable to parse peergos-app.json. See console for details']});
                } else {
                    let props = res.app;
                    let errors = [];
                    if (props.schemaVersion == null) {
                        errors.push("Missing property schemaVersion");
                    }
                    let fields = ["displayName","name","majorVersion","minorVersion"
                        ,"description","author","supportAddress","fileExtensions","mimeTypes","iconFilename"];
                    fields.forEach(field => {
                        if (props.details[field] == null) {
                            errors.push("Missing property " + field);
                        }
                    });
                    if (errors.length == 0) {
                        if (props.schemaVersion != this.currentAppSchema) {
                            errors.push("Invalid schemaVersion property. Must be: " + this.currentAppSchema);
                        }
                        if (props.details.displayName.length > 15) {
                            errors.push("Invalid displayName property. Length must not exceed 15 characters");
                        }
                        if (props.details.name.length > 15) {
                            errors.push("Invalid name property. Length must not exceed 15 characters");
                        }
                        if (appNames.findIndex(v => v.displayName == props.details.displayName) >= 0
                            || appNames.findIndex(v => v.name == props.details.name) >= 0) {
                            errors.push("Existing app with same name already installed");
                        }
                        if (!props.details.name.match(/^[a-z\d\-_]+$/i)) {
                            errors.push("Invalid name property. Use only alphanumeric characters plus dash and underscore");
                        }
                        const majorVersion = Number(props.details.majorVersion);
                        if (!(majorVersion >= 0 && majorVersion < 1000)) {
                            errors.push("Invalid majorVersion property. Must be numeric between 1 and 999");
                        }
                        const minorVersion = Number(props.details.minorVersion);
                        if (!(minorVersion >= 0 && minorVersion < 1000)) {
                            errors.push("Invalid minorVersion property. Must be numeric between 1 and 999");
                        }
                        if (props.details.description.length > 100) {
                            errors.push("Invalid description property. Length must not exceed 100 characters");
                        }
                        let knownUsers = this.context.network.usernames.toArray([]);
                        if (knownUsers.findIndex(v => v == props.details.author) == -1) {
                            errors.push("Invalid author property. Property must be set to a known peergos user");
                        }
                        if (props.details.supportAddress.length > 100) {
                            errors.push("Invalid supportAddress property. Length must not exceed 100 characters");
                        }
                        if (!(props.details.fileExtensions.constructor === Array)) {
                            errors.push("Invalid fileExtensions property. Must be an array. Can be empty []");
                        }
                        if (!(props.details.mimeTypes.constructor === Array)) {
                            errors.push("Invalid fileExtensions property. Must be an array. Can be empty []");
                        }
                        let iconFilename = props.details.iconFilename;
                        if (iconFilename.lastIndexOf(".") == -1) {
                            errors.push("Invalid iconFilename property. Must be a regular filename");
                        }
                        let extension = iconFilename.substring(iconFilename.lastIndexOf(".") +1);
                        let validExtensions = ["gif","jpg","png"];
                        if (validExtensions.findIndex(v => v == extension) == -1) {
                            errors.push("Invalid iconFilename property. Must be of type .gif or .jpg or .png");
                        }
                    }
                    future.complete({props:props, errors: errors});
                }
            });
            return future;
        },
        readJSONFile: function(file) {
            let future = peergos.shared.util.Futures.incomplete();
            let props = file.getFileProperties();
            var low = props.sizeLow();
            if (low < 0) low = low + Math.pow(2, 32);
            let size = low + (props.sizeHigh() * Math.pow(2, 32));
            file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), (progress) => {}).thenApply(reader => {
                let data = convertToByteArray(new Int8Array(size));
                return reader.readIntoArray(data, 0, data.length).thenApply(read => {
                    try {
                        future.complete(JSON.parse(new TextDecoder().decode(data)));
                    } catch (ex) {
                        console.log(ex);
                        future.complete(null);
                    }
                });
            });
            return future;
        },
        readAllAppProperties: function(appDirectories) {
            let that = this;
            let accumulator = [];
            let future = peergos.shared.util.Futures.incomplete();
            if (appDirectories.length == 0) {
                future.complete(accumulator);
            }
            appDirectories.forEach(currentApp => {
                currentApp.getChild("peergos-app.json", this.context.crypto.hasher, this.context.network).thenApply(function(propFileOpt) {
                    that.readJSONFile(propFileOpt.get()).thenApply(res => {
                        accumulator.push(res);
                        if (accumulator.length == appDirectories.length) {
                            future.complete(accumulator);
                        }
                    });
                });
            });
            return future;
        },
        readAppProperties: function(appDirectories) {
            let future = peergos.shared.util.Futures.incomplete();
            this.readAllAppProperties(appDirectories).thenApply(props => {
                future.complete(props);
            });
            return future;
        }
    }
};
