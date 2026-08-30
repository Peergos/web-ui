module.exports = {
    methods: {
        detectOs: function() {
            const ua = navigator.userAgent || "";
            if (/Android/i.test(ua))                          return "Android";
            if (/Windows/i.test(ua))                          return "Windows";
            if (/Mac OS X|Macintosh|Mac_PowerPC/i.test(ua))   return "MacOS";
            return "Linux";
        },

        // Sends user feedback with the email follow-up consent, OS and Peergos version appended,
        // trimmed to fit the maximum server message size
        sendUserFeedback: function(context, feedback, allowEmailFollowup) {
            let that = this;
            return context.getVersion()
                .exceptionally(e => "unknown")
                .thenCompose(version => {
                    var maxContentSize = peergos.shared.user.ServerMessage.MAX_CONTENT_SIZE;
                    var suffix = (allowEmailFollowup ? "\nemail: yes" : "") + "\nOS: " + that.detectOs()
                        + "\nVersion: " + version;
                    var maxFeedbackSize = maxContentSize - suffix.length;
                    var trimmedContents = (feedback.length > maxFeedbackSize ? feedback.substring(0, maxFeedbackSize) : feedback) + suffix;
                    return context.sendFeedback(trimmedContents);
                });
        }
    }
}
