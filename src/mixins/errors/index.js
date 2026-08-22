// Turning a failure into something worth showing a user. A throwable that crossed
// the GWT boundary carries its text on detailMessage, and the server sends its
// errors as the java toString, class names and all.
module.exports = {
    methods: {
        errText(e) {
            if (e == null)
                return "Unknown error";
            if (e.detailMessage != null && e.detailMessage.length > 0)
                return e.detailMessage;
            if (e.message != null && e.message.length > 0)
                return e.message;
            return "" + e;
        },
        /** Strips the java class names a wrapped exception leaves in front of its message,
         *  however many times it was rewrapped. */
        cleanError(msg) {
            if (msg == null)
                return '';
            let out = ("" + msg).trim();
            let previous = null;
            while (out !== previous) {
                previous = out;
                out = out.replace(/^(?:[\w$]+\.)+[\w$]*(?:Exception|Error|Throwable):\s*/, '');
            }
            return out;
        },
    },
};
