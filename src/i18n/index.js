const enGB = require("en-GB.js")
const fr = require("fr.js")
const it = require("it.js")
const zhCN = require("zh-CN.js")

const supported = ["en-GB", "zh-CN"]
const supported_prefixes = ["it", "fr"]
module.exports = {

    methods: {
        translate(label, locale) {
            if (locale == null)
                locale = navigator.language;
            if (! supported.includes(locale)) {
                isSupportedPrefix = false;
                for (var i=0; i < supported_prefixes.length; i++)
                    if (locale == supported_prefixes[i] || locale.startsWith(supported_prefixes[i]+"-")) {
                        isSupportedPrefix = true;
                        locale = supported_prefixes[i];
                    }
                if (! isSupportedPrefix)
                    locale = "en-GB";
            }
            if (locale == "en-GB") {
                const res = enGB[label];
                if (res != null)
                    return res;
            }
            if (locale== "fr") {
                const res = fr[label];
                if (res != null)
                    return res;
            }
            if (locale== "it") {
                const res = it[label];
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
