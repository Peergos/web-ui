// Whether this device has a network at all, from the browser's own signal. It says
// nothing about the server being reachable, only that nothing can reach it from here.
module.exports = {
    data() {
        return {
            offline: false,
        };
    },
    created() {
        this.readNetworkState();
        window.addEventListener("online", this.readNetworkState);
        window.addEventListener("offline", this.readNetworkState);
    },
    destroyed() {
        window.removeEventListener("online", this.readNetworkState);
        window.removeEventListener("offline", this.readNetworkState);
    },
    methods: {
        readNetworkState() {
            this.offline = typeof navigator !== "undefined" && navigator.onLine === false;
        },
    },
};
