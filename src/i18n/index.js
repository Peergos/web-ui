const enGB = require("en-GB.js")

const supported = ["en-GB"]
module.exports = {

    methods: {
        translate(label, locale) {
            if (locale == null)
                locale = navigator.language;
            if (!supported.includes(locale))
                locale = "en-GB";
            if (locale == "en-GB") {
                return enGB[label];
            }
        }
    }
}
