/* The server could not be reached. A java client's exception names the cause; through a
 * local server the browser gets its message, url encoded; the browser's own fetch says
 * "Failed to fetch". */
const MARKS = [
    "ConnectException", "UnknownHostException",
    "Failed to connect", "Failed+to+connect",
    "Unable to resolve host", "Unable+to+resolve+host",
    "Failed to fetch", "NetworkError",
];

module.exports = {
    methods: {
        isOfflineError(error) {
            if (error == null)
                return false;
            let text;
            try {
                text = "" + (error.getMessage != null ? error.getMessage() : error.message != null ? error.message : error);
            } catch (e) {
                text = "" + error;
            }
            return MARKS.some(mark => text.indexOf(mark) >= 0);
        },
        // Records an error that means the server is out of reach; says whether it was one.
        noteOffline(error) {
            if (! this.isOfflineError(error))
                return false;
            this.$store.commit("SET_OFFLINE", true);
            return true;
        },
    },
};
