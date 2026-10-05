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
        /** Whether a write failed only because another write to the same account got in
         *  first, which the step that lost leaves unwritten. */
        isWriteConflict(e) {
            return /CAS exception|CasException/.test(this.errText(e));
        },
        /** Takes a write again while it keeps losing a compare-and-set to another write the
         *  app makes to the same account at the same moment - the social state an account
         *  settles after signing in among them - rather than leaving the user to press the
         *  button again. attempt returns a fresh future each time it is called. */
        retryOnConflict(attempt, tries) {
            let future = peergos.shared.util.Futures.incomplete();
            let left = tries == null ? 3 : tries;
            let fail = e => {
                if (--left > 0 && this.isWriteConflict(e))
                    setTimeout(run, 1000);
                else
                    future.completeExceptionally(e);
                return null;
            };
            // a throw from attempt itself fails the future too, rather than leaving it pending
            let run = () => {
                try {
                    attempt().thenApply(r => future.complete(r)).exceptionally(fail);
                } catch (e) {
                    future.completeExceptionally(e);
                }
            };
            run();
            return future;
        },
    },
};
