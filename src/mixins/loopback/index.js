module.exports = {
    isLoopbackHost(hostname) {
        if (hostname == null)
            return false;
        if (hostname === "localhost" || hostname === "::1" || hostname === "[::1]")
            return true;
        if (hostname.endsWith(".localhost"))
            return true;
        return /^127(?:\.\d{1,3}){3}$/.test(hostname);
    }
}
