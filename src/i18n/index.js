const enGB = require("en-GB.js")
const zhCN = require("zh-CN.js")

const supported = ["en-GB", "zh-CN"]
module.exports = {

    methods: {
        translate(label, locale) {
            if (locale == null)
                locale = navigator.language;
            if (!supported.includes(locale))
                locale = "en-GB";
            if (locale == "en-GB") {
                const res = enGB[label];
                if (res != null)
                    return res;
            }
            if (locale == "zh-CN") {
                const res = zhCN[label];
                if (res != null)
                    return res;
            }
            // default to enGB if language doesn't have an entry for this
            return enGB[label];
        }
    }
}
